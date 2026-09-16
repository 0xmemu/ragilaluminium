<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Urutan tampil folder Media Library: hanya antar-sibling (folder tidak bisa
 * dipindah ke dalam folder lain; kepindahan parent tetap lewat aksi "move").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_folders', function (Blueprint $table) {
            if (! Schema::hasColumn('media_folders', 'sort_order')) {
                $table->unsignedInteger('sort_order')->default(0)->after('parent_id');
                $table->index(['parent_id', 'sort_order'], 'media_folders_parent_sort_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('media_folders', function (Blueprint $table) {
            $table->dropIndex('media_folders_parent_sort_idx');
            $table->dropColumn('sort_order');
        });
    }
};
