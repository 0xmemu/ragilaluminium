<?php

namespace App\Support;

/**
 * Maps Shopee variation_name ("slot1,slot2") onto product_variants axes.
 *
 * Window / bouven (2 slots, separate attributes):
 *   "Putih,Kaca Bening" → Warna + Kaca
 *
 * Swing door (2 slots, different semantics — do NOT force window axes):
 *   "Buka Kanan,Putih Kaca Bening" → Arah Buka + Warna & Kaca (combined finishing)
 */
class ShopeeVariationAxes
{
    private const COLORS = ['Serat Kayu', 'Hitam', 'Putih', 'Cokelat'];

    private const GLASSES = ['Kaca Bening', 'Kaca Riben', 'Kaca Es'];

    /**
     * @return array{
     *   variation_1_name: ?string,
     *   variation_1_option: ?string,
     *   variation_2_name: ?string,
     *   variation_2_option: ?string
     * }
     */
    public static function fromVariationName(string $variationName): array
    {
        $parts = array_map(
            static fn (string $part): string => trim((string) preg_replace('/T\d+\s*X\s*P\d+/i', '', $part)),
            explode(',', $variationName),
        );

        $slot1 = ($parts[0] ?? '') !== '' ? $parts[0] : null;
        $slot2 = isset($parts[1]) && $parts[1] !== '' ? $parts[1] : null;

        if ($slot1 !== null && self::isOpeningDirection($slot1)) {
            $combined = self::normalizeColorGlassLabel($slot2);

            return [
                'variation_1_name' => 'Arah Buka',
                'variation_1_option' => self::normalizeOpening($slot1),
                'variation_2_name' => $combined !== null ? 'Warna & Kaca' : 'Kaca',
                'variation_2_option' => $combined ?? self::normalizeGlassOnly($slot2),
            ];
        }

        return [
            'variation_1_name' => $slot1 !== null ? 'Warna' : null,
            'variation_1_option' => $slot1,
            'variation_2_name' => $slot2 !== null ? 'Kaca' : null,
            'variation_2_option' => self::normalizeGlassOnly($slot2),
        ];
    }

    public static function isOpeningDirection(?string $value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }

        return (bool) preg_match('/^Buka\s+(Kanan|Kiri)$/iu', trim($value));
    }

    public static function normalizeOpening(string $value): string
    {
        if (preg_match('/^Buka\s+Kanan$/iu', trim($value))) {
            return 'Buka Kanan';
        }
        if (preg_match('/^Buka\s+Kiri$/iu', trim($value))) {
            return 'Buka Kiri';
        }

        return trim($value);
    }

    /**
     * Fix Shopee typos: "KcaBening", "KacaRiben", "Kca Bening".
     */
    public static function normalizeOptionText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim($value);
        if ($text === '') {
            return null;
        }

        // "KcaBening" / "Kca Bening" → "Kaca Bening"; "KacaRiben" → "Kaca Riben".
        $text = preg_replace('/\bKca(?=\s*[A-Za-z])/iu', 'Kaca', $text) ?? $text;
        $text = preg_replace('/\bKaca(?=[A-Za-z])/u', 'Kaca ', $text) ?? $text;
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return trim($text);
    }

    /**
     * @return array{color: string, glass: string}|null
     */
    public static function splitColorGlass(?string $value): ?array
    {
        $text = self::normalizeOptionText($value);
        if ($text === null) {
            return null;
        }

        $colorAlt = implode('|', array_map(static fn (string $c): string => preg_quote($c, '/'), self::COLORS));
        $glassAlt = implode('|', array_map(static fn (string $g): string => preg_quote($g, '/'), self::GLASSES));

        if (preg_match('/^('.$colorAlt.')\s+('.$glassAlt.')$/iu', $text, $m)) {
            return [
                'color' => self::canonicalColor($m[1]),
                'glass' => self::canonicalGlass($m[2]),
            ];
        }

        return null;
    }

    public static function normalizeColorGlassLabel(?string $value): ?string
    {
        $split = self::splitColorGlass($value);
        if ($split === null) {
            return null;
        }

        return $split['color'].' '.$split['glass'];
    }

    public static function normalizeGlassOnly(?string $value): ?string
    {
        $text = self::normalizeOptionText($value);
        if ($text === null) {
            return null;
        }

        // "240 x 220 Kaca Riben" → keep glass token for the Kaca axis.
        $glassAlt = implode('|', array_map(static fn (string $g): string => preg_quote($g, '/'), self::GLASSES));
        if (preg_match('/('.$glassAlt.')$/iu', $text, $m)) {
            return self::canonicalGlass($m[1]);
        }

        foreach (self::GLASSES as $glass) {
            if (strcasecmp($text, $glass) === 0) {
                return $glass;
            }
        }

        return $text;
    }

    private static function canonicalColor(string $value): string
    {
        foreach (self::COLORS as $color) {
            if (strcasecmp($color, trim($value)) === 0) {
                return $color;
            }
        }

        return trim($value);
    }

    private static function canonicalGlass(string $value): string
    {
        $normalized = self::normalizeOptionText($value) ?? trim($value);
        foreach (self::GLASSES as $glass) {
            if (strcasecmp($glass, $normalized) === 0) {
                return $glass;
            }
        }

        return $normalized;
    }
}
