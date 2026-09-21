<?php

namespace Tests\Feature;

use App\Models\PerformanceVisitorEvent;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Kontrak kejujuran angka pengunjung.
 *
 * Pengunjung baru dicatat sejak tanggal tertentu. Sebelumnya halaman menentukan
 * "data kunjungan belum lengkap" dengan membandingkan from_date yang berformat
 * tampilan ("23 Agt 2026") terhadap tanggal ISO sebagai TEKS, sehingga hasilnya
 * bergantung pada angka harinya. Contoh nyata: "15 Sep 2026" kebetulan lebih
 * kecil dari "2026-09-19" sehingga penjaganya menyala, sedangkan "21 Sep 2026"
 * dan "23 Agt 2026" tidak, padahal keduanya juga sebelum atau sesudah batas
 * dengan cara yang berbeda.
 *
 * Waktu dibekukan dan satu peristiwa kunjungan disemai pada tanggal tetap,
 * supaya kedua cabang penjaga benar-benar diuji dan bukan di-skip.
 */
class StorePerformanceVisitorHonestyTest extends TestCase
{
    use RefreshDatabase;

    /** Tanggal beku untuk pengujian, dan tanggal mulai pencatatan pengunjung. */
    private const SEKARANG = '2026-09-21 10:00:00';
    private const MULAI_DICATAT = '2026-09-19';

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse(self::SEKARANG));

        PerformanceVisitorEvent::create([
            'visitor_hash' => 'uji-honesty-1',
            'visit_date' => self::MULAI_DICATAT,
            'visited_at' => self::MULAI_DICATAT.' 08:00:00',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function service(): StorePerformanceService
    {
        return app(StorePerformanceService::class);
    }

    public function test_range_menyediakan_tanggal_iso_untuk_perbandingan(): void
    {
        $report = $this->service()->build('last_30');

        $this->assertArrayHasKey('from_date_iso', $report['range']);
        $this->assertArrayHasKey('to_date_iso', $report['range']);

        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}$/',
            (string) $report['range']['from_date_iso'],
            'from_date_iso harus berformat ISO supaya bisa dibandingkan sebagai tanggal'
        );

        // from_date sengaja tetap ada untuk tampilan, dan memang bukan ISO.
        $this->assertDoesNotMatchRegularExpression(
            '/^\d{4}-\d{2}-\d{2}$/',
            (string) $report['range']['from_date'],
            'from_date adalah tanggal tampilan, bukan untuk perbandingan'
        );
    }

    public function test_perbandingan_teks_dan_tanggal_berbeda_pada_sebagian_periode(): void
    {
        $service = $this->service();
        $pernahBeda = false;

        foreach (['today', 'yesterday', 'last_7', 'last_30', 'this_month', 'this_year', 'all'] as $period) {
            $report = $service->build($period);
            $tampilan = (string) $report['range']['from_date'];
            $iso = (string) $report['range']['from_date_iso'];
            $tersedia = (string) $report['financial']['visitors_available_from'];

            if ($tampilan !== $iso && ($tampilan < $tersedia) !== ($iso < $tersedia)) {
                $pernahBeda = true;
            }

            $this->assertSame(
                strtotime($iso) < strtotime($tersedia),
                $iso < $tersedia,
                'perbandingan teks tanggal ISO harus sejalan dengan perbandingan waktu'
            );
        }

        $this->assertTrue(
            $pernahBeda,
            'harus ada minimal satu periode di mana perbandingan teks tanggal tampilan'
                .' memberi jawaban berbeda dari perbandingan tanggal ISO; itulah bukti'
                .' bahwa perbaikan ini perlu'
        );
    }

    /**
     * Penjaga data kunjungan wajib dipakai di header grafik, bukan hanya di
     * kartu dan drawer.
     *
     * Kartu menahan angka kunjungan dan konversi bila rentangnya mulai sebelum
     * kunjungan layak dicatat, tetapi header grafik dulu merender angka Total
     * tanpa penjaga, sehingga satu layar menampilkan dua jawaban berbeda untuk
     * satu hal. Angka itu bukan sekadar belum lengkap melainkan salah: pembeli
     * dihitung sepanjang periode sedangkan pengunjung hanya sejak pencatatan
     * berjalan.
     */
    public function test_header_grafik_memakai_penjaga_kunjungan(): void
    {
        $isi = file_get_contents(base_path('resources/js/pages/Admin/Analytics/StorePerformance.tsx'));
        $this->assertNotFalse($isi, 'halaman harus terbaca');
        // Komentar dibuang supaya penjelasan di kode tidak dianggap kode.
        $isi = preg_replace('~/\*.*?\*/~s', '', $isi ?? '') ?? '';
        $isi = preg_replace('~^\s*//.*$~m', '', $isi) ?? '';

        // Dua grafik yang memakai data kunjungan.
        $this->assertStringContainsString(
            'grafikKunjungan',
            $isi,
            'header grafik wajib mengenali grafik berbasis kunjungan'
        );
        $this->assertMatchesRegularExpression(
            '~chart\.key === "visitors" \|\| chart\.key === "conversion_rate"~',
            $isi,
            'grafik berbasis kunjungan adalah visitors dan conversion_rate'
        );

        // Nilai periode pada header wajib memakai penjaga, bukan mencetak angka
        // apa adanya.
        $this->assertStringContainsString(
            'totalTidakLayak ?',
            $isi,
            'nilai Total pada header grafik wajib bercabang lewat penjaga'
        );
        $this->assertStringNotContainsString(
            "Total:{\" \"}\n                    <span className=\"font-semibold tabular-nums text-foreground\">",
            $isi,
            'nilai Total tidak boleh langsung dicetak tanpa penjaga'
        );
    }

    /**
     * Pemeriksaan yang sama untuk drawer: angka kunjungan di sana juga wajib
     * lewat penjaga, supaya tidak ada permukaan yang lolos.
     */
    public function test_drawer_dan_kartu_memakai_penjaga_yang_sama(): void
    {
        $isi = file_get_contents(base_path('resources/js/pages/Admin/Analytics/StorePerformance.tsx'));
        $this->assertNotFalse($isi);
        $isi = preg_replace('~/\*.*?\*/~s', '', $isi ?? '') ?? '';
        $isi = preg_replace('~^\s*//.*$~m', '', $isi) ?? '';

        // Penjaga didefinisikan sekali dan dipakai lebih dari dua tempat:
        // dua kartu atas, tiga baris drawer, dan header grafik.
        $pemakaian = substr_count($isi, 'kunjunganTidakLengkap');
        $this->assertGreaterThanOrEqual(
            5,
            $pemakaian,
            'penjaga kunjungan wajib dipakai di kartu, drawer, dan header grafik;'
                .' pemakaian ditemukan: '.$pemakaian
        );
    }
    public function test_penanda_pembanding_benar_untuk_kedua_cabang(): void
    {
        $service = $this->service();
        $terukur = 0;
        $tidakTerukur = 0;

        foreach (['today', 'yesterday', 'last_7', 'last_30', 'this_month', 'this_year', 'all'] as $period) {
            $report = $service->build($period);
            $chart = collect($report['charts'])->firstWhere('key', 'visitors');

            $harusTerukur = (string) $report['range']['previous_from'] >= self::MULAI_DICATAT;

            $this->assertSame(
                $harusTerukur,
                $chart['previous_measured'],
                'penanda previous_measured salah untuk periode '.$period
            );

            $harusTerukur ? $terukur++ : $tidakTerukur++;
        }

        // Kedua cabang harus tersentuh supaya tes ini bermakna.
        $this->assertGreaterThan(0, $terukur, 'harus ada periode yang pembandingnya terukur');
        $this->assertGreaterThan(0, $tidakTerukur, 'harus ada periode yang pembandingnya belum dicatat');
    }

    public function test_chart_pengunjung_dan_konversi_menyatakan_pembanding_diukur(): void
    {
        $report = $this->service()->build('last_30');

        foreach (['visitors', 'conversion_rate'] as $key) {
            $chart = collect($report['charts'])->firstWhere('key', $key);

            $this->assertNotNull($chart, 'chart '.$key.' harus ada');
            $this->assertArrayHasKey(
                'previous_measured',
                $chart,
                'chart '.$key.' harus menyatakan apakah jendela pembandingnya diukur,'
                    .' supaya 0 tidak ditampilkan sebagai hasil pengukuran'
            );
            $this->assertIsBool($chart['previous_measured']);
        }
    }

    public function test_penanda_pembanding_hanya_ada_pada_chart_berbasis_pengunjung(): void
    {
        $report = $this->service()->build('last_30');

        foreach ($report['charts'] as $chart) {
            if (in_array($chart['key'], ['visitors', 'conversion_rate'], true)) {
                continue;
            }

            $this->assertArrayNotHasKey(
                'previous_measured',
                $chart,
                'chart '.$chart['key'].' tidak bergantung pada pencatatan pengunjung,'
                    .' jadi tidak perlu penanda itu'
            );
        }
    }

    public function test_sumber_halaman_tidak_membandingkan_tanggal_tampilan(): void
    {
        $path = base_path('resources/js/pages/Admin/Analytics/StorePerformance.tsx');
        $sumber = file_get_contents($path);

        $this->assertNotFalse($sumber, 'berkas halaman harus terbaca');

        $this->assertStringNotContainsString(
            'report.range.from_date <',
            $sumber,
            'penjaga kelengkapan kunjungan tidak boleh membandingkan from_date yang'
                .' berformat tampilan, karena hasilnya bergantung pada angka harinya'
        );

        $this->assertStringContainsString(
            'report.range.from_date_iso',
            $sumber,
            'penjaga kelengkapan kunjungan harus memakai tanggal ISO'
        );
    }
}
