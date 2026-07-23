<?php

namespace App\Http\Controllers;

use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Support\InstallationGallery;
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

        if ($page) {
            $content = is_array($page->content) ? $page->content : [];
            $heading = trim((string) ($content['heading'] ?? ''));
            $raw = is_array($page->content)
                ? (string) ($content['html'] ?? $content['body'] ?? '')
                : (is_string($page->content) ? $page->content : '');
            if ($raw !== '') {
                $body = \App\Support\CmsDocumentSettings::bodyToHtml($raw);
            }
        }

        return Inertia::render('Public/CmsPage', [
            'page' => [
                'title' => $title,
                'heading' => $heading,
                'body' => $body,
                'slug' => $slug,
            ],
        ]);
    }

    public function about(): Response
    {
        return $this->showPage('tentang-kami');
    }

    public function faq(): Response
    {
        return Inertia::render('Public/Faq', [
            'guide' => \App\Support\FaqSettings::forStorefront(),
        ]);
    }

    public function problemsSolutions(): Response
    {
        return Inertia::render('Public/MasalahSolusi', [
            'guide' => \App\Support\ProblemsSolutionsSettings::forStorefront(),
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
            'guide' => \App\Support\CaraPemesananSettings::forStorefront(),
        ]);
    }

    public function reviews(Request $request): Response
    {
        $sort = (string) $request->input('sort', 'newest');
        $sourceFilter = (string) $request->input('source', 'all');
        if (! in_array($sourceFilter, ['all', 'marketplace', 'website'], true)) {
            $sourceFilter = 'all';
        }

        $published = CmsTestimonial::query()->published();

        $totalCount = (clone $published)->count();
        $avgRating = (clone $published)->whereNotNull('rating')->avg('rating');

        $filtered = (clone $published)
            ->when(
                $sourceFilter === 'marketplace',
                fn ($q) => $q->whereIn('source', ['shopee', 'whatsapp', 'other'])
            )
            ->when(
                $sourceFilter === 'website',
                fn ($q) => $q->where('source', 'website')
            );

        $paginator = $filtered
            ->with('product:id,parent_sku,name,short_name')
            ->when($sort === 'rating_desc', fn ($q) => $q->orderByDesc('rating')->orderByDesc('id'))
            ->when($sort === 'rating_asc', fn ($q) => $q->orderByRaw('rating is null')->orderBy('rating')->orderByDesc('id'))
            ->when($sort === 'oldest', fn ($q) => $q->orderBy('sort_order')->orderBy('id'))
            ->when(
                ! in_array($sort, ['rating_desc', 'rating_asc', 'oldest'], true),
                fn ($q) => $q->orderBy('sort_order')->orderByDesc('id')
            )
            ->paginate(12)
            ->withQueryString();

        $testimonials = $paginator->getCollection()
            ->map(fn (CmsTestimonial $t) => $t->toPublicArray())
            ->values()
            ->all();

        return Inertia::render('Public/Reviews', [
            'pageMeta' => \App\Support\TestimonialPageSettings::forStorefront(),
            'testimonials' => $testimonials,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'links' => $paginator->linkCollection()->toArray(),
            ],
            'stats' => [
                'total' => $totalCount,
                'average_rating' => $avgRating !== null ? round((float) $avgRating, 1) : null,
            ],
            'activeSort' => $sort,
            'activeSource' => $sourceFilter,
            'installationsHref' => route('installation.index'),
        ]);
    }

    public function installations(): Response
    {
        $installations = collect(InstallationGallery::productCards(48))
            ->map(fn (array $item) => [
                'id' => $item['id'],
                'image_url' => $item['image_url'],
                'label' => $item['label'],
                'photo_count' => $item['photo_count'],
                'video_count' => $item['video_count'],
                'href' => $item['href'],
                'product_sku' => $item['product_sku'],
            ])
            ->all();

        return Inertia::render('Public/Installations', [
            'pageMeta' => \App\Support\InstallationPageSettings::forStorefront(),
            'installations' => $installations,
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

        return Inertia::render('Public/InstallationDetail', [
            'pageMeta' => \App\Support\InstallationPageSettings::forStorefront(),
            'product' => $gallery['product'],
            'media' => $gallery['media'],
            'indexHref' => route('installation.index'),
        ]);
    }
}
