<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use App\Models\WhatsAppMessage;
use App\Services\WhatsAppService;
use App\Support\PhoneNumber;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;

class WhatsAppMessageController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $requestedPhone = trim((string) $request->query('phone', ''));

        // Ambil daftar nomor telepon percakapan (agregasi per nomor)
        $threadsQuery = WhatsAppMessage::query()
            ->select('phone_number')
            ->selectRaw('MAX(id) as last_id')
            ->selectRaw('COUNT(*) as message_count')
            ->groupBy('phone_number')
            ->orderByDesc('last_id');

        if ($search !== '') {
            $threadsQuery->where('phone_number', 'like', "%{$search}%");
        }

        $threadRows = $threadsQuery->limit(50)->get();

        // Kumpulkan last_id untuk eager loading pesan terakhir
        $lastIds = $threadRows->pluck('last_id')->filter()->all();
        $latestMessages = WhatsAppMessage::with('order')
            ->whereIn('id', $lastIds)
            ->get()
            ->keyBy('id');

        // Kumpulkan nomor telepon untuk resolusi nama customer & order
        $phoneNumbers = $threadRows->pluck('phone_number')->unique()->all();

        $customersByPhone = Customer::query()
            ->whereIn('phone', $phoneNumbers)
            ->get()
            ->keyBy('phone');

        $latestOrdersByPhone = Order::query()
            ->whereIn('customer_phone', $phoneNumbers)
            ->latest('id')
            ->get()
            ->groupBy('customer_phone');

        // Susun daftar percakapan
        $conversations = $threadRows->map(function ($row) use ($latestMessages, $customersByPhone, $latestOrdersByPhone) {
            $phone = (string) $row->phone_number;
            $lastMsg = $latestMessages->get($row->last_id);

            // Deteksi apakah nomor broadcast/channel WA (ID panjang 18+ digit)
            $isChannel = strlen($phone) > 16 || str_starts_with($phone, '62120363') || str_starts_with($phone, '120363');

            $linkedOrders = $latestOrdersByPhone->get($phone);
            $latestOrder = $linkedOrders?->first();

            $customer = $customersByPhone->get($phone);
            $customerName = $latestOrder?->customer_name ?? $customer?->name;

            if ($isChannel && ! $customerName) {
                $customerName = 'Saluran WhatsApp';
            }

            return [
                'phone' => $phone,
                'phone_formatted' => PhoneNumber::formatDisplay($phone) ?? $phone,
                'customer_name' => $customerName,
                'is_channel' => $isChannel,
                'message_count' => (int) $row->message_count,
                'last_message' => $lastMsg ? [
                    'id' => $lastMsg->id,
                    'text' => (string) $lastMsg->content_text,
                    'direction' => $lastMsg->direction,
                    'status' => $lastMsg->status,
                    'created_at' => optional($lastMsg->created_at)?->toIso8601String(),
                    'created_at_label' => optional($lastMsg->created_at)?->locale('id')->diffForHumans(),
                ] : null,
                'latest_order' => $latestOrder ? [
                    'id' => $latestOrder->id,
                    'order_number' => $latestOrder->order_number,
                    'order_status' => $latestOrder->order_status,
                    'total_amount_formatted' => 'Rp ' . number_format((float) $latestOrder->total_amount, 0, ',', '.'),
                ] : null,
            ];
        })->values()->all();

        // Tentukan nomor aktif
        $activePhone = $requestedPhone !== ''
            ? $requestedPhone
            : ($conversations[0]['phone'] ?? '');

        // Ambil riwayat chat lengkap untuk nomor yang aktif
        $chatMessages = [];
        $activeCustomerContext = null;

        if ($activePhone !== '') {
            $chatMessages = WhatsAppMessage::with('order:id,order_number,order_status')
                ->where('phone_number', $activePhone)
                ->orderBy('id', 'asc')
                ->limit(150)
                ->get()
                ->map(fn (WhatsAppMessage $m) => [
                    'id' => $m->id,
                    'direction' => $m->direction,
                    'status' => $m->status,
                    'content_text' => (string) $m->content_text,
                    'internal_template_key' => $m->internal_template_key,
                    'order_id' => $m->order_id,
                    'order_number' => $m->order?->order_number,
                    'created_at' => optional($m->created_at)?->toIso8601String(),
                    'time_label' => optional($m->created_at)?->format('H:i'),
                    'date_label' => optional($m->created_at)?->locale('id')->translatedFormat('d M Y'),
                ])->all();

            $customerOrders = Order::query()
                ->where('customer_phone', $activePhone)
                ->latest('id')
                ->limit(5)
                ->get(['id', 'order_number', 'order_status', 'total_amount', 'shipping_city', 'created_at']);

            $firstOrder = $customerOrders->first();
            $customerProfile = Customer::where('phone', $activePhone)->first();

            $activeCustomerContext = [
                'phone' => $activePhone,
                'phone_formatted' => PhoneNumber::formatDisplay($activePhone) ?? $activePhone,
                'name' => $firstOrder?->customer_name ?? $customerProfile?->name ?? 'Pelanggan',
                'city' => $firstOrder?->shipping_city ?? $customerProfile?->default_city ?? '',
                'total_orders' => $customerOrders->count(),
                'orders' => $customerOrders->map(fn ($o) => [
                    'id' => $o->id,
                    'order_number' => $o->order_number,
                    'order_status' => $o->order_status,
                    'total_amount_formatted' => 'Rp ' . number_format((float) $o->total_amount, 0, ',', '.'),
                    'href' => route('admin.orders.show', $o),
                ])->all(),
            ];
        }

        // Cek status gateway Baileys
        $gatewayStatus = [
            'connected' => true,
            'status' => 'open',
            'phone' => '62881080733754',
        ];

        try {
            $base = rtrim((string) config('services.whatsapp.baileys.base_url', 'http://127.0.0.1:3005'), '/');
            $key = (string) config('services.whatsapp.baileys.api_key', '');
            $res = Http::timeout(1)
                ->withHeaders($key !== '' ? ['X-Api-Key' => $key] : [])
                ->get($base . '/status');
            if ($res->successful()) {
                $body = $res->json();
                $gatewayStatus = [
                    'connected' => ($body['status'] ?? '') === 'open',
                    'status' => (string) ($body['status'] ?? 'unknown'),
                    'phone' => (string) ($body['phone'] ?? '62881080733754'),
                ];
            }
        } catch (\Throwable) {
            // Gunakan fallback
        }

        return Inertia::render('Admin/WhatsApp/Messages', [
            'title' => 'Pesan WhatsApp',
            'search' => $search,
            'conversations' => $conversations,
            'active_phone' => $activePhone,
            'messages' => $chatMessages,
            'customer_context' => $activeCustomerContext,
            'gateway_status' => $gatewayStatus,
            'pairing_url' => route('admin.whatsapp.pairing'),
            'templates_url' => route('admin.whatsapp.templates.index'),
        ]);
    }

    public function reply(Request $request, WhatsAppService $whatsapp): RedirectResponse
    {
        $validated = $request->validate([
            'phone_number' => 'required|string',
            'message_text' => 'required|string|max:2000',
            'order_id' => 'nullable|integer',
        ]);

        $orderId = isset($validated['order_id']) && $validated['order_id'] > 0
            ? (int) $validated['order_id']
            : null;

        $cleanPhone = PhoneNumber::normalize($validated['phone_number']) ?? $validated['phone_number'];

        $whatsapp->sendTextMessage(
            $cleanPhone,
            trim($validated['message_text']),
            $orderId
        );

        return redirect()->route('admin.whatsapp.messages.index', ['phone' => $cleanPhone])
            ->with('success', 'Pesan WhatsApp berhasil dikirim.');
    }

    public function byOrder(Order $order): RedirectResponse
    {
        $phone = $order->customer_phone;
        if ($phone) {
            $cleanPhone = PhoneNumber::normalize($phone) ?? $phone;
            return redirect()->route('admin.whatsapp.messages.index', ['phone' => $cleanPhone]);
        }

        return redirect()->route('admin.whatsapp.messages.index');
    }

    public function show(WhatsAppMessage $message): RedirectResponse
    {
        $phone = $message->phone_number;
        if ($phone) {
            $cleanPhone = PhoneNumber::normalize($phone) ?? $phone;
            return redirect()->route('admin.whatsapp.messages.index', ['phone' => $cleanPhone]);
        }

        return redirect()->route('admin.whatsapp.messages.index');
    }
}
