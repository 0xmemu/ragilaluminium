<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'Test Admin',
            'email' => 'test@example.com',
            'role' => 'admin',
            'status' => 'active',
            'password' => 'password',
        ]);

        $this->call(FaqSeeder::class);

        // Konten storefront penuh untuk QA frontend (butuh katalog sudah diimport):
        // php artisan db:seed --class=StorefrontQaSeeder
    }
}
