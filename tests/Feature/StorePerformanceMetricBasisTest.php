<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\OrderReturnItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ShippingRecord;
use App\Services\StorePerformanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Cakupan setiap metrik dibuktikan dengan data di luar periode.
 *
 * Cara membuktikan yang dipakai di sini sengaja BUKAN membandingkan nilai pada
 * dua rentang, karena cara itu tidak diskriminatif: metrik periode pun bernilai
 * sama kalau datanya nol di kedua rentang. Yang dipakai adalah menanam data di
 * LUAR rentang lalu memeriksa apakah metrik tetap menghitungnya.
 */
class StorePerformanceMetricBasisTest extends TestCase
{
    use RefreshDatabase;

    /** Rentang uji: hari ini saja. Semua data uji ditanam jauh di luar ini. */
    private function dari(): Carbon
    {
        return Carbon::today()->startOfDay();
    }

    private function sampai(): Carbon
    {
        return Carbon::today()->endOfDay();
    }

    private function metrik(): array
    {
        return app(StorePerformanceService::class)->metricsFor($this->dari(), $this->sampai());
    }

    private function order(
        string $nomor,
        string $status,
        ?string $dibuat = null,
        int $total = 1000000,
        string $telepon = '081200000001',
        string $metode = 'transfer',
    ): Order {
        $order = Order::create([
            'order_number' => $nomor,
            'customer_name' => 'Uji Cakupan',
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
            'payment_method' => $metode,
            'cod_flag' => $metode === 'cod',
        ]);

        if ($dibuat !== null) {
            // created_at tidak ada di $fillable, jadi update() Eloquent membuangnya.
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
        return EventLog::create([
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'payload' => ['from' => 'processing', 'order_status' => $status, 'source' => 'test'],
            'created_by_user_id' => null,
            'created_at' => Carbon::parse($kapan),
        ]);
    }

    // =======================================================================
    // 1. KELENGKAPAN: tidak boleh ada metrik tanpa deklarasi cakupan
    // =======================================================================

    /**
     * Setiap KPI yang keluar dari build() wajib punya deklarasi di METRIC_BASIS.
     * Tanpa test ini, metrik baru bisa lolos tanpa cakupan dan pembacanya tidak
     * punya cara tahu angkanya periode atau keadaan sekarang.
     */
    /**
     * Kunci bagian financial yang TIDAK perlu deklarasi cakupan sendiri, dengan
     * alasannya. Dua kelompok:
     * - alias: angkanya sama dengan metrik lain yang sudah dideklarasikan;
     * - komponen: bagian dari metrik induk, cakupannya mengikuti induknya.
     *
     * Daftar ini sengaja eksplisit. Menambah angka uang baru ke bagian financial
     * memaksa pilihannya sadar: deklarasikan cakupannya, atau sebut di sini
     * beserta alasannya. Tanpa daftar ini, metrik baru bisa berjalan tanpa
     * cakupan seperti yang pernah terjadi pada dua angka kas COD dalam periode.
     *
     * @var array<string, string>
     */
    /** Kosakata unit yang sah. Unit di luar ini berarti salah ketik atau konsep baru yang belum diputuskan. */
    private const UNIT_SAHIH = [
        'rupiah', 'pesanan', 'pembayaran', 'unit', 'model', 'sub model', 'produk',
        'kunjungan', 'orang', 'kasus', 'jam', 'hari', 'persen',
    ];

    private const FINANCIAL_TANPA_CAKUPAN_SENDIRI = [
        // Alias: angkanya sama dengan metrik yang sudah dideklarasikan.
        'gross_revenue' => 'alias dari omzet',
        'buyer_orders' => 'alias dari orders',
        'refund_adjustments' => 'alias dari refund_given',
        'return_shipping_store' => 'alias dari return_shipping_cost_total',
        // Komponen: bagian dari metrik induk.
        'items_before_discount' => 'komponen omzet',
        'product_discount' => 'komponen omzet, bukan pengurang tagihan',
        'voucher_discount' => 'komponen omzet',
        'insurance' => 'komponen omzet',
        'shipping_raw' => 'komponen pengurang Penjualan Bersih',
        'shipping_paid_by_customer' => 'komponen omzet',
        'shipping_subsidy' => 'sudah termasuk di shipping_raw',
        'cod_fee' => 'komponen omzet sekaligus pengurang',
        'refused_goods_value' => 'komponen pengurang Penjualan Bersih',
        'refused_borne_count' => 'komponen refused_borne_cost',
        'refused_shipping_cost' => 'komponen refused_borne_cost',
        'refused_cod_fee' => 'komponen refused_borne_cost',
        // Bukan angka metrik.
        'definition' => 'teks definisi, bukan angka',
        'visitors_available_from' => 'tanggal batas data, bukan angka',
    ];

    /**
     * Setiap KPI WAJIB punya deklarasi cakupan, termasuk yang hanya hidup di
     * bagian financial dan tidak pernah menjadi kartu KPI.
     *
     * Sebelumnya penjaga ini hanya menelusuri sections[].kpis[], sehingga
     * cod_pending_in_period_amount dan cod_pending_in_period_count berjalan
     * tanpa deklarasi: dipakai halaman, tetapi tidak muncul di tabel Dasar
     * Setiap Metrik dan tidak tertangkap penjaga mana pun.
     */
    public function test_setiap_metrik_punya_deklarasi_cakupan(): void
    {
        $payload = app(StorePerformanceService::class)->build('last_7');

        // Kumpulkan dari dua sumber: kartu KPI dan angka pada bagian financial.
        $kunci = [];
        foreach ($payload['sections'] as $bagian) {
            foreach ($bagian['kpis'] as $kpi) {
                $kunci[] = $kpi['key'];
            }
        }
        $this->assertNotEmpty($kunci, 'build() wajib mengembalikan KPI');

        $keuangan = [];
        foreach ($payload['financial'] as $key => $nilai) {
            if (is_numeric($nilai)) {
                $keuangan[] = $key;
            }
        }
        $this->assertNotEmpty($keuangan, 'build() wajib mengembalikan angka financial');

        $terdeklarasi = array_keys(StorePerformanceService::METRIC_BASIS);

        // Angka financial wajib terdeklarasi, atau disebut sadar sebagai alias
        // atau komponen.
        $tanpaDeklarasi = [];
        foreach ($keuangan as $key) {
            if (in_array($key, $terdeklarasi, true)) {
                continue;
            }
            if (array_key_exists($key, self::FINANCIAL_TANPA_CAKUPAN_SENDIRI)) {
                continue;
            }
            $tanpaDeklarasi[] = $key;
        }

        // KPI tidak punya alasan untuk dilewatkan.
        foreach ($kunci as $key) {
            if (! in_array($key, $terdeklarasi, true)) {
                $tanpaDeklarasi[] = $key;
            }
        }

        $this->assertSame(
            [],
            array_values(array_unique($tanpaDeklarasi)),
            'Metrik ini dihitung server tetapi belum dideklarasikan cakupannya,'
                .' dan tidak disebut sebagai alias atau komponen: '
                .implode(', ', array_unique($tanpaDeklarasi))
        );
    }

    /**
     * Setiap metrik wajib menyebut satuannya, dan satuan itu harus dari
     * kosakata yang sah. Tanpa unit, jumlah pesanan bisa dibandingkan dengan
     * rupiah atau jumlah kunjungan tanpa ada yang menyadari.
     */
    public function test_setiap_metrik_punya_unit(): void
    {
        $payload = app(StorePerformanceService::class)->build('last_7');

        foreach (StorePerformanceService::METRIC_BASIS as $key => $basis) {
            $this->assertArrayHasKey('unit', $basis, 'Metrik '.$key.' belum punya unit.');
            $this->assertContains(
                $basis['unit'],
                self::UNIT_SAHIH,
                'Unit metrik '.$key.' tidak dikenal: '.$basis['unit']
            );
        }

        // Peta yang dikirim ke payload harus membawa unit yang sama dengan kontrak.
        foreach ($payload['metric_basis'] as $key => $basis) {
            $this->assertSame(
                StorePerformanceService::METRIC_BASIS[$key]['unit'] ?? null,
                $basis['unit'] ?? null,
                'Unit '.$key.' di payload berbeda dari kontrak METRIC_BASIS.'
            );
        }
    }

    /**
     * Kontrak tanggal wajib ikut dalam payload: zona waktu dan semantik batas
     * rentang tidak boleh rahasia internal service.
     */
    public function test_payload_memuat_kontrak_tanggal(): void
    {
        $payload = app(StorePerformanceService::class)->build('last_7');
        $kontrak = $payload['date_contract'] ?? null;

        $this->assertIsArray($kontrak, 'build() wajib mengirim date_contract.');
        foreach (['timezone', 'start_boundary', 'end_boundary', 'running_period', 'comparison', 'recognition', 'per_metric'] as $kunci) {
            $this->assertArrayHasKey($kunci, $kontrak, 'date_contract kurang kunci '.$kunci.'.');
            $this->assertNotSame('', trim((string) $kontrak[$kunci]), 'Kunci '.$kunci.' pada date_contract kosong.');
        }
        $this->assertSame(
            config('app.timezone'),
            $kontrak['timezone'],
            'Zona waktu pada kontrak harus sama dengan zona waktu aplikasi.'
        );
    }

    /**
     * Daftar putih di atas tidak boleh basi: setiap kunci yang disebut harus
     * benar benar ada di payload. Tanpa pemeriksaan ini, kunci yang sudah
     * dihapus dari kode akan terus tinggal di daftar dan menyamarkan celah baru.
     */
    public function test_daftar_putih_financial_tidak_basi(): void
    {
        $payload = app(StorePerformanceService::class)->build('last_7');

        foreach (array_keys(self::FINANCIAL_TANPA_CAKUPAN_SENDIRI) as $key) {
            $this->assertArrayHasKey(
                $key,
                $payload['financial'],
                'Kunci '.$key.' disebut di daftar putih tetapi sudah tidak ada di payload; hapus dari daftar.'
            );
        }

        // Dan kunci yang sudah punya deklarasi tidak boleh ikut disebut di daftar.
        foreach (array_keys(self::FINANCIAL_TANPA_CAKUPAN_SENDIRI) as $key) {
            $this->assertArrayNotHasKey(
                $key,
                StorePerformanceService::METRIC_BASIS,
                'Kunci '.$key.' sudah dideklarasikan cakupannya, jadi tidak perlu ada di daftar putih.'
            );
        }
    }

    /**
     * Dua angka kas COD tidak tampil sebagai kartu KPI, tetapi tetap wajib
     * terdeklarasi dan terkirim ke payload supaya tabel Dasar Setiap Metrik
     * bisa menjelaskannya.
     */
    public function test_dua_angka_kas_cod_terdeklarasi_dan_terkirim(): void
    {
        $payload = app(StorePerformanceService::class)->build('last_7');

        foreach (['cod_pending_amount', 'cod_pending_count'] as $key) {
            $this->assertArrayHasKey($key, StorePerformanceService::METRIC_BASIS, $key.' wajib punya deklarasi');
            $this->assertSame('current', StorePerformanceService::METRIC_BASIS[$key]['scope'], $key.' bercakupan sekarang');
            $this->assertSame('semua waktu', StorePerformanceService::METRIC_BASIS[$key]['marker'], $key.' cakupannya melampaui periode');
            $this->assertArrayHasKey($key, $payload['metric_basis'], $key.' wajib ikut terkirim');
        }
    }

    /** Payload membawa cakupan tiap metrik untuk halaman. */
    public function test_payload_membawa_peta_cakupan(): void
    {
        $payload = app(StorePerformanceService::class)->build('last_7');

        $this->assertArrayHasKey('metric_basis', $payload);
        $this->assertSame('current', $payload['metric_basis']['open_orders']['scope']);
        $this->assertNull($payload['metric_basis']['open_orders']['anchor'], 'metrik keadaan sekarang tidak punya tanggal acuan');
        $this->assertSame('period', $payload['metric_basis']['omzet']['scope']);
        $this->assertNotEmpty($payload['metric_basis']['omzet']['anchor'], 'metrik periode wajib menyebut tanggal acuannya');
    }

    /**
     * Deklarasi cakupan wajib cocok dengan perilaku label: metrik bercakupan
     * sekarang harus membawa penandanya di label, karena ekspor dan drawer
     * hanya membaca label.
     */
    public function test_metrik_cakupan_sekarang_membawa_penanda_di_label(): void
    {
        $payload = app(StorePerformanceService::class)->build('last_7');

        $peta = [];
        foreach ($payload['sections'] as $bagian) {
            foreach ($bagian['kpis'] as $kpi) {
                $peta[$kpi['key']] = $kpi;
            }
        }

        foreach (StorePerformanceService::METRIC_BASIS as $key => $basis) {
            if ($basis['scope'] !== 'current' || ! isset($peta[$key])) {
                continue;
            }
            $penanda = $basis['marker'] ?? 'kondisi saat ini';
            $this->assertStringContainsString(
                '('.$penanda.')',
                $peta[$key]['label'],
                'label '.$key.' wajib menyebut cakupannya supaya ikut terbaca di ekspor dan drawer'
            );
        }

        // Dan sebaliknya: metrik periode tidak boleh menyandang penanda cakupan.
        foreach ($peta as $key => $kpi) {
            if ((StorePerformanceService::METRIC_BASIS[$key]['scope'] ?? null) !== 'period') {
                continue;
            }
            $this->assertStringNotContainsString(
                '(kondisi saat ini)',
                $kpi['label'],
                'label '.$key.' terikat periode, jadi tidak boleh menyandang penanda cakupan sekarang'
            );
            $this->assertStringNotContainsString('(semua waktu)', $kpi['label'], 'label '.$key.' tidak bercakupan semua waktu');
        }
    }

    /**
     * Label kartu metrik bercakupan sekarang wajib datang dari server.
     *
     * Sempat ada kartu yang menulis labelnya sendiri, sehingga penanda cakupan
     * yang sudah dikirim service tidak muncul di kartu itu. Test perilaku
     * service tidak menangkapnya, karena service-nya benar; yang salah adalah
     * halaman yang tidak membaca labelnya.
     */
    public function test_label_kartu_bercakupan_sekarang_diambil_dari_server(): void
    {
        $isi = file_get_contents(base_path('resources/js/pages/Admin/Analytics/StorePerformance.tsx'));
        $this->assertNotFalse($isi, 'halaman harus terbaca');
        // Komentar dibuang supaya penjelasan di kode tidak dianggap label.
        $isi = preg_replace('~/\*.*?\*/~s', '', $isi ?? '') ?? '';
        $isi = preg_replace('~^\s*//.*$~m', '', $isi) ?? '';

        // Label mentah yang tidak boleh muncul lagi, karena akan melewatkan
        // penanda cakupan yang dikirim server.
        foreach (['label="Retur Aktif"', 'label="Pembayaran Transfer Pending"', 'label="Pesanan Belum Selesai"', 'label="Dalam Pengiriman"'] as $terlarang) {
            $this->assertStringNotContainsString(
                $terlarang,
                $isi,
                $terlarang.' menulis label tanpa penanda cakupan; ambil dari kpiMap[key].label'
            );
        }

        // Dan labelnya wajib benar benar diambil dari kpiMap untuk tiap metrik
        // bercakupan sekarang yang tampil sebagai kartu.
        foreach (['returns_open', 'payment_pending_count', 'open_orders', 'dispatched_orders'] as $key) {
            $this->assertStringContainsString(
                'kpiMap["'.$key.'"]?.label',
                $isi,
                'kartu '.$key.' wajib membaca labelnya dari server'
            );
        }
    }

    // =======================================================================
    // 2. CAKUPAN SEKARANG: data di luar periode TETAP terhitung
    // =======================================================================

    /**
     * open_orders, dispatched_orders, returns_open: pesanan dan kasus retur yang
     * dibuat jauh sebelum periode tetap masuk hitungan, karena yang dibaca
     * adalah keadaan sekarang.
     */
    public function test_metrik_keadaan_sekarang_menghitung_data_luar_periode(): void
    {
        $lama = '2026-01-05 09:00:00';

        // Tiga bentuk keadaan sekarang, semuanya bertanggal jauh di luar periode.
        $belumKonfirmasi = $this->order('RA-CUR-A', 'awaiting_confirmation', $lama, 1000000, '081200000201');
        $this->item($belumKonfirmasi);
        $dikirim = $this->order('RA-CUR-B', 'shipped', $lama, 1000000, '081200000202');
        $this->item($dikirim);

        // Kasus retur masih terbuka, diajukan jauh sebelum periode.
        $retur = OrderReturnCase::create([
            'order_id' => $belumKonfirmasi->id,
            'status' => 'open',
            'reason' => 'Barang pecah',
            'refund_amount' => 0,
        ]);
        OrderReturnCase::whereKey($retur->id)->update(['created_at' => $lama, 'updated_at' => $lama]);

        // Pembayaran transfer pending pada pesanan aktif.
        Payment::create([
            'order_id' => $belumKonfirmasi->id,
            'payment_method' => 'transfer',
            'amount' => 1000000,
            'status' => 'pending',
        ]);

        // Dana COD yang belum cair: pesanannya sedang dikirim (masuk daftar
        // status omzet) dan pembayarannya belum selesai. Pesanannya bertanggal
        // jauh di luar periode.
        Payment::create([
            'order_id' => $dikirim->id,
            'payment_method' => 'cod',
            'amount' => 2500000,
            'status' => 'pending',
        ]);

        $m = $this->metrik();

        // Dua pesanan terbuka dibuat: satu belum dikonfirmasi, satu sedang dikirim.
        // Keduanya bertanggal jauh di luar periode dan tetap terhitung.
        $this->assertSame(2, $m['open_orders'], 'open_orders membaca keadaan sekarang, jadi pesanan di luar periode tetap terhitung');
        $this->assertSame(1, $m['dispatched_orders'], 'dispatched_orders tidak dibatasi tanggal');
        $this->assertSame(1, $m['returns_open'], 'returns_open tidak dibatasi tanggal');
        $this->assertSame(1, $m['payment_pending_count'], 'payment_pending_count tidak dibatasi tanggal');

        // Dua angka kas COD ini menjumlahkan seluruh dana yang belum cair,
        // jadi cakupannya melampaui periode terpilih.
        $this->assertSame(2500000.0, (float) $m['cod_pending_amount'], 'cod_pending_amount tidak dibatasi tanggal');
        $this->assertSame(1, $m['cod_pending_count'], 'cod_pending_count tidak dibatasi tanggal');
    }

    // =======================================================================
    // 3. TERIKAT PERIODE: data di luar periode TIDAK terhitung
    //
    // Satu test per kelas tanggal acuan. Inilah yang menangkap salah
    // klasifikasi, dan tidak bisa lolos karena kebetulan angka nol.
    // =======================================================================

    /** Acuan: tanggal pesanan dibuat. */
    public function test_acuan_tanggal_pesanan_dibuat(): void
    {
        $lama = '2026-01-05 09:00:00';
        $order = $this->order('RA-B-DIBUAT', 'processing', $lama, 5000000, '081200000211');
        $this->item($order, 'SWING', 'POLOS', 'VAR-LAMA');

        $m = $this->metrik();

        $this->assertSame(0, $m['orders'], 'pesanan di luar periode tidak masuk Jumlah Pesanan');
        $this->assertSame(0.0, $m['revenue'], 'omzet tidak memuat pesanan di luar periode');
        $this->assertSame(0, $m['units'], 'unit terjual tidak memuat pesanan di luar periode');
        $this->assertSame(0, $m['models_sold'], 'model terjual terikat periode');
        $this->assertSame(0, $m['products_sold'], 'produk terjual terikat periode');
        $this->assertSame(0, $m['open_orders_in_period'], 'versi periode dari antrean terikat tanggal pembuatan');
    }

    /** Acuan: tanggal pesanan selesai. */
    public function test_acuan_tanggal_pesanan_selesai(): void
    {
        $lama = '2026-01-05 09:00:00';
        $order = $this->order('RA-B-SELESAI', 'completed', $lama, 1000000, '081200000212');
        $this->item($order);
        // Perpindahan ke selesai juga di luar periode.
        $this->event($order, 'completed', '2026-01-05 12:00:00');

        $m = $this->metrik();

        $this->assertSame(0, $m['completed_orders'], 'selesai di luar periode tidak masuk Pesanan Selesai');
    }

    /** Acuan: tanggal pembayaran lunas. */
    public function test_acuan_tanggal_pembayaran_lunas(): void
    {
        $order = $this->order('RA-B-BAYAR', 'processing', now()->toDateTimeString(), 1000000, '081200000213');
        $this->item($order);

        $bayar = Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'transfer',
            'amount' => 1000000,
            'status' => 'completed',
        ]);
        Payment::whereKey($bayar->id)->update(['paid_at' => '2026-01-06 10:00:00']);

