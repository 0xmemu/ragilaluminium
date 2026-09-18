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
        // Asuransi selalu ikut (keputusan owner 2026-09-18): biaya dari J&T
        // di-snapshot ke order, dan total pesanan memuatnya secara eksplisit.
        $this->assertGreaterThan(0.0, (float) $order->shipping_insurance_amount);
        $this->assertEquals(
            (float) $order->subtotal_amount
                + (float) $order->shipping_amount
                + (float) $order->shipping_insurance_amount
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
     * Asuransi pengiriman menyatu ke tarif ongkir (keputusan owner 2026-09-18):
     * pengiriman toko selalu diasuransikan, pembeli tidak memilih. Quote
     * memisahkan freight & insurance untuk pembukuan; subsidi hanya atas
     * freight; net = freight - subsidi + asuransi. Order menyimpan snapshot.
     */
    public function test_checkout_with_insurance_snapshot_and_total_consistency(): void
    {
        ShippingSubsidySettings::update([
            'enabled' => true,
            'subsidy_type' => 'percent',
            'subsidy_value' => 50,
            'jnt_enabled' => true,
        ]);

        // Struktur quote: insurance >= 0 dan net konsisten tanpa argumen pilihan.
        $breakdown = app(\App\Services\ShippingService::class)->quote(1.0, 'KOTA SEMARANG', 'JAWA TENGAH', '50254', 'Candisari');
        $this->assertArrayHasKey('insurance', $breakdown);
        $this->assertArrayHasKey('freight', $breakdown);
        $this->assertGreaterThanOrEqual(0.0, (float) $breakdown['insurance']);
        $this->assertEqualsWithDelta(
            max(0, (float) $breakdown['freight'] - (float) $breakdown['subsidy']) + (float) $breakdown['insurance'],
            (float) $breakdown['net'],
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
     * Kontrak BARU (keputusan owner 2026-09-18): asuransi TIDAK lagi pilihan
     * pembeli. Pengiriman toko selalu diasuransikan, biayanya selalu ikut ke
     * tagihan ongkir, dan tidak ada flag pilihan yang bisa mematikannya.
     */
    public function test_asuransi_selalu_ditagihkan_tanpa_pilihan_pembeli(): void
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

        $q = $svc->quote(30.0, 'KOTA BOGOR', 'JAWA BARAT', null, 'Bogor Barat', 5000000);

        $this->assertEquals(10000.0, (float) $q['insurance'], 'biaya 0,2% dari nilai barang');
        $this->assertEquals(10000.0, (float) $q['insurance_charged'], 'SELALU ditagihkan, tanpa pilihan');
        $this->assertEquals(5000000.0, (float) $q['insured_value']);
        $this->assertEquals(130000.0, (float) $q['net'], 'net = ongkir + asuransi (selalu)');
        $this->assertEquals(120000.0, (float) $q['freight'], 'ongkir tidak berubah karena asuransi');
        $this->assertArrayNotHasKey('insurance_selected', $q, 'tidak ada lagi flag pilihan');
        $this->assertArrayNotHasKey('insurance_available', $q, 'tidak ada lagi flag ketersediaan opsi');

        // Nilai pertanggungan mengikuti nilai barang, bukan angka tetap.
        $besar = $svc->quote(30.0, 'KOTA BOGOR', 'JAWA BARAT', null, 'Bogor Barat', 10283000);
        $this->assertEquals(20566.0, (float) $besar['insurance'], 'biaya ikut nilai barang');

        // Keranjang kosong: tidak ada nilai barang, jadi tidak ada biaya asuransi.
        $kosong = $svc->quote(30.0, 'KOTA BOGOR', 'JAWA BARAT', null, 'Bogor Barat', 0);
        $this->assertEquals(0.0, (float) $kosong['insurance']);
        $this->assertEquals(0.0, (float) $kosong['insurance_charged']);
        $this->assertEquals(120000.0, (float) $kosong['net'], 'net = ongkir saja tanpa asuransi');
    }
    /**
     * Penjaga: ongkir HANYA dari estimateCustomerCost (ongkos standar J&T).
     *
     * Saat offerFee dikirim, estimateSumFreight SUDAH memuat asuransi. Kalau
     * angka itu dipakai sebagai ongkir lalu asuransi ditambahkan lagi,
     * asuransi tertagih dua kali (ongkir membengkak). Test ini mengunci
     * kontraknya dengan J&T palsu yang meniru perilaku nyata.
     */
    public function test_ongkir_hanya_dari_estimatecustomercost(): void
    {
        ShippingSubsidySettings::update([
            'enabled' => false,
            'subsidy_type' => 'fixed',
            'subsidy_value' => 0,
            'jnt_enabled' => true,
        ]);

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

                // Bentuk balasan nyata J&T: customerCost = ongkos standar,
                // sumFreight = customerCost + asuransi.
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

        // Tanpa nilai barang: ongkir = 120.000 dan tidak ada asuransi.
        // sumFreight TIDAK BOLEH bocor jadi ongkir.
        $tanpa = $svc->quote(30.0, 'KOTA BOGOR', 'JAWA BARAT', null, 'Bogor Barat', 0);
        $this->assertEquals(120000.0, (float) $tanpa['freight'], 'ongkir dari estimateCustomerCost');
        $this->assertEquals(120000.0, (float) $tanpa['gross'], 'gross tanpa asuransi');
        $this->assertEquals(120000.0, (float) $tanpa['net'], 'net tanpa asuransi');
        $this->assertEquals(0.0, (float) $tanpa['insurance_charged']);

        // Dengan nilai barang: net = 120.000 + 10.000 = 130.000.
        // Kalau sumFreight dipakai sebagai ongkir, hasilnya 140.000 (dobel).
        $dengan = $svc->quote(30.0, 'KOTA BOGOR', 'JAWA BARAT', null, 'Bogor Barat', 5000000);
        $this->assertEquals(120000.0, (float) $dengan['freight'], 'ongkir tetap ongkos standar');
        $this->assertEquals(10000.0, (float) $dengan['insurance_charged']);
        $this->assertEquals(130000.0, (float) $dengan['net'], 'net = ongkir + asuransi (sekali)');
        $this->assertNotEquals(140000.0, (float) $dengan['net'], 'asuransi tidak boleh terhitung dua kali');
        $this->assertEquals(130000.0, (float) $dengan['gross'], 'gross memakai total J&T apa adanya');
    }

    /**
     * Penjaga: kalau J&T hanya memberi TOTAL (tanpa ongkos standar), ongkir
     * diturunkan dari angka J&T SENDIRI (total dikurangi asuransi yang ikut
     * di dalamnya) - bukan dari rumus tarif lokal, dan bukan dengan memakai
     * total mentah-mentah lalu menambah asuransi lagi.
     */
    public function test_jnt_tanpa_ongkos_standar_diturunkan_dari_angka_jnt(): void
    {
        ShippingSubsidySettings::update([
            'enabled' => false,
            'subsidy_type' => 'fixed',
            'subsidy_value' => 0,
            'jnt_enabled' => true,
        ]);

        $fake = new class extends \App\Services\Shipping\JntCargoClient
        {
            public function isEnabled(): bool
            {
                return true;
            }

            public function tariff(array $bizContent): \App\Services\Shipping\JntResponse
            {
                // Hanya sumFreight yang ada (sudah termasuk asuransi).
                return new \App\Services\Shipping\JntResponse(
                    ok: true,
                    httpStatus: 200,
                    data: ['data' => [
                        'estimateTime' => '1-3',
                        'estimateSumFreight' => '130000',
                        'estimateInsuranceCost' => '10000',
                    ]],
                    requestId: 'test',
                    elapsedMs: 1,
                );
            }
        };

        $this->app->instance(\App\Services\Shipping\JntCargoClient::class, $fake);
        $svc = app(\App\Services\ShippingService::class);

        $q = $svc->quote(30.0, 'KOTA BOGOR', 'JAWA BARAT', null, 'Bogor Barat', 5000000);

        // Ongkir diturunkan: 130.000 (total J&T) - 10.000 (asuransi J&T).
        $this->assertSame('ready', $q['state'], 'tarif J&T tetap dianggap final');
        $this->assertEquals(120000.0, (float) $q['freight'], 'ongkir = total J&T - asuransi');
        $this->assertEquals(10000.0, (float) $q['insurance_charged']);
        $this->assertEquals(130000.0, (float) $q['net'], 'net = ongkir + asuransi (sekali)');
        $this->assertNotEquals(140000.0, (float) $q['net'], 'asuransi tidak boleh terhitung dua kali');
        // Rumus tarif lokal TIDAK dipakai selama J&T memberi angka.
        $this->assertNotEquals(
            (float) config('shipping.local_base_rate', 15000) + 30.0 * (float) config('shipping.local_per_kg', 2000),
            (float) $q['freight'],
            'rumus tarif lokal tidak boleh dipakai'
        );
    }

}
