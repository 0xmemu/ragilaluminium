<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Support\ExportSafety;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\RegistersEventListeners;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithStrictNullComparison;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Table;
use PhpOffice\PhpSpreadsheet\Worksheet\Table\Column as TableColumn;

/**
 * Laporan Performa Toko XLSX. Arsitektur workbook (2026-09-11) dengan gaya
 * visual baru (2026-09-13, referensi gaya owner: band navy + subjudul):
 *   1. Ringkasan Finansial - P&L bertingkat (I-III) + Status Arus Kas (IV).
 *      Angka pendapatan dan beban adalah RUMUS SUM/SUMIFS yang menunjuk
 *      TabelPesanan, jadi bila admin mengoreksi satu sel di tabel, P&L ikut
 *      berubah. Arus kas tetap angka payload (sumbernya ledger pembayaran,
 *      bukan baris tabel pesanan, agar pesanan yang dibayar di luar periode
 *      pembuatannya tetap terhitung benar).
 *   2. KPI Operasional Toko - metrik e-commerce per seksi (I-V).
 *   3. Tabel Pesanan - 1 baris = 1 pesanan, Excel Table "TabelPesanan"
 *      dengan Total Row SUBTOTAL + kolom identitas pembeli (W-X-Y).
 *   4. Tabel Item - 1 baris = 1 item; Subtotal Baris = rumus Harga*Jumlah.
 *   5. Analisis - agregat yang tidak bisa diturunkan dari dua tabel
 *      (kunjungan produk, pelanggan, retur); sisanya SUMIFS/COUNTIFS.
 *   6. Panduan - aturan baca, definisi, format angka.
 *
 * Label kontrak owner (tabel kanonik ADR-018): "Penjualan Gross" (agregat
 * tagihan pembeli, KPI omzet, kolom tabel pesanan, subtotal pendapatan),
 * "Penjualan Bersih"
 * TANPA sisipan lain, label COD menyatakan keadaan barang ("COD (barang
 * belum sampai), N pesanan"), 100% Bahasa Indonesia.
 *
 * PENTING: baris pemisah antarblok wajib ditulis [""] (satu sel kosong),
 * BUKAN array kosong []. Maatwebsite membuang [] saat menulis sehingga
 * seluruh nomor baris styling bergeser (insiden 2026-09-11).
 *
 * PENTING (tabel): override afterSheet pada sheet bertabel WAJIB memanggil
 * parent::afterSheet($event) sebelum mengecat ulang header, karena loop
 * addTable milik basis membaca $this->excelTables.
 */
class StorePerformanceExport implements WithMultipleSheets
{
    public function __construct(protected array $payload, protected ?string $sheetSuffix = null) {}

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
 * Basis sheet tabel datar. Laporan bertingkat (Laba Rugi, KPI, Analisis)
 * memakai band judul navy di baris 1 + subjudul slate di baris 2 (gaya
 * referensi owner 2026-09-13); dua sheet tabel memakai header Table navy.
 */
abstract class StorePerformanceTableSheet extends RagilStyledExport implements FromArray, WithStrictNullComparison, WithTitle
{
    /**
     * Penanda cakupan sebuah metrik, diambil dari kontrak
     * StorePerformanceService::METRIC_BASIS. Dipakai baris yang menulis
     * labelnya sendiri, supaya cakupannya tidak bisa berbeda dari label KPI
     * dan dari penanda di layar.
     */
    protected function penandaCakupan(string $key): string
    {
        $basis = \App\Services\StorePerformanceService::METRIC_BASIS[$key] ?? null;
        if (($basis['scope'] ?? null) !== 'current') {
            return '';
        }

        return ' ('.($basis['marker'] ?? 'kondisi saat ini').')';
    }
    /** @var list<array{0: int, 1: int, 2: string}> [baris, indeks kolom, format] */
    protected array $numberCells = [];

    protected bool $useTableHeader = true;

    /** @var list<array{0: int, 1: string}> Band judul: [baris, kolom terakhir]. */
    protected array $bandRows = [];

    /** @var list<array{0: int, 1: string}> Band subjudul: [baris, kolom terakhir]. */
    protected array $bandSubtitleRows = [];

    /** @var list<int> Baris penanda kolom pada laporan bertingkat. */
    protected array $columnLabelRows = [];

    /** @var list<int> Baris judul seksi (I. II. III. ...). */
    protected array $groupRows = [];

    /** @var list<int> Baris subtotal. */
    protected array $totalRows = [];

    /** @var list<int> Baris hasil akhir. */
    protected array $grandTotalRows = [];

    /** @var list<int> Baris catatan kecil. */
    protected array $noteRows = [];

    /** @var list<array{0: int, 1: string}> Baris judul blok di dalam sheet tabel. */
    protected array $blockTitleRows = [];

    /** @var list<array{0: int, 1: int}> Rentang baris data per blok untuk zebra. */
    protected array $zebraRanges = [];

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

        // Sel identitas (nomor HP pelanggan) diterapkan di sini.
        $this->applyTextCells($sheet, $sheet->getHighestRow());

        // Pasang Excel Table (Format Table / Ctrl+T) setelah autofilter
        // milik basis; Table membawa autofilter dan Total Row sendiri.
        foreach ($this->excelTables as $table) {
            $sheet->addTable($table);
        }

        $this->paintBands($sheet);
        $this->styleReportRows($sheet);
    }

