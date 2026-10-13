<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kolom pelacakan polling berkala J&T Cargo.
     * Mencegah pemanggilan API berlebih (throttling), mencatat riwayat error,
     * dan mengatur jadwal retry dengan backoff.
     */
    public function up(): void
    {
        Schema::table('shipping_records', function (Blueprint $table) {
            $table->timestamp('last_polled_at')->nullable()->after('last_status_at');
            $table->unsignedInteger('poll_attempts')->default(0)->after('last_polled_at');
            $table->timestamp('next_poll_at')->nullable()->after('poll_attempts');
            $table->text('last_poll_error')->nullable()->after('next_poll_at');

            $table->index(['status', 'next_poll_at'], 'idx_shipping_poll');
        });
    }

    public function down(): void
    {
        Schema::table('shipping_records', function (Blueprint $table) {
            $table->dropIndex('idx_shipping_poll');
            $table->dropColumn([
                'last_polled_at',
                'poll_attempts',
                'next_poll_at',
                'last_poll_error',
            ]);
        });
    }
};
