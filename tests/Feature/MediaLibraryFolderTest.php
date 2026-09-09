<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaLibraryFolderTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    public function test_folder_crud_bertahap(): void
    {
        $this->actingAs($this->admin());

        $this->post(route('admin.media.folders.store'), ['name' => 'Produk'])->assertRedirect();
        $root = MediaFolder::where('name', 'Produk')->firstOrFail();

        $this->post(route('admin.media.folders.store'), ['name' => 'Jungkit', 'parent_id' => $root->id])->assertRedirect();
        $child = MediaFolder::where('name', 'Jungkit')->firstOrFail();
        $this->assertSame($root->id, $child->parent_id);

        $this->post(route('admin.media.folders.rename', $child), ['name' => 'Jungkit 50x50'])->assertRedirect();
        $this->assertSame('Jungkit 50x50', $child->fresh()->name);

        // Pindah parent (root -> null)
        $this->post(route('admin.media.folders.move', $child), ['parent_id' => null])->assertRedirect();
        $this->assertNull($child->fresh()->parent_id);

        // Hapus folder kosong
        $this->delete(route('admin.media.folders.destroy', $child))->assertRedirect();
        $this->assertNull(MediaFolder::find($child->id));
    }

    public function test_hapus_folder_berisi_asset_memindahkan_asset_ke_semua_media(): void
    {
        $this->actingAs($this->admin());
        $folder = MediaFolder::create(['name' => 'Berisi']);
        $asset = MediaAsset::create([
            'kind' => 'image', 'label' => 'a.jpg', 'object_key' => 'k/a.jpg',
            'mime_type' => 'image/jpeg', 'size_bytes' => 1,
            'status' => 'ready', 'visibility' => 'visible', 'folder_id' => $folder->id,
        ]);

        $this->delete(route('admin.media.folders.destroy', $folder))->assertRedirect();
        $this->assertNull(MediaFolder::find($folder->id), 'Folder harus terhapus');
        $this->assertNull($asset->fresh()->folder_id, 'Asset harus dipindahkan ke Semua Media (folder_id null)');
    }

    public function test_hapus_folder_dengan_subfolder_memindahkan_seluruh_asset_dan_hapus_pohon(): void
    {
        $this->actingAs($this->admin());
        $parent = MediaFolder::create(['name' => 'Induk']);
        $child = MediaFolder::create(['name' => 'Anak', 'parent_id' => $parent->id]);

        $assetParent = MediaAsset::create([
            'kind' => 'image', 'label' => 'parent.jpg', 'object_key' => 'k/parent.jpg',
            'mime_type' => 'image/jpeg', 'size_bytes' => 1,
            'status' => 'ready', 'visibility' => 'visible', 'folder_id' => $parent->id,
        ]);

        $assetChild = MediaAsset::create([
            'kind' => 'image', 'label' => 'child.jpg', 'object_key' => 'k/child.jpg',
            'mime_type' => 'image/jpeg', 'size_bytes' => 1,
            'status' => 'ready', 'visibility' => 'visible', 'folder_id' => $child->id,
        ]);

        $this->delete(route('admin.media.folders.destroy', $parent))->assertRedirect();
        $this->assertNull(MediaFolder::find($parent->id));
        $this->assertNull(MediaFolder::find($child->id));
        $this->assertNull($assetParent->fresh()->folder_id);
        $this->assertNull($assetChild->fresh()->folder_id);
    }

    public function test_upload_tanpa_folder_masuk_inbox_dan_url_immutable(): void
    {
        Storage::fake('media');
        $this->actingAs($this->admin());

        $folder = MediaFolder::create(['name' => 'Produk/Jungkit']);

        // upload ke folder
        $this->post(route('admin.media.upload'), [
            'media' => UploadedFile::fake()->image('IMG_2847.jpg', 10, 10),
            'folder_id' => $folder->id,
        ])->assertStatus(201);

        $asset = MediaAsset::firstOrFail();
        $this->assertSame('ready', $asset->status);
        $this->assertSame($folder->id, $asset->folder_id);
        $this->assertStringStartsWith('media-assets/', $asset->object_key);
        $urlBefore = $asset->publicUrlForPath($asset->object_key);

        // pindah folder -> URL tetap
        $folder2 = MediaFolder::create(['name' => 'Banner']);
        $this->post(route('admin.media.folders.move-assets'), [
            'folder_id' => $folder2->id,
            'asset_ids' => [$asset->id],
        ])->assertRedirect();
        $asset->refresh();
        $this->assertSame($folder2->id, $asset->folder_id);
        $this->assertSame($urlBefore, $asset->publicUrlForPath($asset->object_key), 'URL tidak berubah saat pindah folder');

        // rename folder -> URL tetap
        $this->post(route('admin.media.folders.rename', $folder2), ['name' => 'Banner Baru'])->assertRedirect();
        $this->assertSame($urlBefore, $asset->fresh()->publicUrlForPath($asset->object_key), 'URL tidak berubah saat rename folder');
    }

    public function test_upload_tanpa_folder_folder_id_null(): void
    {
        Storage::fake('media');
        $this->actingAs($this->admin());

        $this->post(route('admin.media.upload'), [
            'media' => UploadedFile::fake()->image('random-003.jpg', 10, 10),
        ])->assertStatus(201);

        $asset = MediaAsset::firstOrFail();
        $this->assertNull($asset->folder_id, 'masuk Inbox');
        $this->assertSame('random-003.jpg', $asset->label);
    }

    public function test_upload_mime_tidak_diizinkan_422(): void
    {
        Storage::fake('media');
        $this->actingAs($this->admin());

        $this->post(route('admin.media.upload'), [
            'media' => UploadedFile::fake()->create('x.exe', 10, 'application/x-msdownload'),
        ])->assertStatus(422);
        $this->assertSame(0, MediaAsset::count());
    }
}