<?php

namespace App\Console\Commands;

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
                            {--throttle=30 : Batas minimal menit sejak pembaruan terakhir}
                            {--dry-run : Tampilkan daftar resi tanpa memanggil API J&T}';

    protected $description = 'Tarik status pelacakan J&T Cargo terjadwal untuk resi aktif sebagai fallback bila webhook kurir tidak masuk';

    public function handle(ShippingService $shipping, JntCargoClient $client): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $throttle = max(1, (int) $this->option('throttle'));
        $dryRun = (bool) $this->option('dry-run');

        // Query resi aktif yang perlu disinkronkan
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
            ->where(function ($query) use ($throttle) {
                $query->whereNull('last_status_at')
                    ->orWhere('updated_at', '<=', now()->subMinutes($throttle));
            })
            ->where('created_at', '>=', now()->subDays(45))
            ->orderBy('updated_at', 'asc')
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
                ['ID', 'Order ID', 'No Resi', 'Status Pengiriman', 'Terakhir Dicek'],
                $records->map(fn ($r) => [
                    $r->id,
                    $r->order?->order_number ?? $r->order_id,
                    $r->waybill_number,
                    $r->status,
                    $r->last_status_at ? $r->last_status_at->format('Y-m-d H:i') : '-',
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
                $shipping->refreshStatus($record);
                $refreshed++;
                // Beri jeda 150ms antar resi agar ramah terhadap jaringan API kurir
                usleep(150000);
            } catch (Throwable $exception) {
                $failed++;
                Log::channel('jnt')->warning('shipping:poll-jnt failed for waybill', [
                    'waybill' => $record->waybill_number,
                    'error' => $exception->getMessage(),
                ]);
                $this->error("Gagal memeriksa resi {$record->waybill_number}: {$exception->getMessage()}");
            }
        }

        $this->info("Selesai. Sukses diperiksa: {$refreshed}, Gagal: {$failed}.");
        return self::SUCCESS;
    }
}
