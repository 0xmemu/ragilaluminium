<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sub_model_attribute_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sub_model_id')->nullable()->index();
            $table->foreign('sub_model_id')->references('id')->on('sub_models')->nullOnDelete();
            $table->string('product_model', 30)->index();
            $table->string('attribute_name', 100);
            $table->string('attribute_value', 255);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sub_model_attribute_templates');
    }
};
