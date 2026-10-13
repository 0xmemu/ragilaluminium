<?php

namespace Tests\Feature;

use App\Http\Middleware\SecurityHeaders;
use App\Providers\AppServiceProvider;
use Illuminate\Http\Request;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class ProductionSecurityGateTest extends TestCase
{
    public function test_report_only_csp_allows_only_google_maps_frame_origin(): void
    {
        $request = Request::create('/about', 'GET');
        $response = (new SecurityHeaders())->handle($request, fn () => response('ok'));
        $policy = (string) $response->headers->get('Content-Security-Policy-Report-Only');

        $this->assertStringContainsString("frame-src https://maps.google.com", $policy);
        $this->assertStringNotContainsString("frame-src 'none'", $policy);
        $this->assertStringNotContainsString("frame-src https:;", $policy);
    }

    /**
     * @param  array<string, mixed>  $override
     */
    #[DataProvider('invalidProductionConfigurationProvider')]
    public function test_production_boot_rejects_unsafe_perimeter_configuration(
        array $override,
        string $expectedMessage,
    ): void {
        $this->app->detectEnvironment(fn (): string => 'production');
        config(array_merge([
            'jnt.enabled' => false,
            'services.whatsapp.allow_unsigned_webhooks' => false,
            'services.whatsapp.default_provider' => null,
            'services.whatsapp.compare_provider' => null,
            'app.debug' => false,
            'app.url' => 'https://shop.example.test',
            'session.secure' => true,
            'session.http_only' => true,
            'security.force_https' => true,
            'security.trusted_proxies' => ['127.0.0.1', '::1'],
        ], $override));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage($expectedMessage);

        (new AppServiceProvider($this->app))->boot();
    }

    /** @return array<string, array{array<string, mixed>, string}> */
    public static function invalidProductionConfigurationProvider(): array
    {
        return [
            'debug enabled' => [['app.debug' => true], 'APP_DEBUG'],
            'non https app url' => [['app.url' => 'http://shop.example.test'], 'APP_URL'],
            'https forcing disabled' => [['security.force_https' => false], 'FORCE_HTTPS'],
            'insecure session cookie' => [['session.secure' => false], 'SESSION_SECURE_COOKIE'],
            'javascript readable session cookie' => [['session.http_only' => false], 'SESSION_HTTP_ONLY'],
            'wildcard proxy trust' => [['security.trusted_proxies' => ['*']], 'TRUSTED_PROXIES'],
            'empty proxy trust' => [['security.trusted_proxies' => []], 'TRUSTED_PROXIES'],
        ];
    }
}
