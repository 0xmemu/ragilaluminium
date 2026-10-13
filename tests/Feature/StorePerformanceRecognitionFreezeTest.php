<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\Order;
use App\Services\StorePerformanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pembekuan pengakuan penjualan (P0.2, keputusan owner 2026-09-22).
 *
 * Keanggotaan pesanan pada laporan periode diuji dari catatan event HINGGA
 * AKHIR PERIODE, bukan status pesanan saat laporan dibangun. Tiga sifat yang
 * wajib dibuktikan diskriminatif:
 *  - pembatalan SETELAH periode berakhir tidak menghapus pesanan dari laporan
 *    periode itu (di kode lama pesanan langsung hilang);
 *  - pesanan yang baru mencapai Diproses SETELAH periode berakhir tidak
 *    dihitung pada periode itu (di kode lama ikut terhitung);
 *  - pesanan tanpa catatan event tidak terhitung.
 *
 * Rentang uji Agustus 2026 sengaja dipakai karena selalu berada di masa lalu,
 * sehingga test tidak bergantung pada jam eksekusi.
 */
class StorePerformanceRecognitionFreezeTest extends TestCase
{
    use RefreshDatabase;

    private function buatPesanan(string $nomor, string $dibuat, int $total = 500000, string $status = 'processing'): Order
    {
        $order = Order::create([
            'order_number' => $nomor,
            'customer_name' => 'Uji Beku',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl Uji',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'payment_status' => $status === 'awaiting_confirmation' ? 'pending' : 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $total,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
        // created_at tidak ada di $fillable, jadi diperbarui lewat query builder.
        Order::whereKey($order->id)->update(['created_at' => $dibuat, 'updated_at' => $dibuat]);

        return $order->fresh();
    }

    private function event(Order $order, string $status, string $kapan): void
    {
        EventLog::create([
            'event_type' => 'order_status_changed',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'payload' => ['from' => 'awaiting_confirmation', 'order_status' => $status, 'source' => 'test'],
            'created_by_user_id' => null,
            'created_at' => Carbon::parse($kapan),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function laporanAgustus(): array
    {
        return app(StorePerformanceService::class)->build('custom', '2026-08-01', '2026-08-31');
    }

    /**
     * @return array<string, mixed>
     */
    private function kpi(array $laporan, string $key): array
    {
        $kpi = collect($laporan['sections'][0]['kpis'])->firstWhere('key', $key);
        $this->assertNotNull($kpi, 'KPI '.$key.' tidak ada di bagian Penjualan.');

        return $kpi;
    }

    public function test_pembatalan_setelah_periode_tidak_menghapus_pesanan_dari_laporan(): void
    {
        $order = $this->buatPesanan('ORD-BEKU-1', '2026-08-15 10:00:00');
        $this->event($order, 'processing', '2026-08-16 09:00:00');

        // Pembatalan terjadi SETELAH periode Agustus berakhir.
        $this->event($order, 'cancelled', '2026-09-15 12:00:00');
        Order::whereKey($order->id)->update(['order_status' => 'cancelled']);

        $laporan = $this->laporanAgustus();

        $this->assertSame(500000.0, (float) $laporan['financial']['gross_revenue']);
        $this->assertSame(1, (int) $this->kpi($laporan, 'orders')['value']);
        $this->assertSame(500000.0, (float) $this->kpi($laporan, 'omzet')['value']);
    }

    public function test_pengakuan_setelah_periode_tidak_dihitung_pada_periode_itu(): void
    {
        $order = $this->buatPesanan('ORD-BEKU-2', '2026-08-29 10:00:00');
        // Diproses lima hari SETELAH periode berakhir, status tetap processing.
        $this->event($order, 'processing', '2026-09-03 09:00:00');

        $laporan = $this->laporanAgustus();

        $this->assertSame(0.0, (float) $laporan['financial']['gross_revenue']);
        $this->assertSame(0, (int) $this->kpi($laporan, 'orders')['value']);
    }

    public function test_pesanan_tanpa_catatan_event_tidak_dihitung(): void
    {
        $this->buatPesanan('ORD-BEKU-3', '2026-08-20 10:00:00', 750000, 'awaiting_confirmation');

        $laporan = $this->laporanAgustus();

        $this->assertSame(0.0, (float) $laporan['financial']['gross_revenue']);
        $this->assertSame(0, (int) $this->kpi($laporan, 'orders')['value']);
    }

    public function test_grafik_dan_kartu_memakai_himpunan_pengakuan_yang_sama(): void
    {
        $order = $this->buatPesanan('ORD-BEKU-4', '2026-08-10 10:00:00');
        $this->event($order, 'processing', '2026-08-11 09:00:00');
        $this->event($order, 'cancelled', '2026-09-20 12:00:00');
        Order::whereKey($order->id)->update(['order_status' => 'cancelled']);

        $laporan = $this->laporanAgustus();

        $grafik = collect($laporan['charts'])->firstWhere('key', 'revenue');
        $this->assertNotNull($grafik);
        $this->assertSame(
            (float) $laporan['financial']['gross_revenue'],
            (float) $grafik['total'],
            'Grafik dan kartu wajib memakai satu himpunan.'
        );
        $this->assertSame(500000.0, (float) $grafik['total']);

        $campur = collect($laporan['payment_mix'])->firstWhere('method', 'transfer');
        $this->assertNotNull($campur, 'Pesanan yang diakui harus tetap ada di campuran pembayaran.');
        $this->assertSame(500000.0, (float) $campur['revenue']);
    }

    public function test_anchor_penjualan_menyebut_syarat_pengakuan(): void
    {
        $this->assertStringContainsString('Diproses', StorePerformanceService::METRIC_BASIS['omzet']['anchor']);
        $this->assertStringContainsString('Diproses', StorePerformanceService::METRIC_BASIS['orders']['anchor']);
    }
}
