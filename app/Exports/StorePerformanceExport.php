<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Support\ExportSafety;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithStrictNullComparison;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Laporan Performa Toko XLSX, desain tabel mengikuti Laporan Pesanan
 * (OrderExport): setiap sheet = SATU tabel datar (header merah #c20000,
 * zebra, freeze A2, autofilter), angka POLOS tanpa "Rp" (nilai sel tetap
 * numerik), plus sheet Panduan. Sheet:
 *   1. Laba Rugi        - laporan bertingkat gaya pembukuan: pendapatan
 *                         bruto, pengurang, penjualan bersih, lalu arus kas
 *                         dan KPI operasional. Angka dapat dijumlah menurun.
 *   2. Rincian Pesanan  - 1 baris per pesanan, header di baris 1, urutan
 *                         kolom mengikuti alur uang (nilai produk -> potongan
 *                         -> dibayar pembeli -> beban toko -> bersih -> kas).
 *   3. Rincian Item     - 1 baris per item pesanan (SKU, qty, harga).
 *   4. Analisis         - produk, pelanggan, bauran pembayaran, dan biaya
 *                         retur dalam satu sheet, tiap blok berjudul.
 *   5. Panduan          - aturan baca, definisi, format angka.
 *
 * PENTING: baris pemisah antarblok wajib ditulis [""] (satu sel kosong),
 * BUKAN array kosong []. Maatwebsite membuang [] saat menulis sehingga
 * seluruh nomor baris styling bergeser (insiden 2026-09-11).
 * Aturan format: header tabel WAJIB di baris 1 (freeze + autofilter milik
 * RagilStyledExport mengunci baris 1), jadi sheet yang butuh blok ringkasan
 * memakai layout dua kolom label-nilai tanpa header tabel, bukan menyelipkan
 * header di tengah sheet.
 */
class StorePerformanceExport implements WithMultipleSheets
{
    /**
     * @param string|null $sheetSuffix Label bulan utk export multi-bulan
     *                                 (mis. " Jan 2026") -> nama sheet unik
     *                                 per bulan dalam satu file.
     */
    public function __construct(protected array $payload, protected ?string $sheetSuffix = null)
    {
    }

    public function sheets(): array
    {
        return [
            new StorePerformanceSummarySheet($this->payload, $this->sheetSuffix),
            new StorePerformanceIncomeDetailSheet($this->payload, $this->sheetSuffix),
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

    /**
     * Sheet laporan bertingkat (Laba Rugi) tidak memakai header tabel merah
     * di baris 1, sehingga freeze pane dan autofilter milik RagilStyledExport
     * harus dimatikan. Sheet tabel datar tetap true.
     */
    protected bool $useTableHeader = true;

    /** @var list<int> Baris judul besar laporan. */
    protected array $titleRows = [];

    /** @var list<int> Baris anak judul (nama toko, periode). */
    protected array $subtitleRows = [];

    /** @var list<int> Baris judul kelompok (PENDAPATAN, BEBAN, dan seterusnya). */
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
            // Laporan bertingkat: styling sendiri, tanpa header merah baris 1.
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

        $this->styleReportRows($sheet);
    }

    /**
     * Gaya baris laporan bertingkat dan judul blok di dalam sheet tabel.
     */
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

    /**
     * Status pesanan dalam bahasa Indonesia. Laporan ini dibaca pemilik toko,
     * bukan pengembang, jadi nilai mentah basis data tidak boleh bocor.
     */
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

    /**
     * Format angka sesuai jenis KPI (nilai persen sudah skala persen).
     */
    protected function kpiNumberFormat(string $kpiFormat): string
    {
        return match ($kpiFormat) {
            'percent' => '0.00"%"',
            'hours' => '0.00" jam"',
            'days' => '0.0" hari"',
            default => '#,##0',
        };
    }
}

// ------ 1. LABA RUGI (laporan bertingkat, gaya pembukuan) ------

/**
 * Sheet Laba Rugi. Bentuknya laporan bertingkat, bukan daftar metrik acak:
 * pendapatan bruto di atas, pengurang berurut di bawahnya, lalu subtotal
 * Penjualan Bersih, dilanjutkan arus kas dan KPI operasional.
 *
 * Kolom C berisi nilai periode ini, kolom D periode sebelumnya, kolom E
 * perubahan. Bila periode pembanding tidak punya data sama sekali, kolom D
 * dan E diisi keterangan, bukan angka nol yang memicu persentase palsu.
 */
class StorePerformanceSummarySheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Laba Rugi';
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

