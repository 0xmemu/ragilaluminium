<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_folders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('media_folders')->nullOnDelete();
            $table->string('name', 120);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        if (! Schema::hasColumn('media_assets', 'folder_id')) {
            Schema::table('media_assets', function (Blueprint $table) {
                $table->foreignId('folder_id')->nullable()->after('poster_asset_id')
                    ->constrained('media_folders')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::table('media_assets', function (Blueprint $table) {
            $table->dropForeign(['folder_id']);
            $table->dropColumn('folder_id');
        });
        Schema::dropIfExists('media_folders');
    }
};