<?php

namespace App\Imports;

use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\ImportedProductActivationService;
use App\Support\CatalogImportVerifierV2;
use App\Support\CatalogLabels;
use App\Support\ProductMediaStubUpserter;
use App\Support\ShopeeStyleSku;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Row;

/**
 * Importer katalog format v2: satu baris = satu varian.
 *
 * Perbedaan dari importer lama (CatalogProductsImport):
 *  - Header Bahasa Indonesia (nama_produk, opsi_variasi_1, dst).
 *  - Tidak ada kolom opsi 1..4. Setiap baris mendefinisikan satu varian.
 *  - Kolom identitas cukup di baris pertama grup; baris lanjutan mewarisi
 *    nilai terakhir yang terlihat (perilaku ala marketplace).
 *  - Gambar per varian di-dedupe per nilai opsi karena satu opsi muncul di
 *    beberapa baris kombinasi. Tanpa dedupe, satu opsi melahirkan banyak baris
 *    media kembar.
 *
 * Kontrak yang dipertahankan dari importer lama:
 *  - Transaksi all-or-nothing (dibungkus DB::transaction di ProcessCatalogImport).
 *  - SKU dibuat sistem, bukan dari berkas (RA + token acak).
 *  - Verifikasi pre-pass sebelum satu pun produk dibuat.
 *  - Berat dan dimensi hanya untuk pengiriman, tidak pernah ke storefront.
 */
class CatalogProductsImportV2 implements OnEachRow, WithChunkReading, WithHeadingRow
{
    protected bool $started = false;

    /** @var list<string>|null hasil verifikasi pre-pass. */
    protected ?array $verifyErrors = null;

    /** Identitas terakhir yang terlihat, diwarisi baris lanjutan grup. */
    protected array $lastIdentity = [];

    /** parent_sku per grup NO. ID. */
    protected array $groupParentSkus = [];

    /** Gambar per opsi yang sudah ditulis: [productId][optionKey] => true. */
    protected array $writtenOptionImages = [];

    /** Media produk umum yang sudah ditulis: [productId][pos] => true. */
    protected array $writtenProductMedia = [];

    protected int $processedCount = 0;

    /** @var array<int, bool> */
    protected array $processedProductIds = [];

    public function __construct(
        public int $jobId,
        protected ?string $filePath = null,
    ) {
    }

    public function chunkSize(): int
    {
        return 1000;
    }

