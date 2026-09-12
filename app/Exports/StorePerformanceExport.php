<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Support\ExportSafety;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithStrictNullComparison;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Table;
use PhpOffice\PhpSpreadsheet\Worksheet\Table\Column as TableColumn;

/**
 * Laporan Performa Toko XLSX, arsitektur workbook (2026-09-11, arah owner):
 *   1. Ringkasan Finansial - P&L bertingkat + Arus Kas SAJA. Angka pendapatan
 *      dan beban adalah RUMUS SUM/SUMIFS yang menunjuk TabelPesanan, jadi
 *      bila admin mengoreksi satu sel di tabel, P&L ikut berubah.
 *   2. KPI Operasional Toko - metrik e-commerce (penjualan, kunjungan,
 *      operasional) yang dulu menumpuk di bawah P&L (baris 31-75).
 *   3. Tabel Pesanan - 1 baris = 1 pesanan, Format Table (Ctrl+T) dengan
 *      Total Row bawaan Excel (SUBTOTAL, bukan baris data JUMLAH).
 *   4. Tabel Item - 1 baris = 1 item; Subtotal Baris = rumus Harga*Jumlah
 *      (verifikasi basis data: line_subtotal = unit_price x quantity).
 *   5. Analisis - agregat yang TIDAK bisa diturunkan dari dua tabel
 *      (kunjungan produk, pelanggan, retur). Dihubungkan dengan SUMIFS ke
 *      TabelPesanan/TabelItem; pivot asli tidak didukung pustaka penulis.
 *   6. Panduan - aturan baca, definisi, format angka.
 *
 * PENTING: baris pemisah antarblok wajib ditulis [""] (satu sel kosong),
 * BUKAN array kosong []. Maatwebsite membuang [] saat menulis sehingga
 * seluruh nomor baris styling bergeser (insiden 2026-09-11).
 *
 * PENTING (tabel): override afterSheet pada sheet bertabel WAJIB memanggil
 * parent::afterSheet($event) di AKHIR method. Loop addTable milik basis
 * membaca $this->excelTables; dipanggil di awal membuat tabel tidak pernah
 * tertulis di berkas (insiden 2026-09-11).
 */
class StorePerformanceExport implements WithMultipleSheets
{
    public function __construct(protected array $payload, protected ?string $sheetSuffix = null)
    {
    }

    public function sheets(): array
    {
        return [
            new StorePerformanceSummarySheet($this->payload, $this->sheetSuffix),
            new StorePerformanceKpiSheet($this->payload, $this->sheetSuffix),
            new StorePerformanceOrdersSheet($this->payload, $this->sheetSuffix),
            new StorePerformanceSoldItemsSheet($this->payload, $this->sheetSuffix),
            new StorePerformanceAnalysisSheet($this->payload, $this->sheetSuffix),
            new StorePerformanceGuideSheet($this->payload, $this->sheetSuffix),
        ];
    }
}

/**
 * Basis sheet tabel datar: styling RagilStyledExport (header merah baris 1,
 * border, zebra, freeze, autofilter) + format angka per sel.
 */
abstract class StorePerformanceTableSheet extends RagilStyledExport implements FromArray, WithTitle, WithStrictNullComparison
{
    /** @var list<array{0: int, 1: int, 2: string}> [baris, indeks kolom, format] */
    protected array $numberCells = [];

    protected bool $useTableHeader = true;

    /** @var list<int> Baris judul besar laporan. */
    protected array $titleRows = [];

    /** @var list<int> Baris anak judul (nama toko, periode). */
    protected array $subtitleRows = [];

    /** @var list<int> Baris judul kelompok. */
    protected array $groupRows = [];

    /** @var list<int> Baris penanda kolom pada laporan bertingkat. */
    protected array $columnLabelRows = [];

    /** @var list<int> Baris subtotal. */
    protected array $totalRows = [];

    /** @var list<int> Baris hasil akhir. */
    protected array $grandTotalRows = [];

    /** @var list<int> Baris catatan kecil. */
    protected array $noteRows = [];

    /** @var list<array{0: int, 1: string}> Baris judul blok di dalam sheet tabel. */
    protected array $blockTitleRows = [];

    /** @var array<string, Table> Tabel Excel yang dipasang di afterSheet. */
    protected array $excelTables = [];

    public function __construct(protected array $payload, protected ?string $sheetSuffix = null)
    {
        $this->currencyFormat = '#,##0';
        $this->configure();
        if ($this->sheetSuffix !== null && $this->sheetSuffix !== '') {
            $this->sheetTitle = $this->sheetTitle.' ('.$this->sheetSuffix.')';
        }
    }

    abstract protected function configure(): void;

    abstract protected function buildRows(): array;

    public function array(): array
    {
        return $this->buildRows();
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        if ($this->useTableHeader) {
            parent::afterSheet($event);
        } else {
            $sheet->setShowGridlines(false);
            foreach ($this->columnWidths as $col => $width) {
                $sheet->getColumnDimension($col)->setWidth($width);
            }
        }

        foreach ($this->numberCells as [$rowNum, $colIdx, $fmt]) {
            $coord = $this->cellCoord($rowNum, $colIdx);
            $sheet->getStyle($coord)->getNumberFormat()->setFormatCode($fmt);
            $sheet->getStyle($coord)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }

        // Sheet ini tidak memanggil parent::afterSheet, jadi sel identitas
        // (nomor HP pelanggan) diterapkan di sini.
        $this->applyTextCells($sheet, $sheet->getHighestRow());

        // Pasang Excel Table (Format Table / Ctrl+T) setelah autofilter
        // milik basis; Table membawa autofilter dan Total Row sendiri.
        foreach ($this->excelTables as $table) {
            $sheet->addTable($table);
        }

        $this->styleReportRows($sheet);
    }

