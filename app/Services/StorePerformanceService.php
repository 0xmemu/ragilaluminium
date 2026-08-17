<?php

namespace App\Services;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\PerformanceMetric;
use App\Models\PerformanceVisitorEvent;
use App\Models\ShippingRecord;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;

/**
 * Pembukuan toko & penjualan — sumber kebenaran: orders + order_items (+ page views).
 */
class StorePerformanceService
{
    /** Omzet / unit terjual hanya dari pesanan yang sudah masuk alur fulfillment (bukan batal / pending bayar). */
    public const REVENUE_STATUSES = [
        'processing', 'shipped', 'delivered', 'completed',
        'return_in_process', 'return_completed',
    ];

    public const COMPLETED_STATUSES = ['completed'];

    public const OPEN_STATUSES = ['pending_payment', 'processing', 'shipped'];

    /**
     * issue is an operational exception, not proof that goods were returned.
     * Actual return KPIs come from the return ledger below.
     */
    public const RETURN_STATUSES = [];

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
                $from ? Carbon::parse($from)->startOfDay() : $now->copy()->subDays(6)->startOfDay(),
                $to ? Carbon::parse($to)->endOfDay() : $now->copy()->endOfDay(),
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

        // Carbon 3: diffInSeconds default absolute=false ??? hitung dari $start ke $end.
        $fullSeconds = max(1, (int) round($start->diffInSeconds($end)));
        // Spec ??G: periode berjalan ??? bandingkan sampai jam sama; selesai ??? penuh.
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

        $autoGranularity = match (true) {
            $period === 'today' || $period === 'yesterday' => 'hour',
            in_array($period, ['this_year', 'all'], true) || $start->diffInDays($end) > 90 => 'month',
            $start->diffInDays($end) > 45 => 'week',
            default => 'day',
        };

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

