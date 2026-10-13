<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

/**
 * Ukuran halaman katalog menyesuaikan perangkat (kontrak owner 2026-09-18).
 *
 * Jumlah kartu per halaman dihitung SERVER, jadi server tidak tahu lebar layar.
 * Dua sinyal dipakai, berurutan:
 *
 *  1. `per_page` dari klien (paling akurat: klien mengukur viewport-nya sendiri).
 *  2. User-Agent telepon, supaya pelanggan HP menerima 16 kartu sejak render
 *     pertama tanpa permintaan ulang. Pelanggan memakai satu perangkat secara
 *     konsisten, jadi sinyal ini stabil untuk mereka.
 *
 * Desktop memakai default config: 15 kartu, pas untuk grid 3 kolom (sm/md) dan
 * 5 kolom (xl). HP 16 kartu: 8 baris penuh pada grid 2 kolom, tanpa kartu
 * menggantung. Tablet sengaja tetap 15 karena lebarnya masuk grid 3 kolom.
 */
class CatalogPageSizeTest extends TestCase
{
    use CreatesVisibleProducts;
    use RefreshDatabase;

    private function seedProducts(int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->createVisibleProduct([
                'parent_sku' => 'PP-'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
            ]);
        }
    }

    public function test_desktop_memakai_ukuran_default_config(): void
    {
        $this->seedProducts(20);

        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->has('products', 15)
                ->where('pagination.per_page', 15)
                ->where('pagination.last_page', 2)
            );
    }

    public function test_mobile_meminta_ukuran_lebih_besar_lewat_per_page(): void
    {
        $this->seedProducts(20);

        $this->get('/products/all?per_page=16')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->has('products', 16)
                ->where('pagination.per_page', 16)
                ->where('pagination.last_page', 2)
            );
    }

    public function test_ukuran_halaman_disajikan_ke_klien(): void
    {
        $this->seedProducts(3);

        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('catalogPageSize.desktop', 15)
                ->where('catalogPageSize.mobile', 16)
            );
    }

    public function test_per_page_di_luar_ukuran_resmi_diabaikan(): void
    {
        $this->seedProducts(20);

        // URL yang menyisipkan per_page sembarang tidak boleh bisa memaksa
        // pagination raksasa; halaman kembali ke ukuran default.
        foreach (['1000', '0', '7', 'abc', '-5'] as $value) {
            $this->get('/products/all?per_page='.$value)
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->has('products', 15)
                    ->where('pagination.per_page', 15)
                );
        }
    }

    public function test_ukuran_mobile_tidak_tercampur_cache_dengan_desktop(): void
    {
        $this->seedProducts(20);

        // Permintaan ukuran desktop dulu, lalu mobile: hasilnya tidak boleh
        // bertukar lewat cache katalog (kunci cache memuat ukuran halaman).
        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('products', 15));

        $this->get('/products/all?per_page=16')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('products', 16));

        // Kembali ke desktop: 15 kartu lagi, bukan sisa hasil mobile.
        $this->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('products', 15));
    }

    public function test_halaman_terakhir_mobile_memuat_sisa_kartu(): void
    {
        $this->seedProducts(20);

        // 20 produk / 16 = halaman 2 berisi 4 kartu.
        $this->get('/products/all?per_page=16&page=2')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('products', 4)
                ->where('pagination.current_page', 2)
                ->where('pagination.last_page', 2)
            );
    }

    /** User-Agent telepon Android (selalu memuat "Mobile"). */
    private const UA_ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 13; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36';

    /** User-Agent iPhone. */
    private const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

    /** User-Agent desktop. */
    private const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

    /** User-Agent tablet Android: "Android" tanpa "Mobile". */
    private const UA_ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

    /** User-Agent iPad (memuat "Mobile" tetapi bukan telepon). */
    private const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

    public function test_telepon_android_mendapat_ukuran_mobile_tanpa_parameter(): void
    {
        $this->seedProducts(20);

        // Pelanggan HP mendarat dari tautan menu: URL bersih, tanpa per_page,
        // tetapi kartunya sudah 16 sejak render pertama.
        $this->withHeaders(['User-Agent' => self::UA_ANDROID_PHONE])
            ->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Catalog')
                ->has('products', 16)
                ->where('pagination.per_page', 16)
                ->where('pagination.last_page', 2)
            );
    }

    public function test_iphone_mendapat_ukuran_mobile(): void
    {
        $this->seedProducts(20);

        $this->withHeaders(['User-Agent' => self::UA_IPHONE])
            ->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('products', 16)
                ->where('pagination.per_page', 16)
            );
    }

    public function test_desktop_tetap_ukuran_default(): void
    {
        $this->seedProducts(20);

        $this->withHeaders(['User-Agent' => self::UA_DESKTOP])
            ->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('products', 15)
                ->where('pagination.per_page', 15)
            );
    }

    public function test_tablet_dan_ipad_bukan_telepon(): void
    {
        $this->seedProducts(20);

        // Lebar tablet masuk grid 3 kolom, dan 15 kartu pas mengisi 5 baris.
        foreach ([self::UA_ANDROID_TABLET, self::UA_IPAD] as $agent) {
            $this->withHeaders(['User-Agent' => $agent])
                ->get('/products/all')
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->has('products', 15)
                    ->where('pagination.per_page', 15)
                );
        }
    }

    public function test_user_agent_kosong_memakai_ukuran_default(): void
    {
        $this->seedProducts(20);

        $this->withHeaders(['User-Agent' => ''])
            ->get('/products/all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('products', 15)
                ->where('pagination.per_page', 15)
            );
    }

    public function test_parameter_per_page_menang_atas_deteksi_user_agent(): void
    {
        $this->seedProducts(20);

        // Klien yang mengukur sendiri viewport-nya lebih akurat daripada
        // User-Agent, jadi nilai eksplisitnya yang dipakai. Contoh nyata: HP
        // yang diputar ke lanskap sehingga gridnya jadi 3 kolom.
        $this->withHeaders(['User-Agent' => self::UA_ANDROID_PHONE])
            ->get('/products/all?per_page=15')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('products', 15)
                ->where('pagination.per_page', 15)
            );

        // Dan sebaliknya: jendela desktop sempit meminta ukuran mobile.
        $this->withHeaders(['User-Agent' => self::UA_DESKTOP])
            ->get('/products/all?per_page=16')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('products', 16)
                ->where('pagination.per_page', 16)
            );
    }

    public function test_api_katalog_ikut_mengenali_telepon(): void
    {
        $this->seedProducts(20);

        $this->withHeaders(['User-Agent' => self::UA_ANDROID_PHONE])
            ->getJson('/api/catalog/windows')
            ->assertOk()
            ->assertJsonPath('pagination.per_page', 16)
            ->assertJsonCount(16, 'products');
    }

    public function test_api_katalog_ikut_memakai_ukuran_halaman(): void
    {
        $this->seedProducts(20);

        $this->getJson('/api/catalog/windows')
            ->assertOk()
            ->assertJsonPath('pagination.per_page', 15);

        $this->getJson('/api/catalog/windows?per_page=16')
            ->assertOk()
            ->assertJsonPath('pagination.per_page', 16)
            ->assertJsonCount(16, 'products');
    }
}
