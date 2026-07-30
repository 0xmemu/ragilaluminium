<?php

namespace Tests\Feature;

use App\Models\CmsProblemSolution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
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
                'sort_order' => 0,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $item = CmsProblemSolution::query()->first();
        $this->assertNotNull($item);
        $this->assertSame('Ganti ke jendela aluminium anti rayap dengan finishing powder coating.', $item->solution);

        $this->actingAs($admin)
            ->put(route('admin.masalah-solusi.update', $item), [
                'problem' => 'Kayu cepat lapuk & rayap',
                'solution_body' => 'Pakai aluminium Inkalum + kaca 5 mm, siap pasang.',
                'sort_order' => 0,
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

    public function test_admin_can_upload_documentation_photos_for_problem_solution(): void
    {
        Storage::fake('media');

        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->post(route('admin.masalah-solusi.store'), [
                'problem' => 'Barang rusak saat pengiriman',
                'solution_body' => 'Hubungi kami untuk klaim garansi pengiriman.',
                'examples_hint' => 'Retak bingkai, goresan kaca',
                'photo_files' => [
                    UploadedFile::fake()->image('rusak-1.jpg'),
                    UploadedFile::fake()->image('rusak-2.jpg'),
                ],
                'photo_alts' => ['Retak bingkai', 'Goresan kaca'],
                'sort_order' => 0,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $item = CmsProblemSolution::query()->first();
        $this->assertNotNull($item);

        $decoded = json_decode($item->solution, true);
        $this->assertIsArray($decoded);
        $this->assertSame('rich', $decoded['type'] ?? null);
        $this->assertCount(2, $decoded['photos'] ?? []);
        $this->assertSame('Retak bingkai', $decoded['photos'][0]['alt'] ?? null);

        Storage::disk('media')->assertExists('masalah-solusi/'.basename(parse_url($decoded['photos'][0]['src'], PHP_URL_PATH)));

        $this->get(route('masalah-dan-solusi'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/MasalahSolusi')
                ->where('guide.items.0.solution.type', 'rich'));
    }
}
