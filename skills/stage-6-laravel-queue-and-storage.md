# Skill: Stage 6 – Laravel Queue & Storage Configuration for Ragil Aluminium

This document defines the **standard Laravel queue and storage configuration** for the Ragil Aluminium system.  
All agents must treat this as an **environment & infrastructure contract**: do not introduce ad‑hoc queue drivers or storage paths that conflict with these conventions, unless Stage 6 is explicitly updated.

---

## 1. Queue Strategy for Ragil Aluminium

### 1.1 Queue Connection

For asynchronous jobs (imports, media downloads, notifications), Ragil Aluminium uses:

- Default queue connection: **Redis** (preferred) or **Database** (fallback for very simple setups).

Environment:

- `.env` baseline:

  ```env
  QUEUE_CONNECTION=redis
  ```

If Redis is not available yet in early development:

- Temporary:

  ```env
  QUEUE_CONNECTION=database
  ```

but production should migrate to **Redis** for performance and reliability.

### 1.2 Queue Names & Separation

We use **logical queue names** on the same connection:

- `default` – general jobs (emails, simple notifications, etc.).  
- `imports` – Import Pipeline jobs (Stage 5).  
- `media` – Media Pipeline jobs (Stage 5).  

Config example `config/queue.php` (conceptual):

```php
return [
    'default' => env('QUEUE_CONNECTION', 'redis'),

    'connections' => [

        'redis' => [
            'driver'      => 'redis',
            'connection'  => 'default',
            'queue'       => env('REDIS_QUEUE', 'default'),
            'retry_after' => 1860,
            'block_for'   => null,
        ],

        'database' => [
            'driver'      => 'database',
            'table'       => 'jobs',
            'queue'       => 'default',
            'retry_after' => 1860,
        ],
    ],

    'failed' => [
        'driver'   => env('QUEUE_FAILED_DRIVER', 'database'),
        'database' => env('DB_CONNECTION', 'mysql'),
        'table'    => 'failed_jobs',
    ],
];
```

At the job level, we set specific queues:

- Import jobs:
  - `$this->onQueue('imports');`
- Media jobs:
  - `$this->onQueue('media');`

This keeps bulk workloads separated from general tasks while still using a single Redis or Database backend.
The 1,860-second visibility timeout must remain greater than the longest
`ProcessCatalogImport::$timeout` (1,800 seconds).

### 1.3 Redis Configuration (Recommended)

In `.env`:

```env
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

QUEUE_CONNECTION=redis
```

In `config/database.php`, Redis connection:

```php
'redis' => [
    'client' => 'phpredis',

    'default' => [
        'host'     => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD', null),
        'port'     => env('REDIS_PORT', 6379),
        'database' => env('REDIS_DB', 0),
    ],
];
```

If using a dedicated Redis database for queues, add e.g. a `queue` connection and reference it in `config/queue.php`.

---

## 2. Queue Workers & Process Management

### 2.1 Running Workers

Workers for Ragil Aluminium should be run via:

- `php artisan queue:work redis --queue=imports,media,default`
- Or separate workers per queue, e.g.:
  - `queue:work --queue=imports`
  - `queue:work --queue=media`
  - `queue:work --queue=default`

Use **Supervisor** or **Horizon** to keep workers running and auto‑restart on failure.

### 2.2 Worker Health & Limits

To keep workers healthy:

- Use flags like:

  - `--max-jobs=100`
  - `--max-time=3600`
  - `--sleep=3`
  - `--retry=3`

Example:

```bash
php artisan queue:work redis --queue=imports --max-jobs=100 --max-time=3600 --sleep=3 --tries=1 --timeout=1800
```

Principles:

- Worker `--timeout` must stay below the connection `retry_after`.
- Long import dispatches use `ShouldBeUnique` and `WithoutOverlapping` keyed by import job ID.
- Workers periodically restart to avoid memory leaks.
- Failed jobs are persisted in `failed_jobs` and can be retried via artisan (`queue:retry`) or Horizon.

---

## 3. Storage Strategy for Ragil Aluminium

### 3.1 Disks Overview

Ragil Aluminium uses three main disks:

1. `local` – internal, non‑public storage (e.g., raw import files).  
2. `public` – public or semi‑public storage for media (served via `/storage`).  
3. `s3` (optional) – for production media hosting on AWS S3 or similar.

Environment `.env` baseline:

```env
FILESYSTEM_DISK=local

# For S3 (if enabled)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_DEFAULT_REGION=ap-southeast-1
AWS_BUCKET=ragil-aluminium-bucket
AWS_URL=https://your-bucket-url
```

### 3.2 `config/filesystems.php` Disk Definitions

Conceptual configuration:

```php
return [

    'default' => env('FILESYSTEM_DISK', 'local'),

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root'   => storage_path('app'),
        ],

        'public' => [
            'driver'     => 'local',
            'root'       => storage_path('app/public'),
            'url'        => env('APP_URL').'/storage',
            'visibility' => 'public',
        ],

        'imports' => [
            'driver' => 'local',
            'root'   => storage_path('app/imports'),
        ],

        'media' => [
            'driver'     => env('MEDIA_DISK', 'public'), // 'public' or 's3'
            'root'       => storage_path('app/public/media'),
            'url'        => env('APP_URL').'/storage/media',
            'visibility' => 'public',
        ],

        's3' => [
            'driver'   => 's3',
            'key'      => env('AWS_ACCESS_KEY_ID'),
            'secret'   => env('AWS_SECRET_ACCESS_KEY'),
            'region'   => env('AWS_DEFAULT_REGION'),
            'bucket'   => env('AWS_BUCKET'),
            'url'      => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT', null),
        ],
    ],
];
```

