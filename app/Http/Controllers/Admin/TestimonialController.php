<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsGalleryItem;
use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\Order;
use App\Support\InertiaAdmin;
use App\Support\InstallationPageSettings;
use App\Support\TestimonialPageSettings;
use App\Support\MediaNamer;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
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
        $channel = (string) $request->query('channel', 'all');

        if ($tab === 'foto') {
            return $this->fotoIndex($q, $sort, $published, false);
        }

        return $this->websiteIndex($q, $sort, $published, $channel);
    }

    /** Pengaturan Website → Apa Kata Pelanggan Kami (screenshot Shopee/WA + meta + urutan). */
    public function apaKata(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $published = $request->query('published');

        return $this->marketplaceScreenshotIndex($q, $published);
    }

    public function reorderApaKata(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.id' => ['required', 'integer', 'exists:cms_testimonials,id'],
            'rows.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        foreach ($validated['rows'] as $index => $row) {
            CmsTestimonial::query()
                ->whereKey((int) $row['id'])
                ->marketplace()
                ->update([
                    'sort_order' => array_key_exists('sort_order', $row) && $row['sort_order'] !== null
                        ? (int) $row['sort_order']
                        : $index,
                ]);
        }

        ActivityLogService::record(
            'cms.apa_kata_pelanggan_reordered',
            'cms_page',
            TestimonialPageSettings::pageId(),
            ['count' => count($validated['rows'])],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.apa-kata-pelanggan.index')
            ->with('success', 'Urutan screenshot Apa Kata Pelanggan disimpan.');
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

    public function create(Request $request): Response
    {
        $intent = in_array((string) $request->query('intent'), ['marketplace', 'admin-order'], true) ? (string) $request->query('intent') : 'website';
        $sources = $intent === 'marketplace'
            ? CmsTestimonial::MARKETPLACE_SOURCES
            : CmsTestimonial::SOURCES;
        $indexUrl = $intent === 'marketplace'
            ? route('admin.apa-kata-pelanggan.index')
            : route('admin.testimonials.index', ['tab' => 'website']);

        return Inertia::render('Admin/Testimonials/Form', [
            'testimonial' => null,
            'products' => $this->productOptions(),
            'sources' => array_values($sources),
            'sourceLabels' => CmsTestimonial::SOURCE_LABELS,
            'intent' => $intent,
            'submitUrl' => $intent === 'admin-order' ? route('admin.testimonials.admin-review.store') : route('admin.testimonials.store'),
            'indexUrl' => $indexUrl,
            'reviewMode' => $intent === 'admin-order',
            'verifiedOrders' => $intent === 'admin-order' ? $this->verifiedOrderOptions() : [],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);
        $validated['cms_page_id'] = $this->testimonialsPageId();

        if (! isset($validated['sort_order']) || (int) $validated['sort_order'] === 0) {
            if (in_array($validated['source'], CmsTestimonial::MARKETPLACE_SOURCES, true)) {
                $validated['sort_order'] = (int) CmsTestimonial::query()->marketplace()->max('sort_order') + 1;
            }
        }

        CmsTestimonial::create($validated);

        if (in_array($validated['source'], CmsTestimonial::MARKETPLACE_SOURCES, true)) {
            return redirect()
                ->route('admin.apa-kata-pelanggan.index')
                ->with('success', 'Screenshot Apa Kata Pelanggan ditambahkan.');
        }

        return redirect()
            ->route('admin.testimonials.index', ['tab' => 'website', 'channel' => 'website'])
            ->with('success', 'Ulasan website ditambahkan.');
    }

    public function edit(Request $request, CmsTestimonial $testimonial): Response
    {
        $isMarketplace = in_array((string) $testimonial->source, CmsTestimonial::MARKETPLACE_SOURCES, true);
        $intent = $request->query('intent') === 'marketplace' || $isMarketplace ? 'marketplace' : 'website';
        $sources = $intent === 'marketplace'
            ? CmsTestimonial::MARKETPLACE_SOURCES
            : CmsTestimonial::SOURCES;
        $indexUrl = $intent === 'marketplace'
            ? route('admin.apa-kata-pelanggan.index')
            : route('admin.testimonials.index', ['tab' => 'website']);

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
                'image_urls' => $testimonial->image_urls ?? [],
                'sort_order' => $testimonial->sort_order,
                'published' => $testimonial->published,
                'moderation_status' => $testimonial->moderation_status ?: 'approved',
            ],
            'products' => $this->productOptions(),
            'sources' => array_values($sources),
            'sourceLabels' => CmsTestimonial::SOURCE_LABELS,
            'intent' => $intent,
            'submitUrl' => route('admin.testimonials.update', $testimonial),
            'indexUrl' => $indexUrl,
            'moderateUrl' => route('admin.testimonials.moderate', $testimonial),
        ]);
    }

    public function update(Request $request, CmsTestimonial $testimonial): RedirectResponse
    {
        $validated = $this->validated($request, $testimonial);
        if ($testimonial->isCustomerAuthored()) {
            // Customer text/identity is immutable; moderation may only add media or change visibility.
            $validated['message'] = $testimonial->message;
            $validated['customer_name'] = $testimonial->customer_name;
            $validated['rating'] = $testimonial->rating;
        }
        unset($validated['author_type'], $validated['order_id'], $validated['author_admin_id'], $validated['verified_at']);
        $testimonial->update($validated);
        ActivityLogService::record('cms.testimonial_updated', 'cms_testimonial', $testimonial->id, ['customer_text_immutable' => $testimonial->isCustomerAuthored(), 'media_count' => count($testimonial->mediaPayload())], $request->user()?->id);

        if (in_array($validated['source'], CmsTestimonial::MARKETPLACE_SOURCES, true)) {
            return redirect()
                ->route('admin.apa-kata-pelanggan.index')
                ->with('success', 'Screenshot Apa Kata Pelanggan diperbarui.');
        }

        return redirect()
            ->route('admin.testimonials.index', ['tab' => 'website', 'channel' => 'website'])
            ->with('success', 'Ulasan website diperbarui.');
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

    protected function marketplaceScreenshotIndex(string $q, mixed $published): Response
    {
        $query = CmsTestimonial::query()
            ->marketplace()
            ->with('product:id,parent_sku,name,short_name')
            ->orderBy('sort_order')
            ->orderByDesc('id');

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

        $items = $query->limit(200)->get();

        return Inertia::render('Admin/Testimonials/Index', [
            'title' => 'Apa Kata Pelanggan Kami',
            'description' => 'Hanya screenshot percakapan/ulasan Shopee atau WhatsApp di luar transaksi website. Geser urutan untuk prioritas tampilan di beranda dan /reviews.',
            'tab' => 'website',
            'tabs' => [],
            'filters' => [
                'q' => $q,
                'sort' => 'sort_order',
                'published' => in_array($published, ['1', '0'], true) ? $published : '',
                'channel' => 'marketplace',
            ],
            'channelOptions' => [],
            'sortOptions' => [],
            'publishedOptions' => [
                ['value' => '', 'label' => 'Semua status'],
                ['value' => '1', 'label' => 'Published'],
                ['value' => '0', 'label' => 'Draft'],
            ],
            'createHref' => route('admin.testimonials.create', ['intent' => 'marketplace']),
            'createLabel' => 'Tambah Screenshot',
            'indexRoute' => 'admin.apa-kata-pelanggan.index',
            'pageMeta' => TestimonialPageSettings::pageMeta(),
            'metaUrl' => route('admin.apa-kata-pelanggan.meta.update'),
            'metaHint' => 'Judul section Apa kata pelanggan kami di /reviews',
            'previewUrl' => route('reviews.screenshots'),
            'reorderUrl' => route('admin.apa-kata-pelanggan.reorder'),
            'canReorder' => true,
            'sourceLabels' => CmsTestimonial::SOURCE_LABELS,
            'rows' => $items->values()->map(function (CmsTestimonial $t, int $index) {
                return [
                    'id' => $t->id,
                    'no' => $index + 1,
                    'customer_name' => $t->customer_name,
                    'message' => $t->message,
                    'rating' => $t->rating,
                    'source' => $t->source,
                    'source_label' => CmsTestimonial::sourceLabel((string) $t->source),
                    'location' => $t->location,
                    'product' => $t->product
                        ? ($t->product->short_name ?: $t->product->name).' ('.$t->product->parent_sku.')'
                        : null,
                    'image_url' => $t->image_url,
                    'sort_order' => $t->sort_order,
                    'published' => $t->published,
                    'created_at' => optional($t->created_at)?->toIso8601String(),
                    'edit_href' => route('admin.testimonials.edit', ['testimonial' => $t, 'intent' => 'marketplace']),
                    'publish_url' => route('admin.testimonials.publish', $t),
                    'unpublish_url' => route('admin.testimonials.unpublish', $t),
                ];
            })->all(),
            'pagination' => null,
        ]);
    }

    protected function websiteIndex(string $q, string $sort, mixed $published, string $channel = 'all'): Response
    {
        if (! in_array($channel, ['all', 'marketplace', 'website'], true)) {
            $channel = 'all';
        }

        $query = CmsTestimonial::query()->with('product:id,parent_sku,name,short_name');

        if ($channel === 'marketplace') {
            $query->marketplace();
        } elseif ($channel === 'website') {
            $query->website();
        }

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
        $indexRoute = 'admin.testimonials.index';

        return Inertia::render('Admin/Testimonials/Index', [
            'title' => 'Daftar Ulasan',
            'description' => 'Pisahkan umpan balik: Apa kata pelanggan (screenshot Shopee/WA) vs ulasan pelanggan di website.',
            'tab' => 'website',
            'tabs' => $this->tabs(),
            'filters' => [
                'q' => $q,
                'sort' => in_array($sort, ['newest', 'oldest', 'rating_desc', 'rating_asc', 'sort_order'], true) ? $sort : 'newest',
                'published' => in_array($published, ['1', '0'], true) ? $published : '',
                'channel' => $channel,
            ],
            'channelOptions' => [
                ['value' => 'all', 'label' => 'Semua kanal'],
                ['value' => 'marketplace', 'label' => 'Apa kata (Shopee/WA)'],
                ['value' => 'website', 'label' => 'Ulasan website'],
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
            'adminReviewHref' => route('admin.testimonials.create', ['intent' => 'admin-order']),
            'createLabel' => 'Tambah Ulasan',
            'indexRoute' => $indexRoute,
            'pageMeta' => null,
            'metaUrl' => null,
            'metaHint' => null,
            'previewUrl' => route('reviews.website'),
            'reorderUrl' => null,
            'canReorder' => false,
            'sourceLabels' => CmsTestimonial::SOURCE_LABELS,
            'rows' => $rows->getCollection()->values()->map(function (CmsTestimonial $t, int $index) use ($rows) {
                $no = (($rows->currentPage() - 1) * $rows->perPage()) + $index + 1;

                return [
                    'id' => $t->id,
                    'no' => $no,
                    'customer_name' => $t->customer_name,
                    'message' => $t->message,
                    'rating' => $t->rating,
                    'source' => $t->source,
                    'source_label' => CmsTestimonial::sourceLabel((string) $t->source),
                    'location' => $t->location,
                    'product' => $t->product
                        ? ($t->product->short_name ?: $t->product->name).' ('.$t->product->parent_sku.')'
                        : null,
                    'image_url' => $t->image_url,
                    'sort_order' => $t->sort_order,
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
            ->with(['product:id,parent_sku,name,short_name', 'mediaAsset']);

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
                    'media_asset_id' => $media->media_asset_id,
                    'attach_url' => $media->media_asset_id
                        ? route('admin.media.attach', $media->media_asset_id)
                        : null,
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

    /**
     * @return array<string, mixed>
     */
    protected function validated(Request $request, ?CmsTestimonial $existing = null): array
    {
        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'source' => ['required', Rule::in(CmsTestimonial::SOURCES)],
            'location' => ['nullable', 'string', 'max:255'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'image_urls' => ['nullable', 'array', 'max:20'],
            'image_urls.*' => ['nullable', 'string', 'max:2048'],
            'image' => ['nullable', 'image', 'max:5120'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'published' => ['boolean'],
        ]);

        $validated['published'] = $request->boolean('published');
        $validated['sort_order'] = $validated['sort_order'] ?? 0;
        $validated['product_id'] = ! empty($validated['product_id'] ?? null) ? (int) $validated['product_id'] : null;
        $validated['rating'] = $validated['rating'] ?? null;
        $validated['message'] = filled($validated['message'] ?? null) ? trim((string) $validated['message']) : null;

        $imageUrl = filled($validated['image_url'] ?? null) ? trim((string) $validated['image_url']) : null;
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $name = MediaNamer::onDisk('testimonial', $file->getClientOriginalExtension() ?: 'jpg', 'media', 'testimonials');
            $path = $file->storeAs('testimonials', $name, 'media');
            $imageUrl = Storage::disk('media')->url($path);
        } elseif ($imageUrl === null && $existing !== null && ! $request->exists('image_url')) {
            $imageUrl = $existing->image_url;
        }

        $validated['image_url'] = $imageUrl;
        unset($validated['image']);

        // Foto tambahan (multi-gambar): URL baris-per-baris dari form admin.
        $imageUrls = array_values(array_filter(array_map(
            static fn ($url) => is_string($url) ? trim($url) : '',
            $validated['image_urls'] ?? [],
        )));
        if ($imageUrls !== [] && $imageUrl === null) {
            $validated['image_url'] = $imageUrls[0];
        }
        $validated['image_urls'] = $imageUrls !== [] ? $imageUrls : null;

        $isMarketplace = in_array((string) $validated['source'], CmsTestimonial::MARKETPLACE_SOURCES, true);

        if ($isMarketplace && blank($imageUrl)) {
            throw ValidationException::withMessages([
                'image' => 'Screenshot Shopee/WhatsApp wajib untuk Apa kata pelanggan kami.',
                'image_url' => 'Unggah gambar atau isi URL screenshot.',
            ]);
        }

        if (! $isMarketplace && $validated['message'] === null && blank($imageUrl)) {
            throw ValidationException::withMessages([
                'message' => 'Isi teks ulasan atau unggah/isi URL gambar (minimal salah satu).',
                'image_url' => 'Isi teks ulasan atau unggah/isi URL gambar (minimal salah satu).',
            ]);
        }

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
    public function moderate(Request $request, CmsTestimonial $testimonial): RedirectResponse
    {
        $validated = $request->validate(['moderation_status' => ['required', Rule::in(CmsTestimonial::MODERATION_STATUSES)]]);
        $from = $testimonial->moderation_status ?: 'approved';
        $testimonial->update(['moderation_status' => $validated['moderation_status'], 'published' => $validated['moderation_status'] === 'approved' ? $testimonial->published : false]);
        ActivityLogService::record('cms.testimonial_moderated', 'cms_testimonial', $testimonial->id, ['from' => $from, 'to' => $validated['moderation_status'], 'author_type' => $testimonial->author_type], $request->user()?->id);
        return back()->with('success', 'Status moderasi ulasan diperbarui.');
    }

    public function addMedia(Request $request, CmsTestimonial $testimonial): RedirectResponse
    {
        $validated = $request->validate(['media_url' => ['required', 'url', 'max:2048'], 'media_type' => ['required', Rule::in(['image', 'video'])], 'media_source' => ['nullable', 'string', 'max:40']]);
        $items = $testimonial->mediaPayload();
        $items[] = ['type' => $validated['media_type'], 'url' => $validated['media_url'], 'source' => $validated['media_source'] ?? 'admin'];
        $testimonial->update(['media_items' => array_values(array_unique($items, SORT_REGULAR))]);
        ActivityLogService::record('cms.testimonial_media_added', 'cms_testimonial', $testimonial->id, ['type' => $validated['media_type'], 'source' => $validated['media_source'] ?? 'admin'], $request->user()?->id);
        return back()->with('success', 'Media ulasan ditambahkan.');
    }

    public function storeAdminReview(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'order_id' => ['required', 'integer', 'exists:orders,id'], 'message' => ['required', 'string'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'], 'source_reference' => ['nullable', 'string', 'max:2048'],
            'published' => ['boolean'], 'media_items' => ['nullable', 'array', 'max:30'],
            'media_items.*.type' => ['required_with:media_items', Rule::in(['image', 'video'])],
            'media_items.*.url' => ['required_with:media_items', 'url', 'max:2048'],
        ]);
        $order = Order::query()->with('items')->whereIn('order_status', ['delivered', 'completed'])->findOrFail($validated['order_id']);
        if (CmsTestimonial::query()->where('order_id', $order->id)->exists()) {
            throw ValidationException::withMessages(['order_id' => 'Pesanan ini sudah memiliki ulasan. Hindari duplikasi.']);
        }
        $item = $order->items->first();
        $testimonial = CmsTestimonial::create([
            'cms_page_id' => $this->testimonialsPageId(), 'order_id' => $order->id, 'product_id' => $item?->product_id,
            'customer_name' => $order->customer_name ?: 'Pelanggan', 'message' => trim($validated['message']), 'rating' => $validated['rating'] ?? null,
            'source' => 'website', 'source_reference' => $validated['source_reference'] ?? null, 'author_type' => 'admin',
            'author_admin_id' => $request->user()?->id, 'verified_at' => now(), 'moderation_status' => 'approved',
            'media_items' => $validated['media_items'] ?? null, 'published' => $request->boolean('published'), 'sort_order' => 0,
        ]);
        ActivityLogService::record('cms.testimonial_admin_created', 'cms_testimonial', $testimonial->id, ['order_id' => $order->id, 'verified_purchase' => true], $request->user()?->id);
        return redirect()->route('admin.testimonials.index', ['tab' => 'website', 'channel' => 'website'])->with('success', 'Ulasan admin untuk pembelian terverifikasi ditambahkan.');
    }

    /** @return list<array{id:int,label:string,status:string}> */
    protected function verifiedOrderOptions(): array
    {
        return Order::query()->whereIn('order_status', ['delivered', 'completed'])
            ->whereNotIn('id', CmsTestimonial::query()->whereNotNull('order_id')->pluck('order_id'))
            ->withCount('items')->orderByDesc('id')->limit(200)->get(['id', 'order_number', 'customer_name', 'order_status'])
            ->map(fn (Order $order) => ['id' => $order->id, 'label' => $order->order_number.' · '.($order->customer_name ?: 'Pelanggan'), 'status' => $order->order_status])
            ->values()->all();
    }

}