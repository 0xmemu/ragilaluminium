<?php

namespace Tests\Feature;

use App\Support\OperationalSettings;
use App\Support\OrderEta;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class OrderEtaContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_display_buffer_is_applied_once_at_customer_presentation_boundary(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-15 10:00:00'));
        OperationalSettings::record(OperationalSettings::ETA, [
            'production_days' => 1,
            'delivery_min_days' => 2,
            'delivery_max_days' => 5,
            'display_buffer_days' => 1,
        ]);

        $raw = OrderEta::deliveryRange();
        $this->assertSame(['min_days' => 2, 'max_days' => 5], $raw);

        $eta = OrderEta::forOrder();
        $this->assertSame(3, $eta['min_days']);
        $this->assertSame(6, $eta['max_days']);
        $this->assertSame(2, $eta['base_min_days']);
        $this->assertSame(5, $eta['base_max_days']);
        $this->assertSame(1, $eta['display_buffer_days']);
        $this->assertSame('2026-08-19T00:00:00+00:00', $eta['start_at']);
        $this->assertSame('2026-08-22T23:59:59+00:00', $eta['end_at']);

        Carbon::setTestNow();
    }
}
