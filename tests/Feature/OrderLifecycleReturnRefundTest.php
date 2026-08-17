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
use App\Services\OrderService;
use App\Services\ShippingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

class OrderLifecycleReturnRefundTest extends TestCase
{
    use RefreshDatabase;
    use CreatesVisibleProducts;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function makeOrder(string $status, array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'ORD-F9-'.strtoupper(uniqid()),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji No. 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => $status,
            'payment_status' => $status === 'pending_payment' ? 'pending' : 'paid',
            'shipping_status' => $status === 'pending_payment' ? 'pending' : 'delivered',
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

    // ==== Rule 1: edit order hanya saat menunggu konfirmasi (pending) ====
    public function test_admin_edit_rejected_after_confirmation(): void
    {
        $admin = $this->admin();
        $order = $this->makeOrder('processing');

        $this->actingAs($admin)
            ->put(route('admin.orders.items.update', $order), [
                'customer_name' => 'Budi',
                'customer_phone' => '08123456789',
            ])
            ->assertRedirect(route('admin.orders.show', $order))
            ->assertSessionHasErrors('edit');

        $this->assertSame('processing', $order->fresh()->order_status);
    }

    public function test_edit_policy_only_allows_pending_confirmation(): void
    {
        $service = app(OrderService::class);

        $this->assertTrue($service->editPolicy($this->makeOrder('pending_payment'))['allowed']);
        $this->assertFalse($service->editPolicy($this->makeOrder('processing'))['allowed']);
        $this->assertFalse($service->editPolicy($this->makeOrder('completed'))['allowed']);
    }

    // ==== Rule 2: pembatalan customer hanya sebelum konfirmasi ====
    public function test_guest_cancel_allowed_only_before_confirmation(): void
    {
        $product = $this->createVisibleProduct();
        $variant = $product->variants()->first();
        $variant->update(['stock' => 3]);

        $pending = $this->makeOrder('pending_payment');
        $this->attachItem($pending, $product, $variant, 2, 50000);

        $this->post(route('order.cancel', $pending->order_number), [
            'customer_phone' => '08123456789',
            'order_number' => $pending->order_number,
        ])->assertStatus(302);

        $this->assertSame('cancelled', $pending->fresh()->order_status);
        $this->assertSame(5, $variant->fresh()->stock, 'stok dikembalikan setelah pembatalan pelanggan');

        // Sudah dikonfirmasi -> pembatalan customer ditolak.
        $processing = $this->makeOrder('processing');
        $this->post(route('order.cancel', $processing->order_number), [
            'customer_phone' => '08123456789',
            'order_number' => $processing->order_number,
        ])->assertStatus(302);

        $this->assertSame('processing', $processing->fresh()->order_status);
    }
    // ==== Rule 3: completed terminal untuk edit/cancel biasa ====
    public function test_completed_order_cannot_be_cancelled_or_edited(): void
    {
        $admin = $this->admin();
        $order = $this->makeOrder('completed');

        $this->actingAs($admin)
            ->put(route('admin.orders.status', $order), ['order_status' => 'cancelled'])
            ->assertRedirect(route('admin.orders.show', $order))
            ->assertSessionHasErrors('order_status');
        $this->assertSame('completed', $order->fresh()->order_status);

        $this->actingAs($admin)
            ->put(route('admin.orders.items.update', $order), ['customer_name' => 'X'])
            ->assertRedirect(route('admin.orders.show', $order))
            ->assertSessionHasErrors('edit');
        $this->assertSame('completed', $order->fresh()->order_status);
    }

    public function test_cancelled_order_is_terminal(): void
    {
        $states = app(OrderStateMachine::class);
        $this->assertFalse($states->canTransition('cancelled', 'processing'));
        $this->assertFalse($states->canTransition('cancelled', 'return_in_process'));
    }

    // ==== Rule 4 & 8: return dari completed + alur terpisah di timeline ====
    public function test_return_case_can_be_created_from_completed_and_is_separate_track(): void
    {
        $admin = $this->admin();
        $product = $this->createVisibleProduct();
        $variant = $product->variants()->first();
        $order = $this->makeOrder('completed');
        $item = $this->attachItem($order, $product, $variant, 2, 50000);

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), [
                'reason' => 'Barang rusak saat tiba',
                'customer_notes' => 'Kaca pecah',
                'admin_notes' => 'Cek foto kerusakan',
                'resolution_type' => 'refund',
                'refund_amount' => 100000,
                'items' => [
                    ['order_item_id' => $item->id, 'requested_quantity' => 2],
                ],
            ])
            ->assertRedirect(route('admin.orders.show', $order))
            ->assertSessionHas('success');

        $this->assertSame('return_in_process', $order->fresh()->order_status);

        $case = OrderReturnCase::where('order_id', $order->id)->sole();
        $this->assertSame('open', $case->status);
        $this->assertSame('Barang rusak saat tiba', $case->reason);
        $this->assertSame(1, $case->items()->count());

