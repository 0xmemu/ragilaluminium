<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ImportJob;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\WhatsAppMessage;
use App\Services\ProductEngagementService;
use App\Services\StorePerformanceService;
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
    ) {}

    public function index(Request $request): Response
    {
        $today = now()->startOfDay();
        $yesterday = now()->subDay()->startOfDay();
        $yesterdayEnd = $today->copy()->subSecond();

        $todaysOrders = Order::where('created_at', '>=', $today)->count();
        $todaysRevenue = (float) Order::where('created_at', '>=', $today)->sum('total_amount');
        $yesterdaysOrders = Order::whereBetween('created_at', [$yesterday, $yesterdayEnd])->count();
        $yesterdaysRevenue = (float) Order::whereBetween('created_at', [$yesterday, $yesterdayEnd])->sum('total_amount');

        $todaysUnits = (int) OrderItem::query()
            ->whereHas('order', fn ($q) => $q->where('created_at', '>=', $today))
            ->sum('quantity');
        $yesterdaysUnits = (int) OrderItem::query()
            ->whereHas('order', fn ($q) => $q->whereBetween('created_at', [$yesterday, $yesterdayEnd]))
            ->sum('quantity');

        $revenueChangePercent = $yesterdaysRevenue > 0
            ? round((($todaysRevenue - $yesterdaysRevenue) / $yesterdaysRevenue) * 100, 1)
            : ($todaysRevenue > 0 ? 100.0 : 0.0);

        $revenueSparkline = collect(range(6, 0))->map(function (int $daysAgo) {
            $day = now()->subDays($daysAgo)->startOfDay();

            return (float) Order::whereBetween('created_at', [$day, $day->copy()->endOfDay()])
                ->sum('total_amount');
        })->values()->all();

        $statusOrder = [
            ['key' => 'pending_payment', 'label' => 'Perlu Konfirmasi', 'icon' => 'clock'],
            ['key' => 'processing', 'label' => 'Diproses', 'icon' => 'refresh'],
            ['key' => 'shipped', 'label' => 'Dikirim', 'icon' => 'truck'],
            ['key' => 'delivered', 'label' => 'Sampai', 'icon' => 'check-circle'],
            ['key' => 'return_in_process', 'label' => 'Retur Diproses', 'icon' => 'package'],
        ];

        $statusCounts = Order::select('order_status', DB::raw('count(*) as total'))
            ->whereIn('order_status', collect($statusOrder)->pluck('key'))
            ->groupBy('order_status')
            ->pluck('total', 'order_status');

        $attention = [
            [
                'key' => 'confirm_overdue',
                'label' => 'Perlu Konfirmasi > 24 Jam',
                'count' => Order::where('order_status', 'pending_payment')
                    ->where('updated_at', '<', now()->subDay())
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
        ];

        // Nilai plus: alert operasional di luar Figma status-aging.
        $failedMedia = ProductMedia::where('status', 'failed')->count();
        $failedMessages = WhatsAppMessage::where('status', 'failed')->count();
        $runningImports = ImportJob::running()->count();

        if ($failedMedia > 0) {
            $attention[] = [
                'key' => 'failed_media',
                'label' => 'Media Produk Gagal Unduh',
                'count' => $failedMedia,
                'href' => route('admin.media.index', ['status' => 'failed']),
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
                    'shipping_status' => $order->shipping_status,
                    'waybill_number' => $shipping?->waybill_number,
                    'shipping_track' => OrderTrackingPresenter::forOrder($order, $shipping, withTimeline: false),
                    'total_amount' => (float) $order->total_amount,
                    'payment_method' => $order->payment_method,
                    'product_count' => (int) $order->items_count,
                    'unit_count' => (int) ($order->units_count ?? 0),
                    'href' => route('admin.orders.show', $order),
                    'whatsapp_url' => $phone
                        ? 'https://wa.me/'.$phone
                        : null,
                ];
            })
            ->all();

        return Inertia::render('Admin/Dashboard', [
            'greetingName' => auth()->user()?->name ?? 'Admin',
            'todayLabel' => now()->locale('id')->translatedFormat('l, d F Y'),
            'omzet' => [
                'revenue' => $todaysRevenue,
                'orders' => $todaysOrders,
                'units' => $todaysUnits,
                'change_percent' => $revenueChangePercent,
                'orders_delta' => $todaysOrders - $yesterdaysOrders,
                'units_delta' => $todaysUnits - $yesterdaysUnits,
                'sparkline' => $revenueSparkline,
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
                'detail_href' => route('admin.analytics.store-performance', ['period' => $performaPeriod]),
            ],
            'statusOrder' => collect($statusOrder)->map(fn ($row) => [
                ...$row,
                'total' => (int) ($statusCounts[$row['key']] ?? 0),
                'href' => route('admin.orders.index', ['order_status' => $row['key']]),
            ])->values()->all(),
            'attention' => $attention,
            'quickActions' => [
                [
                    'label' => 'Buat Promo Toko',
                    'description' => 'Tambah banner promo beranda',
                    'href' => route('admin.banners.create'),
                    'icon' => 'ticket',
                ],
                [
                    'label' => 'Buat Voucher',
                    'description' => 'Buat kode diskon checkout',
                    'href' => route('admin.vouchers.create'),
                    'icon' => 'voucher',
                ],
                [
                    'label' => 'WhatsApp Otomatis',
                    'description' => 'Template & status otomasi WA',
                    'href' => route('admin.whatsapp.templates.index'),
                    'icon' => 'whatsapp',
                ],
                [
                    'label' => 'Lihat Performa Toko',
                    'description' => 'Analitik penjualan & kunjungan',
                    'href' => route('admin.analytics.store-performance'),
                    'icon' => 'trend-up',
                ],
            ],
            'recentOrders' => $recentOrders,
            'promoProducts' => $promoProducts->take(6)->all(),
            'promoTotal' => $promoProducts->count(),
            'topEngagedProducts' => $this->productEngagement->topProducts($performaPeriod, 8),
        ]);
    }
}
