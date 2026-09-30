<?php

namespace Tests\Feature;

use App\Models\SubModel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Kontrak admin Sub Model (2026-09-16):
 * - form tambah SELALU kosong (tanpa prefill model, jangan ulangi MODELS[0]);
 * - pemilihan model via pemilih bercari, validasi product_model tetap kaku;
 * - kolom image_url dihapus (tidak dipakai storefront);
 * - daftar tanpa parameter tidak memilih model otomatis.
 */
class SubModelAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_create_form_starts_empty_without_model_prefill(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->get(route('admin.sub-models.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/SubModelForm')
                ->missing('productModel')
                ->where('subModel', null));
    }

    public function test_create_with_valid_model_only_sets_back_link_not_prefill(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->get(route('admin.sub-models.create', ['product_model' => 'JUNGKIT_1_DAUN']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/SubModelForm')
                ->missing('productModel')
                ->where('indexUrl', route('admin.sub-models.index', ['product_model' => 'JUNGKIT_1_DAUN'])));
    }

    public function test_store_requires_explicit_product_model(): void
    {
        SubModel::query()->delete();
        $admin = $this->admin();

        // Tanpa product_model: ditolak (dulu jatuh ke JUNGKIT_1_DAUN diam-diam).
        $this->actingAs($admin)
            ->post(route('admin.sub-models.store'), [
                'code' => 'JALUSI',
                'name' => 'Jalusi',
            ])
            ->assertSessionHasErrors('product_model');

        $this->assertSame(0, SubModel::query()->count());

        // Dengan product_model valid: tersimpan.
        $this->actingAs($admin)
            ->post(route('admin.sub-models.store'), [
                'product_model' => 'JUNGKIT_1_DAUN',
                'code' => 'JALUSI',
                'name' => 'Jalusi',
            ])
            ->assertRedirect(route('admin.sub-models.index', ['product_model' => 'JUNGKIT_1_DAUN']));

        $this->assertDatabaseHas('sub_models', [
            'product_model' => 'JUNGKIT_1_DAUN',
            'code' => 'JALUSI',
            'is_active' => true,
        ]);
    }

    public function test_index_without_model_shows_all_rows_grouped_and_no_active_model(): void
    {
        SubModel::query()->delete();
        $admin = $this->admin();

        SubModel::create(['product_model' => 'JUNGKIT_1_DAUN', 'code' => 'JALUSI', 'name' => 'Jalusi Jungkit', 'sort_order' => 10]);
        SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'JALUSI', 'name' => 'Jalusi Swing', 'sort_order' => 10]);
        SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'SERIES_D', 'name' => 'Series D', 'sort_order' => 20]);

        $this->actingAs($admin)
            ->get(route('admin.sub-models.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/SubModels')
                ->where('activeModel', null)
                ->has('rows', 3)
                // Urutan server: per model, lalu sort_order.
                ->where('rows.0.product_model', 'JUNGKIT_1_DAUN')
                ->where('rows.1.product_model', 'SWING_2_DAUN')
                ->where('rows.2.product_model', 'SWING_2_DAUN'));

        // Dengan parameter: hanya model itu, activeModel terisi.
        $this->actingAs($admin)
            ->get(route('admin.sub-models.index', ['product_model' => 'SWING_2_DAUN']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activeModel', 'SWING_2_DAUN')
                ->has('rows', 2));

        // Parameter asing: tanpa model terpilih, bukan fallback MODELS[0].
        $this->actingAs($admin)
            ->get(route('admin.sub-models.index', ['product_model' => 'MODEL_PALAKPAKAI']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activeModel', null)
                ->has('rows', 3));
    }

    /**
     * Kontrak owner 2026-09-29: urutan daftar Sub Model menirukan logika Model
     * Produk, yaitu sub model nonaktif "jatuh" ke bawah dalam modelnya walau
     * nomor urutnya lebih kecil. Nomor urut tersimpan TIDAK diubah oleh
     * penampilan ini.
     */
    public function test_sub_model_nonaktif_jatuh_ke_bawah_dalam_modelnya(): void
    {
        SubModel::query()->delete();
        $admin = $this->admin();

        // Nomor sengaja dibalik: nonaktif justru punya nomor terkecil, supaya
        // terbukti status, bukan sort_order, yang memindahkannya ke bawah.
        SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'NONAKTIF_KECIL', 'name' => 'Nonaktif Kecil', 'sort_order' => 1, 'is_active' => false]);
        SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'AKTIF_BESAR', 'name' => 'Aktif Besar', 'sort_order' => 9, 'is_active' => true]);
        SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'AKTIF_KECIL', 'name' => 'Aktif Kecil', 'sort_order' => 5, 'is_active' => true]);

        $this->actingAs($admin)
            ->get(route('admin.sub-models.index', ['product_model' => 'SWING_2_DAUN']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 3)
                ->where('rows.0.code', 'AKTIF_KECIL')
                ->where('rows.1.code', 'AKTIF_BESAR')
                ->where('rows.2.code', 'NONAKTIF_KECIL')
                ->where('rows.2.is_active', false)
                ->where('rows.2.sort_order', 1));

        // Nomor urut tersimpan tetap seperti semula.
        $this->assertSame(1, SubModel::where('code', 'NONAKTIF_KECIL')->value('sort_order'));
    }

    /**
     * Cakupan grup pada mode semua model harus tetap utuh walau ada penonaktifan:
     * urutan server memakai product_model sebagai kunci pertama supaya baris satu
     * model tidak terpecah (penanda grup di frontend mengandalkan itu).
     */
    public function test_mode_semua_model_tetap_berkelompok_walau_ada_yang_nonaktif(): void
    {
        SubModel::query()->delete();
        $admin = $this->admin();

        SubModel::create(['product_model' => 'JUNGKIT_1_DAUN', 'code' => 'POLOS', 'name' => 'Polos', 'sort_order' => 5, 'is_active' => true]);
        SubModel::create(['product_model' => 'JUNGKIT_1_DAUN', 'code' => 'ORNAMEN', 'name' => 'Ornamen', 'sort_order' => 2, 'is_active' => false]);
        SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'POLOS', 'name' => 'Polos', 'sort_order' => 1, 'is_active' => false]);
        SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'ORNAMEN', 'name' => 'Ornamen', 'sort_order' => 4, 'is_active' => true]);

        $this->actingAs($admin)
            ->get(route('admin.sub-models.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows', 4)
                // Model tetap berurutan, dan di dalam tiap model yang aktif dulu.
                ->where('rows.0.product_model', 'JUNGKIT_1_DAUN')
                ->where('rows.0.code', 'POLOS')
                ->where('rows.1.product_model', 'JUNGKIT_1_DAUN')
                ->where('rows.1.code', 'ORNAMEN')
                ->where('rows.2.product_model', 'SWING_2_DAUN')
                ->where('rows.2.code', 'ORNAMEN')
                ->where('rows.3.product_model', 'SWING_2_DAUN')
                ->where('rows.3.code', 'POLOS'));
    }

    /**
     * Simpan urutan menulis nomor untuk SEMUA baris yang dikirim, termasuk baris
     * nonaktif, karena payload memuat seluruh baris pada model terpilih (tab
     * Semua status). Nomor urut tidak menghalangi penampilan aktif-dulu.
     */
    public function test_simpan_urutan_menulis_nomor_untuk_semua_baris_model(): void
    {
        SubModel::query()->delete();
        $admin = $this->admin();

        $aktif = SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'AKTIF', 'name' => 'Aktif', 'sort_order' => 0, 'is_active' => true]);
        $nonaktif = SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'NONAKTIF', 'name' => 'Nonaktif', 'sort_order' => 1, 'is_active' => false]);

        $this->actingAs($admin)
            ->post(route('admin.sub-models.reorder'), [
                'rows' => [
                    ['id' => $nonaktif->id, 'sort_order' => 1],
                    ['id' => $aktif->id, 'sort_order' => 2],
                ],
            ])
            ->assertRedirect();

        // Nomor urut 1-based (kontrak nomor urut admin).
        $this->assertSame(1, $nonaktif->fresh()->sort_order);
        $this->assertSame(2, $aktif->fresh()->sort_order);

        // Penampilan tetap menaruh yang aktif lebih dulu.
        $this->actingAs($admin)
            ->get(route('admin.sub-models.index', ['product_model' => 'SWING_2_DAUN']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('rows.0.code', 'AKTIF')
                ->where('rows.1.code', 'NONAKTIF'));
    }

    public function test_image_url_column_is_gone(): void
    {
        $columns = collect(\Illuminate\Support\Facades\Schema::getColumnListing('sub_models'));
        $this->assertFalse(
            $columns->contains('image_url'),
            'Kolom sub_models.image_url harus sudah dihapus (tidak dipakai storefront).'
        );
    }

    public function test_admin_pages_no_longer_expose_image_url(): void
    {
        $admin = $this->admin();
        SubModel::create(['product_model' => 'SWING', 'code' => 'SERIES_X', 'name' => 'Series X', 'sort_order' => 10]);
        $subModel = SubModel::query()->firstOrFail();

        $this->actingAs($admin)
            ->get(route('admin.sub-models.edit', $subModel))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/SubModelForm')
                ->missing('subModel.image_url'));

        $this->actingAs($admin)
            ->get(route('admin.sub-models.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->missing('rows.0.image_url'));
    }

    public function test_index_filters_by_status_and_provides_status_tabs(): void
    {
        SubModel::query()->delete();
        $admin = $this->admin();

        SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'ACTIVE_1', 'name' => 'Active 1', 'is_active' => true, 'sort_order' => 10]);
        SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'ACTIVE_2', 'name' => 'Active 2', 'is_active' => true, 'sort_order' => 20]);
        SubModel::create(['product_model' => 'SWING_2_DAUN', 'code' => 'INACTIVE_1', 'name' => 'Inactive 1', 'is_active' => false, 'sort_order' => 30]);

        // Default 'all'
        $this->actingAs($admin)
            ->get(route('admin.sub-models.index', ['product_model' => 'SWING_2_DAUN']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/SubModels')
                ->where('activeStatus', 'all')
                ->where('statusTabs.0.count', 3)
                ->where('statusTabs.1.count', 2)
                ->where('statusTabs.2.count', 1)
                ->has('rows', 3));

        // Filter 'active'
        $this->actingAs($admin)
            ->get(route('admin.sub-models.index', ['product_model' => 'SWING_2_DAUN', 'status' => 'active']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activeStatus', 'active')
                ->has('rows', 2)
                ->where('rows.0.code', 'ACTIVE_1')
                ->where('rows.1.code', 'ACTIVE_2'));

        // Filter 'inactive'
        $this->actingAs($admin)
            ->get(route('admin.sub-models.index', ['product_model' => 'SWING_2_DAUN', 'status' => 'inactive']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('activeStatus', 'inactive')
                ->has('rows', 1)
                ->where('rows.0.code', 'INACTIVE_1'));
    }

    /**
     * Ukuran halaman (kontrak 2026-09-23): hanya 20, 50, 100 yang diterima.
     * Nilai di luar daftar itu jatuh ke default 20.
     */
    public function test_index_per_page_accepts_only_allowed_sizes(): void
    {
        SubModel::query()->delete();
        $admin = $this->admin();

        for ($i = 1; $i <= 25; $i++) {
            SubModel::create([
                'product_model' => 'SWING_2_DAUN',
                'code' => 'BARIS_'.$i,
                'name' => 'Baris '.$i,
                'sort_order' => $i * 10,
            ]);
        }

        // Default 20: hanya halaman pertama yang dikirim.
        $this->actingAs($admin)
            ->get(route('admin.sub-models.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('perPage', 20)
                ->where('pagination.total', 25)
                ->where('pagination.last_page', 2)
                ->has('rows', 20));

        // 100: seluruh 25 baris dalam satu halaman.
        $this->actingAs($admin)
            ->get(route('admin.sub-models.index', ['per_page' => 100]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('perPage', 100)
                ->where('pagination.last_page', 1)
                ->has('rows', 25));

        // Nilai tidak diizinkan jatuh ke default 20.
        $this->actingAs($admin)
            ->get(route('admin.sub-models.index', ['per_page' => 77]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('perPage', 20)
                ->has('rows', 20));
    }
}