        // Rule 8: alur retur tercatat sebagai jejak terpisah (ledger retur + event admin_return),
        // bukan menimpa riwayat(source order) dengan transisi normal.
        $event = EventLog::where('entity_id', $order->id)
            ->where('event_type', 'order_status_changed')
            ->latest('id')->first();
        $this->assertSame('admin_return', $event->payload['source']);
        $this->assertSame('return_in_process', $event->payload['order_status']);
        $this->assertSame((string) $case->id, (string) $event->payload['return_case_id']);
    }

    // ==== Rule 5: retur wajib alasan + hanya dari delivered/completed ====
    public function test_return_requires_reason_from_admin(): void
    {
        $admin = $this->admin();
        $product = $this->createVisibleProduct();
        $variant = $product->variants()->first();
        $order = $this->makeOrder('completed');
        $item = $this->attachItem($order, $product, $variant, 1, 50000);

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), [
                'customer_notes' => 'Yang penting diganti',
                'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
            ])
            ->assertSessionHasErrors('reason');

        $this->assertSame(0, OrderReturnCase::count());
        $this->assertSame('completed', $order->fresh()->order_status);
    }

    public function test_return_rejected_when_order_still_processing(): void
    {
        $admin = $this->admin();
        $order = $this->makeOrder('processing');

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), [
                'reason' => 'Alasan uji',
                'customer_notes' => 'Catatan uji',
                'items' => [],
            ])
            ->assertSessionHasErrors('return');

        $this->assertSame('processing', $order->fresh()->order_status);
        $this->assertSame(0, OrderReturnCase::count());
    }

    // ==== Rule 6 & 7: hasil retur refund/penggantian/kombinasi + catatan akuntansi ====
    public function test_return_completion_records_resolution_and_admin_accounting(): void
    {
        $admin = $this->admin();
        $product = $this->createVisibleProduct();
        $variant = $product->variants()->first();
        $order = $this->makeOrder('return_in_process');
        $item = $this->attachItem($order, $product, $variant, 2, 100000);

        $case = OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'open',
            'reason' => 'Cacat produksi',
            'customer_notes' => 'Minta ganti',
            'admin_notes' => null,
            'resolution_type' => null,
            'refund_amount' => 0,
            'replacement_amount' => 0,
            'additional_shipping_amount' => 0,
            'created_by_user_id' => $admin->id,
            'updated_by_user_id' => $admin->id,
        ]);
        $returnItem = $case->items()->create([
            'order_item_id' => $item->id,
            'requested_quantity' => 2,
            'returned_quantity' => 0,
        ]);

        // Kombinasi: refund + selisih harga penggantian + ongkir tambahan.
        $this->actingAs($admin)
            ->post(route('admin.orders.returns.complete', [$order, $case]), [
                'resolution_type' => 'refund',
                'admin_notes' => 'Tindakan: refund & penggantian. Refund 150rb, selisih harga unit 50rb, ongkir balik 20rb.',
                'refund_amount' => 150000,
                'replacement_amount' => 50000,
                'additional_shipping_amount' => 20000,
                'returned_items' => [
                    ['id' => $returnItem->id, 'returned_quantity' => 2],
                ],
            ])
            ->assertRedirect(route('admin.orders.show', $order))
            ->assertSessionHas('success');

        $case->refresh();
        $this->assertSame('completed', $case->status);
        $this->assertSame('refund', $case->resolution_type);
        $this->assertSame(150000.0, (float) $case->refund_amount);
        $this->assertSame(50000.0, (float) $case->replacement_amount);
        $this->assertSame(20000.0, (float) $case->additional_shipping_amount);
        $this->assertStringContainsString('selisih harga', (string) $case->admin_notes);
        $this->assertNotNull($case->completed_at);
        $this->assertSame(2, $case->items()->first()->returned_quantity);

        $this->assertSame('return_completed', $order->fresh()->order_status);
    }

    // ==== Rule 9: tracking tidak membuka kembali status order ====
    public function test_carrier_tracking_cannot_reopen_delivered_order(): void
    {
        $order = $this->makeOrder('delivered', [
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
        ]);
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'F9-JT-1',
            'shipping_cost' => 10000,
            'status' => 'delivered',
            'last_status_at' => now(),
        ]);

        // Update kurir regresif (transit) tidak boleh memutar balik pesanan Sampai.
        app(ShippingService::class)->applyCarrierUpdate(
            $record,
            'in_transit',
            'late scan kembali ke transit',
            null,
            now()->addMinute()->toDateTimeString(),
        );

        $this->assertSame('delivered', $record->fresh()->status);
        $this->assertSame('delivered', $order->fresh()->shipping_status);
        $this->assertSame('delivered', $order->fresh()->order_status);

        $states = app(OrderStateMachine::class);
        $this->assertFalse($states->canTransition('delivered', 'in_transit', 'carrier'));
        $this->assertFalse($states->canTransitionShipping('delivered', 'in_transit'));
        $this->assertFalse($states->canTransition('completed', 'processing', 'carrier'));
    }
}

