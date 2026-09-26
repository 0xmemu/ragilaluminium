<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\OrderReturnItem;
use App\Models\Payment;
use App\Models\PerformanceVisitorEvent;
use App\Models\Product;
use App\Services\StorePerformanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GOLDEN TEST, Kontrak Perhitungan Beku (ADR-026).
 *
 * Dataset uji yang sama harus selalu menghasilkan angka yang sama. Seluruh
 * angka keluaran build() dibekukan pada berkas
 * tests/Expectations/store-performance-golden-v1.json, dan test ini gagal
 * bila angka berubah WALAU SATU. Disiplinnya:
 *
 *  1. Perubahan formula yang disengaja WAJIB memperbarui berkas expectation
 *     di PR yang sama, dengan menjalankan GOLDEN_UPDATE=1 php artisan test
 *     --filter=StorePerformanceGoldenTest, dan menaikkan versi kontrak pada
 *     ADR-026 beserta komentar FROZEN di berkas yang berubah.
 *  2. Perubahan angka yang TIDAK disengaja berarti ada regresi perhitungan.
 *
 * Dataset menanam semua kelas kejadian yang menentukan angka: pesanan diakui,
 * pembatalan pasca periode (tetap diakui), pengakuan telat (tidak dihitung),
 * pesanan tanpa event, COD lunas saat sampai, paket ditolak, retur refund,
 * pesanan batal tanpa event, dan data pembanding bulan Juli.
 *
 * Jam laporan dibekukan lewat setTestNow supaya rentang pembanding, periode
 * berjalan, dan waktu kunjungan tidak bergantung jam eksekusi.
 */
class StorePerformanceGoldenTest extends TestCase
{
    use RefreshDatabase;

    public const CONTRAK_VERSI = '1.0.1';

    private const BERKAS = __DIR__.'/../Expectations/store-performance-golden-v1.json';

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-09-30 10:00:00'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_keluaran_perhitungan_sesuai_expectation_beku(): void
    {
        $this->tanamDataset();

        $payload = app(StorePerformanceService::class)->build('custom', '2026-08-01', '2026-08-31');
        unset($payload['generated_at']);
        $payload['versi_kontrak'] = self::CONTRAK_VERSI;

        $aktual = $this->kanonikal($payload);

        if (env('GOLDEN_UPDATE') === '1') {
            if (! is_dir(dirname(self::BERKAS))) {
                mkdir(dirname(self::BERKAS), 0775, true);
            }
            file_put_contents(self::BERKAS, $aktual);
            $this->assertFileExists(self::BERKAS, 'Expectation beku gagal ditulis.');

            return;
        }

        $this->assertFileExists(
            self::BERKAS,
            'Berkas expectation beku tidak ada. Jalankan GOLDEN_UPDATE=1 sekali untuk membuatnya.'
        );

        $beku = file_get_contents(self::BERKAS);
        if ($beku !== $aktual) {
            $this->fail($this->pesanSelisih($beku, $aktual));
        }
        $this->assertTrue(true);
    }

    public function test_versi_kontrak_expectation_sesuai_kontrak_test(): void
    {
        $this->assertFileExists(self::BERKAS);
        $beku = json_decode((string) file_get_contents(self::BERKAS), true);
        $this->assertSame(
            self::CONTRAK_VERSI,
            $beku['versi_kontrak'] ?? null,
            'Versi kontrak pada expectation beku harus sama dengan ADR-026. Naikkan keduanya bersama.'
        );
    }

    /**
     * Komentar FROZEN pada berkas beku wajib ada: ia yang memberi tahu
     * pem reviewer bahwa menyentuh berkas ini ada gerbang tambahan.
     */
    public function test_komentar_frozen_hadir_pada_berkas_beku(): void
    {
        foreach ([
            'app/Services/StorePerformanceService.php',
            'app/Exports/OrderExport.php',
        ] as $berkas) {
            $isi = (string) file_get_contents(base_path($berkas));
            $this->assertStringContainsString('FROZEN', $isi, $berkas.' kehilangan komentar FROZEN.');
            $this->assertStringContainsString('ADR-026', $isi, $berkas.' kehilangan rujukan ADR-026.');
            $this->assertStringContainsString(self::CONTRAK_VERSI, $isi, $berkas.' kehilangan versi kontrak.');
        }
    }