        $prevHasData = (bool) ($this->payload['previous_has_data'] ?? true);
        $prevText = 'Tidak ada data';

        // Nilai periode sebelumnya untuk baris keuangan tidak tersedia per
        // komponen, jadi kolom D dan E baris keuangan diberi tanda hubung
        // dan pembaca diarahkan ke blok KPI di bawah.
        $money = function (string $label, $value, int $indent = 0, bool $isTotal = false) use ($push, $guard, $num, &$r) {
            $prefix = str_repeat('    ', $indent);
            $row = ['', $guard($prefix.$label), $num($value), '', ''];
            $line = $push($row);
            $this->registerNumber($line, 3, '#,##0');
            if ($isTotal) {
                $this->totalRows[] = $line;
            }

            return $line;
        };

        // ---- PENDAPATAN ----
        $push(['', 'PENDAPATAN', '', '', '']);
        $this->groupRows[] = $r - 1;

        $money('Nilai produk terjual', $fin['items_before_discount'] ?? null, 1);
        $money('Potongan voucher', -1 * $num($fin['voucher_discount'] ?? 0), 1);
        $money('Ongkir dibayar pelanggan', $fin['shipping_paid_by_customer'] ?? null, 1);
        $money('Asuransi dibayar pelanggan', $fin['insurance'] ?? null, 1);
        $money('Biaya COD dibayar pelanggan', $fin['cod_fee'] ?? null, 1);
        $money('TOTAL DIBAYAR PEMBELI', $fin['gross_revenue'] ?? null, 0, true);
        $push(['', '    Nilai produk terjual sudah memakai harga promo yang berlaku. Pembeli menghemat '.number_format($num($fin['product_discount'] ?? 0), 0, ',', '.').' dibanding harga normal, angka itu bukan pengurang tagihan sehingga tidak dikurangkan di sini.', '', '', '']);
        $this->noteRows[] = $r - 1;
        $push([""]);

        // ---- BEBAN ----
        $push(['', 'BEBAN YANG DITANGGUNG TOKO', '', '', '']);
        $this->groupRows[] = $r - 1;

        $money('Ongkir dibayarkan ke J&T', -1 * $num($fin['shipping_raw'] ?? 0), 1);
        $money('Biaya COD diteruskan ke J&T', -1 * $num($fin['cod_fee'] ?? 0), 1);
        $money('Refund retur', -1 * $num($fin['refund_adjustments'] ?? 0), 1);
        $money('Ongkir retur ditanggung toko', -1 * $num($fin['return_shipping_store'] ?? 0), 1);
        $totalBeban = $num($fin['shipping_raw'] ?? 0) + $num($fin['cod_fee'] ?? 0)
            + $num($fin['refund_adjustments'] ?? 0) + $num($fin['return_shipping_store'] ?? 0);
        $money('Jumlah beban toko', -1 * $totalBeban, 0, true);
        $push([""]);

        // ---- HASIL ----
        $push(['', 'HASIL', '', '', '']);
        $this->groupRows[] = $r - 1;
        $money('PENJUALAN BERSIH', $fin['net_revenue'] ?? null, 0, true);
        $this->grandTotalRows[] = $r - 1;
        $push(['', '    Catatan: subsidi ongkir '.number_format($num($fin['shipping_subsidy'] ?? 0), 0, ',', '.').' sudah termasuk dalam ongkir yang dibayarkan ke J&T, tidak dikurangkan dua kali.', '', '', '']);
        $this->noteRows[] = $r - 1;
        $push([""]);

