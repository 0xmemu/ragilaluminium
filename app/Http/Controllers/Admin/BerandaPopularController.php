<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsPage;
use App\Models\Product;
use App\Services\ActivityLogService;
use App\Services\ProductEngagementService;
use App\Support\CatalogLabels;
use App\Support\HomepageLayoutSettings;
use App\Support\HomepagePromotions;
use App\Support\ProductCache;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pengaturan urutan "Paling Banyak Dipesan".
 *
 * Halaman ini mengatur URUTAN GALERI /products/all?from=paling-banyak-dipesan,
 * dan carousel beranda/katalog otomatis mengambil 10 produk teratas dari urutan
 * yang sama (lihat Product::palingBanyakDipesanOrderSql()).
 *
 * Kolom yang ditulis:
 * - `homepage_popular_sort`  : posisi kurasi 1-based; 0 = belum dikurasi.
 * - `homepage_popular`       : penanda "10 teratas" (konsumen: sorotan banner
 *                              otomatis, produk terkait, preload media).
 * - `homepage_popular_since` : kapan produk MASUK jendela carousel; dipakai
 *                              pembanding views/clicks sebelum vs sesudah.
 */
class BerandaPopularController extends Controller
{
    /** Jumlah kartu carousel "Paling Banyak Dipesan" (selaras popularProductCards(10)). */
    public const CAROUSEL_LIMIT = 10;

    public function __construct(protected ProductEngagementService $engagement)
    {
    }

