<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->string('seo_title', 191)->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Seed the three existing catalog categories.
        \Illuminate\Support\Facades\DB::table('categories')->insert([
            ['code' => 'WINDOW', 'name' => 'Jendela', 'slug' => 'windows', 'seo_title' => 'Jendela Aluminium', 'sort_order' => 1, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'DOOR', 'name' => 'Pintu', 'slug' => 'doors', 'seo_title' => 'Pintu Aluminium', 'sort_order' => 2, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'BOUVEN', 'name' => 'Boven', 'slug' => 'bouven', 'seo_title' => 'Boven Aluminium', 'sort_order' => 3, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
