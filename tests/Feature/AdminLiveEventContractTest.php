<?php

namespace Tests\Feature;

use App\Events\AdminOrderUpdated;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class AdminLiveEventContractTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(): Order
    {
        return Order::create([
            'order_number' => 'LVE-'.strtoupper(uniqid()),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => 'processing',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'shipping_amount' => 10000,
            'discount_amount' => 0,
            'total_amount' => 110000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
    }

    public function test_event_has_minimal_safe_payload_without_pii(): void
    {
        $order = $this->makeOrder();
        $event = new AdminOrderUpdated($order, ['order_status']);

        $this->assertNotEmpty($event->event_id);
        $this->assertSame($order->id, $event->order_id);
        $this->assertSame($order->order_number, $event->order_number);
        $this->assertSame('processing', $event->order_status);
        $this->assertSame(['order_status'], $event->changed_fields);
        $this->assertNotNull($event->occurred_at);

        // Aman: event TIDAK membawa PII sensitif.
        $this->assertObjectNotHasProperty('customer_name', $event);
        $this->assertObjectNotHasProperty('customer_phone', $event);
        $this->assertObjectNotHasProperty('shipping_address_line1', $event);
        $this->assertObjectNotHasProperty('total_amount', $event);

        // Public properties yang di-broadcast harus aman (tidak ada data pelanggan).
        $payload = get_object_vars($event);
        $json = json_encode($payload);
        $this->assertStringNotContainsString('Budi', $json);
        $this->assertStringNotContainsString('628123456789', $json);
        $this->assertStringNotContainsString('Jl. Uji', $json);
    }

    public function test_event_broadcasts_to_private_admin_channel(): void
    {
        $order = $this->makeOrder();
        $event = new AdminOrderUpdated($order);

        $channels = $event->broadcastOn();
        $this->assertCount(1, $channels);
        $this->assertSame('private-admin.operations', $channels[0]->name);
        $this->assertSame('order.updated', $event->broadcastAs());
    }

    public function test_channel_authorization_accepts_admin_and_rejects_non_admin(): void
    {
        // Simulasi callback routes/channels.php: Broadcast::channel('admin.operations', fn(User $u) => $u->isAdmin())
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $staff = User::factory()->create(['role' => 'staff', 'status' => 'active']);

        $this->assertTrue($admin->isAdmin(), 'admin diterima');
        $this->assertFalse($staff->isAdmin(), 'staff ditolak (non-admin)');
    }

    public function test_after_commit_dispatch_via_dispatcher_creates_event(): void
    {
        Event::fake([AdminOrderUpdated::class]);

        $order = $this->makeOrder();
        $order->update(['order_status' => 'shipped']);

        // Dispatch helper hanya setelah commit: panggil manual seperti setelah mutation sukses.
        $eventId = \App\Support\AdminLiveEvents::orderUpdated($order, ['order_status']);

        $this->assertNotNull($eventId);
        Event::assertDispatched(AdminOrderUpdated::class, function (AdminOrderUpdated $event) use ($order) {
            return $event->order_id === $order->id
                && $event->order_status === 'shipped'
                && in_array('order_status', $event->changed_fields, true);
        });
    }

    public function test_dispatcher_skips_event_when_order_not_persisted(): void
    {
        Event::fake([AdminOrderUpdated::class]);

        $order = new Order(); // belum disimpan (updated_at null, exists false)

        $eventId = \App\Support\AdminLiveEvents::orderUpdated($order, ['order_status']);

        $this->assertNull($eventId);
        Event::assertNotDispatched(AdminOrderUpdated::class);
    }
}
