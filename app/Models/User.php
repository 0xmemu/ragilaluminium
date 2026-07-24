<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isAdmin(): bool
    {
        // Stage 2 equal-admin: semua akun dashboard memakai role kanonik `admin`
        // (lihat migration 2026_07_22_000001_normalize_users_to_equal_admin_role).
        // Role tetap dievaluasi agar penambahan role lain di masa depan
        // tidak otomatis mendapatkan akses admin.
        return $this->role === 'admin';
    }

    public function createdProducts(): HasMany
    {
        return $this->hasMany(Product::class, 'created_by_user_id');
    }

    public function triggeredImportJobs(): HasMany
    {
        return $this->hasMany(ImportJob::class, 'triggered_by_user_id');
    }

    public function updatedOrders(): HasMany
    {
        return $this->hasMany(Order::class, 'updated_by_user_id');
    }
}
