<?php

namespace App\Support;

use App\Models\JntAddressMaster;
use Illuminate\Support\Str;

class JntAddressResolver
{
    /**
     * Resolve the internal city/area names to the hierarchy required by J&T.
     * J&T's agingCost/get accepts areaName, while village/district may be
     * represented by townName in getAddress.
     *
     * @return array{province_name:?string, city_name:?string, area_name:?string, town_name:?string, status:string}
     */
    public function resolve(
        ?string $province,
        ?string $city,
        ?string $area,
        ?string $village = null,
    ): array {
        $provinceKey = $this->key($province);
        $cityKey = $this->key($city);
        $areaKey = $this->key($area);
        $villageKey = $this->key($village);

        // 1. Exact match on province_key + city_key
        $base = JntAddressMaster::query()
            ->where('province_key', $provinceKey)
            ->where('city_key', $cityKey);

        $match = $this->findMatch($base, $areaKey, $villageKey);

        // 2. Normalized city match (e.g. "KABUPATEN KARANGANYAR" -> "KAB KARANGANYAR")
        if ($match === null && $cityKey !== null) {
            $cityClean = $this->cleanCity($city);

            $matchingCityKeys = JntAddressMaster::query()
                ->when($provinceKey !== null, fn ($q) => $q->where('province_key', $provinceKey))
                ->select('city_key', 'city_name')
                ->distinct()
                ->get()
                ->filter(fn ($row) => $this->cleanCity($row->city_name) === $cityClean)
                ->pluck('city_key');

            if ($matchingCityKeys->isNotEmpty()) {
                $normBase = JntAddressMaster::query()->whereIn('city_key', $matchingCityKeys);
                $match = $this->findMatch($normBase, $areaKey, $villageKey);
            }
        }

        if ($match === null) {
            return [
                'province_name' => $province,
                'city_name' => $city,
                'area_name' => $area,
                'town_name' => $village,
                'status' => 'unmatched',
            ];
        }

        return [
            'province_name' => $match->province_name,
            'city_name' => $match->city_name,
            'area_name' => $match->area_name,
            'town_name' => $match->town_name,
            'status' => 'verified',
        ];
    }

    private function findMatch($query, ?string $areaKey, ?string $villageKey): ?JntAddressMaster
    {
        if ($villageKey !== null) {
            $match = (clone $query)->where('town_key', $villageKey)->first();
            if ($match) {
                return $match;
            }

            $vClean = $this->cleanAlnum($villageKey);
            $match = (clone $query)->whereRaw('REPLACE(town_key, " ", "") = ?', [$vClean])->first();
            if ($match) {
                return $match;
            }
        }

        if ($areaKey !== null) {
            // First check town_key (e.g. Temas)
            $match = (clone $query)->where('town_key', $areaKey)->first();
            if ($match) {
                return $match;
            }

            $aClean = $this->cleanAlnum($areaKey);
            $match = (clone $query)->whereRaw('REPLACE(town_key, " ", "") = ?', [$aClean])->first();
            if ($match) {
                return $match;
            }

            // Then check area_key
            $match = (clone $query)->where('area_key', $areaKey)->first();
            if ($match) {
                return $match;
            }

            $match = (clone $query)->whereRaw('REPLACE(area_key, " ", "") = ?', [$aClean])->first();
            if ($match) {
                return $match;
            }
        }

        return null;
    }

    private function key(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        return Str::upper(preg_replace('/[^A-Z0-9]+/i', ' ', $value) ?? $value);
    }

    private function cleanAlnum(?string $value): string
    {
        if (! $value) {
            return '';
        }

        return Str::upper(preg_replace('/[^A-Z0-9]/i', '', $value) ?? '');
    }

    private function cleanCity(?string $value): string
    {
        if (! $value) {
            return '';
        }
        $s = Str::upper(trim($value));
        $s = preg_replace('/^(KABUPATEN|KAB\\.?|KOTA|ADM\\.?)\\s+/i', '', $s);

        return preg_replace('/[^A-Z0-9]/i', '', $s);
    }
}
