<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Koreksi dan penutupan kasus retur (instruksi owner 2026-09-28).
 *
 - late_return + override_reason: jalur "Catat Retur Manual" untuk pesanan
   yang sudah Selesai (completed -> return_in_process lewat admin khusus).
 - voided_at / voided_by_user_id / void_reason: penutupan administratif kasus.
   Kasus open menjadi "cancelled", kasus completed TETAP "completed" tetapi
   diberi tanda void sehingga tidak lagi dihitung laporan, tanpa dihapus fisik.
 - return_case_adjustments: jejak audit koreksi per field (nilai lama, nilai
   baru, alasan, pelaku) supaya edit kasus selesai tidak menimpa riwayat.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->boolean('late_return')->default(false)->after('resolution_type');
            $table->text('override_reason')->nullable()->after('late_return');
            $table->timestamp('voided_at')->nullable()->after('completed_at');
            $table->foreignId('voided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('void_reason')->nullable()->after('voided_by_user_id');
        });

        Schema::create('return_case_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('return_case_id')->constrained('order_return_cases')->cascadeOnDelete();
            $table->string('field', 64);
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->text('reason');
            $table->foreignId('changed_by_user_id')->nullable();
            $table->timestamps();

            $table->index(['return_case_id', 'created_at'], 'idx_return_adjustments_case_time');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('return_case_adjustments');

        Schema::table('order_return_cases', function (Blueprint $table) {
            $table->dropForeign(['voided_by_user_id']);
            $table->dropColumn(['late_return', 'override_reason', 'voided_at', 'voided_by_user_id', 'void_reason']);
        });
    }
};
