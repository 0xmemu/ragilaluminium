<?php

namespace Tests\Feature;

use App\Models\CmsProblemSolution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
                'solution' => 'Ganti ke jendela aluminium anti rayap dengan finishing powder coating.',
                'sort_order' => 0,
            ])
            ->assertRedirect(route('admin.masalah-solusi.index'));

        $item = CmsProblemSolution::query()->first();
        $this->assertNotNull($item);

        $this->actingAs($admin)
            ->put(route('admin.masalah-solusi.update', $item), [
                'problem' => 'Kayu cepat lapuk & rayap',
                'solution' => 'Pakai aluminium Inkalum + kaca 5 mm, siap pasang.',
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
}
