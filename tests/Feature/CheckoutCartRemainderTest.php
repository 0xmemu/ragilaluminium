<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kontrak keranjang setelah checkout: baris yang TIDAK dipesan harus tetap
 * ada di keranjang. Sebelumnya placeOrder memanggil cart->clear() sehingga
 * seluruh keranjang terhapus walau pembeli hanya memesan sebagian baris
 * (termasuk kasus "Beli Sekarang" yang hanya memilih satu baris).
 */
class CheckoutCartRemainderTest extends TestCase
{
    use RefreshDatabase;

    private function makeProduct(string $sku, string $variantSku, float $price): void
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => 'Produk '.$sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $variantSku,
            'price' => $price,
            'stock' => 5,
            'status' => 'active',
        ]);
    }

    private function cartLine(string $parentSku, string $variantSku, float $price): array
    {
        return [
            'line_id' => $variantSku,
            'parent_sku' => $parentSku,
            'variant_sku' => $variantSku,
            'name' => 'Produk '.$parentSku,
            'unit_price' => $price,
            'quantity' => 1,
        ];
    }

    public function test_baris_yang_tidak_dipesan_tetap_di_keranjang(): void
    {
        $this->makeProduct('REM-A', 'REM-A-1', 1000000);
        $this->makeProduct('REM-B', 'REM-B-1', 500000);

        $dipesan = 'REM-A-1';
        $tidakDipesan = 'REM-B-1';

        $this->withSession([
            'ragil_cart' => [
                $dipesan => $this->cartLine('REM-A', $dipesan, 1000000),
                $tidakDipesan => $this->cartLine('REM-B', $tidakDipesan, 500000),
            ],
            'ragil_cart_selected' => [$dipesan],
        ]);

        $this->post('/checkout/validate', [
            'name' => 'Budi', 'phone' => '081200000001', 'address_line1' => 'Jl A No 1',
            'province' => 'JAWA BARAT', 'city' => 'KOTA BANDUNG', 'district' => 'COBLONG',
            'village' => 'LEBAK GEDE', 'province_id' => '32', 'city_id' => '3273',
            'district_id' => '3273010', 'village_id' => '3273010001', 'postal_code' => '40132',
        ])->assertRedirect();

        $this->post('/checkout/place-order', ['payment_method' => 'transfer'])
            ->assertRedirectContains('/order/ORD');

        $sisa = session('ragil_cart') ?? [];

        $this->assertArrayNotHasKey(
            $dipesan,
            $sisa,
            'Baris yang dipesan harus keluar dari keranjang setelah order dibuat.',
        );
        $this->assertArrayHasKey(
            $tidakDipesan,
            $sisa,
            'Baris yang TIDAK dipesan harus tetap ada di keranjang.',
        );
    }
}
