<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderReturnCase extends Model
{
    protected $fillable = [
        'order_id',
        'status',
        'reason',
        'reason_detail',
        'fault_party',
        'shipping_cost_borne_by_store',
        'resolution_type',
        'customer_notes',
        'admin_notes',
        'refund_amount',
        'replacement_amount',
        'return_shipping_cost',
        'completed_at',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'refund_amount' => 'decimal:2',
        'replacement_amount' => 'decimal:2',
        'return_shipping_cost' => 'decimal:2',
        'completed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        // Setiap jalur tulis wajib meninggalkan completed_at saat kasus
        // dinyatakan selesai. Seluruh angka refund dan ongkir retur di laporan
        // disaring dari kolom ini, jadi kasus selesai tanpa tanggal akan hilang
        // diam-diam dari Refund Diberikan, Ongkir Retur, dan Penjualan Bersih.
        static::saving(function (self $case): void {
            if ($case->status === 'completed' && $case->completed_at === null) {
                $case->completed_at = now();
            }
        });
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderReturnItem::class, 'return_case_id');
    }
}
