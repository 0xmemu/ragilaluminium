<?php

namespace Tests\Feature;

use App\Support\OrderEventLabels;
use PHPUnit\Framework\TestCase;

/**
 * Label Log perubahan status wajib Bahasa Indonesia untuk semua jenis event
 * yang pernah muncul (owner 2026-09-27: "logs perubahan status masih
 * menggunakan bahasa sistem").
 */
class OrderEventLabelsEventTypeTest extends TestCase
{
    public function test_semua_jenis_event_berlabel_indonesia(): void
    {
        $harapan = [
            'order.created' => 'Pesanan dibuat',
            'order.edited' => 'Pesanan diedit admin',
            'order_status_changed' => 'Status: Diterima → Selesai',
            'order.cancelled' => 'Pesanan dibatalkan',
            'order_returned' => 'Pesanan dikembalikan',
            'payment.confirmed' => 'Pembayaran dikonfirmasi',
            'shipping.created' => 'Pengiriman dibuat',
            'shipping.status_updated' => 'Status pengiriman diperbarui',
            'system/cod_settlement' => 'Penyesuaian tagihan COD oleh sistem',
        ];

        foreach ($harapan as $jenis => $label) {
            $payload = $jenis === 'order_status_changed'
                ? ['from' => 'delivered', 'order_status' => 'completed']
                : [];
            $this->assertSame($label, OrderEventLabels::eventType($jenis, $payload), $jenis);
        }
    }
}
