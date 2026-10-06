<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsGalleryItem;
use App\Models\MediaAsset;
use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Support\InertiaAdmin;
use App\Support\InstallationPageSettings;
use App\Support\TestimonialPageSettings;
use App\Support\MediaNamer;
use App\Services\ActivityLogService;
use App\Services\WhatsAppService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TestimonialController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        $tab = (string) $request->query('tab', 'website');
        $q = trim((string) $request->query('q', ''));
        $sort = (string) $request->query('sort', 'newest');
        $published = $request->query('published');
        $channel = (string) $request->query('channel', 'all');
        // Filter status balasan (owner 2026-09-18): admin perlu cepat menemukan
        // ulasan yang belum ditanggapi tanpa menyisir daftar satu per satu.
        $reply = (string) $request->query('reply', 'all');

        // Foto hasil pemasangan punya menu sendiri (Pengaturan Website ->
        // Hasil Pemasangan Kami); tautan lama tab=foto dialihkan ke sana.
        if ($tab === 'foto') {
            return redirect()->route('admin.hasil-pemasangan.index');
        }

        if ($tab === 'eksternal' || $tab === 'marketplace') {
            return $this->marketplaceScreenshotIndex($q, $published);
        }

        return $this->websiteIndex($q, $sort, $published, $channel, $reply);
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
                ->withScreenshot()
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
            ->route('admin.testimonials.index', ['tab' => 'eksternal'])
            ->with('success', 'Urutan screenshot ulasan eksternal disimpan.');
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
        // Hanya dua bentuk form (kontrak owner 2026-09-29): ulasan biasa dan
        // screenshot marketplace. Alur "ulasan dari order" dihapus supaya tidak
        // ada dua tombol tambah yang membingungkan di tab Ulasan Website.
        $intent = (string) $request->query('intent') === 'marketplace' ? 'marketplace' : 'website';
        $sources = $intent === 'marketplace'
            ? CmsTestimonial::MARKETPLACE_SOURCES
            : CmsTestimonial::SOURCES;
        $indexUrl = $intent === 'marketplace'
            ? route('admin.testimonials.index', ['tab' => 'eksternal'])
            : route('admin.testimonials.index', ['tab' => 'website']);

        return Inertia::render('Admin/Testimonials/Form', [
            'backUrl' => $indexUrl,
            'testimonial' => null,
            'sources' => array_values($sources),
            'sourceLabels' => CmsTestimonial::SOURCE_LABELS,
            'intent' => $intent,
            'maxPhotos' => CmsTestimonial::MAX_PHOTOS,
            'initialProduct' => null,
            'submitUrl' => route('admin.testimonials.store'),
            'indexUrl' => $indexUrl,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);
        $validated['cms_page_id'] = $this->testimonialsPageId();

        // Screenshot marketplace selalu tampil saat dibuat (tidak ada toggle
        // di form); untuk menyembunyikan dipakai aksi Sembunyikan di daftar.
        if (in_array($validated['source'], CmsTestimonial::MARKETPLACE_SOURCES, true)) {
            $validated['published'] = true;
        }

        if (! isset($validated['sort_order']) || (int) $validated['sort_order'] === 0) {
            if (in_array($validated['source'], CmsTestimonial::MARKETPLACE_SOURCES, true)) {
                $validated['sort_order'] = (int) CmsTestimonial::query()->marketplace()->max('sort_order') + 1;
            }
        }

        CmsTestimonial::create($validated);

        if (in_array($validated['source'], CmsTestimonial::MARKETPLACE_SOURCES, true)) {
            return redirect()
                ->route('admin.testimonials.index', ['tab' => 'eksternal'])
                ->with('success', 'Screenshot ulasan eksternal ditambahkan.');
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
            ? route('admin.testimonials.index', ['tab' => 'eksternal'])
            : route('admin.testimonials.index', ['tab' => 'website']);

        return Inertia::render('Admin/Testimonials/Form', [
            'backUrl' => $indexUrl,
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
                // Seluruh foto berurutan (gambar utama dulu) supaya form bisa
                // menampilkan semua foto yang tersimpan, termasuk foto
                // kiriman pelanggan yang dulu tidak terlihat admin.
                'photos' => $testimonial->imagesPayload(),
                'sort_order' => $testimonial->sort_order,
                'published' => $testimonial->published,
                'moderation_status' => $testimonial->moderation_status ?: 'approved',
                'created_at' => optional($testimonial->created_at)?->toIso8601String(),
                'admin_reply' => $testimonial->admin_reply,
                'admin_replied_at' => optional($testimonial->admin_replied_at)?->toIso8601String(),
            ],
            'sources' => array_values($sources),
            'sourceLabels' => CmsTestimonial::SOURCE_LABELS,
            'intent' => $intent,
            'maxPhotos' => CmsTestimonial::MAX_PHOTOS,
            'initialProduct' => $this->initialProductFor($testimonial),
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
                ->route('admin.testimonials.index', ['tab' => 'eksternal'])
                ->with('success', 'Screenshot ulasan eksternal diperbarui.');
        }

        return redirect()
            ->route('admin.testimonials.index', ['tab' => 'website', 'channel' => 'website'])
            ->with('success', 'Ulasan website diperbarui.');
    }

    public function publish(CmsTestimonial $testimonial): RedirectResponse
    {
        // Moderasi ikut disetujui, bukan hanya kolom terbitnya. Gerbang
        // storefront mensyaratkan published DAN approved, sedangkan tombol ini
        // hanya menyentuh published. Akibatnya pada ulasan yang pernah ditolak,
        // tombol ini tampak berhasil sementara ulasannya tetap tidak muncul.
        $testimonial->update([
            'published' => true,
            'moderation_status' => 'approved',
        ]);

        return back()->with('success', 'Ulasan dipublikasikan.');
    }

    public function unpublish(CmsTestimonial $testimonial): RedirectResponse
    {
        $testimonial->update(['published' => false]);

        return back()->with('success', 'Ulasan disembunyikan.');
    }

    protected function marketplaceScreenshotIndex(string $q, mixed $published): Response
    {
        // Sinkron dengan feed publik /reviews/ss: semua ulasan published
        // yang punya screenshot, bukan hanya source Shopee/WhatsApp.
        $query = CmsTestimonial::query()
            ->published()
            ->withScreenshot()
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
            'title' => 'Ulasan Pelanggan',
            'description' => 'Kelola ulasan pembeli dari transaksi website dan tangkapan layar marketplace (Shopee, Tokopedia, WA).',
            'tab' => 'eksternal',
            'tabs' => $this->tabs(),
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
                ['value' => '1', 'label' => 'Tampil'],
                ['value' => '0', 'label' => 'Tersembunyi'],
            ],
            'createHref' => route('admin.testimonials.create', ['intent' => 'marketplace']),
            'createLabel' => 'Tambah',
            'indexRoute' => 'admin.testimonials.index',
            'pageMeta' => null,
            'metaUrl' => null,
            'metaHint' => null,
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
                    'source_url' => route('admin.testimonials.source', $t),
                    'location' => $t->location,
                    'product' => $t->product
                        ? ($t->product->short_name ?: $t->product->name).' ('.$t->product->parent_sku.')'
                        : null,
                    'image_url' => $t->image_url,
                    // Jumlah media memakai sumber yang sama dengan storefront,
                    // supaya penanda di daftar tidak berbeda dari yang dilihat
                    // pembeli. Kolom daftar hanya memuat ubin sampul.
                    'media_count' => count($t->imagesPayload()),
                    'sort_order' => $t->sort_order,
                    'published' => $t->published,
                    'created_at' => optional($t->created_at)?->toIso8601String(),
                    'edit_href' => route('admin.testimonials.edit', ['testimonial' => $t, 'intent' => 'marketplace']),
                    'publish_url' => route('admin.testimonials.publish', $t),
                    'unpublish_url' => route('admin.testimonials.unpublish', $t),
                    // Data balasan, sama seperti tab website. Tab ini memuat
                    // ulasan bertaut produk yang punya teks, jadi kolom Balasan
                    // di tabelnya memang bisa dipakai. Ulasan yang benar-benar
                    // dari marketplace tetap ditolak backend karena tanpa teks.
                    'admin_reply' => $t->admin_reply,
                    'admin_replied_at' => optional($t->admin_replied_at)?->toIso8601String(),
                    'has_reply' => $t->hasAdminReply(),
                    'can_reply' => ! in_array((string) $t->source, CmsTestimonial::MARKETPLACE_SOURCES, true),
                    'reply_url' => route('admin.testimonials.reply', $t),
                    'destroy_reply_url' => route('admin.testimonials.reply.destroy', $t),
                ];
            })->all(),
            'pagination' => null,
        ]);
    }

    protected function websiteIndex(string $q, string $sort, mixed $published, string $channel = 'all', string $reply = 'all'): Response
    {
        if (! in_array($channel, ['all', 'marketplace', 'website'], true)) {
            $channel = 'all';
        }

        if (! in_array($reply, ['all', 'replied', 'unreplied'], true)) {
            $reply = 'all';
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

        if ($reply === 'replied') {
            $query->replied();
        } elseif ($reply === 'unreplied') {
            $query->unreplied();
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
            'title' => 'Ulasan Pelanggan',
            'description' => 'Kelola ulasan pembeli dari transaksi website, tangkapan layar marketplace (Shopee, Tokopedia, WA), dan foto hasil pemasangan.',
            'tab' => 'website',
            'tabs' => $this->tabs(),
            'filters' => [
                'q' => $q,
                'sort' => in_array($sort, ['newest', 'oldest', 'rating_desc', 'rating_asc', 'sort_order'], true) ? $sort : 'newest',
                'published' => in_array($published, ['1', '0'], true) ? $published : '',
                'channel' => $channel,
                'reply' => $reply,
            ],
            'channelOptions' => [
                ['value' => 'all', 'label' => 'Semua sumber'],
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
                ['value' => '1', 'label' => 'Tampil'],
                ['value' => '0', 'label' => 'Tersembunyi'],
            ],
            'replyOptions' => [
                ['value' => 'all', 'label' => 'Semua balasan'],
                ['value' => 'unreplied', 'label' => 'Belum dibalas'],
                ['value' => 'replied', 'label' => 'Sudah dibalas'],
            ],
            'createHref' => route('admin.testimonials.create'),
            'createLabel' => 'Tambah',
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
                    // Jumlah media memakai sumber yang sama dengan storefront,
                    // supaya penanda di daftar tidak berbeda dari yang dilihat
                    // pembeli. Kolom daftar hanya memuat ubin sampul.
                    'media_count' => count($t->imagesPayload()),
                    'sort_order' => $t->sort_order,
                    'published' => $t->published,
                    'created_at' => optional($t->created_at)?->toIso8601String(),
                    'edit_href' => route('admin.testimonials.edit', $t),
                    'publish_url' => route('admin.testimonials.publish', $t),
                    'unpublish_url' => route('admin.testimonials.unpublish', $t),
                    // Balasan admin (owner 2026-09-18). Kartu marketplace murni
                    // screenshot tanpa teks, jadi tombol balas hanya untuk ulasan website.
                    'admin_reply' => $t->admin_reply,
                    'admin_replied_at' => optional($t->admin_replied_at)?->toIso8601String(),
                    'has_reply' => $t->hasAdminReply(),
                    'can_reply' => ! in_array((string) $t->source, CmsTestimonial::MARKETPLACE_SOURCES, true),
                    'reply_url' => route('admin.testimonials.reply', $t),
                    'destroy_reply_url' => route('admin.testimonials.reply.destroy', $t),
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
                        : route('admin.media.library'),
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
            'title' => 'Ulasan Pelanggan',
            'description' => 'Kelola ulasan pembeli dari transaksi website, tangkapan layar marketplace (Shopee, Tokopedia, WA), dan foto hasil pemasangan.',
            'tab' => 'foto',
            'tabs' => [],
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
                ['value' => '1', 'label' => 'Tampil'],
                ['value' => '0', 'label' => 'Tersembunyi'],
            ],
            'createHref' => route('admin.gallery-items.create'),
            'createLabel' => 'Tambah',
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
                'key' => 'eksternal',
                // Nama yang dipakai dokumen kanonik (docs/sitemap/admin-sitemap.md)
                // dan sudah dipakai storefront; kunci tab tetap 'eksternal'
                // supaya tautan lama tidak pecah.
                'label' => 'Apa Kata Pelanggan',
                'href' => route('admin.testimonials.index', ['tab' => 'eksternal']),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function validated(Request $request, ?CmsTestimonial $existing = null): array
    {
        $validated = $request->validate([
            'customer_name' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'source' => ['required', Rule::in(CmsTestimonial::SOURCES)],
            'location' => ['nullable', 'string', 'max:255'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            // Skema media form admin: daftar id aset Media Library berurutan
            // (foto pertama = gambar utama), sama seperti ProductForm,
            // ModelProducts, dan MasalahSolusi.
            'media_asset_ids' => ['nullable', 'array', 'max:'.CmsTestimonial::MAX_PHOTOS],
            'media_asset_ids.*' => ['integer', 'exists:media_assets,id'],
            // Skema lama untuk URL tempelan dan foto warisan; tetap dipertahankan
            // supaya tautan luar (screenshot lama) tidak hilang.
            'image_urls' => ['nullable', 'array', 'max:'.CmsTestimonial::MAX_PHOTOS],
            'image_urls.*' => ['nullable', 'string', 'max:2048'],
            'image' => ['nullable', 'image', 'max:5120'],
            'media_asset_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'published' => ['boolean'],
        ]);

        $validated['customer_name'] = filled($validated['customer_name'] ?? null) ? trim((string) $validated['customer_name']) : 'Pelanggan';
        // Toggle "Tampilkan di storefront" dihapus dari form (keputusan owner
        // 2026-09-29): ulasan langsung aktif saat dibuat. Saat menyunting,
        // status lama dipertahankan supaya ulasan yang sudah disembunyikan
        // lewat aksi Sembunyikan di daftar tidak hidup lagi hanya karena
        // disunting. Untuk menyembunyikan dipakai aksi di daftar.
        $validated['published'] = $request->exists('published')
            ? $request->boolean('published')
            : ($existing?->published ?? true);
        // Form tidak lagi mengirim urutan (fitur dihapus owner 2026-09-29), jadi
        // saat menyunting urutan lama dipertahankan; hanya ulasan baru yang
        // mulai dari 0 dan bisa diatur lewat Urutkan di daftar.
        $validated['sort_order'] = $validated['sort_order'] ?? ($existing?->sort_order ?? 0);
        $validated['product_id'] = ! empty($validated['product_id'] ?? null) ? (int) $validated['product_id'] : null;
        $validated['rating'] = $validated['rating'] ?? null;
        $validated['message'] = filled($validated['message'] ?? null) ? trim((string) $validated['message']) : null;

        // Form baru selalu mengirim kunci daftar foto (walau kosong). Kehadirannya
        // berarti daftar foto di form adalah sumber kebenaran, sehingga jalur
        // warisan "pertahankan gambar lama" di bawah tidak boleh dipakai: kalau
        // tidak, foto yang dihapus admin akan muncul kembali.
        $kirimDaftarFoto = $request->exists('media_asset_ids') || $request->exists('image_urls');

        $imageUrl = filled($validated['image_url'] ?? null) ? trim((string) $validated['image_url']) : null;
        $imageUrlEksplisit = $imageUrl !== null;
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $name = MediaNamer::onDisk('testimonial', $file->getClientOriginalExtension() ?: 'jpg', 'media', 'testimonials');
            $path = $file->storeAs('testimonials', $name, 'media');
            $imageUrl = Storage::disk('media')->url($path);
            $imageUrlEksplisit = true;
        } elseif ($imageUrl === null && $existing !== null && ! $request->exists('image_url') && ! $kirimDaftarFoto) {
            $imageUrl = $existing->image_url;
        }

        // Pilihan dari MediaPicker (modal Kelola Media): resolve public URL
        // aset Media Library sebagai screenshot. Menang atas URL manual.
        $mediaAssetId = $validated['media_asset_id'] ?? null;
        if (! empty($mediaAssetId)) {
            $asset = MediaAsset::query()->find((int) $mediaAssetId);
            if ($asset) {
                $imageUrl = $asset->urlFor('pdp') ?? $asset->urlFor('card') ?? $asset->urlFor('thumb') ?? $imageUrl;
                $imageUrlEksplisit = true;
            }
        }
        unset($validated['media_asset_id']);

        $validated['image_url'] = $imageUrl;
        unset($validated['image']);

        // Daftar foto berurutan (form baru, 2026-09-29) memakai skema yang sama
        // dengan form admin lain: `media_asset_ids` berurutan untuk aset Media
        // Library, `image_urls` untuk URL tempelan/foto warisan. URL aset
        // ditanyakan ke server (klien hanya mengirim id), lalu seluruh foto
        // dirapikan: unik dan berurutan. Foto pertama jadi gambar utama; kolom
        // image_url/image_urls tetap dipakai supaya seluruh konsumen lama
        // (kartu, scope, ekspor) tidak perlu berubah.
        $assetUrls = $this->resolveMediaAssetIds($validated['media_asset_ids'] ?? []);
        $imageUrls = array_values(array_filter(array_map(
            static fn ($url) => is_string($url) ? trim($url) : '',
            $validated['image_urls'] ?? [],
        )));

        $semuaFoto = array_values(array_unique([...$assetUrls, ...$imageUrls]));
        if (count($semuaFoto) > CmsTestimonial::MAX_PHOTOS) {
            throw ValidationException::withMessages([
                'media_asset_ids' => 'Maksimal '.CmsTestimonial::MAX_PHOTOS.' foto per ulasan (termasuk foto dari URL).',
            ]);
        }

        if ($imageUrlEksplisit && $imageUrl !== null) {
            // URL utama dikirim eksplisit (alur screenshot marketplace dan tes
            // lama): pertahankan sebagai gambar utama, sisanya jadi tambahan.
            $imageUrls = array_values(array_filter($semuaFoto, fn ($url) => $url !== $imageUrl));
            $validated['image_url'] = $imageUrl;
        } elseif ($semuaFoto !== []) {
            $validated['image_url'] = $semuaFoto[0];
            $imageUrls = array_slice($semuaFoto, 1);
        } elseif ($kirimDaftarFoto) {
            // Daftar foto kosong = admin menghapus semua foto.
            $validated['image_url'] = null;
            $imageUrls = [];
        }
        unset($validated['media_asset_ids']);
        $validated['image_urls'] = $imageUrls !== [] ? array_values($imageUrls) : null;

        // Nilai yang dipakai pemeriksaan wajib-isi di bawah: gambar utama hasil
        // daftar foto sudah masuk $validated['image_url'] di atas.
        $imageUrl = $validated['image_url'];

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

    /**
     * Ubah daftar id aset Media Library menjadi daftar URL publik berurutan.
     *
     * Skema yang sama dipakai ProductForm, ModelProducts, dan MasalahSolusi:
     * klien mengirim id aset, server yang menyelesaikan URL-nya sehingga URL
     * basi atau URL pratinjau tidak pernah tersimpan. Hasilnya unik dan tetap
     * berurutan supaya foto pertama bisa ditetapkan sebagai gambar utama.
     *
     * @param  list<int|string>  $assetIds
     * @return list<string>
     */
    protected function resolveMediaAssetIds(array $assetIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map(
            static fn ($id) => is_numeric($id) ? (int) $id : 0,
            $assetIds,
        ))));

        if ($ids === []) {
            return [];
        }

        $urls = [];
        foreach (MediaAsset::query()->whereIn('id', $ids)->get() as $asset) {
            $url = $asset->urlFor('pdp') ?? $asset->urlFor('card') ?? $asset->urlFor('thumb');
            if (filled($url)) {
                $urls[(int) $asset->id] = (string) $url;
            }
        }

        // Urutan mengikuti urutan kiriman form, bukan urutan hasil query.
        return array_values(array_filter(array_map(fn (int $id) => $urls[$id] ?? null, $ids)));
    }

    protected function testimonialsPageId(): int
    {
        return TestimonialPageSettings::pageId();
    }

    /**
     * Produk terkait yang tersimpan, dalam bentuk yang sama dengan
     * ProductPicker (skema reusable yang dipakai form promo). Taxa pratinjau
     * di form saat menyunting tanpa memuat ulang daftar produk.
     *
     * @return array{id:int,parent_sku:string,name:string,category:string,model:string,sub_model:string,price:float,dimensions:string}|null
     */
    protected function initialProductFor(?CmsTestimonial $testimonial): ?array
    {
        if (! $testimonial || ! $testimonial->product_id) {
            return null;
        }

        $product = Product::query()->find($testimonial->product_id);
        if (! $product) {
            return null;
        }

        return [
            'id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'category' => (string) $product->product_category,
            'model' => (string) $product->product_model,
            'sub_model' => (string) $product->design_variant,
            'price' => 0.0,
            'dimensions' => (string) ($product->short_name ?? ''),
        ];
    }

    /** Ubah sumber testimoni secara cepat dari tabel (kolom Sumber). */
    public function updateSource(Request $request, CmsTestimonial $testimonial): RedirectResponse
    {
        $validated = $request->validate([
            'source' => ['required', Rule::in(CmsTestimonial::SOURCES)],
        ]);

        $from = (string) $testimonial->source;
        $testimonial->update(['source' => $validated['source']]);

        ActivityLogService::record(
            'cms.testimonial_source_updated',
            'cms_testimonial',
            $testimonial->id,
            ['from' => $from, 'to' => $validated['source']],
            $request->user()?->id,
        );

        return back()->with('success', 'Sumber testimoni diperbarui.');
    }

    public function moderate(Request $request, CmsTestimonial $testimonial): RedirectResponse
    {
        $validated = $request->validate(['moderation_status' => ['required', Rule::in(CmsTestimonial::MODERATION_STATUSES)]]);
        $from = $testimonial->moderation_status ?: 'approved';
        $testimonial->update(['moderation_status' => $validated['moderation_status'], 'published' => $validated['moderation_status'] === 'approved' ? $testimonial->published : false]);
        ActivityLogService::record('cms.testimonial_moderated', 'cms_testimonial', $testimonial->id, ['from' => $from, 'to' => $validated['moderation_status'], 'author_type' => $testimonial->author_type], $request->user()?->id);
        return back()->with('success', 'Status moderasi ulasan diperbarui.');
    }

    /**
     * Simpan balasan admin atas ulasan pelanggan (owner 2026-09-18).
     *
     * Balasan hidup di baris ulasan yang sama supaya teks pelanggan tetap utuh.
     * published & moderation_status SENGAJA tidak disentuh: membalas boleh
     * KAPAN PUN, termasuk pada ulasan yang sudah tayang, dan membalas tidak
     * pernah menarik ulasan itu turun dari storefront (owner 2026-09-21).
     */
    public function reply(Request $request, CmsTestimonial $testimonial): RedirectResponse
    {
        if (in_array((string) $testimonial->source, CmsTestimonial::MARKETPLACE_SOURCES, true)) {
            return back()->with('error', 'Ulasan marketplace tidak punya teks, jadi tidak bisa dibalas.');
        }

        $validated = $request->validate([
            'admin_reply' => ['required', 'string', 'min:2', 'max:1000'],
        ], [
            'admin_reply.required' => 'Isi balasan tidak boleh kosong.',
            'admin_reply.min' => 'Balasan minimal 2 karakter.',
            'admin_reply.max' => 'Balasan maksimal 1000 karakter.',
        ]);

        $before = ['admin_reply' => $testimonial->admin_reply];
        $testimonial->update([
            'admin_reply' => trim((string) $validated['admin_reply']),
            'admin_replied_at' => now(),
            'admin_reply_admin_id' => $request->user()?->id,
        ]);

        ActivityLogService::record(
            'cms.testimonial_replied',
            'cms_testimonial',
            $testimonial->id,
            ['customer_name' => $testimonial->customer_name],
            $request->user()?->id,
            'admin',
            $before,
            ['admin_reply' => $testimonial->admin_reply],
        );

        // WA balasan ulasan (owner 2026-09-21). Kirim HANYA pada balasan
        // PERTAMA: mengedit balasan yang sudah ada tidak boleh mengirim pesan
        // kedua ke pelanggan. Kegagalan pengiriman tidak menggagalkan permintaan
        // admin, statusnya tetap tercatat di baris whatsapp_messages.
        if (trim((string) ($before['admin_reply'] ?? '')) === '') {
            app(WhatsAppService::class)->notifyReviewReplied($testimonial);
        }

        return back()->with('success', 'Balasan ulasan disimpan.');
    }

    /** Hapus balasan admin. Ulasannya sendiri tidak ikut terhapus. */
    public function destroyReply(Request $request, CmsTestimonial $testimonial): RedirectResponse
    {
        if (! $testimonial->hasAdminReply()) {
            return back()->with('error', 'Ulasan ini belum punya balasan.');
        }

        $before = ['admin_reply' => $testimonial->admin_reply];
        $testimonial->update([
            'admin_reply' => null,
            'admin_replied_at' => null,
            'admin_reply_admin_id' => null,
        ]);

        ActivityLogService::record(
            'cms.testimonial_reply_deleted',
            'cms_testimonial',
            $testimonial->id,
            ['customer_name' => $testimonial->customer_name],
            $request->user()?->id,
            'admin',
            $before,
            ['admin_reply' => null],
        );

        return back()->with('success', 'Balasan ulasan dihapus.');
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
}
