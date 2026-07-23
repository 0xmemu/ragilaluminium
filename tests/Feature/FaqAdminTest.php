<?php

namespace Tests\Feature;

use App\Models\CmsFaqItem;
use App\Models\User;
use App\Support\FaqSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FaqAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_faq_and_public_page_renders_groups(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.faq.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Faq/Index')
                ->has('categoryOptions')
                ->has('statusCounts')
                ->where('filters.status', 'active'));

        $this->actingAs($admin)
            ->post(route('admin.faq.store'), [
                'question' => 'Apakah bisa COD?',
                'answer' => 'Ya, COD tersedia di checkout.',
                'category' => 'Metode Pembayaran',
            ])
            ->assertRedirect(route('admin.faq.index', ['status' => 'active']));

        $this->actingAs($admin)
            ->post(route('admin.faq.store'), [
                'question' => 'Bisa custom ukuran?',
                'answer' => 'Ya, sertakan tinggi x panjang.',
                'category' => 'Spesifikasi Material & Ukuran',
            ])
            ->assertRedirect(route('admin.faq.index', ['status' => 'active']));

        $this->assertDatabaseHas('cms_faq_items', [
            'question' => 'Apakah bisa COD?',
            'category' => 'Metode Pembayaran',
            'status' => 'active',
        ]);

        $item = CmsFaqItem::query()->where('question', 'Apakah bisa COD?')->first();
        $this->assertNotNull($item);

        $this->actingAs($admin)
            ->put(route('admin.faq.update', $item), [
                'question' => 'Apakah tersedia COD?',
                'answer' => 'Ya, COD dan transfer bank.',
                'category' => 'Metode Pembayaran',
            ])
            ->assertRedirect(route('admin.faq.index', ['status' => 'active']));

        $this->get(route('faq'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Faq')
                ->has('guide.groups', 2)
                ->where('guide.groups.0.category', 'Spesifikasi Material & Ukuran')
                ->where('guide.groups.1.items.0.question', 'Apakah tersedia COD?'));

        $this->actingAs($admin)
            ->put(route('admin.faq.reorder'), [
                'rows' => [
                    ['id' => $item->id, 'sort_order' => 5],
                ],
                'status' => 'active',
            ])
            ->assertRedirect(route('admin.faq.index', ['status' => 'active']));

        $this->assertSame(5, (int) $item->fresh()->sort_order);

        $this->actingAs($admin)
            ->post(route('admin.faq.archive', $item))
            ->assertRedirect(route('admin.faq.index', ['status' => 'active']));

        $this->assertSame('archived', $item->fresh()->status);

        $this->get(route('faq'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Faq')
                ->has('guide.groups', 1)
                ->where('guide.groups.0.category', 'Spesifikasi Material & Ukuran'));

        $this->actingAs($admin)
            ->get(route('admin.faq.index', ['status' => 'archived']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.status', 'archived')
                ->has('rows', 1));

        $this->actingAs($admin)
            ->post(route('admin.faq.unarchive', $item))
            ->assertRedirect(route('admin.faq.index', ['status' => 'active']));

        $this->assertSame('active', $item->fresh()->status);

        $this->actingAs($admin)
            ->post(route('admin.faq.archive', $item))
            ->assertRedirect();

        $this->actingAs($admin)
            ->delete(route('admin.faq.destroy', $item))
            ->assertRedirect(route('admin.faq.index', ['status' => 'archived']));

        $this->assertDatabaseMissing('cms_faq_items', ['id' => $item->id]);
        $this->assertSame(FaqSettings::PAGE_SLUG, 'faq');
    }
}
