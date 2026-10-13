<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MediaPickerEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_picker_returns_ready_assets_as_json(): void
    {
        $user = User::factory()->create();

        MediaAsset::create([
            'kind' => 'image',
            'label' => 'SET (1).png',
            'object_key' => 'media/library/test/set-1.png',
            'mime_type' => 'image/png',
            'status' => 'ready',
            'visibility' => 'visible',
            'created_by_user_id' => $user->id,
        ]);
        MediaAsset::create([
            'kind' => 'image',
            'label' => 'Draft.png',
            'object_key' => 'media/library/test/draft.png',
            'mime_type' => 'image/png',
            'status' => 'pending',
            'visibility' => 'visible',
            'created_by_user_id' => $user->id,
        ]);

        $this->actingAs($user)
            ->getJson('/admin/media/picker?q=SET')
            ->assertOk()
            ->assertJsonStructure(['assets' => [['id', 'label', 'kind', 'thumb_url']]])
            ->assertJsonMissing(['label' => 'Draft.png']);
    }
    /**
     * Kendala nyata 2026-09-20: daftar pemilih dibatasi 48 aset terbaru lebih dulu,
     * sehingga penyaringan jenis di sisi klien membuat aset VIDEO lama tidak pernah
     * muncul saat admin menambah video (853 aset gambar jauh lebih baru). Penyaring
     * jenis karena itu dikerjakan server lewat parameter `kind`.
     */
    public function test_picker_filters_by_kind_on_server(): void
    {
        $user = User::factory()->create();

        foreach (range(1, 3) as $index) {
            MediaAsset::create([
                'kind' => 'image',
                'label' => 'Gambar '.$index,
                'object_key' => 'media/library/test/gambar-'.$index.'.png',
                'mime_type' => 'image/png',
                'status' => 'ready',
                'visibility' => 'visible',
                'created_by_user_id' => $user->id,
            ]);
        }

        MediaAsset::create([
            'kind' => 'video',
            'label' => 'Video lama.mp4',
            'object_key' => 'media/library/test/video-lama.mp4',
            'mime_type' => 'video/mp4',
            'status' => 'ready',
            'visibility' => 'visible',
            'created_by_user_id' => $user->id,
        ]);

        $this->actingAs($user)
            ->getJson('/admin/media/picker?kind=video')
            ->assertOk()
            ->assertJsonCount(1, 'assets')
            ->assertJsonPath('assets.0.label', 'Video lama.mp4');

        $this->actingAs($user)
            ->getJson('/admin/media/picker?kind=image')
            ->assertOk()
            ->assertJsonCount(3, 'assets');

        // Tanpa parameter kind, semua jenis tetap tampil seperti perilaku lama.
        $this->actingAs($user)
            ->getJson('/admin/media/picker')
            ->assertOk()
            ->assertJsonCount(4, 'assets');
    }
}
