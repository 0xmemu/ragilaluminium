<?php

namespace App\Exports;

use App\Exports\Concerns\RagilStyledExport;
use App\Models\Order;
use App\Support\ExportSafety;
use App\Support\OrderEventLabels;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\RegistersEventListeners;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Export pesanan mengikuti TEMPLATE OWNER v3 (Laporan_Performa_Toko_Lengkap_
 * Ragil_Aluminium_v3.xlsx, kontrak owner 2026-09-12): 3 sheet, format dan
 * rumus dipertahankan persis, hanya gaya yang ikut merek Ragil (merah).
 *
 *  1. 'Laporan Transaksi (Skema A)' -> 1 baris = 1 item; kolom pesanan
 *     (voucher/subsidi/ongkir/COD/asuransi) diulang sebagai referensi dan
 *     TIDAK di-SUM vertikal. Rumus bawaan: N=Diskon % (M/L), O=L-M,
 *     Q=M*P, R=O*P; Net Profit (AC) = net profit PESANAN dialokasikan
 *     proporsional per subtotal baris (per produk, aman di-SUM); baris
 *     TOTAL menjumlah P/Q/R/AC.
 *  2. 'Rekap Keuangan per Pesanan' -> 1 baris = 1 pesanan; E/F/G menarik
 *     sheet 1 lewat SUMPRODUCT yang mengecualikan pesanan Dibatalkan; TOTAL
 *     SUM E:R (sesuai template).
 *  3. 'Panduan & Kamus Lengkap' -> kamus kolom owner.
 *
 * Pesanan Dibatalkan: seluruh nilai uang = 0 di semua sheet (item tetap
 * terdata sebagai catatan fisik: SKU, nama, qty); hanya Refund & Ongkir
 * Retur yang tetap tercatat bila ada kasus retur selesai.
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

    public function __construct(protected Builder $query) {}

    public function sheets(): array
    {
        $blocks = $this->blocks();

        return [
            new OrderTxSheet($blocks),
            new OrderRekapSheet($blocks),
            new OrderGuideSheet,
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
                'shippingRecords:id,order_id,waybill_number,shipping_cost,shipping_freight,shipping_insured_fee,shipping_chargeable_weight_kg,status',
                'returnCases:id,order_id,status,resolution_type,reason,refund_amount,additional_shipping_amount',
            ])
            ->latest('created_at')
            ->latest('id')
            ->get();

        $blocks = [];
        foreach ($orders as $order) {
            // Pesanan Dibatalkan: seluruh nilai uang 0 di semua sheet; hanya
            // Refund & Ongkir Retur yang tetap tercatat (retur harus terdata).
            $isBatal = $order->order_status === 'cancelled';
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
                    'normal' => $isBatal ? 0.0 : (float) $item->unit_price + (float) $item->line_discount,
                    'line_discount' => $isBatal ? 0.0 : (float) $item->line_discount,
                    'qty' => (int) $item->quantity,
                ];
            }

            // Tagihan ASLI dari J&T (totalFreight, diisi otomatis dari
            // pelacakan resi); record aktif terbaru yang menang. null = J&T
            // belum melaporkan, dan laporan memakai asumsi checkout.
            $actualRecord = $order->shippingRecords
                ->whereNotIn('status', ['cancelled'])
                ->whereNotNull('shipping_cost')
                ->sortBy('id')
                ->last();
            $jntOngkirActual = $actualRecord ? (float) $actualRecord->shipping_cost : null;
            // Asumsi checkout: ongkir pembeli + subsidi toko + asuransi.
            // totalFreight juga sudah memuat asuransi, jadi keduanya sebanding
            // dan tidak ada asuransi yang terhitung dua kali.
            $jntAsumsi = (float) $order->shipping_amount
                + (float) $order->shipping_subsidy_amount
                + (float) $order->shipping_insurance_amount;

            $blocks[] = [
                'order_number' => $order->order_number,
                'created_at' => $order->created_at?->timezone('Asia/Jakarta')->format('Y-m-d H:i:s') ?? '-',
                'paid_at' => $paidAt ? $paidAt->timezone('Asia/Jakarta')->format('Y-m-d H:i:s') : '-',
                'status' => OrderEventLabels::orderStatus($order->order_status),
                'waybill' => $order->shippingRecords->first()->waybill_number ?? '-',
                'charge_kg' => $chargeKg,
                'volume' => $volume,
                'voucher' => $isBatal ? 0.0 : (float) $order->voucher_discount_amount,
                'subsidi' => $isBatal ? 0.0 : (float) $order->shipping_subsidy_amount,
                'ongkir' => $isBatal ? 0.0 : (float) $order->shipping_amount,
                'cod' => $isBatal ? 0.0 : (float) $order->cod_fee_amount,
                'insurance' => $isBatal ? 0.0 : (float) $order->shipping_insurance_amount,
                'jnt_ongkir_actual' => $isBatal ? 0.0 : $jntOngkirActual,
                'jnt_ongkir_assumed' => $isBatal ? 0.0 : $jntAsumsi,
                'jnt_ongkir_selisih' => $isBatal
                    ? 0.0
                    : ($jntOngkirActual !== null
                        ? $jntOngkirActual - $jntAsumsi
                        : null),
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
        [11, 18, 'FFD1E7DD', 'FF1B365D', 'FF065F46', 'FFF0FDF4', false],
        [19, 25, 'FFFEF3C7', 'FF1B365D', 'FF92400E', 'FFFFFBEB', false],
        [26, 28, 'FFFEE2E2', 'FF1B365D', 'FF991B1B', 'FFFEF2F2', false],
        [29, 29, 'FFBBF7D0', 'FF14532D', 'FF166534', 'FFDCFCE7', true],
        [30, 37, 'FFEDE9FE', 'FF1B365D', 'FF5B21B6', 'FFF5F3FF', false],
    ];

    /** @var list<array{0:int, 1:int, 2:string, 3:string, 4:string, 5:string, 6:bool}> */
    public const REKAP = [
        [1, 4, 'FFE2E8F0', 'FF1B365D', 'FF334155', 'FFF8FAFC', false],
        [5, 7, 'FFD1E7DD', 'FF1B365D', 'FF065F46', 'FFF0FDF4', false],
        [8, 9, 'FFFEE2E2', 'FF7F1D1D', 'FF991B1B', 'FFFEF2F2', true],
        [10, 13, 'FFFEF3C7', 'FF1B365D', 'FF92400E', 'FFFFFBEB', false],
        [14, 17, 'FFE0E7FF', 'FF312E81', 'FF3730A3', 'FFEEF2FF', true],
        [18, 19, 'FFFEE2E2', 'FF7F1D1D', 'FF991B1B', 'FFFEF2F2', true],
        [20, 20, 'FFBBF7D0', 'FF14532D', 'FF166534', 'FFDCFCE7', true],
        [21, 23, 'FFEDE9FE', 'FF1B365D', 'FF5B21B6', 'FFF5F3FF', false],
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
        'K' => 16, 'L' => 20, 'M' => 18, 'N' => 12, 'O' => 18,
        'P' => 8, 'Q' => 20, 'R' => 24, 'S' => 20, 'T' => 22,
        'U' => 20, 'V' => 20, 'W' => 20, 'X' => 24, 'Y' => 24,
        'Z' => 20, 'AA' => 18, 'AB' => 18, 'AC' => 24, 'AD' => 22,
        'AE' => 18, 'AF' => 40, 'AG' => 18, 'AH' => 18, 'AI' => 22,
        'AJ' => 18, 'AK' => 12,
    ];

    protected const GROUPS = [
        ['A1', 'E1', '1. IDENTITAS PESANAN & WAKTU'],
        ['F1', 'J1', '2. SPESIFIKASI PRODUK & DIMENSI'],
        ['K1', 'R1', '3. RINCIAN HARGA & DISKON (Aman Di-SUM & Dibuat Pivot)'],
        ['S1', 'Y1', '4. BEBAN TOKO, ONGKIR, COD & ASURANSI (Header Repeat - JANGAN Di-SUM)'],
        ['Z1', 'AB1', '5. STATUS RETUR & REFUND'],
        ['AC1', 'AC1', '6. HASIL BERSIH'],
        ['AD1', 'AK1', '7. DETAIL PELANGGAN & ALAMAT PENGIRIMAN (DI PALING AKHIR)'],
    ];

    protected const HEADERS = [
        'Nomor Pesanan', 'Tanggal Pesanan', 'Tanggal Bayar Cair', 'Status Pesanan', 'No. Resi J&T',
        'SKU Varian', 'Nama Produk', 'Variasi Kusen & Kaca', 'Berat (kg)', 'Volume',
        'Sumber Diskon', 'Harga Produk (Normal)', 'Diskon per Produk', 'Diskon per Produk (%)', 'Harga Jual Satuan', 'Qty',
        'Total Diskon Produk', 'Subtotal Penjualan Produk',
        'Voucher Pesanan (Beban Toko)', 'Subsidi Ongkir Toko (Beban Toko)', 'Ongkir Ditanggung Pembeli',
        'Biaya COD Ditanggung Pembeli', 'Asuransi Pengiriman Dibayar Pembeli',
        'Penjualan Gross', 'Pengurangan Nilai Pesanan ke J&T',
        'Kasus Retur / Alasan', 'Nilai Refund Pembeli', 'Ongkir Retur Tambahan',
        'Net Profit Toko per Produk (Kas Bersih)',
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
        $this->currencyColumns = ['L', 'M', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'AA', 'AB', 'AC'];
        $this->currencyFormat = '#,##0';
        // Nomor pesanan, nomor resi J&T, SKU varian, telepon, dan kode pos
        // adalah identitas: harus teks, bukan angka.
        $this->textColumns = ['A', 'E', 'F', 'AE', 'AK'];
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
        $rangeSubtotal = "\$R\${$first}:\$R\${$lastItem}";

        foreach ($rows as [$item, $b, $r]) {
            // Net profit per baris produk = net profit pesanan dialokasikan
            // proporsional terhadap subtotal baris; bila total subtotal
            // pesanan 0, alokasi dibagi rata antar barisnya.
            $share = "IFERROR(R{$r}/SUMIF({$rangeA}, A{$r}, {$rangeSubtotal}), 1/COUNTIF({$rangeA}, A{$r}))";
            $netOrder = "IF(D{$r}=\"Dibatalkan\", 0-AA{$r}-AB{$r}, X{$r}-Y{$r}-AA{$r}-AB{$r})";
            // Pengurangan ke J&T memakai ongkir ASLI dari konsol J&T bila admin
            // sudah mencatatnya; kalau belum, asumsi checkout (ongkir pembeli +
            // subsidi toko). Wajib sama dengan Sheet 2 agar kedua sheet rekonsiliasi.
            // Tagihan J&T: angka ASLI bila J&T sudah melaporkan (totalFreight,
            // sudah memuat asuransi), atau rumus asumsi checkout
            // (ongkir pembeli + subsidi + asuransi) bila belum.
            $ongkirBasis = $b['jnt_ongkir_actual'] !== null
                ? number_format($b['jnt_ongkir_actual'], 2, '.', '')
                : "(U{$r}+T{$r}+W{$r})";
            $out[] = [
                $b['order_number'], $b['created_at'], $b['paid_at'], $b['status'], $b['waybill'],
                $item['variant_sku'], $item['name'], $item['variations'],
                $b['charge_kg'] ?? '-', $b['volume'],
                $item['discount_source'], $item['normal'], $item['line_discount'],
                "=IF(L{$r}=0, 0, M{$r}/L{$r})", "=L{$r}-M{$r}", $item['qty'],
                "=M{$r}*P{$r}", "=O{$r}*P{$r}",
                $b['voucher'], $b['subsidi'], $b['ongkir'], $b['cod'], $b['insurance'],
                "=IF(D{$r}=\"Dibatalkan\", 0, SUMIF({$rangeA}, A{$r}, {$rangeSubtotal}) - S{$r} + U{$r} + V{$r} + W{$r})",
                "={$ongkirBasis}+V{$r}",
                $b['return_type'], $b['refund'], $b['retur_ongkir'],
                "={$netOrder}*{$share}",
                $b['customer_name'], $b['customer_phone'], $b['address'], $b['village'],
                $b['district'], $b['city'], $b['province'], $b['postal'],
            ];
            $this->trackZeroCells($out[count($out) - 1], $r);
        }

        // Baris TOTAL: Qty/Total Diskon/Subtotal/Net Profit per produk
        // di-SUM; kolom pesanan level order tetap lewat Rekap.
        $total = array_fill(0, count(self::HEADERS), null);
        $total[0] = 'TOTAL';
        $total[15] = "=SUM(P{$first}:P{$lastItem})";
        $total[16] = "=SUM(Q{$first}:Q{$lastItem})";
        $total[17] = "=SUM(R{$first}:R{$lastItem})";
        $total[28] = "=SUM(AC{$first}:AC{$lastItem})";
        // Kolom pesanan S..AB -> penanda lihat Rekap (persis template).
        foreach (['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB'] as $i => $col) {
            $total[18 + $i] = '[Lihat Tab Rekap]';
        }
        $out[] = $total;

        return $out;
    }

    public static function groupRow(): array
    {
        $row = array_fill(0, count(self::HEADERS), '');
        foreach (self::GROUPS as [$a, $b, $label]) {
            $row[Coordinate::columnIndexFromString(preg_replace('/\d+/', '', $a)) - 1] = $label;
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
        $sheet->getStyle("A2:AK{$lastRow}")->getBorders()->getAllBorders()->applyFromArray([
            'borderStyle' => Border::BORDER_THIN,
            'color' => ['argb' => 'FFCBD5E1'],
        ]);
        $sheet->getStyle('A1:AK1')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_NONE);

        if ($lastRow < 3) {
            return;
        }

        // Perataan per kolom: identitas & teks tengah, nama/alamat kiri,
        // uang kanan (persis template).
        foreach (['B', 'C', 'D', 'E', 'F', 'I', 'J', 'K', 'P', 'Z', 'AE', 'AK'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        }
        foreach (['G', 'H', 'AD', 'AF', 'AG', 'AH', 'AI', 'AJ'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        }
        foreach (['L', 'M', 'N', 'O', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'AA', 'AB', 'AC'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }

        // Nomor pesanan dan kolom uang kunci ditebalkan seperti template.
        $sheet->getStyle("A3:A{$lastRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("A3:A{$lastRow}")->getFont()->setBold(true);
        foreach (['O', 'P', 'Q', 'R', 'X', 'Y', 'AC'] as $col) {
            $sheet->getStyle("{$col}3:{$col}{$lastRow}")->getFont()->setBold(true);
        }

        // Berat (kg): desimal bebas (22,45 tampil penuh; "-" tetap teks).
        $sheet->getStyle("I3:I{$lastRow}")->getNumberFormat()->setFormatCode('0.##');
        // Diskon per Produk (%): pecahan berformat persen (10%).
        $sheet->getStyle("N3:N{$lastRow}")->getNumberFormat()->setFormatCode('0%');

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

        foreach (['A', 'P'] as $col) {
            $sheet->getStyle("{$col}{$lastRow}")->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1E293B');
            $sheet->getStyle("{$col}{$lastRow}")->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
        }
        foreach (['Q', 'R', 'AC'] as $col) {
            $sheet->getStyle("{$col}{$lastRow}")->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1E293B');
            $sheet->getStyle("{$col}{$lastRow}")->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_RIGHT)->setVertical(Alignment::VERTICAL_CENTER);
        }
        $sheet->getStyle("P{$lastRow}:R{$lastRow}")->getNumberFormat()->setFormatCode('#,##0');
        $sheet->getStyle("AC{$lastRow}")->getNumberFormat()->setFormatCode('#,##0');
        foreach (['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB'] as $col) {
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
        'S' => 18, 'T' => 26,
        'U' => 22, 'V' => 18, 'W' => 22,
    ];

    protected const GROUPS = [
        ['A1', 'D1', '1. IDENTITAS PESANAN'],
        ['E1', 'G1', '2. PENJUALAN PRODUK (DARI SHEET 1)'],
        ['H1', 'I1', '3. BEBAN TOKO'],
        ['J1', 'M1', '4. PEMBAYARAN PEMBELI (UANG MASUK)'],
        ['N1', 'Q1', '5. PENGURANGAN PESANAN (KE J&T)'],
        ['R1', 'S1', '6. RETUR & REFUND'],
        ['T1', 'T1', '7. HASIL AKHIR'],
        ['U1', 'W1', '8. DETAIL PELANGGAN (DI PALING AKHIR)'],
    ];

    protected const HEADERS = [
        'Nomor Pesanan', 'Tanggal Pesanan', 'Tanggal Bayar Cair', 'Status Pesanan',
        'Total Nilai Normal', 'Total Diskon Produk', 'Total Penjualan Produk',
        'Voucher Toko', 'Subsidi Ongkir Toko',
        'Ongkir Dibayar Pembeli', 'Biaya COD Dibayar Pembeli', 'Asuransi Pengiriman Dibayar Pembeli',
        'PENJUALAN GROSS',
        'Ongkir Total ke J&T', 'Selisih Ongkir J&T', 'Biaya COD ke J&T', 'Total Potongan J&T',
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
        $this->currencyColumns = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
        $this->currencyFormat = '#,##0';
        // Nomor pesanan dan telepon pelanggan adalah identitas: harus teks.
        $this->textColumns = ['A', 'V'];
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
        $rangeD = $src."\$D\${$firstItem}:\$D\${$lastItem}";
        $rangeDiskon = $src."\$Q\${$firstItem}:\$Q\${$lastItem}";
        $rangeSubtotal = $src."\$R\${$firstItem}:\$R\${$lastItem}";
        // Penjualan produk mengecualikan pesanan Dibatalkan (barang tidak
        // pernah dibayar) supaya identitas Rekap berlaku sampai ke TOTAL:
        // Penjualan - Voucher - Subsidi - Refund - Ongkir Retur = Net Profit.

        $out = [
            [
                '1. IDENTITAS PESANAN', '', '', '',
                '2. PENJUALAN PRODUK (DARI SHEET 1)', '', '',
                '3. BEBAN TOKO', '',
                '4. PEMBAYARAN PEMBELI (UANG MASUK)', '', '', '',
                '5. PENGURANGAN PESANAN (KE J&T)', '', '', '',
                '6. RETUR & REFUND', '',
                '7. HASIL AKHIR',
                '8. DETAIL PELANGGAN (DI PALING AKHIR)', '', '',
            ],
            self::HEADERS,
        ];

        $r = $firstOrder;
        foreach ($this->blocks as $b) {
            // Tagihan J&T: angka ASLI bila J&T sudah melaporkan (totalFreight,
            // sudah memuat asuransi), atau asumsi checkout
            // (subsidi + ongkir pembeli + asuransi) bila belum.
            $ongkirJnt = $b['jnt_ongkir_actual'] !== null
                ? $b['jnt_ongkir_actual']
                : "=I{$r}+J{$r}+L{$r}";

            $out[] = [
                $b['order_number'], $b['created_at'], $b['paid_at'], $b['status'],
                "=F{$r}+G{$r}",
                "=SUMPRODUCT(({$rangeA} = A{$r}) * ({$rangeD} <> \"Dibatalkan\") * {$rangeDiskon})",
                "=SUMPRODUCT(({$rangeA} = A{$r}) * ({$rangeD} <> \"Dibatalkan\") * {$rangeSubtotal})",
                $b['voucher'], $b['subsidi'],
                $b['ongkir'], $b['cod'], $b['insurance'],
                "=IF(D{$r}=\"Dibatalkan\", 0, G{$r}-H{$r}+J{$r}+K{$r}+L{$r})",
                $ongkirJnt, "=N{$r}-I{$r}-J{$r}-L{$r}", "=K{$r}", "=N{$r}+P{$r}",
                $b['refund'], $b['retur_ongkir'],
                "=IF(D{$r}=\"Dibatalkan\", 0 - R{$r} - S{$r}, M{$r}-Q{$r}-R{$r}-S{$r})",
                $b['customer_name'], $b['customer_phone'], $b['city'],
            ];
            $this->trackZeroCells($out[count($out) - 1], $r);
            $r++;
        }

        $last = max($firstOrder, $r - 1);
        $total = array_fill(0, count(self::HEADERS), null);
        $total[0] = 'TOTAL';
        foreach (['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'] as $i => $col) {
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

        // Kolom PENJUALAN GROSS selalu disorot amber (uang masuk).
        $sheet->getStyle('M3:M'.($lastRow - 1))->getFill()
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
        foreach (['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'] as $col) {
            $sheet->getStyle("{$col}{$lastRow}")->getFont()->setBold(true)->setSize(10)->getColor()->setARGB('FF1E293B');
            $sheet->getStyle("{$col}{$lastRow}")->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_RIGHT)->setVertical(Alignment::VERTICAL_CENTER);
        }
        $sheet->getStyle("E{$lastRow}:T{$lastRow}")->getNumberFormat()->setFormatCode('#,##0');

        $sheet->freezePane('E3');
    }
}

// ============ SHEET 3: PANDUAN & KAMUS LENGKAP ============

class OrderGuideSheet implements FromArray, WithEvents, WithTitle
{
    use RegistersEventListeners;

    public function array(): array
    {
        return [
            ['KAMUS KOLOM & PANDUAN PENGOPERASIAN LAPORAN (RAGIL ALUMINIUM)'],
            [''],
            ['1. Nomor Pesanan (order_number)', 'Kode unik transaksi pesanan. Pada pesanan dengan multi-item (beberapa produk), nomor pesanan ini akan berulang (Skema A).'],
            ['2. Tanggal Pesanan (created_at)', 'Waktu saat pembeli membuat pesanan di sistem toko online.'],
            ['3. Tanggal Bayar Cair (paid_at)', 'Waktu saat pembayaran pesanan telah terkonfirmasi lunas dan masuk ke saldo toko (krusial untuk monitoring arus kas cair).'],
            ['4. Status Pesanan (order_status)', 'Status operasional terkini: Diproses, Selesai, atau Dibatalkan. Pesanan Dibatalkan: seluruh nilai uang = 0 di semua sheet; hanya Retur/Refund yang tetap tercatat.'],
            ['5. No. Resi J&T (waybill_number)', 'Nomor Air Waybill (AWB) dari kurir J&T untuk bukti pengiriman fisik dan pelacakan paket. Disimpan dalam format Teks karena resi J&T murni angka: sebagai angka, Excel menampilkannya sebagai notasi ilmiah (2,01719E+11) dan digit di atas 15 bisa dibulatkan.'],
            ['6. SKU Varian (variant_sku)', 'Kode unik kombinasi model dan varian. Digunakan untuk melacak pergerakan stok per jenis.'],
            ['7. Nama Produk & Variasi', 'Nama model barang dan varian detailnya (contoh: Warna: Putih, Kaca: Kaca Es). Dipisah kolomnya agar memudahkan Pivot Table varian.'],
            ['8. Berat (kg) & Volume', 'Mengikuti format modul pengiriman: berat tagih paket (max berat aktual vs volumetrik P x L x T / 5000, pallet kayu allowance 3 cm/sisi) dan dimensi luar paket, sebagai snapshot yang direkam saat order dibuat. Tanda "-" berarti order dibuat sebelum sistem menyimpan snapshot; nilai lama tidak dihitung ulang agar angka historis tidak berubah.'],
            ['9. Sumber Diskon (discount_source)', 'Jenis promo yang berlaku: Reguler atau Flash Sale.'],
            ['10. Harga Produk (Normal)', 'Harga katalog normal sebelum promo (harga jual + diskon garis produk).'],
            ['11. Diskon per Produk (line_discount)', 'Potongan harga yang disetting khusus pada produk tersebut untuk menurunkan margin harga normal.'],
            ['12. Diskon per Produk (%)', 'Persentase potongan harga terhadap harga normal: [Diskon per Produk] / [Harga Produk (Normal)]. Ditampilkan sebagai persen (misal 10%); 0% berarti produk terjual tanpa diskon.'],
            ['13. Harga Jual Satuan', 'Harga riil setelah diskon per unit: [Harga Normal] - [Diskon per Produk].'],
            ['14. Qty (quantity)', 'Jumlah unit fisik barang yang dibeli.'],
            ['15. Total Diskon Produk', 'Total penghematan diskon produk pada baris tersebut: [Diskon per Produk] x [Qty].'],
            ['16. Subtotal Penjualan Produk', 'Nilai penjualan bersih barang sebelum biaya pesanan: [Harga Jual Satuan] x [Qty]. Kolom ini aman di-SUM dan dipakai Pivot Table untuk performa produk. Catatan: baris milik pesanan Dibatalkan bernilai uang 0 (item tetap terdata), otomatis tidak terhitung di penjualan Sheet 2 (Rekap).'],
            ['17. Voucher Pesanan (Beban Toko)', 'Kupon diskon keranjang belanja yang ditanggung toko. Berlaku per nomor pesanan, bukan per produk.'],
            ['18. Subsidi Ongkir Toko (Beban Toko)', 'Bagian ongkir yang ditanggung penjual/toko ke ekspedisi J&T. Merupakan beban riil pengurang laba toko.'],
            ['19. Ongkir Ditanggung Pembeli', 'Tarif ongkir kurir sesudah dipotong subsidi toko. Dibayar oleh pembeli saat checkout / bayar di tempat.'],
            ['20. Biaya COD Ditanggung Pembeli', 'Fee penanganan COD yang dibebankan kepada pembeli. Dibayar oleh pembeli ke kurir J&T saat serah terima barang.'],
            ['21. Asuransi Pengiriman Dibayar Pembeli (shipping_insurance_amount)', 'Biaya asuransi paket yang dibayar pembeli. Besarnya DIHITUNG OLEH J&T dari nilai barang yang diasuransikan; sistem tidak menghitung tarif ini sendiri, angkanya diambil apa adanya dari J&T. Bersifat opsional: muncul sebagai pilihan di checkout, dan hanya ditagihkan bila pembeli memilihnya. Termasuk uang titipan: masuk di tagihan pembeli lalu dipotong utuh oleh J&T.'],
            ['22. Penjualan Gross', 'Total uang yang ditagih kurir ke pembeli (Total Tagihan pada pesan pelanggan): [Total Penjualan Produk] - [Voucher] + [Ongkir Pembeli] + [Biaya COD] + [Asuransi Pengiriman].'],
            ['23. Pengurangan Nilai Pesanan ke J&T', 'Total saldo yang dipotong oleh pihak J&T: [Ongkir Total ke J&T] + [Biaya COD] + [Asuransi Pengiriman].'],
            ['24. Kasus Retur / Alasan (return_case)', 'Keterangan alasan kendala pesanan (misal: Refund (rusak), Pesanan dibatalkan, atau -).'],
            ['25. Nilai Refund Pembeli (refund_amount)', 'Uang yang dikembalikan ke pembeli jika terjadi klaim barang rusak atau batal.'],
            ['26. Ongkir Retur Tambahan (additional_shipping)', 'Biaya kirim balik dari pembeli ke toko yang dibebankan ke toko jika terjadi retur komplain.'],
            ['27. Net Profit Toko per Produk (Kas Bersih)', 'Kontribusi laba bersih pada baris produk tersebut: [Net Profit pesanan] dialokasikan proporsional terhadap porsi [Subtotal Penjualan Produk] baris itu dari total subtotal pesanan. Jumlahkan seluruh baris satu pesanan = NET PROFIT pesanan di Sheet 2 (Rekap). Pesanan Dibatalkan: kerugian (-Refund -Ongkir Retur) dialokasikan dengan cara yang sama. Kolom ini aman di-SUM.'],
            ['28. Nama Pelanggan (customer_name)', 'Nama pembeli / penerima paket yang tertera pada resi dan pesanan.'],
            ['29. No. Telepon / WA (customer_phone)', 'Nomor kontak pelanggan (disimpan dalam format Teks agar angka 0 dan digit panjang tidak terpotong atau berubah eksponensial).'],
            ['30. Alamat Pengiriman (shipping_address)', 'Alamat tujuan pengiriman (jalan, RT/RW, nomor rumah, atau patokan).'],
            ['31. Kelurahan s.d. Provinsi', 'Tingkat wilayah penerima (Desa/Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi). Sangat berguna untuk filter & analisis wilayah pengiriman.'],
            ['32. Kode Pos (shipping_postal_code)', 'Kode pos area pengiriman untuk validasi zona tarif ekspedisi.'],
            ['33. Prinsip COD & Ongkir (Pass-Through)', 'Biaya COD dan Ongkir Pembeli diperlakukan sebagai uang titipan: masuk di tagihan pembeli, lalu keluar utuh dipotong J&T. Dampak netronya Rp 0 terhadap laba toko.'],
            ['35. Tagihan J&T Asli & Selisihnya (Sheet 2 kolom N & O)', 'Tagihan J&T (N) memakai angka ASLI dari J&T Cargo yang diambil otomatis dari pelacakan resi (field totalFreight), jadi tidak ada input manual dan tidak ada perhitungan sendiri. Angka itu SUDAH termasuk asuransi (insuredFee), sehingga asuransi tidak ditambahkan lagi di atasnya. Bila J&T belum melaporkan, dipakai asumsi checkout: [Subsidi Ongkir Toko] + [Ongkir Ditanggung Pembeli] + [Asuransi Pengiriman], dan Selisih (O) bernilai 0. Selisih = [Tagihan J&T Asli] - [Subsidi] - [Ongkir Pembeli] - [Asuransi]; nilai POSITIF berarti tagihan J&T lebih besar dari asumsi (ditanggung toko), NEGATIF berarti lebih hemat dari perkiraan.'],
            ['34. Aturan Agregasi (SUM di Excel)', 'Di Sheet 1, kolom yang boleh di-SUM vertikal: Qty, Total Diskon Produk, Subtotal Penjualan Produk, dan Net Profit Toko (kini per produk). Kolom tingkat pesanan (Voucher, Subsidi, Ongkir, COD, Asuransi, Penjualan Gross, Potongan J&T, Refund, Ongkir Retur) diulang per baris dan TIDAK boleh di-SUM agar tidak terjadi pelipatgandaan; totalnya ada di Sheet 2 (Rekap Keuangan per Pesanan). Di Sheet 2, kolom penjualan (Total Nilai Normal, Total Diskon Produk, Total Penjualan Produk) mengecualikan pesanan Dibatalkan sehingga identitas Penjualan - Voucher - Subsidi - Refund - Ongkir Retur = Net Profit berlaku sampai ke baris TOTAL. Pesanan Dibatalkan tampil dengan seluruh nilai uang 0 di kedua sheet; hanya kolom Retur & Refund yang tetap tercatat.'],
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
