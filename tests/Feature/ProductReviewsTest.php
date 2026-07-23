<?php

namespace Tests\Feature;

use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;

class ProductReviewsTest extends \Tests\TestCase
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
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $product->id,
            'customer_name' => 'Draft',
            'message' => 'Should not show',
            'source' => 'whatsapp',
            'published' => false,
            'sort_order' => 1,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $other->id,
            'customer_name' => 'Ani',
            'message' => 'For other SKU',
            'source' => 'other',
            'published' => true,
            'sort_order' => 0,
        ]);

        $this->get(route('product.show', 'WIN-REV-1'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ProductDetail')
                ->has('reviews', 1)
                ->where('reviews.0.customer_name', 'Budi')
                ->where('reviews.0.source', 'shopee')
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
            'source' => 'whatsapp',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $product->id,
            'customer_name' => 'Linked',
            'message' => 'Produk bagus',
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 1,
        ]);

        $this->get(route('reviews'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials', 2)
                ->has('pageMeta')
                ->where('pageMeta.heading', 'Apa kata pelanggan kami.')
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
                ->has('installations', 1)
                ->where('installations.0.label', 'Rumah Kudus')
                ->where('installations.0.photo_count', 1)
                ->where('installations.0.video_count', 0)
                ->where('pageMeta.heading', 'Galeri pemasangan custom.')
                ->where('pageMeta.subtitle', 'Subtitle gallery.')
            );
    }

    public function test_reviews_page_filters_by_source_group(): void
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
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'WA User',
            'message' => 'Dari WhatsApp',
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

        $this->get(route('reviews', ['source' => 'marketplace']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials', 2)
                ->where('activeSource', 'marketplace')
                ->where('stats.total', 3)
            );

        $this->get(route('reviews', ['source' => 'website']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials', 1)
                ->where('testimonials.0.customer_name', 'Web User')
                ->where('activeSource', 'website')
            );
    }
}
