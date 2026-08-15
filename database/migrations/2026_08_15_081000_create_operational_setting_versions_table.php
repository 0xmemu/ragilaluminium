<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operational_setting_versions', function (Blueprint $table): void {
            $table->id();
            $table->string('setting_key');
            $table->unsignedInteger('version');
            $table->json('value');
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('source')->default('system');
            $table->text('reason')->nullable();
            $table->string('reference_type')->nullable();
            $table->string('reference_id')->nullable();
            $table->timestamp('created_at');

            $table->foreign('actor_id')->references('id')->on('users')->nullOnDelete();
            $table->unique(['setting_key', 'version'], 'uq_operational_setting_version');
            $table->index(['setting_key', 'created_at'], 'idx_operational_setting_key_created');
            $table->index(['reference_type', 'reference_id'], 'idx_operational_setting_reference');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operational_setting_versions');
    }
};