        // ---- ARUS KAS ----
        $push(['', 'ARUS KAS', '', '', '']);
        $this->groupRows[] = $r - 1;
        // Alur uang: komponen dulu, hasil akhir belakangan. Transfer cair
        // diturunkan dari pembayaran selesai dikurangi COD selesai.
        $money('Transfer bank sudah cair', max($num($fin['payments_received'] ?? 0) - $num($fin['cod_paid'] ?? 0), 0.0), 1);
        $money('COD sudah cair', $fin['cod_paid'] ?? null, 1);
        $money('Pembayaran sudah diterima', $fin['payments_received'] ?? null, 0, true);
        $money('COD (barang belum sampai), '.(int) ($fin['cod_pending_count'] ?? 0).' pesanan', $fin['cod_pending_amount'] ?? null, 1);
        $push([""]);

        // ---- KPI OPERASIONAL ----
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

// ------ 2. RINCIAN PESANAN (1 baris = 1 pesanan, header di baris 1) ------

/**
 * Sheet Rincian Pesanan. Header WAJIB di baris 1 supaya freeze pane dan
 * autofilter bekerja, dan supaya pembaca tidak menemukan header terselip di
 * tengah sheet. Blok rekap yang dulu berada di atas header sudah dipindahkan
 * ke sheet Laba Rugi, tempatnya yang benar.
 *
 * Urutan kolom mengikuti alur uang, kiri ke kanan:
 *   identitas -> nilai produk -> potongan -> yang dibayar pembeli
 *   -> beban toko -> penjualan bersih -> kas masuk.
 * Baris terakhir adalah baris JUMLAH, sehingga angka sheet ini dapat
 * dicocokkan langsung dengan sheet Laba Rugi.
 */
class StorePerformanceIncomeDetailSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Rincian Pesanan';
        $this->columnWidths = [
            'A' => 16, 'B' => 18, 'C' => 18, 'D' => 12, 'E' => 16,
            'F' => 16, 'G' => 9, 'H' => 18, 'I' => 15, 'J' => 14,
            'K' => 16, 'L' => 12, 'M' => 15, 'N' => 19, 'O' => 17,
            'P' => 15, 'Q' => 14, 'R' => 16, 'S' => 17, 'T' => 15,
            'U' => 30,
        ];
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $num = static fn ($v) => (float) ($v ?? 0);
        $rows = [];
        $r = 1;

        // Header di BARIS 1. Tidak ada blok rekap di atasnya.
        $rows[] = [
            'Nomor Pesanan', 'Tanggal Pesanan', 'Tanggal Dibayar', 'Metode',
            'Status Pesanan', 'Status Pembayaran', 'Jumlah Item',
            'Nilai Produk Terjual', 'Voucher',
            'Ongkir Dibayar Pelanggan', 'Asuransi', 'Biaya COD',
            'Total Dibayar Pembeli',
            'Ongkir ke J&T', 'Refund Retur', 'Ongkir Retur Toko',
            'Penjualan Bersih',
            'Uang Sudah Masuk', 'Belum Cair',
            'Subsidi Ongkir Toko', 'Hemat Pembeli vs Harga Normal',
        ];
        $r++;

        $sum = array_fill_keys([
            'items', 'subtotal', 'discount', 'voucher', 'shipping_net', 'insurance',
            'cod_fee', 'paid_by_customer', 'shipping_raw', 'refund', 'return_shipping',
            'net', 'received', 'outstanding', 'subsidy',
        ], 0.0);

        $dataRows = $this->payload['income_detail'] ?? [];

