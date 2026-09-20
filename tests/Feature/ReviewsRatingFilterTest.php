<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Filter rating pada halaman ulasan (/reviews/web dan /reviews/ss).
 *
 * Kontrak:
 * - `rating` hanya menerima 1..5; nilai lain diabaikan (tidak memfilter).
 * - Opsi rating dihitung dari basis TANPA filter rating, supaya jumlahnya
 *   tetap terbaca saat salah satu rating dipilih.
 * - Hanya rating yang benar-benar punya ulasan yang ditawarkan.
 * - Filter rating dan filter model berdampingan, tidak saling menghapus.
 */
class ReviewsRatingFilterTest extends TestCase
{
    use RefreshDatabase;

    private function page(): CmsPage
    {
        return CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);
    }

    private function product(string $sku, string $model = 'SLIDING'): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => 'Produk '.$sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => $model,
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    private function review(CmsPage $page, ?int $productId, string $name, int $rating): CmsTestimonial
    {
        return CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $productId,
            'customer_name' => $name,
            'message' => 'Ulasan '.$name,
            'rating' => $rating,
            'source' => 'website',
            'published' => true,
            'sort_order' => 0,
        ]);
    }

    public function test_opsi_rating_hanya_menawarkan_rating_yang_ada_ulasannya(): void
    {
        $page = $this->page();
        $product = $this->product('RA-RATING-1');

        // Rating 5 ada 2, rating 3 ada 1, rating lain tidak ada.
        $this->review($page, $product->id, 'A', 5);
        $this->review($page, $product->id, 'B', 5);
        $this->review($page, $product->id, 'C', 3);

        $this->get(route('reviews.website'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $assert) => $assert
                ->component('Public/Reviews')
                // Urut menaik: bintang terendah paling atas.
                ->has('ratingNav', 2)
                ->where('ratingNav.0.value', '3')
                ->where('ratingNav.0.count', 1)
                ->where('ratingNav.1.value', '5')
                ->where('ratingNav.1.count', 2)
                ->where('activeRating', null));
    }

    public function test_filter_rating_menyaring_daftar_ulasan(): void
    {
        $page = $this->page();
        $product = $this->product('RA-RATING-2');

        $this->review($page, $product->id, 'Lima', 5);
        $this->review($page, $product->id, 'Empat', 4);
        $this->review($page, $product->id, 'Tiga', 3);

        $this->get(route('reviews.website', ['rating' => 4]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $assert) => $assert
                ->component('Public/Reviews')
                ->has('testimonials.data', 1)
                ->where('testimonials.data.0.customer_name', 'Empat')
                ->where('activeRating', '4')
                // Jumlah tiap rating tetap dihitung dari seluruh ulasan,
                // bukan dari hasil filter.
                ->has('ratingNav', 3)
                ->where('ratingNav.0.value', '3')
                ->where('ratingNav.0.count', 1));
    }

    public function test_statistik_mengikuti_filter_rating(): void
    {
        $page = $this->page();
        $product = $this->product('RA-RATING-3');

        $this->review($page, $product->id, 'A', 5);
        $this->review($page, $product->id, 'B', 5);
        $this->review($page, $product->id, 'C', 4);

        $this->get(route('reviews.website', ['rating' => 5]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $assert) => $assert
                ->where('stats.website_total', 2)
                ->where('stats.average_rating', fn ($v) => (float) $v === 5.0));
    }

    public function test_rating_di_luar_1_sampai_5_diabaikan(): void
    {
        $page = $this->page();
        $product = $this->product('RA-RATING-4');

        $this->review($page, $product->id, 'A', 5);
        $this->review($page, $product->id, 'B', 4);

        foreach (['0', '6', '99', 'abc', '', '3.5', '-2'] as $invalid) {
            $this->get(route('reviews.website', ['rating' => $invalid]))
                ->assertOk()
                ->assertInertia(fn (AssertableInertia $assert) => $assert
                    ->has('testimonials.data', 2)
                    ->where('activeRating', null));
        }
    }

    public function test_filter_rating_dan_model_bisa_dipakai_bersamaan(): void
    {
        $page = $this->page();
        $sliding = $this->product('RA-RATING-5', 'SLIDING');
        $jungkit = $this->product('RA-RATING-6', 'JUNGKIT');

        $this->review($page, $sliding->id, 'Sliding Lima', 5);
        $this->review($page, $jungkit->id, 'Jungkit Lima', 5);
        $this->review($page, $jungkit->id, 'Jungkit Empat', 4);

        $this->get(route('reviews.website', ['rating' => 4, 'model' => 'WINDOW|JUNGKIT']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $assert) => $assert
                ->has('testimonials.data', 1)
                ->where('testimonials.data.0.customer_name', 'Jungkit Empat')
                ->where('activeRating', '4')
                ->where('activeModel', 'WINDOW|JUNGKIT')
                // Opsi rating mengikuti filter model: model JUNGKIT punya
                // rating 5 dan 4, model SLIDING tidak ikut terhitung.
                ->has('ratingNav', 2)
                ->where('ratingNav.0.count', 1));
    }

    public function test_filter_rating_juga_berlaku_di_halaman_screenshot(): void
    {
        $page = $this->page();

        $mk = fn (string $name, int $rating) => CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => null,
            'customer_name' => $name,
            'message' => 'Ulasan '.$name,
            'rating' => $rating,
            'source' => 'shopee',
            'image_url' => 'https://example.test/'.$name.'.jpg',
            'published' => true,
            'sort_order' => 0,
        ]);

        $mk('Satu', 5);
        $mk('Dua', 3);

        $this->get(route('reviews.screenshots', ['rating' => 3]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $assert) => $assert
                ->component('Public/Reviews')
                ->has('testimonials.data', 1)
                ->where('testimonials.data.0.customer_name', 'Dua')
                ->where('activeRating', '3')
                ->has('ratingNav', 2));
    }

    public function test_ulasan_belum_disetujui_tidak_ikut_terhitung(): void
    {
        $page = $this->page();
        $product = $this->product('RA-RATING-7');

        $this->review($page, $product->id, 'Tayang', 5);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $product->id,
            'customer_name' => 'Menunggu moderasi',
            'message' => 'Belum tayang',
            'rating' => 1,
            'source' => 'website',
            'published' => true,
            'moderation_status' => 'pending',
            'sort_order' => 0,
        ]);

        $this->get(route('reviews.website'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $assert) => $assert
                ->has('ratingNav', 1)
                ->where('ratingNav.0.value', '5')
                ->where('ratingNav.0.count', 1));
    }
}
