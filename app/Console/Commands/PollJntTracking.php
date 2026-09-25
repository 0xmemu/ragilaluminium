<?php

namespace App\Console\Commands;

use App\Models\AdminNotification;
use App\Models\ShippingRecord;
use App\Services\Shipping\JntCargoClient;
use App\Services\ShippingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

class PollJntTracking extends Command
{
    protected $signature = 'shipping:poll-jnt
                            {--limit=30 : Batas jumlah resi yang diperiksa dalam satu panggilan}
                            {--throttle=30 : Batas minimal menit interval polling normal}
                            {--dry-run : Tampilkan daftar resi tanpa memanggil API J&T}';

    protected $description = 'Tarik status pelacakan J&T Cargo terjadwal untuk resi aktif sebagai fallback bila webhook kurir tidak masuk';

    public function handle(ShippingService $shipping, JntCargoClient $client): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $throttle = max(1, (int) $this->option('throttle'));
        $dryRun = (bool) $this->option('dry-run');

        // Query resi aktif yang memenuhi kriteria polling
        $records = ShippingRecord::query()
            ->with('order')
            ->whereNotNull('waybill_number')
            ->where('waybill_number', '!=', '')
            ->whereIn('status', [
                'tracking_pending',
                'pending_pickup',
                'picked_up',
                'in_process',
                'in_transit',
            ])
            ->whereHas('order', function ($query) {
                $query->whereNotIn('order_status', [
                    'delivered',
                    'completed',
                    'return_completed',
                    'cancelled',
                ]);
            })
            ->where(function ($query) {
                $query->whereNull('next_poll_at')
                    ->orWhere('next_poll_at', '<=', now());
            })
            ->where('created_at', '>=', now()->subDays(45))
            ->where('poll_attempts', '<', 20)
            ->orderByRaw('next_poll_at IS NULL DESC, next_poll_at ASC')
            ->limit($limit)
            ->get();

        $count = $records->count();
        if ($count === 0) {
            $this->info('Tidak ada resi aktif yang perlu diperiksa.');
            return self::SUCCESS;
        }

        $this->info("Menemukan {$count} resi aktif untuk diperiksa (limit: {$limit}, throttle: {$throttle} menit).");

        if ($dryRun) {
            $this->table(
                ['ID', 'Order ID', 'No Resi', 'Status Pengiriman', 'Terakhir Dicek', 'Next Poll', 'Gagal'],
                $records->map(fn ($r) => [
                    $r->id,
                    $r->order?->order_number ?? $r->order_id,
                    $r->waybill_number,
                    $r->status,
                    $r->last_polled_at ? $r->last_polled_at->format('Y-m-d H:i') : ($r->last_status_at ? $r->last_status_at->format('Y-m-d H:i') : '-'),
                    $r->next_poll_at ? $r->next_poll_at->format('Y-m-d H:i') : 'sekarang',
                    $r->poll_attempts,
                ])
            );
            return self::SUCCESS;
        }

        if (! $client->isEnabled()) {
            $this->warn('Integrasi J&T Cargo tidak aktif (jnt.enabled false atau kredensial kosong).');
            return self::SUCCESS;
        }

        $refreshed = 0;
        $failed = 0;

        foreach ($records as $record) {
            try {
                $this->line("Memeriksa resi {$record->waybill_number} (Order #{$record->order?->order_number})...");

                // Gunakan alur tunggal refreshStatus yang melewati state machine & applyCarrierUpdate yang sama dengan webhook
                $shipping->refreshStatus($record);
                $record->refresh();

                // Periksa apakah status pengiriman telah menjadi terminal
                $isTerminal = in_array($record->status, ['delivered', 'returned', 'cancelled'], true);

                $record->update([
                    'last_polled_at' => now(),
                    'poll_attempts' => 0,
                    'last_poll_error' => null,
                    'next_poll_at' => $isTerminal ? null : now()->addMinutes($throttle),
                ]);

                $refreshed++;
                // Beri jeda 150ms antar resi agar ramah jaringan kurir
                usleep(150000);
            } catch (Throwable $exception) {
                $failed++;
                $attempts = (int) $record->poll_attempts + 1;
                // Exponential backoff: 30m, 45m, 68m, ... maksimal 360m (6 jam)
                $backoffMinutes = min(360, (int) round($throttle * pow(1.5, min(8, $attempts))));
                $errorMsg = substr($exception->getMessage(), 0, 500);

                Log::channel('jnt')->warning('shipping:poll-jnt failed for waybill', [
                    'waybill' => $record->waybill_number,
                    'attempts' => $attempts,
                    'error' => $errorMsg,
                ]);

                $record->update([
                    'last_polled_at' => now(),
                    'poll_attempts' => $attempts,
                    'last_poll_error' => $errorMsg,
                    'next_poll_at' => now()->addMinutes($backoffMinutes),
                ]);

                // Buat notifikasi admin idempoten jika gagal berturut-turut >= 5 kali
                if ($attempts >= 5 && $record->order) {
                    $this->notifyAdminOfRepeatedFailure($record);
                }

                $this->error("Gagal memeriksa resi {$record->waybill_number}: {$exception->getMessage()}");
            }
        }

        $this->info("Selesai. Sukses diperiksa: {$refreshed}, Gagal: {$failed}.");
        return self::SUCCESS;
    }

    protected function notifyAdminOfRepeatedFailure(ShippingRecord $record): void
    {
        $exists = AdminNotification::query()
            ->where('type', 'shipping_poll_failed')
            ->where('related_type', ShippingRecord::class)
            ->where('related_id', $record->id)
            ->exists();

        if ($exists) {
            return;
        }

        AdminNotification::create([
            'type' => 'shipping_poll_failed',
            'related_type' => ShippingRecord::class,
            'related_id' => $record->id,
            'order_id' => $record->order_id,
            'title' => 'Gangguan Pelacakan J&T: Resi '.$record->waybill_number,
            'body' => 'Pelacakan resi '.$record->waybill_number.' (Pesanan '.$record->order?->order_number.') gagal diperbarui 5 kali berturut-turut.',
            'href' => route('admin.orders.show', $record->order_id),
        ]);
    }
}