    protected function styleReportRows($sheet): void
    {
        foreach ($this->titleRows as $row) {
            $sheet->getStyle('B'.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
            ]);
            $sheet->getRowDimension($row)->setRowHeight(24);
        }

        foreach ($this->subtitleRows as $row) {
            $sheet->getStyle('B'.$row)->applyFromArray([
                'font' => ['size' => 10, 'color' => ['argb' => 'FF666666']],
            ]);
        }

        foreach ($this->columnLabelRows as $row) {
            $sheet->getStyle('B'.$row.':E'.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
                'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getStyle('C'.$row.':E'.$row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
            $sheet->getRowDimension($row)->setRowHeight(20);
        }

        foreach ($this->groupRows as $row) {
            $sheet->getStyle('B'.$row.':E'.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FFC20000']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF7F8F7']],
            ]);
        }

        foreach ($this->totalRows as $row) {
            $sheet->getStyle('B'.$row.':E'.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10],
                'borders' => ['top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
            ]);
        }

        foreach ($this->grandTotalRows as $row) {
            $sheet->getStyle('B'.$row.':E'.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF121212']],
                'borders' => [
                    'top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF121212']],
                    'bottom' => ['borderStyle' => Border::BORDER_DOUBLE, 'color' => ['argb' => 'FF121212']],
                ],
            ]);
        }

        foreach ($this->noteRows as $row) {
            $sheet->getStyle('B'.$row)->applyFromArray([
                'font' => ['italic' => true, 'size' => 9, 'color' => ['argb' => 'FF666666']],
            ]);
        }

        foreach ($this->blockTitleRows as [$row, $lastCol]) {
            $sheet->getStyle('A'.$row.':'.$lastCol.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FFC20000']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF7F8F7']],
            ]);
            $sheet->getRowDimension($row)->setRowHeight(20);
        }
    }

    protected function registerNumber(int $rowNum, int $colIdx, string $fmt): void
    {
        $this->numberCells[] = [$rowNum, $colIdx, $fmt];
    }

    protected function orderStatusLabel(?string $status): string
    {
        return [
            'awaiting_confirmation' => 'Menunggu konfirmasi',
            'processing' => 'Diproses',
            'shipped' => 'Dikirim',
            'delivered' => 'Sampai tujuan',
            'completed' => 'Selesai',
            'cancelled' => 'Dibatalkan',
            'issue' => 'Perlu perhatian',
            'returned' => 'Diretur',
        ][$status ?? ''] ?? ($status ?? '-');
    }

    protected function paymentStatusLabel(?string $status): string
    {
        return [
            'pending' => 'Belum dibayar',
            'paid' => 'Lunas',
            'partial' => 'Dibayar sebagian',
            'refunded' => 'Dikembalikan',
            'failed' => 'Gagal',
            'expired' => 'Kedaluwarsa',
        ][$status ?? ''] ?? ($status ?? '-');
    }

    protected function paymentMethodLabel(?string $method): string
    {
        return [
            'cod' => 'COD',
            'transfer' => 'Transfer bank',
            'bank_transfer' => 'Transfer bank',
        ][$method ?? ''] ?? ($method ?? '-');
    }

    protected function kpiNumberFormat(string $kpiFormat): string
    {
        return match ($kpiFormat) {
            'percent' => '0.00"%"',
            'hours' => '0.00" jam"',
            'days' => '0.0" hari"',
            default => '#,##0',
        };
    }

    /**
     * Rumus total baris tabel sebagai string Excel, dipakai oleh sel Total
     * Row dan Ringkasan Finansial. SUBTOTAL(109) menjumlah hanya sel yang
     * terlihat, jadi ikut benar saat admin memfilter tabel.
     */
    protected static function subtotal(string $range): string
    {
        return '=SUBTOTAL(109,'.$range.')';
    }

    /**
     * Nama Excel Table harus unik per workbook. Export multi-bulan
     * menulis set sheet per bulan dalam SATU file, jadi nama tabel
     * wajib diberi akhiran bulan (TabelPesanan_Agt2026). Tanpa itu
     * Excel menolak berkas dengan dialog repair.
     */
    protected function tableName(string $base): string
    {
        $suffix = preg_replace('/[^A-Za-z0-9]/', '', (string) $this->sheetSuffix);

        return $suffix !== '' ? $base.'_'.$suffix : $base;
    }
}

// ------ 1. RINGKASAN FINANSIAL (P&L + Arus Kas, angka berumus) ------

/**
 * Sheet Ringkasan Finansial. Hanya P&L dan Arus Kas; KPI operasional
 * dipindah ke sheet sendiri (KPI Operasional Toko) agar pembacaan
 * manajemen fokus. Angka pendapatan/beban adalah rumus SUMIFS yang
 * menunjuk TabelPesanan (sheet Tabel Pesanan), bukan angka mati:
 *   Nilai produk   = SUM(TabelPesanan[Nilai Produk Terjual])
 *   Voucher        = -SUM(TabelPesanan[Voucher])
 *   dst.
 * Rumus menunjuk kolom terstruktur, jadi tetap benar bila admin menambah
 * atau memfilter baris tabel.
 */
class StorePerformanceSummarySheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Ringkasan Finansial';
        $this->columnWidths = ['A' => 4, 'B' => 40, 'C' => 20, 'D' => 20, 'E' => 18];
        $this->useTableHeader = false;
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $fin = $this->payload['financial'] ?? [];
        $range = $this->payload['range'] ?? [];
        $num = static fn ($v) => (float) ($v ?? 0);

        $rows = [];
        $r = 1;

        $push = function (array $row) use (&$rows, &$r): int {
            $rows[] = $row;
            $current = $r;
            $r++;

            return $current;
        };

        // Rumus SUM kolom terstruktur TabelPesanan (sheet Tabel Pesanan).
        // Kolom P&L ditulis sebagai formula agar hidup mengikuti tabel.
        // Nama tabel ikut suffix bulan (workbook multi-bulan punya tabel
        // per bulan dengan nama unik).
        $tableName = $this->tableName('TabelPesanan');
        $sum = static fn (string $col) => '=SUM('.$tableName.'['.$col.'])';

        // Kepala laporan.
        $push(['', 'LAPORAN LABA RUGI TOKO', '', '', '']);
        $this->titleRows[] = $r - 1;
        $push(['', 'Ragil Aluminium', '', '', '']);
        $this->subtitleRows[] = $r - 1;
        $push(['', 'Periode: '.($range['from_date'] ?? '-').' sampai '.($range['to_date'] ?? '-'), '', '', '']);
        $this->subtitleRows[] = $r - 1;
        $push([""]);

        // Judul kolom laporan (bukan header tabel, hanya penanda kolom).
        $head = $push(['', 'Keterangan', 'Periode Ini', 'Periode Sebelumnya', 'Perubahan']);
        $this->columnLabelRows[] = $head;

        // Baris keuangan: kolom C berisi rumus, D dan E kosong (nilai
        // pembanding per komponen tidak tersedia dari payload).
        $moneyF = function (string $label, string $formula, int $indent = 0, bool $isTotal = false) use ($push, $guard, &$r) {
            $prefix = str_repeat('    ', $indent);
            $line = $push(['', $guard($prefix.$label), $formula, '', '']);
            $this->registerNumber($line, 3, '#,##0');
            if ($isTotal) {
                $this->totalRows[] = $line;
            }

            return $line;
        };

        // Baris arus kas tetap angka dari payload (data pembayaran bukan
        // kolom tabel pesanan).
        $money = function (string $label, $value, int $indent = 0, bool $isTotal = false) use ($push, $guard, $num, &$r) {
            $prefix = str_repeat('    ', $indent);
            $line = $push(['', $guard($prefix.$label), $num($value), '', '']);
            $this->registerNumber($line, 3, '#,##0');
            if ($isTotal) {
                $this->totalRows[] = $line;
            }

            return $line;
        };

        // Bulan tanpa satu pun baris pesanan tidak membuat Excel Table,
        // sehingga rumus kolom terstruktur akan menjadi nama yang menggantung
        // (#NAME?). Untuk keadaan itu angka diambil dari payload (nol).
        $hasRows = ($this->payload['income_detail'] ?? []) !== [];
        $moneyRow = function (string $label, string $formula, $static, int $indent = 1) use ($hasRows, $moneyF, $money) {
            return $hasRows
                ? $moneyF($label, $formula, $indent)
                : $money($label, $static, $indent);
        };

        // ---- PENDAPATAN (rumus -> TabelPesanan) ----
        $push(['', 'PENDAPATAN', '', '', '']);
        $this->groupRows[] = $r - 1;

        $rowNilai = $moneyRow('Nilai produk terjual', $sum('Nilai Produk Terjual'), $fin['items_before_discount'] ?? null);
        // Kolom Voucher di tabel sudah negatif; jangan dibalik lagi.
        $rowVoucher = $moneyRow('Potongan voucher', $sum('Voucher'), -1 * $num($fin['voucher_discount'] ?? 0));
        $rowOngkir = $moneyRow('Ongkir dibayar pelanggan', $sum('Ongkir Dibayar Pelanggan'), $fin['shipping_paid_by_customer'] ?? null);
        $rowAsuransi = $moneyRow('Asuransi dibayar pelanggan', $sum('Asuransi'), $fin['insurance'] ?? null);
        $rowCod = $moneyRow('Biaya COD dibayar pelanggan', $sum('Biaya COD'), $fin['cod_fee'] ?? null);
        $rowTotalDibayar = $push(['', 'TOTAL DIBAYAR PEMBELI', '=SUM(C'.$rowNilai.':C'.$rowCod.')', '', '']);
        $this->totalRows[] = $rowTotalDibayar;
        $this->registerNumber($rowTotalDibayar, 3, '#,##0');
        $this->noteRows[] = $push(['', '    Angka pada kolom Periode Ini berupa rumus yang menunjuk Tabel Pesanan. Koreksi nilai di tabel akan mengubah laporan ini.', '', '', '']);
        $push([""]);

        // ---- BEBAN (rumus -> TabelPesanan) ----
        $push(['', 'BEBAN YANG DITANGGUNG TOKO', '', '', '']);
        $this->groupRows[] = $r - 1;

        // Tiga kolom beban di tabel sudah bernilai negatif.
        $rowOngkirJnt = $moneyRow('Ongkir dibayarkan ke J&T', $sum('Ongkir ke J&T'), -1 * $num($fin['shipping_raw'] ?? 0));
        // Kolom Biaya COD positif (uang diterima pembeli), jadi beban
        // ke J&T memang dibalik di sini.
        $rowCodJnt = $moneyRow('Biaya COD diteruskan ke J&T', '-'.$sum('Biaya COD'), -1 * $num($fin['cod_fee'] ?? 0));
        $rowRefund = $moneyRow('Refund retur', $sum('Refund Retur'), -1 * $num($fin['refund_adjustments'] ?? 0));
        $rowRetShip = $moneyRow('Ongkir retur ditanggung toko', $sum('Ongkir Retur Toko'), -1 * $num($fin['return_shipping_store'] ?? 0));
        $rowBeban = $push(['', 'Jumlah beban toko', '=SUM(C'.$rowOngkirJnt.':C'.$rowRetShip.')', '', '']);
        $this->totalRows[] = $rowBeban;
        $this->registerNumber($rowBeban, 3, '#,##0');
        $push([""]);

        // ---- HASIL ----
        $push(['', 'HASIL', '', '', '']);
        $this->groupRows[] = $r - 1;
        // Penjualan bersih = total dibayar + jumlah beban (beban sudah negatif).
        // Referensi WAJIB baris Jumlah beban yang ditangkap di atas; kalkulasi
        // offset manual ($r-2) pernah menunjuk baris pemisah kosong.
        $push(['', 'PENJUALAN BERSIH', '=C'.$rowTotalDibayar.'+C'.$rowBeban, '', '']);
        $this->grandTotalRows[] = $r - 1;
        $this->registerNumber($r - 1, 3, '#,##0');
        $this->noteRows[] = $push(['', '    Catatan: subsidi ongkir sudah termasuk dalam Ongkir ke J&T, tidak dikurangkan dua kali.', '', '', '']);
        $push([""]);

        // ---- ARUS KAS (angka payload: sumbernya pembayaran, bukan tabel) ----
        $push(['', 'ARUS KAS', '', '', '']);
        $this->groupRows[] = $r - 1;
        $money('Transfer bank sudah cair', max($num($fin['payments_received'] ?? 0) - $num($fin['cod_paid'] ?? 0), 0.0), 1);
        $money('COD sudah cair', $fin['cod_paid'] ?? null, 1);
        $money('Pembayaran sudah diterima', $fin['payments_received'] ?? null, 0, true);
        $money('COD (barang belum sampai), '.(int) ($fin['cod_pending_count'] ?? 0).' pesanan', $fin['cod_pending_amount'] ?? null, 1);
        $push([""]);

        return $rows;
    }
}

