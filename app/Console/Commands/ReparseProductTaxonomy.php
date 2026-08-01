<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Support\CatalogTaxonomy;
use App\Support\ShopeeCatalogTaxonomy;
use Illuminate\Console\Command;

/**
 * Re-parse product_category / product_model / design_variant dari nama Shopee.
 * Tidak wipe DB — hanya update kolom taxonomy bila berbeda.
 */
class ReparseProductTaxonomy extends Command
{
    protected $signature = 'catalog:reparse-taxonomy
                            {--dry-run : Tampilkan perubahan tanpa menulis DB}
                            {--limit=0 : Batasi jumlah produk (0 = semua)}';

    protected $description = 'Perbaiki taxonomy (WINDOW/DOOR/BOUVEN + model + desain) dari nama produk';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $limit = (int) $this->option('limit');

        $query = Product::query()->orderBy('id');
        if ($limit > 0) {
            $query->limit($limit);
        }

        $changed = 0;
        $checked = 0;

        $query->chunkById(100, function ($products) use ($dryRun, &$changed, &$checked) {
            foreach ($products as $product) {
                $checked++;
                $name = trim((string) $product->name);
                if ($name === '') {
                    continue;
                }

                $parsed = ShopeeCatalogTaxonomy::fromProductName($name);
                $updates = [];

                if (strtoupper((string) $product->product_category) !== $parsed['category']) {
                    $updates['product_category'] = $parsed['category'];
                }
                if (strtoupper((string) $product->product_model) !== $parsed['model']) {
                    $updates['product_model'] = $parsed['model'];
                }
                if (strtoupper((string) $product->design_variant) !== $parsed['design']) {
                    $updates['design_variant'] = $parsed['design'];
                }

                if ($updates === []) {
                    continue;
                }

                $changed++;
                $this->line(sprintf(
                    '%s | %s → %s/%s/%s | %s',
                    $product->parent_sku,
                    $product->product_category.'/'.$product->product_model.'/'.$product->design_variant,
                    $parsed['category'],
                    $parsed['model'],
                    $parsed['design'],
                    mb_substr($name, 0, 70),
                ));

                if (! $dryRun) {
                    $product->fill($updates);
                    $product->save();
                }
            }
        });

        if ($changed > 0 && ! $dryRun) {
            CatalogTaxonomy::forgetCache();
        }

        $this->info(($dryRun ? '[dry-run] ' : '')."Checked {$checked}, would-change/changed {$changed}");

        return self::SUCCESS;
    }
}
