<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

/**
 * Pemilih produk untuk mengubah isi pesanan (permintaan owner 2026-09-29:
 * pemilihan produk dibuat sesederhana pemilih media dan bisa dicari).
 *
 * Kontrak yang dijaga: hanya admin yang bisa membuka, pencarian menjangkau nama
 * produk, induk SKU, dan SKU varian, produk maupun varian nonaktif tidak pernah
 * ditawarkan, dan setiap produk membawa varian aktifnya supaya admin tidak perlu
 * menebak kode SKU.
 */
class AdminOrderProductPickerTest extends TestCase
{
    use RefreshDatabase;
    use CreatesVisibleProducts;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    /** @return list<array<string, mixed>> */
    private function produkDari(User $admin, string $q): array
    {
        $res = $this->actingAs($admin)->getJson(route('admin.orders.product-picker', ['q' => $q]));
        $res->assertOk();

        return $res->json('products');
    }

    public function test_pencarian_nama_produk_membawa_varian_lengkap(): void
    {
        $admin = $this->admin();
        $product = $this->createVisibleProduct([
            'parent_sku' => 'PILIH-'.strtoupper(substr(uniqid(), -6)),
            'name' => 'Jendela Jungkit Pilihan',
        ]);
        $variant = $product->variants()->first();

        $hasil = $this->produkDari($admin, 'Jungkit Pilihan');

        $this->assertCount(1, $hasil);
        $this->assertSame($product->parent_sku, $hasil[0]['parent_sku']);
        $this->assertSame('Jendela Jungkit Pilihan', $hasil[0]['name']);

        $varianPertama = $hasil[0]['variants'][0];
        $this->assertSame($variant->variant_sku, $varianPertama['variant_sku']);
        $this->assertSame(1000000.0, (float) $varianPertama['price']);
        $this->assertSame(5, (int) $varianPertama['stock']);
        $this->assertArrayHasKey('label', $varianPertama);
    }

    public function test_pencarian_menjangkau_induk_sku_dan_sku_varian(): void
    {
        $admin = $this->admin();
        $product = $this->createVisibleProduct([
            'parent_sku' => 'INDUK'.strtoupper(substr(uniqid(), -6)),
            'name' => 'Produk Uji Pencarian SKU',
        ]);

        $lewatInduk = $this->produkDari($admin, $product->parent_sku);
        $this->assertSame([$product->parent_sku], array_column($lewatInduk, 'parent_sku'));

        $lewatVarian = $this->produkDari($admin, $product->variants()->first()->variant_sku);
        $this->assertSame([$product->parent_sku], array_column($lewatVarian, 'parent_sku'));
    }

    public function test_produk_nonaktif_tidak_ditawarkan(): void
    {
        $admin = $this->admin();
        $this->createVisibleProduct([
            'name' => 'Produk Arsip Pemilih',
            'status' => 'archived',
        ]);

        $this->assertSame([], $this->produkDari($admin, 'Produk Arsip Pemilih'));
    }

    public function test_varian_nonaktif_tidak_ikut_ditawarkan(): void
    {
        $admin = $this->admin();
        $product = $this->createVisibleProduct(['name' => 'Produk Varian Sebagian']);
        $aktif = $product->variants()->first();

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $product->parent_sku.'-NONAKTIF',
            'price' => 900000,
            'stock' => 3,
            'status' => 'inactive',
        ]);

        $hasil = $this->produkDari($admin, 'Produk Varian Sebagian');

        $this->assertSame([$aktif->variant_sku], array_column($hasil[0]['variants'], 'variant_sku'));
    }

    public function test_label_varian_memakai_titik_tengah_bukan_escape_mentah(): void
    {
        $admin = $this->admin();
        $product = $this->createVisibleProduct(['name' => 'Produk Label Varian']);
        $product->variants()->delete();

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $product->parent_sku.'-WARNA',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Hitam',
            'variation_2_name' => 'Kaca',
            'variation_2_option' => 'Kaca Es',
            'price' => 1200000,
            'stock' => 4,
            'status' => 'active',
        ]);

        $label = $this->produkDari($admin, 'Produk Label Varian')[0]['variants'][0]['label'];

        $this->assertSame('Warna: Hitam · Kaca: Kaca Es', $label);
        $this->assertStringNotContainsString('\\u', $label, 'label tidak boleh memuat escape mentah');
    }

    public function test_tamu_tidak_bisa_membuka_pemilih_produk(): void
    {
        $this->get(route('admin.orders.product-picker'))->assertRedirect();
    }

    /**
     * Jalur simpan: kiriman yang disusun pemilih produk (induk SKU + SKU varian +
     * jumlah, tanpa item_id karena baris baru) harus diterima server, mengikat
     * varian yang dipilih, dan mengurangi stok varian itu. Inilah yang membuat
     * pemilih baru setara dengan cara lama yang mengetik SKU manual.
     */
    public function test_kiriman_pemilih_produk_tersimpan_dan_mengikat_varian(): void
    {
        $admin = $this->admin();
        $order = $this->pesananMenungguKonfirmasi();

        $lama = $this->createVisibleProduct(['name' => 'Produk Sudah Ada']);
        $barisLama = $this->lampirkanItem($order, $lama, $lama->variants()->first(), 1, 1000000);

        $baru = $this->createVisibleProduct(['name' => 'Produk Dari Pemilih']);
        $varianBaru = $baru->variants()->first();
        $stokAwal = (int) $varianBaru->stock;

        $this->actingAs($admin)
            ->put(route('admin.orders.items.update', $order), [
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'customer_email' => '',
                'address_line1' => $order->shipping_address_line1,
                'address_line2' => '',
                'village' => '',
                'district' => '',
                'city' => $order->shipping_city,
                'province' => $order->shipping_province,
                'postal_code' => $order->shipping_postal_code,
                'notes' => '',
                'edit_note' => '',
                'items' => [
                    ['item_id' => $barisLama->id, 'qty' => 1],
                    // Bentuk baris baru persis seperti yang dikirim pemilih produk.
                    [
                        'parent_sku' => $baru->parent_sku,
                        'variant_sku' => $varianBaru->variant_sku,
                        'qty' => 2,
                    ],
                ],
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $tersimpan = OrderItem::where('order_id', $order->id)
            ->where('parent_sku', $baru->parent_sku)
            ->first();

        $this->assertNotNull($tersimpan, 'baris baru harus tersimpan');
        $this->assertSame($varianBaru->id, $tersimpan->product_variant_id);
        $this->assertSame(2, (int) $tersimpan->quantity);
        $this->assertSame(
            $stokAwal - 2,
            (int) $varianBaru->fresh()->stock,
            'stok varian yang dipilih harus berkurang sesuai jumlah'
        );
    }

    private function pesananMenungguKonfirmasi(): Order
    {
        return Order::create([
            'order_number' => 'PILIH-'.strtoupper(substr(uniqid(), -6)),
            'customer_name' => 'Budi',
            'customer_phone' => '6285725116817',
            'shipping_address_line1' => 'Jl. Uji No. 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => 'awaiting_confirmation',
            'payment_status' => 'pending',
            'shipping_status' => 'pending',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 10000,
            'discount_amount' => 0,
            'total_amount' => 1010000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
    }

    private function lampirkanItem(Order $order, Product $product, ProductVariant $variant, int $qty, float $price): OrderItem
    {
        return OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => $product->parent_sku,
            'variant_sku' => $variant->variant_sku,
            'name' => $product->name,
            'unit_price' => $price,
            'quantity' => $qty,
            'line_subtotal' => $price * $qty,
            'line_discount' => 0,
            'line_total' => $price * $qty,
        ]);
    }
}
