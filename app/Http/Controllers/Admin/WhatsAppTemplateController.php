<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\WhatsAppMessage;
use App\Models\WhatsAppTemplate;
use App\Services\ActivityLogService;
use App\Services\WhatsAppService;
use App\Support\WhatsAppAutomationCatalog;
use App\Support\WhatsAppTemplateSync;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WhatsAppTemplateController extends Controller
{

    /**
     * Halaman pilihan menu WhatsApp. Menjadi titik masuk menu agar admin
     * memilih tujuan lebih dulu, bukan langsung dibawa ke Live Chat.
     */
    /** Pilihan rentang waktu ringkasan WhatsApp. */
    protected const HUB_RANGES = [
        '24h' => ['label' => '24 Jam', 'days' => 1],
        '7d' => ['label' => '7 Hari', 'days' => 7],
        '30d' => ['label' => '30 Hari', 'days' => 30],
        'all' => ['label' => 'Semua', 'days' => null],
    ];

    public function hub(Request $request): Response
    {
        $range = (string) $request->query('range', '7d');
        if (! array_key_exists($range, self::HUB_RANGES)) {
            $range = '7d';
        }

        $days = self::HUB_RANGES[$range]['days'];
        $rangeLabel = self::HUB_RANGES[$range]['label'];
        // Satu kali cek gateway: sekaligus menyinkronkan nomor WA website
        // (nomor baru tersambung -> ikut berganti; terputus -> nomor lama tetap).
        $connection = $this->connectionPayload();

        $since = $days === null ? null : now()->subDays($days);

        $countInRange = fn ($query) => $since ? $query->where('created_at', '>=', $since) : $query;

        $stats = [
            'inbound' => $countInRange(WhatsAppMessage::personalNumbers()->where('direction', 'inbound'))->count(),
            'outbound' => $countInRange(WhatsAppMessage::personalNumbers()->where('direction', 'outbound'))->count(),
            'failed' => $countInRange(WhatsAppMessage::personalNumbers()->where('direction', 'outbound')->where('status', 'failed'))->count(),
            'active_templates' => WhatsAppTemplate::whereIn('internal_key', WhatsAppAutomationCatalog::keys())
                ->where('status', 'active')
                ->count(),
        ];

        // Percakapan terakhir per nomor: satu baris per pelanggan, memuat
        // pesan terbaru sekaligus pesanan terkini nomor tersebut.
        $recent = WhatsAppMessage::query()
            ->personalNumbers()
            ->when($since, fn ($q) => $q->where('created_at', '>=', $since))
            ->orderByDesc('id')
            ->limit(400)
            ->get(['id', 'phone_number', 'direction', 'status', 'content_text', 'internal_template_key', 'created_at']);

        $threads = $recent->groupBy('phone_number')->take(12);
        $phones = $threads->keys()->all();

        $orders = Order::query()
            ->whereIn('customer_phone', $phones)
            ->orderByDesc('id')
            ->get(['id', 'order_number', 'customer_name', 'customer_phone', 'order_status', 'total_amount', 'created_at'])
            ->groupBy('customer_phone');

        $conversations = $threads->map(function ($messages, string $phone) use ($orders) {
            /** @var \App\Models\WhatsAppMessage $last */
            $last = $messages->first();
            $orderList = $orders->get($phone) ?? collect();
            /** @var \App\Models\Order|null $latestOrder */
            $latestOrder = $orderList->first();

            $text = trim((string) $last->content_text);
            $text = preg_replace('/\s+/', ' ', $text) ?? '';

            // Owner 2026-09-16: pesan otomatis (template) terlalu panjang untuk
            // daftar percakapan -> tampilkan NAMA TEMPLATE-nya saja.
            $templateKey = trim((string) $last->internal_template_key);
            $isTemplate = $templateKey !== '';

            return [
                'phone' => $phone,
                'name' => $latestOrder?->customer_name,
                'last_text' => $isTemplate
                    ? \App\Support\OrderEventLabels::whatsappTemplate($templateKey)
                    : ($text === '' ? null : \Illuminate\Support\Str::limit($text, 90)),
                'last_is_template' => $isTemplate,
                'last_direction' => $last->direction,
                'last_status' => $last->status,
                'last_at' => $last->created_at?->diffForHumans(),
                'order_number' => $latestOrder?->order_number,
                'order_status' => $latestOrder?->order_status,
                'order_total' => $latestOrder?->total_amount,
                'order_url' => $latestOrder ? route('admin.orders.show', $latestOrder->id) : null,
                'order_count' => $orderList->count(),
            ];
        })->values()->all();

        // Daftar pesan gagal terbaru. PENTING: angka `failed_count` sengaja
        // dihitung dari SELURUH pesan gagal sepanjang waktu, sama seperti angka
        // dashboard, sehingga parameter rentang tidak mengubahnya (kontrak
        // audit admin 2026-09-23, B5). Daftar di bawah hanya untuk ditampilkan,
        // dibatasi 25 baris terbaru.
        $failedCount = WhatsAppMessage::where('status', 'failed')->count();

        $failedMessages = WhatsAppMessage::query()
            ->where('status', 'failed')
            ->with('order:id,order_number')
            ->orderByDesc('id')
            ->limit(25)
            ->get(['id', 'status', 'phone_number', 'order_id', 'content_text', 'error_reason', 'created_at'])
            ->map(function (WhatsAppMessage $message): array {
                $order = $message->order;
                $text = trim((string) $message->content_text);
                $error = trim((string) $message->error_reason);

                return [
                    'id' => (int) $message->id,
                    'status' => (string) $message->status,
                    // Format Indonesia singkat, mis. "23 Sep 2026, 14.05 WIB".
                    'created_at' => $message->created_at
                            ?->timezone(config('app.timezone'))
                            ->translatedFormat('d M Y, H.i').' WIB',
                    'recipient' => (string) $message->phone_number,
                    'order_number' => $order?->order_number,
                    'order_url' => $order ? route('admin.orders.show', $order->id) : null,
                    'message' => $text === '' ? null : \Illuminate\Support\Str::limit($text, 120),
                    'error' => $error === '' ? null : \Illuminate\Support\Str::limit($error, 160),
                ];
            })
            ->values()
            ->all();

        return Inertia::render('Admin/WhatsApp/Hub', [
            'title' => 'WhatsApp',
            'description' => 'Ringkasan percakapan pelanggan dan status pesanan terkini.',
            'stats' => $stats,
            'failed_count' => $failedCount,
            'failed_messages' => $failedMessages,
            'range' => $range,
            'range_label' => $rangeLabel,
            'range_options' => collect(self::HUB_RANGES)
                ->map(fn (array $meta, string $key) => ['value' => $key, 'label' => $meta['label']])
                ->values()
                ->all(),
            'connection' => $connection,
            'conversations' => $conversations,
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
            'description' => 'Template pesan WhatsApp yang dikirim otomatis di setiap tahapan pesanan, urut sesuai alur pesanan.',
            'automations' => $automations,
            'pairingUrl' => route('admin.whatsapp.pairing'),
            'totalTemplates' => count($automations),
            'replySignature' => WhatsAppService::replySignature(),
            // Owner 2026-09-17: status WhatsApp (terhubung/terputus) + nomor yang
            // sedang dipakai seluruh website.
            'connection' => $this->connectionPayload(),
        ]);
    }

    /**
     * Payload kartu status WhatsApp untuk halaman admin.
     *
     * Memanggil gateway SEKALI saja: sekaligus menyinkronkan nomor storefront
     * (nomor baru tersambung menggantikan nomor lama; saat terputus nomor
     * terakhir tetap dipertahankan).
     *
     * @return array{
     *   configured: bool, connected: bool, phone: string|null, error: string|null,
     *   storefront_phone: string, last_synced_at: string|null
     * }
     */
    protected function connectionPayload(): array
    {
        try {
            $sync = \App\Support\WhatsAppSessionPhone::sync();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Sinkron nomor WhatsApp gagal', ['error' => $e->getMessage()]);
            $status = \App\Support\WhatsAppSessionPhone::gatewayStatus();
            $sync = [
                'configured' => $status['configured'],
                'connected' => $status['connected'],
                'gateway_phone' => $status['phone'],
                'error' => $status['error'],
            ];
        }

        return [
            'configured' => (bool) ($sync['configured'] ?? false),
            'connected' => (bool) ($sync['connected'] ?? false),
            'phone' => $sync['gateway_phone'] ?? null,
            'error' => $sync['error'] ?? null,
            'storefront_phone' => \App\Support\ConsultationWhatsApp::displayPhone(),
            'last_synced_at' => \App\Support\WhatsAppSessionPhone::lastSyncedAt(),
        ];
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
            'replySignature' => WhatsAppService::replySignature(),
            'submitUrl' => route('admin.whatsapp.templates.update', $template),
            'backUrl' => route('admin.whatsapp.templates.index'),
            'pairingUrl' => route('admin.whatsapp.pairing'),
            'statusUrl' => route('admin.whatsapp.pairing.status'),
            'activateUrl' => route('admin.whatsapp.templates.activate', $template),
            'deactivateUrl' => route('admin.whatsapp.templates.deactivate', $template),
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
            ->route('admin.whatsapp.templates.index')
            ->with('success', 'Template WhatsApp '.$template->internal_key.' disimpan.');
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
        // Owner 2026-09-15: katalog hanya seed awal (firstOrCreate). Sebelumnya
        // forceFill menimpa body_preview tiap halaman index dibuka sehingga
        // edit admin selalu hilang. Reset naskah default kini manual via edit.
        //
        // Owner 2026-09-21: halaman ini dan seeder memakai SATU jalur penulisan
        // yang sama, WhatsAppTemplateSync. Baris baru dibuat lengkap dengan
        // naskah awal, baris rusak yang naskahnya kosong dipulihkan, dan naskah
        // yang sudah terisi tidak pernah ditimpa.
        WhatsAppTemplateSync::sync();
    }
}
