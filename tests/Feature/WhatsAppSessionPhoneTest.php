<?php

namespace Tests\Feature;

use App\Support\ConsultationWhatsApp;
use App\Support\OperationalSettings;
use App\Support\WhatsAppSessionPhone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Nomor WhatsApp di seluruh website (kontrak owner 2026-09-18):
 *
 *   1. Nomor yang diisi admin di Profil & Kontak Toko (CMS 'kontak') = SUMBER
 *      UTAMA. Perubahan nomor di sana langsung berlaku di storefront.
 *   2. Nomor sesi Baileys = CADANGAN, dipakai hanya bila admin belum mengisi
 *      nomor toko. Saat perangkat terputus, nomor terakhir TETAP dipakai
 *      sampai nomor baru benar-benar tersambung.
 *
 * Karena test memakai RefreshDatabase (tanpa baris CMS 'kontak'), seluruh test
 * di berkas ini berjalan pada cabang CADANGAN - itulah perilaku yang diuji di
 * bawah (nomor sesi tersimpan, tetap dipakai saat gateway putus, dsb).
 */
class WhatsAppSessionPhoneTest extends TestCase
{
    use RefreshDatabase;

    private function gatewayBase(): string
    {
        return 'http://127.0.0.1:3005';
    }

    private function setGateway(): void
    {
        config([
            'services.whatsapp.baileys.base_url' => $this->gatewayBase(),
            'services.whatsapp.baileys.api_key' => 'test-key',
        ]);
    }

    public function test_connected_gateway_stores_phone_and_storefront_follows_it(): void
    {
        $this->setGateway();
        config([
            'services.whatsapp.business_phone' => '6281776370707',
            'sitemap.brand.phone' => '+62 851-9966-6810',
        ]);

        Http::fake([
            $this->gatewayBase().'/status' => Http::response([
                'status' => 'open',
                'connected_phone' => '62881080733754',
            ]),
        ]);

        $result = WhatsAppSessionPhone::sync();

        $this->assertTrue($result['connected']);
        $this->assertTrue($result['changed']);
        $this->assertSame('62881080733754', $result['stored_phone']);

        // Nomor website mengikuti nomor Baileys, bukan nomor di CMS/env.
        $this->assertSame('62881080733754', ConsultationWhatsApp::businessPhone());
        $this->assertStringStartsWith('https://wa.me/62881080733754', (string) ConsultationWhatsApp::directUrl());
    }

    public function test_disconnected_gateway_keeps_last_stored_phone(): void
    {
        $this->setGateway();
        config(['services.whatsapp.business_phone' => '6281776370707']);

        // Http::fake() MENAMBAH stub (bukan mengganti), jadi respons berurutan
        // harus lewat fakeSequence supaya stub pertama tidak selalu menang.
        Http::fakeSequence()
            ->push(['status' => 'open', 'connected_phone' => '62881080733754'])
            ->push(['status' => 'close']);

        WhatsAppSessionPhone::sync();
        $result = WhatsAppSessionPhone::sync();

        $this->assertFalse($result['connected']);
        $this->assertFalse($result['changed']);
        // Nomor lama TIDAK dihapus dan tetap dipakai website.
        $this->assertSame('62881080733754', WhatsAppSessionPhone::current());
        $this->assertSame('62881080733754', ConsultationWhatsApp::businessPhone());
    }

    public function test_gateway_unreachable_does_not_clear_stored_phone(): void
    {
        $this->setGateway();

        Http::fakeSequence()
            ->push(['status' => 'open', 'connected_phone' => '62881080733754'])
            ->pushFailedConnection('connection refused');

        WhatsAppSessionPhone::sync();
        $result = WhatsAppSessionPhone::sync();

        $this->assertFalse($result['connected']);
        $this->assertSame('62881080733754', WhatsAppSessionPhone::current());
    }

    public function test_new_phone_replaces_previous_one(): void
    {
        $this->setGateway();

        Http::fakeSequence()
            ->push(['status' => 'open', 'connected_phone' => '62881080733754'])
            ->push(['status' => 'open', 'connected_phone' => '6281234567890']);

        WhatsAppSessionPhone::sync();
        $result = WhatsAppSessionPhone::sync();

        $this->assertTrue($result['changed']);
        $this->assertSame('6281234567890', WhatsAppSessionPhone::current());
        $this->assertSame('6281234567890', ConsultationWhatsApp::businessPhone());
    }

