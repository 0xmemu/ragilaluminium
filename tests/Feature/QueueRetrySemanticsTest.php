<?php

namespace Tests\Feature;

use App\Jobs\DownloadMediaAsset;
use App\Jobs\DownloadProductMedia;
use App\Jobs\ProcessCatalogImport;
use App\Models\ImportJob;
use App\Models\MediaAsset;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Services\MediaDerivativeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class QueueRetrySemanticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_shared_media_transient_http_failure_is_rethrown_for_worker_retry(): void
    {
        config(['media.allowed_source_hosts' => ['93.184.216.34']]);
        Http::fake([
            'https://93.184.216.34/transient.jpg' => Http::response('', 503),
        ]);
        $asset = MediaAsset::create([
            'kind' => 'image',
            'source_url_hash' => hash('sha256', 'https://93.184.216.34/transient.jpg'),
            'source_url' => 'https://93.184.216.34/transient.jpg',
            'status' => 'pending',
            'visibility' => 'visible',
        ]);

        $exception = null;
        try {
            (new DownloadMediaAsset($asset->id))->handle(app(MediaDerivativeService::class));
        } catch (RuntimeException $caught) {
            $exception = $caught;
        }

        $this->assertInstanceOf(RuntimeException::class, $exception);
        $this->assertStringContainsString('HTTP 503', $exception->getMessage());
        $this->assertSame('failed', $asset->fresh()->status);
    }

    public function test_shared_media_permanent_http_failure_is_recorded_without_retry(): void
    {
        config(['media.allowed_source_hosts' => ['93.184.216.34']]);
        Http::fake([
            'https://93.184.216.34/missing.jpg' => Http::response('', 404),
        ]);
        $asset = MediaAsset::create([
            'kind' => 'image',
            'source_url_hash' => hash('sha256', 'https://93.184.216.34/missing.jpg'),
            'source_url' => 'https://93.184.216.34/missing.jpg',
            'status' => 'pending',
            'visibility' => 'visible',
        ]);

        (new DownloadMediaAsset($asset->id))->handle(app(MediaDerivativeService::class));

        $this->assertSame('failed', $asset->fresh()->status);
        $this->assertSame('HTTP 404', $asset->fresh()->error_reason);
    }

    public function test_shared_media_redirect_is_not_followed_into_a_private_network(): void
    {
        config(['media.allowed_source_hosts' => ['93.184.216.34']]);
        Http::fakeSequence()
            ->push('', 302, ['Location' => 'http://127.0.0.1/internal'])
            ->push('internal response', 200, ['Content-Type' => 'image/jpeg']);
        $asset = MediaAsset::create([
            'kind' => 'image',
            'source_url_hash' => hash('sha256', 'https://93.184.216.34/redirect.jpg'),
            'source_url' => 'https://93.184.216.34/redirect.jpg',
            'status' => 'pending',
            'visibility' => 'visible',
        ]);

        (new DownloadMediaAsset($asset->id))->handle(app(MediaDerivativeService::class));

        $this->assertSame('failed', $asset->fresh()->status);
        $this->assertSame('HTTP 302', $asset->fresh()->error_reason);
        Http::assertSentCount(1);
    }

    public function test_legacy_media_transient_failure_is_rethrown_for_worker_retry(): void
    {
        config(['media.allowed_source_hosts' => ['93.184.216.34']]);
        Http::fake([
            'https://93.184.216.34/legacy.jpg' => Http::response('', 503),
        ]);
        $product = Product::create([
            'parent_sku' => 'QUEUE-RETRY-1',
            'name' => 'Queue Retry',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'draft',
        ]);
        $media = ProductMedia::create([
            'product_id' => $product->id,
            'source_url' => 'https://93.184.216.34/legacy.jpg',
            'status' => 'pending',
            'visibility' => 'visible',
            'position' => 1,
        ]);

        $exception = null;
        try {
            (new DownloadProductMedia($media->id))->handle(app(MediaDerivativeService::class));
        } catch (RuntimeException $caught) {
            $exception = $caught;
        }

        $this->assertInstanceOf(RuntimeException::class, $exception);
        $this->assertSame('failed', $media->fresh()->status);
    }

    public function test_legacy_media_redirect_is_not_followed_into_a_private_network(): void
    {
        config(['media.allowed_source_hosts' => ['93.184.216.34']]);
        Http::fakeSequence()
            ->push('', 302, ['Location' => 'http://127.0.0.1/internal'])
            ->push('internal response', 200, ['Content-Type' => 'image/jpeg']);
        $product = Product::create([
            'parent_sku' => 'QUEUE-REDIRECT-1',
            'name' => 'Queue Redirect',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'draft',
        ]);
        $media = ProductMedia::create([
            'product_id' => $product->id,
            'source_url' => 'https://93.184.216.34/legacy-redirect.jpg',
            'status' => 'pending',
            'visibility' => 'visible',
            'position' => 1,
        ]);

        (new DownloadProductMedia($media->id))->handle(app(MediaDerivativeService::class));

        $this->assertSame('failed', $media->fresh()->status);
        $this->assertSame('HTTP 302', $media->fresh()->error_reason);
        Http::assertSentCount(1);
    }

    public function test_missing_import_source_is_failed_and_rethrown_for_global_alerting(): void
    {
        Storage::fake('imports');
        $import = ImportJob::create([
            'type' => 'internal_bulk_update',
            'source_file_name' => 'missing.xlsx',
            'source_file_path' => 'catalog/missing.xlsx',
            'status' => 'pending',
        ]);

        $exception = null;
        try {
            (new ProcessCatalogImport($import->id, 'catalog/missing.xlsx'))->handle();
        } catch (RuntimeException $caught) {
            $exception = $caught;
        }

        $this->assertInstanceOf(RuntimeException::class, $exception);
        $this->assertSame('failed', $import->fresh()->status);
        $this->assertNotNull($import->fresh()->completed_at);
    }
}
