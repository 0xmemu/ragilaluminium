<?php

namespace Tests\Feature;

use App\Jobs\ProcessCatalogImport;
use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\ImportJob;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Support\InstallationGallery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Maatwebsite\Excel\Facades\Excel;

class InstallationMediaImportTest extends \Tests\TestCase
{
    use RefreshDatabase;

    public function test_import_creates_catalog_and_installation_media_flags(): void
    {
        $rows = collect([
            [
                'parent_sku' => 'WIN-INST-1',
                'name' => 'Window Install',
                'product_category' => 'WINDOW',
                'product_model' => 'JUNGKIT',
                'design_variant' => 'POLOS',
                'variant_sku' => 'WIN-INST-1-V1',
                'price' => 1000000,
                'stock' => 5,
                'image_1' => 'https://example.com/catalog.jpg',
                'installation_slots' => '1',
                'installation_image_1' => 'https://example.com/install-extra.jpg',
            ],
        ]);
        $export = new class($rows) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            public function __construct(public $rows) {}

            public function collection()
            {
                return $this->rows;
            }

            public function headings(): array
            {
                return array_keys($this->rows->first());
            }
        };
        Excel::store($export, 'inst.xlsx', 'imports');

        $job = ImportJob::create([
            'type' => 'shopee_mass_upload',
            'source_file_name' => 'inst.xlsx',
            'source_file_path' => 'inst.xlsx',
            'status' => 'pending',
        ]);

        (new ProcessCatalogImport($job->id, 'inst.xlsx'))->handle();

        $product = Product::where('parent_sku', 'WIN-INST-1')->firstOrFail();

        $this->assertDatabaseHas('product_media', [
            'product_id' => $product->id,
            'source_url' => 'https://example.com/catalog.jpg',
            'show_in_catalog' => true,
            'is_installation' => true,
        ]);

        $this->assertDatabaseHas('product_media', [
            'product_id' => $product->id,
            'source_url' => 'https://example.com/install-extra.jpg',
            'show_in_catalog' => false,
            'is_installation' => true,
        ]);

        $this->assertSame(2, ProductMedia::where('product_id', $product->id)->count());
    }

    public function test_reviews_page_includes_imported_installation_media(): void
    {
        config(['media.allow_source_url_fallback' => true]);

        $product = Product::create([
            'parent_sku' => 'WIN-REV-1',
            'name' => 'Jendela Review',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'position' => 101,
            'is_main_image' => false,
            'show_in_catalog' => false,
            'is_installation' => true,
            'visibility' => 'visible',
            'source_url' => 'https://example.com/hasil.jpg',
            'status' => 'pending',
        ]);

        CmsPage::query()->firstOrCreate(
            ['slug' => 'hasil-pemasangan'],
            ['title' => 'Hasil Pemasangan', 'published' => true, 'content' => []]
        );

        CmsPage::query()->firstOrCreate(
            ['slug' => 'testimoni'],
            ['title' => 'Testimoni', 'published' => true, 'content' => []]
        );

        $items = InstallationGallery::items(10);
        $this->assertNotEmpty($items);
        $this->assertSame('https://example.com/hasil.jpg', $items[0]['image_url']);
        $this->assertSame('import', $items[0]['source']);
        $this->assertSame('WIN-REV-1', $items[0]['product_sku']);
        $this->assertNotEmpty($items[0]['href']);

        $response = $this->get(route('installation.index'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Installations')
            ->has('installations', 1)
            ->where('installations.0.image_url', 'https://example.com/hasil.jpg')
            ->where('installations.0.href', route('installation.show', ['parent_sku' => 'WIN-REV-1'], absolute: false))
        );

        $detail = $this->get(route('installation.show', ['parent_sku' => 'WIN-REV-1']));
        $detail->assertOk();
        $detail->assertInertia(fn (Assert $page) => $page
            ->component('Public/InstallationDetail')
            ->where('product.parent_sku', 'WIN-REV-1')
            ->has('media', 1)
        );
    }

    public function test_installation_gallery_merges_manual_cms_items(): void
    {
        config(['media.allow_source_url_fallback' => true]);

        $page = CmsPage::query()->firstOrCreate(
            ['slug' => 'hasil-pemasangan'],
            ['title' => 'Hasil Pemasangan', 'published' => true, 'content' => []]
        );

        CmsGalleryItem::create([
            'cms_page_id' => $page->id,
            'image_url' => 'https://example.com/manual.jpg',
            'label' => 'Manual pasang',
            'published' => true,
            'sort_order' => 1,
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-MERGE-1',
            'name' => 'Merge Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'position' => 101,
            'show_in_catalog' => false,
            'is_installation' => true,
            'visibility' => 'visible',
            'source_url' => 'https://example.com/from-import.jpg',
            'status' => 'pending',
        ]);

        $items = InstallationGallery::items(10);
        $urls = collect($items)->pluck('image_url')->all();
        $this->assertContains('https://example.com/from-import.jpg', $urls);
        $this->assertContains('https://example.com/manual.jpg', $urls);
    }
}
