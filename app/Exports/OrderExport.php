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
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

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

class OrderTxSheet extends RagilStyledExport implements FromArray
{
    protected const WIDTHS = [
        'A' => 16, 'B' => 19, 'C' => 19, 'D' => 12, 'E' => 17,
        'F' => 26, 'G' => 42, 'H' => 24, 'I' => 11, 'J' => 18,
        'K' => 12, 'L' => 15, 'M' => 14, 'N' => 14, 'O' => 7,
        'P' => 15, 'Q' => 16, 'R' => 14, 'S' => 15, 'T' => 14,
        'U' => 14, 'V' => 17, 'W' => 17, 'X' => 20, 'Y' => 13,
        'Z' => 13, 'AA' => 15, 'AB' => 18, 'AC' => 15, 'AD' => 30,
        'AE' => 14, 'AF' => 14, 'AG' => 18, 'AH' => 14, 'AI' => 10,
    ];

    protected const GROUPS = [
        ['A1', 'E1', '1. IDENTITAS PESANAN & WAKTU'],
        ['F1', 'J1', '2. SPESIFIKASI PRODUK & DIMENSI'],
        ['K1', 'Q1', '3. RINCIAN HARGA & DISKON (Aman Di-SUM & Dibuat Pivot)'],
        ['R1', 'W1', '4. BEBAN TOKO, ONGKIR & COD (Header Repeat - JANGAN Di-SUM)'],
        ['X1', 'Z1', '5. STATUS RETUR & REFUND'],
        ['AA1', 'AA1', '6. HASIL BERSIH'],
        ['AB1', 'AI1', '7. DETAIL PELANGGAN & ALAMAT PENGIRIMAN (DI PALING AKHIR)'],
    ];

    protected const HEADERS = [
        'Nomor Pesanan', 'Tanggal Pesanan', 'Tanggal Bayar Cair', 'Status Pesanan', 'No. Resi J&T',
        'SKU Varian', 'Nama Produk', 'Variasi Kusen & Kaca', 'Berat (kg)', 'Volume',
        'Sumber Diskon', 'Harga Produk (Normal)', 'Diskon per Produk', 'Harga Jual Satuan', 'Qty',
        'Total Diskon Produk', 'Subtotal Penjualan Produk',
        'Voucher Pesanan (Beban Toko)', 'Subsidi Ongkir Toko (Beban Toko)', 'Ongkir Ditanggung Pembeli',
        'Biaya COD Ditanggung Pembeli', 'Total Tagihan Dibayar Pembeli', 'Pengurangan Nilai Pesanan ke J&T',
        'Kasus Retur / Alasan', 'Nilai Refund Pembeli', 'Ongkir Retur Tambahan',
        'Net Profit Toko (Kas Bersih)',
        'Nama Pelanggan', 'No. Telepon / WA', 'Alamat Pengiriman', 'Kelurahan / Desa',
        'Kecamatan', 'Kabupaten / Kota', 'Provinsi', 'Kode Pos',
    ];

    public function __construct(protected array $blocks)
    {
        $this->sheetTitle = OrderExport::SHEET_TX;
        $this->skipSheetAutoFilter = true;
        // Kolom uang: angka polos #,##0 (pivot-friendly). Berat (I) terpisah
        // karena memakai desimal (2 angka) sesuai berat tagih pengiriman.
        $this->currencyColumns = ['L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Y', 'Z', 'AA'];
        $this->currencyFormat = '#,##0';
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
                    $b['voucher'], $b['subsidi'], $b['ongkir'], $b['cod'],
                    "=IF(D{$r}=\"Dibatalkan\", 0, SUMIF({$rangeA}, A{$r}, {$rangeQ}) - R{$r} + T{$r} + U{$r})",
                    "=(T{$r}+S{$r})+U{$r}",
                    $b['return_type'], $b['refund'], $b['retur_ongkir'],
                    "=IF(D{$r}=\"Dibatalkan\", 0 - Z{$r}, V{$r}-W{$r}-Y{$r}-Z{$r})",
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
        // Kolom pesanan R..AA -> penanda lihat Rekap (persis template).
        foreach (['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA'] as $i => $col) {
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

        // Baris 1 + 2 merah merek, teks putih.
        $sheet->getStyle('A1:AI2')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
        ]);
        $sheet->getStyle('A1:A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        foreach (self::GROUPS as [$a, $b]) {
            if ($a !== $b) {
                $sheet->mergeCells("{$a}:{$b}");
            }
        }
        $sheet->getStyle('A1:AI1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('AA1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        // Group header lebih gelap dari header kolom.
        $sheet->getStyle('A1:AI1')->getFill()->setStartColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF8F0000'));

        $sheet->getStyle("A{$lastRow}:AI{$lastRow}")->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => 'FF8F0000']],
        ]);

        // No. Telepon / WA + Kode Pos: format teks (aturan Panduan no. 27).
        $sheet->getStyle("AC3:AC{$lastRow}")->getNumberFormat()->setFormatCode(\PhpOffice\PhpSpreadsheet\Style\NumberFormat::FORMAT_TEXT);
        $sheet->getStyle("AI3:AI{$lastRow}")->getNumberFormat()->setFormatCode(\PhpOffice\PhpSpreadsheet\Style\NumberFormat::FORMAT_TEXT);

        // Berat (kg): desimal bebas (22,45 tampil penuh; "-" tetap teks).
        $sheet->getStyle("I3:I{$lastRow}")->getNumberFormat()->setFormatCode('0.##');
        $sheet->getStyle("I3:I{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

        $sheet->freezePane('A3');
    }
}

