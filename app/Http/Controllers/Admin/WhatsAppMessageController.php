<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Support\PhoneNumber;
use Illuminate\Http\RedirectResponse;

/**
 * Live Chat dihentikan pada 2026-09-11 atas keputusan owner.
 *
 * Alasan: untuk mengobrol, WhatsApp Desktop lebih lengkap (kirim foto,
 * dokumen, voice note, tanda baca). Nilai yang benar benar dibutuhkan panel
 * adalah KONTEKS dan ARSIP, dan keduanya kini hidup di detail pesanan.
 *
 * Controller ini hanya menyisakan pengalih agar tautan lama, riwayat browser,
 * dan notifikasi yang sudah terkirim tidak berakhir di halaman mati.
 */
class WhatsAppMessageController extends Controller
{
    public function redirectToOrders(): RedirectResponse
    {
        return redirect()->route('admin.orders.index');
    }

    /**
     * Tautan dari pesanan: buka detail pesanan pada kartu percakapan.
     */
    public function byOrder(Order $order): RedirectResponse
    {
        return redirect()->route('admin.orders.show', $order)->withFragment('percakapan-whatsapp');
    }

    /**
     * Notifikasi pesan masuk membawa nomor telepon. Cari pesanan terbaru milik
     * nomor itu agar admin mendarat pada konteks yang benar.
     */
    public function byPhone(string $phone): RedirectResponse
    {
        $clean = PhoneNumber::normalize($phone) ?: $phone;

        $order = Order::query()
            ->where('customer_phone', $clean)
            ->latest('id')
            ->first();

        if ($order) {
            return redirect()->route('admin.orders.show', $order)->withFragment('percakapan-whatsapp');
        }

        return redirect()->route('admin.orders.index', ['search' => $clean]);
    }
}
