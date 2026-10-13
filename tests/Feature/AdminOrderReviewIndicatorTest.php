<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Penanda ulasan pelanggan baru di daftar pesanan admin (owner 2026-09-21):
 * tombol Balas ulasan di kolom Aksi, dan titik notifikasi di tab status.
 *
 * Definisi "menunggu balasan" ada di scope CmsTestimonial::awaitingReply, dan
 * test ini menguncinya supaya tombol serta titik notifikasi tidak pernah muncul
 * untuk ulasan yang memang tidak bisa dibalas.
 */
class AdminOrderReviewIndicatorTest extends TestCase
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

    private function order(string $status = 'completed', string $number = 'RA-IND-1'): Order
    {
        return Order::create([
            'order_number' => $number,
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Uji 1',
            'shipping_city' => 'Kudus',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '59311',
            'order_status' => $status,
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
    }

    private function review(Order $order, array $overrides = []): CmsTestimonial
    {
        return CmsTestimonial::create(array_merge([
            'cms_page_id' => $this->page()->id,
            'order_id' => $order->id,
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

    /** Ambil satu baris pesanan dari payload, supaya tidak peka urutan. */
    private function row(Assert $page, string $orderNumber): array
    {
        $orders = $page->toArray()['props']['orders'];
        foreach ($orders as $row) {
            if (($row['order_number'] ?? null) === $orderNumber) {
                return $row;
            }
        }
        $this->fail("Pesanan {$orderNumber} tidak ada di payload daftar.");
    }

    public function test_pesanan_dengan_ulasan_belum_dibalas_menandai_perlu_dibalas(): void
    {
        $admin = $this->admin();
        $order = $this->order();
        $this->review($order);

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['order_status' => 'completed']))
            ->assertOk()
            ->assertInertia(function (Assert $page) {
                $row = $this->row($page, 'RA-IND-1');
                $this->assertNotNull($row['review']);
                $this->assertTrue($row['review']['awaiting_reply']);
                $this->assertFalse($row['review']['has_reply']);
                $this->assertTrue($row['review']['can_reply']);
                $this->assertArrayHasKey('reply_url', $row['review']);
            });
    }

    public function test_ulasan_yang_sudah_dibalas_tidak_lagi_ditandai(): void
    {
        $admin = $this->admin();
        $order = $this->order();
        $this->review($order, ['admin_reply' => 'Terima kasih Kak.', 'admin_replied_at' => now()]);

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['order_status' => 'completed']))
            ->assertOk()
            ->assertInertia(function (Assert $page) {
                $row = $this->row($page, 'RA-IND-1');
                $this->assertTrue($row['review']['has_reply']);
                $this->assertFalse($row['review']['awaiting_reply']);
            });
    }

    public function test_pesanan_tanpa_ulasan_tidak_punya_data_ulasan(): void
    {
        $admin = $this->admin();
        $this->order();

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['order_status' => 'completed']))
            ->assertOk()
            ->assertInertia(function (Assert $page) {
                $this->assertNull($this->row($page, 'RA-IND-1')['review']);
            });
    }

    /**
     * Ulasan marketplace tidak punya teks dan endpoint balasan menolaknya.
     * Kalau ikut dihitung, titik notifikasinya tidak akan pernah bisa hilang.
     */
    public function test_ulasan_marketplace_tidak_ikut_ditandai(): void
    {
        $admin = $this->admin();
        $order = $this->order();
        $this->review($order, ['source' => 'shopee']);

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['order_status' => 'completed']))
            ->assertOk()
            ->assertInertia(function (Assert $page) {
                $row = $this->row($page, 'RA-IND-1');
                $this->assertNotNull($row['review']);
                $this->assertFalse($row['review']['can_reply']);
                $this->assertFalse($row['review']['awaiting_reply']);

                foreach ($page->toArray()['props']['tabs'] as $tab) {
                    $this->assertSame(0, $tab['awaiting_review_count']);
                }
            });
    }

    /** Ulasan buatan admin bukan tulisan pelanggan, jadi tidak dihitung. */
    public function test_ulasan_buatan_admin_tidak_ikut_ditandai(): void
    {
        $admin = $this->admin();
        $order = $this->order();
        $this->review($order, ['author_type' => 'admin']);

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['order_status' => 'completed']))
            ->assertOk()
            ->assertInertia(function (Assert $page) {
                $this->assertFalse($this->row($page, 'RA-IND-1')['review']['awaiting_reply']);
            });
    }

    public function test_hitungan_per_tab_hanya_menghitung_yang_belum_dibalas(): void
    {
        $admin = $this->admin();

        $belum = $this->order('completed', 'RA-IND-A');
        $this->review($belum);

        $sudah = $this->order('delivered', 'RA-IND-B');
        $this->review($sudah, ['admin_reply' => 'Sudah dibalas.', 'admin_replied_at' => now()]);

        $tanpaUlasan = $this->order('completed', 'RA-IND-C');
        $this->assertNotNull($tanpaUlasan);

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['order_status' => 'all']))
            ->assertOk()
            ->assertInertia(function (Assert $page) {
                $tabs = collect($page->toArray()['props']['tabs'])->keyBy('key');

                // completed: satu ulasan belum dibalas. delivered: sudah dibalas, jadi 0.
                $this->assertSame(1, $tabs['completed']['awaiting_review_count']);
                $this->assertSame(0, $tabs['delivered']['awaiting_review_count']);
                // Tab "all" menjumlahkan seluruh status.
                $this->assertSame(1, $tabs['all']['awaiting_review_count']);
            });
    }

    /**
     * Hitungan mengikuti STATUS PESANAN saat ini, bukan status saat ulasan
     * dibuat. Kalau pesanan dipindah kembali (mis. dari Selesai ke Diproses
     * karena ada masalah), penandanya ikut pindah ke tab status yang baru.
     */
    public function test_hitungan_mengikuti_status_pesanan_saat_ini(): void
    {
        $admin = $this->admin();
        $order = $this->order('processing', 'RA-IND-D');
        $this->review($order);

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['order_status' => 'all']))
            ->assertOk()
            ->assertInertia(function (Assert $page) {
                $tabs = collect($page->toArray()['props']['tabs'])->keyBy('key');
                $this->assertSame(1, $tabs['processing']['awaiting_review_count']);
                $this->assertSame(0, $tabs['completed']['awaiting_review_count']);
            });
    }
}
