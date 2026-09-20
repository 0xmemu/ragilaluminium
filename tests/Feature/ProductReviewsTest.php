<?php

namespace Tests\Feature;

use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Tests\Concerns\CreatesVisibleProducts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class ProductReviewsTest extends TestCase
{
    use CreatesVisibleProducts;
    use RefreshDatabase;

    public function test_pdp_includes_only_published_reviews_for_that_product(): void
    {
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        $product = $this->createVisibleProduct([
            'parent_sku' => 'WIN-REV-1',
            'name' => 'Window With Reviews',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $other = $this->createVisibleProduct([
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

        $product = $this->createVisibleProduct([
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

        $this->get(route('reviews.screenshots'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials.data', 2)
                ->has('testimonials.links')
                ->has('pageMeta')
                ->where('pageMeta.heading', 'Apa kata pelanggan kami')
                ->has('modelNav', 1)
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

        $this->get(route('reviews.screenshots'))
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

        $this->get(route('reviews.website'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->missing('installations')
                ->missing('installationMeta')
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

        // Halaman galeri screenshot (/reviews/ss): hanya ulasan ber-gambar.
        $this->get(route('reviews.screenshots'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials.data', 2)
                ->where('stats.website_total', 0)
                ->has('modelNav')
                ->has('pageMeta')
                ->has('installationsHref')
            );

        $this->get(route('reviews.screenshots'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials.data', 2)
                ->where('stats.website_total', 0)
            );
    }

    public function test_reviews_page_lists_published_website_reviews(): void
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

        $this->get(route('reviews.website'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials.data', 2)
                ->where('stats.website_total', 2)
            );
    }

    public function test_reviews_page_combines_website_and_marketplace_and_filters_by_model(): void
    {
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        $sliding = $this->createVisibleProduct(['product_model' => 'SLIDING']);
        $swing = $this->createVisibleProduct(['product_model' => 'SWING']);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $sliding->id,
            'customer_name' => 'Shopee User',
            'message' => 'Dari Shopee',
            'image_url' => 'https://cdn.example.com/shopee.jpg',
            'source' => 'shopee',
            'published' => true,
            'sort_order' => 0,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $sliding->id,
            'customer_name' => 'Web Sliding',
            'message' => 'Dari website',
            'rating' => 5,
            'source' => 'website',
            'published' => true,
            'sort_order' => 1,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $swing->id,
            'customer_name' => 'Web Swing',
            'message' => 'Dari website swing',
            'rating' => 4,
            'source' => 'website',
            'published' => true,
            'sort_order' => 2,
        ]);

        // Draft tidak terbit.
        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $swing->id,
            'customer_name' => 'Web Draft',
            'message' => 'Belum terbit',
            'rating' => 1,
            'source' => 'website',
            'published' => false,
            'sort_order' => 3,
        ]);

        // Halaman "Ulasan website" (/reviews/web): hanya ulasan website teks/rating.
        $this->get(route('reviews.website'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials.data', 2)
                ->where('stats.website_total', 2)
                ->where('stats.average_rating', 4.5)
            );

        // Filter model produk (web).
        $this->get(route('reviews.website', ['model' => 'WINDOW|SLIDING']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials.data', 1)
                ->where('activeModel', 'WINDOW|SLIDING')
            );

        // Slug lama /ulasan & /reviews di-redirect 301 ke /reviews/web.
        $this->get('/ulasan')->assertRedirect(route('reviews.website'));
        $this->get('/reviews')->assertRedirect(route('reviews.website'));
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
    public function test_kartu_ulasan_membawa_tanggal_label_model_dan_varian(): void
    {
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        $product = $this->createVisibleProduct([
            'parent_sku' => 'WIN-VAR-1',
            'name' => 'Jendela Aluminium Jungkit Ornamen',
            'short_name' => '200x180',
        ]);

        $order = Order::create([
            'order_number' => 'RA-REV-VAR-001',
            'customer_name' => 'Pelanggan Varian',
            'customer_phone' => '081200000009',
            'shipping_address_line1' => 'Jl Test Varian',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'delivered',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => 'WIN-VAR-1',
            'name' => 'Jendela Aluminium Jungkit Ornamen',
            'unit_price' => 100000,
            'quantity' => 1,
            'line_subtotal' => 100000,
            'line_total' => 100000,
            'variation_1_name' => 'Warna',
            'variation_1_option' => 'Putih',
            'variation_2_name' => 'Kaca',
            'variation_2_option' => 'Kaca Es',
        ]);

        $review = CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'product_id' => $product->id,
            'order_id' => $order->id,
            'customer_name' => 'Pelanggan Varian',
            'message' => 'Variannya persis seperti yang dipilih.',
            'rating' => 5,
            'source' => 'website',
            'location' => 'Semarang',
            'published' => true,
            'sort_order' => 0,
        ]);

        // `created_at` tidak ada di $fillable, jadi create() akan membuangnya
        // tanpa error. Diisi lewat forceFill supaya tanggalnya pasti terpasang.
        $review->forceFill(['created_at' => '2026-04-18 15:00:00'])->save();

        $this->get(route('reviews.website'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials.data', 1)
                ->where('testimonials.data.0.location', 'Semarang')
                ->where('testimonials.data.0.variant_label', 'Warna: Putih · Kaca: Kaca Es')
                // `name` tetap nama pendek demi konsumen lama; kartu ulasan
                // memakai `line`, label kategori + model + sub-model. Produk ini
                // dibuat tanpa override, jadi kategorinya WINDOW, model JUNGKIT,
                // dan sub-modelnya POLOS.
                ->where('testimonials.data.0.product.name', '200x180')
                ->where('testimonials.data.0.product.line', 'Jendela Jungkit Polos')
                ->missing('testimonials.data.0.product.full_name')
                ->where('testimonials.data.0.created_at', fn ($value) => is_string($value) && str_starts_with($value, '2026-04-18'))
            );
    }

    public function test_ulasan_tanpa_pesanan_tidak_membawa_varian(): void
    {
        $page = CmsPage::create([
            'slug' => 'testimoni',
            'title' => 'Testimoni',
            'content' => [],
            'published' => true,
        ]);

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Tanpa Pesanan',
            'message' => 'Ulasan lama yang tidak tertaut pesanan.',
            'rating' => 4,
            'source' => 'website',
            'published' => true,
            'sort_order' => 0,
        ]);

        $this->get(route('reviews.website'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Reviews')
                ->has('testimonials.data', 1)
                ->where('testimonials.data.0.variant_label', null)
                ->where('testimonials.data.0.product', null)
            );
    }
}

