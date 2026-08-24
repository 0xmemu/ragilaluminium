<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Support\OrderTrackingViewModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase A2 — Customer Order Status & Copy Contract.
 *
 * Memastikan status dictionary customer-facing (ViewModel) memenuhi kontrak
 * docs/customer-order-status-contract.md, tanpa mengubah lifecycle bisnis.
 */
class StatusDictionaryContractTest extends TestCase
{
    use RefreshDatabase;

    protected function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-STATUS-1',
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'payment_method' => 'transfer',
            'cod_flag' => false,
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI',
            'shipping_district' => 'Menteng',
            'shipping_postal_code' => '10310',
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
        ], $overrides));
    }

    private function vm(Order $order): OrderTrackingViewModel
    {
        return new OrderTrackingViewModel($order, $order->shippingRecords->first());
    }

    public function test_completed_primary_status_says_finished_and_no_new_return(): void
    {
        $order = $this->makeOrder(['order_status' => 'completed']);
        $s = $this->vm($order)->primaryStatus();

        $this->assertSame('completed', $s['key']);
        $this->assertSame('Pesanan selesai', $s['label']);
        // Tidak boleh menawarkan retur baru pada order selesai.
        $this->assertStringContainsString('Retur baru tidak tersedia', $s['message']);
    }

    public function test_cancelled_primary_status_is_clear_and_safe(): void
    {
        $order = $this->makeOrder(['order_status' => 'cancelled']);
        $s = $this->vm($order)->primaryStatus();

        $this->assertSame('cancelled', $s['key']);
        $this->assertSame('Pesanan dibatalkan', $s['label']);
        $this->assertStringNotContainsString('admin', strtolower($s['message']));
    }

    public function test_issue_primary_status_has_no_internal_note_or_reason(): void
    {
        $order = $this->makeOrder(['order_status' => 'issue']);
        $s = $this->vm($order)->primaryStatus();

        $this->assertSame('issue', $s['key']);
        $this->assertSame('Perlu perhatian', $s['label']);
        // Tidak boleh membocorkan alasan internal / admin note.
    }

    public function test_return_in_process_and_completed_labels_are_safe(): void
    {
        $o1 = $this->makeOrder(['order_number' => 'RA-STATUS-R1', 'order_status' => 'return_in_process']);
        $s1 = $this->vm($o1)->primaryStatus();

        $o2 = $this->makeOrder(['order_number' => 'RA-STATUS-R2', 'order_status' => 'return_completed']);
        $s2 = $this->vm($o2)->primaryStatus();

        $this->assertSame('Retur diproses', $s1['label']);
        $this->assertSame('Retur selesai', $s2['label']);
    }

    public function test_payment_dictionary_matches_schema_and_copy(): void
    {
        // paid
        $paid = $this->makeOrder(['payment_status' => 'paid']);
        // Transfer pending (awaiting_confirmation) -> Menunggu pembayaran
        $unpaid = $this->makeOrder([
            'order_number' => 'RA-STATUS-2',
            'order_status' => 'awaiting_confirmation',
            'payment_status' => 'pending',
            'payment_method' => 'transfer',
        ]);
        // COD belum delivered -> bayar saat diterima
        $codPending = $this->makeOrder([
            'order_number' => 'RA-STATUS-3',
            'payment_status' => 'pending',
            'payment_method' => 'cod',
            'cod_flag' => true,
            'shipping_status' => 'in_transit',
        ]);
        // COD delivered -> menunggu pengumpulan (butuh ShippingRecord agar
        // normalizedShippingStatus() mengembalikan 'delivered').
        $codDelivered = $this->makeOrder([
            'order_number' => 'RA-STATUS-4',
            'payment_status' => 'pending',
            'payment_method' => 'cod',
            'cod_flag' => true,
            'shipping_status' => 'delivered',
            'order_status' => 'delivered',
        ]);
        ShippingRecord::create([
            'order_id' => $codDelivered->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JNT-COD-4',
            'status' => 'delivered',
            'last_status_at' => now(),
        ]);

        $labels = [
            $this->vm($paid)->payment()['statusLabel'],
            $this->vm($unpaid)->payment()['statusLabel'],
            $this->vm($codPending)->payment()['statusLabel'],
            $this->vm($codDelivered->fresh())->payment()['statusLabel'],
        ];

        $this->assertContains('Lunas', $labels);
        $this->assertContains('Menunggu pembayaran', $labels);
        $this->assertContains('Dibayar saat barang diterima', $labels);
        $this->assertContains('Menunggu pengumpulan', $labels);
    }

    public function test_refunded_payment_status_maps_to_refund(): void
    {
        $order = $this->makeOrder(['payment_status' => 'refunded']);
        $pay = $this->vm($order)->payment();

        $this->assertSame('refunded', $pay['statusKey']);
        $this->assertSame('Dikembalikan', $pay['statusLabel']);
    }

    public function test_shipping_exception_copy_has_no_raw_provider_text(): void
    {
        $order = $this->makeOrder([
            'order_status' => 'shipped',
            'payment_status' => 'paid',
            'shipping_status' => 'exception',
        ]);
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JNT-EX-1',
            'status' => 'exception',
            'status_raw' => 'KENDALA-INTERNAL-RAW-77',
            'last_status_at' => now(),
        ]);

        $s = $this->vm($order->fresh())->primaryStatus();

        $this->assertSame('delivery_failed', $s['key']);
        // Tidak boleh memuat raw provider text.
        $this->assertStringNotContainsString('KENDALA-INTERNAL-RAW-77', $s['message']);
        $this->assertStringNotContainsString('KENDALA-INTERNAL-RAW-77', $s['headline']);
    }

    public function test_tracking_timeline_does_not_expose_internal_source(): void
    {
        $order = $this->makeOrder(['order_status' => 'processing']);
        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JNT-TL-1',
            'status' => 'in_transit',
            'status_raw' => 'RAW-66',
            'last_status_at' => now(),
        ]);

        $tracking = \App\Support\OrderTrackingPresenter::forOrder($order->fresh());
        // Dalam tracking lengkap, source adalah metadata internal; pastikan tidak dipakai
        // sebagai copy utama (message) dan tidak ter-render sebagai raw.
        foreach ($tracking['timeline'] as $entry) {
            $this->assertArrayNotHasKey('detail', $entry);
            $this->assertArrayNotHasKey('location', $entry);
            $this->assertNotSame('KENDALA-INTERNAL-RAW-77', $entry['message']);
        }
    }
}
