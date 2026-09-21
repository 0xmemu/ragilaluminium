<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Exports\StorePerformanceExport;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Services\StorePerformanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * Batch 3 halaman Performa Toko: memisahkan metrik yang terikat periode dari
 * metrik snapshot, dan membetulkan perhitungan yang memakai populasi berbeda.
 */
class StorePerformancePeriodeSnapshotTest extends TestCase
{
    use RefreshDatabase;

    private function order(
        string $nomor,
        string $status,
        int $total = 1000000,
        string $telepon = '081200000001',
        ?string $dibuat = null,
    ): Order {
        $order = Order::create([
            'order_number' => $nomor,
            'customer_name' => 'Uji Periode',
            'customer_phone' => $telepon,
            'shipping_address_line1' => 'Jl Uji',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'payment_status' => $status === 'awaiting_confirmation' ? 'pending' : 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $total,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        if ($dibuat !== null) {
            // created_at tidak ada di $fillable, jadi update() Eloquent diam
            // diam membuangnya. Backdate lewat query builder.
            Order::whereKey($order->id)->update(['created_at' => $dibuat, 'updated_at' => $dibuat]);
        }

        return $order->fresh();
    }

    private function item(Order $order, string $model = 'SLIDING', string $desain = 'POLOS', ?string $varian = 'VAR-1'): OrderItem
    {
        $produk = Product::create([
            'parent_sku' => 'CAT-'.$order->order_number,
            'name' => 'Katalog '.$model,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => $model,
            'design_variant' => $desain,
            'status' => 'active',
        ]);

        return OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $produk->id,
            'parent_sku' => 'SKU-'.$order->order_number,
            'variant_sku' => $varian,
            'name' => 'Snapshot '.$model,
            'product_category' => 'WINDOW',
            'product_model' => $model,
            'design_variant' => $desain,
            'unit_price' => 1000000,
            'quantity' => 1,
            'line_subtotal' => 1000000,
            'line_discount' => 0,
            'line_total' => 1000000,
        ]);
    }

    private function event(Order $order, string $status, string $kapan): EventLog
    {
        $waktu = Carbon::parse($kapan);

        return EventLog::create([
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'payload' => ['from' => 'processing', 'order_status' => $status, 'source' => 'test'],
            'created_by_user_id' => null,
            'created_at' => $waktu,
        ]);
    }

    private function metrik(): array
    {
        return app(StorePerformanceService::class)->metricsFor(
            Carbon::today()->startOfDay(),
            Carbon::today()->endOfDay(),
        );
    }

    /**
     * Antrean adalah keadaan sekarang, bukan hasil penyaringan tanggal.
     * Sebelumnya pesanan berstatus awaiting_confirmation selalu hilang, karena
     * penyaring status omzet tidak memuatnya padahal penyaring antrean memuat.
     */
    public function test_antrean_menghitung_pesanan_belum_dikonfirmasi_tanpa_batas_tanggal(): void
    {
        // Dibuat jauh sebelum periode: tetap bagian dari antrean yang menumpuk.
        $lama = $this->order('RA-ANTRE-LAMA', 'awaiting_confirmation', 1000000, '081200000101', '2026-01-05 09:00:00');
        $this->item($lama);

        $diproses = $this->order('RA-ANTRE-PROSES', 'processing', 1000000, '081200000102');
        $this->item($diproses);

        $m = $this->metrik();

        $this->assertSame(2, $m['open_orders'], 'antrean menghitung semua yang belum selesai, termasuk yang belum dikonfirmasi dan yang dibuat di luar periode');
        $this->assertSame(1, $m['open_orders_in_period'], 'versi periode hanya menghitung yang dibuat pada periode ini');
    }

    /**
     * Dalam Pengiriman juga snapshot: pesanan yang dikirim sekarang tetap
     * terhitung walau dibuat lama.
     */
    public function test_dalam_pengiriman_menghitung_tanpa_batas_tanggal(): void
    {
        $lama = $this->order('RA-KIRIM-LAMA', 'shipped', 1000000, '081200000103', '2026-02-10 08:00:00');
        $this->item($lama);

        $m = $this->metrik();

        $this->assertSame(1, $m['dispatched_orders'], 'pesanan yang sedang dikirim terhitung tanpa melihat tanggal pembuatan');
    }

    /**
     * Pesanan Selesai dihitung dari waktu penyelesaian, bukan waktu pembuatan.
     * Sebelumnya pesanan yang dibuat bulan lalu dan selesai hari ini hilang.
     */
    public function test_pesanan_selesai_dihitung_dari_tanggal_penyelesaian(): void
    {
        $lama = $this->order('RA-SELESAI-LAMA', 'completed', 2000000, '081200000104', '2026-01-20 10:00:00');
        $this->item($lama);
        $this->event($lama, 'completed', Carbon::today()->setTime(11, 0)->toDateTimeString());

        // Dibuat pada periode ini, tetapi belum selesai.
        $belum = $this->order('RA-BELUM-SELESAI', 'processing', 3000000, '081200000105');
        $this->item($belum);

        $m = $this->metrik();

        $this->assertSame(1, $m['completed_orders'], 'selesai dihitung dari tanggal penyelesaian, bukan tanggal pembuatan');
    }