    public function index(): Response
    {
        $eligible = Product::query()
            ->visible()
            ->with('mainImage')
            ->withPopularityScore()
            ->withSum('activeVariants as stock_sort', 'stock')
            ->orderByRaw(Product::palingBanyakDipesanOrderSql())
            ->get();

        $eligibleIds = array_fill_keys($eligible->pluck('id')->all(), true);

        // Produk yang tidak bisa tayang (arsip / tanpa varian) diletakkan paling
        // bawah: posisinya tidak berpengaruh ke storefront, tapi urutan geser
        // admin tetap disimpan agar tidak berubah saat dimuat ulang.
        $others = Product::query()
            ->whereNotIn('id', $eligible->pluck('id')->all() ?: [0])
            ->with('mainImage')
            ->orderBy('homepage_popular_sort')
            ->orderBy('id')
            ->get();

        $ordered = $eligible->concat($others);

        $windowLeft = self::CAROUSEL_LIMIT;
        $rows = $ordered->map(function (Product $product) use ($eligibleIds, &$windowLeft): array {
            $isEligible = isset($eligibleIds[$product->id]);
            // "Carousel" = posisi 10 teratas urutan ini = isi carousel toko.
            $inWindow = $isEligible && $windowLeft > 0;
            if ($inWindow) {
                $windowLeft--;
            }

            return [
                'id' => $product->id,
                'name' => $product->name,
                'parent_sku' => $product->parent_sku,
                'thumb_url' => $product->mainImage?->urlFor('thumb') ?? $product->mainImage?->urlFor('card'),
                'href' => route('admin.products.show', $product),
                'category_label' => CatalogLabels::category($product->product_category),
                'model_label' => CatalogLabels::model($product->product_model),
                'design_label' => CatalogLabels::design($product->design_variant),
                'is_eligible' => $isEligible,
                'in_window' => $inWindow,
                'since' => $product->homepage_popular_since?->toDateString(),
                'since_label' => $product->homepage_popular_since?->translatedFormat('d M Y'),
            ];
        })->values();

        $rows = $this->attachEngagement($rows, self::CAROUSEL_LIMIT)->all();

        return Inertia::render('Admin/Beranda/Popular', [
            'title' => 'Paling Banyak Dipesan',
            'description' => 'Atur urutan produk Paling Banyak Dipesan. Urutan ini berlaku di halaman daftar produk, dan '.self::CAROUSEL_LIMIT.' produk teratas mengisi carousel beranda serta halaman katalog.',
            'products' => $rows,
            'carouselLimit' => self::CAROUSEL_LIMIT,
            'submitUrl' => route('admin.beranda.popular.update'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'product_ids' => ['required', 'array', 'min:1'],
            'product_ids.*' => ['integer', 'exists:products,id'],
        ]);

        $orderedIds = array_values(array_unique(array_map('intval', $validated['product_ids'])));
        $eligibleIds = array_fill_keys(Product::query()->visible()->pluck('id')->all(), true);

        $windowLeft = self::CAROUSEL_LIMIT;
        $now = now();

        DB::transaction(function () use ($orderedIds, $eligibleIds, &$windowLeft, $now): void {
            $products = Product::query()->whereIn('id', $orderedIds)->get()->keyBy('id');

            foreach ($orderedIds as $position => $productId) {
                $product = $products->get($productId);
                if (! $product) {
                    continue;
                }

                // Posisi 1-based: 0 dipakai sebagai penanda "belum dikurasi"
                // sehingga urutan yang disusun admin selalu menang, sementara
                // produk yang belum pernah disentuh tetap ikut skor penjualan.
                $sortPosition = $position + 1;

                // Flag hanya untuk 10 teratas yang bisa tayang (konsumen lama).
                $isTopTen = isset($eligibleIds[$productId]) && $windowLeft > 0;
                if ($isTopTen) {
                    $windowLeft--;
                }

                // Catat kapan produk MASUK carousel; kalau sudah di dalam dan
                // masih di dalam, tanggalnya dipertahankan agar pembanding
                // "sebelum vs sesudah" tidak ikut bergeser tiap simpan.
                $since = $isTopTen
                    ? ($product->homepage_popular_since ?? $now)
                    : null;

                $product->forceFill([
                    'homepage_popular_sort' => $sortPosition,
                    'homepage_popular' => $isTopTen,
                    'homepage_popular_since' => $since,
                ])->save();
            }
        });

        $this->flushCaches();

        ActivityLogService::record(
            'cms.beranda_popular_updated',
            'cms_page',
            $this->berandaPageId(),
            [
                'ordered_count' => count($orderedIds),
                'carousel_limit' => self::CAROUSEL_LIMIT,
            ],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.beranda.popular.index')
            ->with('success', 'Urutan Paling Banyak Dipesan disimpan.');
    }

    /**
     * Tempelkan views/clicks "sebelum" dan "sesudah" jadi carousel untuk baris
     * di jendela carousel saja (permintaan owner: hanya 10 produk teratas).
     *
     * Jendela "sesudah" = sejak `homepage_popular_since` sampai hari ini.
     * Jendela "sebelum" = rentang SAMA PANJANG tepat sebelum tanggal itu, jadi
     * perbandingannya adil (bukan membandingkan 3 hari vs 3 bulan).
     *
     * @param  \Illuminate\Support\Collection<int, array<string, mixed>>  $rows
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    protected function attachEngagement($rows, int $limit)
    {
        $carouselIds = $rows->take($limit)
            ->filter(fn (array $row) => $row['in_window'])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $today = Carbon::today();

        // Rentang per produk (tanggal masuk carousel berbeda-beda).
        $windows = [];
        foreach ($rows->take($limit) as $row) {
            if (! $row['in_window'] || ! $row['since']) {
                continue;
            }

            $since = Carbon::parse($row['since']);

            // Sampai kemarin: hari ini belum selesai, jadi belum bisa dibandingkan
            // apple-to-apple dengan rentang penuh di jendela sebelumnya.
            $afterTo = $today->copy()->subDay();
            $afterFrom = $since->copy();

            if ($afterFrom->greaterThan($afterTo)) {
                // Baru masuk carousel hari ini; belum ada rentang pembanding.
                $windows[(int) $row['id']] = ['after' => null, 'before' => null];

                continue;
            }

            $days = $afterFrom->diffInDays($afterTo) + 1;
            $beforeTo = $afterFrom->copy()->subDay();
            $beforeFrom = $beforeTo->copy()->subDays($days - 1);

            $windows[(int) $row['id']] = [
                'after' => [$afterFrom, $afterTo],
                'before' => [$beforeFrom, $beforeTo],
            ];
        }

        $afterFrom = collect($windows)->pluck('after')->filter()->pluck(0)->min() ?? $today;
        $beforeFrom = collect($windows)->pluck('before')->filter()->pluck(0)->min() ?? $today;

        // Sekali ambil untuk rentang terlebar, lalu disaring per produk di PHP.
        $allFrom = collect([$afterFrom, $beforeFrom])->min();
        $allTo = $today;

        $metricRows = $this->metricSeries($carouselIds, Carbon::parse($allFrom), $allTo);

        // Angka eksisting SELURUH riwayat untuk SEMUA baris. Baris di luar
        // jendela carousel tidak punya tanggal masuk sorotan, jadi tidak ada
        // rentang "sebelum" yang sebanding: yang bisa ditampilkan hanya totalnya.
        $totals = $this->lifetimeTotals(
            $rows->pluck('id')->map(fn ($id) => (int) $id)->all()
        );

        return $rows->map(function (array $row, int $index) use ($windows, $metricRows, $totals, $limit): array {
            $row['views_total'] = $totals[$row['id']]['views'] ?? 0;
            $row['clicks_total'] = $totals[$row['id']]['clicks'] ?? 0;
            $row['views_before'] = null;
            $row['clicks_before'] = null;
            $row['views_after'] = null;
            $row['clicks_after'] = null;
            $row['delta_views'] = null;
            $row['delta_clicks'] = null;

            if ($index >= $limit || ! isset($windows[$row['id']])) {
                return $row;
            }

            $win = $windows[$row['id']];
            $series = $metricRows[$row['id']] ?? [];

            $sum = function (array $dates) use ($series): array {
                $views = 0;
                $clicks = 0;
                foreach ($dates as $date => $vals) {
                    $views += $vals['views'];
                    $clicks += $vals['clicks'];
                }

                return [$views, $clicks];
            };

            if ($win['after'] === null) {
                // Baru masuk hari ini: belum ada rentang "sesudah" yang utuh.
                [$row['views_after'], $row['clicks_after']] = $sum($series);

                return $row;
            }

            [$afterFrom, $afterTo] = $win['after'];
            [$beforeFrom, $beforeTo] = $win['before'];

            $afterDates = [];
            $beforeDates = [];
            foreach ($series as $date => $vals) {
                $d = Carbon::parse($date);
                if ($d->betweenIncluded($afterFrom, $afterTo)) {
                    $afterDates[$date] = $vals;
                }
                if ($d->betweenIncluded($beforeFrom, $beforeTo)) {
                    $beforeDates[$date] = $vals;
                }
            }

            [$row['views_after'], $row['clicks_after']] = $sum($afterDates);
            [$row['views_before'], $row['clicks_before']] = $sum($beforeDates);
            $row['delta_views'] = $row['views_after'] - $row['views_before'];
            $row['delta_clicks'] = $row['clicks_after'] - $row['clicks_before'];

            return $row;
        });
    }

    /**
     * Seri harian views/clicks per produk dari performance_metrics.
     *
     * @param  list<int>  $productIds
     * @return array<int, array<string, array{views: int, clicks: int}>>
     */
    protected function metricSeries(array $productIds, Carbon $from, Carbon $to): array
    {
        if ($productIds === []) {
            return [];
        }

        $wanted = array_fill_keys($productIds, true);
        $out = [];

        $rows = \App\Models\PerformanceMetric::query()
            ->whereIn('metric_name', [ProductEngagementService::METRIC_VIEWS, ProductEngagementService::METRIC_CLICKS])
            ->whereDate('metric_date', '>=', $from->toDateString())
            ->whereDate('metric_date', '<=', $to->toDateString())
            ->get(['metric_date', 'metric_name', 'metric_value', 'context']);

        foreach ($rows as $row) {
            $productId = (int) data_get($row->context, 'product_id', 0);
            if (! isset($wanted[$productId])) {
                continue;
            }

            $date = Carbon::parse($row->metric_date)->toDateString();
            $out[$productId][$date] ??= ['views' => 0, 'clicks' => 0];

            $value = (int) round((float) $row->metric_value);
            if ($row->metric_name === ProductEngagementService::METRIC_VIEWS) {
                $out[$productId][$date]['views'] += $value;
            } else {
                $out[$productId][$date]['clicks'] += $value;
            }
        }

        return $out;
    }

    /**
     * Total views/clicks SELURUH riwayat per produk (angka eksisting).
     *
     * Dipakai baris di luar jendela carousel: baris itu tidak punya tanggal masuk
     * sorotan, jadi tidak ada rentang "sebelum" yang sebanding. Yang ditampilkan
     * hanya total yang tercatat sampai hari ini.
     *
     * @param  list<int>  $productIds
     * @return array<int, array{views: int, clicks: int}>
     */
    protected function lifetimeTotals(array $productIds): array
    {
        $wanted = array_fill_keys($productIds, true);
        $out = [];
        foreach ($wanted as $id => $_) {
            $out[$id] = ['views' => 0, 'clicks' => 0];
        }

        if ($wanted === []) {
            return $out;
        }

        $rows = \App\Models\PerformanceMetric::query()
            ->whereIn('metric_name', [ProductEngagementService::METRIC_VIEWS, ProductEngagementService::METRIC_CLICKS])
            ->get(['metric_name', 'metric_value', 'context']);

        foreach ($rows as $row) {
            $productId = (int) data_get($row->context, 'product_id', 0);
            if (! isset($wanted[$productId])) {
                continue;
            }

            $value = (int) round((float) $row->metric_value);
            if ($row->metric_name === ProductEngagementService::METRIC_VIEWS) {
                $out[$productId]['views'] += $value;
            } else {
                $out[$productId]['clicks'] += $value;
            }
        }

        return $out;
    }

    /** Carousel & galeri di-cache; banner otomatis ikut memakai urutan ini. */
    protected function flushCaches(): void
    {
        Cache::forget('home.popular_cards');
        ProductCache::flushProducts();
        HomepagePromotions::flushCache();
    }

    protected function berandaPageId(): int
    {
        return (int) CmsPage::query()->where('slug', HomepageLayoutSettings::PAGE_SLUG)->value('id');
    }
}
