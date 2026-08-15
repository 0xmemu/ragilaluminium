<?php

namespace App\Services;

use App\Domain\Orders\OrderStateMachine;
use App\Events\ShippingStatusUpdated;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\ShippingTrackingEvent;
use App\Services\Shipping\JntCargoClient;
use App\Services\Shipping\JntResponse;
use App\Support\ShippingSubsidySettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class ShippingService
{
    public function __construct(
        protected JntCargoClient $jnt,
        protected OrderStateMachine $states,
    ) {}

    /**
     * Estimasi ongkir. Jika J&T aktif & tarif dikonfigurasi, pakai API tarif;
     * jika tidak, jatuh ke rumus lokal (berat) sebagai fallback dev/test.
     * Nilai yang dikembalikan = ongkir bersih setelah subsidi (jika aktif).
     */
    public function estimateCost(float $weightKg, string $destinationCity, ?string $destinationProvince = null, ?string $postalCode = null, ?string $destinationArea = null): float
    {
        return $this->estimateBreakdown($weightKg, $destinationCity, $destinationProvince, $postalCode, $destinationArea)['net'];
    }

    /**
     * @return array{gross: float, subsidy: float, net: float, applied: bool, carrier: string}
     */
    public function estimateBreakdown(
        float $weightKg,
        string $destinationCity,
        ?string $destinationProvince = null,
        ?string $postalCode = null,
        ?string $destinationArea = null,
    ): array {
        return $this->quote($weightKg, $destinationCity, $destinationProvince, $postalCode, $destinationArea);
    }

    /**
     * Customer-facing quote contract shared by checkout and the quote endpoint.
     * Provisional states never pretend to be a final carrier tariff.
     *
     * @return array<string, mixed>
     */
    public function quote(
        float $weightKg,
        string $destinationCity,
        ?string $destinationProvince = null,
        ?string $postalCode = null,
        ?string $destinationArea = null,
    ): array {
        $weightKg = max($weightKg, 1.0);

        if (! $this->jnt->isEnabled()) {
            $applied = ShippingSubsidySettings::apply($this->localEstimate($weightKg), 'jnt');

            return [
                ...$applied,
                'carrier' => 'jnt',
                'state' => 'fallback',
                'is_final' => false,
                'rough_estimate' => (float) $applied['net'],
                'manual_review' => false,
                'message' => 'Estimasi ongkir sementara berdasarkan rumus lokal.',
            ];
        }

        try {
            $resp = $this->jnt->tariff([
                'paymentType' => config('jnt.defaults.payment_type'),
                'expressType' => config('jnt.defaults.express_type'),
                'deliveryType' => config('jnt.defaults.delivery_type'),
                'goodsType' => config('jnt.defaults.goods_type'),
                'weight' => (string) $weightKg,
                'totalQuantity' => 1,
                'sendProv' => config('jnt.sender.prov'),
                'sendCity' => config('jnt.sender.city'),
                'sendArea' => config('jnt.sender.area'),
                'receiveProv' => $destinationProvince,
                'receiveCity' => $destinationCity,
                'receiveArea' => $destinationArea ?? $destinationCity,
            ]);

            if ($resp->ok) {
                $cost = $resp->get('estimateSumFreight')
                    ?? $resp->get('estimateCustomerCost')
                    ?? $resp->get('totalFreight');
                if (is_numeric($cost)) {
                    $applied = ShippingSubsidySettings::apply(round((float) $cost, 2), 'jnt');

                    return [
                        ...$applied,
                        'carrier' => 'jnt',
                        'state' => 'ready',
                        'is_final' => true,
                        'rough_estimate' => (float) $applied['net'],
                        'manual_review' => false,
                        'message' => 'Tarif ongkir J&T berhasil dihitung.',
                    ];
                }
            }
        } catch (Throwable $e) {
            Log::channel('jnt')->warning('JNT tariff unavailable; using provisional local estimate', [
                'exception_class' => $e::class,
            ]);
        }

        $provisional = ShippingSubsidySettings::apply($this->localEstimate($weightKg), 'jnt');

        return [
            ...$provisional,
            'carrier' => 'jnt',
            'state' => 'manual_review',
            'is_final' => false,
            'rough_estimate' => (float) $provisional['net'],
            'manual_review' => true,
            'message' => 'Estimasi sementara berdasarkan area akan dikonfirmasi admin.',
        ];
    }

    protected function estimateGrossCost(
        float $weightKg,
        string $destinationCity,
        ?string $destinationProvince = null,
        ?string $postalCode = null,
        ?string $destinationArea = null,
    ): float {
        $weightKg = max($weightKg, 1.0);

        if ($this->jnt->isEnabled()) {
            try {
                // agingCost/get — cek tarif & estimasi waktu.
                $resp = $this->jnt->tariff([
                    'paymentType' => config('jnt.defaults.payment_type'),
                    'expressType' => config('jnt.defaults.express_type'),
                    'deliveryType' => config('jnt.defaults.delivery_type'),
                    'goodsType' => config('jnt.defaults.goods_type'),
                    'weight' => (string) $weightKg,
                    'totalQuantity' => 1,
                    'sendProv' => config('jnt.sender.prov'),
                    'sendCity' => config('jnt.sender.city'),
                    'sendArea' => config('jnt.sender.area'),
                    'receiveProv' => $destinationProvince,
                    'receiveCity' => $destinationCity,
                    'receiveArea' => $destinationArea ?? $destinationCity,
                ]);

                if ($resp->ok) {
                    $cost = $resp->get('estimateSumFreight')
                        ?? $resp->get('estimateCustomerCost')
                        ?? $resp->get('totalFreight');
                    if (is_numeric($cost)) {
                        return round((float) $cost, 2);
                    }
                }
            } catch (Throwable $e) {
                Log::channel('jnt')->warning('JNT tariff failed, fallback to local estimate', ['error' => $e->getMessage()]);
            }
        }

        return $this->localEstimate($weightKg);
    }

    protected function localEstimate(float $weightKg): float
    {
        $baseRate = (float) config('shipping.local_base_rate', 15000);
        $perKg = (float) config('shipping.local_per_kg', 2000);

        return round($baseRate + ($weightKg * $perKg), 2);
    }

    /**
     * Buat order pengiriman di J&T untuk sebuah Order dan simpan ShippingRecord.
     * Idempoten: jika sudah ada resi aktif untuk order, kembalikan yang ada.
     */
    public function createShipment(Order $order, float $weightKg = 1.0): ShippingRecord
    {
        $existing = $order->shippingRecords()->whereNotIn('status', ['cancelled'])->first();
        if ($existing) {
            return $existing;
        }

        if (! $this->jnt->isEnabled()) {
            throw new \RuntimeException('Integrasi J&T belum aktif (JNT_ENABLED=false / kredensial kosong).');
        }

        $bizContent = $this->buildCreateOrderPayload($order, $weightKg);
        $resp = $this->jnt->createOrder($bizContent);

        if ($resp->failed() || ! $resp->billCode()) {
            $this->logEvent('shipping.create_failed', $order, [
                'request_id' => $resp->requestId,
                'message' => $resp->message(),
                'http_status' => $resp->httpStatus,
            ]);

            throw new \RuntimeException('Gagal membuat resi J&T: '.($resp->message() ?? 'unknown error'));
        }

        return DB::transaction(function () use ($order, $resp, $weightKg) {
            $record = ShippingRecord::create([
                'order_id' => $order->id,
                'carrier_name' => 'J&T Cargo',
                'service_name' => config('jnt.defaults.express_type'),
                'waybill_number' => $resp->billCode(),
                'shipping_cost' => $order->shipping_amount,
                'status' => 'pending_pickup',
                'status_raw' => 'created',
                'last_status_at' => now(),
                'tracking_url' => $resp->get('trackingUrl'),
            ]);

            $order->update(['shipping_status' => 'pending_pickup']);

            $this->logEvent('shipping.created', $order, [
                'waybill' => $record->waybill_number,
                'request_id' => $resp->requestId,
                'weight_kg' => $weightKg,
            ]);

            return $record;
        });
    }

    /**
     * Simpan resi manual (fallback bila J&T off / resi dari luar sistem).
     * Idempoten terhadap resi aktif yang sama.
     */
    public function attachManualWaybill(
        Order $order,
        string $waybillNumber,
        string $carrierName = 'J&T Cargo',
    ): ShippingRecord {
        $waybillNumber = trim($waybillNumber);
        $existing = $order->shippingRecords()->whereNotIn('status', ['cancelled'])->first();
        if ($existing) {
            $existing->update([
                'waybill_number' => $waybillNumber,
                'carrier_name' => $carrierName,
                'last_status_at' => now(),
            ]);

            return $existing->fresh();
        }

        return DB::transaction(function () use ($order, $waybillNumber, $carrierName) {
            $record = ShippingRecord::create([
                'order_id' => $order->id,
                'carrier_name' => $carrierName,
                'service_name' => config('jnt.defaults.express_type'),
                'waybill_number' => $waybillNumber,
                'shipping_cost' => $order->shipping_amount,
                'status' => 'pending_pickup',
                'status_raw' => 'manual',
                'last_status_at' => now(),
            ]);

            $order->update(['shipping_status' => 'pending_pickup']);

            $this->logEvent('shipping.created', $order, [
                'waybill' => $record->waybill_number,
                'source' => 'manual',
            ]);

            return $record;
        });
    }

    public function refreshStatus(ShippingRecord $record): void
    {
        if (! $this->jnt->isEnabled()) {
            $record->update(['last_status_at' => now()]);

            return;
        }

        // billCodes = string dipisah koma (maks 30 per panggilan).
        $resp = $this->jnt->track(['billCodes' => $record->waybill_number]);

        if ($resp->failed()) {
            Log::channel('jnt')->error('Shipping status refresh failed', [
                'waybill' => $record->waybill_number,
                'request_id' => $resp->requestId,
                'message' => $resp->message(),
            ]);

            return;
        }

        [$scanType, $scanTypeCode, $desc, $occurredAt] = $this->extractLatestTrace($resp);

        if ($scanType !== null) {
            $this->applyCarrierUpdate($record, $scanType, $desc, null, $occurredAt, $scanTypeCode, 'poll');
        }
    }

    /** Batalkan resi di J&T (cancelOrder) dan tandai record. */
    public function cancelShipment(ShippingRecord $record, string $reason = 'dibatalkan'): bool
    {
        if (! $this->jnt->isEnabled()) {
            $record->update(['status' => 'cancelled', 'status_raw' => 'cancelled', 'last_status_at' => now()]);

            return true;
        }

        $resp = $this->jnt->cancelOrder([
            'billCode' => $record->waybill_number,
            'orderType' => config('jnt.defaults.order_type'),
            'txlogisticId' => $record->order?->order_number,
            'reason' => $reason,
        ]);

        if ($resp->ok) {
            $this->applyCarrierUpdate($record, '104', $reason, null, null, null, 'manual');
        }

        return $resp->ok;
    }

    /**
     * Terapkan update dari carrier (webhook atau polling) secara idempoten &
     * transaksional. Hanya mem-forward status yang valid; catat EventLog dan
     * dispatch event saat status benar-benar berubah.
     */
    public function applyCarrierUpdate(
        ShippingRecord $record,
        ?string $rawStatus,
        ?string $statusRaw = null,
        ?string $trackingUrl = null,
        ?string $occurredAt = null,
        ?string $scanTypeCode = null,
        string $source = 'manual',
    ): void {
        $mapped = $this->mapCarrierStatus($rawStatus, $scanTypeCode);
        $providerStatus = $statusRaw ?? $rawStatus;
        $eventTime = $this->carrierEventTime($occurredAt);
        $eventHash = hash('sha256', implode('|', [
            (string) $record->waybill_number,
            (string) ($rawStatus ?? ''),
            (string) ($scanTypeCode ?? ''),
            (string) ($statusRaw ?? ''),
            (string) ($occurredAt ?? ''),
        ]));

        DB::transaction(function () use (
            $record,
            $mapped,
            $providerStatus,
            $rawStatus,
            $trackingUrl,
            $eventTime,
            $eventHash,
            $source,
        ): void {
            $record = ShippingRecord::query()->lockForUpdate()->findOrFail($record->id);

            try {
                ShippingTrackingEvent::firstOrCreate(
                    [
                        'shipping_record_id' => $record->id,
                        'event_hash' => $eventHash,
                    ],
                    [
                        'order_id' => $record->order_id,
                        'provider' => 'jnt',
                        'waybill_number' => $record->waybill_number,
                        'provider_status' => $providerStatus,
                        'normalized_status' => $mapped,
                        'source' => in_array($source, ['webhook', 'poll', 'manual'], true) ? $source : 'manual',
                        'description' => $providerStatus,
                        'occurred_at' => $eventTime,
                    ],
                );
            } catch (\Illuminate\Database\QueryException $exception) {
                if (! str_contains($exception->getMessage(), 'uniq_shipping_tracking_event')) {
                    throw $exception;
                }
            }

            $previous = $record->status;
            if ($record->last_status_at !== null && $eventTime->lt($record->last_status_at)) {
                Log::warning('carrier_update_ignored_stale', [
                    'shipping_record_id' => $record->id,
                    'from' => $previous,
                    'to' => $mapped,
                    'event_time' => $eventTime->toIso8601String(),
                    'last_status_at' => $record->last_status_at->toIso8601String(),
                ]);

                return;
            }

            if ($mapped === null) {
                $record->update([
                    'status_raw' => $providerStatus,
                    'last_status_at' => $eventTime,
                    'tracking_url' => $trackingUrl ?? $record->tracking_url,
                ]);

                return;
            }

            if (! $this->states->canTransitionShipping($previous, $mapped)) {
                $record->update([
                    'status_raw' => $providerStatus,
                    'last_status_at' => $eventTime,
                    'tracking_url' => $trackingUrl ?? $record->tracking_url,
                ]);
                Log::warning('carrier_update_ignored_regression', [
                    'shipping_record_id' => $record->id,
                    'from' => $previous,
                    'to' => $mapped,
                ]);

                return;
            }

            $record->update([
                'status' => $mapped,
                'status_raw' => $providerStatus,
                'last_status_at' => $eventTime,
                'tracking_url' => $trackingUrl ?? $record->tracking_url,
            ]);

            $order = $record->order()->lockForUpdate()->first();
            if ($order) {
                $order->update(['shipping_status' => $mapped]);
                $this->cascadeOrderStatus($order, $mapped);
            }

            if ($previous !== $mapped) {
                $this->logEvent('shipping.status_updated', $order ?? $record, [
                    'waybill' => $record->waybill_number,
                    'from' => $previous,
                    'to' => $mapped,
                    'raw' => $providerStatus,
                ]);

                if ($order) {
                    ShippingStatusUpdated::dispatch($order, $record, $previous, $mapped);
                }
            }
        });
    }

    protected function cascadeOrderStatus(Order $order, string $shippingStatus): void
    {
        $target = match ($shippingStatus) {
            'in_transit' => 'shipped',
            'delivered' => 'delivered',
            'returned' => 'return_in_process',
            default => null,
        };

        if ($target && $order->order_status !== $target) {
            if ($this->states->canTransition($order, $target, 'carrier')) {
                $this->states->transition(
                    $order,
                    $target,
                    null,
                    'carrier',
                    ['shipping_status' => $shippingStatus],
                );

                return;
            }

            Log::warning('carrier_order_transition_rejected', [
                'order_id' => $order->id,
                'from' => $order->order_status,
                'to' => $target,
                'shipping_status' => $shippingStatus,
            ]);
        }
    }

    protected function carrierEventTime(?string $occurredAt): Carbon
    {
        if (blank($occurredAt)) {
            return now();
        }

        try {
            return Carbon::parse($occurredAt);
        } catch (Throwable $exception) {
            Log::warning('carrier_event_time_invalid', [
                'exception_class' => $exception::class,
            ]);

            return now();
        }
    }

    /**
     * Petakan status J&T ke status internal. scanTypeCode (100 delivered /
     * 101 return) memprioritaskan pembedaan tanda tangan pada scanType=10.
     */
    protected function mapCarrierStatus(?string $status, ?string $scanTypeCode = null): ?string
    {
        if ($scanTypeCode !== null && $scanTypeCode !== '') {
            $signMap = config('jnt.sign_type_code_map', []);
            if (isset($signMap[(string) $scanTypeCode])) {
                return $signMap[(string) $scanTypeCode];
            }
        }

        if ($status === null || $status === '') {
            return null;
        }

        $map = config('jnt.status_map', []);

        return $map[(string) $status] ?? $map[strtolower(trim((string) $status))] ?? null;
    }

    /**
     * Ambil trace terbaru dari respons trace J&T.
     * data.details[] : { scanType, scanCode, scanTypeCode, desc, scanTime }.
     */
    protected function extractLatestTrace(JntResponse $resp): array
    {
        $details = $resp->get('details')
            ?? data_get($resp->data, 'data.0.details')
            ?? data_get($resp->data, 'data.details')
            ?? [];

        if (! is_array($details) || empty($details)) {
            $status = $resp->get('scanType') ?? $resp->get('scanCode');

            return [$status !== null ? (string) $status : null, $resp->get('scanTypeCode'), $resp->get('desc'), $resp->get('scanTime')];
        }

        $latest = end($details);

        return [
            (string) (data_get($latest, 'scanType') ?? data_get($latest, 'scanCode') ?? ''),
            data_get($latest, 'scanTypeCode'),
            data_get($latest, 'desc'),
            data_get($latest, 'scanTime') ?? data_get($latest, 'time'),
        ];
    }

    /** bizContent untuk /api/order/addOrder (spesifikasi resmi J&T Cargo). */
    protected function buildCreateOrderPayload(Order $order, float $weightKg): array
    {
        $currency = config('jnt.defaults.price_currency');

        $items = $order->items->map(fn ($i) => [
            'itemName' => $i->name,
            'englishName' => $i->name,
            'number' => (int) $i->quantity,
            'itemValue' => (string) $i->unit_price,
            'priceCurrency' => $currency,
            'desc' => $i->variant_sku,
        ])->all();

        $receiverPhone = $order->customer_phone;
        $receiverAddress = trim($order->shipping_address_line1.' '.($order->shipping_address_line2 ?? ''));

        return [
            'txlogisticId' => $order->order_number,
            'operateType' => 1, // 1=add, 2=modify
            'expressType' => config('jnt.defaults.express_type'),
            'orderType' => config('jnt.defaults.order_type'),
            'serviceType' => config('jnt.defaults.service_type'),
            'deliveryType' => config('jnt.defaults.delivery_type'),
            'payType' => $order->cod_flag
                ? config('jnt.defaults.pay_type_cod')
                : config('jnt.defaults.pay_type'),
            'goodsType' => config('jnt.defaults.goods_type'),
            'weight' => (string) $weightKg,
            'totalQuantity' => max(1, (int) $order->items->sum('quantity')),
            'remark' => $order->notes,
            'sender' => [
                'name' => config('jnt.sender.name'),
                'company' => config('jnt.sender.company'),
                'mobile' => config('jnt.sender.mobile'),
                'phone' => config('jnt.sender.phone') ?: config('jnt.sender.mobile'),
                'countryCode' => config('jnt.sender.country_code'),
                'prov' => config('jnt.sender.prov'),
                'city' => config('jnt.sender.city'),
                'area' => config('jnt.sender.area'),
                'town' => config('jnt.sender.town'),
                'address' => config('jnt.sender.address'),
                'postCode' => config('jnt.sender.postcode'),
            ],
            'receiver' => [
                'name' => $order->customer_name,
                'mobile' => $receiverPhone,
                'phone' => $receiverPhone,
                'countryCode' => 'IDN',
                'prov' => $order->shipping_province,
                'city' => $order->shipping_city,
                'area' => $order->shipping_city,
                'address' => $receiverAddress,
                'postCode' => $order->shipping_postal_code,
            ],
            'items' => $items,
        ];
    }

    protected function logEvent(string $type, $entity, array $payload): void
    {
        EventLog::create([
            'event_type' => $type,
            'entity_type' => $entity instanceof Order ? 'order' : 'shipping_record',
            'entity_id' => $entity->id,
            'payload' => $payload,
            'created_at' => now(),
        ]);
    }
}
