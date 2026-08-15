<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('postal_code_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('postal_dataset_id')->constrained('postal_datasets')->cascadeOnDelete();
            $table->string('province_id', 32)->nullable();
            $table->string('province_name', 120);
            $table->string('regency_id', 32)->nullable();
            $table->string('regency_name', 120);
            $table->string('district_id', 32)->nullable();
            $table->string('district_name', 120);
            $table->string('village_id', 32)->nullable();
            $table->string('village_name', 160);
            $table->string('postal_code', 5);
            $table->unsignedInteger('source_row')->nullable();
            $table->timestamps();
            $table->unique(['postal_dataset_id', 'village_id', 'village_name', 'postal_code'], 'uq_postal_mapping_village_code');
            $table->index(['postal_dataset_id', 'postal_code'], 'idx_postal_mapping_code');
            $table->index(['postal_dataset_id', 'village_id'], 'idx_postal_mapping_village');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('postal_code_mappings');
    }
};
