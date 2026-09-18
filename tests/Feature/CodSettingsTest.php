<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\EventLog;
use App\Services\PaymentService;
use App\Services\Shipping\JntCargoClient;
use App\Services\Shipping\JntResponse;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\CodSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CodSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_save_cod_settings(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.cod-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/CodSettings/Edit')
                ->where('settings.enabled', true));

        $this->actingAs($admin)
            ->put(route('admin.cod-settings.update'), [
                'enabled' => true,
                'fee_type' => 'percent',
                'fee_value' => 2.5,
                'max_order_amount' => 5000000,
            ])
            ->assertRedirect(route('admin.cod-settings.edit'));

        $settings = CodSettings::get();
        $this->assertTrue($settings['enabled']);
        $this->assertSame('percent', $settings['fee_type']);
        $this->assertEquals(2.5, $settings['fee_value']);
        $this->assertEquals(5000000.0, $settings['max_order_amount']);
    }

    public function test_cod_checkout_adds_handling_fee_to_order_total(): void
    {
        CodSettings::update([
            'enabled' => true,
            'fee_type' => 'percent',
            'fee_value' => 10,
            'max_order_amount' => null,
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-COD-1',
            'name' => 'Jendela COD',
            'short_name' => 'COD',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-COD-1-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->withSession(['ragil_cart' => [
            'WIN-COD-1-100' => [
                'line_id' => 'WIN-COD-1-100',
                'parent_sku' => 'WIN-COD-1',
                'variant_sku' => 'WIN-COD-1-100',
                'name' => 'Jendela COD',
                'unit_price' => 1000000,
                'quantity' => 1,
            ],
        ]]);

        $this->post(route('checkout.validate'), [
            'name' => 'Budi',
            'phone' => '081234567890',
            'email' => 'budi@example.com',
            'province' => 'Jawa Tengah',
            'city' => 'Semarang',
            'district' => 'Candisari',
            'village' => 'Jatingaleh',
            'province_id' => '33',
            'city_id' => '3374',
            'district_id' => '337401',
            'village_id' => '3374011001',
            'address_line1' => 'Jl. Contoh 1',
            'postal_code' => '50254',
        ])->assertRedirect();

        $this->post(route('checkout.place-order'), [
            'payment_method' => 'cod',
        ])->assertRedirect();

        $order = Order::query()->latest('id')->first();
        $this->assertNotNull($order);
        $this->assertTrue((bool) $order->cod_flag);
        // Keputusan owner 2026-09-03 (dipertegas 2026-09-18): COD = fee% x
        // (subtotal dibayar + TOTAL ongkir dibayar pembeli, sudah termasuk
        // asuransi). Ongkir net 60.000 + asuransi 5.000 = 65.000.
        $basisOngkir = (float) $order->shipping_amount + (float) $order->shipping_insurance_amount;
        $this->assertEquals(
            round(((float) $order->subtotal_amount + $basisOngkir) * 0.10, 2),
            (float) $order->cod_fee_amount,
            'biaya COD dihitung dari total ongkir yang dibayar pembeli'
        );
        // Total memuat asuransi secara eksplisit (selalu ditagihkan sejak
        // keputusan owner 2026-09-18).
        $this->assertEquals(
            (float) $order->subtotal_amount
                + (float) $order->shipping_amount
                + (float) $order->shipping_insurance_amount
                - (float) $order->voucher_discount_amount
                + (float) $order->cod_fee_amount,
            (float) $order->total_amount
        );
    }

    /**
     * Penjaga: biaya COD yang DILIHAT pembeli di pratinjau checkout harus sama
     * dengan yang TERSIMPAN saat pesanan dibuat.
     *
     * Sebelumnya pratinjau memakai ongkir `net` (termasuk asuransi) sementara
     * OrderService memakai `net_ongkir` (tanpa asuransi). Selama asuransi hanya
     * ditagihkan bila dicentang, selisihnya jarang terlihat; begitu asuransi
     * selalu ditagihkan (keputusan owner 2026-09-18), pratinjau dan order
     * berbeda setiap kali ada nilai barang.
     */
    public function test_biaya_cod_di_pratinjau_sama_dengan_yang_tersimpan(): void
    {
        CodSettings::update([
            'enabled' => true,
            'fee_type' => 'percent',
            'fee_value' => 4,
            'max_order_amount' => null,
        ]);

        // Subsidi dimatikan supaya angkanya mudah dibaca.
        \App\Support\ShippingSubsidySettings::update([
            'enabled' => false,
            'subsidy_type' => 'fixed',
            'subsidy_value' => 0,
            'jnt_enabled' => true,
        ]);

        // J&T palsu SELALU memberi biaya asuransi. Tanpa ini asuransi bernilai
        // 0 di lingkungan test, sehingga selisih basis COD tidak akan terlihat
        // dan test ini kehilangan daya tangkapnya.
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andReturn(new JntResponse(
                ok: true,
                httpStatus: 200,
                data: ['data' => [
                    'estimateCustomerCost' => 120000,
                    'estimateInsuranceCost' => 5000,
                    'estimateSumFreight' => 125000,
                ]],
                requestId: 'cod-sync',
                elapsedMs: 1,
            ));
        });

        $product = Product::create([
            'parent_sku' => 'WIN-COD-SYNC',
            'name' => 'Jendela Sinkron COD',
            'short_name' => 'SYNC',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-COD-SYNC-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->withSession(['ragil_cart' => [
            'WIN-COD-SYNC-100' => [
                'line_id' => 'WIN-COD-SYNC-100',
                'parent_sku' => 'WIN-COD-SYNC',
                'variant_sku' => 'WIN-COD-SYNC-100',
                'name' => 'Jendela Sinkron COD',
                'unit_price' => 1000000,
                'quantity' => 1,
            ],
        ]]);

        $this->post(route('checkout.validate'), [
            'name' => 'Budi',
            'phone' => '081234567890',
            'email' => 'budi@example.com',
            'province' => 'Jawa Tengah',
            'city' => 'Semarang',
            'district' => 'Candisari',
            'village' => 'Jatingaleh',
            'province_id' => '33',
            'city_id' => '3374',
            'district_id' => '337401',
            'village_id' => '3374011001',
            'address_line1' => 'Jl. Contoh 1',
            'postal_code' => '50254',
        ])->assertRedirect();

        // Angka yang dilihat pembeli di halaman checkout.
        $pratinjau = 0.0;
        $this->get(route('checkout.index'))
            ->assertOk()
            ->assertInertia(function (Assert $page) use (&$pratinjau) {
                $page->component('Public/Checkout');
                $pratinjau = (float) $page->toArray()['props']['cod']['fee_amount'];
            });

        $this->assertGreaterThan(0.0, $pratinjau, 'pratinjau biaya COD harus terhitung');

        $this->post(route('checkout.place-order'), ['payment_method' => 'cod'])->assertRedirect();

        $order = Order::query()->latest('id')->firstOrFail();

        // Pastikan asuransi memang ikut ditagihkan; kalau 0, test ini tidak
        // membuktikan apa pun soal sinkronisasi basis COD.
        $this->assertSame(5000.0, (float) $order->shipping_insurance_amount, 'asuransi selalu ikut');
        $this->assertSame(120000.0, (float) $order->shipping_amount, 'ongkir tersimpan tanpa asuransi');

        $this->assertSame(
            $pratinjau,
            (float) $order->cod_fee_amount,
            'biaya COD di pratinjau harus sama dengan yang tersimpan di order',
        );

        // Basis fee = subtotal + TOTAL ongkir dibayar pembeli (termasuk
        // asuransi): 4% x (1.000.000 + 125.000) = 45.000. Asuransi 5.000 ikut
        // jadi basis supaya biaya COD dapat diverifikasi dari angka yang
        // terlihat di ringkasan.
        $this->assertSame(45000.0, (float) $order->cod_fee_amount);

        // Total yang ditampilkan = subtotal + ongkir + asuransi + biaya COD.
        $this->assertEqualsWithDelta(
            (float) $order->subtotal_amount
                + (float) $order->shipping_amount
                + (float) $order->shipping_insurance_amount
                - (float) $order->voucher_discount_amount
                + (float) $order->cod_fee_amount,
            (float) $order->total_amount,
            0.01,
        );
    }

    /**
     * ATURAN BASIS BIAYA COD (keputusan owner 2026-09-18):
     * biaya COD = persen x TOTAL PEMBAYARAN SEBELUM biaya COD, yaitu
     * subtotal setelah voucher + ongkos kirim yang dibayar pembeli.
     * Perlakuannya SAMA dengan atau tanpa asuransi, karena ongkos kirim yang
     * dibayar sudah memuat asuransi bila J&T menagihnya.
     *
     * Test ini menutup kasus TANPA asuransi. Ketika asuransi bernilai 0,
     * `net_ongkir` dan `net` memang sama, sehingga test ini TIDAK dapat
     * membedakan keduanya; yang menjaganya adalah dua test lain di berkas ini
     * (`cod checkout adds handling fee` dan `biaya cod di pratinjau sama
     * dengan yang tersimpan`) yang memakai asuransi tidak nol.
     */
    public function test_basis_cod_adalah_total_pembayaran_sebelum_biaya_cod_tanpa_asuransi(): void
    {
        CodSettings::update([
            'enabled' => true,
            'fee_type' => 'percent',
            'fee_value' => 4,
            'max_order_amount' => null,
        ]);

        \App\Support\ShippingSubsidySettings::update([
            'enabled' => false,
            'subsidy_type' => 'fixed',
            'subsidy_value' => 0,
            'jnt_enabled' => true,
        ]);

        // J&T palsu TIDAK menagih asuransi, meniru kondisi asuransi tidak berlaku.
        $this->mock(JntCargoClient::class, function ($mock) {
            $mock->shouldReceive('isEnabled')->andReturn(true);
            $mock->shouldReceive('tariff')->andReturn(new JntResponse(
                ok: true,
                httpStatus: 200,
                data: ['data' => [
                    'estimateCustomerCost' => 120000,
                    'estimateInsuranceCost' => 0,
                    'estimateSumFreight' => 120000,
                ]],
                requestId: 'cod-tanpa-asuransi',
                elapsedMs: 1,
            ));
        });

        $product = Product::create([
            'parent_sku' => 'WIN-COD-NOINS',
            'name' => 'Jendela COD Tanpa Asuransi',
            'short_name' => 'NOINS',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-COD-NOINS-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->withSession(['ragil_cart' => [
            'WIN-COD-NOINS-100' => [
                'line_id' => 'WIN-COD-NOINS-100',
                'parent_sku' => 'WIN-COD-NOINS',
                'variant_sku' => 'WIN-COD-NOINS-100',
                'name' => 'Jendela COD Tanpa Asuransi',
                'unit_price' => 1000000,
                'quantity' => 1,
            ],
        ]]);

        $this->post(route('checkout.validate'), [
            'name' => 'Budi',
            'phone' => '081234567890',
            'email' => 'budi@example.com',
            'province' => 'Jawa Tengah',
            'city' => 'Semarang',
            'district' => 'Candisari',
            'village' => 'Jatingaleh',
            'province_id' => '33',
            'city_id' => '3374',
            'district_id' => '337401',
            'village_id' => '3374011001',
            'address_line1' => 'Jl. Contoh 1',
            'postal_code' => '50254',
        ])->assertRedirect();

        $this->post(route('checkout.place-order'), ['payment_method' => 'cod'])->assertRedirect();

        $order = Order::query()->latest('id')->firstOrFail();

        // Asuransi memang tidak ditagihkan pada kasus ini.
        $this->assertEquals(0.0, (float) $order->shipping_insurance_amount, 'tanpa asuransi');
        $this->assertEquals(120000.0, (float) $order->shipping_amount, 'yang dibayar hanya tarif kurir');

        // ATURAN: 4% x (subtotal setelah voucher + ongkos kirim dibayar + asuransi)
        $basis = (float) $order->subtotal_amount
            - (float) $order->voucher_discount_amount
            + (float) $order->shipping_amount
            + (float) $order->shipping_insurance_amount;

        $this->assertSame(
            round($basis * 0.04, 2),
            (float) $order->cod_fee_amount,
            'biaya COD = persen x total pembayaran sebelum biaya COD'
        );
        $this->assertSame(44800.0, (float) $order->cod_fee_amount, '4% x 1.120.000');

        // Total = subtotal - voucher + ongkir + asuransi + biaya COD
        $this->assertEqualsWithDelta(
            $basis + (float) $order->cod_fee_amount,
            (float) $order->total_amount,
            0.01,
        );
    }

    public function test_disabled_cod_cannot_be_selected_at_checkout(): void
    {
        CodSettings::update(['enabled' => false]);

        $product = Product::create([
            'parent_sku' => 'WIN-COD-2',
            'name' => 'Jendela',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-COD-2-100',
            'price' => 500000,
            'stock' => 2,
            'status' => 'active',
        ]);

        $this->withSession([
            'ragil_cart' => [
                'WIN-COD-2-100' => [
                    'line_id' => 'WIN-COD-2-100',
                    'parent_sku' => 'WIN-COD-2',
                    'variant_sku' => 'WIN-COD-2-100',
                    'name' => 'Jendela',
                    'unit_price' => 500000,
                    'quantity' => 1,
                ],
            ],
            'checkout_details' => [
                'name' => 'Budi',
                'phone' => '0812',
                'address_line1' => 'Jl A',
                'province' => 'DKI JAKARTA',
                'city' => 'JAKARTA',
                'district' => 'KEBAYORAN',
                'village' => 'SENAYAN',
                'postal_code' => '12190',
            ],
        ]);

        $this->from(route('checkout.index'))
            ->post(route('checkout.place-order'), ['payment_method' => 'cod'])
            ->assertRedirect(route('checkout.index'))
            ->assertSessionHasErrors('payment_method');
    }

    public function test_cod_is_settled_by_system_when_order_is_completed(): void
    {
        $order = Order::create([
            'order_number' => 'RA-20260815-9001',
            'customer_name' => 'Budi',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Contoh 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'order_status' => 'completed',
            'payment_status' => 'pending',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 100000,
            'total_amount' => 1100000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);

        $payment = app(PaymentService::class)->completeCodAtCompletion($order);

        $this->assertSame('completed', $payment->status);
        $this->assertEquals(1100000.0, (float) $payment->amount);
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertDatabaseHas('event_logs', [
            'event_type' => 'system/cod_completion',
            'entity_type' => 'order',
            'entity_id' => $order->id,
            'created_by_user_id' => null,
        ]);
        $this->assertSame(1, EventLog::query()->where('event_type', 'system/cod_completion')->count());
    }
}
