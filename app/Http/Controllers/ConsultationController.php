<?php

namespace App\Http\Controllers;

use App\Services\WhatsAppService;
use App\Support\ConsultationWhatsApp;
use App\Support\PhoneNumber;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ConsultationController extends Controller
{
    public function send(Request $request, WhatsAppService $whatsapp): RedirectResponse
    {
        $validated = $request->validate(
            [
                'phone' => ['required', 'string', 'max:30'],
                'source' => ['nullable', 'string', 'max:50'],
            ],
            [
                'phone.required' => 'Nomor WhatsApp wajib diisi.',
                'phone.max' => 'Nomor WhatsApp terlalu panjang.',
            ],
        );

        $phone = PhoneNumber::normalize($validated['phone']);
        if (! $phone) {
            return back()->withErrors([
                'phone' => 'Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx.',
            ]);
        }

        $message = $whatsapp->sendTemplateMessage(
            $phone,
            ConsultationWhatsApp::templateKey(),
            ConsultationWhatsApp::templateVariables(),
        );

        if (! $message) {
            return back()->withErrors([
                'phone' => 'Pesan otomatis belum tersedia. Gunakan opsi chat langsung di WhatsApp.',
            ]);
        }

        if ($message->status === 'failed') {
            return back()->withErrors([
                'phone' => 'Gagal mengirim pesan WhatsApp. Coba lagi atau gunakan chat langsung.',
            ]);
        }

        return back()->with(
            'success',
            'Pesan konsultasi terkirim ke WhatsApp Anda. Silakan buka aplikasi WhatsApp untuk melanjutkan.',
        );
    }
}
