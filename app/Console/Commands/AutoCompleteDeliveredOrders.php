<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Console\Command;

/**
 * Item 1 antrean pekerjaan (owner 2026-09-21, eksekusi 2026-09-28):
 * pesanan berstatus Sampai yang sudah melewati masa tenggang berpindah
 * sendiri ke Selesai, dengan sumber audit "system" supaya jejaknya
 * terbedakan dari penyelesaian manual.
 *
 * Keputusan yang dipakai (default saran antrean):
 * - Masa tenggang 72 jam sejak paket tercatat sampai: sengaja di atas
 *   tenggat retur 48 jam, jadi hak retur selalu menutup lebih dulu.
 * - Berlaku untuk COD dan transfer.
 * - Dapat dimatikan lewat konfigurasi operations.orders_auto_complete.
 * - Tidak mengirim WhatsApp (paritas dengan penyelesaian manual).
 *
 * Syarat keamanan per pesanan: masih delivered, pembayaran sudah lunas
 * (sabuk pengaman, COD memang dilunasi saat sampai), dan tidak ada kasus
 * retur open.
 */
class AutoCompleteDeliveredOrders extends Command
{
    protected $signature = 'orders:auto-complete';

    protected $description = 'Menyelesaikan pesanan Sampai yang telah melewati masa tenggang';

    public function handle(OrderService $orders): int
    {
        if (! config('operations.orders_auto_complete.enabled', true)) {
            $this->info('Dinonaktifkan lewat konfigurasi.');

            return self::SUCCESS;
        }

        $graceHours = max(1, (int) config('operations.orders_auto_complete.grace_hours', 72));
        $batas = now()->subHours($graceHours);

        $kandidat = Order::query()
            ->where('order_status', 'delivered')
            ->where('payment_status', 'paid')
            ->whereDoesntHave('returnCases', fn ($q) => $q->where('status', 'open'))
            ->whereHas('shippingRecords', fn ($q) => $q
                ->where('status', 'delivered')
                ->where('last_status_at', '<=', $batas))
            ->get();

        if ($kandidat->isEmpty()) {
            $this->info('Tidak ada pesanan yang memenuhi syarat.');

            return self::SUCCESS;
        }

        $selesai = 0;
        foreach ($kandidat as $order) {
            $berpindah = $orders->transition($order, 'completed', null, 'system', [
                'auto_complete' => true,
                'grace_hours' => $graceHours,
            ]);

            if ($berpindah) {
                $selesai++;
                $this->line("Selesai: {$order->order_number}");
            }
        }

        $this->info("Total selesai otomatis: {$selesai} dari ".$kandidat->count().' kandidat.');

        return self::SUCCESS;
    }
}