    public function test_repeated_sync_with_same_phone_writes_no_new_version(): void
    {
        $this->setGateway();

        Http::fake([
            $this->gatewayBase().'/status' => Http::response([
                'status' => 'open',
                'connected_phone' => '62881080733754',
            ]),
        ]);

        WhatsAppSessionPhone::sync();
        $afterFirst = WhatsAppSessionPhone::versions();

        WhatsAppSessionPhone::sync();
        WhatsAppSessionPhone::sync();

        // Versi tidak bertambah saat nomor tidak berubah -> audit log tetap bersih.
        $this->assertSame($afterFirst, WhatsAppSessionPhone::versions());
    }

    public function test_operational_setting_normalizes_phone_payload(): void
    {
        $normalized = OperationalSettings::normalize(OperationalSettings::WHATSAPP_SESSION, [
            'phone' => ' 62881080733754 ',
            'previous_phone' => '',
            'synced_at' => '',
        ]);

        $this->assertSame('62881080733754', $normalized['phone']);
        $this->assertNull($normalized['previous_phone']);
        $this->assertNull($normalized['synced_at']);
    }
    public function test_no_session_yet_falls_back_to_contact_settings(): void
    {
        // Kondisi toko baru: belum pernah ada sesi Baileys tersimpan.
        $this->setGateway();
        config([
            'services.whatsapp.business_phone' => '6281776370707',
            'sitemap.brand.phone' => '+62 851-9966-6810',
        ]);

        Http::fake([
            $this->gatewayBase().'/status' => Http::response(['status' => 'close']),
        ]);

        $this->assertNull(WhatsAppSessionPhone::current());

        // Website tetap punya nomor: jatuh ke WHATSAPP_BUSINESS_PHONE, bukan kosong.
        $this->assertSame('6281776370707', ConsultationWhatsApp::businessPhone());
    }

    public function test_stored_session_phone_used_when_contact_settings_empty(): void
    {
        $this->setGateway();
        config(['services.whatsapp.business_phone' => '6281776370707']);

        Http::fake([
            $this->gatewayBase().'/status' => Http::response([
                'status' => 'open',
                'connected_phone' => '62881080733754',
            ]),
        ]);
        WhatsAppSessionPhone::sync();

        // CMS 'kontak' kosong (kondisi test), jadi nomor sesi dipakai sebagai
        // cadangan - menang atas nomor config/env.
        $this->assertSame('62881080733754', ConsultationWhatsApp::businessPhone());
        $this->assertStringContainsString('62881080733754', (string) ConsultationWhatsApp::directUrl());
    }

    public function test_product_cta_uses_connected_number_when_contact_settings_empty(): void
    {
        $this->setGateway();

        Http::fake([
            $this->gatewayBase().'/status' => Http::response([
                'status' => 'open',
                'connected_phone' => '62881080733754',
            ]),
        ]);
        WhatsAppSessionPhone::sync();

        $url = (string) ConsultationWhatsApp::productDirectUrl('Jendela Uji (SKU123)');

        $this->assertStringStartsWith('https://wa.me/62881080733754', $url);
    }

    public function test_contact_settings_phone_wins_over_connected_gateway(): void
    {
        $this->setGateway();

        Http::fake([
            $this->gatewayBase().'/status' => Http::response([
                'status' => 'open',
                'connected_phone' => '62881080733754',
            ]),
        ]);
        WhatsAppSessionPhone::sync();

        // Admin mengisi nomor di Profil & Kontak Toko (CMS 'kontak').
        $page = \App\Models\CmsPage::create(['slug' => 'kontak', 'title' => 'Kontak Kami']);
        $page->update(['content' => ['blocks' => [
            ['type' => 'heading', 'text' => 'Telepon / WhatsApp'],
            ['type' => 'paragraph', 'text' => '081234567890'],
        ]]]);
        \App\Support\CmsSettings::forgetPage('kontak');

        // Nomor Kontak Toko menang; nomor sesi hanya cadangan (kontrak 2026-09-18).
        // businessPhone() mengembalikan nilai apa adanya dari CMS (dipakai untuk
        // tampilan), normalisasi ke 62... terjadi di directUrl()/wa.me.
        $this->assertSame('081234567890', ConsultationWhatsApp::businessPhone());

        $url = (string) ConsultationWhatsApp::directUrl();
        $this->assertStringContainsString('6281234567890', $url);
        $this->assertStringNotContainsString('62881080733754', $url, 'Nomor sesi tidak boleh dipakai saat CMS terisi.');

        // Display phone dinormalisasi untuk dibaca pelanggan.
        $this->assertSame('0812-3456-7890', ConsultationWhatsApp::displayPhone());
    }
}