    /**
     * Satu model dengan dua desain adalah satu model, tetapi dua sub model.
     * Sebelumnya keduanya dilaporkan sebagai satu angka "model".
     */
    public function test_model_dan_sub_model_dipisah(): void
    {
        $a = $this->order('RA-MODEL-A', 'processing', 1000000, '081200000106');
        $this->item($a, 'SWING', 'POLOS', 'VAR-A');
        $b = $this->order('RA-MODEL-B', 'processing', 1000000, '081200000107');
        $this->item($b, 'SWING', 'ORNAMEN', 'VAR-B');
        $c = $this->order('RA-MODEL-C', 'processing', 1000000, '081200000108');
        $this->item($c, 'JUNGKIT', 'POLOS', 'VAR-C');

        $m = $this->metrik();

        $this->assertSame(2, $m['models_sold'], 'dua jenis model: SWING dan JUNGKIT');
        $this->assertSame(3, $m['sub_models_sold'], 'tiga pasangan model dan desain');
    }

    /**
     * Produk yang dijual tanpa varian ukuran tidak boleh hilang dari laporan.
     * Sebelumnya baris tanpa variant_sku dibuang diam diam.
     */
    public function test_produk_tanpa_varian_tetap_dihitung(): void
    {
        $a = $this->order('RA-VARIAN-A', 'processing', 1000000, '081200000109');
        $this->item($a, 'SLIDING', 'POLOS', 'VAR-X');
        $b = $this->order('RA-VARIAN-B', 'processing', 1000000, '081200000110');
        $this->item($b, 'SLIDING', 'POLOS', null);

        $m = $this->metrik();

        $this->assertSame(2, $m['products_sold'], 'baris tanpa varian dihitung memakai kode induknya');
    }

