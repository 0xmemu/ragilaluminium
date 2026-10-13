<?php

namespace App\Console\Commands;

use App\Models\JntAddressMaster;
use App\Services\Shipping\JntCargoClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SyncJntAddressMaster extends Command
{
    protected $signature = 'jnt:sync-address-master {--dry-run : Ambil dan hitung tanpa menulis database}';
    protected $description = 'Sinkronkan master hierarki alamat J&T ke database lokal.';

    public function handle(JntCargoClient $jnt): int
    {
        $response = $jnt->address([]);
        $rows = $response->get('data');
        if (! $response->ok || ! is_array($rows)) {
            $this->error('Master alamat J&T gagal diambil.');
            return self::FAILURE;
        }

        $now = now();
        $normalized = [];
        foreach ($rows as $row) {
            if (! is_array($row) || ! isset($row['provinceName'])) continue;
            $item = [
                'province_name' => trim((string) $row['provinceName']),
                'city_name' => $this->nullable($row['cityName'] ?? null),
                'area_name' => $this->nullable($row['areaName'] ?? null),
                'town_name' => $this->nullable($row['townName'] ?? null),
                'province_key' => $this->key($row['provinceName']),
                'city_key' => $this->key($row['cityName'] ?? null),
                'area_key' => $this->key($row['areaName'] ?? null),
                'town_key' => $this->key($row['townName'] ?? null),
                'synced_at' => $now,
            ];
            $normalized[implode('|', [$item['province_key'], $item['city_key'] ?? '', $item['area_key'] ?? '', $item['town_key'] ?? ''])] = $item;
        }

        $this->info('Rows dari J&T: '.count($rows));
        $this->info('Rows hierarki unik: '.count($normalized));
        if ($this->option('dry-run')) return self::SUCCESS;

        DB::transaction(function () use ($normalized): void {
            foreach (array_chunk(array_values($normalized), 500) as $chunk) {
                JntAddressMaster::upsert(
                    $chunk,
                    ['province_key', 'city_key', 'area_key', 'town_key'],
                    ['province_name', 'city_name', 'area_name', 'town_name', 'synced_at', 'updated_at'],
                );
            }
        });

        $this->info('Master alamat J&T tersimpan.');
        return self::SUCCESS;
    }

    private function key(?string $value): ?string
    {
        $value = trim((string) $value);
        return $value === '' ? null : Str::upper(preg_replace('/[^A-Z0-9]+/i', ' ', $value) ?? $value);
    }

    private function nullable(?string $value): ?string
    {
        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }
}
