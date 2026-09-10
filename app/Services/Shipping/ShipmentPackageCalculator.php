<?php

namespace App\Services\Shipping;

/**
 * Builds one provisional pallet package for the current cart.
 * Product dimensions use the Ragil convention: height, length, width/depth.
 */
final class ShipmentPackageCalculator
{
    public function __construct(
        private readonly float $allowancePerSideCm = 3.0,
        private readonly float $volumetricDivisor = 5000.0,
        private readonly float $palletWeightKg = 0.0,
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
                'packing_source' => 'manual_review',
                'manual_review' => true,
                'invalid_fields' => $invalid,
            ];
        }

        // Provisional layout for pallet standing items side by side:
        // largest height/length, accumulated width for every unit.
        $innerHeight = max(array_map(static fn (array $i): float => (float) $i['height_cm'], $items));
        $innerLength = max(array_map(static fn (array $i): float => (float) $i['length_cm'], $items));
        $innerWidth = array_sum(array_map(static fn (array $i): float => (float) $i['width_cm'] * (int) $i['quantity'], $items));
        $productWeight = array_sum(array_map(static fn (array $i): float => (float) $i['weight_kg'] * (int) $i['quantity'], $items));

        $allowances = array_map(static fn (array $item): float =>
            is_numeric($item['pallet_allowance_per_side_cm'] ?? null)
                ? max(0, (float) $item['pallet_allowance_per_side_cm'])
                : 3.0,
            $items,
        );
        $palletWeights = array_map(static fn (array $item): float =>
            is_numeric($item['pallet_weight_kg'] ?? null)
                ? max(0, (float) $item['pallet_weight_kg'])
                : 0.0,
            $items,
        );
        $allowance = max($allowances);
        $palletWeight = array_sum($palletWeights);
        $length = $innerLength + (2 * $allowance);
        $width = $innerWidth + (2 * $allowance);
        $height = $innerHeight + (2 * $allowance);
        $volume = $length * $width * $height;
        $actual = $productWeight + $palletWeight;
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
            'packing_source' => 'product_profile',
            'manual_review' => false,
            'invalid_fields' => [],
        ];
    }
}