    /**
     * Rasio retur selesai memakai populasi yang sama di pembilang dan penyebut:
     * keduanya dihitung dari WAKTU PENYELESAIAN pada periode yang sama.
     *
     * Skenarionya sengaja memakai pesanan yang dibuat di luar periode tetapi
     * selesai pada periode ini. Pada kode lama penyebutnya menghitung pesanan
     * yang DIBUAT pada periode ini, jadi penyebutnya nol dan hasilnya 0,
     * padahal pembilangnya berisi. Kode baru menjawab 100.
     */
    public function test_rasio_retur_selesai_memakai_penyebut_penyelesaian(): void
    {
        $order = $this->order('RA-RASIO-RETUR', 'completed', 1000000, '081200000111', '2026-01-11 09:00:00');
        $item = $this->item($order);
        // Pesanan dibuat Januari, selesai hari ini.
        $this->event($order, 'completed', Carbon::today()->setTime(8, 0)->toDateTimeString());

        $kasus = \App\Models\OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'Barang pecah',
            'refund_amount' => 100000,
            'completed_at' => Carbon::today()->setTime(9, 0),
        ]);
        \App\Models\OrderReturnItem::create([
            'return_case_id' => $kasus->id,
            'order_item_id' => $item->id,
            'requested_quantity' => 1,
            'returned_quantity' => 1,
        ]);

        $m = $this->metrik();

        $this->assertSame(1, $m['completed_orders'], 'pesanan yang selesai hari ini terhitung walau dibuat di luar periode');
        $this->assertSame(1, $m['returns_completed'], 'kasus retur yang selesai hari ini terhitung');
        $this->assertSame(
            100.0,
            $m['return_rate_completed'],
            'satu retur selesai dibagi satu pesanan selesai pada periode yang sama'
        );
    }

    /**
     * Pembatalan atas pesanan lama tidak ikut pembilang rasio, karena pesanan
     * itu tidak ada di dalam populasi penyebut (pesanan periode ini).
     */
    public function test_rasio_pembatalan_mengabaikan_pembatalan_pesanan_lama(): void
    {
        $lama = $this->order('RA-BATAL-LAMA', 'cancelled', 5000000, '081200000112', '2026-01-03 09:00:00');
        $this->item($lama);
        $this->event($lama, 'cancelled', Carbon::today()->setTime(9, 30)->toDateTimeString());

        $baru = $this->order('RA-BATAL-BARU', 'processing', 1000000, '081200000113');
        $this->item($baru);

        $m = $this->metrik();

        // Pembatalan pesanan lama tetap TERCATAT sebagai peristiwa periode ini.
        $this->assertSame(1, $m['cancelled_orders'], 'peristiwa pembatalannya tetap tercatat');
        // Tetapi tidak masuk rasio, karena pesanannya bukan pesanan periode ini.
        $this->assertSame(0.0, $m['cancellation_rate'], 'rasio hanya memakai pesanan yang dibuat pada periode ini');
    }

    /**
     * Jumlah pembeli dikirim server, supaya tampilan tidak perlu menghitungnya
     * ulang dari persentase yang sudah dibulatkan.
     */
    public function test_payload_membawa_jumlah_pembeli(): void
    {
        $a = $this->order('RA-PEMBELI-A', 'processing', 1000000, '081200000114');
        $this->item($a);
        $b = $this->order('RA-PEMBELI-B', 'processing', 1000000, '081200000115');
        $this->item($b);

        $payload = app(StorePerformanceService::class)->build('today');

        $this->assertArrayHasKey('buyers', $payload['financial'], 'jumlah pembeli wajib ada di payload');
        $this->assertSame(2, $payload['financial']['buyers'], 'dua pembeli berbeda');
    }

    /**
     * Metrik snapshot tidak punya pembanding, dan itu terlihat dari payload.
     * Reaksi sebelumnya: pembandingnya berisi angka, sehingga kartunya
     * menampilkan "Tetap" seolah dibandingkan dengan periode sebelumnya.
     */
    public function test_metrik_snapshot_tidak_punya_pembanding(): void
    {
        $payload = app(StorePerformanceService::class)->build('today');

        $peta = [];
        foreach ($payload['sections'] as $bagian) {
            foreach ($bagian['kpis'] as $kpi) {
                $peta[$kpi['key']] = $kpi;
            }
        }

        foreach (['open_orders', 'dispatched_orders', 'returns_open', 'payment_pending_count'] as $key) {
            $this->assertArrayHasKey($key, $peta, $key.' wajib ada');
            $this->assertNull($peta[$key]['previous'], $key.' adalah snapshot, jadi tidak punya pembanding');
            $this->assertNull($peta[$key]['change_percent'], $key.' adalah snapshot, jadi tidak punya perubahan');
        }

        // Metrik periode tetap punya pembanding numerik.
        $this->assertNotNull($peta['omzet']['previous'], 'metrik periode wajib punya pembanding');
        $this->assertIsNumeric($peta['omzet']['previous']);
    }

    /**
     * Ekspor memperlakukan metrik snapshot sama seperti layar: kolom pembanding
     * dan perubahan berisi keterangan, bukan angka 0 atau persentase.
     */
    public function test_ekspor_tidak_mengarang_pembanding_untuk_metrik_snapshot(): void
    {
        $order = $this->order('RA-XLSX-SNAP', 'processing', 1000000, '081200000116');
        $this->item($order);

        // Periode pembanding wajib berisi, kalau tidak seluruh kolom pembanding
        // memang kosong dan perbedaan snapshot dengan periode tidak teruji.
        //
        // Ditaruh pada AWAL hari kemarin, bukan jam tertentu seperti 10:00:
        // periode berjalan dibandingkan sampai jam yang sama, sehingga jendela
        // pembanding pada pukul 01:16 hanya sampai 01:16 hari kemarin. Fixture
        // yang memakai jam tetap akan gagal bila suite dijalankan pagi.
        $kemarin = $this->order(
            'RA-XLSX-KEMARIN',
            'processing',
            1000000,
            '081200000117',
            Carbon::today()->subDay()->startOfDay()->addMinute()->toDateTimeString(),
        );
        $this->item($kemarin);

        $payload = app(StorePerformanceService::class)->build('today');
        $this->assertTrue($payload['previous_has_data'], 'periode pembanding wajib berisi untuk menguji kolom C');
        $payload['income_detail'] = [];
        $payload['sold_items'] = [];

        Excel::store(new StorePerformanceExport($payload), 'perf-snapshot.xlsx', 'imports');
        $ss = IOFactory::load(Storage::disk('imports')->path('perf-snapshot.xlsx'));

        $baris = $ss->getSheetByName('KPI Operasional Toko')->toArray(null, false, false, true);

        $cari = function (string $potongan) use ($baris): ?array {
            foreach ($baris as $row) {
                if (is_string($row['A'] ?? null) && str_contains($row['A'], $potongan)) {
                    return $row;
                }
            }

            return null;
        };

        // Metrik snapshot: kolom pembanding berisi keterangan.
        $snapshot = $cari('Pesanan Belum Selesai');
        $this->assertNotNull($snapshot, 'baris Pesanan Belum Selesai wajib ada');
        $this->assertSame('Tidak ada data', $snapshot['C'], 'snapshot tidak boleh menulis angka pembanding');
        $this->assertSame('-', $snapshot['D'], 'snapshot tidak boleh menulis persentase');

        // Metrik periode: kolom pembanding berisi angka bila pembandingnya ada.
        $periode = $cari('Pesanan Dibuat Periode Ini yang Masih Terbuka');
        $this->assertNotNull($periode, 'baris Pesanan Dibuat Periode Ini wajib ada');
        $this->assertIsNumeric($periode['C'], 'metrik periode wajib punya angka pembanding');
    }
}