<?php

namespace App\Http\Controllers;

use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Services\ModelProductService;
use App\Support\HomepageLayoutSettings;
use App\Support\HomepagePromotions;
use App\Support\InertiaCatalog;
use App\Support\InstallationGallery;
use App\Support\InstallationPageSettings;
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
            $popularProductCards = InertiaCatalog::popularProductCards(10);

            $featuredProducts = Product::visible()
                ->with(['mainImage', 'media', 'activeVariants', 'attributes'])
                ->withPopularityScore()
                ->latest()
                ->limit(8)
                ->get();

            $modelCards = app(ModelProductService::class)->storefrontCards(8);
            $categoryMenu = app(ModelProductService::class)->storefrontCategoryMenu();
        } catch (\Throwable) {
            $featuredProducts = collect();
            $popularProductCards = [];
            $modelCards = [];
            $categoryMenu = [];
        }

        try {
            $promoSlides = HomepagePromotions::slides();
        } catch (\Throwable) {
            // Promo CMS must not make the storefront unavailable.
        }

        try {
            $base = CmsTestimonial::query()
                ->published()
                ->with('product:id,parent_sku,name,short_name')
                ->orderBy('sort_order')
                ->orderByDesc('id');

            $marketplaceTestimonials = (clone $base)
                ->marketplace()
                ->withScreenshot()
                ->limit(12)
                ->get()
                ->map(fn (CmsTestimonial $t) => $t->toPublicArray())
                ->values()
                ->all();

            // Home: section ulasan website baru muncul jika ≥ 10 ulasan terbit.
            $websiteCount = (clone $base)->website()->count();
            $websiteTestimonials = $websiteCount >= 10
                ? (clone $base)
                    ->website()
                    ->limit(12)
                    ->get()
                    ->map(fn (CmsTestimonial $t) => $t->toPublicArray())
                    ->values()
                    ->all()
                : [];

            // Keep the customer section populated from published CMS reviews when
            // no marketplace channel has been configured yet.
            if ($marketplaceTestimonials === [] && $websiteTestimonials !== []) {
                $marketplaceTestimonials = array_slice($websiteTestimonials, 0, 12);
            }
        } catch (\Throwable) {
            $marketplaceTestimonials = [];
            $websiteTestimonials = [];
        }

        try {
            $installations = InstallationGallery::forHome(8);

            if ($installations === []) {
                $installations = collect(array_merge($marketplaceTestimonials, $websiteTestimonials))
                    ->filter(fn (array $item) => filled($item['image_url'] ?? null))
                    ->take(8)
                    ->map(fn (array $item) => [
                        'id' => (string) $item['id'],
                        'image' => $item['image_url'],
                        'label' => $item['customer_name'] ?? 'Hasil pemasangan',
                        'product_count' => 1,
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
            $installationMeta = InstallationPageSettings::forStorefront();
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
            'popularProducts' => $popularProductCards,
            'modelCards' => $modelCards,
            'categoryMenu' => $categoryMenu,
            'promoSlides' => $promoSlides,
            'marketplaceTestimonials' => $marketplaceTestimonials,
            'websiteTestimonials' => $websiteTestimonials,
            // Legacy alias (cuplikan marketplace) — hindari blank jika FE lama masih baca `testimonials`.
            'testimonials' => $marketplaceTestimonials,
            'installations' => $installations,
            'installationMeta' => $installationMeta,
            'homepageLayout' => $homepageLayout,
        ]);
    }
}
