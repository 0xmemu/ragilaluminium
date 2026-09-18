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
use App\Support\PhoneNumber;
use App\Support\ShippingQuoteManualReviewNotifier;
use Illuminate\Http\JsonResponse;
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

    public function index(Request $request): Response|RedirectResponse
    {
        // Setiap kunjungan halaman checkout memakai token checkout BARU bila
        // token sebelumnya sudah terpakai order. Tanpa ini, pembeli yang
        // alamatnya sudah tersimpan (tidak memanggil validateDetails) memakai
        // token lama, lalu "Buat Pesanan" mengembalikan ORDER LAMA seolah
        $this->prepareCheckoutIdempotencyKey($request, rotateCompleted: true);

        // Baris yang benar-benar di-checkout. Berat paket & tarif J&T WAJIB
        // memakai daftar ini, bukan seluruh isi keranjang (bug 2026-09-14:
        // sisa item lama ikut menambah berat sehingga tarif membengkak 4x).
        $lineIds = $this->selectedCheckoutLineIds($request);

        $priced = $this->cart->pricedLines($lineIds);

        // Keranjang kosong tidak boleh menampilkan halaman checkout.
        // Bila sesi ini baru membuat pesanan, pembeli diarahkan ke DETAIL
        // pesanan itu (konteks yang benar setelah checkout berhasil, mis. saat
        // menekan tombol back). Tanpa pesanan, baru dialihkan ke keranjang.
        if (($priced['items'] ?? []) === []) {
            $lastOrderNumber = collect((array) $request->session()->get('confirmed_orders', []))
                ->filter(fn ($n) => is_string($n) && $n !== '')
                ->last();

            if ($lastOrderNumber) {
                return redirect()->route('order.status', ['order_number' => $lastOrderNumber]);
            }

            return redirect()->route('cart.index')
                ->with('error', 'Keranjang kosong. Pilih produk terlebih dahulu sebelum checkout.');
        }

        $applied = $request->session()->get(VoucherService::SESSION_KEY);
        $voucherDiscount = 0.0;
        $voucherPayload = null;

        if (is_array($applied)) {
            try {
                $fresh = $this->vouchers->applyCodesToLines(
                    $this->vouchers->codesFromPayload($applied),
                    $this->voucherLinesFromPriced($priced),
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
        $codFeePreview = 0.0;
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
                $this->orders->cartWeightKg($lineIds),
                (string) $details['city'],
                $details['province'] ?? null,
                $details['postal_code'] ?? null,
                $details['district'] ?? null,
                $this->cart->subtotal($lineIds),
            );
            $shippingPreview = [
                'gross' => $breakdown['gross'],
                'subsidy' => $breakdown['subsidy'],
                // Persentase ASLI dari setelan, dikirim supaya label checkout
                // tidak menghitung balik dari nominal (persen pecahan bisa
                // tampil salah setelah dibulatkan).
                'subsidy_percent' => (float) ($breakdown['subsidy_percent'] ?? 0),
                'net' => $breakdown['net'],
                // Ongkir tanpa asuransi: inilah basis biaya COD, supaya angka
                // pratinjau sama dengan yang tersimpan saat pesanan dibuat.
                'net_ongkir' => (float) ($breakdown['net_ongkir'] ?? $breakdown['net']),
                'freight' => (float) ($breakdown['freight'] ?? 0),
                'applied' => $breakdown['applied'],
                'state' => $breakdown['state'],
                'is_final' => $breakdown['is_final'],
                'rough_estimate' => $breakdown['rough_estimate'],
                'manual_review' => $breakdown['manual_review'],
                'message' => $breakdown['message'],
                'carrier_eta' => $breakdown['carrier_eta'] ?? null,
                // Biaya asuransi ikut sebagai info bahwa tarif sudah memuatnya
                // (bukan lagi sebagai pilihan pembeli).
                'insurance' => (float) ($breakdown['insurance'] ?? 0),
                'insured_value' => (float) ($breakdown['insured_value'] ?? 0),
            ];
        }

        // Biaya COD = persen x (subtotal dibayar + TOTAL ongkos kirim yang
        // dibayar pembeli); fee preview baru valid setelah ongkir tersedia
        // (keputusan owner 2026-09-03).
        //
        // Basis memakai `net` (sudah termasuk asuransi), karena `net` adalah
        // angka ongkos kirim yang benar-benar dibayar pembeli dan itulah yang
        // tertulis di ringkasan. Memakai net_ongkir membuat biaya COD tidak
        // dapat diverifikasi dari angka yang terlihat.
        if ($cod['enabled']) {
            $codFeePreview = CodSettings::calculateFee(
                $subtotalAfterVoucher,
                (float) ($shippingPreview['net'] ?? 0),
            );
        }

        $items = collect($priced['items'])->map(function (array $item) {
            return [
                'line_id' => $item['line_id'],
                'name' => $item['name'],
                'image' => $item['image'] ?? null,
                'variation_1_name' => $item['variation_1_name'] ?? null,
                'variation_1_option' => $item['variation_1_option'] ?? null,
                'variation_2_name' => $item['variation_2_name'] ?? null,
                'variation_2_option' => $item['variation_2_option'] ?? null,
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
            'shippingWeightKg' => max(1.0, $this->orders->cartWeightKg($lineIds)),
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
            $applied = $this->vouchers->applyCodesToLines($codes, $this->voucherLinesFromPriced($priced));
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

        $lineIds = $this->selectedCheckoutLineIds($request);

        if (empty($this->cart->get($lineIds))) {
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
            $this->orders->cartWeightKg($lineIds),
            $details['city'],
            $details['province'] ?? null,
            $details['postal_code'] ?? null,
            $details['district'] ?? null,
            $this->cart->subtotal($lineIds),
        );

        $sessionVoucher = $request->session()->get(VoucherService::SESSION_KEY);
        $voucher = is_array($sessionVoucher) ? $sessionVoucher : null;

        try {
            $order = $this->orders->createFromCart(
                customer: $details,
                shipping: $details,
                paymentMethod: $validated['payment_method'],
                shippingCost: (float) ($shipping['net_ongkir'] ?? $shipping['net']),
                voucher: $voucher,
                shippingSubsidy: $shipping['subsidy'],
                shippingInsurance: (float) ($shipping['insurance_charged'] ?? 0),
                idempotencyKey: $idempotencyKey,
            );
        } catch (\DomainException $e) {
            OperationalTelemetry::checkoutOutcome('order_rejected', $validated['payment_method']);

            return redirect()->route('checkout.index')->withErrors(['checkout' => $e->getMessage()]);
        }

        OperationalTelemetry::checkoutOutcome('order_created', $validated['payment_method']);

        if (($shipping['manual_review'] ?? false) === true) {
            ShippingQuoteManualReviewNotifier::notify($order, $shipping);
        }

        $this->rememberConfirmedOrder($request, $order);

        // Halaman konfirmasi hanya boleh dibuka sekali untuk order ini;
        // bukaan berikutnya dialihkan ke detail pesanan.
        $pending = $request->session()->get('confirmation_pending', []);
        $pending = is_array($pending) ? array_values(array_filter($pending, 'is_string')) : [];
        $pending[] = $order->order_number;
        $request->session()->put('confirmation_pending', array_values(array_unique($pending)));

        // Hanya baris yang benar-benar dipesan yang keluar dari keranjang.
        // Tanpa seleksi (checkout seluruh keranjang) semua baris adalah pesanan,
        // jadi seluruhnya keluar. Baris lain milik pembeli tetap tersimpan.
        $this->cart->removeOrderedLines($lineIds ?? array_keys($this->cart->get()));
        // Detail pengiriman & metode bayar dipertahankan agar checkout ulang
        // (order berikutnya) tidak perlu mengisi dari nol. Voucher dibersihkan
        // supaya tidak terbawa ke order berikutnya.
        $request->session()->forget([VoucherService::SESSION_KEY]);

        return redirect()->route('order.confirmation', $order->order_number);
    }

    /**
     * Detail pengiriman dari order terakhir untuk nomor HP tertentu.
     * Dipakai checkout untuk prefill otomatis saat checkout ulang
     * (sesi/device baru); phone dinormalisasi seperti saat order disimpan.
     */
    public function lastDetails(Request $request): JsonResponse
    {
        $phone = trim((string) $request->input('phone', ''));
        if ($phone === '') {
            return response()->json(['found' => false]);
        }

        $normalized = PhoneNumber::normalize($phone) ?? $phone;
        $order = Order::query()
            ->where('customer_phone', $normalized)
            ->whereNotNull('shipping_address_line1')
            ->orderByDesc('id')
            ->first();

        if (! $order) {
            return response()->json(['found' => false]);
        }

        return response()->json([
            'found' => true,
            'details' => [
                'name' => $order->customer_name,
                'phone' => $order->customer_phone,
                'province' => $order->shipping_province,
                'city' => $order->shipping_city,
                'district' => $order->shipping_district,
                'village' => $order->shipping_village,
                'province_id' => $order->shipping_province_id,
                'city_id' => $order->shipping_city_id,
                'district_id' => $order->shipping_district_id,
                'village_id' => $order->shipping_village_id,
                'address_line1' => $order->shipping_address_line1,
                'address_line2' => $order->shipping_address_line2,
                'postal_code' => $order->shipping_postal_code,
            ],
        ]);
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

    /**
     * Bangun array baris (product_id, product_model, amount) dari output pricedLines
     * untuk kalkulasi voucher bertarget (general/model/produk).
     *
     * @param  array{items: list<array<string, mixed>>}  $priced
     * @return list<array{product_id: int|null, product_model: string|null, amount: float}>
     */
    private function voucherLinesFromPriced(array $priced): array
    {
        return collect($priced['items'] ?? [])->map(fn (array $item): array => [
            'product_id' => $item['product_id'] ?? null,
            'product_model' => $item['product_model'] ?? null,
            'amount' => (float) ($item['line_total'] ?? 0),
        ])->all();
    }
}
