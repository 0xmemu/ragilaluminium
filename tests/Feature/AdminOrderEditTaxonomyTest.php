<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * B13 (audit admin 2026-09-23): baris pesanan yang ditambahkan lewat edit
 * pesanan wajib menyimpan snapshot taksonomi (product_model + design_variant),
 * sama seperti baris yang lahir dari checkout. Sebelumnya jalur edit hanya
 * menulis SKU dan nama, sehingga produk ber-sub model lain ikut hilang dari
 * laporan per model/sub model. Baris histori lama tidak boleh ikut berubah.
 */
class AdminOrderEditTaxonomyTest extends TestCase
{
    use RefreshDatabase;

    private function makeProduct(string $sku, string $category, string $model, string $design, float $price, int $stock = 5): Product
    {
        $product = Product::create([
            'parent_sku' => $sku,
            'name' => 'Produk '.$sku,
            'short_name' => $sku,
            'category_id' => 1,
            'product_category' => $category,
            'product_model' => $model,
            'design_variant' => $design,
            'status' => 'active',
        ]);

        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => $sku.'-V1',
            'price' => $price,
            'stock' => $stock,
            'status' => 'active',
        ]);

        return $product;
    }

    private function makeEditableOrder(string $sku, Product $product, int $qty, float $price): Order
    {
        $order = Order::create([
            'order_number' => 'RA-EDIT-'.strtoupper(uniqid()),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji No. 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'shipping_country' => 'Indonesia',
            'order_status' => 'awaiting_confirmation',
            'payment_status' => 'pending',
            'shipping_status' => 'tracking_pending',
            'subtotal_amount' => $price * $qty,
            'shipping_amount' => 10000,
            'discount_amount' => 0,
            'total_amount' => $price * $qty + 10000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $product->variants()->first()->id,
            'parent_sku' => $sku,
            'variant_sku' => $sku.'-V1',
            'name' => $product->name,
            'product_category' => $product->product_category,
            'product_model' => $product->product_model,
            'design_variant' => $product->design_variant,
            'unit_price' => $price,
            'quantity' => $qty,
            'line_subtotal' => $price * $qty,
            'line_discount' => 0,
            'line_total' => $price * $qty,
        ]);

        return $order->fresh();
    }

    private function editPayload(array $items): array
    {
        return [
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'customer_email' => null,
            'address_line1' => 'Jl. Uji No. 1',
            'city' => 'Bandung',
            'province' => 'Jawa Barat',
            'postal_code' => '40111',
            'items' => $items,
        ];
    }

    public function test_new_item_from_edit_records_product_model_and_design_variant(): void
    {
        $old = $this->makeProduct('EDT-OLD', 'JENDELA', 'JUNGKIT', 'POLOS', 500000);
        $new = $this->makeProduct('EDT-NEW', 'PINTU', 'SLIDING', 'ORNAMEN', 700000);

        $order = $this->makeEditableOrder('EDT-OLD', $old, 1, 500000);
        $oldItem = $order->items()->first();

        $edited = app(OrderService::class)->editOrder($order, $this->editPayload([
            ['item_id' => $oldItem->id, 'parent_sku' => '', 'variant_sku' => null, 'qty' => 1],
            ['parent_sku' => 'EDT-NEW', 'variant_sku' => 'EDT-NEW-V1', 'qty' => 1],
        ]), null, 'Tukar produk ke sub model lain');

        $newItem = $edited->items()->where('parent_sku', 'EDT-NEW')->sole();
        $this->assertSame('SLIDING', $newItem->product_model);
        $this->assertSame('ORNAMEN', $newItem->design_variant);

        // Baris histori lama tidak ikut berubah taksonominya.
        $oldItem->refresh();
        $this->assertSame('JUNGKIT', $oldItem->product_model);
        $this->assertSame('POLOS', $oldItem->design_variant);
    }

    public function test_item_switched_to_another_product_follows_new_product_taxonomy(): void
    {
        $old = $this->makeProduct('EDT-A', 'JENDELA', 'JUNGKIT', 'POLOS', 500000);
        $new = $this->makeProduct('EDT-B', 'PINTU', 'SWING', 'KOMBINASI', 900000);

        $order = $this->makeEditableOrder('EDT-A', $old, 1, 500000);
        $oldItem = $order->items()->first();

        // Produk lama dihapus dari baris (tidak dikirim), produk baru masuk.
        $edited = app(OrderService::class)->editOrder($order, $this->editPayload([
            ['parent_sku' => 'EDT-B', 'variant_sku' => 'EDT-B-V1', 'qty' => 2],
        ]), null, 'Ganti produk');

        $item = $edited->items()->sole();
        $this->assertSame('EDT-B', $item->parent_sku);
        $this->assertSame('SWING', $item->product_model);
        $this->assertSame('KOMBINASI', $item->design_variant);
        $this->assertSame('PINTU', $item->product_category);
        $this->assertNull(OrderItem::find($oldItem->id), 'baris lama dihapus, bukan ditimpa');
    }
}