    /**
     * @return array<string, mixed>
     */
    public function build(string $period = 'today', ?string $from = null, ?string $to = null, ?string $granularity = null): array
    {
        $range = $this->resolveRange($period, $from, $to, $granularity);
        $current = $this->metricsFor($range['from'], $range['to']);
        $previous = $this->metricsFor($range['previous_from'], $range['previous_to']);

        $salesKpis = [
            $this->kpi('omzet', 'Omset', $current['revenue'], $previous['revenue'], 'currency'),
            $this->kpi('orders', 'Jumlah Pesanan', $current['orders'], $previous['orders'], 'number'),
            $this->kpi('models', 'Model/Sub Model Terjual', $current['models_sold'], $previous['models_sold'], 'number'),
            $this->kpi('units', 'Jumlah Unit Terjual', $current['units'], $previous['units'], 'number'),
            $this->kpi('avg_unit_price', 'Harga Rata-rata per Unit', $current['avg_unit_price'], $previous['avg_unit_price'], 'currency'),
        ];

        $trafficKpis = [
            $this->kpi('visitors', 'Jumlah Pengunjung', $current['visitors'], $previous['visitors'], 'number'),
            $this->kpi('conversion', 'Tingkat Konversi', $current['conversion_rate'], $previous['conversion_rate'], 'percent'),
            $this->kpi('new_customers', 'Customer Baru', $current['new_customers'], $previous['new_customers'], 'number'),
            $this->kpi('repeat_customers', 'Customer Order Ulang', $current['repeat_customers'], $previous['repeat_customers'], 'number'),
            $this->kpi('completed_orders', 'Pesanan Selesai', $current['completed_orders'], $previous['completed_orders'], 'number'),
        ];

        $opsKpis = [
            $this->kpi('open_orders', 'Pesanan Belum Selesai', $current['open_orders'], $previous['open_orders'], 'number'),
            $this->kpi('returns', 'Jumlah Retur', $current['return_orders'], $previous['return_orders'], 'number'),
            $this->kpi('return_value', 'Nilai Retur', $current['return_value'], $previous['return_value'], 'currency'),
            $this->kpi('avg_confirm_hours', 'Rata-rata Waktu Konfirmasi', $current['avg_confirm_hours'], $previous['avg_confirm_hours'], 'hours'),
            $this->kpi('avg_process_days', 'Rata-rata Waktu Proses', $current['avg_process_days'], $previous['avg_process_days'], 'days'),
        ];

        return [
            'range' => [
                'period' => $range['period'],
                'label' => $range['label'],
                'from' => $range['from']->toIso8601String(),
                'to' => $range['to']->toIso8601String(),
                'from_date' => $range['from']->toDateString(),
                'to_date' => $range['to']->toDateString(),
                'previous_from' => $range['previous_from']->toIso8601String(),
                'previous_to' => $range['previous_to']->toIso8601String(),
                'granularity' => $range['granularity'],
                'compare_label' => 'vs '.$range['previous_from']->translatedFormat('j M Y')
                    .(
                        $range['previous_from']->toDateString() === $range['previous_to']->toDateString()
                            ? ''
                            : ' – '.$range['previous_to']->translatedFormat('j M Y')
                    ),
                'compare_from_date' => $range['previous_from']->toDateString(),
                'compare_to_date' => $range['previous_to']->toDateString(),
                'is_running' => $range['is_running'],
            ],
            'financial' => [
                'gross_revenue' => $current['gross_revenue'],
                'refund_adjustments' => $current['refund_adjustments'],
                'net_revenue' => $current['net_revenue'],
                'definition' => 'Omset adalah gross dari order fulfillment/return; net dikurangi refund pada return case yang benar-benar selesai.',
            ],
            'sections' => [
                ['key' => 'sales', 'title' => 'Penjualan', 'kpis' => $salesKpis],
                ['key' => 'traffic', 'title' => 'Kunjungan & Layanan', 'kpis' => $trafficKpis],
                ['key' => 'operations', 'title' => 'Operasional', 'kpis' => $opsKpis],
            ],
            'charts' => [
                [
                    'key' => 'revenue',
                    'title' => 'Tren Omset',
                    'total' => $current['revenue'],
                    'total_format' => 'currency',
                    'series' => $this->series($range['from'], $range['to'], $range['granularity'], 'revenue'),
                ],
                [
                    'key' => 'visitors',
                    'title' => 'Tren Pengunjung',
                    'total' => $current['visitors'],
                    'total_format' => 'number',
                    'series' => $this->series($range['from'], $range['to'], $range['granularity'], 'visitors'),
                ],
                [
                    'key' => 'units',
                    'title' => 'Tren Unit Terjual',
                    'total' => $current['units'],
                    'total_format' => 'number',
                    'series' => $this->series($range['from'], $range['to'], $range['granularity'], 'units'),
                ],
            ],
            'top_products' => $this->topProducts($range['from'], $range['to']),
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

        $orders = (clone $base)->count();
        $revenueOrders = $this->paidRevenueScope(clone $base);
        $revenue = (float) (clone $revenueOrders)->sum('total_amount');
        $revenueOrderIds = (clone $revenueOrders)->pluck('id');

        $units = $revenueOrderIds->isEmpty()
            ? 0
            : (int) OrderItem::query()->whereIn('order_id', $revenueOrderIds)->sum('quantity');

        // Historical identity is read from order_items snapshots, never from live catalog rows.
        $modelsSold = $revenueOrderIds->isEmpty()
            ? 0
            : $this->distinctModelCount($revenueOrderIds);

        $avgUnitPrice = $units > 0 ? round($revenue / $units, 2) : 0.0;

        $completedOrders = (clone $base)->whereIn('order_status', self::COMPLETED_STATUSES)->count();
        $openOrders = (clone $base)->whereIn('order_status', self::OPEN_STATUSES)->count();

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
        $netRevenue = $revenue - $refundAdjustments;

        $visitors = $this->visitorsBetween($from, $to);
        $conversionRate = $visitors > 0 ? round(($orders / $visitors) * 100, 2) : 0.0;

        [$newCustomers, $repeatCustomers] = $this->customerCounts($from, $to);

        return [
            'orders' => $orders,
            'revenue' => round($revenue, 2),
            'gross_revenue' => round($revenue, 2),
            'refund_adjustments' => round($refundAdjustments, 2),
            'net_revenue' => round($netRevenue, 2),
            'units' => $units,
            'models_sold' => $modelsSold,
            'avg_unit_price' => $avgUnitPrice,
            'visitors' => $visitors,
            'conversion_rate' => $conversionRate,
            'new_customers' => $newCustomers,
            'repeat_customers' => $repeatCustomers,
            'completed_orders' => $completedOrders,
            'open_orders' => $openOrders,
            'return_orders' => $returnOrders,
            'return_value' => round($returnValue, 2),
            'avg_confirm_hours' => $this->avgConfirmHours($from, $to),
            'avg_process_days' => $this->avgProcessDays($from, $to),
        ];
    }

    /**
     * @return list<array{bucket: string, label: string, value: float}>
     */
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

            if ($rows->isEmpty()) {
                // Backward-compatible fallback for visitor history recorded before the event table.
                $legacyGranularity = $granularity === 'hour' ? 'day' : $granularity;
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
    public function topProducts(Carbon $from, Carbon $to, int $limit = 20): array
    {
        return OrderItem::query()
            ->select([
                'order_items.parent_sku',
                'order_items.name',
                DB::raw('SUM(order_items.quantity) as units'),
                DB::raw('SUM(order_items.line_total) as revenue'),
                DB::raw('COUNT(DISTINCT order_items.order_id) as order_count'),
            ])
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereBetween('orders.created_at', [$from, $to])
            ->whereRaw($this->paidRevenueStatusSql('orders'))
            ->groupBy('order_items.parent_sku', 'order_items.name')
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'parent_sku' => $row->parent_sku,
                'name' => $row->name,
                'units' => (int) $row->units,
                'revenue' => round((float) $row->revenue, 2),
                'order_count' => (int) $row->order_count,
            ])
            ->all();
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
            ['metric_date' => $today, 'metric_name' => 'storefront_page_views'],
            ['metric_value' => 0, 'created_at' => $now]
        );
        $views->increment('metric_value');

