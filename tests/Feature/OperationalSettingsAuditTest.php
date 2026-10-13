<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\User;
use App\Support\CodSettings;
use App\Support\OperationalSettings;
use App\Support\OrderEta;
use App\Support\ShippingSubsidySettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use LogicException;
use Tests\TestCase;

class OperationalSettingsAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_operational_settings_are_versioned_and_audited_with_before_after(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $first = OperationalSettings::record(
            OperationalSettings::COD,
            ['enabled' => true, 'fee_type' => 'percent', 'fee_value' => 2.5, 'max_order_amount' => 5000000],
            $admin->id,
            'admin',
            'Aktifkan biaya COD',
            'cms_page',
            'checkout',
        );
        $second = OperationalSettings::record(
            OperationalSettings::COD,
            ['enabled' => true, 'fee_type' => 'percent', 'fee_value' => 3, 'max_order_amount' => 5000000],
            $admin->id,
            'admin',
            'Sesuaikan persentase',
            'cms_page',
            'checkout',
        );

        $this->assertSame(1, $first->version);
        $this->assertSame(2, $second->version);
        $this->assertEquals(3.0, OperationalSettings::get(OperationalSettings::COD)['fee_value']);

        $event = EventLog::query()
            ->where('event_type', 'settings.version_created')
            ->where('entity_id', $second->id)
            ->firstOrFail();

        $this->assertSame('admin', $event->source);
        $this->assertSame('Sesuaikan persentase', $event->reason);
        $this->assertSame('cms_page', $event->reference_type);
        $this->assertSame('checkout', $event->reference_id);
        $this->assertSame(2.5, $event->before['fee_value']);
        $this->assertEquals(3.0, $event->after['fee_value']);
    }

    public function test_operational_setting_versions_and_activity_logs_are_immutable(): void
    {
        $version = OperationalSettings::record(
            OperationalSettings::STOCK_RANDOMIZATION,
            ['default_enabled' => true, 'min' => 700, 'max' => 5000],
        );

        $this->expectException(LogicException::class);
        $version->update(['reason' => 'tamper']);
    }

    public function test_activity_log_cannot_be_deleted(): void
    {
        $event = EventLog::create([
            'event_type' => 'settings.test',
            'entity_type' => 'settings',
            'entity_id' => 1,
            'payload' => [],
            'created_at' => now(),
        ]);

        $this->expectException(LogicException::class);
        $event->delete();
    }

    public function test_stock_range_and_eta_buffer_are_normalized(): void
    {
        $stock = OperationalSettings::record(
            OperationalSettings::STOCK_RANDOMIZATION,
            ['default_enabled' => false, 'min' => 5000, 'max' => 700],
        );
        $this->assertSame(['default_enabled' => false, 'min' => 5000, 'max' => 5000], $stock->value);

        Carbon::setTestNow(Carbon::parse('2026-08-15 10:00:00'));
        OperationalSettings::record(OperationalSettings::ETA, [
            'production_days' => 1,
            'delivery_min_days' => 2,
            'delivery_max_days' => 5,
            'display_buffer_days' => 1,
        ]);

        $eta = OrderEta::forOrder();
        $this->assertSame(3, $eta['min_days']);
        $this->assertSame(6, $eta['max_days']);
        $this->assertSame(1, $eta['display_buffer_days']);
        Carbon::setTestNow();
    }

    public function test_existing_financial_settings_create_versions(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        CodSettings::update([
            'enabled' => true,
            'fee_type' => 'percent',
            'fee_value' => 2,
            'max_order_amount' => null,
        ], $admin->id, ['reason' => 'Uji COD']);

        ShippingSubsidySettings::update([
            'enabled' => true,
            'subsidy_type' => 'percent',
            'subsidy_value' => 50,
            'jnt_enabled' => true,
        ], $admin->id, ['reason' => 'Uji subsidi']);

        $this->assertDatabaseHas('operational_setting_versions', [
            'setting_key' => OperationalSettings::COD,
            'version' => 1,
            'reason' => 'Uji COD',
        ]);
        $this->assertDatabaseHas('operational_setting_versions', [
            'setting_key' => OperationalSettings::SHIPPING_SUBSIDY,
            'version' => 1,
            'reason' => 'Uji subsidi',
        ]);
    }

    public function test_subsidy_page_does_not_expose_provider_readiness(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.shipping-subsidy.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ShippingSubsidy/Edit')
                ->missing('jntConfigured'));
    }

    public function test_operational_settings_are_not_publicly_readable(): void
    {
        $this->get(route('admin.cod-settings.edit'))->assertRedirect(route('login'));
    }
}
