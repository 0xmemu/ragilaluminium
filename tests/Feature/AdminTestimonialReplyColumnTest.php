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

    /**
     * Popup detail ulasan menggantikan halaman detail (owner 2026-10-06:
     * "hapus halaman detail ulasan, gantikan dengan popup saja").
     *
     * Kontrak ini hidup di TSX dan tidak terlihat dari respons Inertia, jadi
     * diperiksa dari sumber. Tiga hal yang mudah rusak tanpa suara:
     * 1. Nama pelanggan di daftar harus MEMBUKA POPUP, bukan menautkan ke
     *    halaman edit; kalau tautannya kembali, halaman detail hidup lagi.
     * 2. Jalan masuk "Edit ulasan" harus tetap ada di menu Lainnya, kalau tidak
     *    admin kehilangan cara mengelola foto ulasan.
     * 3. Popup harus tetap MURNI BACA: tidak boleh ada form atau endpoint tulis
     *    di dalam komponennya, karena menulis balasan hanya lewat satu dialog
     *    bersama (ReviewReplyDialog).
     */
    public function test_daftar_membuka_popup_detail_dan_menyimpan_jalan_edit(): void
    {
        $daftar = $this->halaman();

        $this->assertStringContainsString(
            'onClick={() => setDetailTarget(row)}',
            $daftar,
            'Nama pelanggan harus membuka popup detail, bukan menautkan ke halaman.'
        );
        // Tautan nama pelanggan ke halaman edit tidak boleh kembali. Satu
        // kemunculan pola itu masih SAH: tabel galeri foto hasil pemasangan,
        // yang barisnya memang masih memakai halaman, bukan popup.
        $this->assertSame(
            1,
            substr_count($daftar, '<Link href={row.edit_href} className="font-semibold hover:text-primary hover:underline">'),
            'Hanya tabel galeri foto yang boleh menautkan nama ke halaman; nama pelanggan di tabel ulasan harus membuka popup.'
        );
        $this->assertStringContainsString('Edit ulasan', $daftar, 'Jalan masuk Edit ulasan harus tetap ada di menu baris.');
        $this->assertStringContainsString('<TestimonialDetailDialog', $daftar, 'Daftar harus merender popup detail.');
    }

    public function test_popup_detail_murni_baca_dan_satu_arah_balas(): void
    {
        $popup = file_get_contents(base_path('resources/js/components/admin/testimonial-detail-dialog.tsx'));
        $this->assertNotFalse($popup, 'komponen popup detail ulasan harus terbaca');
        $popup = (string) $popup;

        // Urutan bagian ditetapkan owner: produk, pelanggan, ulasan, media, balasan.
        // Urutan dibaca dari penanda data-bagian, bukan dari teks judul, karena
        // judul bagian juga muncul di kalimat pengantar popup.
        preg_match_all('~bagian="([a-z]+)"~', $popup, $cocok);
        $this->assertSame(
            ['produk', 'pelanggan', 'ulasan', 'media', 'balasan'],
            $cocok[1],
            'Urutan bagian popup harus produk, pelanggan, ulasan, media, balasan.'
        );

        $this->assertStringNotContainsString('<form', $popup, 'Popup detail harus murni baca, tidak memuat form.');
        $this->assertStringNotContainsString('useForm', $popup, 'Popup detail tidak boleh mengirim data.');
        $this->assertStringNotContainsString('router.post', $popup, 'Popup detail tidak boleh memanggil endpoint tulis.');
        $this->assertStringContainsString('onReply', $popup, 'Tombol balas harus menyerahkan ke dialog balasan bersama lewat onReply.');
    }

    public function test_halaman_form_ulasan_tidak_lagi_punya_mode_ringkasan(): void
    {
        $form = file_get_contents(base_path('resources/js/pages/Admin/Testimonials/Form.tsx'));
        $this->assertNotFalse($form, 'halaman form ulasan harus terbaca');
        $form = (string) $form;

        $this->assertStringNotContainsString('setMode', $form, 'Mode ringkasan di halaman form sudah dihapus; baca ulasan lewat popup.');
        $this->assertStringNotContainsString('const ringkasan', $form, 'Blok ringkasan halaman tidak boleh kembali.');
        $this->assertStringNotContainsString('Detail Ulasan', $form, 'Judul halaman berbunyi Detail Ulasan tidak boleh kembali.');
    }


}
