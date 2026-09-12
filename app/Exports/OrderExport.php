<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Models\Order;
use App\Support\ExportSafety;
use App\Support\OrderEventLabels;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Export pesanan mengikuti TEMPLATE OWNER v3 (Laporan_Performa_Toko_Lengkap_
 * Ragil_Aluminium_v3.xlsx, kontrak owner 2026-09-12): 3 sheet, format dan
 * rumus dipertahankan persis, hanya gaya yang ikut merek Ragil (merah).
 *
 *  1. 'Laporan Transaksi (Skema A)' -> 1 baris = 1 item; kolom pesanan
 *     (voucher/subsidi/ongkir/COD/V/W/AA) diulang sebagai referensi dan
 *     TIDAK di-SUM vertikal. Rumus bawaan: N=L-M, P=M*O, Q=N*O, V dan W
 *     dan AA sesuai template; baris TOTAL hanya O/P/Q.
 *  2. 'Rekap Keuangan per Pesanan' -> 1 baris = 1 pesanan; E/F/G menarik
 *     sheet 1 lewat SUMIF; TOTAL SUM E:R (sesuai template).
 *  3. 'Panduan & Kamus Lengkap' -> kamus kolom owner.
 *
 * Sumber data: sistem Ragil (orders, order_items, payments, shipping_records,
 * order_return_cases, voucher_discount_amount). Berat (kg) dan Volume memakai
 * FORMAT MODUL PENGIRIMAN (keputusan owner): snapshot paket yang direkam saat
 * order dibuat (shipping_chargeable_weight_kg + shipping_package_snapshot ->
 * berat tagih max(aktual, volumetrik P x L x T / 5000) dan dimensi luar pallet
 * allowance 3 cm/sisi). Order yang dibuat sebelum snapshot ada tetap "-":
 * tidak dihitung retroaktif supaya angka historis tidak berubah.
 *
 * Urutan baris: pesanan terbaru dulu (persis template owner).
 */
class OrderExport implements WithMultipleSheets
{
    public const SHEET_TX = 'Laporan Transaksi (Skema A)';

    public const SHEET_REKAP = 'Rekap Keuangan per Pesanan';

    public const SHEET_GUIDE = 'Panduan & Kamus Lengkap';

    public function __construct(protected Builder $query)
    {
    }

    public function sheets(): array
    {
        $blocks = $this->blocks();

        return [
            new OrderTxSheet($blocks),
            new OrderRekapSheet($blocks),
            new OrderGuideSheet(),
        ];
    }

    /**
     * Kumpulkan pesanan + item jadi blok per pesanan (urutan terbaru dulu).
     *
     * @return list<array<string, mixed>>
     */
    protected function blocks(): array
    {
        ExportSafety::assertQueryWithinLimit($this->query);

        $orders = (clone $this->query)
            ->with([
                'items:id,order_id,parent_sku,variant_sku,name,variation_1_name,variation_1_option,variation_2_name,variation_2_option,unit_price,quantity,line_discount,discount_source',
                'payments:id,order_id,status,paid_at',
                'shippingRecords:id,order_id,waybill_number',
                'returnCases:id,order_id,status,resolution_type,reason,refund_amount,additional_shipping_amount',
            ])
            ->latest('created_at')
            ->latest('id')
            ->get();

        $blocks = [];
        foreach ($orders as $order) {
            $paidAt = $order->payments->firstWhere('status', 'completed')?->paid_at;

            $completedCase = $order->returnCases->firstWhere('status', 'completed');
            $runningCase = $order->returnCases->firstWhere('status', 'open');
            $refund = (float) ($completedCase->refund_amount ?? 0);
            $returOngkir = (float) ($completedCase->additional_shipping_amount ?? 0);

            $returnType = '-';
            if ($runningCase) {
                $returnType = 'Retur diproses ('.($runningCase->reason ?? '-').')';
            } elseif ($completedCase) {
                $rt = $completedCase->resolution_type === 'replacement' ? 'Ganti barang' : 'Refund';
                $returnType = $rt.' ('.($completedCase->reason ?? '-').')';
            } elseif ($order->order_status === 'cancelled') {
                $returnType = 'Pesanan dibatalkan';
            }

            // Berat & Volume: FORMAT MODUL PENGIRIMAN (snapshot paket order).
            $chargeKg = null;
            if ($order->shipping_chargeable_weight_kg !== null
                && (float) $order->shipping_chargeable_weight_kg > 0) {
                $chargeKg = round((float) $order->shipping_chargeable_weight_kg, 2);
            }
            $snap = is_array($order->shipping_package_snapshot ?? null) ? $order->shipping_package_snapshot : [];
            $pL = (float) ($snap['length_cm'] ?? 0);
            $pW = (float) ($snap['width_cm'] ?? 0);
            $pH = (float) ($snap['height_cm'] ?? 0);
            $volume = ($pL > 0 && $pW > 0 && $pH > 0)
                ? round($pL).' x '.round($pW).' x '.round($pH).' cm'
                : '-';

            $items = [];
            foreach ($order->items as $item) {
                $variations = collect([
                    $item->variation_1_name ? $item->variation_1_name.': '.$item->variation_1_option : null,
                    $item->variation_2_name ? $item->variation_2_name.': '.$item->variation_2_option : null,
                ])->filter()->implode(', ');

                // Harga Normal (L) = harga jual + diskon garis (contoh sel
                // owner: 5.750.000 = 5.175.000 + 575.000); rumus N=L-M.
                $items[] = [
                    'variant_sku' => $item->variant_sku ?: $item->parent_sku,
                    'name' => $item->name,
                    'variations' => $variations !== '' ? $variations : '-',
                    'discount_source' => $item->discount_source === 'flashsale' ? 'Flashsale' : 'Reguler',
                    'normal' => (float) $item->unit_price + (float) $item->line_discount,
                    'line_discount' => (float) $item->line_discount,
                    'qty' => (int) $item->quantity,
                ];
            }

            $blocks[] = [
                'order_number' => $order->order_number,
                'created_at' => $order->created_at?->timezone('Asia/Jakarta')->format('Y-m-d H:i:s') ?? '-',
                'paid_at' => $paidAt ? $paidAt->timezone('Asia/Jakarta')->format('Y-m-d H:i:s') : '-',
                'status' => OrderEventLabels::orderStatus($order->order_status),
                'waybill' => $order->shippingRecords->first()->waybill_number ?? '-',
                'charge_kg' => $chargeKg,
                'volume' => $volume,
                'voucher' => (float) $order->voucher_discount_amount,
                'subsidi' => (float) $order->shipping_subsidy_amount,
                'ongkir' => (float) $order->shipping_amount,
                'cod' => (float) $order->cod_fee_amount,
                'insurance' => (float) $order->shipping_insurance_amount,
                'return_type' => $returnType,
                'refund' => $refund,
                'retur_ongkir' => $returOngkir,
                'customer_name' => $order->customer_name,
                'customer_phone' => (string) $order->customer_phone,
                'address' => trim(($order->shipping_address_line1 ?? '').' '.($order->shipping_address_line2 ?? '')),
                'village' => $order->shipping_village ?: '-',
                'district' => $order->shipping_district ?: '-',
                'city' => $order->shipping_city,
                'province' => $order->shipping_province,
                'postal' => (string) $order->shipping_postal_code,
                'items' => $items,
            ];
        }

        return $blocks;
    }
}