        $m = $this->metrik();

        $this->assertSame(0.0, $m['payments_received'], 'pembayaran di luar periode tidak masuk Pembayaran Diterima');
    }

    /** Acuan: tanggal retur selesai. */
    public function test_acuan_tanggal_retur_selesai(): void
    {
        $order = $this->order('RA-B-RETUR', 'return_completed', now()->toDateTimeString(), 1000000, '081200000214');
        $item = $this->item($order);

        $kasus = OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'Barang pecah',
            'refund_amount' => 100000,
            'completed_at' => '2026-01-07 10:00:00',
        ]);
        OrderReturnItem::create([
            'return_case_id' => $kasus->id,
            'order_item_id' => $item->id,
            'requested_quantity' => 1,
            'returned_quantity' => 1,
        ]);

        $m = $this->metrik();

        $this->assertSame(0, $m['return_orders'], 'retur selesai di luar periode tidak masuk Pesanan dengan Retur Barang Selesai');
        $this->assertSame(0.0, $m['return_value'], 'nilai retur terikat tanggal retur selesai');
        $this->assertSame(0, $m['returns_completed'], 'kasus retur selesai terikat tanggal penyelesaian');
        $this->assertSame(0.0, $m['refund_adjustments'], 'refund terikat tanggal retur selesai');
        $this->assertSame(0, $m['return_shipping_cost_cases'], 'ongkir retur toko terikat tanggal retur selesai');
    }

    /** Acuan: tanggal retur diajukan. */
    public function test_acuan_tanggal_retur_diajukan(): void
    {
        $order = $this->order('RA-B-AJUKAN', 'processing', now()->toDateTimeString(), 1000000, '081200000215');
        $this->item($order);

        $kasus = OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'open',
            'reason' => 'Salah ukuran',
            'refund_amount' => 0,
        ]);
        OrderReturnCase::whereKey($kasus->id)->update(['created_at' => '2026-01-08 10:00:00', 'updated_at' => '2026-01-08 10:00:00']);

        $m = $this->metrik();

        $this->assertSame(0, $m['returns_created'], 'retur diajukan di luar periode tidak masuk Retur Diajukan');
    }

    /** Acuan: tanggal pembatalan dicatat. */
    public function test_acuan_tanggal_pembatalan_dicatat(): void
    {
        $order = $this->order('RA-B-BATAL', 'cancelled', now()->toDateTimeString(), 4000000, '081200000216');
        $this->item($order);
        $this->event($order, 'cancelled', '2026-01-09 10:00:00');

        $m = $this->metrik();

        $this->assertSame(0, $m['cancelled_orders'], 'pembatalan di luar periode tidak masuk Pesanan Dibatalkan');
        $this->assertSame(0.0, $m['cancelled_value'], 'nilai pembatalan terikat tanggal pencatatannya');
    }

    /** Acuan: tanggal kunjungan. */
    public function test_acuan_tanggal_kunjungan(): void
    {
        $koneksi = config('database.default');

        \Illuminate\Support\Facades\DB::table('performance_visitor_events')->insert([
            'visitor_hash' => hash('sha256', 'kunjungan-lama'),
            // visit_date wajib: skema memakainya sebagai bagian kunci unik
            // pengunjung per hari selain visited_at.
            'visit_date' => '2026-01-10',
            'visited_at' => '2026-01-10 10:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $m = $this->metrik();

        $this->assertSame(0, $m['visitors'], 'kunjungan di luar periode ('.$koneksi.') tidak masuk Pengunjung Unik');
    }
}