// ------ 2. KPI OPERASIONAL TOKO (dipisah dari P&L) ------

/**
 * Metrik e-commerce yang dulu menumpuk di baris 31-75 sheet Laba Rugi:
 * penjualan, kunjungan, operasional, pembayaran, retur dan pembatalan.
 * Format sama dengan P&L (kolom C nilai, D pembanding, E perubahan).
 */
class StorePerformanceKpiSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'KPI Operasional Toko';
        $this->columnWidths = ['A' => 4, 'B' => 40, 'C' => 20, 'D' => 20, 'E' => 18];
        $this->useTableHeader = false;
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $range = $this->payload['range'] ?? [];

        $rows = [];
        $r = 1;

        $push = function (array $row) use (&$rows, &$r): int {
            $rows[] = $row;
            $current = $r;
            $r++;

            return $current;
        };

        $push(['', 'KPI OPERASIONAL TOKO', '', '', '']);
        $this->titleRows[] = $r - 1;
        $push(['', 'Periode: '.($range['from_date'] ?? '-').' sampai '.($range['to_date'] ?? '-'), '', '', '']);
        $this->subtitleRows[] = $r - 1;
        $push([""]);

        $head = $push(['', 'Keterangan', 'Periode Ini', 'Periode Sebelumnya', 'Perubahan']);
        $this->columnLabelRows[] = $head;

        $prevHasData = (bool) ($this->payload['previous_has_data'] ?? true);
        $prevText = 'Tidak ada data';

        foreach ($this->payload['sections'] ?? [] as $section) {
            $push(['', mb_strtoupper((string) ($section['title'] ?? 'RINCIAN')), '', '', '']);
            $this->groupRows[] = $r - 1;

            foreach ($section['kpis'] as $kpi) {
                $change = $kpi['change_percent'];
                $fmt = $this->kpiNumberFormat((string) ($kpi['format'] ?? 'number'));

                $row = [
                    '',
                    $guard('    '.$kpi['label']),
                    $guard($kpi['value'] ?? 0),
                    $prevHasData ? $guard($kpi['previous'] ?? 0) : $prevText,
                    ! $prevHasData ? '' : ($change === null ? 'Baru pada periode ini' : $guard($change)),
                ];
                $line = $push($row);
                $this->registerNumber($line, 3, $fmt);
                if ($prevHasData) {
                    $this->registerNumber($line, 4, $fmt);
                    if ($change !== null) {
                        $this->registerNumber($line, 5, '0.0"%"');
                    }
                }
            }
            $push([""]);
        }

        return $rows;
    }
}

// ------ 3. TABEL PESANAN (Excel Table + Total Row) ------

/**
 * 1 baris = 1 pesanan. Dibungkus Excel Table "TabelPesanan" (sama dengan
 * Format Table / Ctrl+T): Total Row bawaan Excel berisi SUBTOTAL sehingga
 * baris total bukan baris data (bisa disembunyikan, ikut filter), kolom
 * Penjualan Bersih berisi rumus sel per baris. Nama kolom:
 *   - "Total Qty (Pcs)" menggantikan "Jumlah Item" (rancu dengan jenis).
 *   - "Jumlah Jenis SKU" = banyak SKU unik dalam pesanan.
 */
class StorePerformanceOrdersSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Tabel Pesanan';
        $this->skipSheetAutoFilter = true;
        $this->columnWidths = [
            'A' => 16, 'B' => 18, 'C' => 18, 'D' => 12, 'E' => 16,
            'F' => 16, 'G' => 14, 'H' => 17, 'I' => 18, 'J' => 15,
            'K' => 16, 'L' => 12, 'M' => 15, 'N' => 19, 'O' => 17,
            'P' => 15, 'Q' => 14, 'R' => 16, 'S' => 17, 'T' => 15,
            'U' => 30,
        ];
    }

    /** Header kolom tabel pesanan (dipakai sheet ini dan Ringkasan Finansial). */
    public static function headers(): array
    {
        return [
            'Nomor Pesanan', 'Tanggal Pesanan', 'Tanggal Dibayar', 'Metode',
            'Status Pesanan', 'Status Pembayaran', 'Total Qty (Pcs)',
            'Jumlah Jenis SKU',
            'Nilai Produk Terjual', 'Voucher',
            'Ongkir Dibayar Pelanggan', 'Asuransi', 'Biaya COD',
            'Total Dibayar Pembeli',
            'Ongkir ke J&T', 'Refund Retur', 'Ongkir Retur Toko',
            'Penjualan Bersih',
            'Uang Sudah Masuk', 'Belum Cair',
            'Subsidi Ongkir Toko', 'Hemat Pembeli vs Harga Normal',
        ];
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $num = static fn ($v) => (float) ($v ?? 0);
        $rows = [$this->headers()];
        $r = 2;

        $dataRows = $this->payload['income_detail'] ?? [];

        foreach ($dataRows as $row) {
            $paidAt = $row['paid_at'] ?? null;

            $out = [
                $guard($row['order_number'] ?? '-'),
                $guard($this->formatWib($row['created_at'] ?? null, 'j M Y H:i')),
                $paidAt ? $guard($this->formatWib($paidAt, 'j M Y H:i')) : '',
                $guard($this->paymentMethodLabel($row['payment_method'] ?? null)),
                $guard($this->orderStatusLabel($row['order_status'] ?? null)),
                $guard($this->paymentStatusLabel($row['payment_status'] ?? null)),
                (int) ($row['total_qty'] ?? 0),
                (int) ($row['sku_count'] ?? 0),
                $num($row['subtotal_before_discount'] ?? 0),
                -1 * $num($row['voucher_discount'] ?? 0),
                $num($row['shipping_net_paid_by_customer'] ?? 0),
                $num($row['insurance'] ?? 0),
                $num($row['cod_fee'] ?? 0),
                $num($row['total_paid_by_customer'] ?? 0),
                -1 * $num($row['shipping_raw'] ?? 0),
                -1 * $num($row['refund_amount'] ?? 0),
                -1 * $num($row['return_shipping_store'] ?? 0),
                // Penjualan Bersih per baris = rumus alur uang. Kolom O, P, Q
                // sudah negatif; kolom M (Biaya COD, positif) dikurangkan.
                '=N{r}-M{r}+O{r}+P{r}+Q{r}',
                $num($row['paid_amount'] ?? 0),
                $num($row['outstanding'] ?? 0),
                $num($row['shipping_subsidy'] ?? 0),
                $num($row['discount'] ?? 0),
            ];

            $rows[] = $out;
            for ($c = 7; $c <= 22; $c++) {
                $this->registerNumber($r, $c, '#,##0');
            }
            $this->trackZeroCells($out, $r);
            $r++;
        }

        return $rows;
    }

    public function afterSheet(AfterSheet $event): void
    {
        // parent::afterSheet() WAJIB dipanggil di AKHIR override: loop
        // addTable milik basis membaca $this->excelTables. Dipanggil di
        // awal membuat tabel tidak pernah terpasang (insiden 2026-09-11).
        $sheet = $event->sheet->getDelegate();
        $count = count($this->payload['income_detail'] ?? []);

        if ($count === 0) {
            return;
        }

        // Ganti placeholder {r} pada rumus Penjualan Bersih per baris.
        for ($i = 0; $i < $count; $i++) {
            $rowNum = 2 + $i;
            $sheet->setCellValue(
                'R'.$rowNum,
                str_replace(
                    '{r}',
                    (string) $rowNum,
                    '=N{r}-M{r}+O{r}+P{r}+Q{r}'
                )
            );
        }

        // Baris total: label + rumus SUBTOTAL (Total Row bawaan Excel),
        // lalu Excel Table membungkus seluruh rentang termasuk baris total.
        $totalRow = 2 + $count;
        $sheet->setCellValue('A'.$totalRow, 'JUMLAH');
        $sumCols = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V'];
        foreach ($sumCols as $col) {
            $sheet->setCellValue($col.$totalRow, '=SUBTOTAL(109,'.$col.'2:'.$col.($totalRow - 1).')');
        }
        foreach ($sumCols as $i => $col) {
            $this->registerNumber($totalRow, $i + 7, '#,##0');
        }

        // Excel Table: rentang A1:V{totalRow}, Total Row dihidupkan lewat
        // XML (setShowTotalsRow). Kolom uang diberi totalsRowFunction=sum.
        $lastCol = 'V';
        $table = new Table('A1:'.$lastCol.$totalRow, $this->tableName('TabelPesanan'));
        $table->setShowTotalsRow(true);

        foreach (range('A', 'V') as $colLetter) {
            $c = new TableColumn($colLetter, $table);
            if (in_array($colLetter, $sumCols, true)) {
                $c->setTotalsRowFunction('sum');
            }
            $table->setColumn($c);
        }
        $this->excelTables[] = $table;

        parent::afterSheet($event);
    }
}

// ------ 4. TABEL ITEM (Excel Table + rumus baris) ------

/**
 * 1 baris = 1 item pesanan. Subtotal Baris = rumus Harga Satuan * Jumlah
 * (konsisten dengan snapshot: line_subtotal = unit_price x quantity),
 * dibungkus Excel Table "TabelItem" dengan Total Row SUBTOTAL.
 */
class StorePerformanceSoldItemsSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Tabel Item';
        $this->skipSheetAutoFilter = true;
        $this->columnWidths = [
            'A' => 16, 'B' => 17, 'C' => 14, 'D' => 34, 'E' => 18,
            'F' => 16, 'G' => 12, 'H' => 14, 'I' => 14,
        ];
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $rows = [
            ['Nomor Pesanan', 'Tanggal Pesanan', 'SKU Induk', 'Nama Produk',
                'Variasi', 'Harga Satuan', 'Jumlah', 'Subtotal Baris', 'Diskon Baris'],
        ];
        $r = 2;

        foreach ($this->payload['sold_items'] ?? [] as $row) {
            $out = [
                $guard($row['order_number'] ?? '-'),
                $guard($this->formatWib($row['created_at'] ?? null, 'j M Y H:i')),
                $guard($row['parent_sku'] ?? '-'),
                $guard($row['name'] ?? '-'),
                $guard($row['variation'] ?? '-'),
                $guard($row['unit_price'] ?? 0),
                $guard($row['quantity'] ?? 0),
                '=F{r}*G{r}',
                $guard($row['line_discount'] ?? 0),
            ];
            $rows[] = $out;
            for ($c = 6; $c <= 9; $c++) {
                $this->registerNumber($r, $c, '#,##0');
            }
            $this->trackZeroCells($out, $r);
            $r++;
        }

        return $rows;
    }

    public function afterSheet(AfterSheet $event): void
    {
        // parent::afterSheet() WAJIB dipanggil di AKHIR override (lihat
        // catatan pada Tabel Pesanan).
        $sheet = $event->sheet->getDelegate();
        $count = count($this->payload['sold_items'] ?? []);

        if ($count === 0) {
            return;
        }

        for ($i = 0; $i < $count; $i++) {
            $rowNum = 2 + $i;
            $sheet->setCellValue('H'.$rowNum, str_replace('{r}', (string) $rowNum, '=F{r}*G{r}'));
        }

        $totalRow = 2 + $count;
        $sheet->setCellValue('A'.$totalRow, 'JUMLAH');
        foreach (['F', 'G', 'H', 'I'] as $col) {
            $sheet->setCellValue($col.$totalRow, '=SUBTOTAL(109,'.$col.'2:'.$col.($totalRow - 1).')');
        }
        foreach (['F', 'G', 'H', 'I'] as $i => $col) {
            $this->registerNumber($totalRow, $i + 6, '#,##0');
        }

        $table = new Table('A1:I'.$totalRow, $this->tableName('TabelItem'));
        $table->setShowTotalsRow(true);
        foreach (range('A', 'I') as $colLetter) {
            $c = new TableColumn($colLetter, $table);
            if (in_array($colLetter, ['F', 'G', 'H', 'I'], true)) {
                $c->setTotalsRowFunction('sum');
            }
            if ($colLetter === 'F') {
                $c->setTotalsRowLabel('JUMLAH');
            }
            $table->setColumn($c);
        }
        $this->excelTables[] = $table;

        parent::afterSheet($event);
    }
}

// ------ 5. ANALISIS (agregat non-tabel + SUMIFS ke dua tabel) ------

/**
 * Blok yang TIDAK bisa diturunkan dari Tabel Pesanan/Tabel Item
 * (kunjungan produk, pelanggan, retur) tetap diekspor dari payload.
 * Blok yang bisa (bauran metode, produk terlaris) dihitung dengan
 * SUMIFS/COUNTIFS yang menunjuk tabel, supaya sumbernya satu.
 * Pivot Table asli tidak didukung pustaka penulis XLSX (PhpSpreadsheet
 * tidak punya API pivot); struktur data tabel tetap pivot-ready.
 */
class StorePerformanceAnalysisSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Analisis';
        $this->columnWidths = [
            'A' => 20, 'B' => 52, 'C' => 14, 'D' => 18, 'E' => 14, 'F' => 16,
        ];
        $this->useTableHeader = false;
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $rows = [];
        $r = 1;

        $push = function (array $row) use (&$rows, &$r): int {
            $rows[] = $row;
            $current = $r;
            $r++;

            return $current;
        };

        $range = $this->payload['range'] ?? [];
        $push(['ANALISIS PENJUALAN']);
        $this->titleRows[] = $r - 1;
        $rows[$r - 2][0] = 'ANALISIS PENJUALAN';
        $push(['Periode: '.($range['from_date'] ?? '-').' sampai '.($range['to_date'] ?? '-')]);
        $this->subtitleRows[] = $r - 1;
        $push([""]);

        $block = function (string $title, array $header, string $lastCol) use ($push, &$r) {
            $line = $push([$title]);
            $this->blockTitleRows[] = [$line, $lastCol];
            $push($header);
            $this->columnLabelRows[] = $r - 1;

            return $r - 1;
        };

        $money = function (int $row, array $cols) {
            foreach ($cols as $c) {
                $this->registerNumber($row, $c, '#,##0');
            }
        };

        // ---- BLOK 1: PRODUK TERLARIS (Unit Terjual via SUMIFS ke TabelItem) ----
        $block('PRODUK TERLARIS', ['SKU Induk', 'Nama Produk', 'Unit Terjual', 'Penjualan', 'Jumlah Pesanan'], 'E');
        $topAll = $this->payload['top_products'] ?? [];
        $top = array_slice($topAll, 0, 15);
        if ($top === []) {
            $push(['Tidak ada produk terjual pada periode ini.']);
            $this->noteRows[] = $r - 1;
        }
        foreach ($top as $pr) {
            $sku = (string) ($pr['parent_sku'] ?? '');
            $row = [
                $guard($sku),
                $guard($pr['name'] ?? ''),
                '=SUMIFS(' . $this->tableName('TabelItem') . '[Jumlah],' . $this->tableName('TabelItem') . '[SKU Induk],$A'.$r.')',
                $guard($pr['revenue'] ?? 0),
                '=COUNTIFS(' . $this->tableName('TabelItem') . '[SKU Induk],$A'.$r.')',
            ];
            $line = $push($row);
            $money($line, [4]);
            $this->registerNumber($line, 3, '#,##0');
            $this->registerNumber($line, 5, '#,##0');
            $this->trackZeroCells($row, $line);
        }
        if (count($topAll) > count($top)) {
            $push(['Menampilkan 15 produk teratas dari '.count($topAll).' produk yang terjual.']);
            $this->noteRows[] = $r - 1;
        }
        $push([""]);

        // ---- BLOK 2: INTERAKSI PRODUK (payload: data klik bukan kolom tabel) ----
        $block('PRODUK PALING DILIHAT', ['SKU Induk', 'Nama Produk', 'Dilihat', 'Diklik', 'Total Interaksi'], 'E');
        $viewedAll = $this->payload['product_breakdowns']['most_viewed'] ?? [];
        $viewed = array_slice($viewedAll, 0, 15);
        if ($viewed === []) {
            $push(['Belum ada data kunjungan produk pada periode ini.']);
            $this->noteRows[] = $r - 1;
        }
        foreach ($viewed as $pr) {
            $row = [
                $guard($pr['parent_sku'] ?? ''),
                $guard($pr['name'] ?? ''),
                (float) ($pr['views'] ?? 0),
                (float) ($pr['clicks'] ?? 0),
                (float) ($pr['total'] ?? 0),
            ];
            $line = $push($row);
            $money($line, [3, 4, 5]);
            $this->trackZeroCells($row, $line);
        }
        if (count($viewedAll) > count($viewed)) {
            $push(['Menampilkan 15 produk teratas dari '.count($viewedAll).' produk yang pernah dilihat.']);
            $this->noteRows[] = $r - 1;
        }
        $push([""]);

        // ---- BLOK 3: PELANGGAN (payload: gabungan beberapa pesanan) ----
        $block('PELANGGAN TERBAIK', ['Nama Pelanggan', 'Nomor HP', 'Jumlah Pesanan', 'Total Belanja', 'Pesanan Terakhir'], 'E');
        $customers = $this->payload['customers'] ?? [];
        if ($customers === []) {
            $push(['Tidak ada pelanggan pada periode ini.']);
            $this->noteRows[] = $r - 1;
        }
        foreach ($customers as $c) {
            $lastAt = $c['last_order_at'] ?? null;
            if ($lastAt !== null && $lastAt !== '' && $lastAt !== '-') {
                try {
                    $lastAt = $this->formatWib($lastAt, 'j M Y H:i');
                } catch (\Throwable) {
                    $lastAt = (string) $lastAt;
                }
            } else {
                $lastAt = '';
            }
            $row = [
                $guard($c['customer_name'] ?? ''),
                $guard($c['customer_phone'] ?? ''),
                (float) ($c['order_count'] ?? 0),
                (float) ($c['total_spent'] ?? 0),
                $guard($lastAt),
            ];
            $line = $push($row);
            $money($line, [3, 4]);
            // Nomor HP pelanggan: identitas, wajib teks.
            $this->registerTextCell($line, 2);
            $this->trackZeroCells($row, $line);
        }
        $push([""]);

        // ---- BLOK 4: BAURAN METODE (COUNTIFS/SUMIFS ke kolom Metode tabel) ----
        $block('BAURAN METODE PEMBAYARAN', ['Metode', 'Jumlah Pesanan', 'Nilai Penjualan', 'Porsi Nilai', ''], 'D');
        $methods = [
            'COD' => 'COD',
            'Transfer bank' => 'Transfer bank',
        ];
        $rowFirst = null;
        foreach ($methods as $label => $needle) {
            $row = [
                $guard($label),
                '=COUNTIFS(' . $this->tableName('TabelPesanan') . '[Metode],"'.$needle.'")',
                '=SUMIFS(' . $this->tableName('TabelPesanan') . '[Total Dibayar Pembeli],' . $this->tableName('TabelPesanan') . '[Metode],"'.$needle.'")',
                null, // porsi dihitung setelah tahu baris
            ];
            $line = $push($row);
            if ($rowFirst === null) {
                $rowFirst = $line;
            }
            $this->registerNumber($line, 2, '#,##0');
            $this->registerNumber($line, 3, '#,##0');
        }
        $rowLast = $r - 1;
        // Porsi nilai: baris ini dibagi jumlah seluruh baris blok.
        for ($rr = $rowFirst; $rr <= $rowLast; $rr++) {
            $rows[$rr - 1][3] = '=IFERROR(C'.$rr.'/SUM($C$'.$rowFirst.':$C$'.$rowLast.'),0)';
            $this->registerNumber($rr, 4, '0.00"%"');
        }
        $push([""]);

        // ---- BLOK 5: BIAYA RETUR (payload: kasus retur) ----
        $block('BIAYA RETUR DITANGGUNG TOKO', ['Nomor Pesanan', 'Tanggal Selesai', 'Pihak Penyebab', 'Alasan', 'Ongkir Retur'], 'E');
        $returns = $this->payload['return_shipping_costs'] ?? [];
        if ($returns === []) {
            $push(['Tidak ada biaya retur yang ditanggung toko pada periode ini.']);
            $this->noteRows[] = $r - 1;
        }
        foreach ($returns as $rc) {
            $completedAt = $rc['completed_at'] ?? null;
            if ($completedAt) {
                try {
                    $completedAt = $this->formatWib($completedAt, 'j M Y H:i');
                } catch (\Throwable) {
                    $completedAt = (string) $completedAt;
                }
            } else {
                $completedAt = '';
            }
            $party = [
                'store' => 'Toko',
                'customer' => 'Pembeli',
            ][$rc['fault_party'] ?? ''] ?? ($rc['fault_party'] ?? '-');
            $row = [
                $guard($rc['order_number'] ?? ($rc['order_id'] ?? '')),
                $guard($completedAt),
                $guard($party),
                $guard($rc['reason'] ?? '-'),
                (float) ($rc['return_shipping_cost'] ?? 0),
            ];
            $line = $push($row);
            $this->registerNumber($line, 5, '#,##0');
            $this->trackZeroCells($row, $line);
        }

        return $rows;
    }

    protected function styleReportRows($sheet): void
    {
        foreach ($this->titleRows as $row) {
            $sheet->getStyle('A'.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
            ]);
            $sheet->getRowDimension($row)->setRowHeight(24);
        }
        foreach ($this->subtitleRows as $row) {
            $sheet->getStyle('A'.$row)->applyFromArray([
                'font' => ['size' => 10, 'color' => ['argb' => 'FF666666']],
            ]);
        }
        foreach ($this->noteRows as $row) {
            $sheet->getStyle('A'.$row)->applyFromArray([
                'font' => ['italic' => true, 'size' => 9, 'color' => ['argb' => 'FF666666']],
            ]);
        }
        foreach ($this->columnLabelRows as $row) {
            $sheet->getStyle('A'.$row.':F'.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            ]);
            $sheet->getRowDimension($row)->setRowHeight(18);
        }

        $this->titleRows = [];
        $this->subtitleRows = [];
        $this->noteRows = [];
        $this->columnLabelRows = [];

        parent::styleReportRows($sheet);
    }
}

