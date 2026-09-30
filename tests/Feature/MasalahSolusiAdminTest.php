<?php

namespace Tests\Feature;

use App\Models\CmsProblemSolution;
use App\Models\MediaAsset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MasalahSolusiAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_problems_solutions_and_public_page_renders(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.masalah-solusi.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/MasalahSolusi/Index'));

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Kayu jendela cepat lapuk kena hujan',
                'solution_body' => 'Ganti ke jendela aluminium anti rayap dengan finishing powder coating.',
                'sort_order' => 1,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $item = CmsProblemSolution::query()->first();
        $this->assertNotNull($item);
        $this->assertSame('Ganti ke jendela aluminium anti rayap dengan finishing powder coating.', $item->solution);

        $this->actingAs($admin)
            ->put(route('admin.masalah-solusi.update', $item), [
                'problem' => 'Kayu cepat lapuk & rayap',
                'solution_body' => 'Pakai aluminium Inkalum + kaca 5 mm, siap pasang.',
                'sort_order' => 1,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $this->get(route('masalah-dan-solusi'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/MasalahSolusi')
                ->has('guide.items', 1)
                ->where('guide.items.0.problem', 'Kayu cepat lapuk & rayap'));

        $this->actingAs($admin)
            ->put(route('admin.masalah-solusi.reorder'), [
                'rows' => [['id' => $item->id, 'sort_order' => 3]],
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $this->assertSame(3, (int) $item->fresh()->sort_order);

        $this->actingAs($admin)
            ->delete(route('admin.masalah-solusi.destroy', $item))
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $this->assertDatabaseMissing('cms_problems_solutions', ['id' => $item->id]);
    }

    /** Buat aset Media Library yang siap pakai. */
    private function mediaAsset(string $kind = 'image', ?string $key = null): MediaAsset
    {
        $slug = $key ?? ($kind.'-'.uniqid());

        return MediaAsset::create([
            'kind' => $kind,
            'label' => 'Aset '.$slug,
            'checksum' => hash('sha256', $slug),
            'object_key' => 'media-assets/'.$slug.'/'.($kind === 'video' ? 'video.mp4' : 'card.webp'),
            'status' => 'ready',
            'visibility' => 'visible',
        ]);
    }

    public function test_admin_can_attach_documentation_media_from_library(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $foto1 = $this->mediaAsset('image', 'foto-retak');
        $foto2 = $this->mediaAsset('image', 'foto-goresan');

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Barang rusak saat pengiriman',
                'solution_body' => 'Hubungi kami untuk klaim garansi pengiriman.',
                'examples_hint' => 'Retak bingkai, goresan kaca',
                // Owner 2026-09-16: Media Library satu-satunya sumber media.
                'media_asset_ids' => [$foto1->id, $foto2->id],
                'photo_alts' => ['Retak bingkai', 'Goresan kaca'],
                'sort_order' => 1,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $item = CmsProblemSolution::query()->first();
        $this->assertNotNull($item);

        $decoded = json_decode($item->solution, true);
        $this->assertIsArray($decoded);
        $this->assertSame('rich', $decoded['type'] ?? null);
        $this->assertCount(2, $decoded['photos'] ?? []);
        $this->assertSame('Retak bingkai', $decoded['photos'][0]['alt'] ?? null);

        $this->get(route('masalah-dan-solusi'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/MasalahSolusi')
                ->where('guide.items.0.solution.type', 'rich'));
    }

    public function test_video_can_come_from_media_library(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $video = $this->mediaAsset('video', 'video-pasang');

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Cara memasang yang benar',
                'solution_body' => 'Ikuti langkah pada video.',
                'media_video_asset_id' => $video->id,
                'sort_order' => 1,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $decoded = json_decode(CmsProblemSolution::query()->first()->solution, true);

        $this->assertSame('rich', $decoded['type'] ?? null);
        $this->assertSame('library', $decoded['video']['source'] ?? null);
        $this->assertSame($video->id, $decoded['video']['asset_id'] ?? null);
        $this->assertNotNull($decoded['video']['src'] ?? null);
    }

    /** Kontrak owner 2026-09-20: maksimal 2 media per item, foto dan video satu slot. */
    public function test_media_beyond_two_slots_is_rejected(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $a = $this->mediaAsset('image', 'a');
        $b = $this->mediaAsset('image', 'b');
        $c = $this->mediaAsset('image', 'c');

        // Tiga foto sekaligus: ditolak validasi (max 2).
        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Tiga foto',
                'solution_body' => 'Solusi.',
                'media_asset_ids' => [$a->id, $b->id, $c->id],
            ])
            ->assertSessionHasErrors('media_asset_ids');

        $this->assertDatabaseCount('cms_problems_solutions', 0);
    }

    public function test_two_photos_plus_video_is_rejected(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $a = $this->mediaAsset('image', 'dua-a');
        $b = $this->mediaAsset('image', 'dua-b');
        $video = $this->mediaAsset('video', 'dua-video');

        // Dua foto + satu video = 3 slot, melewati batas walau masing-masing di
        // dalam batasnya sendiri.
        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Dua foto dan satu video',
                'solution_body' => 'Solusi.',
                'media_asset_ids' => [$a->id, $b->id],
                'media_video_asset_id' => $video->id,
            ])
            ->assertSessionHasErrors('media_asset_ids');

        $this->assertDatabaseCount('cms_problems_solutions', 0);
    }

    public function test_one_photo_plus_video_is_allowed(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $foto = $this->mediaAsset('image', 'campur-foto');
        $video = $this->mediaAsset('video', 'campur-video');

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Satu foto dan satu video',
                'solution_body' => 'Solusi.',
                'media_asset_ids' => [$foto->id],
                'media_video_asset_id' => $video->id,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $decoded = json_decode(CmsProblemSolution::query()->first()->solution, true);
        $this->assertCount(1, $decoded['photos'] ?? []);
        $this->assertSame('library', $decoded['video']['source'] ?? null);
    }

    /**
     * Koreksi owner 2026-09-29: video hanya dari Media Library. Tautan video
     * luar, isian durasi, dan poster manual dihapus dari form, jadi ketiganya
     * tidak lagi berpengaruh walau tetap dikirim ke server.
     */
    public function test_field_video_lama_diabaikan(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $video = $this->mediaAsset('video', 'video-bersih');
        $poster = $this->mediaAsset('image', 'poster-manual');

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Video dengan field lama',
                'solution_body' => 'Solusi.',
                'media_video_asset_id' => $video->id,
                // Tiga field yang sudah dihapus dari form:
                'video_url' => 'https://youtube.com/watch?v=abc',
                'video_duration' => '02:37',
                'video_poster_asset_id' => $poster->id,
                'remove_video_poster' => false,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $decoded = json_decode(CmsProblemSolution::query()->first()->solution, true);
        $videoPayload = $decoded['video'] ?? [];

        $this->assertSame('library', $videoPayload['source'] ?? null);
        $this->assertStringNotContainsString('youtube.com', (string) ($videoPayload['src'] ?? ''));
        // Durasi tidak lagi disimpan sama sekali.
        $this->assertArrayNotHasKey('duration', $videoPayload);
        // Poster selalu dari berkas videonya, bukan aset poster pilihan admin.
        $this->assertStringNotContainsString(
            'poster-manual',
            (string) ($videoPayload['poster'] ?? ''),
        );
    }

    /** Tautan video luar tanpa berkas Library tidak menghasilkan video sama sekali. */
    public function test_tautan_video_luar_tanpa_berkas_tidak_menghasilkan_video(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Hanya tautan luar',
                'solution_body' => 'Solusi.',
                'video_url' => 'https://youtube.com/watch?v=abc',
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $decoded = json_decode(CmsProblemSolution::query()->first()->solution, true);
        $this->assertNull($decoded['video'] ?? null);
    }

    /**
     * Halaman edit memuat video terpasang lengkap dengan NAMA BERKASNYA, bukan
     * nomor id aset, supaya admin tahu video mana yang sedang dipakai
     * (koreksi owner 2026-09-29).
     */
    public function test_form_edit_memuat_video_terpasang_dengan_namanya(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $video = $this->mediaAsset('video', 'video-nama-berkas');

        $this->actingAs($admin)->post(route('admin.masalah-solusi.store'), [
            'problem' => 'Video dengan nama berkas',
            'solution_body' => 'Solusi.',
            'media_video_asset_id' => $video->id,
            'sort_order' => 1,
        ]);

        $item = CmsProblemSolution::query()->first();

        $this->actingAs($admin)
            ->get(route('admin.masalah-solusi.edit', $item))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/MasalahSolusi/Form')
                ->where('item.video.source', 'library')
                ->where('item.video.asset_id', $video->id)
                ->where('item.video_label', $video->label)
                // Durasi tidak lagi ikut di payload.
                ->missing('item.video.duration'));
    }
}