    public function onRow(Row $row): void
    {
        $job = ImportJob::find($this->jobId);
        if (! $job) {
            return;
        }

        if (! $this->started) {
            $this->start();
        }

        $data = $row->toArray();

        if ($this->isBlankRow($data)) {
            return;
        }

        $rowIndex = $row->getIndex();

        try {
            $this->importRow($job, $data, $rowIndex);
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

        $this->processedCount++;
        if ($this->processedCount % 5 === 0) {
            \Illuminate\Support\Facades\Cache::put("import_progress_{$this->jobId}", $this->processedCount, 600);
        }
    }

    /**
     * Verifikasi pre-pass. Berkas yang gagal aturan berarti tidak ada produk
     * yang dibuat sama sekali (all-or-nothing).
     */
    protected function start(): void
    {
        $job = ImportJob::find($this->jobId);
        if ($job) {
            $job->update(['status' => 'running', 'started_at' => now()]);
        }
        $this->started = true;

        if ($this->filePath === null) {
            return;
        }

        $rows = \Maatwebsite\Excel\Facades\Excel::toArray(
            new InternalCatalogPreviewImport(),
            $this->filePath
        )[0] ?? [];

        $this->verifyErrors = CatalogImportVerifierV2::verify($rows);

        if ($this->verifyErrors !== []) {
            throw new \RuntimeException('File gagal verifikasi: '
                .implode(' | ', array_slice($this->verifyErrors, 0, 8))
                .(count($this->verifyErrors) > 8 ? ' dan '.(count($this->verifyErrors) - 8).' lainnya.' : ''));
        }
    }

    /** Baris kosong: tidak punya nama produk maupun opsi varian. */
    protected function isBlankRow(array $data): bool
    {
        foreach (['nama_produk', 'opsi_variasi_1', 'opsi_variasi_2', 'harga'] as $key) {
            if (trim((string) ($data[$key] ?? '')) !== '') {
                return false;
            }
        }

        return true;
    }

    /**
     * Impor satu baris. Identitas diwarisi dari baris pertama grup sehingga
     * admin tidak perlu mengulang nama dan deskripsi di setiap baris.
     */
    protected function importRow(ImportJob $job, array $data, int $rowIndex): void
    {
        $noId = trim((string) ($data["no_id"] ?? ""));

        // Kolom identitas dan pengiriman boleh dikosongkan di baris lanjutan.
        $warisan = [
            "nama_produk", "deskripsi_produk", "spesifikasi", "kategori_produk",
            "model_produk", "sub_model", "berat_kg", "tinggi_cm", "panjang_cm",
            "lebar_cm", "gambar_1_utama", "gambar_2", "media_bersama_1",
            "media_bersama_2", "gambar_hasil_pemasangan_1", "gambar_hasil_pemasangan_2",
        ];
        foreach ($warisan as $key) {
            if (trim((string) ($data[$key] ?? "")) === "" && isset($this->lastIdentity[$key])) {
                $data[$key] = $this->lastIdentity[$key];
            }
        }

        $name = trim((string) ($data["nama_produk"] ?? ""));
        if ($name === "") {
            throw new \RuntimeException("Nama Produk kosong dan tidak bisa diwarisi dari baris sebelumnya.");
        }

        foreach ($warisan as $key) {
            if (trim((string) ($data[$key] ?? "")) !== "") {
                $this->lastIdentity[$key] = $data[$key];
            }
        }

        $product = $this->simpanProduk($data, $name, $noId);
        $variant = $this->simpanVarian($job, $product, $data);

        $this->syncAttributes($product, $data);
        $this->syncMedia($product, $variant, $data);

        $activation = app(ImportedProductActivationService::class)->apply($product);

        ImportJobRow::create([
            "import_job_id" => $this->jobId,
            "row_number" => $rowIndex,
            "raw_data" => array_merge($data, [
                "_stock_mode" => $job->stock_mode,
                "_effective_stock" => $variant?->stock,
                "_activation_status" => $activation["status"],
                "_activation_reasons" => $activation["reasons"],
                "_template" => "v2",
            ]),
            "status" => "success",
            "linked_product_id" => $product->id,
            "linked_product_variant_id" => $variant?->id,
            "processed_at" => now(),
        ]);
        $job->increment("success_rows");

        if (! isset($this->processedProductIds[$product->id])) {
            $this->processedProductIds[$product->id] = true;
            \Illuminate\Support\Facades\Cache::put(
                "import_processed_products_{$this->jobId}",
                count($this->processedProductIds),
                600
            );
        }
    }

    /**
     * Produk per grup NO. ID. parent_sku dibuat sistem dan dipakai ulang untuk
     * seluruh baris grup yang sama.
     */
    protected function simpanProduk(array $data, string $name, string $noId): Product
    {
        $rawCategory = trim((string) ($data["kategori_produk"] ?? ""));
        $productCategory = $rawCategory !== ""
            ? (CatalogLabels::normalizeCategory($rawCategory) ?? "")
            : "";

        if ($productCategory === "") {
            throw new \RuntimeException(
                $rawCategory === ""
                    ? "Kategori Produk kosong."
                    : "Kategori Produk tidak dikenal: ".$rawCategory
            );
        }

        $groupKey = $noId !== "" ? $noId : "nama:".$name;
        if (! isset($this->groupParentSkus[$groupKey])) {
            $this->groupParentSkus[$groupKey] = ShopeeStyleSku::nextParentSku();
        }

        return Product::updateOrCreate(
            ["parent_sku" => $this->groupParentSkus[$groupKey]],
            [
                "name" => $name,
                // Nama yang diisi admin dipakai APA ADANYA. Ukuran tidak
                // pernah menggantikan nama (kontrak 2026-09-17).
                "short_name" => CatalogLabels::titleCaseIndonesia($name) ?: $this->groupParentSkus[$groupKey],
                "description" => trim((string) ($data["deskripsi_produk"] ?? "")) ?: null,
                "product_category" => $productCategory,
                "product_model" => CatalogLabels::normalizeModel($data["model_produk"] ?? "") ?? "SLIDING",
                "design_variant" => CatalogLabels::normalizeDesign($data["sub_model"] ?? null),
                // Empat kolom pengiriman. Lebar (cm) dipetakan ke depth_cm
                // sesuai keputusan owner: kedalaman itu lebar.
                "weight_kg" => $this->number($data["berat_kg"] ?? null),
                "height_cm" => $this->number($data["tinggi_cm"] ?? null),
                "width_cm" => $this->number($data["panjang_cm"] ?? null),
                "depth_cm" => $this->number($data["lebar_cm"] ?? null),
                "status" => "archived",
            ]
        );
    }

    /**
     * Varian per baris. Kombinasi Opsi Variasi 1 dan 2 menentukan varian mana
     * yang diperbarui, sehingga import ulang berkas yang sama tidak melahirkan
     * varian kembar.
     */
    protected function simpanVarian(ImportJob $job, Product $product, array $data): ?ProductVariant
    {
        $v1Name = trim((string) ($data["nama_variasi_1"] ?? ""));
        $v1Option = trim((string) ($data["opsi_variasi_1"] ?? ""));
        $v2Name = trim((string) ($data["nama_variasi_2"] ?? ""));
        $v2Option = trim((string) ($data["opsi_variasi_2"] ?? ""));

        if ($v1Option === "" && $v2Option === "") {
            return null;
        }

        $existing = ProductVariant::query()
            ->where("product_id", $product->id)
            ->when($v1Option !== "", fn ($q) => $q->where("variation_1_option", $v1Option))
            ->when($v2Option !== "", fn ($q) => $q->where("variation_2_option", $v2Option))
            ->first();

        $variantSku = $existing?->variant_sku ?? ShopeeStyleSku::nextVariantSku($product);

        $stock = $job->stock_mode === "manual"
            ? (int) $job->manual_stock
            : (\App\Services\StockCellParser::resolve($data["stok"] ?? null) ?? 0);

        return ProductVariant::updateOrCreate(
            ["variant_sku" => $variantSku],
            [
                "product_id" => $product->id,
                "variation_1_name" => $v1Name !== "" ? $v1Name : null,
                "variation_1_option" => $v1Option !== "" ? $v1Option : null,
                "variation_2_name" => $v2Name !== "" ? $v2Name : null,
                "variation_2_option" => $v2Option !== "" ? $v2Option : null,
                "price" => $this->number($data["harga"] ?? null) ?? 0.0,
                "stock" => $stock,
                "weight_kg" => $this->number($data["berat_kg"] ?? null),
                "height_cm" => $this->number($data["tinggi_cm"] ?? null),
                "width_cm" => $this->number($data["panjang_cm"] ?? null),
                "depth_cm" => $this->number($data["lebar_cm"] ?? null),
                "status" => "active",
            ]
        );
    }

    /**
     * Spesifikasi disimpan sebagai atribut produk.
     *
     * Pemisah: titik koma atau baris baru selalu memulai baris baru. Koma juga
     * pemisah resmi, tetapi banyak nilai katalog mengandung koma (mis.
     * "Powder coating interpon (pilihan: hitam, putih)"), sehingga potongan
     * koma hanya dianggap pasangan baru bila memuat titik dua; kalau tidak,
     * potongan itu disambungkan kembali ke nilai sebelumnya.
     */
    protected function syncAttributes(Product $product, array $data): void
    {
        $raw = trim((string) ($data["spesifikasi"] ?? ""));
        $product->attributes()->whereNull("product_variant_id")->delete();

        if ($raw === "") {
            return;
        }

        $attributes = [];
        $push = static function (string $part) use (&$attributes): void {
            foreach (preg_split("/,/", $part) ?: [] as $chunk) {
                if (trim($chunk) === "") {
                    continue;
                }

                if (str_contains($chunk, ":")) {
                    [$nama, $nilai] = array_pad(explode(":", $chunk, 2), 2, null);
                    if (trim((string) $nama) !== "" && trim((string) $nilai) !== "") {
                        $attributes[] = ["name" => trim($nama), "value" => trim($nilai)];
                    }

                    continue;
                }

                $last = count($attributes) - 1;
                if ($last < 0) {
                    continue;
                }
                $attributes[$last]["value"] = rtrim((string) $attributes[$last]["value"]).", ".trim($chunk);
            }
        };

        foreach (preg_split("/[;
]+/", $raw) ?: [] as $part) {
            $push((string) $part);
        }

        $created = 0;
        foreach ($attributes as $attr) {
            if ($attr["name"] === "" || $attr["value"] === "") {
                continue;
            }
            \App\Models\ProductAttribute::updateOrCreate(
                [
                    "product_id" => $product->id,
                    "product_variant_id" => null,
                    "attribute_name" => $attr["name"],
                ],
                [
                    "attribute_value" => $attr["value"],
                    "source" => "internal",
                ]
            );
            $created++;
        }

        // Spesifikasi kosong di berkas: pakai template per sub model yang sudah
        // ada (ADR-019), sama seperti importer lama, supaya produk tidak tampil
        // tanpa spesifikasi sama sekali.
        if ($created === 0) {
            app(\App\Services\AttributeTemplateService::class)->applyToProduct($product);
        }
    }

    /**
     * Tulis media dari URL di berkas.
     *
     * Posisi mengikuti pita yang sudah dipakai sistem: 1..9 media katalog
     * (1 = utama), 50..79 gambar per opsi, 81..82 media bersama, 101..119
     * dokumentasi pemasangan.
     *
     * Gambar per varian di-dedupe per NILAI OPSI, bukan per baris: satu opsi
     * (mis. "Putih") muncul di beberapa baris kombinasi, sehingga tanpa dedupe
     * satu opsi melahirkan belasan baris media kembar.
     */
    protected function syncMedia(Product $product, ?ProductVariant $variant, array $data): void
    {
        $upserter = new ProductMediaStubUpserter($this->jobId);

        // Media katalog: Gambar 1 (utama) dan Gambar 2.
        $mainUrl = trim((string) ($data["gambar_1_utama"] ?? ""));
        if ($mainUrl !== "" && ! ($this->writtenProductMedia[$product->id][1] ?? false)) {
            $this->writtenProductMedia[$product->id][1] = true;
            $upserter->upsert(
                productId: $product->id,
                variantId: null,
                url: $mainUrl,
                position: 1,
                isMain: true,
                showInCatalog: true,
            );
        }

        $secondUrl = trim((string) ($data["gambar_2"] ?? ""));
        if ($secondUrl !== "" && ! ($this->writtenProductMedia[$product->id][2] ?? false)) {
            $this->writtenProductMedia[$product->id][2] = true;
            $upserter->upsert(
                productId: $product->id,
                variantId: null,
                url: $secondUrl,
                position: 2,
                isMain: false,
                showInCatalog: true,
            );
        }

        // Media bersama: dipakai semua varian, posisi 81 dan 82.
        foreach (["media_bersama_1" => 81, "media_bersama_2" => 82] as $key => $position) {
            $url = trim((string) ($data[$key] ?? ""));
            if ($url === "" || ($this->writtenProductMedia[$product->id][$position] ?? false)) {
                continue;
            }
            $this->writtenProductMedia[$product->id][$position] = true;
            $upserter->upsert(
                productId: $product->id,
                variantId: null,
                url: $url,
                position: $position,
                isMain: false,
                showInCatalog: true,
            );
        }

        // Dokumentasi pemasangan: posisi 101 dan 102, tidak tampil di katalog.
        foreach (["gambar_hasil_pemasangan_1" => 101, "gambar_hasil_pemasangan_2" => 102] as $key => $position) {
            $url = trim((string) ($data[$key] ?? ""));
            if ($url === "" || ($this->writtenProductMedia[$product->id][$position] ?? false)) {
                continue;
            }
            $this->writtenProductMedia[$product->id][$position] = true;
            $upserter->upsert(
                productId: $product->id,
                variantId: null,
                url: $url,
                position: $position,
                isMain: false,
                showInCatalog: false,
                isInstallation: true,
            );
        }

        // Gambar per varian: menempel pada varian baris ini.
        $variantUrl = trim((string) ($data["gambar_per_varian"] ?? ""));
        if ($variantUrl === "" || $variant === null) {
            return;
        }

        $optionKey = $this->optionKey(trim((string) ($data["opsi_variasi_1"] ?? "")));
        if ($optionKey === "" || ($this->writtenOptionImages[$product->id][$optionKey] ?? false)) {
            return;
        }
        $this->writtenOptionImages[$product->id][$optionKey] = true;

        $upserter->upsert(
            productId: $product->id,
            variantId: $variant->id,
            url: $variantUrl,
            position: 50 + count($this->writtenOptionImages[$product->id]) - 1,
            isMain: false,
            showInCatalog: true,
        );
    }

    /** Kunci nilai opsi untuk dedupe gambar (huruf kecil, spasi dirapikan). */
    protected function optionKey(string $option): string
    {
        $key = strtolower(trim(preg_replace("/\s+/u", " ", $option) ?? $option));

        return $key;
    }

    protected function number(mixed $value): ?float
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        return (float) str_replace(',', '.', (string) $value);
    }
}
