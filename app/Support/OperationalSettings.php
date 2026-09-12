<?php

namespace App\Support;

use App\Models\OperationalSettingVersion;
use App\Services\ActivityLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only version ledger for business settings.
 *
 * Provider credentials/readiness are intentionally not part of this contract.
 */
final class OperationalSettings
{
    public const COD = 'cod';
    public const SHIPPING_SUBSIDY = 'shipping_subsidy';
    public const STOCK_RANDOMIZATION = 'stock_randomization';
    public const ETA = 'eta';

    /** @return array<string, array<string, mixed>> */
    public static function defaults(): array
    {
        return [
            self::COD => CodSettings::DEFAULTS,
            self::SHIPPING_SUBSIDY => ShippingSubsidySettings::DEFAULTS,
            self::STOCK_RANDOMIZATION => [
                'default_enabled' => true,
                'min' => 700,
                'max' => 5000,
            ],
            self::ETA => [
                'production_days' => max(0, (int) config('shipping.eta.production_days', 1)),
                'delivery_min_days' => max(1, (int) config('shipping.eta.delivery_min_days', 2)),
                'delivery_max_days' => max(1, (int) config('shipping.eta.delivery_max_days', 5)),
                'display_buffer_days' => max(0, (int) config('shipping.eta.display_buffer_days', 1)),
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    public static function current(string $key): ?array
    {
        if (! Schema::hasTable('operational_setting_versions')) {
            return null;
        }
        $row = OperationalSettingVersion::query()
            ->where('setting_key', $key)
            ->orderByDesc('version')
            ->orderByDesc('id')
            ->first();

        return $row?->value;
    }

    public static function available(): bool
    {
        return Schema::hasTable('operational_setting_versions');
    }

    public static function get(string $key): array
    {
        return self::current($key) ?? (self::defaults()[$key] ?? []);
    }

    public static function record(
        string $key,
        array $value,
        ?int $actorId = null,
        string $source = 'system',
        ?string $reason = null,
        ?string $referenceType = null,
        ?string $referenceId = null,
    ): OperationalSettingVersion {
        if (! array_key_exists($key, self::defaults())) {
            throw new \InvalidArgumentException("Unknown operational setting [{$key}].");
        }

        $normalized = self::normalize($key, $value);

        return DB::transaction(function () use (
            $key,
            $normalized,
            $actorId,
            $source,
            $reason,
            $referenceType,
            $referenceId,
        ): OperationalSettingVersion {
            $before = self::current($key);
            $version = ((int) OperationalSettingVersion::query()
                ->where('setting_key', $key)
                ->lockForUpdate()
                ->max('version')) + 1;

            $row = OperationalSettingVersion::create([
                'setting_key' => $key,
                'version' => $version,
                'value' => $normalized,
                'actor_id' => $actorId,
                'source' => $source,
                'reason' => $reason,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'created_at' => now(),
            ]);

            ActivityLogService::record(
                'settings.version_created',
                'operational_setting',
                $row->id,
                ['setting_key' => $key, 'version' => $version],
                $actorId,
                $source,
                $before,
                $normalized,
                $reason,
                $referenceType,
                $referenceId,
            );

            return $row;
        });
    }

    public static function normalize(string $key, array $value): array
    {
        return match ($key) {
            self::COD => [
                'enabled' => (bool) ($value['enabled'] ?? true),
                'fee_type' => 'percent',
                'fee_value' => min(100, max(0, (float) ($value['fee_value'] ?? 0))),
                'max_order_amount' => ($value['max_order_amount'] ?? null) === null || ($value['max_order_amount'] ?? '') === ''
                    ? null
                    : max(0, (float) $value['max_order_amount']),
            ],
            self::SHIPPING_SUBSIDY => [
                'enabled' => (bool) ($value['enabled'] ?? false),
                'subsidy_type' => ($value['subsidy_type'] ?? 'percent') === 'fixed' ? 'fixed' : 'percent',
                'subsidy_value' => ($value['subsidy_type'] ?? 'percent') === 'percent'
                    ? min(100, max(0, (float) ($value['subsidy_value'] ?? 0)))
                    : max(0, (float) ($value['subsidy_value'] ?? 0)),
                'carriers' => [
                    'jnt' => (bool) ($value['carriers']['jnt'] ?? $value['jnt_enabled'] ?? true),
                ],
            ],
            self::STOCK_RANDOMIZATION => self::normalizeStock($value),
            self::ETA => self::normalizeEta($value),
            default => throw new \InvalidArgumentException("Unknown operational setting [{$key}]."),
        };
    }

    /** @return array{default_enabled: bool, min: int, max: int} */
    private static function normalizeStock(array $value): array
    {
        $min = max(0, (int) ($value['min'] ?? 700));
        $max = max($min, (int) ($value['max'] ?? 5000));

        return [
            'default_enabled' => (bool) ($value['default_enabled'] ?? true),
            'min' => $min,
            'max' => $max,
        ];
    }

    /** @return array{production_days: int, delivery_min_days: int, delivery_max_days: int, display_buffer_days: int} */
    private static function normalizeEta(array $value): array
    {
        $min = max(1, (int) ($value['delivery_min_days'] ?? 2));

        return [
            'production_days' => max(0, (int) ($value['production_days'] ?? 1)),
            'delivery_min_days' => $min,
            'delivery_max_days' => max($min, (int) ($value['delivery_max_days'] ?? 5)),
            'display_buffer_days' => max(0, (int) ($value['display_buffer_days'] ?? 1)),
        ];
    }
}
