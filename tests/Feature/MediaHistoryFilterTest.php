<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\MediaProcessingLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Filter halaman Riwayat Media (/admin/media/history).
 *
 * Dua hal yang dijaga di sini, keduanya temuan nyata pada 8 Okt 2026:
 *
 * 1. Nilai event yang tidak punya tab lagi (mis. ?event=dedup dari tautan lama)
 *    membuat halaman tampil tanpa tab aktif dan daftar kosong, sehingga terbaca
 *    seperti halaman rusak. Nilai itu sekarang dinormalkan menjadi kosong.
 * 2. Filter periode memakai pola yang sama dengan halaman daftar admin lain, dan
 *    rentang tanggal hanya berlaku saat periode rentang yang dipilih.
 */
class MediaHistoryFilterTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    private function log(string $event, ?string $createdAt = null, string $label = 'aset.png'): MediaProcessingLog
    {
        return MediaProcessingLog::create([
            'loggable_type' => MediaAsset::class,
            'loggable_id' => 1,
            'entity_label' => $label,
            'event' => $event,
            'message' => 'Uji '.$event,
            'created_at' => $createdAt ?? now(),
        ]);
    }

    public function test_event_yang_tidak_punya_tab_dinormalkan_menjadi_kosong(): void
    {
        $this->log('dedup');
        $this->log('success');

        // Empat nilai yang tidak punya tab, karena tiga sebab berbeda:
        // - dedup: penjagaan berkas kembar sudah jalan di klien.
        // - downloaded: bukan event sama sekali, melainkan status lampiran media.
        // - processing dan queued: bukan keadaan yang bertahan, karena setiap tahap
        //   menambah barisnya sendiri sehingga tabnya tidak menyaring apa pun.
        // Tanpa normalisasi, halaman menyaring ke event itu dan tampil tanpa tab
        // aktif, terbaca seperti halaman rusak.
        foreach (['dedup', 'downloaded', 'processing', 'queued'] as $event) {
            $this->actingAs($this->admin())
                ->get(route('admin.media.history', ['event' => $event]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Admin/Media/History')
                    ->where('filters.event', '')
                    // Daftar kembali memuat semua log, bukan kosong.
                    ->has('logs', 2));
        }
    }

    public function test_event_yang_punya_tab_tetap_menyaring(): void
    {
        $this->log('dedup');
        $this->log('success');

        $this->actingAs($this->admin())
            ->get(route('admin.media.history', ['event' => 'success']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.event', 'success')
                ->has('logs', 1)
                ->where('logs.0.event', 'success'));
    }

    public function test_tanpa_filter_semua_log_tampil(): void
    {
        $this->log('dedup');
        $this->log('success');

        $this->actingAs($this->admin())
            ->get(route('admin.media.history'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.event', '')
                ->where('activeDatePreset', '')
                ->where('periodLabel', 'Semua waktu')
                ->has('logs', 2));
    }

    public function test_periode_hari_ini_menyaring_berdasarkan_created_at(): void
    {
        $this->log('success', now()->toDateTimeString());
        $this->log('success', now()->subDays(10)->toDateTimeString());

        $this->actingAs($this->admin())
            ->get(route('admin.media.history', ['date_preset' => 'today']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activeDatePreset', 'today')
                ->where('periodLabel', 'Hari ini')
                ->has('logs', 1));
    }

    public function test_periode_rentang_memakai_batas_dari_dan_sampai(): void
    {
        $this->log('success', '2026-09-10 10:00:00');
        $this->log('success', '2026-09-20 10:00:00');
        $this->log('success', '2026-10-01 10:00:00');

        $this->actingAs($this->admin())
            ->get(route('admin.media.history', [
                'date_preset' => 'range',
                'date_from' => '2026-09-15',
                'date_to' => '2026-09-25',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activeDatePreset', 'range')
                ->has('logs', 1)
                ->where('logs.0.created_at', fn ($v) => str_starts_with((string) $v, '2026-09-20')));
    }

    public function test_rentang_tanggal_diabaikan_saat_periode_bukan_rentang(): void
    {
        // Tanggal sisa pilihan lama tidak boleh menyaring diam-diam: kalau ikut
        // berlaku, daftar menyusut tanpa terlihat di kontrol mana pun.
        $this->log('success', '2026-09-20 10:00:00');
        $this->log('success', now()->toDateTimeString());

        $this->actingAs($this->admin())
            ->get(route('admin.media.history', [
                'date_preset' => 'today',
                'date_from' => '2026-09-15',
                'date_to' => '2026-09-25',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activeDatePreset', 'today')
                ->has('logs', 1));
    }

    public function test_preset_periode_yang_tidak_dikenal_diabaikan(): void
    {
        // Mengikuti pola filter di Order, Payment, dan Shipping: nilai yang tidak
        // dikenal dibuat kosong, bukan ditolak dengan galat. Menolaknya membuat
        // tautan lama memantul ke halaman sebelumnya.
        $this->log('success');

        $this->actingAs($this->admin())
            ->get(route('admin.media.history', ['date_preset' => 'kemarin']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activeDatePreset', '')
                ->where('periodLabel', 'Semua waktu')
                ->has('logs', 1));
    }

    public function test_baris_log_menyertakan_media_href_ke_library_atau_produk(): void
    {
        $asset = MediaAsset::create([
            'kind' => 'image',
            'label' => 'foto-banner.png',
            'object_key' => 'media/foto-banner.png',
            'mime_type' => 'image/png',
            'size_bytes' => 100,
            'status' => 'ready',
            'visibility' => 'visible',
        ]);

        MediaProcessingLog::record($asset, 'success', 'Derivatif WebP siap.');

        $this->actingAs($this->admin())
            ->get(route('admin.media.history'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs', 1)
                ->where('logs.0.media_href', route('admin.media.library', ['q' => 'foto-banner.png']))
                ->where('logs.0.merged_into', null));
    }

    public function test_baris_log_penggabungan_duplikat_menyertakan_tujuan_penggabungan(): void
    {
        $canonical = MediaAsset::create([
            'kind' => 'image',
            'label' => 'foto-asli.png',
            'object_key' => 'media/foto-asli.png',
            'mime_type' => 'image/png',
            'size_bytes' => 100,
            'status' => 'ready',
            'visibility' => 'visible',
        ]);

        $dup = MediaAsset::create([
            'kind' => 'image',
            'label' => 'foto-duplikat.png',
            'object_key' => 'media/foto-duplikat.png',
            'mime_type' => 'image/png',
            'size_bytes' => 100,
            'status' => 'archived',
            'visibility' => 'archived',
        ]);

        MediaProcessingLog::record($dup, 'dedup', 'File identik dengan aset lain.', [
            'merged_into_asset_id' => $canonical->id,
            'merged_into_label' => $canonical->label,
        ]);

        $this->actingAs($this->admin())
            ->get(route('admin.media.history'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs', 1)
                ->where('logs.0.merged_into.asset_id', $canonical->id)
                ->where('logs.0.merged_into.label', 'foto-asli.png')
                ->where('logs.0.merged_into.href', route('admin.media.library', ['q' => 'foto-asli.png'])));
    }

    public function test_label_periode_rentang_menyebut_tanggal(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.media.history', [
                'date_preset' => 'range',
                'date_from' => '2026-09-15',
                'date_to' => '2026-09-25',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('periodLabel', fn ($v) => is_string($v) && str_contains($v, 'sampai')));
    }
}
