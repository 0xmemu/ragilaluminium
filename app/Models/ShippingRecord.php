<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShippingRecord extends Model
{
    /**
     * Nama kurir J&T Cargo sebagaimana tertulis di kolom carrier_name.
     *
     * Satu-satunya sumber nilai ini. Sebelumnya penulis resi memakai 'J&T
     * Cargo' sementara perintah penarik status menyaring 'JNT', sehingga
     * penyaring itu tidak pernah menemukan resi apa pun dan jaring pengaman
     * webhook tidak pernah bekerja.
     */
    public const CARRIER_JNT = 'J&T Cargo';

    /** Ejaan lama yang masih mungkin ada di data lama. @var list<string> */
    public const CARRIER_JNT_ALIASES = ['JNT'];

    /**
     * Ejaan nama kurir J&T yang sah untuk penyaringan.
     *
     * @return list<string>
     */
    public static function jntCarrierNames(): array
    {
        return array_merge([self::CARRIER_JNT], self::CARRIER_JNT_ALIASES);
    }

    /**
     * Penanda internal yang ditulis sistem ke kolom keterangan kurir
     * (status_raw) saat resi dibatalkan, dibuat, atau ditempel manual.
     *
     * Nilai ini bukan keterangan dari kurir, jadi dilarang ditampilkan di
     * bawah label apa pun yang berbunyi keterangan kurir. Informasi asal-usul
     * resi sudah tercatat di log kejadian pesanan.
     *
     * @var list<string>
     */
    public const INTERNAL_RAW_MARKERS = ['manual', 'created', 'cancelled'];

    /**
     * Keterangan kurir yang layak ditampilkan, atau null bila kolomnya berisi
     * penanda internal sistem. Nilai mentahnya tetap utuh di basis data.
     */
    public function courierNote(): ?string
    {
        $value = trim((string) $this->status_raw);

        if ($value === '' || in_array(mb_strtolower($value), self::INTERNAL_RAW_MARKERS, true)) {
            return null;
        }

        return $value;
    }

    protected $fillable = [
        'order_id',
        'carrier_name',
        'service_name',
        'waybill_number',
        'shipping_cost',
        'shipping_freight',
        'shipping_insured_fee',
        'shipping_chargeable_weight_kg',
        'shipping_cost_synced_at',
        'status',
        'status_raw',
        'last_status_at',
        'last_polled_at',
        'poll_attempts',
        'next_poll_at',
        'last_poll_error',
        'tracking_url',
    ];

    protected $casts = [
        'shipping_cost' => 'decimal:2',
        'shipping_freight' => 'decimal:2',
        'shipping_insured_fee' => 'decimal:2',
        'shipping_chargeable_weight_kg' => 'decimal:2',
        'shipping_cost_synced_at' => 'datetime',
        'last_status_at' => 'datetime',
        'last_polled_at' => 'datetime',
        'next_poll_at' => 'datetime',
        'poll_attempts' => 'integer',
    ];

    /**
     * Rincian tagihan ASLI dari J&T Cargo per pesanan.
     *
     * Sumbernya endpoint pelacakan (logistics/trace), yang mengembalikan
     * totalFreight/freight/insuredFee/weight per nomor resi. Hanya record
     * aktif (bukan cancelled) yang dipakai; record terbaru menang bila ada
     * lebih dari satu. Pesanan yang belum dilaporkan J&T tidak muncul di
     * hasil, dan pemanggil memakai asumsi ongkir checkout untuk pesanan itu.
     *
     * Catatan: total (totalFreight) SUDAH termasuk asuransi, jadi jangan
     * menambahkan asuransi lagi di atasnya.
     *
     * @param  iterable<int|string>  $orderIds
     * @return array<int, array{total: float, freight: float|null, insured: float|null, weight: float|null, synced_at: \Illuminate\Support\Carbon|null}>
     */
    public static function actualCostByOrder(iterable $orderIds): array
    {
        $ids = collect($orderIds)->filter()->unique()->values();

        if ($ids->isEmpty()) {
            return [];
        }

        return static::query()
            ->whereIn('order_id', $ids)
            ->whereNotIn('status', ['cancelled'])
            ->whereNotNull('shipping_cost')
            ->orderBy('id')
            ->get([
                'order_id', 'shipping_cost', 'shipping_freight',
                'shipping_insured_fee', 'shipping_chargeable_weight_kg',
                'shipping_cost_synced_at',
            ])
            ->groupBy('order_id')
            ->map(fn ($rows): array => [
                'total' => (float) $rows->last()->shipping_cost,
                'freight' => $rows->last()->shipping_freight !== null
                    ? (float) $rows->last()->shipping_freight
                    : null,
                'insured' => $rows->last()->shipping_insured_fee !== null
                    ? (float) $rows->last()->shipping_insured_fee
                    : null,
                'weight' => $rows->last()->shipping_chargeable_weight_kg !== null
                    ? (float) $rows->last()->shipping_chargeable_weight_kg
                    : null,
                'synced_at' => $rows->last()->shipping_cost_synced_at,
            ])
            ->all();
    }

    /**
     * Total tagihan J&T per pesanan (kompatibilitas: hanya angkanya).
     *
     * @param  iterable<int|string>  $orderIds
     * @return array<int, float>
     */
    public static function actualOngkirByOrder(iterable $orderIds): array
    {
        return array_map(
            fn (array $row): float => $row['total'],
            static::actualCostByOrder($orderIds)
        );
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
    public function trackingEvents(): HasMany
    {
        return $this->hasMany(ShippingTrackingEvent::class);
    }
}
