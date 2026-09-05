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
 * Hanya mengubah FOTO produk/varian (image_katalog + installation_image).
 * Sel kosong = foto yang ada TIDAK diubah; import TIDAK PERNAH menghapus
 * (penghapusan lewat halaman Media produk di admin).
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
        $data = $row->toArray();
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
            $hasAnyImage = false;
            for ($i = 1; $i <= 9; $i++) {
                if (trim((string) ($data['image_'.$i] ?? '')) !== ''
                    || trim((string) ($data['installation_image_'.$i] ?? '')) !== '') {
                    $hasAnyImage = true;
                    break;
                }
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