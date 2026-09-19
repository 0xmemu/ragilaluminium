<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\User;
use App\Support\CtaSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;

class CtaStorefrontTest extends \Tests\TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_default_text_matches_the_pre_feature_storefront_copy(): void
    {
        $settings = CtaSettings::get();

        $this->assertTrue($settings['enabled']);
        $this->assertSame('Masih punya pertanyaan?', $settings['pages']['faq']['eyebrow']);
        $this->assertSame(
            'Tim kami siap membantu lewat WhatsApp',
            $settings['pages']['faq']['heading'],
        );
    }

    public function test_admin_page_lists_every_cta_block(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.cta-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/CtaStorefront/Edit')
                ->has('blocks', count(CtaSettings::PAGES))
                ->where('enabled', true)
                ->where('color', CtaSettings::DEFAULT_COLOR)
                ->has('destinations', count(CtaSettings::DESTINATIONS))
                ->has('submitUrl'));
    }

    public function test_saving_changes_only_the_edited_page(): void
    {
        $admin = $this->admin();
        $before = CtaSettings::get();

        $payload = $this->formPayload(['faq' => ['heading' => 'Judul baru untuk FAQ']]);

        $this->actingAs($admin)
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $after = CtaSettings::get();
        $this->assertSame('Judul baru untuk FAQ', $after['pages']['faq']['heading']);
        $this->assertSame(
            $before['pages']['about']['heading'],
            $after['pages']['about']['heading'],
            'Halaman lain tidak boleh ikut berubah.',
        );
    }

    public function test_empty_text_falls_back_to_the_initial_copy(): void
    {
        $admin = $this->admin();
        $payload = $this->formPayload(['faq' => ['heading' => '   ']]);

        $this->actingAs($admin)->put(route('admin.cta-settings.update'), $payload);

        $this->assertSame(
            CtaSettings::INITIAL_TEXT['faq']['heading'],
            CtaSettings::get()['pages']['faq']['heading'],
        );
    }

    public function test_disabling_hides_the_cta_on_public_pages(): void
    {
        $admin = $this->admin();
        $payload = $this->formPayload(enabled: false);

        $this->actingAs($admin)->put(route('admin.cta-settings.update'), $payload);

        $this->get('/faq')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Faq')
                ->where('ctaSettings.enabled', false));
    }

    public function test_public_pages_receive_the_configured_text(): void
    {
        $admin = $this->admin();
        $payload = $this->formPayload(['faq' => ['eyebrow' => 'Kop uji', 'heading' => 'Judul uji FAQ']]);

        $this->actingAs($admin)->put(route('admin.cta-settings.update'), $payload);

        $this->get('/faq')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('ctaSettings.pages.faq.eyebrow', 'Kop uji')
                ->where('ctaSettings.pages.faq.heading', 'Judul uji FAQ'));
    }

    public function test_admin_pages_do_not_receive_cta_settings(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.cta-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('ctaSettings', null));
    }

    public function test_settings_survive_without_clobbering_other_cms_content(): void
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

    /**
     * Payload persis seperti yang dikirim halaman admin: { enabled, blocks[] }.
     * Struktur simpanan (pages[]) berbeda dengan struktur form (blocks[]).
     *
     * @param  array<string, mixed>  $overrides  key => kolom => nilai
     * @return array{enabled: bool, blocks: list<array{key: string, eyebrow: string, heading: string}>}
     */
    public function test_tombol_live_terkirim_ke_halaman_admin(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.cta-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                // Halaman admin harus menggambarkan tombol yang benar-benar
                // dirender storefront, bukan daftar kosong.
                ->where('blocks', fn ($blocks) => collect($blocks)->contains(
                    fn ($b) => ($b['key'] ?? null) === 'about'
                        && collect($b['actions'] ?? [])->pluck('destination')->all() === ['whatsapp', 'catalog.index']
                ))
                ->where('blocks', fn ($blocks) => collect($blocks)->contains(
                    fn ($b) => ($b['key'] ?? null) === 'trust'
                        && ($b['actions'] ?? null) === []
                ))
            );
    }

    public function test_admin_dapat_mengubah_tombol_cta(): void
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

        $after = CtaSettings::get();
        $this->assertSame(
            [['label' => 'Tanya admin', 'destination' => 'contact', 'variant' => 'primary']],
            $after['pages']['faq']['actions'],
        );
    }

    public function test_tombol_kosong_kembali_ke_tombol_live(): void
    {
        // Admin menghapus semua tombol di satu blok: blok itu kembali memakai
        // tombol bawaan supaya CTA tidak pernah kehilangan jalur konsultasi.
        $payload = $this->formPayload(['faq' => ['actions' => []]]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame(
            CtaSettings::INITIAL_ACTIONS['faq'],
            CtaSettings::get()['pages']['faq']['actions'],
        );
    }

    public function test_tujuan_tombol_tidak_sah_dibuang(): void
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

        // Tujuan di luar daftar preset dibuang, lalu blok kembali ke tombol live.
        $this->assertSame(
            CtaSettings::INITIAL_ACTIONS['faq'],
            CtaSettings::get()['pages']['faq']['actions'],
        );
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

        // Tidak tersimpan karena melebihi batas.
        $this->assertSame(
            CtaSettings::INITIAL_ACTIONS['home'],
            CtaSettings::get()['pages']['home']['actions'],
        );
    }

    public function test_admin_dapat_mengubah_warna_banner(): void
    {
        $payload = $this->formPayload();
        $payload['color'] = '#1D4ED8';

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame('#1D4ED8', CtaSettings::get()['color']);

        // Halaman publik menerima warna itu lewat prop bersama.
        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('ctaSettings.color', '#1D4ED8'));
    }

    public function test_warna_tidak_sah_kembali_ke_warna_bawaan(): void
    {
        $payload = $this->formPayload();
        $payload['color'] = 'merah-terang';

        // Ditolak validasi (bukan hex 6 digit), jadi nilai lama yang bertahan.
        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertSessionHasErrors('color');

        $this->assertSame(CtaSettings::DEFAULT_COLOR, CtaSettings::get()['color']);
    }

    public function test_lima_blok_baru_terdaftar_dengan_isi_live(): void
    {
        // Blok yang ditemukan saat penyisiran ulang: semuanya teks persuasi yang
        // tampil di storefront tetapi dulu keras di kode.
        $settings = CtaSettings::get();

        foreach (['home-help', 'pdp-benefits', 'catalog-empty', 'about-contact'] as $key) {
            $this->assertArrayHasKey($key, $settings['pages'], "Blok {$key} harus terdaftar.");
        }

        // `hero-trust` SENGAJA tidak terdaftar: teks lencana hero ditampilkan
        // PromoSlider yang sudah tidak dirender, jadi blok itu tidak akan
        // tampil di storefront dan hanya menyesatkan admin.
        $this->assertArrayNotHasKey('hero-trust', $settings['pages']);

        // Poin alasan belanja PDP: 3 poin live.
        $this->assertSame(
            ['Garansi 100%', 'Bayar di tempat (COD)', 'Kirim ke seluruh Indonesia'],
            $settings['pages']['pdp-benefits']['items'],
        );

        // Judul & tombol blok yang bukan berbentuk lencana.
        $this->assertSame('Masih Bingung?', $settings['pages']['home-help']['eyebrow']);
        $this->assertSame('Toko & Workshop Ragil Aluminium', $settings['pages']['about-contact']['heading']);
        $this->assertSame(
            ['whatsapp', 'catalog.all'],
            collect($settings['pages']['catalog-empty']['actions'])->pluck('destination')->all(),
        );
    }

    public function test_poin_pdp_terkirim_ke_halaman_publik(): void
    {
        $this->setBlocks([
            'pdp-benefits' => ['items' => ['POIN-UJI-A']],
        ]);

        $product = \App\Models\Product::create([
            'parent_sku' => 'RA-CTATEST-1',
            'name' => 'Produk Uji CTA',
            'short_name' => 'Produk Uji',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'status' => 'active',
        ]);
        \App\Models\ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'RA-CTATEST-1-A',
            'price' => 900000,
            'stock' => 3,
            'status' => 'active',
        ]);

        $this->get('/product/RA-CTATEST-1')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('ctaSettings.pages.pdp-benefits.items', ['POIN-UJI-A'])
            );
    }

    public function test_admin_dapat_mengubah_poin_pdp(): void
    {
        $payload = $this->formPayload([
            'pdp-benefits' => ['items' => ['Hanya satu poin']],
        ]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame(['Hanya satu poin'], CtaSettings::get()['pages']['pdp-benefits']['items']);
    }

    public function test_poin_kosong_kembali_ke_daftar_live(): void
    {
        $payload = $this->formPayload(['pdp-benefits' => ['items' => ['   ', '']]]);

        $this->actingAs($this->admin())
            ->put(route('admin.cta-settings.update'), $payload)
            ->assertRedirect(route('admin.cta-settings.edit'));

        $this->assertSame(
            CtaSettings::INITIAL_ITEMS['pdp-benefits'],
            CtaSettings::get()['pages']['pdp-benefits']['items'],
        );
    }

    /**
     * Ubah sebagian saja dari satu blok: override digabung PER BLOK, bukan
     * mengganti seluruh entry (array_replace akan membuang field yang tidak
     * disebut sehingga blok jadi tidak lengkap).
     */
    private function setBlocks(array $overrides): void
    {
        $current = CtaSettings::get();
        $pages = [];
        foreach ($current['pages'] as $key => $page) {
            $pages[$key] = array_merge($page, $overrides[$key] ?? []);
        }

        CtaSettings::update([
            'enabled' => $current['enabled'],
            'color' => $current['color'],
            'pages' => $pages,
        ], null);
    }

    private function formPayload(array $overrides = [], ?bool $enabled = null): array
    {
        $settings = CtaSettings::get();

        return [
            'enabled' => $enabled ?? $settings['enabled'],
            'color' => $settings['color'],
            'blocks' => collect($settings['pages'])
                ->map(fn (array $text, string $key): array => [
                    'key' => $key,
                    'eyebrow' => $overrides[$key]['eyebrow'] ?? $text['eyebrow'],
                    'heading' => $overrides[$key]['heading'] ?? $text['heading'],
                    'actions' => $overrides[$key]['actions'] ?? $text['actions'],
                    'items' => $overrides[$key]['items'] ?? $text['items'],
                ])
                ->values()
                ->all(),
        ];
    }
}
