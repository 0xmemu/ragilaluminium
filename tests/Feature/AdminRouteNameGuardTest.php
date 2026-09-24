<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Penjaga nama route admin (Batch 0, audit admin 2026-09-23).
 *
 * Controller admin sudah pernah 500 karena memanggil `route('media.attach')`
 * padahal route itu terdaftar di dalam grup ber-prefix nama `admin.`, sehingga
 * nama sesungguhnya `admin.media.attach`. Error seperti ini baru terlihat saat
 * halaman dibuka, bukan saat build. Test ini memindai semua literal nama route
 * di berkas controller admin dan memastikan setiap nama unik benar-benar
 * terdaftar, jadi salah ketik nama route ketahuan lebih awal.
 *
 * Tidak memakai database: cukup Route::has().
 */
class AdminRouteNameGuardTest extends TestCase
{
    public function test_all_route_names_in_admin_controllers_are_registered(): void
    {
        $dir = app_path('Http/Controllers/Admin');
        $this->assertDirectoryExists($dir, 'Direktori controller admin tidak ditemukan');

        $names = [];

        foreach (File::files($dir) as $file) {
            // Hanya berkas controller sungguhan; berkas cadangan (.bak-*) dan
            // berkas non-controller diabaikan.
            $name = $file->getFilename();
            if (! str_ends_with($name, 'Controller.php')) {
                continue;
            }

            $contents = (string) File::get($file->getPathname());

            foreach (['\'', '"'] as $quote) {
                if (preg_match_all('/route\(\s*'.preg_quote($quote, '/').'([^'.preg_quote($quote, '/').']+)'.preg_quote($quote, '/').'/', $contents, $matches)) {
                    foreach ($matches[1] as $candidate) {
                        // Nama dinamis (mengandung variabel) tidak bisa diverifikasi statis.
                        if (str_contains($candidate, '$')) {
                            continue;
                        }
                        $names[$candidate] = $name;
                    }
                }
            }
        }

        $this->assertNotEmpty($names, 'Tidak ada literal nama route yang terbaca di controller admin');

        $missing = [];
        foreach ($names as $routeName => $sourceFile) {
            if (! Route::has($routeName)) {
                $missing[] = "{$routeName} (dipakai di {$sourceFile})";
            }
        }

        sort($missing);
        $this->assertSame([], $missing, "Nama route berikut dipanggil di controller admin tetapi tidak terdaftar:\n".implode("\n", $missing));
    }
}