// ============ SHEET 2: REKAP KEUANGAN PER PESANAN ============

class OrderRekapSheet extends RagilStyledExport implements FromArray
{
    protected const WIDTHS = [
        'A' => 16, 'B' => 19, 'C' => 19, 'D' => 12,
        'E' => 16, 'F' => 16, 'G' => 18,
        'H' => 13, 'I' => 16,
        'J' => 18, 'K' => 18, 'L' => 20,
        'M' => 16, 'N' => 15, 'O' => 16,
        'P' => 16, 'Q' => 16,
        'R' => 20,
        'S' => 18, 'T' => 15, 'U' => 22,
    ];

    protected const GROUPS = [
        ['A1', 'D1', '1. IDENTITAS PESANAN'],
        ['E1', 'G1', '2. PENJUALAN PRODUK (DARI SHEET 1)'],
        ['H1', 'I1', '3. BEBAN TOKO'],
        ['J1', 'L1', '4. PEMBAYARAN PEMBELI (UANG MASUK)'],
        ['M1', 'O1', '5. PENGURANGAN PESANAN (KE J&T)'],
        ['P1', 'Q1', '6. RETUR & REFUND'],
        ['R1', 'R1', '7. HASIL AKHIR'],
        ['S1', 'U1', '8. DETAIL PELANGGAN (DI PALING AKHIR)'],
    ];

    protected const HEADERS = [
        'Nomor Pesanan', 'Tanggal Pesanan', 'Tanggal Bayar Cair', 'Status Pesanan',
        'Total Nilai Normal', 'Total Diskon Produk', 'Total Penjualan Produk',
        'Voucher Toko', 'Subsidi Ongkir Toko',
        'Ongkir Dibayar Pembeli', 'Biaya COD Dibayar Pembeli', 'TOTAL DIBAYAR PEMBELI',
        'Ongkir Total ke J&T', 'Biaya COD ke J&T', 'Total Potongan J&T',
        'Nilai Refund Pembeli', 'Ongkir Retur Toko',
        'NET PROFIT TOKO (KAS BERSIH)',
        'Nama Pelanggan', 'No. Telepon / WA', 'Kabupaten / Kota',
    ];

