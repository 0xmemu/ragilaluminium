<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Promotion extends Model
{
    public const TYPE_STORE = 'store';
    public const TYPE_FLASH_SALE = 'flash_sale';

    public const STATUS_DRAFT = 'draft';
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_ENDED = 'ended';
    public const STATUS_FINISHED = 'finished';

    public const TYPES = [self::TYPE_STORE, self::TYPE_FLASH_SALE];
    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_SCHEDULED,
        self::STATUS_ACTIVE,
        self::STATUS_ENDED,
        self::STATUS_FINISHED,
    ];

    protected $fillable = [
        'type',
        'name',
        'status',
        'starts_at',
        'ends_at',
        'discount_percent',
        'sync_banner',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'discount_percent' => 'integer',
        'sync_banner' => 'boolean',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(PromotionItem::class);
    }

    public function isFlashSale(): bool
    {
        return $this->type === self::TYPE_FLASH_SALE;
    }
}
