<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppMessage;
use App\Models\WhatsAppTemplate;
use App\Services\ActivityLogService;
use App\Support\WhatsAppAutomationCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WhatsAppTemplateController extends Controller
{

    public function dashboard(): Response
    {
        $this->ensureAutomationTemplates();

        $templates = WhatsAppTemplate::query()
            ->whereIn('internal_key', WhatsAppAutomationCatalog::keys())
            ->get()
            ->keyBy('internal_key');

        $automations = collect(WhatsAppAutomationCatalog::all())->map(function (array $trigger) use ($templates) {
            /** @var WhatsAppTemplate $template */
            $template = $templates->get($trigger['internal_key']);

            return [
                'id' => $template?->id,
                'internal_key' => $trigger['internal_key'],
                'label' => $trigger['label'],
                'description' => $trigger['description'],
                'icon' => $trigger['icon'],
                'status' => $template?->status ?? 'inactive',
                'provider_template_name' => $template?->provider_template_name ?? '',
                'language_code' => $template?->language_code ?? '',
                'editUrl' => $template ? route('admin.whatsapp.templates.edit', $template) : null,
            ];
        })->values()->all();

        $connection = app(\App\Services\WhatsAppService::class)->connectionStatus();

        $recentMessages = WhatsAppMessage::query()
            ->with('order')
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (WhatsAppMessage $m) => [
                'id' => $m->id,
                'provider' => strtoupper((string) $m->provider),
                'direction' => $m->direction,
                'phone_number' => $m->phone_number,
                'status' => $m->status,
                'content' => mb_substr((string) $m->content_text, 0, 80),
                'order_number' => $m->order?->order_number ?? '-',
                'created_at' => optional($m->created_at)?->toDateTimeString(),
            ]);

        $outbound = WhatsAppMessage::query()->where('direction', 'outbound');
        $stats = [
            'sent' => (clone $outbound)->whereIn('status', ['sent', 'delivered', 'read'])->count(),
            'failed' => (clone $outbound)->where('status', 'failed')->count(),
            'total' => WhatsAppMessage::query()->count(),
            'last_sent_at' => (clone $outbound)->whereNotNull('sent_at')->latest('sent_at')->value('sent_at'),
        ];

        return Inertia::render('Admin/WhatsApp/Dashboard', [
            'title' => 'WhatsApp',
            'description' => 'Kelola koneksi, template pesan otomatis, dan log pengiriman WhatsApp dalam satu tempat.',
            'automations' => $automations,
            'connection' => array_merge($connection, [
                'webhook_path' => '/webhook/whatsapp',
                'baileys_webhook_path' => '/webhook/whatsapp/baileys',
            ]),
            'recentMessages' => $recentMessages,
            'stats' => $stats,
            'statusUrl' => route('admin.whatsapp.pairing.status'),
            'qrUrl' => route('admin.whatsapp.pairing.qr'),
            'refreshQrUrl' => route('admin.whatsapp.pairing.refresh-qr'),
            'codeUrl' => route('admin.whatsapp.pairing.code'),
            'templatesUrl' => route('admin.whatsapp.templates.index'),
            'messagesUrl' => route('admin.whatsapp.messages.index'),
            'pairingUrl' => route('admin.whatsapp.pairing'),
        ]);
    }

    public function index(): Response
    {
        $this->ensureAutomationTemplates();

        $templates = WhatsAppTemplate::query()
            ->whereIn('internal_key', WhatsAppAutomationCatalog::keys())
            ->get()
            ->keyBy('internal_key');

        $automations = collect(WhatsAppAutomationCatalog::all())->map(function (array $trigger) use ($templates) {
            /** @var WhatsAppTemplate $template */
            $template = $templates->get($trigger['internal_key']);

            return [
                'id' => $template->id,
                'internal_key' => $trigger['internal_key'],
                'label' => $trigger['label'],
                'description' => $trigger['description'],
                'icon' => $trigger['icon'],
                'status' => $template->status,
                'provider_template_name' => $template->provider_template_name,
                'language_code' => $template->language_code,
                'editUrl' => route('admin.whatsapp.templates.edit', $template),
                'activateUrl' => route('admin.whatsapp.templates.activate', $template),
                'deactivateUrl' => route('admin.whatsapp.templates.deactivate', $template),
            ];
        })->values()->all();

        return Inertia::render('Admin/WhatsApp/Index', [
            'title' => 'WhatsApp Otomatis',
            'description' => 'Konfigurasi template pesan WhatsApp yang akan dikirim secara otomatis pada setiap tahapan pesanan.',
            'automations' => $automations,
            'connectionUrl' => route('admin.whatsapp.connection'),
            'messagesUrl' => route('admin.whatsapp.messages.index'),
            'totalTemplates' => count($automations),
        ]);
    }

    public function edit(WhatsAppTemplate $template): Response
    {
        $catalog = WhatsAppAutomationCatalog::find($template->internal_key);
        abort_unless($catalog, 404);

        return Inertia::render('Admin/WhatsApp/Edit', [
            'title' => 'Edit '.$catalog['label'],
            'description' => $catalog['description'],
            'template' => [
                'id' => $template->id,
                'internal_key' => $template->internal_key,
                'label' => $catalog['label'],
                'provider_template_name' => $template->provider_template_name,
                'language_code' => $template->language_code,
                'category' => $template->category,
                'status' => $template->status,
                'body_preview' => $template->body_preview ?: $catalog['default_body'],
            ],
            'variables' => $catalog['variables'],
            'submitUrl' => route('admin.whatsapp.templates.update', $template),
            'backUrl' => route('admin.whatsapp.templates.index'),
            'pairingUrl' => route('admin.whatsapp.pairing'),
            'statusUrl' => route('admin.whatsapp.pairing.status'),
            'activateUrl' => route('admin.whatsapp.templates.activate', $template),
            'deactivateUrl' => route('admin.whatsapp.templates.deactivate', $template),
        ]);
    }

    public function connection(): Response
    {
        $connection = app(\App\Services\WhatsAppService::class)->connectionStatus();

        $outbound = WhatsAppMessage::query()->where('direction', 'outbound');
        $sentCount = (clone $outbound)->whereIn('status', ['sent', 'delivered', 'read'])->count();
        $failedCount = (clone $outbound)->where('status', 'failed')->count();
        $lastSentAt = (clone $outbound)->whereNotNull('sent_at')->latest('sent_at')->value('sent_at');

        return Inertia::render('Admin/WhatsApp/Connection', [
            'title' => 'Hubungkan WhatsApp',
            'description' => 'Status integrasi Meta resmi dan BAILEYS untuk pesan otomatis toko, termasuk compare mode yang aman untuk nomor uji.',
            'backUrl' => route('admin.whatsapp.templates.index'),
            'connection' => array_merge($connection, [
                'webhook_path' => '/webhook/whatsapp',
                'baileys_webhook_path' => '/webhook/whatsapp/baileys',
            ]),
            'stats' => [
                'sent_count' => $sentCount,
                'failed_count' => $failedCount,
                'last_sent_at' => $lastSentAt?->toIso8601String(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        // Automations are catalog-owned; free-form create is not part of Figma WA Otomatis.
        return redirect()
            ->route('admin.whatsapp.templates.index')
            ->with('error', 'Template otomatisasi sudah ditetapkan. Edit template yang ada.');
    }

    public function update(Request $request, WhatsAppTemplate $template): RedirectResponse
    {
        abort_unless(WhatsAppAutomationCatalog::find($template->internal_key), 404);

        $validated = $request->validate([
            'provider_template_name' => ['required', 'string', 'max:191'],
            'language_code' => ['required', 'string', 'max:16'],
            'body_preview' => ['nullable', 'string'],
        ]);
        $validated['updated_by_user_id'] = $request->user()->id;
        $template->update($validated);

        ActivityLogService::record(
            'whatsapp.template_updated',
            'whatsapp_template',
            (int) $template->id,
            ['internal_key' => $template->internal_key],
            (int) $request->user()->id,
        );

        return redirect()
            ->route('admin.whatsapp.templates.edit', $template)
            ->with('success', 'Template WhatsApp disimpan.');
    }

    public function activate(WhatsAppTemplate $template): RedirectResponse
    {
        abort_unless(WhatsAppAutomationCatalog::find($template->internal_key), 404);
        $template->update([
            'status' => 'active',
            'updated_by_user_id' => request()->user()?->id,
        ]);

        ActivityLogService::record(
            'whatsapp.template_activated',
            'whatsapp_template',
            (int) $template->id,
            ['internal_key' => $template->internal_key],
            request()->user()?->id,
        );

        return redirect()->back()->with('success', 'Otomasi diaktifkan.');
    }

    public function deactivate(WhatsAppTemplate $template): RedirectResponse
    {
        abort_unless(WhatsAppAutomationCatalog::find($template->internal_key), 404);
        $template->update([
            'status' => 'inactive',
            'updated_by_user_id' => request()->user()?->id,
        ]);

        ActivityLogService::record(
            'whatsapp.template_deactivated',
            'whatsapp_template',
            (int) $template->id,
            ['internal_key' => $template->internal_key],
            request()->user()?->id,
        );

        return redirect()->back()->with('success', 'Otomasi dinonaktifkan.');
    }

    protected function ensureAutomationTemplates(): void
    {
        foreach (WhatsAppAutomationCatalog::all() as $trigger) {
            $template = WhatsAppTemplate::query()->firstOrCreate(
                ['internal_key' => $trigger['internal_key']],
                [
                    'provider_template_name' => $trigger['default_provider_name'],
                    'language_code' => 'id',
                    'category' => 'transactional',
                    'status' => 'active',
                    'description' => $trigger['description'],
                    'body_preview' => $trigger['default_body'],
                ]
            );

            // Katalog = sumber naskah resmi; refresh preview/deskripsi tanpa menimpa nama Meta / status.
            $template->forceFill([
                'description' => $trigger['description'],
                'body_preview' => $trigger['default_body'],
            ])->save();
        }
    }
}