    public function __construct(protected array $blocks)
    {
        $this->sheetTitle = OrderExport::SHEET_REKAP;
        $this->skipSheetAutoFilter = true;
        $this->currencyColumns = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];
        $this->currencyFormat = '#,##0';
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
                '4. PEMBAYARAN PEMBELI (UANG MASUK)', '', '',
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
                $b['ongkir'], $b['cod'],
                "=IF(D{$r}=\"Dibatalkan\", 0, G{$r}-H{$r}+J{$r}+K{$r})",
                "=I{$r}+J{$r}", "=K{$r}", "=M{$r}+N{$r}",
                $b['refund'], $b['retur_ongkir'],
                "=IF(D{$r}=\"Dibatalkan\", 0 - Q{$r}, L{$r}-O{$r}-P{$r}-Q{$r})",
                $b['customer_name'], $b['customer_phone'], $b['city'],
            ];
            $this->trackZeroCells($out[count($out) - 1], $r);
            $r++;
        }

        $last = max($firstOrder, $r - 1);
        $total = array_fill(0, count(self::HEADERS), null);
        $total[0] = 'TOTAL';
        foreach (['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'] as $i => $col) {
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

        $sheet->getStyle('A1:U2')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true, 'horizontal' => Alignment::HORIZONTAL_LEFT],
        ]);
        $sheet->getStyle('A1:U1')->getFill()->setStartColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF8F0000'));
        $sheet->getStyle('A1:U1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        foreach (self::GROUPS as [$a, $b]) {
            if ($a !== $b) {
                $sheet->mergeCells("{$a}:{$b}");
            }
        }
        $sheet->getStyle("A{$lastRow}:U{$lastRow}")->applyFromArray([
            'font' => ['bold' => true, 'color' => ['argb' => 'FF8F0000']],
        ]);
        $sheet->getStyle("T3:T{$lastRow}")->getNumberFormat()->setFormatCode(\PhpOffice\PhpSpreadsheet\Style\NumberFormat::FORMAT_TEXT);
        $sheet->freezePane('A3');
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
            ['5. No. Resi J&T (waybill_number)', 'Nomor Air Waybill (AWB) dari kurir J&T untuk bukti pengiriman fisik dan pelacakan paket.'],
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
            ['20. Total Tagihan Dibayar Pembeli', 'Total uang yang ditagih kurir ke pembeli: [Total Penjualan Produk] - [Voucher] + [Ongkir Pembeli] + [Biaya COD].'],
            ['21. Pengurangan Nilai Pesanan ke J&T', 'Total saldo yang dipotong oleh pihak J&T: [Ongkir Total (Subsidi + Ongkir Pembeli)] + [Biaya COD].'],
            ['22. Kasus Retur / Alasan (return_case)', 'Keterangan alasan kendala pesanan (misal: Refund (rusak), Pesanan dibatalkan, atau -).'],
            ['23. Nilai Refund Pembeli (refund_amount)', 'Uang yang dikembalikan ke pembeli jika terjadi klaim barang rusak atau batal.'],
            ['24. Ongkir Retur Tambahan (additional_shipping)', 'Biaya kirim balik dari pembeli ke toko yang dibebankan ke toko jika terjadi retur komplain.'],
            ['25. Net Profit Toko (Kas Bersih)', 'Uang bersih yang dicairkan ke rekening toko: [Total Tagihan Dibayar Pembeli] - [Pengurangan Nilai Pesanan ke J&T] - [Refund] - [Ongkir Retur]. Hasilnya sama persis dengan: [Total Penjualan Produk] - [Voucher] - [Subsidi Ongkir] - [Refund] - [Ongkir Retur].'],
            ['26. Nama Pelanggan (customer_name)', 'Nama pembeli / penerima paket yang tertera pada resi dan pesanan.'],
            ['27. No. Telepon / WA (customer_phone)', 'Nomor kontak pelanggan (disimpan dalam format Teks agar angka 0 dan digit panjang tidak terpotong atau berubah eksponensial).'],
            ['28. Alamat Pengiriman (shipping_address)', 'Alamat tujuan pengiriman (jalan, RT/RW, nomor rumah, atau patokan).'],
            ['29. Kelurahan s.d. Provinsi', 'Tingkat wilayah penerima (Desa/Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi). Sangat berguna untuk filter & analisis wilayah pengiriman.'],
            ['30. Kode Pos (shipping_postal_code)', 'Kode pos area pengiriman untuk validasi zona tarif ekspedisi.'],
            ['31. Prinsip COD & Ongkir (Pass-Through)', 'Biaya COD dan Ongkir Pembeli diperlakukan sebagai uang titipan: masuk di tagihan pembeli, lalu keluar utuh dipotong J&T. Dampak netronya Rp 0 terhadap laba toko.'],
            ['32. Aturan Agregasi (SUM di Excel)', 'Di Sheet 1, HANYA kolom Qty, Total Diskon, dan Subtotal Penjualan yang boleh di-SUM vertikal. Kolom tingkat pesanan (Voucher, Ongkir, Net Profit) ditulis sebagai informasi referensi dan tidak boleh di-SUM vertikal agar tidak terjadi pelipatgandaan. Untuk melihat total keuangan toko secara utuh, gunakan Sheet 2 (Rekap Keuangan per Pesanan).'],
        ];
    }

    public function title(): string
    {
        return OrderExport::SHEET_GUIDE;
    }

    public function afterSheet(AfterSheet $event): void
    {
        $sheet = $event->sheet->getDelegate();

        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 15, 'color' => ['argb' => 'FFFFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC20000']],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        $last = $sheet->getHighestRow();
        $sheet->getStyle('A3:B'.$last)->applyFromArray([
            'font' => ['size' => 10, 'color' => ['argb' => 'FF333333']],
            'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_TOP],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFDEE3E0']]],
        ]);
        for ($r = 3; $r <= $last; $r++) {
            $sheet->getStyle('A'.$r)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10, 'color' => ['argb' => 'FFC20000']],
            ]);
        }

        $sheet->getColumnDimension('A')->setWidth(34);
        $sheet->getColumnDimension('B')->setWidth(100);
    }
}
