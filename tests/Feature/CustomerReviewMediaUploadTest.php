<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * U4: endpoint upload media ulasan pelanggan.
 *
 * Guard: order delivered/completed + ownership order_number+phone (sama dgn
 * review store); non-authenticated tetap bisa (guest-owned) TAPI hanya untuk
 * order yang sah; file terikat tipe & ukuran.
 */
class CustomerReviewMediaUploadTest extends TestCase
{
    use RefreshDatabase;

    private function order(array $overrides = []): Order
    {
        $product = Product::create([
            'parent_sku' => 'RV-MED-1',
            'name' => 'Jendela Aluminium Sliding',
            'short_name' => 'Jendela Sliding',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'description' => 'Produk uji media review.',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RV-MED-1-V1',
            'height_cm' => 100,
            'width_cm' => 50,
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        return Order::create(array_merge([
            'order_number' => 'ORD-RVMED-1',
            'customer_name' => 'Budi Ulas',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Merdeka 1',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '10110',
            'subtotal_amount' => 1000000,
            'total_amount' => 1000000,
            'payment_method' => 'cod',
            'cod_flag' => true,
            'payment_status' => 'pending',
            'order_status' => 'delivered',
        ], $overrides));
    }

    private function upload(string $orderNumber, string $phone): \Illuminate\Testing\TestResponse
    {
        Storage::fake('media');

        return $this->postJson("/order/{$orderNumber}/review/media", [
            'customer_phone' => $phone,
            'media' => UploadedFile::fake()->image('foto.jpg', 20, 20),
        ]);
    }

    public function test_upload_ok_untuk_order_delivered(): void
    {
        $order = $this->order();

        $this->upload($order->order_number, '08123456789')
            ->assertStatus(201)
            ->assertJsonStructure(['url', 'type']);
    }

    public function test_upload_ditolak_order_belum_delivered(): void
    {
        $order = $this->order(['order_status' => 'processing']);

        $this->upload($order->order_number, '08123456789')->assertStatus(422);
    }

    public function test_upload_ditolak_phone_tidak_cocok(): void
    {
        $order = $this->order();

        $this->upload($order->order_number, '081299999999')->assertStatus(404);
    }

    public function test_upload_ditolak_tipe_tidak_diizinkan(): void
    {
        $order = $this->order();

        $this->postJson("/order/{$order->order_number}/review/media", [
            'customer_phone' => '08123456789',
            'media' => UploadedFile::fake()->create('skrip.php', 10),
        ])->assertStatus(422);
    }

    public function test_upload_ditolak_file_terlalu_besar(): void
    {
        $order = $this->order();

        $this->postJson("/order/{$order->order_number}/review/media", [
            'customer_phone' => '08123456789',
            'media' => UploadedFile::fake()->image('besar.jpg', 20, 20)->size(10241),
        ])->assertStatus(422);
    }

    public function test_upload_tanpa_order_404(): void
    {
        $this->upload('ORD-TIDAK-ADA', '08123456789')->assertStatus(404);
    }
}