    /**
     * Band judul navy + subjudul slate (baris 1-2, di-merge selebar laporan).
     */
    protected function paintBands($sheet): void
    {
        foreach ($this->bandRows as [$row, $lastCol]) {
            $sheet->mergeCells("A{$row}:{$lastCol}{$row}");
            $sheet->getStyle("A{$row}:{$lastCol}{$row}")->applyFromArray([
                'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1B365D']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getRowDimension($row)->setRowHeight(24);
        }

        foreach ($this->bandSubtitleRows as [$row, $lastCol]) {
            $sheet->mergeCells("A{$row}:{$lastCol}{$row}");
            $sheet->getStyle("A{$row}:{$lastCol}{$row}")->applyFromArray([
                'font' => ['size' => 9, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF2E5B88']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getRowDimension($row)->setRowHeight(18);
        }
    }

    /**
     * Zebra manual untuk rentang baris data (baris genap = F8FAFC).
     */
    protected function paintZebra($sheet): void
    {
        foreach ($this->zebraRanges as [$first, $last]) {
            for ($row = $first; $row <= $last; $row++) {
                if ($row % 2 === 0) {
                    $sheet->getStyle("A{$row}:".$sheet->getHighestColumn().$row)->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF8FAFC']],
                    ]);
                }
            }
        }
    }

    protected function styleReportRows($sheet): void
    {
        foreach ($this->columnLabelRows as $row) {
            $sheet->getStyle("A{$row}:".chr(64 + 4).$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF334155']],
                'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF94A3B8']]],
            ]);
            $sheet->getRowDimension($row)->setRowHeight(20);
        }

        foreach ($this->groupRows as $row) {
            $sheet->getStyle("A{$row}:D{$row}")->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF1B365D']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF1F5F9']],
            ]);
            $sheet->getRowDimension($row)->setRowHeight(18);
        }

        foreach ($this->totalRows as $row) {
            $sheet->getStyle("A{$row}:D{$row}")->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF1E293B']],
                'borders' => ['top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFCBD5E1']]],
            ]);
        }

        foreach ($this->grandTotalRows as $row) {
            $sheet->getStyle("A{$row}:D{$row}")->applyFromArray([
                'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF1E293B']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFDCFCE7']],
                'borders' => [
                    'top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF0F172A']],
                    'bottom' => ['borderStyle' => Border::BORDER_DOUBLE, 'color' => ['argb' => 'FF0F172A']],
                ],
            ]);
        }

        foreach ($this->noteRows as $row) {
            $sheet->getStyle('A'.$row)->applyFromArray([
                'font' => ['italic' => true, 'size' => 9, 'color' => ['argb' => 'FF666666']],
            ]);
        }

        foreach ($this->blockTitleRows as [$row, $lastCol]) {
            $sheet->getStyle('A'.$row.':'.$lastCol.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF1B365D']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF1F5F9']],
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

    /**
     * Label metode pembayaran, sama dengan labelMetodeBayar di layar
     * Performa Toko. Nilai mentah dari database dibandingkan tanpa
     * membedakan huruf besar kecil. Nilai yang tidak dikenal ditampilkan
     * apa adanya supaya tidak ada metode yang hilang dari laporan.
     */
    /** Satu sumber teks untuk metode transfer, dipakai label dan kriteria. */
    public const LABEL_TRANSFER = 'Transfer Bank';

    protected function paymentMethodLabel(?string $method): string
    {
        $kunci = strtolower(trim((string) $method));
        if ($kunci === '') {
            return '-';
        }

        return [
            'cod' => 'COD',
            'transfer' => self::LABEL_TRANSFER,
            'bank_transfer' => self::LABEL_TRANSFER,
            'gateway' => 'Pembayaran Online',
            'other' => 'Lainnya',
        ][$kunci] ?? (string) $method;
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

// ------ 1. RINGKASAN FINANSIAL (P&L bertingkat + Status Arus Kas) ------

/**
 * I. PENDAPATAN PENJUALAN, II. BEBAN YANG DITANGGUNG TOKO,
 * III. HASIL BERSIH, IV. STATUS ARUS KAS. Kolom B berisi rumus yang
 * menunjuk TabelPesanan; kolom C/D hanya terisi bila ada periode
 * pembanding (bila tidak: "Tidak ada data" dan "-").
 * Arus kas SENGAJA angka payload (ledger pembayaran per paid_at), bukan
 * SUMIFS ke tabel: baris tabel hanya pesanan yang dibuat dalam periode,
 * sedangkan kas mengikuti tanggal pembayaran.
 */
class StorePerformanceSummarySheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Ringkasan Finansial';
        $this->columnWidths = ['A' => 50, 'B' => 24, 'C' => 20, 'D' => 16];
        $this->useTableHeader = false;
    }

    protected function buildRows(): array
    {
        $guard = static fn ($value) => ExportSafety::cell($value);
        $fin = $this->payload['financial'] ?? [];
        $finPrev = $this->payload['financial_previous'] ?? [];
        $range = $this->payload['range'] ?? [];
        $num = static fn ($v) => (float) ($v ?? 0);

        // Kolom pembanding Ringkasan Finansial. Sebelumnya kedua kolom ini
        // selalu "Tidak ada data" dan "-", bahkan ketika periode pembandingnya
        // berisi, sehingga sheet ini bertentangan dengan sheet KPI di berkas
        // yang sama (temuan audit 2026-09-21).
        $prevHasData = (bool) ($this->payload['previous_has_data'] ?? true);

        // Aturan persentase disamakan dengan StorePerformanceService::kpi()
        // supaya angka di dua sheet tidak pernah berbeda.
        $persenPerubahan = static function ($current, $previous): ?float {
            $c = (float) $current;
            $p = (float) $previous;
            if ($p > 0) {
                return round((($c - $p) / $p) * 100, 1);
            }
            if ($c > 0) {
                return 100.0;
            }
            if ($c === 0.0 && $p === 0.0) {
                return 0.0;
            }

            return null;
        };

        // Baris snapshot (tanpa periode pembanding) memanggil ini dengan
        // $previous null, jadi kolomnya tetap keterangan, bukan persen palsu.
        $pasangan = static function ($current, $previous) use ($prevHasData, $persenPerubahan): array {
            if (! $prevHasData || $previous === null) {
                return ['Tidak ada data', '-'];
            }
            $persen = $persenPerubahan($current, $previous);

            return [$previous, $persen === null ? 'Baru pada periode ini' : $persen];
        };

        $rows = [];
        $r = 1;

        $push = function (array $row) use (&$rows, &$r): int {
            $rows[] = $row;
            $current = $r;
            $r++;

            return $current;
        };

        $tableName = $this->tableName('TabelPesanan');
        $sum = static fn (string $col) => '=SUM('.$tableName.'['.$col.'])';

        // Band judul + subjudul + baris kosong + penanda kolom.
        $push(['LAPORAN LABA RUGI & ARUS KAS TOKO']);
        $this->bandRows[] = [$r - 1, 'D'];
        $push(['Ragil Aluminium  |  Periode: '.($range['from_date'] ?? '-').' sampai '.($range['to_date'] ?? '-')]);
        $this->bandSubtitleRows[] = [$r - 1, 'D'];
        $push(['']);

        $head = $push(['Keterangan Akun', 'Periode Ini', 'Periode Sebelumnya', 'Perubahan']);
        $this->columnLabelRows[] = $head;

        $moneyF = function (string $label, string $formula, bool $isTotal = false, $current = null, $previous = null) use ($push, $guard, $pasangan, $prevHasData, &$r) {
            [$kolomC, $kolomD] = $pasangan($current, $previous);
            $line = $push([$guard($label), $formula, $kolomC, $kolomD]);
            $this->registerNumber($line, 2, '#,##0');
            if ($prevHasData && $previous !== null) {
                $this->registerNumber($line, 3, '#,##0');
                if (is_float($kolomD) || is_int($kolomD)) {
                    $this->registerNumber($line, 4, '0.0"%"');
                }
            }
            if ($isTotal) {
                $this->totalRows[] = $line;
            }

            return $line;
        };

        // Arus kas: angka payload (ledger pembayaran), bukan kolom tabel.
        $money = function (string $label, $value, bool $isTotal = false, $previous = null) use ($push, $guard, $num, $pasangan, $prevHasData, &$r) {
            [$kolomC, $kolomD] = $pasangan($num($value), $previous);
            $line = $push([$guard($label), $num($value), $kolomC, $kolomD]);
            $this->registerNumber($line, 2, '#,##0');
            if ($prevHasData && $previous !== null) {
                $this->registerNumber($line, 3, '#,##0');
                if (is_float($kolomD) || is_int($kolomD)) {
                    $this->registerNumber($line, 4, '0.0"%"');
                }
            }
            if ($isTotal) {
                $this->totalRows[] = $line;
            }

            return $line;
        };

        // Bulan tanpa satu pun baris pesanan tidak membuat Excel Table,
        // sehingga rumus kolom terstruktur akan menjadi nama yang menggantung
        // (#NAME?). Untuk keadaan itu angka diambil dari payload (nol).
        $hasRows = ($this->payload['income_detail'] ?? []) !== [];
        $moneyRow = function (string $label, string $formula, $static, bool $isTotal = false, $current = null, $previous = null) use ($hasRows, $moneyF, $money) {
            return $hasRows
                ? $moneyF($label, $formula, $isTotal, $current, $previous)
                : $money($label, $static, $isTotal, $previous);
        };

        // ---- I. PENDAPATAN PENJUALAN ----
        $push(['I. PENDAPATAN PENJUALAN']);
        $this->groupRows[] = $r - 1;

        $rowNilai = $moneyRow('Nilai Produk Terjual', $sum('Nilai Produk Terjual'), $fin['items_before_discount'] ?? null, false, $num($fin['items_before_discount'] ?? 0), $num($finPrev['items_before_discount'] ?? 0));
        // Kolom Voucher di tabel sudah negatif; jangan dibalik lagi.
        $rowVoucher = $moneyRow('Potongan Voucher Toko', $sum('Voucher'), -1 * $num($fin['voucher_discount'] ?? 0), false, -1 * $num($fin['voucher_discount'] ?? 0), -1 * $num($finPrev['voucher_discount'] ?? 0));
        $rowOngkir = $moneyRow('Ongkir Dibayar Pelanggan', $sum('Ongkir Dibayar Pelanggan'), $fin['shipping_paid_by_customer'] ?? null, false, $num($fin['shipping_paid_by_customer'] ?? 0), $num($finPrev['shipping_paid_by_customer'] ?? 0));
        $rowAsuransi = $moneyRow('Asuransi Dibayar Pelanggan', $sum('Asuransi'), $fin['insurance'] ?? null, false, $num($fin['insurance'] ?? 0), $num($finPrev['insurance'] ?? 0));
        $rowCod = $moneyRow('Biaya COD Dibayar Pelanggan', $sum('Biaya COD'), $fin['cod_fee'] ?? null, false, $num($fin['cod_fee'] ?? 0), $num($finPrev['cod_fee'] ?? 0));
        [$grossKolomC, $grossKolomD] = $pasangan($num($fin['gross_revenue'] ?? 0), $num($finPrev['gross_revenue'] ?? 0));
        $rowGross = $push(['PENJUALAN GROSS', '=SUM(B'.$rowNilai.':B'.$rowCod.')', $grossKolomC, $grossKolomD]);
        $this->totalRows[] = $rowGross;
        $this->registerNumber($rowGross, 2, '#,##0');
        $this->noteRows[] = $push(['* Nilai produk terjual sudah memakai harga promo (setelah diskon produk). Koreksi nilai di Tabel Pesanan akan mengubah baris ini.']);

        // ---- II. BEBAN YANG DITANGGUNG TOKO ----
        $push(['II. BEBAN YANG DITANGGUNG TOKO']);
        $this->groupRows[] = $r - 1;

        // Tiga kolom beban di tabel sudah bernilai negatif.
        $rowOngkirJnt = $moneyRow('Ongkir Dibayarkan ke J&T', $sum('Ongkir ke J&T'), -1 * $num($fin['shipping_raw'] ?? 0), false, -1 * $num($fin['shipping_raw'] ?? 0), -1 * $num($finPrev['shipping_raw'] ?? 0));
        // Kolom Biaya COD positif (uang diterima pembeli), jadi beban
        // ke J&T memang dibalik di sini. Negasi rumus: '=' harus tetap di
        // depan, jika tidak Excel menyimpan sel sebagai teks dan COD hilang
        // dari jumlah beban (bug 2026-09-12).
        $rowCodJnt = $moneyRow('Biaya COD Diteruskan ke J&T', '=-'.ltrim($sum('Biaya COD'), '='), -1 * $num($fin['cod_fee'] ?? 0), false, -1 * $num($fin['cod_fee'] ?? 0), -1 * $num($finPrev['cod_fee'] ?? 0));
        $rowRefund = $moneyRow('Refund Retur', $sum('Refund Retur'), -1 * $num($fin['refund_adjustments'] ?? 0), false, -1 * $num($fin['refund_adjustments'] ?? 0), -1 * $num($finPrev['refund_adjustments'] ?? 0));
        $rowRetShip = $moneyRow('Ongkir Retur (Toko)', $sum('Ongkir Retur (Toko)'), -1 * $num($fin['return_shipping_store'] ?? 0), false, -1 * $num($fin['return_shipping_store'] ?? 0), -1 * $num($finPrev['return_shipping_store'] ?? 0));
        // Nilai barang pesanan yang ditolak kurir sebelum lunas: pengurang
        // penjualan (barang kembali, transaksi batal). Dibaca dari kolom
        // Tabel Pesanan seperti baris beban lain, supaya SATU sumber angka
        // dengan rumus Penjualan Bersih per baris dan dengan KPI layar.
        $rowRetDitolak = $moneyRow(
            'Nilai Barang Retur Paket',
            $sum('Nilai Barang Retur Paket'),
            -1 * $num($fin['refused_goods_value'] ?? 0),
            false,
            -1 * $num($fin['refused_goods_value'] ?? 0),
            -1 * $num($finPrev['refused_goods_value'] ?? 0),
        );
        // Beban nyata paket yang tidak diterima pembeli: ongkir kirim yang
        // sudah ditagih J&T dan biaya layanan COD yang hangus. Pembeli tidak
        // membayar, jadi keduanya keluar dari kas toko.
        // Baris keterangan saja, TIDAK dijumlahkan ke JUMLAH BEBAN TOKO.
        $rowRefusedShip = $money('Ongkir Kirim Ditanggung Toko', -1 * $num($fin['refused_shipping_cost'] ?? 0), false, -1 * $num($finPrev['refused_shipping_cost'] ?? 0));
        // Baris keterangan saja, TIDAK dijumlahkan ke JUMLAH BEBAN TOKO.
        $rowRefusedCod = $money('Biaya Layanan COD Ditanggung Toko', -1 * $num($fin['refused_cod_fee'] ?? 0), false, -1 * $num($finPrev['refused_cod_fee'] ?? 0));
        // Seluruh baris beban yang dijumlahkan berasal dari kolom Tabel
        // Pesanan: ongkir J&T, biaya COD ke J&T, refund, ongkir retur, dan
        // nilai barang retur paket. Dua baris keterangan paket ditolak di
        // bawah sengaja TIDAK ikut: keduanya bagian dari Ongkir ke J&T dan
        // Biaya COD, jadi menjumlahkannya lagi membuat Penjualan Bersih di
        // Excel lebih kecil daripada di layar (temuan audit 2026-09-20).
        // Jumlah beban dibaca dari komponen payload yang sama dengan rumus
        // kolom B, supaya kolom C sebanding dengan kolom B.
        $bebanDari = static function (array $f) use ($num): float {
            return -1 * (
                $num($f['shipping_raw'] ?? 0)
                + $num($f['cod_fee'] ?? 0)
                + $num($f['refund_adjustments'] ?? 0)
                + $num($f['return_shipping_store'] ?? 0)
                + $num($f['refused_goods_value'] ?? 0)
            );
        };
        [$bebanKolomC, $bebanKolomD] = $pasangan($bebanDari($fin), $bebanDari($finPrev));
        $rowBeban = $push(['JUMLAH BEBAN TOKO', '=SUM(B'.$rowOngkirJnt.':B'.$rowRetShip.')+B'.$rowRetDitolak, $bebanKolomC, $bebanKolomD]);
        $this->totalRows[] = $rowBeban;
        $this->registerNumber($rowBeban, 2, '#,##0');

        // ---- III. HASIL BERSIH ----
        $push(['III. HASIL BERSIH']);
        $this->groupRows[] = $r - 1;
        // Penjualan bersih = total dibayar + jumlah beban (beban sudah negatif).
        // Referensi WAJIB baris Jumlah beban yang ditangkap di atas; kalkulasi
        // offset manual pernah menunjuk baris pemisah kosong.
        [$netKolomC, $netKolomD] = $pasangan($num($fin['net_revenue'] ?? 0), $num($finPrev['net_revenue'] ?? 0));
        $rowNet = $push(['PENJUALAN BERSIH', '=B'.$rowGross.'+B'.$rowBeban, $netKolomC, $netKolomD]);
        $this->grandTotalRows[] = $rowNet;
        $this->registerNumber($rowNet, 2, '#,##0');
        $this->noteRows[] = $push(['* Subsidi ongkir sudah termasuk dalam Ongkir ke J&T, tidak dikurangkan dua kali.']);

        // ---- IV. STATUS ARUS KAS ----
        $push(['IV. STATUS ARUS KAS']);
        $this->groupRows[] = $r - 1;
        $money('Transfer Bank Lunas', max($num($fin['payments_received'] ?? 0) - $num($fin['cod_paid'] ?? 0), 0.0), false, max($num($finPrev['payments_received'] ?? 0) - $num($finPrev['cod_paid'] ?? 0), 0.0));
        $money('COD Selesai (barang sudah sampai)', $fin['cod_paid'] ?? null, false, $num($finPrev['cod_paid'] ?? 0));
        $money('Pembayaran Diterima', $fin['payments_received'] ?? null, true, $num($finPrev['payments_received'] ?? 0));
        $money('COD (barang belum sampai)'.$this->penandaCakupan('cod_pending_amount').', '.(int) ($fin['cod_pending_count'] ?? 0).' pesanan', $fin['cod_pending_amount'] ?? null);

        return $rows;
    }
}

