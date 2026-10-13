<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sub_models', function (Blueprint $table) {
            $table->id();
            $table->string('product_model', 50);
            $table->string('code', 100);
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('image_url', 1024)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['product_model', 'code']);
        });

        $models = ['JUNGKIT', 'SLIDING', 'SWING', 'KACA_MATI', 'ZIGZAG'];
        $designs = [
            'POLOS' => 'Polos',
            'ORNAMEN' => 'Ornamen',
            'KOMBINASI' => 'Kombinasi',
            'SERIES_A' => 'Seri A',
            'SERIES_B' => 'Seri B',
            'SERIES_C' => 'Seri C',
        ];
        $now = now()->toDateTimeString();
        $seeds = [];
        $modelIndex = 0;
        foreach ($models as $model) {
            $designIndex = 0;
            foreach ($designs as $code => $name) {
                $seeds[] = [
                    'product_model' => $model,
                    'code' => $code,
                    'name' => $name,
                    'sort_order' => $designIndex * 10 + $modelIndex,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                $designIndex++;
            }
            $modelIndex++;
        }
        DB::table('sub_models')->insert($seeds);
    }

    public function down(): void
    {
        Schema::dropIfExists('sub_models');
    }
};
