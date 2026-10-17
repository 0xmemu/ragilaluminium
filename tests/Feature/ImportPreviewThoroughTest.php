<?php

namespace Tests\Feature;

use App\Imports\CatalogProductsImportV2;
use App\Models\ImportJob;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

/**
 * Kontrak 17 Okt 2026 (permintaan owner):
 *  - Periksa file WAJIB memeriksa seluruh baris, bukan sebagian. Kalau tidak,
 *    pemeriksaan hanya formalitas.
 *  - Media dari host mana pun diterima selama benar-benar bisa diunduh.
 *    Yang ditolak hanya URL yang tidak bisa diunduh.
 *  - Masalah media menjadi pemblokir: tombol Mulai Import mati sampai beres.
 */
class ImportPreviewThoroughTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('media');
        Storage::fake('imports');
        \App\Support\MediaUrlProbe::flush();
        // Test memakai host palsu (contoh.test), jadi pemeriksaan DNS
        // dimatikan. Penjagaan SSRF tetap diuji terpisah di UrlGuardTest.
        config(['media.preview_probe' => true, 'media.probe_dns_check' => false]);
    }

    private function baris(int $noId, string $nama, string $foto): array
    {
        return [
            'no_id' => $noId,
            'nama_produk' => $nama,
            'deskripsi_produk' => 'Deskripsi uji.',
            'spesifikasi' => 'Bahan: Aluminium',
            'kategori_produk' => 'JENDELA',
            'model_produk' => 'JUNGKIT',
            'sub_model' => 'ORNAMEN',
            'nama_variasi_1' => 'Warna',
            'opsi_variasi_1' => 'Putih',
            'harga' => 1500000,
            'stok' => 5,
            'berat_kg' => 18,
            'tinggi_cm' => 100,
            'panjang_cm' => 70,
            'lebar_cm' => 8,
            'gambar_1_utama' => $foto,
        ];
    }

    /** @param  list<array>  $rows */
    private function berkas(array $rows): string
    {
        $ss = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $ws = $ss->getActiveSheet();

        foreach (array_keys($rows[0]) as $i => $header) {
            $ws->setCellValue(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1).'1', $header);
        }
        foreach ($rows as $r => $row) {
            foreach (array_values($row) as $c => $value) {
                $ws->setCellValue(
                    \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($c + 1).($r + 2),
                    $value
                );
            }
        }

        $path = Storage::disk('imports')->path('tmp/uji-preview.xlsx');
        @mkdir(dirname($path), 0775, true);
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($ss))->save($path);

        return $path;
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function periksa(string $path): array
    {
        $upload = new UploadedFile(
            $path,
            'uji.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $res = $this->actingAs($this->admin())
            ->post(route('admin.imports.preview-catalog'), ['file' => $upload]);
        $res->assertOk();

        return json_decode($res->getContent(), true);
    }

    public function test_pemeriksaan_menyentuh_seluruh_baris_bukan_hanya_seribu(): void
    {
        config(['media.preview_display_rows' => 50]);

        // 1.200 baris: di atas batas tampilan, dan di atas 1.000 yang dulu
        // menjadi batas pemeriksaan. URL sengaja unik per baris.
        $rows = [];
        for ($i = 1; $i <= 1200; $i++) {
            $rows[] = $this->baris($i, 'Produk Uji '.$i, 'https://contoh.test/foto-'.$i.'.webp');
        }

        // Semua URL bisa diunduh.
        Http::fake(['*' => Http::response('', 200)]);

        $data = $this->periksa($this->berkas($rows));

        $this->assertSame(1200, $data['total'], 'seluruh baris terisi dihitung');
        $this->assertSame(
            1200,
            $data['media_totals']['external'],
            'seluruh 1.200 URL diperiksa, bukan hanya 1.000 pertama'
        );
        $this->assertSame(0, $data['media_errors_total']);
        $this->assertLessThanOrEqual(
            50,
            $data['shown_rows'],
            'tabel tetap dibatasi, tetapi angkanya mencakup semua baris'
        );
        $this->assertSame(1200, $data['total'], 'jumlah yang dilaporkan tetap seluruh berkas');
    }

    public function test_media_tidak_bisa_diunduh_menjadi_pemblokir(): void
    {
        Http::fake([
            'https://contoh.test/ada.webp' => Http::response('', 200),
            'https://contoh.test/hilang.webp' => Http::response('', 404),
        ]);

        $rows = [
            $this->baris(1, 'Produk Ada', 'https://contoh.test/ada.webp'),
            $this->baris(2, 'Produk Hilang', 'https://contoh.test/hilang.webp'),
        ];

        $data = $this->periksa($this->berkas($rows));

        $this->assertSame(1, $data['media_totals']['external']);
        $this->assertSame(1, $data['media_totals']['unreachable']);
        $this->assertSame(1, $data['media_errors_total']);
        $this->assertStringContainsString('tidak bisa diunduh', $data['media_errors'][0]);
        $this->assertStringContainsString('hilang.webp', $data['media_errors'][0]);
    }

    public function test_media_dari_host_baru_diterima_tanpa_daftar_izin(): void
    {
        // Host yang TIDAK ada di daftar mana pun, dan berkasnya bisa diunduh.
        Http::fake(['https://gudang-foto-baru.example/*' => Http::response('', 200)]);

        $rows = [$this->baris(1, 'Produk Host Baru', 'https://gudang-foto-baru.example/foto.webp')];
        $data = $this->periksa($this->berkas($rows));

        $this->assertSame(
            1,
            $data['media_totals']['external'],
            'host baru tetap diterima selama bisa diunduh'
        );
        $this->assertSame(0, $data['media_errors_total'], 'tidak boleh ditolak karena daftar host');
    }

    public function test_daftar_host_bawaan_kosong(): void
    {
        // Bawaan di berkas konfigurasi tidak boleh memuat daftar host apa pun.
        // Daftar hanya diisi bila admin memang ingin membatasi sumber.
        $config = file_get_contents(base_path('config/media.php'));

        $this->assertStringContainsString(
            "env('MEDIA_ALLOWED_HOSTS', '')",
            $config,
            'bawaan daftar host harus kosong'
        );
        $this->assertStringNotContainsString(
            'susercontent.com',
            $config,
            'konfigurasi tidak boleh membawa daftar host bawaan'
        );
    }

    public function test_url_bukan_gambar_tetap_ditolak(): void
    {
        $rows = [$this->baris(1, 'Produk URL Rusak', 'bukan-url')];
        $data = $this->periksa($this->berkas($rows));

        $this->assertSame(1, $data['media_totals']['invalid']);
        $this->assertSame(1, $data['media_errors_total']);
    }

    public function test_permintaan_media_membawa_identitas_peramban(): void
    {
        // Banyak CDN membalas 403 untuk permintaan tanpa User-Agent, termasuk
        // berkas yang sebenarnya bisa diunduh. Probe dan job unduh wajib
        // memakai header yang sama supaya hasil periksa mencerminkan nasib
        // sebenarnya.
        Http::fake(['*' => Http::response('', 200)]);

        $rows = [$this->baris(1, 'Produk Host Baru', 'https://gudang-foto-baru.example/foto.webp')];
        $data = $this->periksa($this->berkas($rows));

        $this->assertSame(0, $data['media_errors_total']);

        Http::assertSent(function ($request) {
            return $request->hasHeader('User-Agent')
                && str_contains((string) $request->header('User-Agent')[0], 'Mozilla')
                && $request->hasHeader('Accept');
        });
    }

    public function test_impor_tetap_berjalan_untuk_media_internal(): void
    {
        Storage::disk('media')->put('media-assets/uji/pdp.webp', 'isi');

        // Host disk media disetel sama dengan URL uji supaya URL dikenali
        // sebagai aset internal (bukan eksternal yang perlu diunduh).
        config(['filesystems.disks.media.url' => 'https://contoh.test']);

        $job = ImportJob::create([
            'type' => 'catalog_import',
            'source_file_name' => 'uji.xlsx',
            'source_file_path' => 'tmp/uji.xlsx',
            'stock_mode' => 'file',
            'status' => 'pending',
            'triggered_by_user_id' => $this->admin()->id,
        ]);

        $path = $this->berkas([
            $this->baris(1, 'Produk Internal', 'https://contoh.test/media-assets/uji/pdp.webp'),
        ]);

        // Media internal dikenali dari object_key, jadi tidak perlu jaringan.
        $data = $this->periksa($path);
        $this->assertSame(0, $data['media_errors_total']);

        Excel::import(new CatalogProductsImportV2($job->id, $path), $path);
        $this->assertSame(1, \App\Models\Product::count());
    }
}
