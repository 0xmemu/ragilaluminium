<?php

namespace Tests\Feature;

use App\Domain\Orders\OrderStateMachine;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

class AdminReturnWorkflowTest extends TestCase
{
    use RefreshDatabase;
    use CreatesVisibleProducts;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function productWithStock(int $stock = 10): Product
    {
        return $this->createVisibleProduct([
            'parent_sku' => 'RET-'.strtoupper(uniqid()),
            'name' => 'Produk Retur '.uniqid(),
            'status' => 'active',
        ]);
    }

    private function variantWithStock(Product $product, int $stock = 10): ProductVariant
    {
        // Hapus variant bawaan dari createVisibleProduct, pakai stock yg kita kendalikan.
        $product->variants()->delete();
        return ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'V-'.strtoupper(uniqid()),
            'name' => 'Varian',
            'price' => 1000000,
            'stock' => $stock,
            'status' => 'active',
        ]);
    }

    private function makeOrder(string $status, array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RET-'.strtoupper(uniqid()),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji No. 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => $status,
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 100000,
            'shipping_amount' => 10000,
            'discount_amount' => 0,
            'total_amount' => 110000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ], $overrides));
    }

    private function attachItem(Order $order, Product $product, ProductVariant $variant, int $qty, float $price): OrderItem
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

    /** Pasang shipping record delivered dgn last_status_at. */
    private function markDelivered(Order $order, string $at): void
    {
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Express',
            'waybill_number' => 'RET-'.uniqid(),
            'status' => 'delivered',
            'last_status_at' => $at,
            'last_event' => 'Delivered',
        ]);
        $order->refresh();
    }

    private function validCreatePayload(Order $order, array $overrides = []): array
    {
        $item = $order->items()->first();
        return array_merge([
            'reason' => 'rusak',
            'customer_notes' => 'Barang rusak saat diterima',
            'items' => [
                ['order_item_id' => $item->id, 'requested_quantity' => 1],
            ],
        ], $overrides);
    }

    // 1. hati: create retur hanya delivered + paid + dalam 48 jam.
    public function test_create_return_succeeds_for_delivered_inside_deadline(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered');
        $this->attachItem($order, $p, $v, 2, 100000);
        $this->markDelivered($order, now()->subHours(2)->toDateTimeString());

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order))
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertDatabaseHas('order_return_cases', [
            'order_id' => $order->id,
            'status' => 'open',
            'reason' => 'rusak',
            'fault_party' => 'store',
        ]);
        $order->refresh();
        $this->assertSame('return_in_process', $order->order_status);
    }

    // 2. retur dari completed dilarang.
    public function test_create_return_rejected_for_completed(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('completed');
        $this->attachItem($order, $p, $v, 1, 100000);
        $this->markDelivered($order, now()->subHours(2)->toDateTimeString());

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order))
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertDatabaseMissing('order_return_cases', ['order_id' => $order->id]);
        $order->refresh();
        $this->assertSame('completed', $order->order_status);
    }

    // 3. lewat 48 jam ditolak.
    public function test_create_return_rejected_after_48h_deadline(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered');
        $this->attachItem($order, $p, $v, 1, 100000);
        $this->markDelivered($order, now()->subHours(60)->toDateTimeString());

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order))
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertDatabaseMissing('order_return_cases', ['order_id' => $order->id]);
    }

    // 4. unpaid ditolak.
    public function test_create_return_rejected_for_unpaid(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered', ['payment_status' => 'pending']);
        $this->attachItem($order, $p, $v, 1, 100000);

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order))
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertDatabaseMissing('order_return_cases', ['order_id' => $order->id]);
    }

    // 5. reason lainnya wajib reason_detail.
    public function test_reason_lainnya_requires_reason_detail(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered');
        $this->attachItem($order, $p, $v, 1, 100000);
        $this->markDelivered($order, now()->subHours(1)->toDateTimeString());

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order, [
                'reason' => 'lainnya',
                'reason_detail' => '',
            ]))
            ->assertSessionHasErrors(['reason_detail']);

        $this->assertDatabaseMissing('order_return_cases', ['order_id' => $order->id]);
    }

    // 6. requested qty tidak boleh melebihi qty order.
    public function test_requested_quantity_cannot_exceed_order_quantity(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered');
        $item = $this->attachItem($order, $p, $v, 2, 100000);
        $this->markDelivered($order, now()->subHours(1)->toDateTimeString());

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order, [
                'items' => [['order_item_id' => $item->id, 'requested_quantity' => 5]],
            ]))
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertDatabaseMissing('order_return_cases', ['order_id' => $order->id]);
    }

    // 7. create mengubah order ke return_in_process.
    public function test_create_return_sets_return_in_process(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered');
        $this->attachItem($order, $p, $v, 1, 100000);
        $this->markDelivered($order, now()->subHours(1)->toDateTimeString());

        $this->actingAs($admin)->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order));
        $order->refresh();
        $this->assertSame('return_in_process', $order->order_status);
    }

    // 8. no duplicate active return.
    public function test_create_return_rejected_when_active_case_exists(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered');
        $item = $this->attachItem($order, $p, $v, 2, 100000);
        $this->markDelivered($order, now()->subHours(1)->toDateTimeString());

        // buat case open via request
        $this->actingAs($admin)->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order));
        $order->refresh();
        $this->assertSame('return_in_process', $order->order_status);

        // create kedua harus ditolak (return_in_process bukan delivered; & ada active)
        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), [
                'reason' => 'rusak',
                'customer_notes' => 'duplikat',
                'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertSame(1, OrderReturnCase::where('order_id', $order->id)->count());
    }

    // 9. refund negatif / > total ditolak.
    public function test_refund_amount_not_greater_than_total(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered');
        $this->attachItem($order, $p, $v, 1, 100000);
        $this->markDelivered($order, now()->subHours(1)->toDateTimeString());

        $this->actingAs($admin)->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order));
        $case = OrderReturnCase::where('order_id', $order->id)->firstOrFail();

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.complete', ['order' => $order, 'returnCase' => $case]), [
                'resolution_type' => 'refund',
                'admin_notes' => 'selesai',
                'refund_amount' => 99999999,
                'return_shipping_cost' => 10000,
            ])
            ->assertSessionHasErrors(['refund_amount']);

        $case->refresh();
        $this->assertSame('open', $case->status);
    }

    // 10. complete refund -> case completed + order return_completed.
    public function test_complete_refund_marks_case_and_order_completed(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered');
        $this->attachItem($order, $p, $v, 1, 100000);
        $this->markDelivered($order, now()->subHours(1)->toDateTimeString());

        $this->actingAs($admin)->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order));
        $case = OrderReturnCase::where('order_id', $order->id)->firstOrFail();

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.complete', ['order' => $order, 'returnCase' => $case]), [
                'resolution_type' => 'refund',
                'admin_notes' => 'refund lunas',
                'refund_amount' => 110000,
                'return_shipping_cost' => 10000,
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $case->refresh();
        $this->assertSame('completed', $case->status);
        $this->assertNotNull($case->completed_at);
        $this->assertSame(110000.0, (float) $case->refund_amount);
        $order->refresh();
        $this->assertSame('return_completed', $order->order_status);
    }

    // 11/12/13/14. replacement: auto-fill field, stock berkurang sekali, no new order, idempotent.
    public function test_complete_replacement_decrements_stock_once_and_no_new_order(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock(20);
        $v = $this->variantWithStock($p, 20);
        $order = $this->makeOrder('delivered');
        $item = $this->attachItem($order, $p, $v, 2, 100000);
        $this->markDelivered($order, now()->subHours(1)->toDateTimeString());

        $this->actingAs($admin)->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order, [
            'items' => [['order_item_id' => $item->id, 'requested_quantity' => 2]],
        ]));
        $case = OrderReturnCase::where('order_id', $order->id)->firstOrFail();

        $payload = [
            'resolution_type' => 'replacement',
            'admin_notes' => 'ganti barang',
            'return_shipping_cost' => 10000,
            'replacement_items' => [
                ['order_item_id' => $item->id, 'product_id' => $p->id, 'variant_id' => $v->id, 'quantity' => 2],
            ],
        ];

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.complete', ['order' => $order, 'returnCase' => $case]), $payload)
            ->assertRedirect(route('admin.orders.show', $order));

        $v->refresh();
        $this->assertSame(18, (int) $v->stock, 'stok berkurang 2');
        $case->refresh();
        $this->assertSame('completed', $case->status);
        $order->refresh();
        $this->assertSame('return_completed', $order->order_status);

        // tidak membuat order baru
        $this->assertSame(1, Order::where('customer_phone', $order->customer_phone)->count());
    }

    // 13. repeat complete tidak mengurangi stok dua kali.
    public function test_repeat_complete_does_not_decrement_stock_twice(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock(20);
        $v = $this->variantWithStock($p, 20);
        $order = $this->makeOrder('delivered');
        $item = $this->attachItem($order, $p, $v, 2, 100000);
        $this->markDelivered($order, now()->subHours(1)->toDateTimeString());

        $this->actingAs($admin)->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order, [
            'items' => [['order_item_id' => $item->id, 'requested_quantity' => 2]],
        ]));
        $case = OrderReturnCase::where('order_id', $order->id)->firstOrFail();
        $payload = [
            'resolution_type' => 'replacement',
            'admin_notes' => 'ganti',
            'return_shipping_cost' => 10000,
            'replacement_items' => [
                ['order_item_id' => $item->id, 'product_id' => $p->id, 'variant_id' => $v->id, 'quantity' => 2],
            ],
        ];

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.complete', ['order' => $order, 'returnCase' => $case]), $payload);
        $v->refresh();
        $this->assertSame(18, (int) $v->stock);

        // repeat complete ditolak (case sudah completed) -> stok tetap 18
        $this->actingAs($admin)
            ->post(route('admin.orders.returns.complete', ['order' => $order, 'returnCase' => $case]), $payload)
            ->assertRedirect(route('admin.orders.show', $order));
        $v->refresh();
        $this->assertSame(18, (int) $v->stock, 'stok tidak berkurang dua kali');
    }

    // 15. fault_party default store utk rusak; override ke customer.
    public function test_fault_party_default_and_override(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered');
        $item = $this->attachItem($order, $p, $v, 1, 100000);
        $this->markDelivered($order, now()->subHours(1)->toDateTimeString());

        // default: rusak -> store
        $this->actingAs($admin)->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order, [
            'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
        ]));
        $case = OrderReturnCase::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('store', $case->fault_party);

        // override -> customer
        $order2 = $this->makeOrder('delivered');
        $this->attachItem($order2, $p, $v, 1, 100000);
        $this->markDelivered($order2, now()->subHours(1)->toDateTimeString());
        $this->actingAs($admin)->post(route('admin.orders.returns.store', $order2), $this->validCreatePayload($order2, [
            'fault_party' => 'customer',
            'items' => [['order_item_id' => $order2->items()->first()->id, 'requested_quantity' => 1]],
        ]));
        $case2 = OrderReturnCase::where('order_id', $order2->id)->firstOrFail();
        $this->assertSame('customer', $case2->fault_party);
    }

    // 16. shipping_cost_borne_by_store default dgn fault_party & override.
    public function test_shipping_borne_default_and_override(): void
    {
        $admin = $this->admin();
        $p = $this->productWithStock();
        $v = $this->variantWithStock($p);
        $order = $this->makeOrder('delivered');
        $item = $this->attachItem($order, $p, $v, 1, 100000);
        $this->markDelivered($order, now()->subHours(1)->toDateTimeString());

        // default store -> borne true
        $this->actingAs($admin)->post(route('admin.orders.returns.store', $order), $this->validCreatePayload($order, [
            'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
        ]));
        $case = OrderReturnCase::where('order_id', $order->id)->firstOrFail();
        $this->assertTrue((bool) $case->shipping_cost_borne_by_store);

        $order2 = $this->makeOrder('delivered');
        $this->attachItem($order2, $p, $v, 1, 100000);
        $this->markDelivered($order2, now()->subHours(1)->toDateTimeString());
        $this->actingAs($admin)->post(route('admin.orders.returns.store', $order2), $this->validCreatePayload($order2, [
            'shipping_cost_borne_by_store' => false,
            'items' => [['order_item_id' => $order2->items()->first()->id, 'requested_quantity' => 1]],
        ]));
        $case2 = OrderReturnCase::where('order_id', $order2->id)->firstOrFail();
        $this->assertFalse((bool) $case2->shipping_cost_borne_by_store);
    }
}