// ============ SHEET 1: LAPORAN TRANSAKSI (SKEMA A) ============

/**
 * Pita warna per kelompok kolom untuk laporan lebar (template owner v3).
 *
 * Setiap kelompok kolom punya warna baris kelompok, warna baris judul, dan
 * warna zebra sendiri. Inilah yang membuat tabel 35 kolom tetap bisa
 * dipindai mata tanpa kehilangan jejak kolom saat menggeser ke kanan.
 *
 * Satu pita = [kolom awal, kolom akhir, fill baris kelompok, fill baris
 * judul, warna teks kelompok, fill zebra, zebra tetap?].
 */
final class OrderReportBands
{
    /** @var list<array{0:int, 1:int, 2:string, 3:string, 4:string, 5:string, 6:bool}> */
    public const TX = [
        [1, 5, 'FFE2E8F0', 'FF1B365D', 'FF334155', 'FFF8FAFC', false],
        [6, 10, 'FFE0F2FE', 'FF1B365D', 'FF0369A1', 'FFF0F9FF', false],
        [11, 17, 'FFD1E7DD', 'FF1B365D', 'FF065F46', 'FFF0FDF4', false],
        [18, 24, 'FFFEF3C7', 'FF1B365D', 'FF92400E', 'FFFFFBEB', false],
        [25, 27, 'FFFEE2E2', 'FF1B365D', 'FF991B1B', 'FFFEF2F2', false],
        [28, 28, 'FFBBF7D0', 'FF14532D', 'FF166534', 'FFDCFCE7', true],
        [29, 36, 'FFEDE9FE', 'FF1B365D', 'FF5B21B6', 'FFF5F3FF', false],
    ];

    /** @var list<array{0:int, 1:int, 2:string, 3:string, 4:string, 5:string, 6:bool}> */
    public const REKAP = [
        [1, 4, 'FFE2E8F0', 'FF1B365D', 'FF334155', 'FFF8FAFC', false],
        [5, 7, 'FFD1E7DD', 'FF1B365D', 'FF065F46', 'FFF0FDF4', false],
        [8, 9, 'FFFEE2E2', 'FF7F1D1D', 'FF991B1B', 'FFFEF2F2', true],
        [10, 13, 'FFFEF3C7', 'FF1B365D', 'FF92400E', 'FFFFFBEB', false],
        [14, 16, 'FFE0E7FF', 'FF312E81', 'FF3730A3', 'FFEEF2FF', true],
        [17, 18, 'FFFEE2E2', 'FF7F1D1D', 'FF991B1B', 'FFFEF2F2', true],
        [19, 19, 'FFBBF7D0', 'FF14532D', 'FF166534', 'FFDCFCE7', true],
        [20, 22, 'FFEDE9FE', 'FF1B365D', 'FF5B21B6', 'FFF5F3FF', false],
    ];

