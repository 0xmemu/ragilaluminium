<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ShippingRecord;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Batch 5: pengaman masukan rentang tanggal, dan jumlah kueri yang tidak boleh
 * tumbuh sebanding jumlah pesanan.
 *
 * Ketiga cacat yang ditutup di sini terukur lebih dulu, bukan diperkirakan:
 * from="monday" diterima sebagai 22 sampai 28 September, from="2026-13-45"
 * gagal diam diam menjadi rentang bawaan, rentang masa depan diterima dengan
 * jendela pembanding sepanjang nol detik, dan jumlah kueri naik sebanding
 * jumlah pesanan (188 kueri untuk 10 pesanan pada periode "semua waktu").
 */
class StorePerformanceInputGuardTest extends TestCase
{
    use RefreshDatabase;

    private function service(): StorePerformanceService
    {
        return app(StorePerformanceService::class);
    }

    private function order(string $nomor, string $dibuat, string $status = 'processing'): Order
    {
        $order = Order::create([
            'order_number' => $nomor,
            'customer_name' => 'Uji Masukan',
            'customer_phone' => '0812000003'.substr(md5($nomor), 0, 2),
            'shipping_address_line1' => 'Jl Uji',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        Order::whereKey($order->id)->update(['created_at' => $dibuat, 'updated_at' => $dibuat]);

        return $order->fresh();
    }

    /**
     * Kata yang bisa dibaca pengurai tanggal TIDAK boleh diterima sebagai
     * tanggal. Sebelumnya "monday" menghasilkan rentang 22 sampai 28 September,
     * padahal admin tidak pernah meminta tanggal itu.
     */
    public function test_kata_yang_bukan_tanggal_ditolak_dan_dilaporkan(): void
    {
        $payload = $this->service()->build('custom', 'monday', 'now');

        $this->assertContains('from', $payload['range']['input_diabaikan'], 'from yang bukan tanggal wajib dilaporkan');
        $this->assertContains('to', $payload['range']['input_diabaikan'], 'to yang bukan tanggal wajib dilaporkan');

        // Rentang yang tampil harus rentang bawaan 7 hari, bukan tafsiran "monday".
        $bawaan = $this->service()->resolveRange('custom');
        $this->assertSame($bawaan['from']->toDateString(), $payload['range']['from_date_iso']);
        $this->assertSame($bawaan['to']->toDateString(), $payload['range']['to_date_iso']);
    }

    /** Tanggal yang tidak ada di kalender juga ditolak, bukan digeser diam diam. */
    public function test_tanggal_tidak_ada_di_kalender_ditolak(): void
    {
        $payload = $this->service()->build('custom', '2026-13-45', '2026-02-31');

        $this->assertSame(['from', 'to'], $payload['range']['input_diabaikan']);
    }

    /** Tanggal ISO yang sah tetap dipakai apa adanya. */
    public function test_tanggal_iso_yang_sah_tetap_dipakai(): void
    {
        $payload = $this->service()->build('custom', '2026-08-05', '2026-09-15');

        $this->assertSame([], $payload['range']['input_diabaikan'], 'tanggal sah tidak boleh dilaporkan diabaikan');
        $this->assertSame('2026-08-05', $payload['range']['from_date_iso']);
        $this->assertSame('2026-09-15', $payload['range']['to_date_iso']);
        $this->assertFalse($payload['range']['rentang_dipotong']);
    }

    /**
     * Rentang yang melewati hari ini dipotong sampai hari ini, dan itu
     * dilaporkan. Sebelumnya rentang masa depan diterima apa adanya, dan
     * jendela pembandingnya menciut sampai panjang nol detik sehingga seluruh
     * kolom pembanding kehilangan arti.
     */
    public function test_rentang_masa_depan_dipotong_dan_pembandingnya_tidak_nol(): void
    {
        $payload = $this->service()->build('custom', now()->addDays(3)->toDateString(), now()->addDays(10)->toDateString());

        $this->assertTrue($payload['range']['rentang_dipotong'], 'pemotongan wajib dilaporkan');
        $this->assertSame(now()->toDateString(), $payload['range']['to_date_iso'], 'batas akhir dipotong sampai hari ini');

        // Jendela pembanding tidak boleh sepanjang nol detik. Kedua nilai di
        // payload berupa string ISO, jadi diurai dulu.
        $panjangPembanding = \Carbon\Carbon::parse($payload['range']['previous_from'])
            ->diffInSeconds(\Carbon\Carbon::parse($payload['range']['previous_to']));
        $this->assertGreaterThan(0, $panjangPembanding, 'jendela pembanding tidak boleh nol detik');
    }

    /** Rentang yang sebagian sudah lewat tetap dipotong, bukan ditolak. */
    public function test_rentang_yang_sebagian_sudah_lewat_dipotong(): void
    {
        $payload = $this->service()->build('custom', now()->subDays(3)->toDateString(), now()->addDays(5)->toDateString());

        $this->assertTrue($payload['range']['rentang_dipotong']);
        $this->assertSame(now()->toDateString(), $payload['range']['to_date_iso']);
        $this->assertSame(now()->subDays(3)->toDateString(), $payload['range']['from_date_iso'], 'batas awal tidak ikut berubah');
        $this->assertSame([], $payload['range']['input_diabaikan']);
    }

    /** Periode bawaan tidak boleh ikut dilaporkan sebagai dipotong. */
    public function test_periode_bawaan_tidak_dilaporkan_dipotong(): void
    {
        foreach (['today', 'yesterday', 'last_7', 'last_30', 'this_month', 'this_year'] as $period) {
            $payload = $this->service()->build($period);
            $this->assertFalse($payload['range']['rentang_dipotong'], $period.' tidak boleh dipotong');
            $this->assertSame([], $payload['range']['input_diabaikan'], $period.' tidak boleh punya masukan diabaikan');
        }
    }

    /**
     * Jumlah kueri tidak boleh tumbuh sebanding jumlah pesanan.
     *
     * Ini cacat yang sebenarnya di balik keluhan period=all: rentangnya bukan
     * penyebabnya, melainkan kueri per pesanan. Terukur sebelum perbaikan,
     * 60 pesanan menambah ratusan kueri; sesudahnya penambahannya tetap.
     */
    public function test_jumlah_kueri_tidak_tumbuh_sebanding_jumlah_pesanan(): void
    {
        ShippingRecord::query()->delete();
        DB::table('orders')->delete();

        foreach (range(1, 3) as $i) {
            $this->order('RA-KUERI-A'.$i, '2026-09-10 10:0'.$i.':00');
        }

        // Diukur dua hal: jumlah kueri SELURUHNYA, dan jumlah kueri ke tabel
        // riwayat (event_logs) yang jadi sumber pertumbuhan sebenarnya.
        $ukur = function (): array {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->service()->build('this_year');
            $log = DB::getQueryLog();
            DB::disableQueryLog();

            $eventLogs = count(array_filter(
                $log,
                fn (array $q): bool => str_contains((string) ($q['query'] ?? ''), 'event_logs')
            ));

            return ['total' => count($log), 'eventLogs' => $eventLogs];
        };

        $kecil = $ukur();

        // 40 pesanan tambahan, masing-masing dengan resi supaya jalur waktu
        // proses ikut teruji. Kueri per pesanan menambah MINIMAL satu kueri per
        // pesanan, jadi jumlah ini cukup besar untuk membedakan.
        foreach (range(4, 43) as $i) {
            $order = $this->order('RA-KUERI-A'.$i, '2026-09-11 10:00:00');
            ShippingRecord::create([
                'order_id' => $order->id,
                'carrier_name' => 'JNT',
                'waybill_number' => 'WB-KUERI-'.$i,
                'shipping_cost' => 0,
                'status' => 'pending_pickup',
            ]);
        }

        $besar = $ukur();

        // Toleransi 10 jauh di bawah 40, sehingga kueri per pesanan pasti
        // tertangkap, sementara biaya tetap yang memang tumbuh sedikit (mis.
        // kueri batch yang mengembalikan lebih banyak baris) tetap lolos.
        $this->assertLessThanOrEqual(
            10,
            $besar['total'] - $kecil['total'],
            'menambah 40 pesanan tidak boleh menambah lebih dari 10 kueri; '
                .'sebelumnya tiap pesanan menambah beberapa kueri sendiri-sendiri '
                .'(total kecil='.$kecil['total'].', besar='.$besar['total'].')'
        );

        // Yang paling menentukan: kueri riwayat tidak boleh tumbuh sebanding
        // jumlah pesanan. Inilah cacat yang sebenarnya di balik period=all.
        $this->assertLessThanOrEqual(
            2,
            $besar['eventLogs'] - $kecil['eventLogs'],
            'kueri ke riwayat status tidak boleh tumbuh sebanding jumlah pesanan '
                .'(kecil='.$kecil['eventLogs'].', besar='.$besar['eventLogs'].')'
        );
    }

    /** Angka hasil perhitungan tetap sama sesudah kueri dibatch. */
    public function test_hasil_waktu_konfirmasi_dan_proses_tetap_benar(): void
    {
        $order = $this->order('RA-HITUNG-1', '2026-09-10 10:00:00');
        $resi = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'JNT',
            'waybill_number' => 'WB-HITUNG-1',
            'shipping_cost' => 0,
            'status' => 'pending_pickup',
        ]);

        // Konfirmasi 1,5 jam sesudah pesanan dibuat.
        DB::table('event_logs')->insert([
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'payload' => json_encode(['from' => 'awaiting_confirmation', 'order_status' => 'processing']),
            'created_by_user_id' => null,
            'created_at' => '2026-09-10 11:30:00',
        ]);

        // Resi dibuat 48 jam sesudah konfirmasi.
        $resi->created_at = \Carbon\Carbon::parse('2026-09-12 11:30:00');
        $resi->save();

        $m = $this->service()->metricsFor(
            \Carbon\Carbon::parse('2026-09-01')->startOfDay(),
            \Carbon\Carbon::parse('2026-09-30')->endOfDay(),
        );

        $this->assertSame(1.5, round((float) $m['avg_confirm_hours'], 2), 'waktu konfirmasi 1,5 jam');
        $this->assertSame(2.0, round((float) $m['avg_process_days'], 2), 'waktu proses 2 hari');
    }
}