    /**
     * Gerbang pada template PR wajib ada supaya setiap PR yang menyentuh
     * berkas beku melewati pertanyaan yang sama.
     */
    public function test_pr_template_memuat_gerbang_kontrak_beku(): void
    {
        $berkas = base_path('.github/PULL_REQUEST_TEMPLATE.md');
        $this->assertFileExists($berkas, 'Template PR wajib ada dan memuat Gerbang Kontrak Beku.');
        $isi = (string) file_get_contents($berkas);
        $this->assertStringContainsString('Gerbang Kontrak Beku', $isi);
        $this->assertStringContainsString('store-performance-golden-v1.json', $isi);
    }

    // =====================================================================
    // Dataset deterministik
    // =====================================================================

    private function tanamDataset(): void
    {
        $produk = [
            'GOLD-SL-PUTIH' => $this->produk('GOLD-SL-PUTIH', 'SLIDING', 'PUTIH'),
            'GOLD-SL-HITAM' => $this->produk('GOLD-SL-HITAM', 'SLIDING', 'HITAM'),
            'GOLD-JK-KACA' => $this->produk('GOLD-JK-KACA', 'JUNGKIT', 'KACA'),
            'GOLD-SL-POLOS' => $this->produk('GOLD-SL-POLOS', 'SLIDING', 'POLOS'),
            'GOLD-SL-FOST' => $this->produk('GOLD-SL-FOST', 'SLIDING', 'FOST'),
        ];

        // --- Pesanan pembanding bulan Juli ---
        $jul = $this->pesanan('ORD-GOLD-JUL', 300000, 'completed', '2026-07-20 09:00:00');
        $this->event($jul, 'processing', '2026-07-20 10:00:00');
        $this->event($jul, 'completed', '2026-07-25 09:00:00');
        $this->item($jul, $produk['GOLD-JK-KACA'], 1, 300000, 'GOLD-JK-KACA-V');
        $this->bayar($jul, 'transfer', 300000, '2026-07-20 10:30:00');

        // --- A: transfer, selesai, dua item untuk alokasi per baris ---
        $a = $this->pesanan('ORD-GOLD-A', 1000000, 'completed', '2026-08-05 09:00:00');
        $this->event($a, 'processing', '2026-08-05 11:00:00');
        $this->event($a, 'completed', '2026-08-20 10:00:00');
        $this->item($a, $produk['GOLD-SL-PUTIH'], 1, 600000, 'GOLD-SL-PUTIH-V');
        $this->item($a, $produk['GOLD-SL-HITAM'], 1, 400000, 'GOLD-SL-HITAM-V');
        $this->bayar($a, 'transfer', 1000000, '2026-08-05 12:00:00');

        // --- B: COD, lunas saat barang sampai, ongkir + asuransi + subsidi ---
        $b = $this->pesanan('ORD-GOLD-B', 500000, 'delivered', '2026-08-10 08:00:00', [
            'payment_method' => 'cod',
            'cod_flag' => true,
            'cod_fee_amount' => 5000,
            'shipping_amount' => 20000,
            'shipping_subsidy_amount' => 5000,
            'shipping_insurance_amount' => 10000,
            'shipping_status' => 'delivered',
        ]);
        $this->event($b, 'processing', '2026-08-10 09:00:00');
        $this->event($b, 'delivered', '2026-08-15 09:00:00');
        $this->item($b, $produk['GOLD-JK-KACA'], 2, 250000, 'GOLD-JK-KACA-V');
        $this->bayar($b, 'cod', 500000, '2026-08-15 09:00:00');

        // --- C: diakui pada Agustus, dibatalkan SETELAH periode berakhir ---
        $c = $this->pesanan('ORD-GOLD-C', 800000, 'cancelled', '2026-08-12 08:00:00');
        $this->event($c, 'processing', '2026-08-12 10:00:00');
        $this->event($c, 'cancelled', '2026-09-15 10:00:00');

        // --- D: Diproses SETELAH periode berakhir, tidak dihitung Agustus ---
        $d = $this->pesanan('ORD-GOLD-D', 700000, 'processing', '2026-08-28 08:00:00');
        $this->event($d, 'processing', '2026-09-03 09:00:00');

        // --- E: menunggu konfirmasi, tidak pernah masuk pengakuan ---
        $e = $this->pesanan('ORD-GOLD-E', 450000, 'awaiting_confirmation', '2026-08-20 08:00:00', [
            'payment_status' => 'pending',
        ]);

        // --- F: COD ditolak pembeli, belum pernah lunas ---
        $f = $this->pesanan('ORD-GOLD-F', 650000, 'return_completed', '2026-08-08 08:00:00', [
            'payment_method' => 'cod',
            'cod_flag' => true,
            'payment_status' => 'pending',
            'cod_fee_amount' => 10000,
            'shipping_amount' => 25000,
            'shipping_status' => 'returned',
        ]);
        $this->event($f, 'processing', '2026-08-08 09:00:00');
        $itemF = $this->item($f, $produk['GOLD-SL-POLOS'], 1, 650000, 'GOLD-SL-POLOS-V');
        $kasusF = $this->kasus($f, '2026-08-18 09:00:00', 'refund', 0, 15000);
        $this->itemRetur($kasusF, $itemF, 1);

        // --- G: transfer, selesai, retur refund dengan ongkir retur toko ---
        $g = $this->pesanan('ORD-GOLD-G', 2000000, 'completed', '2026-08-03 08:00:00');
        $this->event($g, 'processing', '2026-08-03 10:00:00');
        $this->event($g, 'completed', '2026-08-25 10:00:00');
        $itemG = $this->item($g, $produk['GOLD-SL-FOST'], 1, 2000000, 'GOLD-SL-FOST-V');
        $this->bayar($g, 'transfer', 2000000, '2026-08-03 11:00:00');
        $kasusG = $this->kasus($g, '2026-08-26 10:00:00', 'refund', 150000, 30000);
        $this->itemRetur($kasusG, $itemG, 1);

        // --- I: dibatalkan sebelum Diproses, tidak pernah diakui ---
        $i = $this->pesanan('ORD-GOLD-I', 400000, 'cancelled', '2026-08-15 08:00:00', [
            'payment_status' => 'pending',
        ]);
        $this->event($i, 'cancelled', '2026-08-16 09:00:00');

        // --- Kunjungan tetap: 8 kunjungan unik pada Agustus ---
        foreach (['08-10', '08-12'] as $hari) {
            foreach (['g1', 'g2', 'g3', 'g4'] as $urut) {
                PerformanceVisitorEvent::create([
                    'visitor_hash' => 'golden-'.$urut.'-'.$hari,
                    'visit_date' => '2026-'.$hari,
                    'visited_at' => '2026-'.$hari.' 08:00:00',
                ]);
            }
        }
    }