    /** Warna teks isi tabel (slate 800, sama seperti template). */
    public const BODY_TEXT = 'FF1E293B';

    /**
     * Gambar baris kelompok kolom, baris judul kolom, dan zebra per pita.
     *
     * @param  list<array{0:int, 1:int, 2:string, 3:string, 4:string, 5:string, 6:bool}>  $bands
     */
    public static function paint(
        Worksheet $sheet,
        array $bands,
        int $firstBody,
        int $lastBody,
        string $freeze
    ): void {
        $sheet->getRowDimension(1)->setRowHeight(24);
        $sheet->getRowDimension(2)->setRowHeight(36);

        if ($lastBody >= $firstBody) {
            for ($row = $firstBody; $row <= $lastBody; $row++) {
                $sheet->getRowDimension($row)->setRowHeight(20);
            }
            $sheet->getRowDimension($lastBody + 1)->setRowHeight(24);
        }

        foreach ($bands as [$from, $to, $groupFill, $headerFill, $groupText, $zebraFill, $zebraFixed]) {
            for ($col = $from; $col <= $to; $col++) {
                $letter = Coordinate::stringFromColumnIndex($col);

                $group = $sheet->getStyle($letter.'1');
                $group->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB($groupFill);
                $group->getFont()->setBold(true)->setSize(10)->getColor()->setARGB($groupText);
                $group->getAlignment()
                    ->setHorizontal(Alignment::HORIZONTAL_CENTER)
                    ->setVertical(Alignment::VERTICAL_CENTER);

                $head = $sheet->getStyle($letter.'2');
                $head->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB($headerFill);
                $head->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FFFFFFFF');
                $head->getAlignment()
                    ->setHorizontal(Alignment::HORIZONTAL_CENTER)
                    ->setVertical(Alignment::VERTICAL_CENTER)
                    ->setWrapText(true);

                for ($row = $firstBody; $row <= $lastBody; $row++) {
                    if ($zebraFixed) {
                        $fill = $zebraFill;
                    } else {
                        $fill = $row % 2 === 1 ? 'FFFFFFFF' : $zebraFill;
                    }

                    $body = $sheet->getStyle($letter.$row);
                    $body->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB($fill);
                    $body->getFont()->setSize(10)->getColor()->setARGB(self::BODY_TEXT);
                    $body->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                }
            }
        }

        $sheet->freezePane($freeze);
    }
}

class OrderTxSheet extends RagilStyledExport implements FromArray
{
    protected const WIDTHS = [
        'A' => 16, 'B' => 18, 'C' => 18, 'D' => 14, 'E' => 16,
        'F' => 28, 'G' => 46, 'H' => 28, 'I' => 12, 'J' => 12,
        'K' => 16, 'L' => 20, 'M' => 18, 'N' => 18, 'O' => 8,
        'P' => 20, 'Q' => 24, 'R' => 20, 'S' => 22, 'T' => 20,
        'U' => 20, 'V' => 20, 'W' => 24, 'X' => 24, 'Y' => 20,
        'Z' => 18, 'AA' => 18, 'AB' => 24, 'AC' => 22, 'AD' => 18,
        'AE' => 40, 'AF' => 18, 'AG' => 18, 'AH' => 22, 'AI' => 18,
        'AJ' => 12,
    ];

    protected const GROUPS = [
        ['A1', 'E1', '1. IDENTITAS PESANAN & WAKTU'],
        ['F1', 'J1', '2. SPESIFIKASI PRODUK & DIMENSI'],
        ['K1', 'Q1', '3. RINCIAN HARGA & DISKON (Aman Di-SUM & Dibuat Pivot)'],
        ['R1', 'X1', '4. BEBAN TOKO, ONGKIR, COD & ASURANSI (Header Repeat - JANGAN Di-SUM)'],
        ['Y1', 'AA1', '5. STATUS RETUR & REFUND'],
        ['AB1', 'AB1', '6. HASIL BERSIH'],
        ['AC1', 'AJ1', '7. DETAIL PELANGGAN & ALAMAT PENGIRIMAN (DI PALING AKHIR)'],
    ];

    protected const HEADERS = [
        'Nomor Pesanan', 'Tanggal Pesanan', 'Tanggal Bayar Cair', 'Status Pesanan', 'No. Resi J&T',
        'SKU Varian', 'Nama Produk', 'Variasi Kusen & Kaca', 'Berat (kg)', 'Volume',
        'Sumber Diskon', 'Harga Produk (Normal)', 'Diskon per Produk', 'Harga Jual Satuan', 'Qty',
        'Total Diskon Produk', 'Subtotal Penjualan Produk',
        'Voucher Pesanan (Beban Toko)', 'Subsidi Ongkir Toko (Beban Toko)', 'Ongkir Ditanggung Pembeli',
        'Biaya COD Ditanggung Pembeli', 'Asuransi Pengiriman Dibayar Pembeli',
        'Total Tagihan Dibayar Pembeli', 'Pengurangan Nilai Pesanan ke J&T',
        'Kasus Retur / Alasan', 'Nilai Refund Pembeli', 'Ongkir Retur Tambahan',
        'Net Profit Toko (Kas Bersih)',
        'Nama Pelanggan', 'No. Telepon / WA', 'Alamat Pengiriman', 'Kelurahan / Desa',
        'Kecamatan', 'Kabupaten / Kota', 'Provinsi', 'Kode Pos',
    ];

