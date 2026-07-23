<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->unique();
            $table->string('email')->nullable();
            $table->string('default_address_line1')->nullable();
            $table->string('default_address_line2')->nullable();
            $table->string('default_city')->nullable();
            $table->string('default_province')->nullable();
            $table->string('default_postal_code')->nullable();
            $table->string('default_country')->nullable();
            $table->timestamps();

            $table->unique('phone', 'idx_customers_phone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
