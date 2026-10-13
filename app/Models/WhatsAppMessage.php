<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppMessage extends Model
{
    /**
     * Hanya percakapan nomor pribadi.
     *
     * Grup dan saluran kini ditolak di pintu masuk, tetapi riwayat lama
     * sudah tersimpan memakai nomor pseudo hasil pemotongan JID
     * (mis. 62120363363090730395, 20 digit). Nomor Indonesia yang sah
     * tidak pernah sepanjang itu, jadi batas 15 digit memisahkannya
     * tanpa menyentuh nomor pelanggan asli.
     */
    public function scopePersonalNumbers($query)
    {
        return $query
            ->whereNotNull('phone_number')
            ->where('phone_number', '!=', '-')
            ->whereRaw('LENGTH(phone_number) <= 15');
    }

    protected $table = 'whatsapp_messages';

    protected $fillable = [
        'direction',
        'order_id',
        'phone_number',
        'provider',
        'internal_template_key',
        'provider_message_id',
        'provider_session',
        'content_text',
        'content_payload',
        'status',
        'error_reason',
        'sent_at',
        'received_at',
        'raw_payload',
    ];

    protected $casts = [
        'content_payload' => 'array',
        'raw_payload' => 'array',
        'sent_at' => 'datetime',
        'received_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
