<?php

namespace App\Imports;

use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\InstallationGallery;
use App\Support\ProductMediaStubUpserter;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Row;

/**
 * Mode C: Update Media (media_update).
 *
 * Hanya mengubah FOTO produk/varian.
 *
 * Aturan sel (keputusan owner 2026-09-18):
 *  - Sel KOSONG berarti tidak mengubah media.
 *  - Sel berisi "hapus" MENGARSIPKAN media, bukan menghapus permanen
 *    (kontrak arsip repo: arsipkan, jangan hapus permanen).
 *  - Selain dua itu, sel berisi URL publik yang akan dipasang.
 * SKU parent/variant yang tidak dikenal -> baris GAGAL; TIDAK membuat produk baru.
 * URL tidak valid di baris -> baris GAGAL (biar admin langsung tahu).
 */
class ImportMediaUpdate implements OnEachRow, WithHeadingRow, WithChunkReading
{
    protected bool $started = false;

    public function __construct(public int $jobId)
    {
    }

    public function chunkSize(): int
    {
        return 500;
    }

    public function onRow(Row $row): void
    {
        $job = ImportJob::find($this->jobId);
        if (! $job) {
            return;
        }

        if (! $this->started) {
            $job->update(['status' => 'running', 'started_at' => now()]);
            $this->started = true;
        }

        $rowIndex = $row->getIndex();
        // Selaraskan header v2 (Gambar per Varian, Media Bersama, dst) ke
        // kunci internal supaya template baru langsung terbaca.
        $data = \App\Support\UpdateImportColumnMap::normalize($row->toArray());
        // Baris catatan/contoh dilewati (konsisten dgn importer katalog & stok).
        $firstCell = (string) ($data['parent_sku'] ?? array_values($data)[0] ?? '');
        if (preg_match('/^\s*(CATATAN|CONTOH)\s*:/i', $firstCell)) {
            return;
        }
        $job->increment('processed_rows');

        try {
            $parentSku = trim((string) ($data['parent_sku'] ?? ''));
            $variantSku = trim((string) ($data['variant_sku'] ?? ''));

            if ($parentSku === '' && $variantSku === '') {
                throw new \RuntimeException('parent_sku/variant_sku kosong');
            }

            $variant = $variantSku === ''
                ? null
                : ProductVariant::where('variant_sku', $variantSku)->first();

            if ($variantSku !== '' && ! $variant) {
                // variant_sku diketik tapi tidak ada di sistem mana pun: gagal,
                // supaya foto tidak nyasar ke produk lain / level produk.
                throw new \RuntimeException('SKU tidak ditemukan: '.$variantSku);
            }

            $product = $variant?->product
                ?? ($parentSku === '' ? null : Product::where('parent_sku', $parentSku)->first());

            if (! $product) {
                $unknown = $variantSku !== '' ? $variantSku : $parentSku;
                throw new \RuntimeException('SKU tidak ditemukan: '.$unknown);
            }

            if ($variant && $parentSku !== '' && $product->parent_sku !== $parentSku) {
                throw new \RuntimeException('variant_sku tidak cocok dengan parent_sku: '.$variantSku);
            }

            // Kontrak owner (09-05): baris dgn semua kolom gambar kosong =
            // DILEWATI (bukan gagal, bukan sukses bisu). Tandai dgn marker.
            // Kolom media v2 ikut dihitung: Gambar per Varian, Media Bersama,
            // dan penanda hapus. Tanpa ini, baris yang hanya mengisi kolom v2
            // akan dianggap kosong lalu dilewati.
            $hasAnyImage = false;
            for ($i = 1; $i <= 9; $i++) {
                if (trim((string) ($data['image_'.$i] ?? '')) !== ''
                    || trim((string) ($data['installation_image_'.$i] ?? '')) !== ''
                    || trim((string) ($data['shared_media_'.$i] ?? '')) !== '') {
                    $hasAnyImage = true;
                    break;
                }
            }
            if (! $hasAnyImage && trim((string) ($data['image_variation_option'] ?? '')) !== '') {
                $hasAnyImage = true;
            }
            if (! $hasAnyImage) {
                ImportJobRow::create([
                    'import_job_id' => $this->jobId,
                    'row_number' => $rowIndex,
                    'raw_data' => ['parent_sku' => $parentSku, 'variant_sku' => $variantSku, '_skipped' => 'no_media'],
                    'status' => 'skipped',
                    'error_reason' => 'Dilewati: tidak ada gambar di baris ini',
                ]);
                return;
            }

            $upserter = new ProductMediaStubUpserter($this->jobId);
            $installationSlots = InstallationGallery::parseSlots(
                isset($data['installation_slots']) ? (string) $data['installation_slots'] : null
            );

            for ($i = 1; $i <= 9; $i++) {
                $url = trim((string) ($data['image_'.$i] ?? ''));
                if ($url === '') {
                    continue; // sel kosong = tidak diubah
                }
                if (! filter_var($url, FILTER_VALIDATE_URL)) {
                    throw new \RuntimeException('URL image_'.$i.' tidak valid: '.$url);
                }
                $upserter->upsert(
                    productId: $product->id,
                    variantId: $variant?->id,
                    url: $url,
                    position: $i,
                    isMain: $i === 1,
                    showInCatalog: true,
                    isInstallation: in_array($i, $installationSlots, true),
                );
            }

            for ($i = 1; $i <= 9; $i++) {
                $url = trim((string) ($data['installation_image_'.$i] ?? ''));
                if ($url === '') {
                    continue;
                }
                if (! filter_var($url, FILTER_VALIDATE_URL)) {
                    throw new \RuntimeException('URL installation_image_'.$i.' tidak valid: '.$url);
                }
                $upserter->upsert(
                    productId: $product->id,
                    variantId: $variant?->id,
                    url: $url,
                    position: 100 + $i,
                    showInCatalog: false,
                    isInstallation: true,
                );
            }

            // Penanda hapus (keputusan owner): sel berisi "hapus" mengarsipkan
            // media, bukan menghapus permanen (kontrak arsip repo).
            $hapus = \App\Support\UpdateImportColumnMap::isDeleteMarker($data["image_variation_option"] ?? null);

            // Gambar per Varian (template v2): menempel pada varian baris ini,
            // posisi 50 mengikuti pita media per opsi yang sudah dipakai.
            $urlVar = trim((string) ($data['image_variation_option'] ?? ''));

            if ($hapus && $variant !== null) {
                \App\Models\ProductMedia::query()
                    ->where('product_id', $product->id)
                    ->where('product_variant_id', $variant->id)
                    ->where('visibility', '!=', 'archived')
                    ->update(['visibility' => 'archived']);
                $urlVar = '';
            }

            if ($urlVar !== '') {
                if (! filter_var($urlVar, FILTER_VALIDATE_URL)) {
                    throw new \RuntimeException('URL Gambar per Varian tidak valid: '.$urlVar);
                }
                $upserter->upsert(
                    productId: $product->id,
                    variantId: $variant?->id,
                    url: $urlVar,
                    position: 50,
                    showInCatalog: true,
                );
            }

            // Media Bersama 1..2 (template v2): dipakai semua varian, posisi 81
            // dan 82 mengikuti pita media bersama yang sudah dipakai sistem.
            for ($i = 1; $i <= 2; $i++) {
                $urlBersama = trim((string) ($data['shared_media_'.$i] ?? ''));
                if ($urlBersama === '') {
                    continue;
                }
                if (! filter_var($urlBersama, FILTER_VALIDATE_URL)) {
                    throw new \RuntimeException('URL Media Bersama '.$i.' tidak valid: '.$urlBersama);
                }
                $upserter->upsert(
                    productId: $product->id,
                    variantId: null,
                    url: $urlBersama,
                    position: 80 + $i,
                    showInCatalog: true,
                );
            }

            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => array_merge($data, [
                    '_media_queue' => true,
                ]),
                'status' => 'success',
                'linked_product_id' => $product->id,
                'linked_product_variant_id' => $variant?->id,
                'processed_at' => now(),
            ]);
            $job->increment('success_rows');
        } catch (\Throwable $e) {
            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => $data,
                'status' => 'failed',
                'error_reason' => $e->getMessage(),
                'processed_at' => now(),
            ]);
            $job->increment('failed_rows');
        }
    }
}