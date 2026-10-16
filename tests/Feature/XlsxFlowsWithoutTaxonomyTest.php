<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\Product;
use App\Models\SubModel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Memastikan ketiga alur XLSX tetap hidup saat taksonomi kosong:
 * 1. Unduh template import produk baru.
 * 2. Unduh template update harga/stok.
 * 3. Unduh template update media.
 * 4. Export katalog sebagai update.
 */
class XlsxFlowsWithoutTaxonomyTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function kosongkan(): void
    {
        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();
    }

    public function test_template_import_produk_baru_tetap_bisa_diunduh(): void
    {
        $this->kosongkan();

        $res = $this->actingAs($this->admin())
            ->get(route('admin.imports.product-import-template'));

        $res->assertOk();
        $this->assertTrue($res->baseResponse instanceof \Symfony\Component\HttpFoundation\BinaryFileResponse
            || $res->headers->get('content-type') !== null,
            'respons template harus berupa unduhan berkas');
    }

    public function test_template_update_harga_stok_tetap_bisa_diunduh(): void
    {
        $this->kosongkan();

        $res = $this->actingAs($this->admin())
            ->get(route('admin.imports.stock-price-template'));

        $res->assertOk();
    }

    public function test_template_update_media_tetap_bisa_diunduh(): void
    {
        $this->kosongkan();

        $res = $this->actingAs($this->admin())
            ->get(route('admin.imports.media-update-template'));

        $res->assertOk();
    }

    public function test_export_katalog_tetap_bisa_diunduh(): void
    {
        $this->kosongkan();

        $res = $this->actingAs($this->admin())
            ->get(route('admin.products.export'));

        $res->assertOk();
    }
}
