<?php

namespace App\Console\Commands;

use App\Services\MediaStoragePurger;
use Illuminate\Console\Command;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

/**
 * Jaring pengaman untuk berkas media di disk (lokal atau R2).
 *
 * Cascade hapus di model MediaAsset sudah mencegah object yatim pada
 * penghapusan normal. Command ini menutup celah yang tidak bisa dicegah oleh
 * cascade: baris yang terhapus langsung lewat SQL, berkas yang tersalin dari
 * lingkungan lain, dan aset arsip yang berkasnya sengaja ditahan.
 *
 * PENTING: awalan Media Library (media/library/ dan media-assets/) DILINDUNGI
 * dari pemindaian yatim. Isinya disimpan untuk dipakai produk, jadi berkasnya
 * sering ada sebelum baris database yang merujuknya dibuat. Tanpa perlindungan
 * ini, pemindaian akan menghapus media produk hanya karena belum dirujuk.
 *
 * Dua tugasnya:
 * 1. Object yatim: berkas di disk yang tidak dirujuk baris database mana pun,
 *    di luar awalan Media Library yang dilindungi.
 * 2. Retensi arsip: hapus berkas aset yang lama diarsipkan, karena
 *    pengarsipan sengaja tidak menghapus berkas supaya masih bisa dipulihkan.
 */
class ReconcileMediaObjects extends Command
{
    protected $signature = 'media:reconcile
                            {--orphans : Laporkan object di disk yang tidak dirujuk database}
                            {--prune-orphans : Hapus object yatim (pakai bersama --orphans)}
                            {--archived-days=0 : Hapus berkas aset arsip lebih dari N hari (0 = lewati)}
                            {--dry-run : Tampilkan rencana tanpa menghapus apa pun}
                            {--force : Lewati pengaman ambang batas saat menghapus yatim}
                            {--include-library : Ikut sertakan awalan Media Library dalam pemindaian yatim}';

    protected $description = 'Temukan object media yatim di disk dan bersihkan berkas aset arsip yang kedaluwarsa';

    /** Awalan yang bukan media aplikasi, jadi tidak pernah dianggap yatim. */
    private const IGNORED_PREFIXES = ['healthchecks/', 'test/'];

    /**
     * Awalan Media Library yang dilindungi dari pemindaian yatim.
     *
     * Isinya disimpan untuk dipakai produk, jadi TIDAK pernah dianggap yatim
     * walaupun belum ada baris database yang merujuknya. Kontrak owner
     * 2026-10-14: jangan hapus media di Media Library produksi.
     *
     * @var list<string>
     */
    private const PROTECTED_PREFIXES = ['media/library/', 'media-assets/'];

    /**
     * Kolom database yang menyimpan penunjuk ke berkas media.
     *
     * Daftar ini HARUS lengkap: satu kolom yang terlewat berarti berkasnya
     * dianggap yatim dan ikut terhapus, padahal masih dipakai. Isinya sudah
     * diverifikasi dengan menyisir seluruh kolom teks di database untuk
     * nilai yang memuat awalan penyimpanan media.
     *
     * Kolom JSON (image_urls, media_items, derivatives) dibaca rekursif,
     * jadi nilai bersarang seperti [{"url": "..."}] ikut terbaca.
     *
     * @var array<string, list<string>>
     */
    private const REFERENCE_COLUMNS = [
        'media_assets' => ['object_key', 'derivatives', 'source_url'],
        'product_media' => ['stored_path', 'derivatives', 'stored_url', 'source_url'],
        'cms_banners' => ['image_url'],
        'cms_gallery_items' => ['image_url'],
        'cms_model_products' => ['image_url'],
        // Foto ulasan pelanggan tidak lewat media_assets: ditulis langsung ke
        // awalan reviews/ lalu disimpan sebagai URL di tiga kolom ini.
        'cms_testimonials' => ['image_url', 'image_urls', 'media_items'],
    ];

