<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ImportJob;
use App\Models\MediaAsset;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\WhatsAppMessage;
use App\Services\ProductEngagementService;
use App\Services\StorePerformanceService;
use App\Services\WhatsAppService;
use App\Support\JntReadiness;
use App\Support\OrderTrackingPresenter;
use App\Support\PhoneNumber;
use App\Support\ProductPromotionMetadata;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(
        protected StorePerformanceService $performance,
        protected ProductEngagementService $productEngagement,
        protected WhatsAppService $whatsapp,
    ) {}

    public function index(Request $request): Response
    {
        $today = now()->startOfDay();
        $yesterday = now()->subDay()->startOfDay();
        $yesterdayEnd = $today->copy()->subSecond();
        $activeOrderStatuses = ['processing', 'shipped', 'delivered'];

        $todaysOrders = Order::where('created_at', '>=', $today)
            ->where('order_status', '!=', 'cancelled')
            ->count();
        $todaysRevenue = (float) Order::where('created_at', '>=', $today)
            ->whereIn('order_status', StorePerformanceService::REVENUE_STATUSES)
            ->sum('total_amount');
        $yesterdaysOrders = Order::whereBetween('created_at', [$yesterday, $yesterdayEnd])
            ->where('order_status', '!=', 'cancelled')
            ->count();
        $yesterdaysRevenue = (float) Order::whereBetween('created_at', [$yesterday, $yesterdayEnd])
            ->whereIn('order_status', StorePerformanceService::REVENUE_STATUSES)
            ->sum('total_amount');

        $todaysUnits = (int) OrderItem::query()
            ->whereHas('order', fn ($q) => $q
                ->where('created_at', '>=', $today)
                ->whereIn('order_status', StorePerformanceService::REVENUE_STATUSES))
            ->sum('quantity');
        $yesterdaysUnits = (int) OrderItem::query()
            ->whereHas('order', fn ($q) => $q
                ->whereBetween('created_at', [$yesterday, $yesterdayEnd])
                ->whereIn('order_status', StorePerformanceService::REVENUE_STATUSES))
            ->sum('quantity');

        $pendingPaymentQuery = Order::query()->where('order_status', 'pending_payment');
        $activeOrdersQuery = Order::query()->whereIn('order_status', $activeOrderStatuses);
        $paymentsReceivedTodayQuery = Payment::query()
            ->where('status', 'completed')
            ->whereBetween('paid_at', [$today, now()]);
        $jntReadiness = JntReadiness::report();
        $whatsappReadiness = $this->whatsapp->connectionStatus();
        $mediaDriver = (string) config('filesystems.disks.media.driver', config('filesystems.default', 'local'));
        $mediaIsReady = $mediaDriver === 's3'
            ? filled(config('filesystems.disks.media.key'))
                && filled(config('filesystems.disks.media.secret'))
                && filled(config('filesystems.disks.media.bucket'))
                && filled(config('filesystems.disks.media.endpoint'))
            : ! app()->environment('production');
        $queueConnection = (string) config('queue.default', 'sync');
        $queueIsReady = ! in_array($queueConnection, ['sync', 'null'], true);

        $revenueChangePercent = $yesterdaysRevenue > 0
            ? round((($todaysRevenue - $yesterdaysRevenue) / $yesterdaysRevenue) * 100, 1)
            : ($todaysRevenue > 0 ? 100.0 : 0.0);

        $revenueSparkline = collect(range(6, 0))->map(function (int $daysAgo) {
            $day = now()->subDays($daysAgo)->startOfDay();

            return (float) Order::whereBetween('created_at', [$day, $day->copy()->endOfDay()])
                ->whereIn('order_status', StorePerformanceService::REVENUE_STATUSES)
                ->sum('total_amount');
        })->values()->all();

        $statusOrder = [
            ['key' => 'pending_payment', 'label' => 'Perlu Konfirmasi', 'icon' => 'clock'],
            ['key' => 'processing', 'label' => 'Diproses', 'icon' => 'refresh'],
            ['key' => 'shipped', 'label' => 'Dikirim', 'icon' => 'truck'],
            ['key' => 'delivered', 'label' => 'Sampai', 'icon' => 'check-circle'],
            ['key' => 'return_in_process', 'label' => 'Retur Diproses', 'icon' => 'package'],
        ];

        $statusSummary = Order::select(
            'order_status',
            DB::raw('count(*) as total'),
            DB::raw('sum(total_amount) as total_value'),
        )
            ->whereIn('order_status', collect($statusOrder)->pluck('key'))
            ->groupBy('order_status')
            ->get()
            ->keyBy('order_status');

        $attention = [
            [
                'key' => 'confirm_overdue',
                'label' => 'Perlu Konfirmasi > 24 Jam',
                'count' => Order::where('order_status', 'pending_payment')
                    ->where('created_at', '<', now()->subDay())
                    ->count(),
                'href' => route('admin.orders.index', ['order_status' => 'pending_payment']),
            ],
            [
                'key' => 'processing_overdue',
                'label' => 'Diproses > 24 Jam',
                'count' => Order::where('order_status', 'processing')
                    ->where('updated_at', '<', now()->subDay())
                    ->count(),
                'href' => route('admin.orders.index', ['order_status' => 'processing']),
            ],
            [
                'key' => 'delivered_stale',
                'label' => 'Pesanan Sampai > 2 Hari Belum Selesai',
                'count' => Order::where('order_status', 'delivered')
                    ->where('updated_at', '<', now()->subDays(2))
                    ->count(),
                'href' => route('admin.orders.index', ['order_status' => 'delivered']),
            ],
            [
                'key' => 'return_overdue',
                'label' => 'Retur Diproses > 7 Hari',
                'count' => Order::where('order_status', 'return_in_process')
                    ->where('updated_at', '<', now()->subDays(7))
                    ->count(),
                'href' => route('admin.orders.index', ['order_status' => 'return_in_process']),
            ],
            [
                'key' => 'issue_orders',
                'label' => 'Pesanan Perlu Perhatian',
                'count' => Order::where('order_status', 'issue')->count(),
                'href' => route('admin.orders.index', ['order_status' => 'issue']),
            ],
        ];

        // Nilai plus: alert operasional di luar Figma status-aging.
        $failedMedia = ProductMedia::query()
            ->whereNull('media_asset_id')
            ->where('status', 'failed')
            ->count();
        $failedMediaAssets = MediaAsset::where('status', 'failed')->count();
        $pendingMedia = ProductMedia::query()
            ->whereNull('media_asset_id')
            ->whereIn('status', ['pending', 'downloading'])
            ->count();
        $pendingMediaAssets = MediaAsset::whereIn('status', ['pending', 'downloading'])->count();
        $failedImports = ImportJob::where('status', 'failed')->count();
        $failedMessages = WhatsAppMessage::where('status', 'failed')->count();
        $runningImports = ImportJob::running()->count();

        $importStatusCounts = ImportJob::query()
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');
        $recentImports = ImportJob::query()
            ->latest('updated_at')
            ->limit(4)
            ->get(['id', 'source_file_name', 'status', 'failed_rows', 'updated_at'])
            ->map(fn (ImportJob $job) => [
                'id' => $job->id,
                'file_name' => $job->source_file_name,
                'status' => $job->status,
                'failed_rows' => (int) ($job->failed_rows ?? 0),
                'updated_at' => optional($job->updated_at)?->toIso8601String(),
                'href' => route('admin.imports.show', $job),
            ])
            ->values()
            ->all();
        $attachmentStatusCounts = ProductMedia::query()
            ->where('visibility', '!=', 'archived')
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');
        $assetStatusCounts = MediaAsset::query()
            ->where('visibility', '!=', 'archived')
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');
        $countStatuses = static function ($counts, array $statuses): int {
            return (int) collect($statuses)->sum(fn (string $status) => (int) ($counts[$status] ?? 0));
        };
        $importMediaSummary = [
            'imports' => [
                'running' => $runningImports,
                'failed' => (int) ($importStatusCounts['failed'] ?? 0),
                'completed' => (int) ($importStatusCounts['completed'] ?? 0),
                'failed_rows' => (int) ImportJob::sum('failed_rows'),
                'recent' => $recentImports,
                'href' => route('admin.imports.index'),
            ],
            'media' => [
                'attachments' => [
                    'ready' => (int) ($attachmentStatusCounts['downloaded'] ?? 0),
                    'pending' => $countStatuses($attachmentStatusCounts, ['pending', 'downloading']),
                    'failed' => (int) ($attachmentStatusCounts['failed'] ?? 0),
                    'archived' => (int) ProductMedia::where('visibility', 'archived')->count(),
                ],
                'shared_assets' => [
                    'ready' => (int) ($assetStatusCounts['ready'] ?? 0),
                    'pending' => $countStatuses($assetStatusCounts, ['pending', 'downloading']),
                    'failed' => (int) ($assetStatusCounts['failed'] ?? 0),
                    'archived' => (int) MediaAsset::where('visibility', 'archived')->count(),
                ],
                'href' => route('admin.media.index'),
            ],
        ];

        if ($failedMedia > 0) {
            $attention[] = [
                'key' => 'failed_media_attachments',
                'label' => 'Attachment Media Gagal Unduh',
                'count' => $failedMedia,
                'href' => route('admin.media.index', ['status' => 'failed']),
            ];
        }
        if ($failedMediaAssets > 0) {
            $attention[] = [
                'key' => 'failed_media_assets',
                'label' => 'Shared Media Gagal Diproses',
                'count' => $failedMediaAssets,
                'href' => route('admin.media.index', ['asset_status' => 'failed']),
            ];
        }
        if ($pendingMedia + $pendingMediaAssets > 0) {
            $attention[] = [
                'key' => 'pending_media',
                'label' => 'Media Menunggu Diproses',
                'count' => $pendingMedia + $pendingMediaAssets,
                'href' => route('admin.media.index'),
            ];
        }
        if ($failedImports > 0) {
            $attention[] = [
                'key' => 'failed_imports',
                'label' => 'Import Gagal',
                'count' => $failedImports,
                'href' => route('admin.imports.index', ['status' => 'failed']),
            ];
        }
        if ($failedMessages > 0) {
            $attention[] = [
                'key' => 'failed_wa',
                'label' => 'Pesan WhatsApp Gagal',
                'count' => $failedMessages,
                'href' => route('admin.whatsapp.messages.index'),
            ];
        }
        if ($runningImports > 0) {
            $attention[] = [
                'key' => 'running_imports',
                'label' => 'Import Sedang Berjalan',
                'count' => $runningImports,
                'href' => route('admin.imports.index'),
            ];
        }

        $attention = collect($attention)
            ->filter(fn (array $item) => $item['count'] > 0)
            ->values()
            ->all();

        $performaPeriod = (string) $request->query('performa_period', 'today');
        if (! in_array($performaPeriod, ['today', 'yesterday', 'last_7', 'last_30', 'this_month'], true)) {
            $performaPeriod = 'today';
        }

        $performance = $this->performance->build($performaPeriod);
        $trafficKpis = collect($performance['sections'] ?? [])
            ->firstWhere('key', 'traffic')['kpis'] ?? [];
        $performaMetrics = collect($trafficKpis)
            ->whereIn('key', ['visitors', 'conversion', 'new_customers', 'repeat_customers'])
            ->values()
            ->all();
        $revenueChart = collect($performance['charts'] ?? [])->firstWhere('key', 'revenue') ?? [];

        $promoProducts = Product::visible()
            ->with(['activeVariants', 'attributes'])
            ->whereHas('attributes', function ($attr) {
                $attr->whereIn('attribute_name', [
                    'promo_compare_price',
                    'compare_price',
                    'harga_asli',
                    'harga_sebelum_diskon',
                    'promo_flash_sale',
                    'flash_sale',
                ]);
            })
            ->orderByDesc('homepage_popular')
            ->orderBy('homepage_popular_sort')
            ->orderBy('id')
            ->get()
            ->map(function (Product $product) {
                $promo = ProductPromotionMetadata::forProduct($product, applyGlobalEventDiscount: false);

                return [
                    'id' => $product->id,
                    'parent_sku' => $product->parent_sku,
                    'name' => $product->name,
                    'discount_percent' => $promo['discount_percent'],
                    'flash_sale' => $promo['flash_sale'],
                    'homepage_popular' => (bool) $product->homepage_popular,
                    'href' => route('admin.products.show', $product),
                ];
            })
            ->filter(fn (array $row) => $row['discount_percent'] !== null || $row['flash_sale'])
            ->values();

        $recentOrders = Order::query()
            ->with(['shippingRecords' => fn ($q) => $q->latest('id')])
            ->withCount('items')
            ->withSum('items as units_count', 'quantity')
            ->latest()
            ->limit(8)
            ->get()
            ->map(function (Order $order) {
                $phone = PhoneNumber::normalize($order->customer_phone) ?? $order->customer_phone;
                $shipping = $order->shippingRecords->first(
                    fn ($record) => $record->status !== 'cancelled'
                ) ?? $order->shippingRecords->first();

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'created_at' => optional($order->created_at)?->toIso8601String(),
                    'updated_at' => optional($order->updated_at)?->toIso8601String(),
                    'customer_name' => $order->customer_name,
                    'shipping_city' => $order->shipping_city,
                    'shipping_province' => $order->shipping_province,
                    'customer_phone' => $order->customer_phone,
                    'order_status' => $order->order_status,
                    'payment_status' => $order->payment_status,
                    'shipping_status' => $order->shipping_status,
                    'waybill_number' => $shipping?->waybill_number,
                    'shipping_track' => OrderTrackingPresenter::forOrder($order, $shipping, withTimeline: false),
                    'total_amount' => (float) $order->total_amount,
                    'payment_method' => $order->payment_method,
                    'product_count' => (int) $order->items_count,
                    'unit_count' => (int) ($order->units_count ?? 0),
                    'href' => route('admin.orders.show', $order),
                    'shipping_href' => route('admin.orders.show', $order).'#lacak-pesanan',
                    'whatsapp_url' => $phone
                        ? 'https://wa.me/'.$phone
                        : null,
                ];
            })
            ->all();

        return Inertia::render('Admin/Dashboard', [
            'greetingName' => auth()->user()?->name ?? 'Admin',
            'todayLabel' => now()->locale('id')->translatedFormat('l, d F Y'),
            'generatedAt' => now()->toIso8601String(),
            'productCount' => Product::visible()->count(),
            'jntReadiness' => $jntReadiness,
            'integrationReadiness' => [
                [
                    'key' => 'whatsapp',
                    'label' => 'WhatsApp',
                    'icon' => 'whatsapp',
                    'ready' => (bool) ($whatsappReadiness['configured'] ?? false),
                    'verified' => false,
                    'status_label' => ($whatsappReadiness['configured'] ?? false)
                        ? 'Konfigurasi ada, live check belum dilakukan'
                        : 'Konfigurasi belum lengkap',
                    'detail' => ($whatsappReadiness['default_provider'] ?? 'meta').' provider',
                    'href' => route('admin.whatsapp.connection'),
                ],
                [
                    'key' => 'media',
                    'label' => 'Media / R2',
                    'icon' => 'image',
                    'ready' => $mediaIsReady,
                    'verified' => false,
                    'status_label' => $mediaIsReady
                        ? 'Konfigurasi ada, object storage belum diuji'
                        : 'Konfigurasi object storage belum lengkap',
                    'detail' => $mediaDriver === 's3' ? 'Object storage aktif' : 'Disk lokal development',
                    'href' => route('admin.media.index'),
                ],
                [
                    'key' => 'queue',
                    'label' => 'Queue worker',
                    'icon' => 'refresh',
                    'ready' => $queueIsReady,
                    'verified' => false,
                    'status_label' => $queueIsReady
                        ? 'Konfigurasi ada, worker belum diverifikasi'
                        : 'Worker perlu dipisahkan dari request',
                    'detail' => $queueConnection === 'sync'
                        ? 'Sync aktif, worker belum terpisah'
                        : 'Konfigurasi '.$queueConnection,
                    'href' => route('admin.settings.index'),
                ],
                [
                    'key' => 'jnt',
                    'label' => 'J&T Cargo',
                    'icon' => 'truck',
                    'ready' => (bool) $jntReadiness['client_ready'],
                    'verified' => false,
                    'status_label' => $jntReadiness['client_ready']
                        ? 'Kredensial ada, koneksi live belum diuji'
                        : 'Kredensial belum lengkap',
                    'detail' => $jntReadiness['client_ready']
                        ? $jntReadiness['environment']
                        : 'Kredensial belum lengkap',
                    'href' => route('admin.settings.index'),
                ],
            ],
            'importMediaSummary' => $importMediaSummary,
            'omzet' => [
                'revenue' => $todaysRevenue,
                'orders' => $todaysOrders,
                'units' => $todaysUnits,
                'change_percent' => $revenueChangePercent,
                'orders_delta' => $todaysOrders - $yesterdaysOrders,
                'units_delta' => $todaysUnits - $yesterdaysUnits,
                'sparkline' => $revenueSparkline,
            ],
            'financial' => [
                'pending_payment_amount' => (float) $pendingPaymentQuery->sum('total_amount'),
                'pending_payment_orders' => (int) $pendingPaymentQuery->count(),
                'active_order_amount' => (float) $activeOrdersQuery->sum('total_amount'),
                'active_order_count' => (int) $activeOrdersQuery->count(),
                'received_today_amount' => (float) $paymentsReceivedTodayQuery->sum('amount'),
                'received_today_count' => (int) $paymentsReceivedTodayQuery->count(),
            ],
            'performa' => [
                'period' => $performaPeriod,
                'period_label' => $performance['range']['label'] ?? 'Hari ini',
                'period_options' => [
                    ['value' => 'today', 'label' => 'Hari Ini'],
                    ['value' => 'yesterday', 'label' => 'Kemarin'],
                    ['value' => 'last_7', 'label' => '7 Hari Terakhir'],
                    ['value' => 'last_30', 'label' => '30 Hari Terakhir'],
                    ['value' => 'this_month', 'label' => 'Bulan Ini'],
                ],
                'metrics' => $performaMetrics,
                'trend' => [
                    'total' => (float) ($revenueChart['total'] ?? 0),
                    'total_format' => $revenueChart['total_format'] ?? 'currency',
                    'granularity' => $performance['range']['granularity'] ?? 'day',
                    'series' => $revenueChart['series'] ?? [],
                ],
                'detail_href' => route('admin.analytics.store-performance', ['period' => $performaPeriod]),
            ],
            'statusOrder' => collect($statusOrder)->map(fn ($row) => [
                ...$row,
                'total' => (int) ($statusSummary[$row['key']]?->total ?? 0),
                'total_value' => (float) ($statusSummary[$row['key']]?->total_value ?? 0),
                'href' => route('admin.orders.index', ['order_status' => $row['key']]),
            ])->values()->all(),
            'attention' => $attention,
            'quickActions' => [
                [
                    'label' => 'Tambah Produk',
                    'description' => 'Buat produk katalog baru',
                    'href' => route('admin.products.create'),
                    'icon' => 'package',
                ],
                [
                    'label' => 'Mulai Import',
                    'description' => 'Upload katalog Shopee atau internal',
                    'href' => route('admin.imports.create'),
                    'icon' => 'upload',
                ],
                [
                    'label' => 'Lihat Pending Payment',
                    'description' => 'Periksa pesanan yang belum dibayar',
                    'href' => route('admin.orders.index', ['order_status' => 'pending_payment']),
                    'icon' => 'clock',
                ],
                [
                    'label' => 'Kelola Media',
                    'description' => 'Cek foto produk dan shared asset',
                    'href' => route('admin.media.index'),
                    'icon' => 'images',
                ],
            ],
            'recentOrders' => $recentOrders,
            'promoProducts' => $promoProducts->take(6)->all(),
            'promoTotal' => $promoProducts->count(),
            'topEngagedProducts' => $this->productEngagement->topProducts($performaPeriod, 8),
        ]);
    }
}
