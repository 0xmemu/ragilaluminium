<?php

namespace App\Http\Controllers;

use App\Http\Requests\LookupOrderStatusApiRequest;
use App\Http\Requests\LookupOrderStatusRequest;
use App\Models\CmsTestimonial;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ShippingRecord;
use App\Services\OrderService;
use App\Services\ShippingService;
use App\Support\BankTransferInstructions;
use App\Support\ConsultationWhatsApp;
use App\Support\OrderEta;
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
    public function __construct(
        private readonly ShippingService $shipping,
        private readonly OrderService $orders,
    ) {}

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
        $phone = PhoneNumber::normalize(ConsultationWhatsApp::businessPhone());
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
                'created_at' => $order->created_at?->toIso8601String(),
                'items' => $order->items->map(fn ($i) => [
                    'product_name' => $i->product_name,
                    'product_id' => $i->product_id ? (int) $i->product_id : null,
                    'quantity' => $i->quantity,
                    'line_total' => (float) $i->line_total,
                    'note' => $i->note ?? null,
                    'parent_sku' => $i->parent_sku,
                    'variant_label' => collect([
                        [$i->variation_1_name, $i->variation_1_option],
                        [$i->variation_2_name, $i->variation_2_option],
                    ])->filter(fn ($p) => filled($p[0]) && filled($p[1]))->map(fn ($p) => $p[0].': '.$p[1])->implode(' · ') ?: null,
                ])->all(),
            ],
            'eta' => OrderEta::forOrder($order),
            'payment_instructions' => $isTransfer
                ? BankTransferInstructions::forStorefront()
                : null,
            'whatsapp_url' => $whatsappUrl,
        ]);
    }

    /**
     * Pembatalan oleh pembeli: hanya saat status masih "menunggu konfirmasi"
     * (pending). Identitas harus cocok (nomor order + HP), sama
     * seperti pencarian status, agar orang lain tidak bisa membatalkan pesanan.
     */
    public function cancel(LookupOrderStatusRequest $request, string $order_number): RedirectResponse
    {
        $validated = $request->validated();

        $order = $this->findGuestOrder([
            'order_number' => $order_number,
            'customer_phone' => $validated['customer_phone'] ?? null,
        ]);

        if (! $order) {
            return back()->withErrors([
                'cancel' => 'Nomor pesanan dan identitas tidak cocok. Periksa kembali data Anda.',
            ]);
        }

        if ($order->order_status !== 'awaiting_confirmation') {
            return back()->withErrors([
                'cancel' => 'Pesanan sudah diproses dan tidak dapat dibatalkan dari halaman ini.',
            ]);
        }

        $changed = $this->orders->cancel($order, null, 'Pembatalan oleh pembeli');

        return back()->with(
            $changed ? 'success' : 'error',
            $changed
                ? 'Pesanan '.$order->order_number.' dibatalkan. Stok dikembalikan ke katalog.'
                : 'Pesanan sudah dibatalkan sebelumnya.',
        );
    }

    public function index(Request $request): Response
    {
        $orders = $this->sessionOrdersPayload($request);

        return Inertia::render('Public/OrderList', [
            'has_session_orders' => $orders !== [],
            'orders' => $orders,
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

        $payload = $order ? $this->publicOrderPayload($order, true) : null;
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
        ]);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        $this->refreshShippingFromCarrier($order);
        $order->refresh()->load('items', 'shippingRecords');

        return response()->json($this->publicOrderPayload($order, true));
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
            $payloads[] = $this->publicOrderPayload($order, true);
        }

        return $payloads;
    }

    private function findGuestOrder(array $validated): ?Order
    {
        $query = Order::where('order_number', $validated['order_number']);

        if (! empty($validated['customer_phone'])) {
            $query->where('customer_phone', PhoneNumber::normalize($validated['customer_phone']));
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
    private function publicOrderPayload(Order $order, bool $includeReviewMeta = false): array
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
        $viewModel = new \App\Support\OrderTrackingViewModel($order, $shipping);

        // Phase D: blok retur customer-safe (tanpa internal reason; reason sdh
        // dirancang customer-facing di ReturnService::canCreateReturn).
        $returnBlock = [
            'eligible' => false,
            'reason' => null,
            'deadline' => null,
        ];
        $deliveredRecord = $shipping?->status === 'delivered' ? $shipping : $order->shippingRecords
            ->first(fn ($r) => $r->status === 'delivered' && $r->last_status_at !== null);
        $deliveredAt = $deliveredRecord?->last_status_at;
        if ($deliveredAt) {
            $eligibility = app(\App\Services\ReturnService::class)
                ->canCreateReturn($order, $deliveredRecord);
            $returnBlock = [
                'eligible' => (bool) ($eligibility['allowed'] ?? false),
                'reason' => $eligibility['reason'] ?? null,
                'deadline' => $eligibility['deadline'] ?? null,
            ];
        }

        $whatsappUrl = null;
        $returnWhatsappUrl = null;
        $businessPhone = PhoneNumber::normalize(\App\Support\ConsultationWhatsApp::businessPhone());
        if ($businessPhone) {
            $whatsappUrl = 'https://wa.me/'.$businessPhone.'?text='.rawurlencode(sprintf(
                'Halo Ragil Aluminium, saya mau bertanya soal order %s. Mohon bantuannya.',
                $order->order_number,
            ));
            $returnWhatsappUrl = 'https://wa.me/'.$businessPhone.'?text='.rawurlencode(sprintf(
                'Halo Ragil Aluminium, saya mau mengajukan retur untuk order %s. Mohon info prosedurnya.',
                $order->order_number,
            ));
        }

        return [
            'order_number' => $order->order_number,
            'order_status' => $order->order_status,
            'payment_status' => $order->payment_status,
            'payment_method' => $order->payment_method,
            'shipping_status' => $order->shipping_status,
            'total_amount' => (float) $order->total_amount,
            'billing' => [
                'subtotal' => (float) $order->subtotal_amount,
                'discount' => (float) $order->discount_amount,
                'voucher_discount' => (float) $order->voucher_discount_amount,
                'shipping_gross' => (float) $order->shipping_amount + (float) $order->shipping_subsidy_amount,
                'shipping_subsidy' => (float) $order->shipping_subsidy_amount,
                'shipping_net' => (float) $order->shipping_amount,
                'cod_fee' => (float) ($order->cod_fee_amount ?? 0),
                'insurance' => (float) ($order->shipping_insurance_amount ?? 0),
                'total' => (float) $order->total_amount,
            ],
            'customer_name' => $order->customer_name,
            'customer_phone' => $order->customer_phone,
            'shipping_address' => trim(implode(', ', array_filter([
                $order->shipping_address_line1,
                $order->shipping_address_line2 ?? null,
                $order->shipping_village,
                $order->shipping_district,
                $order->shipping_city,
                $order->shipping_province,
            ]))),
                'created_at' => $order->created_at?->toIso8601String(),
            'eta' => OrderEta::forOrder($order),
            'items' => $order->items->map(function ($i) {
                $img = $i->product?->media()->first();

                return [
                    'product_name' => $i->product_name ?: $i->product?->name,
                    'product_id' => $i->product_id ? (int) $i->product_id : null,
                    'quantity' => $i->quantity,
                    'line_total' => isset($i->line_total) ? (float) $i->line_total : null,
                    'note' => $i->note ?? null,
                    'parent_sku' => $i->parent_sku,
                    'variant_label' => collect([
                        [$i->variation_1_name, $i->variation_1_option],
                        [$i->variation_2_name, $i->variation_2_option],
                    ])->filter(fn ($p) => filled($p[0]) && filled($p[1]))->map(fn ($p) => $p[0].': '.$p[1])->implode(' · ') ?: null,
                    'image' => $img?->urlFor('thumb') ?? $img?->urlFor('card'),
                ];
            })->all(),
            'reviews' => $includeReviewMeta ? CmsTestimonial::query()->where('order_id', $order->id)->get(['id', 'order_id', 'product_id', 'rating', 'message', 'media_items', 'moderation_status', 'published', 'verified_at', 'author_type'])->map(fn (CmsTestimonial $review) => ['id' => $review->id, 'product_id' => $review->product_id ? (int) $review->product_id : null, 'rating' => (int) $review->rating, 'message' => (string) $review->message, 'media_items' => $review->mediaPayload(), 'moderation_status' => $review->moderation_status, 'published' => (bool) $review->published, 'verified_purchase' => $review->verified_at !== null, 'customer_authored' => $review->isCustomerAuthored()])->values()->all() : [],
            'shipping' => $shipping ? [
                'carrier_name' => $shipping->carrier_name,
                'waybill_number' => $shipping->waybill_number,
                'status' => $shipping->status,
                'tracking_url' => $shipping->tracking_url,
                'last_status_at' => $shipping->last_status_at?->toIso8601String(),
            ] : null,
            // Satu lapisan publik: 'tracking' kini = versi TERSANITASI (metadata
            // internal dibuang). UI memakai tracking_public / vm.* — jangan pernah
            // kirim raw $tracking (record_status/status_raw/source) ke pelanggan.
            'tracking' => self::publicTrackingSanitized($tracking, $shipping),
            'vm' => $viewModel->toArray(),
            'whatsapp_url' => $whatsappUrl,
            'delivered_at' => $deliveredAt?->toIso8601String(),
            'return_block' => $returnBlock,
            'return_whatsapp_url' => $returnWhatsappUrl,
            // Lapisan publik: sanitasi metadata internal yang bukan informasi customer.
            'tracking_public' => self::publicTrackingSanitized($tracking, $shipping),

        ];
    }

    /**
     * Sanitasi tracking utk publik: hapus source/detail/location raw + status_raw.
     *
     * @param  array<string, mixed>  $tracking
     * @return array<string, mixed>
     */
    private static function publicTrackingSanitized(array $tracking, ?ShippingRecord $shipping = null): array
    {
        unset($tracking['status_raw'], $tracking['record_status']);

        // Raw provider text (dari fallback timeline shipping record) tidak boleh
        // sampai ke UI customer; ganti dgn label aman generik.
        $rawValues = collect($shipping ? [$shipping->status_raw] : [])
            ->filter(fn ($v) => filled($v))
            ->values();

        if (isset($tracking['timeline']) && is_array($tracking['timeline'])) {
            $tracking['timeline'] = array_map(static function (array $entry) use ($rawValues): array {
                $message = (string) ($entry['message'] ?? '');
                if ($rawValues->contains($message)) {
                    $message = 'Status pengiriman diperbarui.';
                }
                $safe = [
                    'message' => $message,
                    'at' => $entry['at'] ?? null,
                ];
                // Hapus metadata internal; unknown scan selalu label aman dari presenter.
                unset($safe['source'], $safe['detail'], $safe['location']);

                return $safe;
            }, $tracking['timeline']);
        }

        return $tracking;
    }
}

