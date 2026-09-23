<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\DownloadMediaAsset;
use App\Jobs\DownloadProductMedia;
use App\Jobs\ProcessUploadedMediaAsset;
use App\Models\CmsBanner;
use App\Models\CmsGalleryItem;
use App\Models\MediaAsset;
use App\Models\MediaProcessingLog;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Services\MediaAssetResolver;
use App\Support\InertiaAdmin;
use App\Support\LikeSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProductMediaController extends Controller
{

    public function byProduct(Request $request, Product $product): \Illuminate\Http\RedirectResponse
    {
        // Halaman media khusus dihapus (redundan dgn tab Media di halaman edit).
        // GET browser dan Inertia sama-sama dialihkan ke tab Media.
        $params = ['product' => $product, 'tab' => 'media'];
        if (filled($request->query('variant'))) {
            $params['variant'] = $request->query('variant');
        }

        return redirect()->route('admin.products.edit', $params);
    }

    /**
     * Halaman Media Library global: browse semua shared asset dengan filter
     * konteks/pencarian + attach lintas produk (tanpa harus buka media produk).
     */
    public function library(Request $request): Response
    {
        $assets = MediaAsset::query()
            ->withCount(['attachments as usage_count' => fn ($query) => $query->where('visibility', '!=', 'archived')])
            ->when($request->filled('folder_id'), function ($query) use ($request): void {
                $folderId = (int) $request->query('folder_id');
                if ($folderId === 0) {
                    $query->whereNull('folder_id'); // Inbox
                } else {
                    $query->where('folder_id', $folderId);
                }
            })
            ->when(! $request->filled('visibility'), fn ($query) => $query->where('visibility', '!=', 'archived'))
            // Status arsip (duplikat dedup) tidak punya file/derivatives; sembunyikan
            // kecuali filter status dipilih eksplisit.
            ->when(! $request->filled('status'), fn ($query) => $query->where('status', '!=', 'archived'))
            ->when($request->filled('q'), function ($query) use ($request): void {
                $q = trim((string) $request->query('q'));
                $query->where(fn ($inner) => LikeSearch::whereLike($inner, 'label', $q)->orWhereRaw('source_url LIKE ? ESCAPE ?', [LikeSearch::pattern($q), '\\']));
            })
            ->when($request->filled('kind'), fn ($query) => $query->where('kind', $request->query('kind')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('visibility'), fn ($query) => $query->where('visibility', $request->query('visibility')))
            ->orderByDesc('id')
            ->paginate(30)
            ->withQueryString();

        $folderTree = $this->folderTree();

        return Inertia::render('Admin/Media/Library', [
            'assets' => $assets->getCollection()->map(fn (MediaAsset $asset) => [
                'id' => $asset->id,
                'label' => $asset->label ?: 'Media #'.$asset->id,
                'kind' => $asset->kind,
                'status' => $asset->status,
                'usage_count' => (int) $asset->usage_count,
                'folder_id' => $asset->folder_id,
                'thumb_url' => $asset->urlFor('thumb'),
                'media_url' => $asset->urlFor($asset->kind === 'video' ? 'video' : 'thumb'),
                'public_url' => $asset->publicUrlForPath((string) $asset->object_key),
                'error_reason' => $asset->error_reason,
                'context' => self::libraryContext($asset->label),
                'attach_url' => route('admin.media.attach.show', $asset),
                'created_at' => optional($asset->created_at)?->toIso8601String(),
            ])->values()->all(),
            'folders' => $folderTree,
            'pagination' => InertiaAdmin::pagination($assets),
            'filters' => [
                'q' => (string) $request->query('q', ''),
                'kind' => (string) $request->query('kind', ''),
                'status' => (string) $request->query('status', ''),
                'visibility' => (string) $request->query('visibility', ''),
                'folder_id' => (string) $request->query('folder_id', ''),
            ],
            'historyHref' => route('admin.media.history'),
        ]);
    }

    protected function folderTree(): array
    {
        $folders = \App\Models\MediaFolder::query()
            ->withCount('assets')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
        $build = function (?int $parentId) use ($folders, &$build): array {
            return $folders->where('parent_id', $parentId)->values()->map(fn ($f) => [
                'id' => $f->id,
                'name' => $f->name,
                'assets_count' => (int) $f->assets_count,
                'children' => $build((int) $f->id),
            ])->all();
        };

        return $build(null);
    }

    protected static function libraryContext(?string $label): string
    {
        $label = strtolower((string) $label);
        if (str_starts_with($label, 'hasil-pemasangan')) {
            return 'hasil-pemasangan';
        }
        if (str_starts_with($label, 'banner')) {
            return 'banner';
        }
        if (str_starts_with($label, 'media')) {
            return 'media';
        }

        return 'lainnya';
    }

    public function store(Request $request, Product $product): RedirectResponse
    {
        if ($request->exists('product_variant_id') && ! $request->filled('product_variant_id')) {
            $request->merge(['product_variant_id' => null]);
        }

        $validated = $request->validate([
            'kind' => ['sometimes', 'in:image,video'],
            'source_url' => ['nullable', 'url'],
            'media_asset_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'position' => ['required', 'integer', 'min:1', 'max:109'],
            'is_main_image' => ['boolean'],
            'show_in_catalog' => ['boolean'],
            'is_installation' => ['boolean'],
            'installation_caption' => ['nullable', 'string', 'max:280'],
            'visibility' => ['required', 'in:visible,archived,hidden'],
            // §6 boundary: batasi jenis file — bukan sekadar ukuran. File arbitrer
            // tidak boleh masuk R2 (admin-only, tapi mimes menutup celah upload bebas).
            'upload' => ['nullable', 'file', 'max:51200', 'mimes:jpeg,png,webp,gif,mp4,webm'],
            'product_variant_id' => [
                'nullable',
                'integer',
                Rule::exists('product_variants', 'id')->where('product_id', $product->id),
            ],
        ]);

        $kind = $validated['kind'] ?? 'image';
        if ($kind === 'video' && ! empty($validated['is_main_image'])) {
            return redirect()->back()->withErrors(['kind' => 'Video tidak dapat dijadikan gambar utama.']);
        }

        $resolver = app(MediaAssetResolver::class);
        try {
            $asset = ! empty($validated['media_asset_id'])
                ? MediaAsset::where('visibility', '!=', 'archived')->findOrFail((int) $validated['media_asset_id'])
                : ($request->hasFile('upload')
                    ? $resolver->fromUploadedFile($request->file('upload'), $kind, (int) $request->user()->id)
                    : (! empty($validated['source_url'])
                        ? $resolver->fromSourceUrl((string) $validated['source_url'], $kind, (int) $request->user()->id)
                        : null));
        } catch (\Throwable $e) {
            return redirect()->back()->withErrors(['upload' => $e->getMessage()]);
        }

        if (! $asset) {
            return redirect()->back()->withErrors(['source_url' => 'Pilih media library, upload file, atau isi source URL.']);
        }

        if ($asset->kind !== $kind) {
            return redirect()->back()->withErrors(['kind' => 'Jenis media tidak cocok dengan aset yang dipilih.']);
        }

        $media = $resolver->attach($product, $asset, [
            'product_variant_id' => $validated['product_variant_id'] ?? null,
            'position' => $validated['position'],
            'is_main_image' => $kind === 'image' && ($validated['is_main_image'] ?? false),
            'show_in_catalog' => $validated['show_in_catalog'] ?? true,
            'is_installation' => $validated['is_installation'] ?? false,
            'installation_caption' => filled($validated['installation_caption'] ?? null) ? trim($validated['installation_caption']) : null,
            'visibility' => $validated['visibility'],
        ], (int) $request->user()->id);

        if ($asset->status === 'pending') {
            DownloadMediaAsset::dispatch($asset->id);
        }

        $params = ['product' => $product];
        if (! empty($validated['product_variant_id'])) {
            $params['variant'] = $validated['product_variant_id'];
        }

        return redirect()
            ->route('admin.products.media.byProduct', $params)
            ->with('success', 'Media ditambahkan.');
    }

    public function attachPage(Request $request, MediaAsset $asset): Response
    {
        $usages = \App\Models\ProductMedia::query()
            ->where('media_asset_id', $asset->id)
            ->with('product:id,name,parent_sku,status')
            ->latest('id')
            ->limit(50)
            ->get()
            ->filter(fn ($m) => $m->product !== null)
            ->values();

        return Inertia::render('Admin/Media/Attach', [
            'asset' => [
                'id' => $asset->id,
                'label' => $asset->label ?: 'Media #'.$asset->id,
                'kind' => $asset->kind,
                'status' => $asset->status,
                'thumb_url' => $asset->urlFor('thumb'),
                'public_url' => $asset->publicUrlForPath((string) $asset->object_key),
                'created_at' => optional($asset->created_at)?->toIso8601String(),
            ],
            'usages' => $usages->map(fn ($m) => [
                'product_id' => $m->product->id,
                'product_name' => $m->product->name,
                'parent_sku' => $m->product->parent_sku,
                'position' => $m->position,
                'is_main' => (bool) $m->is_main_image,
                'is_installation' => (bool) $m->is_installation,
                'show_in_catalog' => (bool) $m->show_in_catalog,
                'visibility' => $m->visibility,
            ])->all(),
            // Owner 2026-09-16: form pasang-ke-produk langsung dari halaman detail media.
            // Nama route wajib berawalan `admin.`: seluruh route admin didaftarkan
            // di dalam grup ->name('admin.'), sehingga `media.attach` dan
            // `media.assets.destroy` tidak pernah terdaftar dan halaman ini 500.
            'attachUrl' => route('admin.media.attach', $asset),
            'libraryHref' => route('admin.media.library'),
            'destroyUrl' => route('admin.media.assets.destroy', $asset),
        ]);
    }

    public function bulkAttach(Request $request, MediaAsset $asset): RedirectResponse
    {
        $validated = $request->validate([
            'product_ids' => ['required', 'array', 'min:1', 'max:100'],
            'product_ids.*' => ['integer', 'distinct', 'exists:products,id'],
            'position' => ['required', 'integer', 'min:1', 'max:109'],
            'show_in_catalog' => ['boolean'],
            'is_installation' => ['boolean'],
            'is_main_image' => ['boolean'],
            'visibility' => ['required', 'in:visible,hidden,archived'],
        ]);

        if ($asset->visibility === 'archived') {
            return redirect()->back()->with('error', 'Shared asset yang sudah diarsipkan tidak dapat dipasang.');
        }
        if ($asset->kind === 'video' && ! empty($validated['is_main_image'])) {
            return redirect()->back()->with('error', 'Video tidak dapat dijadikan gambar utama.');
        }

        $resolver = app(MediaAssetResolver::class);
        $products = Product::query()->whereIn('id', $validated['product_ids'])->get();
        foreach ($products as $product) {
            $resolver->attach($product, $asset, [
                'position' => $validated['position'],
                'is_main_image' => $asset->kind === 'image' && ($validated['is_main_image'] ?? false),
                'show_in_catalog' => $validated['show_in_catalog'] ?? true,
                'is_installation' => $validated['is_installation'] ?? false,
                'visibility' => $validated['visibility'],
            ], (int) $request->user()->id);
        }

        return redirect()->back()->with('success', "Media dipasang ke {$products->count()} produk.");
    }


    /**
     * Aksi massal pada shared assets di Media Library: archive atau delete.
     * Delete hanya berlaku untuk aset yang tidak dipakai entitas lain
     * (produk/banner/galeri); yang masih dipakai otomatis di-archive.
     */
    public function bulkAction(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'action' => ['required', 'in:archive,delete,restore'],
            'asset_ids' => ['required', 'array', 'min:1', 'max:200'],
            'asset_ids.*' => ['integer', 'distinct', 'exists:media_assets,id'],
        ]);

        $assets = MediaAsset::query()->whereIn('id', $validated['asset_ids'])->get();
        $deleted = 0;
        $archived = 0;
        $restored = 0;

        foreach ($assets as $asset) {
            if ($validated['action'] === 'restore') {
                if ($asset->visibility === 'archived') {
                    $asset->update(['visibility' => 'visible']);
                    $restored++;
                }

                continue;
            }
            if ($asset->visibility === 'archived') {
                continue;
            }
            if ($validated['action'] === 'archive') {
                $asset->update(['visibility' => 'archived']);
                $archived++;

                continue;
            }
            $usedElsewhere = ProductMedia::where('media_asset_id', $asset->id)->exists()
                || CmsBanner::where('media_asset_id', $asset->id)->exists()
                || CmsGalleryItem::where('media_asset_id', $asset->id)->exists();
            if ($usedElsewhere) {
                $asset->update(['visibility' => 'archived']);
                $archived++;

                continue;
            }
            $this->deleteAssetFiles($asset);
            $asset->delete();
            $deleted++;
        }

        return redirect()->back()->with('success', "{$deleted} aset dihapus, {$archived} diarsipkan, {$restored} dipulihkan.");
    }

    /**
     * Hapus permanen aset tunggal dari Media Library (hanya jika tidak digunakan di mana pun).
     */
    public function destroyAsset(MediaAsset $asset): RedirectResponse
    {
        $usedElsewhere = ProductMedia::where('media_asset_id', $asset->id)->exists()
            || \App\Models\CmsBanner::where('media_asset_id', $asset->id)->exists()
            || \App\Models\CmsGalleryItem::where('media_asset_id', $asset->id)->exists();

        if ($usedElsewhere) {
            return redirect()->back()->with('error', 'Aset media tidak dapat dihapus karena masih digunakan oleh produk atau konten website. Lepaskan tautan terlebih dahulu.');
        }

        $this->deleteAssetFiles($asset);
        $asset->delete();

        return redirect()->route('admin.media.library')->with('success', 'Aset media berhasil dihapus permanen.');
    }

    /**
     * Pencarian produk untuk panel attach di Media Library (live, debounce).
     */
    public function searchProducts(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $products = Product::query()
            ->where('status', '!=', 'archived')
            ->when($q !== '', function ($query) use ($q): void {
                $query->where(fn ($inner) => LikeSearch::whereLike($inner, 'name', $q)
                    ->orWhereRaw('parent_sku LIKE ? ESCAPE ?', [LikeSearch::pattern($q), '\\']));
            })
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'parent_sku']);

        return response()->json([
            'products' => $products->map(fn (Product $p) => [
                'id' => $p->id,
                'label' => $p->name.' · '.$p->parent_sku,
            ])->values()->all(),
        ]);
    }

    private function deleteAssetFiles(MediaAsset $asset): void
    {
        $disk = Storage::disk(config('media.disk', 'media'));
        $keys = [];
        $derivatives = is_array($asset->derivatives) ? $asset->derivatives : [];
        foreach (['thumb', 'card', 'pdp', 'poster', 'video'] as $variant) {
            $path = $derivatives[$variant]['path'] ?? null;
            if ($path && $disk->exists($path)) {
                $keys[] = $path;
            }
        }
        if ($asset->object_key && ! in_array($asset->object_key, $keys, true) && $disk->exists($asset->object_key)) {
            $keys[] = $asset->object_key;
        }
        foreach ($keys as $key) {
            $disk->delete($key);
        }
    }

    /**
     * Aksi massal pada media milik satu produk (halaman byProduct):
     * archive -> visibility=archived; delete -> mengikuti semantik destroy
     * single (hanya status failed yang dihapus permanen; failed+shared asset
     * di-archive; selain itu di-archive).
     */

    /**
     * Riwayat pemrosesan media (queued -> processing -> success / failed / dedup)
     * untuk audit job WebP yang gagal. Filter event, pencarian label/pesan, dan rentang tanggal.
     */
    public function history(Request $request): Response
    {
        $validated = $request->validate([
            'event' => ['nullable', 'in:queued,processing,success,failed,dedup,downloaded'],
            'q' => ['nullable', 'string', 'max:120'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $query = MediaProcessingLog::query()
            ->when($validated['event'] ?? null, fn ($q) => $q->where('event', $validated['event']))
            ->when(filled($validated['q'] ?? null), function ($q) use ($validated) {
                $search = LikeSearch::escape((string) $validated['q']);

                return $q->where(function ($sub) use ($search) {
                    $sub->where('entity_label', 'like', "%{$search}%")
                        ->orWhere('message', 'like', "%{$search}%");
                });
            })
            ->when(filled($validated['from'] ?? null), fn ($q) => $q->whereDate('created_at', '>=', $validated['from']))
            ->when(filled($validated['to'] ?? null), fn ($q) => $q->whereDate('created_at', '<=', $validated['to']));

        $paginator = (clone $query)->latest('created_at')->paginate(30)->withQueryString();

        $logs = collect($paginator->items())->map(function (MediaProcessingLog $log) {
            $row = $log->toArray();
            $row['retry_url'] = $log->event === 'failed' ? route('admin.media.logs.retry', $log) : null;
            $row['delete_url'] = route('admin.media.logs.destroy', $log);

            return $row;
        })->all();

        $pruneDays = (int) config('media.log_retention_days', 30);

        return Inertia::render('Admin/Media/History', [
            'libraryHref' => route('admin.media.library'),
            'logs' => $logs,
            'pagination' => InertiaAdmin::pagination($paginator),
            'filters' => [
                'event' => $validated['event'] ?? '',
                'q' => $validated['q'] ?? '',
                'from' => $validated['from'] ?? '',
                'to' => $validated['to'] ?? '',
            ],
            'prune' => [
                'days' => $pruneDays,
                'count' => MediaProcessingLog::where('created_at', '<', now()->subDays($pruneDays))->count(),
            ],
        ]);
    }

    /**
     * Status terkini batch media (ProductMedia / MediaAsset) untuk polling
     * live di halaman media produk & Media Library (pending -> ready tanpa reload).
     */
    public function status(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'kind' => ['required', 'in:product,asset'],
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        $statuses = [];
        if ($validated['kind'] === 'product') {
            $rows = ProductMedia::query()
                ->whereIn('id', $validated['ids'])
                ->get(['id', 'status', 'error_reason']);
            foreach ($rows as $row) {
                $statuses[] = [
                    'id' => $row->id,
                    'status' => $row->status,
                    'error_reason' => $row->error_reason,
                    'thumb_url' => $row->urlFor('thumb') ?? $row->stored_url,
                ];
            }
        } else {
            $rows = MediaAsset::query()
                ->whereIn('id', $validated['ids'])
                ->get(['id', 'status', 'error_reason']);
            foreach ($rows as $row) {
                $statuses[] = [
                    'id' => $row->id,
                    'status' => $row->status,
                    'error_reason' => $row->error_reason,
                    'thumb_url' => $row->urlFor('thumb'),
                ];
            }
        }

        return response()->json(['statuses' => $statuses]);
    }

    public function bulkProductMedia(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'action' => ['required', 'in:archive,delete'],
            'media_ids' => ['required', 'array', 'min:1', 'max:200'],
            'media_ids.*' => ['integer', 'distinct'],
        ]);

        $rows = ProductMedia::query()
            ->where('product_id', $product->id)
            ->whereIn('id', $validated['media_ids'])
            ->get();

        $archived = 0;
        $deleted = 0;
        $skipped = 0;
        $disk = Storage::disk(config('media.disk', 'media'));

        foreach ($rows as $media) {
            if ($validated['action'] === 'archive') {
                $media->update(['visibility' => 'archived']);
                $archived++;

                continue;
            }

            // delete: hanya media failed yang bisa dihapus permanen
            if ($media->status !== 'failed') {
                $media->update(['visibility' => 'archived']);
                $archived++;

                continue;
            }
            if ($media->media_asset_id) {
                $media->update(['visibility' => 'archived']);
                $archived++;

                continue;
            }
            $paths = array_filter([
                $media->stored_path,
                ...collect($media->derivatives ?? [])->pluck('path')->filter()->all(),
            ]);
            foreach ($paths as $path) {
                try {
                    if (is_string($path) && $path !== '' && $disk->exists($path)) {
                        $disk->delete($path);
                    }
                } catch (\Throwable) {
                    // Abaikan kegagalan cleanup storage; row tetap dihapus.
                }
            }
            $media->delete();
            $deleted++;
        }

        $message = $validated['action'] === 'archive'
            ? "{$archived} media diarsipkan."
            : "{$deleted} media dihapus permanen, {$archived} diarsipkan (hanya berstatus gagal yang bisa dihapus).";

        return redirect()->back()->with('success', $message);
    }

    public function update(Request $request, ProductMedia $media): RedirectResponse
    {
        if ($request->exists('product_variant_id') && ! $request->filled('product_variant_id')) {
            $request->merge(['product_variant_id' => null]);
        }

        $validated = $request->validate([
            'position' => ['sometimes', 'integer', 'min:1', 'max:109'],
            'visibility' => ['sometimes', 'in:visible,archived,hidden'],
            'show_in_catalog' => ['sometimes', 'boolean'],
            'is_installation' => ['sometimes', 'boolean'],
            'installation_caption' => ['nullable', 'string', 'max:280'],
            'product_variant_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('product_variants', 'id')->where('product_id', $media->product_id),
            ],
        ]);

        $media->update($validated);

        return redirect()->back()->with('success', 'Media diperbarui.');
    }

    public function setMain(ProductMedia $media): RedirectResponse
    {
        if (($media->mediaAsset?->kind ?? (str_starts_with((string) $media->mime_type, 'video/') ? 'video' : 'image')) === 'video') {
            return redirect()->back()->with('error', 'Video tidak dapat dijadikan gambar utama.');
        }

        ProductMedia::where('product_id', $media->product_id)->update(['is_main_image' => false]);
        $media->update(['is_main_image' => true]);

        return redirect()->back()->with('success', 'Gambar utama diatur.');
    }

    public function archive(ProductMedia $media): RedirectResponse
    {
        $media->update(['visibility' => 'archived']);

        return redirect()->back()->with('success', 'Media diarsipkan.');
    }

    public function restore(ProductMedia $media): RedirectResponse
    {
        $media->update(['visibility' => 'visible']);

        return redirect()->back()->with('success', 'Media dipulihkan.');
    }

    public function redownload(ProductMedia $media): RedirectResponse
    {
        $media->update(['status' => 'pending', 'error_reason' => null]);
        if ($media->media_asset_id) {
            $media->mediaAsset?->update(['status' => 'pending', 'error_reason' => null]);
            DownloadMediaAsset::dispatch($media->media_asset_id);
        } else {
            DownloadProductMedia::dispatch($media->id);
        }

        return redirect()->back()->with('success', 'Download media dijadwalkan ulang.');
    }

    /**
     * Retry pemrosesan media dari baris log (event=failed): set status pending
     * dan jadwalkan ulang job yang sesuai (upload asset / unduh dari URL).
     */
    /**
     * Hapus permanen satu baris log riwayat.
     */
    public function destroyLog(MediaProcessingLog $log): RedirectResponse
    {
        $log->delete();

        return redirect()->back()->with('success', 'Log riwayat dihapus.');
    }

    /**
     * Hapus permanen log yang lebih tua dari N hari (default 30).
     */
    public function pruneLogs(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);
        $days = (int) ($validated['days'] ?? config('media.log_retention_days', 30));

        $deleted = MediaProcessingLog::where('created_at', '<', now()->subDays($days))->delete();

        return redirect()->back()->with(
            'success',
            $deleted > 0
                ? "{$deleted} log riwayat lebih tua dari {$days} hari dihapus."
                : "Tidak ada log lebih tua dari {$days} hari.",
        );
    }

    public function retryLog(MediaProcessingLog $log): RedirectResponse
    {
        $loggable = $log->loggable;

        if ($loggable instanceof MediaAsset) {
            if ($loggable->source_url) {
                $loggable->update(['status' => 'pending', 'error_reason' => null]);
                MediaProcessingLog::record($loggable, 'queued', 'Retry: mengunduh ulang media dari URL sumber.');
                DownloadMediaAsset::dispatch($loggable->id);

                return redirect()->back()->with('success', 'Pemrosesan media dijadwalkan ulang.');
            }

            if ($loggable->object_key) {
                $loggable->update(['status' => 'pending', 'error_reason' => null]);
                MediaProcessingLog::record($loggable, 'queued', 'Retry: memproses ulang derivatif WebP.');
                ProcessUploadedMediaAsset::dispatch($loggable->id);

                return redirect()->back()->with('success', 'Pemrosesan media dijadwalkan ulang.');
            }

            return redirect()->back()->with('error', 'Aset tidak memiliki sumber untuk diproses ulang.');
        }

        if ($loggable instanceof ProductMedia) {
            $loggable->update(['status' => 'pending', 'error_reason' => null]);
            MediaProcessingLog::record($loggable, 'queued', 'Retry: mengunduh ulang media produk.');
            if ($loggable->media_asset_id) {
                $loggable->mediaAsset?->update(['status' => 'pending', 'error_reason' => null]);
                DownloadMediaAsset::dispatch($loggable->media_asset_id);
            } else {
                DownloadProductMedia::dispatch($loggable->id);
            }

            return redirect()->back()->with('success', 'Pemrosesan media dijadwalkan ulang.');
        }

        return redirect()->back()->with('error', 'Entitas media tidak ditemukan untuk diproses ulang.');
    }

    public function destroy(ProductMedia $media): RedirectResponse
    {
        if ($media->status !== 'failed') {
            return redirect()->back()->with('error', 'Hanya media berstatus gagal yang dapat dihapus permanen. Arsipkan media lain.');
        }

        if ($media->media_asset_id) {
            $media->update(['visibility' => 'archived']);

            return redirect()->back()->with('success', 'Attachment media diarsipkan tanpa menghapus shared asset.');
        }

        $paths = array_filter([
            $media->stored_path,
            ...collect($media->derivatives ?? [])->pluck('path')->filter()->all(),
        ]);

        $disk = \Illuminate\Support\Facades\Storage::disk(config('media.disk', 'media'));
        foreach ($paths as $path) {
            try {
                if (is_string($path) && $path !== '' && $disk->exists($path)) {
                    $disk->delete($path);
                }
            } catch (\Throwable) {
                // Ignore storage cleanup errors; DB row still removed.
            }
        }

        $media->delete();

        return redirect()->back()->with('success', 'Media gagal dihapus.');
    }

    protected function variantLabel(ProductVariant $variant): string
    {
        $parts = array_values(array_filter([
            $variant->variation_1_option,
            $variant->variation_2_option,
        ], fn ($v) => filled($v)));

        if ($parts === []) {
            return $variant->variant_sku;
        }

        return implode(' / ', $parts).' · '.$variant->variant_sku;
    }
}