// ------ 2. KPI OPERASIONAL TOKO ------

/**
 * Metrik e-commerce per seksi dari payload (I. PENJUALAN s.d. V. RETUR &
 * PEMBATALAN). Kolom B nilai, C pembanding, D perubahan.
 */
class StorePerformanceKpiSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'KPI Operasional Toko';
        $this->columnWidths = ['A' => 48, 'B' => 24, 'C' => 20, 'D' => 16];
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

        $push(['INDIKATOR KINERJA UTAMA (KPI) OPERASIONAL TOKO']);
        $this->bandRows[] = [$r - 1, 'D'];
        $push(['Ragil Aluminium  |  Periode: '.($range['from_date'] ?? '-').' sampai '.($range['to_date'] ?? '-')]);
        $this->bandSubtitleRows[] = [$r - 1, 'D'];
        $push(['']);

        $head = $push(['Keterangan Metrik', 'Periode Ini', 'Periode Sebelumnya', 'Perubahan']);
        $this->columnLabelRows[] = $head;

        $prevHasData = (bool) ($this->payload['previous_has_data'] ?? true);
        $roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

        foreach (($this->payload['sections'] ?? []) as $i => $section) {
            $nomor = $roman[$i] ?? (string) ($i + 1);
            $push([$nomor.'. '.mb_strtoupper((string) ($section['title'] ?? 'RINCIAN'))]);
            $this->groupRows[] = $r - 1;

            foreach ($section['kpis'] as $kpi) {
                $change = $kpi['change_percent'];
                $fmt = $this->kpiNumberFormat((string) ($kpi['format'] ?? 'number'));

                // Metrik snapshot tidak punya pembanding: layarnya menampilkan
                // penanda "kondisi saat ini", jadi ekspornya juga tidak boleh
                // menulis angka 0 atau persentase yang mengesankan perbandingan.
                $punyaPembanding = $prevHasData && ($kpi['previous'] ?? null) !== null;

                $line = $push([
                    $guard($kpi['label']),
                    $guard($kpi['value'] ?? 0),
                    $punyaPembanding ? $guard($kpi['previous']) : 'Tidak ada data',
                    ! $punyaPembanding ? '-' : ($change === null ? 'Baru pada periode ini' : $guard($change)),
                ]);
                $this->registerNumber($line, 2, $fmt);
                if ($punyaPembanding) {
                    $this->registerNumber($line, 3, $fmt);
                    if ($change !== null) {
                        $this->registerNumber($line, 4, '0.0"%"');
                    }
                }
            }
        }

        return $rows;
    }
}

