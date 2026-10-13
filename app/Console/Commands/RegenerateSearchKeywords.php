<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Support\ProductSearchKeywordService;
use Illuminate\Console\Command;

class RegenerateSearchKeywords extends Command
{
    protected $signature = 'catalog:regenerate-search {--fresh : kosongkan search_keywords dulu}';

    protected $description = 'Backfill short_name + search_keywords seluruh produk (chunk 200)';

    public function handle(ProductSearchKeywordService $service): int
    {
        $query = Product::query();

        if ($this->option('fresh')) {
            $query->update(['search_keywords' => null]);
            $this->info('search_keywords dikosongkan (fresh).');
        }

        $total = 0;
        $query->orderBy('id')->chunk(200, function ($products) use ($service, &$total) {
            foreach ($products as $product) {
                $service->generate($product);
                $total++;
            }
        });

        $this->info("Selesai: {$total} produk di-generate.");

        return self::SUCCESS;
    }
}