<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminShippingIndexTest extends TestCase
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
        $this->get(route('admin.shipping.index'))
            ->assertRedirect(route('login'));
    }

    public function test_admin_can_view_shipping_index(): void
    {
        $order = Order::create([
            'order_number' => 'ORD26080001',
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Merdeka 10',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'subtotal_amount' => 500000,
            'total_amount' => 500000,
            'payment_method' => 'transfer',
            'order_status' => 'completed',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
        ]);

        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'service_name' => 'Kargo Darat',
            'waybill_number' => '201718781511',
            'status' => 'delivered',
            'status_raw' => 'Paket diterima oleh penerima',
            'last_status_at' => now(),
        ]);

        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->has('summary')
                ->where('summary.total_delivered', 1)
                ->where('summary.total_in_transit', 0)
                ->has('tabs', 5)
                ->has('records.data', 1)
                ->where('records.data.0.waybill_number', '201718781511')
                ->where('records.data.0.customer_name', 'Budi Santoso')
                ->where('records.data.0.status', 'delivered')
                // Kolom daftar terpisah: No. Order, No. HP, dan Penerima
                // (nama plus alamat utuh), jadi tiga field ini wajib ada.
                ->where('records.data.0.order_number', 'ORD26080001')
                ->where('records.data.0.customer_phone', '081234567890')
                ->where('records.data.0.customer_address', 'Jl. Merdeka 10, Semarang, Jawa Tengah, 50254')
            );
    }

    public function test_admin_can_filter_shipping_by_status(): void
    {
        $order1 = Order::create([
            'order_number' => 'ORD26080010',
            'customer_name' => 'Delivered Order',
            'customer_phone' => '08111111111',
            'shipping_address_line1' => 'Jl. A',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '10110',
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
            'order_status' => 'completed',
            'shipping_status' => 'delivered',
        ]);

        ShippingRecord::create([
            'order_id' => $order1->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-DELIVERED-1',
            'status' => 'delivered',
        ]);

        $order2 = Order::create([
            'order_number' => 'ORD26080020',
            'customer_name' => 'In Transit Order',
            'customer_phone' => '08222222222',
            'shipping_address_line1' => 'Jl. B',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40115',
            'subtotal_amount' => 200000,
            'total_amount' => 200000,
            'payment_method' => 'transfer',
            'order_status' => 'shipped',
            'shipping_status' => 'in_transit',
        ]);

        ShippingRecord::create([
            'order_id' => $order2->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'JT-TRANSIT-1',
            'status' => 'in_transit',
        ]);

        // Filter status=delivered
        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['status' => 'delivered']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->has('records.data', 1)
                ->where('records.data.0.waybill_number', 'JT-DELIVERED-1')
            );

        // Filter status=in_transit
        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['status' => 'in_transit']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->has('records.data', 1)
                ->where('records.data.0.waybill_number', 'JT-TRANSIT-1')
            );
    }

    /**
     * Resi baru dengan tanggal pencatatan dan metode bayar yang bisa
     * ditentukan, supaya filter periode dan metode dapat diuji tanpa menunggu
     * waktu berjalan.
     */
    private function makeRecord(
        string $waybill,
        string $status,
        ?string $createdAt = null,
        string $paymentMethod = 'transfer',
    ): ShippingRecord {
        $order = Order::create([
            'order_number' => 'ORD-'.$waybill,
            'customer_name' => 'Pelanggan '.$waybill,
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'subtotal_amount' => 100000,
            'total_amount' => 100000,
            'payment_method' => $paymentMethod,
            'order_status' => 'shipped',
            'shipping_status' => $status,
        ]);

        $record = ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => $waybill,
            'status' => $status,
        ]);

        if ($createdAt !== null) {
            // created_at tidak masuk daftar fillable, jadi diset langsung.
            $record->created_at = $createdAt;
            $record->save();
        }

        return $record;
    }

    public function test_period_filter_scopes_table_summary_and_tabs(): void
    {
        $this->makeRecord('JT-TODAY', 'delivered');
        $this->makeRecord('JT-TEN-DAYS', 'in_transit', now()->subDays(10)->toDateTimeString());
        $this->makeRecord('JT-FORTY-DAYS', 'in_transit', now()->subDays(40)->toDateTimeString());

        // Tanpa filter periode, seluruh resi ikut terhitung.
        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->where('activeDatePreset', '')
                ->where('periodLabel', 'Semua waktu')
                ->where('summary.total_records', 3)
                ->has('records.data', 3)
            );

        // 7 hari terakhir: hanya resi yang dicatat dalam rentang itu. Angka KPI
        // dan hitungan tab wajib ikut menyempit agar sejalan dengan tabel.
        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['date_preset' => '7d']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->where('activeDatePreset', '7d')
                ->where('periodLabel', '7 hari terakhir')
                ->where('summary.total_records', 1)
                ->where('summary.total_delivered', 1)
                ->where('summary.total_in_transit', 0)
                ->has('records.data', 1)
                ->where('records.data.0.waybill_number', 'JT-TODAY')
                ->where('tabs.0.count', 1)
            );

        // 30 hari terakhir: dua resi termuda masuk, resi 40 hari tidak.
        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['date_preset' => '30d']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.total_records', 2)
                ->has('records.data', 2)
            );
    }

    public function test_period_filter_accepts_explicit_range(): void
    {
        $this->makeRecord('JT-TODAY', 'delivered');
        $this->makeRecord('JT-TEN-DAYS', 'in_transit', now()->subDays(10)->toDateTimeString());
        $this->makeRecord('JT-FORTY-DAYS', 'in_transit', now()->subDays(40)->toDateTimeString());

        $from = now()->subDays(20)->toDateString();
        $to = now()->subDays(5)->toDateString();

        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', [
                'date_preset' => 'range',
                'date_from' => $from,
                'date_to' => $to,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->where('activeDatePreset', 'range')
                ->where('dateFrom', $from)
                ->where('dateTo', $to)
                ->where('summary.total_records', 1)
                ->has('records.data', 1)
                ->where('records.data.0.waybill_number', 'JT-TEN-DAYS')
            );
    }

    public function test_unknown_date_preset_falls_back_to_all_time(): void
    {
        $this->makeRecord('JT-TODAY', 'delivered');

        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['date_preset' => 'kemarin']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activeDatePreset', '')
                ->where('summary.total_records', 1)
            );
    }

    public function test_payment_method_filter_scopes_the_table(): void
    {
        $this->makeRecord('JT-COD-1', 'in_transit', null, 'cod');
        $this->makeRecord('JT-COD-2', 'delivered', null, 'cod');
        $this->makeRecord('JT-TRF-1', 'in_transit', null, 'transfer');

        // Ringkasan sengaja tetap menghitung seluruh metode, sama seperti
        // halaman Pembayaran: metode sejajar status, bukan pembatas periode.
        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['payment_method' => 'cod']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->where('activePaymentMethod', 'cod')
                ->where('summary.total_records', 3)
                ->has('records.data', 2)
                ->where('records.data.0.waybill_number', 'JT-COD-2')
                ->where('records.data.1.waybill_number', 'JT-COD-1')
            );

        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['payment_method' => 'transfer']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activePaymentMethod', 'transfer')
                ->has('records.data', 1)
                ->where('records.data.0.waybill_number', 'JT-TRF-1')
            );

        // Nilai di luar daftar yang sah dianggap tanpa filter.
        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['payment_method' => 'qris']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activePaymentMethod', 'all')
                ->has('records.data', 3)
            );
    }

    public function test_issue_tab_groups_exception_and_returned(): void
    {
        // Tab Kendala = paket gagal antar (exception) atau sedang dikembalikan
        // (returned). Penjaga ini ada karena bucket itu sebelumnya tidak punya
        // test, padahal ia satu-satunya tab yang mengelompokkan dua status.
        $this->makeRecord('JT-ISSUE-EXCEPTION', 'exception');
        $this->makeRecord('JT-ISSUE-RETURNED', 'returned');
        $this->makeRecord('JT-ISSUE-DELIVERED', 'delivered');
        $this->makeRecord('JT-ISSUE-TRANSIT', 'in_transit');

        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', ['status' => 'issue']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Shipping/Index')
                ->where('activeStatus', 'issue')
                ->where('summary.total_issue', 2)
                ->has('records.data', 2)
                ->where('records.data.0.waybill_number', 'JT-ISSUE-RETURNED')
                ->where('records.data.1.waybill_number', 'JT-ISSUE-EXCEPTION')
            );
    }

    public function test_payment_method_filter_composes_with_period(): void
    {
        $this->makeRecord('JT-COD-NEW', 'in_transit', null, 'cod');
        $this->makeRecord('JT-COD-OLD', 'in_transit', now()->subDays(20)->toDateTimeString(), 'cod');
        $this->makeRecord('JT-TRF-NEW', 'in_transit');

        $this->actingAs($this->admin)
            ->get(route('admin.shipping.index', [
                'payment_method' => 'cod',
                'date_preset' => '7d',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activePaymentMethod', 'cod')
                ->where('activeDatePreset', '7d')
                ->has('records.data', 1)
                ->where('records.data.0.waybill_number', 'JT-COD-NEW')
            );
    }
}
