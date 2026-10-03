<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Kontrak tombol Kembali untuk halaman yang punya entri SENDIRI di menu sidebar
 * (koreksi owner 2026-10-03).
 *
 * Halaman item sidebar tidak punya halaman induk, jadi tombol Kembali di sana
 * hanya bisa menunjuk halaman SAUDARA dan itu membingungkan. Kasus nyata yang
 * memicu aturan ini: Media Library (dulu mengirim tombol tanpa syarat) dan
 * Teruskan Popularitas (mengirim tombol ke daftar Produk, padahal keduanya
 * sama-sama item sidebar).
 *
 * Halaman item sidebar yang memang punya alur masuk dari halaman lain boleh
 * memakai tombol Kembali SECARA BERSYARAT (contoh: Media Library memakai
 * penanda `origin=products`). Test ini memeriksa permintaan polosnya, yaitu
 * saat halaman dibuka langsung dari sidebar, dan di situ tombolnya harus tidak
 * ada.
 *
 * Kelas kebalikannya dijaga test lain: halaman ANAK (bukan item sidebar) wajib
 * punya jalan kembali, lihat AdminPromoPagesBackButtonTest dan
 * AdminMediaBackButtonTest.
 */
class AdminSidebarPagesBackButtonTest extends TestCase
{
    use RefreshDatabase;

    public function test_halaman_item_sidebar_tidak_memakai_tombol_kembali(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $pelanggar = [];
        $diperiksa = 0;

        foreach ($this->itemSidebar() as $nama) {
            if (! Route::has($nama)) {
                continue;
            }

            $respons = $this->actingAs($admin)->get(route($nama));
            $respons->assertOk();

            $props = $respons->viewData('page')['props'] ?? [];
            $diperiksa++;

            $nilai = $props['backUrl'] ?? null;
            if ($nilai !== null) {
                $pelanggar[] = $nama.' -> '.$nilai;
            }
        }

        // Jaring pengaman: kalau daftar menu berubah bentuk, test tidak boleh
        // lulus diam-diam karena tidak memeriksa apa pun.
        $this->assertGreaterThan(
            25,
            $diperiksa,
            'jumlah halaman item sidebar yang diperiksa tidak wajar',
        );

        $this->assertSame(
            [],
            $pelanggar,
            "Halaman item sidebar tidak boleh memakai tombol Kembali:\n".implode("\n", $pelanggar),
        );
    }

    /**
     * Kontrol positif: alat ukur test ini benar-benar bisa MELIHAT backUrl.
     *
     * Tanpa kasus ini, test di atas bisa lulus semu (mis. kalau cara membaca
     * props-nya salah sehingga selalu terbaca null). Halaman anak yang memang
     * memakai tombol Kembali harus terbaca nilainya lewat cara yang sama.
     */
    public function test_alat_ukur_melihat_back_url_pada_halaman_anak(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $respons = $this->actingAs($admin)->get(route('admin.masalah-solusi.create'));
        $respons->assertOk();

        $props = $respons->viewData('page')['props'] ?? [];

        $this->assertSame(
            route('admin.masalah-solusi.index'),
            $props['backUrl'] ?? null,
            'halaman anak yang memakai tombol Kembali harus terbaca nilainya',
        );
    }

    /**
     * Kelas kebalikannya juga dijaga: halaman daftar Pembayaran adalah item
     * sidebar, jadi tanpa tombol; versi per pesanan (dibuka dari detail
     * pesanan) justru punya.
     */
    public function test_pembayaran_per_pesanan_punya_tombol_kembali_ke_pesanan(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $order = \App\Models\Order::create([
            'order_number' => 'ORD-BACK-1',
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '081200000123',
            'shipping_address_line1' => 'Jl Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'processing',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
        ]);

        $respons = $this->actingAs($admin)->get(route('admin.orders.payments', $order));
        $respons->assertOk();

        $props = $respons->viewData('page')['props'] ?? [];

        $this->assertSame(
            route('admin.orders.show', $order),
            $props['backUrl'] ?? null,
        );
    }

    /**
     * Daftar route item menu sidebar, dibaca dari konfigurasi supaya item baru
     * ikut terjaga otomatis tanpa menyunting test ini.
     *
     * @return list<string>
     */
    private function itemSidebar(): array
    {
        $rute = [];

        foreach (config('admin-sitemap.navigation', []) as $grup) {
            foreach (($grup['items'] ?? []) as $item) {
                if (! empty($item['route'])) {
                    $rute[] = (string) $item['route'];
                }
            }
        }

        return array_values(array_unique($rute));
    }
}
