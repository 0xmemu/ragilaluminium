<?php

namespace Tests\Feature;

use App\Jobs\DownloadMediaAsset;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminProductMediaVariantTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_attach_media_to_variant_and_reassign(): void
    {
        Queue::fake([DownloadMediaAsset::class]);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $product = Product::create([
            'parent_sku' => 'WIN-MEDIA-1',
            'name' => 'Window Media',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        $putih = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-MEDIA-1-PUTIH',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Putih',
            'variation_2_name' => 'Kaca',
            'variation_2_option' => 'Bening',
            'price' => 100000,
            'stock' => 2,
            'status' => 'active',
        ]);
        $hitam = ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-MEDIA-1-HITAM',
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Hitam',
            'variation_2_name' => 'Kaca',
            'variation_2_option' => 'Bening',
            'price' => 110000,
            'stock' => 2,
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.products.media.byProduct', $product))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Products/Media')
                ->has('variants', 2));

        $this->actingAs($admin)
            ->post(route('admin.products.media.store', $product), [
                'source_url' => 'https://cdn.example.com/putih-bening.jpg',
                'position' => 1,
                'visibility' => 'visible',
                'is_main_image' => true,
                'product_variant_id' => $putih->id,
            ])
            ->assertRedirect();

        Queue::assertPushed(DownloadMediaAsset::class);
        $media = ProductMedia::query()->where('product_id', $product->id)->first();
        $this->assertNotNull($media);
        $this->assertSame($putih->id, $media->product_variant_id);

        $this->actingAs($admin)
            ->put(route('admin.media.update', $media), [
                'position' => 2,
                'visibility' => 'visible',
                'product_variant_id' => $hitam->id,
            ])
            ->assertRedirect();

        $this->assertSame($hitam->id, $media->fresh()->product_variant_id);
        $this->assertSame(2, $media->fresh()->position);

        $this->actingAs($admin)
            ->get(route('admin.variants.edit', $hitam))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/VariantEdit')
                ->has('media', 1)
                ->where('media.0.id', $media->id));
    }
}
