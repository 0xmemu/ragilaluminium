<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\User;
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
}
