<?php

namespace App\Imports;

use App\Models\ImportJob;
use App\Models\ImportJobRow;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\ProductVariant;
use App\Services\ImportedProductActivationService;
use App\Support\InstallationGallery;
use App\Support\ProductMediaStubUpserter;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Row;
use PhpOffice\PhpSpreadsheet\IOFactory;

class CatalogProductsImport implements OnEachRow, WithHeadingRow, WithChunkReading
{
    protected bool $started = false;

    /** @var array{variants: list<array{name: string, options: list<array{option: string, image_url: ?string, installation_image_url: ?string}>}>, errors: list<string>}|null */
    protected ?array $variantSheet = null;

    /** @var array<string, string> kunci option (lowercase) -> URL gambar */
    protected array $optionImages = [];

    /** @var array<string, string> kunci option (lowercase) -> URL installation */
    protected array $optionInstallations = [];

    /**
     * Media umum produk yang sudah ditulis pada sesi ini:
     * [productId][kelas media][position] => true. Kelas: legacy (image_1..9),
     * shared, installrow (installation umum), owneropt (gambar per opsi).
     *
     * @var array<int, array<string, array<int, bool>>>
     */
    protected array $writtenMedia = [];

    /**
     * Definisi varian per grup produk (by name): [N => name] dari baris
     * pertama (desain owner: daftar opsi ditulis sekali di baris pertama).
     *
     * @var array<string, array<int, string>>
     */
    protected array $groupVariantNames = [];

    /**
     * Definisi opsi per grup produk: [name][n][m] => nilai opsi.
     *
     * @var array<string, array<int, array<int, string>>>
     */
    protected array $groupOptionDefs = [];

    /**
     * Gambar per opsi varian per grup produk:
     * [name grupp][optionKey(lowercase)] => URL.
     *
     * @var array<string, array<string, string>>
     */
    protected array $groupOptionImages = [];

    /**
     * Identitas produk terakhir yang terlihat (baris pertama grup).
     * Baris lanjutan kombinasi cukup berisi option + price + stock; kolom
     * identitas diwarisi dari sini (perilaku ala marketplace).
     *
     * @var array<string, mixed>
     */
    protected array $lastIdentity = [];

    public function __construct(
        public int $jobId,
        protected ?string $filePath = null,
    ) {
    }

