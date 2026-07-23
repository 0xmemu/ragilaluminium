<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsGalleryItem;
use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Support\InertiaAdmin;
use App\Support\InstallationPageSettings;
use App\Support\TestimonialPageSettings;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TestimonialController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = $request->query('tab') === 'foto' ? 'foto' : 'website';
        $q = trim((string) $request->query('q', ''));
        $sort = (string) $request->query('sort', 'newest');
        $published = $request->query('published');

        if ($tab === 'foto') {
            return $this->fotoIndex($q, $sort, $published, false);
        }

        return $this->websiteIndex($q, $sort, $published, false);
    }

    /** Pengaturan Website → Apa Kata Pelanggan Kami (website tab + page meta). */
    public function apaKata(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $sort = (string) $request->query('sort', 'newest');
        $published = $request->query('published');

        return $this->websiteIndex($q, $sort, $published, true);
    }

    public function updateApaKataMeta(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'heading' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:320'],
            'published' => ['boolean'],
        ]);
        $validated['published'] = $validated['published'] ?? false;

        TestimonialPageSettings::updatePageMeta($validated, $request->user()?->id);

        ActivityLogService::record(
            'cms.apa_kata_pelanggan_meta_updated',
            'cms_page',
            TestimonialPageSettings::pageId(),
            ['heading' => $validated['heading']],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.apa-kata-pelanggan.index')
            ->with('success', 'Meta halaman Apa Kata Pelanggan disimpan.');
    }

    /** Pengaturan Website → Hasil Pemasangan Kami (foto/gallery tab + page meta). */
    public function hasilPemasangan(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $sort = (string) $request->query('sort', 'newest');
        $published = $request->query('published');

        return $this->fotoIndex($q, $sort, $published, true);
    }

    public function updateHasilPemasanganMeta(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'heading' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:320'],
            'published' => ['boolean'],
        ]);
        $validated['published'] = $validated['published'] ?? false;

        InstallationPageSettings::updatePageMeta($validated, $request->user()?->id);

        ActivityLogService::record(
            'cms.hasil_pemasangan_meta_updated',
            'cms_page',
            InstallationPageSettings::pageId(),
            ['heading' => $validated['heading']],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.hasil-pemasangan.index')
            ->with('success', 'Meta halaman Hasil Pemasangan disimpan.');
    }

    public function create(): Response
    {
        return Inertia::render('Admin/Testimonials/Form', [
            'testimonial' => null,
            'products' => $this->productOptions(),
            'sources' => CmsTestimonial::SOURCES,
            'submitUrl' => route('admin.testimonials.store'),
            'indexUrl' => route('admin.testimonials.index', ['tab' => 'website']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);
        $validated['cms_page_id'] = $this->testimonialsPageId();

        CmsTestimonial::create($validated);

        return redirect()
            ->route('admin.testimonials.index', ['tab' => 'website'])
            ->with('success', 'Ulasan ditambahkan.');
    }

    public function edit(CmsTestimonial $testimonial): Response
    {
        return Inertia::render('Admin/Testimonials/Form', [
            'testimonial' => [
                'id' => $testimonial->id,
                'customer_name' => $testimonial->customer_name,
                'message' => $testimonial->message,
                'rating' => $testimonial->rating,
                'source' => $testimonial->source,
                'location' => $testimonial->location,
                'product_id' => $testimonial->product_id,
                'image_url' => $testimonial->image_url,
                'sort_order' => $testimonial->sort_order,
                'published' => $testimonial->published,
            ],
            'products' => $this->productOptions(),
            'sources' => CmsTestimonial::SOURCES,
            'submitUrl' => route('admin.testimonials.update', $testimonial),
            'indexUrl' => route('admin.testimonials.index', ['tab' => 'website']),
        ]);
    }

    public function update(Request $request, CmsTestimonial $testimonial): RedirectResponse
    {
        $testimonial->update($this->validated($request));

        return redirect()
            ->route('admin.testimonials.index', ['tab' => 'website'])
            ->with('success', 'Ulasan diperbarui.');
    }

    public function publish(CmsTestimonial $testimonial): RedirectResponse
    {
        $testimonial->update(['published' => true]);

        return back()->with('success', 'Ulasan dipublikasikan.');
    }

    public function unpublish(CmsTestimonial $testimonial): RedirectResponse
    {
        $testimonial->update(['published' => false]);

        return back()->with('success', 'Ulasan disembunyikan.');
    }

    protected function websiteIndex(string $q, string $sort, mixed $published, bool $pengaturanSurface = false): Response
    {
        $query = CmsTestimonial::query()->with('product:id,parent_sku,name,short_name');

        if ($q !== '') {
            $query->where(function ($builder) use ($q) {
                $builder->where('customer_name', 'like', '%'.$q.'%')
                    ->orWhere('message', 'like', '%'.$q.'%')
                    ->orWhere('location', 'like', '%'.$q.'%')
                    ->orWhere('source', 'like', '%'.$q.'%');
            });
        }

        if ($published === '1' || $published === '0') {
            $query->where('published', $published === '1');
        }

        match ($sort) {
            'oldest' => $query->orderBy('id'),
            'rating_desc' => $query->orderByDesc('rating')->orderByDesc('id'),
            'rating_asc' => $query->orderBy('rating')->orderByDesc('id'),
            'sort_order' => $query->orderBy('sort_order')->orderByDesc('id'),
            default => $query->orderByDesc('id'),
        };

        $rows = $query->paginate(20)->withQueryString();
        $indexRoute = $pengaturanSurface ? 'admin.apa-kata-pelanggan.index' : 'admin.testimonials.index';

        return Inertia::render('Admin/Testimonials/Index', [
            'title' => $pengaturanSurface ? 'Apa Kata Pelanggan Kami' : 'Daftar Ulasan',
            'description' => $pengaturanSurface
                ? 'Kelola testimoni website yang tampil di /reviews dan beranda.'
                : 'Tinjau dan kelola umpan balik pelanggan dari Shopee, WhatsApp, atau website.',
            'tab' => 'website',
            'tabs' => $this->tabs(),
            'filters' => [
                'q' => $q,
                'sort' => in_array($sort, ['newest', 'oldest', 'rating_desc', 'rating_asc', 'sort_order'], true) ? $sort : 'newest',
                'published' => in_array($published, ['1', '0'], true) ? $published : '',
            ],
            'sortOptions' => [
                ['value' => 'newest', 'label' => 'Terbaru'],
                ['value' => 'oldest', 'label' => 'Terlama'],
                ['value' => 'rating_desc', 'label' => 'Rating tertinggi'],
                ['value' => 'rating_asc', 'label' => 'Rating terendah'],
                ['value' => 'sort_order', 'label' => 'Urutan tampil'],
            ],
            'publishedOptions' => [
                ['value' => '', 'label' => 'Semua status'],
                ['value' => '1', 'label' => 'Published'],
                ['value' => '0', 'label' => 'Draft'],
            ],
            'createHref' => route('admin.testimonials.create'),
            'createLabel' => 'Tambah Ulasan Website',
            'indexRoute' => $indexRoute,
            'pageMeta' => $pengaturanSurface ? TestimonialPageSettings::pageMeta() : null,
            'metaUrl' => $pengaturanSurface ? route('admin.apa-kata-pelanggan.meta.update') : null,
            'metaHint' => $pengaturanSurface ? 'Meta halaman /reviews' : null,
            'previewUrl' => route('reviews'),
            'rows' => $rows->getCollection()->values()->map(function (CmsTestimonial $t, int $index) use ($rows) {
                $no = (($rows->currentPage() - 1) * $rows->perPage()) + $index + 1;

                return [
                    'id' => $t->id,
                    'no' => $no,
                    'customer_name' => $t->customer_name,
                    'message' => $t->message,
                    'rating' => $t->rating,
                    'source' => $t->source,
                    'location' => $t->location,
                    'product' => $t->product
                        ? ($t->product->short_name ?: $t->product->name).' ('.$t->product->parent_sku.')'
                        : null,
                    'image_url' => $t->image_url,
                    'published' => $t->published,
                    'created_at' => optional($t->created_at)?->toIso8601String(),
                    'edit_href' => route('admin.testimonials.edit', $t),
                    'publish_url' => route('admin.testimonials.publish', $t),
                    'unpublish_url' => route('admin.testimonials.unpublish', $t),
                ];
            })->all(),
            'pagination' => InertiaAdmin::pagination($rows),
        ]);
    }

    protected function fotoIndex(string $q, string $sort, mixed $published, bool $pengaturanSurface = false): Response
    {
        $query = CmsGalleryItem::query();

        if ($q !== '') {
            $query->where(function ($builder) use ($q) {
                $builder->where('label', 'like', '%'.$q.'%')
                    ->orWhere('image_url', 'like', '%'.$q.'%');
            });
        }

        if ($published === '1' || $published === '0') {
            $query->where('published', $published === '1');
        }

        match ($sort) {
            'oldest' => $query->orderBy('id'),
            'sort_order' => $query->orderBy('sort_order')->orderByDesc('id'),
            default => $query->orderByDesc('id'),
        };

        $rows = $query->paginate(20)->withQueryString();
        $indexRoute = $pengaturanSurface ? 'admin.hasil-pemasangan.index' : 'admin.testimonials.index';

        $importedQuery = ProductMedia::query()
            ->installation()
            ->visible()
            ->with(['product:id,parent_sku,name,short_name']);

        if ($q !== '') {
            $importedQuery->where(function ($builder) use ($q) {
                $builder->where('source_url', 'like', '%'.$q.'%')
                    ->orWhere('stored_url', 'like', '%'.$q.'%')
                    ->orWhereHas('product', function ($productQuery) use ($q) {
                        $productQuery->where('parent_sku', 'like', '%'.$q.'%')
                            ->orWhere('name', 'like', '%'.$q.'%')
                            ->orWhere('short_name', 'like', '%'.$q.'%');
                    });
            });
        }

        $imported = $importedQuery
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(function (ProductMedia $media, int $index) {
                $url = $media->urlFor('card') ?? $media->urlFor('thumb') ?? $media->source_url;
                $product = $media->product;
                $label = $product
                    ? trim((string) ($product->short_name ?: $product->name)).' ('.$product->parent_sku.')'
                    : 'Import media #'.$media->id;

                return [
                    'id' => 'import-'.$media->id,
                    'no' => $index + 1,
                    'label' => $label !== '' ? $label : 'Hasil pemasangan (import)',
                    'image_url' => $url ?: '',
                    'published' => true,
                    'sort_order' => $media->position,
                    'created_at' => optional($media->created_at)?->toIso8601String(),
                    'source' => 'import',
                    'readonly' => true,
                    'edit_href' => $product
                        ? route('admin.products.media.byProduct', $product)
                        : route('admin.media.index'),
                    'publish_url' => null,
                    'unpublish_url' => null,
                ];
            })
            ->filter(fn (array $row) => filled($row['image_url']))
            ->values()
            ->all();

        $manualStart = count($imported);
        $manualRows = $rows->getCollection()->values()->map(function (CmsGalleryItem $item, int $index) use ($rows, $manualStart) {
            $no = $manualStart + (($rows->currentPage() - 1) * $rows->perPage()) + $index + 1;

            return [
                'id' => $item->id,
                'no' => $no,
                'label' => $item->label ?: '(tanpa label)',
                'image_url' => $item->image_url,
                'published' => $item->published,
                'sort_order' => $item->sort_order,
                'created_at' => optional($item->created_at)?->toIso8601String(),
                'source' => 'manual',
                'readonly' => false,
                'edit_href' => route('admin.gallery-items.edit', $item),
                'publish_url' => route('admin.gallery-items.publish', $item),
                'unpublish_url' => route('admin.gallery-items.unpublish', $item),
            ];
        })->all();

        return Inertia::render('Admin/Testimonials/Index', [
            'title' => $pengaturanSurface ? 'Hasil Pemasangan Kami' : 'Daftar Ulasan',
            'description' => $pengaturanSurface
                ? 'Foto dari import produk (is_installation) + galeri manual untuk beranda dan /hasil-pemasangan.'
                : 'Kelola foto hasil pemasangan: import batch produk dan unggah manual.',
            'tab' => 'foto',
            'tabs' => $this->tabs(),
            'filters' => [
                'q' => $q,
                'sort' => in_array($sort, ['newest', 'oldest', 'sort_order'], true) ? $sort : 'newest',
                'published' => in_array($published, ['1', '0'], true) ? $published : '',
            ],
            'sortOptions' => [
                ['value' => 'newest', 'label' => 'Terbaru'],
                ['value' => 'oldest', 'label' => 'Terlama'],
                ['value' => 'sort_order', 'label' => 'Urutan tampil'],
            ],
            'publishedOptions' => [
                ['value' => '', 'label' => 'Semua status'],
                ['value' => '1', 'label' => 'Published'],
                ['value' => '0', 'label' => 'Draft'],
            ],
            'createHref' => route('admin.gallery-items.create'),
            'createLabel' => $pengaturanSurface ? 'Tambah Foto Pemasangan' : 'Tambah Ulasan Foto',
            'indexRoute' => $indexRoute,
            'pageMeta' => $pengaturanSurface ? InstallationPageSettings::pageMeta() : null,
            'metaUrl' => $pengaturanSurface ? route('admin.hasil-pemasangan.meta.update') : null,
            'metaHint' => $pengaturanSurface ? 'Meta halaman /hasil-pemasangan' : null,
            'previewUrl' => route('installation.index'),
            'importedRows' => $imported,
            'rows' => $manualRows,
            'pagination' => InertiaAdmin::pagination($rows),
        ]);
    }

    /** @return list<array{key:string,label:string,href:string}> */
    protected function tabs(): array
    {
        return [
            [
                'key' => 'website',
                'label' => 'Ulasan Website',
                'href' => route('admin.testimonials.index', ['tab' => 'website']),
            ],
            [
                'key' => 'foto',
                'label' => 'Ulasan Foto',
                'href' => route('admin.testimonials.index', ['tab' => 'foto']),
            ],
        ];
    }

    /** @return array<string, mixed> */
    protected function validated(Request $request): array
    {
        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'source' => ['required', Rule::in(CmsTestimonial::SOURCES)],
            'location' => ['nullable', 'string', 'max:255'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'published' => ['boolean'],
        ]);

        $validated['published'] = $request->boolean('published');
        $validated['sort_order'] = $validated['sort_order'] ?? 0;
        $validated['product_id'] = $validated['product_id'] ?: null;
        $validated['rating'] = $validated['rating'] ?? null;

        return $validated;
    }

    protected function testimonialsPageId(): int
    {
        return TestimonialPageSettings::pageId();
    }

    /** @return list<array{id:int,label:string}> */
    protected function productOptions(): array
    {
        return Product::query()
            ->orderBy('name')
            ->limit(500)
            ->get(['id', 'parent_sku', 'name', 'short_name'])
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'label' => ($p->short_name ?: $p->name).' · '.$p->parent_sku,
            ])
            ->values()
            ->all();
    }
}
