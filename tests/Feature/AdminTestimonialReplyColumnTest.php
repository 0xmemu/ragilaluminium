<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Kolom Balasan di daftar ulasan admin hanya boleh tampil di tab Ulasan Website.
 *
 * Halaman /admin/testimonials memakai SATU berkas untuk dua tab. Tab Apa Kata
 * Pelanggan berisi galeri screenshot, dan balasan memang tidak berlaku untuk
 * sumber marketplace: `can_reply` mengecualikan Shopee dan WhatsApp. Kalau
 * kolomnya dirender di tab itu, selnya hanya akan berisi tanda hubung begitu ada
 * ulasan marketplace sungguhan, dan tombol Balas di sana terbaca sebagai aksi
 * yang tidak pada tempatnya.
 *
 * Kontrak ini hidup di berkas TSX dan tidak bisa dilihat dari respons Inertia,
 * jadi diperiksa dengan membaca sumbernya, sama seperti test kontrak istilah.
 */
class AdminTestimonialReplyColumnTest extends TestCase
{
    private function halaman(): string
    {
        $isi = file_get_contents(base_path('resources/js/pages/Admin/Testimonials/Index.tsx'));
        $this->assertNotFalse($isi, 'halaman daftar ulasan harus terbaca');

        return (string) $isi;
    }

    public function test_header_kolom_balasan_hanya_dirender_di_tab_ulasan_website(): void
    {
        $isi = $this->halaman();

        $this->assertMatchesRegularExpression(
            '~\{!isApaKata \?\s*<th[^>]*>Balasan</th>\s*:\s*null\}~',
            $isi,
            'Header Balasan harus dijaga !isApaKata supaya tidak tampil di tab Apa Kata Pelanggan.'
        );

        $this->assertSame(
            1,
            substr_count($isi, '>Balasan</th>'),
            'Hanya boleh ada satu header Balasan di halaman ini.'
        );
    }

    public function test_sel_balasan_hanya_dirender_di_tab_ulasan_website(): void
    {
        $isi = $this->halaman();

        $this->assertMatchesRegularExpression(
            '~\{!isApaKata \?\s*\(\s*<td[^>]*align-top">~',
            $isi,
            'Sel Balasan harus dibuka dengan penjaga !isApaKata.'
        );

        $this->assertMatchesRegularExpression(
            '~\)\s*:\s*null\}\s*<td[^>]*>\s*<StatusBadge~',
            $isi,
            'Sel Balasan harus ditutup penjaga sebelum kolom Status, supaya tidak ada kolom kosong menganga di tab Apa Kata Pelanggan.'
        );
    }

    /**
     * Jalan masuk balas lewat menu Lainnya sengaja TIDAK ikut dimatikan.
     * Tanpa itu, tab Apa Kata Pelanggan tidak punya cara membalas sama sekali,
     * padahal isinya sekarang ulasan website yang bisa dibalas.
     */
    public function test_menu_lainnya_tetap_menyediakan_balas_ulasan(): void
    {
        $isi = $this->halaman();

        $this->assertStringContainsString(
            'Balas ulasan',
            $isi,
            'Menu Lainnya harus tetap menyediakan aksi Balas ulasan.'
        );
    }
}
