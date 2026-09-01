<?php

namespace Tests\Feature;

use App\Models\ImportJob;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class ImportStoreUploadTest extends TestCase
{
    use RefreshDatabase;

    // GATE G1: upload VALID ke admin.imports.store harus membuat ImportJob
    // (bukan 500 karena $file dipakai sebelum didefinisikan di store()).
    public function test_store_accepts_valid_catalog_upload_and_creates_pending_job(): void
    {
        Queue::fake();
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $rows = collect([
            ['name' => 'Jendela Besi Test', 'product_category' => 'WINDOW', 'product_model' => 'JUNGKIT', 'price' => 1500000, 'stock' => 3],
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
        Excel::store($export, 'imp_store_test.xlsx', 'imports');
        $path = \Illuminate\Support\Facades\Storage::disk('imports')->path('imp_store_test.xlsx');

        $upload = new UploadedFile(
            $path,
            'katalog.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $response = $this->actingAs($admin)->post(route('admin.imports.store'), [
            'type' => 'catalog_import',
            'file' => $upload,
            'stock_mode' => 'file',
        ]);

        $job = ImportJob::query()->latest('id')->first();
        $this->assertNotNull($job, 'ImportJob harus dibuat untuk upload valid');
        $response->assertRedirect(route('admin.imports.show', $job));
        $response->assertSessionHas('success');
        $this->assertSame('pending', $job->status);
    }


    // GATE G2: preview-catalog mengklasifikasi URL gambar internal/eksternal
    // per baris, tanpa menulis data apa pun.
    public function test_preview_catalog_classifies_image_urls(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $internalUrl = 'https://media.test.internal/media/library/contoh.webp';
        config(['filesystems.disks.media.url' => 'https://media.test.internal']);
        config(['filesystems.disks.media.proxy_url' => null]);
        config(['media.disk' => 'media']);

        \Illuminate\Support\Facades\Storage::fake('media');
        \Illuminate\Support\Facades\Storage::disk('media')->put('media/library/contoh.webp', 'x');

        $rows = collect([
            [
                'name' => 'Produk A',
                'price' => 100000,
                'stock' => 2,
                'image_1' => $internalUrl,
                'image_2' => 'https://cf.shopee.co.id/foto-b.jpg',
                'image_3' => 'bukan-url-valid',
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
        Excel::store($export, 'imp_preview_test.xlsx', 'imports');
        $path = \Illuminate\Support\Facades\Storage::disk('imports')->path('imp_preview_test.xlsx');
        $upload = new UploadedFile($path, 'katalog.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->actingAs($admin)->post(route('admin.imports.preview-catalog'), [
            'file' => $upload,
        ]);

        $response->assertOk();
        $payload = $response->json();
        $this->assertSame('preview-only; tidak menulis data', $payload['contract']);
        $this->assertSame(1, $payload['total']);
        $row = $payload['rows'][0];
        $this->assertSame('Produk A', $row['name']);
        $this->assertSame(3, count($row['media']));
        $classes = array_column($row['media'], 'class');
        $this->assertContains('internal', $classes);
        $this->assertContains('external', $classes);
        $this->assertContains('invalid', $classes);
        $this->assertSame(1, $row['media_stats']['internal']);
        $this->assertSame(1, $row['media_stats']['external']);
        $this->assertSame(1, $row['media_stats']['invalid']);
        // Tidak ada baris yang ditulis
        $this->assertSame(0, ImportJob::count());
    }
}
