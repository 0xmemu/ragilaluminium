<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\WhatsAppMessage;
use App\Services\WhatsAppService;
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

    /**
     * Kirim ulang satu pesan gagal dari daftar Pesan Gagal di hub WhatsApp.
     *
     * Beda dengan tombol borongan di detail pesanan: di sini admin memilih baris
     * yang dia lihat sendiri, jadi TIDAK ada batas 24 jam dan tidak dibatasi
     * kunci templat perubahan status. Batas 24 jam itu penjaga untuk kirim ulang
     * sekaligus satu pesanan, bukan untuk tindakan yang dipilih satu per satu.
     *
     * Naskah yang dikirim persis naskah baris itu (snapshot saat pesan dibuat),
     * sama seperti aturan kirim ulang yang sudah berlaku. Untuk kegagalan segar
     * naskahnya identik dengan template aktif, jadi tidak ada bedanya.
     *
     * Percobaan KEMBAR dari notifikasi yang sama ditandai digantikan supaya satu
     * notifikasi tidak terkirim dua kali. Karena daftar hanya menampilkan baris
     * yang belum digantikan, baris kembarnya ikut hilang bersama baris ini.
     */
    public function resend(WhatsAppMessage $message, WhatsAppService $whatsapp): RedirectResponse
    {
        if ($message->direction !== 'outbound'
            || $message->status !== 'failed'
            || trim((string) $message->content_text) === '') {
            return back()->with('error', 'Pesan ini tidak bisa dikirim ulang.');
        }

        $hasil = $whatsapp->resendMessage($message);
        $whatsapp->supersedeAttempts($whatsapp->siblingAttempts($message), $message);

        if ($hasil->status === 'failed') {
            $sebab = trim((string) $hasil->error_reason);

            return back()->with(
                'error',
                'Kirim ulang gagal: '.($sebab !== '' ? $sebab : 'alasan tidak tercatat dari gateway'),
            );
        }

        return back()->with('success', 'Pesan berhasil dikirim ulang ke '.$message->phone_number.'.');
    }
}
