<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_logs', function (Blueprint $table): void {
            $table->string('source')->default('system')->after('created_by_user_id');
            $table->json('before')->nullable()->after('source');
            $table->json('after')->nullable()->after('before');
            $table->text('reason')->nullable()->after('after');
            $table->string('reference_type')->nullable()->after('reason');
            $table->string('reference_id')->nullable()->after('reference_type');
            $table->index(['reference_type', 'reference_id'], 'idx_event_logs_reference');
        });
    }

    public function down(): void
    {
        Schema::table('event_logs', function (Blueprint $table): void {
            $table->dropIndex('idx_event_logs_reference');
            $table->dropColumn([
                'source',
                'before',
                'after',
                'reason',
                'reference_type',
                'reference_id',
            ]);
        });
    }
};
