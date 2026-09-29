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

    /** Admin tunggal per test untuk helper filter periode di bawah. */
    private ?User $adminPelangganCache = null;

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
            ->assertRedirect(route('admin.customers.index'));

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

    // =====================================================================
    // Filter periode halaman Pelanggan (permintaan owner 2026-09-28).
    // Definisinya: daftar dibatasi ke pelanggan yang BERBELANJA pada periode
    // itu, dan angka Pesanan/Total Belanja per baris dihitung dalam periode
    // yang sama. Basis tanggalnya created_at pesanan.
    // =====================================================================

    /** Pesanan dengan tanggal dibuat yang bisa ditempatkan di masa lalu. */
    private function pesananPada(string $nomor, string $phone, float $total, string $createdAt): Order
    {
        $order = Order::create([
            'order_number' => $nomor,
            'customer_name' => 'Pelanggan '.$phone,
            'customer_phone' => $phone,
            'shipping_address_line1' => 'Jl Uji',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'completed',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => (int) $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => (int) $total,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        // created_at tidak fillable, jadi tanggalnya ditempatkan lewat query.
        \Illuminate\Support\Facades\DB::table('orders')
            ->where('id', $order->id)
            ->update(['created_at' => $createdAt]);

        return $order->fresh();
    }

    /** @return array<string, mixed> */
    private function propsPelanggan(array $query = []): array
    {
        $props = [];
        $this->actingAs($this->adminPelanggan())
            ->get(route('admin.customers.index', $query))
            ->assertOk()
            ->assertInertia(function (Assert $page) use (&$props) {
                $props = $page->component('Admin/Customers/Index')->toArray()['props'];
            });

        return $props;
    }

    private function adminPelanggan(): User
    {
        return $this->adminPelangganCache ??= User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_tanpa_periode_daftar_dan_angka_tetap_seumur_hidup(): void
    {
        $this->pesananPada('RA-LIFE-1', '6285711110001', 100000, now()->subDays(2)->toDateTimeString());
        $this->pesananPada('RA-LIFE-2', '6285711110001', 400000, now()->subDays(60)->toDateTimeString());

        $props = $this->propsPelanggan();

        $this->assertCount(1, $props['rows']);
        $this->assertSame(2, (int) $props['rows'][0]['order_count']);
        $this->assertSame(500000.0, (float) $props['rows'][0]['total_spent']);
        $this->assertFalse((bool) $props['summary']['period_scoped']);
        $this->assertSame('Semua waktu', $props['periodLabel']);
    }

    public function test_periode_membatasi_daftar_ke_pelanggan_yang_berbelanja(): void
    {
        $this->pesananPada('RA-PER-BARU', '6285711110002', 150000, now()->subDays(2)->toDateTimeString());
        $this->pesananPada('RA-PER-LAMA', '6285711110003', 250000, now()->subDays(60)->toDateTimeString());

        $props = $this->propsPelanggan(['date_preset' => '7d']);

        $this->assertCount(1, $props['rows']);
        $this->assertSame('6285711110002', $props['rows'][0]['phone']);
        $this->assertSame('7d', $props['activeDatePreset']);
        $this->assertSame('7 hari terakhir', $props['periodLabel']);
        $this->assertTrue((bool) $props['summary']['period_scoped']);
        // Kartu ringkasan memakai himpunan yang sama dengan daftar.
        $this->assertSame(1, (int) $props['summary']['total_customers']);
    }

    public function test_periode_menghitung_pesanan_dan_belanja_dalam_periode_saja(): void
    {
        $this->pesananPada('RA-DALAM', '6285711110004', 100000, now()->subDays(3)->toDateTimeString());
        $this->pesananPada('RA-LUAR', '6285711110004', 400000, now()->subDays(45)->toDateTimeString());

        $props = $this->propsPelanggan(['date_preset' => '7d']);

        $this->assertCount(1, $props['rows']);
        $this->assertSame(1, (int) $props['rows'][0]['order_count'], 'hanya pesanan dalam periode yang dihitung');
        $this->assertSame(100000.0, (float) $props['rows'][0]['total_spent']);
        // Status keaktifan tetap seumur hidup: pelanggan ini terakhir berbelanja
        // 3 hari lalu, jadi Aktif, bukan dinilai dari periode 7 hari saja.
        $this->assertSame('aktif', $props['rows'][0]['status']['key']);
    }

    public function test_periode_tanpa_pesanan_memberi_daftar_dan_kartu_kosong(): void
    {
        Customer::create(['name' => 'Belum Pernah Order', 'phone' => '6285711110005']);

        $props = $this->propsPelanggan(['date_preset' => '7d']);

        $this->assertSame([], $props['rows']);
        $this->assertSame(0, (int) $props['summary']['total_customers']);
        $this->assertSame('-', $props['summary']['top_province']['name']);
    }

    public function test_rentang_tanggal_memakai_batas_inklusif(): void
    {
        $this->pesananPada('RA-RANGE-DALAM', '6285711110006', 120000, now()->subDays(10)->toDateTimeString());
        $this->pesananPada('RA-RANGE-LUAR', '6285711110007', 130000, now()->subDays(1)->toDateTimeString());

        $props = $this->propsPelanggan([
            'date_preset' => 'range',
            'date_from' => now()->subDays(15)->toDateString(),
            'date_to' => now()->subDays(5)->toDateString(),
        ]);

        $this->assertCount(1, $props['rows']);
        $this->assertSame('6285711110006', $props['rows'][0]['phone']);
        $this->assertStringContainsString(' - ', (string) $props['periodLabel']);
    }

    public function test_ekspor_mengikuti_periode_layar(): void
    {
        $this->pesananPada('RA-EXP-PER', '6285711110008', 200000, now()->subDays(2)->toDateTimeString());

        $props = $this->propsPelanggan(['date_preset' => '7d', 'q' => '6285711110008']);
        $this->assertStringContainsString('date_preset=7d', (string) $props['exportUrl']);
        $this->assertStringContainsString('q=6285711110008', (string) $props['exportUrl']);

        // Nama berkas membawa periode supaya berkas tersimpan tidak dibaca
        // sebagai laporan seumur hidup.
        $this->actingAs($this->adminPelanggan())
            ->get(route('admin.customers.export', ['date_preset' => '7d']))
            ->assertOk()
            ->assertHeader('content-disposition');

        $this->assertStringContainsString('-7d.xlsx', $this->namaBerkasEkspor(['date_preset' => '7d']));
        $this->assertStringNotContainsString('-7d', $this->namaBerkasEkspor([]));
    }

    /** Nama berkas dari respons ekspor, dibaca dari header content-disposition. */
    private function namaBerkasEkspor(array $query): string
    {
        $respons = $this->actingAs($this->adminPelanggan())
            ->get(route('admin.customers.export', $query));

        return (string) $respons->headers->get('content-disposition');
    }

    public function test_ekspor_angka_per_baris_mengikuti_periode(): void
    {
        $this->pesananPada('RA-EXP-DALAM', '6285711110009', 150000, now()->subDays(3)->toDateTimeString());
        $this->pesananPada('RA-EXP-LUAR', '6285711110009', 350000, now()->subDays(40)->toDateTimeString());

        // Baris pelanggan lahir dari sinkronisasi saat halaman daftar dibuka,
        // sama seperti alur nyata sebelum admin menekan tombol Ekspor.
        $this->propsPelanggan();
        $customer = Customer::query()->where('phone', '6285711110009')->firstOrFail();
        $ekspor = new CustomerExport(
            Customer::query()->where('phone', '6285711110009'),
            now()->subDays(7),
            now(),
        );

        $baris = $ekspor->map($customer);

        // Kolom I = Total Pesanan, J = Total Belanja, D = nomor pesanan.
        $this->assertSame(1, (int) $baris[8]);
        $this->assertSame(150000.0, (float) $baris[9]);
        $this->assertSame('RA-EXP-DALAM', $baris[3]);
    }
}
