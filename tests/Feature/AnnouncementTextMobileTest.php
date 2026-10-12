<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\User;
use App\Support\ActiveAnnouncements;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Dua teks bar promo (owner 2026-10-13): teks desktop sampai 64 huruf (batas
 * kolom) dan teks ponsel sampai 40 huruf (agar utuh di layar sempit). Keduanya
 * dibatasi paksa di form lewat maxLength dan di server lewat validasi panjang.
 *
 * Kolom ponsel opsional. Kosong berarti storefront memakai teks desktop untuk
 * kedua ukuran layar, jadi bar promo yang sudah ada tidak berubah tampilannya
 * dan tidak ada yang wajib diisi ulang.
 */
class AnnouncementTextMobileTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    public function test_teks_ponsel_tersimpan_dan_ikut_ke_form_edit(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.announcements.store'), [
                'text' => 'Diskon sampai 30% untuk semua model',
                'text_mobile' => 'Diskon s/d 30%',
                'published' => true,
            ])
            ->assertRedirect(route('admin.announcements.index'))
            ->assertSessionHasNoErrors();

        $row = Announcement::firstOrFail();
        $this->assertSame('Diskon s/d 30%', $row->text_mobile);

        $this->actingAs($this->admin())
            ->get(route('admin.announcements.edit', $row))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Announcements/Form')
                ->where('announcement.text_mobile', 'Diskon s/d 30%'));
    }

    public function test_teks_ponsel_lebih_dari_40_huruf_ditolak(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.announcements.store'), [
                'text' => 'Teks desktop',
                'text_mobile' => str_repeat('a', 41),
                'published' => true,
            ])
            ->assertSessionHasErrors('text_mobile');

        $this->assertDatabaseCount('announcements', 0);
    }

    public function test_teks_ponsel_tepat_40_huruf_diterima(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.announcements.store'), [
                'text' => 'Teks desktop',
                'text_mobile' => str_repeat('a', 40),
                'published' => true,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(40, mb_strlen(Announcement::firstOrFail()->text_mobile));
    }

    public function test_teks_ponsel_kosong_disimpan_null(): void
    {
        // Spasi saja sama dengan kosong: yang disimpan null supaya storefront
        // tahu harus jatuh ke teks desktop, bukan menampilkan bar kosong.
        $this->actingAs($this->admin())
            ->post(route('admin.announcements.store'), [
                'text' => 'Teks desktop saja',
                'text_mobile' => '   ',
                'published' => true,
            ])
            ->assertSessionHasNoErrors();

        $this->assertNull(Announcement::firstOrFail()->text_mobile);
    }

    public function test_batas_teks_desktop_tetap_64(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.announcements.store'), [
                'text' => str_repeat('b', 65),
                'published' => true,
            ])
            ->assertSessionHasErrors('text');

        $this->actingAs($this->admin())
            ->post(route('admin.announcements.store'), [
                'text' => str_repeat('b', 64),
                'published' => true,
            ])
            ->assertSessionHasNoErrors();
    }

    public function test_storefront_membawa_teks_ponsel(): void
    {
        Announcement::create([
            'text' => 'Diskon sampai 30% untuk semua model',
            'text_mobile' => 'Diskon s/d 30%',
            'published' => true,
            'sort_order' => 1,
        ]);

        $item = collect(ActiveAnnouncements::items())->first();

        $this->assertSame('Diskon sampai 30% untuk semua model', $item['text']);
        $this->assertSame('Diskon s/d 30%', $item['text_mobile']);
    }

    public function test_storefront_memangkas_teks_ponsel_di_40_huruf(): void
    {
        // Data lama atau perintah langsung bisa melewati validasi form; pengurai
        // storefront tetap memangkasnya di 40 huruf (ditambah tanda elipsis).
        Announcement::create([
            'text' => 'Teks desktop',
            'text_mobile' => str_repeat('c', 60),
            'published' => true,
            'sort_order' => 1,
        ]);

        $item = collect(ActiveAnnouncements::items())->first();

        $this->assertSame(43, mb_strlen($item['text_mobile']));
        $this->assertStringEndsWith('...', $item['text_mobile']);
    }

    public function test_storefront_mengosongkan_teks_ponsel_bila_kolomnya_kosong(): void
    {
        Announcement::create([
            'text' => 'Teks desktop saja',
            'text_mobile' => null,
            'published' => true,
            'sort_order' => 1,
        ]);

        $this->assertNull(collect(ActiveAnnouncements::items())->first()['text_mobile']);
    }
}
