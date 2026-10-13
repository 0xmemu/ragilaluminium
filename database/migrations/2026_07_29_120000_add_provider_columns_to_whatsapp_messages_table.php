<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_messages', function (Blueprint $table): void {
            $table->string('provider', 32)->default('meta')->after('phone_number');
            $table->string('provider_session', 64)->nullable()->after('provider_message_id');

            $table->index(['provider', 'status'], 'idx_whatsapp_messages_provider_status');
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_messages', function (Blueprint $table): void {
            $table->dropIndex('idx_whatsapp_messages_provider_status');
            $table->dropColumn(['provider', 'provider_session']);
        });
    }
};
