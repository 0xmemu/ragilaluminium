<?php

namespace Tests\Feature;

use App\Jobs\DownloadMediaAsset;
use App\Models\MediaAsset;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Services\MediaAssetResolver;
use App\Services\MediaDerivativeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SharedMediaAssetTest extends TestCase
{
    use RefreshDatabase;

    public function test_one_asset_can_be_attached_to_multiple_products_without_duplicate_storage(): void
    {
        if (! extension_loaded('gd') || ! function_exists('imagewebp')) {
            $this->markTestSkipped('GD + WebP required');
        }

        Storage::fake('media');
        config(['media.allowed_source_hosts' => ['93.184.216.34']]);
        Http::fake(['https://93.184.216.34/shared.png' => Http::response($this->makePngBytes(), 200, ['Content-Type' => 'image/png'])]);

        $first = $this->makeProduct('WEB-SHARED-1');
        $second = $this->makeProduct('WEB-SHARED-2');
        $resolver = app(MediaAssetResolver::class);
        $asset = $resolver->fromSourceUrl('https://93.184.216.34/shared.png');
        $resolver->attach($first, $asset, ['position' => 1, 'is_main_image' => true]);
        $resolver->attach($second, $asset, ['position' => 1, 'is_main_image' => true]);

        (new DownloadMediaAsset($asset->id))->handle(app(MediaDerivativeService::class));

        $asset->refresh();
        $this->assertSame('ready', $asset->status);
        $this->assertSame(2, ProductMedia::where('media_asset_id', $asset->id)->count());
        $this->assertCount(3, Storage::disk('media')->allFiles());
        $this->assertStringStartsWith('media-assets/'.$asset->checksum.'/', $asset->object_key);
    }

    public function test_different_source_urls_with_same_bytes_converge_to_one_asset(): void
    {
        if (! extension_loaded('gd') || ! function_exists('imagewebp')) {
            $this->markTestSkipped('GD + WebP required');
        }

        Storage::fake('media');
        config(['media.allowed_source_hosts' => ['93.184.216.34']]);
        $bytes = $this->makePngBytes();
        Http::fake([
            'https://93.184.216.34/one.png' => Http::response($bytes, 200, ['Content-Type' => 'image/png']),
            'https://93.184.216.34/two.png' => Http::response($bytes, 200, ['Content-Type' => 'image/png']),
        ]);

        $first = $this->makeProduct('WEB-SHARED-3');
        $second = $this->makeProduct('WEB-SHARED-4');
        $resolver = app(MediaAssetResolver::class);
        $one = $resolver->fromSourceUrl('https://93.184.216.34/one.png');
        $two = $resolver->fromSourceUrl('https://93.184.216.34/two.png');
        $resolver->attach($first, $one);
        $resolver->attach($second, $two);

        (new DownloadMediaAsset($one->id))->handle(app(MediaDerivativeService::class));
        (new DownloadMediaAsset($two->id))->handle(app(MediaDerivativeService::class));

        $this->assertSame(1, MediaAsset::where('status', 'ready')->count());
        $this->assertSame(2, ProductMedia::where('media_asset_id', $one->id)->count());
        $this->assertSame(0, ProductMedia::where('media_asset_id', $two->id)->count());
        $this->assertSame($one->id, ProductMedia::where('product_id', $first->id)->value('media_asset_id'));
        $this->assertSame($one->id, ProductMedia::where('product_id', $second->id)->value('media_asset_id'));
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

    protected function makePngBytes(): string
    {
        $image = imagecreatetruecolor(120, 80);
        $background = imagecolorallocate($image, 200, 40, 40);
        imagefilledrectangle($image, 0, 0, 120, 80, $background);
        ob_start();
        imagepng($image);
        imagedestroy($image);

        return (string) ob_get_clean();
    }
}
