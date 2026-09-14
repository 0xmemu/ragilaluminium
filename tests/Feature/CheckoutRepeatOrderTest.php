<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regresi BUG KRITIS 2026-09-14 (terbukti di produksi):
 *
 * Pembeli yang alamatnya sudah tersimpan tidak memanggil /checkout/validate,
 * sehingga token checkout (checkout_idempotency_key) lama - milik order yang
 * SUDAH terbit - tetap dipakai. Akibatnya "Buat Pesanan" mengembalikan order
 * lama sebagai sukses: pembeli melihat konfirmasi order lain (produk berbeda)
 * dan pesanan barunya TIDAK PERNAH dibuat.
 *
 * Perbaikan: token checkout dirotasi setiap halaman checkout DIBUKA, jadi satu
 * kunjungan checkout = satu token. Retry request yang sama tetap idempotent
 * karena placeOrder tidak merotasi.
 */
class CheckoutRepeatOrderTest extends TestCase
{
    use RefreshDatabase;

    private function makeProduct(string $sku, string $variantSku, float $price): void
    {
        $product = Product::create([
            'parent_sku' => $sku, 'name' => 'Produk '.$sku, 'category_id' => 1,
            'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS', 'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id, 'variant_sku' => $variantSku,
            'price' => $price, 'stock' => 5, 'status' => 'active',
        ]);
    }

    private function line(string $parentSku, string $variantSku, float $price): array
    {
        return [
            'line_id' => $variantSku, 'parent_sku' => $parentSku, 'variant_sku' => $variantSku,
            'name' => 'Produk '.$parentSku, 'unit_price' => $price, 'quantity' => 1,
        ];
    }

    private function details(): array
    {
        return [
            'name' => 'Budi', 'phone' => '081200000009', 'address_line1' => 'Jl A No 1',
            'province' => 'JAWA BARAT', 'city' => 'KOTA BANDUNG', 'district' => 'COBLONG',
            'village' => 'LEBAK GEDE', 'province_id' => '32', 'city_id' => '3273',
            'district_id' => '3273010', 'village_id' => '3273010001', 'postal_code' => '40132',
        ];
    }

    public function test_pesan_lagi_membuat_order_baru_bukan_mengembalikan_order_lama(): void
    {
        $this->makeProduct('REP-A', 'REP-A-1', 1000000);
        $this->makeProduct('REP-B', 'REP-B-1', 500000);

        // ---- Pesanan 1: produk A (alamat diisi lewat validateDetails) ----
        $this->withSession([
            'ragil_cart' => ['REP-A-1' => $this->line('REP-A', 'REP-A-1', 1000000)],
            'ragil_cart_selected' => ['REP-A-1'],
        ]);
        $this->post('/checkout/validate', $this->details())->assertRedirect();
        $this->post('/checkout/place-order', ['payment_method' => 'transfer'])
            ->assertRedirectContains('/order/ORD');

        $orderSatu = Order::latest('id')->firstOrFail();
        $tokenLama = (string) session('checkout_idempotency_key');
        $this->assertSame($orderSatu->checkout_idempotency_key, $tokenLama);

        // ---- Pesanan 2: produk B, alamat sudah tersimpan ----
        // Token lama SENGAJA dibiarkan di sesi (meniru browser asli yang tidak
        // memanggil validateDetails lagi).
        session([
            'ragil_cart' => ['REP-B-1' => $this->line('REP-B', 'REP-B-1', 500000)],
            'ragil_cart_selected' => ['REP-B-1'],
            'checkout_details' => $this->details(),
        ]);

        // Membuka halaman checkout WAJIB merotasi token.
        $this->get('/checkout')->assertOk();
        $this->assertNotSame(
            $tokenLama,
            (string) session('checkout_idempotency_key'),
            'Membuka checkout setelah order terbit harus memakai token baru.',
        );

        $this->post('/checkout/place-order', ['payment_method' => 'transfer'])
            ->assertRedirectContains('/order/ORD');

        $orderDua = Order::latest('id')->firstOrFail();

        $this->assertNotSame(
            $orderSatu->order_number,
            $orderDua->order_number,
            'Pesanan kedua harus order BARU, bukan order lama yang dikembalikan.',
        );
        $this->assertSame(2, Order::count());
        $this->assertSame('REP-B', $orderDua->items()->value('parent_sku'));
    }

    public function test_klik_ganda_tetap_idempotent_satu_order(): void
    {
        $this->makeProduct('REP-C', 'REP-C-1', 1000000);

        $this->withSession([
            'ragil_cart' => ['REP-C-1' => $this->line('REP-C', 'REP-C-1', 1000000)],
            'ragil_cart_selected' => ['REP-C-1'],
            'checkout_details' => $this->details(),
        ]);

        $this->get('/checkout')->assertOk();

        // Dua submit berurutan dengan token yang sama (double-click).
        $this->post('/checkout/place-order', ['payment_method' => 'transfer']);
        $this->post('/checkout/place-order', ['payment_method' => 'transfer']);

        $this->assertSame(
            1,
            Order::count(),
            'Retry request yang sama harus mengembalikan order yang sama, bukan membuat order kedua.',
        );
    }
}
