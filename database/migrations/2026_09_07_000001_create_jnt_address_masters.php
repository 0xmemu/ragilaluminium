<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jnt_address_masters', function (Blueprint $table) {
            $table->id();
            $table->string('province_name', 120);
            $table->string('city_name', 120)->nullable();
            $table->string('area_name', 120)->nullable();
            $table->string('town_name', 160)->nullable();
            $table->string('province_key', 120);
            $table->string('city_key', 120)->nullable();
            $table->string('area_key', 120)->nullable();
            $table->string('town_key', 160)->nullable();
            $table->timestamp('synced_at');
            $table->timestamps();
            $table->unique(['province_key', 'city_key', 'area_key', 'town_key'], 'uq_jnt_address_hierarchy');
            $table->index(['province_key', 'city_key', 'town_key'], 'idx_jnt_address_town');
            $table->index(['province_key', 'city_key', 'area_key'], 'idx_jnt_address_area');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jnt_address_masters');
    }
};
