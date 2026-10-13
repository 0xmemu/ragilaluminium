<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Grup hasil pemasangan mandiri: judul yang diisi admin saat "Buat grup
 * baru" jadi entitas, sehingga daftar grup di admin menampilkan judul
 * tersebut (bukan label generik "Grup mandiri").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('installation_groups', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->timestamps();
        });

        Schema::table('product_media', function (Blueprint $table) {
            $table->foreignId('installation_group_id')
                ->nullable()
                ->after('model_product_id')
                ->constrained('installation_groups')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('product_media', function (Blueprint $table) {
            $table->dropForeign(['installation_group_id']);
            $table->dropColumn('installation_group_id');
        });

        Schema::dropIfExists('installation_groups');
    }
};
