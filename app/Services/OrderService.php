<?php

namespace App\Services;

use App\Events\OrderCreated;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\CodSettings;
use App\Support\PhoneNumber;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderService
{
    public function __construct(
        protected CartService $cart,
        protected VoucherService $vouchers,
        protected CustomerService $customers,
    ) {
    }

    /**
     * Buat order dari isi cart dengan revalidasi harga & stok TERHADAP DATABASE
     * (harga di session tidak dipercaya). Stok dikunci & dikurangi dalam
     * transaksi untuk mencegah race/oversell. FK product_id dijamin valid.
     *
     * @param  array{code?: string, discount?: float}|null  $voucher
     */
    public function createFromCart(
        array $customer,
        array $shipping,
        string $paymentMethod,
        ?float $shippingCost = 0,
        ?array $voucher = null,
        float $shippingSubsidy = 0,
    ): Order {
        $items = $this->cart->get();

        if (empty($items)) {
            throw new \DomainException('Keranjang kosong, tidak dapat membuat pesanan.');
        }

        $shippingCost = (float) ($shippingCost ?? 0);
        $shippingSubsidy = max(0, (float) $shippingSubsidy);

        return $this->createWithRetryOnDuplicateNumber(function (string $orderNumber) use ($customer, $shipping, $paymentMethod, $shippingCost, $items, $voucher, $shippingSubsidy) {
            return DB::transaction(function () use ($orderNumber, $customer, $shipping, $paymentMethod, $shippingCost, $items, $voucher, $shippingSubsidy) {
                $subtotal = 0.0;
                $discountTotal = 0.0;
                $resolved = [];

                foreach ($items as $item) {
                    $product = Product::where('parent_sku', $item['parent_sku'])
                        ->with(['attributes', 'activeVariants'])
                        ->first();
                    if (! $product || $product->status !== 'active') {
                        throw new \DomainException("Produk {$item['parent_sku']} tidak tersedia.");
                    }

                    $variant = null;
                    if (! empty($item['variant_sku'])) {
                        $variant = ProductVariant::where('variant_sku', $item['variant_sku'])
                            ->where('product_id', $product->id)
                            ->lockForUpdate()
                            ->first();

                        if (! $variant || $variant->status !== 'active') {
                            throw new \DomainException("Varian {$item['variant_sku']} tidak tersedia.");
                        }
                    }

                    $qty = max(1, (int) $item['quantity']);

                    // Harga otoritatif dari DB + metadata promo (bukan session).
                    $pricing = $this->cart->priceFor($product, $variant);
                    $unitPrice = $pricing['unit_price'];

                    if ($unitPrice <= 0) {
                        throw new \DomainException("Harga produk {$product->parent_sku} tidak valid.");
                    }

                    if ($variant) {
                        if ($variant->stock < $qty) {
                            throw new \DomainException("Stok {$variant->variant_sku} tidak cukup (tersisa {$variant->stock}).");
                        }
                        $variant->decrement('stock', $qty);
                    }

                    $lineSubtotal = $unitPrice * $qty;
                    $compareUnit = $pricing['compare_price'];
                    $lineDiscount = $compareUnit !== null && $compareUnit > $unitPrice
                        ? ($compareUnit - $unitPrice) * $qty
                        : 0.0;
                    $subtotal += $lineSubtotal;
                    $discountTotal += $lineDiscount;

                    $resolved[] = compact(
                        'product',
                        'variant',
                        'item',
                        'qty',
                        'unitPrice',
                        'lineSubtotal',
                        'lineDiscount',
                    );
                }

                $voucherCode = null;
                $voucherDiscount = 0.0;
                if (! empty($voucher['code'])) {
                    $applied = $this->vouchers->applyCode((string) $voucher['code'], $subtotal);
                    $voucherCode = $applied['code'];
                    $voucherDiscount = $applied['discount'];
                }

                $subtotalAfterVoucher = max(0, $subtotal - $voucherDiscount);
                $codFee = 0.0;
                if ($paymentMethod === 'cod') {
                    CodSettings::assertAllowedForSubtotal($subtotalAfterVoucher);
                    $codFee = CodSettings::calculateFee($subtotalAfterVoucher);
                }

                $total = max(0, $subtotal + $shippingCost - $voucherDiscount + $codFee);

                $customerRecord = $this->customers->upsertFromCheckout([
                    'name' => $customer['name'],
                    'phone' => $customer['phone'],
                    'email' => $customer['email'] ?? null,
                    'address_line1' => $shipping['address_line1'],
                    'address_line2' => $shipping['address_line2'] ?? null,
                    'city' => $shipping['city'],
                    'province' => $shipping['province'],
                    'postal_code' => $shipping['postal_code'],
                    'country' => $shipping['country'] ?? 'Indonesia',
                ]);

                $order = Order::create([
                    'order_number' => $orderNumber,
                    'customer_id' => $customerRecord->id,
                    'customer_name' => $customer['name'],
                    'customer_phone' => PhoneNumber::normalize($customer['phone']) ?? $customer['phone'],
                    'customer_email' => $customer['email'] ?? null,
                    'shipping_address_line1' => $shipping['address_line1'],
                    'shipping_address_line2' => $shipping['address_line2'] ?? null,
                    'shipping_city' => $shipping['city'],
                    'shipping_province' => $shipping['province'],
                    'shipping_district' => $shipping['district'] ?? null,
                    'shipping_village' => $shipping['village'] ?? null,
                    'shipping_postal_code' => $shipping['postal_code'],
                    'shipping_country' => $shipping['country'] ?? 'Indonesia',
                    'order_status' => 'pending_payment',
                    'payment_status' => 'pending',
                    'shipping_status' => 'pending_pickup',
                    'subtotal_amount' => $subtotal,
                    'shipping_amount' => $shippingCost,
                    'shipping_subsidy_amount' => round($shippingSubsidy, 2),
                    'discount_amount' => round($discountTotal, 2),
                    'voucher_code' => $voucherCode,
                    'voucher_discount_amount' => round($voucherDiscount, 2),
                    'cod_fee_amount' => round($codFee, 2),
                    'total_amount' => $total,
                    'payment_method' => $paymentMethod,
                    'cod_flag' => $paymentMethod === 'cod',
                    'notes' => $customer['notes'] ?? null,
                ]);

                foreach ($resolved as $r) {
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $r['product']->id,
                        'product_variant_id' => $r['variant']?->id,
                        'parent_sku' => $r['product']->parent_sku,
                        'variant_sku' => $r['variant']?->variant_sku,
                        'name' => $r['product']->name,
                        'variation_1_name' => $r['variant']?->variation_1_name,
                        'variation_1_option' => $r['variant']?->variation_1_option,
                        'variation_2_name' => $r['variant']?->variation_2_name,
                        'variation_2_option' => $r['variant']?->variation_2_option,
                        'unit_price' => $r['unitPrice'],
                        'quantity' => $r['qty'],
                        'line_subtotal' => $r['lineSubtotal'],
                        'line_discount' => round($r['lineDiscount'], 2),
                        'line_total' => $r['lineSubtotal'],
                    ]);
                }

                Payment::create([
                    'order_id' => $order->id,
                    'payment_method' => $paymentMethod === 'cod' ? 'cod' : 'transfer',
                    'amount' => $total,
                    'status' => 'pending',
                ]);

                EventLog::create([
                    'event_type' => 'order.created',
                    'entity_type' => 'order',
                    'entity_id' => $order->id,
                    'payload' => [
                        'order_number' => $order->order_number,
                        'total' => $total,
                        'payment_method' => $paymentMethod,
                        'voucher_code' => $voucherCode,
                        'voucher_discount' => $voucherDiscount,
                        'cod_fee' => $codFee,
                        'shipping_subsidy' => $shippingSubsidy,
                    ],
                    'created_at' => now(),
                ]);

                OrderCreated::dispatch($order);

                return $order;
            });
        });
    }

    /** Hitung total berat cart (kg) untuk estimasi/booking ongkir. */
    public function cartWeightKg(): float
    {
        $default = (float) config('shipping.default_item_weight_kg', 1.0);
        $total = 0.0;

        foreach ($this->cart->get() as $item) {
            $variant = ! empty($item['variant_sku'])
                ? ProductVariant::where('variant_sku', $item['variant_sku'])->first()
                : null;
            $weight = $variant && $variant->weight_kg ? (float) $variant->weight_kg : $default;
            $total += $weight * max(1, (int) $item['quantity']);
        }

        return max($total, $default);
    }

    protected function createWithRetryOnDuplicateNumber(callable $callback, int $attempts = 5): Order
    {
        for ($i = 0; $i < $attempts; $i++) {
            try {
                return $callback($this->generateOrderNumber());
            } catch (QueryException $e) {
                // 23000 = integrity constraint violation (nomor order bentrok)
                if (! Str::contains($e->getMessage(), ['order_number', 'UNIQUE', 'Duplicate']) || $i === $attempts - 1) {
                    throw $e;
                }
            }
        }

        throw new \RuntimeException('Gagal membuat nomor order unik.');
    }

    protected function generateOrderNumber(): string
    {
        return 'RA-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
    }
}
