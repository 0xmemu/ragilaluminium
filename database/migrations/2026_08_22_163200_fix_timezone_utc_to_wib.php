<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * KPI-001 KOREKSI TIMEZONE UTC -> Asia/Jakarta (+7 jam) utk semua kolom datetime/timestamp.
 * Data historis disimpan UTC-naif; app kini memakai WIB. Tambah 7 jam agar interpretasi konsisten.
 * Forward-only. Backup: /root/ragilaluminium-backups/pre-timezone-fix_*.sql.gz
 * NOTE: kolom bertipe DATE (mis. performance_metrics.metric_date) DIKECUALIKAN.
 */
class FixTimezoneUtcToWib extends Migration
{
    public function up(): void
    {
        // Hanya MySQL (produksi/dev): DATE_ADD bukan fungsi SQLite. Test memakai sqlite :memory:.
        if (\Illuminate\Support\Facades\DB::getDriverName() !== 'mysql') {
            echo "Timezone shift skipped (driver: ".\Illuminate\Support\Facades\DB::getDriverName().").\n";
            return;
        }
        $tzCols = [
            'admin_notifications' => ['read_at', 'created_at', 'updated_at'],
            'announcements' => ['created_at', 'updated_at'],
            'categories' => ['created_at', 'updated_at'],
            'cms_banners' => ['created_at', 'updated_at'],
            'cms_faq_items' => ['created_at', 'updated_at'],
            'cms_gallery_items' => ['created_at', 'updated_at'],
            'cms_model_products' => ['created_at', 'updated_at'],
            'cms_pages' => ['created_at', 'updated_at'],
            'cms_problems_solutions' => ['created_at', 'updated_at'],
            'cms_testimonials' => ['verified_at', 'created_at', 'updated_at'],
            'customers' => ['created_at', 'updated_at'],
            'event_logs' => ['created_at'],
            'failed_jobs' => ['failed_at'],
            'import_job_rows' => ['processed_at', 'created_at', 'updated_at'],
            'import_jobs' => ['started_at', 'completed_at', 'created_at', 'updated_at'],
            'media_assets' => ['created_at', 'updated_at'],
            'media_processing_logs' => ['created_at'],
            'operational_setting_versions' => ['created_at'],
            'order_items' => ['created_at', 'updated_at'],
            'order_number_sequences' => ['created_at', 'updated_at'],
            'order_return_cases' => ['completed_at', 'created_at', 'updated_at'],
            'order_return_items' => ['created_at', 'updated_at'],
            'orders' => ['created_at', 'updated_at'],
            'password_reset_tokens' => ['created_at'],
            'payments' => ['paid_at', 'created_at', 'updated_at'],
            'performance_visitor_events' => ['visited_at', 'created_at', 'updated_at'],
            'postal_code_mappings' => ['created_at', 'updated_at'],
            'postal_datasets' => ['retrieved_at', 'created_at', 'updated_at'],
            'product_attributes' => ['created_at', 'updated_at'],
            'product_media' => ['created_at', 'updated_at'],
            'product_popularity_boosts' => ['threshold_notified_at', 'disabled_at', 'created_at', 'updated_at'],
            'product_variants' => ['created_at', 'updated_at'],
            'products' => ['popularity_seed_applied_at', 'created_at', 'updated_at'],
            'promotion_items' => ['created_at', 'updated_at'],
            'promotions' => ['starts_at', 'ends_at', 'created_at', 'updated_at'],
            'shipping_records' => ['last_status_at', 'created_at', 'updated_at'],
            'shipping_tracking_events' => ['occurred_at', 'created_at', 'updated_at'],
            'store_vouchers' => ['starts_at', 'ends_at', 'created_at', 'updated_at'],
            'sub_models' => ['created_at', 'updated_at'],
            'users' => ['email_verified_at', 'created_at', 'updated_at'],
            'whatsapp_messages' => ['sent_at', 'received_at', 'created_at', 'updated_at'],
            'whatsapp_templates' => ['created_at', 'updated_at'],
        ];

        $changed = 0;
        foreach ($tzCols as $table => $cols) {
            foreach ($cols as $col) {
                $count = DB::table($table)->whereNotNull($col)->count();
                if ($count === 0) {
                    continue;
                }
                DB::statement("UPDATE `$table` SET `$col` = DATE_ADD(`$col`, INTERVAL 7 HOUR) WHERE `$col` IS NOT NULL");
                $changed++;
            }
        }
        echo "Timezone shift applied to $changed column-groups.\n";
    }

    public function down(): void
    {
        // Rollback tidak diimplementasikan; gunakan backup.
    }
}