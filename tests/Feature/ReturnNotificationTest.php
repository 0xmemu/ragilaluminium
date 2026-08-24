<?php

namespace Tests\Feature;

use App\Events\OrderReturnCreated;
use App\Models\AdminNotification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Product;
use App\Models\ShippingRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReturnNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function makeDeliveredOrder(): array
    {
        $product = Product::create([
            'parent_sku' => 'NTF-1', 'name' => 'Produk NTF', 'category_id' => 1,
            'product_category' => 'WINDOW', 'product_model' => 'SLIDING',
            'design_variant' => 'POLOS', 'status' => 'active', 'stock' => 50,
        ]);
        $order = Order::create([
            'order_number' => 'NTF-'.strtoupper(uniqid()),
            'customer_name' => 'Budi', 'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji 1', 'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat', 'shipping_postal_code' => '40111',
            'order_status' => 'delivered', 'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 100000, 'shipping_amount' => 10000,
            'discount_amount' => 0, 'total_amount' => 110000,
            'payment_method' => 'transfer', 'cod_flag' => false,
        ]);
        ShippingRecord::create([
            'order_id' => $order->id, 'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'NTF-WB-1', 'shipping_cost' => 10000,
            'status' => 'delivered', 'last_status_at' => now(),
        ]);
        $item = OrderItem::create([
            'order_id' => $order->id, 'product_id' => $product->id,
            'product_variant_id' => null, 'parent_sku' => $product->parent_sku,
            'variant_sku' => null, 'name' => $product->name,
            'unit_price' => 100000, 'quantity' => 2,
            'line_subtotal' => 200000, 'line_discount' => 0, 'line_total' => 200000,
        ]);
        return [$order, $item];
    }

    public function test_valid_create_return_makes_exactly_one_notification(): void
    {
        $admin = $this->admin();
        [$order, $item] = $this->makeDeliveredOrder();

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), [
                'reason' => 'rusak',
                'customer_notes' => 'pecah saat tiba',
                'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $case = OrderReturnCase::where('order_id', $order->id)->sole();
        $notifs = AdminNotification::where('type', 'return_created')
            ->where('related_id', $case->id)->get();
        $this->assertCount(1, $notifs);
    }

    public function test_notification_metadata_and_admin_order_link(): void
    {
        $admin = $this->admin();
        [$order, $item] = $this->makeDeliveredOrder();

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), [
                'reason' => 'salah_ukuran',
                'customer_notes' => 'ukuran tidak pas',
                'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
            ]);

        $case = OrderReturnCase::where('order_id', $order->id)->sole();
        $notif = AdminNotification::where('type', 'return_created')
            ->where('related_id', $case->id)->firstOrFail();

        $this->assertSame(OrderReturnCase::class, $notif->related_type);
        $this->assertSame((int) $case->id, (int) $notif->related_id);
        $this->assertSame((int) $order->id, (int) $notif->order_id);
        $this->assertStringContainsString('salah_ukuran', (string) $notif->body);
        $this->assertSame(route('admin.orders.show', $order), $notif->href);
        // href harus menuju halaman admin, bukan halaman publik.
        $this->assertStringContainsString('/admin/orders/', $notif->href);
    }

    public function test_reprocessing_event_does_not_duplicate_notification(): void
    {
        $admin = $this->admin();
        [$order, $item] = $this->makeDeliveredOrder();

        // Simulasikan event diproses dua kali (idempotensi per return_case_id).
        $case = OrderReturnCase::create([
            'order_id' => $order->id, 'status' => 'open', 'reason' => 'kurang',
            'fault_party' => 'store',
        ]);
        $case->items()->create([
            'order_item_id' => $item->id, 'requested_quantity' => 1, 'returned_quantity' => 0,
        ]);

        OrderReturnCreated::dispatch($order, $case);
        OrderReturnCreated::dispatch($order, $case);

        $count = AdminNotification::where('type', 'return_created')
            ->where('related_id', $case->id)->count();
        $this->assertSame(1, $count);
    }

    public function test_failed_validation_creates_no_notification(): void
    {
        $admin = $this->admin();
        [$order, $item] = $this->makeDeliveredOrder();

        // reason invalid -> validasi gagal -> tidak ada notifikasi.
        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), [
                'reason' => 'alasan_tidak_valid',
                'customer_notes' => 'x',
                'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
            ])
            ->assertSessionHasErrors('reason');

        $this->assertSame(0, AdminNotification::where('type', 'return_created')->count());
        $this->assertSame(0, OrderReturnCase::count());
    }
}