<?php

namespace App\Services;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Payment;
use App\Models\PerformanceMetric;
use App\Models\PerformanceVisitorEvent;
use App\Models\Product;
use App\Models\ShippingRecord;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;

/**
 * Pembukuan toko & penjualan - sumber kebenaran: orders + order_items (+ page views).
 */
class StorePerformanceService
{
    /** Omzet / unit terjual hanya dari pesanan yang sudah masuk alur fulfillment (bukan batal / pending bayar). */
    public const REVENUE_STATUSES = [
        'processing', 'shipped', 'delivered', 'completed',
        'return_in_process', 'return_completed',
    ];

    public const COMPLETED_STATUSES = ['completed'];

    // Status pesanan yang dihitung sebagai 'pesanan valid' utk KPI Pesanan & tingkat konversi
    // (konsisten dgn omzet: exclude pending, cancelled, issue).
    public const VALID_ORDER_STATUSES = self::REVENUE_STATUSES;

    public const OPEN_STATUSES = ['awaiting_confirmation', 'processing', 'shipped'];

    /**
     * Cakupan dan tanggal acuan setiap metrik yang dilaporkan halaman ini.
     *
     * Satu sumber kebenaran: label, drawer, tabel Referensi, dan ekspor XLSX
     * membacanya dari sini, jadi tidak ada permukaan yang bisa berbeda.
     *
     * scope 'current': perhitungannya TIDAK membaca rentang tanggal sama sekali.
     *   Angkanya keadaan saat laporan dibangun, karena itu tidak diberi
     *   pembanding periode (membandingkannya dengan dirinya sendiri selalu nol).
     *   Labelnya wajib menyebut cakupannya, lihat scopeMarker().
     * scope 'period': perhitungannya membaca rentang terpilih pada kolom tanggal
     *   yang disebut di 'anchor'.
     *
     * 'anchor' memakai frasa Bahasa Indonesia karena ditampilkan ke pembaca,
     * bukan nama kolom database.
     */
    public const METRIC_BASIS = [
        // --- Penjualan, semuanya terikat periode ---
        'omzet' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'orders' => ['unit' => 'pesanan', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'models' => ['unit' => 'model', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'sub_models' => ['unit' => 'sub model', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'products' => ['unit' => 'produk', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'units' => ['unit' => 'unit', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'avg_unit_price' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'aov' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'completed_orders' => ['unit' => 'pesanan', 'scope' => 'period', 'anchor' => 'Tanggal pesanan selesai'],

        // --- Kunjungan & pelanggan ---
        'visitors' => ['unit' => 'kunjungan', 'scope' => 'period', 'anchor' => 'Tanggal kunjungan'],
        'conversion' => ['unit' => 'persen', 'scope' => 'period', 'anchor' => 'Tanggal kunjungan'],
        // Pembilang dari rasio konversi: jumlah pembeli unik pada pesanan
        // berstatus omzet dalam rentang, dihitung per nomor telepon. Dipakai
        // drawer Pengunjung pada baris Pembeli Unik.
        'buyers' => ['unit' => 'orang', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'new_customers' => ['unit' => 'orang', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'repeat_customers' => ['unit' => 'orang', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'repeat_order_rate' => ['unit' => 'persen', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],

        // --- Operasional ---
        // Dua metrik antrean ini membaca keadaan sekarang, tanpa tanggal.
        'open_orders' => ['unit' => 'pesanan', 'scope' => 'current', 'anchor' => null],
        'dispatched_orders' => ['unit' => 'pesanan', 'scope' => 'current', 'anchor' => null],
        'open_orders_in_period' => ['unit' => 'pesanan', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'avg_confirm_hours' => ['unit' => 'jam', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'avg_process_days' => ['unit' => 'hari', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],

        // --- Pembayaran ---
        'net_revenue' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat dan tanggal retur selesai'],
        'payments_received' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal pembayaran lunas'],
        'cod_paid' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal pembayaran lunas'],
        'payment_pending_count' => ['unit' => 'pembayaran', 'scope' => 'current', 'anchor' => null],
        // Dua angka kas COD ini menjumlahkan seluruh pesanan yang uangnya belum
        // cair, jadi cakupannya melampaui periode terpilih.
        'cod_pending_amount' => ['unit' => 'rupiah', 'scope' => 'current', 'anchor' => null, 'marker' => 'semua waktu'],
        'cod_pending_count' => ['unit' => 'pesanan', 'scope' => 'current', 'anchor' => null, 'marker' => 'semua waktu'],
        // Versi terbatas periode dari dua angka di atas: dana COD belum cair
        // untuk pesanan yang DIBUAT dalam rentang terpilih. Dipakai halaman
        // pada baris Belum Masuk (periode ini) di drawer Arus Kas.
        'cod_pending_in_period_amount' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'cod_pending_in_period_count' => ['unit' => 'pesanan', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],

        // --- Retur & pembatalan ---
        'returns' => ['unit' => 'pesanan', 'scope' => 'period', 'anchor' => 'Tanggal retur selesai'],
        'return_value' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal retur selesai'],
        'returns_created' => ['unit' => 'kasus', 'scope' => 'period', 'anchor' => 'Tanggal retur diajukan'],
        'returns_open' => ['unit' => 'kasus', 'scope' => 'current', 'anchor' => null],
        'returns_completed' => ['unit' => 'kasus', 'scope' => 'period', 'anchor' => 'Tanggal retur selesai'],
        'refused_orders' => ['unit' => 'pesanan', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'refund_given' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal retur selesai'],
        'return_rate_created' => ['unit' => 'persen', 'scope' => 'period', 'anchor' => 'Tanggal retur diajukan'],
        'return_rate_completed' => ['unit' => 'persen', 'scope' => 'period', 'anchor' => 'Tanggal retur selesai'],
        'return_shipping_cost_total' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal retur selesai'],
        'return_shipping_cost_cases' => ['unit' => 'kasus', 'scope' => 'period', 'anchor' => 'Tanggal retur selesai'],
        'refused_borne_cost' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal pesanan dibuat'],
        'cancelled_orders' => ['unit' => 'pesanan', 'scope' => 'period', 'anchor' => 'Tanggal pembatalan dicatat'],
        'cancelled_by_customer' => ['unit' => 'pesanan', 'scope' => 'period', 'anchor' => 'Tanggal pembatalan dicatat'],
        'cancelled_by_store' => ['unit' => 'pesanan', 'scope' => 'period', 'anchor' => 'Tanggal pembatalan dicatat'],
        'cancelled_value' => ['unit' => 'rupiah', 'scope' => 'period', 'anchor' => 'Tanggal pembatalan dicatat'],
        'cancellation_rate' => ['unit' => 'persen', 'scope' => 'period', 'anchor' => 'Tanggal pembatalan dicatat'],
    ];


    /**
     * issue is an operational exception, not proof that goods were returned.
     * Actual return KPIs come from the return ledger below.
     */
    public const RETURN_STATUSES = [];

    protected function safeParseDate(?string $value, Carbon $fallback, bool $startOfDay = true): Carbon
    {
        if (! $value) {
            return $fallback;
        }

        try {
            $parsed = Carbon::parse($value);

            return $startOfDay ? $parsed->startOfDay() : $parsed->endOfDay();
        } catch (\Throwable) {
            return $fallback;
        }
    }

    /**
     * @return array{from: Carbon, to: Carbon, previous_from: Carbon, previous_to: Carbon, label: string, granularity: string, period: string}
     */
    /**
     * Apakah nilai tanggal masukan berformat persis YYYY-MM-DD.
     *
     * Dipakai untuk MENOLAK masukan yang bukan tanggal, bukan menebaknya.
     * Sebelumnya nilai apa pun diserahkan ke pengurai tanggal, dan pengurai itu
     * menerima kata seperti "monday" atau "+3 days" sebagai tanggal yang sah,
     * lalu gagal diam diam menjadi rentang bawaan untuk nilai yang tidak masuk
     * akal seperti "2026-13-45". Dua duanya membuat laporan menampilkan rentang
     * yang tidak pernah diminta, tanpa pemberitahuan apa pun.
     */
    protected function tanggalSah(?string $nilai): bool
    {
        if ($nilai === null) {
            return false;
        }

        $bersih = trim($nilai);
        if ($bersih === '') {
            return false;
        }

        $tanggal = \DateTimeImmutable::createFromFormat('!Y-m-d', $bersih);

        // createFromFormat meloloskan tanggal bergeser seperti 2026-02-31, jadi
        // hasilnya dibandingkan balik dengan masukannya.
        return $tanggal !== false && $tanggal->format('Y-m-d') === $bersih;
    }

    public function resolveRange(string $period, ?string $from = null, ?string $to = null, ?string $granularity = null): array
    {
        $now = now();
        $period = in_array($period, ['today', 'yesterday', 'last_7', 'last_30', 'this_month', 'this_year', 'all', 'custom'], true)
            ? $period
            : 'today';

        // Masukan tanggal dipakai hanya bila bentuknya sah. Yang tidak sah
        // dicatat namanya, sehingga halaman bisa memberi tahu bahwa rentang yang
        // tampil bukan rentang yang diminta.
        $fromSah = $this->tanggalSah($from) ? trim((string) $from) : null;
        $toSah = $this->tanggalSah($to) ? trim((string) $to) : null;
        $inputDiabaikan = [];
        if ($from !== null && trim($from) !== '' && $fromSah === null) {
            $inputDiabaikan[] = 'from';
        }
        if ($to !== null && trim($to) !== '' && $toSah === null) {
            $inputDiabaikan[] = 'to';
        }

        [$start, $end, $label] = match ($period) {
            'yesterday' => [
                $now->copy()->subDay()->startOfDay(),
                $now->copy()->subDay()->endOfDay(),
                'Kemarin',
            ],
            'last_7' => [
                $now->copy()->subDays(6)->startOfDay(),
                $now->copy()->endOfDay(),
                '7 hari terakhir',
            ],
            'last_30' => [
                $now->copy()->subDays(29)->startOfDay(),
                $now->copy()->endOfDay(),
                '30 hari terakhir',
            ],
            'this_month' => [
                $now->copy()->startOfMonth(),
                $now->copy()->endOfDay(),
                'Bulan ini',
            ],
            'this_year' => [
                $now->copy()->startOfYear(),
                $now->copy()->endOfDay(),
                'Tahun ini',
            ],
            'all' => [
                Order::query()->min('created_at')
                    ? Carbon::parse(Order::query()->min('created_at'))->startOfDay()
                    : $now->copy()->startOfYear(),
                $now->copy()->endOfDay(),
                'Semua waktu',
            ],
            'custom' => [
                $this->safeParseDate($fromSah, $now->copy()->subDays(6)->startOfDay(), true),
                $this->safeParseDate($toSah, $now->copy()->endOfDay(), false),
                'Rentang kustom',
            ],
            default => [
                $now->copy()->startOfDay(),
                $now->copy()->endOfDay(),
                'Hari ini',
            ],
        };

        if ($start->gt($end)) {
            [$start, $end] = [$end->copy()->startOfDay(), $start->copy()->endOfDay()];
        }

        // Rentang yang melewati hari ini dipotong ke hari ini. Sebelumnya rentang
        // masa depan diterima apa adanya, dan jendela pembandingnya menciut
        // sampai panjang nol detik, sehingga seluruh kolom pembanding dan
        // persentase di halaman kehilangan arti. Pemotongan ini dilaporkan lewat
        // 'rentang_dipotong' supaya halaman bisa mengatakannya.
        $rentangDipotong = false;
        $batasHariIni = now()->endOfDay();
        if ($start->gt($batasHariIni)) {
            $start = now()->startOfDay();
            $rentangDipotong = true;
        }
        if ($end->gt($batasHariIni)) {
            $end = $batasHariIni->copy();
            $rentangDipotong = true;
        }

        // Carbon 3: diffInSeconds default absolute=false -> hitung dari $start ke $end.
        $fullSeconds = max(1, (int) round($start->diffInSeconds($end)));
        // Spec G: periode berjalan -> bandingkan sampai jam sama; selesai -> penuh.
        $now = now();
        $elapsedSeconds = $now->lessThan($end)
            ? max(1, (int) round($start->diffInSeconds($now)))
            : $fullSeconds;
        $isRunning = $elapsedSeconds < $fullSeconds;
        if ($isRunning) {
            // Periode masih berjalan: potong periode sebelumnya di jam yang sama.
            $previousFrom = $start->copy()->subSeconds($fullSeconds);
            $previousTo = $previousFrom->copy()->addSeconds($elapsedSeconds - 1);
        } else {
            // Periode selesai: bandingkan penuh.
            $previousTo = $start->copy()->subSecond();
            $previousFrom = $previousTo->copy()->subSeconds($fullSeconds - 1);
        }

        // Granularitas otomatis diambil dari daftar opsi yang sama dengan yang
        // ditawarkan ke UI, sehingga nilai aktif selalu ada di pilihan.
        $autoGranularity = $this->defaultGranularity($start, $end);

        $granularity = in_array($granularity, ['hour', 'day', 'week', 'month', 'year'], true)
            ? $granularity
            : $autoGranularity;

        return [
            'from' => $start,
            'to' => $end,
            'previous_from' => $previousFrom,
            'previous_to' => $previousTo,
            'label' => $label,
            'granularity' => $granularity,
            'period' => $period,
            'is_running' => $isRunning,
            // Nama parameter tanggal yang diminta tetapi tidak dipakai karena
            // bentuknya bukan tanggal, mis. "monday" atau "2026-13-45".
            'input_diabaikan' => $inputDiabaikan,
            // Benar bila rentang yang diminta melewati hari ini sehingga
            // dipotong.
            'rentang_dipotong' => $rentangDipotong,
        ];
    }

    /** Jumlah hari kalender yang tercakup rentang, minimal 1. */
    public function spanDays(Carbon $from, Carbon $to): int
    {
        return max(1, (int) $from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) + 1);
    }

    /** Urutan skala dari paling rinci ke paling kasar. */
    public const GRANULARITY_ORDER = ['hour', 'day', 'week', 'month', 'year'];

    /**
     * Skala tren yang benar-benar berguna untuk rentang nyata, dari paling
     * rinci ke paling kasar.
     *
     * Satu skala hanya ditawarkan bila jumlah titiknya masuk akal: minimal 2
     * titik supaya garisnya terbentuk, dan maksimal agar grafik tidak menjadi
     * kabut titik. Batas minimal juga melihat panjang rentang, bukan hanya
     * jumlah titik, karena minggu kalender bisa menghasilkan 2 titik pada
     * rentang 7 hari dan itu tidak berarti apa pun.
     *
     * Dihitung dari emptyBuckets() sehingga jumlah titik yang dipakai di sini
     * persis sama dengan yang digambar grafik.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public function granularityOptions(Carbon $from, Carbon $to): array
    {
        $labels = [
            'hour' => 'Per Jam',
            'day' => 'Per Hari',
            'week' => 'Per Minggu',
            'month' => 'Per Bulan',
            'year' => 'Per Tahun',
        ];
        $maxBuckets = ['hour' => 72, 'day' => 90, 'week' => 60, 'month' => 36, 'year' => PHP_INT_MAX];
        $minSpanDays = ['hour' => 1, 'day' => 1, 'week' => 14, 'month' => 28, 'year' => 1];
        $spanDays = $this->spanDays($from, $to);

        $options = [];
        foreach (self::GRANULARITY_ORDER as $value) {
            if ($spanDays < $minSpanDays[$value]) {
                continue;
            }

            $count = count($this->emptyBuckets($from, $to, $value));
            if ($count < 2 || $count > $maxBuckets[$value]) {
                continue;
            }

            $options[] = ['value' => $value, 'label' => $labels[$value]];
        }

        return $options;
    }

    /**
     * Skala terbaik untuk rentang ini, dijamin ada di granularityOptions().
     * Bila pilihan terbaik tidak layak (mis. rentang 40 hari untuk Per Bulan),
     * dipakai skala terdekat yang tersedia.
     */
    public function defaultGranularity(Carbon $from, Carbon $to): string
    {
        $spanDays = $this->spanDays($from, $to);

        $preferred = match (true) {
            $spanDays <= 2 => 'hour',
            $spanDays > 90 => 'month',
            $spanDays > 45 => 'week',
            default => 'day',
        };

        $values = array_column($this->granularityOptions($from, $to), 'value');
        if ($values === []) {
            return $preferred;
        }

        if (in_array($preferred, $values, true)) {
            return $preferred;
        }

        $order = self::GRANULARITY_ORDER;
        $index = (int) array_search($preferred, $order, true);
        for ($distance = 1; $distance < count($order); $distance += 1) {
            foreach ([$index - $distance, $index + $distance] as $candidate) {
                if ($candidate >= 0 && $candidate < count($order) && in_array($order[$candidate], $values, true)) {
                    return $order[$candidate];
                }
            }
        }

        return $values[0];
    }

    /**
     * @return array<string, mixed>
     */
    public function build(string $period = 'today', ?string $from = null, ?string $to = null, ?string $granularity = null): array
    {
        $range = $this->resolveRange($period, $from, $to, $granularity);
        // KPI-002: saat periode masih berjalan, bandingkan current sampai 'sekarang' (elapsed sama),
        // bukan endOfDay penuh, agar setara dgn previous yang dipotong di jam yang sama.
        // KPI-002: periode berjalan dibandingkan sampai 'sekarang'. Namun
        // rentang yang BELUM dimulai (masa depan) tidak boleh dikepal:
        // memutasi range.to ke now() membuat tanggal tampil terbalik.
        $periodStarted = $range['from']->lte(now());
        $currentTo = ($range['is_running'] ?? false) && $periodStarted && $range['to']->gt(now())
            ? now()
            : $range['to'];
        $current = $this->metricsFor($range['from'], $currentTo);
        // Sinkronkan portabel current utk grafik/label bila running dan
        // periode memang sudah dimulai.
        if (($range['is_running'] ?? false) && $periodStarted) {
            $range['to'] = $currentTo;
        }
        // Jendela pembanding diselaraskan ke batas bucket untuk granularitas
        // minggu, bulan, dan tahun. Dilakukan SEBELUM metrik pembanding
        // dihitung, supaya angka Pembanding dan seri pembanding memakai
        // jendela yang sama persis.
        $range = $this->alignPreviousWindowToBuckets($range);

        // Pengunjung hanya dicatat sejak tanggal tertentu. Jendela pembanding
        // yang mulai sebelum tanggal itu tidak pernah diukur, jadi angkanya
        // bukan nol melainkan tidak ada. Dipakai chart pengunjung dan konversi.
        $pengunjungSejak = $current['visitors_available_from'] ?? null;
        $pengunjungPembandingTerukur = $pengunjungSejak !== null
            && $range['previous_from']->gte(Carbon::parse($pengunjungSejak));

        $previous = $this->metricsFor($range['previous_from'], $range['previous_to']);

        $salesKpis = [
            $this->kpi('omzet', 'Penjualan Gross', $current['revenue'], $previous['revenue'], 'currency'),
            $this->kpi('orders', 'Jumlah Pesanan', $current['orders'], $previous['orders'], 'number'),
            $this->kpi('models', 'Model Produk Terjual', $current['models_sold'], $previous['models_sold'], 'number', 'Jenis model yang terjual, tanpa membedakan desain. Satu model dengan dua desain tetap dihitung satu.'),
            $this->kpi('sub_models', 'Sub Model Terjual', $current['sub_models_sold'], $previous['sub_models_sold'], 'number', 'Model beserta desainnya. Satu model dengan dua desain dihitung dua.'),
            $this->kpi('products', 'Produk Terjual', $current['products_sold'], $previous['products_sold'], 'number', 'Produk berbeda yang terjual, dibedakan menurut varian ukuran. Produk yang dijual tanpa varian dihitung memakai kode SKU induknya.'),
            $this->kpi('units', 'Jumlah Unit Terjual', $current['units'], $previous['units'], 'number'),
            $this->kpi('avg_unit_price', 'Harga Rata-rata per Unit', $current['avg_unit_price'], $previous['avg_unit_price'], 'currency'),
            $this->kpi('aov', 'Rata-rata Nilai Pesanan', $current['aov'], $previous['aov'], 'currency'),
            $this->kpi('completed_orders', 'Pesanan Selesai', $current['completed_orders'], $previous['completed_orders'], 'number'),
        ];

        $trafficKpis = [
            $this->kpi('visitors', 'Pengunjung Unik', $current['visitors'], $previous['visitors'], 'number'),
            $this->kpi(
                'conversion',
                'Pengunjung yang Membeli',
                $current['conversion_rate'],
                $previous['conversion_rate'],
                'percent',
                sprintf(
                    '%s pembeli dari %s pengunjung',
                    number_format((int) ($current['buyers'] ?? 0), 0, ',', '.'),
                    number_format((int) $current['visitors'], 0, ',', '.')
                )
            ),
            $this->kpi('new_customers', 'Pelanggan Baru', $current['new_customers'], $previous['new_customers'], 'number'),
            $this->kpi('repeat_customers', 'Pelanggan Ulang', $current['repeat_customers'], $previous['repeat_customers'], 'number'),
            $this->kpi('repeat_order_rate', 'Rasio Pelanggan Ulang', $current['repeat_order_rate'], $previous['repeat_order_rate'], 'percent'),
        ];

        $opsKpis = [
            // Operasional = FULFILLMENT (bukan retur). Kontrak 2026-09-02: retur dipindah
            // ke section 'Retur & Pembatalan' supaya Operasional bersih dari dominasi retur.
            // Dua KPI antrean ini snapshot: angkanya keadaan saat laporan
            // dibangun, jadi sengaja tidak punya nilai pembanding. Membandingkan
            // snapshot dengan periode sebelumnya selalu menghasilkan nol dan
            // menyesatkan.
            $this->kpi('open_orders', 'Pesanan Belum Selesai', $current['open_orders'], null, 'number', 'Seluruh pesanan yang belum selesai saat laporan dibangun: menunggu konfirmasi, sedang diproses, atau sudah dikirim. Tidak dibatasi periode.'),
            $this->kpi('dispatched_orders', 'Dalam Pengiriman', $current['dispatched_orders'], null, 'number', 'Pesanan yang sedang dikirim saat laporan dibangun. Tidak dibatasi periode.'),
            $this->kpi('open_orders_in_period', 'Pesanan Dibuat Periode Ini yang Masih Terbuka', $current['open_orders_in_period'], $previous['open_orders_in_period'], 'number', 'Pesanan yang DIBUAT pada periode terpilih dan sampai sekarang belum selesai. Berbeda dari antrean saat ini, yang menghitung seluruh pesanan terbuka tanpa melihat tanggal pembuatan.'),
            $this->kpi('avg_confirm_hours', 'Rata-rata Waktu Konfirmasi', $current['avg_confirm_hours'], $previous['avg_confirm_hours'], 'hours', 'Waktu dari pesanan masuk sampai dikonfirmasi admin.'),
            $this->kpi('avg_process_days', 'Rata-rata Waktu Proses', $current['avg_process_days'], $previous['avg_process_days'], 'days', 'Waktu dari dikonfirmasi sampai pesanan siap diserahkan ke kurir.'),
        ];

        $paymentsKpis = [
            $this->kpi('net_revenue', 'Penjualan Bersih', $current['net_revenue'], $previous['net_revenue'] ?? 0, 'currency', 'Penjualan Gross dikurangi refund retur yang benar-benar selesai.'),
            $this->kpi('payments_received', 'Pembayaran Diterima', $current['payments_received'], $previous['payments_received'], 'currency', 'Pembayaran yang dana-nya benar-benar lunas pada periode.'),
            $this->kpi('cod_paid', 'COD Selesai', $current['cod_paid'], $previous['cod_paid'], 'currency', 'Pesanan COD yang barangnya sudah sampai ke pembeli pada periode. Sistem tidak melacak setoran uang dari kurir, jadi status mengikuti kejadian barang sampai, bukan konfirmasi pembayaran.'),
            $this->kpi('payment_pending_count', 'Pembayaran Transfer Pending', $current['payment_pending_count'], null, 'number', 'Pembayaran non-COD yang belum lunas pada pesanan aktif saat laporan dibangun. Tidak dibatasi periode. COD tidak dihitung di sini karena statusnya mengikuti kejadian barang sampai, bukan konfirmasi pembayaran.'),
        ];

        $cancellationsKpis = [
            $this->kpi('cancelled_orders', 'Pesanan Dibatalkan', $current['cancelled_orders'], $previous['cancelled_orders'], 'number', 'Dihitung dari catatan pembatalan pada periode.'),
            $this->kpi('cancelled_by_customer', 'Dibatalkan Pelanggan', $current['cancelled_by_customer'], $previous['cancelled_by_customer'], 'number', 'Dibatalkan pembeli lewat halaman pesanan.'),
            $this->kpi('cancelled_by_store', 'Dibatalkan Toko', $current['cancelled_by_store'], $previous['cancelled_by_store'], 'number', 'Dibatalkan oleh admin toko.'),
            $this->kpi('cancelled_value', 'Nilai Pesanan Dibatalkan', $current['cancelled_value'], $previous['cancelled_value'] ?? 0, 'currency', 'Total nilai pesanan yang dibatalkan pada periode. Tidak termasuk dalam Penjualan Gross.'),
            $this->kpi('cancellation_rate', 'Rasio Pembatalan', $current['cancellation_rate'], $previous['cancellation_rate'], 'percent', 'Pesanan yang dibatalkan pada periode dibanding pesanan yang dibuat pada periode yang sama. Pembatalan atas pesanan lama tidak ikut dihitung supaya rasionya tidak melewati 100 persen.'),
        ];

        $returnsKpis = [
            // Menghitung PESANAN berbeda yang returnya selesai dan barangnya
            // benar benar kembali, bukan jumlah kasus retur. Kasus retur
            // termasuk refund tanpa barang kembali ada di Kasus Retur Selesai.
            $this->kpi('returns', 'Pesanan dengan Retur Barang Selesai', $current['return_orders'], $previous['return_orders'], 'number', 'Jumlah pesanan berbeda yang returnya selesai pada periode dan barangnya benar benar kembali. Satu pesanan dengan dua kasus retur tetap dihitung satu. Refund tanpa barang kembali tidak masuk hitungan ini.'),
            $this->kpi('return_value', 'Nilai Retur', $current['return_value'], $previous['return_value'], 'currency'),
            $this->kpi('returns_created', 'Retur Diajukan', $current['returns_created'], $previous['returns_created'], 'number'),
            $this->kpi('returns_open', 'Retur Aktif', $current['returns_open'], null, 'number', 'Kasus retur yang masih terbuka saat laporan dibuat. Tidak dibatasi periode.'),
            $this->kpi('returns_completed', 'Kasus Retur Selesai', $current['returns_completed'], $previous['returns_completed'], 'number', 'Jumlah kasus retur yang selesai pada periode, termasuk refund tanpa barang kembali. Satu pesanan bisa punya lebih dari satu kasus.'),
            $this->kpi('refused_orders', 'Pesanan Retur Paket', $current['refused_orders'], $previous['refused_orders'], 'number', 'Pesanan yang paketnya kembali sebelum diterima pembeli dan belum pernah lunas. Barang kembali ke gudang tanpa menambah stok.'),
            $this->kpi('refund_given', 'Refund Diberikan', $current['refund_given'], $previous['refund_given'], 'currency'),
            $this->kpi('return_rate_created', 'Rasio Retur Diajukan', $current['return_rate_created'], $previous['return_rate_created'], 'percent', 'Retur diajukan dibanding pesanan yang masuk proses.'),
            $this->kpi('return_rate_completed', 'Rasio Retur Selesai', $current['return_rate_completed'], $previous['return_rate_completed'], 'percent', 'Retur yang selesai pada periode dibanding pesanan yang selesai pada periode. Keduanya dihitung dari waktu penyelesaian, bukan waktu pembuatan.'),
        ];

        $returnCostKpis = [
            $this->kpi('return_shipping_cost_total', 'Ongkir Retur (Toko)', $current['return_shipping_cost_total'], $previous['return_shipping_cost_total'] ?? 0, 'currency', 'Total ongkir retur yang DITANGGUNG TOKO dari kasus retur selesai periode ini (bukan dibayar pembeli).'),
            $this->kpi('return_shipping_cost_cases', 'Kasus Retur (Ongkir Toko)', $current['return_shipping_cost_cases'], $previous['return_shipping_cost_cases'] ?? 0, 'number', 'Jumlah kasus retur selesai yang ongkirnya ditanggung toko.'),
            $this->kpi('refused_borne_cost', 'Ongkir & COD Ditanggung Toko', $current['refused_borne_cost'], $previous['refused_borne_cost'] ?? 0, 'currency', 'Ongkir kirim dan biaya layanan COD yang tetap ditagih J&T untuk paket yang kembali sebelum diterima pembeli. Pembeli tidak membayar, jadi toko yang menanggung. Ongkir perjalanan balik belum termasuk karena tagihannya belum tercatat otomatis.'),
        ];

        return [
            'range' => [
                'period' => $range['period'],
                'label' => $range['label'],
                'from' => $range['from']->toIso8601String(),
                'to' => $range['to']->toIso8601String(),
                'from_date' => $range['from']->translatedFormat('d M Y'),
                'to_date' => $range['to']->translatedFormat('d M Y'),
                'previous_from' => $range['previous_from']->toIso8601String(),
                'previous_to' => $range['previous_to']->toIso8601String(),
                'granularity' => $range['granularity'],
                'compare_label' => 'vs '.$range['previous_from']->translatedFormat('j M Y H:i')
                    .(
                        $range['previous_from']->toDateString() === $range['previous_to']->toDateString()
                        && $range['previous_from']->format('H:i') === $range['previous_to']->format('H:i')
                            ? ' '.$range['previous_from']->translatedFormat('H:i')
                            : ' - '.$range['previous_to']->translatedFormat('j M Y H:i')
                    ),
                'range_detail' => $range['from']->translatedFormat('j M Y H:i').' - '.$range['to']->translatedFormat('j M Y H:i'),
                'compare_from_date' => $range['previous_from']->translatedFormat('d M Y'),
                'compare_to_date' => $range['previous_to']->translatedFormat('d M Y'),
                // KPI-008: nilai ISO utk control HTML date & param custom/export (display tetap d M Y di atas).
                'from_date_iso' => $range['from']->toDateString(),
                'to_date_iso' => $range['to']->toDateString(),
                'is_running' => $range['is_running'],
                'input_diabaikan' => $range['input_diabaikan'] ?? [],
                'rentang_dipotong' => $range['rentang_dipotong'] ?? false,
            ],
            // P0-2 freshness: waktu laporan dibangun (WIB) utk indikator 'Data diperbarui'.
            'generated_at' => now()->timezone(config('app.timezone', 'Asia/Jakarta'))->toIso8601String(),
            'financial' => [
                'gross_revenue' => $current['gross_revenue'],
                'items_before_discount' => $current['items_before_discount'] ?? 0.0,
                'product_discount' => $current['product_discount'] ?? 0.0,
                'voucher_discount' => $current['voucher_discount'] ?? 0.0,
                'insurance' => $current['insurance'] ?? 0.0,
                'shipping_raw' => $current['shipping_raw'],
                'shipping_paid_by_customer' => $current['shipping_paid_by_customer'],
                'shipping_subsidy' => $current['shipping_subsidy'],
                'cod_fee' => $current['cod_fee'],
                'refund_adjustments' => $current['refund_adjustments'],
                'return_shipping_store' => $current['return_shipping_store'],
                'net_revenue' => $current['net_revenue'],
                'buyer_orders' => $current['orders'],
                // Jumlah pembeli unik apa adanya. Sebelumnya dibuang dari
                // payload sehingga tampilan menghitungnya ulang dari persentase
                // yang sudah dibulatkan, dan hasilnya bisa meleset beberapa
                // pembeli.
                'buyers' => $current['buyers'],
                'visitors' => $current['visitors'],
                'visitors_available_from' => $current['visitors_available_from'],
                'payments_received' => $current['payments_received'],
                'cod_paid' => $current['cod_paid'],
                'cod_pending_amount' => $current['cod_pending_amount'],
                'cod_pending_count' => $current['cod_pending_count'],
                'cod_pending_in_period_amount' => $current['cod_pending_in_period_amount'],
                'cod_pending_in_period_count' => $current['cod_pending_in_period_count'],
                'payment_pending_count' => $current['payment_pending_count'],
                'refused_goods_value' => round($current['refused_goods_value'], 2),
                'refused_borne_count' => $current['refused_borne_count'],
                'refused_shipping_cost' => $current['refused_shipping_cost'],
                'refused_cod_fee' => $current['refused_cod_fee'],
                'refused_borne_cost' => $current['refused_borne_cost'],
                'definition' => 'Penjualan Gross = total yang dibayar pelanggan, termasuk nilai produk, ongkir, dan biaya COD. Penjualan Bersih = Penjualan Gross dikurangi tagihan J&T yang sebenarnya, biaya COD yang diteruskan ke J&T, refund retur, dan ongkir retur toko. Subsidi ongkir sudah termasuk di tagihan J&T sehingga tidak dikurangkan lagi. Uang yang benar-benar masuk lihat Pembayaran Diterima.',
            ],
            // Nilai periode pembanding untuk sheet Ringkasan Finansial di
            // ekspor. Layar dan sheet KPI sudah memakai pembanding, sedangkan
            // sheet Ringkasan sebelumnya menulis "Tidak ada data" tetap
            // sehingga dua sheet dalam satu berkas saling bertentangan
            // (temuan audit 2026-09-21).
            'financial_previous' => [
                'gross_revenue' => $previous['gross_revenue'] ?? 0.0,
                'items_before_discount' => $previous['items_before_discount'] ?? 0.0,
                'voucher_discount' => $previous['voucher_discount'] ?? 0.0,
                'insurance' => $previous['insurance'] ?? 0.0,
                'shipping_paid_by_customer' => $previous['shipping_paid_by_customer'] ?? 0.0,
                'cod_fee' => $previous['cod_fee'] ?? 0.0,
                'shipping_raw' => $previous['shipping_raw'] ?? 0.0,
                'refund_adjustments' => $previous['refund_adjustments'] ?? 0.0,
                'return_shipping_store' => $previous['return_shipping_store'] ?? 0.0,
                'refused_goods_value' => $previous['refused_goods_value'] ?? 0.0,
                'refused_shipping_cost' => $previous['refused_shipping_cost'] ?? 0.0,
                'refused_cod_fee' => $previous['refused_cod_fee'] ?? 0.0,
                'net_revenue' => $previous['net_revenue'] ?? 0.0,
                'payments_received' => $previous['payments_received'] ?? 0.0,
                'cod_paid' => $previous['cod_paid'] ?? 0.0,
            ],
            'previous_has_data' => ($previous['orders'] ?? 0) > 0,
            // Cakupan dan tanggal acuan tiap metrik, dipakai halaman untuk
            // memberi penanda cakupan dan untuk tabel Dasar Setiap Metrik.
            'metric_basis' => $this->metricBasisMap(),
            // Kontrak tanggal laporan: zona waktu dan semantik batas rentang,
            // supaya pembaca angka tidak perlu menebak kapan hari terakhir
            // dihitung. Isinya mendeskripsikan kode apa adanya.
            'date_contract' => [
                'timezone' => config('app.timezone', 'Asia/Jakarta'),
                'start_boundary' => 'Inklusif: hari pertama dihitung sejak 00:00:00',
                'end_boundary' => 'Inklusif: hari terakhir dihitung sampai 23:59:59.999999',
                'running_period' => 'Periode berjalan dipotong ke waktu laporan dibangun',
                'comparison' => 'Periode berjalan dibandingkan sampai jam yang sama pada periode sebelumnya, periode selesai dibandingkan penuh',
                'per_metric' => 'Kolom tanggal tiap metrik tercantum di metric_basis.anchor',
            ],
            'sections' => [
                ['key' => 'sales', 'title' => 'Penjualan', 'kpis' => $salesKpis],
                ['key' => 'traffic', 'title' => 'Kunjungan & Pelanggan', 'kpis' => $trafficKpis],
                ['key' => 'operations', 'title' => 'Operasional', 'kpis' => $opsKpis],
                ['key' => 'payments', 'title' => 'Pembayaran', 'kpis' => $paymentsKpis],
                ['key' => 'returns_cancellations', 'title' => 'Retur & Pembatalan', 'kpis' => array_merge($returnsKpis, $returnCostKpis, $cancellationsKpis)],
            ],
            'return_shipping_costs' => $current['return_shipping_cost_list'],
            'charts' => [
                [
                    'key' => 'revenue',
                    'title' => 'Tren Penjualan Gross',
                    'total' => $current['gross_revenue'],
                    'previous_total' => $previous['gross_revenue'] ?? 0.0,
                    'total_format' => 'currency',
                    'series' => $this->chartSeries($range, 'revenue', false),
                    'previous_series' => $this->chartSeries($range, 'revenue', true),
                ],
                [
                    'key' => 'orders',
                    'title' => 'Tren Pesanan',
                    'total' => $current['orders'],
                    'previous_total' => $previous['orders'] ?? 0.0,
                    'total_format' => 'number',
                    'series' => $this->chartSeries($range, 'orders', false),
                    'previous_series' => $this->chartSeries($range, 'orders', true),
                ],
                [
                    'key' => 'products',
                    'title' => 'Tren Produk Terjual',
                    'total' => $current['products_sold'],
                    'previous_total' => $previous['products_sold'] ?? 0.0,
                    'total_format' => 'number',
                    'series' => $this->chartSeries($range, 'products', false),
                    'previous_series' => $this->chartSeries($range, 'products', true),
                ],
                [
                    'key' => 'units',
                    'title' => 'Tren Unit Terjual',
                    'total' => $current['units'],
                    'previous_total' => $previous['units'] ?? 0.0,
                    'total_format' => 'number',
                    'series' => $this->chartSeries($range, 'units', false),
                    'previous_series' => $this->chartSeries($range, 'units', true),
                ],
                [
                    'key' => 'visitors',
                    'title' => 'Tren Pengunjung Unik',
                    'total' => $current['visitors'],
                    'previous_total' => $previous['visitors'] ?? 0.0,
                    'total_format' => 'number',
                    'previous_measured' => $pengunjungPembandingTerukur,
                    'series' => $this->chartSeries($range, 'visitors', false),
                    'previous_series' => $this->chartSeries($range, 'visitors', true),
                ],
                [
                    'key' => 'conversion_rate',
                    'title' => 'Tren Pengunjung yang Membeli',
                    'total' => $current['conversion_rate'],
                    'previous_total' => $previous['conversion_rate'] ?? 0.0,
                    'total_format' => 'percent',
                    'previous_measured' => $pengunjungPembandingTerukur,
                    'series' => $this->chartSeries($range, 'conversion_rate', false),
                    'previous_series' => $this->chartSeries($range, 'conversion_rate', true),
                ],

            ],
            'top_products' => $this->topProducts($range['from'], $range['to']),
            'product_breakdowns' => $this->productPerformanceBreakdowns($range['from'], $range['to']),
            'customers' => $this->customers($range['from'], $range['to']),
            'payment_mix' => $this->paymentMix($range['from'], $range['to']),
        ];
    }

    /**
     * @return array<string, float|int>
     */
    public function metricsFor(Carbon $from, Carbon $to): array
    {
        $base = Order::query()->whereBetween('created_at', [$from, $to]);

        $base = (clone $base)->whereIn('order_status', self::VALID_ORDER_STATUSES);
        $orders = (clone $base)->count();
        $revenueOrders = $this->paidRevenueScope(clone $base);
        $revenue = (float) (clone $revenueOrders)->sum('total_amount');
        // Total transaksi pelanggan mencakup ongkir net + biaya COD. Keduanya
        // diterima toko hanya untuk diteruskan ke J&T, bukan pendapatan toko.
        $shippingNet = (float) (clone $revenueOrders)->sum('shipping_amount');
        $shippingSubsidy = (float) (clone $revenueOrders)->sum('shipping_subsidy_amount');
        $insurance = (float) (clone $revenueOrders)->sum('shipping_insurance_amount');
        // Tagihan J&T: pakai angka ASLI dari J&T (totalFreight, diisi otomatis
        // dari pelacakan resi) bila sudah ada; kalau belum, pakai asumsi
        // checkout supaya pesanan lama tidak berubah. Asumsi = ongkir pembeli +
        // subsidi toko + asuransi, SEBANDING dengan totalFreight yang juga
        // sudah memuat asuransi, supaya tidak terhitung dua kali.
        $actualOngkir = ShippingRecord::actualOngkirByOrder(
            (clone $revenueOrders)->pluck('id')->all()
        );
        $ongkirDasar = 0.0;
        $ongkirSelisih = 0.0;
        foreach ((clone $revenueOrders)->get([
            'id', 'shipping_amount', 'shipping_subsidy_amount', 'shipping_insurance_amount',
        ]) as $shippingRow) {
            $asumsiOngkir = (float) $shippingRow->shipping_amount
                + (float) $shippingRow->shipping_subsidy_amount
                + (float) $shippingRow->shipping_insurance_amount;
            $asliOngkir = $actualOngkir[$shippingRow->id] ?? null;
            $ongkirDasar += $asliOngkir ?? $asumsiOngkir;

            if ($asliOngkir !== null) {
                $ongkirSelisih += $asliOngkir - $asumsiOngkir;
            }
        }
        $shippingRaw = $ongkirDasar;
        $codFees = (float) (clone $revenueOrders)->sum('cod_fee_amount');
        // Komponen pendapatan untuk laporan laba rugi bertingkat. Diambil dari
        // scope yang sama dengan revenue agar jumlah komponen konsisten dengan
        // gross yang dilaporkan.
        $itemsBeforeDiscount = (float) (clone $revenueOrders)->sum('subtotal_amount');
        $productDiscount = (float) (clone $revenueOrders)->sum('discount_amount');
        $voucherDiscount = (float) (clone $revenueOrders)->sum('voucher_discount_amount');
        $revenueOrderIds = (clone $revenueOrders)->pluck('id');

        $units = $revenueOrderIds->isEmpty()
            ? 0
            : (int) OrderItem::query()->whereIn('order_id', $revenueOrderIds)->sum('quantity');

        // Historical identity is read from order_items snapshots, never from live catalog rows.
        // Model dan sub model dipisah karena keduanya dua hal berbeda: satu
        // model dengan dua desain adalah satu model tetapi dua sub model.
        $modelCounts = $revenueOrderIds->isEmpty()
            ? ['models' => 0, 'sub_models' => 0]
            : $this->distinctModelCounts($revenueOrderIds);
        $modelsSold = $modelCounts['models'];
        $subModelsSold = $modelCounts['sub_models'];

        // Produk berbeda yang terjual, dari snapshot. Baris tanpa varian
        // (produk yang dijual tanpa ukuran) tetap dihitung memakai parent_sku,
        // supaya tidak ada produk yang hilang diam diam dari hitungan.
        $productsSold = $revenueOrderIds->isEmpty()
            ? 0
            : $this->distinctProductCount($revenueOrderIds);

        // Harga rata-rata per unit memakai NILAI PRODUK saja, bukan penjualan
        // gross: gross memuat ongkir, biaya COD, dan asuransi sehingga angkanya
        // jadi nilai tagihan per unit, bukan harga produk. Temuan audit 2026-09-20.
        $avgUnitPrice = $units > 0 ? round($itemsBeforeDiscount / $units, 2) : 0.0;

        // Pesanan selesai dihitung dari KAPAN pesanan selesai, bukan kapan
        // pesanan dibuat. Sebelumnya penyaring created_at membuat pesanan yang
        // dibuat bulan lalu dan selesai bulan ini tidak pernah terhitung,
        // padahal labelnya menjanjikan "selesai pada periode ini".
        $completionDates = $this->completionDates();
        $completedOrders = count(array_filter(
            $completionDates,
            fn (Carbon $at): bool => $at->gte($from) && $at->lte($to)
        ));

        // Antrean saat ini, sengaja TANPA penyaring tanggal: labelnya
        // menjanjikan antrean yang sedang menumpuk sekarang. Sebelumnya
        // penyaring created_at plus irisan REVENUE_STATUSES membuat pesanan
        // yang belum dikonfirmasi tidak pernah bisa muncul.
        $openOrders = (int) Order::query()->whereIn('order_status', self::OPEN_STATUSES)->count();
        $dispatchedOrders = (int) Order::query()->where('order_status', 'shipped')->count();

        // Versi terbatas periode, supaya admin tetap bisa melihat berapa
        // pesanan yang DIBUAT pada rentang ini dan masih terbuka. Termasuk
        // awaiting_confirmation, yang sebelumnya selalu hilang.
        $openOrdersInPeriod = (int) Order::query()
            ->whereBetween('created_at', [$from, $to])
            ->whereIn('order_status', self::OPEN_STATUSES)
            ->count();

        $returnCases = OrderReturnCase::query()
            ->where('status', 'completed')
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to])
            ->whereHas('items', fn ($query) => $query->where('returned_quantity', '>', 0))
            ->with(['items.orderItem:id,unit_price'])
            ->get();
        $returnOrders = $returnCases->pluck('order_id')->unique()->count();
        $returnValue = (float) $returnCases->sum(
            fn (OrderReturnCase $case): float => (float) $case->items->sum(
                fn ($item): float => (float) $item->returned_quantity * (float) optional($item->orderItem)->unit_price
            )
        );
        // Refund mencakup SEMUA refund termasuk goodwill, yaitu uang yang
        // kembali ke pembeli walau barangnya tidak dikembalikan. Sengaja tidak
        // memakai filter returned_quantity seperti $returnCases, supaya angka
        // "Refund Diberikan" yang tampil sama dengan pengurang Penjualan
        // Bersih. Keputusan owner 2026-09-20.
        $refundAdjustments = (float) OrderReturnCase::query()
            ->where('status', 'completed')
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to])
            ->sum('refund_amount');
        $returnShippingStore = (float) OrderReturnCase::query()
            ->where('status', 'completed')
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to])
            ->sum('return_shipping_cost');
        // Pesanan ditolak pelanggan sebelum lunas (keputusan owner 2026-09-19):
        // barang kembali ke gudang tanpa restore stok, transaksi dianggap batal.
        // Selama kasus retur berjalan masih dihitung penjualan; setelah retur
        // selesai nilai barang dikeluarkan dari penjualan bersih.
        $refusedOrders = (int) (clone $base)
            ->whereIn('order_status', ['return_in_process', 'return_completed'])
            ->where('payment_status', '!=', 'paid')
            ->count();
        $refusedGoodsValue = (float) (clone $base)
            ->where('order_status', 'return_completed')
            ->where('payment_status', '!=', 'paid')
            ->sum('total_amount');

        // Penjualan Gross adalah seluruh total yang dibayar pelanggan. Ongkir raw dan
        // COD adalah dana titipan untuk J&T; subsidi, refund, ongkir retur toko,
        // dan nilai barang retur ditolak adalah pengurang hasil toko.
        $netRevenue = $revenue - $shippingRaw - $codFees - $refundAdjustments - $returnShippingStore - $refusedGoodsValue;

        // Paket yang tidak diterima pembeli juga meninggalkan BEBAN NYATA di
        // kas: pembeli tidak membayar sepeser pun, tetapi J&T sudah mengantar
        // paket ke alamat pembeli sehingga ongkir kirim tetap ditagih ke toko,
        // dan biaya layanan COD ikut hangus karena tidak ada uang COD yang bisa
        // dipotong. Scope-nya sengaja SAMA dengan refused_goods_value supaya
        // kedua angka bisa direkonsiliasi baris per baris.
        //
        // Angka ini adalah RINCIAN dari pengurang yang sudah tercermin di
        // Penjualan Bersih, bukan pengurang tambahan: nilai barang yang batal
        // sudah dikeluarkan lewat refused_goods_value, sedangkan ongkir dan biaya
        // COD memang tetap keluar sehingga sudah ikut terhitung di shipping_raw
        // dan cod_fee. Jangan kurangkan lagi dari Penjualan Bersih.
        //
        // Ongkir memakai tagihan ASLI J&T bila sudah dilaporkan, kalau belum
        // jatuh ke asumsi checkout. Ongkir KAKI BALIK belum ikut dihitung karena
        // tagihannya belum tercatat otomatis, jadi tidak ada sumber angka yang
        // bisa dipercaya.
        $refusedCostOrders = (clone $base)
            ->where('order_status', 'return_completed')
            ->where('payment_status', '!=', 'paid')
            ->get([
                'id', 'cod_fee_amount',
                'shipping_amount', 'shipping_subsidy_amount', 'shipping_insurance_amount',
            ]);
        $refusedActualOngkir = $refusedCostOrders->isEmpty()
            ? []
            : ShippingRecord::actualOngkirByOrder($refusedCostOrders->pluck('id')->all());

        $refusedShippingBorne = 0.0;
        $refusedCodFeeBorne = 0.0;
        foreach ($refusedCostOrders as $refusedOrder) {
            $asumsiRefused = (float) $refusedOrder->shipping_amount
                + (float) $refusedOrder->shipping_subsidy_amount
                + (float) $refusedOrder->shipping_insurance_amount;
            $refusedShippingBorne += $refusedActualOngkir[$refusedOrder->id] ?? $asumsiRefused;
            $refusedCodFeeBorne += (float) $refusedOrder->cod_fee_amount;
        }
        $refusedBorneCost = $refusedShippingBorne + $refusedCodFeeBorne;
        $refusedBorneCount = $refusedCostOrders->count();

        $returnCounts = $this->returnCounts($from, $to);
        $paymentCounts = $this->paymentCounts($from, $to);
        $cancellationCounts = $this->cancellationCounts($from, $to);

        $visitors = $this->visitorsBetween($from, $to);
        // Jumlah pembeli unik, bukan jumlah pesanan: label metriknya
        // "Pengunjung yang Membeli", jadi satu pelanggan dengan beberapa
        // pesanan tetap dihitung satu orang.
        $buyers = (clone $revenueOrders)
            ->whereNotNull('customer_phone')
            ->where('customer_phone', '!=', '')
            ->distinct()
            ->count('customer_phone');
        $conversionRate = $visitors > 0 ? round(($buyers / $visitors) * 100, 2) : 0.0;

        [$newCustomers, $repeatCustomers] = $this->customerCounts($from, $to);
        $shippingCost = $this->shippingCostCounts($from, $to);

        return [
            'orders' => $orders,
            'revenue' => round($revenue, 2),
            'gross_revenue' => round($revenue, 2),
            'items_before_discount' => round($itemsBeforeDiscount, 2),
            'product_discount' => round($productDiscount, 2),
            'voucher_discount' => round($voucherDiscount, 2),
            'insurance' => round($insurance, 2),
            'shipping_raw' => round($shippingRaw, 2),
            'jnt_ongkir_actual' => round(array_sum($actualOngkir), 2),
            'jnt_ongkir_selisih' => round($ongkirSelisih, 2),
            'jnt_ongkir_recorded_orders' => count($actualOngkir),
            'shipping_paid_by_customer' => round($shippingNet, 2),
            'shipping_subsidy' => round($shippingSubsidy, 2),
            'cod_fee' => round($codFees, 2),
            'refund_adjustments' => round($refundAdjustments, 2),
            'return_shipping_store' => round($returnShippingStore, 2),
            'net_revenue' => round($netRevenue, 2),
            'units' => $units,
            'models_sold' => $modelsSold,
            'sub_models_sold' => $subModelsSold,
            'products_sold' => $productsSold,
            'avg_unit_price' => $avgUnitPrice,
            'visitors' => $visitors,
            // Tanggal paling awal data kunjungan yang bisa dipercaya, supaya
            // halaman bisa menandai rentang yang mencampur data lama tercemar.
            'visitors_available_from' => $this->visitorsAvailableFrom(),
            'buyers' => $buyers,
            'conversion_rate' => $conversionRate,
            'new_customers' => $newCustomers,
            'repeat_customers' => $repeatCustomers,
            'completed_orders' => $completedOrders,
            'open_orders' => $openOrders,
            'open_orders_in_period' => $openOrdersInPeriod,
            'dispatched_orders' => $dispatchedOrders,
            'return_orders' => $returnOrders,
            'return_value' => round($returnValue, 2),
            'avg_confirm_hours' => $this->avgConfirmHours($from, $to),
            'avg_process_days' => $this->avgProcessDays($from, $to),

            // Task 1 KPI baru (additive)
            'aov' => $orders > 0 ? round($revenue / $orders, 2) : 0.0,
            'returns_created' => $returnCounts['created'],
            'returns_open' => $returnCounts['open'],
            'returns_completed' => $returnCounts['completed'],
            'refund_given' => round($returnCounts['refund'], 2),
            'return_rate_created' => $orders > 0 ? round(($returnCounts['created'] / $orders) * 100, 2) : 0.0,
            'return_rate_completed' => $completedOrders > 0 ? round(($returnCounts['completed'] / $completedOrders) * 100, 2) : 0.0,
            'refused_orders' => $refusedOrders,
            'refused_goods_value' => round($refusedGoodsValue, 2),
            'refused_borne_count' => $refusedBorneCount,
            'refused_shipping_cost' => round($refusedShippingBorne, 2),
            'refused_cod_fee' => round($refusedCodFeeBorne, 2),
            'refused_borne_cost' => round($refusedBorneCost, 2),
            'repeat_order_rate' => $this->repeatOrderRate($newCustomers, $repeatCustomers),

            // Ongkir retur ditanggung toko (biaya operasional, bukan pengurang omzet)
            'return_shipping_cost_total' => round($shippingCost['total'], 2),
            'return_shipping_cost_cases' => $shippingCost['cases'],
            'return_shipping_cost_list' => $shippingCost['list'],

            // Task 2 KPI baru (additive)
            'payments_received' => round($paymentCounts['received'], 2),
            'cod_paid' => round($paymentCounts['cod'], 2),
            'payment_pending_count' => $paymentCounts['pending_count'],
            'cod_pending_amount' => round($paymentCounts['cod_pending_amount'] ?? 0, 2),
            'cod_pending_count' => (int) ($paymentCounts['cod_pending_count'] ?? 0),
            'cod_pending_in_period_amount' => round($paymentCounts['cod_pending_in_period_amount'] ?? 0, 2),
            'cod_pending_in_period_count' => (int) ($paymentCounts['cod_pending_in_period_count'] ?? 0),
            'cancelled_orders' => $cancellationCounts['total'],
            'cancelled_value' => $cancellationCounts['value'],
            'cancelled_by_customer' => $cancellationCounts['customer'],
            'cancelled_by_store' => $cancellationCounts['store'],
            // Pembilang dan penyebut kini dari populasi yang sama: pesanan yang
            // DIBUAT pada periode ini. Sebelumnya pembilang memuat pembatalan
            // pesanan lama, sehingga rasionya bisa melewati 100 persen.
            'cancellation_rate' => $orders + $cancellationCounts['in_period'] > 0
                ? round(($cancellationCounts['in_period'] / ($orders + $cancellationCounts['in_period'])) * 100, 2)
                : 0.0,
        ];
    }

    /**
     * @return list<array{bucket: string, label: string, value: float}>
     */
    /**
     * KPI retur (Task 1). returns_open adalah SNAPSHOT current (kasus bertatus 'open'
     * saat laporan dibuat), bukan histori akhir periode.
     *
     * @return array{
     *   created: int, open: int, completed: int, refund: float
     * }
     */
    protected function returnCounts(Carbon $from, Carbon $to): array
    {
        $created = (int) OrderReturnCase::query()
            ->whereBetween('created_at', [$from, $to])
            ->count();

        // Snapshot current: semua kasus yang masih status 'open' sekarang.
        $open = (int) OrderReturnCase::query()
            ->where('status', 'open')
            ->count();

        $completedCases = OrderReturnCase::query()
            ->where('status', 'completed')
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$from, $to])
            ->get();

        $completed = $completedCases->count();
        $refund = (float) $completedCases->sum('refund_amount');

        return [
            'created' => $created,
            'open' => $open,
            'completed' => $completed,
            'refund' => $refund,
        ];
    }

    /**
     * KPI pembayaran (Task 2). Event date = payments.paid_at.
     * payments_received & cod_paid HANYA status=completed (tidak termasuk refunded/cancelled/pending).
     *
     * @return array{received: float, cod: float, pending_count: int}
     */
    protected function paymentCounts(Carbon $from, Carbon $to): array
    {
        $completed = Payment::query()
            ->where('status', 'completed')
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$from, $to])
            ->get();

        $received = (float) $completed->sum('amount');

        // COD: hanya payment record method=cod yang completed (pakai ledger, bukan sum orders).
        $cod = (float) $completed->where('payment_method', 'cod')->sum('amount');

        // Perbaikan 2026-09-02: pending hanya non-COD pada order aktif. COD memang
        // lunas saat paket tiba (pending-nya bisnis normal), dan order cancelled
        // tidak lagi relevan ditindaklanjuti.
        $pendingCount = (int) Payment::query()
            ->where('status', 'pending')
            ->where('payment_method', '!=', 'cod')
            ->whereHas('order', fn ($q) => $q->whereIn('order_status', self::OPEN_STATUSES))
            ->count();

        $codPendingQuery = Payment::query()
            ->where('status', 'pending')
            ->where('payment_method', 'cod')
            ->whereHas('order', fn ($q) => $q->whereIn('order_status', self::REVENUE_STATUSES));

        $codPendingAmount = (float) (clone $codPendingQuery)->sum('amount');
        $codPendingCount = (int) (clone $codPendingQuery)->count();

        // Versi terbatas periode: order COD yang dibuat dalam rentang dan
        // uangnya belum cair. Dipisah dari snapshot semua waktu supaya tidak
        // dicampur dengan angka periode di panel arus kas.
        $codPendingInPeriod = (float) (clone $codPendingQuery)
            ->whereHas('order', fn ($q) => $q->whereBetween('created_at', [$from, $to]))
            ->sum('amount');
        $codPendingInPeriodCount = (int) (clone $codPendingQuery)
            ->whereHas('order', fn ($q) => $q->whereBetween('created_at', [$from, $to]))
            ->count();

        return [
            'received' => $received,
            'cod' => $cod,
            'pending_count' => $pendingCount,
            'cod_pending_amount' => $codPendingAmount,
            'cod_pending_count' => $codPendingCount,
            'cod_pending_in_period_amount' => $codPendingInPeriod,
            'cod_pending_in_period_count' => $codPendingInPeriodCount,
        ];
    }

