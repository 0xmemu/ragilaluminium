<?php

/**
 * Probe audit: cari nilai IDENTITAS yang ditulis sebagai ANGKA di seluruh
 * export Ragil (penyebab notasi ilmiah 2,01719E+11 dan digit dibulatkan).
 *
 * Cara pakai (di /root/ragilaluminium, sebagai www-data):
 *   php scripts/xlsx-identity-column-audit.php
 *
 * Yang dilakukan:
 *   1. Hasilkan SETIAP export dengan data produksi nyata ke storage/app/private/audit/.
 *   2. Baca balik tiap berkas, periksa setiap sel.
 *   3. Laporkan tiga tingkat temuan:
 *        DIGIT HILANG  : angka 15+ digit (digit terakhir dibulatkan = nomor SALAH)
 *        NOTASI ILMIAH : angka 11-14 digit (tampil 2,01719E+11)
 *        KOLOM CAMPUR  : satu kolom identitas bercampur teks dan angka
 *
 * Kenapa ambangnya 11 digit: PhpSpreadsheet DefaultValueBinder mengubah
 * string angka menjadi angka KECUALI dua kasus (lihat dataTypeForValue):
 *   - berawalan 0 (mis. '081234567890')      -> tetap TEKS (aman)
 *   - lebih besar dari PHP_INT_MAX (19 digit) -> tetap TEKS (aman)
 * Sisanya (11-18 digit) menjadi ANGKA. Presisi float aman sampai 2^53
 * (16 digit), jadi 16-18 digit berisiko digit terakhir dibulatkan.
 *
 * Karena string berawalan 0 AMAN, data uji yang memakai nomor berawalan 0
 * tidak akan menangkap bug ini. Ambil nilai nyata dari DB saat menulis test.
 */

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Customer;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\Product;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;

$auditDir = storage_path('app/private/audit');
@mkdir($auditDir, 0775, true);

/** Exporter yang bisa dibuat langsung dari query model. */
$jobs = [
    'order' => fn () => new \App\Exports\OrderExport(Order::query()),
    'customer' => fn () => new \App\Exports\CustomerExport(Customer::query()),
    'produk' => fn () => new \App\Exports\ProductExport(Product::query()),
    'produk_lengkap' => fn () => new \App\Exports\ProductExportFullUpdateSheet(Product::query()),
    'produk_harga' => fn () => new \App\Exports\ProductExportUpdatePriceStockSheet(Product::query()),
    'template_katalog' => fn () => new \App\Exports\CatalogTemplateExport(),
    'template_harga' => fn () => new \App\Exports\StockPriceTemplateExport(),
    'template_media' => fn () => new \App\Exports\MediaUpdateTemplateExport(),
    'log_aktivitas' => fn () => new \App\Exports\ActivityLogExport(EventLog::query()->limit(200)->get()),
];

// Export Performa Toko butuh payload lengkap dari service + rincian baris.
try {
    $svc = app(\App\Services\StorePerformanceService::class);
    $payload = $svc->build(period: 'last_30');
    $payload['income_detail'] = \App\Support\IncomeDetailQuery::orders(
        $payload['range']['from_date_iso'], $payload['range']['to_date_iso']
    );
    $payload['sold_items'] = \App\Support\IncomeDetailQuery::items(
        $payload['range']['from_date_iso'], $payload['range']['to_date_iso']
    );
    $jobs['performa'] = fn () => new \App\Exports\StorePerformanceExport($payload);
} catch (\Throwable $e) {
    fwrite(STDERR, 'Lewati performa: '.$e->getMessage().PHP_EOL);
}

// Berkas koreksi import butuh baris gagal; pakai bentuk data asli
// (nomor tanpa awalan 0, SKU angka panjang) supaya bug-nya terlihat.
try {
    $jobs['koreksi'] = fn () => new \App\Exports\CorrectionFileExport(collect([
        (object) [
            'raw_data' => [
                'id_key' => 1,
                'variant_sku' => '90012345678',
                'product_name' => 'Produk Uji',
                'price' => '9870000',
            ],
            'error_reason' => 'Kategori tidak dikenal',
        ],
    ]));
} catch (\Throwable $e) {
    fwrite(STDERR, 'Lewati koreksi: '.$e->getMessage().PHP_EOL);
}

