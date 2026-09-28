<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Kolom Aksi daftar pesanan wajib merender SEMUA bentuk aksi utama yang dikirim
 * server, bukan hanya aksi yang mengubah status.
 *
 * Insiden 2026-09-28: pada status Retur diproses server mengirim aksi
 * "Selesaikan Retur" (kind complete_return, next_status null, href menuju panel
 * retur di halaman detail). Pengisi daftar hanya merender aksi yang punya
 * next_status, jadi kolom Aksi kosong untuk pesanan yang sedang diretur dan
 * admin tidak punya jalan masuk ke form penyelesaiannya.
 *
 * Bagian perender hidup di berkas TSX dan tidak terlihat dari respons Inertia,
 * jadi diperiksa dengan membaca sumber, sama seperti
 * AdminTestimonialReplyColumnTest.
 */
class AdminOrderActionColumnTest extends TestCase
{
    use RefreshDatabase;

    private function halaman(): string
    {
        $isi = file_get_contents(base_path('resources/js/pages/Admin/Orders/Index.tsx'));
        $this->assertNotFalse($isi, 'halaman daftar pesanan harus terbaca');

        return (string) $isi;
    }

    public function test_aksi_utama_yang_hanya_menautkan_dirender_di_kolom_aksi(): void
    {
        $isi = $this->halaman();

        $this->assertMatchesRegularExpression(
            '~:\s*order\.primary_action\?\.href\s*\?~',
            $isi,
            'Cabang tautan wajib jadi fallback setelah cabang next_status/input_resi, '
                .'supaya aksi tanpa next_status tidak hilang dari kolom Aksi.'
        );

        $this->assertMatchesRegularExpression(
            '~<Link href=\{order\.primary_action\.href\}>\{order\.primary_action\.label\}</Link>~',
            $isi,
            'Cabang tautan harus memakai label dan tautan dari server, bukan teks tetap, '
                .'supaya labelnya ikut berubah bila server mengganti aksi.'
        );
    }

    public function test_pesanan_retur_diproses_membawa_aksi_selesaikan_retur_bertauutan(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        Order::create([
            'order_number' => 'AKSI-'.strtoupper(uniqid()),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
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

        $aksi = null;

        $this->actingAs($admin)
            ->get(route('admin.orders.index', ['order_status' => 'return_in_process']))
            ->assertOk()
            ->assertInertia(function (Assert $page) use (&$aksi) {
                foreach ($page->toArray()['props']['orders'] as $kartu) {
                    $aksi = $kartu['primary_action'] ?? null;
                }
            });

        $this->assertNotNull($aksi, 'pesanan Retur diproses harus muncul di filter ini.');
        $this->assertSame('complete_return', $aksi['kind']);
        $this->assertNull(
            $aksi['next_status'],
            'Aksi ini tidak mengubah status, jadi wajib dibuka lewat tautan. '
                .'Bila next_status terisi, test cabang tautan di atas jadi tidak relevan.'
        );
        $this->assertStringContainsString('#return-case', (string) $aksi['href']);
    }
}
