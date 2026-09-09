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
            'waybill_number' => 'JT9TESTWAYBILL'.strtoupper(substr(uniqid(), -9)),
            'carrier_name' => 'J&T Cargo',
            'status' => 'in_transit',
            'last_status_at' => now(),
        ], $overrides));
    }

    private function vm(Order $order, ?ShippingRecord $shipping = null): array
    {
        return (new OrderTrackingViewModel($order, $shipping))->toArray();
    }

    private function summaryState(array $vm, string $key): ?string
    {
        foreach (($vm['summary']['steps'] ?? []) as $step) {
            if ($step['key'] === $key) {
                return $step['state'];
            }
        }

        return null;
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
        $this->assertSame('Pesanan menunggu konfirmasi', $v['primaryStatus']['headline']);
        $s1 = $v['summary']['steps'];
        $this->assertSame('Menunggu konfirmasi', $s1[0]['label']);
        // Ikon sinkron: menunggu konfirmasi = clock (credit-card tidak dipakai lagi).
        $this->assertSame('clock', $s1[0]['icon']);
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
        $this->assertSame('Menyiapkan', $v['primaryStatus']['headline']);
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
        $this->assertSame($shipping->waybill_number, $v['shipment']['waybill']);
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

        $this->assertSame('awaiting_confirmation', $v['primaryStatus']['key']);
        $this->assertSame('Pesanan menunggu konfirmasi', $v['primaryStatus']['headline']);
        $this->assertSame('Kami sedang memverifikasi pesanan Anda.', $v['primaryStatus']['message']);
        $this->assertSame('Menunggu konfirmasi', $v['summary']['steps'][0]['label']);

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
        $this->assertSame('Sampai', $v['primaryStatus']['headline']);
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
        $taken = ShippingRecord::first()->waybill_number;
        $this->assertSame($taken, $payload['vm']['shipment']['waybill']);
        $this->assertNotSame($order->order_number, $payload['vm']['shipment']['waybill']);
        // Kontrak 9.2: summary hadir di payload API (satu mapper).
        $this->assertArrayHasKey('summary', $payload['vm']);
    }

    /** Kontrak 4.1/4.2: summary tanpa 'Pesanan Sampai'; 'Pesanan siap dikirim' = substatus Disiapkan. */
    public function test_summary_steps_contract(): void
    {
        // ready_to_ship tanpa waybill: Dikonfirmasi completed, Disiapkan current,
        // Dikirim & Selesai upcoming.
        $v = $this->vm($this->order(['order_status' => 'processing', 'payment_status' => 'paid']));
        $labels = array_column($v['summary']['steps'], 'label');
        // Text adaptif: fulfillment current = "Menyiapkan" (owner 2026-08-25).
        $this->assertSame(['Dikonfirmasi', 'Menyiapkan', 'Dikirim', 'Selesai'], $labels);
        $this->assertSame('completed', $this->summaryState($v, 'confirmation'));
        $this->assertSame('current', $this->summaryState($v, 'fulfillment'));
        $this->assertSame('upcoming', $this->summaryState($v, 'shipping'));
        $this->assertSame('upcoming', $this->summaryState($v, 'completion'));
        $this->assertStringNotContainsString('Pesanan Sampai', json_encode($v));

        // waybill dibuat tanpa scan: Dikirim tetap upcoming.
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $shipping = $this->shipping($order, ['status' => 'waybill_created']);
        $v2 = $this->vm($order, $shipping);
        $this->assertSame('current', $this->summaryState($v2, 'fulfillment'));
        $this->assertSame('upcoming', $this->summaryState($v2, 'shipping'));

        // carrier diterima: Dikirim current.
        $shipping2 = $this->shipping($order, ['status' => 'picked_up', 'last_status_at' => now()->subHour()]);
        $v3 = $this->vm($order, $shipping2);
        $this->assertSame('completed', $this->summaryState($v3, 'fulfillment'));
        $this->assertSame('current', $this->summaryState($v3, 'shipping'));

        // delivered: Dikirim completed, Selesai current (bukan completed).
        $order2 = $this->order(['order_status' => 'delivered', 'payment_status' => 'paid']);
        $shipping3 = $this->shipping($order2, ['status' => 'delivered']);
        $v4 = $this->vm($order2, $shipping3);
        $this->assertSame('completed', $this->summaryState($v4, 'shipping'));
        $this->assertSame('current', $this->summaryState($v4, 'completion'));
        $labels4 = array_column($v4['summary']['steps'], 'label');
        $this->assertSame('Sampai', $labels4[2]);

        // completed: Selesai completed.
        $v5 = $this->vm($this->order(['order_status' => 'completed', 'payment_status' => 'paid']));
        $this->assertSame('completed', $this->summaryState($v5, 'completion'));
    }

    /** Kontrak 5/6: customerStatus punya source/eventAt/position/attention. */
    public function test_customer_status_sources(): void
    {
        // Store source: processing tanpa waybill; eventAt dari updated_at order.
        $v = $this->vm($this->order(['order_status' => 'processing', 'payment_status' => 'paid']));
        $this->assertSame('store', $v['customerStatus']['source']);
        $this->assertNotNull($v['customerStatus']['position']);
        $this->assertNotNull($v['customerStatus']['eventAt']);
        $this->assertFalse($v['customerStatus']['attention']);

        // Carrier source dengan event.
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
            'description' => 'Paket tiba di hub',
            'occurred_at' => now()->subHours(2),
            'event_hash' => md5('evt-'.uniqid()),
        ]);
        $v2 = $this->vm($order, $shipping->fresh());
        $this->assertSame('carrier', $v2['customerStatus']['source']);

        // Attention: exception.
        $order2 = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $shipping2 = $this->shipping($order2, ['status' => 'exception', 'last_status_at' => now()->subHour()]);
        $v3 = $this->vm($order2, $shipping2);
        $this->assertTrue($v3['customerStatus']['attention']);
        $this->assertSame('attention', $this->summaryState($v3, 'shipping'));
    }

    /** REGRESI: order belum bayar tidak boleh menampilkan "Pembayaran dikonfirmasi". */
    public function test_events_awaiting_payment_not_confirmed(): void
    {
        // Transfer belum bayar + awaiting_confirmation.
        $v = $this->vm($this->order());
        $labels = array_column($v['events'], 'label');
        $this->assertNotContains('Pembayaran dikonfirmasi', $labels);
        $this->assertContains('Pesanan menunggu konfirmasi', $labels);
        // Item terakhir = state saat ini (current), bukan kejadian yang belum terjadi.
        $last = end($v['events']);
        $this->assertSame('Pesanan menunggu konfirmasi', $last['label']);

        // COD awaiting: tidak ada pembayaran dikonfirmasi; item akhir "Pesanan menunggu konfirmasi".
        $v2 = $this->vm($this->order([
            'payment_method' => 'cod',
            'cod_flag' => true,
            'payment_status' => 'pending',
            'order_status' => 'awaiting_confirmation',
        ]));
        $labels2 = array_column($v2['events'], 'label');
        $this->assertNotContains('Pembayaran dikonfirmasi', $labels2);
        $this->assertContains('Pesanan menunggu konfirmasi', $labels2);

        // Sudah lunas: pembayaran dikonfirmasi valid muncul.
        $v3 = $this->vm($this->order(['payment_status' => 'paid', 'order_status' => 'processing']));
        $this->assertContains('Pembayaran dikonfirmasi', array_column($v3['events'], 'label'));
    }

    /** Revisi final 9-15: timeline events hanya dari mapper, terjemahan, tanpa raw. */
    public function test_events_timeline_translated_and_ordered(): void
    {
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $shipping = $this->shipping($order, ['status' => 'in_transit', 'last_status_at' => now()->subHour()]);
        ShippingTrackingEvent::create([
            'shipping_record_id' => $shipping->id,
            'order_id' => $order->id,
            'provider' => 'jnt',
            'waybill_number' => $shipping->waybill_number,
            'normalized_status' => 'picked_up',
            'source' => 'carrier',
            'description' => 'RAW-PII-KURIR INI TIDAK BOLEH MUNCUL',
            'occurred_at' => now()->subHours(3),
            'event_hash' => md5('evt-a'.uniqid()),
        ]);
        ShippingTrackingEvent::create([
            'shipping_record_id' => $shipping->id,
            'order_id' => $order->id,
            'provider' => 'jnt',
            'waybill_number' => $shipping->waybill_number,
            'normalized_status' => 'in_transit',
            'source' => 'carrier',
            'description' => '【Kab Tasikmalaya】【BJN006A】Kuri J&T Cargo Anda Kefien Pradisa (085157873922) sudah mengambil paket. Jika ada masalah atau pengaduan silakan hubungi nomor telepon outlet',
            'occurred_at' => now()->subHours(1),
            'event_hash' => md5('evt-b'.uniqid()),
        ]);
        $v = $this->vm($order, $shipping->fresh());

        $events = $v['events'];
        $this->assertNotEmpty($events);
        foreach ($events as $ev) {
            $this->assertArrayHasKey('label', $ev);
            $this->assertArrayHasKey('at', $ev);
            $this->assertArrayHasKey('position', $ev);
            $this->assertContains($ev['source'], ['store', 'carrier']);
            // Tidak boleh ada teks raw J&T (PII/source internal).
            $json = json_encode($ev);
            $this->assertStringNotContainsString('RAW-PII-KURIR', $json);
            $this->assertStringNotContainsString('Muhammad Hilausastra', $json);
        }
        // Kunci store ada + carrier canonical dedupe (in_transit 1x meski 2 event).
        $keys = array_column($events, 'key');
        $this->assertContains('order_created', $keys);
        $this->assertContains('picked_up', $keys);
        $this->assertSame(1, count(array_filter($keys, fn ($k) => $k === 'in_transit')));
        // Detail event ter-parse (lokasi/kurir/telepon), tanpa raw description.
        $it = array_values(array_filter($events, fn ($e) => $e['key'] === 'in_transit'))[0];
        $this->assertSame('Kab Tasikmalaya', $it['detail']['location']);
        $this->assertSame('Kefien Pradisa', $it['detail']['courierName']);
        $this->assertSame('085157873922', $it['detail']['courierPhone']);
        $raw = json_encode($events);
        $this->assertStringNotContainsString('【', $raw);
        $this->assertStringNotContainsString('Kuri J&T Cargo Anda', $raw);

        // Urutan kronologis: timestamp non-null terurut; null (tanpa waktu
        // kejadian nyata) diperbolehkan utk tahap store tanpa recordedAt.
        $ats = array_column($events, 'at');
        $nonNull = array_values(array_filter($ats, fn ($a) => $a !== null));
        $sorted = $nonNull;
        sort($sorted);
        $this->assertSame($sorted, $nonNull);
        foreach ($events as $ev) {
            $this->assertTrue($ev['at'] === null || is_string($ev['at']));
        }
        $this->assertNotEmpty($nonNull);
    }

    /** Revisi final 20: matrix translation untuk state terminal utama. */
    public function test_translation_matrix_terminal_states(): void
    {
        // delivered
        $o1 = $this->order(['order_status' => 'delivered', 'payment_status' => 'paid']);
        $sh1 = $this->shipping($o1, ['status' => 'delivered', 'last_status_at' => now()]);
        ShippingTrackingEvent::create([
            'shipping_record_id' => $sh1->id,
            'order_id' => $o1->id,
            'provider' => 'jnt',
            'waybill_number' => $sh1->waybill_number,
            'normalized_status' => 'delivered',
            'source' => 'carrier',
            'description' => 'Paket telah diterima',
            'occurred_at' => now(),
            'event_hash' => md5('evt-delivered-'.uniqid()),
        ]);
        $v1 = $this->vm($o1, $sh1->fresh());
        $this->assertContains('delivered', array_column($v1['events'], 'key'));
        $this->assertSame('Sampai', $this->eventLabel($v1, 'delivered'));

        // cancelled
        $v2 = $this->vm($this->order(['order_status' => 'cancelled', 'payment_status' => 'pending']));
        $this->assertSame('Pesanan dibatalkan', $this->eventLabel($v2, 'cancelled'));
    }

    private function eventLabel(array $vm, string $key): ?string
    {
        foreach (($vm['events'] ?? []) as $ev) {
            if ($ev['key'] === $key) {
                return $ev['label'];
            }
        }

        return null;
    }

    /** Kontrak 7: officialTrackingUrl terbentuk bila waybill ada; null bila tidak. */
    public function test_official_tracking_url(): void
    {
        $v = $this->vm($this->order(['order_status' => 'processing', 'payment_status' => 'paid']));
        $this->assertNull($v['shipment']['officialTrackingUrl']);

        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $shipping = $this->shipping($order, ['status' => 'waybill_created']);
        $v2 = $this->vm($order, $shipping);
        $this->assertSame(
            'https://www.jet.co.id/track/trace?waybill='.$shipping->waybill_number,
            $v2['shipment']['officialTrackingUrl'],
        );
    }
}