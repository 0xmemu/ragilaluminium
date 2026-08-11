<?php

namespace App\Services;

use App\Domain\Orders\OrderStateMachine;
use App\Events\OrderCancelled;
use App\Events\OrderCreated;
use App\Events\OrderProcessingStarted;
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
        protected OrderStateMachine $states,
        protected ShippingService $shipping,
    ) {}

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
        ?string $idempotencyKey = null,
    ): Order {
        $idempotencyKey = trim((string) $idempotencyKey);
        if ($idempotencyKey === '' || ! Str::isUuid($idempotencyKey)) {
            throw new \DomainException('Token checkout tidak valid. Muat ulang halaman checkout.');
        }

        $existingOrder = Order::where('checkout_idempotency_key', $idempotencyKey)->first();
        if ($existingOrder) {
            return $existingOrder;
        }

        $selected = $this->cart->getSelectedLines();
        $items = $this->cart->get($selected ?: null);

        if (empty($items)) {
            throw new \DomainException('Keranjang kosong, tidak dapat membuat pesanan.');
        }

        $shippingCost = (float) ($shippingCost ?? 0);
        $shippingSubsidy = max(0, (float) $shippingSubsidy);

        try {
            return $this->createWithRetryOnDuplicateNumber(function (string $orderNumber) use ($customer, $shipping, $paymentMethod, $shippingCost, $items, $voucher, $shippingSubsidy, $idempotencyKey) {
                return DB::transaction(function () use ($orderNumber, $customer, $shipping, $paymentMethod, $shippingCost, $items, $voucher, $shippingSubsidy, $idempotencyKey) {
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
                        'checkout_idempotency_key' => $idempotencyKey,
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
                            'note' => $r['item']['note'] ?? null,
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
        } catch (QueryException $e) {
            if ($this->isDuplicateForColumn($e, 'checkout_idempotency_key')) {
                $existingOrder = Order::where('checkout_idempotency_key', $idempotencyKey)->first();
                if ($existingOrder) {
                    return $existingOrder;
                }
            }

            throw $e;
        }
    }

    /**
     * Mulai fulfillment: pending_payment → processing (tanpa menandai lunas).
     * Dipakai COD (admin "Proses" atau konfirmasi tombol WhatsApp pelanggan).
     *
     * @return bool true jika status berubah ke processing
     */
    public function beginProcessing(Order $order, ?int $actorUserId = null, string $source = 'admin'): bool
    {
        $order = $order->fresh() ?? $order;

        if ($order->order_status !== 'pending_payment') {
            return false;
        }

        $isCod = $order->cod_flag || $order->payment_method === 'cod';

        // Konfirmasi pelanggan via WA hanya untuk COD — transfer butuh bukti bayar.
        if ($source === 'whatsapp_customer' && ! $isCod) {
            return false;
        }

        $changed = $this->states->transition(
            $order,
            'processing',
            $actorUserId,
            $source,
            ['flow' => $isCod ? 'cod' : 'transfer'],
        );

        if (! $changed) {
            return false;
        }

        OrderProcessingStarted::dispatch($order->fresh(), $source);

        return true;
    }

    /**
     * Batalkan order dan kembalikan stok varian tepat satu kali.
     *
     * Lock order menjadi guard idempotensi untuk request admin paralel/retry.
     */
    public function cancel(Order $order, ?int $actorUserId = null, ?string $reason = null): bool
    {
        $cancelled = $this->states->transition(
            $order,
            'cancelled',
            $actorUserId,
            'admin_cancel',
            ['reason' => $reason],
            function (Order $lockedOrder): void {
                $variantQuantities = OrderItem::query()
                    ->where('order_id', $lockedOrder->id)
                    ->whereNotNull('product_variant_id')
                    ->selectRaw('product_variant_id, SUM(quantity) as quantity')
                    ->groupBy('product_variant_id')
                    ->orderBy('product_variant_id')
                    ->pluck('quantity', 'product_variant_id');

                foreach ($variantQuantities as $variantId => $quantity) {
                    $variant = ProductVariant::query()
                        ->lockForUpdate()
                        ->find((int) $variantId);

                    if ($variant) {
                        $variant->increment('stock', (int) $quantity);
                    }
                }
            },
        );

        if ($cancelled) {
            OrderCancelled::dispatch($order->fresh(), $reason);
        }

        return $cancelled;
    }

    public function canTransition(Order $order, string $to, string $source = 'admin'): bool
    {
        return $this->states->canTransition($order, $to, $source);
    }

    /**
     * @param  array<string, bool|float|int|string|null>  $context
     */
    public function transition(
        Order $order,
        string $to,
        ?int $actorUserId,
        string $source = 'admin',
        array $context = [],
    ): bool {
        return $this->states->transition($order, $to, $actorUserId, $source, $context);
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
                if (! $this->isDuplicateForColumn($e, 'order_number') || $i === $attempts - 1) {
                    throw $e;
                }
            }
        }

        throw new \RuntimeException('Gagal membuat nomor order unik.');
    }

    protected function isDuplicateForColumn(QueryException $exception, string $column): bool
    {
        $message = Str::lower($exception->getMessage());

        return Str::contains($message, Str::lower($column))
            && Str::contains($message, ['unique', 'duplicate', '23000']);
    }

    protected function generateOrderNumber(): string
    {
        $seq = app(SequenceService::class)->next('order-'.now()->format('Ymd'));

        return 'RA-'.now()->format('ymd').'-'.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Aturan edit pesanan (keputusan #7/#23): MK bebas, Diproses boleh dengan
     * catatan, terkunci setelah resi masuk.
     *
     * @return array{allowed: bool, require_note: bool, reason: string|null}
     */
    public function editPolicy(Order $order): array
    {
        if ($order->order_status === 'cancelled') {
            return ['allowed' => false, 'require_note' => false, 'reason' => 'Pesanan dibatalkan dan tidak dapat diubah.'];
        }

        if ($this->hasWaybill($order)) {
            return ['allowed' => false, 'require_note' => false, 'reason' => 'Pesanan sudah memiliki resi pengiriman dan terkunci.'];
        }

        $requireNote = $order->order_status === 'processing';

        return [
            'allowed' => true,
            'require_note' => $requireNote,
            'reason' => $requireNote
                ? 'Pesanan Diproses: perubahan dicatat di riwayat dan konfirmasi dikirim ulang ke pelanggan.'
                : null,
        ];
    }

    protected function hasWaybill(Order $order): bool
    {
        if (! $order->relationLoaded('shippingRecords')) {
            $order->load('shippingRecords');
        }

        return $order->shippingRecords->contains(
            fn ($record) => filled($record->waybill_number) && $record->status !== 'cancelled'
        );
    }

    /**
     * Ubah isi pesanan + penerima + alamat. Hitung ulang harga, ongkir, total;
     * sesuaikan stok; catat log order.edited. Nomor order tetap.
     *
     * @param  array{
     *     customer_name: string,
     *     customer_phone: string,
     *     customer_email?: string|null,
     *     address_line1: string,
     *     address_line2?: string|null,
     *     village?: string|null,
     *     district?: string|null,
     *     city: string,
     *     province: string,
     *     postal_code: string,
     *     notes?: string|null,
     *     items: list<array{item_id?: int|null, parent_sku?: string, variant_sku?: string|null, qty: int}>
     * }  $data
     */
    public function editOrder(Order $order, array $data, ?int $actorUserId, string $note = ''): Order
    {
        $policy = $this->editPolicy($order);
        if (! $policy['allowed']) {
            throw new \DomainException($policy['reason']);
        }
        if ($policy['require_note'] && trim($note) === '') {
            throw new \DomainException('Pesanan Diproses memerlukan catatan perubahan.');
        }

        return DB::transaction(function () use ($order, $data, $actorUserId, $note) {
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);
            $locked->load(['items.product', 'items.productVariant']);

            $oldItems = $locked->items->keyBy('id');
            $lines = [];
            $subtotal = 0.0;
            $discountTotal = 0.0;

            foreach ($data['items'] as $raw) {
                $qty = max(1, (int) ($raw['qty'] ?? 1));
                $itemId = isset($raw['item_id']) ? (int) $raw['item_id'] : null;
                $oldItem = $itemId !== null ? ($oldItems[$itemId] ?? null) : null;

                if ($oldItem !== null) {
                    $product = $oldItem->product;
                    $variant = $oldItem->productVariant;
                } else {
                    $product = Product::where('parent_sku', trim((string) ($raw['parent_sku'] ?? '')))
                        ->with(['attributes', 'activeVariants'])
                        ->first();
                    if (! $product || $product->status !== 'active') {
                        throw new \DomainException("Produk {$raw['parent_sku']} tidak tersedia.");
                    }

                    $variant = null;
                    if (filled(trim((string) ($raw['variant_sku'] ?? '')))) {
                        $variant = ProductVariant::where('variant_sku', trim((string) $raw['variant_sku']))
                            ->where('product_id', $product->id)
                            ->first();
                        if (! $variant || $variant->status !== 'active') {
                            throw new \DomainException("Varian {$raw['variant_sku']} tidak tersedia.");
                        }
                    }
                }

                $pricing = $this->cart->priceFor($product, $variant);
                $unitPrice = $pricing['unit_price'];
                if ($unitPrice <= 0) {
                    throw new \DomainException("Harga produk {$product->parent_sku} tidak valid.");
                }

                $lineSubtotal = $unitPrice * $qty;
                $compareUnit = $pricing['compare_price'];
                $lineDiscount = $compareUnit !== null && $compareUnit > $unitPrice
                    ? ($compareUnit - $unitPrice) * $qty
                    : 0.0;

                $subtotal += $lineSubtotal;
                $discountTotal += $lineDiscount;

                $lines[] = compact('itemId', 'oldItem', 'product', 'variant', 'qty', 'unitPrice', 'lineSubtotal', 'lineDiscount');
            }

            if (empty($lines)) {
                throw new \DomainException('Pesanan harus memiliki minimal 1 produk.');
            }

            // Stok: selisih qty baris lama, kembalikan stok baris yang dihapus.
            foreach ($lines as $line) {
                $variant = $line['variant'];
                if ($variant === null) {
                    continue;
                }
                $oldQty = $line['oldItem'] !== null ? (int) $line['oldItem']->quantity : 0;
                $delta = $line['qty'] - $oldQty;
                if ($delta > 0 && $variant->stock < $delta) {
                    throw new \DomainException("Stok {$variant->variant_sku} tidak cukup (tersisa {$variant->stock}).");
                }
                if ($delta !== 0) {
                    $variant->increment('stock', -$delta);
                }
            }
            foreach ($oldItems as $oldId => $oldItem) {
                $kept = collect($lines)->contains(fn ($line) => $line['itemId'] === $oldId);
                if ($kept || $oldItem->productVariant === null) {
                    continue;
                }
                $oldItem->productVariant->increment('stock', (int) $oldItem->quantity);
            }

            // Voucher: terapkan ulang bila masih valid pada subtotal baru.
            $voucherCode = null;
            $voucherDiscount = 0.0;
            if (filled($locked->voucher_code)) {
                try {
                    $applied = $this->vouchers->applyCode((string) $locked->voucher_code, $subtotal);
                    $voucherCode = $applied['code'];
                    $voucherDiscount = $applied['discount'];
                } catch (\DomainException $e) {
                    // Voucher tidak lagi berlaku -> dilepas; tercatat di log order.edited.
                }
            }

            $subtotalAfterVoucher = max(0, $subtotal - $voucherDiscount);

            $isCod = (bool) $locked->cod_flag || $locked->payment_method === 'cod';
            $codFee = 0.0;
            if ($isCod) {
                CodSettings::assertAllowedForSubtotal($subtotalAfterVoucher);
                $codFee = CodSettings::calculateFee($subtotalAfterVoucher);
            }

            $breakdown = $this->shipping->estimateBreakdown(
                $this->cartWeightForLines($lines),
                (string) $data['city'],
                $data['province'] ?? null,
                $data['postal_code'] ?? null,
            );
            $shippingCost = $breakdown['net'];
            $shippingSubsidy = $breakdown['subsidy'];
            $total = max(0, $subtotal + $shippingCost - $voucherDiscount + $codFee);

            // Persist baris.
            $changes = [];
            $lineIds = [];
            foreach ($lines as $line) {
                if ($line['oldItem'] !== null) {
                    $oldItem = $line['oldItem'];
                    $changes[] = [
                        'id' => $oldItem->id,
                        'name' => $oldItem->name,
                        'from' => $oldItem->quantity.'x'.$oldItem->unit_price,
                        'to' => $line['qty'].'x'.$line['unitPrice'],
                    ];
                    $oldItem->update([
                        'quantity' => $line['qty'],
                        'unit_price' => $line['unitPrice'],
                        'line_subtotal' => $line['lineSubtotal'],
                        'line_discount' => $line['lineDiscount'],
                        'line_total' => $line['lineSubtotal'],
                    ]);
                    $lineIds[] = $oldItem->id;
                    continue;
                }

                $item = $locked->items()->create([
                    'product_id' => $line['product']->id,
                    'product_variant_id' => $line['variant']?->id,
                    'parent_sku' => $line['product']->parent_sku,
                    'variant_sku' => $line['variant']?->variant_sku,
                    'name' => $line['product']->name,
                    'variation_1_name' => $line['variant']?->variation_1_name,
                    'variation_1_option' => $line['variant']?->variation_1_option,
                    'variation_2_name' => $line['variant']?->variation_2_name,
                    'variation_2_option' => $line['variant']?->variation_2_option,
                    'unit_price' => $line['unitPrice'],
                    'quantity' => $line['qty'],
                    'line_subtotal' => $line['lineSubtotal'],
                    'line_discount' => $line['lineDiscount'],
                    'line_total' => $line['lineSubtotal'],
                ]);
                $changes[] = [
                    'id' => $item->id,
                    'name' => $item->name,
                    'from' => null,
                    'to' => $line['qty'].'x'.$line['unitPrice'],
                ];
                $lineIds[] = $item->id;
            }
            foreach ($oldItems as $oldId => $oldItem) {
                if (in_array($oldId, $lineIds, true)) {
                    continue;
                }
                $changes[] = [
                    'id' => $oldId,
                    'name' => $oldItem->name,
                    'from' => $oldItem->quantity.'x'.$oldItem->unit_price,
                    'to' => null,
                ];
                $oldItem->delete();
            }

            // Persist order.
            $locked->update([
                'customer_name' => trim((string) $data['customer_name']),
                'customer_phone' => PhoneNumber::normalize((string) $data['customer_phone']) ?? (string) $data['customer_phone'],
                'customer_email' => $data['customer_email'] ?? null,
                'shipping_address_line1' => $data['address_line1'],
                'shipping_address_line2' => $data['address_line2'] ?? null,
                'shipping_village' => $data['village'] ?? null,
                'shipping_district' => $data['district'] ?? null,
                'shipping_city' => $data['city'],
                'shipping_province' => $data['province'],
                'shipping_postal_code' => $data['postal_code'],
                'notes' => $data['notes'] ?? null,
                'subtotal_amount' => $subtotal,
                'shipping_amount' => $shippingCost,
                'shipping_subsidy_amount' => $shippingSubsidy,
                'discount_amount' => $discountTotal,
                'voucher_code' => $voucherCode,
                'voucher_discount_amount' => $voucherDiscount,
                'cod_fee_amount' => $codFee,
                'total_amount' => $total,
                'updated_by_user_id' => $actorUserId,
            ]);

            EventLog::create([
                'event_type' => 'order.edited',
                'entity_type' => 'order',
                'entity_id' => $locked->id,
                'created_by_user_id' => $actorUserId,
                'payload' => array_filter([
                    'order_number' => $locked->order_number,
                    'note' => $note !== '' ? $note : null,
                    'changes' => $changes,
                    'subtotal' => $subtotal,
                    'shipping' => $shippingCost,
                    'voucher' => $voucherCode,
                    'voucher_discount' => $voucherDiscount,
                    'cod_fee' => $codFee,
                    'total' => $total,
                    'voucher_dropped' => filled($locked->voucher_code) && $voucherCode === null ? true : null,
                ]),
                'created_at' => now(),
            ]);

            return $locked->fresh();
        });
    }

    /**
     * Berat kiriman pesanan dari baris terpilih (default config per item).
     *
     * @param  list<array{variant: \App\Models\ProductVariant|null, qty: int}>  $lines
     */
    protected function cartWeightForLines(array $lines): float
    {
        $default = (float) config('shipping.default_item_weight_kg', 1.0);
        $total = 0.0;

        foreach ($lines as $line) {
            $weight = $line['variant'] && $line['variant']->weight_kg
                ? (float) $line['variant']->weight_kg
                : $default;
            $total += $weight * max(1, (int) $line['qty']);
        }

        return max($total, $default);
    }
}
