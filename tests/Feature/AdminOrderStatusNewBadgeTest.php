<?php

namespace Tests\Feature;

use App\Domain\Orders\OrderStateMachine;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Tes penanda badge merah di kanan atas tab filter status pesanan (kontrak owner 2026-09-26):
 * - Angka bertambah saat ada pesanan "baru" masuk ke status tersebut.
 * - Posisi di kanan atas tab.
 * - Sekadar melihat tab daftar tidak mengurangi/menghilangkan badge.
 * - Badge hanya hilang bila admin membuka detail pesanan terkait atau menindaklanjutinya.
 */
class AdminOrderStatusNewBadgeTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function createOrder(string $status = 'awaiting_confirmation', ?string $seenStatus = null, string $number = 'RA-TEST-1'): Order
    {
        return Order::create([
            'order_number' => $number,
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Uji 1',
            'shipping_city' => 'Kudus',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '59311',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'admin_seen_status' => $seenStatus,
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 500000,
            'shipping_amount' => 50000,
            'total_amount' => 550000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
    }

    public function test_pesanan_baru_dibuat_memunculkan_badge_merah_di_tab_statusnya_dan_tab_semua(): void
    {
        $admin = $this->admin();
        $this->createOrder('awaiting_confirmation', null, 'RA-NEW-1');

        $response = $this->actingAs($admin)->get(route('admin.orders.index'));

        $response->assertOk();
        $response->assertInertia(function (Assert $page) {
            $tabs = collect($page->toArray()['props']['tabs'])->keyBy('key');
            $this->assertSame(1, $tabs['awaiting_confirmation']['new_count']);
            $this->assertSame(0, $tabs['processing']['new_count']);
            $this->assertSame(0, $tabs['shipped']['new_count']);
            $this->assertSame(1, $tabs['all']['new_count']);
        });
    }

    public function test_hanya_melihat_tab_daftar_tidak_mengurangi_atau_menghilangkan_badge_merah(): void
    {
        $admin = $this->admin();
        $order = $this->createOrder('awaiting_confirmation', null, 'RA-NEW-2');

        // Buka tab status awaiting_confirmation
        $response = $this->actingAs($admin)->get(route('admin.orders.index', ['order_status' => 'awaiting_confirmation']));

        $response->assertOk();
        $response->assertInertia(function (Assert $page) {
            $tabs = collect($page->toArray()['props']['tabs'])->keyBy('key');
            $this->assertSame(1, $tabs['awaiting_confirmation']['new_count']);
            $this->assertSame(1, $tabs['all']['new_count']);
        });

        // admin_seen_status pada database tetap null
        $this->assertNull($order->fresh()->admin_seen_status);
    }

    public function test_membuka_detail_pesanan_menghilangkan_badge_merah_pada_status_terkait(): void
    {
        $admin = $this->admin();
        $order = $this->createOrder('awaiting_confirmation', null, 'RA-NEW-3');

        // Buka halaman detail pesanan
        $showResponse = $this->actingAs($admin)->get(route('admin.orders.show', $order));
        $showResponse->assertOk();

        // admin_seen_status pada database kini tercatat sesuai status saat ini
        $this->assertSame('awaiting_confirmation', $order->fresh()->admin_seen_status);

        // Kembali ke daftar pesanan: badge merah di awaiting_confirmation dan all kini 0
        $indexResponse = $this->actingAs($admin)->get(route('admin.orders.index'));
        $indexResponse->assertOk();
        $indexResponse->assertInertia(function (Assert $page) {
            $tabs = collect($page->toArray()['props']['tabs'])->keyBy('key');
            $this->assertSame(0, $tabs['awaiting_confirmation']['new_count']);
            $this->assertSame(0, $tabs['all']['new_count']);
        });
    }

    public function test_perubahan_status_pesanan_memunculkan_badge_merah_pada_tab_tujuan(): void
    {
        $admin = $this->admin();
        // Pesanan sudah pernah dilihat saat statusnya 'processing'
        $order = $this->createOrder('processing', 'processing', 'RA-TRANS-1');

        // Verifikasi awal: tidak ada badge merah di tab processing maupun shipped
        $this->actingAs($admin)->get(route('admin.orders.index'))
            ->assertInertia(function (Assert $page) {
                $tabs = collect($page->toArray()['props']['tabs'])->keyBy('key');
                $this->assertSame(0, $tabs['processing']['new_count']);
                $this->assertSame(0, $tabs['shipped']['new_count']);
                $this->assertSame(0, $tabs['all']['new_count']);
            });

        // Status pesanan berubah dari 'processing' menjadi 'shipped' (misalnya via StateMachine)
        app(OrderStateMachine::class)->transition($order, 'shipped', $admin->id, 'admin_test');

        // Pesanan kini berstatus 'shipped', tetapi admin_seen_status masih 'processing'
        $orderFresh = $order->fresh();
        $this->assertSame('shipped', $orderFresh->order_status);
        $this->assertSame('processing', $orderFresh->admin_seen_status);

        // Tab 'shipped' kini memiliki badge merah 1, tab 'processing' tetap 0
        $this->actingAs($admin)->get(route('admin.orders.index'))
            ->assertInertia(function (Assert $page) {
                $tabs = collect($page->toArray()['props']['tabs'])->keyBy('key');
                $this->assertSame(1, $tabs['shipped']['new_count']);
                $this->assertSame(0, $tabs['processing']['new_count']);
                $this->assertSame(1, $tabs['all']['new_count']);
            });

        // Saat admin membuka detail pesanan yang baru dikirim tersebut:
        $this->actingAs($admin)->get(route('admin.orders.show', $orderFresh))->assertOk();
        $this->assertSame('shipped', $orderFresh->fresh()->admin_seen_status);

        // Badge merah pada tab 'shipped' hilang kembali menjadi 0
        $this->actingAs($admin)->get(route('admin.orders.index'))
            ->assertInertia(function (Assert $page) {
                $tabs = collect($page->toArray()['props']['tabs'])->keyBy('key');
                $this->assertSame(0, $tabs['shipped']['new_count']);
                $this->assertSame(0, $tabs['all']['new_count']);
            });
    }
}
