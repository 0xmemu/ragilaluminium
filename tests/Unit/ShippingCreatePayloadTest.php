<?php

namespace Tests\Unit;

use App\Models\Order;
use App\Models\OrderItem;
use App\Services\ShippingService;
use Illuminate\Support\Collection;
use Tests\TestCase;

class ShippingCreatePayloadTest extends TestCase
{
    public function test_create_payload_uses_order_package_snapshot(): void
    {
        $order = new Order();
        $order->forceFill([
            'order_number' => 'ORD-TEST-SNAPSHOT',
            'shipping_chargeable_weight_kg' => 17.554,
            'shipping_package_snapshot' => [
                'length_cm' => 106,
                'width_cm' => 18,
                'height_cm' => 46,
                'volume_cm3' => 87768,
                'chargeable_weight_kg' => 17.554,
            ],
            'cod_flag' => false,
            'customer_phone' => '081234567890',
            'customer_name' => 'Test',
            'shipping_province' => 'Jawa Timur',
            'shipping_city' => 'Kota Batu',
            'shipping_postal_code' => '65315',
            'shipping_address_line1' => 'Alamat test',
        ]);
        $order->setRelation('items', new Collection([
            (new OrderItem())->forceFill(['name' => 'Produk', 'quantity' => 2, 'unit_price' => 1000]),
        ]));

        $service = app(ShippingService::class);
        $method = new \ReflectionMethod($service, 'buildCreateOrderPayload');
        $method->setAccessible(true);
        $payload = $method->invoke($service, $order, 1.0);

        $this->assertSame('17.554', $payload['weight']);
        $this->assertSame(1, $payload['totalQuantity']);
        $this->assertSame(106, $payload['length']);
        $this->assertSame(18, $payload['width']);
        $this->assertSame(46, $payload['height']);
        $this->assertSame(87768, $payload['volume']);
    }
}
