<?php

namespace App\Console\Commands;

use App\Models\AdminNotification;
use App\Models\ShippingRecord;
use App\Services\Shipping\JntCargoClient;
use App\Services\ShippingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Item 7 antrean pekerjaan: penarik status J&T terjadwal sebagai cadangan
 * webhook (owner 2026-09-28, eksekusi default saran antrean).
 *
 * Ini SATU-SATUNYA penarik yang dijadwalkan. Sebelumnya `shipping:poll-jnt`
 * ikut terjadwal dengan maksud yang sama, sehingga setiap resi aktif
 * diperiksa dua kali per setengah jam dan kuota API J&T terpakai dua kali.
 * Perintah itu kini hanya alat diagnostik manual.
 *
 * - Menarik resi J&T aktif (belum terminal, termasuk yang sedang bermasalah)
 *   yang terakhir diperbarui dalam jendela aktif, maksimum per jalanan.
 * - Tiap resi punya jatah waktunya sendiri (kolom next_poll_at) supaya satu
 *   kali jalan tidak menembak API untuk resi yang baru saja diperiksa, plus
 *   mundur bertingkat saat gagal dan berhenti setelah batas percobaan.
 * - Opsional berlangganan push J&T per resi (default mati; bentuk payload
 *   mengikuti track dan perlu validasi live sebelum diandalkan).
 * - Dapat dimatikan lewat operations.shipping_pull.enabled.
 */
class PullJntShippingStatus extends Command
{
    protected $signature = 'shipping:pull-jnt';

    protected $description = 'Menarik status J&T untuk resi aktif sebagai cadangan webhook';

    public function handle(ShippingService $shipping): int
    {
        if (! config('operations.shipping_pull.enabled', true)) {
            $this->info('Dinonaktifkan lewat konfigurasi.');

            return self::SUCCESS;
        }

        if (! config('jnt.enabled')) {
            $this->info('Integrasi J&T tidak aktif.');

            return self::SUCCESS;
        }

        $jendelaHari = max(1, (int) config('operations.shipping_pull.active_days', 30));
        $maks = max(1, (int) config('operations.shipping_pull.max_per_run', 50));
        $throttle = max(1, (int) config('operations.shipping_pull.throttle_minutes', 30));
        $maksPercobaan = max(1, (int) config('operations.shipping_pull.max_attempts', 20));
        $ambangAlert = max(1, (int) config('operations.shipping_pull.failure_alert_threshold', 5));
        $batas = now()->subDays($jendelaHari);

        $records = ShippingRecord::query()
            ->with('order')
            ->whereIn('carrier_name', ShippingRecord::jntCarrierNames())
            ->whereNotNull('waybill_number')
            ->where('waybill_number', '!=', '')
            ->whereIn('status', ['tracking_pending', 'pending_pickup', 'in_process', 'picked_up', 'in_transit', 'exception'])
            ->where(fn ($q) => $q
                ->where('last_status_at', '>=', $batas)
                ->orWhere(fn ($w) => $w->whereNull('last_status_at')->where('created_at', '>=', $batas)))
            ->where(fn ($q) => $q->whereNull('next_poll_at')->orWhere('next_poll_at', '<=', now()))
            ->where('poll_attempts', '<', $maksPercobaan)
            ->whereHas('order', fn ($q) => $q->whereNotIn('order_status', [
                'delivered',
                'completed',
                'return_completed',
                'cancelled',
            ]))
            ->orderByRaw('next_poll_at IS NULL DESC, next_poll_at ASC')
            ->limit($maks)
            ->get();

        if ($records->isEmpty()) {
            $this->info('Tidak ada resi aktif untuk ditarik.');

            return self::SUCCESS;
        }

        $berhasil = 0;
        $gagal = 0;
        $ukuranPotongan = max(1, (int) config('operations.shipping_pull.batch_size', 30));

        // Satu panggilan kurir untuk banyak resi sekaligus. Resi yang tidak
        // disebut pada respons gabungan ditarik sendiri-sendiri oleh service,
        // jadi hasilnya tidak pernah lebih buruk daripada satu per satu.
        $hasilPerResi = $shipping->refreshMany($records, $ukuranPotongan);

        foreach ($records as $record) {
            $exception = $hasilPerResi[$record->id] ?? null;

            if ($exception === null) {
                $record->refresh();

                $terminal = in_array($record->status, ['delivered', 'returned', 'cancelled'], true);

                $record->update([
                    'last_polled_at' => now(),
                    'poll_attempts' => 0,
                    'last_poll_error' => null,
                    'next_poll_at' => $terminal ? null : now()->addMinutes($throttle),
                ]);

                $berhasil++;
            } else {
                $gagal++;
                $percobaan = (int) $record->poll_attempts + 1;
                // Mundur bertingkat: 30m, 45m, 68m, ... maksimal 360m (6 jam).
                $mundur = min(360, (int) round($throttle * pow(1.5, min(8, $percobaan))));
                $pesan = substr($exception->getMessage(), 0, 500);

                Log::channel('jnt')->warning('shipping:pull-jnt failed for waybill', [
                    'waybill' => $record->waybill_number,
                    'attempts' => $percobaan,
                    'error' => $pesan,
                ]);

                $record->update([
                    'last_polled_at' => now(),
                    'poll_attempts' => $percobaan,
                    'last_poll_error' => $pesan,
                    'next_poll_at' => now()->addMinutes($mundur),
                ]);

                if ($percobaan >= $ambangAlert) {
                    $this->beriTahuAdminGagalBerulang($record, $percobaan);
                }
            }

            if (config('operations.shipping_pull.subscribe', false)) {
                try {
                    app(JntCargoClient::class)->subscribe(['billCodes' => $record->waybill_number]);
                } catch (Throwable $exception) {
                    Log::warning('shipping_pull_subscribe_failed', [
                        'waybill' => $record->waybill_number,
                        'message' => $exception->getMessage(),
                    ]);
                }
            }

        }

        $this->info("Selesai. Resi ditarik: {$berhasil}, gagal: {$gagal}.");

        return self::SUCCESS;
    }

    /**
     * Satu pemberitahuan per resi, idempoten. Memakai jenis yang sama dengan
     * alat diagnostik shipping:poll-jnt supaya admin tidak melihat dua jenis
     * peringatan untuk gangguan yang sama.
     */
    private function beriTahuAdminGagalBerulang(ShippingRecord $record, int $percobaan): void
    {
        $sudahAda = AdminNotification::query()
            ->where('type', 'shipping_poll_failed')
            ->where('related_type', ShippingRecord::class)
            ->where('related_id', $record->id)
            ->exists();

        if ($sudahAda) {
            return;
        }

        AdminNotification::create([
            'type' => 'shipping_poll_failed',
            'related_type' => ShippingRecord::class,
            'related_id' => $record->id,
            'order_id' => $record->order_id,
            'title' => 'Gangguan Pelacakan J&T: Resi '.$record->waybill_number,
            'body' => 'Pelacakan resi '.$record->waybill_number.' (Pesanan '.$record->order?->order_number.') gagal diperbarui '.$percobaan.' kali berturut-turut.',
            'href' => route('admin.orders.show', $record->order_id),
        ]);
    }
}