echo "Menghasilkan berkas...\n";
foreach ($jobs as $name => $make) {
    try {
        Excel::store($make(), "audit/{$name}.xlsx", 'local');
        printf("  OK    %-18s %d bytes\n", $name, filesize("{$auditDir}/{$name}.xlsx"));
    } catch (\Throwable $e) {
        printf("  GAGAL %-18s %s\n", $name, substr($e->getMessage(), 0, 120));
    }
}

/** Nilai yang bentuknya identitas: murni digit (boleh berawalan 0). */
function looksLikeIdentifier(?string $v): bool
{
    if ($v === null) {
        return false;
    }
    $t = trim($v);
    if ($t === '' || ! preg_match('/^\+?[0-9][0-9\-\s]*$/', $t)) {
        return false;
    }

    return strlen(preg_replace('/\D/', '', $t)) >= 6;
}

echo "\nAudit sel per sel...\n";
$totals = ['hilang' => 0, 'ilmiah' => 0, 'campur' => 0];
$files = glob("{$auditDir}/*.xlsx");
sort($files);

foreach ($files as $path) {
    $name = basename($path, '.xlsx');
    $ss = IOFactory::load($path);
    $findings = [];

    foreach ($ss->getSheetNames() as $sheetName) {
        $sheet = $ss->getSheetByName($sheetName);
        $maxRow = $sheet->getHighestRow();
        $maxCol = Coordinate::columnIndexFromString($sheet->getHighestColumn());

        for ($c = 1; $c <= $maxCol; $c++) {
            $letter = Coordinate::stringFromColumnIndex($c);
            $numRows = [];
            $idTextRows = [];

            for ($r = 1; $r <= $maxRow; $r++) {
                $cell = $sheet->getCellByColumnAndRow($c, $r);
                $v = $cell->getValue();
                if ($v === null || $v === '') {
                    continue;
                }

                if ($cell->getDataType() === 'n' && is_numeric($v)) {
                    $numRows[$r] = $v;
                } elseif (looksLikeIdentifier((string) $v)) {
                    $idTextRows[$r] = (string) $v;
                }
            }

            foreach ($numRows as $r => $v) {
                $fmt = $sheet->getCellByColumnAndRow($c, $r)->getStyle()->getNumberFormat()->getFormatCode();
                $digits = strlen((string) (int) $v);
                if ($digits >= 15) {
                    $findings[] = ['level' => 'hilang', 'msg' => sprintf(
                        '%s!%s%d = %s (%d digit) fmt=%s', $sheetName, $letter, $r, $v, $digits, $fmt
                    )];
                } elseif ($digits >= 11) {
                    $findings[] = ['level' => 'ilmiah', 'msg' => sprintf(
                        '%s!%s%d = %s (%d digit) fmt=%s', $sheetName, $letter, $r, $v, $digits, $fmt
                    )];
                }
            }

            if ($idTextRows !== [] && $numRows !== []) {
                $findings[] = ['level' => 'campur', 'msg' => sprintf(
                    '%s!%s: %d sel teks (%s) + %d sel angka (%s)',
                    $sheetName, $letter, count($idTextRows), reset($idTextRows),
                    count($numRows), reset($numRows)
                )];
            }
        }
    }

    foreach ($findings as $f) {
        $totals[$f['level']]++;
    }

    echo "\n### {$name}: ".count($findings)." temuan\n";
    $byLevel = [];
    foreach ($findings as $f) {
        $byLevel[$f['level']][] = $f['msg'];
    }
    foreach (['hilang', 'ilmiah', 'campur'] as $lvl) {
        if (! isset($byLevel[$lvl])) {
            continue;
        }
        echo '  ['.strtoupper($lvl).'] '.count($byLevel[$lvl])."x\n";
        foreach (array_slice($byLevel[$lvl], 0, 8) as $m) {
            echo "     {$m}\n";
        }
        if (count($byLevel[$lvl]) > 8) {
            echo '     ... dan '.(count($byLevel[$lvl]) - 8)." lagi\n";
        }
    }
}

echo "\n".str_repeat('=', 78)."\n";
echo "RINGKASAN: digit hilang={$totals['hilang']}, notasi ilmiah={$totals['ilmiah']}, kolom campur={$totals['campur']}\n";
echo "Target: 0 / 0 / 0.\n";
