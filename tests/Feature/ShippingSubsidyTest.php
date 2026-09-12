<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\ShippingSubsidySettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ShippingSubsidyTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_save_shipping_subsidy_settings(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.shipping-subsidy.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ShippingSubsidy/Edit')
                ->where('settings.enabled', false));

        $this->actingAs($admin)
            ->put(route('admin.shipping-subsidy.update'), [
                'enabled' => true,
                'subsidy_type' => 'percent',
                'subsidy_value' => 50,
                'jnt_enabled' => true,
            ])
            ->assertRedirect(route('admin.shipping-subsidy.edit'));

        $settings = ShippingSubsidySettings::get();
        $this->assertTrue($settings['enabled']);
        $this->assertSame('percent', $settings['subsidy_type']);
        $this->assertEquals(50.0, $settings['subsidy_value']);
        $this->assertTrue($settings['carriers']['jnt']);
    }

    public function test_checkout_applies_percent_subsidy_to_shipping(): void
    {
        ShippingSubsidySettings::update([
            'enabled' => true,
            'subsidy_type' => 'percent',
            'subsidy_value' => 50,
            'jnt_enabled' => true,
        ]);

        $product = Product::create([
            'parent_sku' => 'WIN-SUB-1',
            'name' => 'Jendela Subsidi',
            'short_name' => 'SUB',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-SUB-1-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->withSession(['ragil_cart' => [
            'WIN-SUB-1-100' => [
                'line_id' => 'WIN-SUB-1-100',
                'parent_sku' => 'WIN-SUB-1',
                'variant_sku' => 'WIN-SUB-1-100',
                'name' => 'Jendela Subsidi',
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
            'payment_method' => 'transfer',
        ])->assertRedirect();

        $order = Order::query()->latest('id')->first();
        $this->assertNotNull($order);

        $gross = (float) $order->shipping_amount + (float) $order->shipping_subsidy_amount;
        $this->assertGreaterThan(0, $gross);
        $this->assertEquals(
            round($gross * 0.5, 2),
            (float) $order->shipping_subsidy_amount
        );
        $this->assertEquals(
            round($gross - (float) $order->shipping_subsidy_amount, 2),
            (float) $order->shipping_amount
        );
        // Tanpa asuransi (default): snapshot asuransi 0.
        $this->assertEquals(0.0, (float) $order->shipping_insurance_amount);
        $this->assertEquals(
            (float) $order->subtotal_amount
                + (float) $order->shipping_amount
                - (float) $order->voucher_discount_amount
                + (float) $order->cod_fee_amount,
            (float) $order->total_amount
        );
    }

    public function test_disabled_jnt_carrier_skips_subsidy(): void
    {
        ShippingSubsidySettings::update([
            'enabled' => true,
            'subsidy_type' => 'fixed',
            'subsidy_value' => 25000,
            'jnt_enabled' => false,
        ]);

        $applied = ShippingSubsidySettings::apply(50000, 'jnt');
        $this->assertFalse($applied['applied']);
        $this->assertEquals(0.0, $applied['subsidy']);
        $this->assertEquals(50000.0, $applied['net']);
    }

    /**
     * Asuransi pengiriman opsional (pilihan pembeli): quote dengan asuransi
     * memisahkan freight & insurance; subsidi hanya atas freight; net =
     * freight - subsidi + asuransi. Order menyimpan snapshot insurance.
     */
    public function test_checkout_with_insurance_snapshot_and_total_consistency(): void
    {
        ShippingSubsidySettings::update([
            'enabled' => true,
            'subsidy_type' => 'percent',
            'subsidy_value' => 50,
            'jnt_enabled' => true,
        ]);

        // Struktur quote dengan asuransi: insurance >= 0 dan net konsisten.
        $withInsurance = app(\App\Services\ShippingService::class)->quote(1.0, 'KOTA SEMARANG', 'JAWA TENGAH', '50254', 'Candisari', true);
        $this->assertArrayHasKey('insurance', $withInsurance);
        $this->assertArrayHasKey('freight', $withInsurance);
        $this->assertGreaterThanOrEqual(0.0, (float) $withInsurance['insurance']);
        $this->assertEqualsWithDelta(
            max(0, (float) $withInsurance['freight'] - (float) $withInsurance['subsidy']) + (float) $withInsurance['insurance'],
            (float) $withInsurance['net'],
            0.01,
        );

        $product = Product::create([
            'parent_sku' => 'WIN-INS-1',
            'name' => 'Jendela Asuransi',
            'short_name' => 'INS',
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
        ProductVariant::create([
            'product_id' => $product->id,
            'variant_sku' => 'WIN-INS-1-100',
            'price' => 1000000,
            'stock' => 5,
            'status' => 'active',
        ]);

        $this->withSession(['ragil_cart' => [
            'WIN-INS-1-100' => [
                'line_id' => 'WIN-INS-1-100',
                'parent_sku' => 'WIN-INS-1',
                'variant_sku' => 'WIN-INS-1-100',
                'name' => 'Jendela Asuransi',
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
            'payment_method' => 'transfer',
            'insurance' => 1,
        ])->assertRedirect();

        $order = Order::query()->latest('id')->first();
        $this->assertNotNull($order);
        $this->assertGreaterThanOrEqual(0.0, (float) $order->shipping_insurance_amount);
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
     * Kontrak: opsi asuransi HARUS tersedia sebelum pembeli mencentang.
     *
     * Sebelumnya mentok: biaya asuransi hanya dihitung bila offerFee dikirim,
     * sementara offerFee hanya dikirim bila pembeli sudah mencentang - padahal
     * checkbox-nya baru muncul setelah biaya diketahui. Akibatnya opsi tidak
     * pernah bisa dipilih.
     */
    public function test_opsi_asuransi_tersedia_tanpa_harus_dicentang_dulu(): void
    {
        ShippingSubsidySettings::update([
            'enabled' => false,
            'subsidy_type' => 'fixed',
            'subsidy_value' => 0,
            'jnt_enabled' => true,
        ]);

        // J&T disimulasikan mengikuti perilaku nyata (terbukti 2026-09-12):
        // biaya asuransi hanya keluar bila offerFee dikirim, dan besarnya
        // sekitar 0,2% nilai barang dengan minimum Rp 5.000.
        $fake = new class extends \App\Services\Shipping\JntCargoClient
        {
            public function isEnabled(): bool
            {
                return true;
            }

            public function tariff(array $bizContent): \App\Services\Shipping\JntResponse
            {
                $offer = (int) ($bizContent['offerFee'] ?? 0);
                $insurance = $offer > 0 ? max(5000, (int) round($offer * 0.002)) : 0;

                return new \App\Services\Shipping\JntResponse(
                    ok: true,
                    httpStatus: 200,
                    data: ['data' => [
                        'estimateTime' => '1-3',
                        'estimateCustomerCost' => '120000',
                        'estimateSumFreight' => (string) (120000 + $insurance),
                        'estimateInsuranceCost' => (string) $insurance,
                    ]],
                    requestId: 'test',
                    elapsedMs: 1,
                );
            }
        };

        $this->app->instance(\App\Services\Shipping\JntCargoClient::class, $fake);
        $svc = app(\App\Services\ShippingService::class);

        // Kondisi awal halaman: pembeli BELUM mencentang.
        $belum = $svc->quote(30.0, 'KOTA BOGOR', 'JAWA BARAT', null, 'Bogor Barat', false, 5000000);
        $this->assertTrue($belum['insurance_available'], 'opsi asuransi harus tersedia tanpa dicentang');
        $this->assertEquals(10000.0, (float) $belum['insurance'], 'biaya 0,2% dari nilai barang');
        $this->assertEquals(0.0, (float) $belum['insurance_charged'], 'belum ditagihkan');
        $this->assertEquals(5000000.0, (float) $belum['insured_value']);
        $this->assertEquals(120000.0, (float) $belum['net'], 'net belum termasuk asuransi');

        // Setelah dicentang: biaya masuk ke net.
        $sudah = $svc->quote(30.0, 'KOTA BOGOR', 'JAWA BARAT', null, 'Bogor Barat', true, 5000000);
        $this->assertTrue($sudah['insurance_selected']);
        $this->assertEquals(10000.0, (float) $sudah['insurance_charged']);
        $this->assertEquals(130000.0, (float) $sudah['net'], 'net termasuk asuransi');

        // Nilai pertanggungan mengikuti nilai barang, bukan angka tetap.
        $besar = $svc->quote(30.0, 'KOTA BOGOR', 'JAWA BARAT', null, 'Bogor Barat', false, 10283000);
        $this->assertEquals(20566.0, (float) $besar['insurance'], 'biaya ikut nilai barang');

        // Keranjang kosong: tidak ditawarkan.
        $kosong = $svc->quote(30.0, 'KOTA BOGOR', 'JAWA BARAT', null, 'Bogor Barat', false, 0);
        $this->assertFalse($kosong['insurance_available']);
    }
}
