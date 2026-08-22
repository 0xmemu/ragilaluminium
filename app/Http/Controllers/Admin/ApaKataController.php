<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsTestimonial;
use App\Services\ActivityLogService;
use App\Support\TestimonialPageSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pengaturan Website -> Apa Kata Pelanggan Kami.
 * Scope terpisah dari menu core Ulasan (TestimonialController).
 */
class ApaKataController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $published = $request->query('published');

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

        return Inertia::render('Admin/ApaKata/Index', [
            'title' => 'Apa Kata Pelanggan Kami',
            'description' => 'Hanya screenshot percakapan/ulasan Shopee atau WhatsApp di luar transaksi website. Geser urutan untuk prioritas tampilan di beranda dan /reviews.',
            'filters' => [
                'q' => $q,
                'published' => in_array($published, ['1', '0'], true) ? $published : '',
            ],
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
        ]);
    }

    public function updateMeta(Request $request): RedirectResponse
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

    public function reorder(Request $request): RedirectResponse
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
}