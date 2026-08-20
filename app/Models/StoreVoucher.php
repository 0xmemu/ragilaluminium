<?php

namespace App\Models;

use App\Support\CatalogLabels;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class StoreVoucher extends Model
{
    public const TARGET_GENERAL = 'general';
    public const TARGET_MODEL = 'model';
    public const TARGET_PRODUCT = 'product';

    public const TARGET_TYPES = [
        self::TARGET_GENERAL,
        self::TARGET_MODEL,
        self::TARGET_PRODUCT,
    ];

    protected $fillable = [
        'name',
        'code',
        'discount_type',
        'discount_value',
        'min_purchase',
        'stackable',
        'target_type',
        'target_model',
        'target_product_id',
        'starts_at',
        'ends_at',
        'published',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
        'min_purchase' => 'decimal:2',
        'stackable' => 'boolean',
        'target_product_id' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'published' => 'boolean',
    ];

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    public function targetProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'target_product_id');
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('published', true);
    }

    public function isGeneral(): bool
    {
        return $this->target_type === self::TARGET_GENERAL || $this->target_type === null;
    }

    public function isWithinSchedule(?Carbon $at = null): bool
    {
        $at ??= now();

        if ($this->starts_at && $at->lt($this->starts_at)) {
            return false;
        }
        if ($this->ends_at && $at->gt($this->ends_at)) {
            return false;
        }

        return true;
    }

    public function isCurrentlyRunnable(?Carbon $at = null): bool
    {
        return $this->published && $this->isWithinSchedule($at);
    }

    /**
     * Label jenis target untuk UI admin, e.g. 'General', 'Model', 'Produk'.
     */
    public function targetKindLabel(): string
    {
        return match ($this->target_type) {
            self::TARGET_MODEL => 'Model',
            self::TARGET_PRODUCT => 'Produk',
            default => 'General',
        };
    }

    /**
     * Label target yang bisa dibaca manusia, e.g. 'Semua produk', 'Model Jungkit',
     * 'Produk Jendela 3 (WIN-100)'. Kosong bila target tidak terdefinisi.
     */
    public function targetLabel(): string
    {
        if ($this->isGeneral()) {
            return 'Semua produk';
        }
        if ($this->target_type === self::TARGET_MODEL) {
            return 'Model '.CatalogLabels::model($this->target_model);
        }
        if ($this->target_type === self::TARGET_PRODUCT) {
            $product = $this->targetProduct;
            if ($product !== null) {
                return 'Produk '.$product->name.($product->parent_sku ? ' ('.$product->parent_sku.')' : '');
            }

            return 'Produk #'.$this->target_product_id;
        }

        return '';
    }

    /**
     * Alasan voucher tidak dapat dipakai sekarang, untuk UI admin (Fase 12).
     * Mengembalikan null bila voucher siap dipakai (published && dalam periode).
     */
    public function unusableReason(?Carbon $at = null): ?string
    {
        $at ??= now();

        if (! $this->published) {
            return 'Voucher tidak aktif (belum dipublikasikan).';
        }
        if ($this->starts_at && $at->lt($this->starts_at)) {
            return 'Periode voucher belum dimulai (mulai '.$this->starts_at->translatedFormat('j M Y, H:i').').';
        }
        if ($this->ends_at && $at->gt($this->ends_at)) {
            return 'Periode voucher sudah berakhir ('.$this->ends_at->translatedFormat('j M Y, H:i').').';
        }

        return null;
    }
}
