<?php

namespace Tests\Feature;

use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class ProductReviewsTest extends TestCase
{
    use RefreshDatabase;

    public function test_pdp_includes_only_published_reviews_for_that_product(): void
    {
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-REV-1',
            'name' => 'Window With Reviews',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $other = Product::create([
            'parent_sku' => 'WIN-REV-2',
            'name' => 'Other Window',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $product->id,
            'customer_name' => 'Budi',
            'message' => 'Bagus, packing rapi.',
            'rating' => 5,
            'source' => 'website',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $product->id,
            'customer_name' => 'Draft',
            'message' => 'Should not show',
            'source' => 'website',
            'published' => false,
            'sort_order' => 1,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $product->id,
            'customer_name' => 'Shopee Only',
            'message' => 'PDP ignores marketplace source',
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 2,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $other->id,
            'customer_name' => 'Ani',
            'message' => 'For other SKU',
            'source' => 'website',
            'published' => true,
            'sort_order' => 0,
        ]);

        $this->get(route('product.show', 'WIN-REV-1'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ProductDetail')
                ->has('reviews', 1)
                ->where('reviews.0.customer_name', 'Budi')
                ->where('reviews.0.source', 'website')
            );
    }

    public function test_reviews_page_lists_general_and_product_linked(): void
    {
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-REV-3',
            'name' => 'Linked',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => null,
            'customer_name' => 'Umum',
            'message' => 'Toko bagus',
            'image_url' => 'https://cdn.example.com/umum.jpg',
            'source' => 'whatsapp',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $product->id,
            'customer_name' => 'Linked',
            'message' => 'Produk bagus',
            'image_url' => 'https://cdn.example.com/linked.jpg',
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 1,
        ]);

        $this->get(route('reviews'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('marketplaceTestimonials', 2)
                ->missing('websiteTestimonials')
                ->has('pageMeta')
                ->where('pageMeta.heading', 'Apa kata pelanggan kami')
                ->missing('installationMeta')
                ->has('installationsHref')
            );
    }

    public function test_reviews_page_uses_cms_testimoni_meta(): void
    {
        CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Custom Title',
            'content' => [
                'heading' => 'Heading custom dari CMS.',
                'subtitle' => 'Subtitle custom.',
            ],
            'published' => true,
        ]);

        $this->get(route('reviews'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->where('pageMeta.heading', 'Heading custom dari CMS.')
                ->where('pageMeta.subtitle', 'Subtitle custom.')
                ->where('pageMeta.title', 'Custom Title')
            );
    }

    public function test_reviews_page_lists_gallery_installations_and_meta(): void
    {
        CmsPage::create([
            'slug' => 'hasil-pemasangan',
            'title' => 'Hasil',
            'content' => [
                'heading' => 'Galeri pemasangan custom.',
                'subtitle' => 'Subtitle gallery.',
            ],
            'published' => true,
        ]);

        $page = CmsPage::query()->where('slug', 'hasil-pemasangan')->firstOrFail();

        CmsGalleryItem::create([
            'cms_page_id' => $page->id,
            'image_url' => 'https://cdn.example.com/g1.jpg',
            'label' => 'Rumah Kudus',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsGalleryItem::create([
            'cms_page_id' => $page->id,
            'image_url' => 'https://cdn.example.com/g2.jpg',
            'label' => 'Draft',
            'published' => false,
            'sort_order' => 1,
        ]);

        $this->get(route('reviews'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->missing('installations')
                ->missing('installationMeta')
                ->has('installationsHref')
            );

        $this->get(route('installation.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Installations')
                ->where('level', 'model')
                ->has('installations')
                ->where('pageMeta.heading', 'Galeri pemasangan custom.')
                ->where('pageMeta.subtitle', 'Subtitle gallery.')
            );

        $this->get(route('installation.model', ['category' => 'lainnya', 'model' => 'manual']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Installations')
                ->where('level', 'product')
                ->has('installations', 1)
                ->where('installations.0.label', 'Rumah Kudus')
            );
    }

    public function test_reviews_page_returns_marketplace_screenshots_only(): void
    {
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Shopee User',
            'message' => 'Dari Shopee',
            'image_url' => 'https://cdn.example.com/shopee.jpg',
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'WA User',
            'message' => 'Dari WhatsApp',
            'image_url' => 'https://cdn.example.com/wa.jpg',
            'source' => 'whatsapp',
            'published' => true,
            'sort_order' => 1,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Web User',
            'message' => 'Dari website',
            'source' => 'website',
            'published' => true,
            'sort_order' => 2,
        ]);

        // /reviews kini murni galeri screenshot marketplace/WA; query ?source= diabaikan.
        $this->get(route('reviews', ['source' => 'marketplace']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('marketplaceTestimonials', 2)
                ->where('testimonialMode', 'marketplace')
                ->missing('websiteTestimonials')
                ->missing('stats')
                ->has('pageMeta')
                ->has('installationsHref')
            );

        $this->get(route('reviews'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('marketplaceTestimonials', 2)
                ->where('testimonialMode', 'marketplace')
                ->missing('websiteTestimonials')
            );
    }

    public function test_reviews_page_falls_back_to_published_website_reviews_with_images(): void
    {
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Web User',
            'message' => 'Ulasan dari website',
            'image_url' => 'https://cdn.example.com/review.jpg',
            'source' => 'website',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Web Tanpa Foto',
            'message' => 'Belum punya foto',
            'source' => 'website',
            'published' => true,
            'sort_order' => 1,
        ]);

        $this->get(route('reviews'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('marketplaceTestimonials', 1)
                ->where('marketplaceTestimonials.0.customer_name', 'Web User')
                ->where('testimonialMode', 'website_fallback')
            );
    }

    public function test_ulasan_page_returns_website_reviews_only(): void
    {
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Shopee User',
            'message' => 'Dari Shopee',
            'image_url' => 'https://cdn.example.com/shopee.jpg',
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Web User',
            'message' => 'Dari website',
            'rating' => 5,
            'source' => 'website',
            'published' => true,
            'sort_order' => 1,
        ]);

        $this->get(route('ulasan'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Ulasan')
                ->has('websiteTestimonials', 1)
                ->where('websiteTestimonials.0.customer_name', 'Web User')
                ->where('stats.website_total', 1)
                ->where('stats.average_rating', 5)
                ->where('activeSort', 'newest')
                ->has('installationsHref')
            );

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Web Draft',
            'message' => 'Belum terbit',
            'rating' => 1,
            'source' => 'website',
            'published' => false,
            'sort_order' => 2,
        ]);

        // Ulasan draft tidak ikut terhitung di stats maupun daftar.
        $this->get(route('ulasan', ['sort' => 'rating_asc']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Ulasan')
                ->has('websiteTestimonials', 1)
                ->where('stats.website_total', 1)
                ->where('activeSort', 'rating_asc')
            );
    }

    public function test_home_splits_marketplace_and_website_testimonials(): void
    {
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'SS Shopee',
            'message' => null,
            'image_url' => 'https://cdn.example.com/ss.jpg',
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Web Buyer',
            'message' => 'Order via website bagus',
            'source' => 'website',
            'published' => true,
            'sort_order' => 1,
        ]);

        // Di bawah 10 ulasan website → section belum ikut di props beranda.
        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Home')
                ->has('marketplaceTestimonials', 1)
                ->has('websiteTestimonials', 0)
                ->where('marketplaceTestimonials.0.customer_name', 'SS Shopee')
            );

        for ($i = 2; $i <= 10; $i++) {
            CmsTestimonial::create([
                'cms_page_id' => $page->id,
                'customer_name' => "Web Buyer {$i}",
                'message' => "Ulasan website {$i}",
                'source' => 'website',
                'published' => true,
                'sort_order' => $i,
            ]);
        }

        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Home')
                ->has('websiteTestimonials', 10)
            );
    }
}

