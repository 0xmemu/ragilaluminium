<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicUxBlockersTest extends TestCase
{
    use RefreshDatabase;

    public function test_validation_messages_use_indonesian_field_labels(): void
    {
        $this->assertSame('id', config('app.locale'));

        $response = $this->from('/checkout')->post('/checkout/validate', []);
        $response->assertSessionHasErrors([
            'city_id',
            'address_line1',
            'name',
            'phone',
        ]);

        $joined = implode(' ', session('errors')->getBag('default')->all());
        $this->assertStringContainsString('Kota/Kabupaten', $joined);
        $this->assertStringContainsString('Alamat', $joined);
        $this->assertStringNotContainsString('city id', strtolower($joined));
        $this->assertStringNotContainsString('address line1', strtolower($joined));
        $this->assertStringNotContainsString('field is required', strtolower($joined));

        $orderResponse = $this->from('/order/status')->post('/order/status', []);
        $orderResponse->assertSessionHasErrors(['order_number']);

        $orderJoined = implode(' ', session('errors')->getBag('default')->all());
        $this->assertStringContainsString('Nomor pesanan', $orderJoined);
        $this->assertStringNotContainsString('order number', strtolower($orderJoined));
    }

    public function test_unknown_public_url_renders_branded_inertia_error(): void
    {
        $this->get('/halaman-yang-pasti-tidak-ada-xyz')
            ->assertNotFound()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Error')
                ->where('status', 404)
            );
    }

    public function test_unknown_admin_url_renders_admin_branded_error(): void
    {
        $admin = \App\Models\User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->get('/admin/halaman-yang-pasti-tidak-ada-xyz')
            ->assertNotFound()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Error')
                ->where('status', 404)
            );
    }

    public function test_import_file_mimes_message_is_indonesian(): void
    {
        $admin = \App\Models\User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $tmp = tempnam(sys_get_temp_dir(), 'imp');
        file_put_contents($tmp, 'not-an-excel');
        $upload = new \Illuminate\Http\UploadedFile($tmp, 'notes.txt', 'text/plain', null, true);

        $response = $this->actingAs($admin)->post(route('admin.imports.store'), [
            'file' => $upload,
        ]);

        $response->assertSessionHasErrors(['file']);
        $joined = implode(' ', session('errors')->getBag('default')->all());
        $this->assertStringContainsString('Excel', $joined);
        $this->assertStringNotContainsString('validation.mimes', strtolower($joined));
        $this->assertStringNotContainsString('must be a file of type', strtolower($joined));
    }
}
