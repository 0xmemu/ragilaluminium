<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Halaman detail promo: produk terjual per kampanye (Diskon Reguler & Flash Sale).
 *
 * Kontrak yang dikunci:
 * - Halaman detail dapat dibuka untuk kedua tipe kampanye.
 * - Baris produk = target kampanye; urut dari yang paling banyak terjual.
 * - Hanya pesanan scope omzet yang dihitung (menunggu konfirmasi tidak masuk).
 * - Penjualan hanya dihitung pada periode kampanye, tanpa rentang "semua waktu".
 */
class PromotionDetailTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function product(string $name, string $sku): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => $name,
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'JUNGKIT',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    private function order(Product $product, string $status, int $qty, float $lineTotal): Order
    {
        static $seq = 0;
        $seq++;

        $order = Order::create([
            'order_number' => 'ORD2609'.str_pad((string) $seq, 4, '0', STR_PAD_LEFT),
            'customer_name' => 'Pembeli Uji',
            'customer_phone' => '6281234567890',
            'shipping_address_line1' => 'Jl. Uji No. 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => $status,
            'payment_status' => $status === 'completed' ? 'paid' : 'pending',
            'payment_method' => 'transfer',
            'subtotal_amount' => $lineTotal,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'voucher_discount_amount' => 0,
            'total_amount' => $lineTotal,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'quantity' => $qty,
            'unit_price' => $qty > 0 ? $lineTotal / $qty : 0,
            'line_subtotal' => $lineTotal,
            'line_discount' => 0,
            'discount_source' => 'reg',
            'line_total' => $lineTotal,
        ]);

        return $order;
    }

    private function campaign(string $type, Product ...$products): Promotion
    {
        $promotion = Promotion::create([
            'type' => $type,
            'name' => 'Kampanye Uji '.$type,
            'status' => Promotion::STATUS_ACTIVE,
            'starts_at' => now()->subDays(5),
            'ends_at' => now()->addDays(5),
            'discount_percent' => 10,
        ]);

        foreach ($products as $product) {
            PromotionItem::create([
                'promotion_id' => $promotion->id,
                'target_type' => PromotionItem::TARGET_PRODUCT,
                'target_id' => (string) $product->id,
                'excluded' => false,
            ]);
        }

        return $promotion;
    }

    public function test_detail_promo_menampilkan_produk_terjual_urut_terlaris(): void
    {
        $admin = $this->admin();
        $laris = $this->product('Produk Laris', 'RA-DETAIL-A');
        $sepi = $this->product('Produk Sepi', 'RA-DETAIL-B');

        $this->order($laris, 'completed', 3, 3_000_000);
        $this->order($sepi, 'processing', 1, 900_000);

        $promotion = $this->campaign(Promotion::TYPE_STORE, $laris, $sepi);

        $this->actingAs($admin)
            ->get(route('admin.promotions.show', $promotion))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/PromotionDetail')
                ->where('promotion.type_label', 'Diskon Reguler')
                ->where('report.totals.qty', 4)
                ->where('report.totals.revenue', 3_900_000)
                ->where('report.rows.0.name', 'Produk Laris')
                ->where('report.rows.0.qty', 3)
                ->where('report.rows.1.name', 'Produk Sepi')
                ->where('report.rows.1.qty', 1));
    }

    public function test_flash_sale_pakai_halaman_detail_yang_sama(): void
    {
        $admin = $this->admin();
        $product = $this->product('Produk Flash', 'RA-DETAIL-C');
        $this->order($product, 'delivered', 2, 1_800_000);

        $flash = $this->campaign(Promotion::TYPE_FLASH_SALE, $product);

        $this->actingAs($admin)
            ->get(route('admin.promotions.show', $flash))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/PromotionDetail')
                ->where('promotion.type_label', 'Flash Sale')
                ->where('report.totals.qty', 2));
    }

    public function test_pesanan_menunggu_konfirmasi_tidak_dihitung(): void
    {
        $admin = $this->admin();
        $product = $this->product('Produk Pending', 'RA-DETAIL-D');

        $this->order($product, 'awaiting_confirmation', 5, 5_000_000);
        $this->order($product, 'cancelled', 4, 4_000_000);

        $promotion = $this->campaign(Promotion::TYPE_STORE, $product);

        $this->actingAs($admin)
            ->get(route('admin.promotions.show', $promotion))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('report.totals.qty', 0)
                ->where('report.totals.orders', 0)
                ->where('report.totals.products', 1)
                ->where('report.rows.0.qty', 0));
    }

    public function test_produk_tanpa_penjualan_tetap_tampil(): void
    {
        $admin = $this->admin();
        $terjual = $this->product('Produk Terjual', 'RA-DETAIL-E');
        $belum = $this->product('Produk Belum Terjual', 'RA-DETAIL-F');

        $this->order($terjual, 'completed', 1, 1_000_000);

        $promotion = $this->campaign(Promotion::TYPE_STORE, $terjual, $belum);

        $this->actingAs($admin)
            ->get(route('admin.promotions.show', $promotion))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('report.totals.products', 2)
                ->where('report.totals.sold_products', 1)
                ->where('report.totals.unsold_products', 1)
                ->has('report.rows', 2));
    }

    public function test_daftar_promo_mengirim_tautan_detail(): void
    {
        $admin = $this->admin();
        $product = $this->product('Produk Daftar', 'RA-DETAIL-H');
        $promotion = $this->campaign(Promotion::TYPE_STORE, $product);

        $this->actingAs($admin)
            ->get(route('admin.promotions.index', ['type' => 'store']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('title', 'Diskon Reguler')
                ->where('typeOptions.0.label', 'Diskon Reguler')
                ->where('rows.0.detail_href', route('admin.promotions.show', $promotion)));
    }

    /**
     * Kontrak 2026-09-29: tabel "Produk dalam kampanye" menampilkan matrik
     * dilihat dan diklik (pengganti kolom Nilai) dengan rentang yang sama
     * seperti penjualan, yaitu periode kampanye.
     *
     * Catatan fixture: metrik disisipkan lewat DB::table karena cast date pada
     * PerformanceMetric menyimpan "Y-m-d 00:00:00" di sqlite, sehingga
     * pencocokan tanggal lewat model tidak dapat diandalkan.
     */
    public function test_detail_promo_menampilkan_dilihat_dan_diklik_pada_periode_kampanye(): void
    {
        $admin = $this->admin();
        $produk = $this->product('Produk Dilirik', 'RA-DETAIL-V');

        $promotion = $this->campaign(Promotion::TYPE_STORE, $produk);

        // Dalam periode kampanye: dihitung.
        $this->metric($produk->id, 'product_views', now()->subDay()->toDateString(), 7);
        $this->metric($produk->id, 'product_clicks', now()->subDay()->toDateString(), 3);
        // Di luar periode kampanye (sebelum starts_at): tidak dihitung.
        $this->metric($produk->id, 'product_views', now()->subDays(30)->toDateString(), 99);
        // Produk lain: tidak boleh bocor ke baris produk ini.
        $lain = $this->product('Produk Lain', 'RA-DETAIL-W');
        $this->metric($lain->id, 'product_views', now()->subDay()->toDateString(), 50);

        $this->actingAs($admin)
            ->get(route('admin.promotions.show', $promotion))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/PromotionDetail')
                ->has('report.rows', 1)
                ->where('report.rows.0.name', 'Produk Dilirik')
                ->where('report.rows.0.views', 7)
                ->where('report.rows.0.clicks', 3));
    }

    private function metric(int $productId, string $metricName, string $date, int $value): void
    {
        DB::table('performance_metrics')->insert([
            'metric_date' => $date,
            'metric_name' => $metricName,
            'metric_value' => $value,
            'context' => json_encode(['product_id' => $productId]),
            'context_hash' => md5(json_encode(['product_id' => $productId])),
            'created_at' => now(),
        ]);
    }
}