    public function handle(): int
    {
        $disk = Storage::disk(config('media.disk', 'media'));
        $dryRun = (bool) $this->option('dry-run');

        $referenced = $this->referencedKeys();
        $this->line('Key yang dirujuk database: '.count($referenced));

        $checkOrphans = (bool) $this->option('orphans') || (bool) $this->option('prune-orphans');
        $days = (int) $this->option('archived-days');

        if (! $checkOrphans && $days === 0) {
            $this->warn('Tidak ada aksi yang diminta.');
            $this->line('Pakai --orphans untuk memeriksa, --prune-orphans untuk membersihkan, atau --archived-days=N untuk retensi arsip.');

            return self::SUCCESS;
        }

        $status = self::SUCCESS;

        if ($checkOrphans) {
            $status = max($status, $this->handleOrphans($disk, $referenced, $dryRun));
        }

        if ($days > 0) {
            $status = max($status, $this->handleArchived($days, $dryRun));
        }

        return $status;
    }

    /**
     * Seluruh key penyimpanan yang masih dirujuk database.
     *
     * @return array<string, true>
     */
    private function referencedKeys(): array
    {
        $keys = [];
        $db = app('db');
        $schema = $db->getSchemaBuilder();

        foreach (self::REFERENCE_COLUMNS as $table => $columns) {
            if (! $schema->hasTable($table)) {
                continue;
            }

            foreach ($columns as $column) {
                if (! $schema->hasColumn($table, $column)) {
                    continue;
                }

                $db->table($table)
                    ->whereNotNull($column)
                    ->select($column)
                    ->orderBy($column)
                    ->chunk(500, function ($rows) use ($column, &$keys): void {
                        foreach ($rows as $row) {
                            $this->collectKeys($row->{$column}, $keys);
                        }
                    });
            }
        }

        return $keys;
    }

    /**
     * Kumpulkan semua key penyimpanan dari sebuah nilai kolom, termasuk nilai
     * bersarang di dalam JSON.
     *
     * @param  array<string, true>  $keys
     */
    private function collectKeys(mixed $value, array &$keys): void
    {
        if (is_array($value)) {
            foreach ($value as $item) {
                $this->collectKeys($item, $keys);
            }

            return;
        }

        if (! is_string($value)) {
            return;
        }

        // Kolom JSON bisa tersimpan sebagai string mentah.
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $this->collectKeys($decoded, $keys);

            return;
        }

