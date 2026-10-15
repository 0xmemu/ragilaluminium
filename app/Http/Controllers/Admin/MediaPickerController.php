<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Support\LikeSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * JSON endpoint untuk MediaPicker di form produk (ADR-020):
 * pilih aset siap pakai dari Media Library tanpa keluar dari form.
 * Mendukung filter folder, pencarian label/produk, dan info produk pemakai.
 */
class MediaPickerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $folderId = $request->query('folder_id');
        // Penyaring jenis HARUS di query, bukan di sisi klien: daftar dibatasi
        // 48 aset terbaru lebih dulu, sehingga video lama tidak pernah muncul
        // bila penyaringan baru dilakukan setelah batas itu dipotong.
        $kind = $request->query('kind');
        $kind = in_array($kind, ['image', 'video'], true) ? $kind : null;

        $assets = MediaAsset::query()
            ->with(['folder:id,name', 'attachments.product:id,name'])
            ->where('status', 'ready')
            ->where('visibility', '!=', 'archived')
            ->when($kind !== null, fn ($query) => $query->where('kind', $kind))
            ->when($folderId !== null && $folderId !== '', function ($query) use ($folderId): void {
                if ($folderId === 'inbox' || $folderId === 'null') {
                    $query->whereNull('folder_id');

                    return;
                }

                // Folder induk harus mencakup sub-folder di bawahnya: aset
                // umumnya tersimpan di sub-folder, sehingga exact match membuat
                // folder induk tampak kosong (temuan owner 2026-09-17).
                $folder = MediaFolder::find((int) $folderId);
                $query->whereIn('folder_id', $folder ? $folder->descendantIds() : [(int) $folderId]);
            })
            ->when($q !== '', function ($query) use ($q): void {
                $query->where(function ($inner) use ($q): void {
                    LikeSearch::whereLike($inner, 'label', $q);
                    $inner->orWhereHas('attachments.product', function ($pQuery) use ($q): void {
                        LikeSearch::whereLike($pQuery, 'name', $q);
                    });
                });
            })
            ->orderByDesc('id')
            ->limit(48)
            ->get(['id', 'label', 'kind', 'status', 'object_key', 'derivatives', 'folder_id']);

        // Angka folder memuat isi subfolder, sama seperti daftar Media Library,
        // supaya folder induk tidak tampak kosong di pemilih media. Rinciannya
        // dihitung server lewat MediaFolder::deepAssetCounts() supaya aturannya
        // cuma ada satu.
        $deepCounts = MediaFolder::deepAssetCounts();
        $allFolders = MediaFolder::query()
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name'])
            ->map(fn (MediaFolder $folder) => [
                'id' => (int) $folder->id,
                'parent_id' => $folder->parent_id === null ? null : (int) $folder->parent_id,
                'name' => (string) $folder->name,
                'assets_count' => (int) ($deepCounts[(int) $folder->id] ?? 0),
            ])
            ->values()
            ->all();

        $inboxCount = MediaAsset::query()
            ->where('status', 'ready')
            ->where('visibility', '!=', 'archived')
            ->whereNull('folder_id')
            ->count();

        return response()->json([
            'assets' => $assets->map(function (MediaAsset $asset) {
                $products = $asset->attachments
                    ->map(fn ($att) => $att->product?->name)
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();

                return [
                    'id' => $asset->id,
                    'label' => $asset->label ?: ('Media #'.$asset->id),
                    'kind' => $asset->kind,
                    'thumb_url' => $asset->urlFor('thumb'),
                    'pdp_url' => $asset->urlFor('pdp') ?? $asset->urlFor('card'),
                    'folder_id' => $asset->folder_id,
                    'folder_name' => $asset->folder?->name,
                    'product_names' => $products,
                ];
            })->values()->all(),
            'folders' => $allFolders,
            'inbox_count' => $inboxCount,
        ]);
    }

    /**
     * Saran folder Media Library untuk sebuah produk (owner 2026-09-16).
     *
     * Konvensi struktur folder:
     *   {Kategori} {Model-dasar}/{dimensi} (mis. "Jendela Swing/180x160").
     * Root di-resolve dari label katalog; dimensi dicari dgn dua urutan
     * (tinggi x panjang dan panjang x tinggi) karena penamaan historis
     * tidak konsisten. Bila belum ada, folder root+dimensi dibuat.
     *
     * @return JsonResponse
     */
    public function suggestFolder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ]);

        $product = \App\Models\Product::query()->findOrFail((int) $validated['product_id']);

        $categoryLabel = \App\Support\CatalogLabels::category($product->product_category);
        $modelLabel = \App\Support\CatalogLabels::model($product->product_model);

        // Model 1/2/3 Daun memakai root kategori+model dasar ("Jendela Swing").
        // Model lain (Zigzag, Kaca Mati) memakai root kategori+model penuh.
        $baseModel = str_contains($modelLabel, 'Daun')
            ? trim(str_replace(['Satu Daun', 'Dua Daun', 'Tiga Daun'], '', $modelLabel))
            : $modelLabel;
        $rootName = trim($categoryLabel.' '.$baseModel);

        $root = MediaFolder::query()->where('name', $rootName)->first();

        $dimFolder = null;
        $height = (int) round((float) $product->height_cm);
        $width = (int) round((float) $product->width_cm);
        $dims = array_values(array_unique(array_filter([
            $width !== 0 && $height !== 0 ? $width.'x'.$height : '',
            $width !== 0 && $height !== 0 ? $height.'x'.$width : '',
        ])));

        if ($root && $dims !== []) {
            $dimFolder = MediaFolder::query()
                ->where('parent_id', $root->id)
                ->where(fn ($q) => $q->whereIn('name', $dims))
                ->first();

            // Buat folder dimensi bila belum ada agar konsolidasi media per ukuran.
            if (! $dimFolder) {
                $dimFolder = MediaFolder::create([
                    'name' => $dims[0],
                    'parent_id' => $root->id,
                ]);
            }
        }

        return response()->json([
            'root_name' => $rootName,
            'root_id' => $root?->id,
            'dimension_folder_id' => $dimFolder?->id,
            'dimension_folder_name' => $dimFolder?->name,
        ]);
    }
}
