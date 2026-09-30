<?php

namespace Tests\Feature;

use App\Models\AdminNotification;
use App\Models\WhatsAppMessage;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Notifikasi admin saat pengiriman pesan WhatsApp gagal.
 *
 * Alasan fitur ini ada: dulu kegagalan kirim tidak memberi tahu siapa pun,
 * sehingga pesan gagal bisa menumpuk berhari-hari tanpa ada yang menangani.
 * Admin baru tahu setelah membuka halaman WhatsApp sendiri.
 *
 * Kontrak:
 * - Setiap kegagalan kirim menghasilkan notifikasi tipe `whatsapp_send_failed`.
 * - Dedupe: kegagalan berulang memperbarui SATU notifikasi belum dibaca yang
 *   sama, bukan menumpuk, karena satu sebab biasanya melahirkan banyak
 *   kegagalan sekaligus (mis. sesi gateway putus).
 * - Pengiriman yang berhasil tidak membuat notifikasi apa pun.
 *
 * Nomor uji memakai 085725116817 (kontrak keras pengujian WhatsApp).
 */
class WhatsAppSendFailureNotifierTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Kredensial gateway dibuat eksplisit supaya hasil test tidak bergantung
        // pada isi .env server: tanpa ini pengiriman dianggap "belum
        // dikonfigurasi" dan pesan ditandai terkirim tanpa mencoba gateway.
        config([
            'services.whatsapp.baileys.base_url' => 'https://gateway-uji.test',
            'services.whatsapp.baileys.api_key' => 'kunci-uji',
        ]);
    }

    /** Gateway palsu: nomor terdaftar, hasil kirim ditentukan pemanggil. */
    private function fakeGateway(bool $kirimBerhasil, string $alasanGagal = 'gateway mati'): void
    {
        Http::fake(function (Request $request) use ($kirimBerhasil, $alasanGagal) {
            if (str_contains($request->url(), '/api/on-whatsapp')) {
                $jid = (string) ($request->data()['numbers'][0] ?? '');

                return Http::response(['results' => [['jid' => $jid, 'exists' => true]]], 200);
            }

            return $kirimBerhasil
                ? Http::response(['id' => 'WA-NOTIF-OK'], 200)
                : Http::response($alasanGagal, 500);
        });
    }

    private function kirim(WhatsAppService $service): ?WhatsAppMessage
    {
        return $service->sendTextMessage('085725116817', 'Naskah uji notifikasi');
    }

    public function test_kegagalan_kirim_menghasilkan_notifikasi_admin(): void
    {
        $this->fakeGateway(false, 'sesi WhatsApp terputus');

        $this->kirim(app(WhatsAppService::class));

        $notif = AdminNotification::query()->where('type', 'whatsapp_send_failed')->first();

        $this->assertNotNull($notif, 'Kegagalan kirim wajib memberi tahu admin.');
        $this->assertNull($notif->read_at);
        $this->assertStringContainsString('Pesan WhatsApp gagal terkirim', $notif->title);
        $this->assertStringContainsString('sesi WhatsApp terputus', (string) $notif->body);
        // Tautan mengarah ke daftar pesan gagal supaya admin bisa langsung kirim ulang.
        $this->assertSame(
            route('admin.whatsapp.dashboard', ['status' => 'failed']),
            $notif->href,
        );
    }

    public function test_kegagalan_berulang_tidak_menumpuk_jadi_banyak_notifikasi(): void
    {
        $this->fakeGateway(false, 'not connected');
        $service = app(WhatsAppService::class);

        $this->kirim($service);
        $this->kirim($service);
        $this->kirim($service);

        // Tiga pesan gagal, tetapi tetap SATU notifikasi belum dibaca.
        $this->assertSame(
            3,
            WhatsAppMessage::query()->where('status', 'failed')->count(),
            'Ketiga pengiriman memang gagal.',
        );
        $this->assertSame(
            1,
            AdminNotification::query()->where('type', 'whatsapp_send_failed')->whereNull('read_at')->count(),
            'Kegagalan berulang harus memperbarui notifikasi lama, bukan menumpuk.',
        );

        // Isinya menyebut jumlah pesan yang menunggu tindakan.
        $notif = AdminNotification::query()->where('type', 'whatsapp_send_failed')->first();
        $this->assertStringContainsString('3 pesan menunggu dikirim ulang', (string) $notif->body);
    }

    public function test_pengiriman_berhasil_tidak_membuat_notifikasi(): void
    {
        $this->fakeGateway(true);

        $this->kirim(app(WhatsAppService::class));

        $this->assertSame(
            0,
            AdminNotification::query()->where('type', 'whatsapp_send_failed')->count(),
        );
    }

    public function test_kegagalan_sesudah_notifikasi_dibaca_membuat_notifikasi_baru(): void
    {
        $this->fakeGateway(false, 'not connected');
        $service = app(WhatsAppService::class);

        $this->kirim($service);
        AdminNotification::query()->where('type', 'whatsapp_send_failed')->update(['read_at' => now()]);

        // Kegagalan baru sesudah yang lama dibaca = masalah baru, bukan kelanjutan.
        $this->kirim($service);

        $this->assertSame(
            1,
            AdminNotification::query()->where('type', 'whatsapp_send_failed')->whereNull('read_at')->count(),
        );
        $this->assertSame(
            2,
            AdminNotification::query()->where('type', 'whatsapp_send_failed')->count(),
        );
    }
}
