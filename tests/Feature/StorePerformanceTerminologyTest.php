<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Menjaga agar istilah internal sistem tidak muncul di permukaan yang dibaca admin.
 *
 * Nama tabel, nama kolom, nama kelas, nilai enum, dan cap waktu ISO adalah
 * kosakata teknis. Bila salah satunya bocor ke layar atau ke berkas XLSX,
 * pemilik toko membaca hal yang tidak ada hubungannya dengan pekerjaannya, dan
 * itu terbaca sebagai laporan yang tidak rapi meski angkanya benar.
 *
 * Yang diperiksa hanya teks yang benar-benar dirender, bukan komentar kode.
 * Komentar untuk pengembang memang boleh menyebut nama tabel dan nama kelas.
 */
class StorePerformanceTerminologyTest extends TestCase
{
    use RefreshDatabase;

    /** Isi berkas halaman, tanpa komentar blok dan tanpa komentar baris. */
    private function halamanTanpaKomentar(): string
    {
        $isi = file_get_contents(base_path('resources/js/pages/Admin/Analytics/StorePerformance.tsx'));
        $this->assertNotFalse($isi, 'halaman harus terbaca');

        // Buang komentar blok /* */ dan komentar baris //.
        $isi = preg_replace('~/\*.*?\*/~s', '', $isi ?? '') ?? '';
        $isi = preg_replace('~^\s*//.*$~m', '', $isi) ?? '';

        return $isi;
    }

    /**
     * Isi array Panduan pada ekspor. Hanya wilayah ini yang dibaca admin;
     * sisanya kode dan komentar pengembang.
     */
    private function panduanEkspor(): string
    {
        $isi = file_get_contents(base_path('app/Exports/StorePerformanceExport.php'));
        $this->assertNotFalse($isi, 'ekspor harus terbaca');

        $awal = strpos($isi ?? '', 'PANDUAN PENGGUNAAN LAPORAN PERFORMA TOKO');
        $this->assertNotFalse($awal, 'array panduan harus ditemukan');

        // Panduan berakhir di penutup array sebelum method title().
        $akhir = strpos($isi ?? '', 'public function title()', $awal);
        $this->assertNotFalse($akhir, 'batas akhir panduan harus ditemukan');

        return substr($isi ?? '', $awal, $akhir - $awal);
    }

    public function test_istilah_terlarang_tidak_muncul_di_halaman(): void
    {
        $isi = $this->halamanTanpaKomentar();

        foreach ([
            // Nama kolom basis data.
            'created_by_user_id',
            // Nama kelas internal.
            'StorePerformanceService',
            'AnalyticsController',
            // Nama tabel basis data.
            'order_return_cases',
            'shipping_records',
            'performance_visitor_events',
            'performance_metrics',
            'product_clicks',
            'order_items',
        ] as $istilah) {
            $this->assertStringNotContainsString(
                $istilah,
                $isi,
                'halaman memuat istilah sistem "'.$istilah.'" yang tidak boleh dibaca admin'
            );
        }
    }

    public function test_panduan_ekspor_memakai_bahasa_toko(): void
    {
        $panduan = $this->panduanEkspor();

        foreach ([
            'Pivot Table',
            'SUMIFS',
            'COUNTIFS',
            'paid_at',
            'sheet',
        ] as $istilah) {
            $this->assertStringNotContainsString(
                $istilah,
                $panduan,
                'panduan ekspor memuat istilah teknis "'.$istilah.'" yang tidak boleh dibaca admin'
            );
        }
    }

