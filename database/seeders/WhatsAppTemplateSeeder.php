<?php

namespace Database\Seeders;

use App\Models\WhatsAppTemplate;
use App\Support\WhatsAppAutomationCatalog;
use Illuminate\Database\Seeder;

/**
 * Sinkronisasi baris whatsapp_templates dengan WhatsAppAutomationCatalog.
 * Upsert by internal_key ??? template lama tetap, tidak ada penghapusan.
 */
class WhatsAppTemplateSeeder extends Seeder
{
    public function run(): void
    {
        foreach (WhatsAppAutomationCatalog::all() as $trigger) {
            WhatsAppTemplate::updateOrCreate(
                ['internal_key' => $trigger['internal_key']],
                [
                    'provider_template_name' => $trigger['default_provider_name'],
                    'language_code' => 'id',
                    'category' => 'transactional',
                    'status' => 'active',
                    'description' => $trigger['description'],
                ],
            );
        }
    }
}

