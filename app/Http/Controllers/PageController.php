<?php

namespace App\Http\Controllers;

use App\Models\CmsModelProduct;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Services\ModelProductService;
use App\Support\AboutPageSettings;
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
        $about = AboutPageSettings::forStorefront();

        return Inertia::render('Public/About', [
            'page' => [
                'title' => $about['hero_title'],
                'heading' => $about['hero_title'],
                'subtitle' => $about['hero_subtitle'],
                'tagline' => $about['hero_tagline'],
                'headline' => $about['hero_headline'],
                'description' => $about['hero_description'],
                'main_image_url' => $about['main_image_url'],
                'gallery_items' => $about['gallery_items'],
                'stats_items' => $about['stats_items'],
                'why_points' => $about['why_points'],
                'production_processes' => $about['production_processes'],
                'work_steps' => $about['work_steps'],
                'trust_rows' => $about['trust_rows'],
                'google_maps_url' => $about['google_maps_url'],
                'google_maps_embed_url' => $about['google_maps_embed_url'],
            ],
            'stats' => [
                // Angka nyata dari database (bukan klaim marketing) utk trust strip halaman Tentang Kami.
                'variant_count' => \App\Models\ProductVariant::query()->count(),
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
     * Halaman "Ulasan pelanggan di website" (ulasan teks).
     * /reviews/web - filter model via query ?model=KATEGORI|MODEL.
     */
    public function reviewsWebsite(Request $request): Response
    {
        [$modelCategory, $modelCode] = $this->reviewModelFilter($request);
        $activeRating = $this->reviewRatingFilter($request);
        $mediaOnly = $this->reviewMediaOnlyFilter($request);
        $sort = $this->reviewSortFilter($request);

        // Basis untuk menghitung jumlah tiap rating: SESUDAH filter model dan
        // media, tetapi SEBELUM filter rating. Dengan begitu jumlah tiap
        // rating tetap terbaca saat salah satu rating dipilih.
        // Produk dan baris pesanan dimuat di muka: kartu ulasan menampilkan nama
        // produk dan varian yang dipilih, dan tanpa eager load keduanya selalu
        // null karena relasinya dibaca lewat guard relationLoaded().
        $base = CmsTestimonial::query()->published()->website()
            ->with(['product:id,parent_sku,name,short_name,product_category,product_model,design_variant', 'order.items']);
        $this->applyReviewModelFilter($base, $modelCategory, $modelCode);
        $ratingNav = $this->reviewRatingNav($base, $mediaOnly, $sort);

        // Daftar memakai SELURUH filter, sehingga angka yang tampil selalu
        // cocok dengan kartu yang dilihat pembeli.
        $filtered = $this->applyReviewListingFilters(clone $base, $activeRating, $mediaOnly, $sort);

        $websiteTotal = $filtered->count();
        $avgRating = (clone $filtered)->whereNotNull('rating')->avg('rating');

        $testimonials = $this->paginateReviews($filtered);

        return Inertia::render('Public/Reviews', [
            'type' => 'web',
            'pageMeta' => [
                'title' => 'Ulasan pelanggan website',
                'heading' => 'Ulasan pelanggan di website',
                'subtitle' => 'Ulasan pelanggan yang memesan lewat website.',
            ],
            'testimonials' => $testimonials,
            // activeModel tetap dikirim supaya param `model` pada URL lama
            // tidak hilang saat pembeli mengganti filter lain, walaupun
            // kontrolnya sudah tidak ditampilkan (diganti tiga pill filter).
            'activeModel' => $modelCategory && $modelCode ? $modelCategory.'|'.$modelCode : null,
            'ratingNav' => $ratingNav,
            'activeRating' => $activeRating !== [] ? implode(',', $activeRating) : null,
            'activeMediaOnly' => $mediaOnly,
            'activeSort' => $sort,
            'stats' => [
                'website_total' => $websiteTotal,
                'average_rating' => $avgRating !== null ? round((float) $avgRating, 1) : null,
            ],
        ]);
    }

    /**
     * Halaman "Apa kata pelanggan kami" (galeri screenshot).
     * /reviews/ss - hanya ulasan yang punya gambar (media).
     */
    /**
     * Halaman ini SENGAJA tidak diubah saat tiga pill filter dipasang di
     * /reviews/web: daftar screenshot tetap dirender apa adanya seperti sebelum
     * perubahan, jadi parameternya juga tidak dipakai di sini.
     */
    public function reviewsScreenshots(Request $request): Response
    {
        [$modelCategory, $modelCode] = $this->reviewModelFilter($request);

        $published = CmsTestimonial::query()->published()->withScreenshot();
        if ($modelCategory && $modelCode) {
            $published->whereHas('product', function ($q) use ($modelCategory, $modelCode) {
                $q->whereIn('product_category', \App\Support\CatalogLabels::categoryCodesWithLegacy($modelCategory))
                    ->where('product_model', $modelCode);
            });
        }

        $testimonials = (clone $published)->with('product:id,parent_sku,name,short_name')
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->paginate(12)
            ->withQueryString()
            ->through(fn (CmsTestimonial $t) => $t->toPublicArray());

        $websiteTotal = (clone $published)->website()->count();

        return Inertia::render('Public/Reviews', [
            'type' => 'ss',
            'pageMeta' => TestimonialPageSettings::forStorefront(),
            'testimonials' => $testimonials,
            'modelNav' => $this->reviewModelNav(),
            'activeModel' => $modelCategory && $modelCode ? $modelCategory.'|'.$modelCode : null,
            'stats' => [
                'website_total' => $websiteTotal,
                'average_rating' => null,
            ],
            'installationsHref' => route('installation.index'),
        ]);
    }

    private function reviewModelFilter(Request $request): array
    {
        $modelFilter = (string) $request->input('model', '');
        if ($modelFilter === '' || ! str_contains($modelFilter, '|')) {
            return [null, null];
        }
        [$category, $code] = explode('|', $modelFilter, 2);

        return [strtoupper($category), strtoupper($code)];
    }

    /**
     * Filter rating dari query string.
     *
     * Menerima SATU nilai ("4") atau DAFTAR dipisah koma ("4,5"), karena
     * dropdown bintang boleh memilih lebih dari satu rating. Hanya 1..5 yang
     * diterima; nilai lain dibuang. Bila tidak ada yang valid, filter dianggap
     * tidak aktif, sama seperti perilaku filter model.
     *
     * @return list<int>
     */
    private function reviewRatingFilter(Request $request): array
    {
        $raw = (string) $request->input('rating', '');

        $ratings = collect(explode(',', $raw))
            ->map(fn ($part) => trim($part))
            ->filter(fn ($part) => ctype_digit($part))
            ->map(fn ($part) => (int) $part)
            ->filter(fn (int $value) => $value >= 1 && $value <= 5)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $ratings;
    }

    /**
     * Urutan ulasan dari query string: "all" (bawaan halaman), "newest", atau
     * "oldest". Nilai lain dianggap "all".
     */
    private function reviewSortFilter(Request $request): string
    {
        $sort = (string) $request->input('sort', '');

        return in_array($sort, ['newest', 'oldest'], true) ? $sort : 'all';
    }

    /**
     * Filter "hanya ulasan berfoto atau bervideo".
     *
     * Sengaja TIDAK memakai klausa JSON pada SQL: kolom media bertipe json dan
     * perilakunya berbeda antara MySQL dan SQLite (driver test). Penyaringan
     * dilakukan di PHP, dan paginasi daftar memakai paginator manual supaya
     * batas 12 per halaman tetap berlaku.
     */
    private function reviewMediaOnlyFilter(Request $request): bool
    {
        return $request->boolean('media_only');
    }

    /** Apakah ulasan ini punya foto atau video. */
    private function reviewHasMedia(CmsTestimonial $testimonial): bool
    {
        if (filled($testimonial->image_url)) {
            return true;
        }
        if ($testimonial->imagesPayload() !== []) {
            return true;
        }

        return $testimonial->mediaPayload() !== [];
    }

    /**
     * Susun daftar ulasan yang sudah tayang untuk storefront: filter rating,
     * filter media, lalu pengurutan.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<CmsTestimonial>  $query
     * @param  list<int>  $activeRatings  kosong berarti tanpa filter rating
     * @return \Illuminate\Support\Collection<int, CmsTestimonial>
     */
    private function reviewListingCollection($query, array $activeRatings, bool $mediaOnly, string $sort)
    {
        $items = $query
            ->when($activeRatings !== [], fn ($q) => $q->whereIn('rating', $activeRatings))
            ->get();

        if ($mediaOnly) {
            $items = $items->filter(fn (CmsTestimonial $t) => $this->reviewHasMedia($t))->values();
        }

        if ($sort === 'newest') {
            $items = $items->sortByDesc('id')->values();
        } elseif ($sort === 'oldest') {
            $items = $items->sortBy('id')->values();
        } else {
            // Urutan bawaan halaman: sort_order admin, lalu terbaru.
            $items = $items
                ->sortBy([['sort_order', 'asc'], ['id', 'desc']])
                ->values();
        }

        return $items;
    }

    /** @param \Illuminate\Database\Eloquent\Builder<CmsTestimonial> $base */
    private function applyReviewListingFilters($base, array $activeRatings, bool $mediaOnly, string $sort)
    {
        return $this->reviewListingCollection($base, $activeRatings, $mediaOnly, $sort);
    }

    /**
     * Ubah koleksi ulasan menjadi paginator 12 per halaman supaya bentuk props
     * storefront tetap sama (data, links, total, dan seterusnya).
     *
     * @param  \Illuminate\Support\Collection<int, CmsTestimonial>  $items
     */
    private function paginateReviews($items, bool $includeProduct = true): \Illuminate\Pagination\LengthAwarePaginator
    {
        // Ketika pemanggil mengirim builder, ambil koleksinya lebih dulu.
        if (! $items instanceof \Illuminate\Support\Collection) {
            $items = collect($items);
        }

        $perPage = 12;
        $page = \Illuminate\Pagination\Paginator::resolveCurrentPage() ?: 1;
        $slice = $items->forPage($page, $perPage)->values();

        return new \Illuminate\Pagination\LengthAwarePaginator(
            $slice->map(fn (CmsTestimonial $t) => $t->toPublicArray($includeProduct))->all(),
            $items->count(),
            $perPage,
            $page,
            ['path' => \Illuminate\Pagination\Paginator::resolveCurrentPath()],
        );
    }

    /** @param \Illuminate\Database\Eloquent\Builder<CmsTestimonial> $query */
    private function applyReviewModelFilter($query, ?string $modelCategory, ?string $modelCode): void
    {
        if (! $modelCategory || ! $modelCode) {
            return;
        }

        $query->whereHas('product', function ($q) use ($modelCategory, $modelCode) {
            $q->whereIn('product_category', \App\Support\CatalogLabels::categoryCodesWithLegacy($modelCategory))
                ->where('product_model', $modelCode);
        });
    }

    /**
     * Opsi filter rating beserta jumlahnya. Dihitung dari basis TANPA filter
     * rating, supaya jumlah tiap rating tetap terbaca saat salah satu dipilih.
     * Rating tanpa ulasan tidak ditampilkan.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<CmsTestimonial>  $base
     * @return list<array{value: string, label: string, count: int}>
     */
    private function reviewRatingNav($base, bool $mediaOnly = false, string $sort = 'all'): array
    {
        // Hitungan memakai filter media + urutan yang sama dengan daftar,
        // tetapi TANPA filter rating, supaya jumlah tiap rating tidak hilang
        // saat salah satu rating sedang dipilih.
        $items = $this->reviewListingCollection($base, [], $mediaOnly, $sort);

        $counts = $items->whereNotNull('rating')->countBy('rating');

        $options = [];

        // Urut dari 1 ke 5: bintang terendah di paling atas, sesuai kontrak
        // tampilan dropdown filter.
        for ($rating = 1; $rating <= 5; $rating++) {
            $count = (int) ($counts[$rating] ?? 0);
            if ($count < 1) {
                continue;
            }
            $options[] = [
                'value' => (string) $rating,
                'label' => $rating.' bintang',
                'count' => $count,
            ];
        }

        return $options;
    }

    private function reviewModelNav(): array
    {
        $navSource = CmsTestimonial::query()->published()
            ->whereHas('product')
            ->with('product:id,parent_sku,name,short_name,product_category,product_model')
            ->get();

        return $navSource
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
    }


    public function installations(Request $request): Response
    {
        $sort = (string) $request->input('sort', 'admin');
        if (! in_array($sort, ['admin', 'latest', 'oldest'], true)) {
            $sort = 'admin';
        }

        $modelCards = collect(InstallationGallery::modelCards(48));
        $hasModelMedia = $modelCards->contains(fn (array $item) => filled($item['image_url'] ?? null));

        // Level 1 = kartu model produk + kartu grup mandiri (selevel, sesuai
        // kontrak admin: grup tanpa model produk hirarkinya sama dengan model).
        $installations = ($hasModelMedia ? $modelCards : collect(InstallationGallery::productCards(48)))
            ->concat(collect(InstallationGallery::standaloneGroupCards(48)))
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
            'models' => app(ModelProductService::class)->storefrontCards(0, null, null, $sort),
            'level' => 'model',
            'activeSort' => $sort,
            'reviewsHref' => route('reviews.website'),
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

        $standaloneGroup = $categoryCode === 'LAINNYA'
            ? InstallationGallery::standaloneGroupBySlug($model)
            : null;

        if ($standaloneGroup !== null) {
            // Halaman galeri satu grup mandiri: daftar media grup tersebut.
            $gallery = InstallationGallery::mediaForGroup($standaloneGroup);
            $installations = [];
            $title = (string) $standaloneGroup->title;
            $cover = $gallery[0]['url'] ?? null;
            $photoCount = count(array_filter($gallery, fn (array $i) => ! $i['is_video']));
            $videoCount = count(array_filter($gallery, fn (array $i) => $i['is_video']));
            $productCount = 0;
        } elseif ($categoryCode === 'LAINNYA') {
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
        if (! isset($gallery)) {
            $gallery = InstallationGallery::mediaForModel($categoryCode, $modelCode);
        }

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
                'subtitle' => $standaloneGroup !== null
                    ? 'Dokumentasi pemasangan pada grup ini.'
                    : 'Produk dalam model ini yang memiliki dokumentasi hasil pemasangan.',
            ],
            'installations' => $installations,
            'gallery' => $gallery,
            'featured' => $featured,
            'level' => 'product',
            // Penanda halaman grup mandiri (bukan model katalog): dipakai
            // frontend untuk menyesuaikan statistik hero.
            'standaloneGroup' => $standaloneGroup !== null,
            'activeSort' => $sort,
            'modelMeta' => [
                'category' => $categoryCode,
                'model' => $modelCode,
                'label' => $title,
            ],
            'modelHighlights' => isset($modelCard) && is_array($modelCard)
                ? ($modelCard['highlights'] ?? null)
                : null,
            'modelDescription' => isset($modelCard) && is_array($modelCard)
                ? ($modelCard['desc'] ?? null)
                : null,
            'indexHref' => route('installation.index'),
            'reviewsHref' => route('reviews.website'),
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
        $cmsKeywords = null;
        if ($category !== '' && $model !== '' && $category !== 'LAINNYA') {
            $row = CmsModelProduct::query()
                ->active()
                ->whereIn('product_category', \App\Support\CatalogLabels::categoryCodesWithLegacy($category))
                ->where('product_model', $model)
                ->first(['description', 'keywords']);
            if ($row) {
                $cmsDescription = filled(trim((string) ($row->description ?? '')))
                    ? trim((string) $row->description)
                    : null;
                $cmsKeywords = filled($row->keywords ?? []) ? $row->keywords : null;
            }
        }

        $payload['subtitle'] = $presentation['subtitle'];
        $payload['desc'] = $cmsDescription ?: $presentation['desc'];
        $payload['highlights'] = $cmsKeywords
            ? ModelProductPresentation::highlightsFromKeywords($cmsKeywords)
            : $presentation['highlights'];

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
