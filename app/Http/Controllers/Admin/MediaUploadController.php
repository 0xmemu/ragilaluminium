<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessUploadedMediaAsset;
use App\Support\MediaNamer;
use App\Models\MediaAsset;
use App\Models\MediaProcessingLog;
use App\Models\Product;
use App\Services\MediaAssetResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Alur upload langsung browser -> R2 (presigned PUT), lalu finalize di sini:
 * verifikasi object R2, buat MediaAsset + attach ke produk, dan proses WebP
 * derivatif via job async (queue media). File besar tidak pernah menetap di VPS.
 */
class MediaUploadController extends Controller
{
    /**
     * Buat presigned PUT URL untuk upload langsung ke R2.
     */
    public function presign(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'kind' => ['required', 'in:image,video'],
            'filename' => ['required', 'string', 'max:255'],
            'size_bytes' => ['required', 'integer', 'min:1'],
            'mime' => ['required', 'string', 'max:120'],
            'context' => ['nullable', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/'],
        ]);

        $kind = $validated['kind'];
        $mime = strtolower(trim($validated['mime']));
        $allowed = $kind === 'video'
            ? (array) config('media.allowed_video_mime', [])
            : (array) config('media.allowed_mime', []);
        if (! in_array($mime, $allowed, true)) {
            return response()->json(['message' => "Tipe file tidak diizinkan: {$mime}"], 422);
        }

        $maxBytes = $kind === 'video'
            ? (int) config('media.max_video_bytes', 50 * 1024 * 1024)
            : (int) config('media.max_bytes', 10 * 1024 * 1024);
        if ($validated['size_bytes'] > $maxBytes) {
            return response()->json(['message' => "Ukuran file melebihi batas {$maxBytes} byte"], 422);
        }

        $extension = $this->extensionForMime($mime);
        $name = MediaNamer::asset($validated['context'] ?? 'media', $extension);
        $key = 'pending/'.$name;

        $disk = Storage::disk(config('media.disk', 'media'));
        $upload = $disk->temporaryUploadUrl(
            $key,
            now()->addMinutes(15),
            ['Content-Type' => $mime],
        );

        return response()->json([
            'upload_url' => $upload['url'],
            'object_key' => $key,
            'expires_at' => now()->addMinutes(15)->toIso8601String(),
        ]);
    }

    /**
     * Finalisasi setelah browser selesai PUT ke R2: buat asset pending, attach
     * ke produk, dan antrekan job WebP derivatif.
     */
    public function finalize(Request $request): RedirectResponse
    {
        if ($request->exists('product_variant_id') && ! $request->filled('product_variant_id')) {
            $request->merge(['product_variant_id' => null]);
        }

        $validated = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'kind' => ['required', 'in:image,video'],
            'object_key' => ['required', 'string', 'max:255'],
            'context' => ['nullable', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/'],
            'mime' => ['nullable', 'string', 'max:120'],
            'position' => ['required', 'integer', 'min:1', 'max:109'],
            'is_main_image' => ['boolean'],
            'show_in_catalog' => ['boolean'],
            'is_installation' => ['boolean'],
            'installation_caption' => ['nullable', 'string', 'max:280'],
            'visibility' => ['required', 'in:visible,hidden,archived'],
            'product_variant_id' => [
                'nullable',
                'integer',
                Rule::exists('product_variants', 'id')->where('product_id', $validated['product_id'] ?? 0),
            ],
        ]);

        $disk = Storage::disk(config('media.disk', 'media'));
        $key = $validated['object_key'];
        if (! str_starts_with($key, 'pending/') || ! $disk->exists($key)) {
            return redirect()->back()->withErrors(['upload' => 'File upload tidak ditemukan. Silakan unggah ulang.']);
        }

        $size = (int) ($disk->size($key) ?: 0);
        $mime = strtolower((string) ($validated['mime'] ?? $this->mimeFromKey($key)));
        $allowed = $validated['kind'] === 'video'
            ? (array) config('media.allowed_video_mime', [])
            : (array) config('media.allowed_mime', []);
        if (! in_array($mime, $allowed, true)) {
            $disk->delete($key);

            return redirect()->back()->withErrors(['upload' => "Tipe file tidak diizinkan: {$mime}"]);
        }

        $product = filled($validated['product_id'] ?? null)
            ? Product::findOrFail($validated['product_id'])
            : null;
        $resolver = app(MediaAssetResolver::class);

        $label = filled($validated['context'] ?? null)
            ? pathinfo($key, PATHINFO_FILENAME)
            : null;
        $asset = MediaAsset::create([
            'kind' => $validated['kind'],
            'label' => $label,
            'checksum' => null,
            'source_url' => null,
            'object_key' => $key,
            'mime_type' => $mime,
            'size_bytes' => $size,
            'status' => 'pending',
            'visibility' => 'visible',
            'created_by_user_id' => (int) $request->user()->id,
        ]);

        if ($product) {
            $resolver->attach($product, $asset, [
                'product_variant_id' => $validated['product_variant_id'] ?? null,
                'position' => $validated['position'],
                'is_main_image' => $validated['kind'] === 'image' && ($validated['is_main_image'] ?? false),
                'show_in_catalog' => $validated['show_in_catalog'] ?? true,
                'is_installation' => $validated['is_installation'] ?? false,
                'installation_caption' => filled($validated['installation_caption'] ?? null) ? trim($validated['installation_caption']) : null,
                'visibility' => $validated['visibility'],
            ], (int) $request->user()->id);
        }

        MediaProcessingLog::record($asset, 'queued', 'Upload diterima; menunggu antrean proses derivatif WebP.');
        ProcessUploadedMediaAsset::dispatch($asset->id);

        if ($product) {
            $params = ['product' => $product];
            if (! empty($validated['product_variant_id'])) {
                $params['variant'] = $validated['product_variant_id'];
            }

            return redirect()
                ->route('admin.products.media.byProduct', $params)
                ->with('success', 'Media ditambahkan. Proses WebP dijalankan di background.');
        }

        return redirect()
            ->route('admin.media.library')
            ->with('success', 'Media ditambahkan. Proses WebP dijalankan di background.');
    }

    protected function extensionForMime(string $mime): string
    {
        return match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'video/mp4' => 'mp4',
            'video/webm' => 'webm',
            'video/quicktime' => 'mov',
            default => 'bin',
        };
    }

    protected function mimeFromKey(string $key): string
    {
        $extension = strtolower(pathinfo($key, PATHINFO_EXTENSION));

        return match ($extension) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'mp4' => 'video/mp4',
            'webm' => 'video/webm',
            'mov' => 'video/quicktime',
            default => 'application/octet-stream',
        };
    }
}
