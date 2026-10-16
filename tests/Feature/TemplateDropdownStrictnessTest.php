<?php

namespace Tests\Feature;

use App\Models\CmsModelProduct;
use App\Models\SubModel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Penjaga sikap dropdown Excel pada template import produk v2.
 *
 * Kontrak (perbaikan 16 Okt 2026):
 *  - Kategori Produk: errorStyle `stop`. Nilai di luar daftar DITOLAK Excel,
 *    karena kategori wajib sudah terdaftar di sistem.
 *  - Model Produk dan Sub Model: errorStyle `warning`. Nilai di luar daftar
 *    DIPERBOLEHKAN dengan peringatan, karena keduanya boleh berisi kode baru
 *    yang belum terdaftar dan akan dibuat otomatis saat impor.
 *
 * Sebelum perbaikan, Model dan Sub Model juga memakai `stop`, sehingga admin
 * TIDAK BISA mengetik model baru walau panduan template menyarankannya.
 */
class TemplateDropdownStrictnessTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function ambilXlsx(): string
    {
        $res = $this->actingAs($this->admin())
            ->get(route('admin.imports.product-import-template'));
        $res->assertOk();

        $base = $res->baseResponse;
        $tmp = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
        if ($base instanceof \Symfony\Component\HttpFoundation\BinaryFileResponse) {
            copy($base->getFile()->getPathname(), $tmp);

            return $tmp;
        }
        file_put_contents($tmp, $res->getContent());

        return $tmp;
    }

    /** @return array<string, array{errorStyle:string, allowBlank:string, daftar:string}> */
    private function validasiSheetData(): array
    {
        $tmp = $this->ambilXlsx();
        $zip = new \ZipArchive();
        $zip->open($tmp);
        $isi = (string) $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();
        @unlink($tmp);

        $hasil = [];
        preg_match_all('/<dataValidation\b[^>]*>.*?<\/dataValidation>/s', $isi, $m);
        foreach ($m[0] as $blok) {
            preg_match('/sqref="([^"]+)"/', $blok, $sq);
            preg_match('/errorStyle="([^"]+)"/', $blok, $es);
            preg_match('/allowBlank="([^"]+)"/', $blok, $ab);
            preg_match('/<formula1>(.*?)<\/formula1>/s', $blok, $f);
            $kolom = explode(':', $sq[1] ?? '?')[0];
            $hasil[$kolom] = [
                'errorStyle' => $es[1] ?? '?',
                'allowBlank' => $ab[1] ?? '?',
                'daftar' => html_entity_decode($f[1] ?? '', ENT_QUOTES),
            ];
        }

        return $hasil;
    }

    public function test_kategori_memakai_stop_sedangkan_model_dan_sub_model_warning(): void
    {
        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();

        CmsModelProduct::create([
            'name' => 'Model Satu',
            'product_category' => 'PINTU',
            'product_model' => 'MODEL_SATU',
            'status' => 'active',
        ]);
        SubModel::create([
            'product_model' => 'MODEL_SATU',
            'code' => 'SUB_SATU',
            'name' => 'Sub Satu',
            'is_active' => true,
        ]);
        \Illuminate\Support\Facades\Cache::flush();

        $v = $this->validasiSheetData();

        // Kolom E = Kategori Produk, F = Model Produk, G = Sub Model.
        $this->assertArrayHasKey('E2', $v, 'validasi kategori harus ada');
        $this->assertArrayHasKey('F2', $v, 'validasi model harus ada');
        $this->assertArrayHasKey('G2', $v, 'validasi sub model harus ada');

        $this->assertSame('stop', $v['E2']['errorStyle'], 'kategori harus menolak nilai asing');
        $this->assertSame('warning', $v['F2']['errorStyle'], 'model harus mengizinkan kode baru');
        $this->assertSame('warning', $v['G2']['errorStyle'], 'sub model harus mengizinkan kode baru');

        $this->assertStringContainsString('PINTU', $v['E2']['daftar']);
        $this->assertStringContainsString('MODEL_SATU', $v['F2']['daftar']);
        $this->assertStringContainsString('SUB_SATU', $v['G2']['daftar']);
    }

    public function test_saat_db_kosong_kolom_model_dan_sub_model_tanpa_dropdown(): void
    {
        CmsModelProduct::query()->delete();
        SubModel::query()->delete();
        \Illuminate\Support\Facades\Cache::flush();

        $v = $this->validasiSheetData();

        $this->assertArrayHasKey('E2', $v, 'kategori tetap punya dropdown');
        $this->assertArrayNotHasKey('F2', $v, 'model tanpa dropdown karena daftarnya kosong');
        $this->assertArrayNotHasKey('G2', $v, 'sub model tanpa dropdown karena daftarnya kosong');
    }
}
