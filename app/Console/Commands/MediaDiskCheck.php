<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaDiskCheck extends Command
{
    protected $signature = 'media:disk-check
                            {--keep : Jangan hapus object uji setelah sukses}';

    protected $description = 'Verifikasi disk media (local atau R2/S3): tulis, baca URL, hapus';

    public function handle(): int
    {
        $diskName = config('media.disk', 'media');
        $mode = strtolower((string) env('MEDIA_DISK', 'local'));
        if ($mode === 'public') {
            $mode = 'local';
            $this->warn('MEDIA_DISK=public diperlakukan sebagai local (alias). Prefer MEDIA_DISK=local.');
        }
        $disk = Storage::disk($diskName);
        $diskConfig = (array) config("filesystems.disks.{$diskName}", []);

        $this->info("MEDIA_DISK={$mode} → filesystems.disks.{$diskName}");
        $this->line('driver: '.(config("filesystems.disks.{$diskName}.driver") ?? '?'));

        if ($mode === 's3') {
            $required = [
                'AWS_ACCESS_KEY_ID' => $diskConfig['key'] ?? null,
                'AWS_SECRET_ACCESS_KEY' => $diskConfig['secret'] ?? null,
                'AWS_BUCKET' => $diskConfig['bucket'] ?? null,
                'AWS_ENDPOINT' => $diskConfig['endpoint'] ?? null,
                'AWS_URL' => $diskConfig['url'] ?? null,
            ];

            foreach ($required as $key => $value) {
                $ok = filled($value);
                $this->line(($ok ? '[ok] ' : '[MISSING] ').$key);
                if (! $ok) {
                    $this->error('Lengkapi konfigurasi R2 pada disk media (lihat docs/media-storage-r2.md).');

                    return self::FAILURE;
                }
            }
            $this->line('endpoint: '.$diskConfig['endpoint']);
            $this->line('public AWS_URL: '.$diskConfig['url']);
            $this->line('bucket: '.$diskConfig['bucket']);
        }

        $path = 'healthchecks/'.Str::lower(Str::random(12)).'.txt';
        $payload = 'ragil-media-disk-check '.now()->toIso8601String();

        try {
            $disk->put($path, $payload, ['visibility' => 'public']);
            $this->info("PUT ok: {$path}");

            $read = $disk->get($path);
            if ($read !== $payload) {
                $this->error('GET mismatch — isi file berbeda.');

                return self::FAILURE;
            }
            $this->info('GET ok');

            $url = $disk->url($path);
            $this->line("url: {$url}");

            if (! $this->option('keep')) {
                $disk->delete($path);
                $this->info('DELETE ok');
            } else {
                $this->warn("Object retained (--keep): {$url}");
            }
        } catch (\Throwable $e) {
            $this->error('Disk check failed: '.$e->getMessage());
            $this->line('Tip R2: AWS_USE_PATH_STYLE_ENDPOINT=true, AWS_DEFAULT_REGION=auto, AWS_URL = custom domain publik.');

            return self::FAILURE;
        }

        $this->info('media:disk-check PASS');

        return self::SUCCESS;
    }
}
