<?php

namespace App\Http\Controllers;

use App\Models\CmsModelProduct;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Services\ModelProductService;
use App\Support\CaraPemesananSettings;
use App\Support\CatalogLabels;
use App\Support\CmsDocumentSettings;
use App\Support\FaqSettings;
use App\Support\InstallationGallery;
use App\Support\InstallationPageSettings;
use App\Support\ModelProductPresentation;
use App\Support\ProblemsSolutionsSettings;
use App\Support\TestimonialPageSettings;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PageController extends Controller
{
    protected function showPage(string $slug): Response
    {
        $page = CmsPage::where('slug', $slug)->published()->first();

        $title = $page?->title ?? str_replace('-', ' ', ucfirst($slug));
        $heading = '';
        $body = '<p>Konten belum tersedia.</p>';

        $updatedAt = null;
        if ($page) {
            $content = is_array($page->content) ? $page->content : [];
            $heading = trim((string) ($content['heading'] ?? ''));
            $raw = is_array($page->content)
                ? (string) ($content['html'] ?? $content['body'] ?? '')
                : (is_string($page->content) ? $page->content : '');
            if ($raw !== '') {
                $body = CmsDocumentSettings::bodyToHtml($raw);
            }
            $updatedAt = optional($page->updated_at)?->timezone(config('app.timezone'))->translatedFormat('d F Y');
        }

        return Inertia::render('Public/CmsPage', [
            'page' => [
                'title' => $title,
                'heading' => $heading,
                'body' => $body,
                'slug' => $slug,
                'updated_at_label' => $updatedAt,
            ],
        ]);
    }

    public function about(): Response
    {
        $page = CmsPage::where('slug', 'tentang-kami')->published()->first();

        $title = $page?->title ?? 'Informasi Toko';
        $heading = '';
        $body = '';

        if ($page) {
            $content = is_array($page->content) ? $page->content : [];
            $heading = trim((string) ($content['heading'] ?? ''));
            $raw = is_array($page->content)
                ? (string) ($content['html'] ?? $content['body'] ?? '')
                : (is_string($page->content) ? $page->content : '');
            if ($raw !== '') {
                $body = CmsDocumentSettings::bodyToHtml($raw);
            }
        }

        return Inertia::render('Public/InformasiToko', [
            'page' => [
                'title' => $title,
                'heading' => $heading,
                'body' => $body,
            ],
        ]);
    }

    public function faq(): Response
    {
        return Inertia::render('Public/Faq', [
            'guide' => FaqSettings::forStorefront(),
        ]);
    }

    public function problemsSolutions(): Response
    {
        return Inertia::render('Public/MasalahSolusi', [
            'guide' => ProblemsSolutionsSettings::forStorefront(),
        ]);
    }

    public function contact(): Response
    {
        return $this->showPage('kontak');
    }

    public function privacy(): Response
    {
        return $this->showPage('kebijakan-privasi');
    }

    public function terms(): Response
    {
        return $this->showPage('ketentuan-layanan');
    }

    public function howToOrder(): Response
    {
        return Inertia::render('Public/HowToOrder', [
            'guide' => CaraPemesananSettings::forStorefront(),
        ]);
    }

    /**
     * Halaman gabungan "Apa kata pelanggan kami" + "Ulasan pelanggan di website".
     * Satu slug (/reviews) dengan nav/filter model produk ala halaman Model Produk.
     */
    public function reviews(Request $request): Response
    {
        $modelFilter = (string) $request->input('model', '');
        $modelCategory = null;
        $modelCode = null;
        if ($modelFilter !== '' && str_contains($modelFilter, '|')) {
            [$modelCategory, $modelCode] = explode('|', $modelFilter, 2);
            $modelCategory = strtoupper($modelCategory);
            $modelCode = strtoupper($modelCode);
        }

        // Nav model produk: pasangan kategori+model unik yang punya testimonial terbit.
        $navSource = CmsTestimonial::query()->published()
            ->whereHas('product')
            ->with('product:id,parent_sku,name,short_name,product_category,product_model')
            ->get();

        $modelNav = $navSource
            ->groupBy(function (CmsTestimonial $t) {
                $p = $t->product;
                return $p ? strtoupper($p->product_category).'|'.strtoupper((string) $p->product_model) : '__none';
            })
            ->filter(fn ($group, $key) => $key !== '__none')
            ->map(function ($group) {
                $product = $group->first()->product;
                return [
                    'value' => strtoupper($product->product_category).'|'.strtoupper((string) $product->product_model),
                    'label' => CatalogLabels::modelCardTitle($product->product_category, $product->product_model),
                    'count' => $group->count(),
                ];
            })
            ->values()
            ->sortBy('label')
            ->values()
            ->all();

        $published = CmsTestimonial::query()->published();

        if ($modelCategory && $modelCode) {
            $published->whereHas('product', function ($q) use ($modelCategory, $modelCode) {
                $q->where('product_category', $modelCategory)
                    ->where('product_model', $modelCode);
            });
        }

        // Hitung stats dari clone bersih (tanpa orderBy/limit yang melekat pada daftar kartu).
        $websiteTotal = (clone $published)->website()->count();
        $avgRating = (clone $published)->website()->whereNotNull('rating')->avg('rating');

        $testimonials = (clone $published)->with('product:id,parent_sku,name,short_name')
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->limit(120)
            ->get()
            ->map(fn (CmsTestimonial $t) => $t->toPublicArray())
            ->values()
            ->all();

        return Inertia::render('Public/Reviews', [
            'pageMeta' => TestimonialPageSettings::forStorefront(),
            'testimonials' => $testimonials,
            'modelNav' => $modelNav,
            'activeModel' => $modelCategory && $modelCode ? $modelCategory.'|'.$modelCode : null,
            'stats' => [
                'website_total' => $websiteTotal,
                'average_rating' => $avgRating !== null ? round((float) $avgRating, 1) : null,
            ],
            'installationsHref' => route('installation.index'),
        ]);
    }

    public function installations(Request $request): Response
    {
        $sort = (string) $request->input('sort', 'newest');
        if (! in_array($sort, ['newest', 'photos'], true)) {
            $sort = 'newest';
        }

        $modelCards = collect(InstallationGallery::modelCards(48));
        $hasModelMedia = $modelCards->contains(fn (array $item) => filled($item['image_url'] ?? null));
        $installations = ($hasModelMedia ? $modelCards : collect(InstallationGallery::productCards(48)))
            ->map(fn (array $item) => $this->installationCardPayload($item))
            ->all();
        $installations = $sort === "newest" ? array_values($installations) : $this->sortInstallationProducts($installations, $sort);

        $pageMeta = InstallationPageSettings::forStorefront();
        if (($pageMeta['heading'] ?? '') === InstallationPageSettings::DEFAULT_HEADING) {
            $pageMeta['heading'] = 'Hasil Pemasangan Kami';
        }

        return Inertia::render('Public/Installations', [
            'pageMeta' => $pageMeta,
            'installations' => $installations,
            'level' => 'model',
            'activeSort' => $sort,
            'reviewsHref' => route('reviews'),
        ]);
    }

    public function installationModel(string $category, string $model, Request $request): Response
    {
        $categoryCode = InstallationGallery::categoryFromSlug($category);
        $modelCode = InstallationGallery::modelFromSlug($model);
        if ($categoryCode === null || $modelCode === '') {
            abort(404);
        }

        $sort = (string) $request->input('sort', 'newest');
        if (! in_array($sort, ['newest', 'photos'], true)) {
            $sort = 'newest';
        }

        if ($categoryCode === 'LAINNYA') {
            $installations = collect(InstallationGallery::manualProductCards(48))
                ->map(fn (array $item) => $this->installationCardPayload($item))
                ->all();
            $title = 'Dokumentasi lainnya';
            $cover = $installations[0]['image_url'] ?? null;
            $photoCount = array_sum(array_map(fn (array $i) => (int) ($i['photo_count'] ?? 0), $installations));
            $videoCount = array_sum(array_map(fn (array $i) => (int) ($i['video_count'] ?? 0), $installations));
            $productCount = count($installations);
        } else {
            $modelCard = collect(app(ModelProductService::class)->storefrontCards())
                ->first(fn (array $item) => strtoupper((string) ($item['category'] ?? '')) === $categoryCode
                    && strtoupper((string) ($item['model'] ?? '')) === $modelCode);
            if (! is_array($modelCard)) {
                abort(404);
            }

            $installations = collect(InstallationGallery::productCardsForModel($categoryCode, $modelCode, 48))
                ->map(fn (array $item) => $this->installationCardPayload($item))
                ->all();
            $title = (string) ($modelCard['title'] ?? CatalogLabels::modelCardTitle($categoryCode, $modelCode));
            $cover = $installations[0]['image_url'] ?? null;
            $photoCount = array_sum(array_map(fn (array $i) => (int) ($i['photo_count'] ?? 0), $installations));
            $videoCount = array_sum(array_map(fn (array $i) => (int) ($i['video_count'] ?? 0), $installations));
            $productCount = max(0, (int) ($modelCard['count'] ?? 0));
        }

        $installations = $this->sortInstallationProducts($installations, $sort);
        $gallery = $categoryCode === 'LAINNYA' ? [] : InstallationGallery::mediaForModel($categoryCode, $modelCode);

        $featured = ($photoCount + $videoCount) > 0
            ? $this->installationCardPayload([
                'id' => 'featured-'.$categoryCode.'-'.$modelCode,
                'image_url' => $cover,
                'label' => $title,
                'product_count' => $productCount,
                'photo_count' => $photoCount,
                'video_count' => $videoCount,
                'category' => $categoryCode,
                'model' => $modelCode,
                'href' => '#inspirasi-pemasangan',
                'product_sku' => null,
                'product_href' => null,
            ], enrichPresentation: true)
            : null;

        return Inertia::render('Public/Installations', [
            'pageMeta' => [
                'title' => $title.' · Hasil Pemasangan',
                'heading' => $title,
                'subtitle' => 'Produk dalam model ini yang memiliki dokumentasi hasil pemasangan.',
            ],
            'installations' => $installations,
            'gallery' => $gallery,
            'featured' => $featured,
            'level' => 'product',
            'activeSort' => $sort,
            'modelMeta' => [
                'category' => $categoryCode,
                'model' => $modelCode,
                'label' => $title,
            ],
            'indexHref' => route('installation.index'),
            'reviewsHref' => route('reviews'),
        ]);
    }

    public function installationShow(string $parent_sku): Response
    {
        $product = Product::visible()
            ->where('parent_sku', $parent_sku)
            ->firstOrFail();

        $gallery = InstallationGallery::forProduct($product);
        if ($gallery === null) {
            abort(404);
        }

        $modelHref = InstallationGallery::modelHref(
            $gallery['product']['category'] ?? null,
            $gallery['product']['model'] ?? null,
        );

        return Inertia::render('Public/InstallationDetail', [
            'pageMeta' => InstallationPageSettings::forStorefront(),
            'product' => $gallery['product'],
            'media' => $gallery['media'],
            'indexHref' => route('installation.index'),
            'modelHref' => $modelHref,
            'modelLabel' => ($gallery['product']['category'] && $gallery['product']['model'])
                ? CatalogLabels::modelCardTitle(
                    $gallery['product']['category'],
                    $gallery['product']['model'],
                )
                : null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    protected function installationCardPayload(array $item, bool $enrichPresentation = false): array
    {
        $payload = [
            'id' => $item['id'],
            'image_url' => $item['image_url'] ?? null,
            'label' => $item['label'],
            'product_count' => (int) ($item['product_count'] ?? 0),
            'photo_count' => (int) ($item['photo_count'] ?? 0),
            'video_count' => (int) ($item['video_count'] ?? 0),
            'category' => $item['category'] ?? null,
            'model' => $item['model'] ?? null,
            'href' => $item['href'],
            'product_sku' => $item['product_sku'] ?? null,
            'product_href' => $item['product_href'] ?? null,
        ];

        if (! $enrichPresentation) {
            return $payload;
        }

        $category = strtoupper((string) ($payload['category'] ?? ''));
        $model = strtoupper((string) ($payload['model'] ?? ''));
        $presentation = ModelProductPresentation::forModel($model !== '' ? $model : 'MANUAL');

        $cmsDescription = null;
        if ($category !== '' && $model !== '' && $category !== 'LAINNYA') {
            $cmsDescription = CmsModelProduct::query()
                ->active()
                ->where('product_category', $category)
                ->where('product_model', $model)
                ->value('description');
            $cmsDescription = filled($cmsDescription) ? trim((string) $cmsDescription) : null;
        }

        $payload['subtitle'] = $presentation['subtitle'];
        $payload['desc'] = $cmsDescription ?: $presentation['desc'];
        $payload['highlights'] = $presentation['highlights'];

        return $payload;
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    protected function sortInstallationProducts(array $items, string $sort): array
    {
        usort($items, function (array $a, array $b) use ($sort) {
            return match ($sort) {
                'photos' => ((int) ($b['photo_count'] ?? 0) + (int) ($b['video_count'] ?? 0))
                    <=> ((int) ($a['photo_count'] ?? 0) + (int) ($a['video_count'] ?? 0)),
                default => strcmp((string) ($b['id'] ?? ''), (string) ($a['id'] ?? '')),
            };
        });

        return array_values($items);
    }
}
