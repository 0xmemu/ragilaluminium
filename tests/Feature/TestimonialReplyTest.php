<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\WhatsAppMessage;
use App\Models\WhatsAppTemplate;
use App\Support\PhoneNumber;
use App\Support\WhatsAppAutomationCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Balasan admin atas ulasan pelanggan (owner 2026-09-18).
 *
 * Balasan hidup di baris ulasan yang sama, tidak pernah menimpa teks pelanggan,
 * dan tidak mengubah status tayang ulasan.
 */
class TestimonialReplyTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    /** Slug cms_pages unik, jadi halaman testimoni dibuat sekali lalu dipakai ulang. */
    private function page(): CmsPage
    {
        return CmsPage::firstOrCreate(
            ['slug' => 'testimoni'],
            ['title' => 'Testimoni', 'content' => [], 'published' => true],
        );
    }

    private function review(array $overrides = []): CmsTestimonial
    {
        return CmsTestimonial::create(array_merge([
            'cms_page_id' => $this->page()->id,
            'customer_name' => 'Budi Santoso',
            'message' => 'Kualitas bagus, pemasangan rapi.',
            'rating' => 5,
            'source' => 'website',
            'author_type' => 'customer',
            'moderation_status' => 'approved',
            'published' => true,
            'sort_order' => 0,
        ], $overrides));
    }

    public function test_admin_can_reply_to_customer_review(): void
    {
        $admin = $this->admin();
        $review = $this->review();

        $this->actingAs($admin)
            ->post(route('admin.testimonials.reply', $review), [
                'admin_reply' => 'Terima kasih Kak Budi, senang mendengarnya!',
            ])
            ->assertRedirect();

        $fresh = $review->fresh();
        $this->assertSame('Terima kasih Kak Budi, senang mendengarnya!', $fresh->admin_reply);
        $this->assertNotNull($fresh->admin_replied_at);
        $this->assertSame($admin->id, $fresh->admin_reply_admin_id);
        $this->assertTrue($fresh->hasAdminReply());

        $this->assertDatabaseHas('event_logs', [
            'event_type' => 'cms.testimonial_replied',
            'entity_type' => 'cms_testimonial',
            'entity_id' => $review->id,
        ]);
    }

    public function test_reply_reaches_public_reviews_payload(): void
    {
        $admin = $this->admin();
        $review = $this->review();

        $this->actingAs($admin)->post(route('admin.testimonials.reply', $review), [
            'admin_reply' => 'Terima kasih atas ulasannya.',
        ]);

        $this->get(route('reviews.website'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Reviews')
                ->where('testimonials.data.0.admin_reply', 'Terima kasih atas ulasannya.')
                ->where('testimonials.data.0.admin_replied_at', fn ($value) => is_string($value) && $value !== ''));
    }

    public function test_admin_can_update_existing_reply(): void
    {
        $admin = $this->admin();
        $review = $this->review(['admin_reply' => 'Balasan lama', 'admin_replied_at' => now()]);

        $this->actingAs($admin)->post(route('admin.testimonials.reply', $review), [
            'admin_reply' => 'Balasan baru yang sudah diperbaiki.',
        ])->assertRedirect();

        $this->assertSame('Balasan baru yang sudah diperbaiki.', $review->fresh()->admin_reply);
    }

    public function test_admin_can_delete_reply_without_deleting_review(): void
    {
        $admin = $this->admin();
        $review = $this->review([
            'admin_reply' => 'Balasan yang akan dihapus',
            'admin_replied_at' => now(),
            'admin_reply_admin_id' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->delete(route('admin.testimonials.reply.destroy', $review))
            ->assertRedirect();

        $fresh = $review->fresh();
        $this->assertNull($fresh->admin_reply);
        $this->assertNull($fresh->admin_replied_at);
        $this->assertNull($fresh->admin_reply_admin_id);
        $this->assertFalse($fresh->hasAdminReply());

        $this->assertDatabaseHas('cms_testimonials', [
            'id' => $review->id,
            'message' => 'Kualitas bagus, pemasangan rapi.',
        ]);
        $this->assertDatabaseHas('event_logs', [
            'event_type' => 'cms.testimonial_reply_deleted',
            'entity_id' => $review->id,
        ]);

        $this->get(route('reviews.website'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('testimonials.data.0.admin_reply', null));
    }

    public function test_reply_validation_rejects_empty_and_overlong_text(): void
    {
        $admin = $this->admin();
        $review = $this->review();

        $this->actingAs($admin)
            ->post(route('admin.testimonials.reply', $review), ['admin_reply' => ''])
            ->assertSessionHasErrors('admin_reply');

        $this->actingAs($admin)
            ->post(route('admin.testimonials.reply', $review), ['admin_reply' => str_repeat('a', 1001)])
            ->assertSessionHasErrors('admin_reply');

        $this->assertNull($review->fresh()->admin_reply);
    }

    public function test_reply_does_not_change_publish_or_moderation_state(): void
    {
        $admin = $this->admin();
        $review = $this->review([
            'moderation_status' => 'pending',
            'published' => false,
        ]);

        $this->actingAs($admin)->post(route('admin.testimonials.reply', $review), [
            'admin_reply' => 'Balasan untuk ulasan yang belum disetujui.',
        ])->assertRedirect();

        $fresh = $review->fresh();
        $this->assertSame('pending', $fresh->moderation_status);
        $this->assertFalse((bool) $fresh->published);
        $this->assertSame('Balasan untuk ulasan yang belum disetujui.', $fresh->admin_reply);

        $this->get(route('reviews.website'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('testimonials.data', 0));
    }

    public function test_marketplace_review_cannot_be_replied(): void
    {
        $admin = $this->admin();
        $review = $this->review([
            'source' => 'shopee',
            'message' => null,
            'image_url' => 'https://cdn.example.com/shopee.jpg',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.reply', $review), ['admin_reply' => 'Coba balas'])
            ->assertSessionHas('error');

        $this->assertNull($review->fresh()->admin_reply);
    }

    public function test_reply_filter_narrows_the_admin_list(): void
    {
        $admin = $this->admin();
        $this->review(['customer_name' => 'Sudah Dibalas', 'admin_reply' => 'Terima kasih', 'admin_replied_at' => now()]);
        $this->review(['customer_name' => 'Belum Dibalas']);

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'website', 'reply' => 'unreplied']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 1)
                ->where('rows.0.customer_name', 'Belum Dibalas')
                ->where('filters.reply', 'unreplied'));

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'website', 'reply' => 'replied']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 1)
                ->where('rows.0.customer_name', 'Sudah Dibalas'));
    }

    public function test_admin_rows_expose_reply_fields(): void
    {
        $admin = $this->admin();
        $this->review(['admin_reply' => 'Balasan tampil di tabel', 'admin_replied_at' => now()]);

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'website']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('rows.0.has_reply', true)
                ->where('rows.0.can_reply', true)
                ->where('rows.0.admin_reply', 'Balasan tampil di tabel')
                ->has('rows.0.reply_url')
                ->has('rows.0.destroy_reply_url')
                ->has('replyOptions', 3));
    }

    public function test_guest_cannot_reply(): void
    {
        $review = $this->review();

        $this->post(route('admin.testimonials.reply', $review), [
            'admin_reply' => 'Percobaan tanpa login',
        ])->assertRedirect(route('login'));

        $this->assertNull($review->fresh()->admin_reply);
    }

    /**
     * Template WA balasan ulasan dibuat dari katalog, sama seperti halaman
     * WhatsApp Otomatis membuatnya (body_preview = naskah default).
     */
    private function reviewTemplate(): WhatsAppTemplate
    {
        $trigger = WhatsAppAutomationCatalog::find('review_replied');
        $this->assertNotNull($trigger);

        return WhatsAppTemplate::create([
            'internal_key' => 'review_replied',
            'provider_template_name' => $trigger['default_provider_name'],
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'active',
            'description' => $trigger['description'],
            'body_preview' => $trigger['default_body'],
        ]);
    }

    /** Pesanan pelanggan yang dipakai sebagai sumber nomor WhatsApp. */
    private function order(string $phone = '6285711122233'): Order
    {
        return Order::create([
            'order_number' => 'RA-260921-'.substr(md5($phone.microtime(true)), 0, 6),
            'customer_name' => 'Budi Santoso',
            'customer_phone' => $phone,
            'shipping_address_line1' => 'Jl Aluminium 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'completed',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
    }

    private function product(): Product
    {
        return Product::create([
            'parent_sku' => 'RV-REV-1',
            'name' => 'Jendela Aluminium Sliding',
            'short_name' => '200x180',
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'description' => 'Produk uji WA balasan ulasan.',
            'status' => 'active',
        ]);
    }

    public function test_reply_sends_review_replied_whatsapp_for_linked_review(): void
    {
        $this->reviewTemplate();

        $admin = $this->admin();
        $order = $this->order();
        $product = $this->product();
        $review = $this->review([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'customer_name' => 'Budi Santoso',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.reply', $review), [
                'admin_reply' => 'Terima kasih Kak Budi, senang ulasannya membantu.',
            ])
            ->assertRedirect();

        $message = WhatsAppMessage::query()
            ->where('internal_template_key', 'review_replied')
            ->where('order_id', $order->id)
            ->first();

        $this->assertNotNull($message);
        $this->assertSame(
            PhoneNumber::normalize('6285711122233'),
            $message->phone_number,
        );
        // Gateway tidak dikonfigurasi di lingkungan test (mode degradasi),
        // jadi yang diuji adalah isi naskah tercatat, bukan status terkirim.
        $this->assertContains($message->status, ['pending', 'sent', 'failed']);
        $this->assertStringContainsString('Budi Santoso', $message->content_text);
        // Owner 2026-09-21: naskah review_replied memakai nomor order, bukan
        // nama produk; token varian dan nama produk dihapus dari naskah.
        $this->assertStringContainsString((string) $order->order_number, $message->content_text);
        $this->assertStringNotContainsString('Jendela Aluminium Sliding', $message->content_text);
        $this->assertStringContainsString(
            'Terima kasih Kak Budi, senang ulasannya membantu.',
            $message->content_text,
        );
        $this->assertStringNotContainsString('{{1}}', $message->content_text);
        $this->assertStringNotContainsString('{{2}}', $message->content_text);
        $this->assertStringNotContainsString('{{3}}', $message->content_text);
    }

    public function test_reply_without_linked_order_sends_nothing_and_still_succeeds(): void
    {
        $this->reviewTemplate();

        $admin = $this->admin();
        $product = $this->product();
        $review = $this->review([
            'order_id' => null,
            'product_id' => $product->id,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.reply', $review), [
                'admin_reply' => 'Terima kasih atas ulasannya.',
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame('Terima kasih atas ulasannya.', $review->fresh()->admin_reply);
        $this->assertSame(
            0,
            WhatsAppMessage::query()->where('internal_template_key', 'review_replied')->count(),
        );
    }

    public function test_editing_existing_reply_does_not_send_second_whatsapp(): void
    {
        $this->reviewTemplate();

        $admin = $this->admin();
        $order = $this->order();
        $review = $this->review(['order_id' => $order->id]);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.reply', $review), [
                'admin_reply' => 'Balasan pertama.',
            ])
            ->assertRedirect();

        $this->assertSame(
            1,
            WhatsAppMessage::query()->where('internal_template_key', 'review_replied')->count(),
        );

        $this->actingAs($admin)
            ->post(route('admin.testimonials.reply', $review), [
                'admin_reply' => 'Balasan pertama yang sudah diperbaiki.',
            ])
            ->assertRedirect();

        $this->assertSame('Balasan pertama yang sudah diperbaiki.', $review->fresh()->admin_reply);
        $this->assertSame(
            1,
            WhatsAppMessage::query()->where('internal_template_key', 'review_replied')->count(),
        );
    }
}
