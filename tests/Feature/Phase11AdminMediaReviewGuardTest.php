<?php

namespace Tests\Feature;

use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\User;
use App\Support\InstallationPageSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class Phase11AdminMediaReviewGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_update_cannot_change_customer_review_content(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $page = CmsPage::firstOrCreate(['slug' => 'testimoni'], ['title' => 'Testimoni', 'content' => [], 'published' => true]);
        $review = CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'author_type' => 'customer',
            'moderation_status' => 'approved',
            'customer_name' => 'Ibu Asli',
            'message' => 'Teks asli dari pelanggan.',
            'rating' => 4,
            'source' => 'website',
            'published' => true,
        ]);

        $this->actingAs($admin)->put(route('admin.testimonials.update', $review), [
            'customer_name' => 'Nama Ubahan',
            'message' => 'Teks yang ingin diubah admin.',
            'rating' => 1,
            'source' => 'website',
        ])->assertRedirect();

        $fresh = $review->fresh();
        $this->assertSame('Teks asli dari pelanggan.', $fresh->message);
        $this->assertSame(4, $fresh->rating);
        $this->assertSame('Ibu Asli', $fresh->customer_name);
        $this->assertDatabaseHas('event_logs', ['event_type' => 'cms.testimonial_updated']);
    }

    public function test_admin_can_add_media_to_an_existing_review(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $page = CmsPage::firstOrCreate(['slug' => 'testimoni'], ['title' => 'Testimoni', 'content' => [], 'published' => true]);
        $review = CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'author_type' => 'customer',
            'moderation_status' => 'approved',
            'customer_name' => 'Pak Joko',
            'message' => 'Sudah terpasang.',
            'rating' => 5,
            'source' => 'website',
            'published' => true,
            'media_items' => [['type' => 'image', 'url' => 'https://cdn.example.test/hasil-1.jpg', 'source' => 'customer']],
        ]);

        $this->actingAs($admin)->post(route('admin.testimonials.media', $review), [
            'media_url' => 'https://cdn.example.test/hasil-admin.jpg',
            'media_type' => 'image',
            'media_source' => 'admin',
        ])->assertRedirect();

        $items = $review->fresh()->mediaPayload();
        $this->assertCount(2, $items);
        $this->assertTrue(collect($items)->contains('url', 'https://cdn.example.test/hasil-admin.jpg'));
        $this->assertSame('admin', collect($items)->firstWhere('url', 'https://cdn.example.test/hasil-admin.jpg')['source']);
    }

    public function test_product_page_upload_is_scoped_to_that_product_only(): void
    {
        Storage::fake('media');
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $a = $this->product('SCOPE-MEDIA-A');
        $b = $this->product('SCOPE-MEDIA-B');

        $this->actingAs($admin)->post(route('admin.products.media.store', $a), [
            'kind' => 'image',
            'position' => 1,
            'is_main_image' => true,
            'show_in_catalog' => true,
            'is_installation' => false,
            'visibility' => 'visible',
            'upload' => UploadedFile::fake()->image('hasil-produk-a.jpg'),
        ])->assertRedirect();

        $this->assertSame(1, ProductMedia::where('product_id', $a->id)->count());
        $this->assertSame(0, ProductMedia::where('product_id', $b->id)->count());
    }

    public function test_installation_gallery_is_manageable_independently_from_product_media(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)->post(route('admin.gallery-items.store'), [
            'image_url' => 'https://cdn.example.test/hasil-pemasangan-1.jpg',
            'label' => 'Pasang jendela rumah Bapak Tono',
            'published' => false,
        ])->assertRedirect();

        $item = CmsGalleryItem::query()->firstOrFail();
        $this->assertSame(InstallationPageSettings::pageId(), (int) $item->cms_page_id);
        $this->assertFalse((bool) $item->published);
        $this->assertSame(0, ProductMedia::count());

        $this->actingAs($admin)->post(route('admin.gallery-items.publish', $item))->assertRedirect();
        $this->assertTrue((bool) $item->fresh()->published);
    }

    private function product(string $sku): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => 'Produk '.$sku,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    /**
     * @return array{0:Order,1:Product}
     */

}
