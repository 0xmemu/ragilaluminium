<?php

namespace App\Http\Controllers;

use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Support\HomepageLayoutSettings;
use App\Support\HomepagePromotions;
use App\Support\InertiaCatalog;
use App\Support\InstallationGallery;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function index(Request $request): Response
    {
        $promoSlides = [];
        $testimonials = [];
        $installations = [];
        $installationMeta = null;

        try {
            // Home “Paling Banyak Dipesan”: kurasi admin (max 10), fallback penjualan website.
            $popularProducts = Product::visible()
                ->homepagePopular()
                ->with(['mainImage', 'media', 'activeVariants', 'attributes'])
                ->withSum('orderItems as sold_count', 'quantity')
                ->orderBy('homepage_popular_sort')
                ->orderByDesc('id')
                ->limit(10)
                ->get();

            if ($popularProducts->isEmpty()) {
                $popularProducts = Product::visible()
                    ->with(['mainImage', 'media', 'activeVariants', 'attributes'])
                    ->withSum('orderItems as sold_count', 'quantity')
                    ->orderByWebsiteSales()
                    ->limit(10)
                    ->get();
            }

            $featuredProducts = Product::visible()
                ->with(['mainImage', 'media', 'activeVariants', 'attributes'])
                ->withSum('orderItems as sold_count', 'quantity')
                ->latest()
                ->limit(8)
                ->get();

            $modelCards = app(\App\Services\ModelProductService::class)->storefrontCards(8);
        } catch (\Throwable) {
            $featuredProducts = collect();
            $popularProducts = collect();
            $modelCards = [];
        }

        try {
            $promoSlides = HomepagePromotions::slides();
        } catch (\Throwable) {
            // Promo CMS must not make the storefront unavailable.
        }

        try {
            // Gabungan ulasan Shopee (admin) + website/produk dalam satu daftar.
            $testimonials = CmsTestimonial::query()
                ->published()
                ->with('product:id,parent_sku,name,short_name')
                ->orderBy('sort_order')
                ->orderByDesc('id')
                ->limit(12)
                ->get()
                ->map(fn (CmsTestimonial $t) => $t->toPublicArray())
                ->values()
                ->all();
        } catch (\Throwable) {
            $testimonials = [];
        }

        try {
            $installations = InstallationGallery::forHome(8);

            if ($installations === []) {
                $installations = collect($testimonials)
                    ->filter(fn (array $item) => filled($item['image_url'] ?? null))
                    ->take(8)
                    ->map(fn (array $item) => [
                        'id' => (string) $item['id'],
                        'image' => $item['image_url'],
                        'label' => $item['customer_name'] ?? 'Hasil pemasangan',
                        'photo_count' => 1,
                        'video_count' => 0,
                        'href' => route('installation.index'),
                        'product_sku' => null,
                    ])
                    ->values()
                    ->all();
            }
        } catch (\Throwable) {
            $installations = [];
        }

        try {
            $installationMeta = \App\Support\InstallationPageSettings::forStorefront();
        } catch (\Throwable) {
            $installationMeta = null;
        }

        try {
            $homepageLayout = HomepageLayoutSettings::forStorefront();
        } catch (\Throwable) {
            $homepageLayout = [
                'sections' => array_map(
                    fn (array $s) => ['key' => $s['key'], 'enabled' => $s['enabled']],
                    HomepageLayoutSettings::DEFAULT_SECTIONS,
                ),
                'service_highlights' => HomepageLayoutSettings::DEFAULT_SERVICE_HIGHLIGHTS,
                'how_to_order' => [
                    'title' => HomepageLayoutSettings::DEFAULT_HOW_TO_ORDER['title'],
                    'subtitle' => HomepageLayoutSettings::DEFAULT_HOW_TO_ORDER['subtitle'],
                    'steps' => collect(HomepageLayoutSettings::DEFAULT_HOW_TO_ORDER['steps'])
                        ->values()
                        ->map(fn (array $step, int $i) => [
                            'step' => str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT),
                            'title' => $step['title'],
                            'description' => $step['description'],
                        ])
                        ->all(),
                ],
            ];
        }

        return Inertia::render('Public/Home', [
            'featuredProducts' => InertiaCatalog::productCards($featuredProducts),
            'popularProducts' => InertiaCatalog::productCards($popularProducts),
            'modelCards' => $modelCards,
            'promoSlides' => $promoSlides,
            'testimonials' => $testimonials,
            'installations' => $installations,
            'installationMeta' => $installationMeta,
            'homepageLayout' => $homepageLayout,
        ]);
    }
}
