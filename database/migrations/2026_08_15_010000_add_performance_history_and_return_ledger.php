<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            $table->string('product_category')->nullable()->after('name');
            $table->string('product_model')->nullable()->after('product_category');
            $table->string('design_variant')->nullable()->after('product_model');
            $table->index(['product_model', 'design_variant'], 'idx_order_items_catalog_identity');
        });

        Schema::create('order_return_cases', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->restrictOnDelete();
            $table->string('status', 32)->default('open');
            $table->string('reason', 120);
            $table->string('resolution_type', 64)->nullable();
            $table->text('customer_notes')->nullable();
            $table->text('admin_notes')->nullable();
            $table->decimal('refund_amount', 12, 2)->default(0);
            $table->decimal('replacement_amount', 12, 2)->default(0);
            $table->decimal('additional_shipping_amount', 12, 2)->default(0);
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['order_id', 'status'], 'idx_return_cases_order_status');
            $table->index('completed_at', 'idx_return_cases_completed_at');
        });

        Schema::create('order_return_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('return_case_id')->constrained('order_return_cases')->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained('order_items')->restrictOnDelete();
            $table->unsignedInteger('requested_quantity')->default(0);
            $table->unsignedInteger('returned_quantity')->default(0);
            $table->timestamps();

            $table->index(['return_case_id', 'returned_quantity'], 'idx_return_items_case_quantity');
            $table->index('order_item_id', 'idx_return_items_order_item');
        });

        Schema::create('performance_visitor_events', function (Blueprint $table): void {
            $table->id();
            $table->string('visitor_hash', 64);
            $table->date('visit_date');
            $table->timestamp('visited_at');
            $table->timestamps();

            $table->unique(['visitor_hash', 'visit_date'], 'uq_performance_visitor_day');
            $table->index('visited_at', 'idx_performance_visitor_visited_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('performance_visitor_events');
        Schema::dropIfExists('order_return_items');
        Schema::dropIfExists('order_return_cases');

        Schema::table('order_items', function (Blueprint $table): void {
            $table->dropIndex('idx_order_items_catalog_identity');
            $table->dropColumn(['product_category', 'product_model', 'design_variant']);
        });
    }
};
