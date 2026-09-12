<?php

namespace Tests\Feature;

use App\Exports\CorrectionFileExport;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * Kontrak file koreksi import: file ini BOLAK-BALIK (admin unduh, perbaiki,
 * upload ulang), jadi nilai teks harus kembali persis.
 *
 * Kalau SKU angka ditulis sebagai ANGKA, Excel menampilkan notasi ilmiah
 * dan di atas 15 digit membulatkan digit terakhir, sehingga SKU tidak lagi
 * cocok saat di-upload ulang.
 */
class CorrectionFileExportTest extends TestCase
{
    private function rows(): \Illuminate\Support\Collection
    {
        return collect([
            (object) [
                'raw_data' => [
                    'id_key' => 1,
                    'variant_sku' => '90012345678',
                    'product_name' => 'Jendela Jungkit 2 Daun',
                    'price' => '9870000',
                ],
                'error_reason' => 'Kategori tidak dikenal',
            ],
            (object) [
                'raw_data' => [
                    'id_key' => 2,
                    'variant_sku' => '081234567890',
                    'product_name' => 'Boven Sliding',
                    'price' => '10590000',
                ],
                'error_reason' => 'Harga bukan angka',
            ],
        ]);
    }

    public function test_nilai_teks_kembali_persis_seperti_file_admin(): void
    {
        Excel::store(new CorrectionFileExport($this->rows()), 'koreksi_uji.xlsx', 'imports');
        $path = Storage::disk('imports')->path('koreksi_uji.xlsx');
        $ss = IOFactory::load($path);

        $sheet = $ss->getSheet(0);
        $this->assertSame('variant_sku', $sheet->getCell('B1')->getValue());

        $c2 = $sheet->getCell('B2');
        $this->assertSame('90012345678', (string) $c2->getValue(), 'SKU angka terbaca utuh');
        $this->assertSame(DataType::TYPE_STRING, $c2->getDataType(), 'SKU angka disimpan sebagai teks');
        $this->assertSame('@', $c2->getStyle()->getNumberFormat()->getFormatCode());

        // Nilai yang memang angka tetap angka supaya import tetap jalan.
        $this->assertSame(DataType::TYPE_NUMERIC, $sheet->getCell('A2')->getDataType(), 'id_key tetap angka');
    }

    public function test_baca_ulang_seperti_cara_importer(): void
    {
        Excel::store(new CorrectionFileExport($this->rows()), 'koreksi_uji2.xlsx', 'imports');
        $path = Storage::disk('imports')->path('koreksi_uji2.xlsx');

        // Excel::toArray memakai reader yang sama dengan jalur import.
        $sheetRows = Excel::toArray(new class implements \Maatwebsite\Excel\Concerns\ToArray
        {
            public function array(array $array) {}
        }, $path);

        $flat = $sheetRows[0] ?? [];
        $header = $flat[0] ?? [];
        $data = array_slice($flat, 1);
        $idx = array_flip($header);

        $this->assertSame('90012345678', (string) $data[0][$idx['variant_sku']]);
        $this->assertSame('081234567890', (string) $data[1][$idx['variant_sku']]);
        $this->assertSame('9870000', (string) $data[0][$idx['price']]);
    }
}
