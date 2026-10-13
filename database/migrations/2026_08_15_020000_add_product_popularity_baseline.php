<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->unsignedBigInteger('popularity_seed')->default(0)->after('homepage_popular_sort');
            $table->foreignId('popularity_seed_source_product_id')
                ->nullable()
                ->after('popularity_seed')
                ->constrained('products')
                ->nullOnDelete();
            $table->timestamp('popularity_seed_applied_at')->nullable()->after('popularity_seed_source_product_id');
            $table->foreignId('popularity_seed_applied_by_user_id')
                ->nullable()
                ->after('popularity_seed_applied_at')
                ->constrained('users')
                ->nullOnDelete();
            $table->index('popularity_seed_source_product_id', 'idx_products_popularity_seed_source');
        });

        Schema::create('product_popularity_boosts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('source_product_id')->constrained('products')->restrictOnDelete();
            $table->foreignId('target_product_id')->constrained('products')->restrictOnDelete();
            $table->boolean('enabled')->default(true)->index();
            $table->unsignedBigInteger('seed_sold_count')->default(0);
            $table->unsignedBigInteger('notification_threshold')->nullable();
            $table->timestamp('threshold_notified_at')->nullable();
            $table->timestamp('disabled_at')->nullable();
            $table->foreignId('disabled_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('disabled_reason', 500)->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['source_product_id', 'target_product_id'], 'uq_popularity_boost_source_target');
            $table->index(['target_product_id', 'enabled'], 'idx_popularity_boost_target_enabled');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_popularity_boosts');

        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['popularity_seed_source_product_id']);
            $table->dropForeign(['popularity_seed_applied_by_user_id']);
            $table->dropIndex('idx_products_popularity_seed_source');
            $table->dropColumn([
                'popularity_seed',
                'popularity_seed_source_product_id',
                'popularity_seed_applied_at',
                'popularity_seed_applied_by_user_id',
            ]);
        });
    }
};
