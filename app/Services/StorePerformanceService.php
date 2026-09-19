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
    public function resolveRange(string $period, ?string $from = null, ?string $to = null, ?string $granularity = null): array
    {
        $now = now();
        $period = in_array($period, ['today', 'yesterday', 'last_7', 'last_30', 'this_month', 'this_year', 'all', 'custom'], true)
            ? $period
            : 'today';

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
                $this->safeParseDate($from, $now->copy()->subDays(6)->startOfDay(), true),
                $this->safeParseDate($to, $now->copy()->endOfDay(), false),
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
        $previous = $this->metricsFor($range['previous_from'], $range['previous_to']);

        $salesKpis = [
            $this->kpi('omzet', 'Penjualan Gross', $current['revenue'], $previous['revenue'], 'currency'),
            $this->kpi('orders', 'Jumlah Pesanan', $current['orders'], $previous['orders'], 'number'),
            $this->kpi('models', 'Model Produk Terjual', $current['models_sold'], $previous['models_sold'], 'number'),
            $this->kpi('products', 'Produk Terjual', $current['products_sold'], $previous['products_sold'], 'number'),
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
            $this->kpi('open_orders', 'Pesanan Belum Selesai', $current['open_orders'], $previous['open_orders'], 'number', 'Pesanan yang masuk fulfillment dan belum selesai pada periode.'),
            $this->kpi('dispatched_orders', 'Dalam Pengiriman', $current['dispatched_orders'], $previous['dispatched_orders'], 'number', 'Pesanan berstatus dikirim/dalam perjalanan pada periode.'),
            $this->kpi('avg_confirm_hours', 'Rata-rata Waktu Konfirmasi', $current['avg_confirm_hours'], $previous['avg_confirm_hours'], 'hours', 'Waktu dari pesan masuk sampai dikonfirmasi.'),
            $this->kpi('avg_process_days', 'Rata-rata Waktu Proses', $current['avg_process_days'], $previous['avg_process_days'], 'days', 'Waktu dari dikonfirmasi sampai disiapkan/siap kirim.'),
        ];

        $paymentsKpis = [
            $this->kpi('net_revenue', 'Penjualan Bersih', $current['net_revenue'], $previous['net_revenue'] ?? 0, 'currency', 'Penjualan Gross dikurangi refund retur yang benar-benar selesai.'),
            $this->kpi('payments_received', 'Pembayaran Diterima', $current['payments_received'], $previous['payments_received'], 'currency', 'Pembayaran yang tercatat selesai (paid_at) pada periode.'),
            $this->kpi('cod_paid', 'COD Selesai (uang masuk)', $current['cod_paid'], $previous['cod_paid'], 'currency', 'Pesanan COD yang barangnya sudah sampai ke pembeli pada periode. Sistem tidak melacak setoran uang dari kurir, jadi status mengikuti kejadian barang sampai, bukan konfirmasi pembayaran.'),
            $this->kpi('payment_pending_count', 'Pembayaran Transfer Pending', $current['payment_pending_count'], $previous['payment_pending_count'], 'number', 'Pembayaran non-COD yang belum lunas pada order aktif. COD tidak dihitung di sini karena statusnya mengikuti kejadian barang sampai, bukan konfirmasi pembayaran.'),
        ];

        $cancellationsKpis = [
            $this->kpi('cancelled_orders', 'Pesanan Dibatalkan', $current['cancelled_orders'], $previous['cancelled_orders'], 'number', 'Dihitung dari event pembatalan pada periode.'),
            $this->kpi('cancelled_by_customer', 'Dibatalkan Pelanggan', $current['cancelled_by_customer'], $previous['cancelled_by_customer'], 'number', 'Pembatalan oleh pelanggan (created_by_user_id kosong).'),
            $this->kpi('cancelled_by_store', 'Dibatalkan Toko', $current['cancelled_by_store'], $previous['cancelled_by_store'], 'number', 'Pembatalan oleh admin/toko (created_by_user_id terisi).'),
            $this->kpi('cancelled_value', 'Nilai Pesanan Dibatalkan', $current['cancelled_value'], $previous['cancelled_value'] ?? 0, 'currency', 'Total nilai pesanan yang dibatalkan pada periode. Tidak termasuk dalam Penjualan Gross.'),
            $this->kpi('cancellation_rate', 'Rasio Pembatalan', $current['cancellation_rate'], $previous['cancellation_rate'], 'percent', 'Dihitung dari event pembatalan pada periode dibandingkan pesanan yang masuk fulfillment pada periode.'),
        ];

        $returnsKpis = [
            $this->kpi('returns', 'Jumlah Retur', $current['return_orders'], $previous['return_orders'], 'number'),
            $this->kpi('return_value', 'Nilai Retur', $current['return_value'], $previous['return_value'], 'currency'),
            $this->kpi('returns_created', 'Retur Diajukan', $current['returns_created'], $previous['returns_created'], 'number'),
            $this->kpi('returns_open', 'Retur Aktif', $current['returns_open'], $previous['returns_open'], 'number', 'Kasus retur yang masih terbuka saat laporan dibuat.'),
            $this->kpi('returns_completed', 'Retur Selesai', $current['returns_completed'], $previous['returns_completed'], 'number'),
            $this->kpi('refused_orders', 'Pesanan Ditolak', $current['refused_orders'], $previous['refused_orders'], 'number', 'Pesanan yang paketnya dikembalikan kurir sebelum diterima dan belum pernah lunas. Barang kembali ke gudang tanpa restore stok.'),
            $this->kpi('refund_given', 'Refund Diberikan', $current['refund_given'], $previous['refund_given'], 'currency'),
            $this->kpi('return_rate_created', 'Rasio Retur Diajukan', $current['return_rate_created'], $previous['return_rate_created'], 'percent', 'Retur diajukan dibanding pesanan yang masuk fulfillment.'),
            $this->kpi('return_rate_completed', 'Rasio Retur Selesai', $current['return_rate_completed'], $previous['return_rate_completed'], 'percent', 'Retur selesai dibanding pesanan selesai.'),
        ];

        $returnCostKpis = [
            $this->kpi('return_shipping_cost_total', 'Ongkir Retur (Toko)', $current['return_shipping_cost_total'], $previous['return_shipping_cost_total'] ?? 0, 'currency', 'Total ongkir retur yang DITANGGUNG TOKO dari kasus retur selesai periode ini (bukan dibayar pembeli).'),
            $this->kpi('return_shipping_cost_cases', 'Kasus Retur (Ongkir Toko)', $current['return_shipping_cost_cases'], $previous['return_shipping_cost_cases'] ?? 0, 'number', 'Jumlah kasus retur selesai yang ongkirnya ditanggung toko.'),
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
                'visitors' => $current['visitors'],
                'payments_received' => $current['payments_received'],
                'cod_paid' => $current['cod_paid'],
                'cod_pending_amount' => $current['cod_pending_amount'],
                'cod_pending_count' => $current['cod_pending_count'],
                'cod_pending_in_period_amount' => $current['cod_pending_in_period_amount'],
                'cod_pending_in_period_count' => $current['cod_pending_in_period_count'],
                'payment_pending_count' => $current['payment_pending_count'],
                'refused_goods_value' => round($current['refused_goods_value'], 2),
                'definition' => 'Penjualan Gross = total yang dibayar pelanggan, termasuk nilai produk, ongkir, dan biaya COD. Penjualan Bersih = Penjualan Gross dikurangi ongkir raw J&T, biaya COD yang diteruskan ke J&T, refund retur, dan ongkir retur toko. Subsidi ongkir sudah termasuk di ongkir raw J&T sehingga tidak dikurangkan lagi. Uang yang benar-benar masuk lihat Pembayaran Diterima.',
            ],
            'previous_has_data' => ($previous['orders'] ?? 0) > 0,
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
                    'series' => $this->series($range['from'], $range['to'], $range['granularity'], 'revenue'),
                    'previous_series' => $this->series($range['previous_from'], $range['previous_to'], $range['granularity'], 'revenue'),
                ],
                [
                    'key' => 'net_revenue',
                    'title' => 'Tren Penjualan Bersih',
                    'total' => $current['net_revenue'],
                    'previous_total' => $previous['net_revenue'] ?? 0.0,
                    'total_format' => 'currency',
                    'series' => $this->series($range['from'], $range['to'], $range['granularity'], 'net_revenue'),
                    'previous_series' => $this->series($range['previous_from'], $range['previous_to'], $range['granularity'], 'net_revenue'),
                ],
                [
                    'key' => 'orders',
                    'title' => 'Tren Pesanan',
                    'total' => $current['orders'],
                    'previous_total' => $previous['orders'] ?? 0.0,
                    'total_format' => 'number',
                    'series' => $this->series($range['from'], $range['to'], $range['granularity'], 'orders'),
                    'previous_series' => $this->series($range['previous_from'], $range['previous_to'], $range['granularity'], 'orders'),
                ],
                [
                    'key' => 'units',
                    'title' => 'Tren Unit Terjual',
                    'total' => $current['units'],
                    'previous_total' => $previous['units'] ?? 0.0,
                    'total_format' => 'number',
                    'series' => $this->series($range['from'], $range['to'], $range['granularity'], 'units'),
                    'previous_series' => $this->series($range['previous_from'], $range['previous_to'], $range['granularity'], 'units'),
                ],
                [
                    'key' => 'visitors',
                    'title' => 'Tren Pengunjung Unik',
                    'total' => $current['visitors'],
                    'previous_total' => $previous['visitors'] ?? 0.0,
                    'total_format' => 'number',
                    'series' => $this->series($range['from'], $range['to'], $range['granularity'], 'visitors'),
                    'previous_series' => $this->series($range['previous_from'], $range['previous_to'], $range['granularity'], 'visitors'),
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
        $modelsSold = $revenueOrderIds->isEmpty()
            ? 0
            : $this->distinctModelCount($revenueOrderIds);

        // Produk berbeda (per varian/ukuran) yang terjual - distinct SKU dari snapshot.
        $productsSold = $revenueOrderIds->isEmpty()
            ? 0
            : (int) OrderItem::query()
                ->whereIn('order_id', $revenueOrderIds)
                ->whereNotNull('variant_sku')
                ->where('variant_sku', '!=', '')
                ->distinct('variant_sku')
                ->count('variant_sku');

        $avgUnitPrice = $units > 0 ? round($revenue / $units, 2) : 0.0;

        $completedOrders = (clone $base)->whereIn('order_status', self::COMPLETED_STATUSES)->count();
        $openOrders = (clone $base)->whereIn('order_status', self::OPEN_STATUSES)->count();
        $dispatchedOrders = (clone $base)->where('order_status', 'shipped')->count();

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
        $refundAdjustments = (float) $returnCases->sum('refund_amount');
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
            'products_sold' => $productsSold,
            'avg_unit_price' => $avgUnitPrice,
            'visitors' => $visitors,
            'buyers' => $buyers,
            'conversion_rate' => $conversionRate,
            'new_customers' => $newCustomers,
            'repeat_customers' => $repeatCustomers,
            'completed_orders' => $completedOrders,
            'open_orders' => $openOrders,
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
            'cancellation_rate' => $orders + $cancellationCounts['total'] > 0
                ? round(($cancellationCounts['total'] / ($orders + $cancellationCounts['total'])) * 100, 2)
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

            // Cadangan untuk riwayat pengunjung sebelum tabel event ada. Tabel
            // metrik lama hanya menyimpan agregat harian (metric_date berupa
            // tanggal), jadi cadangan ini HANYA dipakai untuk skala Per Hari ke
            // atas. Dulu skala Per Jam diturunkan diam-diam menjadi Per Hari,
            // sehingga memilih Per Jam bisa menggambar satu titik saja dan sumbu
            // grafiknya tidak cocok dengan pilihan dropdown.
            if ($rows->isEmpty() && $granularity !== 'hour') {
                $legacyGranularity = $granularity;
                $buckets = $this->emptyBuckets($from, $to, $legacyGranularity);
                $rows = PerformanceMetric::query()
                    ->selectRaw($this->bucketSelect('metric_date', $legacyGranularity).' as bucket')
                    ->selectRaw('SUM(metric_value) as value')
                    ->where('metric_name', 'storefront_unique_visitors')
                    ->whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])
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

        $buckets = $this->emptyBuckets($from, $to, $granularity);

        if ($metric === 'net_revenue') {
            $orderRows = Order::query()
                ->selectRaw($this->bucketSelect('created_at', $granularity).' as bucket')
                ->selectRaw('SUM(total_amount - COALESCE(shipping_amount, 0) - COALESCE(shipping_subsidy_amount, 0) - COALESCE(shipping_insurance_amount, 0) - COALESCE(cod_fee_amount, 0)) as value')
                ->whereBetween('created_at', [$from, $to])
                ->whereRaw($this->paidRevenueStatusSql())
                ->groupBy('bucket')
                ->pluck('value', 'bucket');

            $returnRows = OrderReturnCase::query()
                ->selectRaw($this->bucketSelect('completed_at', $granularity).' as bucket')
                ->selectRaw('SUM(COALESCE(refund_amount, 0) + COALESCE(return_shipping_cost, 0)) as value')
                ->where('status', 'completed')
                ->whereNotNull('completed_at')
                ->whereBetween('completed_at', [$from, $to])
                ->groupBy('bucket')
                ->pluck('value', 'bucket');

            return collect($buckets)->map(function (array $bucket) use ($orderRows, $returnRows) {
                $gross = (float) ($orderRows[$bucket['key']] ?? 0);
                $deductions = (float) ($returnRows[$bucket['key']] ?? 0);

                return [
                    'bucket' => $bucket['key'],
                    'label' => $bucket['label'],
                    'value' => round(max(0, $gross - $deductions), 2),
                ];
            })->values()->all();
        }

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

        if ($metric === 'units') {
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

        return [
            'total' => $dedup->count(),
            'customer' => $customer,
            'store' => $store,
            'value' => round($cancelledValue, 2),
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
            return (int) PerformanceVisitorEvent::query()
                ->whereBetween('visited_at', [$from, $to])
                ->distinct()
                ->count('visitor_hash');
        }

        // Rentang menyeberang: pengunjung sebelum batas dihitung dari metrik
        // harian (identitas lintas sumber tidak dapat digabung), sesudahnya
        // dari event. Disediakan sebagai angka gabungan dua sumber.
        $legacyDays = (int) PerformanceMetric::query()
            ->where('metric_name', 'storefront_unique_visitors')
            ->whereDate('metric_date', '>=', $from->toDateString())
            ->whereDate('metric_date', '<', $firstEventDay->toDateString())
            ->sum('metric_value');
        $eventVisitors = (int) PerformanceVisitorEvent::query()
            ->whereBetween('visited_at', [$firstEventDay, $to])
            ->distinct()
            ->count('visitor_hash');

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
     * Cari event transisi status order. Menerima $fromStatus tunggal ATAU array
     * (legacy fallback: order lama pakai 'pending_payment', order baru 'awaiting_confirmation').
     */
    protected function statusEventAt(int|string $orderId, string|array $fromStatus, string $toStatus): ?Carbon
    {
        $fromStatuses = (array) $fromStatus;

        return EventLog::query()
            ->where('entity_type', 'order')
            ->where('entity_id', (string) $orderId)
            ->where('event_type', 'order_status_changed')
            ->get()
            ->filter(function (EventLog $event) use ($fromStatuses, $toStatus): bool {
                return in_array((string) data_get($event->payload, 'from'), $fromStatuses, true)
                    && (string) data_get($event->payload, 'order_status') === $toStatus;
            })
            ->sortBy('created_at')
            ->first()?->created_at;
    }

    protected function avgConfirmHours(Carbon $from, Carbon $to): float
    {
        $orders = Order::query()->whereBetween('created_at', [$from, $to])->get(['id', 'created_at']);
        $durations = $orders->map(function (Order $order): ?float {
            $confirmedAt = $this->statusEventAt($order->id, ['awaiting_confirmation', 'pending_payment'], 'processing');

            return $confirmedAt ? max(0, $order->created_at->diffInMinutes($confirmedAt) / 60) : null;
        })->filter(fn (?float $value): bool => $value !== null);

        return $durations->isEmpty() ? 0.0 : (float) $durations->avg();
    }

    protected function avgProcessDays(Carbon $from, Carbon $to): float
    {
        $orders = Order::query()->whereBetween('created_at', [$from, $to])->get(['id']);
        $durations = $orders->map(function (Order $order): ?float {
            $processingAt = $this->statusEventAt($order->id, ['awaiting_confirmation', 'pending_payment'], 'processing')
                ?: $this->statusEventAt($order->id, 'issue', 'processing');
            if (! $processingAt) {
                return null;
            }

            $waybillAt = ShippingRecord::query()
                ->where('order_id', $order->id)
                ->whereNotNull('waybill_number')
                ->orderBy('created_at')
                ->value('created_at');

            return $waybillAt
                ? max(0, $processingAt->diffInMinutes(Carbon::parse($waybillAt)) / (60 * 24))
                : null;
        })->filter(fn (?float $value): bool => $value !== null);

        return $durations->isEmpty() ? 0.0 : (float) $durations->avg();
    }

    /**
     * @return array{key: string, label: string, value: float|int, previous: float|int, change_percent: float|null, format: string}
     */
    protected function kpi(string $key, string $label, float|int $value, float|int $previous, string $format, ?string $detail = null): array
    {
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
                $buckets[] = ['key' => $key, 'label' => 'Minggu '.$cursor->format('W')];
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
    protected function distinctModelCount(iterable $orderIds): int
    {
        return (int) OrderItem::query()
            ->whereIn('order_id', $orderIds)
            ->whereRaw(
                "(COALESCE(NULLIF(TRIM(product_model), ''), NULLIF(TRIM(parent_sku), ''), NULLIF(TRIM(name), ''), '') <> '' "
                ."OR COALESCE(NULLIF(TRIM(design_variant), ''), '') <> '')"
            )
            ->selectRaw(
                "COALESCE(NULLIF(TRIM(product_model), ''), NULLIF(TRIM(parent_sku), ''), NULLIF(TRIM(name), ''), '') AS model_ref, "
                ."COALESCE(NULLIF(TRIM(design_variant), ''), '') AS design_ref"
            )
            ->distinct()
            ->get(['model_ref', 'design_ref'])
            ->count();
    }

    protected function paidRevenueScope($query, string $alias = '')
    {
        return $query->whereRaw($this->paidRevenueStatusSql($alias));
    }
}
