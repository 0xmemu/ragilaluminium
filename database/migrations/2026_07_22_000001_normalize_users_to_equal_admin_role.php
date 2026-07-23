<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Stage 2 equal-admin: all dashboard users use canonical role `admin`.
     * Enum values remain in schema for compatibility; app no longer assigns others.
     */
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        DB::table('users')->where('role', '!=', 'admin')->update(['role' => 'admin']);
    }

    public function down(): void
    {
        // Irreversible data normalize — no-op.
    }
};
