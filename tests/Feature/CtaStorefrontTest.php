<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\CtaSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Pengaturan teks CTA storefront.
 *
 * KONTRAK YANG DIKUNCI DI SINI (owner 2026-09-20): pengaturan ini LAPISAN
 * PEMBANDING, bukan sumber teks. Selama admin belum menyimpan sebuah kolom,
 * `get()` mengembalikan null (atau daftar kosong) dan komponen storefront
 * memakai teksnya sendiri. Jadi memasang fitur ini tidak pernah mengubah
 * tampilan storefront, dan teks yang diperbarui di kode tidak ikut membeku.
 *
 * Teks live dibaca dari resources/js/lib/cta-live.json, satu berkas yang juga
 * diimpor React, supaya halaman admin tidak bisa menampilkan teks yang berbeda
 * dari yang benar-benar dirender storefront.
 */
class CtaStorefrontTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    // ---------------------------------------------------------------------
    // Registry: satu sumber teks untuk PHP dan React
    // ---------------------------------------------------------------------

    public function test_registry_memuat_seluruh_blok_cta_storefront(): void
    {
        $registry = CtaSettings::registry();

        // Blok yang benar-benar tampil di storefront, dikelompokkan per jenis.
        $perJenis = array_count_values(array_column($registry, 'kind'));

        $this->assertGreaterThanOrEqual(6, $perJenis['banner'] ?? 0, 'Banner penutup per halaman.');
        $this->assertGreaterThanOrEqual(6, $perJenis['section'] ?? 0, 'Tombol judul section beranda.');
        $this->assertGreaterThanOrEqual(6, $perJenis['empty'] ?? 0, 'Tampilan saat belum ada isi.');

        foreach (['trust', 'order-help', 'about-contact'] as $key) {
            $this->assertArrayHasKey($key, $registry, "Blok {$key} harus terdaftar.");
            $this->assertSame('card', $registry[$key]['kind']);
        }

        foreach (['home-help', 'pdp-benefits'] as $key) {
            $this->assertArrayHasKey($key, $registry, "Blok {$key} harus terdaftar.");
            $this->assertSame('list', $registry[$key]['kind']);
        }
    }

    public function test_setiap_blok_punya_label_dan_kunci_unik(): void
    {
        $registry = CtaSettings::registry();
        $kunci = array_keys($registry);

        $this->assertSame($kunci, array_values(array_unique($kunci)), 'Kunci blok harus unik.');

        foreach ($registry as $key => $block) {
            $this->assertNotSame('', $block['label'], "Blok {$key} harus punya label.");
            $this->assertContains(
                $block['kind'],
                ['banner', 'card', 'section', 'empty', 'list'],
                "Jenis blok {$key} harus dikenal.",
            );
        }
    }

    public function test_tujuan_tombol_di_registry_selalu_dikenal(): void
    {
        foreach (CtaSettings::registry() as $key => $block) {
            foreach ($block['actions'] as $action) {
                $destination = (string) ($action['destination'] ?? '');
                // Blok `section` tautannya menempel pada section, jadi kosong.
                if ($block['kind'] === 'section') {
                    $this->assertSame('', $destination, "Blok section {$key} tidak menyimpan tujuan.");
                    continue;
                }
                $this->assertArrayHasKey(
                    $destination,
                    CtaSettings::DESTINATIONS,
                    "Tujuan tombol blok {$key} harus ada di daftar preset.",
                );
            }
        }
    }

    public function test_daftar_tujuan_memuat_semua_tautan_yang_dipakai_storefront(): void
    {
        // Tautan yang dipakai teks live storefront, harus bisa dipilih admin.
        foreach ([
            'whatsapp',
            'home',
            'catalog.index',
            'catalog.all',
            'catalog.category.jendela',
            'faq',
            'cara-pemesanan',
            'masalah-dan-solusi',
            'about',
            'contact',
        ] as $destination) {
            $this->assertArrayHasKey($destination, CtaSettings::DESTINATIONS);
        }
    }

    // ---------------------------------------------------------------------
    // Lapisan pembanding: belum disimpan berarti storefront tidak berubah
    // ---------------------------------------------------------------------

    public function test_tanpa_simpanan_semua_kolom_kosong(): void
    {
        $settings = CtaSettings::get();

        $this->assertTrue($settings['enabled']);
        $this->assertNull($settings['color'], 'Warna harus null supaya banner pakai warna brand.');
        $this->assertSame(array_keys(CtaSettings::registry()), array_keys($settings['pages']));

        foreach ($settings['pages'] as $key => $page) {
            $this->assertNull($page['eyebrow'], "eyebrow {$key} harus null.");
            $this->assertNull($page['heading'], "heading {$key} harus null.");
            $this->assertSame([], $page['actions'], "actions {$key} harus kosong.");
            $this->assertSame([], $page['items'], "items {$key} harus kosong.");
        }
    }

    public function test_halaman_publik_tetap_mengirim_kolom_kosong_sebelum_disimpan(): void
    {
        $this->get('/faq')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('ctaSettings.pages.faq.eyebrow', null)
                ->where('ctaSettings.pages.faq.heading', null)
                ->where('ctaSettings.pages.faq.actions', [])
                ->where('ctaSettings.color', null));
    }

    public function test_teks_live_tidak_disalin_ke_simpanan(): void
    {
        // Menyimpan tanpa mengubah apa pun tidak boleh membekukan teks live:
        // kolom tetap kosong sehingga teks dari kode terus dipakai.
        $payload = $this->formPayload();

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $settings = CtaSettings::get();
        $this->assertNull($settings['pages']['faq']['eyebrow']);
        $this->assertSame([], $settings['pages']['faq']['actions']);
    }

    // ---------------------------------------------------------------------
    // Menyimpan teks
    // ---------------------------------------------------------------------

    public function test_simpan_mengubah_hanya_blok_yang_diisi(): void
    {
        $payload = $this->formPayload(['faq' => ['heading' => 'Judul baru untuk FAQ']]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $settings = CtaSettings::get();
        $this->assertSame('Judul baru untuk FAQ', $settings['pages']['faq']['heading']);
        $this->assertNull($settings['pages']['about']['heading'], 'Blok lain tidak boleh ikut berubah.');
    }

    public function test_teks_kosong_kembali_ke_teks_storefront(): void
    {
        $payload = $this->formPayload(['faq' => ['heading' => '   ']]);

        $this->actingAs($this->admin())->put(route('admin.cta-settings.update'), $payload);

        $this->assertNull(CtaSettings::get()['pages']['faq']['heading']);
    }

    public function test_halaman_publik_menerima_teks_yang_disimpan(): void
    {
        $payload = $this->formPayload([
            'faq' => ['eyebrow' => 'Kop uji', 'heading' => 'Judul uji FAQ'],
        ]);

        $this->actingAs($this->admin())->put(route('admin.cta-settings.update'), $payload);

        $this->get('/faq')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('ctaSettings.pages.faq.eyebrow', 'Kop uji')
                ->where('ctaSettings.pages.faq.heading', 'Judul uji FAQ'));
    }

    public function test_mematikan_cta_menyembunyikan_banner(): void
    {
        $payload = $this->formPayload(enabled: false);

        $this->actingAs($this->admin())->put(route('admin.cta-settings.update'), $payload);

        $this->get('/faq')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('ctaSettings.enabled', false));
    }

    // ---------------------------------------------------------------------
    // Tombol
    // ---------------------------------------------------------------------

    public function test_admin_dapat_mengubah_tombol(): void
    {
        $payload = $this->formPayload([
            'faq' => [
                'actions' => [
                    ['label' => 'Tanya admin', 'destination' => 'contact', 'variant' => 'primary'],
                ],
            ],
        ]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame(
            [['label' => 'Tanya admin', 'destination' => 'contact', 'variant' => 'primary']],
            CtaSettings::get()['pages']['faq']['actions'],
        );
    }

    public function test_tombol_kosong_berarti_kembali_ke_tombol_storefront(): void
    {
        $payload = $this->formPayload(['faq' => ['actions' => []]]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame([], CtaSettings::get()['pages']['faq']['actions']);
    }

    public function test_tujuan_tombol_di_luar_preset_dibuang(): void
    {
        $payload = $this->formPayload([
            'faq' => [
                'actions' => [
                    ['label' => 'Judi online', 'destination' => 'https://situs-terlarang.example', 'variant' => 'primary'],
                ],
            ],
        ]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame([], CtaSettings::get()['pages']['faq']['actions']);
    }

    public function test_tombol_dibatasi_dua_per_blok(): void
    {
        $payload = $this->formPayload([
            'home' => [
                'actions' => [
                    ['label' => 'Satu', 'destination' => 'whatsapp', 'variant' => 'primary'],
                    ['label' => 'Dua', 'destination' => 'faq', 'variant' => 'secondary'],
                    ['label' => 'Tiga', 'destination' => 'about', 'variant' => 'secondary'],
                ],
            ],
        ]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            // Laravel menamai kunci error array dengan indeks, bukan tanda bintang.
            ->assertSessionHasErrors('blocks.0.actions');

        $this->assertSame([], CtaSettings::get()['pages']['home']['actions']);
    }

    public function test_blok_section_hanya_menyimpan_label(): void
    {
        $payload = $this->formPayload([
            'home-model' => [
                'actions' => [
                    ['label' => 'Lihat Katalog', 'destination' => 'contact', 'variant' => 'primary'],
                ],
            ],
        ]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        // Tautan section tidak boleh bisa diganti dari pengaturan.
        $this->assertSame(
            [['label' => 'Lihat Katalog', 'destination' => '', 'variant' => 'secondary']],
            CtaSettings::get()['pages']['home-model']['actions'],
        );
    }

    // ---------------------------------------------------------------------
    // Warna banner
    // ---------------------------------------------------------------------

    public function test_admin_dapat_mengubah_warna_banner(): void
    {
        $payload = $this->formPayload();
        $payload['color'] = '#1D4ED8';

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame('#1D4ED8', CtaSettings::get()['color']);

        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('ctaSettings.color', '#1D4ED8'));
    }

    public function test_warna_kosong_berarti_pakai_warna_brand(): void
    {
        $payload = $this->formPayload();
        $payload['color'] = '';

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertNull(CtaSettings::get()['color']);
    }

    public function test_warna_tidak_sah_ditolak_validasi(): void
    {
        $payload = $this->formPayload();
        $payload['color'] = 'merah-terang';

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertSessionHasErrors('color');

        $this->assertNull(CtaSettings::get()['color']);
    }

    // ---------------------------------------------------------------------
    // Daftar kartu/poin
    // ---------------------------------------------------------------------

    public function test_daftar_poin_menyimpan_judul_dan_keterangan(): void
    {
        $payload = $this->formPayload([
            'home-help' => [
                'items' => [
                    ['label' => 'Kartu satu', 'description' => 'Keterangan satu'],
                ],
            ],
        ]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame(
            [['label' => 'Kartu satu', 'description' => 'Keterangan satu']],
            CtaSettings::get()['pages']['home-help']['items'],
        );
    }

    public function test_baris_tanpa_judul_dibuang(): void
    {
        $payload = $this->formPayload([
            'pdp-benefits' => [
                'items' => [
                    ['label' => 'Poin sah', 'description' => ''],
                    ['label' => '   ', 'description' => 'tanpa judul'],
                ],
            ],
        ]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame(
            [['label' => 'Poin sah', 'description' => '']],
            CtaSettings::get()['pages']['pdp-benefits']['items'],
        );
    }

    public function test_daftar_kosong_berarti_kembali_ke_daftar_storefront(): void
    {
        $payload = $this->formPayload([
            'pdp-benefits' => ['items' => [['label' => '  ', 'description' => '']]],
        ]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame([], CtaSettings::get()['pages']['pdp-benefits']['items']);
    }

    // ---------------------------------------------------------------------
    // Halaman admin
    // ---------------------------------------------------------------------

    public function test_halaman_admin_menampilkan_teks_storefront_dan_nilai_tersimpan(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->get(route('admin.cta-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/CtaStorefront/Edit')
                ->has('blocks', count(CtaSettings::registry()))
                ->where('enabled', true)
                ->where('color', null)
                ->where('defaultColor', CtaSettings::DEFAULT_COLOR)
                ->where('maxActions', CtaSettings::MAX_ACTIONS)
                ->where('maxItems', CtaSettings::MAX_ITEMS)
                ->has('destinations', count(CtaSettings::DESTINATIONS))
                ->has('submitUrl')
                // Teks storefront ikut dikirim supaya admin melihat keadaan
                // sebenarnya, dan kolom tersimpan masih kosong.
                ->where('blocks', fn ($blocks) => collect($blocks)->contains(
                    fn ($b) => ($b['key'] ?? null) === 'home-help'
                        && ($b['live']['eyebrow'] ?? null) === 'Masih Bingung?'
                        && ($b['live']['heading'] ?? null) === 'Kami bantu dari awal sampai jadi'
                        && ($b['stored']['eyebrow'] ?? null) === null
                        && count($b['live']['items'] ?? []) === 4
                )));
    }

    public function test_halaman_admin_mengelompokkan_blok(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.cta-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('blocks', fn ($blocks) => collect($blocks)->every(
                    fn ($b) => in_array($b['kind'] ?? null, ['banner', 'card', 'section', 'empty', 'list'], true)
                ))
                ->where('blocks', fn ($blocks) => collect($blocks)->contains(
                    fn ($b) => ($b['key'] ?? null) === 'trust'
                        && ($b['kind'] ?? null) === 'card'
                        && ($b['live']['eyebrow'] ?? null) === 'Belanja Aman & Terpercaya'
                ))
                ->where('blocks', fn ($blocks) => collect($blocks)->contains(
                    fn ($b) => ($b['key'] ?? null) === 'home-model'
                        && ($b['kind'] ?? null) === 'section'
                        && ($b['live']['actions'][0]['label'] ?? null) === 'Lihat Semua'
                )));
    }

    public function test_halaman_admin_menandai_blok_yang_dinamis(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.cta-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('blocks', fn ($blocks) => collect($blocks)->contains(
                    fn ($b) => ($b['key'] ?? null) === 'pdp-benefits'
                        && ($b['dynamic'] ?? null) === true
                        && ($b['note'] ?? null) !== null
                )));
    }

    public function test_halaman_admin_tidak_menerima_cta_settings(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.cta-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('ctaSettings', null));
    }

    // ---------------------------------------------------------------------
    // Penyimpanan tidak merusak konten CMS lain
    // ---------------------------------------------------------------------

    public function test_simpanan_tidak_menghapus_konten_cms_lain(): void
    {
        CmsPage::query()->create([
            'slug' => CtaSettings::PAGE_SLUG,
            'title' => 'Halaman lain',
            'content' => ['catatan_lain' => 'harus tetap ada'],
            'published' => true,
        ]);

        $payload = CtaSettings::get();
        $payload['pages']['home']['heading'] = 'Judul beranda baru';
        CtaSettings::update($payload, 1);

        $page = CmsPage::query()->where('slug', CtaSettings::PAGE_SLUG)->firstOrFail();
        $this->assertSame('harus tetap ada', $page->content['catatan_lain'] ?? null);
        $this->assertSame(
            'Judul beranda baru',
            $page->content[CtaSettings::CONTENT_KEY]['pages']['home']['heading'],
        );
    }

    public function test_forget_mengembalikan_seluruh_blok_ke_teks_storefront(): void
    {
        $payload = $this->formPayload(['faq' => ['heading' => 'Judul uji']]);
        $this->actingAs($this->admin())->put(route('admin.cta-settings.update'), $payload);
        $this->assertSame('Judul uji', CtaSettings::get()['pages']['faq']['heading']);

        CtaSettings::forget();

        $this->assertNull(CtaSettings::get()['pages']['faq']['heading']);
    }

    // ---------------------------------------------------------------------
    // Daftar alasan belanja PDP dihitung per produk
    // ---------------------------------------------------------------------

    public function test_daftar_alasan_belanja_kosong_sebelum_disimpan(): void
    {
        $product = Product::create([
            'parent_sku' => 'RA-CTATEST-1',
            'name' => 'Produk Uji CTA',
            'short_name' => 'Produk Uji',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RA-CTATEST-1-A',
            'price' => 900000,
            'stock' => 3,
            'status' => 'active',
        ]);

        // Komponen PDP menghitung sendiri daftarnya per produk (label garansi
        // ikut promo, baris COD bisa hilang), jadi prop-nya harus kosong.
        $this->get('/product/RA-CTATEST-1')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('ctaSettings.pages.pdp-benefits.items', []));
    }

    // ---------------------------------------------------------------------

    /**
     * Payload persis seperti yang dikirim halaman admin: { enabled, color,
     * blocks[{key, eyebrow, heading, actions, items}] }. Nilai yang tidak
     * disebut berarti kosong, yaitu "pakai teks storefront".
     */
    private function formPayload(array $overrides = [], ?bool $enabled = null): array
    {
        $settings = CtaSettings::get();

        return [
            'enabled' => $enabled ?? $settings['enabled'],
            'color' => $settings['color'] ?? '',
            'blocks' => collect($settings['pages'])
                ->map(fn (array $block, string $key): array => [
                    'key' => $key,
                    'eyebrow' => $overrides[$key]['eyebrow'] ?? $block['eyebrow'] ?? '',
                    'heading' => $overrides[$key]['heading'] ?? $block['heading'] ?? '',
                    'actions' => $overrides[$key]['actions'] ?? $block['actions'],
                    'items' => $overrides[$key]['items'] ?? $block['items'],
                ])
                ->values()
                ->all(),
        ];
    }
}
