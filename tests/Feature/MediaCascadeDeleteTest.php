<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Penjaga kontrak: menghapus aset media harus ikut menghapus berkasnya di
 * disk, sedangkan mengarsipkan tidak boleh menyentuh berkasnya sama sekali.
 */
class MediaCascadeDeleteTest extends TestCase
{
    use RefreshDatabase;

    private const CARD = 'media-assets/cascade/card.webp';

    private const PDP = 'media-assets/cascade/pdp.webp';

    private const THUMB = 'media-assets/cascade/thumb.webp';

    private function makeProduct(string $sku): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => $sku,
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'draft',
        ]);
    }

    private function makeAsset(array $overrides = []): MediaAsset
    {
        Storage::disk('media')->put(self::CARD, 'card');
        Storage::disk('media')->put(self::PDP, 'pdp');
        Storage::disk('media')->put(self::THUMB, 'thumb');

        return MediaAsset::create(array_merge([
            'kind' => 'image',
            'label' => 'Kontrak cascade',
            'checksum' => hash('sha256', 'cascade-fixture'),
            'object_key' => self::PDP,
            'derivatives' => [
                'thumb' => ['path' => self::THUMB],
                'card' => ['path' => self::CARD],
                'pdp' => ['path' => self::PDP],
            ],
            'mime_type' => 'image/webp',
            'status' => 'ready',
            'visibility' => 'visible',
        ], $overrides));
    }

    public function test_deleting_asset_removes_every_file_from_disk(): void
    {
        Storage::fake('media');
        $asset = $this->makeAsset();

        $asset->delete();

        $disk = Storage::disk('media');
        $disk->assertMissing(self::CARD);
        $disk->assertMissing(self::PDP);
        $disk->assertMissing(self::THUMB);
        $this->assertDatabaseMissing('media_assets', ['id' => $asset->id]);
    }

    public function test_archiving_asset_keeps_its_files_on_disk(): void
    {
        Storage::fake('media');
        $asset = $this->makeAsset();

        $asset->update(['visibility' => 'archived']);

        $disk = Storage::disk('media');
        $disk->assertExists(self::CARD);
        $disk->assertExists(self::PDP);
        $disk->assertExists(self::THUMB);
    }

    public function test_bulk_action_delete_removes_files_and_row(): void
    {
        Storage::fake('media');
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $asset = $this->makeAsset();

        $this->actingAs($admin)
            ->post(route('admin.media.bulk-action'), [
                'action' => 'delete',
                'asset_ids' => [$asset->id],
            ])
            ->assertRedirect();

        $disk = Storage::disk('media');
        $disk->assertMissing(self::CARD);
        $disk->assertMissing(self::PDP);
        $disk->assertMissing(self::THUMB);
        $this->assertDatabaseMissing('media_assets', ['id' => $asset->id]);
    }

    public function test_bulk_action_delete_archives_asset_that_is_still_used(): void
    {
        Storage::fake('media');
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $asset = $this->makeAsset();

        ProductMedia::create([
            'product_id' => $this->makeProduct('CASCADE-USED')->id,
            'media_asset_id' => $asset->id,
            'position' => 1,
            'visibility' => 'visible',
            'status' => 'downloaded',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.media.bulk-action'), [
                'action' => 'delete',
                'asset_ids' => [$asset->id],
            ])
            ->assertRedirect();

        // Aset yang masih dipakai entitas lain tidak dihapus, hanya diarsipkan,
        // dan berkasnya harus tetap ada supaya masih bisa dipulihkan.
        $this->assertDatabaseHas('media_assets', [
            'id' => $asset->id,
            'visibility' => 'archived',
        ]);
        Storage::disk('media')->assertExists(self::PDP);
    }

    public function test_deleting_attachment_without_shared_asset_removes_files(): void
    {
        Storage::fake('media');
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        Storage::disk('media')->put('products/9/lampiran-card.webp', 'x');

        $media = ProductMedia::create([
            'product_id' => $this->makeProduct('CASCADE-FAILED')->id,
            'position' => 1,
            'visibility' => 'visible',
            'status' => 'failed',
            'stored_path' => 'products/9/lampiran-card.webp',
            'derivatives' => ['card' => ['path' => 'products/9/lampiran-card.webp']],
        ]);

        $this->actingAs($admin)
            ->delete(route('admin.media.destroy', $media))
            ->assertRedirect();

        Storage::disk('media')->assertMissing('products/9/lampiran-card.webp');
        $this->assertDatabaseMissing('product_media', ['id' => $media->id]);
    }

    public function test_bulk_delete_archives_asset_that_is_organized_in_a_folder(): void
    {
        Storage::fake('media');
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $folder = MediaFolder::create(['name' => 'Rapi', 'parent_id' => null]);
        $asset = $this->makeAsset(['folder_id' => $folder->id]);

        $this->actingAs($admin)
            ->post(route('admin.media.bulk-action'), [
                'action' => 'delete',
                'asset_ids' => [$asset->id],
            ])
            ->assertRedirect();

        // Aset yang sudah dirapikan ke folder belum tentu terlampir ke produk,
        // jadi folder dihitung sebagai tanda sedang dipakai: diarsipkan, bukan
        // dihapus permanen, dan berkasnya tetap ada supaya bisa dipulihkan.
        $this->assertDatabaseHas('media_assets', [
            'id' => $asset->id,
            'visibility' => 'archived',
        ]);
        Storage::disk('media')->assertExists(self::PDP);
    }
}