    public function seriesWithComparison(Carbon $from, Carbon $to, Carbon $prevFrom, Carbon $prevTo, string $granularity, string $metric): array
    {
        $current = $this->series($from, $to, $granularity, $metric);
        $previous = $this->series($prevFrom, $prevTo, $granularity, $metric);

        $prevCount = count($previous);

        return collect($current)->map(function (array $item, int $idx) use ($previous, $prevCount) {
            $prevItem = $idx < $prevCount ? $previous[$idx] : null;

            return [
                'bucket' => $item['bucket'],
                'label' => $item['label'],
                'value' => $item['value'],
                'previous_value' => $prevItem['value'] ?? 0.0,
                'previous_label' => $prevItem['label'] ?? null,
            ];
        })->values()->all();
    }

    public function series(Carbon $from, Carbon $to, string $granularity, string $metric): array
    {
        if ($metric === 'visitors') {
            $buckets = $this->emptyBuckets($from, $to, $granularity);
            $rows = PerformanceVisitorEvent::query()
                ->selectRaw($this->bucketSelect('visited_at', $granularity).' as bucket')
                ->selectRaw('COUNT(DISTINCT visitor_hash) as value')
                ->whereBetween('visited_at', [$from, $to])
                ->groupBy('bucket')
                ->pluck('value', 'bucket');

            // Cadangan untuk riwayat pengunjung sebelum tabel event ada. Dua
            // pagar dipasang di sini:
            //
            // 1. Metrik lama bersatuan HARI (metric_date berupa tanggal), jadi
            //    ia hanya dipakai untuk hari yang seluruhnya berada SEBELUM era
            //    event. Dulu bacaannya memakai whereBetween tanggal, sehingga
            //    jendela yang terpotong di tengah hari tetap menarik satu hari
            //    penuh dan nilainya berbeda dari angka Pembanding yang dihitung
            //    visitorsBetween() atas jendela sempit. Batasnya kini disamakan
            //    dengan visitorsBetween() supaya sumber kedua angka itu identik.
            // 2. Skala Per Jam tidak pernah memakai metrik harian: menurunkannya
            //    diam-diam pernah membuat grafik hanya bergambar satu titik.
            $firstEventDay = $this->firstVisitorEventDay();

            if ($granularity !== 'hour' && ($firstEventDay === null || $from->lt($firstEventDay))) {
                $legacyEnd = $firstEventDay !== null && $firstEventDay->lt($to)
                    ? $firstEventDay->copy()->subSecond()
                    : $to;

                if ($from->lte($legacyEnd)) {
                    $legacy = PerformanceMetric::query()
                        ->selectRaw($this->bucketSelect('metric_date', $granularity).' as bucket')
                        ->selectRaw('SUM(metric_value) as value')
                        ->where('metric_name', 'storefront_unique_visitors')
                        ->whereBetween('metric_date', [$from->toDateString(), $legacyEnd->toDateString()])
                        ->groupBy('bucket')
                        ->pluck('value', 'bucket');

                    foreach ($legacy as $bucketKey => $value) {
                        $rows[$bucketKey] = (float) ($rows[$bucketKey] ?? 0) + (float) $value;
                    }
                }
            }

            return collect($buckets)->map(function (array $bucket) use ($rows) {
                return [
                    'bucket' => $bucket['key'],
                    'label' => $bucket['label'],
                    'value' => round((float) ($rows[$bucket['key']] ?? 0), 2),
                ];
            })->values()->all();
        }

        $buckets = $this->emptyBuckets($from, $to, $granularity);

        if ($metric === 'conversion_rate') {
            // Rasio pesanan (paid/COD lunas) dibanding pengunjung unik per bucket, dalam %.
            $orderRows = Order::query()
                ->selectRaw($this->bucketSelect('created_at', $granularity).' as bucket')
                ->selectRaw('COUNT(*) as value')
                ->whereBetween('created_at', [$from, $to])
                ->whereRaw($this->paidRevenueStatusSql())
                ->groupBy('bucket')
                ->pluck('value', 'bucket');
            $visitorRows = PerformanceVisitorEvent::query()
                ->selectRaw($this->bucketSelect('visited_at', $granularity).' as bucket')
                ->selectRaw('COUNT(DISTINCT visitor_hash) as value')
                ->whereBetween('visited_at', [$from, $to])
                ->groupBy('bucket')
                ->pluck('value', 'bucket');

            return collect($buckets)->map(function (array $bucket) use ($orderRows, $visitorRows) {
                $visitors = (float) ($visitorRows[$bucket['key']] ?? 0);
                $orders = (float) ($orderRows[$bucket['key']] ?? 0);

                return [
                    'bucket' => $bucket['key'],
                    'label' => $bucket['label'],
                    'value' => $visitors > 0 ? round(($orders / $visitors) * 100, 2) : 0.0,
                ];
            })->values()->all();
        }

        if ($metric === 'products') {
            // Produk berbeda yang terjual per bucket. Aturannya WAJIB sama
            // dengan products_sold pada metricsFor, kalau tidak jumlah titik
            // seri tidak lagi sama dengan total di kartu. Baris tanpa
            // variant_sku jatuh ke parent_sku supaya produk yang dijual tanpa
            // varian ukuran tetap terhitung.
            $produkRef = "COALESCE(NULLIF(TRIM(order_items.variant_sku), ''), "
                ."NULLIF(TRIM(order_items.parent_sku), ''), NULLIF(TRIM(order_items.name), ''), '')";
            $rows = OrderItem::query()
                ->selectRaw($this->bucketSelect('orders.created_at', $granularity).' as bucket')
                ->selectRaw("COUNT(DISTINCT {$produkRef}) as value")
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->whereBetween('orders.created_at', [$from, $to])
                ->whereRaw($this->paidRevenueStatusSql('orders'))
                ->havingRaw("COUNT(DISTINCT {$produkRef}) > 0")
                ->groupBy('bucket')
                ->pluck('value', 'bucket');
        } elseif ($metric === 'units') {
            $rows = OrderItem::query()
                ->selectRaw($this->bucketSelect('orders.created_at', $granularity).' as bucket')
                ->selectRaw('SUM(order_items.quantity) as value')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->whereBetween('orders.created_at', [$from, $to])
                ->whereRaw($this->paidRevenueStatusSql('orders'))
                ->groupBy('bucket')
                ->pluck('value', 'bucket');
        } elseif ($metric === 'revenue') {
            $rows = Order::query()
                ->selectRaw($this->bucketSelect('created_at', $granularity).' as bucket')
                ->selectRaw('SUM(total_amount) as value')
                ->whereBetween('created_at', [$from, $to])
                ->whereRaw($this->paidRevenueStatusSql())
                ->groupBy('bucket')
                ->pluck('value', 'bucket');
        } else {
            $rows = Order::query()
                ->selectRaw($this->bucketSelect('created_at', $granularity).' as bucket')
                ->selectRaw('COUNT(*) as value')
                ->whereBetween('created_at', [$from, $to])
                ->whereRaw($this->paidRevenueStatusSql())
                ->groupBy('bucket')
                ->pluck('value', 'bucket');
        }

        return collect($buckets)->map(function (array $bucket) use ($rows) {
            return [
                'bucket' => $bucket['key'],
                'label' => $bucket['label'],
                'value' => round((float) ($rows[$bucket['key']] ?? 0), 2),
            ];
        })->values()->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    /**
     * KPI pembatalan (Task 2). Berbasis event_logs:
     * event_type='order_status_changed', payload.order_status='cancelled',
     * timestamp = event_logs.created_at, actor = created_by_user_id.
     * Dedupe per entity_id (status cancelled terminal -> maks 1, guard retry).
     *
     * @return array{total: int, customer: int, store: int, value: float}
     */
    protected function cancellationCounts(Carbon $from, Carbon $to): array
    {
        $events = EventLog::query()
            ->where('event_type', 'order_status_changed')
            ->where('entity_type', 'order')
            ->whereBetween('created_at', [$from, $to])
            ->get()
            ->filter(function (EventLog $event): bool {
                return (string) data_get($event->payload, 'order_status') === 'cancelled';
            });

        $dedup = $events->unique('entity_id');

        $customer = $dedup->filter(fn (EventLog $e): bool => $e->created_by_user_id === null)->count();
        $store = $dedup->filter(fn (EventLog $e): bool => $e->created_by_user_id !== null)->count();

        // Nilai rupiah pesanan batal (owner 2026-09-04): SUM(total_amount) order
        // yang dibatalkan pada periode - dedupe per order sama dengan count.
        $orderIds = $dedup->pluck('entity_id')->all();
        $cancelledValue = (float) Order::query()
            ->whereIn('id', $orderIds)
            ->sum('total_amount');

        // Pembatalan atas pesanan yang DIBUAT pada periode yang sama. Dipakai
        // sebagai pembilang rasio supaya pembilang berada di dalam populasi
        // penyebut (pesanan yang dibuat periode itu), sehingga rasionya tidak
        // bisa melewati 100 persen karena pembatalan pesanan lama.
        $inPeriod = $orderIds === []
            ? 0
            : (int) Order::query()
                ->whereIn('id', $orderIds)
                ->whereBetween('created_at', [$from, $to])
                ->count();

        return [
            'total' => $dedup->count(),
            'customer' => $customer,
            'store' => $store,
            'value' => round($cancelledValue, 2),
            'in_period' => $inPeriod,
        ];
    }

    /**
     * Breakdown performa produk (Task 3) - ADDITIVE, tanpa mengubah top_products.
     *
     * - most_viewed : ranking performance_metrics product_views (metric_date in period).
     * - most_clicked: ranking product_clicks.
     * - best_sellers: SUM(order_items.quantity) dari order REVENUE_STATUSES (created_at in period).
     *
     * Produk di-load batch (whereIn id) + mainImage -> tanpa N+1.
     *
     * @return array{
     *   most_viewed: list<array>,
     *   most_clicked: list<array>,
     *   best_sellers: list<array>
     * }
     */
    public function productPerformanceBreakdowns(Carbon $from, Carbon $to, int $limit = 50): array
    {
        $dateFrom = $from->toDateString();
        $dateTo = $to->toDateString();

        // --- engagement dari performance_metrics ---
        $rows = PerformanceMetric::query()
            ->whereIn('metric_name', ['product_views', 'product_clicks'])
            ->whereDate('metric_date', '>=', $dateFrom)
            ->whereDate('metric_date', '<=', $dateTo)
            ->get(['metric_name', 'metric_value', 'context']);

        $agg = [];
        foreach ($rows as $row) {
            $productId = (int) data_get($row->context, 'product_id', 0);
            if ($productId <= 0) {
                continue;
            }
            if (! isset($agg[$productId])) {
                $agg[$productId] = ['views' => 0.0, 'clicks' => 0.0];
            }
            if ($row->metric_name === 'product_views') {
                $agg[$productId]['views'] += (float) $row->metric_value;
            } else {
                $agg[$productId]['clicks'] += (float) $row->metric_value;
            }
        }

        $viewRank = collect($agg)->mapWithKeys(fn ($v, $k) => [$k => (int) round($v['views'])])
            ->sort()->reverse()->take($limit);
        $clickRank = collect($agg)->mapWithKeys(fn ($v, $k) => [$k => (int) round($v['clicks'])])
            ->sort()->reverse()->take($limit);

        // --- best sellers dari order_items ---
        $bestRows = OrderItem::query()
            ->select(['order_items.product_id', 'order_items.parent_sku', 'order_items.name',
                DB::raw('SUM(order_items.quantity) as units'),
                DB::raw('SUM(order_items.line_total) as revenue'),
                DB::raw('COUNT(DISTINCT order_items.order_id) as order_count')])
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereBetween('orders.created_at', [$from, $to])
            ->whereRaw($this->paidRevenueStatusSql('orders'))
            ->groupBy('order_items.product_id', 'order_items.parent_sku', 'order_items.name')
            ->orderByDesc('units')
            ->limit($limit)
            ->get();

        // --- batch load produk utk ranking (views/clicks/sellers) ---
        $engagementIds = $viewRank->keys()->merge($clickRank->keys());
        $bestProductIds = collect($bestRows)->pluck('product_id')->filter();
        $bestSkus = collect($bestRows)->pluck('parent_sku')->filter();

        $allProductIds = $engagementIds->merge($bestProductIds)->unique()->values()->all();

        $products = $allProductIds === []
            ? collect()
            : Product::query()->whereIn('id', $allProductIds)->with('mainImage')->get()->keyBy('id');

        $productsBySku = $bestSkus->isEmpty()
            ? collect()
            : Product::query()->whereIn('parent_sku', $bestSkus->all())->with('mainImage')->get()->keyBy('parent_sku');

        $bestSellers = collect($bestRows)->map(function ($row) use ($products, $productsBySku) {
            $p = $products->get($row->product_id) ?? $productsBySku->get($row->parent_sku);

            return [
                'product_id' => (int) ($row->product_id ?? $p?->id ?? 0),
                'parent_sku' => $row->parent_sku,
                'name' => $row->name,
                'image' => $p?->mainImage?->urlFor('thumb') ?? $p?->mainImage?->urlFor('card'),
                'units' => (int) $row->units,
                'revenue' => round((float) $row->revenue, 2),
                'order_count' => (int) $row->order_count,
            ];
        })->values()->all();

        $makeEngagement = function (array $ids, array $agg) use ($products): array {
            $out = [];
            foreach ($ids as $productId) {
                $p = $products->get($productId);
                if (! $p) {
                    continue;
                }
                $views = (int) round($agg[$productId]['views'] ?? 0);
                $clicks = (int) round($agg[$productId]['clicks'] ?? 0);
                $out[] = [
                    'product_id' => $productId,
                    'parent_sku' => $p->parent_sku,
                    'name' => $p->name,
                    'image' => $p->mainImage?->urlFor('thumb') ?? $p->mainImage?->urlFor('card'),
                    'views' => $views,
                    'clicks' => $clicks,
                    'total' => $views + $clicks,
                ];
            }

            return $out;
        };

        return [
            'most_viewed' => $makeEngagement($viewRank->keys()->all(), $agg),
            'most_clicked' => $makeEngagement($clickRank->keys()->all(), $agg),
            'best_sellers' => $bestSellers,
        ];
    }

    public function topProducts(Carbon $from, Carbon $to, int $limit = 50): array
    {
        $rows = OrderItem::query()
            ->select([
                'order_items.product_id',
                'order_items.parent_sku',
                'order_items.name',
                DB::raw('SUM(order_items.quantity) as units'),
                DB::raw('SUM(order_items.line_total) as revenue'),
                DB::raw('COUNT(DISTINCT order_items.order_id) as order_count'),
            ])
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereBetween('orders.created_at', [$from, $to])
            ->whereRaw($this->paidRevenueStatusSql('orders'))
            ->groupBy('order_items.product_id', 'order_items.parent_sku', 'order_items.name')
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get();

        $productIds = $rows->pluck('product_id')->filter()->unique()->all();
        $skus = $rows->pluck('parent_sku')->filter()->unique()->all();

        $productsById = $productIds === []
            ? collect()
            : Product::query()->whereIn('id', $productIds)->with('mainImage')->get()->keyBy('id');

        $productsBySku = $skus === []
            ? collect()
            : Product::query()->whereIn('parent_sku', $skus)->with('mainImage')->get()->keyBy('parent_sku');

        return $rows->map(function ($row) use ($productsById, $productsBySku) {
            $p = $productsById->get($row->product_id) ?? $productsBySku->get($row->parent_sku);

            return [
                'parent_sku' => $row->parent_sku,
                'name' => $row->name,
                'image' => $p?->mainImage?->urlFor('thumb') ?? $p?->mainImage?->urlFor('card'),
                'units' => (int) $row->units,
                'revenue' => round((float) $row->revenue, 2),
                'order_count' => (int) $row->order_count,
            ];
        })->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function customers(Carbon $from, Carbon $to, int $limit = 50): array
    {
        return Order::query()
            ->select([
                'customer_phone',
                DB::raw('MAX(customer_name) as customer_name'),
                DB::raw('COUNT(*) as order_count'),
                DB::raw('SUM(CASE WHEN '.$this->paidRevenueStatusSql().' THEN total_amount ELSE 0 END) as total_spent'),
                DB::raw('MAX(created_at) as last_order_at'),
            ])
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('customer_phone')
            ->groupBy('customer_phone')
            ->orderByDesc('total_spent')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'customer_name' => $row->customer_name,
                'customer_phone' => $row->customer_phone,
                'order_count' => (int) $row->order_count,
                'total_spent' => round((float) $row->total_spent, 2),
                'last_order_at' => optional($row->last_order_at)?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * @return list<array{method: string, count: int, revenue: float}>
     */
    public function paymentMix(Carbon $from, Carbon $to): array
    {
        return Order::query()
            ->select([
                'payment_method',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(total_amount) as revenue'),
            ])
            ->whereBetween('created_at', [$from, $to])
            ->whereRaw($this->paidRevenueStatusSql())
            ->groupBy('payment_method')
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($row) => [
                'method' => (string) $row->payment_method,
                'count' => (int) $row->count,
                'revenue' => round((float) $row->revenue, 2),
            ])
            ->all();
    }

    /**
     * Catat page view storefront (unique visitor per session / hari).
     */
    public function trackPageView(string $sessionId): void
    {
        $now = now();
        $today = $now->toDateString();
        $visitorHash = sha1($sessionId);

        $views = PerformanceMetric::query()->firstOrCreate(
            [
                'metric_date' => $today,
                'metric_name' => 'storefront_page_views',
                'context_hash' => PerformanceMetric::hashContext(null),
            ],
            ['metric_value' => 0, 'context' => null, 'created_at' => $now]
        );
        $views->increment('metric_value');

        // The unique key is database-backed so analytics remains correct across workers.
        $event = PerformanceVisitorEvent::query()->firstOrCreate(
            ['visitor_hash' => $visitorHash, 'visit_date' => $today],
            ['visited_at' => $now]
        );
        $unique = PerformanceMetric::query()->firstOrCreate(
            [
                'metric_date' => $today,
                'metric_name' => 'storefront_unique_visitors',
                'context_hash' => PerformanceMetric::hashContext(null),
            ],
            ['metric_value' => 0, 'context' => null, 'created_at' => $now]
        );
        if ($event->wasRecentlyCreated || (int) $unique->metric_value === 0) {
            $unique->increment('metric_value');
        }
    }

    /**
     * Tanggal paling awal data kunjungan yang layak dipercaya, atau null bila
     * belum ada sama sekali. Dipakai halaman untuk menandai cakupan periode.
     */
    protected function visitorsAvailableFrom(): ?string
    {
        $awal = PerformanceVisitorEvent::query()->min('visited_at');

        return $awal === null ? null : Carbon::parse($awal)->toDateString();
    }

    /**
     * Pengunjung unik sebagai JUMLAH harian, bukan distinct sepanjang rentang.
     *
     * ADR-015 menetapkan satu pengunjung = satu sesi per hari, jadi rentang
     * dihitung sebagai penjumlahan pengunjung unik tiap hari. Memakai distinct
     * sepanjang rentang membuat angka kartu tidak pernah sama dengan total
     * grafik tren yang menjumlah per titik (temuan audit 2026-09-20).
     */
    protected function dailyUniqueVisitors(Carbon $from, Carbon $to): int
    {
        return (int) PerformanceVisitorEvent::query()
            ->whereBetween('visited_at', [$from, $to])
            ->selectRaw('COUNT(DISTINCT visitor_hash) as total')
            ->groupByRaw('DATE(visited_at)')
            ->pluck('total')
            ->sum();
    }

    protected function visitorsBetween(Carbon $from, Carbon $to): int
    {
        // Era event dimulai dari scan pertama pada tabel visitor events.
        // Sebelum tanggal itu satu-satunya sumber adalah metrik harian
        // (storefront_unique_visitors), jadi rentang yang menyeberang batas
        // era harus menggabungkan keduanya, bukan membuang salah satu.
        $firstEventDate = PerformanceVisitorEvent::query()
            ->min('visited_at');

        if ($firstEventDate === null) {
            return (int) PerformanceMetric::query()
                ->where('metric_name', 'storefront_unique_visitors')
                ->whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])
                ->sum('metric_value');
        }

        $firstEventDay = Carbon::parse($firstEventDate)->startOfDay();

        // Rentang sepenuhnya sebelum era event: metrik harian saja.
        if ($to->lt($firstEventDay)) {
            return (int) PerformanceMetric::query()
                ->where('metric_name', 'storefront_unique_visitors')
                ->whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])
                ->sum('metric_value');
        }

        // Rentang sepenuhnya di dalam era event: events saja.
        if (! $from->lt($firstEventDay)) {
            return $this->dailyUniqueVisitors($from, $to);
        }

        // Rentang menyeberang: pengunjung sebelum batas dihitung dari metrik
        // harian (identitas lintas sumber tidak dapat digabung), sesudahnya
        // dari event. Disediakan sebagai angka gabungan dua sumber.
        $legacyDays = (int) PerformanceMetric::query()
            ->where('metric_name', 'storefront_unique_visitors')
            ->whereDate('metric_date', '>=', $from->toDateString())
            ->whereDate('metric_date', '<', $firstEventDay->toDateString())
            ->sum('metric_value');
        $eventVisitors = $this->dailyUniqueVisitors($firstEventDay, $to);

        return $legacyDays + $eventVisitors;
    }

    /**
     * @return array{0: int, 1: int}
     */
    /**
     * Rasio pembelian ulang = repeat / unique valid customers * 100.
     * $unique = new + repeat (keduanya dari customerCounts: order valid, exclude cancelled).
     * Normalisasi nomor tetap via customerCounts (dimana pun raw customer_phone dipakai).
     */
    /**
     * Ongkir retur yang ditanggung toko (biaya operasional, bukan pengurang omzet).
     * Dihitung dari kasus retur yang selesai (completed) dalam periode.
     *
     * @return array{total: float, cases: int, list: list<array<string, mixed>>}
     */
    protected function shippingCostCounts(Carbon $from, Carbon $to): array
    {
        $rows = OrderReturnCase::query()
            ->with('order:id,order_number')
            ->whereBetween('completed_at', [$from, $to])
            ->where('status', 'completed')
            ->where('return_shipping_cost', '>', 0)
            ->orderBy('completed_at')
            ->get();

        $total = (float) $rows->sum('return_shipping_cost');

        return [
            'total' => $total,
            'cases' => $rows->count(),
            'list' => $rows->map(fn ($case) => [
                'order_id' => $case->order_id,
                'order_number' => $case->order?->order_number,
                'completed_at' => $case->completed_at?->toIso8601String(),
                'fault_party' => $case->fault_party,
                'reason' => $case->reason,
                'return_shipping_cost' => (float) $case->return_shipping_cost,
            ])->all(),
        ];
    }

    protected function repeatOrderRate(int $newCustomers, int $repeatCustomers): float
    {
        $unique = $newCustomers + $repeatCustomers;

        return $unique > 0 ? round(($repeatCustomers / $unique) * 100, 2) : 0.0;
    }

    protected function customerCounts(Carbon $from, Carbon $to): array
    {
        // KPI-011: 'customer' punya order VALID (konsisten dgn KPI-003), exclude pending/cancelled.
        $phonesInPeriod = Order::query()
            ->whereBetween('created_at', [$from, $to])
            ->whereIn('order_status', self::VALID_ORDER_STATUSES)
            ->whereNotNull('customer_phone')
            ->distinct()
            ->pluck('customer_phone');

        if ($phonesInPeriod->isEmpty()) {
            return [0, 0];
        }

        $priorPhones = Order::query()
            ->whereIn('customer_phone', $phonesInPeriod)
            ->where('created_at', '<', $from)
            ->where('order_status', '!=', 'cancelled')
            ->distinct()
            ->pluck('customer_phone');

        $repeat = $priorPhones->count();
        $new = $phonesInPeriod->diff($priorPhones)->count();

        return [$new, $repeat];
    }

    /**
     * Waktu transisi status paling awal untuk sekumpulan pesanan, dalam SATU
     * kueri.
     *
     * Menerima $fromStatus tunggal ATAU array (fallback legacy: pesanan lama
     * memakai 'pending_payment', pesanan baru 'awaiting_confirmation').
     *
     * Sebelumnya tiap pesanan menanyakan riwayatnya sendiri lewat
     * statusEventAt(), sehingga jumlah kueri tumbuh sebanding jumlah pesanan:
     * terukur 188 kueri untuk 10 pesanan pada periode "semua waktu". Sekarang
     * riwayat seluruh pesanan periode diambil sekali, lalu dipetakan di PHP.
     *
     * @param  list<int|string>  $orderIds
     * @param  string|list<string>  $fromStatus
     * @return array<int, Carbon> id pesanan => waktu transisi
     */
    protected function statusEventsFor(array $orderIds, string|array $fromStatus, string $toStatus): array
    {
        if ($orderIds === []) {
            return [];
        }

        $fromStatuses = (array) $fromStatus;
        $hasil = [];

        foreach (EventLog::query()
            ->where('entity_type', 'order')
            ->whereIn('entity_id', array_map('strval', $orderIds))
            ->where('event_type', 'order_status_changed')
            ->orderBy('created_at')
            ->get() as $event) {
            if (! in_array((string) data_get($event->payload, 'from'), $fromStatuses, true)) {
                continue;
            }

            if ((string) data_get($event->payload, 'order_status') !== $toStatus) {
                continue;
            }

            $id = (int) $event->entity_id;
            if (! isset($hasil[$id]) || $event->created_at->lt($hasil[$id])) {
                $hasil[$id] = $event->created_at;
            }
        }

        return $hasil;
    }

    /** Resi pertama tiap pesanan pada sekumpulan pesanan, dalam SATU kueri. */
    protected function firstWaybillAtFor(array $orderIds): array
    {
        if ($orderIds === []) {
            return [];
        }

        $hasil = [];
        foreach (ShippingRecord::query()
            ->whereIn('order_id', $orderIds)
            ->whereNotNull('waybill_number')
            ->orderBy('created_at')
            ->get(['order_id', 'created_at']) as $resi) {
            $id = (int) $resi->order_id;
            if (! isset($hasil[$id])) {
                $hasil[$id] = $resi->created_at;
            }
        }

        return $hasil;
    }

    protected function avgConfirmHours(Carbon $from, Carbon $to): float
    {
        $orders = Order::query()->whereBetween('created_at', [$from, $to])->get(['id', 'created_at']);
        if ($orders->isEmpty()) {
            return 0.0;
        }

        $dikonfirmasi = $this->statusEventsFor(
            $orders->pluck('id')->all(),
            ['awaiting_confirmation', 'pending_payment'],
            'processing'
        );

        $durations = $orders->map(function (Order $order) use ($dikonfirmasi): ?float {
            $confirmedAt = $dikonfirmasi[(int) $order->id] ?? null;

            return $confirmedAt ? max(0, $order->created_at->diffInMinutes($confirmedAt) / 60) : null;
        })->filter(fn (?float $value): bool => $value !== null);

        return $durations->isEmpty() ? 0.0 : (float) $durations->avg();
    }

    protected function avgProcessDays(Carbon $from, Carbon $to): float
    {
        $orders = Order::query()->whereBetween('created_at', [$from, $to])->get(['id']);
        if ($orders->isEmpty()) {
            return 0.0;
        }

        $ids = $orders->pluck('id')->all();
        $diproses = $this->statusEventsFor($ids, ['awaiting_confirmation', 'pending_payment'], 'processing');
        $dariIssue = $this->statusEventsFor($ids, 'issue', 'processing');
        $resi = $this->firstWaybillAtFor($ids);

        $durations = $orders->map(function (Order $order) use ($diproses, $dariIssue, $resi): ?float {
            $id = (int) $order->id;
            $processingAt = $diproses[$id] ?? $dariIssue[$id] ?? null;
            if (! $processingAt) {
                return null;
            }

            $waybillAt = $resi[$id] ?? null;

            return $waybillAt
                ? max(0, $processingAt->diffInMinutes(Carbon::parse($waybillAt)) / (60 * 24))
                : null;
        })->filter(fn (?float $value): bool => $value !== null);

        return $durations->isEmpty() ? 0.0 : (float) $durations->avg();
    }

    /**
     * @return array{key: string, label: string, value: float|int, previous: float|int, change_percent: float|null, format: string}
     */

    /**
     * Penanda cakupan yang ditempelkan ke label metrik.
     *
     * ADR-015 bagian 2b mewajibkan label metrik kondisi-saat-ini menyebut
     * cakupannya. Penanda ditempel di sini, bukan di kartu, supaya ikut terbawa
     * ke semua permukaan yang membaca label: kartu, drawer, dan ekspor XLSX.
     */
    protected function scopeMarker(string $key): string
    {
        $basis = self::METRIC_BASIS[$key] ?? null;
        if (($basis['scope'] ?? null) !== 'current') {
            return '';
        }

        return ' ('.($basis['marker'] ?? 'kondisi saat ini').')';
    }

    /**
     * Peta cakupan seluruh metrik untuk halaman, termasuk dua angka kas COD
     * yang tidak tampil sebagai KPI kartu tetapi punya cakupan sendiri.
     *
     * @return array<string, array{scope: string, anchor: string|null, marker: string|null, unit: string|null}>
     */
    public function metricBasisMap(): array
    {
        $peta = [];
        foreach (self::METRIC_BASIS as $key => $basis) {
            $peta[$key] = [
                'scope' => $basis['scope'],
                'anchor' => $basis['anchor'],
                'marker' => $basis['scope'] === 'current'
                    ? ($basis['marker'] ?? 'kondisi saat ini')
                    : null,
                'unit' => $basis['unit'] ?? null,
            ];
        }

        return $peta;
    }
    protected function kpi(string $key, string $label, float|int $value, float|int|null $previous, string $format, ?string $detail = null): array
    {
        // Penanda cakupan berasal dari METRIC_BASIS, bukan dari nilai pembanding:
        // labelnya wajib menyebut cakupan sendiri supaya ikut terbaca di ekspor
        // dan drawer yang tidak menampilkan lencana kartu.
        $label .= $this->scopeMarker($key);

        // Pembanding kosong dipakai metrik ber-cakupan sekarang: angkanya
        // keadaan saat laporan dibangun, jadi tidak ada periode pembanding yang
        // bermakna. Perubahan dikosongkan supaya kartu tidak menampilkan "Tetap"
        // atau persentase palsu hasil membandingkan angka itu dengan dirinya sendiri.
        if ($previous === null) {
            return [
                'key' => $key,
                'label' => $label,
                'value' => $format === 'currency' || $format === 'percent' || $format === 'hours' || $format === 'days'
                    ? round((float) $value, 2)
                    : (int) $value,
                'previous' => null,
                'change_percent' => null,
                'format' => $format,
                'detail' => $detail,
            ];
        }

        $change = null;
        if ((float) $previous > 0) {
            $change = round((((float) $value - (float) $previous) / (float) $previous) * 100, 1);
        } elseif ((float) $value > 0) {
            // Naik dari nol -> 100% (owner 2026-09-15: format delta seragam persen,
            // menggantikan KPI-006 "Baru pada periode ini" & fallback absolut "+N unit").
            $change = 100.0;
        } elseif ((float) $value === 0.0 && (float) $previous === 0.0) {
            $change = 0.0;
        }

        return [
            'key' => $key,
            'label' => $label,
            'value' => $format === 'currency' || $format === 'percent' || $format === 'hours' || $format === 'days'
                ? round((float) $value, 2)
                : (int) $value,
            'previous' => $format === 'currency' || $format === 'percent' || $format === 'hours' || $format === 'days'
                ? round((float) $previous, 2)
                : (int) $previous,
            'change_percent' => $change,
            'format' => $format,
            'detail' => $detail,
        ];
    }

    protected function bucketSelect(string $column, string $granularity): string
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            return match ($granularity) {
                'hour' => "strftime('%Y-%m-%d %H:00:00', {$column})",
                'week' => "strftime('%Y-%W', {$column})",
                'month' => "strftime('%Y-%m', {$column})",
                'year' => "strftime('%Y', {$column})",
                default => "strftime('%Y-%m-%d', {$column})",
            };
        }

        return match ($granularity) {
            'hour' => "DATE_FORMAT({$column}, '%Y-%m-%d %H:00:00')",
            'week' => "DATE_FORMAT({$column}, '%x-%v')",
            'month' => "DATE_FORMAT({$column}, '%Y-%m')",
            'year' => "DATE_FORMAT({$column}, '%Y')",
            default => "DATE({$column})",
        };
    }

    /**
     * @return list<array{key: string, label: string}>
     */
    /**
     * Seri untuk satu chart. Satu pintu supaya perlakuan label seri periode ini
     * dan seri pembanding tidak berbeda antar chart.
     *
     * Pada skala Per Jam, label seri pembanding diberi tanggal. Membandingkan
     * "jam 00:00 hari ini" dengan "jam 00:00 hari sebelumnya" memang disengaja,
     * jadi label porosnya sama; tanpa tanggal, tooltip hanya menuliskan
     * "00:00 vs 00:00" dan pembaca tidak tahu hari mana yang dibandingkan.
     *
     * @param  array<string, mixed>  $range
     * @return list<array{bucket: string, label: string, value: float}>
     */
    protected function chartSeries(array $range, string $metric, bool $previous): array
    {
        $from = $previous ? $range['previous_from'] : $range['from'];
        $to = $previous ? $range['previous_to'] : $range['to'];

        $rows = $this->series($from, $to, (string) $range['granularity'], $metric);

        if ($previous && $range['granularity'] === 'hour') {
            foreach ($rows as $index => $row) {
                $rows[$index]['label'] = Carbon::parse($row['bucket'])->translatedFormat('j M H:i');
            }
        }

        return $rows;
    }

    /**
     * Hari pertama data event pengunjung, atau null bila tabelnya masih kosong.
     * Dipakai agar seri dan total memakai batas era yang sama.
     */
    protected function firstVisitorEventDay(): ?Carbon
    {
        $first = PerformanceVisitorEvent::query()->min('visited_at');

        return $first === null ? null : Carbon::parse($first)->startOfDay();
    }

    /**
     * Menyejajarkan jendela pembanding ke batas bucket utuh untuk granularitas
     * minggu, bulan, dan tahun.
     *
     * Jendela pembanding dihitung dari selisih detik, sehingga awal dan akhirnya
     * jatuh di tengah bucket. Pada granularitas kasar itu berarti bucket pertama
     * atau terakhir muncul di KEDUA seri dengan label yang sama, dan jumlah titik
     * kedua seri bisa berbeda. Karena halaman memasangkan seri berdasarkan
     * indeks, keduanya membuat grafik membandingkan periode yang keliru.
     *
     * Penyejajaran tidak diperlukan untuk jam dan hari: kedua jendela berdurasi
     * sama dan bucketnya sudah sejajar sendiri. Membandingkan "sejak awal sampai
     * jam yang sama" juga sengaja dipertahankan untuk dua skala itu (KPI-002).
     *
     * @param  array<string, mixed>  $range
     * @return array<string, mixed>
     */
    protected function alignPreviousWindowToBuckets(array $range): array
    {
        $granularity = (string) $range['granularity'];

        if (! in_array($granularity, ['week', 'month', 'year'], true)) {
            return $range;
        }

        /** @var Carbon $from */
        $from = $range['from'];
        /** @var Carbon $to */
        $to = $range['to'];

        $count = count($this->emptyBuckets($from, $to, $granularity));
        if ($count === 0) {
            return $range;
        }

        // Bucket pertama periode ini, lalu mundur sejumlah bucket yang sama.
        $gridStart = match ($granularity) {
            'week' => $from->copy()->startOfWeek(),
            'month' => $from->copy()->startOfMonth(),
            default => $from->copy()->startOfYear(),
        };

        $previousFrom = $gridStart->copy();
        for ($i = 0; $i < $count; $i++) {
            $previousFrom = match ($granularity) {
                'week' => $previousFrom->subWeek(),
                'month' => $previousFrom->subMonth(),
                default => $previousFrom->subYear(),
            };
        }

        $range['previous_from'] = $previousFrom;
        $range['previous_to'] = $gridStart->copy()->subSecond();
        $range['previous_aligned_to_buckets'] = true;

        return $range;
    }

    protected function emptyBuckets(Carbon $from, Carbon $to, string $granularity): array
    {
        $buckets = [];

        if ($granularity === 'hour') {
            $cursor = $from->copy()->startOfHour();
            $end = $to->copy()->startOfHour();
            while ($cursor <= $end) {
                $key = $cursor->format('Y-m-d H:00:00');
                $buckets[] = ['key' => $key, 'label' => $cursor->format('H:i')];
                $cursor->addHour();
            }

            return $buckets;
        }

        if ($granularity === 'week') {
            $cursor = $from->copy()->startOfWeek();
            $end = $to->copy()->startOfWeek();
            while ($cursor <= $end) {
                $key = $cursor->format('Y-W');
                // Tahun ikut ditulis supaya label minggu tidak pernah bertabrakan
                // dengan seri pembanding yang jatuh di tahun berbeda.
                $buckets[] = ['key' => $key, 'label' => 'Minggu '.$cursor->format('W').' '.$cursor->format('Y')];
                $cursor->addWeek();
            }

            return $buckets;
        }

        if ($granularity === 'month') {
            $cursor = $from->copy()->startOfMonth();
            $end = $to->copy()->startOfMonth();
            while ($cursor <= $end) {
                $key = $cursor->format('Y-m');
                $buckets[] = ['key' => $key, 'label' => $cursor->translatedFormat('M Y')];
                $cursor->addMonth();
            }

            return $buckets;
        }

        if ($granularity === 'year') {
            $cursor = $from->copy()->startOfYear();
            $end = $to->copy()->startOfYear();
            while ($cursor <= $end) {
                $key = $cursor->format('Y');
                $buckets[] = ['key' => $key, 'label' => (string) $cursor->year];
                $cursor->addYear();
            }

            return $buckets;
        }

        foreach (CarbonPeriod::create($from->copy()->startOfDay(), '1 day', $to->copy()->startOfDay()) as $day) {
            /** @var Carbon $day */
            $buckets[] = [
                'key' => $day->toDateString(),
                'label' => $day->translatedFormat('j M'),
            ];
        }

        return $granularity === 'day' ? $this->labelBucketYears($buckets) : $buckets;
    }

    /**
     * Menambahkan tahun pada label bucket minggu dan hari bila grid-nya
     * mencakup lebih dari satu tahun kalender.
     *
     * Label bulan dan tahun sudah memuat tahunnya sendiri. Tanpa penambahan ini,
     * seri periode ini dan seri pembanding yang jatuh di tahun berbeda bisa
     * memakai label yang sama persis, sehingga tooltip menuliskan
     * "Minggu 14 vs Minggu 14" untuk dua minggu yang berlainan.
     *
     * @param  list<array{key: string, label: string}>  $buckets
     * @return list<array{key: string, label: string}>
     */
    protected function labelBucketYears(array $buckets): array
    {
        $total = count($buckets);
        if ($total < 2) {
            return $buckets;
        }

        $firstYear = substr((string) $buckets[0]['key'], 0, 4);
        $lastYear = substr((string) $buckets[$total - 1]['key'], 0, 4);

        if ($firstYear === $lastYear) {
            return $buckets;
        }

        foreach ($buckets as $index => $bucket) {
            $buckets[$index]['label'] = $bucket['label'].' '.substr((string) $bucket['key'], 0, 4);
        }

        return $buckets;
    }

    /**
     * Whether an order counts as omzet (revenue).
     * Rule omzet (owner 2026-08-22): SEMUA pesanan (transfer & COD) dihitung omzet
     * sejak memasuki fulfillment (processing), apa pun metode bayarnya.
     * Realisasi/uang masuk dibedakan lewat metrik "Pembayaran Diterima" (paid_at), bukan di sini.
     */
    protected function paidRevenueStatusSql(string $alias = ''): string
    {
        // Rule omzet (owner 2026-08-22): SEMUA pesanan (transfer & COD) yang masuk alur
        // fulfillment dihitung omzet sejak processing, apa pun metode bayarnya.
        // Terealisasi (uang masuk) dibedakan lewat metrik "Pembayaran Diterima" (paid_at),
        // bukan dengan menunda pengakuan omzet COD ke completed.
        $prefix = $alias !== '' ? $alias.'.' : '';

        return "{$prefix}order_status IN (".implode(',', array_map(fn (string $v): string => "'".$v."'", self::REVENUE_STATUSES)).')';
    }

    /**
     * MySQL + SQLite compatible distinct count of catalogue models sold.
     * Identity is read from order_items snapshots (never live catalog).
     *
     * @param  iterable<int>  $orderIds
     */
    /**
     * Hitungan model dan sub model dari snapshot item pesanan.
     *
     * Model = jenis produk saja (mis. JUNGKIT). Sub model = model beserta
     * desainnya (mis. JUNGKIT ORNAMEN). Sebelumnya hanya pasangan yang
     * dihitung tetapi dilabeli "Model", sehingga satu model dengan dua desain
     * terhitung dua model.
     *
     * @return array{models: int, sub_models: int}
     */
    protected function distinctModelCounts(iterable $orderIds): array
    {
        $rows = OrderItem::query()
            ->whereIn('order_id', $orderIds)
            ->selectRaw(
                "COALESCE(NULLIF(TRIM(product_model), ''), NULLIF(TRIM(parent_sku), ''), NULLIF(TRIM(name), ''), '') AS model_ref, "
                ."COALESCE(NULLIF(TRIM(design_variant), ''), '') AS design_ref"
            )
            ->distinct()
            ->get();

        $models = $rows
            ->pluck('model_ref')
            ->filter(fn ($nilai): bool => (string) $nilai !== '')
            ->unique()
            ->count();

        $subModels = $rows
            ->filter(fn ($row): bool => (string) $row->model_ref !== '' || (string) $row->design_ref !== '')
            ->map(fn ($row): string => $row->model_ref.'|'.$row->design_ref)
            ->unique()
            ->count();

        return ['models' => (int) $models, 'sub_models' => (int) $subModels];
    }

    /**
     * Produk berbeda yang terjual, dibedakan menurut varian ukuran.
     *
     * Baris yang tidak punya variant_sku tetap dihitung memakai parent_sku,
     * karena produk yang dijual tanpa ukuran tidak boleh hilang dari laporan.
     */
    protected function distinctProductCount(iterable $orderIds): int
    {
        return (int) OrderItem::query()
            ->whereIn('order_id', $orderIds)
            ->selectRaw(
                "COALESCE(NULLIF(TRIM(variant_sku), ''), NULLIF(TRIM(parent_sku), ''), NULLIF(TRIM(name), ''), '') AS produk_ref"
            )
            ->distinct()
            ->get()
            ->pluck('produk_ref')
            ->filter(fn ($nilai): bool => (string) $nilai !== '')
            ->unique()
            ->count();
    }

    /**
     * Tanggal setiap pesanan berpindah ke status selesai.
     *
     * Sumber utamanya riwayat perubahan status, bukan status saat ini, karena
     * sebuah pesanan bisa keluar lagi dari status completed (mis. masuk retur),
     * sehingga status hari ini tidak membuktikan kapan penyelesaiannya terjadi.
     *
     * Untuk pesanan lama yang sudah selesai tetapi perubahan statusnya tidak
     * tercatat di riwayat (data sebelum pencatatan riwayat berjalan), waktu
     * perubahan terakhir pesanan dipakai sebagai perkiraan supaya pesanan itu
     * tidak hilang dari hitungan.
     *
     * @return array<int, Carbon> id pesanan => waktu selesai
     */
    protected function completionDates(): array
    {
        $dates = [];

        foreach (EventLog::query()
            ->where('event_type', 'order_status_changed')
            ->where('entity_type', 'order')
            ->get() as $event) {
            if ((string) data_get($event->payload, 'order_status') !== 'completed') {
                continue;
            }

            $id = (int) $event->entity_id;
            if (! isset($dates[$id]) || $event->created_at->lt($dates[$id])) {
                $dates[$id] = $event->created_at;
            }
        }

        $sudahAda = $dates === [] ? [0] : array_keys($dates);

        foreach (Order::query()
            ->where('order_status', 'completed')
            ->whereNotIn('id', $sudahAda)
            ->get(['id', 'updated_at']) as $order) {
            if ($order->updated_at !== null) {
                $dates[(int) $order->id] = $order->updated_at;
            }
        }

        return $dates;
    }

    protected function paidRevenueScope($query, string $alias = '')
    {
        return $query->whereRaw($this->paidRevenueStatusSql($alias));
    }
}
