<?php

namespace App\Support;

use App\Models\WhatsAppTemplate;

/**
 * Satu jalur penulisan naskah template WhatsApp otomatis.
 *
 * Kontrak (owner 2026-09-21): naskah resmi yang benar-benar dikirim hidup di
 * kolom naskah (body_preview) tabel whatsapp_templates, dan HANYA panel admin
 * menu WhatsApp yang boleh menyuntingnya.
 *
 * Pembagian tugas:
 *   - Katalog kode (WhatsAppAutomationCatalog) = metadata + naskah AWAL.
 *   - Database (body_preview) = naskah RESMI yang dipakai saat mengirim pesan.
 *   - Panel admin = SATU-SATUNYA tempat menyunting naskah.
 *
 * Aturan yang mengikat method ini:
 *   1. Baris belum ada          -> buat lengkap dengan naskah awal (created).
 *   2. Baris ada, naskah kosong -> isi naskah awal, memperbaiki baris rusak (healed).
 *   3. Baris ada, naskah terisi -> JANGAN sentuh, suntingan admin menang (skipped).
 *
 * PERINGATAN: JANGAN mengubah method ini supaya menimpa naskah yang sudah
 * terisi. Sebelumnya controller memakai forceFill yang menimpa body_preview
 * setiap halaman admin dibuka, sehingga suntingan admin selalu hilang; owner
 * mencabut perilaku itu pada 2026-09-15. Mengembalikannya akan mengulang bug
 * yang sama dan menghapus pekerjaan admin.
 */
class WhatsAppTemplateSync
{
    /**
     * Selaraskan baris tabel whatsapp_templates dengan katalog kode.
     *
     * Dipakai bersama oleh seeder dan halaman admin template supaya tidak ada
     * dua jalur penulisan yang saling timpa.
     *
     * @return array{created: int, healed: int, skipped: int}
     */
    public static function sync(): array
    {
        $summary = ['created' => 0, 'healed' => 0, 'skipped' => 0];

        foreach (WhatsAppAutomationCatalog::all() as $trigger) {
            $key = $trigger['internal_key'];

            $template = WhatsAppTemplate::query()
                ->where('internal_key', $key)
                ->first();

            if ($template === null) {
                WhatsAppTemplate::query()->create([
                    'internal_key' => $key,
                    'provider_template_name' => $trigger['default_provider_name'],
                    'language_code' => 'id',
                    'category' => 'transactional',
                    'status' => 'active',
                    'description' => $trigger['description'],
                    'body_preview' => $trigger['default_body'],
                ]);

                $summary['created']++;

                continue;
            }

            if (trim((string) $template->body_preview) === '') {
                // Baris rusak: pernah dibuat tanpa naskah, mis. oleh seeder lama
                // yang tidak mengisi body_preview. Isi naskah awal, tanpa
                // menyentuh metadata yang mungkin sudah disunting admin.
                $template->forceFill(['body_preview' => $trigger['default_body']])->save();

                $summary['healed']++;

                continue;
            }

            // Naskah sudah terisi. Ini naskah resmi, bisa jadi hasil suntingan
            // admin. Jangan sentuh.
            $summary['skipped']++;
        }

        return $summary;
    }
}
