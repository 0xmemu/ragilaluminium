<?php

namespace Tests\Feature;

use App\Models\CmsProblemSolution;
use App\Models\MediaAsset;
use App\Models\User;
use App\Support\ProblemsSolutionsSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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

    /**
     * Kontrak owner 2026-10-01: teks solusi tidak boleh hilang saat item juga
     * memakai daftar opsi. Dulu keduanya saling meniadakan di halaman publik,
     * sehingga naskah yang tersimpan dan tampil di daftar admin tidak pernah
     * terbaca pelanggan. Penjaga ini memastikan teks itu benar-benar ikut
     * terkirim ke halaman publik bersama daftar opsinya.
     */
    public function test_teks_solusi_ikut_terkirim_ke_halaman_publik_saat_pakai_daftar_opsi(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Barang pecah saat pengiriman',
                'solution_body' => 'Ajukan retur lewat WhatsApp kami.',
                'solution_lead' => 'Chat ke nomor tim kami',
                'use_options' => true,
                'solution_options' => json_encode([
                    ['title' => 'Hubungi Admin', 'description' => '085725116817', 'icon' => 'check-circle'],
                ]),
                'whatsapp_note' => 'WhatsApp',
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $this->get(route('masalah-dan-solusi'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/MasalahSolusi')
                ->has('guide.items', 1)
                ->where('guide.items.0.solution.content.body', 'Ajukan retur lewat WhatsApp kami.')
                ->where('guide.items.0.solution.content.lead', 'Chat ke nomor tim kami')
                ->has('guide.items.0.solution.content.options', 1)
                ->where('guide.items.0.solution.content.options.0.title', 'Hubungi Admin')
                ->where('guide.items.0.solution.content.options.0.description', '085725116817'));
    }

    /**
     * Kontrol Terbitkan halaman sengaja dihapus dari form meta (keputusan owner
     * 2026-10-01): halaman ini selalu tayang. Karena itu menyimpan meta tidak
     * boleh diam-diam menonaktifkan halaman, yang dulu terjadi karena controller
     * mengirim published=false saat form tidak menyertakannya.
     */
    public function test_menyimpan_meta_halaman_tidak_menonaktifkan_halaman(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $pageId = ProblemsSolutionsSettings::pageId();

        $this->assertTrue((bool) DB::table('cms_pages')->where('id', $pageId)->value('published'));

        $this->actingAs($admin)
            ->put(route('admin.masalah-solusi.meta.update'), [
                'title' => 'Masalah & Solusi',
                'heading' => 'Masalah & Solusi',
                'subtitle' => 'Temukan solusi untuk masalah yang mungkin Anda hadapi.',
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $this->assertTrue((bool) DB::table('cms_pages')->where('id', $pageId)->value('published'));

        $this->get(route('masalah-dan-solusi'))->assertOk()->assertInertia(
            fn (Assert $page) => $page->component('Public/MasalahSolusi')
        );
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

    /**
     * Daftar media dikirim satu kunci JSON `media`, berurutan sesuai pilihan
     * admin. Entri yang punya asset_id diambil ulang dari Media Library.
     *
     * @param  list<array{asset_id?: int, alt?: string}>  $entri
     */
    private function kirimMedia(array $entri): string
    {
        return json_encode($entri, JSON_UNESCAPED_UNICODE);
    }

    /**
     * Kontrak owner 2026-09-30: media TIDAK dipisah foto dan video, dan
     * urutannya pilihan admin. Bentuk tersimpannya satu daftar `media`.
     */
    public function test_media_dari_media_library_tersimpan_satu_daftar_berurutan(): void
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
                'media' => $this->kirimMedia([
                    ['asset_id' => $foto1->id, 'alt' => 'Retak bingkai'],
                    ['asset_id' => $foto2->id, 'alt' => 'Goresan kaca'],
                ]),
                'sort_order' => 1,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $item = CmsProblemSolution::query()->first();
        $this->assertNotNull($item);

        $decoded = json_decode($item->solution, true);
        $this->assertIsArray($decoded);
        $this->assertSame('rich', $decoded['type'] ?? null);
        $this->assertCount(2, $decoded['media'] ?? []);
        $this->assertSame('image', $decoded['media'][0]['kind'] ?? null);
        $this->assertSame('Retak bingkai', $decoded['media'][0]['alt'] ?? null);
        $this->assertSame('Goresan kaca', $decoded['media'][1]['alt'] ?? null);

        // Bentuk lama tidak ditulis lagi, jadi hanya ada satu model data.
        $this->assertArrayNotHasKey('photos', $decoded);
        $this->assertArrayNotHasKey('video', $decoded);

        $this->get(route('masalah-dan-solusi'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/MasalahSolusi')
                ->has('guide.items.0.solution.content.media', 2)
                ->where('guide.items.0.solution.content.media.0.kind', 'image'));
    }

    public function test_video_dan_foto_bisa_bercampur_dengan_urutan_pilihan_admin(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $foto = $this->mediaAsset('image', 'campur-foto');
        $video = $this->mediaAsset('video', 'campur-video');

        // Urutannya video dulu, baru foto: itu yang harus tersimpan apa adanya.
        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Video lebih dulu',
                'solution_body' => 'Solusi.',
                'media' => $this->kirimMedia([
                    ['asset_id' => $video->id, 'alt' => ''],
                    ['asset_id' => $foto->id, 'alt' => 'Setelah dipasang'],
                ]),
                'sort_order' => 1,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $decoded = json_decode(CmsProblemSolution::query()->first()->solution, true);

        $this->assertCount(2, $decoded['media'] ?? []);
        $this->assertSame('video', $decoded['media'][0]['kind'] ?? null);
        $this->assertSame('library', $decoded['media'][0]['source'] ?? null);
        $this->assertNotNull($decoded['media'][0]['src'] ?? null);
        $this->assertSame('image', $decoded['media'][1]['kind'] ?? null);
        $this->assertSame('Setelah dipasang', $decoded['media'][1]['alt'] ?? null);
    }

    /** Kemampuan baru kontrak 2026-09-30: dua video sekaligus diizinkan. */
    public function test_dua_video_sekaligus_diizinkan(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $videoA = $this->mediaAsset('video', 'video-a');
        $videoB = $this->mediaAsset('video', 'video-b');

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Dua video',
                'solution_body' => 'Solusi.',
                'media' => $this->kirimMedia([
                    ['asset_id' => $videoA->id, 'alt' => ''],
                    ['asset_id' => $videoB->id, 'alt' => ''],
                ]),
                'sort_order' => 1,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $decoded = json_decode(CmsProblemSolution::query()->first()->solution, true);

        $this->assertCount(2, $decoded['media'] ?? []);
        $this->assertSame('video', $decoded['media'][0]['kind'] ?? null);
        $this->assertSame('video', $decoded['media'][1]['kind'] ?? null);
    }

    /** Batas dua media tetap berlaku, apa pun jenisnya. */
    public function test_media_lebih_dari_dua_ditolak(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $a = $this->mediaAsset('image', 'a');
        $b = $this->mediaAsset('image', 'b');
        $c = $this->mediaAsset('image', 'c');

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Tiga media',
                'solution_body' => 'Solusi.',
                'media' => $this->kirimMedia([
                    ['asset_id' => $a->id, 'alt' => ''],
                    ['asset_id' => $b->id, 'alt' => ''],
                    ['asset_id' => $c->id, 'alt' => ''],
                ]),
            ])
            ->assertSessionHasErrors('media');

        $this->assertDatabaseCount('cms_problems_solutions', 0);
    }

    /**
     * Bentuk permintaan lama tetap diterima supaya tab admin yang sudah terbuka
     * sebelum deploy tidak kehilangan medianya.
     */
    public function test_bentuk_lama_media_asset_ids_dan_video_tetap_diterima(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $foto = $this->mediaAsset('image', 'lama-foto');
        $video = $this->mediaAsset('video', 'lama-video');

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Bentuk lama',
                'solution_body' => 'Solusi.',
                'media_asset_ids' => [$foto->id],
                'photo_alts' => ['Keterangan lama'],
                'media_video_asset_id' => $video->id,
                'sort_order' => 1,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $decoded = json_decode(CmsProblemSolution::query()->first()->solution, true);

        // Foto dulu lalu video, itu urutan bentuk lama.
        $this->assertCount(2, $decoded['media'] ?? []);
        $this->assertSame('image', $decoded['media'][0]['kind'] ?? null);
        $this->assertSame('Keterangan lama', $decoded['media'][0]['alt'] ?? null);
        $this->assertSame('video', $decoded['media'][1]['kind'] ?? null);
        $this->assertSame('library', $decoded['media'][1]['source'] ?? null);
    }

    /**
     * Koreksi owner 2026-09-29: video hanya dari Media Library. Tautan video
     * luar, isian durasi, dan poster manual dihapus dari form, jadi ketiganya
     * tidak berpengaruh walau tetap dikirim ke server.
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
                'video_url' => 'https://youtube.com/watch?v=abc',
                'video_duration' => '02:37',
                'video_poster_asset_id' => $poster->id,
                'remove_video_poster' => false,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $decoded = json_decode(CmsProblemSolution::query()->first()->solution, true);
        $entri = $decoded['media'][0] ?? [];

        $this->assertSame('video', $entri['kind'] ?? null);
        $this->assertSame('library', $entri['source'] ?? null);
        $this->assertStringNotContainsString('youtube.com', (string) ($entri['src'] ?? ''));
        $this->assertArrayNotHasKey('duration', $entri);
        $this->assertStringNotContainsString('poster-manual', (string) ($entri['poster'] ?? ''));
    }

    /** Tautan video luar tanpa berkas Library tidak menghasilkan media apa pun. */
    public function test_tautan_video_luar_tanpa_berkas_tidak_menghasilkan_media(): void
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

        // Tanpa media sama sekali, solusinya disimpan sebagai teks biasa
        // (bukan rich), jadi memang tidak ada daftar media untuk disimpan.
        $this->assertSame('Solusi.', CmsProblemSolution::query()->first()->solution);
    }

    /**
     * Owner 2026-09-30: item baru selalu ditaruh paling belakang, dan halaman
     * tambah tidak lagi menanyakan nomor urut (pengurutan ulang ada di fitur
     * Urutkan pada halaman daftar).
     */
    public function test_item_baru_otomatis_ditaruh_paling_belakang(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        foreach ([['A', 1], ['B', 2], ['C', 7]] as [$problem, $urutan]) {
            CmsProblemSolution::create([
                'cms_page_id' => \App\Support\ProblemsSolutionsSettings::pageId(),
                'problem' => $problem,
                'solution' => 'Solusi '.$problem,
                'sort_order' => $urutan,
            ]);
        }

        // Form tidak mengirim nomor urut sama sekali.
        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Item baru',
                'solution_body' => 'Solusi item baru.',
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $baru = CmsProblemSolution::query()->where('problem', 'Item baru')->first();
        $this->assertNotNull($baru);
        $this->assertSame(
            8,
            (int) $baru->sort_order,
            'nomor tertinggi yang ada adalah 7, jadi item baru harus dapat 8',
        );
    }

    public function test_halaman_tambah_tidak_lagi_meminta_nomor_urut(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.masalah-solusi.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/MasalahSolusi/Form')
                // Prop nomor urut usulan sudah tidak dikirim; halaman ini tidak
                // lagi ikut memikirkan penomoran.
                ->missing('nextSortOrder')
            );
    }

    /**
     * Baris LAMA (tersimpan sebagai photos + video) tetap tampil di halaman
     * publik sebagai satu daftar media, tanpa perlu migrasi data.
     */
    public function test_baris_lama_dengan_photos_dan_video_tetap_tampil(): void
    {
        $item = CmsProblemSolution::create([
            'cms_page_id' => \App\Support\ProblemsSolutionsSettings::pageId(),
            'problem' => 'Baris lama',
            'solution' => json_encode([
                'type' => 'rich',
                'photos' => [
                    ['src' => 'https://contoh.test/foto-lama.webp', 'alt' => 'Foto lama', 'width' => 1024, 'height' => 1024],
                ],
                'video' => [
                    'src' => 'https://contoh.test/video-lama.mp4',
                    'poster' => 'https://contoh.test/poster-lama.webp',
                    'source' => 'library',
                    'asset_id' => 99,
                ],
                'body' => 'Solusi lama.',
            ], JSON_UNESCAPED_UNICODE),
            'sort_order' => 1,
        ]);

        $this->get(route('masalah-dan-solusi'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/MasalahSolusi')
                ->has('guide.items.0.solution.content.media', 2)
                ->where('guide.items.0.solution.content.media.0.kind', 'image')
                ->where('guide.items.0.solution.content.media.0.alt', 'Foto lama')
                ->where('guide.items.0.solution.content.media.1.kind', 'video')
                ->where('guide.items.0.solution.content.media.1.src', 'https://contoh.test/video-lama.mp4'));

        // Halaman edit juga memakai daftar yang sama.
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.masalah-solusi.edit', $item))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/MasalahSolusi/Form')
                ->has('item.media', 2)
                ->where('item.media.0.kind', 'image')
                ->where('item.media.1.kind', 'video'));
    }
}
