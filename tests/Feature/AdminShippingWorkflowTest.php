<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\ShippingTrackingEvent;
use App\Models\User;
use App\Services\Shipping\JntCargoClient;
use App\Services\Shipping\JntResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminShippingWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    private function order(): Order
    {
        return Order::create([
            'order_number' => 'RA-SHIP-1',
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_postal_code' => '12345',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
        ]);
    }

    public function test_admin_shipping_detail_contains_tracking_link_and_event_timeline(): void
    {
        $admin = $this->admin();
        $order = $this->order();
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'service_name' => 'FTAIR',
            'waybill_number' => 'JT-SHIP-1',
            'shipping_cost' => 0,
            'status' => 'in_transit',
            'status_raw' => 'On the way',
            'last_status_at' => now(),
            'tracking_url' => 'https://tracking.example.test/JT-SHIP-1',
        ]);
        EventLog::create([
            'event_type' => 'shipping.status_updated',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'payload' => [
                'waybill' => $record->waybill_number,
                'from' => 'pending_pickup',
                'to' => 'in_transit',
                'raw' => 'On the way',
            ],
            'created_at' => now(),
        ]);

        $this->actingAs($admin)
            ->get(route('admin.shipping.show', $record))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ResourceShow')
                ->where('fields.6.value', $record->tracking_url)
                ->where('sections.0.title', 'Timeline pengiriman')
                ->where('sections.0.rows.0.value', 'pending_pickup -> in_transit - On the way'));
    }

    public function test_order_shipping_accepts_manual_waybill_and_rejects_jnt_creation_mode(): void
    {
        config(['jnt.enabled' => false]);
        $admin = $this->admin();
        $order = $this->order();

        $this->actingAs($admin)
            ->post(route('admin.orders.shipping.store', $order), [
                'mode' => 'jnt',
                'weight_kg' => 1,
            ])
            ->assertSessionHasErrors('mode');

        $this->actingAs($admin)
            ->post(route('admin.orders.shipping.store', $order), [
                'waybill_number' => 'JT-MANUAL-1',
                // Ongkir asli dari konsol J&T (sekarang wajib saat input resi).
                'shipping_cost' => 70000,
                'mark_shipped' => false,
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertDatabaseHas('shipping_records', [
            'order_id' => $order->id,
            'waybill_number' => 'JT-MANUAL-1',
        ]);
    }

    public function test_manual_waybill_attach_pulls_real_carrier_events_and_advances_status(): void
    {
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('track')->andReturn(new JntResponse(
                ok: true,
                httpStatus: 200,
                data: [
                    'code' => '1',
                    'msg' => 'success',
                    'data' => [[
                        'billCode' => 'JT-MANUAL-LIVE',
                        'details' => [
                            ['scanCode' => 1, 'scanType' => 'pengambilan paket', 'desc' => 'Kurir mengambil paket', 'scanTime' => '2026-08-21 13:38:24'],
                            ['scanCode' => 3, 'scanType' => 'Scan Kirim', 'desc' => 'Paket meninggalkan outlet', 'scanTime' => '2026-08-21 17:28:48'],
                            ['scanCode' => 4, 'scanType' => 'Scan Sampai', 'desc' => 'Paket tiba di gateway', 'scanTime' => '2026-08-21 18:53:58'],
                        ],
                    ]],
                ],
                requestId: 'req-manual-live',
                elapsedMs: 12,
            ));
        });

        $admin = $this->admin();
        $order = $this->order();

        $this->actingAs($admin)
            ->post(route('admin.orders.shipping.store', $order), [
                'waybill_number' => 'JT-MANUAL-LIVE',
                'shipping_cost' => 70000,
                'mark_shipped' => false,
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $record = ShippingRecord::where('waybill_number', 'JT-MANUAL-LIVE')->first();
        $this->assertNotNull($record);
        $this->assertSame('in_transit', $record->status);
        $this->assertSame('2026-08-21 18:53:58', $record->last_status_at->format('Y-m-d H:i:s'));
        $this->assertSame(3, ShippingTrackingEvent::where('shipping_record_id', $record->id)->count());
        $this->assertSame('in_transit', $order->fresh()->shipping_status);
        // cascadeOrderStatus: in_transit -> order_status shipped
        $this->assertSame('shipped', $order->fresh()->order_status);
    }

    public function test_refresh_reports_unavailable_integration_as_stale_status(): void
    {
        config(['jnt.enabled' => false]);
        $admin = $this->admin();
        $order = $this->order();
        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-STALE-1',
            'shipping_cost' => 0,
            'status' => 'pending_pickup',
            'last_status_at' => now()->subHour(),
        ]);

        $this->actingAs($admin)
            ->post(route('admin.shipping.refresh', $record))
            ->assertSessionHas('status', fn (string $message): bool => str_contains($message, 'belum diperbarui'))
            ->assertSessionMissing('success');
    }
    /**
     * Ongkir ASLI dari konsol J&T Cargo WAJIB diisi saat input resi.
     * Tanpa angka itu pembukuan kembali memakai asumsi checkout, sehingga
     * selisih ongkir tidak akan pernah terdeteksi.
     */
    public function test_input_resi_tanpa_ongkir_asli_ditolak(): void
    {
        $admin = $this->admin();
        $order = $this->order();

        $this->actingAs($admin)
            ->post(route('admin.orders.shipping.store', $order), [
                'waybill_number' => 'JT-TANPA-ONGKIR',
                'mark_shipped' => false,
            ])
            ->assertSessionHasErrors('shipping_cost');

        $this->assertDatabaseMissing('shipping_records', [
            'waybill_number' => 'JT-TANPA-ONGKIR',
        ]);
    }

    /**
     * Ongkir asli yang diisi admin tersimpan apa adanya di shipping_cost,
     * bukan diganti harga ongkir yang ditagih ke pembeli.
     */
    public function test_ongkir_asli_tersimpan_apa_adanya(): void
    {
        $admin = $this->admin();
        $order = $this->order();

        $this->actingAs($admin)
            ->post(route('admin.orders.shipping.store', $order), [
                'waybill_number' => 'JT-ONGKIR-ASLI',
                'shipping_cost' => 87500,
                'mark_shipped' => false,
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $record = \App\Models\ShippingRecord::where('waybill_number', 'JT-ONGKIR-ASLI')->first();
        $this->assertNotNull($record);
        $this->assertSame(87500.0, (float) $record->shipping_cost);
    }

}
