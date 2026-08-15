<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Session\Store;

class CartService
{
    protected const SESSION_KEY = 'ragil_cart';

    public function __construct(protected Store $session)
    {
    }

    public function get(?array $onlyLineIds = null): array
    {
        $cart = $this->session->get(self::SESSION_KEY, []);

        if ($onlyLineIds !== null) {
            $ids = array_flip($onlyLineIds);
            $cart = array_intersect_key($cart, $ids);
        }

        return $cart;
    }

    public function add(string $parentSku, ?string $variantSku, int $quantity, ?string $note = null): array
    {
        $cart = $this->get();
        $lineId = $variantSku ?: $parentSku;
        $quantity = max(1, $quantity);

        $variant = $variantSku ? ProductVariant::where('variant_sku', $variantSku)->first() : null;
        $product = Product::where('parent_sku', $parentSku)
            ->with(['attributes', 'activeVariants', 'mainImage'])
            ->firstOrFail();
        $stock = $this->stockFor($product, $variant);

        if (isset($cart[$lineId])) {
            $cart[$lineId]['quantity'] = min($stock, (int) $cart[$lineId]['quantity'] + $quantity);
            $cart[$lineId]['stock'] = $stock;
            if ($note !== null && trim($note) !== '') {
                $cart[$lineId]['note'] = trim($note);
            }
        } else {
            $pricing = $this->priceFor($product, $variant);

            $cart[$lineId] = [
                'line_id' => $lineId,
                'parent_sku' => $parentSku,
                'variant_sku' => $variantSku,
                'name' => $product->name,
                'short_name' => $product->short_name,
                'variation_1_name' => $variant?->variation_1_name,
                'variation_1_option' => $variant?->variation_1_option,
                'variation_2_name' => $variant?->variation_2_name,
                'variation_2_option' => $variant?->variation_2_option,
                'unit_price' => $pricing['unit_price'],
                'compare_price' => $pricing['compare_price'],
                'discount_percent' => $pricing['discount_percent'],
                'flash_sale' => $pricing['flash_sale'],
                'stock' => $stock,
                'quantity' => min($stock, $quantity),
                'note' => $note !== null && trim($note) !== '' ? trim($note) : null,
            ];
        }

        if (($cart[$lineId]['quantity'] ?? 0) < 1) {
            unset($cart[$lineId]);
        }

        $this->session->put(self::SESSION_KEY, $cart);

        return $cart;
    }

    public function update(string $lineId, int $quantity, ?string $note = null): array
    {
        $cart = $this->get();

        if (isset($cart[$lineId])) {
            if ($quantity <= 0) {
                unset($cart[$lineId]);
            } else {
                $product = Product::where('parent_sku', $cart[$lineId]['parent_sku'] ?? '')
                    ->with('activeVariants')
                    ->first();
                $variant = ! empty($cart[$lineId]['variant_sku'])
                    ? ProductVariant::where('variant_sku', $cart[$lineId]['variant_sku'])->first()
                    : null;
                $stock = $product ? $this->stockFor($product, $variant) : max(0, (int) ($cart[$lineId]['stock'] ?? 0));
                $cart[$lineId]['stock'] = $stock;
                $cart[$lineId]['quantity'] = min($stock, $quantity);
                if ($note !== null) {
                    $cart[$lineId]['note'] = trim($note) !== '' ? trim($note) : null;
                }
                if ($cart[$lineId]['quantity'] < 1) {
                    unset($cart[$lineId]);
                }
            }
            $this->session->put(self::SESSION_KEY, $cart);
        }

        return $cart;
    }

    public function remove(string $lineId): array
    {
        $cart = $this->get();
        if (isset($cart[$lineId])) {
            $this->session->put(self::SESSION_KEY . '_undo', $cart[$lineId]);
        }
        unset($cart[$lineId]);
        $this->session->put(self::SESSION_KEY, $cart);

        return $cart;
    }

    public function getLastRemoved(): ?array
    {
        return $this->session->get(self::SESSION_KEY . '_undo');
    }

    public function restoreLastRemoved(): bool
    {
        $item = $this->getLastRemoved();
        if (!$item || empty($item['parent_sku'])) {
            return false;
        }

        $cart = $this->get();
        $lineId = $item['line_id'] ?? ($item['variant_sku'] ?: $item['parent_sku']);
        $cart[$lineId] = $item;
        $this->session->put(self::SESSION_KEY, $cart);
        $this->session->forget(self::SESSION_KEY . '_undo');

        return true;
    }

    public function selectLines(array $lineIds): void
    {
        $cartKeys = array_keys($this->get());
        $selected = array_values(array_intersect($cartKeys, array_values(array_unique(array_map(
            static fn ($lineId): string => (string) $lineId,
            $lineIds,
        )))));

        $this->session->put(self::SESSION_KEY . '_selected', $selected);
    }

    public function getSelectedLines(): array
    {
        $selected = $this->session->get(self::SESSION_KEY . '_selected', []);

        if (! is_array($selected)) {
            return [];
        }

        return array_values(array_intersect(array_keys($this->get()), $selected));
    }
    public function clearSelectedLines(): void
    {
        $this->session->forget(self::SESSION_KEY . '_selected');
    }

    public function clear(): void
    {
        $this->session->forget(self::SESSION_KEY);
        $this->clearSelectedLines();
    }

    public function count(): int
    {
        return collect($this->get())->sum('quantity');
    }

    public function subtotal(): float
    {
        return (float) $this->pricedLines()['subtotal'];
    }

