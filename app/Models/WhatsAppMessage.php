<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppMessage extends Model
{
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