    public function __construct(protected array $blocks)
    {
        $this->sheetTitle = OrderExport::SHEET_TX;
        $this->skipSheetAutoFilter = true;
        $this->skipDefaultHeaderStyle = true;
        $this->skipZebra = true;
        $this->firstBodyRow = 3;
        // Kolom uang: angka polos #,##0 (pivot-friendly). Berat (I) terpisah
        // karena memakai desimal (2 angka) sesuai berat tagih pengiriman.
        $this->currencyColumns = ['L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Z', 'AA', 'AB'];
        $this->currencyFormat = '#,##0';
        // Nomor pesanan, nomor resi J&T, SKU varian, telepon, dan kode pos
        // adalah identitas: harus teks, bukan angka.
        $this->textColumns = ['A', 'E', 'F', 'AD', 'AJ'];
        $this->columnWidths = self::WIDTHS;
    }

    public function array(): array
    {
        $first = 3;

        $out = [
            self::groupRow(),
            self::HEADERS,
        ];

        $rows = [];
        $r = $first;
        foreach ($this->blocks as $b) {
            foreach ($b['items'] as $item) {
                $rows[] = [$item, $b, $r];
                $r++;
            }
        }
        $lastItem = max($first, $r - 1);
        $rangeA = "\$A\${$first}:\$A\${$lastItem}";
        $rangeQ = "\$Q\${$first}:\$Q\${$lastItem}";

        foreach ($rows as [$item, $b, $r]) {
            $out[] = [
                    $b['order_number'], $b['created_at'], $b['paid_at'], $b['status'], $b['waybill'],
                    $item['variant_sku'], $item['name'], $item['variations'],
                    $b['charge_kg'] ?? '-', $b['volume'],
                    $item['discount_source'], $item['normal'], $item['line_discount'],
                    "=L{$r}-M{$r}", $item['qty'],
                    "=M{$r}*O{$r}", "=N{$r}*O{$r}",
                    $b['voucher'], $b['subsidi'], $b['ongkir'], $b['cod'], $b['insurance'],
                    "=IF(D{$r}=\"Dibatalkan\", 0, SUMIF({$rangeA}, A{$r}, {$rangeQ}) - R{$r} + T{$r} + U{$r} + V{$r})",
                    "=(T{$r}+S{$r})+U{$r}+V{$r}",
                    $b['return_type'], $b['refund'], $b['retur_ongkir'],
                    "=IF(D{$r}=\"Dibatalkan\", 0 - AA{$r}, W{$r}-X{$r}-Z{$r}-AA{$r})",
                    $b['customer_name'], $b['customer_phone'], $b['address'], $b['village'],
                    $b['district'], $b['city'], $b['province'], $b['postal'],
            ];
            $this->trackZeroCells($out[count($out) - 1], $r);
        }

        // Baris TOTAL: hanya O/P/Q (aturan owner, kolom pesanan lewat Rekap).
        $total = array_fill(0, count(self::HEADERS), null);
        $total[0] = 'TOTAL';
        $total[14] = "=SUM(O{$first}:O{$lastItem})";
        $total[15] = "=SUM(P{$first}:P{$lastItem})";
        $total[16] = "=SUM(Q{$first}:Q{$lastItem})";
        // Kolom pesanan R..AB -> penanda lihat Rekap (persis template).
        foreach (['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB'] as $i => $col) {
            $total[17 + $i] = '[Lihat Tab Rekap]';
        }
        $out[] = $total;

        return $out;
    }

    public static function groupRow(): array
    {
        $row = array_fill(0, count(self::HEADERS), '');
        foreach (self::GROUPS as [$a, $b, $label]) {
            $row[\PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString(preg_replace('/\d+/', '', $a)) - 1] = $label;
        }

        return $row;
    }

    public function afterSheet(AfterSheet $event): void
    {
        parent::afterSheet($event);
        $sheet = $event->sheet->getDelegate();
        $lastRow = $sheet->getHighestRow();

        // Baris 1 (kelompok kolom) + baris 2 (judul kolom) mengikuti
        // template owner v3: tiap kelompok kolom punya pitanya sendiri.
        foreach (self::GROUPS as [$a, $b]) {
            if ($a !== $b) {
                $sheet->mergeCells("{$a}:{$b}");
            }
        }

        OrderReportBands::paint($sheet, OrderReportBands::TX, 3, $lastRow - 1, 'F3');

        // Garis tipis mulai baris judul; baris kelompok dibiarkan bersih.
        $sheet->getStyle("A2:AJ{$lastRow}")->getBorders()->getAllBorders()->applyFromArray([
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['argb' => 'FFCBD5E1'],
        ]);
        $sheet->getStyle('A1:AJ1')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_NONE);

