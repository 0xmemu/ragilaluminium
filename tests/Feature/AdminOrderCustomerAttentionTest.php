<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Penanda "perlu perhatian" di samping nama pelanggan pada daftar pesanan.
 *
 * Penandanya riwayat penolakan paket (dikembalikan kurir sebelum diterima dan
 * belum lunas), sama dengan yang dipakai laporan Performa Toko. Sifatnya HANYA
 * penanda visual: tidak memblokir COD, admin tetap yang memutuskan.
 */
class AdminOrderCustomerAttentionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    /** @param array<string, mixed> $overrides */
    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'ORD-ATT-'.uniqid(),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '628111111111',
            'shipping_address_line1' => 'Jl. Uji',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'order_status' => 'processing',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'payment_method' => 'cod',
            'cod_flag' => true,
            'subtotal_amount' => 500000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 500000,
        ], $overrides));
    }

    /**
     * Ambil kartu pesanan dengan nomor tertentu dari payload daftar.
     *
     * @return array<string, mixed>
     */
    private function card(string $orderNumber): array
    {
        $found = null;

        $this->actingAs($this->admin)
            ->get(route('admin.orders.index'))
            ->assertOk()
            ->assertInertia(function (Assert $page) use ($orderNumber, &$found) {
                foreach ($page->toArray()['props']['orders'] as $card) {
                    if (($card['order_number'] ?? null) === $orderNumber) {
                        $found = $card;
                    }
                }
            });

        $this->assertNotNull($found, 'kartu pesanan '.$orderNumber.' ada di daftar');

        return $found;
    }

    public function test_pelanggan_dengan_riwayat_penolakan_ditandai(): void
    {
        $this->makeOrder([
            'order_number' => 'ORD-ATT-DITOLAK',
            'customer_phone' => '628123456789',
            'order_status' => 'return_completed',
        ]);
        $aktif = $this->makeOrder([
            'order_number' => 'ORD-ATT-AKTIF',
            'customer_phone' => '628123456789',
        ]);

        $card = $this->card('ORD-ATT-AKTIF');

        $this->assertNotNull($card['attention'], 'pelanggan dengan riwayat penolakan ditandai');
        $this->assertSame('refused_package', $card['attention']['kind']);
        $this->assertSame(1, $card['attention']['count']);
        $this->assertSame('Perlu perhatian', $card['attention']['label']);
        $this->assertStringContainsString('dikembalikan kurir', $card['attention']['hint']);
        $this->assertSame('628123456789', $aktif->customer_phone);
    }

    public function test_pelanggan_tanpa_riwayat_tidak_ditandai(): void
    {
        $this->makeOrder(['order_number' => 'ORD-ATT-BERSIH', 'customer_phone' => '628999999999']);

        $card = $this->card('ORD-ATT-BERSIH');

        $this->assertNull($card['attention']);
    }

    public function test_pesanan_yang_sudah_lunas_tidak_menandai_pelanggan(): void
    {
        $this->makeOrder([
            'order_number' => 'ORD-ATT-LUNAS',
            'customer_phone' => '628555555555',
            'order_status' => 'return_completed',
            'payment_status' => 'paid',
        ]);
        $this->makeOrder(['order_number' => 'ORD-ATT-BARU', 'customer_phone' => '628555555555']);

        $card = $this->card('ORD-ATT-BARU');

        $this->assertNull($card['attention'], 'uang sudah diterima: tidak ada kas yang batal');
    }

    public function test_retur_yang_masih_berjalan_sudah_ditandai(): void
    {
        $this->makeOrder([
            'order_number' => 'ORD-ATT-PROSES',
            'customer_phone' => '628777777777',
            'order_status' => 'return_in_process',
        ]);
        $this->makeOrder(['order_number' => 'ORD-ATT-LANJUT', 'customer_phone' => '628777777777']);

        $card = $this->card('ORD-ATT-LANJUT');

        // Peringatan dini: admin sudah waspada sebelum retur selesai.
        $this->assertNotNull($card['attention']);
        $this->assertSame(1, $card['attention']['count']);
    }

    public function test_jumlah_penolakan_dihitung_akumulatif(): void
    {
        foreach (['A', 'B'] as $suffix) {
            $this->makeOrder([
                'order_number' => 'ORD-ATT-TOLAK-'.$suffix,
                'customer_phone' => '628444444444',
                'order_status' => 'return_completed',
            ]);
        }
        $this->makeOrder(['order_number' => 'ORD-ATT-TERBARU', 'customer_phone' => '628444444444']);

        $card = $this->card('ORD-ATT-TERBARU');

        $this->assertNotNull($card['attention']);
        $this->assertSame(2, $card['attention']['count']);
        $this->assertStringContainsString('2 paket', $card['attention']['hint']);
    }

    public function test_nomor_dengan_format_berbeda_tetap_dicocokkan(): void
    {
        // Riwayat tersimpan sebagai 08..., pesanan aktif tersimpan 628...
        // Keduanya wajib terbaca sebagai pelanggan yang sama.
        $this->makeOrder([
            'order_number' => 'ORD-ATT-FORMAT-LAMA',
            'customer_phone' => '081234567890',
            'order_status' => 'return_completed',
        ]);
        $this->makeOrder([
            'order_number' => 'ORD-ATT-FORMAT-BARU',
            'customer_phone' => '6281234567890',
        ]);

        $card = $this->card('ORD-ATT-FORMAT-BARU');

        $this->assertNotNull($card['attention'], 'format 08 dan 628 dianggap satu pelanggan');
        $this->assertSame(1, $card['attention']['count']);
    }

    public function test_riwayat_pelanggan_lain_tidak_menular(): void
    {
        $this->makeOrder([
            'order_number' => 'ORD-ATT-ORANG-LAIN',
            'customer_phone' => '628111222333',
            'order_status' => 'return_completed',
        ]);
        $this->makeOrder(['order_number' => 'ORD-ATT-KOTA-SAMA', 'customer_phone' => '628333222111']);

        $card = $this->card('ORD-ATT-KOTA-SAMA');

        $this->assertNull($card['attention'], 'penandaan per nomor, bukan per kota');
    }

    public function test_pesanan_dibatalkan_biasa_tidak_ditandai(): void
    {
        // Dibatalkan sebelum dikirim bukan penolakan paket: tidak ada ongkir
        // yang hangus karena barang tidak pernah jalan.
        $this->makeOrder([
            'order_number' => 'ORD-ATT-BATAL',
            'customer_phone' => '628666666666',
            'order_status' => 'cancelled',
        ]);
        $this->makeOrder(['order_number' => 'ORD-ATT-SESUDAH', 'customer_phone' => '628666666666']);

        $card = $this->card('ORD-ATT-SESUDAH');

        $this->assertNull($card['attention']);
    }
}
