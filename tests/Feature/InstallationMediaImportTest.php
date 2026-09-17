<?php

namespace Tests\Feature;

use App\Jobs\DownloadMediaAsset;
use App\Jobs\ProcessCatalogImport;
use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\ImportJob;
use App\Models\Product;
use Tests\Concerns\CreatesVisibleProducts;
use App\Models\ProductMedia;
use App\Support\InstallationGallery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class InstallationMediaImportTest extends TestCase
{
    use CreatesVisibleProducts;
    use RefreshDatabase;

    public function test_import_creates_catalog_and_installation_media_flags(): void
    {
        Queue::fake([DownloadMediaAsset::class]);
        $rows = collect([
            [
                'parent_sku' => 'WIN-INST-1',
                'name' => 'Window Install',
                'product_category' => 'JENDELA',
                'product_model' => 'JUNGKIT',
                'design_variant' => 'POLOS',
                'variant_sku' => 'WIN-INST-1-V1',
                'price' => 1000000,
                'stock' => 5,
                'image_1' => 'https://example.com/catalog.jpg',
                'installation_slots' => '1',
                'installation_image_1' => 'https://example.com/install-extra.jpg',
                'weight_kg' => 10,
                'height_cm' => 100,
                'width_cm' => 50,
                'depth_cm' => 20,
            ],
        ]);
        $export = new class($rows) implements FromCollection, WithHeadings
        {
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
        Queue::assertPushed(DownloadMediaAsset::class, 2);
    }

    public function test_reviews_page_includes_imported_installation_media(): void
    {
        config(['media.allow_source_url_fallback' => true]);

        $product = $this->createVisibleProduct([
            'parent_sku' => 'WIN-REV-1',
            'name' => 'Jendela Review',
            'category_id' => 1,
            'product_category' => 'JENDELA',
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

        $models = InstallationGallery::modelCards(10);
        $this->assertNotEmpty($models);
        $this->assertSame('https://example.com/hasil.jpg', $models[0]['image_url']);
        $this->assertSame('import', $models[0]['source']);
        $this->assertSame(1, $models[0]['product_count']);
        $this->assertSame('JENDELA', $models[0]['category']);
        $this->assertSame('SLIDING', $models[0]['model']);
        $this->assertSame(
            route('installation.model', ['category' => 'jendela', 'model' => 'sliding'], absolute: false),
            $models[0]['href']
        );

        $response = $this->get(route('installation.index'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Installations')
            ->where('level', 'model')
            ->where('activeSort', 'admin')
            ->has('installations', 1)
            ->where('installations.0.image_url', 'https://example.com/hasil.jpg')
            ->where('installations.0.product_count', 1)
            ->where('installations.0.href', route('installation.model', ['category' => 'jendela', 'model' => 'sliding'], absolute: false))
        );

        $indexSorted = $this->get(route('installation.index', ['sort' => 'name']));
        $indexSorted->assertOk();
        $indexSorted->assertInertia(fn (Assert $page) => $page
            ->where('activeSort', 'admin')
            ->has('installations', 1)
        );

        $modelPage = $this->get(route('installation.model', ['category' => 'window', 'model' => 'sliding']));
        $modelPage->assertOk();
        $modelPage->assertInertia(fn (Assert $page) => $page
            ->component('Public/Installations')
            ->where('level', 'product')
            ->has('featured')
            ->where('featured.subtitle', 'Luas & Rapi')
            ->has('installations', 1)
            ->where('installations.0.product_sku', 'WIN-REV-1')
            ->where('installations.0.href', route('product.show', ['parent_sku' => 'WIN-REV-1'], absolute: false))
            ->where('activeSort', 'newest')
        );

        $sorted = $this->get(route('installation.model', [
            'category' => 'window',
            'model' => 'sliding',
            'sort' => 'photos',
        ]));
        $sorted->assertOk();
        $sorted->assertInertia(fn (Assert $page) => $page
            ->where('activeSort', 'photos')
            ->has('installations', 1)
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

        $product = $this->createVisibleProduct([
            'parent_sku' => 'WIN-MERGE-1',
            'name' => 'Merge Window',
            'category_id' => 1,
            'product_category' => 'JENDELA',
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

    public function test_installation_for_product_marks_video_media(): void
    {
        config(['media.allow_source_url_fallback' => true]);

        $product = $this->createVisibleProduct([
            'parent_sku' => 'WIN-VID-1',
            'name' => 'Jendela Video',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SWING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'show_in_catalog' => false,
            'is_installation' => true,
            'visibility' => 'visible',
            'source_url' => 'https://example.com/pasang.jpg',
            'mime_type' => 'image/jpeg',
            'status' => 'pending',
        ]);

        ProductMedia::create([
            'product_id' => $product->id,
            'position' => 2,
            'show_in_catalog' => false,
            'is_installation' => true,
            'visibility' => 'visible',
            'source_url' => 'https://example.com/pasang.mp4',
            'mime_type' => 'video/mp4',
            'status' => 'pending',
        ]);

        $gallery = InstallationGallery::forProduct($product);
        $this->assertNotNull($gallery);
        $this->assertCount(2, $gallery['media']);
        $this->assertFalse($gallery['media'][0]['is_video']);
        $this->assertTrue($gallery['media'][1]['is_video']);
        $this->assertSame('https://example.com/pasang.mp4', $gallery['media'][1]['url']);

        $modelPage = $this->get(route('installation.model', ['category' => 'jendela', 'model' => 'swing']));
        $modelPage->assertOk();
        $modelPage->assertInertia(fn (Assert $page) => $page
            ->component('Public/Installations')
            ->has('installations', 1)
            ->where('installations.0.product_sku', 'WIN-VID-1'));
    }

    public function test_model_cards_follow_model_product_list_even_without_installation_media(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-EMPTY-INSTALL',
            'name' => 'Jendela Jungkit Tanpa Dokumentasi',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $cards = InstallationGallery::modelCards(10);

        $this->assertCount(1, $cards);
        $this->assertSame('JENDELA', $cards[0]['category']);
        $this->assertSame('JUNGKIT', $cards[0]['model']);
        $this->assertSame(1, $cards[0]['product_count']);
        $this->assertSame(0, $cards[0]['photo_count']);
        $this->assertSame(0, $cards[0]['video_count']);
        $this->assertNull($cards[0]['image_url']);

        $this->get(route('installation.model', ['category' => 'window', 'model' => 'jungkit']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Installations')
                ->where('featured', null)
                ->has('gallery', 0)
                ->where('modelMeta.model', 'JUNGKIT'));
    }

    /**
     * Regresi 2026-09-17: media hasil pemasangan bisa tanpa produk (Kasus B
     * milik model, Kasus C grup mandiri). Sebelumnya modelCards() mengakses
     * $item->product->product_category tanpa penjagaan sehingga halaman
     * /hasil-pemasangan gagal 500 begitu ada media tanpa produk.
     */
    public function test_installation_gallery_survives_media_without_product(): void
    {
        $model = \App\Models\CmsModelProduct::create([
            'name' => 'Jendela Kaca Mati',
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'status' => 'active',
            'sort_order' => 1,
        ]);

        // Produk katalog pada model ini (kartu model hanya tampil bila model
        // punya produk aktif - kontrak storefront yang sudah ada).
        $this->createVisibleProduct([
            'parent_sku' => 'WIN-KM-INSTALL',
            'name' => 'Jendela Kaca Mati',
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'design_variant' => 'POLOS',
        ]);

        // Kasus B: media milik model, tanpa produk.
        \App\Models\ProductMedia::create([
            'product_id' => null,
            'model_product_id' => $model->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/model-only.jpg',
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);

        // Kasus C: media grup mandiri, tanpa produk & tanpa model.
        \App\Models\ProductMedia::create([
            'product_id' => null,
            'model_product_id' => null,
            'is_installation' => true,
            'stored_url' => 'https://example.com/standalone.jpg',
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);

        $this->get(route('installation.index'))->assertOk();

        $cards = InstallationGallery::modelCards(10);
        $this->assertNotEmpty($cards, 'Kartu model tetap tampil walau ada media tanpa produk.');
        $this->assertSame('JENDELA', $cards[0]['category']);
        $this->assertSame('KACA_MATI', $cards[0]['model']);

        // Media tanpa produk tidak boleh membuat kartu model palsu.
        $categories = array_column($cards, 'category');
        $this->assertNotContains('', $categories);

        // Halaman model tetap bisa dibuka.
        $this->get(route('installation.model', ['category' => 'jendela', 'model' => 'kaca-mati']))->assertOk();

        // productCardsForModel() tidak boleh error saat memfilter media tanpa produk.
        $this->assertIsArray(InstallationGallery::productCardsForModel('JENDELA', 'KACA_MATI'));
    }

    /**
     * Grup mandiri (judul diisi admin, tanpa model & tanpa SKU) harus tampil
     * sebagai kartu tersendiri di /hasil-pemasangan, selevel kartu model
     * produk, dan punya halaman galeri sendiri.
     */
    public function test_standalone_group_appears_as_level_one_card(): void
    {
        $group = \App\Models\InstallationGroup::create(['title' => 'Kanopi Cafe Semarang']);

        \App\Models\ProductMedia::create([
            'product_id' => null,
            'model_product_id' => null,
            'installation_group_id' => $group->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/grup-1.jpg',
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);
        \App\Models\ProductMedia::create([
            'product_id' => null,
            'model_product_id' => null,
            'installation_group_id' => $group->id,
            'is_installation' => true,
            'stored_url' => 'https://example.com/grup-2.jpg',
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);

        // Kartu grup tersedia sebagai kartu level 1.
        $cards = InstallationGallery::standaloneGroupCards(48);
        $this->assertCount(1, $cards);
        $this->assertSame('Kanopi Cafe Semarang', $cards[0]['label']);
        $this->assertSame('standalone', $cards[0]['source']);
        $this->assertSame(2, $cards[0]['photo_count']);

        // Muncul di halaman /hasil-pemasangan bersama kartu model.
        $this->get(route('installation.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Installations')
                ->where('installations', fn ($items) => collect($items)
                    ->contains(fn ($i) => ($i['label'] ?? null) === 'Kanopi Cafe Semarang')));

        // Halaman galeri grup bisa dibuka lewat slug judul.
        $this->get(route('installation.model', [
            'category' => 'lainnya',
            'model' => InstallationGallery::groupSlug('Kanopi Cafe Semarang'),
        ]))->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Installations')
                ->where('pageMeta.heading', 'Kanopi Cafe Semarang')
                ->where('standaloneGroup', true)
                ->has('gallery', 2));

        // Grup tidak ikut lagi ke bucket "Lainnya" (tidak duplikat).
        $manual = InstallationGallery::manualProductCards(48);
        $this->assertFalse(collect($manual)->contains(fn ($i) => ($i['label'] ?? null) === 'Kanopi Cafe Semarang'));
    }
}
