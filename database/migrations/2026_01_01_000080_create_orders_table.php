<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('customer_name');
            $table->string('customer_phone');
            $table->string('customer_email')->nullable();
            $table->string('shipping_address_line1');
            $table->string('shipping_address_line2')->nullable();
            $table->string('shipping_city');
            $table->string('shipping_province');
            $table->string('shipping_district')->nullable();
            $table->string('shipping_village')->nullable();
            $table->string('shipping_postal_code');

            $table->string('shipping_country')->default('Indonesia');
            $table->enum('order_status', [
                'pending_payment', 'processing', 'shipped', 'delivered',
                'completed', 'issue', 'return_in_process', 'cancelled',
            ])->default('pending_payment');
            $table->enum('payment_status', ['pending', 'paid', 'refunded'])->default('pending');
            $table->enum('shipping_status', [
                'pending_pickup', 'in_process', 'in_transit', 'delivered', 'cancelled',
            ])->default('pending_pickup');
            $table->decimal('subtotal_amount', 12, 2);
            $table->decimal('shipping_amount', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->enum('payment_method', ['cod', 'transfer', 'other'])->default('transfer');
            $table->boolean('cod_flag')->default(false);
            $table->text('notes')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('customer_phone', 'idx_orders_customer_phone');
            $table->index(['order_status', 'payment_status', 'shipping_status'], 'idx_orders_statuses');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
