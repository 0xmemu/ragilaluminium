<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\CmsBanner;
use App\Models\CmsGalleryItem;
use App\Models\CmsProblemSolution;
use App\Models\MediaAsset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Kontrak owner 2026-09-30: nomor urut di panel admin dimulai dari 1, bukan 0.
 *
 * Tiga halaman yang menampilkan kolom "Urutan" ke admin (Banner Promo, Kategori,
 * Masalah & Solusi) memakai aturan yang sama seperti Bar Promo:
 * - angka 0 ditolak validasi (tidak ada lagi baris tertulis 0);
 * - baris baru tanpa isian ditaruh paling bawah (max + 1), bukan melompat ke atas;
 * - halaman Tambah membawa usulan nomor berikutnya supaya admin melihat angka 1-based.
 */
class AdminSortOrderBaseOneTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function asetGambar(string $label = 'banner.png'): MediaAsset
    {
        return MediaAsset::create([
            'kind' => 'image',
            'label' => $label,
            'object_key' => 'media/library/test/'.$label,
            'mime_type' => 'image/png',
            'status' => 'ready',
            'visibility' => 'visible',
        ]);
    }

    // ---------- Kategori ----------

    public function test_kategori_baru_tanpa_nomor_urut_ditaruh_paling_belakang_dan_nol_ditolak(): void
    {
        $admin = $this->admin();
        // Kategori bawaan dibersihkan dulu supaya nomor urut di test ini mandiri.
        Category::query()->delete();
        Category::create(['name' => 'Uji Satu', 'code' => 'UJI_SATU', 'slug' => 'uji-satu', 'sort_order' => 1, 'is_active' => true]);
        Category::create(['name' => 'Uji Dua', 'code' => 'UJI_DUA', 'slug' => 'uji-dua', 'sort_order' => 2, 'is_active' => true]);

        $this->actingAs($admin)
            ->get(route('admin.categories.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('nextSortOrder', 3));

        $this->actingAs($admin)
            ->post(route('admin.categories.store'), ['name' => 'Uji Tiga'])
            ->assertRedirect(route('admin.categories.index'));

        $baru = Category::query()->where('name', 'Uji Tiga')->firstOrFail();
        $this->assertSame(3, (int) $baru->sort_order);

        $this->actingAs($admin)
            ->post(route('admin.categories.store'), ['name' => 'Uji Empat', 'sort_order' => 0])
            ->assertSessionHasErrors('sort_order');
    }

    // ---------- Banner Promo ----------

    public function test_banner_baru_tanpa_nomor_urut_ditaruh_paling_belakang_dan_nol_ditolak(): void
    {
        $admin = $this->admin();
        $aset = $this->asetGambar();

        $this->actingAs($admin)
            ->post(route('admin.banners.store'), ['title' => 'Slide A', 'media_asset_id' => $aset->id])
            ->assertRedirect(route('admin.banners.index'));

        $pertama = CmsBanner::query()->orderBy('id')->firstOrFail();
        $this->assertSame(1, (int) $pertama->sort_order, 'banner pertama mulai dari 1');

        $this->actingAs($admin)
            ->post(route('admin.banners.store'), ['title' => 'Slide B', 'media_asset_id' => $aset->id])
            ->assertRedirect(route('admin.banners.index'));

        $kedua = CmsBanner::query()->orderByDesc('id')->firstOrFail();
        $this->assertSame(2, (int) $kedua->sort_order, 'banner baru ditaruh paling belakang');

        $this->actingAs($admin)
            ->post(route('admin.banners.store'), ['title' => 'Slide C', 'media_asset_id' => $aset->id, 'sort_order' => 0])
            ->assertSessionHasErrors('sort_order');

        $this->actingAs($admin)
            ->get(route('admin.banners.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('nextSortOrder', 3));
    }

    public function test_banner_edit_tanpa_nomor_urut_mempertahankan_nomor_lama(): void
    {
        $admin = $this->admin();
        $aset = $this->asetGambar();
        $banner = CmsBanner::create([
            'title' => 'Slide Tetap',
            'image_url' => 'https://example.test/a.png',
            'media_asset_id' => $aset->id,
            'sort_order' => 5,
            'published' => true,
        ]);

        $this->actingAs($admin)
            ->put(route('admin.banners.update', $banner), ['title' => 'Slide Tetap Diubah', 'published' => true])
            ->assertRedirect(route('admin.banners.index'));

        $this->assertSame(5, (int) $banner->fresh()->sort_order);
    }

    // ---------- Masalah & Solusi ----------

    public function test_masalah_solusi_baru_tanpa_nomor_urut_ditaruh_paling_belakang_dan_nol_ditolak(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Masalah pertama',
                'solution_body' => 'Solusi pertama.',
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $pertama = CmsProblemSolution::query()->firstOrFail();
        $this->assertSame(1, (int) $pertama->sort_order);

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Masalah kedua',
                'solution_body' => 'Solusi kedua.',
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $kedua = CmsProblemSolution::query()->orderByDesc('id')->firstOrFail();
        $this->assertSame(2, (int) $kedua->sort_order);

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Masalah nol',
                'solution_body' => 'Solusi nol.',
                'sort_order' => 0,
            ])
            ->assertSessionHasErrors('sort_order');
    }

    // ---------- Jalur Urutkan (geser) juga harus 1-based ----------

    public function test_urutkan_masalah_solusi_menulis_nomor_mulai_dari_satu(): void
    {
        $admin = $this->admin();

        $a = CmsProblemSolution::create(['cms_page_id' => \App\Support\ProblemsSolutionsSettings::pageId(), 'problem' => 'A', 'solution' => 'Solusi A', 'sort_order' => 1]);
        $b = CmsProblemSolution::create(['cms_page_id' => \App\Support\ProblemsSolutionsSettings::pageId(), 'problem' => 'B', 'solution' => 'Solusi B', 'sort_order' => 2]);

        // Susun ulang: B dulu, lalu A. Payload memakai nomor 1-based.
        $this->actingAs($admin)
            ->put(route('admin.masalah-solusi.reorder'), [
                'rows' => [
                    ['id' => $b->id, 'sort_order' => 1],
                    ['id' => $a->id, 'sort_order' => 2],
                ],
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $this->assertSame(1, (int) $b->fresh()->sort_order);
        $this->assertSame(2, (int) $a->fresh()->sort_order);

        // Nomor 0 ditolak, supaya geser tidak diam-diam mengembalikan 0-based.
        $this->actingAs($admin)
            ->put(route('admin.masalah-solusi.reorder'), [
                'rows' => [['id' => $a->id, 'sort_order' => 0]],
            ])
            ->assertSessionHasErrors('rows.0.sort_order');
    }

    public function test_edit_masalah_solusi_dengan_nomor_warisan_nol_tetap_bisa_disimpan(): void
    {
        $admin = $this->admin();
        // Baris warisan bernilai 0 (mis. sisa reorder versi lama).
        $item = CmsProblemSolution::create([
            'cms_page_id' => \App\Support\ProblemsSolutionsSettings::pageId(),
            'problem' => 'Warisan',
            'solution' => 'Solusi warisan',
            'sort_order' => 0,
        ]);

        // Form edit tidak mengirim sort_order (field-nya hanya ada saat membuat),
        // jadi server mempertahankan nomor lama apa adanya.
        $this->actingAs($admin)
            ->put(route('admin.masalah-solusi.update', $item), [
                'problem' => 'Warisan diubah',
                'solution_body' => 'Solusi warisan diubah.',
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'))
            ->assertSessionHasNoErrors();

        $this->assertSame('Warisan diubah', $item->fresh()->problem);
    }

    // ---------- Galeri foto ----------

    public function test_galeri_foto_baru_memakai_nomor_berikutnya_dan_nol_ditolak(): void
    {
        $admin = $this->admin();
        CmsGalleryItem::create(['cms_page_id' => \App\Support\InstallationPageSettings::pageId(), 'label' => 'Foto A', 'image_url' => 'https://example.test/a.png', 'sort_order' => 1, 'published' => true]);

        $this->actingAs($admin)
            ->get(route('admin.gallery-items.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('nextSortOrder', 2));

        $this->actingAs($admin)
            ->post(route('admin.gallery-items.store'), ['label' => 'Foto B', 'media_asset_id' => $this->asetGambar('galeri.png')->id])
            ->assertRedirect(route('admin.hasil-pemasangan.index'));

        $baru = CmsGalleryItem::query()->where('label', 'Foto B')->firstOrFail();
        $this->assertSame(2, (int) $baru->sort_order);

        $this->actingAs($admin)
            ->post(route('admin.gallery-items.store'), ['label' => 'Foto C', 'media_asset_id' => $this->asetGambar('galeri2.png')->id, 'sort_order' => 0])
            ->assertSessionHasErrors('sort_order');
    }
}