        foreach ($dataRows as $row) {
            $paidAt = $row['paid_at'] ?? null;

            $items = (float) ($row['items_count'] ?? 0);
            $subtotal = $num($row['subtotal_before_discount'] ?? 0);
            $discount = $num($row['discount'] ?? 0);
            $voucher = $num($row['voucher_discount'] ?? 0);
            $shipNet = $num($row['shipping_net_paid_by_customer'] ?? 0);
            $insurance = $num($row['insurance'] ?? 0);
            $codFee = $num($row['cod_fee'] ?? 0);
            $paidBy = $num($row['total_paid_by_customer'] ?? 0);
            $shipRaw = $num($row['shipping_raw'] ?? 0);
            $refund = $num($row['refund_amount'] ?? 0);
            $retShip = $num($row['return_shipping_store'] ?? 0);
            $net = $num($row['net_revenue'] ?? 0);
            $received = $num($row['paid_amount'] ?? 0);
            $outstanding = $num($row['outstanding'] ?? 0);
            $subsidy = $num($row['shipping_subsidy'] ?? 0);

            $sum['items'] += $items;
            $sum['subtotal'] += $subtotal;
            $sum['discount'] += $discount;
            $sum['voucher'] += $voucher;
            $sum['shipping_net'] += $shipNet;
            $sum['insurance'] += $insurance;
            $sum['cod_fee'] += $codFee;
            $sum['paid_by_customer'] += $paidBy;
            $sum['shipping_raw'] += $shipRaw;
            $sum['refund'] += $refund;
            $sum['return_shipping'] += $retShip;
            $sum['net'] += $net;
            $sum['received'] += $received;
            $sum['outstanding'] += $outstanding;
            $sum['subsidy'] += $subsidy;

            $out = [
                $guard($row['order_number'] ?? '-'),
                $guard($this->formatWib($row['created_at'] ?? null, 'j M Y H:i')),
                $paidAt ? $guard($this->formatWib($paidAt, 'j M Y H:i')) : '',
                $guard($this->paymentMethodLabel($row['payment_method'] ?? null)),
                $guard($this->orderStatusLabel($row['order_status'] ?? null)),
                $guard($this->paymentStatusLabel($row['payment_status'] ?? null)),
                $items,
                $subtotal, $voucher,
                $shipNet, $insurance, $codFee,
                $paidBy,
                $shipRaw, $refund, $retShip,
                $net,
                $received, $outstanding,
                $subsidy, $discount,
            ];
            $rows[] = $out;
            for ($c = 7; $c <= 21; $c++) {
                $this->registerNumber($r, $c, '#,##0');
            }
            $this->trackZeroCells($out, $r);
            $r++;
        }

        // Baris JUMLAH, supaya bisa dicocokkan dengan sheet Laba Rugi.
        if ($dataRows !== []) {
            $rows[] = [
                'JUMLAH', '', '', '', '', '',
                $sum['items'],
                $sum['subtotal'], $sum['voucher'],
                $sum['shipping_net'], $sum['insurance'], $sum['cod_fee'],
                $sum['paid_by_customer'],
                $sum['shipping_raw'], $sum['refund'], $sum['return_shipping'],
                $sum['net'],
                $sum['received'], $sum['outstanding'],
                $sum['subsidy'], $sum['discount'],
            ];
            for ($c = 7; $c <= 21; $c++) {
                $this->registerNumber($r, $c, '#,##0');
            }
            $this->totalRows[] = $r;
            $r++;
        } else {
            $rows[] = ['Tidak ada pesanan pada periode ini.'];
            $this->noteRows[] = $r;
            $r++;
        }

        return $rows;
    }

    protected function styleReportRows($sheet): void
    {
        // Baris JUMLAH memakai kolom A sampai U, bukan B sampai E.
        foreach ($this->totalRows as $row) {
            $sheet->getStyle('A'.$row.':U'.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10],
                'borders' => [
                    'top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF121212']],
                    'bottom' => ['borderStyle' => Border::BORDER_DOUBLE, 'color' => ['argb' => 'FF121212']],
                ],
            ]);
        }
        $this->totalRows = [];

        parent::styleReportRows($sheet);
    }
}

// ------ 3. ITEM TERJUAL (1 baris = 1 item pesanan) ------

class StorePerformanceSoldItemsSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Item Terjual';
        $this->columnWidths = [
            'A' => 16, 'B' => 17, 'C' => 14, 'D' => 34, 'E' => 18,
            'F' => 16, 'G' => 12, 'H' => 14, 'I' => 14,
        ];
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $rows = [];
        $r = 1;

        $rows[] = [
            'Nomor Pesanan', 'Tanggal Pesanan', 'SKU Induk', 'Nama Produk',
            'Variasi', 'Harga Satuan', 'Jumlah', 'Subtotal Baris', 'Diskon Baris',
        ];
        $r++;

        foreach ($this->payload['sold_items'] ?? [] as $row) {
            $out = [
                $guard($row['order_number'] ?? '-'),
                $guard($this->formatWib($row['created_at'] ?? null, 'j M Y H:i')),
                $guard($row['parent_sku'] ?? '-'),
                $guard($row['name'] ?? '-'),
                $guard($row['variation'] ?? '-'),
                $guard($row['unit_price'] ?? 0),
                $guard($row['quantity'] ?? 0),
                $guard($row['line_total'] ?? 0),
                $guard($row['line_discount'] ?? 0),
            ];
            $rows[] = $out;
            $this->registerNumber($r, 6, '#,##0');
            $this->registerNumber($r, 7, '#,##0');
            $this->registerNumber($r, 8, '#,##0');
            $this->registerNumber($r, 9, '#,##0');
            $this->trackZeroCells($out, $r);
            $r++;
        }

        return $rows;
    }
}

// ------ 4. ANALISIS (produk, pelanggan, pembayaran, retur) ------

