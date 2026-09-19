<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('system_health_snapshots', function (Blueprint $table) {
            // cpu_pct: utilisasi sesaat (bukan persentase sejak boot).
            $table->decimal('cpu_pct', 5, 2)->nullable()->after('load_15');
            // vcpu: pembanding load average supaya angkanya bermakna.
            $table->unsignedSmallInteger('vcpu')->nullable()->after('cpu_pct');
            // disk_mount: mount point yang menaungi storage aplikasi.
            $table->string('disk_mount', 64)->nullable()->after('disk_pct');
        });
    }

    public function down(): void
    {
        Schema::table('system_health_snapshots', function (Blueprint $table) {
            $table->dropColumn(['cpu_pct', 'vcpu', 'disk_mount']);
        });
    }
};
