<?php

namespace Tests\Feature;

use App\Services\Shipping\JntCargoClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Mockery;
use Tests\TestCase;

class JntSafeLoggingTest extends TestCase
{
    public function test_jnt_logs_do_not_contain_credentials_payload_or_provider_message(): void
    {
        config([
            'jnt.credentials.api_account' => 'secret-api-account',
            'jnt.credentials.private_key' => 'secret-private-key',
            'jnt.credentials.customer_code' => 'secret-customer-code',
            'jnt.credentials.customer_password' => 'secret-password',
        ]);

        Http::fake([
            '*' => Http::response([
                'code' => '1',
                'msg' => 'Paket Budi 08123456789 berhasil',
            ], 200),
        ]);

        $forbidden = [
            'secret-api-account',
            'secret-private-key',
            'secret-customer-code',
            'secret-password',
            'Budi',
            '08123456789',
            'Jl. Pelanggan',
            'ORDER-RAW-123',
        ];
        $isSafe = static function (array $context) use ($forbidden): bool {
            $encoded = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            return collect($forbidden)->every(
                fn (string $value): bool => ! str_contains((string) $encoded, $value)
            );
        };

        $logger = Mockery::mock();
        $logger->shouldReceive('info')
            ->once()
            ->with('JNT request', Mockery::on($isSafe));
        $logger->shouldReceive('info')
            ->once()
            ->with('JNT response', Mockery::on($isSafe));
        Log::shouldReceive('channel')
            ->with('jnt')
            ->twice()
            ->andReturn($logger);

        $response = app(JntCargoClient::class)->createOrder([
            'txlogisticId' => 'ORDER-RAW-123',
            'receiver' => [
                'name' => 'Budi',
                'mobile' => '08123456789',
                'address' => 'Jl. Pelanggan',
            ],
        ]);

        $this->assertTrue($response->ok);
    }
}
