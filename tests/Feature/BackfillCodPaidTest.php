<?php

namespace Tests\Feature;

use App\Console\Commands\BackfillCodPaid;
use App\Models\Order;
use App\Models\ShippingRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BackfillCodPaidTest extends TestCase
{
    use RefreshDatabase;

    private function codOrder(string $orderStatus, ?bool $shippingDelivered, ?string $lastStatusAt): Order
    {
        $order = Order::create([
            'order_number' => 'BF-'.uniqid(),
            'payment_method' => 'cod',
            'cod_flag' => true,
            'payment_status' => 'pending',
            'order_status' => $orderStatus,
            'total_amount' => 100000,
            'subtotal_amount' => 100000,
            'customer_name' => 'Test',
            'customer_phone' => '0812000000',
            'shipping_name' => 'Test Penerima',
            'shipping_phone' => '0812000000',
            'shipping_address_line1' => 'Jl. Contoh No. 1',
            'shipping_province' => 'DKI Jakarta',
            'shipping_city' => 'Kota Jakarta Barat',
            'shipping_district' => 'Kebon Jeruk',
            'shipping_village' => 'Kebon Jeruk',
            'shipping_postal_code' => '11530',
        ]);

        if ($shippingDelivered !== null) {
            ShippingRecord::create([
                'order_id' => $order->id,
                'status' => $shippingDelivered ? 'delivered' : 'in_transit',
                'waybill_number' => 'JTB-'.uniqid(),
                'carrier_name' => 'J&T',
                'last_status_at' => $lastStatusAt,
            ]);
        }

        return $order;
    }

    public function test_backfill_marks_delivered_cod_as_paid(): void
    {
        $order = $this->codOrder('delivered', true, now()->subHour()->toDateTimeString());

        $this->artisan('retur:backfill-cod-paid')
            ->expectsOutputToContain('1 order diubah')
            ->assertSuccessful();

        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_backfill_skips_processing_cod(): void
    {
        $order = $this->codOrder('processing', true, now()->subHour()->toDateTimeString());

        $this->artisan('retur:backfill-cod-paid')->assertSuccessful();

        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_backfill_skips_delivered_but_no_shipping_record(): void
    {
        $order = $this->codOrder('delivered', false, null);

        $this->artisan('retur:backfill-cod-paid')->assertSuccessful();

        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_backfill_skips_non_cod(): void
    {
        $order = Order::create([
            'order_number' => 'TR-'.uniqid(),
            'payment_method' => 'transfer',
            'cod_flag' => false,
            'payment_status' => 'pending',
            'order_status' => 'delivered',
            'total_amount' => 100000,
            'subtotal_amount' => 100000,
            'customer_name' => 'Test',
            'customer_phone' => '0812000000',
            'shipping_name' => 'Test Penerima',
            'shipping_phone' => '0812000000',
            'shipping_address_line1' => 'Jl. Contoh No. 1',
            'shipping_province' => 'DKI Jakarta',
            'shipping_city' => 'Kota Jakarta Barat',
            'shipping_district' => 'Kebon Jeruk',
            'shipping_village' => 'Kebon Jeruk',
            'shipping_postal_code' => '11530',
        ]);
        ShippingRecord::create([
            'order_id' => $order->id,
            'status' => 'delivered',
            'waybill_number' => 'JTC-'.uniqid(),
            'carrier_name' => 'J&T',
            'last_status_at' => now()->subHour()->toDateTimeString(),
        ]);

        $this->artisan('retur:backfill-cod-paid')->assertSuccessful();

        $this->assertSame('pending', $order->fresh()->payment_status);
    }
}