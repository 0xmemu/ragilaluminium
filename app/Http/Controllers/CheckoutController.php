<?php

namespace App\Http\Controllers;

use App\Http\Requests\ApplyCheckoutVoucherRequest;
use App\Http\Requests\PlaceOrderRequest;
use App\Http\Requests\StoreCheckoutDetailsRequest;
use App\Models\Order;
use App\Services\CartService;
use App\Services\OrderService;
use App\Services\ShippingService;
use App\Services\VoucherService;
use App\Support\CodSettings;
use App\Support\OperationalTelemetry;
use App\Support\OrderEta;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CheckoutController extends Controller
{
    private const IDEMPOTENCY_SESSION_KEY = 'checkout_idempotency_key';

    public function __construct(
        protected CartService $cart,
        protected OrderService $orders,
        protected ShippingService $shipping,
        protected VoucherService $vouchers,
    ) {}

    public function index(Request $request): Response
    {
        $this->prepareCheckoutIdempotencyKey($request);

        $priced = $this->cart->pricedLines($this->selectedCheckoutLineIds($request));
        $applied = $request->session()->get(VoucherService::SESSION_KEY);
        $voucherDiscount = 0.0;
        $voucherPayload = null;

        if (is_array($applied)) {
            try {
                $fresh = $this->vouchers->applyCodes(
                    $this->vouchers->codesFromPayload($applied),
                    (float) $priced['subtotal'],
                );
                $voucherDiscount = $fresh['discount'];
                $voucherPayload = $fresh;
                $request->session()->put(VoucherService::SESSION_KEY, $fresh);
            } catch (\DomainException) {
                $request->session()->forget(VoucherService::SESSION_KEY);
            }
        }

        $cod = CodSettings::get();
        $subtotalAfterVoucher = max(0, (float) $priced['subtotal'] - $voucherDiscount);
        $codFeePreview = $cod['enabled'] ? CodSettings::calculateFee($subtotalAfterVoucher) : 0.0;
        $codAllowed = $cod['enabled'];
        $codBlockReason = null;
        if ($cod['enabled'] && $cod['max_order_amount'] !== null && $cod['max_order_amount'] > 0
            && $subtotalAfterVoucher > $cod['max_order_amount']) {
            $codAllowed = false;
            $codBlockReason = 'Nilai belanja melebihi batas maksimal COD.';
        }

        $details = $request->session()->get('checkout_details');

        // Metode pembayaran pilihan pengguna tetap dipertahankan saat validasi alamat
        // (keputusan #24) — fallback ke COD bila tersedia, lalu transfer.
        $sessionPayment = (string) $request->session()->get('checkout_payment_method', '');
        $defaultPayment = in_array($sessionPayment, ['cod', 'transfer'], true)
            ? $sessionPayment
            : ($cod['enabled'] && $codAllowed ? 'cod' : 'transfer');

        $shippingPreview = null;
        if (is_array($details) && ! empty($details['city'])) {
            $breakdown = $this->shipping->estimateBreakdown(
                $this->orders->cartWeightKg(),
                (string) $details['city'],
                $details['province'] ?? null,
                $details['postal_code'] ?? null,
            );
            $shippingPreview = [
                'gross' => $breakdown['gross'],
                'subsidy' => $breakdown['subsidy'],
                'net' => $breakdown['net'],
                'applied' => $breakdown['applied'],
            ];
        }

        $items = collect($priced['items'])->map(function (array $item) {
            return [
                'line_id' => $item['line_id'],
                'name' => $item['name'],
                'quantity' => (int) ($item['quantity'] ?? 0),
                'line_total' => (float) ($item['line_total'] ?? 0),
                'unit_price' => (float) ($item['unit_price'] ?? 0),
                'compare_price' => isset($item['compare_price']) ? (float) $item['compare_price'] : null,
                'discount_percent' => isset($item['discount_percent']) ? (int) $item['discount_percent'] : null,
                'line_compare_total' => isset($item['line_compare_total']) ? (float) $item['line_compare_total'] : null,
                'line_discount' => (float) ($item['line_discount'] ?? 0),
                'flash_sale' => (bool) ($item['flash_sale'] ?? false),
                'note' => $item['note'] ?? null,
            ];
        })->all();

        return Inertia::render('Public/Checkout', [
            'items' => $items,
            'subtotal' => $priced['subtotal'],
            'compare_subtotal' => $priced['compare_subtotal'],
            'discount_total' => $priced['discount_total'],
            'voucher' => $voucherPayload,
            'voucher_discount' => $voucherDiscount,
            'cod' => [
                'enabled' => $cod['enabled'],
                'allowed' => $codAllowed,
                'block_reason' => $codBlockReason,
                'fee_type' => $cod['fee_type'],
                'fee_value' => $cod['fee_value'],
                'fee_amount' => $codFeePreview,
                'max_order_amount' => $cod['max_order_amount'],
            ],
            'shipping' => $shippingPreview,
            'eta' => OrderEta::forOrder(),
            'defaultPayment' => $defaultPayment,
            'details' => $details,
            'applyVoucherUrl' => route('checkout.voucher.apply'),
            'removeVoucherUrl' => route('checkout.voucher.remove'),
        ]);
    }

    public function applyVoucher(ApplyCheckoutVoucherRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $priced = $this->cart->pricedLines($this->selectedCheckoutLineIds($request));

        $current = $request->session()->get(VoucherService::SESSION_KEY);
        $codes = $this->vouchers->codesFromPayload($current);
        $codes[] = (string) $validated['code'];

        try {
            $applied = $this->vouchers->applyCodes($codes, (float) $priced['subtotal']);
        } catch (\DomainException $e) {
            return redirect()->route('checkout.index')->withErrors(['voucher' => $e->getMessage()]);
        }

        $request->session()->put(VoucherService::SESSION_KEY, $applied);

        return redirect()->route('checkout.index')->with('success', 'Voucher diterapkan.');
    }

    public function removeVoucher(Request $request): RedirectResponse
    {
        $current = $request->session()->get(VoucherService::SESSION_KEY);
        $removeCode = strtoupper(trim((string) $request->input('code', '')));
        $codes = $this->vouchers->codesFromPayload($current);

        if ($removeCode === '') {
            $request->session()->forget(VoucherService::SESSION_KEY);

            return redirect()->route('checkout.index')->with('success', 'Voucher dihapus.');
        }

        $remaining = array_values(array_filter($codes, fn (string $code): bool => $code !== $removeCode));
        if ($remaining === []) {
            $request->session()->forget(VoucherService::SESSION_KEY);

            return redirect()->route('checkout.index')->with('success', 'Voucher dihapus.');
        }

        try {
            $priced = $this->cart->pricedLines($this->selectedCheckoutLineIds($request));
            $fresh = $this->vouchers->applyCodes($remaining, (float) $priced['subtotal']);
            $request->session()->put(VoucherService::SESSION_KEY, $fresh);
        } catch (\DomainException) {
            $request->session()->forget(VoucherService::SESSION_KEY);
        }

        return redirect()->route('checkout.index')->with('success', 'Voucher dihapus.');
    }

    public function validateDetails(StoreCheckoutDetailsRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $this->prepareCheckoutIdempotencyKey($request, rotateCompleted: true);

        // Simpan pilihan metode pembayaran agar tidak hilang saat redirect balik.
        $paymentMethod = trim((string) $request->input('payment_method', ''));
        if (in_array($paymentMethod, ['cod', 'transfer'], true)) {
            $request->session()->put('checkout_payment_method', $paymentMethod);
        }

        $request->session()->put('checkout_details', $validated);

        return redirect()->route('checkout.index')->with('success', 'Detail pesanan tervalidasi.');
    }

    public function placeOrder(PlaceOrderRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $idempotencyKey = $this->prepareCheckoutIdempotencyKey($request);
        $existingOrder = Order::where('checkout_idempotency_key', $idempotencyKey)->first();

        if ($existingOrder) {
            OperationalTelemetry::checkoutOutcome(
                outcome: 'duplicate_replay',
                paymentMethod: $validated['payment_method'],
                idempotencyReplay: true,
            );
            $this->rememberConfirmedOrder($request, $existingOrder);

            return redirect()->route('order.confirmation', $existingOrder->order_number);
        }

        $details = $request->session()->get('checkout_details');

        if (empty($details)) {
            OperationalTelemetry::checkoutOutcome('missing_details', $validated['payment_method']);

            return redirect()->route('checkout.index')
                ->withErrors(['checkout' => 'Mohon lengkapi detail pengiriman terlebih dahulu.']);
        }

        if (empty($this->cart->get($this->selectedCheckoutLineIds($request)))) {
            OperationalTelemetry::checkoutOutcome('empty_cart', $validated['payment_method']);

            return redirect()->route('cart.index')
                ->withErrors(['checkout' => 'Keranjang kosong.']);
        }

        if ($validated['payment_method'] === 'cod' && ! CodSettings::enabled()) {
            OperationalTelemetry::checkoutOutcome('cod_unavailable', $validated['payment_method']);

            return redirect()->route('checkout.index')
                ->withErrors(['payment_method' => 'Layanan COD sedang tidak tersedia. Pilih transfer bank.']);
        }

        $shipping = $this->shipping->estimateBreakdown(
            $this->orders->cartWeightKg(),
            $details['city'],
            $details['province'] ?? null,
            $details['postal_code'] ?? null,
        );

        $sessionVoucher = $request->session()->get(VoucherService::SESSION_KEY);
        $voucher = is_array($sessionVoucher) ? $sessionVoucher : null;

        try {
            $order = $this->orders->createFromCart(
                customer: $details,
                shipping: $details,
                paymentMethod: $validated['payment_method'],
                shippingCost: $shipping['net'],
                voucher: $voucher,
                shippingSubsidy: $shipping['subsidy'],
                idempotencyKey: $idempotencyKey,
            );
        } catch (\DomainException $e) {
            OperationalTelemetry::checkoutOutcome('order_rejected', $validated['payment_method']);

            return redirect()->route('checkout.index')->withErrors(['checkout' => $e->getMessage()]);
        }

        OperationalTelemetry::checkoutOutcome('order_created', $validated['payment_method']);

        $this->rememberConfirmedOrder($request, $order);

        $this->cart->clear();
        $request->session()->forget('checkout_details');
        $request->session()->forget('checkout_payment_method');
        $request->session()->forget(VoucherService::SESSION_KEY);

        return redirect()->route('order.confirmation', $order->order_number);
    }

    private function prepareCheckoutIdempotencyKey(Request $request, bool $rotateCompleted = false): string
    {
        $key = (string) $request->session()->get(self::IDEMPOTENCY_SESSION_KEY, '');
        $isCompleted = $key !== ''
            && Order::where('checkout_idempotency_key', $key)->exists();

        if (! Str::isUuid($key) || ($rotateCompleted && $isCompleted)) {
            $key = (string) Str::uuid();
            $request->session()->put(self::IDEMPOTENCY_SESSION_KEY, $key);
        }

        return $key;
    }

    /**
     * An empty selection means selection mode is off: all cart lines are in
     * checkout. A non-empty selection is the explicit subset chosen in Cart.
     */
    private function selectedCheckoutLineIds(Request $request): ?array
    {
        $selected = $this->cart->getSelectedLines();

        return $selected !== [] ? $selected : null;
    }

    private function rememberConfirmedOrder(Request $request, Order $order): void
    {
        $confirmed = $request->session()->get('confirmed_orders', []);
        $confirmed[] = $order->order_number;
        $request->session()->put('confirmed_orders', array_values(array_unique($confirmed)));
    }
}
