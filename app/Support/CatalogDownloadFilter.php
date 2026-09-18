<?php

namespace App\Support;

use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;

/**
 * Penyaring unduhan template Update Produk dan Update Media.
 *
 * Dipakai bersama supaya menambah saringan baru (mis. per sub model, per
 * kategori, atau per rentang tanggal) tidak perlu menyalin logika ke endpoint
 * lain. Owner menyatakan filter akan bertambah, karena itu saringan
 * dikumpulkan di satu tempat.
 */
final class CatalogDownloadFilter
{
    /**
     * @param  array{model?: string|null, sub_model?: string|null, kategori?: string|null, q?: string|null}  $filter
     */
    public function __construct(private array $filter = [])
    {
    }

    /** @param array<string, mixed> $input */
    public static function fromRequest(array $input): self
    {
        return new self([
            'model' => self::text($input['model'] ?? null),
            'sub_model' => self::text($input['sub_model'] ?? null),
            'kategori' => self::text($input['kategori'] ?? null),
            'q' => self::text($input['q'] ?? null),
        ]);
    }

    private static function text(mixed $value): ?string
    {
        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }

    /**
     * Query produk beserta variannya, sudah tersaring.
     *
     * @return Builder<Product>
     */
    public function products(): Builder
    {
        return Product::query()
            ->with(['variants', 'media'])
            ->when($this->filter['model'] ?? null, fn (Builder $q, string $v) => $q->where('product_model', $v))
            ->when($this->filter['sub_model'] ?? null, fn (Builder $q, string $v) => $q->where('design_variant', $v))
            ->when($this->filter['kategori'] ?? null, fn (Builder $q, string $v) => $q->where('product_category', $v))
            ->when($this->filter['q'] ?? null, function (Builder $q, string $v): void {
                $needle = '%'.str_replace(['%', '_'], ['\%', '\_'], $v).'%';
                $q->where(function (Builder $inner) use ($needle): void {
                    $inner->where('name', 'like', $needle)
                        ->orWhere('parent_sku', 'like', $needle);
                });
            })
            ->orderBy('product_model')
            ->orderBy('name');
    }

    /**
     * Penanda filter untuk nama berkas unduhan, mis. "jungkit-2-daun-polos".
     * Kosong bila tidak ada filter, sehingga berkas penuh tetap bernama bersih.
     */
    public function fileSuffix(): string
    {
        $parts = array_filter([
            $this->filter["model"] ?? null,
            $this->filter["sub_model"] ?? null,
            $this->filter["kategori"] ?? null,
        ]);

        if ($parts === []) {
            return "";
        }

        $slug = strtolower(implode("-", $parts));
        $slug = preg_replace("/[^a-z0-9]+/", "-", $slug) ?? $slug;

        return trim($slug, "-");
    }

    /** Ringkasan filter untuk sheet Panduan supaya admin tahu cakupan unduhan. */
    public function summary(): string
    {
        $parts = [];
        foreach ([
            'kategori' => 'Kategori',
            'model' => 'Model',
            'sub_model' => 'Sub Model',
            'q' => 'Kata kunci',
        ] as $key => $label) {
            if (! empty($this->filter[$key])) {
                $parts[] = $label.': '.$this->filter[$key];
            }
        }

        return $parts === [] ? 'Seluruh katalog (tanpa filter)' : implode(', ', $parts);
    }
}
