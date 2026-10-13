<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\WhatsAppMessage;
use App\Services\OrderService;
use App\Services\ReturnService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Item 6 antrean pekerjaan: integritas stok dan pembayaran.
 *
 * Kontrak:
 * - reship memproses barang pengganti seperti replacement: stok berkurang
 *   lewat buku besar stok, tidak bocor.
 * - Pesanan batal tidak menggantung: yang belum dibayar berstatus
 *   pembayaran cancelled, yang sudah dibayar refunded (uang dikembalikan).
 * - Kasus retur open kedua untuk pesanan yang sama ditolak database
 *   (unique index open_guard), bukan hanya oleh pemeriksaan kode.
 */
class Item6IntegrityTest extends TestCase
{
    use RefreshDatabase;

    private function makeProduct(string $sku, string $variantSku, float $price, int $stock = 5): array
    {
        $product = Product::create([
            'parent_sku' => $sku, 'name' => 'Produk '.$sku, 'category_id' => 1,
            'product_category' => 'JENDELA', 'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS', 'status' => 'active',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id, 'variant_sku' => $variantSku,
            'price' => $price, 'stock' => $stock, 'status' => 'active',
        ]);

        return [$product, $variant];
    }

    private function order(array $attributes = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-IT6-'.random_int(1000, 9999),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '081200000123',
            'shipping_address_line1' => 'Jl Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'return_in_process',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ], $attributes));
    }

    private function kasusOpen(Order $order): OrderReturnCase
    {
        return OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'open',
            'reason' => 'ditolak',
            'reason_detail' => 'uji',
            'fault_party' => 'other',
            'shipping_cost_borne_by_store' => true,
            'customer_notes' => 'uji',
        ]);
    }

    public function test_reship_memotong_stok_lewat_alur_pengganti(): void
    {
        // Cek pra-kirim dianggap terdaftar; kirim WA uji dipalsukan.
        Http::fake([
            '*/api/on-whatsapp' => Http::response([
                'results' => [['jid' => 'x@s.whatsapp.net', 'exists' => true]],
            ], 200),
            '*' => Http::response(['id' => 'WA-X'], 200),
        ]);

        [$product, $variant] = $this->makeProduct('IT6-A', 'IT6-A-1', 1000000, 5);
        $order = $this->order();
        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => 'IT6-A',
            'variant_sku' => 'IT6-A-1',
            'name' => 'Produk IT6-A',
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'unit_price' => 1000000,
            'quantity' => 1,
            'line_subtotal' => 1000000,
            'line_total' => 1000000,
        ]);
        $case = $this->kasusOpen($order);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.complete', ['order' => $order->id, 'returnCase' => $case->id]), [
                'resolution_type' => 'reship',
                'admin_notes' => 'Kirim ulang uji item 6',
                'replacement_items' => [[
                    'order_item_id' => $item->id,
                    'product_id' => $product->id,
                    'variant_id' => $variant->id,
                    'quantity' => 1,
                ]],
            ])
            ->assertRedirect();

        $this->assertSame(4, $variant->fresh()->stock);
        $this->assertDatabaseHas('order_return_items', [
            'return_case_id' => $case->id,
            'replacement_variant_id' => $variant->id,
            'replacement_quantity' => 1,
        ]);
    }

    public function test_batal_tanpa_dibayar_mencatat_pembayaran_dibatalkan(): void
    {
        $order = $this->order(['order_status' => 'processing']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'cod',
            'amount' => 1000000,
            'status' => 'pending',
        ]);

        app(OrderService::class)->cancel($order, $admin->id, 'uji batal');

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'payment_status' => 'cancelled']);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'status' => 'cancelled']);
    }

    public function test_batal_setelah_dibayar_mencatat_refund(): void
    {
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'transfer',
            'amount' => 1000000,
            'status' => 'completed',
        ]);

        app(OrderService::class)->cancel($order, $admin->id, 'uji batal setelah bayar');

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'payment_status' => 'refunded']);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'status' => 'refunded']);
    }

    public function test_kasus_open_kedua_ditolak_database(): void
    {
        $order = $this->order();
        $this->kasusOpen($order);

        $this->expectException(QueryException::class);
        $this->kasusOpen($order);
    }
}
