<?php

namespace Tests\Feature;

use App\Models\AdminNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Manajemen notifikasi admin: hapus satu baris dan pangkas baris lama.
 *
 * Aturan yang dijaga:
 * - hapus membuang barisnya dari tabel dan mencatat activity log;
 * - pangkas (prune) hanya menghapus notifikasi yang SUDAH dibaca dan waktu
 *   bacanya lebih tua dari ambang retensi;
 * - notifikasi belum dibaca tidak pernah tersentuh pangkas.
 */
class NotificationManageTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function notification(array $overrides = []): AdminNotification
    {
        return AdminNotification::create(array_merge([
            'type' => 'system_info',
            'title' => 'Notifikasi uji',
            'body' => 'Isi notifikasi uji.',
        ], $overrides));
    }

    public function test_destroy_removes_the_row(): void
    {
        $admin = $this->admin();
        $notification = $this->notification(['title' => 'Baris yang dihapus']);

        $this->actingAs($admin)
            ->delete(route('admin.notifications.destroy', $notification))
            ->assertRedirect();

        $this->assertDatabaseMissing('admin_notifications', ['id' => $notification->id]);
    }

    public function test_destroy_records_activity_log(): void
    {
        $admin = $this->admin();
        $notification = $this->notification(['title' => 'Baris dengan jejak log']);

        $this->actingAs($admin)
            ->delete(route('admin.notifications.destroy', $notification));

        $this->assertDatabaseHas('event_logs', [
            'event_type' => 'notification.deleted',
            'entity_type' => 'admin_notification',
            'entity_id' => $notification->id,
        ]);
    }

    public function test_prune_only_removes_read_rows_older_than_threshold(): void
    {
        $admin = $this->admin();
        $days = (int) config('operations.notification_retention_days', 90);

        $oldRead = $this->notification(['title' => 'Dibaca dan lama']);
        $oldRead->forceFill(['read_at' => now()->subDays($days + 5)])->save();

        $recentRead = $this->notification(['title' => 'Dibaca dan baru']);
        $recentRead->forceFill(['read_at' => now()->subDays(2)])->save();

        $unreadOld = $this->notification(['title' => 'Belum dibaca dan lama']);
        $unreadOld->forceFill(['created_at' => now()->subDays($days + 30)])->save();

        $this->actingAs($admin)
            ->post(route('admin.notifications.prune'))
            ->assertRedirect();

        $this->assertDatabaseMissing('admin_notifications', ['id' => $oldRead->id]);
        $this->assertDatabaseHas('admin_notifications', ['id' => $recentRead->id]);
        $this->assertDatabaseHas('admin_notifications', ['id' => $unreadOld->id]);
    }

    public function test_prune_never_touches_unread_rows_even_when_created_long_ago(): void
    {
        $admin = $this->admin();
        $days = (int) config('operations.notification_retention_days', 90);

        $unread = $this->notification(['title' => 'Belum dibaca']);
        $unread->forceFill(['created_at' => now()->subDays($days + 100)])->save();

        $this->actingAs($admin)->post(route('admin.notifications.prune'));

        $this->assertDatabaseHas('admin_notifications', [
            'id' => $unread->id,
            'read_at' => null,
        ]);
    }

    public function test_index_exposes_destroy_and_prune_urls(): void
    {
        $admin = $this->admin();
        $notification = $this->notification(['title' => 'Baris untuk payload']);

        $response = $this->actingAs($admin)->get(route('admin.notifications.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/Notifications')
            ->where('prune_url', route('admin.notifications.prune'))
            ->where('notifications.0.destroy_url', route('admin.notifications.destroy', $notification))
        );
    }
}
