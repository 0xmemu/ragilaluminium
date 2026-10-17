<?php

namespace App\Support;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Uji apakah sebuah URL media benar-benar bisa diunduh.
 *
 * Dipakai pemeriksaan berkas (Periksa file) supaya media dari host mana pun
 * diterima SELAMA berkasnya bisa diambil. Yang ditolak hanya URL yang tidak
 * bisa diunduh, bukan URL yang host-nya tidak ada di daftar izin.
 *
 * Aturan sama dengan job unduh: permintaan TIDAK mengikuti pengalihan, jadi
 * URL yang membalas 3xx di sini juga akan gagal saat impor. Dengan begitu
 * hasil pemeriksaan mencerminkan nasib sebenarnya.
 *
 * Pemeriksaan berjalan paralel per kelompok supaya berkas dengan ratusan URL
 * tidak membuat halaman Periksa file menggantung.
 */
final class MediaUrlProbe
{
    /** @var array<string, bool> hasil per URL, agar URL berulang tidak diperiksa dua kali. */
    private static array $cache = [];

    // 20 permintaan sekaligus. Berkas nyata 1.812 baris hanya punya 77 URL
    // unik, jadi seluruh pemeriksaan selesai dalam beberapa detik.
    private const CHUNK = 20;

    /**
     * Periksa banyak URL sekaligus.
     *
     * @param  list<string>  $urls
     * @return array<string, bool> URL => bisa diunduh
     */
    public static function probeMany(array $urls): array
    {
        $timeout = max(2, (int) config('media.preview_probe_timeout', 4));
        $results = [];
        $pending = [];

        foreach (array_values(array_unique($urls)) as $url) {
            if (array_key_exists($url, self::$cache)) {
                $results[$url] = self::$cache[$url];
                continue;
            }

            // URL yang menunjuk IP privat/loopback tidak pernah dianggap bisa
            // diunduh. Ini penjagaan SSRF, bukan daftar host.
            try {
                UrlGuard::assertSafePublicUrl(
                    $url,
                    [],
                    (bool) config('media.probe_dns_check', true)
                );
            } catch (\Throwable) {
                $results[$url] = self::$cache[$url] = false;
                continue;
            }

            $pending[] = $url;
        }

        foreach (array_chunk($pending, self::CHUNK) as $chunk) {
            $responses = [];
            try {
                $responses = Http::pool(function (Pool $pool) use ($chunk, $timeout) {
                    $requests = [];
                    foreach ($chunk as $index => $url) {
                        $requests[] = $pool->as((string) $index)
                            ->timeout($timeout)
                            ->withoutRedirecting()
                            ->withHeaders(self::browserHeaders())
                            ->head($url);
                    }

                    return $requests;
                });
            } catch (\Throwable) {
                $responses = [];
            }

            foreach ($chunk as $index => $url) {
                $response = $responses[(string) $index] ?? null;
                $ok = $response instanceof Response && $response->successful();

                if (! $ok) {
                    $ok = self::probeWithRange($url, $timeout);
                }

                $results[$url] = self::$cache[$url] = $ok;
            }
        }

        return $results;
    }

    /**
     * Banyak CDN menolak HEAD (405/403). Ambil satu byte sebagai bukti berkas
     * benar-benar bisa diambil.
     */
    private static function probeWithRange(string $url, int $timeout): bool
    {
        try {
            $response = Http::timeout($timeout)
                ->withoutRedirecting()
                ->withHeaders(self::browserHeaders() + ['Range' => 'bytes=0-0'])
                ->get($url);

            return $response->successful() || $response->status() === 206;
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Header yang dipakai saat memeriksa. WAJIB sama dengan yang dipakai job
     * unduh, supaya hasil pemeriksaan mencerminkan nasib sebenarnya.
     *
     * @return array<string, string>
     */
    private static function browserHeaders(): array
    {
        return [
            'User-Agent' => (string) config('media.user_agent'),
            'Accept' => (string) config('media.accept_header'),
        ];
    }

    /** Kosongkan cache. Dipakai test supaya hasil satu kasus tidak bocor ke kasus lain. */
    public static function flush(): void
    {
        self::$cache = [];
    }
}