// ------ 3. TABEL PESANAN (Excel Table + Total Row + identitas pembeli) ------

/**
 * 1 baris = 1 pesanan dalam scope omzet, PLUS pesanan Dibatalkan sebagai
 * baris konteks bernilai uang 0 semua (keputusan owner 2026-09-13: batal
 * penting untuk konteks performa, tapi tidak boleh mengubah total; agregat
 * pembatalan tetap di KPI). Excel Table "TabelPesanan" dengan Total Row
 * SUBTOTAL; kolom W-Y membawa identitas pembeli agar tabel mandiri untuk
 * pivot per pelanggan/kota. Kolom Penjualan Bersih berupa rumus alur uang.
 */
class StorePerformanceOrdersSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Tabel Pesanan';
        $this->skipSheetAutoFilter = true;
        $this->textColumns = ['X'];
        $this->columnWidths = [
            'A' => 16, 'B' => 18, 'C' => 18, 'D' => 14, 'E' => 15,
            'F' => 15, 'G' => 14, 'H' => 16, 'I' => 18, 'J' => 15,
            'K' => 16, 'L' => 12, 'M' => 15, 'N' => 19, 'O' => 17,
            'P' => 15, 'Q' => 14, 'R' => 16, 'S' => 17, 'T' => 15,
            'U' => 30, 'V' => 24, 'W' => 22, 'X' => 18, 'Y' => 20,
            'Z' => 18,
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
            'Penjualan Gross',
            'Ongkir ke J&T', 'Refund Retur', 'Ongkir Retur (Toko)',
            'Penjualan Bersih',
            'Uang Sudah Masuk', 'Belum Masuk',
            'Subsidi Ongkir Toko', 'Hemat Pembeli vs Harga Normal',
            'Nama Pelanggan', 'Nomor HP / WA', 'Kota Pengiriman',
            'Nilai Barang Retur Paket',
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
                // Penjualan Bersih per baris = rumus alur uang. Kolom O, P, Q,
                // dan Z (nilai barang retur paket) sudah negatif; kolom M
                // (Biaya COD, positif) dikurangkan.
                '=N{r}-M{r}+O{r}+P{r}+Q{r}+Z{r}',
                $num($row['paid_amount'] ?? 0),
                $num($row['outstanding'] ?? 0),
                $num($row['shipping_subsidy'] ?? 0),
                $num($row['discount'] ?? 0),
                $guard($row['customer_name'] ?? '-'),
                $guard($row['customer_phone'] ?? '-'),
                $guard($row['city'] ?? '-'),
                // Paket yang ditolak kurir sebelum lunas: pengurang Penjualan
                // Bersih. Selalu negatif, sejajar kolom beban lain, supaya
                // rumus Penjualan Bersih per baris menjumlahkan kolom beban
                // tanpa membalik tandanya lagi.
                -1 * $num($row['refused_goods_value'] ?? 0),
            ];

            $rows[] = $out;
            for ($c = 7; $c <= 26; $c++) {
                $this->registerNumber($r, $c, '#,##0');
            }
            $this->trackZeroCells($out, $r);
            $r++;
        }

        return $rows;
    }

    public function afterSheet(AfterSheet $event): void
    {
        // parent::afterSheet() WAJIB dipanggil sebelum pengecatan ulang: loop
        // addTable milik basis membaca $this->excelTables (insiden 2026-09-11).
        $sheet = $event->sheet->getDelegate();
        $count = count($this->payload['income_detail'] ?? []);

        if ($count === 0) {
            parent::afterSheet($event);
            $sheet->getStyle('A1:Z1')->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1B365D']],
            ]);

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
                    '=N{r}-M{r}+O{r}+P{r}+Q{r}+Z{r}'
                )
            );
        }

        // Baris total: label + rumus SUBTOTAL (Total Row bawaan Excel),
        // lalu Excel Table membungkus seluruh rentang termasuk baris total.
        $totalRow = 2 + $count;
        $sheet->setCellValue('A'.$totalRow, 'JUMLAH');
        $sumCols = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'Z'];
        foreach ($sumCols as $col) {
            $sheet->setCellValue($col.$totalRow, '=SUBTOTAL(109,'.$col.'2:'.$col.($totalRow - 1).')');
        }
        foreach ($sumCols as $i => $col) {
            $this->registerNumber($totalRow, $i + 7, '#,##0');
        }

        // Excel Table: rentang A1:Z{totalRow}, Total Row dihidupkan lewat
        // XML (setShowTotalsRow). Kolom uang diberi totalsRowFunction=sum.
        $table = new Table('A1:Z'.$totalRow, $this->tableName('TabelPesanan'));
        $table->setShowTotalsRow(true);

        foreach (range('A', 'Z') as $colLetter) {
            $c = new TableColumn($colLetter, $table);
            if (in_array($colLetter, $sumCols, true)) {
                $c->setTotalsRowFunction('sum');
            }
            $table->setColumn($c);
        }
        // Gaya visual tabel datang dari catatan sel eksplisit (header navy +
        // zebra manual di bawah); PhpSpreadsheet versi ini belum punya API
        // TableStyleInfo, jadi style Table dibiarkan default Excel.
        $this->excelTables[] = $table;

        parent::afterSheet($event);

        // Header Tabel dicat navy (gaya referensi); zebra manual per baris.
        $sheet->getStyle('A1:Z1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FFFFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1B365D']],
        ]);
        for ($row = 2; $row < $totalRow; $row++) {
            if ($row % 2 === 0) {
                $sheet->getStyle('A'.$row.':Z'.$row)->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF8FAFC']],
                ]);
            }
        }
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
            'A' => 16, 'B' => 18, 'C' => 18, 'D' => 48, 'E' => 26,
            'F' => 16, 'G' => 12, 'H' => 18, 'I' => 14,
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
        // parent::afterSheet() WAJIB dipanggil (lihat catatan Tabel Pesanan).
        $sheet = $event->sheet->getDelegate();
        $count = count($this->payload['sold_items'] ?? []);

        if ($count === 0) {
            parent::afterSheet($event);
            $this->paintBands($sheet);

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

        $sheet->getStyle('A1:I1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FFFFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1B365D']],
        ]);
        for ($row = 2; $row < $totalRow; $row++) {
            if ($row % 2 === 0) {
                $sheet->getStyle('A'.$row.':I'.$row)->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF8FAFC']],
                ]);
            }
        }
    }
}

