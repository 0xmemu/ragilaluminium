<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use App\Services\CustomerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_customer_index_syncs_from_orders_and_lists(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        Order::create([
            'order_number' => 'RA-CUS-1',
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '6281234567890',
            'shipping_address_line1' => 'Jl Melati 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40115',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 500000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 500000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.customers.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Customers/Index')
                ->has('rows', 1)
                ->where('rows.0.name', 'Budi Santoso')
                ->where('rows.0.phone', '6281234567890'));

        $this->assertDatabaseHas('customers', [
            'phone' => '6281234567890',
            'name' => 'Budi Santoso',
        ]);
    }

    public function test_admin_can_edit_customer_and_export_csv(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $customer = Customer::create([
            'name' => 'Ani',
            'phone' => '628111111111',
            'default_city' => 'Jakarta',
            'default_province' => 'DKI Jakarta',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.customers.edit', $customer))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Customers/Edit')
                ->where('customer.code', 'CUS-'.str_pad((string) $customer->id, 5, '0', STR_PAD_LEFT)));

        $this->actingAs($admin)
            ->put(route('admin.customers.update', $customer), [
                'name' => 'Ani Wijaya',
                'email' => 'ani@example.com',
                'default_address_line1' => 'Jl Sudirman',
                'default_city' => 'Jakarta',
                'default_province' => 'DKI Jakarta',
                'default_postal_code' => '12190',
                'default_country' => 'Indonesia',
            ])
            ->assertRedirect(route('admin.customers.edit', $customer));

        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'name' => 'Ani Wijaya',
            'email' => 'ani@example.com',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.customers.export'))
            ->assertOk()
            ->assertHeader('content-disposition');
    }

    public function test_checkout_links_customer_id_on_order(): void
    {
        $service = app(CustomerService::class);
        $customer = $service->upsertFromCheckout([
            'name' => 'Cici',
            'phone' => '081234567890',
            'address_line1' => 'Jl A',
            'city' => 'Semarang',
            'province' => 'Jawa Tengah',
            'postal_code' => '50254',
        ]);

        $this->assertNotNull($customer->id);
        $this->assertSame('6281234567890', $customer->phone);

        $fraud = $service->fraudAssessment($customer);
        $this->assertArrayHasKey('score', $fraud);
        $this->assertLessThanOrEqual(100, $fraud['score']);
    }
}
