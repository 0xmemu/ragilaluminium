<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use App\Support\InertiaAdmin;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    /**
     * Daftar notifikasi admin (spec F: 1 daftar, klik -> detail).
     */
    /**
     * Kategori notifikasi (owner 2026-09-16): pesan WhatsApp, pesanan, dan sistem.
     * Prefix tipe dipakai agar tipe baru otomatis masuk kategori yang tepat.
     */
    private const CATEGORY_PREFIXES = [
        'orders' => ['order_'],
        'messages' => ['whatsapp_'],
        'system' => ['media_', 'product_', 'system_'],
    ];

    /** Terapkan filter kategori ke query (dipakai daftar & hitungan badge). */
    private function applyCategory($query, string $category): void
    {
        if ($category === 'all') {
            return;
        }

        $prefixes = self::CATEGORY_PREFIXES[$category] ?? [];
        if ($prefixes === []) {
            return;
        }

        $query->where(function ($inner) use ($prefixes): void {
            foreach ($prefixes as $prefix) {
                $inner->orWhere('type', 'like', $prefix.'%');
            }
        });
    }

    public function index(Request $request): Response
    {
        $unreadOnly = $request->boolean('unread');
        $category = (string) $request->query('category', 'all');
        if (! in_array($category, ['all', 'orders', 'messages', 'system'], true)) {
            $category = 'all';
        }

        // Ukuran halaman: hanya 20, 50, 100 yang diterima; nilai lain jatuh ke 20.
        $perPage = (int) $request->query('per_page', 20);
        if (! in_array($perPage, [20, 50, 100], true)) {
            $perPage = 20;
        }

        $query = AdminNotification::query()
            ->with('order:id,order_number')
            ->latest('id');
        $this->applyCategory($query, $category);

        if ($unreadOnly) {
            $query->unread();
        }

        $paginator = $query->paginate($perPage)->appends($request->query());
        $notifications = collect($paginator->items())->map(fn (AdminNotification $n) => [
            'id' => $n->id,
            'type' => $n->type,
            'title' => $n->title,
            'body' => $n->body,
            'href' => $n->href,
            'read_at' => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at?->toIso8601String(),
            'created_at_label' => $n->created_at?->locale('id')->diffForHumans(),
        ])->all();

        // Hitungan per kategori mengikuti filter "belum dibaca" agar badge konsisten.
        $counts = [];
        foreach (['all', 'orders', 'messages', 'system'] as $key) {
            $countQuery = AdminNotification::query();
            $this->applyCategory($countQuery, $key);

            if ($unreadOnly) {
                $countQuery->unread();
            }

            $counts[$key] = $countQuery->count();
        }

        return Inertia::render('Admin/Notifications', [
            'title' => 'Notifikasi',
            'description' => 'Pesan WhatsApp, pesanan baru, dan pemberitahuan sistem.',
            'notifications' => $notifications,
            'unread_count' => AdminNotification::unread()->count(),
            'unread_only' => $unreadOnly,
            'active_category' => $category,
            'category_counts' => $counts,
            'perPage' => $perPage,
            'pagination' => InertiaAdmin::pagination($paginator),
            'markAllReadUrl' => route('admin.notifications.mark-all-read'),
        ]);
    }

    public function markRead(Request $request, AdminNotification $notification): \Illuminate\Http\RedirectResponse
    {
        if ($notification->read_at === null) {
            $notification->forceFill(['read_at' => now()])->save();
        }

        return redirect()->back();
    }

    public function markAllRead(): \Illuminate\Http\RedirectResponse
    {
        AdminNotification::unread()->update(['read_at' => now()]);

        return redirect()->back();
    }

    public function poll(Request $request): \Illuminate\Http\JsonResponse
    {
        $lastId = (int) $request->query('last_id', 0);

        $newNotifications = AdminNotification::query()
            ->with('order:id,order_number')
            ->when($lastId > 0, fn ($q) => $q->where('id', '>', $lastId))
            ->latest('id')
            ->limit(10)
            ->get()
            ->map(fn (AdminNotification $n) => [
                'id' => $n->id,
                'type' => $n->type,
                'title' => $n->title,
                'body' => $n->body,
                'href' => $n->href,
                'read_at' => $n->read_at?->toIso8601String(),
                'created_at' => $n->created_at?->toIso8601String(),
                'created_at_label' => $n->created_at?->locale('id')->diffForHumans(),
            ]);

        return response()->json([
            'unread_count' => AdminNotification::unread()->count(),
            'latest_id' => (int) AdminNotification::max('id'),
            'new_notifications' => $newNotifications,
        ]);
    }
}

