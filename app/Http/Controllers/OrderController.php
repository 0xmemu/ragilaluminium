<?php

namespace App\Http\Controllers;

use App\Http\Requests\LookupOrderStatusApiRequest;
use App\Http\Requests\LookupOrderStatusRequest;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ShippingRecord;
use App\Services\ShippingService;
use App\Support\BankTransferInstructions;
use App\Support\OrderTrackingPresenter;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function __construct(private readonly ShippingService $shipping) {}

    public function confirmation(Request $request, string $order_number): Response|RedirectResponse
    {
        $confirmed = $request->session()->get('confirmed_orders', []);

        if (! in_array($order_number, $confirmed, true)) {
            return redirect()->route('order.status')
                ->with('success', 'Masukkan nomor order dan nomor HP untuk melihat status pesanan.');
        }

        $order = Order::where('order_number', $order_number)
            ->with('items')
            ->firstOrFail();

        $whatsappUrl = null;
        $phone = PhoneNumber::normalize(
            config('services.whatsapp.business_phone') ?: config('sitemap.brand.phone')
        );
        if ($phone) {
            $message = sprintf(
                'Halo Ragil Aluminium, saya sudah order %s. Mohon bantuannya.',
                $order->order_number,
            );
            $whatsappUrl = 'https://wa.me/'.$phone.'?text='.rawurlencode($message);
        }

        $paymentMethod = (string) $order->payment_method;
        $isTransfer = $paymentMethod === 'transfer';

        return Inertia::render('Public/OrderConfirmation', [
            'order' => [
                'order_number' => $order->order_number,
                'order_status' => $order->order_status,
                'payment_status' => $order->payment_status,
                'payment_method' => $paymentMethod,
                'shipping_status' => $order->shipping_status,
                'total_amount' => (float) $order->total_amount,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'items' => $order->items->map(fn ($i) => [
                    'product_name' => $i->product_name,
                    'quantity' => $i->quantity,
                    'line_total' => (float) $i->line_total,
                ])->all(),
            ],
            'payment_instructions' => $isTransfer
                ? BankTransferInstructions::forStorefront()
                : null,
            'whatsapp_url' => $whatsappUrl,
        ]);
    }

    public function statusForm(Request $request): Response
    {
        $orders = $this->sessionOrdersPayload($request);

        return Inertia::render('Public/OrderStatus', [
            'has_session_orders' => $orders !== [],
            'orders' => $orders,
            'order' => $orders[0] ?? null,
            'searched' => false,
        ]);
    }

    public function count(Request $request): JsonResponse
    {
        $confirmed = $this->confirmedOrderNumbers($request);

        if ($confirmed === []) {
            return response()->json(['count' => 0]);
        }

        $orderIds = Order::query()
            ->whereIn('order_number', $confirmed)
            ->pluck('id');

        $count = (int) OrderItem::query()
            ->whereIn('order_id', $orderIds)
            ->sum('quantity');

        return response()->json(['count' => $count]);
    }

    public function statusLookup(LookupOrderStatusRequest $request): Response
    {
        $validated = $request->validated();

        $order = $this->findGuestOrder($validated);

        if ($order) {
            $this->rememberConfirmedOrder($request, $order->order_number);
            $this->refreshShippingFromCarrier($order);
            $order->refresh()->load('items', 'shippingRecords');
        }

        $payload = $order ? $this->publicOrderPayload($order) : null;
        $orders = $order
            ? $this->sessionOrdersPayload($request)
            : [];

        return Inertia::render('Public/OrderStatus', [
            'searched' => true,
            'has_session_orders' => $orders !== [],
            'orders' => $orders,
            'order' => $payload,
        ]);
    }

    public function statusApi(LookupOrderStatusApiRequest $request, string $order_number): JsonResponse
    {
        $validated = $request->validated();

        $order = $this->findGuestOrder([
            'order_number' => $order_number,
            'customer_phone' => $validated['customer_phone'] ?? null,
            'customer_email' => $validated['customer_email'] ?? null,
        ]);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        $this->refreshShippingFromCarrier($order);
        $order->refresh()->load('items', 'shippingRecords');

        return response()->json($this->publicOrderPayload($order));
    }

    /**
     * @return list<string>
     */
    private function confirmedOrderNumbers(Request $request): array
    {
        return array_values(array_unique(array_filter(
            $request->session()->get('confirmed_orders', []),
            fn ($n) => is_string($n) && $n !== ''
        )));
    }

    private function rememberConfirmedOrder(Request $request, string $orderNumber): void
    {
        $confirmed = $this->confirmedOrderNumbers($request);
        $confirmed[] = $orderNumber;
        $request->session()->put('confirmed_orders', array_values(array_unique($confirmed)));
    }

    /**
     * Guest orders remembered on this browser (no login). Newest first.
     *
     * @return list<array<string, mixed>>
     */
    private function sessionOrdersPayload(Request $request): array
    {
        $numbers = $this->confirmedOrderNumbers($request);
        if ($numbers === []) {
            return [];
        }

        /** @var Collection<int, Order> $found */
        $found = Order::query()
            ->whereIn('order_number', $numbers)
            ->with(['items', 'shippingRecords'])
            ->get()
            ->keyBy('order_number');

        $payloads = [];
        foreach (array_reverse($numbers) as $number) {
            $order = $found->get($number);
            if (! $order) {
                continue;
            }
            $this->refreshShippingFromCarrier($order);
            $order->refresh()->load('items', 'shippingRecords');
            $payloads[] = $this->publicOrderPayload($order);
        }

        return $payloads;
    }

    /**
     * @param  array{order_number: string, customer_phone?: string|null, customer_email?: string|null}  $validated
     */
    private function findGuestOrder(array $validated): ?Order
    {
        $query = Order::where('order_number', $validated['order_number']);

        if (! empty($validated['customer_phone'])) {
            $query->where('customer_phone', PhoneNumber::normalize($validated['customer_phone']));
        }

        if (! empty($validated['customer_email'])) {
            $query->where('customer_email', $validated['customer_email']);
        }

        return $query->with('items', 'shippingRecords')->first();
    }

    /**
     * Guest order page: pull latest J&T track when a waybill exists (no login).
     * Skips if refreshed within 2 minutes to avoid hammering the carrier API.
     */
    private function refreshShippingFromCarrier(Order $order): void
    {
        $record = $order->shippingRecords
            ->filter(fn (ShippingRecord $row) => filled($row->waybill_number))
            ->sortByDesc(fn (ShippingRecord $row) => $row->last_status_at?->getTimestamp() ?? $row->id)
            ->first();

        if (! $record) {
            return;
        }

        if (
            $record->last_status_at
            && $record->last_status_at->gt(now()->subMinutes(2))
        ) {
            return;
        }

        $this->shipping->refreshStatus($record);
    }

    /**
     * @return array<string, mixed>
     */
    private function publicOrderPayload(Order $order): array
    {
        $shipping = $order->shippingRecords
            ->filter(fn (ShippingRecord $row) => filled($row->waybill_number))
            ->sortByDesc(fn (ShippingRecord $row) => $row->last_status_at?->getTimestamp() ?? $row->id)
            ->first()
            ?? $order->shippingRecords->first(
                fn (ShippingRecord $row) => $row->status !== 'cancelled'
            )
            ?? $order->shippingRecords->first();

        $tracking = OrderTrackingPresenter::forOrder($order, $shipping);

        return [
            'order_number' => $order->order_number,
            'order_status' => $order->order_status,
            'payment_status' => $order->payment_status,
            'payment_method' => $order->payment_method,
            'shipping_status' => $order->shipping_status,
            'total_amount' => (float) $order->total_amount,
            'customer_name' => $order->customer_name,
            'items' => $order->items->map(fn ($i) => [
                'product_name' => $i->product_name,
                'quantity' => $i->quantity,
                'line_total' => isset($i->line_total) ? (float) $i->line_total : null,
            ])->all(),
            'shipping' => $shipping ? [
                'carrier_name' => $shipping->carrier_name,
                'waybill_number' => $shipping->waybill_number,
                'status' => $shipping->status,
                'status_raw' => $shipping->status_raw,
                'tracking_url' => $shipping->tracking_url,
                'last_status_at' => $shipping->last_status_at?->toIso8601String(),
            ] : null,
            'tracking' => $tracking,
        ];
    }
}
