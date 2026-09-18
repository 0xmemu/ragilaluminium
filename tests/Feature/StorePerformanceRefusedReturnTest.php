<?php

namespace Tests\Feature;

use App\Domain\Orders\OrderStateMachine;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ShippingRecord;
use App\Services\ShippingService;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Skenario: pelanggan menolak paket COD sebelum diterima dan sebelum membayar
 * (keputusan owner 2026-09-19: barang kembali tanpa restore stok, biaya lewat
 * jalur retur, nilai barang keluar dari penjualan saat retur selesai).
 */
class StorePerformanceRefusedReturnTest extends TestCase
{
    use RefreshDatabase;

    private function makeProduct(int $sku): Product
    {
        return Product::create([
            'parent_sku' => 'REF-'.$sku,
            'name' => 'Produk Retur Ditolak '.$sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'price' => 100000,
            'stock' => 10,
        ]);
    }

    private function makeCodOrder(int $amount, string $status): Order
    {
        return Order::create([
            'order_number' => 'REF-'.uniqid(),
            'customer_name' => 'Pelanggan Menolak',
            'customer_phone' => '0812'.random_int(10000000, 99999999),
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'payment_status' => 'pending',
            'shipping_status' => $status === 'shipped' ? 'in_transit' : 'pending_pickup',
            'subtotal_amount' => $amount,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $amount,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);
    }

    private function addItem(Order $order, Product $product, int $qty, int $price): void
    {
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'unit_price' => $price,
            'quantity' => $qty,
            'line_subtotal' => $price * $qty,
            'line_discount' => 0,
            'line_total' => $price * $qty,
        ]);
    }

    private function makePendingPayment(Order $order): Payment
    {
        return Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'cod',
            'amount' => $order->total_amount,
            'status' => 'pending',
        ]);
    }

    private function makeShippingRecord(Order $order, string $status): ShippingRecord
    {
        return ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'jnt',
            'waybill_number' => 'JTREF'.uniqid(),
            'status' => $status,
            'status_raw' => $status,
            'last_status_at' => now(),
        ]);
    }

    public function test_shipped_boleh_masuk_retur_tapi_langsung_selesai_tidak(): void
    {
        $machine = new OrderStateMachine;

        $this->assertTrue($machine->canTransition('shipped', 'return_in_process', 'carrier'));
        $this->assertTrue($machine->canTransition('shipped', 'return_in_process', 'admin'));
        $this->assertFalse($machine->canTransition('shipped', 'return_completed', 'admin'));
        $this->assertFalse($machine->canTransition('shipped', 'return_completed', 'carrier'));
    }

    public function test_scan_returned_kurir_memindahkan_order_dan_membuat_kasus_retur(): void
    {
        $product = $this->makeProduct(1);
        $order = $this->makeCodOrder(500000, 'shipped');
        $this->addItem($order, $product, 2, 250000);
        $this->makePendingPayment($order);
        $record = $this->makeShippingRecord($order, 'in_transit');

        app(ShippingService::class)->applyCarrierUpdate($record, '12', 'scan retur', null, now(), null, 'poll');

        $order->refresh();
        $this->assertSame('returned', $order->shipping_status);
        $this->assertSame('return_in_process', $order->order_status);

        $case = OrderReturnCase::query()->where('order_id', $order->id)->first();
        $this->assertNotNull($case, 'Kasus retur otomatis harus dibuat.');
        $this->assertSame('open', $case->status);
        $this->assertSame(1, $case->items()->count());

        // Uang belum cair: payment tetap pending.
        $this->assertSame('pending', $order->payments()->latest('id')->first()->status);
    }

    public function test_penutupan_retur_membatalkan_payment_dan_mengeluarkan_nilai_dari_penjualan(): void
    {
        $product = $this->makeProduct(2);
        $order = $this->makeCodOrder(500000, 'return_in_process');
        $this->addItem($order, $product, 2, 250000);
        $this->makePendingPayment($order);

        $svc = app(StorePerformanceService::class);
        $before = $svc->build(period: 'this_month');
        $kpi = fn (string $key) => collect(collect($before['sections'])
            ->firstWhere('key', 'returns_cancellations')['kpis'])->firstWhere('key', $key);

        // Selama kasus retur berjalan: masih dihitung penjualan dan masih
        // tercatat sebagai COD Belum Selesai (barang belum kembali).
        $this->assertSame(500000.0, (float) $before['financial']['gross_revenue']);
        $this->assertSame(1, $kpi('refused_orders')['value']);
        $this->assertSame(0.0, (float) $before['financial']['refused_goods_value']);

        app(OrderStateMachine::class)->transition($order, 'return_completed', null, 'admin_return');

        $order->refresh();
        $this->assertSame('cancelled', $order->payments()->latest('id')->first()->status);

        $after = $svc->build(period: 'this_month');
        $fin = $after['financial'];

        // Nilai barang keluar dari penjualan: bersih menjadi nol.
        $this->assertSame(500000.0, (float) $fin['gross_revenue']);
        $this->assertSame(500000.0, (float) $fin['refused_goods_value']);
        $this->assertSame(0.0, (float) $fin['net_revenue']);

        // COD Belum Selesai turun karena payment sudah ditutup.
        $this->assertSame(0, $fin['cod_pending_count']);

        $refused = collect(collect($after['sections'])
            ->firstWhere('key', 'returns_cancellations')['kpis'])->firstWhere('key', 'refused_orders');
        $this->assertSame(1, $refused['value']);
    }

    public function test_pesanan_yang_sudah_lunas_tidak_dihitung_ditolak(): void
    {
        $product = $this->makeProduct(3);
        $order = $this->makeCodOrder(300000, 'return_completed');
        $this->addItem($order, $product, 1, 300000);
        $order->update(['payment_status' => 'paid']);
        Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'cod',
            'amount' => 300000,
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        $report = app(StorePerformanceService::class)->build(period: 'this_month');
        $refused = collect(collect($report['sections'])
            ->firstWhere('key', 'returns_cancellations')['kpis'])->firstWhere('key', 'refused_orders');

        $this->assertSame(0, $refused['value']);
        $this->assertSame(0.0, (float) $report['financial']['refused_goods_value']);
    }
}
