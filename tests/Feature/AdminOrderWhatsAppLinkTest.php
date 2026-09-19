<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\User;
use App\Models\WhatsAppTemplate;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Tautan Chat WA admin mengikuti naskah template status pesanan.
 *
 * Kontrak owner 2026-09-19: tombol chat di panel admin harus menghasilkan naskah
 * yang SAMA dengan pesan otomatis yang dikirim sistem untuk status pesanan itu,
 * supaya admin tidak perlu menulis ulang pesan yang sudah baku.
 *
 * Status tanpa template otomatis (Selesai, Dibatalkan) mengembalikan null dan
 * tombol jatuh kembali ke tautan WhatsApp biasa, sehingga chat tetap bisa dibuka.
 */
class AdminOrderWhatsAppLinkTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function order(array $attributes = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'RA-WA-'.random_int(1000, 9999),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '081200000123',
            'shipping_address_line1' => 'Jl Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'awaiting_confirmation',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ], $attributes));
    }

    /**
     * Template aktif dengan body berisi penanda unik per status.
     *
     * Jumlah token mengikuti slot yang benar-benar diisi tiap template, supaya
     * nilai pada slot tertentu (mis. nomor resi di slot keempat) ikut teruji.
     */
    private function template(string $key, string $marker, string $body = 'Halo *{{1}}*, pesanan *{{2}}*. '): void
    {
        WhatsAppTemplate::create([
            'internal_key' => $key,
            'provider_template_name' => $key,
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'active',
            'description' => 'template uji',
            'body_preview' => $body.$marker,
        ]);
    }

    public function test_status_menunggu_konfirmasi_cod_memakai_template_order_created(): void
    {
        $this->template('order_created', 'PENANDA-ORDER-DIBUAT');
        $order = $this->order(['order_status' => 'awaiting_confirmation', 'payment_method' => 'cod', 'cod_flag' => true]);

        $this->assertSame('order_created', app(WhatsAppService::class)->templateKeyForOrderStatus($order));

        $url = app(WhatsAppService::class)->statusMessageUrl($order);
        $this->assertNotNull($url);
        $this->assertStringContainsString('wa.me/', $url);
        $this->assertStringContainsString(rawurlencode('PENANDA-ORDER-DIBUAT'), $url);
    }

    public function test_status_menunggu_konfirmasi_transfer_memakai_template_instruksi_bayar(): void
    {
        $this->template('payment_instructions', 'PENANDA-INSTRUKSI-BAYAR');
        $order = $this->order(['order_status' => 'awaiting_confirmation', 'payment_method' => 'transfer']);

        $this->assertSame('payment_instructions', app(WhatsAppService::class)->templateKeyForOrderStatus($order));
        $this->assertStringContainsString(
            rawurlencode('PENANDA-INSTRUKSI-BAYAR'),
            (string) app(WhatsAppService::class)->statusMessageUrl($order),
        );
    }

    public function test_status_diproses_memakai_template_pesanan_diproses(): void
    {
        $this->template('payment_confirmed', 'PENANDA-DIPROSES');
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);

        $this->assertSame('payment_confirmed', app(WhatsAppService::class)->templateKeyForOrderStatus($order));
        $this->assertStringContainsString(
            rawurlencode('PENANDA-DIPROSES'),
            (string) app(WhatsAppService::class)->statusMessageUrl($order),
        );
    }

    public function test_status_dikirim_memakai_template_resi_dan_butuh_nomor_resi(): void
    {
        // Slot resi ada di token keempat, jadi body uji harus memuatnya.
        $this->template('order_shipped', 'PENANDA-RESI', 'Halo *{{1}}*, pesanan *{{2}}*, resi *{{4}}*. ');
        $order = $this->order(['order_status' => 'shipped', 'payment_status' => 'paid']);

        // Tanpa resi, naskah resi belum bermakna: tautan naskah sengaja kosong
        // supaya pemanggil memakai tautan WhatsApp biasa.
        $this->assertNull(app(WhatsAppService::class)->statusMessageUrl($order));

        ShippingRecord::create([
            'order_id' => $order->id,
            'carrier_name' => 'J&T Cargo',
            'waybill_number' => 'RESI-UJI-123',
            'shipping_cost' => 150000,
            'status' => 'in_transit',
        ]);

        $url = app(WhatsAppService::class)->statusMessageUrl($order->fresh());
        $this->assertNotNull($url);
        $this->assertStringContainsString(rawurlencode('PENANDA-RESI'), $url);
        $this->assertStringContainsString(rawurlencode('RESI-UJI-123'), $url);
    }

    public function test_status_sampai_dan_retur_memakai_template_masing_masing(): void
    {
        $this->template('order_delivered', 'PENANDA-SAMPAI');
        $this->template('order_issue_followup', 'PENANDA-KENDALA');
        $this->template('order_returned', 'PENANDA-RETUR');

        $sampai = $this->order(['order_status' => 'delivered', 'payment_status' => 'paid']);
        $this->assertSame('order_delivered', app(WhatsAppService::class)->templateKeyForOrderStatus($sampai));

        $kendala = $this->order(['order_status' => 'issue']);
        $this->assertSame('order_issue_followup', app(WhatsAppService::class)->templateKeyForOrderStatus($kendala));

        $retur = $this->order(['order_status' => 'return_completed']);
        $this->assertSame('order_returned', app(WhatsAppService::class)->templateKeyForOrderStatus($retur));
    }

    public function test_retur_tanpa_record_pengiriman_tetap_membuat_naskah(): void
    {
        // Regresi: retur bisa dicatat sebelum resi pernah diinput, sehingga
        // record pengiriman belum ada. Sebelumnya kondisi ini melempar
        // TypeError karena variabel retur menuntut ShippingRecord.
        $this->template('order_returned', 'PENANDA-RETUR', 'Halo *{{1}}*, pesanan *{{2}}*, resi *{{3}}*. ');
        $order = $this->order(['order_status' => 'return_completed']);

        $this->assertSame(0, $order->shippingRecords()->count());

        $url = app(WhatsAppService::class)->statusMessageUrl($order);
        $this->assertNotNull($url);
        $this->assertStringContainsString(rawurlencode('PENANDA-RETUR'), $url);
        // Slot resi diisi tanda "-" supaya naskahnya tetap utuh dibaca.
        $this->assertStringContainsString(rawurlencode('resi *-*'), $url);
    }

    public function test_status_tanpa_template_otomatis_tidak_memaksa_naskah(): void
    {
        $this->template('order_delivered', 'PENANDA-SAMPAI');

        foreach (['completed', 'cancelled'] as $status) {
            $order = $this->order(['order_status' => $status]);
            $this->assertNull(
                app(WhatsAppService::class)->templateKeyForOrderStatus($order),
                "Status {$status} tidak punya template otomatis.",
            );
            $this->assertNull(app(WhatsAppService::class)->statusMessageUrl($order));
        }
    }

    public function test_template_nonaktif_tidak_dipakai(): void
    {
        WhatsAppTemplate::create([
            'internal_key' => 'payment_confirmed',
            'provider_template_name' => 'payment_confirmed',
            'language_code' => 'id',
            'category' => 'transactional',
            'status' => 'inactive',
            'description' => 'dimatikan admin',
            'body_preview' => 'Tidak boleh dipakai',
        ]);

        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);
        $this->assertNull(app(WhatsAppService::class)->statusMessageUrl($order));
    }

    public function test_daftar_dan_detail_pesanan_mengirim_tautan_naskah_status(): void
    {
        $this->template('payment_confirmed', 'PENANDA-DIPROSES');
        $admin = $this->admin();
        $order = $this->order(['order_status' => 'processing', 'payment_status' => 'paid']);

        $this->actingAs($admin)
            ->get(route('admin.orders.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Orders/Index')
                ->where('orders.0.whatsapp_status_url', fn ($url) => is_string($url)
                    && str_contains($url, rawurlencode('PENANDA-DIPROSES')))
            );

        $this->actingAs($admin)
            ->get(route('admin.orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Orders/Show')
                ->where('order.whatsapp_status_url', fn ($url) => is_string($url)
                    && str_contains($url, rawurlencode('PENANDA-DIPROSES')))
            );
    }
}
