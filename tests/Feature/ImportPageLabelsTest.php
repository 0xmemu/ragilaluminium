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
                // Label mengikuti nama template v2 supaya admin melihat
                // sebutan yang sama di tombol unduh dan di pilihan tipe.
                ->where('types.0.label', 'Import Produk (produk dan varian baru)')
                ->where('types.1.label', 'Update Produk (harga, stok, deskripsi, spesifikasi)')
                ->where('types.2.label', 'Update Media (foto produk dan varian)')
                // Pilihan "Sumber stok" sudah dihapus; stok selalu dari berkas.
                ->missing('stockMode')
            );
    }
}