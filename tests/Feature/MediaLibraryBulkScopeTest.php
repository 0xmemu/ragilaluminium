<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Aksi massal ber-scope "Pilih semua" (permintaan owner 2026-10-14).
 *
 * Keluhan owner: "Pilih semua" hanya memilih aset di halaman yang tampil
 * (30 per halaman), bukan seluruh isi folder. Penjaga ini memastikan sasaran
 * `scope_all` menyentuh SELURUH aset pada folder + filter aktif, menghormati
 * filter, dan tetap tunduk pada aturan pengaman yang sudah ada:
 *
 *  - aset yang tersimpan di dalam folder dianggap masih dipakai, sehingga
 *    "hapus" mengARSIPKANNYA, bukan menghapus permanen;
 *  - aset di Inbox yang tidak terlampir ke produk/banner/galeri barulah
 *    dihapus permanen.
 */
class MediaLibraryBulkScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    /** Buat sekian aset di dalam satu folder. */
    protected function buatAset(MediaFolder $folder, int $jumlah, string $kind = 'image', string $awalan = 'aset'): void
    {
        for ($i = 0; $i < $jumlah; $i++) {
            MediaAsset::create([
                'kind' => $kind,
                'label' => "{$awalan}-{$i}.jpg",
                'object_key' => "media-assets/uji/{$awalan}-{$i}.jpg",
                'mime_type' => $kind === 'video' ? 'video/mp4' : 'image/jpeg',
                'size_bytes' => 1,
                'status' => 'ready',
                'visibility' => 'visible',
                'folder_id' => $folder->id,
            ]);
        }
    }

    public function test_scope_all_mengarsipkan_seluruh_aset_folder_lebih_dari_satu_halaman(): void
    {
        $this->actingAs($this->admin());
        $folder = MediaFolder::create(['name' => 'Berisi Banyak']);

        // Halaman daftar memuat 30 aset; 35 membuktikan sasaran melampaui halaman.
        $this->buatAset($folder, 35);
        $this->assertSame(35, MediaAsset::where('folder_id', $folder->id)->count());

        $this->post(route('admin.media.bulk-action'), [
            'action' => 'archive',
            'scope_all' => 1,
            'scope_folder_id' => (string) $folder->id,
        ])->assertRedirect();

        $this->assertSame(
            35,
            MediaAsset::where('folder_id', $folder->id)->where('visibility', 'archived')->count(),
            'Seluruh 35 aset harus terarsip, bukan hanya 30 di halaman pertama',
        );
    }

    public function test_scope_all_hapus_mengarsipkan_aset_yang_masih_melekat_pada_folder(): void
    {
        $this->actingAs($this->admin());
        $folder = MediaFolder::create(['name' => 'Berisi']);

        // Folder adalah tanda berkas disimpan untuk dipakai, jadi aset di
        // dalamnya tidak dihapus permanen walau belum terlampir ke produk.
        $this->buatAset($folder, 3);

        $this->post(route('admin.media.bulk-action'), [
            'action' => 'delete',
            'scope_all' => 1,
            'scope_folder_id' => (string) $folder->id,
        ])->assertRedirect();

        $this->assertSame(3, MediaAsset::where('folder_id', $folder->id)->count(), 'Aset dalam folder tidak dihapus permanen');
        $this->assertSame(3, MediaAsset::where('folder_id', $folder->id)->where('visibility', 'archived')->count(), 'Semuanya diarsipkan');
    }

    public function test_scope_all_hapus_menghapus_permanen_aset_inbox_yang_tak_terpakai(): void
    {
        $this->actingAs($this->admin());

        // Inbox: tanpa folder dan tanpa lampiran, jadi boleh dihapus permanen.
        for ($i = 0; $i < 3; $i++) {
            MediaAsset::create([
                'kind' => 'image', 'label' => "inbox-{$i}.jpg",
                'object_key' => "media-assets/uji/inbox-{$i}.jpg",
                'mime_type' => 'image/jpeg', 'size_bytes' => 1,
                'status' => 'ready', 'visibility' => 'visible', 'folder_id' => null,
            ]);
        }

        $this->post(route('admin.media.bulk-action'), [
            'action' => 'delete',
            'scope_all' => 1,
            'scope_folder_id' => '0', // Inbox
        ])->assertRedirect();

        $this->assertSame(0, MediaAsset::whereNull('folder_id')->count(), 'Aset Inbox tak terpakai dihapus permanen');
    }

    public function test_scope_all_menghormati_filter_jenis(): void
    {
        $this->actingAs($this->admin());
        $folder = MediaFolder::create(['name' => 'Campur Jenis']);
        $this->buatAset($folder, 2, 'image', 'gambar');
        $this->buatAset($folder, 2, 'video', 'klip');

        $this->post(route('admin.media.bulk-action'), [
            'action' => 'archive',
            'scope_all' => 1,
            'scope_folder_id' => (string) $folder->id,
            'kind' => 'video',
        ])->assertRedirect();

        $this->assertSame(2, MediaAsset::where('folder_id', $folder->id)->where('kind', 'video')->where('visibility', 'archived')->count());
        $this->assertSame(0, MediaAsset::where('folder_id', $folder->id)->where('kind', 'image')->where('visibility', 'archived')->count(), 'Filter jenis harus dihormati');
    }

    public function test_move_assets_scope_all_memindahkan_seluruh_aset_folder(): void
    {
        $this->actingAs($this->admin());
        $asal = MediaFolder::create(['name' => 'Asal']);
        $tujuan = MediaFolder::create(['name' => 'Tujuan']);
        $this->buatAset($asal, 35);

        // `folder_id` = TUJUAN, `scope_folder_id` = asal filter. Bila server
        // tertukar memakainya, uji ini gagal.
        $this->post(route('admin.media.folders.move-assets'), [
            'folder_id' => $tujuan->id,
            'scope_all' => 1,
            'scope_folder_id' => (string) $asal->id,
        ])->assertRedirect();

        $this->assertSame(35, MediaAsset::where('folder_id', $tujuan->id)->count());
        $this->assertSame(0, MediaAsset::where('folder_id', $asal->id)->count());
    }

    public function test_tanpa_sasaran_ditolak_dan_tidak_mengubah_apa_pun(): void
    {
        $this->actingAs($this->admin());
        $folder = MediaFolder::create(['name' => 'Tak Tersentuh']);
        $this->buatAset($folder, 3);

        // Tanpa asset_ids dan tanpa scope_all: aksi harus ditolak, bukan
        // diam-diam mengenai seluruh daftar.
        $this->post(route('admin.media.bulk-action'), ['action' => 'archive'])
            ->assertSessionHas('error');

        $this->assertSame(0, MediaAsset::where('visibility', 'archived')->count());
    }
}
