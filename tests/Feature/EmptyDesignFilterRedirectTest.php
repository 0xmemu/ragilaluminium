<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

/**
 * Filter desain tanpa produk tidak boleh jadi halaman buntu.
 *
 * /products/boven/zigzag/polos pernah mengembalikan 200 dengan judul
 * "Boven Zigzag Polos" dan "0 Barang ditemukan". Halaman seperti itu buntu:
 * pengunjung tidak bisa ke mana-mana, dan tautan lamanya tetap hidup serta
 * terindeks mesin pencari.
 *
 * Sekarang alihkan 301 ke halaman model, sehingga tautan lama tetap berujung
 * pada produk. Filter desain yang memang punya produk TIDAK dialihkan.
 */
class EmptyDesignFilterRedirectTest extends TestCase
{
    use CreatesVisibleProducts;
    use RefreshDatabase;

    public function test_filter_desain_tanpa_produk_dialihkan_ke_halaman_model(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'ZIG-REDIR-1',
            'name' => 'Boven Zigzag Satu Daun',
            'product_category' => 'BOVEN',
            'product_model' => 'ZIGZAG',
            'design_variant' => null,
            'status' => 'active',
        ]);

        $this->get('/products/boven/zigzag/polos')
            ->assertStatus(301)
            ->assertRedirect('/products/boven/zigzag');
    }

    public function test_filter_desain_dengan_produk_tidak_dialihkan(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'SLD-POLOS-1',
            'name' => 'Sliding Polos',
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING_2_DAUN',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products/jendela/sliding-2-daun/polos')->assertOk();
    }

    public function test_redirect_mempertahankan_filter_lain(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'ZIG-REDIR-2',
            'name' => 'Boven Zigzag Satu Daun',
            'product_category' => 'BOVEN',
            'product_model' => 'ZIGZAG',
            'design_variant' => null,
            'status' => 'active',
        ]);

        $this->get('/products/boven/zigzag/polos?sort=newest')
            ->assertStatus(301)
            ->assertRedirect('/products/boven/zigzag?sort=newest');
    }

    public function test_halaman_tujuan_redirect_menampilkan_produk(): void
    {
        $this->createVisibleProduct([
            'parent_sku' => 'ZIG-REDIR-3',
            'name' => 'Boven Zigzag Satu Daun',
            'product_category' => 'BOVEN',
            'product_model' => 'ZIGZAG',
            'design_variant' => null,
            'status' => 'active',
        ]);

        $this->followingRedirects()
            ->get('/products/boven/zigzag/polos')
            ->assertOk()
            ->assertSee('ZIG-REDIR-3', false);
    }

    public function test_filter_desain_asing_pada_model_ber_sub_model_juga_dialihkan(): void
    {
        // Model punya satu desain, tetapi desain yang diminta tidak ada.
        $this->createVisibleProduct([
            'parent_sku' => 'KMT-POLOS-1',
            'name' => 'Kaca Mati Polos',
            'product_category' => 'JENDELA',
            'product_model' => 'KACA_MATI',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $this->get('/products/jendela/kaca-mati/ornamen')
            ->assertStatus(301)
            ->assertRedirect('/products/jendela/kaca-mati');
    }
}
