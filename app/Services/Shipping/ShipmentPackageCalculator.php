<?php

namespace App\Services\Shipping;

/**
 * Builds one provisional package for the current cart/order lines.
 * Product dimensions use the Ragil convention: height, length, width/depth.
 *
 * Keputusan owner 2026-09-25 (Metode A):
 * - Memakai berat dan dimensi paket aktual per produk.
 * - Tanpa tambahan ukuran packing kayu/pallet (allowance default 0).
 * - Per pesanan menjumlahkan volume paket masing-masing produk (pendekatan standar multi-koli J&T Cargo).
 */
final class ShipmentPackageCalculator
{
    public function __construct(
        private readonly float $allowancePerSideCm = 0.0,
        private readonly float $volumetricDivisor = 5000.0,
    ) {}

    /** @param list<array{weight_kg:float, height_cm:float, length_cm:float, width_cm:float, quantity:int}> $items */
    public function calculate(array $items): array
    {
        $items = array_values(array_filter($items, static fn (array $item): bool => ($item['quantity'] ?? 0) > 0));

        if ($items === []) {
            return [
                'length_cm' => 0.0,
                'width_cm' => 0.0,
                'height_cm' => 0.0,
                'volume_cm3' => 0.0,
                'product_weight_kg' => 0.0,
                'actual_weight_kg' => 0.0,
                'volumetric_weight_kg' => 0.0,
                'chargeable_weight_kg' => 0.0,
                'package_count' => 0,
                'packing_source' => 'catalog_default',
            ];
        }

        $invalid = [];
        foreach ($items as $index => $item) {
            foreach (['weight_kg', 'height_cm', 'length_cm', 'width_cm'] as $field) {
                if (! is_numeric($item[$field] ?? null) || (float) $item[$field] <= 0) {
                    $invalid[] = "items.{$index}.{$field}";
                }
            }
        }

        if ($invalid !== []) {
            return [
                'length_cm' => 0.0,
                'width_cm' => 0.0,
                'height_cm' => 0.0,
                'volume_cm3' => 0.0,
                'product_weight_kg' => 0.0,
                'actual_weight_kg' => 0.0,
                'volumetric_weight_kg' => 0.0,
                'chargeable_weight_kg' => 0.0,
                'package_count' => array_sum(array_map(static fn (array $i): int => (int) ($i['quantity'] ?? 1), $items)),
                'packing_source' => 'manual_review',
                'manual_review' => true,
                'invalid_fields' => $invalid,
            ];
        }

        $productWeight = array_sum(array_map(static fn (array $i): float => (float) $i['weight_kg'] * (int) $i['quantity'], $items));
        $packageCount = array_sum(array_map(static fn (array $i): int => (int) $i['quantity'], $items));

        // Metode A (keputusan owner 2026-09-25):
        // Total volume adalah penjumlahan volume paket masing-masing produk: sum(P * L * T * qty).
        $totalVolume = array_sum(array_map(
            static fn (array $i): float => (float) $i['length_cm'] * (float) $i['width_cm'] * (float) $i['height_cm'] * (int) $i['quantity'],
            $items
        ));

        $maxHeight = max(array_map(static fn (array $i): float => (float) $i['height_cm'], $items));
        $maxLength = max(array_map(static fn (array $i): float => (float) $i['length_cm'], $items));

        $allowance = $this->allowancePerSideCm;

        if ($allowance > 0.0) {
            // Kompatibilitas mundur bila allowance kayu secara eksplisit diset > 0
            $innerWidth = array_sum(array_map(static fn (array $i): float => (float) $i['width_cm'] * (int) $i['quantity'], $items));
            $length = $maxLength + (2 * $allowance);
            $width = $innerWidth + (2 * $allowance);
            $height = $maxHeight + (2 * $allowance);
            $volume = $length * $width * $height;
        } else {
            // Metode A murni: volume total adalah jumlah volume paket masing-masing
            $length = $maxLength;
            $height = $maxHeight;
            // Lebar efektif agar panjang x lebar x tinggi = volume total
            $width = ($length > 0 && $height > 0) ? round($totalVolume / ($length * $height), 3) : 0.0;
            $volume = $totalVolume;
        }

        $actual = $productWeight;
        $volumetric = $volume / $this->volumetricDivisor;

        return [
            'length_cm' => round($length, 3),
            'width_cm' => round($width, 3),
            'height_cm' => round($height, 3),
            'volume_cm3' => round($volume, 3),
            'product_weight_kg' => round($productWeight, 3),
            'actual_weight_kg' => round($actual, 3),
            'volumetric_weight_kg' => round($volumetric, 3),
            'chargeable_weight_kg' => round(max($actual, $volumetric), 3),
            'package_count' => $packageCount,
            'packing_source' => 'product_profile',
            'manual_review' => false,
            'invalid_fields' => [],
        ];
    }
}
