<?php

namespace App\Observers;

use App\Services\AdminDataVersion;

/**
 * Menandai bahwa data yang tampil di panel admin berubah, sehingga panel tahu
 * kapan perlu memuat ulang dirinya.
 *
 * Dipasang terpusat lewat AppServiceProvider untuk model yang tampil di panel
 * (lihat daftar di sana). Model sengaja tidak diubah satu per satu supaya
 * daftarnya satu tempat dan mudah ditinjau.
 *
 * Panggilan bump() sangat murah (satu INCR Redis) dan tidak pernah melempar,
 * jadi aman dipasang pada model yang sering disimpan.
 */
class AdminDataVersionObserver
{
    public function __construct(private readonly AdminDataVersion $version)
    {
    }

    public function saved(): void
    {
        $this->version->bump();
    }

    public function deleted(): void
    {
        $this->version->bump();
    }
}
