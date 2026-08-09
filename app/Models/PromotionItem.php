<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromotionItem extends Model
{
    public const TARGET_PRODUCT = 'product';
    public const TARGET_SUB_MODEL = 'sub_model';
    public const TARGET_MODEL = 'model';

    public const TARGET_TYPES = [
        self::TARGET_PRODUCT,
        self::TARGET_SUB_MODEL,
        self::TARGET_MODEL,
    ];

    protected $fillable = [
        'promotion_id',
        'target_type',
        'target_id',
        'excluded',
        'override_discount_percent',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'excluded' => 'boolean',
        'override_discount_percent' => 'integer',
    ];

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }
}
