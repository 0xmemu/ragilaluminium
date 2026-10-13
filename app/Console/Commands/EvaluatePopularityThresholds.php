<?php

namespace App\Console\Commands;

use App\Models\ProductPopularityBoost;
use App\Services\ProductPopularityService;
use Illuminate\Console\Command;

class EvaluatePopularityThresholds extends Command
{
    protected $signature = 'popularity:evaluate-thresholds';

    protected $description = 'Kirim notifikasi ambang Teruskan Popularitas yang tercapai (pengganti evaluasi saat GET halaman admin)';

    public function handle(ProductPopularityService $popularity): int
    {
        $boosts = ProductPopularityBoost::query()
            ->enabled()
            ->whereNotNull('notification_threshold')
            ->whereNull('threshold_notified_at')
            ->get();

        $notified = 0;
        foreach ($boosts as $boost) {
            if ($popularity->evaluateThreshold($boost)) {
                $notified++;
            }
        }

        $this->info("Dicek {$boosts->count()} boost, notifikasi ambang terkirim: {$notified}.");

        return self::SUCCESS;
    }
}