        $key = $this->normalize($value);
        if ($key !== null) {
            $keys[$key] = true;
        }
    }

    /**
     * Ubah nilai kolom menjadi key penyimpanan. Menerima key mentah, path
     * publik lokal (/storage/media/...), atau URL penuh.
     */
    private function normalize(?string $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);
        if ($value === '') {
            return null;
        }

        $path = str_contains($value, '://')
            ? (string) (parse_url($value, PHP_URL_PATH) ?: '')
            : $value;
        $path = ltrim($path, '/');

        if (str_starts_with($path, 'storage/media/')) {
            $path = substr($path, strlen('storage/media/'));
        }

        return $path !== '' ? $path : null;
    }

    private function isIgnored(string $key): bool
    {
        foreach (self::IGNORED_PREFIXES as $prefix) {
            if (str_starts_with($key, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Berkas yang berada di awalan Media Library.
     *
     * Isinya disimpan untuk dipakai produk, jadi tidak pernah dianggap yatim
     * walaupun belum ada baris database yang merujuknya.
     */
    private function isProtected(string $key): bool
    {
        foreach (self::PROTECTED_PREFIXES as $prefix) {
            if (str_starts_with($key, $prefix)) {
                return true;
            }
        }

        return false;
    }

    private function handleOrphans(Filesystem $disk, array $referenced, bool $dryRun): int
    {
        $includeLibrary = (bool) $this->option('include-library');
        $orphans = [];
        $bytes = 0;
        $total = 0;
        $protected = 0;

        foreach ($disk->allFiles() as $key) {
            if ($this->isIgnored($key)) {
                continue;
            }
            $total++;

            if (! $includeLibrary && $this->isProtected($key)) {
                $protected++;

                continue;
            }

            if (isset($referenced[$key])) {
                continue;
            }

            $orphans[] = $key;
            $bytes += (int) $disk->size($key);
        }

        if ($orphans === []) {
            $this->info('Tidak ada object yatim di luar Media Library.');
            if ($protected > 0) {
                $this->line(sprintf('%d berkas Media Library dilewati karena dilindungi.', $protected));
            }

            return self::SUCCESS;
        }

        $this->warn(sprintf('%d object yatim dari %d berkas, %.2f MB.', count($orphans), $total, $bytes / 1048576));
        if ($protected > 0) {
            $this->line(sprintf('%d berkas Media Library dilewati karena dilindungi.', $protected));
        }
        foreach (array_slice($orphans, 0, 50) as $key) {
            $this->line('  '.$key);
        }
        if (count($orphans) > 50) {
            $this->line('  ... dan '.(count($orphans) - 50).' lainnya');
        }

        if (! $this->option('prune-orphans')) {
            $this->line('Jalankan ulang dengan --prune-orphans untuk menghapus.');

            return self::FAILURE;
        }

        // Pengaman: proporsi yatim yang sangat besar biasanya berarti daftar
        // kolom rujukan di atas ada yang kurang, bukan berarti disknya benar
        // benar penuh sampah. Menghapus dalam keadaan itu berisiko menghapus
        // berkas yang masih dipakai, jadi tahan dulu dan minta --force.
        if ($total >= 100 && count($orphans) / $total > 0.3 && ! $this->option('force')) {
            $this->error(sprintf(
                'Dibatalkan: %d dari %d berkas (%.0f%%) terdeteksi yatim, di atas ambang 30%%.',
                count($orphans),
                $total,
                (count($orphans) / $total) * 100
            ));
            $this->line('Periksa dulu apakah ada kolom rujukan yang belum terdaftar di REFERENCE_COLUMNS.');
            $this->line('Kalau sudah yakin, ulangi dengan --force.');

            return self::FAILURE;
        }

        if ($dryRun) {
            $this->line('Mode --dry-run: tidak ada yang dihapus.');

            return self::SUCCESS;
        }

        $deleted = $this->purge($orphans);
        $this->info(sprintf('%d object yatim dihapus.', count($deleted)));

        return self::SUCCESS;
    }

    private function handleArchived(int $days, bool $dryRun): int
    {
        $db = app('db');
        $cutoff = now()->subDays($days);

        $rows = $db->table('media_assets')
            ->where('visibility', 'archived')
            ->where('updated_at', '<', $cutoff)
            ->select(['id', 'object_key', 'derivatives'])
            ->get();

        if ($rows->isEmpty()) {
            $this->info("Tidak ada aset arsip lebih dari {$days} hari.");

            return self::SUCCESS;
        }

        $keys = [];
        foreach ($rows as $row) {
            $this->collectKeys($row->object_key, $keys);
            $this->collectKeys($row->derivatives, $keys);
        }

        $this->warn(sprintf('%d aset arsip lebih dari %d hari, %d berkas.', $rows->count(), $days, count($keys)));

        if ($dryRun) {
            $this->line('Mode --dry-run: tidak ada yang dihapus.');

            return self::SUCCESS;
        }

        $deleted = $this->purge(array_keys($keys));
        $this->info(sprintf('%d berkas aset arsip dihapus (baris database dipertahankan sebagai riwayat).', count($deleted)));

        return self::SUCCESS;
    }

    /**
     * @param  list<string>  $keys
     * @return list<string>
     */
    private function purge(array $keys): array
    {
        return app(MediaStoragePurger::class)->purgeKeys($keys);
    }
}