    /**
     * Resolve live selling prices + promo discounts for every cart line.
     * Selling price = variant.price (already the promo/flash-sale price).
     * Compare / discount come from PriceService so the cart
     * summary can show potongan explicitly and stay aligned with PDP cards.
     *
     * @return array{
     *     items: list<array<string, mixed>>,
     *     subtotal: float,
     *     compare_subtotal: float,
     *     discount_total: float
     * }
     */
    public function pricedLines(?array $onlyLineIds = null): array
    {
        $raw = collect($this->get())->values();
        if ($onlyLineIds !== null) {
            $ids = array_flip($onlyLineIds);
            $raw = $raw->filter(fn (array $item) => isset($ids[$item['line_id'] ?? '']));
        }
        if ($raw->isEmpty()) {
            return [
                'items' => [],
                'subtotal' => 0.0,
                'compare_subtotal' => 0.0,
                'discount_total' => 0.0,
            ];
        }

        $products = Product::query()
            ->whereIn('parent_sku', $raw->pluck('parent_sku')->unique()->all())
            ->with(['attributes', 'activeVariants', 'mainImage'])
            ->get()
            ->keyBy('parent_sku');

        $variants = ProductVariant::query()
            ->whereIn('variant_sku', $raw->pluck('variant_sku')->filter()->unique()->all())
            ->get()
            ->keyBy('variant_sku');

        $session = $this->get();
        $items = [];
        $subtotal = 0.0;
        $compareSubtotal = 0.0;
        $discountTotal = 0.0;

        foreach ($raw as $item) {
            $product = $products[$item['parent_sku']] ?? null;
            $variant = ! empty($item['variant_sku'])
                ? ($variants[$item['variant_sku']] ?? null)
                : null;

            $qty = max(0, (int) ($item['quantity'] ?? 0));
            $stock = $product ? $this->stockFor($product, $variant) : max(0, (int) ($item['stock'] ?? 0));
            if ($qty > $stock) {
                $qty = $stock;
            }
            $pricing = $product
                ? $this->priceFor($product, $variant)
                : [
                    'unit_price' => (float) ($item['unit_price'] ?? 0),
                    'compare_price' => null,
                    'discount_percent' => null,
                    'flash_sale' => false,
                    'image' => null,
                ];

            $unit = $pricing['unit_price'];
            $compare = $pricing['compare_price'];
            $lineTotal = $unit * $qty;
            $lineCompare = ($compare !== null ? $compare : $unit) * $qty;
            $lineDiscount = max(0, $lineCompare - $lineTotal);

            $subtotal += $lineTotal;
            $compareSubtotal += $lineCompare;
            $discountTotal += $lineDiscount;

            $lineId = $item['line_id'] ?? ($item['variant_sku'] ?? $item['parent_sku']);
            if (isset($session[$lineId])) {
                $session[$lineId]['unit_price'] = $unit;
                $session[$lineId]['compare_price'] = $compare;
                $session[$lineId]['discount_percent'] = $pricing['discount_percent'];
                $session[$lineId]['flash_sale'] = $pricing['flash_sale'];
                $session[$lineId]['stock'] = $stock;
                $session[$lineId]['quantity'] = $qty;
            }

            if ($qty < 1) {
                continue;
            }

            $items[] = [
                ...$item,
                'quantity' => $qty,
                'unit_price' => $unit,
                'compare_price' => $compare,
                'discount_percent' => $pricing['discount_percent'],
                'flash_sale' => $pricing['flash_sale'],
                'stock' => $stock,
                'line_total' => $lineTotal,
                'line_compare_total' => $lineCompare,
                'line_discount' => $lineDiscount,
                'image' => $pricing['image'] ?? ($product?->mainImage?->urlFor('card') ?? $product?->mainImage?->urlFor('thumb')),
            ];
        }

        $this->session->put(self::SESSION_KEY, $session);

        return [
            'items' => $items,
            'subtotal' => round($subtotal, 2),
            'compare_subtotal' => round($compareSubtotal, 2),
            'discount_total' => round($discountTotal, 2),
        ];
    }

    /**
     * @return array{
     *     unit_price: float,
     *     compare_price: float|null,
     *     discount_percent: int|null,
     *     flash_sale: bool,
     *     image: string|null
     * }
     */
    public function priceFor(Product $product, ?ProductVariant $variant = null): array
    {
        if (! $product->relationLoaded('attributes')) {
            $product->load('attributes');
        }
        if (! $product->relationLoaded('activeVariants')) {
            $product->load('activeVariants');
        }
        if (! $product->relationLoaded('mainImage')) {
            $product->load('mainImage');
        }

        $priceService = app(\App\Services\PriceService::class);

        if ($variant) {
            $priced = $priceService->forVariant($variant, $product);
        } else {
            $card = $priceService->productCard($product);
            $priced = [
                'sale' => $card['min_sale'],
                'compare' => $card['compare'],
                'discount_percent' => $card['discount_percent'],
                'flash_sale' => $card['flash_sale'],
            ];
        }

        return [
            'unit_price' => (float) $priced['sale'],
            'compare_price' => $priced['compare'],
            'discount_percent' => $priced['discount_percent'] > 0 ? $priced['discount_percent'] : null,
            'flash_sale' => (bool) $priced['flash_sale'],
            'image' => $product->mainImage?->urlFor('card') ?? $product->mainImage?->urlFor('thumb'),
        ];
    }

    protected function stockFor(Product $product, ?ProductVariant $variant = null): int
    {
        if ($variant) {
            return max(0, (int) $variant->stock);
        }

        if (! $product->relationLoaded('activeVariants')) {
            $product->load('activeVariants');
        }

        return max(0, (int) $product->activeVariants->sum('stock'));
    }
}
