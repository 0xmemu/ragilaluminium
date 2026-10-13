<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Models\WhatsAppMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * B5 (audit admin 2026-09-23): halaman hub WhatsApp menyediakan daftar pesan
 * gagal (`failed_messages`) dan angka total pesan gagal (`failed_count`).
 *
 * Kontrak angka: `failed_count` = WhatsAppMessage::where('status','failed')
 * ->count() sepanjang waktu, sama persis dengan angka di dashboard admin.
 * Parameter rentang TIDAK boleh mengubah angka ini; yang boleh berubah oleh
 * rentang hanyalah statistik agregat lain (mis. `stats.failed`).
 */
class WhatsAppHubFailedMessagesTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function failedMessage(string $phone, ?int $orderId, string $status = 'failed'): WhatsAppMessage
    {
        return WhatsAppMessage::create([
            'phone_number' => $phone,
            'direction' => 'outbound',
            'status' => $status,
            'content_text' => 'Konfirmasi pesanan untuk '.$phone,
            'error_reason' => 'Gateway menolak nomor tujuan',
            'provider' => 'baileys',
            'order_id' => $orderId,
            'sent_at' => now(),
        ]);
    }

    public function test_hub_returns_failed_messages_and_failed_count(): void
    {
        $admin = $this->admin();

        $order = Order::create([
            'order_number' => 'RA-WA-FAIL-1',
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '6285725116817',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
        ]);

        $withOrder = $this->failedMessage('6285725116817', $order->id);
        $withoutOrder = $this->failedMessage('6289990001112', null);

        // Pesan sukses tidak boleh masuk daftar gagal.
        $this->failedMessage('6281112223334', null, 'sent');

        $this->actingAs($admin)
            ->get(route('admin.whatsapp.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/WhatsApp/Hub')
                ->where('failed_count', 2)
                ->has('failed_messages', 2)
                // Terbaru lebih dulu.
                ->where('failed_messages.0.id', $withoutOrder->id)
                ->where('failed_messages.0.status', 'failed')
                ->where('failed_messages.0.recipient', '6289990001112')
                ->where('failed_messages.0.order_number', null)
                ->where('failed_messages.0.order_url', null)
                ->where('failed_messages.0.message', 'Konfirmasi pesanan untuk 6289990001112')
                ->where('failed_messages.0.error', 'Gateway menolak nomor tujuan')
                ->where('failed_messages.1.id', $withOrder->id)
                ->where('failed_messages.1.order_number', 'RA-WA-FAIL-1')
                ->where('failed_messages.1.order_url', route('admin.orders.show', $order->id))
                ->etc()
            );
    }

    public function test_failed_count_is_not_affected_by_range_filter(): void
    {
        $admin = $this->admin();

        $this->failedMessage('6285725116817', null);

        $old = $this->failedMessage('6289990001112', null);
        $old->forceFill(['created_at' => now()->subDays(20)])->save();

        // Rentang pendek: statistik dalam rentang menyaring, angka total tidak.
        $this->actingAs($admin)
            ->get(route('admin.whatsapp.dashboard', ['range' => '24h']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.failed', 1)
                ->where('failed_count', 2)
                ->has('failed_messages', 2)
            );

        $this->actingAs($admin)
            ->get(route('admin.whatsapp.dashboard', ['range' => '30d']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('failed_count', 2)
                ->has('failed_messages', 2)
            );
    }

    public function test_failed_messages_list_is_limited_to_25_newest(): void
    {
        $admin = $this->admin();

        for ($i = 0; $i < 30; $i++) {
            $this->failedMessage('62899900011'.$i, null);
        }

        $newest = WhatsAppMessage::where('status', 'failed')->orderByDesc('id')->value('id');

        $this->actingAs($admin)
            ->get(route('admin.whatsapp.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('failed_count', 30)
                ->has('failed_messages', 25)
                ->where('failed_messages.0.id', $newest)
            );
    }
}
