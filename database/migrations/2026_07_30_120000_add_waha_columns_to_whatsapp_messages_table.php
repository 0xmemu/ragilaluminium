<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_messages', function (Blueprint $table): void {
            if (! Schema::hasColumn('whatsapp_messages', 'provider')) {
                $table->string('provider', 32)->default('meta')->after('phone_number');
            }
            if (! Schema::hasColumn('whatsapp_messages', 'provider_session')) {
                $table->string('provider_session', 64)->nullable()->after('provider_message_id');
            }
        });

        if (! $this->hasIndex('whatsapp_messages', 'idx_whatsapp_messages_provider_status')) {
            Schema::table('whatsapp_messages', function (Blueprint $table): void {
                $table->index(['provider', 'status'], 'idx_whatsapp_messages_provider_status');
            });
        }

        $this->expandStatusEnum();
    }

    public function down(): void
    {
        if ($this->hasIndex('whatsapp_messages', 'idx_whatsapp_messages_provider_status')) {
            Schema::table('whatsapp_messages', function (Blueprint $table): void {
                $table->dropIndex('idx_whatsapp_messages_provider_status');
            });
        }

        Schema::table('whatsapp_messages', function (Blueprint $table): void {
            if (Schema::hasColumn('whatsapp_messages', 'provider_session')) {
                $table->dropColumn('provider_session');
            }
            if (Schema::hasColumn('whatsapp_messages', 'provider')) {
                $table->dropColumn('provider');
            }
        });
    }

    protected function expandStatusEnum(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE whatsapp_messages MODIFY status ENUM('pending','sent','delivered','read','failed','received','deferred') NOT NULL DEFAULT 'pending'");
        }
        // SQLite (tests): enum is stored as string — no ALTER needed.
    }

    protected function hasIndex(string $table, string $name): bool
    {
        $sm = Schema::getConnection()->getSchemaBuilder();
        $indexes = $sm->getIndexes($table);

        foreach ($indexes as $index) {
            if (($index['name'] ?? '') === $name) {
                return true;
            }
        }

        return false;
    }
};
