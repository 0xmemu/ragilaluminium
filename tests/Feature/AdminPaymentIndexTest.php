<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminPaymentIndexTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_guest_redirected_to_login(): void
    {
        $this->get(route('admin.payments.index'))
            ->assertRedirect(route('login'));
    }

    public function test_admin_can_view_payments_index(): void
    {
        $order = Order::create([
            'order_number' => 'ORD26090001',
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Merdeka 10',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'subtotal_amount' => 500000,
            'shipping_amount' => 50000,
            'discount_amount' => 0,
            'total_amount' => 550000,
            'payment_method' => 'transfer',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
        ]);

        Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'transfer',
            'amount' => 550000,
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        $this->actingAs($this->admin)
            ->get(route('admin.payments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Payments/Index')
                ->has('summary')
                ->where('summary.total_received', 550000)
                ->where('summary.completed_count', 1)
                ->has('tabs', 4)
                ->has('payments.data', 1)
                ->where('payments.data.0.order_number', 'ORD26090001')
                ->where('payments.data.0.customer_name', 'Budi Santoso')
                ->where('payments.data.0.status', 'completed')
            );
    }

    public function test_admin_can_filter_payments_by_status(): void
    {
        $orderPaid = Order::create([
            'order_number' => 'ORD26090010',
            'customer_name' => 'User Paid',
            'customer_phone' => '08111111111',
            'shipping_address_line1' => 'Jl. A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
        ]);

        Payment::create([
            'order_id' => $orderPaid->id,
            'payment_method' => 'transfer',
            'amount' => 100000,
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        $orderPending = Order::create([
            'order_number' => 'ORD26090011',
            'customer_name' => 'User Pending',
            'customer_phone' => '08222222222',
            'shipping_address_line1' => 'Jl. B',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'subtotal_amount' => 200000,
            'total_amount' => 200000,
            'payment_method' => 'cod',
            'order_status' => 'awaiting_confirmation',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
        ]);

        Payment::create([
            'order_id' => $orderPending->id,
            'payment_method' => 'cod',
            'amount' => 200000,
            'status' => 'pending',
        ]);

        // Filter status=completed
        $this->actingAs($this->admin)
            ->get(route('admin.payments.index', ['status' => 'completed']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Payments/Index')
                ->has('payments.data', 1)
                ->where('payments.data.0.order_number', 'ORD26090010')
            );

        // Filter status=pending
        $this->actingAs($this->admin)
            ->get(route('admin.payments.index', ['status' => 'pending']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Payments/Index')
                ->has('payments.data', 1)
                ->where('payments.data.0.order_number', 'ORD26090011')
            );
    }
}
