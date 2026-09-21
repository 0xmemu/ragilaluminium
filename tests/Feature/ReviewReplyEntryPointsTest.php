<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Balas ulasan dari dua tempat (owner 2026-09-21):
 *
 * 1. daftar ulasan admin, lewat kolom Balasan;
 * 2. halaman detail pesanan admin, lewat tombol Balas yang muncul bila pesanan
 *    sudah diterima dan pelanggan sudah membuat ulasan.
 *
 * Keduanya memakai endpoint balasan yang sama dan komponen dialog yang sama.
 */
class ReviewReplyEntryPointsTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

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

    private function orderWith(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-REPLY-1',
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Uji 1',
            'shipping_city' => 'Kudus',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '59311',
            'order_status' => 'delivered',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ], $overrides));
    }

    /**
     * Tab Apa Kata Pelanggan tetap MENGIRIM field balasan, walaupun kolom
     * Balasan tidak lagi dirender di tab itu (lihat AdminTestimonialReplyColumnTest).
     *
     * Alasannya: aksi balas di tab itu masih tersedia lewat menu Lainnya, dan itu
     * satu-satunya jalan membalas untuk baris yang screenshot-nya belum ada
     * (kolom Screenshot menandainya "Belum ada screenshot", sedangkan field
     * can_reply tidak membedakannya).
     */
    public function test_tab_apa_kata_pelanggan_mengirim_field_balasan(): void
    {
        $admin = $this->admin();
        $this->review([
            'image_url' => 'https://cdn.example.test/ss.jpg',
            'admin_reply' => 'Balasan dari tab apa kata pelanggan',
            'admin_replied_at' => now(),
        ]);

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'eksternal']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tabs.1.label', 'Apa Kata Pelanggan')
                ->where('rows.0.has_reply', true)
                ->where('rows.0.can_reply', true)
                ->where('rows.0.admin_reply', 'Balasan dari tab apa kata pelanggan')
                ->has('rows.0.reply_url')
                ->has('rows.0.destroy_reply_url'));
    }

    /**
     * Nama tab diganti, tetapi KUNCI tab dan tautannya sengaja tetap
     * 'eksternal' supaya tautan lama dan filter yang tersimpan tidak pecah.
     */
    public function test_tautan_tab_lama_tetap_berfungsi_setelah_ganti_nama(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->get(route('admin.testimonials.index', ['tab' => 'eksternal']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tab', 'eksternal')
                ->has('tabs', 2));

        // Route alias lama tetap mengarah ke tab yang sama.
        $this->actingAs($admin)
            ->get(route('admin.apa-kata-pelanggan.index'))
            ->assertRedirect(route('admin.testimonials.index', ['tab' => 'eksternal']));
    }

    public function test_detail_pesanan_membawa_ulasan_pelanggan(): void
    {
        $admin = $this->admin();
        $order = $this->orderWith();
        $review = $this->review(['order_id' => $order->id, 'product_id' => null]);

        $this->actingAs($admin)
            ->get(route('admin.orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Orders/Show')
                ->where('order.testimonial.id', $review->id)
                ->where('order.testimonial.message', 'Kualitas bagus, pemasangan rapi.')
                ->where('order.testimonial.has_reply', false)
                ->where('order.testimonial.can_reply', true)
                ->has('order.testimonial.reply_url'));
    }

    public function test_detail_pesanan_tanpa_ulasan_tidak_membawa_data_ulasan(): void
    {
        $admin = $this->admin();
        $order = $this->orderWith(['order_number' => 'RA-REPLY-2']);

        $this->actingAs($admin)
            ->get(route('admin.orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('order.testimonial', null));
    }

    /**
     * Ulasan marketplace tetap tidak bisa dibalas (tanpa teks), jadi tombolnya
     * harus tetap tertutup meski payload membawa datanya.
     */
    public function test_ulasan_marketplace_tidak_bisa_dibalas(): void
    {
        $admin = $this->admin();
        $order = $this->orderWith(['order_number' => 'RA-REPLY-3']);
        $this->review(['order_id' => $order->id, 'source' => 'shopee']);

        $this->actingAs($admin)
            ->get(route('admin.orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('order.testimonial.can_reply', false));
    }

    /**
     * Halaman pesanan hanya menyediakan data; balasan tetap lewat endpoint yang
     * sama, dan test ini memastikan alurnya benar-benar tersimpan.
     */
    public function test_balasan_dari_detail_pesanan_tersimpan(): void
    {
        $admin = $this->admin();
        $order = $this->orderWith(['order_number' => 'RA-REPLY-4']);
        $review = $this->review(['order_id' => $order->id]);

        $this->actingAs($admin)
            ->post(route('admin.testimonials.reply', $review), [
                'admin_reply' => 'Terima kasih Kak, senang produknya cocok.',
            ])
            ->assertRedirect();

        $this->assertSame('Terima kasih Kak, senang produknya cocok.', $review->fresh()->admin_reply);

        $this->actingAs($admin)
            ->get(route('admin.orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('order.testimonial.has_reply', true)
                ->where('order.testimonial.admin_reply', 'Terima kasih Kak, senang produknya cocok.'));
    }

    /** Pesanan pada fixture ini butuh item agar halaman detailnya utuh. */
    private function orderItem(Order $order): void
    {
        $product = Product::create([
            'parent_sku' => 'WIN-REPLY',
            'name' => 'Produk Ulasan',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'unit_price' => 1000000,
            'quantity' => 1,
            'line_subtotal' => 1000000,
            'line_total' => 1000000,
        ]);
    }
}
