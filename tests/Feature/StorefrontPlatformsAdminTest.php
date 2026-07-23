<?php

namespace Tests\Feature;

use App\Models\CmsPage;
use App\Models\User;
use App\Support\StorefrontPlatformSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StorefrontPlatformsAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_and_save_platform_links(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->get(route('admin.storefront-platforms.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/StorefrontPlatforms/Edit')
                ->has('platforms')
                ->where('platforms.0.key', 'shopee'));

        $this->actingAs($admin)
            ->put(route('admin.storefront-platforms.update'), [
                'links' => [
                    'shopee' => 'https://shopee.co.id/ragil.aluminium',
                    'tokopedia' => '',
                    'lazada' => '#',
                    'tiktok_shop' => '',
                    'instagram' => 'https://instagram.com/ragilaluminium',
                    'tiktok' => '',
                    'youtube' => '',
                    'facebook' => '',
                ],
            ])
            ->assertRedirect(route('admin.storefront-platforms.edit'));

        $page = CmsPage::query()->where('slug', StorefrontPlatformSettings::PAGE_SLUG)->first();
        $this->assertNotNull($page);
        $this->assertSame('https://shopee.co.id/ragil.aluminium', $page->content['links']['shopee'] ?? null);
        $this->assertSame('', $page->content['links']['tokopedia'] ?? null);
        $this->assertSame('https://instagram.com/ragilaluminium', $page->content['links']['instagram'] ?? null);

        $storefront = StorefrontPlatformSettings::forStorefront();
        $byKey = collect($storefront)->keyBy('key');
        $this->assertSame('https://shopee.co.id/ragil.aluminium', $byKey['shopee']['href']);
        $this->assertSame('#', $byKey['tokopedia']['href']);
        $this->assertSame('https://instagram.com/ragilaluminium', $byKey['instagram']['href']);
    }

    public function test_rejects_non_http_url(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        $this->actingAs($admin)
            ->from(route('admin.storefront-platforms.edit'))
            ->put(route('admin.storefront-platforms.update'), [
                'links' => [
                    'shopee' => 'javascript:alert(1)',
                    'tokopedia' => '',
                    'lazada' => '',
                    'tiktok_shop' => '',
                    'instagram' => '',
                    'tiktok' => '',
                    'youtube' => '',
                    'facebook' => '',
                ],
            ])
            ->assertRedirect(route('admin.storefront-platforms.edit'))
            ->assertSessionHasErrors('links.shopee');
    }
}
