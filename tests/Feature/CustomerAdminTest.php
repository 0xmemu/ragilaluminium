<?php

namespace Tests\Feature;

use App\Exports\CustomerExport;
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
                ->where('rows.0.phone', '6281234567890')
                ->where('rows.0.address', 'Jl Melati 1, Bandung, Jawa Barat'));

        $this->assertDatabaseHas('customers', [
            'phone' => '6281234567890',
            'name' => 'Budi Santoso',
        ]);
    }

    public function test_admin_can_edit_customer_and_export_xlsx_without_email(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $customer = Customer::create([
            'name' => 'Ani',
            'phone' => '628111111111',
            'default_city' => 'Jakarta',
            'default_province' => 'DKI Jakarta',
        ]);

        Order::create([
            'order_number' => 'ORD26080001',
            'customer_name' => 'Ani',
            'customer_phone' => '628111111111',
            'shipping_address_line1' => 'Jl Sudirman',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '12190',
            'shipping_country' => 'Indonesia',
            'order_status' => 'completed',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 300000,
            'shipping_amount' => 20000,
            'total_amount' => 320000,
            'payment_method' => 'transfer',
        ]);

        Order::create([
            'order_number' => 'ORD26080002',
            'customer_name' => 'Ani',
            'customer_phone' => '628111111111',
            'shipping_address_line1' => 'Jl Sudirman',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '12190',
            'shipping_country' => 'Indonesia',
            'order_status' => 'completed',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 400000,
            'shipping_amount' => 20000,
            'total_amount' => 420000,
            'payment_method' => 'transfer',
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
                'default_address_line1' => 'Jl Sudirman No. 10',
                'default_city' => 'Jakarta',
                'default_province' => 'DKI Jakarta',
                'default_postal_code' => '12190',
                'default_country' => 'Indonesia',
            ])
            ->assertRedirect(route('admin.customers.edit', $customer));

        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'name' => 'Ani Wijaya',
            'default_address_line1' => 'Jl Sudirman No. 10',
        ]);

        $export = new CustomerExport(Customer::query()->latest('id'));
        $headings = $export->headings();
        $this->assertContains('Nomor Pesanan', $headings);
        $this->assertContains('Alamat', $headings);
        $this->assertNotContains('Email', $headings);

        $mapped = $export->map($customer->fresh());
        $this->assertSame('ORD26080001, ORD26080002', $mapped[3]);
        $this->assertSame('Jl Sudirman No. 10', $mapped[4]);

        $this->actingAs($admin)
            ->get(route('admin.customers.export'))
            ->assertOk()
            ->assertHeader('content-disposition');
    }

    public function test_customer_pagination_ten_per_page(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        for ($i = 1; $i <= 12; $i++) {
            Customer::create([
                'name' => 'Customer '.$i,
                'phone' => '62812000000'.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
                'default_city' => 'Semarang',
                'default_province' => 'Jawa Tengah',
            ]);
        }

        $this->actingAs($admin)
            ->get(route('admin.customers.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Customers/Index')
                ->has('rows', 10)
                ->where('pagination.total', 12)
                ->where('pagination.last_page', 2)
                ->where('pagination.per_page', 10));
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
    public function test_export_pelanggan_nomor_wa_disimpan_sebagai_teks(): void
    {
        Customer::create([
            'name' => 'Pelanggan Uji Nomor',
            'phone' => '6285725116817',
            'default_city' => 'Banjarnegara',
            'default_province' => 'Jawa Tengah',
        ]);

        \Maatwebsite\Excel\Facades\Excel::store(
            new CustomerExport(Customer::query()),
            'ident_customer.xlsx',
            'imports'
        );
        $ss = \PhpOffice\PhpSpreadsheet\IOFactory::load(
            \Illuminate\Support\Facades\Storage::disk('imports')->path('ident_customer.xlsx')
        );
        $cell = $ss->getSheetByName('Laporan Pelanggan')->getCell('C2');

        // Nomor WA format asli Ragil (berawalan 62). Sebagai angka, Excel
        // menampilkan 2,62857E+12 dan nomor 16+ digit dibulatkan.
        $this->assertSame('6285725116817', (string) $cell->getValue(), 'nomor WA terbaca utuh');
        $this->assertSame(
            \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING,
            $cell->getDataType(),
            'nomor WA disimpan sebagai teks'
        );
        $this->assertSame('@', $cell->getStyle()->getNumberFormat()->getFormatCode(), 'kolom WA berformat teks');
    }
}
