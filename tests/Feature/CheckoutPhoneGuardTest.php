<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Penjaga nomor WhatsApp di formulir detail pengiriman checkout
 * (owner 2026-09-27): nomor yang tidak terdaftar WhatsApp ditolak di
 * formulir dengan pesan jelas, bukan setelah pesanan dibuat.
 *
 * Kontrak:
 * - /api/on-whatsapp menjawab tanpa nomor kita (Baileys menyaring nomor
 *   mati) -> validasi gagal di kolom phone dan detail tidak disimpan sesi.
 * - exists=true atau endpoint tidak tersedia (404) -> detail diterima
 *   (fail-open); cek saat pengiriman tetap berjalan sebagai lapis kedua.
 */
class CheckoutPhoneGuardTest extends TestCase
{
    use RefreshDatabase;

    private function details(): array
    {
        return [
            'name' => 'Budi', 'phone' => '081234567890', 'address_line1' => 'Jl A No 1',
            'province' => 'JAWA BARAT', 'city' => 'KOTA BANDUNG', 'district' => 'COBLONG',
            'village' => 'LEBAK GEDE', 'province_id' => '32', 'city_id' => '3273',
            'district_id' => '3273010', 'village_id' => '3273010001', 'postal_code' => '40132',
        ];
    }

    public function test_nomor_tidak_terdaftar_ditolak_di_formulir(): void
    {
        Http::fake([
            // Baileys menyaring nomor mati: hasil kosong berarti tidak terdaftar.
            '*/api/on-whatsapp' => Http::response(['results' => []], 200),
            '*' => Http::response(['id' => 'WA-1'], 200),
        ]);

        $response = $this->post('/checkout/validate', $this->details());

        $response->assertRedirect();
        $response->assertSessionHasErrors('phone');
        $this->assertNull(session('checkout_details'));
    }

    public function test_nomor_terdaftar_diterima(): void
    {
        Http::fake([
            '*/api/on-whatsapp' => Http::response([
                'results' => [['jid' => '6281234567890@s.whatsapp.net', 'exists' => true]],
            ], 200),
            '*' => Http::response(['id' => 'WA-2'], 200),
        ]);

        $response = $this->post('/checkout/validate', $this->details());

        $response->assertRedirect();
        $response->assertSessionHas('checkout_details');
        $response->assertSessionHasNoErrors();
    }

    public function test_endpoint_tidak_tersedia_diterima_juga(): void
    {
        Http::fake([
            '*/api/on-whatsapp' => Http::response([], 404),
            '*' => Http::response(['id' => 'WA-3'], 200),
        ]);

        $response = $this->post('/checkout/validate', $this->details());

        $response->assertRedirect();
        $response->assertSessionHas('checkout_details');
        $response->assertSessionHasNoErrors();
    }
}
