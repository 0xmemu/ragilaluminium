<?php

namespace Tests\Feature;

use App\Providers\AppServiceProvider;
use RuntimeException;
use Tests\TestCase;

class JntProductionGateTest extends TestCase
{
    public function test_production_boot_fails_when_jnt_is_enabled_without_signing_key(): void
    {
        $this->app->detectEnvironment(fn (): string => 'production');
        config([
            'jnt.enabled' => true,
            'jnt.webhook.private_key' => null,
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('JNT_WEBHOOK_PRIVATE_KEY');

        (new AppServiceProvider($this->app))->boot();
    }
}
