<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Urutan daftar produk admin (/admin/kelola/produk).
 *
 * Kontrak: "baru saja diubah" memakai updated_at supaya hasil import dan hasil
 * edit sama-sama terangkat, dan urutan "terlaris" memakai validOrderItems yang
 * sama dengan sumber popularitas storefront.
 */
class AdminProductListSortTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function product(string $sku, string $name): Product
    {
        return Product::create([
            'parent_sku' => $sku,
            'name' => $name,
            'category_id' => 1,
            'product_category' => 'WINDOW',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
        ]);
    }

    /**
     * Set kolom waktu langsung lewat query builder supaya urutan deterministik;
     * lewat Eloquent, updated_at selalu ditimpa waktu sekarang.
     */
    private function setTimestamps(Product $product, string $updatedAt, string $createdAt): void
    {
        DB::table('products')->where('id', $product->id)->update([
            'updated_at' => $updatedAt,
            'created_at' => $createdAt,
        ]);
    }

    private function sell(Product $product, int $quantity): void
    {
        $order = Order::create([
            'order_number' => 'RA-SORT-'.$product->id.'-'.$quantity,
            'customer_name' => 'Uji Urutan',
            'customer_phone' => '081111111111',
            'shipping_address_line1' => 'Jl Uji',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 50000 * $quantity,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 50000 * $quantity,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'unit_price' => 50000,
            'quantity' => $quantity,
            'line_subtotal' => 50000 * $quantity,
            'line_discount' => 0,
            'line_total' => 50000 * $quantity,
        ]);
    }

    /**
     * Tiga produk dengan penjualan dan waktu berbeda:
     *   Alfa  = belum pernah terjual, diubah paling lama lalu
     *   Beta  = terjual 5, diubah paling baru
     *   Gama  = terjual 12, diubah di antaranya
     *
     * @return array{0: Product, 1: Product, 2: Product}
     */
    private function seedProducts(): array
    {
        $alfa = $this->product('SORT-ALFA', 'Alfa');
        $beta = $this->product('SORT-BETA', 'Beta');
        $gama = $this->product('SORT-GAMA', 'Gama');

        $this->setTimestamps($alfa, '2026-01-01 08:00:00', '2026-01-05 08:00:00');
        $this->setTimestamps($beta, '2026-03-01 08:00:00', '2026-01-01 08:00:00');
        $this->setTimestamps($gama, '2026-02-01 08:00:00', '2026-01-03 08:00:00');

        $this->sell($beta, 5);
        $this->sell($gama, 12);

        return [$alfa, $beta, $gama];
    }

    /** @return array{skus: list<string>, activeSort: string, sorts: list<string>} */
    private function fetchList(array $query = []): array
    {
        $payload = [];

        $this->actingAs($this->admin)
            ->get(route('admin.products.index', $query))
            ->assertOk()
            ->assertInertia(function (Assert $page) use (&$payload) {
                $props = $page->toArray()['props'];
                $payload = [
                    'skus' => collect($props['products'])->pluck('parent_sku')->all(),
                    'activeSort' => $props['activeSort'],
                    'sorts' => collect($props['filterOptions']['sorts'])->pluck('value')->all(),
                ];
            });

        return $payload;
    }

    public function test_default_order_is_most_recently_updated(): void
    {
        $this->seedProducts();

        $result = $this->fetchList();

        // Tanpa parameter sort, urutan default = baru saja diubah.
        $this->assertSame('updated_desc', $result['activeSort']);
        $this->assertSame(['SORT-BETA', 'SORT-GAMA', 'SORT-ALFA'], $result['skus']);
    }

    public function test_updated_asc_puts_longest_untouched_first(): void
    {
        $this->seedProducts();

        $result = $this->fetchList(['sort' => 'updated_asc']);

        $this->assertSame('updated_asc', $result['activeSort']);
        $this->assertSame(['SORT-ALFA', 'SORT-GAMA', 'SORT-BETA'], $result['skus']);
    }

    public function test_sold_desc_ranks_best_seller_first(): void
    {
        $this->seedProducts();

        $result = $this->fetchList(['sort' => 'sold_desc']);

        $this->assertSame(['SORT-GAMA', 'SORT-BETA', 'SORT-ALFA'], $result['skus']);
    }

    public function test_sold_asc_ranks_least_sold_first_including_never_sold(): void
    {
        $this->seedProducts();

        $result = $this->fetchList(['sort' => 'sold_asc']);

        // Produk tanpa penjualan bernilai NULL sehingga berada paling depan.
        $this->assertSame(['SORT-ALFA', 'SORT-BETA', 'SORT-GAMA'], $result['skus']);
    }

    public function test_created_desc_follows_creation_time_not_update_time(): void
    {
        $this->seedProducts();

        $result = $this->fetchList(['sort' => 'created_desc']);

        // Alfa dibuat paling akhir meski diubah paling lama.
        $this->assertSame(['SORT-ALFA', 'SORT-GAMA', 'SORT-BETA'], $result['skus']);
    }

    public function test_unknown_sort_falls_back_to_default(): void
    {
        $this->seedProducts();

        $result = $this->fetchList(['sort' => 'drop_table_products']);

        $this->assertSame('updated_desc', $result['activeSort']);
        $this->assertSame(['SORT-BETA', 'SORT-GAMA', 'SORT-ALFA'], $result['skus']);
    }

    public function test_all_documented_sort_keys_are_exposed_to_the_page(): void
    {
        $result = $this->fetchList();

        $this->assertSame([
            'updated_desc',
            'updated_asc',
            'sold_desc',
            'sold_asc',
            'created_desc',
            'created_asc',
        ], $result['sorts']);
    }

    public function test_sort_combines_with_search_and_status_filters(): void
    {
        [$alfa] = $this->seedProducts();

        DB::table('products')->where('id', $alfa->id)->update(['status' => 'archived']);

        $result = $this->fetchList([
            'sort' => 'sold_asc',
            'status' => 'archived',
            'q' => 'Alfa',
        ]);

        $this->assertSame(['SORT-ALFA'], $result['skus']);
    }
}
