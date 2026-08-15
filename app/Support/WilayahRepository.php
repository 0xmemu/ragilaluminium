<?php

namespace App\Support;

use Illuminate\Support\Str;

class WilayahRepository
{
    /** @var array<string, list<array{id: string, name: string, parent_id?: string}>> */
    private static array $fileCache = [];

    /**
     * @return list<array{id: string, name: string}>
     */
    public function provinces(?string $q = null): array
    {
        return $this->filterByQuery($this->loadSimple('provinces.csv'), $q);
    }

    /**
     * @return list<array{id: string, name: string}>
     */
    public function regencies(string $provinceId, ?string $q = null): array
    {
        $rows = array_values(array_filter(
            $this->loadWithParent('regencies.csv'),
            fn (array $row) => $row['parent_id'] === $provinceId,
        ));

        return $this->filterByQuery($this->withoutParent($rows), $q);
    }

    /**
     * @return list<array{id: string, name: string}>
     */
    public function districts(string $regencyId, ?string $q = null): array
    {
        $rows = array_values(array_filter(
            $this->loadWithParent('districts.csv'),
            fn (array $row) => $row['parent_id'] === $regencyId,
        ));

        return $this->filterByQuery($this->withoutParent($rows), $q);
    }

    /**
     * @return list<array{id: string, name: string}>
     */
    public function villages(string $districtId, ?string $q = null): array
    {
        $path = $this->path('villages.csv');
        if (! is_readable($path)) {
            return [];
        }

        $rows = [];
        $postalCodes = app(PostalCodeRepository::class)->postalCodesForDistrict($districtId);
        $handle = fopen($path, 'r');
        if ($handle === false) {
            return [];
        }

        try {
            while (($cols = fgetcsv($handle)) !== false) {
                if (count($cols) < 3) {
                    continue;
                }
                if ((string) $cols[1] !== $districtId) {
                    continue;
                }
                $rows[] = [
                    'id' => (string) $cols[0],
                    'name' => (string) $cols[2],
                    'postal_code' => $postalCodes[(string) $cols[0]] ?? null,
                ];
            }
        } finally {
            fclose($handle);
        }

        return $this->filterByQuery($rows, $q);
    }

    /**
     * @param  list<array{id: string, name: string}>  $rows
     * @return list<array{id: string, name: string}>
     */
    private function filterByQuery(array $rows, ?string $q): array
    {
        $q = trim((string) $q);
        if ($q === '') {
            return $rows;
        }

        $needle = Str::lower($q);

        return array_values(array_filter(
            $rows,
            fn (array $row) => str_contains(Str::lower($row['name']), $needle),
        ));
    }

    /**
     * @return list<array{id: string, name: string}>
     */
    private function loadSimple(string $filename): array
    {
        if (isset(self::$fileCache[$filename])) {
            return self::$fileCache[$filename];
        }

        $path = $this->path($filename);
        $rows = [];
        if (! is_readable($path)) {
            return self::$fileCache[$filename] = [];
        }

        $handle = fopen($path, 'r');
        if ($handle === false) {
            return self::$fileCache[$filename] = [];
        }

        try {
            while (($cols = fgetcsv($handle)) !== false) {
                if (count($cols) < 2) {
                    continue;
                }
                $rows[] = [
                    'id' => (string) $cols[0],
                    'name' => (string) $cols[1],
                ];
            }
        } finally {
            fclose($handle);
        }

        return self::$fileCache[$filename] = $rows;
    }

    /**
     * @return list<array{id: string, name: string, parent_id: string}>
     */
    private function loadWithParent(string $filename): array
    {
        if (isset(self::$fileCache[$filename])) {
            return self::$fileCache[$filename];
        }

        $path = $this->path($filename);
        $rows = [];
        if (! is_readable($path)) {
            return self::$fileCache[$filename] = [];
        }

        $handle = fopen($path, 'r');
        if ($handle === false) {
            return self::$fileCache[$filename] = [];
        }

        try {
            while (($cols = fgetcsv($handle)) !== false) {
                if (count($cols) < 3) {
                    continue;
                }
                $rows[] = [
                    'id' => (string) $cols[0],
                    'parent_id' => (string) $cols[1],
                    'name' => (string) $cols[2],
                ];
            }
        } finally {
            fclose($handle);
        }

        return self::$fileCache[$filename] = $rows;
    }

    /**
     * @param  list<array{id: string, name: string, parent_id?: string}>  $rows
     * @return list<array{id: string, name: string}>
     */
    private function withoutParent(array $rows): array
    {
        return array_map(
            fn (array $row) => ['id' => $row['id'], 'name' => $row['name']],
            $rows,
        );
    }

    private function path(string $filename): string
    {
        return storage_path('app/wilayah/'.$filename);
    }
}
