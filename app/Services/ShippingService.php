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
        protected ReturnService $returns,
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
     * @return array{gross: float, subsidy: float, net: float, applied: bool, carrier: string, freight: float, insurance: float, insurance_available: bool}
     */
    public function estimateBreakdown(
        float $weightKg,
        string $destinationCity,
        ?string $destinationProvince = null,
        ?string $postalCode = null,
        ?string $destinationArea = null,
        bool $withInsurance = false,
    ): array {
        return $this->quote($weightKg, $destinationCity, $destinationProvince, $postalCode, $destinationArea, $withInsurance);
    }

    /**
     * Customer-facing quote contract shared by checkout and the quote endpoint.
     * Provisional states never pretend to be a final carrier tariff.
     *
     * Asuransi pengiriman (opsional, pilihan pembeli): saat `$withInsurance`,
     * payload menyertakan `offerFee` sehingga J&T menghitung komponen
     * `estimateInsuranceCost`. Ongkir (freight) tetap basis subsidi;
     * asuransi ditambahkan di atas ongkir net: net = freight - subsidi + asuransi.
     *
     * @return array<string, mixed>
     */
    public function quote(
        float $weightKg,
        string $destinationCity,
        ?string $destinationProvince = null,
        ?string $postalCode = null,
        ?string $destinationArea = null,
        bool $withInsurance = false,
    ): array {
        $weightKg = max($weightKg, 1.0);

        // Area (kecamatan) adalah kunci pencocokan master J&T. Bila form
        // belum mengirimnya tetapi postal_code tersedia, resolusi dari
        // dataset postal (level kecamatan) supaya tarif REAL dihitung,
        // bukan jatuh ke estimasi provisional.
        if (($destinationArea === null || trim($destinationArea) === '') && filled($postalCode)) {
            $resolved = DB::table('postal_code_mappings')
                ->where('postal_code', trim((string) $postalCode))
                ->distinct()
                ->orderBy('district_name')
                ->value('district_name');
            if (is_string($resolved) && $resolved !== '') {
                $destinationArea = $resolved;
            }
        }

        if (! $this->jnt->isEnabled()) {
            $freight = $this->localEstimate($weightKg);
            $applied = ShippingSubsidySettings::apply($freight, 'jnt');

            return [
                ...$applied,
                'freight' => $freight,
                'insurance' => 0.0,
                'insurance_available' => false,
                'carrier' => 'jnt',
                'state' => 'fallback',
                'is_final' => false,
                'rough_estimate' => (float) $applied['net'],
                'manual_review' => false,
                'message' => 'Estimasi ongkir sementara berdasarkan rumus lokal.',
            ];
        }

        try {
            $payload = [
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
            ];
            // offerFee (asuransi) HANYA dikirim saat pembeli memilih asuransi.
            $offerFee = config('jnt.defaults.offer_fee');
            if ($withInsurance && filled($offerFee)) {
                $payload['offerFee'] = (string) $offerFee;
            }

            $resp = $this->jnt->tariff($payload);

            if ($resp->ok) {
                // Basis tarif = estimateCustomerCost (yang dibayar pelanggan);
                // estimateSumFreight = freight + asuransi saat offerFee dikirim.
                $freight = $resp->get('estimateCustomerCost')
                    ?? $resp->get('estimateSumFreight')
                    ?? $resp->get('totalFreight');
                // Guard: freight 0 dianggap tarif tidak valid (J&T dapat
                // mengembalikan 0 untuk kombinasi produk/area yang tidak
                // tersedia) -> jatuh ke estimasi provisional + manual review,
                // ongkir Rp 0 tidak pernah tampil ke pembeli.
                if (is_numeric($freight) && (float) $freight > 0) {
                    $freight = round((float) $freight, 2);
                    $insurance = max(0, round((float) ($resp->get('estimateInsuranceCost') ?? 0), 2));
                    $gross = round($freight + $insurance, 2);
                    $applied = ShippingSubsidySettings::apply($freight, 'jnt');
                    $net = round(max(0, (float) $applied['net']) + $insurance, 2);

                    return [
                        ...$applied,
                        'gross' => $gross,
                        'net' => $net,
                        'freight' => $freight,
                        'insurance' => $insurance,
                        'insurance_available' => $insurance > 0,
                        'carrier' => 'jnt',
                        'state' => 'ready',
                        'is_final' => true,
                        'rough_estimate' => $net,
                        'manual_review' => false,
                        'message' => 'Tarif ongkir J&T berhasil dihitung.',
                    ];
                }
            }
        } catch (Throwable $e) {
            // Gunakan debug agar tidak spam log saat J&T belum siap atau down.
            // Warning hanya dicatat saat integration benar-benar aktif.
            Log::channel('jnt')->debug('JNT tariff unavailable; using provisional local estimate', [
                'exception_class' => $e::class,
                'exception_message' => $e->getMessage(),
                'jnt_enabled' => config('jnt.enabled'),
            ]);
        }

        $provisional = ShippingSubsidySettings::apply($this->localEstimate($weightKg), 'jnt');

        return [
            ...$provisional,
            'freight' => (float) $this->localEstimate($weightKg),
            'insurance' => 0.0,
            'insurance_available' => false,
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
                Log::channel('jnt')->debug('JNT tariff failed, fallback to local estimate', ['error' => $e->getMessage()]);
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
            throw new \RuntimeException('Integrasi J&T belum aktif. Lengkapi kredensial di .env (JNT_ENABLED, JNT_API_ACCOUNT, JNT_PRIVATE_KEY, JNT_CUSTOMER_CODE, JNT_CUSTOMER_PASSWORD).');
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
            // Ganti nomor resi = baseline polling lama tidak berlaku lagi
            // (milik resi sebelumnya); null agar event J&T resi baru tidak
            // dianggap stale oleh guard di applyCarrierUpdate.
            $waybillChanged = $existing->waybill_number !== $waybillNumber;
            $existing->update([
                'waybill_number' => $waybillNumber,
                'carrier_name' => $carrierName,
                'last_status_at' => $waybillChanged ? null : $existing->last_status_at,
            ]);

            $record = $existing->fresh();
        } else {
            $record = DB::transaction(function () use ($order, $waybillNumber, $carrierName) {
                $record = ShippingRecord::create([
                    'order_id' => $order->id,
                    'carrier_name' => $carrierName,
                    'service_name' => config('jnt.defaults.express_type'),
                    'waybill_number' => $waybillNumber,
                    'shipping_cost' => $order->shipping_amount,
                    'status' => 'pending_pickup',
                    'status_raw' => 'manual',
                ]);

                $order->update(['shipping_status' => 'pending_pickup']);

                $this->logEvent('shipping.created', $order, [
                    'waybill' => $record->waybill_number,
                    'source' => 'manual',
                ]);

                return $record;
            });
        }

        // Tarik status terkini dari J&T segera (best-effort) agar timeline
        // tracking langsung terisi; kegagalan tidak menggagalkan penyimpanan.
        try {
            $this->refreshStatus($record);
            $record->refresh();
        } catch (\Throwable $exception) {
            Log::channel('jnt')->warning('manual waybill initial refresh failed', [
                'waybill' => $record->waybill_number,
                'message' => $exception->getMessage(),
            ]);
        }

        return $record;
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

        $details = $this->extractTraceDetails($resp);

        // Simpan SELURUH riwayat scan (dedup idempoten per event_hash) agar
        // timeline tracking langsung lengkap, bukan hanya scan terakhir.
        if (! empty($details)) {
            $this->persistTraceEvents($record, $details, 'poll');
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
        $eventHash = $this->traceEventHash(
            $record->waybill_number,
            $rawStatus,
            $scanTypeCode,
            $statusRaw,
            $occurredAt,
        );

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
                        'provider_status' => (string) ($rawStatus ?? ''), // label pendek, varchar(80)
                        'normalized_status' => $mapped,
                        'source' => in_array($source, ['webhook', 'poll', 'manual'], true) ? $source : 'manual',
                        'description' => $statusRaw ?? $rawStatus,
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
                $transitioned = $this->states->transition(
                    $order,
                    $target,
                    null,
                    'carrier',
                    ['shipping_status' => $shippingStatus],
                );

                // Kontrak (revisi 2026-08-25): COD lunas saat shipping
                // DELIVERED via ReturnService::markDeliveredAndSettleCod
                // (primary; idempotent; menulis payments record).
                if ($transitioned && $target === 'delivered') {
                    $this->returns->markDeliveredAndSettleCod($order->fresh());
                }

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
     * Ambil daftar scan dari respons trace J&T.
     * data.details[] : { scanType, scanCode, scanTypeCode, desc, scanTime }.
     */
    protected function extractTraceDetails(JntResponse $resp): array
    {
        $details = $resp->get('details')
            ?? data_get($resp->data, 'data.0.details')
            ?? data_get($resp->data, 'data.details')
            ?? [];

        return is_array($details) ? $details : [];
    }

    /**
     * Ambil trace terbaru dari respons trace J&T (untuk memajukan status).
     */
    protected function extractLatestTrace(JntResponse $resp): array
    {
        $details = $this->extractTraceDetails($resp);

        if (empty($details)) {
            // Kunci mapping = scanCode numerik (status_map), fallback teks scanType.
            $status = $resp->get('scanCode') ?? $resp->get('scanType');

            return [$status !== null ? (string) $status : null, $resp->get('scanTypeCode'), $resp->get('desc'), $resp->get('scanTime')];
        }

        // J&T mengembalikan details urut TERBARU dahulu; jangan andalkan
        // urutan — pilih scan dengan scanTime paling akhir.
        usort($details, fn ($a, $b) => strcmp(
            (string) ($a['scanTime'] ?? $a['time'] ?? ''),
            (string) ($b['scanTime'] ?? $b['time'] ?? ''),
        ));
        $latest = end($details);

        return [
            // scanCode numerik = kunci status_map (1/3/4/5/10...); scanType teks
            // sebagai fallback untuk payload yang tidak membawa scanCode.
            (string) (data_get($latest, 'scanCode') ?? data_get($latest, 'scanType') ?? ''),
            data_get($latest, 'scanTypeCode'),
            data_get($latest, 'desc'),
            data_get($latest, 'scanTime') ?? data_get($latest, 'time'),
        ];
    }

    /**
     * Simpan seluruh riwayat scan sebagai tracking events (idempoten via
     * event_hash — hash sama dengan applyCarrierUpdate, jadi tidak duplikat).
     * Urutan lama -> baru agar timeline konsisten.
     */
    public function persistTraceEvents(ShippingRecord $record, array $details, string $source = 'poll'): void
    {
        if (empty($details)) {
            return;
        }

        $details = array_values($details);
        usort($details, fn ($a, $b) => strcmp(
            (string) ($a['scanTime'] ?? $a['time'] ?? ''),
            (string) ($b['scanTime'] ?? $b['time'] ?? ''),
        ));

        foreach ($details as $detail) {
            $raw = (string) ($detail['scanCode'] ?? $detail['scanType'] ?? '');
            if ($raw === '') {
                continue;
            }
            $code = isset($detail['scanTypeCode']) ? (string) $detail['scanTypeCode'] : null;
            $desc = $detail['desc'] ?? null;
            $at = $detail['scanTime'] ?? $detail['time'] ?? null;

            ShippingTrackingEvent::firstOrCreate(
                [
                    'shipping_record_id' => $record->id,
                    'event_hash' => $this->traceEventHash($record->waybill_number, $raw, $code, $desc, $at),
                ],
                [
                    'order_id' => $record->order_id,
                    'provider' => 'jnt',
                    'waybill_number' => $record->waybill_number,
                    'provider_status' => $raw, // label pendek (scanCode/scanType)
                    'normalized_status' => $this->mapCarrierStatus($raw, $code),
                    'source' => in_array($source, ['webhook', 'poll', 'manual'], true) ? $source : 'manual',
                    'description' => $desc,
                    'occurred_at' => $this->carrierEventTime($at),
                ],
            );
        }
    }

    /**
     * Hash identitas event (dipakai applyCarrierUpdate & persistTraceEvents).
     */
    protected function traceEventHash(
        string $waybill,
        ?string $rawStatus,
        ?string $scanTypeCode,
        ?string $statusRaw,
        ?string $occurredAt,
    ): string {
        return hash('sha256', implode('|', [
            $waybill,
            (string) ($rawStatus ?? ''),
            (string) ($scanTypeCode ?? ''),
            (string) ($statusRaw ?? ''),
            (string) ($occurredAt ?? ''),
        ]));
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
