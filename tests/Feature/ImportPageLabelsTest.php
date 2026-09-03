<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ImportPageLabelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_import_create_page_lists_three_modes_with_clear_scope_labels(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/admin/imports/create')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ImportCreate')
                ->has('types', 3)
                ->where('types.0.label', 'Import Katalog (produk & varian baru, lengkap)')
                ->where('types.1.label', 'Update Harga & Stok (hanya harga/stok; media tidak disentuh)')
                ->where('types.2.label', 'Update Media (hanya foto/video; harga & stok tidak disentuh)')
            );
    }
}