    /**
     * Label dan catatan KPI dirender apa adanya di drawer, jadi keduanya harus
     * bebas kosakata sistem juga. Tanpa tes ini, bocoran di service hanya
     * ketahuan setelah dilihat di layar.
     */
    public function test_label_dan_catatan_kpi_bebas_istilah_sistem(): void
    {
        $laporan = app(\App\Services\StorePerformanceService::class)->build('last_7');

        $terlarang = [
            'created_by_user_id',
            'paid_at',
            'raw J&T',
            'fulfillment',
            'order aktif',
            'event pembatalan',
            'event log',
        ];

        foreach ($laporan['sections'] as $bagian) {
            foreach ($bagian['kpis'] as $kpi) {
                foreach ([$kpi['label'], $kpi['detail']] as $teks) {
                    if (! is_string($teks) || $teks === '') {
                        continue;
                    }
                    foreach ($terlarang as $istilah) {
                        $this->assertStringNotContainsString(
                            $istilah,
                            $teks,
                            'KPI '.$kpi['key'].' memuat istilah sistem "'.$istilah.'": '.$teks
                        );
                    }
                }
            }
        }

        // Definisi keuangan juga dirender di drawer kategori Referensi.
        $definisi = (string) ($laporan['financial']['definition'] ?? '');
        foreach ($terlarang as $istilah) {
            $this->assertStringNotContainsString(
                $istilah,
                $definisi,
                'definisi keuangan memuat istilah sistem "'.$istilah.'"'
            );
        }
    }

    public function test_satu_konsep_satu_nama(): void
    {
        $page = $this->halamanTanpaKomentar();
        $export = file_get_contents(base_path('app/Exports/StorePerformanceExport.php'));

        // Tagihan J&T dulu punya tiga nama: Tagihan J&T Cargo, Potongan J&T,
        // dan Ongkir Dibayarkan ke J&T.
        $this->assertStringNotContainsString(
            'Potongan J&T',
            $page,
            'istilah "Potongan J&T" sudah tidak dipakai; pakai "Tagihan J&T"'
        );
        $this->assertStringNotContainsString(
            'Tagihan J&T Cargo',
            $page,
            'istilah "Tagihan J&T Cargo" sudah tidak dipakai; pakai "Tagihan J&T"'
        );

        $this->assertNotFalse($export, 'ekspor harus terbaca');
    }

    public function test_nilai_enum_tidak_ditampilkan_mentah(): void
    {
        $isi = $this->halamanTanpaKomentar();

        // Kode periode internal tidak boleh tampil di drawer.
        $this->assertStringNotContainsString(
            'range.period + ")"',
            $isi,
            'kode periode internal tidak boleh ditampilkan'
        );

        // Granularitas harus lewat penerjemah, bukan nilai mentahnya.
        $this->assertStringContainsString(
            'labelGranularitas(range.granularity)',
            $isi,
            'granularitas harus ditampilkan sebagai label'
        );

        // Cap waktu harus lewat penerjemah.
        $this->assertStringContainsString(
            'formatWaktuWib(report.generated_at)',
            $isi,
            'waktu laporan harus ditampilkan dalam WIB, bukan ISO mentah'
        );

        // Tanggal kasus retur harus lewat format tanggal yang dipakai admin lain.
        $this->assertStringNotContainsString(
            'completed_at.slice(0, 10)',
            $isi,
            'tanggal kasus retur tidak boleh memakai potongan ISO'
        );
    }

    public function test_tidak_menebak_metode_pembayaran(): void
    {
        $isi = $this->halamanTanpaKomentar();

        // Dulu setiap metode selain COD dipaksa berlabel "Transfer Bank",
        // sehingga metode lain ikut salah nama.
        $this->assertStringNotContainsString(
            '? "COD" : "Transfer Bank"',
            $isi,
            'metode pembayaran tidak boleh ditebak; pakai labelMetodeBayar'
        );
        $this->assertStringContainsString(
            'labelMetodeBayar(row.method)',
            $isi,
            'metode pembayaran harus lewat labelMetodeBayar'
        );
    }

    public function test_pihak_penanggung_retur_memakai_label(): void
    {
        $isi = $this->halamanTanpaKomentar();

        $this->assertStringNotContainsString(
            'row.fault_party ?? "-"',
            $isi,
            'pihak penanggung tidak boleh ditampilkan mentah; pakai labelPenanggung'
        );
        $this->assertStringContainsString(
            'labelPenanggung(row.fault_party)',
            $isi,
            'pihak penanggung harus lewat labelPenanggung'
        );
    }
}
