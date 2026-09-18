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

class ImportProgressStatusTest extends TestCase
{
    use RefreshDatabase;

    // GATE G1: store() mengisi total_rows sejak awal (denominator progress)
    public function test_store_sets_total_rows_for_progress(): void
    {
        Queue::fake();
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $rows = collect([
            ['name' => 'Produk A', 'price' => 100000, 'stock' => 1],
            ['name' => 'Produk B', 'price' => 200000, 'stock' => 2],
            ['name' => 'Produk C', 'price' => 300000, 'stock' => 3],
        ]);
        $export = new class($rows) implements FromCollection, WithHeadings
        {
            public function __construct(public $rows) {}

            public function collection() { return $this->rows; }

            public function headings(): array { return array_keys($this->rows->first()); }
        };
        Excel::store($export, 'imp_progress.xlsx', 'imports');
        $path = \Illuminate\Support\Facades\Storage::disk('imports')->path('imp_progress.xlsx');
        $upload = new UploadedFile($path, 'katalog.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $response = $this->actingAs($admin)->post(route('admin.imports.store'), [
            'type' => 'catalog_import',
            'file' => $upload,
            'stock_mode' => 'file',
        ]);

        $job = ImportJob::latest('id')->first();
        $this->assertNotNull($job);
        $response->assertRedirect(route('admin.imports.show', $job));
        $this->assertSame(3, (int) $job->total_rows, 'total_rows harus terisi = jumlah baris data');
    }

    // GATE G2: halaman detail render Admin/ImportShow dgn data progress
    public function test_show_renders_import_show_page_with_progress_data(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $job = ImportJob::create([
            'type' => 'catalog_import',
            'source_file_name' => 'katalog.xlsx',
            'source_file_path' => 'catalog/x.xlsx',
            'total_rows' => 10,
            'processed_rows' => 4,
            'success_rows' => 3,
            'failed_rows' => 1,
            'status' => 'running',
            'stock_mode' => 'file',
            'triggered_by_user_id' => $admin->id,
        ]);

        $response = $this->actingAs($admin)->get(route('admin.imports.show', $job));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/ImportShow')
            ->where('importJob.total_rows', 10)
            ->where('importJob.processed_rows', 4)
            ->where('importJob.success_rows', 3)
            ->where('importJob.failed_rows', 1)
            ->where('importJob.status', 'running')
        );
    }

    // GATE G3: job backfill total_rows untuk job lama (null) saat mulai jalan
    public function test_running_job_backfills_missing_total_rows(): void
    {
        config(['media.allowed_source_hosts' => ['example.com']]);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        // Fixture memakai format v2 karena import katalog kini WAJIB v2.
        // Dua baris = dua produk (NO. ID berbeda), masing-masing satu varian.
        $rows = collect([
            [
                'no_id' => 1, 'nama_produk' => 'Pintu Aluminium Backfill 1',
                'kategori_produk' => 'PINTU', 'model_produk' => 'SLIDING_2_DAUN', 'sub_model' => 'POLOS',
                'nama_variasi_1' => 'Warna', 'opsi_variasi_1' => 'Putih',
                'harga' => 100000, 'stok' => 1,
                'berat_kg' => 10, 'tinggi_cm' => 100, 'panjang_cm' => 50, 'lebar_cm' => 20,
                'gambar_1_utama' => 'https://example.com/a.jpg',
            ],
            [
                'no_id' => 2, 'nama_produk' => 'Pintu Aluminium Backfill 2',
                'kategori_produk' => 'PINTU', 'model_produk' => 'SLIDING_2_DAUN', 'sub_model' => 'POLOS',
                'nama_variasi_1' => 'Warna', 'opsi_variasi_1' => 'Hitam',
                'harga' => 200000, 'stok' => 2,
                'berat_kg' => 12, 'tinggi_cm' => 110, 'panjang_cm' => 55, 'lebar_cm' => 22,
                'gambar_1_utama' => 'https://example.com/b.jpg',
            ],
        ]);
        $export = new class($rows) implements FromCollection, WithHeadings
        {
            public function __construct(public $rows) {}

            public function collection() { return $this->rows; }

            public function headings(): array { return array_keys($this->rows->first()); }
        };
        Excel::store($export, 'imp_backfill.xlsx', 'imports');

        $job = ImportJob::create([
            'type' => 'catalog_import',
            'source_file_name' => 'imp_backfill.xlsx',
            'source_file_path' => 'imp_backfill.xlsx',
            'status' => 'pending',
            'stock_mode' => 'file',
            'triggered_by_user_id' => $admin->id,
        ]);
        $this->assertNull($job->total_rows);

        (new \App\Jobs\ProcessCatalogImport($job->id, 'imp_backfill.xlsx'))->handle();

        $job->refresh();
        $this->assertSame(2, (int) $job->total_rows, 'total_rows harus ter-backfill saat job jalan');
        $this->assertSame('completed', $job->status);
        $this->assertSame(2, (int) $job->success_rows);
    }
}
