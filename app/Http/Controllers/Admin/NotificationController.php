<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use App\Services\ActivityLogService;
use App\Support\InertiaAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function __construct(protected ActivityLogService $logs) {}

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
            'destroy_url' => route('admin.notifications.destroy', $n),
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
            'prune_url' => route('admin.notifications.prune'),
            'prune_days' => (int) config('operations.notification_retention_days', 90),
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

    /**
     * Hapus satu notifikasi. Dipakai admin untuk membuang baris yang sudah tidak
     * relevan, misalnya pesan lama yang isinya perlu dibersihkan. Tidak ada
     * otorisasi tambahan di sini karena seluruh grup route admin sudah dijaga
     * middleware `auth` + `admin`, sama seperti markRead.
     */
    public function destroy(Request $request, AdminNotification $notification): RedirectResponse
    {
        $this->logs->record('notification.deleted', 'admin_notification', $notification->id, [
            'type' => $notification->type,
            'title' => $notification->title,
        ]);

        $notification->delete();

        return redirect()->back()->with('success', 'Notifikasi dihapus.');
    }

    /**
     * Pangkas notifikasi lama: hanya baris yang SUDAH dibaca dan waktu bacanya
     * lebih tua dari ambang retensi yang dihapus, jadi notifikasi belum dibaca
     * tidak pernah tersentuh.
     *
     * Catatan: kolom entity_id pada event_logs NOT NULL, sedangkan pangkas adalah
     * operasi massal tanpa satu baris tertentu. Nilai 0 dipakai sebagai penanda
     * "tanpa entitas tunggal"; jumlah baris yang terhapus ada di payload.
     */
    public function prune(Request $request): RedirectResponse
    {
        $days = (int) config('operations.notification_retention_days', 90);
        $cutoff = now()->subDays($days);

        $deleted = AdminNotification::query()
            ->whereNotNull('read_at')
            ->where('read_at', '<', $cutoff)
            ->delete();

        $this->logs->record('notification.pruned', 'admin_notification', 0, [
            'deleted' => $deleted,
            'days' => $days,
        ]);

        return redirect()->back()->with(
            'success',
            $deleted.' notifikasi dibaca yang lebih tua dari '.$days.' hari dihapus.'
        );
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