    private function produk(string $sku, string $model, string $desain): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => 'Produk '.$desain,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => $model,
            'design_variant' => $desain,
            'status' => 'active',
        ]);
    }

    private function pesanan(string $nomor, int $total, string $status, string $dibuat, array $tambahan = []): Order
    {
        $order = Order::create(array_merge([
            'order_number' => $nomor,
            'customer_name' => 'Pelanggan Golden',
            'customer_phone' => '0812000000'.substr(md5($nomor), 0, 2),
            'shipping_address_line1' => 'Jl Golden 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'payment_status' => $status === 'awaiting_confirmation' || $status === 'cancelled' ? 'pending' : 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $total,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ], $tambahan));
        Order::whereKey($order->id)->update(['created_at' => $dibuat, 'updated_at' => $dibuat]);

        return $order->fresh();
    }

    private function event(Order $order, string $status, string $kapan): void
    {
        EventLog::create([
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'payload' => ['from' => 'processing', 'order_status' => $status, 'source' => 'golden'],
            'created_by_user_id' => null,
            'created_at' => Carbon::parse($kapan),
        ]);
    }

    private function item(Order $order, Product $produk, int $qty, int $harga, string $skuVarian): OrderItem
    {
        return OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $produk->id,
            'parent_sku' => $produk->parent_sku,
            'variant_sku' => $skuVarian,
            'name' => $produk->name,
            'product_category' => 'WINDOW',
            'product_model' => $produk->product_model,
            'design_variant' => $produk->design_variant,
            'unit_price' => $harga,
            'quantity' => $qty,
            'line_subtotal' => $harga * $qty,
            'line_discount' => 0,
            'line_total' => $harga * $qty,
        ]);
    }

    private function bayar(Order $order, string $metode, int $jumlah, string $lunas): Payment
    {
        return Payment::create([
            'order_id' => $order->id,
            'payment_method' => $metode,
            'amount' => (string) $jumlah,
            'status' => 'completed',
            'paid_at' => Carbon::parse($lunas),
        ]);
    }

    private function kasus(Order $order, string $selesai, string $jenis, int $refund, int $ongkirRetur): OrderReturnCase
    {
        return OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'Uji golden',
            'resolution_type' => $jenis,
            'refund_amount' => $refund,
            'return_shipping_cost' => $ongkirRetur,
            'completed_at' => Carbon::parse($selesai),
        ]);
    }

    private function itemRetur(OrderReturnCase $kasus, OrderItem $item, int $jumlah): OrderReturnItem
    {
        return OrderReturnItem::create([
            'return_case_id' => $kasus->id,
            'order_item_id' => $item->id,
            'requested_quantity' => $jumlah,
            'returned_quantity' => $jumlah,
        ]);
    }

    // =====================================================================
    // Perbandingan kanonikal
    // =====================================================================

    private function kanonikal(array $payload): string
    {
        return json_encode(
            $this->urutkan($payload),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
    }

    private function urutkan(mixed $nilai): mixed
    {
        if (is_array($nilai)) {
            $daftar = array_is_list($nilai)
                ? array_map(fn ($v) => $this->urutkan($v), $nilai)
                : [];
            if ($daftar !== []) {
                return $daftar;
            }
            $peta = [];
            foreach ($nilai as $kunci => $isi) {
                $peta[$kunci] = $this->urutkan($isi);
            }
            ksort($peta);

            return $peta;
        }

        return $nilai;
    }

    private function pesanSelisih(string $beku, string $aktual): string
    {
        $jalur = $this->selisihJalur(
            json_decode((string) $beku, true) ?? [],
            json_decode($aktual, true) ?? []
        );

        return "Keluaran perhitungan berubah terhadap expectation beku (ADR-026 v".self::CONTRAK_VERSI.').'
            ."\nJalur yang berubah (maksimal 15): ".($jalur === [] ? '(bentuk berubah)' : implode(', ', array_slice($jalur, 0, 15)))
            ."\nBila perubahan ini DISENGGAJA: jalankan GOLDEN_UPDATE=1 php artisan test --filter=StorePerformanceGoldenTest,"
            .' sertakan berkas expectation baru di PR yang sama, jelaskan alasannya, dan naikkan versi kontrak di ADR-026.'
            ."\nBila TIDAK disengaja: ini regresi perhitungan, periksa kembali perubahan Anda.";
    }

    private function selisihJalur(mixed $lama, mixed $baru, string $jalur = ''): array
    {
        if (is_array($lama) && is_array($baru)) {
            $keluar = [];
            foreach ($lama as $kunci => $isi) {
                if (! array_key_exists($kunci, $baru)) {
                    $keluar[] = $jalur.'.'.$kunci.' (hilang)';
                } else {
                    $keluar = array_merge($keluar, $this->selisihJalur($isi, $baru[$kunci], $jalur.'.'.$kunci));
                }
            }
            foreach ($baru as $kunci => $isi) {
                if (! array_key_exists($kunci, $lama)) {
                    $keluar[] = $jalur.'.'.$kunci.' (baru)';
                }
            }

            return $keluar;
        }

        return $lama === $baru ? [] : [$jalur.' ('.var_export($lama, true).' menjadi '.var_export($baru, true).')'];
    }
}
