<?php

namespace App\Services\Shipping;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Low-level client untuk J&T Cargo Open Platform.
 *
 * Dokumen: https://open.jtcargo.co.id/#/apiDoc
 *
 * Transport (lihat config/jnt.php):
 *   - POST x-www-form-urlencoded, field bizContent = JSON string
 *   - Header apiAccount, timestamp (epoch ms), digest = base64(md5(bizContent+privateKey))
 *
 * Log hanya menyimpan metadata operasional agar kredensial dan data pelanggan
 * tidak masuk ke file log.
 */
class JntCargoClient
{
    /** Buat/ubah order (addOrder). operateType 1=add, 2=modify. billCode = list. */
    public function createOrder(array $bizContent): JntResponse
    {
        return $this->call('order_create', $this->withOrderCredentials($bizContent));
    }

    /** Cek order (getOrders). */
    public function getOrders(array $bizContent): JntResponse
    {
        return $this->call('order_get', $this->withOrderCredentials($bizContent));
    }

    /** Batalkan order (cancelOrder). */
    public function cancelOrder(array $bizContent): JntResponse
    {
        return $this->call('order_cancel', $this->withOrderCredentials($bizContent));
    }

    /** Cek tarif & estimasi waktu (agingCost/get). */
    public function tariff(array $bizContent): JntResponse
    {
        return $this->call('tariff', $this->withOrderCredentials($bizContent));
    }

    /** 10-character dispatch code (getDispatchCode). */
    public function dispatchCode(array $bizContent): JntResponse
    {
        return $this->call('dispatch_code', $this->withOrderCredentials($bizContent));
    }

    /** Validasi provinsi/kota/area (getAddress). */
    public function address(array $bizContent): JntResponse
    {
        return $this->call('address', $this->withOrderCredentials($bizContent));
    }

    /** Ambil nomor resi massal (getBatchBillCode). */
    public function getBatchBillCode(int $num): JntResponse
    {
        return $this->call('batch_billcode', $this->withOrderCredentials([
            'code' => config('jnt.credentials.customer_code'),
            'num' => $num,
        ]));
    }

    /**
     * Lacak status via resi (logistics/trace). billCodes = string dipisah koma,
     * maksimal 30. Interface trace TIDAK butuh inner customerCode/digest.
     */
    public function track(array $bizContent): JntResponse
    {
        return $this->call('track', $bizContent);
    }

    /** Subscribe push trajektori (trace/subscribe). Tanpa inner creds. */
    public function subscribe(array $bizContent): JntResponse
    {
        return $this->call('track_subscribe', $bizContent);
    }

    public function isEnabled(): bool
    {
        return (bool) config('jnt.enabled')
            && config('jnt.credentials.api_account')
            && config('jnt.credentials.private_key');
    }

    public function environment(): string
    {
        return config('jnt.environment', 'sandbox');
    }

    public function baseUrl(): string
    {
        $env = $this->environment();

        return config("jnt.base_url.{$env}") ?: config('jnt.base_url.sandbox');
    }

    /**
     * Sisipkan customerCode + inner digest ke bizContent (interface order/tarif).
     * Inner digest = Base64(MD5(customerCode + cipher + privateKey)),
     * cipher = STRTOUPPER(MD5(plainPassword + salt)).
     */
    protected function withOrderCredentials(array $bizContent): array
    {
        $creds = [
            'customerCode' => config('jnt.credentials.customer_code'),
            'digest' => $this->innerDigest(),
        ];

        // bizContent lebih dulu, lalu creds tidak boleh ketimpa nilai null user.
        return array_merge($creds, array_filter($bizContent, fn ($v) => $v !== null));
    }

    public function innerDigest(): string
    {
        $customerCode = (string) config('jnt.credentials.customer_code');
        $password = (string) config('jnt.credentials.customer_password');
        $salt = (string) config('jnt.credentials.password_salt');
        $privateKey = (string) config('jnt.credentials.private_key');

        $cipher = strtoupper(md5($password.$salt));

        return base64_encode(md5($customerCode.$cipher.$privateKey, true));
    }

