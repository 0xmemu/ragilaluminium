<?php

namespace Tests\Feature;

use App\Imports\ShopeeMediaExport;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\ProductMedia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ShopeeMediaSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_media_sync_replaces_stale_cover_as_main_image(): void
    {
        Queue::fake();

        $job = ImportJob::create([
            'type' => 'shopee_mass_update',
            'source_file_name' => 'media.xlsx',
            'source_file_path' => 'media.xlsx',
            'stock_mode' => 'file',
            'status' => 'pending',
            'processed_rows' => 0,
            'success_rows' => 0,
            'failed_rows' => 0,
        ]);

        $product = Product::create([
            'parent_sku' => 'SP43057963046',
            'name' => 'Jendela Aluminium Jungkit Ornamen (TxP)',
            'short_name' => 'Jungkit',
            'description' => 'Jungkit',
            'category_id' => 0,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'ORNAMEN',
            'status' => 'active',
        ]);

        $stale = ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'is_main_image' => true,
            'show_in_catalog' => true,
            'is_installation' => false,
            'visibility' => 'visible',
            'source_url' => 'https://cf.shopee.co.id/file/id-11134207-8224z-mhlg08p33ncz23',
            'status' => 'downloaded',
        ]);

        $importer = new ShopeeMediaExport($job->id);
        $cover = 'https://cf.shopee.co.id/file/id-11134207-7ra0o-mbyzqk2ysxb50b';
        $second = 'https://cf.shopee.co.id/file/id-11134207-7ra0l-mbyzqk2yopltdc';

        $importer->syncProductMedia($product, [
            1 => $cover,
            2 => $second,
        ]);

        $stale->refresh();
        $this->assertFalse($stale->is_main_image);
        $this->assertFalse($stale->show_in_catalog);
        $this->assertSame('hidden', $stale->visibility);

        $this->assertDatabaseHas('product_media', [
            'product_id' => $product->id,
            'source_url' => $cover,
            'is_main_image' => 1,
            'show_in_catalog' => 1,
            'visibility' => 'visible',
        ]);
    }

    public function test_product_api_serializes_loaded_installation_media(): void
    {
        $product = Product::create([
            'parent_sku' => 'SP-API-INSTALLATION-001',
            'name' => 'Produk API Installation Media',
            'short_name' => 'Produk API',
            'description' => 'Produk API',
            'category_id' => 0,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'ORNAMEN',
            'status' => 'active',
        ]);

        $installationMedia = ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'is_main_image' => false,
            'show_in_catalog' => false,
            'is_installation' => true,
            'visibility' => 'visible',
            'source_url' => 'https://cf.shopee.co.id/file/installation-api-test',
            'status' => 'downloaded',
        ]);

        $payload = $product->load(['media', 'installationMedia'])->toApiArray();

        $this->assertCount(1, $payload['installation_media']);
        $this->assertSame($installationMedia->id, $payload['installation_media'][0]['id']);
    }
}
