<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    /**
     * Daftar notifikasi admin (spec ??F: 1 daftar, klik ??? detail).
     */
    public function index(Request $request): Response
    {
        $unreadOnly = $request->boolean('unread');

        $query = AdminNotification::query()
            ->with('order:id,order_number')
            ->latest('id');

        if ($unreadOnly) {
            $query->unread();
        }

        $notifications = $query->limit(100)->get()->map(fn (AdminNotification $n) => [
            'id' => $n->id,
            'type' => $n->type,
            'title' => $n->title,
            'body' => $n->body,
            'href' => $n->href,
            'read_at' => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at?->toIso8601String(),
            'created_at_label' => $n->created_at?->locale('id')->diffForHumans(),
        ])->all();

        return Inertia::render('Admin/Notifications', [
            'title' => 'Notifikasi',
            'description' => 'Pesanan baru, sampai, dan dibatalkan.',
            'notifications' => $notifications,
            'unread_count' => AdminNotification::unread()->count(),
            'unread_only' => $unreadOnly,
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
}