Notes:

- `imports` disk is dedicated to raw import files.  
- `media` disk represents where product images/videos live (either `public` or `s3` depending on environment).  
- `public` disk remains available for other public assets.

### 3.3 Path Conventions

For consistency:

- Import files:
  - Stored under `imports/`:
    - e.g., `imports/catalog/products/2026-07-08-<job-id>.xlsx`
- Media:
  - Stored under `media/products/`:
    - e.g., `media/products/<product-id>/<filename>.jpg`
  - Or S3 path like `products/<product-id>/<filename>.jpg`.

Usage in code (examples):

```php
// Saving import file
Storage::disk('imports')->putFileAs('catalog/products', $uploadedFile, $fileName);

// Saving media
Storage::disk('media')->putFileAs("products/{$productId}", $imageFile, $fileName);

// Getting URLs
$mediaUrl = Storage::disk('media')->url("products/{$productId}/{$fileName}");
```

---

## 4. Mapping Pipelines to Queue & Storage

### 4.1 Import Pipeline (Stage 5) → Queue & Storage

- Upload step:
  - Admin uploads Excel → saved via `Storage::disk('imports')`.
  - `import_job.file_path` records the path on the `imports` disk.

- Processing step:
  - Laravel Excel queued import jobs:
    - dispatched on `imports` queue.
  - Workers:
    - `queue:work redis --queue=imports`.

- Results:
  - Only data changes (catalog/inventory) are written to the main DB.
  - Raw files stay in `imports` for audit and reprocessing.

### 4.2 Media Pipeline (Stage 5) → Queue & Storage

- `product_media` records:
  - reference `source_url`,
  - target disk: `media`.

- Download workers:
  - jobs dispatched on `media` queue.
  - workers run with `queue:work redis --queue=media`.

- Saving media:
  - Generate WebP `thumb`/`card`/`pdp` from the download temp file.
  - Default (`MEDIA_KEEP_ORIGINAL=false`): do **not** persist the heavy JPG/PNG; set `stored_path`/`stored_url` to the largest WebP (`pdp`). Original remains available via `source_url` for re-download.
  - If derivatives fail or `MEDIA_KEEP_ORIGINAL=true`: `Storage::disk('media')->put(...)` the original as fallback/archive.
  - Prune existing heavy originals: `php artisan media:prune-originals` (optional `--dry-run`). Orphan JPG/PNG on disk (no DB row) with sibling `*-pdp.webp`: add `--disk`.

Frontend:

- Prefer `ProductMedia::urlFor('card'|'thumb'|'pdp')` / `display_url` (derivatives). `stored_url` is the on-disk master (usually WebP pdp when keep_original is false).

---

## 5. Environment Profiles (Dev vs Prod)

### 5.1 Development Environment

Suggested defaults:

```env
APP_ENV=local
QUEUE_CONNECTION=database
FILESYSTEM_DISK=local
MEDIA_DISK=public
```

- Queue:
  - `database` driver (no Redis needed).
  - Workers can be run manually via `php artisan queue:work`.
- Storage:
  - Import files and media stored locally.
  - Public media served via `/storage` after `php artisan storage:link`.

### 5.2 Production Environment

Suggested defaults:

```env
APP_ENV=production
QUEUE_CONNECTION=redis
FILESYSTEM_DISK=local
MEDIA_DISK=s3
```

- Queue:
  - Redis driver.
  - Supervisor or Horizon manages workers:
    - separate workers for `imports`, `media`, and `default`.
- Storage:
  - Import files on `local/imports` (not public).
  - Media on S3 (via `media` disk pointing to `s3`).

This separation ensures:

- Large jobs do not block HTTP.
- Media delivery is fast and scalable.
- Import files are secure and auditable.

---

## 6. Agent Checklist

Before configuring or coding anything related to queues or storage, agents must:

- [ ] Use **Redis** as the main queue connection in production (`QUEUE_CONNECTION=redis`), with `database` only as a dev fallback.  
- [ ] Separate queue workloads logically using queue names: `default`, `imports`, `media`, and run workers accordingly.  
- [ ] Keep database/Redis `retry_after` above 1,800 seconds and preserve unique/overlap locks on catalog imports.
- [ ] Configure and run queue workers via Supervisor or Horizon with appropriate `--max-jobs` and `--max-time` to keep workers healthy.  
- [ ] Store raw import files on the dedicated `imports` disk/path and reference them via `import_job.file_path`.  
- [ ] Store product media on the `media` disk and always access them via `Storage::disk('media')` APIs (not hardcoded paths).  
- [ ] Use `stored_url` for frontend media, derived from the configured disk (local public or S3).  
- [ ] Keep development and production environment configurations aligned with this Stage 6 strategy (dev: database/public; prod: redis/s3).  
- [ ] Avoid introducing new queue connections or storage disks for core workflows without updating this skill and ensuring all agents are aware.  
- [ ] Ensure that any new pipeline (emails, reports, etc.) respects the established queue/storage conventions and does not conflict with import/media workloads.

Any queue or storage configuration that diverges from this Stage 6 skill must be reviewed and aligned before deployment in Ragil Aluminium’s system.
