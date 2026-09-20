<?php

namespace Tests\Feature;

use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Menjaga agar seluruh KPI yang dihitung server punya tempat di kategori drawer.
 *
 * Halaman Performa Toko punya satu drawer dengan tujuh kategori. Bila suatu
 * saat service menambah KPI baru tetapi kategorinya tidak diperbarui, angka itu
 * akan terhitung tetapi tidak bisa dilihat admin di mana pun. Tes ini menutup
 * celah itu: setiap kunci KPI dari service wajib dirujuk di definisi kategori.
 *
 * Cara kerjanya sengaja sederhana dan stabil: kunci KPI adalah string yang sama
 * di PHP dan di TypeScript, jadi cukup memastikan tiap kunci muncul di berkas
 * halaman. Bukan tes yang rapuh terhadap perubahan tata letak.
 */
class StorePerformanceKpiCoverageTest extends TestCase
{
    use RefreshDatabase;

    private function halaman(): string
    {
        $path = base_path('resources/js/pages/Admin/Analytics/StorePerformance.tsx');
        $isi = file_get_contents($path);

        $this->assertNotFalse($isi, 'berkas halaman harus terbaca');

        return $isi;
    }

    /** Semua kunci KPI yang benar-benar dihitung service. */
    private function kunciKpi(): array
    {
        $report = app(StorePerformanceService::class)->build('last_7');

        $kunci = [];
        foreach ($report['sections'] as $section) {
            foreach ($section['kpis'] as $kpi) {
                $kunci[] = $kpi['key'];
            }
        }

        sort($kunci);

        return $kunci;
    }

    public function test_setiap_kunci_kpi_dirujuk_di_definisi_kategori(): void
    {
        $isi = $this->halaman();
        $kunci = $this->kunciKpi();

        $this->assertNotEmpty($kunci, 'service harus mengembalikan KPI');

        $hilang = [];
        foreach ($kunci as $key) {
            // Kunci dipakai sebagai string di kpiRows([...]) atau kpiMap["..."].
            if (! str_contains($isi, '"'.$key.'"')) {
                $hilang[] = $key;
            }
        }

        $this->assertSame(
            [],
            $hilang,
            'KPI ini dihitung server tetapi tidak dirujuk di kategori mana pun,'
                .' sehingga admin tidak bisa melihatnya: '.implode(', ', $hilang)
        );
    }

    public function test_tujuh_kategori_didefinisikan(): void
    {
        $isi = $this->halaman();

        // Kategori yang harus ada. Urutannya juga menentukan urutan pil filter.
        foreach ([
            'penjualan',
            'arus-kas',
            'operasional',
            'pengunjung',
            'retur',
            'katalog',
            'referensi',
        ] as $kategori) {
            $this->assertStringContainsString(
                '"'.$kategori.'"',
                $isi,
                'kategori "'.$kategori.'" harus terdaftar di DETAIL_CATEGORIES'
            );
        }

        $this->assertStringContainsString('const DETAIL_CATEGORIES', $isi);
    }

    public function test_sistem_drawer_per_kpi_sudah_tidak_ada(): void
    {
        $isi = $this->halaman();

        // Empat penanda subsistem lama. Bila salah satunya kembali, berarti
        // drawer per KPI dihidupkan lagi dan filter kategori jadi tidak tunggal.
        $this->assertStringNotContainsString(
            'MetricInfoButton',
            $isi,
            'tombol info per KPI harus sudah dihapus'
        );
        $this->assertStringNotContainsString(
            'buildMetricDetail',
            $isi,
            'pembangun drawer per metrik harus sudah dihapus'
        );
        $this->assertStringNotContainsString(
            'MetricDetailPanel',
            $isi,
            'panel drawer per metrik harus sudah dihapus'
        );
        $this->assertStringNotContainsString(
            'activeMetric',
            $isi,
            'state drawer per metrik harus sudah dihapus'
        );
    }

    public function test_pemilihan_kategori_tidak_memicu_permintaan_server(): void
    {
        $isi = $this->halaman();

        // Pembangun isi kategori hanya boleh bergantung pada props, bukan
        // memanggil router. Membangun laporan terukur 418 ms dengan 177 query,
        // jadi berpindah kategori tidak boleh membayarnya ulang.
        $awal = strpos($isi, 'function buildCategoryDetail');
        $this->assertNotFalse($awal, 'buildCategoryDetail harus ada');

        $akhir = strpos($isi, 'function CategoryDetailPanel');
        $this->assertNotFalse($akhir, 'CategoryDetailPanel harus ada');

        $isiBuilder = substr($isi, $awal, $akhir - $awal);

        foreach (['router.get', 'router.reload', 'router.post', 'fetch('] as $panggilan) {
            $this->assertStringNotContainsString(
                $panggilan,
                $isiBuilder,
                'definisi kategori tidak boleh memanggil '.$panggilan
                    .'; pemilihan kategori hanya mengubah state lokal'
            );
        }
    }

    public function test_kategori_retur_memuat_seluruh_bagian_returns_cancellations(): void
    {
        $report = app(StorePerformanceService::class)->build('last_7');

        $bagian = collect($report['sections'])->firstWhere('key', 'returns_cancellations');
        $this->assertNotNull($bagian, 'section returns_cancellations harus ada');

        $isi = $this->halaman();

        foreach ($bagian['kpis'] as $kpi) {
            $this->assertStringContainsString(
                '"'.$kpi['key'].'"',
                $isi,
                'KPI retur dan pembatalan '.$kpi['key'].' harus bisa dilihat'
            );
        }
    }

    public function test_batas_daftar_di_drawer_didefinisikan(): void
    {
        $isi = $this->halaman();

        $this->assertStringContainsString(
            'DETAIL_LIST_LIMIT',
            $isi,
            'daftar panjang di drawer harus dipotong supaya jumlah simpul DOM terbatas'
        );
    }
}
