<?php

namespace Database\Seeders;

use App\Support\WhatsAppTemplateSync;
use Illuminate\Database\Seeder;

/**
 * Sinkronisasi baris whatsapp_templates dengan WhatsAppAutomationCatalog.
 *
 * Mendelegasikan ke WhatsAppTemplateSync supaya seeder dan halaman admin
 * memakai SATU jalur penulisan naskah: baris baru dibuat lengkap dengan naskah
 * awal, naskah yang sudah terisi tidak pernah ditimpa (suntingan admin menang),
 * dan tidak ada baris yang dihapus.
 */
class WhatsAppTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $summary = WhatsAppTemplateSync::sync();

        $this->command?->info(sprintf(
            'Template WhatsApp disinkronkan: dibuat %d, naskah dipulihkan %d, dilewati %d.',
            $summary['created'],
            $summary['healed'],
            $summary['skipped'],
        ));
    }
}