        if ($lastRow < 3) {
            return;
        }

        // Perataan per kolom: identitas & teks tengah, nama/alamat kiri,
        // uang kanan (persis template).
        foreach (['B', 'C', 'D', 'E', 'F', 'I', 'J', 'K', 'O', 'Y', 'AD', 'AJ'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        }
        foreach (['G', 'H', 'AC', 'AE', 'AF', 'AG', 'AH', 'AI'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        }
        foreach (['L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Z', 'AA', 'AB'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }

        // Nomor pesanan dan kolom uang kunci ditebalkan seperti template.
        $sheet->getStyle("A3:A{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("A3:A{$lastRow}")->getFont()->setBold(true);
        foreach (['N', 'O', 'P', 'Q', 'W', 'X', 'AB'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getFont()->setBold(true);
        }

        // Berat (kg): desimal bebas (22,45 tampil penuh; "-" tetap teks).
        $sheet->getStyle("I3:I{$lastRow}")->getNumberFormat()->setFormatCode('0.##');

        // Baris TOTAL: hanya angka kunci yang tebal, sisanya normal, dan
        // kolom pesanan diisi penunjuk ke tab Rekap (persis template).
        $totalRow = "A{$lastRow}:AJ{$lastRow}";
        $sheet->getStyle($totalRow)->getFont()->setBold(false)->setSize(11)->getColor()->setARGB('FF000000');
        $sheet->getStyle($totalRow)->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_GENERAL)
            ->setVertical(Alignment::VERTICAL_BOTTOM);
        $sheet->getStyle($totalRow)->getNumberFormat()->setFormatCode('General');
        // Per sel: penghapusan lewat rentang tidak membersihkan sisi dalam.
        for ($col = 1; $col <= count(self::HEADERS); $col++) {
            $sheet->getStyle(Coordinate::stringFromColumnIndex($col).$lastRow)->getBorders()->applyFromArray([
                'left' => ['borderStyle' => Border::BORDER_NONE],
                'right' => ['borderStyle' => Border::BORDER_NONE],
                'top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF0F172A']],
                'bottom' => ['borderStyle' => Border::BORDER_DOUBLE, 'color' => ['argb' => 'FF0F172A']],
            ]);
        }

        foreach (['A', 'O'] as $col) {
            $sheet->getStyle("{$col}{$lastRow}")->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1E293B');
            $sheet->getStyle("{$col}{$lastRow}")->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
        }
        foreach (['P', 'Q'] as $col) {
            $sheet->getStyle("{$col}{$lastRow}")->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1E293B');
            $sheet->getStyle("{$col}{$lastRow}")->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_RIGHT)->setVertical(Alignment::VERTICAL_CENTER);
        }
        $sheet->getStyle("O{$lastRow}:Q{$lastRow}")->getNumberFormat()->setFormatCode('#,##0');
        foreach (['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB'] as $col) {
            $sheet->getStyle("{$col}{$lastRow}")->getFont()->setSize(9)->getColor()->setARGB('FF64748B');
            $sheet->getStyle("{$col}{$lastRow}")->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
        }

        $sheet->freezePane('F3');
    }
}

// ============ SHEET 2: REKAP KEUANGAN PER PESANAN ============

class OrderRekapSheet extends RagilStyledExport implements FromArray
{
    protected const WIDTHS = [
        'A' => 16, 'B' => 18, 'C' => 18, 'D' => 14,
        'E' => 20, 'F' => 20, 'G' => 24,
        'H' => 16, 'I' => 18,
        'J' => 20, 'K' => 22, 'L' => 24,
        'M' => 20, 'N' => 18, 'O' => 22,
        'P' => 18, 'Q' => 18, 'R' => 18,
        'S' => 26,
        'T' => 22, 'U' => 18, 'V' => 22,
    ];

    protected const GROUPS = [
        ['A1', 'D1', '1. IDENTITAS PESANAN'],
        ['E1', 'G1', '2. PENJUALAN PRODUK (DARI SHEET 1)'],
        ['H1', 'I1', '3. BEBAN TOKO'],
        ['J1', 'M1', '4. PEMBAYARAN PEMBELI (UANG MASUK)'],
        ['N1', 'P1', '5. PENGURANGAN PESANAN (KE J&T)'],
        ['Q1', 'R1', '6. RETUR & REFUND'],
        ['S1', 'S1', '7. HASIL AKHIR'],
        ['T1', 'V1', '8. DETAIL PELANGGAN (DI PALING AKHIR)'],
    ];

    protected const HEADERS = [
        'Nomor Pesanan', 'Tanggal Pesanan', 'Tanggal Bayar Cair', 'Status Pesanan',
        'Total Nilai Normal', 'Total Diskon Produk', 'Total Penjualan Produk',
        'Voucher Toko', 'Subsidi Ongkir Toko',
        'Ongkir Dibayar Pembeli', 'Biaya COD Dibayar Pembeli', 'Asuransi Pengiriman Dibayar Pembeli',
        'TOTAL DIBAYAR PEMBELI',
        'Ongkir Total ke J&T', 'Biaya COD ke J&T', 'Total Potongan J&T',
        'Nilai Refund Pembeli', 'Ongkir Retur Toko',
        'NET PROFIT TOKO (KAS BERSIH)',
        'Nama Pelanggan', 'No. Telepon / WA', 'Kabupaten / Kota',
    ];

