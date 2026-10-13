<?php

namespace App\Console\Commands;

use App\Support\JntReadiness;
use Illuminate\Console\Command;

/**
 * Validasi kesiapan kredensial + pengirim J&T Cargo Open Platform.
 *
 *   php artisan jnt:status
 */
class JntStatus extends Command
{
    protected $signature = 'jnt:status';

    protected $description = 'Cek kesiapan integrasi J&T Cargo Open Platform (kredensial + pengirim).';

    public function handle(): int
    {
        $report = JntReadiness::report();

        $this->info("Provider: {$report['provider_label']} ({$report['provider']})");
        $this->line("Environment: {$report['environment']}");
        $this->line("Base URL: {$report['base_url']}");
        $this->line('Client ready (API calls): '.($report['client_ready'] ? 'YES' : 'NO'));
        $this->newLine();

        foreach ($report['checks'] as $key => $ok) {
            $this->line(sprintf('  [%s] %s', $ok ? 'OK' : 'MISSING', $key));
        }

        $this->newLine();

        if ($report['missing'] === []) {
            $this->info('Semua checklist terisi. Lanjut: php artisan jnt:joint-debug --times=3');

            return self::SUCCESS;
        }

        $this->warn('Belum siap. Isi di .env: '.implode(', ', $report['missing']));
        $this->comment('Daftar di https://open.jtcargo.co.id — jangan pakai Biteship (Express only).');
        $this->comment('Setelah kredensial sandbox: JNT_ENABLED=true lalu jnt:joint-debug.');

        return self::FAILURE;
    }
}
