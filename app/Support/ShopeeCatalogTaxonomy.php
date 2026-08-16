<?php

namespace App\Support;

/**
 * Taxonomy dari judul produk Shopee (xlsx tidak punya kolom category terisi).
 *
 * Kategori saling eksklusif — tidak ada “Jendela Boven”:
 * - kata Boven/Bouven → BOUVEN (meski judul diawali “Jendela …”)
 * - kata Pintu → DOOR
 * - kata Jendela (tanpa Boven) → WINDOW
 *
 * Model (Jungkit/Sliding/…) terpisah dari kategori: boleh ada
 * Jendela Jungkit dan Boven Jungkit sebagai dua produk berbeda.
 */
class ShopeeCatalogTaxonomy
{
    /**
     * Kategori tak dikenal diwakili sentinel 'UNKNOWN' (bukan fallback diam-diam ke
     * WINDOW/Jendela) sehingga import bisa menandainya untuk ditinjau admin.
     *
     * @return array{category: string, model: string, design: string}
     */
    public static function fromProductName(string $name): array
    {
        $upper = mb_strtoupper($name);

        return [
            'category' => self::categoryFromName($upper),
            'model' => self::modelFromName($upper),
            'design' => self::designFromName($upper),
        ];
    }

    protected static function categoryFromName(string $upper): string
    {
        if (self::hasWord($upper, ['PINTU', 'DOOR'])) {
            return 'DOOR';
        }

        // “Jendela Boven …” / “Boven 1 Daun …” → BOUVEN, bukan WINDOW.
        if (self::hasWord($upper, ['BOVEN', 'BOUVEN'])) {
            return 'BOUVEN';
        }

        if (self::hasWord($upper, ['JENDELA', 'WINDOW'])) {
            return 'WINDOW';
        }

        // Kategori tidak dikenal: sentinel jelas, bukan Jendela (hindari asumsi diam-diam).
        return 'UNKNOWN';
    }

    protected static function modelFromName(string $upper): string
    {
        if (self::hasWord($upper, ['JUNGKIT'])) {
            return 'JUNGKIT';
        }
        if (self::hasWord($upper, ['SWING', 'CASEMENT'])) {
            return 'SWING';
        }
        if (str_contains($upper, 'KACA MATI') || self::hasWord($upper, ['KACA_MATI', 'FIXED'])) {
            return 'KACA_MATI';
        }
        if (str_contains($upper, 'ZIG ZAG') || self::hasWord($upper, ['ZIGZAG'])) {
            return 'ZIGZAG';
        }
        if (self::hasWord($upper, ['SLIDING'])) {
            return 'SLIDING';
        }

        return 'SLIDING';
    }

    protected static function designFromName(string $upper): string
    {
        if (self::hasWord($upper, ['KOMBINASI', 'COMBINATION'])) {
            return 'KOMBINASI';
        }
        if (self::hasWord($upper, ['ORNAMEN', 'ORNAMENT'])) {
            return 'ORNAMEN';
        }

        return 'POLOS';
    }

    /**
     * @param  list<string>  $words
     */
    protected static function hasWord(string $upper, array $words): bool
    {
        foreach ($words as $word) {
            $word = mb_strtoupper($word);
            if ($word === '') {
                continue;
            }
            if (preg_match('/\b'.preg_quote($word, '/').'\b/u', $upper) === 1) {
                return true;
            }
        }

        return false;
    }
}
