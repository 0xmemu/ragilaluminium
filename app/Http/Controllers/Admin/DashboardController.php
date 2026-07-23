<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\ImportJob;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\WhatsAppMessage;
use App\Support\PhoneNumber;
use App\Support\ProductPromotionMetadata;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $today = now()->startOfDay();
        $yesterday = now()->subDay()->startOfDay();

        $todaysOrders = Order::where('created_at', '>=', $today)->count();
        $todaysRevenue = (float) Order::where('created_at', '>=', $today)->sum('total_amount');
        $yesterdaysRevenue = (float) Order::whereBetween('created_at', [$yesterday, $today])->sum('total_amount');

        $todaysUnits = (int) OrderItem::query()
            ->whereHas('order', fn ($q) => $q->where('created_at', '>=', $today))
            ->sum('quantity');

        $revenueChangePercent = $yesterdaysRevenue > 0
            ? round((($todaysRevenue - $yesterdaysRevenue) / $yesterdaysRevenue) * 100, 1)
            : ($todaysRevenue > 0 ? 100.0 : 0.0);

        // Sparkline 7 hari: omzet harian (untuk kartu Omset).
        $revenueSparkline = collect(range(6, 0))->map(function (int $daysAgo) {
            $day = now()->subDays($daysAgo)->startOfDay();

            return (float) Order::whereBetween('created_at', [$day, $day->copy()->endOfDay()])
                ->sum('total_amount');
        })->values()->all();

        $statusOrder = [
            ['key' => 'pending_payment', 'label' => 'Perlu Konfirmasi', 'icon' => 'alert-circle'],
            ['key' => 'processing', 'label' => 'Diproses', 'icon' => 'package'],
            ['key' => 'shipped', 'label' => 'Dikirim', 'icon' => 'truck'],
            ['key' => 'delivered', 'label' => 'Sampai', 'icon' => 'check-circle'],
            ['key' => 'return_in_process', 'label' => 'Retur Diproses', 'icon' => 'refresh'],
        ];

        $statusCounts = Order::select('order_status', DB::raw('count(*) as total'))
            ->whereIn('order_status', collect($statusOrder)->pluck('key'))
            ->groupBy('order_status')
            ->pluck('total', 'order_status');

        $attention = [
            [
                'key' => 'confirm_overdue',
                'label' => 'Pesanan menunggu konfirmasi > 24 jam',
                'count' => Order::where('order_status', 'pending_payment')
                    ->where('updated_at', '<', now()->subDay())
                    ->count(),
                'href' => route('admin.orders.index', ['order_status' => 'pending_payment']),
            ],
            [
                'key' => 'processing_overdue',
                'label' => 'Pesanan diproses > 24 jam',
                'count' => Order::where('order_status', 'processing')
                    ->where('updated_at', '<', now()->subDay())
                    ->count(),
                'href' => route('admin.orders.index', ['order_status' => 'processing']),
            ],
            [
                'key' => 'delivered_stale',
                'label' => 'Pesanan sampai belum selesai > 2 hari',
                'count' => Order::where('order_status', 'delivered')
                    ->where('updated_at', '<', now()->subDays(2))
                    ->count(),
                'href' => route('admin.orders.index', ['order_status' => 'delivered']),
            ],
            [
                'key' => 'return_overdue',
                'label' => 'Retur menunggu tindak lanjut > 7 hari',
                'count' => Order::where('order_status', 'return_in_process')
                    ->where('updated_at', '<', now()->subDays(7))
                    ->count(),
                'href' => route('admin.orders.index', ['order_status' => 'return_in_process']),
            ],
        ];

        $failedMedia = ProductMedia::where('status', 'failed')->count();
        $failedMessages = WhatsAppMessage::where('status', 'failed')->count();
        $runningImports = ImportJob::running()->count();

        $newCustomersToday = Customer::where('created_at', '>=', $today)->count();
        $repeatCustomers = (int) Customer::query()->has('orders', '>=', 2)->count();

        // Promo aktif (dipertahankan dari dashboard lama).
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
            ->withCount('items')
            ->withSum('items as units_count', 'quantity')
            ->latest()
            ->limit(8)
            ->get()
            ->map(function (Order $order) {
                $phone = PhoneNumber::normalize($order->customer_phone) ?? $order->customer_phone;

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
                'sparkline' => $revenueSparkline,
            ],
            'performa' => [
                'running_imports' => $runningImports,
                'failed_media' => $failedMedia,
                'failed_messages' => $failedMessages,
                'new_customers' => $newCustomersToday,
                'repeat_customers' => $repeatCustomers,
            ],
            'statusOrder' => collect($statusOrder)->map(fn ($row) => [
                ...$row,
                'total' => (int) ($statusCounts[$row['key']] ?? 0),
                'href' => route('admin.orders.index', ['order_status' => $row['key']]),
            ])->values()->all(),
            'attention' => $attention,
            'quickActions' => [
                [
                    'label' => 'Kelola promo / banner',
                    'description' => 'Atur banner dan produk promo di storefront',
                    'href' => route('admin.banners.index'),
                    'icon' => 'ticket',
                ],
                [
                    'label' => 'Import katalog',
                    'description' => 'Upload Excel Shopee / sinkron media',
                    'href' => route('admin.imports.index'),
                    'icon' => 'upload',
                ],
                [
                    'label' => 'WhatsApp otomatis',
                    'description' => 'Template & log pesan transaksi',
                    'href' => route('admin.whatsapp.templates.index'),
                    'icon' => 'whatsapp',
                ],
                [
                    'label' => 'Performa toko',
                    'description' => 'Ringkasan analitik operasional',
                    'href' => route('admin.analytics.store-performance'),
                    'icon' => 'trend-up',
                ],
            ],
            'recentOrders' => $recentOrders,
            'promoProducts' => $promoProducts->take(6)->all(),
            'promoTotal' => $promoProducts->count(),
            'stats' => [
                'todaysOrders' => $todaysOrders,
                'todaysRevenue' => $todaysRevenue,
                'pendingPayment' => (int) ($statusCounts['pending_payment'] ?? 0),
                'inTransit' => Order::whereIn('shipping_status', ['in_process', 'in_transit'])->count(),
                'needsAttention' => collect($attention)->sum('count'),
                'runningImports' => $runningImports,
                'failedMedia' => $failedMedia,
                'failedMessages' => $failedMessages,
            ],
        ]);
    }
}