/**
 * Sheet Analisis. Empat sheet lama (Produk Terlaris, Pelanggan Terbaik,
 * Biaya Retur, ditambah bauran pembayaran dan interaksi produk yang dulu
 * dihitung tetapi tidak pernah diekspor) dilebur ke satu sheet.
 *
 * Alasan peleburan: keempatnya sama sama tabel pendek yang hanya dibaca,
 * tidak dipakai untuk rekonsiliasi, dan lebarnya mirip. Memisahkannya
 * memaksa pembaca berpindah tab untuk pertanyaan yang saling terkait
 * ("produk apa yang laris, siapa yang beli, bayar pakai apa").
 *
 * Tiap blok diberi judul dan header sendiri, dipisahkan baris kosong, jadi
 * autofilter tidak dipakai di sheet ini (header tidak tunggal).
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

        // Judul blok dan subtitle memakai kolom A, jadi styleReportRows
        // versi kelas ini menargetkan kolom A.
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

        // ---- BLOK 1: PRODUK TERLARIS ----
        $block('PRODUK TERLARIS', ['SKU Induk', 'Nama Produk', 'Unit Terjual', 'Penjualan', 'Jumlah Pesanan'], 'E');
        $topAll = $this->payload['top_products'] ?? [];
        $top = array_slice($topAll, 0, 15);
        if ($top === []) {
            $push(['Tidak ada produk terjual pada periode ini.']);
            $this->noteRows[] = $r - 1;
        }
        foreach ($top as $pr) {
            $row = [
                $guard($pr['parent_sku'] ?? ''),
                $guard($pr['name'] ?? ''),
                (float) ($pr['units'] ?? 0),
                (float) ($pr['revenue'] ?? 0),
                (float) ($pr['order_count'] ?? 0),
            ];
            $line = $push($row);
            $money($line, [3, 4, 5]);
            $this->trackZeroCells($row, $line);
        }
        if (count($topAll) > count($top)) {
            $push(['Menampilkan 15 produk teratas dari '.count($topAll).' produk yang terjual.']);
            $this->noteRows[] = $r - 1;
        }
        $push([""]);

        // ---- BLOK 2: INTERAKSI PRODUK (sebelumnya tidak pernah diekspor) ----
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

        // ---- BLOK 3: PELANGGAN ----
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
            $this->trackZeroCells($row, $line);
        }
        $push([""]);

        // ---- BLOK 4: BAURAN PEMBAYARAN (sebelumnya tidak pernah diekspor) ----
        $block('BAURAN METODE PEMBAYARAN', ['Metode', 'Jumlah Pesanan', 'Nilai Penjualan', 'Porsi Nilai', ''], 'D');
        $mix = $this->payload['payment_mix'] ?? [];
        $mixTotal = 0.0;
        foreach ($mix as $m) {
            $mixTotal += (float) ($m['revenue'] ?? 0);
        }
        if ($mix === []) {
            $push(['Tidak ada transaksi pada periode ini.']);
            $this->noteRows[] = $r - 1;
        }
        foreach ($mix as $m) {
            $revenue = (float) ($m['revenue'] ?? 0);
            $row = [
                $guard($this->paymentMethodLabel($m['method'] ?? null)),
                (float) ($m['count'] ?? 0),
                $revenue,
                $mixTotal > 0 ? round($revenue / $mixTotal * 100, 2) : 0.0,
            ];
            $line = $push($row);
            $this->registerNumber($line, 2, '#,##0');
            $this->registerNumber($line, 3, '#,##0');
            $this->registerNumber($line, 4, '0.00"%"');
        }
        $push([""]);

        // ---- BLOK 5: BIAYA RETUR ----
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
        // Judul dan subtitle sheet ini berada di kolom A.
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

// ------ 7. PANDUAN ------

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
            ['ISI BERKAS', 'Laba Rugi = laporan bertingkat, pendapatan lalu beban lalu penjualan bersih. Rincian Pesanan = 1 baris per pesanan, header di baris 1, baris terakhir JUMLAH. Rincian Item = 1 baris per item pesanan. Analisis = produk, pelanggan, bauran pembayaran, dan biaya retur dalam satu sheet berblok.'],
            ['CARA MEMBACA', 'Mulai dari sheet Laba Rugi untuk melihat hasil periode. Bila sebuah angka ingin diperiksa asalnya, buka Rincian Pesanan dan cocokkan dengan baris JUMLAH di bawah tabel. Angka pada baris JUMLAH sama dengan angka pada Laba Rugi.'],
            ['ALUR UANG', 'Nilai produk sebelum potongan, dikurangi diskon produk dan voucher, ditambah ongkir, asuransi, dan biaya COD yang dibayar pelanggan, menghasilkan Total Dibayar Pembeli. Dari angka itu dikurangi ongkir yang dibayarkan ke J&T, biaya COD yang diteruskan ke J&T, refund retur, dan ongkir retur toko, menghasilkan Penjualan Bersih.'],
            ['SUBSIDI ONGKIR', 'Subsidi ongkir adalah bagian ongkir yang ditanggung toko. Nilainya sudah termasuk di dalam Ongkir ke J&T, jadi tidak dikurangkan lagi secara terpisah. Kolom Subsidi Ongkir Toko di Rincian Pesanan hanya keterangan, bukan pengurang tambahan.'],
            ['ARUS KAS', 'Penjualan Bersih adalah hak toko atas periode ini, belum tentu sudah menjadi uang. Pembayaran sudah diterima = transfer bank cair + COD cair pada periode. Sisa COD dihitung terpisah dari pesanan yang barangnya belum sampai, karena sistem menetapkan COD lunas lewat event status pesanan tiba, bukan dari catatan pembayaran.'],
            ['METRIK PRODUK', 'Tiga tingkat berbeda: Model Produk Terjual menghitung jenis model, Produk Terjual menghitung varian atau ukuran, Jumlah Unit Terjual menghitung batang barang. Jangan disamakan.'],
            ['PENGUNJUNG YANG MEMBELI', 'Dihitung dari jumlah pembeli unik dibagi jumlah pengunjung, bukan jumlah pesanan dibagi pengunjung. Satu pelanggan dengan beberapa pesanan tetap dihitung satu orang.'],
            ['PERIODE PEMBANDING', 'Kolom Periode Sebelumnya membandingkan dengan rentang sepanjang periode ini tepat sebelumnya. Bila rentang itu belum ada datanya, kolom berisi keterangan Tidak ada data, bukan angka nol, supaya tidak muncul persentase perubahan yang menyesatkan.'],
            ['FORMAT ANGKA', 'Semua kolom uang berupa angka polos tanpa Rp, contoh 3.000.000. Nilai selnya tetap numerik sehingga aman dijumlah di Excel. Sel yang memang tidak punya nilai dibiarkan kosong, bukan diisi tanda hubung.'],
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