    public function __construct(protected array $blocks)
    {
        $this->sheetTitle = OrderExport::SHEET_REKAP;
        $this->skipSheetAutoFilter = true;
        $this->skipDefaultHeaderStyle = true;
        $this->skipZebra = true;
        $this->firstBodyRow = 3;
        $this->currencyColumns = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'];
        $this->currencyFormat = '#,##0';
        // Nomor pesanan dan telepon pelanggan adalah identitas: harus teks.
        $this->textColumns = ['A', 'U'];
        $this->columnWidths = self::WIDTHS;
    }

    public function array(): array
    {
        $firstOrder = 3;
        $firstItem = 3;
        $lastItem = $firstItem + max(0, array_sum(array_map(fn ($b) => count($b['items']), $this->blocks))) - 1;
        $lastItem = max($lastItem, $firstItem);
        $src = "'".OrderExport::SHEET_TX."'!";
        $rangeA = $src."\$A\${$firstItem}:\$A\${$lastItem}";
        $rangeP = $src."\$P\${$firstItem}:\$P\${$lastItem}";
        $rangeQ = $src."\$Q\${$firstItem}:\$Q\${$lastItem}";

        $out = [
            [
                '1. IDENTITAS PESANAN', '', '', '',
                '2. PENJUALAN PRODUK (DARI SHEET 1)', '', '',
                '3. BEBAN TOKO', '',
                '4. PEMBAYARAN PEMBELI (UANG MASUK)', '', '', '',
                '5. PENGURANGAN PESANAN (KE J&T)', '', '',
                '6. RETUR & REFUND', '',
                '7. HASIL AKHIR',
                '8. DETAIL PELANGGAN (DI PALING AKHIR)', '', '',
            ],
            self::HEADERS,
        ];

        $r = $firstOrder;
        foreach ($this->blocks as $b) {
            $out[] = [
                $b['order_number'], $b['created_at'], $b['paid_at'], $b['status'],
                "=F{$r}+G{$r}",
                "=SUMIF({$rangeA}, A{$r}, {$rangeP})",
                "=SUMIF({$rangeA}, A{$r}, {$rangeQ})",
                $b['voucher'], $b['subsidi'],
                $b['ongkir'], $b['cod'], $b['insurance'],
                "=IF(D{$r}=\"Dibatalkan\", 0, G{$r}-H{$r}+J{$r}+K{$r}+L{$r})",
                "=I{$r}+J{$r}", "=K{$r}", "=N{$r}+O{$r}+L{$r}",
                $b['refund'], $b['retur_ongkir'],
                "=IF(D{$r}=\"Dibatalkan\", 0 - Q{$r}, M{$r}-P{$r}-Q{$r}-R{$r})",
                $b['customer_name'], $b['customer_phone'], $b['city'],
            ];
            $this->trackZeroCells($out[count($out) - 1], $r);
            $r++;
        }

        $last = max($firstOrder, $r - 1);
        $total = array_fill(0, count(self::HEADERS), null);
        $total[0] = 'TOTAL';
        foreach (['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'] as $i => $col) {
            $total[4 + $i] = "=SUM({$col}{$firstOrder}:{$col}{$last})";
        }
        $out[] = $total;

        return $out;
    }

    public function afterSheet(AfterSheet $event): void
    {
        parent::afterSheet($event);
        $sheet = $event->sheet->getDelegate();
        $lastRow = $sheet->getHighestRow();

        foreach (self::GROUPS as [$a, $b]) {
            if ($a !== $b) {
                $sheet->mergeCells("{$a}:{$b}");
            }
        }

        OrderReportBands::paint($sheet, OrderReportBands::REKAP, 3, $lastRow - 1, 'E3');

        $sheet->getStyle("A2:V{$lastRow}")->getBorders()->getAllBorders()->applyFromArray([
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['argb' => 'FFCBD5E1'],
        ]);
        $sheet->getStyle('A1:V1')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_NONE);

        if ($lastRow < 3) {
            return;
        }

        // Kolom TOTAL DIBAYAR PEMBELI selalu disorot amber (uang masuk).
        $sheet->getStyle("M3:M".($lastRow - 1))->getFill()
            ->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFEF3C7');

