<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\MediaAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Penjaga kontrak untuk jaring pengaman media:reconcile.
 *
 * Yang dijaga di sini bukan hanya "yatim terhapus", tetapi terutama bahwa
 * berkas yang MASIH dirujuk tidak pernah dianggap yatim. Foto ulasan
 * pelanggan paling rawan: berkasnya tidak lewat tabel media_assets, hanya
 * disimpan sebagai URL di kolom JSON cms_testimonials.
 */
class ReconcileMediaObjectsTest extends TestCase
{
    use RefreshDatabase;

    private const REFERENCED = 'media-assets/reconcile/card.webp';

    private const ORPHAN = 'media-assets/reconcile/orphan-card.webp';

    private const REVIEW_PHOTO = 'reviews/ORD26080001/foto-ulasan.webp';

    private function seedFiles(): void
    {
        Storage::disk('media')->put(self::REFERENCED, 'dipakai');
        Storage::disk('media')->put(self::ORPHAN, 'yatim');
        Storage::disk('media')->put(self::REVIEW_PHOTO, 'foto ulasan');
    }

    private function makeAsset(): MediaAsset
    {
        return MediaAsset::create([
            'kind' => 'image',
            'label' => 'Aset reconcile',
            'checksum' => hash('sha256', 'reconcile-fixture'),
            'object_key' => self::REFERENCED,
            'derivatives' => ['card' => ['path' => self::REFERENCED]],
            'mime_type' => 'image/webp',
            'status' => 'ready',
            'visibility' => 'visible',
        ]);
    }

    public function test_reports_orphans_without_deleting_anything(): void
    {
        Storage::fake('media');
        $this->seedFiles();
        $this->makeAsset();

        $this->artisan('media:reconcile --orphans')->assertFailed();

        Storage::disk('media')->assertExists(self::ORPHAN);
    }

    public function test_prune_orphans_deletes_only_unreferenced_files(): void
    {
        Storage::fake('media');
        $this->seedFiles();
        $this->makeAsset();

        $this->artisan('media:reconcile --prune-orphans')->assertSuccessful();

        $disk = Storage::disk('media');
        $disk->assertMissing(self::ORPHAN);
        $disk->assertExists(self::REFERENCED);
    }

    public function test_review_photo_referenced_in_json_column_is_never_orphaned(): void
    {
        Storage::fake('media');
        $this->seedFiles();

        $page = CmsPage::firstOrCreate(
            ['slug' => 'testimoni'],
            ['title' => 'Testimoni', 'content' => [], 'published' => true],
        );

        CmsTestimonial::create([
            'cms_page_id' => $page->id,
            'customer_name' => 'Pelanggan Uji',
            'message' => 'Pemasangan rapi.',
            'rating' => 5,
            'media_items' => [
                ['url' => 'https://media.ragilaluminium.com/'.self::REVIEW_PHOTO, 'type' => 'image'],
            ],
            'published' => true,
        ]);

        $this->artisan('media:reconcile --prune-orphans')->assertSuccessful();

        // Foto ulasan tidak boleh ikut terhapus hanya karena tidak ada di media_assets.
        Storage::disk('media')->assertExists(self::REVIEW_PHOTO);
    }

    public function test_healthcheck_files_are_never_treated_as_orphans(): void
    {
        Storage::fake('media');
        Storage::disk('media')->put('healthchecks/probe.txt', 'ok');

        $this->artisan('media:reconcile --orphans')->assertSuccessful();

        Storage::disk('media')->assertExists('healthchecks/probe.txt');
    }
}
