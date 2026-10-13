<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WhatsAppTemplate;
use App\Services\WhatsAppService;
use App\Support\WhatsAppAutomationCatalog;
use App\Support\WhatsAppTemplateSync;
use App\Support\WhatsAppMessageDrafts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Katalog template WhatsApp otomatis: urutan event + naskah yang tidak lagi
 * hidup di kode tanpa terlihat di admin.
 */
class WhatsAppTemplateCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_urutan_katalog_mengikuti_alur_pesanan(): void
    {
        $this->assertSame([
            'order_created',
            'payment_instructions',
            'payment_confirmed',
            'order_shipped',
            'order_delivered',
            'order_issue_followup',
            'order_returned',
            'consultation_request',
            'review_replied',
        ], WhatsAppAutomationCatalog::keys());
    }

    public function test_halaman_template_menampilkan_urutan_dan_footer_otomatis(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.whatsapp.templates.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/WhatsApp/Index')
                ->where('replySignature', WhatsAppService::replySignature())
                ->where('automations.0.internal_key', 'order_created')
                ->where('automations.1.internal_key', 'payment_instructions')
                ->has('automations', count(WhatsAppAutomationCatalog::keys())));
    }

    /**
     * Owner 2026-09-17: seksi "Draf chat pembeli" dihapus dari admin karena
     * dianggap tidak perlu. Naskah draf tetap hidup di kode untuk mengisi teks
     * awal tombol chat storefront, tetapi TIDAK lagi tampil sebagai bagian
     * yang bisa dikelola di halaman template.
     */
    public function test_draf_chat_pembeli_tidak_lagi_tampil_di_halaman_template(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.whatsapp.templates.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->missing('drafts')
                // Daftar hanya berisi template otomatisasi, bukan draf storefront.
                ->has('automations', count(WhatsAppAutomationCatalog::keys())));
    }

    public function test_naskah_draf_storefront_tetap_terisi_tanpa_token_mentah(): void
    {
        // Storefront masih memakai draf ini untuk teks awal tombol chat.
        foreach (WhatsAppMessageDrafts::all() as $draft) {
            $this->assertStringNotContainsString(':brand', $draft['body']);
        }

        $this->assertStringContainsString(
            'Ragil Aluminium',
            WhatsAppMessageDrafts::body('order_confirmation', [':order' => 'ORD123']),
        );
    }

    public function test_footer_otomatis_dapat_dioverride_lewat_config(): void
    {
        config(['services.whatsapp.reply_signature' => 'Balas OKE untuk konfirmasi.']);

        $this->assertSame('Balas OKE untuk konfirmasi.', WhatsAppService::replySignature());

        config(['services.whatsapp.reply_signature' => '']);
        $this->assertSame(WhatsAppService::REPLY_SIGNATURE, WhatsAppService::replySignature());
    }

    /**
     * Penjaga naskah tidak kosong (owner 2026-09-21).
     *
     * Insiden nyata: template review_replied sempat dibuat tanpa naskah
     * (body_preview kosong), lalu pesan terkirim sebagai deretan nilai mentah
     * tanpa kalimat. Sync wajib mengisi naskah awal untuk setiap key katalog.
     */
    public function test_setiap_template_punya_naskah_tidak_kosong(): void
    {
        WhatsAppTemplateSync::sync();

        foreach (WhatsAppAutomationCatalog::keys() as $key) {
            $template = WhatsAppTemplate::query()->where('internal_key', $key)->first();

            $this->assertNotNull($template, "Template {$key} tidak ada di tabel.");
            $this->assertNotSame(
                '',
                trim((string) $template->body_preview),
                "Naskah template {$key} kosong, pesan akan terkirim tanpa kalimat.",
            );
        }
    }

    /**
     * Penjaga konflik kode vs admin (owner 2026-09-21). Ini test terpenting
     * dari kontrak satu jalur: suntingan admin pada body_preview TIDAK BOLEH
     * ditimpa katalog, karena pernah terjadi (forceFill menimpa tiap halaman
     * dibuka, dicabut owner 2026-09-15).
     */
    public function test_suntingan_admin_tidak_ditimpa_saat_sync(): void
    {
        WhatsAppTemplateSync::sync();

        $template = WhatsAppTemplate::query()->where('internal_key', 'review_replied')->firstOrFail();
        $edited = 'Naskah karangan admin, jangan sampai tertimpa katalog.';

        $template->forceFill(['body_preview' => $edited])->save();

        $summary = WhatsAppTemplateSync::sync();

        $this->assertSame(0, $summary['created']);
        $this->assertSame(0, $summary['healed']);
        $this->assertSame($edited, $template->fresh()->body_preview);
    }

    /*
     * CATATAN PENTING (2026-09-21): JANGAN menambahkan test yang menuntut
     * naskah di database SAMA dengan default_body katalog.
     *
     * Panel admin adalah sumber resmi naskah template. Database sengaja DIIZINKAN
     * berbeda dari katalog begitu barisnya dibuat, karena admin berhak menyunting
     * naskah kapan saja. Test kesetaraan akan merah setiap kali admin menyunting
     * dengan benar, lalu memancing agent berikutnya untuk "menyelaraskan" dan
     * menghapus suntingan admin. Itu justru pola saling timpa yang ingin dicegah.
     *
     * Yang wajib dijaga hanya dua: naskah TIDAK BOLEH KOSONG, dan suntingan admin
     * TIDAK BOLEH TERTIMPA saat sinkronisasi dijalankan. Keduanya sudah diuji di
     * dua test di atas.
     */
}
