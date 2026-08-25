<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminOrderNotesTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    protected function order(): Order
    {
        return Order::create([
            'order_number' => 'RA-NOTE-001',
            'customer_name' => 'Pelanggan',
            'customer_phone' => '081200000001',
            'shipping_address_line1' => 'Jl Test 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);
    }

    public function test_admin_dapat_menyimpan_catatan_internal(): void
    {
        $admin = $this->admin();
        $order = $this->order();

        $this->actingAs($admin)
            ->put(route('admin.orders.admin-notes.update', $order), [
                'admin_notes' => 'Hubungi kurir sebelum kirim.',
            ])
            ->assertRedirect();

        $this->assertSame('Hubungi kurir sebelum kirim.', $order->fresh()->admin_notes);
    }

    public function test_admin_dapat_menghapus_catatan_internal(): void
    {
        $admin = $this->admin();
        $order = $this->order();
        $order->update(['admin_notes' => 'Lama']);

        $this->actingAs($admin)
            ->put(route('admin.orders.admin-notes.update', $order), [
                'admin_notes' => '',
            ])
            ->assertRedirect();

        $this->assertNull($order->fresh()->admin_notes);
    }

    public function test_guest_tidak_bisa_menyimpan_catatan(): void
    {
        $order = $this->order();

        $this->put(route('admin.orders.admin-notes.update', $order), [
            'admin_notes' => 'X',
        ])->assertRedirect(route('login'));
    }
}