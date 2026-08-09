<?php

namespace Tests\Feature;

use App\Jobs\DownloadProductMedia;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductMedia;
use App\Services\MediaDerivativeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaDerivativesTest extends TestCase
{
    use RefreshDatabase;

    public function test_download_job_stores_webp_only_by_default(): void
    {
        if (! extension_loaded('gd') || ! function_exists('imagewebp')) {
            $this->markTestSkipped('GD + WebP required');
        }

        Storage::fake('media');
        config(['media.keep_original' => false]);

        $png = $this->makePngBytes(120, 80);
        Http::fake([
            'https://93.184.216.34/product.png' => Http::response($png, 200, ['Content-Type' => 'image/png']),
        ]);
        config(['media.allowed_source_hosts' => ['93.184.216.34']]);

        $product = Product::create([
            'parent_sku' => 'WIN-MED-1',
            'name' => 'Media Test',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $media = ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'is_main_image' => true,
            'visibility' => 'visible',
            'source_url' => 'https://93.184.216.34/product.png',
            'status' => 'pending',
        ]);

        (new DownloadProductMedia($media->id))->handle(app(MediaDerivativeService::class));

        $media->refresh();
        $this->assertSame('downloaded', $media->status);
        $this->assertNotEmpty($media->stored_path);
        $this->assertStringEndsWith('-pdp.webp', $media->stored_path);
        $this->assertSame('image/webp', $media->mime_type);
        $this->assertNotEmpty($media->derivatives['thumb']['url'] ?? null);
        $this->assertNotEmpty($media->derivatives['card']['url'] ?? null);
        $this->assertNotEmpty($media->derivatives['pdp']['url'] ?? null);
        $this->assertStringContainsString('card', $media->urlFor('card'));
        $this->assertStringStartsWith('/storage/', $media->urlFor('card'));

        $pngOnDisk = collect(Storage::disk('media')->allFiles())
            ->filter(fn (string $path) => str_ends_with(strtolower($path), '.png'))
            ->values();
        $this->assertCount(0, $pngOnDisk, 'Heavy original must not remain when keep_original=false');

        $this->assertNull(
            (function () use ($media) {
                config(['media.allow_source_url_fallback' => false]);
                $media->stored_url = null;
                $media->derivatives = null;
                $media->status = 'failed';

                return $media->urlFor('card');
            })()
        );
    }

    public function test_download_job_keeps_original_when_configured(): void
    {
        if (! extension_loaded('gd') || ! function_exists('imagewebp')) {
            $this->markTestSkipped('GD + WebP required');
        }

        Storage::fake('media');
        config(['media.keep_original' => true]);

        $png = $this->makePngBytes(80, 60);
        Http::fake([
            'https://93.184.216.34/keep.png' => Http::response($png, 200, ['Content-Type' => 'image/png']),
        ]);
        config(['media.allowed_source_hosts' => ['93.184.216.34']]);

        $product = Product::create([
            'parent_sku' => 'WIN-MED-KEEP',
            'name' => 'Keep Original',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $media = ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'is_main_image' => true,
            'visibility' => 'visible',
            'source_url' => 'https://93.184.216.34/keep.png',
            'status' => 'pending',
        ]);

        (new DownloadProductMedia($media->id))->handle(app(MediaDerivativeService::class));

        $media->refresh();
        $this->assertSame('downloaded', $media->status);
        $this->assertStringEndsWith('.png', $media->stored_path);
        $this->assertTrue(Storage::disk('media')->exists($media->stored_path));
        $this->assertNotEmpty($media->derivatives['pdp']['path'] ?? null);
    }

    public function test_local_url_prefers_live_path_over_stale_absolute_host(): void
    {
        Storage::fake('media');

        $product = Product::create([
            'parent_sku' => 'WIN-MED-2',
            'name' => 'Media Host Test',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $path = "products/{$product->id}/sample-card.webp";
        Storage::disk('media')->put($path, 'webp');

        $media = ProductMedia::create([
            'product_id' => $product->id,
            'position' => 1,
            'is_main_image' => true,
            'visibility' => 'visible',
            'source_url' => 'https://93.184.216.34/product.png',
            'stored_path' => "products/{$product->id}/sample.jpg",
            'stored_url' => 'http://172.24.0.182:8200/storage/media/products/1/sample.jpg',
            'derivatives' => [
                'card' => [
                    'path' => $path,
                    'url' => 'http://172.24.0.182:8200/storage/media/'.$path,
                    'width' => 800,
                    'height' => 600,
                ],
            ],
            'status' => 'downloaded',
        ]);

        $url = $media->urlFor('card');
        $this->assertStringStartsWith('/storage/', $url);
        $this->assertStringNotContainsString('172.24.0.182', $url);
        $this->assertStringContainsString('sample-card.webp', $url);
    }

    public function test_catalog_paginates_fourteen(): void
    {
        for ($i = 1; $i <= 30; $i++) {
            $product = Product::create([
                'parent_sku' => "WIN-P-{$i}",
                'name' => "Product {$i}",
                'category_id' => 1,
                'product_category' => 'WINDOW',
                'product_model' => 'JUNGKIT',
                'design_variant' => 'POLOS',
                'status' => 'active',
            ]);
            ProductVariant::create([
                'product_id' => $product->id,
                'variant_sku' => "WIN-P-{$i}-V1",
                'price' => 1000000,
                'stock' => 5,
                'status' => 'active',
            ]);
        }

        $response = $this->getJson('/api/catalog/windows');
        $response->assertOk();
        $this->assertCount(14, $response->json('products'));
        $this->assertSame(14, $response->json('pagination.per_page'));
    }

    protected function makePngBytes(int $w, int $h): string
    {
        $im = imagecreatetruecolor($w, $h);
        $bg = imagecolorallocate($im, 200, 40, 40);
        imagefilledrectangle($im, 0, 0, $w, $h, $bg);
        ob_start();
        imagepng($im);
        imagedestroy($im);

        return (string) ob_get_clean();
    }
}