        // The unique key is database-backed so analytics remains correct across workers.
        $event = PerformanceVisitorEvent::query()->firstOrCreate(
            ['visitor_hash' => $visitorHash, 'visit_date' => $today],
            ['visited_at' => $now]
        );
        $unique = PerformanceMetric::query()->firstOrCreate(
            ['metric_date' => $today, 'metric_name' => 'storefront_unique_visitors'],
            ['metric_value' => 0, 'created_at' => $now]
        );
        if ($event->wasRecentlyCreated || (int) $unique->metric_value === 0) {
            $unique->increment('metric_value');
        }
    }

    protected function visitorsBetween(Carbon $from, Carbon $to): int
    {
        $visitors = PerformanceVisitorEvent::query()
            ->whereBetween('visited_at', [$from, $to])
            ->distinct()
            ->count('visitor_hash');

        if ($visitors > 0) {
            return (int) $visitors;
        }

        return (int) PerformanceMetric::query()
            ->where('metric_name', 'storefront_unique_visitors')
            ->whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])
            ->sum('metric_value');
    }

    /**
     * @return array{0: int, 1: int}
     */
    protected function customerCounts(Carbon $from, Carbon $to): array
    {
        $phonesInPeriod = Order::query()
            ->whereBetween('created_at', [$from, $to])
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

    protected function statusEventAt(int|string $orderId, string $fromStatus, string $toStatus): ?Carbon
    {
        return EventLog::query()
            ->where('entity_type', 'order')
            ->where('entity_id', (string) $orderId)
            ->where('event_type', 'order_status_changed')
            ->get()
            ->filter(function (EventLog $event) use ($fromStatus, $toStatus): bool {
                return (string) data_get($event->payload, 'from') === $fromStatus
                    && (string) data_get($event->payload, 'order_status') === $toStatus;
            })
            ->sortBy('created_at')
            ->first()?->created_at;
    }

    protected function avgConfirmHours(Carbon $from, Carbon $to): float
    {
        $orders = Order::query()->whereBetween('created_at', [$from, $to])->get(['id', 'created_at']);
        $durations = $orders->map(function (Order $order): ?float {
            $confirmedAt = $this->statusEventAt($order->id, 'pending_payment', 'processing');
            return $confirmedAt ? max(0, $order->created_at->diffInMinutes($confirmedAt) / 60) : null;
        })->filter(fn (?float $value): bool => $value !== null);

        return $durations->isEmpty() ? 0.0 : round((float) $durations->avg(), 2);
    }

    protected function avgProcessDays(Carbon $from, Carbon $to): float
    {
        $orders = Order::query()->whereBetween('created_at', [$from, $to])->get(['id']);
        $durations = $orders->map(function (Order $order): ?float {
            $processingAt = $this->statusEventAt($order->id, 'pending_payment', 'processing')
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

        return $durations->isEmpty() ? 0.0 : round((float) $durations->avg(), 2);
    }

    /**
     * @return array{key: string, label: string, value: float|int, previous: float|int, change_percent: float|null, format: string}
     */
    protected function kpi(string $key, string $label, float|int $value, float|int $previous, string $format): array
    {
        $change = null;
        if ((float) $previous > 0) {
            $change = round((((float) $value - (float) $previous) / (float) $previous) * 100, 1);
        } elseif ((float) $value > 0) {
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
     * Whether an order counts as paid revenue.
     * Rule F10.R4: COD only recognized as paid when it reaches completed;
     * transfer/regular orders count from fulfilment statuses onward.
     */
    protected function paidRevenueStatusSql(string $alias = ''): string
    {
        $prefix = $alias !== '' ? $alias.'.' : '';
        $revList = implode(',', array_map(fn (string $v): string => "'".$v."'", self::REVENUE_STATUSES));
        $compList = implode(',', array_map(fn (string $v): string => "'".$v."'", self::COMPLETED_STATUSES));

        return "(({$prefix}cod_flag = 0 OR {$prefix}cod_flag IS NULL)"
            ." AND {$prefix}order_status IN ({$revList}))"
            ." OR ({$prefix}cod_flag = 1 AND {$prefix}order_status IN ({$compList}))";
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
