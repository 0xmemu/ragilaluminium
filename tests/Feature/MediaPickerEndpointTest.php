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
}
