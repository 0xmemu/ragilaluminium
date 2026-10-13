<?php

/**
 * Migrasi data dari SQLite ke MySQL.
 *
 * Digunakan saat cutover dari dev (SQLite) ke produksi (MySQL 8).
 * Menyalin seluruh tabel yang ada di SQLite ke MySQL dengan urutan
 * parent -> child (aman untuk foreign key) dan mempertahankan ID asli.
 *
 * Cara pakai:
 *   1. Pastikan .env mengarah ke SQLite (DB_CONNECTION=sqlite) — sumber.
 *   2. Set env MySQL target lewat variabel berikut (atau default dari .env):
 *        MIGRATE_MYSQL_HOST / _PORT / _DATABASE / _USERNAME / _PASSWORD
 *      Jika tidak diset, dibaca dari .env (DB_HOST, DB_PORT, DB_DATABASE, ...).
 *   3. Jalankan:
 *        php scripts/migrate-sqlite-to-mysql.php
 *
 * Idempoten: tabel yang sudah terisi (mis. dari seeder migration) tidak
 * ditimpa — baris dengan ID duplikat dilewati (SKIP), bukan gagal.
 */

use Illuminate\Support\Facades\DB;

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$sourceDriver = DB::connection()->getDriverName();
if ($sourceDriver !== 'sqlite') {
    fwrite(STDERR, "ERROR: koneksi default harus SQLite (sumber).\n");
    fwrite(STDERR, "Set DB_CONNECTION=sqlite di .env lalu jalankan ulang.\n");
    exit(1);
}

// --- Konfigurasi target MySQL ---
// PENTING: jangan fallback ke DB_* dari .env karena saat migrasi, DB_* bisa
// menunjuk ke sumber SQLite (mis. DB_DATABASE berisi path file .sqlite).
// Set MIGRATE_MYSQL_* eksplisit, atau pakai default produksi di bawah.
$mysqlHost = env('MIGRATE_MYSQL_HOST', '127.0.0.1');
$mysqlPort = env('MIGRATE_MYSQL_PORT', '3306');
$mysqlDb   = env('MIGRATE_MYSQL_DATABASE', 'ragil_aluminium');
$mysqlUser = env('MIGRATE_MYSQL_USERNAME', 'ragil');
$mysqlPass = env('MIGRATE_MYSQL_PASSWORD', '');

config([
    'database.connections.mysql.host' => $mysqlHost,
    'database.connections.mysql.port' => $mysqlPort,
    'database.connections.mysql.database' => $mysqlDb,
    'database.connections.mysql.username' => $mysqlUser,
    'database.connections.mysql.password' => $mysqlPass,
    'database.connections.mysql.charset' => 'utf8mb4',
    'database.connections.mysql.collation' => 'utf8mb4_unicode_ci',
]);

$mysql = DB::connection('mysql');

try {
    $mysql->getPdo();
} catch (\Throwable $e) {
    fwrite(STDERR, "ERROR: tidak bisa konek MySQL: " . $e->getMessage() . "\n");
    exit(1);
}

// --- Urutan tabel: parent dulu, child belakangan ---
$order = [
    'users', 'cms_pages', 'cms_banners', 'cms_model_products', 'cms_testimonials',
    'cms_faq_items', 'cms_problems_solutions', 'cms_gallery_items',
    'products', 'product_variants', 'product_media', 'product_attributes',
    'sub_models', 'promotions', 'promotion_items',
    'customers', 'orders', 'order_items', 'payments',
    'shipping_records', 'store_vouchers', 'import_jobs', 'import_job_rows',
    'whatsapp_templates', 'whatsapp_messages',
    'event_logs', 'announcements', 'media_assets',
    'order_number_sequences', 'admin_notifications', 'performance_metrics',
];

$sqliteTables = [];
foreach (DB::select("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name") as $r) {
    $sqliteTables[] = $r->name;
}

$mysql->statement('SET FOREIGN_KEY_CHECKS=0');

$processed = [];
$skipped = [];

foreach ($order as $table) {
    if (! in_array($table, $sqliteTables, true)) {
        $skipped[] = "$table (tidak ada di sqlite)";
        continue;
    }

    $total = DB::table($table)->count();
    if ($total === 0) {
        $processed[] = "$table: 0 baris (lewati)";
        continue;
    }

    $mysqlCols = $mysql->getSchemaBuilder()->getColumnListing($table);
    $inserted = 0;
    $duplicate = 0;

    foreach (DB::table($table)->get() as $row) {
        $data = array_intersect_key((array) $row, array_flip($mysqlCols));
        try {
            $mysql->table($table)->insert($data);
            $inserted++;
        } catch (\Illuminate\Database\QueryException $e) {
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                $duplicate++;
            } else {
                fwrite(STDERR, "  [WARN] $table: " . substr($e->getMessage(), 0, 140) . "\n");
            }
        }
    }

    $label = "$table: $inserted/$total";
    if ($duplicate > 0) {
        $label .= " (skip duplikat: $duplicate)";
    }
    $processed[] = $label;
}

$mysql->statement('SET FOREIGN_KEY_CHECKS=1');

echo "=== Hasil migrasi SQLite -> MySQL ($mysqlDb) ===\n";
foreach ($processed as $p) {
    echo "  OK  $p\n";
}
foreach ($skipped as $s) {
    echo "  --  $s\n";
}
echo "SELESAI\n";
