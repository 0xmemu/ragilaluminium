<?php

namespace App\Support;

use App\Models\PostalCodeMapping;
use App\Models\PostalDataset;
use Illuminate\Support\Str;

class PostalCodeRepository
{
    public function validate(
        ?string $postalCode,
        ?string $villageId = null,
        ?string $villageName = null,
        ?string $districtId = null,
        ?string $districtName = null,
    ): array {
        $postal = $this->normalizePostalCode($postalCode);
        $dataset = $this->activeDataset();

        if ($dataset === null) {
            return $this->unavailable($postal);
        }

        if ($postal === null) {
            return $this->result('invalid', false, $postal, $dataset, null);
        }

        // Spesifikasi: kode pos Indonesia pada dasarnya LINGKUP KECAMATAN.
        // Validasi utama mencocokkan (district + kode pos), bukan per-desa —
        // menghindari penolakan order yang sah akibat beda ejaan nama desa antar
        // sumber (Kemendagri vs Pos Indonesia). Desa hanya dipakai bila identitas
        // kecamatan tidak diberikan (fallback granular).
        $hasDistrict = filled($districtId) || filled($districtName);
        $hasVillage = filled($villageId) || filled($villageName);
        $identityGiven = $hasDistrict || $hasVillage;

        $query = PostalCodeMapping::query()
            ->where('postal_dataset_id', $dataset->id)
            ->where('postal_code', $postal);

        if ($hasDistrict) {
            if (filled($districtId)) {
                $query->where('district_id', (string) $districtId);
            } elseif (filled($districtName)) {
                $query->whereRaw('LOWER(TRIM(district_name)) = ?', [Str::lower(trim((string) $districtName))]);
            }
        } elseif ($hasVillage) {
            if (filled($villageId)) {
                $query->where('village_id', (string) $villageId);
            } elseif (filled($villageName)) {
                $query->whereRaw('LOWER(TRIM(village_name)) = ?', [Str::lower(trim((string) $villageName))]);
            }
        }

        $mapping = $query->first();
        if ($mapping === null && ! $identityGiven) {
            $mapping = PostalCodeMapping::query()
                ->where('postal_dataset_id', $dataset->id)
                ->where('postal_code', $postal)
                ->first();
        }

        return $this->result(
            $mapping === null ? 'invalid' : 'valid',
            $mapping !== null,
            $postal,
            $dataset,
            $mapping,
        );
    }

    public function activeDataset(): ?PostalDataset
    {
        return PostalDataset::query()
            ->active()
            ->latest('retrieved_at')
            ->latest('id')
            ->first();
    }

    /**
     * Return the current postal code per village for the dependent wilayah
     * selector. A missing dataset is a valid pre-import state; the selector
     * then leaves postal_code empty so Maps/manual fallback can be used.
     *
     * @return array<string, string>
     */
    public function postalCodesForDistrict(string $districtId): array
    {
        $dataset = $this->activeDataset();
        if ($dataset === null) {
            return [];
        }

        return PostalCodeMapping::query()
            ->where('postal_dataset_id', $dataset->id)
            ->where('district_id', $districtId)
            ->pluck('postal_code', 'village_id')
            ->map(static fn ($postal): string => (string) $postal)
            ->all();
    }

    /**
     * Kode pos per desa (village_name) dalam satu kecamatan (district_name).
     * Kode pos Indonesia umumnya per kecamatan, tetapi di kota besar tiap desa
     * boleh beda kode pos. Mencocokkan per nama desa adalah granularitas paling
     * akurat dan menghilangkan ambiguitas kecamatan multi-kode-pos.
     *
     * @return array<string, string> map lowercase village_name => postal_code
     */
    public function postalCodesForVillageNames(string $districtName): array
    {
        $dataset = $this->activeDataset();
        if ($dataset === null) {
            return [];
        }

        $name = \Illuminate\Support\Str::lower(trim($districtName));

        return PostalCodeMapping::query()
            ->where('postal_dataset_id', $dataset->id)
            ->whereRaw('LOWER(TRIM(district_name)) = ?', [$name])
            ->get(['village_name', 'postal_code'])
            ->mapWithKeys(function (PostalCodeMapping $mapping): array {
                $key = \Illuminate\Support\Str::lower(trim($mapping->village_name));

                return [$key => (string) $mapping->postal_code];
            })
            ->all();
    }

    public function normalizePostalCode(?string $postalCode): ?string
    {
        $value = preg_replace('/\D+/', '', (string) $postalCode) ?? '';

        return strlen($value) === 5 ? $value : null;
    }

    private function unavailable(?string $postalCode): array
    {
        return [
            'status' => 'unavailable',
            'valid' => null,
            'postal_code' => $this->normalizePostalCode($postalCode),
            'dataset_id' => null,
            'dataset_version' => null,
            'mapping' => null,
        ];
    }

    private function result(
        string $status,
        ?bool $valid,
        ?string $postalCode,
        PostalDataset $dataset,
        ?PostalCodeMapping $mapping,
    ): array {
        return [
            'status' => $status,
            'valid' => $valid,
            'postal_code' => $this->normalizePostalCode($postalCode),
            'dataset_id' => $dataset->id,
            'dataset_version' => $dataset->version,
            'mapping' => $mapping?->toArray(),
        ];
    }
}
