<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\WhatsAppMessage;
use App\Support\InertiaAdmin;
use App\Support\LikeSearch;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WhatsAppMessageController extends Controller
{
    public function index(Request $request): Response
    {
        $messages = WhatsAppMessage::with('order')
            ->when($request->filled('direction'), fn ($q) => $q->where('direction', $request->direction))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('phone_number'), fn ($q) => LikeSearch::whereLike($q, 'phone_number', (string) $request->phone_number))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/ResourceIndex', [
            'title' => 'Pesan WhatsApp',
            'createHref' => null,
            'toolbarLinks' => [
                ['label' => 'Pairing WhatsApp', 'href' => route('admin.whatsapp.pairing')],
                ['label' => 'Template (Advanced)', 'href' => route('admin.whatsapp.templates.index')],
            ],
            'columns' => [
                ['key' => 'id', 'label' => 'ID', 'hrefKey' => 'href'],
                ['key' => 'provider', 'label' => 'Provider'],
                ['key' => 'direction', 'label' => 'Arah'],
                ['key' => 'phone_number', 'label' => 'Nomor'],
                ['key' => 'status', 'label' => 'Status'],
                ['key' => 'order_number', 'label' => 'Pesanan'],
                ['key' => 'created_at', 'label' => 'Waktu'],
            ],
            'rows' => $messages->getCollection()->map(function (WhatsAppMessage $m) {
                $actions = [];
                $phone = $m->phone_number;
                if ($m->status === 'failed' && $phone) {
                    $cleanPhone = preg_replace('/[^0-9]/', '', (string) $phone);
                    // Buka chat WA (andal). Pesan diambil dari kolom konten (disalin manual).
                    $actions[] = [
                        'label' => 'Buka chat WA',
                        'method' => 'get',
                        'href' => 'https://wa.me/'.$cleanPhone,
                    ];
                }

                return [
                    'id' => $m->id,
                    'provider' => strtoupper((string) $m->provider),
                    'direction' => $m->direction,
                    'phone_number' => $m->phone_number,
                    'status' => $m->status,
                    'order_number' => $m->order?->order_number ?? '-',
                    'content_preview' => mb_substr((string) $m->content_text, 0, 120),
                    'created_at' => optional($m->created_at)?->toDateTimeString(),
                    'href' => route('admin.whatsapp.messages.show', $m),
                    'actions' => $actions,
                ];
            })->all(),
            'pagination' => InertiaAdmin::pagination($messages),
        ]);
    }

    public function byOrder(Order $order): Response
    {
        $order->load('whatsappMessages');

        return Inertia::render('Admin/ResourceIndex', [
            'title' => 'WhatsApp · '.$order->order_number,
            'createHref' => null,
            'columns' => [
                ['key' => 'id', 'label' => 'ID', 'hrefKey' => 'href'],
                ['key' => 'provider', 'label' => 'Provider'],
                ['key' => 'direction', 'label' => 'Arah'],
                ['key' => 'phone_number', 'label' => 'Nomor'],
                ['key' => 'status', 'label' => 'Status'],
                ['key' => 'created_at', 'label' => 'Waktu'],
            ],
            'rows' => $order->whatsappMessages->map(fn (WhatsAppMessage $m) => [
                'id' => $m->id,
                'provider' => strtoupper((string) $m->provider),
                'direction' => $m->direction,
                'phone_number' => $m->phone_number,
                'status' => $m->status,
                'created_at' => optional($m->created_at)?->toDateTimeString(),
                'href' => route('admin.whatsapp.messages.show', $m),
            ])->values()->all(),
            'pagination' => null,
        ]);
    }

    public function show(WhatsAppMessage $message): Response
    {
        return Inertia::render('Admin/ResourceShow', [
            'title' => 'Pesan #'.$message->id,
            'subtitle' => $message->phone_number,
            'fields' => [
                ['label' => 'Provider', 'value' => strtoupper((string) $message->provider)],
                ['label' => 'Arah', 'value' => $message->direction],
                ['label' => 'Status', 'value' => $message->status],
                ['label' => 'Nomor', 'value' => $message->phone_number],
                ['label' => 'Order ID', 'value' => $message->order_id],
                ['label' => 'Template Key', 'value' => $message->internal_template_key],
                ['label' => 'Provider ID', 'value' => $message->provider_message_id],
                ['label' => 'Session', 'value' => $message->provider_session],
                ['label' => 'Konten', 'value' => $message->content_text],
                ['label' => 'Waktu', 'value' => optional($message->created_at)?->toDateTimeString()],
            ],
            'sections' => [],
        ]);
    }
}
