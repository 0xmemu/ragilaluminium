<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\MediaAsset;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Media setting model produk (kontrak 2026-09-15): gambar utama + galeri
 * diambil dari Media Library, bukan tempel URL manual.
 */
class ModelProductMediaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('media');
    }

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    protected function asset(string $label, string $key): MediaAsset
    {
        return MediaAsset::create([
            'kind' => 'image',
            'label' => $label,
            'object_key' => $key,
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1024,
            'status' => 'ready',
            'visibility' => 'visible',
            'derivatives' => ['card' => ['path' => $key]],
        ]);
    }

    protected function makeProduct(string $sku = 'WIN-MEDIA-1'): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => 'Jendela Sliding Media',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    /**
     * Wadah yang dibuat otomatis saat makeProduct() menyimpan produknya.
     * Test memakai baris ini, bukan membuat baris kedua untuk pasangan yang sama
     * (sejak 2026-09-28 wadah pasangan berproduk lahir otomatis, dan baris
     * ganda dilarang karena melahirkan kartu model kembar di toko).
     */
    protected function slidingModel(): CmsModelProduct
    {
        return CmsModelProduct::query()
            ->where('product_category', 'JENDELA')
            ->where('product_model', 'SLIDING')
            ->firstOrFail();
    }

    public function test_admin_can_attach_main_media_and_gallery(): void
    {
        $this->makeProduct();
        $admin = $this->admin();
        $main = $this->asset('Foto Utama', 'media/utama/card.webp');
        $second = $this->asset('Foto Dua', 'media/dua/card.webp');
        $third = $this->asset('Foto Tiga', 'media/tiga/card.webp');

        $target = $this->slidingModel();

        $this->actingAs($admin)
            ->put(route('admin.model-products.update', $target), [
                'name' => 'Jendela Aluminium Sliding',
                'product_category' => 'JENDELA',
                'media_asset_id' => $main->id,
                'gallery_asset_ids' => [$second->id, $third->id],
                'media_show_product_photos' => false,
                'status' => 'active',
            ])
            ->assertRedirect(route('admin.model-products.index'));

        $model = $target->fresh();
        $this->assertSame($main->id, (int) $model->media_asset_id);
        $this->assertFalse((bool) $model->media_show_product_photos);
        $this->assertNotNull($model->image_url, 'image_url harus diisi dari media asset');

        // Urutan galeri mengikuti urutan kiriman form.
        $this->assertSame(
            [$second->id, $third->id],
            $model->galleryAssets()->pluck('media_assets.id')->map(fn ($id) => (int) $id)->all(),
        );
    }

    public function test_create_form_renders_with_media_setting_props(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->get(route('admin.model-products.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ModelProducts/Form')
                ->where('modelProduct', null)
                ->where('media', null)
                ->has('gallery', 0)
                ->where('maxGallery', CmsModelProduct::MAX_GALLERY)
                ->has('categories'));
    }

    public function test_create_derives_model_code_from_name_without_catalog_picker(): void
    {
        // Kontrak 2026-09-11 (commit bcae2a6) yang ditegaskan ulang 2026-09-15:
        // halaman tambah berarti MENAMBAH model baru, bukan memilih kode model
        // katalog yang sudah ada. Form hanya mengirim nama + kategori.
        $admin = $this->admin();

        $this->actingAs($admin)->post(route('admin.model-products.store'), [
            'name' => 'Boven Jungkit Empat Daun',
            'product_category' => 'BOVEN',
            'status' => 'active',
        ])->assertRedirect(route('admin.model-products.index'));

        $model = CmsModelProduct::query()->firstOrFail();
        $this->assertSame('BOVEN_JUNGKIT_EMPAT_DAUN', $model->product_model);
        $this->assertSame('Boven Jungkit Empat Daun', $model->name);
    }
    public function test_edit_form_exposes_media_and_gallery_props(): void
    {
        $this->makeProduct();
        $admin = $this->admin();
        $main = $this->asset('Foto Utama', 'media/utama/card.webp');
        $second = $this->asset('Foto Dua', 'media/dua/card.webp');

        $model = $this->slidingModel();
        $model->update([
            'name' => 'Jendela Aluminium Sliding',
            'media_asset_id' => $main->id,
        ]);
        $model->galleryAssets()->sync([$second->id => ['sort_order' => 0]]);

        $this->actingAs($admin)
            ->get(route('admin.model-products.edit', $model))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ModelProducts/Form')
                ->where('media.assetId', $main->id)
                ->has('gallery', 1)
                ->where('gallery.0.assetId', $second->id)
                ->where('maxGallery', CmsModelProduct::MAX_GALLERY)
                ->where('stats.active_count', 1));
    }

    public function test_storefront_card_uses_media_asset_image_and_gallery(): void
    {
        $this->makeProduct();
        $admin = $this->admin();
        $main = $this->asset('Foto Utama', 'media/utama/card.webp');
        $second = $this->asset('Foto Dua', 'media/dua/card.webp');

        $model = $this->slidingModel();
        $model->update([
            'name' => 'Jendela Aluminium Sliding',
            'media_asset_id' => $main->id,
            'image_url' => $main->localUrlFor('card'),
        ]);
        $model->galleryAssets()->sync([$second->id => ['sort_order' => 0]]);

        $cards = app(\App\Services\ModelProductService::class)->storefrontCards();
        $card = collect($cards)->first(
            fn (array $row) => strtoupper((string) $row['category']) === 'JENDELA'
                && strtoupper((string) $row['model']) === 'SLIDING'
        );

        $this->assertIsArray($card);
        $this->assertSame($main->localUrlFor('card'), $card['image']);
        $this->assertCount(1, $card['gallery']);
        $this->assertSame($second->id, (int) $card['gallery'][0]['id']);
    }

    public function test_media_setting_toggles_product_photos_on_model_card(): void
    {
        $this->makeProduct();
        $model = $this->slidingModel();
        $model->update(['media_show_product_photos' => false]);

        $cards = app(\App\Services\ModelProductService::class)->storefrontCards();
        $card = collect($cards)->first(
            fn (array $row) => strtoupper((string) $row['category']) === 'JENDELA'
                && strtoupper((string) $row['model']) === 'SLIDING'
        );

        $this->assertIsArray($card);
        $this->assertFalse((bool) $card['show_product_photos']);
        $this->assertFalse((bool) $model->fresh()->media_show_product_photos === true);
    }

    public function test_replacing_main_media_archives_previous_orphan_asset(): void
    {
        $this->makeProduct();
        $admin = $this->admin();
        $first = $this->asset('Foto Lama', 'media/lama/card.webp');
        $replacement = $this->asset('Foto Baru', 'media/baru/card.webp');

        $this->actingAs($admin)->put(route('admin.model-products.update', $this->slidingModel()), [
            'name' => 'Jendela Aluminium Sliding',
            'product_category' => 'JENDELA',
            'media_asset_id' => $first->id,
            'status' => 'active',
        ])->assertRedirect(route('admin.model-products.index'));

        $model = $this->slidingModel();

        $this->actingAs($admin)->put(route('admin.model-products.update', $model), [
            'name' => 'Jendela Aluminium Sliding',
            'product_category' => 'JENDELA',
            'media_asset_id' => $replacement->id,
            'status' => 'active',
        ])->assertRedirect(route('admin.model-products.index'));

        $this->assertSame($replacement->id, (int) $model->fresh()->media_asset_id);
        $this->assertSame('archived', $first->fresh()->status);
        $this->assertSame('ready', $replacement->fresh()->status);
    }

    public function test_gallery_rejects_more_than_max_assets(): void
    {
        $this->makeProduct();
        $admin = $this->admin();
        $ids = [];
        for ($i = 0; $i < CmsModelProduct::MAX_GALLERY + 1; $i++) {
            $ids[] = $this->asset('Foto '.$i, "media/g$i/card.webp")->id;
        }

        $this->actingAs($admin)
            ->post(route('admin.model-products.store'), [
                'name' => 'Jendela Aluminium Sliding',
                'product_category' => 'JENDELA',
                'gallery_asset_ids' => $ids,
                'status' => 'active',
            ])
                ->assertSessionHasErrors('gallery_asset_ids');

        // Hanya wadah otomatis dari produk; form yang ditolak tidak menambah baris.
        $this->assertSame(1, CmsModelProduct::query()->count());
    }

    public function test_legacy_row_without_media_keeps_image_url_fallback(): void
    {
        // Data produksi 2026-09-15: 12 baris model aktif masih memakai kolom
        // image_url (belum ada media_asset_id). Gambar lama harus tetap tampil
        // selama admin belum memasang media dari Media Library.
        $this->makeProduct();
        $model = $this->slidingModel();
        $model->update(['image_url' => '/storage/media/lama/card.webp']);

        $cards = app(\App\Services\ModelProductService::class)->storefrontCards();
        $card = collect($cards)->first(
            fn (array $row) => strtoupper((string) $row['category']) === 'JENDELA'
                && strtoupper((string) $row['model']) === 'SLIDING'
        );

        $this->assertIsArray($card);
        $this->assertSame('/storage/media/lama/card.webp', $card['image']);
        $this->assertSame([], $card['gallery']);
        $this->assertTrue((bool) $card['show_product_photos']);
    }
}
