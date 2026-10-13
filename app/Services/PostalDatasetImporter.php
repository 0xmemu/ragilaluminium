<?php

namespace App\Services;

use App\Models\PostalDataset;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

class PostalDatasetImporter
{
    private array $report = ['rows' => 0, 'skipped' => 0, 'errors' => []];

    public function import(string $path, array $metadata): PostalDataset
    {
        if (! is_readable($path)) {
            throw new InvalidArgumentException('File dataset postal tidak dapat dibaca.');
        }

        $source = trim((string) ($metadata['source'] ?? ''));
        $version = trim((string) ($metadata['version'] ?? ''));
        if ($source === '' || $version === '') {
            throw new InvalidArgumentException('source dan version wajib diisi.');
        }

        $rows = $this->readRows($path);
        if ($rows === []) {
            throw new RuntimeException('Dataset postal tidak memiliki baris valid.');
        }

        $checksum = hash_file('sha256', $path) ?: null;

        return DB::transaction(function () use ($rows, $metadata, $source, $version, $checksum): PostalDataset {
            $dataset = PostalDataset::create([
                'source' => $source,
                'version' => $version,
                'source_url' => $metadata['source_url'] ?? null,
                'reference_source' => $metadata['reference_source'] ?? null,
                'reference_url' => $metadata['reference_url'] ?? null,
                'published_at' => $metadata['published_at'] ?? null,
                'retrieved_at' => now(),
                'checksum_sha256' => $checksum,
                'status' => ! empty($metadata['activate']) ? 'active' : 'staged',
                'row_count' => count($rows),
                'notes' => $metadata['notes'] ?? null,
            ]);

            foreach (array_chunk($rows, 1000) as $chunk) {
                $dataset->mappings()->createMany($chunk);
            }

            if (! empty($metadata['activate'])) {
                PostalDataset::query()
                    ->where('id', '!=', $dataset->id)
                    ->where('status', 'active')
                    ->update(['status' => 'retired']);
            }

            return $dataset->fresh();
        });
    }

    public function report(): array
    {
        return $this->report;
    }

    private function readRows(string $path): array
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Dataset postal gagal dibuka.');
        }

        $header = fgetcsv($handle);
        if (! is_array($header)) {
            fclose($handle);
            throw new RuntimeException('Header dataset postal tidak ditemukan.');
        }

        $header = array_map(
            static fn ($value): string => strtolower(trim(str_replace(["\xEF\xBB\xBF", ' '], ['', '_'], (string) $value))),
            $header,
        );
        $aliases = $this->aliases();
        $rows = [];
        $seen = [];

        try {
            $line = 1;
            while (($columns = fgetcsv($handle)) !== false) {
                $line++;
                $this->report['rows']++;
                $row = [];
                foreach ($header as $index => $key) {
                    $row[$key] = trim((string) ($columns[$index] ?? ''));
                }

                $normalized = $this->normalizeRow($row, $aliases, $line);
                if ($normalized === null) {
                    continue;
                }

                $dedupe = implode('|', [
                    $normalized['village_id'] ?? '',
                    $normalized['postal_code'],
                    $normalized['district_id'] ?? '',
                    $normalized['village_name'],
                ]);
                if (isset($seen[$dedupe])) {
                    $this->report['skipped']++;
                    continue;
                }
                $seen[$dedupe] = true;
                $rows[] = $normalized;
            }
        } finally {
            fclose($handle);
        }

        return $rows;
    }

    private function aliases(): array
    {
        return [
            'province_id' => ['province_id', 'kode_provinsi', 'kode_bps_provinsi', 'kode_kemendagri_provinsi'],
            'province_name' => ['province_name', 'nama_provinsi', 'nama_bps_provinsi', 'nama_kemendagri_provinsi'],
            'regency_id' => ['regency_id', 'kode_kabupaten_kota', 'kabupaten_kota_id', 'kode_kabupaten'],
            'regency_name' => ['regency_name', 'nama_kabupaten_kota', 'nama_kabupaten', 'kabupaten_kota'],
            'district_id' => ['district_id', 'kode_kecamatan', 'bps_kode_kecamatan', 'kemendagri_kode_kecamatan'],
            'district_name' => ['district_name', 'nama_kecamatan', 'bps_nama_kecamatan', 'kemendagri_nama_kecamatan'],
            'village_id' => ['village_id', 'kode_desa_kelurahan', 'bps_kode_desa_kelurahan', 'kemendagri_kode_desa_kelurahan'],
            'village_name' => ['village_name', 'nama_desa_kelurahan', 'bps_nama_desa_kelurahan', 'kemendagri_nama_desa_kelurahan'],
            'postal_code' => ['postal_code', 'kode_pos', 'kodepos'],
        ];
    }

    private function normalizeRow(array $row, array $aliases, int $line): ?array
    {
        $value = static function (string $key) use ($row, $aliases): string {
            foreach ($aliases[$key] as $alias) {
                if (array_key_exists($alias, $row) && $row[$alias] !== '') {
                    return $row[$alias];
                }
            }

            return '';
        };

        $postal = preg_replace('/\D+/', '', $value('postal_code')) ?? '';
        foreach (['province_name', 'regency_name', 'district_name', 'village_name'] as $key) {
            if ($value($key) === '') {
                $this->report['skipped']++;
                $this->report['errors'][] = "baris {$line}: {$key} kosong";

                return null;
            }
        }

        if (strlen($postal) !== 5) {
            $this->report['skipped']++;
            $this->report['errors'][] = "baris {$line}: kode_pos tidak 5 digit";

            return null;
        }

        return [
            'province_id' => $value('province_id') ?: null,
            'province_name' => $value('province_name'),
            'regency_id' => $value('regency_id') ?: null,
            'regency_name' => $value('regency_name'),
            'district_id' => $value('district_id') ?: null,
            'district_name' => $value('district_name'),
            'village_id' => $value('village_id') ?: null,
            'village_name' => $value('village_name'),
            'postal_code' => $postal,
            'source_row' => $line,
        ];
    }
}
