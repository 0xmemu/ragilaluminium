<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Bersihkan data dummy/test dari database development sebelum deploy ke production.
 *
 * AMAN: default = dry-run (hanya menampilkan jumlah). Untuk eksekusi sungguhan
 * pakai --yes. Kategori katalog/media tidak dihapus kecuali --katalog.
 */
class CleanupDummyData extends Command
{
    protected $signature = 'dev:cleanup-dummy
        {--yes : Jalankan penghapusan sungguhan (tanpa flag ini = dry-run)}
        {--katalog : Ikut hapus katalog + media hasil import dev (produk, varian, media)}
        {--with-sequences : Reset order_number_sequences}
        {--visitors : Hapus semua data performa (visitor events + metrics)}';

    protected $description = 'Petakan dan hapus data dummy/test dev (order uji, testimonial seeder, visitor bot, user dev).';

    public function handle(): int
    {
        $run = (bool) $this->option('yes');
        $katalog = (bool) $this->option('katalog');
        $sequences = (bool) $this->option('with-sequences');
        $visitors = (bool) $this->option('visitors');

        $mode = $run ? 'EKSEKUSI' : 'DRY-RUN';
        $this->info("== {$mode}: pembersihan data dummy/test dev ==");

        // Penanda order test yang diketahui (dev VPS 209, dibuat saat sesi verifikasi).
        $testOrderNumbers = [
            'ORD26080001', 'ORD26080002', 'ORD26080003',
            'RA-TEST-TRACK',
            'RA-260810-0001', 'RA-260815-0002',
        ];
        $testCustomerNames = ['Pembeli Test', 'Pembeli Uji Coba', 'bian'];

        $orderQuery = DB::table('orders')
            ->where(fn ($q) => $q->whereIn('order_number', $testOrderNumbers)
                ->orWhereIn('customer_name', $testCustomerNames));
        $orderIds = $orderQuery->pluck('id');
        $orderCount = $orderIds->count();

        $this->line('');
        $this->line("--- A. Order test ({$orderCount} baris) ---");
        if ($orderCount > 0) {
            foreach (DB::table('orders')->whereIn('id', $orderIds)->get(['order_number', 'customer_name', 'order_status', 'total_amount']) as $o) {
                $this->line("    {$o->order_number} | {$o->customer_name} | {$o->order_status} | {$o->total_amount}");
            }
        }

        $children = [
            'order_items' => fn () => DB::table('order_items')->whereIn('order_id', $orderIds)->count(),
            'payments' => fn () => DB::table('payments')->whereIn('order_id', $orderIds)->count(),
            'shipping_records' => fn () => DB::table('shipping_records')->whereIn('order_id', $orderIds)->count(),
            'shipping_tracking_events' => fn () => DB::table('shipping_tracking_events')->whereIn('order_id', $orderIds)->count(),
            'whatsapp_messages' => fn () => DB::table('whatsapp_messages')->whereIn('order_id', $orderIds)->count(),
            'event_logs (entity order)' => fn () => DB::table('event_logs')->where('entity_type', 'order')->whereIn('entity_id', $orderIds->map(fn ($id) => (string) $id))->count(),
        ];
        foreach ($children as $label => $counter) {
            $this->line("    terkait {$label}: {$counter()} baris");
        }

        $this->line('');
        $this->line('--- B. Testimonial fiktif (seeder) ---');
        $testimonials = DB::table('cms_testimonials')->count();
        $this->line("    cms_testimonials: {$testimonials} baris (semua dari seeder QA)");

        $this->line('');
        $this->line('--- C. User dev ---');
        $devUsers = DB::table('users')
            ->whereIn('email', ['qa.admin@example.com', 'dev.agent@ragilaluminium.test', 'febrian@333labs.tech'])
            ->orWhere('email', 'like', 'tmp-%@ragil.test')
            ->get(['id', 'name', 'email', 'role']);
        foreach ($devUsers as $u) {
            $this->line("    #{$u->id} {$u->name} | {$u->email} | {$u->role}");
        }

        $this->line('');
        $this->line('--- D. Promo/banner/announcement seeder ---');
        $promos = DB::table('promotions')->count();
        $promoItems = DB::table('promotion_items')->count();
        $banners = DB::table('cms_banners')->count();
        $anns = DB::table('announcements')->count();
        $promoAttrs = DB::table('product_attributes')
            ->whereIn('attribute_name', ['promo_compare_price', 'promo_flash_sale'])
            ->count();
        $this->line("    promotions: {$promos}, promotion_items: {$promoItems}, cms_banners: {$banners}, announcements: {$anns}, product_attributes promo: {$promoAttrs}");

        $visitorEvents = 0;
        $visitorMetrics = 0;
        if ($visitors) {
            $this->line('');
            $this->line('--- E. Data performa (visitor) ---');
            $visitorEvents = DB::table('performance_visitor_events')->count();
            $visitorMetrics = DB::table('performance_metrics')->count();
            $this->line("    performance_visitor_events: {$visitorEvents}, performance_metrics: {$visitorMetrics}");
        }

        $this->line('');
        $this->line('--- F. Sesi login ---');
        $sessions = DB::table('sessions')->count();
        $this->line("    sessions: {$sessions} baris");

        $seqRows = 0;
        if ($sequences) {
            $seqRows = DB::table('order_number_sequences')->count();
            $this->line("    order_number_sequences: {$seqRows}");
        }

        if ($katalog) {
            $this->line('');
            $this->line('--- G. Katalog + media import dev ---');
            foreach ([
                'products' => DB::table('products')->count(),
                'product_variants' => DB::table('product_variants')->count(),
                'product_media' => DB::table('product_media')->count(),
                'media_assets' => DB::table('media_assets')->count(),
                'sub_models' => DB::table('sub_models')->count(),
                'cms_model_products' => DB::table('cms_model_products')->count(),
                'import_jobs' => DB::table('import_jobs')->count(),
                'import_job_rows' => DB::table('import_job_rows')->count(),
            ] as $table => $count) {
                $this->line("    {$table}: {$count}");
            }
            $this->warn('    PERHATIAN: import_jobs/rows berisi riwayat import; hapus via command import terpisah bila perlu.');
        }

        if (! $run) {
            $this->line('');
            $this->warn('DRY-RUN: tidak ada yang dihapus. Jalankan ulang dengan --yes untuk eksekusi.');

            return self::SUCCESS;
        }

        // ===== EKSEKUSI =====
        DB::transaction(function () use ($orderIds, $devUsers, $promos, $katalog, $sequences, $visitors) {
            if ($orderIds->isNotEmpty()) {
                DB::table('order_items')->whereIn('order_id', $orderIds)->delete();
                DB::table('payments')->whereIn('order_id', $orderIds)->delete();
                DB::table('shipping_records')->whereIn('order_id', $orderIds)->delete();
                DB::table('shipping_tracking_events')->whereIn('order_id', $orderIds)->delete();
                DB::table('whatsapp_messages')->whereIn('order_id', $orderIds)->delete();
                DB::table('event_logs')->where('entity_type', 'order')->whereIn('entity_id', $orderIds->map(fn ($id) => (string) $id))->delete();
                DB::table('orders')->whereIn('id', $orderIds)->delete();
                $this->info("Order test + turunannya dihapus ({$orderIds->count()} order).");
            }

            DB::table('cms_testimonials')->delete();
            $this->info('cms_testimonials dibersihkan.');

            foreach ($devUsers as $u) {
                DB::table('users')->where('id', $u->id)->delete();
            }
            $this->info('User dev dihapus.');

            DB::table('promotions')->delete();
            DB::table('promotion_items')->delete();
            DB::table('cms_banners')->delete();
            DB::table('announcements')->delete();
            DB::table('product_attributes')->whereIn('attribute_name', ['promo_compare_price', 'promo_flash_sale'])->delete();
            $this->info('Promo/banner/announcement seeder dihapus.');

            DB::table('sessions')->delete();
            $this->info('Sesi login dibersihkan.');

            if ($visitors) {
                DB::table('performance_visitor_events')->delete();
                DB::table('performance_metrics')->delete();
                $this->info('Data performa visitor dibersihkan.');
            }

            if ($sequences) {
                DB::table('order_number_sequences')->delete();
                $this->info('order_number_sequences direset.');
            }

            if ($katalog) {
                DB::table('product_media')->delete();
                DB::table('media_assets')->delete();
                DB::table('product_variants')->delete();
                DB::table('products')->delete();
                $this->info('Katalog produk + media dihapus. Import ulang dari sumber asli sebelum go-live.');
            }
        });

        $this->info('Selesai.');

        return self::SUCCESS;
    }
}
