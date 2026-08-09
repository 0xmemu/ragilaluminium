<?php

namespace Tests\Feature;

use App\Providers\AppServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class WhatsAppWebhookSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_meta_webhook_rejects_missing_signing_secret_by_default(): void
    {
        config([
            'services.whatsapp.allow_unsigned_webhooks' => false,
            'services.whatsapp.app_secret' => null,
        ]);

        $this->postJson('/webhook/whatsapp', ['entry' => []])->assertForbidden();
    }

    public function test_waha_webhook_rejects_missing_secret_by_default(): void
    {
        config([
            'services.whatsapp.allow_unsigned_webhooks' => false,
            'services.whatsapp.waha.webhook_secret' => null,
        ]);

        $this->postJson('/webhook/whatsapp/waha', ['event' => 'message'])->assertForbidden();
    }

    public function test_waha_secret_in_query_string_is_not_accepted(): void
    {
        config(['services.whatsapp.waha.webhook_secret' => 'waha-secret']);

        $this->postJson('/webhook/whatsapp/waha?secret=waha-secret', ['event' => 'message'])
            ->assertForbidden();
    }

    public function test_unsigned_webhook_escape_hatch_is_never_allowed_in_production(): void
    {
        $this->app->detectEnvironment(fn (): string => 'production');
        config([
            'services.whatsapp.allow_unsigned_webhooks' => true,
            'services.whatsapp.app_secret' => null,
        ]);

        $this->postJson('/webhook/whatsapp', ['entry' => []])->assertForbidden();
    }

    public function test_production_boot_rejects_unsigned_webhook_escape_hatch(): void
    {
        $this->app->detectEnvironment(fn (): string => 'production');
        config([
            'jnt.enabled' => false,
            'services.whatsapp.allow_unsigned_webhooks' => true,
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('WHATSAPP_ALLOW_UNSIGNED_WEBHOOKS');

        (new AppServiceProvider($this->app))->boot();
    }

    public function test_production_boot_requires_meta_app_secret_when_meta_is_configured(): void
    {
        $this->app->detectEnvironment(fn (): string => 'production');
        config([
            'jnt.enabled' => false,
            'services.whatsapp.allow_unsigned_webhooks' => false,
            'services.whatsapp.default_provider' => 'meta',
            'services.whatsapp.compare_provider' => null,
            'services.whatsapp.meta.token' => 'configured-token',
            'services.whatsapp.meta.number_id' => 'configured-number',
            'services.whatsapp.app_secret' => null,
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('WHATSAPP_APP_SECRET');

        (new AppServiceProvider($this->app))->boot();
    }

    public function test_production_boot_requires_waha_webhook_secret_when_waha_is_configured(): void
    {
        $this->app->detectEnvironment(fn (): string => 'production');
        config([
            'jnt.enabled' => false,
            'services.whatsapp.allow_unsigned_webhooks' => false,
            'services.whatsapp.default_provider' => 'waha',
            'services.whatsapp.compare_provider' => null,
            'services.whatsapp.waha.base_url' => 'https://waha.example',
            'services.whatsapp.waha.webhook_secret' => null,
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('WHATSAPP_WAHA_WEBHOOK_SECRET');

        (new AppServiceProvider($this->app))->boot();
    }
}
