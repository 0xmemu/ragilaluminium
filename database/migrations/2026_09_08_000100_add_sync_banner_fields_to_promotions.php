<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kontrak owner 2026-09-08: toggle "Sinkron ke banner beranda" pada kampanye
 * harus benar-benar berfungsi. Ketika aktif, admin mengisi materi banner
 * (gambar + link) dan/atau mengaktifkan bar promo, lalu sistem otomatis
 * MEMPUBLIKASIKAN banner/bar tersebut hanya selama kampanye berstatus live
 * (active, atau scheduled yang sudah lewat starts_at). Saat kampanye berakhir
 * (ended/finished), banner & bar otomatis disembunyikan lagi.
 *
 * Kolom:
 * - sync_banner_image_url / sync_banner_media_asset_id: gambar banner beranda.
 * - sync_banner_link_url: tujuan klik banner (default /flash-sale atau /promo).
 * - sync_bar_promo: aktifkan baris bar promo beranda selama kampanye live.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table): void {
            $table->string('sync_banner_image_url')->nullable()->after('sync_banner');
            $table->unsignedBigInteger('sync_banner_media_asset_id')->nullable()->after('sync_banner_image_url');
            $table->string('sync_banner_link_url', 2048)->nullable()->after('sync_banner_media_asset_id');
            $table->boolean('sync_bar_promo')->default(false)->after('sync_banner_link_url');
        });
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table): void {
            $table->dropColumn(['sync_banner_image_url', 'sync_banner_media_asset_id', 'sync_banner_link_url', 'sync_bar_promo']);
        });
    }
};
