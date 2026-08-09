<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'order_number',
        'checkout_idempotency_key',
        'customer_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'shipping_address_line1',
        'shipping_address_line2',
        'shipping_city',
        'shipping_province',
        'shipping_district',
        'shipping_village',
        'shipping_postal_code',
        'shipping_country',
        'order_status',
        'payment_status',
        'shipping_status',
        'subtotal_amount',
        'shipping_amount',
        'shipping_subsidy_amount',
        'discount_amount',
        'voucher_code',
        'voucher_discount_amount',
        'cod_fee_amount',
        'total_amount',
        'payment_method',
        'cod_flag',
        'notes',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'subtotal_amount' => 'decimal:2',
        'shipping_amount' => 'decimal:2',
        'shipping_subsidy_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'voucher_discount_amount' => 'decimal:2',
        'cod_fee_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'cod_flag' => 'boolean',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function shippingRecords(): HasMany
    {
        return $this->hasMany(ShippingRecord::class);
    }

    public function whatsappMessages(): HasMany
    {
        return $this->hasMany(WhatsAppMessage::class);
    }

    public function scopePendingPayment(Builder $query): Builder
    {
        return $query->where('order_status', 'pending_payment');
    }

    public function scopeNeedsAttention(Builder $query): Builder
    {
        return $query->whereIn('order_status', ['issue', 'return_in_process']);
    }
}
