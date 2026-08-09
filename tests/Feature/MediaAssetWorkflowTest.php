<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\User;
use App\Services\MediaAssetResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaAssetWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_video_upload_is_stored_as_one_immutable_asset(): void
    {
        Storage::fake('media');
        $file = UploadedFile::fake()->create('motif.mp4', 12, 'video/mp4');

        $asset = app(MediaAssetResolver::class)->fromUploadedFile($file, 'video');

        $this->assertSame('video', $asset->kind);
        $this->assertSame('ready', $asset->status);
        $this->assertStringStartsWith('media-assets/'.$asset->checksum.'/video.', $asset->object_key);
        Storage::disk('media')->assertExists($asset->object_key);
    }

    public function test_admin_can_bulk_attach_one_asset_to_multiple_products(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $first = $this->makeProduct('BULK-MEDIA-1');
        $second = $this->makeProduct('BULK-MEDIA-2');
        $asset = MediaAsset::create([
            'kind' => 'image',
            'label' => 'Motif sama',
            'checksum' => hash('sha256', 'bulk-motif'),
            'object_key' => 'media-assets/bulk-motif/card.webp',
            'status' => 'ready',
            'visibility' => 'visible',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.media.attach', $asset), [
                'product_ids' => [$first->id, $second->id],
                'position' => 1,
                'show_in_catalog' => true,
                'is_main_image' => true,
                'is_installation' => false,
                'visibility' => 'visible',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame(2, ProductMedia::where('media_asset_id', $asset->id)->count());
        $this->assertSame(2, ProductMedia::where('is_main_image', true)->count());
    }

    public function test_backfill_links_legacy_source_url_without_deleting_attachment(): void
    {
        $product = $this->makeProduct('BACKFILL-MEDIA-1');
        $media = ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'is_main_image' => true,
            'show_in_catalog' => true,
            'visibility' => 'visible',
            'source_url' => 'https://93.184.216.34/legacy.jpg',
            'status' => 'pending',
        ]);

        $this->artisan('media:backfill-assets')->assertExitCode(0);

        $this->assertNotNull($media->fresh()->media_asset_id);
        $this->assertDatabaseHas('media_assets', [
            'source_url' => 'https://93.184.216.34/legacy.jpg',
            'kind' => 'image',
        ]);
        $this->assertDatabaseHas('product_media', ['id' => $media->id]);
    }

    protected function makeProduct(string $sku): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => $sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'draft',
        ]);
    }
}
