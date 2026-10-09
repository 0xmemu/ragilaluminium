<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Models\User;
use App\Jobs\ProcessUploadedMediaAsset;
use App\Models\MediaProcessingLog;
use App\Services\MediaDerivativeService;
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

    public function test_attach_options_lists_active_variants_and_existing_rows(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = $this->makeProduct('ATTACH-OPT-1');
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'ATTACH-OPT-1-PUTIH',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Putih',
            'price' => 100000,
            'stock' => 1,
            'status' => 'active',
        ]);
        $asset = $this->makeAsset('attach-opt-1');

        $this->attachAsset($admin, $asset, $product, 3);

        $this->actingAs($admin)
            ->getJson(route('admin.media.attach-options', $asset).'?product_id='.$product->id)
            ->assertOk()
            ->assertJsonPath('variants.0.id', $variant->id)
            ->assertJsonPath('variants.0.sku', 'ATTACH-OPT-1-PUTIH')
            ->assertJsonPath('existing.0.position', 3)
            ->assertJsonPath('existing.0.product_variant_id', null);
    }

    public function test_attach_insert_shifts_existing_positions_instead_of_duplicate_numbers(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = $this->makeProduct('ATTACH-SHIFT-1');
        $assetA = $this->makeAsset('attach-shift-a');
        $assetB = $this->makeAsset('attach-shift-b');
        $assetC = $this->makeAsset('attach-shift-c');

        $this->attachAsset($admin, $assetA, $product, 1);
        $this->attachAsset($admin, $assetB, $product, 2);
        $this->attachAsset($admin, $assetC, $product, 2);

        $positions = ProductMedia::query()
            ->where('product_id', $product->id)
            ->whereIn('media_asset_id', [$assetA->id, $assetB->id, $assetC->id])
            ->pluck('position', 'media_asset_id');

        $this->assertSame(1, (int) $positions[$assetA->id]);
        $this->assertSame(2, (int) $positions[$assetC->id]);
        $this->assertSame(3, (int) $positions[$assetB->id]);
    }

    public function test_attach_to_variant_scope_does_not_touch_catalog_media(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = $this->makeProduct('ATTACH-VAR-1');
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'ATTACH-VAR-1-PUTIH',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Putih',
            'price' => 100000,
            'stock' => 1,
            'status' => 'active',
        ]);
        $assetCatalog = $this->makeAsset('attach-var-katalog');
        $assetVariant = $this->makeAsset('attach-var-varian');

        $this->attachAsset($admin, $assetCatalog, $product, 1);
        $this->attachAsset($admin, $assetVariant, $product, 1, ['product_variant_id' => $variant->id]);

        $katalog = ProductMedia::query()
            ->where('product_id', $product->id)
            ->where('media_asset_id', $assetCatalog->id)
            ->first();
        $varian = ProductMedia::query()
            ->where('product_id', $product->id)
            ->where('media_asset_id', $assetVariant->id)
            ->first();

        $this->assertNotNull($katalog);
        $this->assertNull($katalog->product_variant_id);
        $this->assertSame(1, (int) $katalog->position);
        $this->assertNotNull($varian);
        $this->assertSame($variant->id, (int) $varian->product_variant_id);
        $this->assertSame(1, (int) $varian->position);
    }

    public function test_attach_rejects_variant_from_another_product(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = $this->makeProduct('ATTACH-VAR-2');
        $other = $this->makeProduct('ATTACH-VAR-2-OTHER');
        $variant = ProductVariant::create([
            'product_id' => $other->id,
            'variant_sku' => 'ATTACH-VAR-2-OTHER-PUTIH',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Putih',
            'price' => 100000,
            'stock' => 1,
            'status' => 'active',
        ]);
        $asset = $this->makeAsset('attach-var-salah');

        $this->actingAs($admin)
            ->postJson(route('admin.media.attach', $asset), [
                'product_ids' => [$product->id],
                'product_variant_id' => $variant->id,
                'position' => 1,
                'visibility' => 'visible',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Varian tidak sesuai dengan produk tujuan.');
    }

    public function test_reattaching_same_asset_updates_row_without_duplicate(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = $this->makeProduct('ATTACH-RE-1');
        $asset = $this->makeAsset('attach-re-1');

        $this->attachAsset($admin, $asset, $product, 1);
        $this->attachAsset($admin, $asset, $product, 2, ['show_in_catalog' => false]);

        $rows = ProductMedia::query()
            ->where('product_id', $product->id)
            ->where('media_asset_id', $asset->id)
            ->get();

        $this->assertCount(1, $rows);
        $this->assertSame(2, (int) $rows[0]->position);
        $this->assertFalse((bool) $rows[0]->show_in_catalog);
    }

    public function test_process_uploaded_media_asset_records_dedup_meta_when_duplicate_found(): void
    {
        Storage::fake('media');
        $disk = Storage::disk('media');

        $content = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        $checksum = hash('sha256', $content);

        $canonical = MediaAsset::create([
            'kind' => 'image',
            'label' => 'foto-asli.png',
            'checksum' => $checksum,
            'object_key' => 'media-assets/'.$checksum.'/card.webp',
            'status' => 'ready',
            'visibility' => 'visible',
        ]);

        $product = $this->makeProduct('DEDUP-P1');

        $uploadKey = 'media/library/pending-upload.png';
        $disk->put($uploadKey, $content);

        $duplicateAsset = MediaAsset::create([
            'kind' => 'image',
            'label' => 'foto-duplikat.png',
            'checksum' => null,
            'object_key' => $uploadKey,
            'status' => 'pending',
            'visibility' => 'visible',
        ]);

        $attachment = ProductMedia::create([
            'product_id' => $product->id,
            'media_asset_id' => $duplicateAsset->id,
            'position' => 1,
            'status' => 'pending',
        ]);

        (new ProcessUploadedMediaAsset($duplicateAsset->id))->handle(app(MediaDerivativeService::class));

        $duplicateAsset->refresh();
        $this->assertSame('archived', $duplicateAsset->status);
        $this->assertFalse($disk->exists($uploadKey), 'Berkas duplikat di R2 harus terhapus');

        $attachment->refresh();
        $this->assertSame($canonical->id, $attachment->media_asset_id, 'Attachment dialihkan ke canonical');

        $dedupLogs = MediaProcessingLog::query()
            ->where('loggable_type', MediaAsset::class)
            ->where('loggable_id', $duplicateAsset->id)
            ->where('event', 'dedup')
            ->get();

        $this->assertCount(1, $dedupLogs, 'Hanya 1 baris log dedup yang dicatat');
        $meta = $dedupLogs->first()->meta;
        $this->assertIsArray($meta);
        $this->assertSame($canonical->id, $meta['merged_into_asset_id']);
        $this->assertSame('foto-asli.png', $meta['merged_into_label']);
    }

    private function makeAsset(string $seed): MediaAsset
    {
        return MediaAsset::create([
            'kind' => 'image',
            'label' => 'Aset '.$seed,
            'checksum' => hash('sha256', $seed),
            'object_key' => 'media-assets/'.$seed.'/card.webp',
            'status' => 'ready',
            'visibility' => 'visible',
        ]);
    }

    private function attachAsset(User $admin, MediaAsset $asset, Product $product, int $position, array $extra = []): void
    {
        $this->actingAs($admin)->post(route('admin.media.attach', $asset), array_merge([
            'product_ids' => [$product->id],
            'position' => $position,
            'show_in_catalog' => true,
            'is_installation' => false,
            'visibility' => 'visible',
        ], $extra))->assertRedirect();
    }

    protected function makeProduct(string $sku): Product
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
}
