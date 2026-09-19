<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Support\CtaSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Teks kartu reusable storefront diatur dari CTA Storefront.
 *
 * Kontrak owner 2026-09-19: komponen reusable (kartu jaminan "Belanja Aman &
 * Terpercaya" dan blok bantuan di halaman Pesanan) juga harus bisa diatur dari
 * halaman pengaturan, bukan hanya banner penutup per halaman.
 *
 * Kunci blok: `trust` (kartu jaminan) dan `order-help` (bantuan pelacakan).
 * Keduanya memakai mekanisme yang sama dengan banner penutup dan tetap
 * dikirim lewat prop `ctaSettings`.
 */
class CtaReusableBlockTest extends TestCase
{
    use RefreshDatabase;

    private function setBlocks(array $pages): void
    {
        $current = CtaSettings::get();
        CtaSettings::update([
            'enabled' => $current['enabled'],
            'pages' => array_map(
                fn ($p) => ['eyebrow' => $p['eyebrow'], 'heading' => $p['heading']],
                array_merge($current['pages'], $pages),
            ),
        ], null);
    }

    public function test_blok_reusable_terdaftar_dengan_teks_bawaan(): void
    {
        $settings = CtaSettings::get();

        $this->assertArrayHasKey('trust', $settings['pages']);
        $this->assertArrayHasKey('order-help', $settings['pages']);
        $this->assertSame('Belanja Aman & Terpercaya', $settings['pages']['trust']['eyebrow']);
        $this->assertSame(
            'Garansi jika produk rusak, pengiriman aman, dan pelayanan terbaik.',
            $settings['pages']['trust']['heading'],
        );
        $this->assertSame('Butuh bantuan dengan pesanan ini?', $settings['pages']['order-help']['eyebrow']);
    }

    public function test_halaman_admin_menampilkan_blok_reusable(): void
    {
        $admin = \App\Models\User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.cta-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/CtaStorefront/Edit')
                ->has('blocks', count(CtaSettings::PAGES))
                ->where('blocks', fn ($blocks) => collect($blocks)->contains(
                    fn ($b) => ($b['key'] ?? null) === 'trust'
                        && ($b['label'] ?? null) === 'Kartu Jaminan (semua halaman)'
                ))
                ->where('blocks', fn ($blocks) => collect($blocks)->contains(
                    fn ($b) => ($b['key'] ?? null) === 'order-help'
                ))
            );
    }

    public function test_teks_kartu_jaminan_terkirim_ke_halaman_publik(): void
    {
        $this->setBlocks([
            'trust' => ['eyebrow' => 'JUDUL-UJI', 'heading' => 'KETERANGAN-UJI'],
        ]);

        $this->get(route('cart.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('ctaSettings.pages.trust.eyebrow', 'JUDUL-UJI')
                ->where('ctaSettings.pages.trust.heading', 'KETERANGAN-UJI')
            );
    }

    public function test_mengubah_blok_reusable_tidak_mengubah_halaman_lain(): void
    {
        $sebelum = CtaSettings::get();

        $this->setBlocks([
            'trust' => ['eyebrow' => 'JUDUL-UJI', 'heading' => 'KETERANGAN-UJI'],
        ]);

        $sesudah = CtaSettings::get();
        $this->assertSame('JUDUL-UJI', $sesudah['pages']['trust']['eyebrow']);
        $this->assertSame($sebelum['pages']['faq']['eyebrow'], $sesudah['pages']['faq']['eyebrow']);
        $this->assertSame($sebelum['pages']['home']['heading'], $sesudah['pages']['home']['heading']);
        $this->assertSame($sebelum['pages']['about']['heading'], $sesudah['pages']['about']['heading']);
    }

    public function test_teks_kosong_kembali_ke_bawaan(): void
    {
        $this->setBlocks([
            'trust' => ['eyebrow' => '', 'heading' => '   '],
        ]);

        $settings = CtaSettings::get();
        $this->assertSame('Belanja Aman & Terpercaya', $settings['pages']['trust']['eyebrow']);
        $this->assertSame(
            'Garansi jika produk rusak, pengiriman aman, dan pelayanan terbaik.',
            $settings['pages']['trust']['heading'],
        );
    }

    public function test_halaman_admin_tidak_menerima_cta_settings(): void
    {
        $admin = \App\Models\User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.cta-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('ctaSettings', null));
    }
}