// ------ 5. ANALISIS (agregat non-tabel + SUMIFS ke dua tabel) ------

/**
 * Blok yang TIDAK bisa diturunkan dari Tabel Pesanan/Tabel Item
 * (kunjungan produk, pelanggan, retur) tetap diekspor dari payload.
 * Blok yang bisa (produk terlaris, bauran metode) dihitung dengan
 * SUMIFS/COUNTIFS yang menunjuk tabel; kriteria menunjuk sel SKU di
 * kolom A supaya tetap hidup bila admin mengganti SKU yang dianalisis.
 * Pivot Table asli tidak didukung pustaka penulis XLSX (PhpSpreadsheet
 * tidak punya API pivot); struktur data tabel tetap pivot-ready.
 */
class StorePerformanceAnalysisSheet extends StorePerformanceTableSheet
{
    protected function configure(): void
    {
        $this->sheetTitle = 'Analisis';
        $this->columnWidths = [
            'A' => 20, 'B' => 50, 'C' => 16, 'D' => 22, 'E' => 22,
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
        $push(['ANALISIS PENJUALAN & PERFORMA PRODUK']);
        $this->bandRows[] = [$r - 1, 'E'];
        $push(['Ragil Aluminium  |  Periode: '.($range['from_date'] ?? '-').' sampai '.($range['to_date'] ?? '-')]);
        $this->bandSubtitleRows[] = [$r - 1, 'E'];
        $push(['']);

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

        // ---- I. PRODUK TERLARIS (semua kolom angka berumus ke TabelItem) ----
        $block('I. PRODUK TERLARIS', ['SKU Induk', 'Nama Produk', 'Unit Terjual', 'Nilai Produk Terjual', 'Jumlah Pesanan'], 'E');
        $topAll = $this->payload['top_products'] ?? [];
        $top = array_slice($topAll, 0, 15);
        $firstData = $r;
        if ($top === []) {
            $push(['Tidak ada produk terjual pada periode ini.']);
            $this->noteRows[] = $r - 1;
        }
        foreach ($top as $pr) {
            $sku = (string) ($pr['parent_sku'] ?? '');
            $itemTable = $this->tableName('TabelItem');
            $row = [
                $guard($sku),
                $guard($pr['name'] ?? ''),
                '=SUMIFS('.$itemTable.'[Jumlah],'.$itemTable.'[SKU Induk],$A'.$r.')',
                '=SUMIFS('.$itemTable.'[Subtotal Baris],'.$itemTable.'[SKU Induk],$A'.$r.')',
                '=COUNTIFS('.$itemTable.'[SKU Induk],$A'.$r.')',
            ];
            $line = $push($row);
            $this->registerNumber($line, 3, '#,##0');
            $this->registerNumber($line, 4, '#,##0');
            $this->registerNumber($line, 5, '#,##0');
        }
        if ($r - 1 >= $firstData) {
            $this->zebraRanges[] = [$firstData, $r - 1];
        }
        if (count($topAll) > count($top)) {
            $push(['Menampilkan 15 produk teratas dari '.count($topAll).' produk yang terjual.']);
            $this->noteRows[] = $r - 1;
        }
        $push(['']);

        // ---- II. PRODUK PALING DILIHAT (payload: data klik bukan kolom tabel) ----
        $block('II. PRODUK PALING DILIHAT', ['SKU Induk', 'Nama Produk', 'Dilihat', 'Diklik', 'Total Interaksi'], 'E');
        $viewedAll = $this->payload['product_breakdowns']['most_viewed'] ?? [];
        $viewed = array_slice($viewedAll, 0, 15);
        $firstData = $r;
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
        if ($r - 1 >= $firstData) {
            $this->zebraRanges[] = [$firstData, $r - 1];
        }
        if (count($viewedAll) > count($viewed)) {
            $push(['Menampilkan 15 produk teratas dari '.count($viewedAll).' produk yang pernah dilihat.']);
            $this->noteRows[] = $r - 1;
        }
        $push(['']);

        // ---- III. PELANGGAN TERBAIK (payload: gabungan beberapa pesanan) ----
        $block('III. PELANGGAN TERBAIK', ['Nama Pelanggan', 'Nomor HP', 'Jumlah Pesanan', 'Total Belanja', 'Pesanan Terakhir'], 'E');
        $customers = $this->payload['customers'] ?? [];
        $firstData = $r;
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
        if ($r - 1 >= $firstData) {
            $this->zebraRanges[] = [$firstData, $r - 1];
        }
        $push(['']);

        // ---- IV. BAURAN METODE PEMBAYARAN (COUNTIFS/SUMIFS kolom Metode) ----
        $block('IV. BAURAN METODE PEMBAYARAN', ['Metode', 'Jumlah Pesanan', 'Nilai Penjualan', 'Porsi Nilai'], 'D');
        // Kriteria disamakan dengan label kolom Metode di Tabel Pesanan
        // supaya COUNTIFS tidak pernah mencari teks yang tidak ada.
        $methods = [
            'COD' => 'COD',
            self::LABEL_TRANSFER => self::LABEL_TRANSFER,
        ];
        $rowFirst = null;
        foreach ($methods as $label => $needle) {
            $row = [
                $guard($label),
                '=COUNTIFS('.$this->tableName('TabelPesanan').'[Metode],"'.$needle.'")',
                '=SUMIFS('.$this->tableName('TabelPesanan').'[Penjualan Gross],'.$this->tableName('TabelPesanan').'[Metode],"'.$needle.'")',
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
        $this->zebraRanges[] = [$rowFirst, $rowLast];
        $push(['']);

        // ---- V. BIAYA RETUR DITANGGUNG TOKO (payload: kasus retur) ----
        $block('V. BIAYA RETUR DITANGGUNG TOKO', ['Nomor Pesanan', 'Tanggal Selesai', 'Pihak Penyebab', 'Alasan', 'Ongkir Retur'], 'E');
        $returns = $this->payload['return_shipping_costs'] ?? [];
        $firstData = $r;
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
        if ($r - 1 >= $firstData) {
            $this->zebraRanges[] = [$firstData, $r - 1];
        }

        return $rows;
    }

    protected function styleReportRows($sheet): void
    {
        foreach ($this->columnLabelRows as $row) {
            $sheet->getStyle('A'.$row.':E'.$row)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF334155']],
                'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF94A3B8']]],
            ]);
            $sheet->getRowDimension($row)->setRowHeight(18);
        }

        $this->paintZebra($sheet);

        foreach ($this->noteRows as $row) {
            $sheet->getStyle('A'.$row)->applyFromArray([
                'font' => ['italic' => true, 'size' => 9, 'color' => ['argb' => 'FF666666']],
            ]);
        }

        $this->columnLabelRows = [];
        $this->noteRows = [];

        parent::styleReportRows($sheet);
    }
}

