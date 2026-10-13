<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 64)->nullable()->after('name');
        });

        DB::table('users')->orderBy('id')->get(['id', 'name', 'email'])->each(function ($user): void {
            $seed = Str::before((string) $user->email, '@');
            $base = Str::lower(Str::slug($seed !== '' ? $seed : (string) $user->name, '_'));
            $base = trim($base, '._-') ?: 'admin';
            $base = Str::limit($base, 54, '');
            $candidate = $base;
            $suffix = 1;

            while (DB::table('users')->where('username', $candidate)->exists()) {
                $candidate = $base.'_'.++$suffix;
            }

            DB::table('users')->where('id', $user->id)->update(['username' => $candidate]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('username', 'users_username_unique');
            $table->dropUnique('users_email_unique');
            $table->index('email', 'users_email_index');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_email_index');
            $table->unique('email', 'users_email_unique');
            $table->dropUnique('users_username_unique');
            $table->dropColumn('username');
        });
    }
};