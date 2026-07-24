<?php

namespace App\Http\Controllers;

use App\Services\CartService;
use App\Services\OrderService;
use App\Services\ShippingService;
use App\Services\VoucherService;
use App\Support\CodSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CheckoutController extends Controller
{
    public function __construct(
        protected CartService $cart,
        protected OrderService $orders,
        protected ShippingService $shipping,
        protected VoucherService $vouchers,
    ) {
    }

    public function index(Request $request): Response
    {
        $priced = $this->cart->pricedLines();
        $applied = $request->session()->get(VoucherService::SESSION_KEY);
        $voucherDiscount = 0.0;
        $voucherPayload = null;

        if (is_array($applied) && ! empty($applied['code'])) {
            try {
                $fresh = $this->vouchers->applyCode((string) $applied['code'], (float) $priced['subtotal']);
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
            'details' => $details,
            'applyVoucherUrl' => route('checkout.voucher.apply'),
            'removeVoucherUrl' => route('checkout.voucher.remove'),
        ]);
    }

    public function applyVoucher(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40'],
        ]);

        $priced = $this->cart->pricedLines();

        try {
            $applied = $this->vouchers->applyCode($validated['code'], (float) $priced['subtotal']);
        } catch (\DomainException $e) {
            return redirect()->route('checkout.index')->withErrors(['voucher' => $e->getMessage()]);
        }

        $request->session()->put(VoucherService::SESSION_KEY, $applied);

        return redirect()->route('checkout.index')->with('success', 'Voucher diterapkan.');
    }

    public function removeVoucher(Request $request): RedirectResponse
    {
        $request->session()->forget(VoucherService::SESSION_KEY);

        return redirect()->route('checkout.index')->with('success', 'Voucher dihapus.');
    }

    public function validateDetails(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email'],
            'province' => ['required', 'string', 'max:100'],
            'city' => ['required', 'string', 'max:100'],
            'district' => ['required', 'string', 'max:100'],
            'village' => ['required', 'string', 'max:100'],
            'province_id' => ['required', 'string', 'max:20'],
            'city_id' => ['required', 'string', 'max:20'],
            'district_id' => ['required', 'string', 'max:20'],
            'village_id' => ['required', 'string', 'max:20'],
            'address_line1' => ['required', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['required', 'string', 'max:20'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $request->session()->put('checkout_details', $validated);

        return redirect()->route('checkout.index')->with('success', 'Detail pesanan tervalidasi.');
    }

    public function placeOrder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'payment_method' => ['required', 'in:cod,transfer'],
        ]);

        $details = $request->session()->get('checkout_details');

        if (empty($details)) {
            return redirect()->route('checkout.index')
                ->withErrors(['checkout' => 'Mohon lengkapi detail pengiriman terlebih dahulu.']);
        }

        if (empty($this->cart->get())) {
            return redirect()->route('cart.index')
                ->withErrors(['checkout' => 'Keranjang kosong.']);
        }

        if ($validated['payment_method'] === 'cod' && ! CodSettings::enabled()) {
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
            );
        } catch (\DomainException $e) {
            return redirect()->route('checkout.index')->withErrors(['checkout' => $e->getMessage()]);
        }

        $confirmed = $request->session()->get('confirmed_orders', []);
        $confirmed[] = $order->order_number;
        $request->session()->put('confirmed_orders', $confirmed);

        $this->cart->clear();
        $request->session()->forget('checkout_details');
        $request->session()->forget(VoucherService::SESSION_KEY);

        return redirect()->route('order.confirmation', $order->order_number);
    }
}