    /**
     * Muat sheet Varian (jika file import punya sheet tersebut - skema baru).
     * File lama tanpa sheet Varian tetap diproses dengan skema kolom legacy.
     */
    protected function loadVariantSheet(): void
    {
        if ($this->variantSheet !== null || $this->filePath === null) {
            return;
        }
        $parsed = \App\Support\VariantSheetParser::extractVariantRows($this->filePath);
        if ($parsed === null) {
            $this->variantSheet = ['variants' => [], 'errors' => []];
            return;
        }
        $this->variantSheet = \App\Support\VariantSheetParser::parse($parsed['rows']);
        $map = \App\Support\VariantSheetParser::optionImageMap($this->variantSheet['variants']);
        $this->optionImages = $map['images'];
        $this->optionInstallations = $map['installations'];

        foreach ($this->variantSheet['errors'] as $error) {
            \Illuminate\Support\Facades\Log::warning('import-variant-sheet: '.$error, ['import_job_id' => $this->jobId]);
        }
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

        // Baris kosong (sheet template menyiapkan ratusan baris siap isi dengan
        // validasi dropdown): tidak dihitung processed/success/failed.
        // Cek dua lapis: isEmpty() milik Maatwebsite (aturan spreadsheet) lalu
        // trim manual (baris berisi hanya spasi / karakter kosong).
        if ($row->isEmpty()) {
            return;
        }
        // Baris tanpa opsi varian sama sekali tidak membentuk varian jadi:
        // abaikan (menangani baris kosong berformat yang lolos isEmpty).
        $hasAnyOption = false;
        for ($i = 1; $i <= 20; $i++) {
            if (trim((string) ($data['option_'.$i] ?? '')) !== '') { $hasAnyOption = true; break; }
        }
        for ($i = 1; $i <= 5; $i++) {
            if (trim((string) ($data['variation_'.$i.'_option'] ?? '')) !== '') { $hasAnyOption = true; break; }
        }
        // Desain owner: kolom kombinasi menandai baris varian jadi.
        if ($this->cell($data, 'variantion_combination') !== null
            || $this->cell($data, 'variation_combination') !== null
            || $this->cell($data, 'price_variantion_combination') !== null) {
            $hasAnyOption = true;
        }
        $hasVariantSku = trim((string) ($data['variant_sku'] ?? '')) !== '';
        $hasLegacyImage = false;
        for ($i = 1; $i <= 9; $i++) {
            if (trim((string) ($data['image_'.$i] ?? '')) !== '' || trim((string) ($data['installation_image_'.$i] ?? '')) !== '') { $hasLegacyImage = true; break; }
        }
        if (! $hasAnyOption && ! $hasVariantSku && ! $hasLegacyImage) {
            return;
        }
        $hasContent = false;
        foreach ($data as $cell) {
            if (trim((string) $cell) !== '') {
                $hasContent = true;
                break;
            }
        }
        if (! $hasContent) {
            return;
        }

        // Baris penanda contoh di sheet Data (template baru) diabaikan.
        foreach ($data as $cell) {
            if (stripos((string) $cell, 'CONTOH:') === 0) {
                return;
            }
        }

        // Baris dari sheet "Varian" (memuat kolom varian_name/option tanpa
        // price): dikonsumsi VariantSheetParser, bukan baris produk.
        if (array_key_exists('varian_name', $data) && ! array_key_exists('price', $data)) {
            return;
        }

        // Warisi identitas dari baris pertama grup: kolom identitas kosong
        // (name, kategori, model, dsb.) diisi dari baris sebelumnya.
        $identityKeys = ['name', 'product_name', 'description', 'product_category',
            'product_model', 'design_variant', 'specifications',
            'weight_kg', 'height_cm', 'width_cm', 'depth_cm',
        ];
        $rowName = trim((string) ($data['name'] ?? $data['product_name'] ?? ''));
        if ($rowName !== '') {
            // Definisi varian (desain owner): variation_N_name + option_1..M
            // hanya di baris pertama grup; simpan utk dipakai baris lanjutan.
            $defs = [];
            $optionImages = [];
            $optionDefs = [];
            for ($n = 1; $n <= 5; $n++) {
                $vname = $this->cell($data, 'variation_'.$n.'_name');
                if ($vname === null) {
                    continue;
                }
                $defs[$n] = $vname;
                for ($m = 1; $m <= 30; $m++) {
                    // Kolom opsi: variation_N_option_M
                    $opt = $this->cell($data, 'variation_'.$n.'_option_'.$m);
                    if ($opt === null) {
                        break;
                    }
                    $optionDefs[$n][$m] = $opt;
                    $imgKey = 'image_variation_'.$n.'_option_'.$m;
                    $img = $this->cell($data, $imgKey);
                    if ($img !== null && filter_var($img, FILTER_VALIDATE_URL)) {
                        $optionImages[\App\Support\VariantSheetParser::optionKey($opt)] = $img;
                    }
                }
            }
            if ($defs !== []) {
                $this->groupVariantNames[$rowName] = $defs;
            }
            if ($optionDefs !== []) {
                $this->groupOptionDefs[$rowName] = $optionDefs;
            }
            if ($optionImages !== []) {
                $this->groupOptionImages[$rowName] = array_merge(
                    $this->groupOptionImages[$rowName] ?? [],
                    $optionImages,
                );
            }
        }
        if (trim((string) ($data['name'] ?? $data['product_name'] ?? '')) !== '') {
            foreach ($identityKeys as $key) {
                if (isset($data[$key]) && trim((string) $data[$key]) !== '') {
                    $this->lastIdentity[$key] = $data[$key];
                } else {
                    unset($this->lastIdentity[$key]);
                }
            }
        } else {
            foreach ($identityKeys as $key) {
                if ((! isset($data[$key]) || trim((string) $data[$key]) === '')
                    && isset($this->lastIdentity[$key])
                ) {
                    $data[$key] = $this->lastIdentity[$key];
                }
            }
        }

        $this->loadVariantSheet();
        $job->increment('processed_rows');

        try {
            $parentSku = trim((string) ($data['parent_sku'] ?? ''));
            $name = trim((string) ($data['name'] ?? $data['product_name'] ?? ''));
            // Auto-mode: kolom parent_sku tidak diisi (template create). Sistem
            // mengelompokkan varian berdasarkan NAMA produk (grouping by name),
            // dan membuat parent_sku baru (RA + token acak, kontrak SKU Fase 4).
            $autoMode = $parentSku === '';
            if ($autoMode) {
                $existingByName = $name !== ''
                    ? Product::where('name', $name)->first()
                    : null;
                if ($existingByName) {
                    $parentSku = (string) $existingByName->parent_sku;
                } else {
                    $parentSku = $this->generateParentSku();
                }
            }
            if ($parentSku === '') {
                throw new \RuntimeException('parent_sku dan name kosong');
            }

            // Resolusi kategori dari sumber DINAMIS (tabel categories), bukan default
            // WINDOW. Kategori tak dikenal / tidak diisi ditandai untuk review admin.
            $existingProduct = Product::where('parent_sku', $parentSku)->first();
            $rawCategory = trim(strtoupper((string) ($data['product_category'] ?? '')));
            $productCategory = $rawCategory === ''
                ? (string) ($existingProduct?->product_category ?? '')
                : (\App\Support\CatalogLabels::normalizeCategory($rawCategory) ?? '');

            if ($productCategory === '') {
                throw new \RuntimeException(
                    $rawCategory === ''
                        ? 'master kategori tidak diisi (perlu ditinjau admin)'
                        : 'kategori tidak dikenal: '.$rawCategory.' (perlu ditinjau admin)'
                );
            }

            $product = Product::updateOrCreate(
                ['parent_sku' => $parentSku],
                [
                    'name' => $data['name'] ?? $data['product_name'] ?? $parentSku,
                    'short_name' => $this->deriveShortName($data),
                    'search_keywords' => $this->deriveKeywords($data, $productCategory),
                    'description' => $data['description'] ?? null,
                        'weight_kg' => $this->number($data, ['weight_kg', 'weight', 'packing_weight']),
                        'height_cm' => $this->number($data, ['height_cm', 'height', 'packing_height']),
                        'width_cm' => $this->number($data, ['width_cm', 'width', 'packing_width']),
                        'depth_cm' => $this->number($data, ['depth_cm', 'depth', 'length', 'packing_depth', 'packing_length']),
                    'product_category' => $productCategory,
                    'product_model' => \App\Support\CatalogLabels::normalizeModel($data['product_model'] ?? 'SLIDING') ?? 'SLIDING',
                    'design_variant' => \App\Support\CatalogLabels::normalizeDesign($data['design_variant'] ?? 'POLOS') ?? 'POLOS',
                    'status' => 'archived',
                ]
            );

            $variantSku = trim((string) ($data['variant_sku'] ?? ''));
            if ($autoMode && $variantSku === '') {
                $hasVariation = false;
                // Skema baru: kolom option_1..N di sheet Kombinasi.
                for ($i = 1; $i <= 20; $i++) {
                    if (trim((string) ($data['option_'.$i] ?? '')) !== '') {
                        $hasVariation = true;
                        break;
                    }
                }
                // Back-compat skema lama: variation_N_option.
                for ($i = 1; $i <= 5; $i++) {
                    if (trim((string) ($data['variation_'.$i.'_option'] ?? '')) !== '') {
                        $hasVariation = true;
                        break;
                    }
                }
                // Desain owner: kolom kombinasi + harga per kombinasi.
                if ($this->cell($data, 'variantion_combination') !== null
                    || $this->cell($data, 'variation_combination') !== null) {
                    $hasVariation = true;
                }
                if ($hasVariation) {
                    // Kontrak SKU: varian = RA + token acak mandiri (bukan
                    // parent-nomor urut).
                    $variantSku = \App\Support\ShopeeStyleSku::nextVariantSku($product);
                }
            }
            $variant = null;
            if ($variantSku !== '') {
                $stock = $job->stock_mode === 'manual'
                    ? (int) $job->manual_stock
                    : (\App\Services\StockCellParser::resolve($data['stock'] ?? null) ?? 0);
                $variant = ProductVariant::updateOrCreate(
                    ['variant_sku' => $variantSku],
                    [
                        'product_id' => $product->id,
                        'variation_1_name' => $this->variantName($data, 1),
                        'variation_1_option' => $this->variantOption($data, 1),
                        'variation_2_name' => $this->variantName($data, 2),
                        'variation_2_option' => $this->variantOption($data, 2),
                        'variation_3_name' => $this->variantName($data, 3),
                        'variation_3_option' => $this->variantOption($data, 3),
                        'variation_4_name' => $this->variantName($data, 4),
                        'variation_4_option' => $this->variantOption($data, 4),
                        'variation_5_name' => $this->variantName($data, 5),
                        'variation_5_option' => $this->variantOption($data, 5),
                        'price' => (float) ($this->cell($data, 'price_variantion_combination') ?? $data['price'] ?? 0),
                        'stock' => $stock,
                        'weight_kg' => $this->number($data, ['weight_kg', 'weight', 'packing_weight']),
                        'height_cm' => $this->number($data, ['height_cm', 'height', 'packing_height']),
                        'width_cm' => $this->number($data, ['width_cm', 'width', 'packing_width']),
                        'depth_cm' => $this->number($data, ['depth_cm', 'depth', 'length', 'packing_depth', 'packing_length']),
                        'status' => 'active',
                    ]
                );
            }

            $this->syncAttributes($product, $variant, $data);

            $installationSlots = InstallationGallery::parseSlots(
                isset($data['installation_slots']) ? (string) $data['installation_slots'] : null
            );

            $legacyImageWritten = false;
            for ($i = 1; $i <= 9; $i++) {
                $url = $data['image_'.$i] ?? $data['image_url_'.$i] ?? null;
                if ($url && filter_var($url, FILTER_VALIDATE_URL)) {
                    $legacyImageWritten = true;
                    // Media umum produk: kolom sama terulang di tiap baris
                    // kombinasi. Tulis sekali per produk+posisi agar tidak
                    // menumpuk duplikat.
                    if ($this->writtenMedia[$product->id]['legacy'][$i] ?? false) {
                        continue;
                    }
                    $this->writtenMedia[$product->id]['legacy'][$i] = true;
                    $this->mediaUpserter()->upsert(
                        productId: $product->id,
                        variantId: null, // media umum produk: milik semua varian
                        url: (string) $url,
                        position: $i,
                        isMain: $i === 1,
                        showInCatalog: true,
                        isInstallation: in_array($i, $installationSlots, true),
                    );
                }
            }

            for ($i = 1; $i <= 9; $i++) {
                $url = $data['installation_image_'.$i] ?? null;
                if ($url && filter_var($url, FILTER_VALIDATE_URL)) {
                    if ($this->writtenMedia[$product->id]['install'][$i] ?? false) {
                        continue;
                    }
                    $this->writtenMedia[$product->id]['install'][$i] = true;
                    $this->mediaUpserter()->upsert(
                        productId: $product->id,
                        variantId: null, // media umum produk: milik semua varian
                        url: (string) $url,
                        position: 100 + $i,
                        isMain: false,
                        showInCatalog: false,
                        isInstallation: true,
                    );
                }
            }

            // Desain owner (09-05): image_variation_N_option_M per opsi varian,
            // shared_media_1..2 media bersama. Hanya diterapkan bila file
            // memakai kolom owner dan TIDAK mencampur image legacy/sheet Varian.
            $ownerImages = [];
            $ownerName = trim((string) ($data['name'] ?? $data['product_name'] ?? ''));
            if ($ownerName === '' && isset($this->lastIdentity['name'])) {
                $ownerName = trim((string) $this->lastIdentity['name']);
            }
            for ($n = 1; $n <= 5; $n++) {
                for ($m = 1; $m <= 30; $m++) {
                    $url = $this->cell($data, 'image_variation_'.$n.'_option_'.$m);
                    if ($url === null) { break; }
                    $opt = $this->cell($data, 'variation_'.$n.'_option_'.$m);
                    if ($opt !== null && filter_var($url, FILTER_VALIDATE_URL)) {
                        $ownerImages[\App\Support\VariantSheetParser::optionKey($opt)] = $url;
                    }
                }
            }
            if ($ownerName !== '' && isset($this->groupOptionImages[$ownerName])) {
                $ownerImages += $this->groupOptionImages[$ownerName];
            }

            $ownerMediaWritten = false;
            if ($ownerImages !== []
                && ($this->variantSheet === null || count($this->variantSheet['variants']) === 0)) {
                // Gambar per opsi milik PRODUK dan harus tertaut untuk SEMUA
                // opsi yang punya URL (dari definisi variation_N_option_M baris
                // pertama grup), bukan hanya opsi yang muncul di kolom
                // kombinasi baris ini. Urutan taut = urutan opsi per varian.
                $orderedUrls = [];
                $ownerName = trim((string) ($data['name'] ?? $data['product_name'] ?? ''));
                if ($ownerName === '' && isset($this->lastIdentity['name'])) {
                    $ownerName = trim((string) $this->lastIdentity['name']);
                }
                $defs = $this->groupVariantNames[$ownerName] ?? [];
                for ($n = 1; $n <= 5; $n++) {
                    if (! isset($defs[$n])) { continue; }
                    for ($m = 1; $m <= 30; $m++) {
                        $opt = $this->cell($data, 'variation_'.$n.'_option_'.$m)
                            ?? ($this->groupOptionDefs[$ownerName][$n][$m] ?? null);
                        if ($opt === null) { break; }
                        $key = \App\Support\VariantSheetParser::optionKey($opt);
                        $url = $ownerImages[$key] ?? null;
                        if ($url !== null) {
                            $orderedUrls[$key] = $url;
                        }
                    }
                }
                $position = 10;
                                foreach ($orderedUrls as $optionKey => $url) {
                    if ($this->writtenMedia[$product->id]['owneropt'][$position] ?? false) {
                        $position++;
                        continue;
                    }
                    $this->writtenMedia[$product->id]['owneropt'][$position] = true;
                    $this->mediaUpserter()->upsert(
                        productId: $product->id,
                        variantId: null,
                        url: $url,
                        position: $position,
                        isMain: false, // foto utama = image_1 (produk umum)
                        showInCatalog: true,
                        isInstallation: false,
                    );
                    $position++;
                    $ownerMediaWritten = true;
                }
                // shared_media_1..N: media bersama (foto/video), tampil semua kombinasi.
                for ($n = 1; $n <= 9; $n++) {
                    $shared = $this->cell($data, 'shared_media_'.$n);
                    if ($shared === null) { break; }
                    if (filter_var($shared, FILTER_VALIDATE_URL)) {
                        if ($this->writtenMedia[$product->id]['shared'][$n] ?? false) {
                            continue;
                        }
                        $this->writtenMedia[$product->id]['shared'][$n] = true;
                        $this->mediaUpserter()->upsert(
                            productId: $product->id,
                            variantId: null,
                            url: $shared,
                            position: 50 + $n,
                            isMain: false,
                            showInCatalog: true,
                            isInstallation: false,
                        );
                    }
                }
            }

            // Skema baru: gambar per opsi dari sheet Varian (image_varian_N_option_M).
            // Diterapkan hanya saat file memakai sheet Varian dan tidak mencampur
            // kolom image legacy agar tidak dobel.
            if ($this->variantSheet !== null && count($this->variantSheet['variants']) > 0 && ! $legacyImageWritten) {
                $position = 1;
                $variantOptionValues = [];
                for ($n = 1; $n <= 5; $n++) {
                    $value = $this->variantOption($data, $n);
                    if ($value !== null && $value !== '') {
                        $variantOptionValues[] = \App\Support\VariantSheetParser::optionKey($value);
                    }
                }
                $isFirstMedia = true;
                foreach ($variantOptionValues as $optionKey) {
                    $url = $this->optionImages[$optionKey] ?? null;
                    if ($url === null) {
                        continue;
                    }
                    $this->mediaUpserter()->upsert(
                        productId: $product->id,
                        variantId: null,
                        url: $url,
                        position: $position,
                        isMain: $isFirstMedia,
                        showInCatalog: true,
                        isInstallation: false,
                    );
                    $isFirstMedia = false;
                    $position++;
                    $installationUrl = $this->optionInstallations[$optionKey] ?? null;
                    if ($installationUrl !== null) {
                        $this->mediaUpserter()->upsert(
                            productId: $product->id,
                            variantId: null,
                            url: $installationUrl,
                            position: 100 + $position,
                            isMain: false,
                            showInCatalog: false,
                            isInstallation: true,
                        );
                    }
                }
            }

            // installation_image_url umum per baris kombinasi (skema baru, opsional).
            $rowInstallationUrl = trim((string) ($data['installation_image_url'] ?? ''));
            if ($rowInstallationUrl !== '' && filter_var($rowInstallationUrl, FILTER_VALIDATE_URL)) {
                if (! ($this->writtenMedia[$product->id]['installrow'][0] ?? false)) {
                    $this->writtenMedia[$product->id]['installrow'][0] = true;
                    $this->mediaUpserter()->upsert(
                        productId: $product->id,
                        variantId: null,
                        url: $rowInstallationUrl,
                        position: 199,
                        isMain: false,
                        showInCatalog: false,
                        isInstallation: true,
                    );
                }
            }

            $activation = app(ImportedProductActivationService::class)->apply($product);
            ImportJobRow::create([
                'import_job_id' => $this->jobId,
                'row_number' => $rowIndex,
                'raw_data' => array_merge($data, [
                    '_stock_mode' => $job->stock_mode,
                    '_effective_stock' => $variant?->stock,
                    '_activation_status' => $activation['status'],
                    '_activation_reasons' => $activation['reasons'],
                    '_shipping_contract' => 'weight_kg,height_cm,width_cm,depth_cm must be > 0',
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

    protected function number(array $data, array $keys): ?float
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $data) && $data[$key] !== '' && $data[$key] !== null) {
                return (float) str_replace(',', '.', (string) $data[$key]);
            }
        }

        return null;
    }

    protected function syncAttributes(Product $product, ?ProductVariant $variant, array $data): void
    {
        $attributes = [];
        $raw = $data['specifications'] ?? $data['attributes'] ?? null;

        if (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $attributes = $decoded;
            } else {
                foreach (preg_split('/[;\\n]+/', $raw) ?: [] as $part) {
                    [$name, $value] = array_pad(explode(':', $part, 2), 2, null);
                    if (trim((string) $name) !== '' && trim((string) $value) !== '') {
                        $attributes[] = ['name' => trim($name), 'value' => trim($value)];
                    }
                }
            }
        } elseif (is_array($raw)) {
            $attributes = $raw;
        }

        if (($data['attribute_name'] ?? '') !== '' && ($data['attribute_value'] ?? '') !== '') {
            $attributes[] = ['name' => $data['attribute_name'], 'value' => $data['attribute_value']];
        }

        foreach ($data as $key => $value) {
            if (str_starts_with((string) $key, 'spec_') && $value !== '' && $value !== null) {
                $attributes[] = ['name' => ucwords(str_replace('_', ' ', substr((string) $key, 5))), 'value' => $value];
            }
        }

        $createdCount = 0;
        foreach ($attributes as $attribute) {
            if (! is_array($attribute)) {
                continue;
            }
            $name = trim((string) ($attribute['name'] ?? $attribute['attribute_name'] ?? ''));
            $value = trim((string) ($attribute['value'] ?? $attribute['attribute_value'] ?? ''));
            if ($name === '' || $value === '') {
                continue;
            }
            ProductAttribute::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'attribute_name' => $name,
                ],
                [
                    'attribute_value' => $value,
                    'source' => 'internal',
                ]
            );
            $createdCount++;
        }