        foreach (['B', 'C', 'D', 'U'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        }
        foreach (['T', 'V'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        }
        foreach (['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }

        $sheet->getStyle("A3:A{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("A3:A{$lastRow}")->getFont()->setBold(true);
        foreach (['G', 'M', 'P', 'S'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getFont()->setBold(true);
        }

        // Baris TOTAL: kolom kunci disorot, angka tebal, garis bawah ganda.
        $sheet->getStyle("G{$lastRow}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFA7F3D0');
        $sheet->getStyle("M{$lastRow}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFDE68A');
        $sheet->getStyle("S{$lastRow}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF86EFAC');

        $totalRow = "A{$lastRow}:V{$lastRow}";
        $sheet->getStyle($totalRow)->getFont()->setBold(false)->setSize(11)->getColor()->setARGB('FF000000');
        $sheet->getStyle($totalRow)->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_GENERAL)
            ->setVertical(Alignment::VERTICAL_BOTTOM);
        $sheet->getStyle($totalRow)->getNumberFormat()->setFormatCode('General');
        // Per sel: penghapusan lewat rentang tidak membersihkan sisi dalam.
        for ($col = 1; $col <= count(self::HEADERS); $col++) {
            $sheet->getStyle(Coordinate::stringFromColumnIndex($col).$lastRow)->getBorders()->applyFromArray([
                'left' => ['borderStyle' => Border::BORDER_NONE],
                'right' => ['borderStyle' => Border::BORDER_NONE],
                'top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF0F172A']],
                'bottom' => ['borderStyle' => Border::BORDER_DOUBLE, 'color' => ['argb' => 'FF0F172A']],
            ]);
        }

        $sheet->getStyle("A{$lastRow}")->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1E293B');
        $sheet->getStyle("A{$lastRow}")->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
        foreach (['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'] as $col) {
            $sheet->getStyle("{$col}{$lastRow}")->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1E293B');
            $sheet->getStyle("{$col}{$lastRow}")->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_RIGHT)->setVertical(Alignment::VERTICAL_CENTER);
        }
        $sheet->getStyle("E{$lastRow}:S{$lastRow}")->getNumberFormat()->setFormatCode('#,##0');

        $sheet->freezePane('E3');
    }
}

// ============ SHEET 3: PANDUAN & KAMUS LENGKAP ============

class OrderGuideSheet implements FromArray, WithTitle, WithEvents
{
    use \Maatwebsite\Excel\Concerns\RegistersEventListeners;

    public function array(): array
    {
        return [
            ['KAMUS KOLOM & PANDUAN PENGOPERASIAN LAPORAN (RAGIL ALUMINIUM)'],
            [''],
            ['1. Nomor Pesanan (order_number)', 'Kode unik transaksi pesanan. Pada pesanan dengan multi-item (beberapa produk), nomor pesanan ini akan berulang (Skema A).'],
            ['2. Tanggal Pesanan (created_at)', 'Waktu saat pembeli membuat pesanan di sistem toko online.'],
            ['3. Tanggal Bayar Cair (paid_at)', 'Waktu saat pembayaran pesanan telah terkonfirmasi lunas dan masuk ke saldo toko (krusial untuk monitoring arus kas cair).'],
            ['4. Status Pesanan (order_status)', 'Status operasional terkini: Diproses, Selesai, atau Dibatalkan.'],
            ['5. No. Resi J&T (waybill_number)', 'Nomor Air Waybill (AWB) dari kurir J&T untuk bukti pengiriman fisik dan pelacakan paket. Disimpan dalam format Teks karena resi J&T murni angka: sebagai angka, Excel menampilkannya sebagai notasi ilmiah (2,01719E+11) dan digit di atas 15 bisa dibulatkan.'],
            ['6. SKU Varian (variant_sku)', 'Kode unik kombinasi model dan varian. Digunakan untuk melacak pergerakan stok per jenis.'],
            ['7. Nama Produk & Variasi', 'Nama model barang dan varian detailnya (contoh: Warna: Putih, Kaca: Kaca Es). Dipisah kolomnya agar memudahkan Pivot Table varian.'],
            ['8. Berat (kg) & Volume', 'Mengikuti format modul pengiriman: berat tagih paket (max berat aktual vs volumetrik P x L x T / 5000, pallet kayu allowance 3 cm/sisi) dan dimensi luar paket, sebagai snapshot yang direkam saat order dibuat. Tanda "-" berarti order dibuat sebelum sistem menyimpan snapshot; nilai lama tidak dihitung ulang agar angka historis tidak berubah.'],
            ['9. Sumber Diskon (discount_source)', 'Jenis promo yang berlaku (misal: Reguler, Flash Sale, Promo Toko).'],
            ['10. Harga Produk (Normal)', 'Harga katalog normal sebelum promo (harga jual + diskon garis produk).'],
            ['11. Diskon per Produk (line_discount)', 'Potongan harga yang disetting khusus pada produk tersebut untuk menurunkan margin harga normal.'],
            ['12. Harga Jual Satuan', 'Harga riil setelah diskon per unit: [Harga Normal] - [Diskon per Produk].'],
            ['13. Qty (quantity)', 'Jumlah unit fisik barang yang dibeli.'],
            ['14. Total Diskon Produk', 'Total penghematan diskon produk pada baris tersebut: [Diskon per Produk] x [Qty].'],
            ['15. Subtotal Penjualan Produk', 'Nilai penjualan bersih barang sebelum biaya pesanan: [Harga Jual Satuan] x [Qty]. Kolom ini aman di-SUM dan dipakai Pivot Table untuk performa produk.'],
            ['16. Voucher Pesanan (Beban Toko)', 'Kupon diskon keranjang belanja yang ditanggung toko. Berlaku per nomor pesanan, bukan per produk.'],
            ['17. Subsidi Ongkir Toko (Beban Toko)', 'Bagian ongkir yang ditanggung penjual/toko ke ekspedisi J&T. Merupakan beban riil pengurang laba toko.'],
            ['18. Ongkir Ditanggung Pembeli', 'Tarif ongkir kurir sesudah dipotong subsidi toko. Dibayar oleh pembeli saat checkout / bayar di tempat.'],
            ['19. Biaya COD Ditanggung Pembeli', 'Fee penanganan COD yang dibebankan kepada pembeli. Dibayar oleh pembeli ke kurir J&T saat serah terima barang.'],
            ['20. Asuransi Pengiriman Dibayar Pembeli (shipping_insurance_amount)', 'Biaya asuransi paket yang dibayar pembeli, dihitung J&T dari NILAI BARANG yang diasuransikan (sekitar 0,2% dengan minimum Rp 5.000). Bersifat opsional: muncul sebagai pilihan di checkout, dan hanya ditagihkan bila pembeli memilihnya. Termasuk uang titipan: masuk di tagihan pembeli lalu dipotong utuh oleh J&T.'],
            ['21. Total Tagihan Dibayar Pembeli', 'Total uang yang ditagih kurir ke pembeli: [Total Penjualan Produk] - [Voucher] + [Ongkir Pembeli] + [Biaya COD] + [Asuransi Pengiriman].'],
            ['22. Pengurangan Nilai Pesanan ke J&T', 'Total saldo yang dipotong oleh pihak J&T: [Ongkir Total (Subsidi + Ongkir Pembeli)] + [Biaya COD] + [Asuransi Pengiriman].'],
            ['23. Kasus Retur / Alasan (return_case)', 'Keterangan alasan kendala pesanan (misal: Refund (rusak), Pesanan dibatalkan, atau -).'],
            ['24. Nilai Refund Pembeli (refund_amount)', 'Uang yang dikembalikan ke pembeli jika terjadi klaim barang rusak atau batal.'],
            ['25. Ongkir Retur Tambahan (additional_shipping)', 'Biaya kirim balik dari pembeli ke toko yang dibebankan ke toko jika terjadi retur komplain.'],
            ['26. Net Profit Toko (Kas Bersih)', 'Uang bersih yang dicairkan ke rekening toko: [Total Tagihan Dibayar Pembeli] - [Pengurangan Nilai Pesanan ke J&T] - [Refund] - [Ongkir Retur]. Hasilnya sama persis dengan: [Total Penjualan Produk] - [Voucher] - [Subsidi Ongkir] - [Refund] - [Ongkir Retur].'],
            ['27. Nama Pelanggan (customer_name)', 'Nama pembeli / penerima paket yang tertera pada resi dan pesanan.'],
            ['28. No. Telepon / WA (customer_phone)', 'Nomor kontak pelanggan (disimpan dalam format Teks agar angka 0 dan digit panjang tidak terpotong atau berubah eksponensial).'],
            ['29. Alamat Pengiriman (shipping_address)', 'Alamat tujuan pengiriman (jalan, RT/RW, nomor rumah, atau patokan).'],
            ['30. Kelurahan s.d. Provinsi', 'Tingkat wilayah penerima (Desa/Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi). Sangat berguna untuk filter & analisis wilayah pengiriman.'],
            ['31. Kode Pos (shipping_postal_code)', 'Kode pos area pengiriman untuk validasi zona tarif ekspedisi.'],
            ['32. Prinsip COD & Ongkir (Pass-Through)', 'Biaya COD dan Ongkir Pembeli diperlakukan sebagai uang titipan: masuk di tagihan pembeli, lalu keluar utuh dipotong J&T. Dampak netronya Rp 0 terhadap laba toko.'],
            ['33. Aturan Agregasi (SUM di Excel)', 'Di Sheet 1, HANYA kolom Qty, Total Diskon, dan Subtotal Penjualan yang boleh di-SUM vertikal. Kolom tingkat pesanan (Voucher, Ongkir, Net Profit) ditulis sebagai informasi referensi dan tidak boleh di-SUM vertikal agar tidak terjadi pelipatgandaan. Untuk melihat total keuangan toko secara utuh, gunakan Sheet 2 (Rekap Keuangan per Pesanan).'],
        ];
    }

    public function title(): string
    {
        return OrderExport::SHEET_GUIDE;
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        $sheet->mergeCells('A1:B1');
        $sheet->getRowDimension(1)->setRowHeight(28);
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FFFFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1B365D']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);

        $last = $sheet->getHighestRow();
        for ($r = 3; $r <= $last; $r++) {
            $sheet->getRowDimension($r)->setRowHeight(36);
        }

        $sheet->getStyle("A3:A{$last}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FF1E293B']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE2E8F0']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFCBD5E1']]],
        ]);
        $sheet->getStyle("B3:B{$last}")->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF1E293B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFCBD5E1']]],
        ]);

        $sheet->getColumnDimension('A')->setWidth(38);
        $sheet->getColumnDimension('B')->setWidth(105);
    }
}
