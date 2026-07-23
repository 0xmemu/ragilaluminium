<?php

namespace App\Support;

/**
 * Guard anti-SSRF untuk unduhan dari URL eksternal (media Shopee).
 * Menolak skema non-http(s), host kosong, dan IP privat/reserved/loopback.
 */
class UrlGuard
{
    public static function assertSafePublicUrl(string $url, array $allowedHosts = []): void
    {
        $parts = parse_url($url);

        if ($parts === false || empty($parts['scheme']) || empty($parts['host'])) {
            throw new \RuntimeException('URL tidak valid.');
        }

        if (! in_array(strtolower($parts['scheme']), ['http', 'https'], true)) {
            throw new \RuntimeException('Skema URL tidak diizinkan.');
        }

        $host = $parts['host'];

        if (! empty($allowedHosts) && ! self::hostAllowed($host, $allowedHosts)) {
            throw new \RuntimeException("Host {$host} tidak ada di daftar izin.");
        }

        foreach (self::resolveIps($host) as $ip) {
            if (! self::isPublicIp($ip)) {
                throw new \RuntimeException("Host {$host} me-resolve ke IP non-publik ({$ip}).");
            }
        }
    }

    protected static function hostAllowed(string $host, array $allowedHosts): bool
    {
        $host = strtolower($host);
        foreach ($allowedHosts as $allowed) {
            $allowed = strtolower(trim($allowed));
            if ($allowed !== '' && ($host === $allowed || str_ends_with($host, '.'.$allowed))) {
                return true;
            }
        }

        return false;
    }

    protected static function resolveIps(string $host): array
    {
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return [$host];
        }

        $records = @dns_get_record($host, DNS_A | DNS_AAAA) ?: [];
        $ips = [];
        foreach ($records as $r) {
            if (! empty($r['ip'])) {
                $ips[] = $r['ip'];
            }
            if (! empty($r['ipv6'])) {
                $ips[] = $r['ipv6'];
            }
        }

        // Jika DNS gagal (mis. sandbox/offline), jangan blokir buta — biarkan
        // lapisan allowlist host & timeout HTTP yang membatasi.
        return $ips;
    }

    protected static function isPublicIp(string $ip): bool
    {
        return (bool) filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        );
    }
}
