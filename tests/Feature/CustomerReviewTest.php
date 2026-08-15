<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_create_one_verified_review_for_delivered_order(): void
    {
        [$order, $product] = $this->orderWithProduct('delivered', 'RA-REVIEW-001');

        $response = $this->postJson(route('order.review.store', $order->order_number), [
            'customer_phone' => '081234567890',
            'product_id' => $product->id,
            'rating' => 5,
            'message' => 'Produknya rapi dan sesuai pesanan.',
            'media_items' => [['type' => 'image', 'url' => 'https://cdn.example.test/review.jpg']],
        ]);

        $response->assertCreated()
            ->assertJsonPath('review.moderation_status', 'pending')
            ->assertJsonPath('review.verified_purchase', true);

        $this->assertDatabaseHas('cms_testimonials', [
            'order_id' => $order->id,
            'author_type' => 'customer',
            'moderation_status' => 'pending',
            'published' => 0,
            'rating' => 5,
        ]);
        $this->assertDatabaseHas('event_logs', [
            'event_type' => 'cms.testimonial_customer_created',
            'entity_type' => 'cms_testimonial',
            'source' => 'customer',
        ]);

        $this->postJson(route('order.review.store', $order->order_number), [
            'customer_phone' => '081234567890',
            'rating' => 4,
            'message' => 'Duplikat.',
        ])->assertStatus(422)->assertJsonValidationErrors('order');
    }

    public function test_review_requires_matching_phone_and_delivered_or_completed_order(): void
    {
        [$order] = $this->orderWithProduct('shipped', 'RA-REVIEW-002');

        $this->postJson(route('order.review.store', $order->order_number), [
            'customer_phone' => '081234567890',
            'rating' => 5,
            'message' => 'Belum sampai.',
        ])->assertStatus(422);

        $this->postJson(route('order.review.store', $order->order_number), [
            'customer_phone' => '089999999999',
            'rating' => 5,
            'message' => 'Nomor salah.',
        ])->assertNotFound();
    }

    public function test_customer_can_edit_own_review_and_admin_authored_review_is_not_customer_editable(): void
    {
        [$order, $product] = $this->orderWithProduct('completed', 'RA-REVIEW-003');

        $created = $this->postJson(route('order.review.store', $order->order_number), [
            'customer_phone' => '081234567890',
            'product_id' => $product->id,
            'rating' => 4,
            'message' => 'Versi awal.',
        ])->assertCreated();

        $review = CmsTestimonial::query()->findOrFail($created->json('review.id'));

        $this->putJson(route('order.review.update', [$order->order_number, $review]), [
            'customer_phone' => '081234567890',
            'rating' => 5,
            'message' => 'Versi yang diperbarui.',
            'media_items' => [],
        ])->assertOk()->assertJsonPath('review.moderation_status', 'pending');

        $this->assertSame('Versi yang diperbarui.', $review->fresh()->message);
        $this->assertFalse((bool) $review->fresh()->published);
        $this->assertDatabaseHas('event_logs', [
            'event_type' => 'cms.testimonial_customer_updated',
            'entity_id' => $review->id,
            'source' => 'customer',
        ]);

        $other = $this->orderWithProduct('completed', 'RA-REVIEW-004')[0];
        $adminReview = CmsTestimonial::create([
            'cms_page_id' => CmsPage::query()->where('slug', 'testimoni')->value('id') ?: CmsPage::create(['slug' => 'testimoni', 'title' => 'Testimoni', 'content' => [], 'published' => true])->id,
            'order_id' => $other->id,
            'author_type' => 'admin',
            'moderation_status' => 'approved',
            'customer_name' => $other->customer_name,
            'message' => 'Dicatat admin.',
            'rating' => 5,
            'source' => 'website',
            'published' => true,
            'verified_at' => now(),
        ]);

        $this->putJson(route('order.review.update', [$other->order_number, $adminReview]), [
            'customer_phone' => '081234567890',
            'rating' => 1,
            'message' => 'Tidak boleh.',
        ])->assertForbidden();

        $this->assertSame('Dicatat admin.', $adminReview->fresh()->message);
    }

    public function test_review_text_rating_and_media_are_validated(): void
    {
        [$order] = $this->orderWithProduct('delivered', 'RA-REVIEW-005');

        $this->postJson(route('order.review.store', $order->order_number), [
            'customer_phone' => '081234567890',
            'rating' => 6,
            'message' => 'x',
            'media_items' => [['type' => 'audio', 'url' => 'not-a-url']],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['rating', 'message', 'media_items.0.type', 'media_items.0.url']);
    }

    /**
     * @return array{0:Order,1:Product}
     */
    private function orderWithProduct(string $status, string $number): array
    {
        CmsPage::firstOrCreate(['slug' => 'testimoni'], ['title' => 'Testimoni', 'content' => [], 'published' => true]);

        $product = Product::create([
            'parent_sku' => 'WIN-'.str_replace('-', '', $number),
            'name' => 'Produk Ulasan',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        $order = Order::create([
            'order_number' => $number,
            'customer_name' => 'Pembeli Ulasan',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Uji 1',
            'shipping_city' => 'Kudus',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '59311',
            'order_status' => $status,
            'payment_status' => 'paid',
            'shipping_status' => $status === 'completed' ? 'delivered' : $status,
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'unit_price' => 1000000,
            'quantity' => 1,
            'line_subtotal' => 1000000,
            'line_discount' => 0,
            'line_total' => 1000000,
        ]);

        return [$order, $product];
    }
}