// ------ 6. PANDUAN ------

class StorePerformanceGuideSheet implements FromArray, WithEvents, WithTitle
{
    use RegistersEventListeners;

    public function __construct(protected array $payload, protected ?string $sheetSuffix = null) {}

    public function array(): array
    {
        $range = $this->payload['range'] ?? [];

        return [
            ['PANDUAN PENGGUNAAN LAPORAN PERFORMA TOKO'],
            ['Ragil Aluminium  |  Periode Laporan: '.($range['from_date'] ?? '-').' sampai '.($range['to_date'] ?? '-')],
            [''],
            ['ISI BERKAS', 'Berkas terdiri dari 6 bagian. Ringkasan Finansial: laba rugi bertingkat dan posisi arus kas. KPI Operasional Toko: metrik penjualan, kunjungan, operasional, pembayaran, retur, dan pembatalan. Tabel Pesanan dan Tabel Item: rincian satu baris per pesanan dan per item, yang menjadi sumber angka bagian lain. Analisis: ringkasan yang tidak bisa dihitung dari dua tabel itu. Panduan: halaman ini.'],
            ['PERAN DUA TABEL', 'Tabel Pesanan dan Tabel Item bukan salinan laporan pesanan. Keduanya sumber angka Ringkasan Finansial dan Analisis. Bila satu sel diubah, angka di bagian lain ikut menyesuaikan.'],
            ['CARA MEMBACA', 'Mulai dari Ringkasan Finansial. Angka pendapatan dan beban dihitung dari kolom di Tabel Pesanan; klik selnya untuk melihat asalnya. Dua pengecualian: baris arus kas mengikuti tanggal dana benar-benar lunas, dan baris Nilai Barang Retur Paket mengikuti pesanan yang returnya selesai tanpa pernah lunas. Baris JUMLAH di kedua tabel ikut menyesuaikan bila tabel disaring.'],
            ['ALUR UANG', 'Nilai produk terjual dikurangi voucher, ditambah ongkir, asuransi, dan biaya COD yang dibayar pelanggan menghasilkan Penjualan Gross. Dari situ dikurangi ongkir ke J&T, biaya COD ke J&T, refund retur, dan ongkir retur (toko) menghasilkan Penjualan Bersih. Kolom Penjualan Bersih di Tabel Pesanan juga berupa rumus dengan urutan yang sama.'],
            ['DISKON PRODUK', "Kolom 'Hemat Pembeli vs Harga Normal' adalah selisih harga normal dengan harga jual, bukan pengurang tagihan. Nilai produk terjual sudah memakai harga promo yang berlaku."],
            ['SUBSIDI ONGKIR', 'Subsidi ongkir sudah termasuk di dalam Ongkir ke J&T, jadi tidak dikurangkan lagi secara terpisah.'],
            ['ARUS KAS', 'Pembayaran sudah diterima = transfer bank lunas + COD selesai pada periode, dihitung dari tanggal pembayaran (bukan tanggal pesanan dibuat). Sisa COD dihitung terpisah dari pesanan yang barangnya belum sampai, karena sistem menetapkan COD lunas lewat event status pesanan tiba.'],
            ['PENGUNJUNG YANG MEMBELI', 'Dihitung dari jumlah pembeli unik dibagi jumlah pengunjung, bukan jumlah pesanan dibagi pengunjung.'],
            ['PERIODE PEMBANDING', 'Kolom Periode Sebelumnya membandingkan rentang sepanjang periode ini tepat sebelumnya. Bila rentang itu belum ada datanya, kolom berisi keterangan Tidak ada data.'],
            ['PESANAN DIBATALKAN', 'Pesanan yang dibatalkan tetap tampil di Tabel Pesanan dengan seluruh nilai uang dan jumlah 0 (nomor pesanan, tanggal, metode, status, dan pelanggan tetap terdata) supaya konteks pembatalan terlihat tanpa mengubah total. Jumlah, nilai, dan rasio pembatalan ada di KPI seksi Retur & Pembatalan; rincian transaksinya ada di Laporan Pesanan.'],
            ['DETAIL PELANGGAN', 'Identitas pembeli (nama, nomor HP atau WhatsApp, kota) tersedia di Tabel Pesanan pada kolom Detail Pelanggan, dan ringkasan per pelanggan ada di bagian Pelanggan Terbaik pada Analisis. Nomor HP disimpan sebagai teks agar digitnya tidak berubah.'],
            ['BAURAN PEMBAYARAN', 'Metode pembayaran ditampilkan sebagai COD dan Transfer Bank, sama dengan kolom Metode di Tabel Pesanan. Porsi nilai dihitung dari nilai penjualan tiap metode dibagi total seluruh metode.'],
            ['ANALISIS', 'Bagian Produk Terlaris menghitung Unit Terjual, Nilai Produk Terjual, dan Jumlah Pesanan langsung dari Tabel Item, dikelompokkan menurut SKU Induk sehingga tetap benar bila barisnya diubah. Untuk menyusun data menurut SKU, metode pembayaran, atau status, gunakan fitur tabel dinamis milik Excel dengan sumber Tabel Pesanan atau Tabel Item.'],
            ['FORMAT ANGKA', 'Semua kolom uang berupa angka polos tanpa Rp sehingga aman dijumlahkan. Sel yang memang tidak punya nilai dibiarkan kosong.'],
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

        $sheet->mergeCells('A1:B1');
        $sheet->getStyle('A1:B1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FFFFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1B365D']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        $sheet->mergeCells('A2:B2');
        $sheet->getStyle('A2:B2')->applyFromArray([
            'font' => ['size' => 9, 'color' => ['argb' => 'FFFFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF2E5B88']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension(2)->setRowHeight(18);

        $last = $sheet->getHighestRow();
        for ($r = 4; $r <= $last; $r++) {
            $sheet->getStyle('A'.$r.':B'.$r)->applyFromArray([
                'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
                'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_TOP],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFCBD5E1']]],
            ]);
            if ($r % 2 === 0) {
                $sheet->getStyle('B'.$r)->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF8FAFC']],
                ]);
            }
            $sheet->getStyle('A'.$r)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF1B365D']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF1F5F9']],
            ]);
            $sheet->getRowDimension($r)->setRowHeight(42);
        }

        $sheet->getColumnDimension('A')->setWidth(28);
        $sheet->getColumnDimension('B')->setWidth(100);
    }
}
