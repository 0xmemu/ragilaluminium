<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Toolbar halaman Paling Banyak Dipesan (owner 2026-10-08: toolbar hanya berisi
 * kotak cari dan penghitung, dianalisa ulang kebutuhannya).
 *
 * Kontrak ini hidup di TSX dan tidak terlihat dari respons Inertia, jadi
 * diperiksa dengan membaca sumbernya, sama seperti test kontrak lain.
 *
 * Tiga hal yang mudah rusak tanpa suara:
 * 1. Kotak cari WAJIB tetap membawa data-reorder-allow. Mode Urutkan mengunci
 *    seluruh kontrol lewat CSS .admin-reorder-lock, dan hanya elemen bertanda
 *    itu yang tetap hidup. Kalau kotak cari pindah ke ListToolbar tanpa
 *    atribut itu, mencari di tengah mode urut menjadi mustahil.
 * 2. Geser wajib mati saat daftar tersaring, apa pun saringannya (pencarian
 *    ATAU filter status), karena posisi target di daftar tersaring tidak
 *    mewakili urutan global.
 * 3. Garis "Batas carousel" hanya boleh tampil pada daftar yang tidak
 *    tersaring: di dalam subset, posisi batasnya tidak berlaku.
 */
class BerandaPopularToolbarTest extends TestCase
{
    public function test_listtoolbar_bisa_meneruskan_atribut_ke_kotak_cari(): void
    {
        $isi = file_get_contents(base_path('resources/js/components/admin/ui/list-toolbar.tsx'));
        $this->assertNotFalse($isi, 'komponen ListToolbar harus terbaca');
        $isi = (string) $isi;

        $this->assertStringContainsString('inputProps', $isi, 'ListToolbar harus mendukung atribut tambahan pada kotak cari.');
        $this->assertStringContainsString('{...(search.inputProps ?? {})}', $isi, 'Atribut tambahan harus benar-benar diteruskan ke Input.');
    }

    public function test_toolbar_paling_banyak_dipesan_membawa_filter_dan_kotak_cari_terkunci_dengan_benar(): void
    {
        $isi = file_get_contents(base_path('resources/js/pages/Admin/Beranda/Popular.tsx'));
        $this->assertNotFalse($isi, 'halaman Paling Banyak Dipesan harus terbaca');
        $isi = (string) $isi;

        $this->assertStringContainsString('"data-reorder-allow"', $isi, 'Kotak cari harus tetap membawa data-reorder-allow lewat ListToolbar.');
        $this->assertStringContainsString('statusOf', $isi, 'Status tiap baris harus berasal dari satu fungsi yang sama dengan badge.');
        $this->assertMatchesRegularExpression(
            '~const canReorder = reorderMode && needle === "" && statusFilter === ""~',
            $isi,
            'Geser harus mati saat daftar tersaring, apa pun saringannya.'
        );
        $this->assertMatchesRegularExpression(
            '~needle === "" && statusFilter === "" && windowCount > 0~',
            $isi,
            'Pembatas carousel hanya pada daftar tak tersaring.'
        );
    }
}
