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

    public function test_hapus_folder_beserta_isi_menghapus_aset_yang_tidak_terpakai(): void
    {
        $this->actingAs($this->admin());
        $folder = MediaFolder::create(['name' => 'Berisi']);
        $asset = MediaAsset::create([
            'kind' => 'image', 'label' => 'a.jpg', 'object_key' => 'k/a.jpg',
            'mime_type' => 'image/jpeg', 'size_bytes' => 1,
            'status' => 'ready', 'visibility' => 'visible', 'folder_id' => $folder->id,
        ]);

        $this->delete(route('admin.media.folders.destroy', $folder).'?with_assets=1')->assertRedirect();

        $this->assertNull(MediaFolder::find($folder->id), 'Folder harus terhapus');
        $this->assertNull(MediaAsset::find($asset->id), 'Aset tak terpakai harus terhapus permanen');
    }

    public function test_hapus_folder_beserta_isi_mengarsipkan_aset_yang_masih_dipakai_produk(): void
    {
        $this->actingAs($this->admin());
        $folder = MediaFolder::create(['name' => 'Dipakai']);

        $asset = MediaAsset::create([
            'kind' => 'image', 'label' => 'dipakai.jpg', 'object_key' => 'k/dipakai.jpg',
            'mime_type' => 'image/jpeg', 'size_bytes' => 1,
            'status' => 'ready', 'visibility' => 'visible', 'folder_id' => $folder->id,
        ]);

        // Lampirkan ke produk supaya dianggap masih dipakai.
        $product = \App\Models\Product::create([
            'name' => 'Uji Folder', 'parent_sku' => 'RAUJIFOLDER1',
            'product_category' => 'JENDELA', 'product_model' => 'SLIDING_2_DAUN',
            'status' => 'archived',
        ]);
        \App\Models\ProductMedia::create([
            'product_id' => $product->id,
            'media_asset_id' => $asset->id,
            'position' => 1,
            'is_main_image' => true,
            'show_in_catalog' => true,
            'visibility' => 'visible',
            'status' => 'ready',
        ]);

        $this->delete(route('admin.media.folders.destroy', $folder).'?with_assets=1')->assertRedirect();

        $this->assertNull(MediaFolder::find($folder->id), 'Folder harus terhapus');
        $sisa = MediaAsset::find($asset->id);
        $this->assertNotNull($sisa, 'Aset terpakai TIDAK boleh dihapus permanen');
        $this->assertSame('archived', $sisa->visibility, 'Aset terpakai harus diarsipkan');
    }

    public function test_hapus_folder_tanpa_with_assets_tetap_memindahkan_isi(): void
    {
        $this->actingAs($this->admin());
        $folder = MediaFolder::create(['name' => 'Pindah']);
        $asset = MediaAsset::create([
            'kind' => 'image', 'label' => 'pindah.jpg', 'object_key' => 'k/pindah.jpg',
            'mime_type' => 'image/jpeg', 'size_bytes' => 1,
            'status' => 'ready', 'visibility' => 'visible', 'folder_id' => $folder->id,
        ]);

        // Tanpa parameter: perilaku lama (isi dipindahkan, aset tetap ada).
        $this->delete(route('admin.media.folders.destroy', $folder))->assertRedirect();

        $this->assertNull(MediaFolder::find($folder->id));
        $this->assertNotNull(MediaAsset::find($asset->id), 'Aset harus tetap ada');
        $this->assertNull($asset->fresh()->folder_id, 'Aset dipindahkan ke Semua Media');
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

    public function test_folder_reorder_only_among_siblings(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);

        // Dua folder root dan satu subfolder di bawah root pertama.
        $a = MediaFolder::create(['name' => 'Alpha']);
        $b = MediaFolder::create(['name' => 'Beta']);
        $child = MediaFolder::create(['name' => 'Child', 'parent_id' => $a->id]);

        // Urutkan root: Beta dulu, lalu Alpha.
        $this->put(route('admin.media.folders.reorder'), [
            'parent_id' => null,
            'ids' => [$b->id, $a->id],
        ])->assertRedirect();

        $this->assertSame(1, (int) $b->fresh()->sort_order);
        $this->assertSame(2, (int) $a->fresh()->sort_order);

        // Subfolder tidak boleh ikut di urutan root (bukan sibling).
        $this->put(route('admin.media.folders.reorder'), [
            'parent_id' => null,
            'ids' => [$child->id],
        ])->assertSessionHasErrors('ids');

        // Subfolder juga tidak boleh masuk ke urutan root, dan parent-nya tetap.
        $this->assertSame($a->id, $child->fresh()->parent_id);

        // Reorder antar-subfolder di parent yang sama sah.
        $child2 = MediaFolder::create(['name' => 'Child 2', 'parent_id' => $a->id]);
        $this->put(route('admin.media.folders.reorder'), [
            'parent_id' => $a->id,
            'ids' => [$child2->id, $child->id],
        ])->assertRedirect();

        $this->assertSame(1, (int) $child2->fresh()->sort_order);
        $this->assertSame(2, (int) $child->fresh()->sort_order);
    }

    /** Buat satu aset gambar yang tersimpan di dalam folder. */
    protected function asetDi(MediaFolder $folder, string $label): MediaAsset
    {
        return MediaAsset::create([
            'kind' => 'image',
            'label' => $label,
            'object_key' => 'media-assets/uji/'.$label,
            'mime_type' => 'image/jpeg',
            'size_bytes' => 1,
            'status' => 'ready',
            'visibility' => 'visible',
            'folder_id' => $folder->id,
        ]);
    }

    /** Cari satu simpul folder pada pohon sidebar berdasarkan id. */
    protected function cariSimpul(array $nodes, int $folderId): ?array
    {
        foreach ($nodes as $node) {
            if ((int) $node['id'] === $folderId) {
                return $node;
            }

            $dalam = $this->cariSimpul($node['children'] ?? [], $folderId);
            if ($dalam !== null) {
                return $dalam;
            }
        }

        return null;
    }

    public function test_daftar_media_folder_induk_memuat_aset_subfolder(): void
    {
        $this->actingAs($this->admin());

        $induk = MediaFolder::create(['name' => 'Induk']);
        $anak = MediaFolder::create(['name' => 'Anak', 'parent_id' => $induk->id]);

        // Persis temuan owner: folder induk tidak menyimpan berkas sendiri,
        // seluruh isinya ada di subfolder. Dulu halaman menampilkan keadaan
        // kosong karena penyaringnya menuntut folder_id sama persis.
        $this->asetDi($anak, 'anak-1.jpg');
        $this->asetDi($anak, 'anak-2.jpg');

        $props = $this->get(route('admin.media.library', ['folder_id' => $induk->id]))
            ->assertOk()
            ->viewData('page')['props'];

        $labels = array_column($props['assets'], 'label');
        sort($labels);
        $this->assertSame(['anak-1.jpg', 'anak-2.jpg'], $labels, 'Folder induk harus memuat aset dari subfolder');

        $simpulInduk = $this->cariSimpul($props['folders'], (int) $induk->id);
        $this->assertNotNull($simpulInduk, 'Folder induk harus ada di pohon sidebar');
        $this->assertSame(
            2,
            (int) $simpulInduk['assets_count'],
            'Angka sidebar folder induk harus ikut memuat isi subfolder',
        );
    }

    public function test_aksi_massal_folder_induk_menyasar_aset_subfolder(): void
    {
        $this->actingAs($this->admin());

        $induk = MediaFolder::create(['name' => 'Induk']);
        $anak = MediaFolder::create(['name' => 'Anak', 'parent_id' => $induk->id]);

        $this->asetDi($anak, 'anak-1.jpg');
        $this->asetDi($anak, 'anak-2.jpg');

        $this->post(route('admin.media.bulk-action'), [
            'action' => 'archive',
            'scope_all' => 1,
            'scope_folder_id' => (string) $induk->id,
        ])->assertRedirect();

        $this->assertSame(
            2,
            MediaAsset::where('folder_id', $anak->id)->where('visibility', 'archived')->count(),
            'Pilih semua di folder induk harus menyentuh aset subfolder juga',
        );
    }
}
