<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\ShippingTrackingEvent;
use App\Support\OrderTrackingViewModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kontrak sinkronisasi status pesanan & pengiriman (UI pelanggan).
 * Satu sumber: OrderTrackingViewModel -> shipment/customerStatus/position/progress.
 */
class CustomerOrderStatusContractTest extends TestCase
{
    use RefreshDatabase;

    private function order(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'ORD-ST-'.strtoupper(substr(uniqid(), -6)),
            'customer_name' => 'Budi Test',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Merdeka 1',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '10110',
            'payment_method' => 'transfer',
            'payment_status' => 'pending',
            'order_status' => 'awaiting_confirmation',
            'shipping_status' => 'not_shipped',
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
            'cod_flag' => false,
        ], $overrides));
    }

    private function shipping(Order $order, array $overrides = []): ShippingRecord
    {
        return ShippingRecord::create(array_merge([
            'order_id' => $order->id,
            'waybill_number' => 'JT9TESTWAYBILL001',
            'carrier_name' => 'J&T Cargo',
            'status' => 'in_transit',
            'last_status_at' => now(),
        ], $overrides));
    }

    private function vm(Order $order, ?ShippingRecord $shipping = null): array
    {
        return (new OrderTrackingViewModel($order, $shipping))->toArray();
    }

    private function progressState(array $vm, string $key): ?string
    {
        foreach ($vm['progress'] as $step) {
            if ($step['key'] === $key) {
                return $step['state'];
            }
        }

        return null;
    }

    public function test_scenario1_new_order_awaits_confirmation(): void
    {
        $v = $this->vm($this->order());

        $this->assertSame('payment_pending', $v['primaryStatus']['key']);
        $this->assertSame('Pesanan menunggu pembayaran', $v['primaryStatus']['headline']);
        $this->assertFalse($v['shipment']['hasWaybill']);
        $this->assertNull($v['shipment']['waybill']);
        $this->assertSame('not_shipped', $v['shipment']['statusKey']);
        $this->assertSame('current', $this->progressState($v, 'confirmed'));
        $this->assertNull($this->progressState($v, 'handover'));
        $this->assertSame('Belum diserahkan ke kurir', $v['position']['text']);
    }

    public function test_scenario2_3_processing_ready_to_ship_no_waybill(): void
    {
        $v = $this->vm($this->order(['order_status' => 'processing', 'payment_status' => 'paid']));

        $this->assertSame('ready_to_ship', $v['primaryStatus']['key']);
        $this->assertSame('Pesanan siap dikirim', $v['primaryStatus']['headline']);
        $this->assertFalse($v['shipment']['hasWaybill']);
        // TIDAK mengklaim dikirim: handover masih upcoming.
        $this->assertSame('current', $this->progressState($v, 'prepared'));
        $this->assertSame('upcoming', $this->progressState($v, 'handover'));
        $this->assertSame('upcoming', $this->progressState($v, 'transit'));
        $this->assertSame('Belum diserahkan ke kurir', $v['position']['text']);
        $this->assertSame('preparing', $v['customerStatus']['stage']);
    }

    public function test_scenario4_waybill_created_awaiting_pickup(): void
    {
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $shipping = $this->shipping($order, ['status' => 'waybill_created']);
        $v = $this->vm($order, $shipping);

        $this->assertTrue($v['shipment']['hasWaybill']);
        $this->assertSame('JT9TESTWAYBILL001', $v['shipment']['waybill']);
        $this->assertSame('awaiting_pickup', $v['primaryStatus']['key']);
        $this->assertSame('Menunggu penjemputan kurir', $v['primaryStatus']['headline']);
        $this->assertSame('Menunggu dijemput atau diterima kurir', $v['position']['text']);
        // Belum diserahkan: handover tidak boleh current/complete.
        $this->assertNotEquals('completed', $this->progressState($v, 'handover'));
        $this->assertNotEquals('current', $this->progressState($v, 'handover'));
    }

    public function test_scenario5_carrier_accepted(): void
    {
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $shipping = $this->shipping($order, ['status' => 'picked_up', 'last_status_at' => now()->subHour()]);
        $v = $this->vm($order, $shipping);

        $this->assertSame('shipped', $v['primaryStatus']['key']);
        $this->assertSame('Pesanan dikirim', $v['primaryStatus']['headline']);
        $this->assertSame('Paket diterima kurir', $v['position']['text']);
        $this->assertSame('current', $this->progressState($v, 'handover'));
        $this->assertSame('upcoming', $this->progressState($v, 'transit'));
    }

    public function test_scenario6_transit_with_location(): void
    {
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $shipping = $this->shipping($order, ['status' => 'in_transit', 'last_status_at' => now()->subHour()]);
        ShippingTrackingEvent::create([
            'shipping_record_id' => $shipping->id,
            'order_id' => $order->id,
            'provider' => 'jnt',
            'waybill_number' => $shipping->waybill_number,
            'normalized_status' => 'in_transit',
            'source' => 'carrier',
            'location' => 'Semarang',
            'description' => 'Paket tiba di hub Semarang',
            'occurred_at' => now()->subHours(2),
            'event_hash' => md5('evt-'.uniqid()),
        ]);
        $v = $this->vm($order, $shipping->fresh());

        $this->assertSame('in_transit', $v['primaryStatus']['key']);
        $this->assertSame('Paket dalam perjalanan', $v['primaryStatus']['headline']);
        $this->assertSame('Paket berada di Semarang', $v['position']['text']);
        $this->assertSame('Semarang', $v['shipment']['location']);
        $this->assertSame('Paket tiba di hub Semarang', $v['shipment']['latestEventText']);
        $this->assertSame('current', $this->progressState($v, 'transit'));
        $this->assertSame('upcoming', $this->progressState($v, 'last_mile'));
    }

    public function test_scenario7_out_for_delivery(): void
    {
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $shipping = $this->shipping($order, ['status' => 'out_for_delivery', 'last_status_at' => now()]);
        $v = $this->vm($order, $shipping);

        $this->assertSame('out_for_delivery', $v['primaryStatus']['key']);
        $this->assertSame('Paket sedang diantar', $v['primaryStatus']['headline']);
        $this->assertSame('Paket sedang dibawa kurir ke alamat tujuan', $v['position']['text']);
        $this->assertSame('current', $this->progressState($v, 'last_mile'));
    }

    /** A1: order COD baru menunggu konfirmasi -> banner kontrak A, tanpa asumsi kirim. */
    public function test_scenario1_cod_awaiting_confirmation(): void
    {
        $v = $this->vm($this->order([
            'payment_method' => 'cod',
            'cod_flag' => true,
            'payment_status' => 'pending',
            'order_status' => 'awaiting_confirmation',
        ]));

        $this->assertSame('confirmed', $v['primaryStatus']['key']);
        $this->assertSame('Pesanan sedang dikonfirmasi', $v['primaryStatus']['headline']);
        $this->assertSame('Kami sedang memverifikasi pesanan Anda.', $v['primaryStatus']['message']);

        $orderConfirmed = collect($v['milestones'])->firstWhere('key', 'order_confirmed');
        $this->assertSame('current', $orderConfirmed['state']);
        $this->assertArrayNotHasKey('occurredAt', $orderConfirmed);

        $this->assertSame('current', $this->progressState($v, 'confirmed'));
        $this->assertSame('upcoming', $this->progressState($v, 'completed'));
        $this->assertSame('Belum diserahkan ke kurir', $v['position']['text']);
        $this->assertFalse($v['shipment']['hasWaybill']);
        $this->assertNull($v['shipment']['waybill']);
    }

    /** A2: milestone state current tidak punya occurredAt (transfer unpaid juga). */
    public function test_milestones_current_has_no_timestamp(): void
    {
        // Transfer unpaid
        $v = $this->vm($this->order());
        $paymentStep = collect($v['milestones'])->firstWhere('key', 'payment_verified');
        $this->assertSame('current', $paymentStep['state']);
        $this->assertArrayNotHasKey('occurredAt', $paymentStep);

        // Setelah lunas -> completed + occurredAt ada (dari created_at).
        $paid = $this->vm($this->order(['payment_status' => 'paid', 'order_status' => 'processing']));
        $paymentStepPaid = collect($paid['milestones'])->firstWhere('key', 'payment_verified');
        $this->assertSame('completed', $paymentStepPaid['state']);
        $this->assertArrayHasKey('occurredAt', $paymentStepPaid);
    }

    /** R1: order cancelled -> tahap terakhir yang tercapai = attention. */
    public function test_progress_attention_on_cancelled(): void
    {
        $v = $this->vm($this->order(['payment_status' => 'paid', 'order_status' => 'cancelled']));

        $states = collect($v['progress'])->pluck('state')->all();
        $this->assertContains('attention', $states);
        // Hanya satu tahap attention (titik gagal), sisanya upcoming.
        $this->assertSame(1, collect($states)->filter(fn ($st) => $st === 'attention')->count());
    }

    public function test_status_map_out_for_delivery(): void
    {
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $shipping = $this->shipping($order, ['status' => 'in_transit']);
        $shipping->update(['status' => 'out_for_delivery', 'last_status_at' => now()]);
        $v = $this->vm($order, $shipping->fresh());

        $this->assertSame('out_for_delivery', $v['shipment']['statusKey']);
        $this->assertSame('Paket sedang diantar', $v['primaryStatus']['headline']);
        $this->assertSame('current', $this->progressState($v, 'last_mile'));
        $this->assertSame('Paket sedang dibawa kurir ke alamat tujuan', $v['position']['text']);
    }

    public function test_scenario8_delivered_not_completed(): void
    {
        $order = $this->order(['order_status' => 'delivered', 'payment_status' => 'paid']);
        $shipping = $this->shipping($order, ['status' => 'delivered', 'last_status_at' => now()]);
        $v = $this->vm($order, $shipping);

        $this->assertSame('delivered', $v['primaryStatus']['key']);
        $this->assertSame('Pesanan terkirim', $v['primaryStatus']['headline']);
        $this->assertSame('current', $this->progressState($v, 'delivered'));
        // Selesai TIDAK otomatis dari delivered.
        $this->assertSame('upcoming', $this->progressState($v, 'completed'));
    }

    public function test_scenario8b_completed_order(): void
    {
        $v = $this->vm($this->order(['order_status' => 'completed', 'payment_status' => 'paid']));

        $this->assertSame('completed', $v['primaryStatus']['key']);
        $this->assertSame('Pesanan selesai', $v['primaryStatus']['headline']);
        $this->assertSame('completed', $this->progressState($v, 'completed'));
    }

    public function test_scenario9_stale_carrier_data(): void
    {
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $shipping = $this->shipping($order, ['status' => 'in_transit', 'last_status_at' => now()->subHours(3)]);
        $shipping->forceFill(['updated_at' => now()->subHours(3)])->save();
        $v = $this->vm($order, $shipping->fresh());

        $this->assertTrue($v['shipment']['stale']);
        $this->assertStringContainsString('sinkronisasi', strtolower($v['position']['description']));
        // Tidak mengarang lokasi: description tidak menyebut lokasi fiktif.
        $this->assertStringNotContainsString('Paket berada di', $v['position']['description']);
    }

    public function test_api_status_uses_same_mapper(): void
    {
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $this->shipping($order, ['status' => 'in_transit', 'last_status_at' => now()->subHour()]);

        $phone = '08123456789';
        $resp = $this->getJson("/api/orders/{$order->order_number}/status?customer_phone={$phone}")
            ->assertOk();

        $payload = $resp->json();
        $this->assertArrayHasKey('vm', $payload);
        $this->assertSame('in_transit', $payload['vm']['shipment']['statusKey']);
        $this->assertSame('Paket dalam perjalanan', $payload['vm']['primaryStatus']['headline']);
        $this->assertArrayHasKey('tracking_public', $payload);
        $this->assertArrayNotHasKey('record_status', $payload['tracking_public'] ?? []);
        $this->assertArrayNotHasKey('status_raw', $payload['tracking_public'] ?? []);
        // Resi = waybill, bukan nomor pesanan.
        $this->assertSame('JT9TESTWAYBILL001', $payload['vm']['shipment']['waybill']);
        $this->assertNotSame($order->order_number, $payload['vm']['shipment']['waybill']);
    }
}