    protected function call(string $endpointKey, array $bizContent): JntResponse
    {
        $path = config("jnt.endpoints.{$endpointKey}");
        $url = $this->baseUrl().$path;

        $json = json_encode($bizContent, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $timestamp = (string) (int) (microtime(true) * 1000);
        $digest = $this->sign($json);

        $headers = [
            config('jnt.headers.api_account') => (string) config('jnt.credentials.api_account'),
            config('jnt.headers.timestamp') => $timestamp,
            config('jnt.headers.digest') => $digest,
        ];

        $requestId = (string) Str::uuid();
        $startedAt = microtime(true);

        Log::channel('jnt')->info('JNT request', [
            'request_id' => $requestId,
            'env' => $this->environment(),
            'endpoint' => $endpointKey,
            'url' => $url,
            'timestamp' => $timestamp,
            'customer_order_ref' => $this->logReference($bizContent['txlogisticId'] ?? null),
            'waybill_ref' => $this->logReference($bizContent['billCode'] ?? $bizContent['billCodes'] ?? null),
        ]);

        try {
            $response = $this->httpClient($endpointKey)
                ->asForm()
                ->withHeaders($headers)
                ->post($url, [config('jnt.content_field') => $json]);

            $elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);
            $body = $response->json() ?? [];

            Log::channel('jnt')->info('JNT response', [
                'request_id' => $requestId,
                'endpoint' => $endpointKey,
                'http_status' => $response->status(),
                'elapsed_ms' => $elapsedMs,
                'business_code' => $body['code'] ?? null,
                'business_success' => $this->isBusinessSuccess($body),
            ]);

            return new JntResponse(
                ok: $response->successful() && $this->isBusinessSuccess($body),
                httpStatus: $response->status(),
                data: $body,
                requestId: $requestId,
                elapsedMs: $elapsedMs,
            );
        } catch (\Throwable $e) {
            $elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);

            Log::channel('jnt')->error('JNT request failed', [
                'request_id' => $requestId,
                'endpoint' => $endpointKey,
                'exception' => $e::class,
                'error_code' => $e->getCode(),
                'elapsed_ms' => $elapsedMs,
            ]);

            return new JntResponse(
                ok: false,
                httpStatus: 0,
                data: ['error' => $e->getMessage()],
                requestId: $requestId,
                elapsedMs: $elapsedMs,
            );
        }
    }

    protected function logReference(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $normalized = is_scalar($value)
            ? (string) $value
            : (string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return substr(hash('sha256', $normalized), 0, 12);
    }

    protected function httpClient(string $endpointKey): PendingRequest
    {
        $http = config('jnt.http');
        $readOnlyEndpoints = ['order_get', 'tariff', 'track', 'dispatch_code', 'address'];
        $retries = in_array($endpointKey, $readOnlyEndpoints, true)
            ? max(0, (int) $http['retries'])
            : 0;

        return Http::timeout($http['timeout'])
            ->connectTimeout($http['connect_timeout'])
            ->retry($retries, $http['retry_sleep_ms'], throw: false);
    }

    /** HEADER digest = Base64(MD5(bizContent + privateKey)). */
    public function sign(string $bizContentJson): string
    {
        $privateKey = (string) config('jnt.credentials.private_key');

        return base64_encode(md5($bizContentJson.$privateKey, true));
    }

    /**
     * Verifikasi tanda tangan push J&T terhadap payload mentah bizContent.
     */
    public function verifyWebhookSignature(string $bizContentJson, ?string $signature): bool
    {
        if (! $signature) {
            return false;
        }

        $privateKey = (string) config('jnt.webhook.private_key');
        $raw = $bizContentJson.$privateKey;

        $expectedBase64 = base64_encode(md5($raw, true));
        $expectedHex = md5($raw);

        return hash_equals($expectedBase64, $signature) || hash_equals($expectedHex, $signature);
    }

    /** J&T umumnya mengembalikan code "1"/success atau isSuccess=true. */
    protected function isBusinessSuccess(array $body): bool
    {
        if (isset($body['code'])) {
            return in_array((string) $body['code'], ['1', '0', '200', 'success'], true);
        }
        if (isset($body['isSuccess'])) {
            return filter_var($body['isSuccess'], FILTER_VALIDATE_BOOLEAN);
        }
        if (isset($body['success'])) {
            return filter_var($body['success'], FILTER_VALIDATE_BOOLEAN);
        }

        return ! isset($body['error']);
    }
}
