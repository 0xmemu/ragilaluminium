<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Jejak audit koreksi kasus retur (instruksi owner 2026-09-28).
 *
 * Satu baris per field yang berubah setiap aksi koreksi atau penutupan
 * (void): nilai lama, nilai baru, alasan, dan pelaku. Kasus retur selesai
 * tidak pernah dihapus fisik, jadi tabel inilah riwayat kenapa angka di
 * laporan berubah dari waktu ke waktu.
 */
class ReturnCaseAdjustment extends Model
{
    protected $fillable = [
        'return_case_id',
        'field',
        'old_value',
        'new_value',
        'reason',
        'changed_by_user_id',
    ];

    public function case(): BelongsTo
    {
        return $this->belongsTo(OrderReturnCase::class, 'return_case_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_user_id');
    }
}
