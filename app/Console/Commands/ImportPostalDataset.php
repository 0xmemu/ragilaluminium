<?php

namespace App\Console\Commands;

use App\Services\PostalDatasetImporter;
use Illuminate\Console\Command;
use InvalidArgumentException;
use RuntimeException;

class ImportPostalDataset extends Command
{
    protected $signature = 'postal:import
        {path : CSV dataset path}
        {--version= : Source version or production date}
        {--source= : Dataset authority, e.g. data.go.id}
        {--source-url= : Dataset URL}
        {--reference-source=Pos Indonesia : Verification reference}
        {--reference-url= : Verification reference URL}
        {--published-at= : Source publication date}
        {--activate : Retire the previous active dataset}';

    protected $description = 'Import a versioned desa/kelurahan postal dataset';

    public function handle(PostalDatasetImporter $importer): int
    {
        try {
            $dataset = $importer->import($this->argument('path'), [
                'source' => $this->option('source') ?: config('postal.baseline.source'),
                'version' => $this->option('version'),
                'source_url' => $this->option('source-url') ?: config('postal.baseline.source_url'),
                'reference_source' => $this->option('reference-source'),
                'reference_url' => $this->option('reference-url') ?: config('postal.baseline.reference_url'),
                'published_at' => $this->option('published-at'),
                'activate' => (bool) $this->option('activate'),
            ]);
        } catch (InvalidArgumentException|RuntimeException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info("Dataset {$dataset->source}:{$dataset->version} tersimpan sebagai {$dataset->status} ({$dataset->row_count} baris).");
        $report = $importer->report();
        if ($report['skipped'] > 0) {
            $this->warn("{$report['skipped']} baris dilewati.");
        }

        return self::SUCCESS;
    }
}
