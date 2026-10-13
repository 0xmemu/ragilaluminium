<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\OrderReturnItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

/**
 * Aksi utama "Selesaikan Retur" pada daftar pesanan.
 *
 * Sejak owner 2026-09-29 aksi itu membuka POPUP penyelesaian di tempat, bukan
 * menautkan ke halaman detail: panel "Retur & penyelesaian" di halaman detail
 * sudah dihapus, jadi seluruh aksi retur (selesaikan, void, koreksi) hidup di
 * popup yang dibuka dari daftar. Karena itu kartu daftar WAJIB membawa data
 * kasus returnya; tanpa itu popupnya tidak punya apa pun untuk ditampilkan.
 *
 * Bagian perender hidup di berkas TSX dan tidak terlihat dari respons Inertia,
 * jadi diperiksa dengan membaca sumber, sama seperti
 * AdminTestimonialReplyColumnTest.
 */
class AdminOrderActionColumnTest extends TestCase
{
    use RefreshDatabase;
    use CreatesVisibleProducts;

    private function halaman(): string
    {
        $isi = file_get_contents(base_path('resources/js/pages/Admin/Orders/Index.tsx'));
        $this->assertNotFalse($isi, 'halaman daftar pesanan harus terbaca');

        return (string) $isi;
    }

    public function test_penyelesaian_retur_membuka_popup_bukan_pindah_halaman(): void
    {
        $isi = $this->halaman();

        $this->assertMatchesRegularExpression(
            '~order\.primary_action\?\.kind === "complete_return"~',
            $isi,
            'Aksi penyelesaian retur harus punya cabang sendiri yang membuka popup.'
        );

        $this->assertStringContainsString(
            'onSelesaikanRetur?.(order)',
            $isi,
            'Cabang itu harus memanggil pembuka popup, bukan memakai tautan.'
        );

        $this->assertStringContainsString(
            '<OrderReturnCaseDialog',
            $isi,
            'Popup penanganan kasus retur harus dirender di halaman daftar.'
        );

        $this->assertStringNotContainsString(
            '#return-case',
            $isi,
            'Anchor #return-case sudah tidak ada karena panelnya dihapus.'
        );
    }

    public function test_halaman_detail_tidak_lagi_punya_panel_retur(): void
    {
        $detail = (string) file_get_contents(base_path('resources/js/pages/Admin/Orders/Show.tsx'));

        $this->assertStringNotContainsString(
            'ReturnCasePanel',
            $detail,
            'Panel retur di halaman detail harus sudah dihapus.'
        );
        $this->assertStringNotContainsString(
            'id="return-case"',
            $detail,
            'Anchor panel retur harus hilang bersama panelnya.'
        );
    }

    public function test_kasus_retur_selesai_punya_jalan_masuk_di_daftar(): void
    {
        $isi = $this->halaman();

        $this->assertMatchesRegularExpression(
            '~\(order\.return_cases\?\.length \?\? 0\) > 0~',
            $isi,
            'Pesanan yang punya kasus retur harus bisa membuka popupnya dari daftar.'
        );

        $this->assertStringContainsString(
            'Lihat retur',
            $isi,
            'Kasus retur di luar status Retur Diproses (mis. yang sudah selesai) butuh '
                .'tombol jalan masuk, kalau tidak koreksi dan void-nya tidak bisa dipakai '
                .'setelah panel halaman detail dihapus.'
        );

        $this->assertMatchesRegularExpression(
            '~order\.primary_action\?\.kind !== "complete_return"~',
            $isi,
            'Tombol jalan masuk itu tidak boleh dobel dengan tombol Selesaikan Retur.'
        );
    }

    public function test_aksi_utama_lain_yang_bertauutan_tetap_dirender(): void
    {
        $isi = $this->halaman();

        $this->assertMatchesRegularExpression(
            '~:\s*order\.primary_action\?\.href\s*\?~',
            $isi,
            'Cabang tautan tetap disediakan untuk aksi utama lain yang hanya menautkan.'
        );
    }

    public function test_kartu_pesanan_membawa_data_kasus_retur_untuk_popup(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        [$order, $item] = $this->pesananReturDiproses();

        $kasus = OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'open',
            'reason' => 'rusak',
            'fault_party' => 'store',
            'shipping_cost_borne_by_store' => true,
            'created_by_user_id' => $admin->id,
        ]);
        OrderReturnItem::create([
            'return_case_id' => $kasus->id,
            'order_item_id' => $item->id,
            'requested_quantity' => 1,
            'returned_quantity' => 0,
        ]);

        $kartu = null;
        $aksi = null;

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['order_status' => 'return_in_process']))
            ->assertOk()
            ->assertInertia(function (Assert $page) use ($order, &$kartu, &$aksi) {
                foreach ($page->toArray()['props']['orders'] as $baris) {
                    if (($baris['id'] ?? null) === $order->id) {
                        $kartu = $baris;
                        $aksi = $baris['primary_action'] ?? null;
                    }
                }
            });

        $this->assertNotNull($kartu, 'pesanan retur harus muncul di kartu daftar.');

        // Aksi: penyelesaian retur tanpa tautan lagi.
        $this->assertSame('complete_return', $aksi['kind']);
        $this->assertNull($aksi['next_status']);
        $this->assertArrayNotHasKey('href', $aksi, 'Aksi popup tidak boleh membawa tautan halaman detail.');

        // Data untuk popup: kasus + itemnya, dan jumlah pembayaran untuk batas refund.
        $this->assertCount(1, $kartu['return_cases']);
        $this->assertSame($kasus->id, $kartu['return_cases'][0]['id']);
        $this->assertSame('open', $kartu['return_cases'][0]['status']);
        $this->assertSame('rusak', $kartu['return_cases'][0]['reason']);
        $this->assertCount(1, $kartu['return_cases'][0]['items']);
        $this->assertSame($item->id, $kartu['return_cases'][0]['items'][0]['order_item_id']);
        $this->assertSame(1, $kartu['return_cases'][0]['items'][0]['requested_quantity']);
        $this->assertArrayHasKey('return_adjustments', $kartu);
        $this->assertArrayHasKey('paid_amount', $kartu);
    }

    /** @return array{0: Order, 1: OrderItem} */
    private function pesananReturDiproses(): array
    {
        $order = Order::create([
            'order_number' => 'AKSI-'.strtoupper(uniqid()),
            'customer_name' => 'Budi',
            'customer_phone' => '6285725116817',
            'shipping_address_line1' => 'Jl. Uji No. 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => 'return_in_process',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 100000,
            'shipping_amount' => 10000,
            'discount_amount' => 0,
            'total_amount' => 110000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        $product = $this->createVisibleProduct([
            'parent_sku' => 'AKSI-'.strtoupper(uniqid()),
            'name' => 'Produk Uji Aksi',
        ]);
        $variant = $product->variants()->first();

        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => $product->parent_sku,
            'variant_sku' => $variant->variant_sku,
            'name' => $product->name,
            'unit_price' => 100000,
            'quantity' => 1,
            'line_subtotal' => 100000,
            'line_discount' => 0,
            'line_total' => 100000,
        ]);

        return [$order, $item];
    }
}