        // Tidak ada spesifikasi di baris import: isi dari template per sub model
        // (ADR-019). Tidak menimpa apa pun bila template kosong.
        if ($createdCount === 0) {
            app(\App\Services\AttributeTemplateService::class)->applyToProduct($product);
        }
    }

    /**
     * Baca nilai header dgn toleransi ejaan "variantion"/"variation"
     * (desain owner 2026-09-05 memakai "variantion").
     */
    protected function cell(array $data, string $key): ?string
    {
        $alt = str_replace('variation', 'variantion', $key);
        // Ejaan owner: image_variantion_name_1_option_1 (ada "name").
        $altName = null;
        if (preg_match('/^image_variation_(\d+)_option_(\d+)$/', $key, $mm)) {
            $altName = 'image_variantion_name_'.$mm[1].'_option_'.$mm[2];
        }
        foreach (array_filter([$key, $alt, $altName]) as $k) {
            if (array_key_exists($k, $data)) {
                $v = trim((string) $data[$k]);
                if ($v !== '') {
                    return $v;
                }
            }
        }
        return null;
    }

    /**
     * Nama varian ke-N untuk baris ini.
     * Skema baru: dari daftar varian sheet Varian (urutan kemunculan).
     * Legacy: kolom variation_N_name langsung.
     */
    protected function variantName(array $data, int $n): ?string
    {
        $legacy = isset($data['variation_'.$n.'_name']) ? trim((string) $data['variation_'.$n.'_name']) : '';
        if ($legacy !== '') {
            return $legacy;
        }
        // Desain owner: nama varian di baris pertama grup (by name).
        $name = trim((string) ($data['name'] ?? $data['product_name'] ?? ''));
        if ($name === '' && isset($this->lastIdentity['name'])) {
            $name = trim((string) $this->lastIdentity['name']);
        }
        if ($name !== '' && isset($this->groupVariantNames[$name][$n])) {
            return $this->groupVariantNames[$name][$n];
        }
        if ($this->variantSheet !== null && isset($this->variantSheet['variants'][$n - 1])) {
            return $this->variantSheet['variants'][$n - 1]['name'];
        }
        return null;
    }

    /**
     * Nilai opsi varian ke-N untuk baris ini.
     * Skema baru: kolom option_{N} di sheet Kombinasi.
     * Legacy: kolom variation_N_option.
     */
    protected function variantOption(array $data, int $n): ?string
    {
        $new = isset($data['option_'.$n]) ? trim((string) $data['option_'.$n]) : '';
        if ($new !== '') {
            return $new;
        }
        // Desain owner: variantion_combination = "Putih, Kaca Bening"
        // (kata ke-N = opsi varian ke-N).
        $combo = $this->cell($data, 'variantion_combination')
            ?? $this->cell($data, 'variation_combination');
        if ($combo !== null) {
            $parts = array_map('trim', explode(',', $combo));
            if (isset($parts[$n - 1]) && $parts[$n - 1] !== '') {
                return $parts[$n - 1];
            }
            return null;
        }
        $legacy = isset($data['variation_'.$n.'_option']) ? trim((string) $data['variation_'.$n.'_option']) : '';
        return $legacy !== '' ? $legacy : null;
    }

    protected function mediaUpserter(): ProductMediaStubUpserter
    {
        return new ProductMediaStubUpserter($this->jobId);
    }

    public function chunkSize(): int
    {
        return 1000;
    }

    protected function deriveShortName(array $data): string
    {
        $provided = trim((string) ($data['short_name'] ?? ''));
        if ($provided !== '') {
            return $provided;
        }
        $name = trim((string) ($data['name'] ?? $data['product_name'] ?? ''));
        $fallback = trim((string) ($data['parent_sku'] ?? ''));
        return \App\Support\CatalogLabels::titleCaseIndonesia($name) ?: $fallback;
    }

    protected function deriveKeywords(array $data, string $categoryCode): string
    {
        $provided = trim((string) ($data['search_keywords'] ?? $data['keywords'] ?? ''));
        if ($provided !== '') {
            return $provided;
        }
        $parts = array_filter([
            \App\Support\CatalogLabels::category($categoryCode) ?: $categoryCode,
            \App\Support\CatalogLabels::model((string) ($data['product_model'] ?? '')),
            \App\Support\CatalogLabels::design((string) ($data['design_variant'] ?? '')),
            trim((string) ($data['name'] ?? '')),
        ]);
        return implode(', ', array_unique(array_filter($parts)));
    }


    protected function generateParentSku(): string
    {
        // Kontrak SKU (Fase 4): produk website = RA + token acak
        // (ShopeeStyleSku::nextParentSku). Prefix RGL-{angka} usang.
        return \App\Support\ShopeeStyleSku::nextParentSku();
    }

}