// ------ 6. PANDUAN ------

class StorePerformanceGuideSheet implements FromArray, WithTitle, \Maatwebsite\Excel\Concerns\WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function __construct(protected array $payload, protected ?string $sheetSuffix = null)
    {
    }

    public function array(): array
    {
        $range = $this->payload['range'] ?? [];

        return [
            ['PANDUAN LAPORAN PERFORMA TOKO', 'Ragil Aluminium'],
            ['Periode laporan: '.($range['from_date'] ?? '-').' sampai '.($range['to_date'] ?? '-')],
            [''],
            ['ISI BERKAS', 'Ringkasan Finansial = laba rugi dan arus kas; angka pendapatan dan beban berupa rumus yang menunjuk Tabel Pesanan. KPI Operasional Toko = metrik kunjungan, operasional, retur, dan pembatalan. Tabel Pesanan = 1 baris per pesanan, Format Table dengan Total Row bawaan Excel. Tabel Item = 1 baris per item, Subtotal Baris berupa rumus Harga x Jumlah. Analisis = agregat yang tidak bisa diturunkan dari dua tabel.'],
            ['CARA MEMBACA', 'Mulai dari Ringkasan Finansial. Setiap angka pendapatan dan beban adalah rumus SUM kolom Tabel Pesanan; klik selnya untuk melihat asalnya. Baris JUMLAH di kedua tabel adalah Total Row bawaan Excel: nilai ikut menyesuaikan bila tabel difilter.'],
            ['ALUR UANG', 'Nilai produk terjual dikurangi voucher, ditambah ongkir, asuransi, dan biaya COD yang dibayar pelanggan menghasilkan Total Dibayar Pembeli. Dari situ dikurangi ongkir ke J&T, biaya COD ke J&T, refund retur, dan ongkir retur toko menghasilkan Penjualan Bersih. Kolom Penjualan Bersih di Tabel Pesanan juga berupa rumus dengan urutan yang sama.'],
            ['DISKON PRODUK', 'Kolom Hemat Pembeli vs Harga Normal adalah selisih harga normal dengan harga jual, bukan pengurang tagihan. Nilai produk terjual sudah memakai harga promo yang berlaku.'],
            ['SUBSIDI ONGKIR', 'Subsidi ongkir sudah termasuk di dalam Ongkir ke J&T, jadi tidak dikurangkan lagi secara terpisah.'],
            ['ARUS KAS', 'Pembayaran sudah diterima = transfer bank cair + COD cair pada periode. Sisa COD dihitung terpisah dari pesanan yang barangnya belum sampai, karena sistem menetapkan COD lunas lewat event status pesanan tiba, bukan dari catatan pembayaran.'],
            ['PENGUNJUNG YANG MEMBELI', 'Dihitung dari jumlah pembeli unik dibagi jumlah pengunjung, bukan jumlah pesanan dibagi pengunjung.'],
            ['PERIODE PEMBANDING', 'Kolom Periode Sebelumnya di KPI Operasional membandingkan rentang sepanjang periode ini tepat sebelumnya. Bila rentang itu belum ada datanya, kolom berisi keterangan Tidak ada data.'],
            ['ANALISIS', 'Blok Produk Terlaris menghitung Unit Terjual dan Jumlah Pesanan langsung dari Tabel Item lewat SUMIFS/COUNTIFS; blok Bauran Metode menghitung dari kolom Metode Tabel Pesanan. Untuk memutar data per SKU, metode, atau status, gunakan Pivot Table di Excel dengan sumber TabelPesanan atau TabelItem; keduanya sudah berformat tabel sehingga tinggal dipilih sebagai sumber pivot.'],
            ['FORMAT ANGKA', 'Semua kolom uang berupa angka polos tanpa Rp. Sel yang memang tidak punya nilai dibiarkan kosong.'],
        ];
    }

    public function title(): string
    {
        return $this->sheetSuffix !== null && $this->sheetSuffix !== ''
            ? 'Panduan ('.$this->sheetSuffix.')'
            : 'Panduan';
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FF121212']],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF666666']],
        ]);

        $last = $sheet->getHighestRow();
        $sheet->getStyle('A4:B'.$last)->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
            'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_TOP],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        for ($r = 4; $r <= $last; $r++) {
            $sheet->getStyle('A'.$r)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FFC20000']],
            ]);
        }

        $sheet->getColumnDimension('A')->setWidth(26);
        $sheet->getColumnDimension('B')->setWidth(100);
    }
}
