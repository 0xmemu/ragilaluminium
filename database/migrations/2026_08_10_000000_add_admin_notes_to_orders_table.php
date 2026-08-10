<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SPESIFIKASI-FINAL §Catatan Internal Admin: catatan privat admin,
        // terpisah dari `notes` (catatan pembeli). Tidak masuk invoice/WhatsApp.
        Schema::table('orders', function (Blueprint $table) {
            $table->text('admin_notes')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('admin_notes');
        });
    }
};
