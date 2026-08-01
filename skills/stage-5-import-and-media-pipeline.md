# Skill: Stage 5 – Import & Media Pipeline (Laravel + Laravel Excel)

This document defines the **Import & Media Pipeline** for the Ragil Aluminium system, assuming a Laravel backend, Laravel queues, and Laravel Excel (maatwebsite/excel) as the primary Excel parsing library.  
All agents must treat this as a **technical pipeline contract**: do not design ad‑hoc bulk logic outside this pipeline, and do not bypass job/log structures.

---

## 1. Goals & Constraints

The Import & Media Pipeline must:

- Use **Shopee Excel templates** (Mass Upload / Mass Update) as the primary input format.  
- Support **large files** (tens of thousands of rows) without HTTP timeouts.  
- Operate **asynchronously** using Laravel queues (jobs).  
- Provide **traceability**:
  - per job (`import_jobs`),
  - per row (`import_job_rows`),
  - and link media (`product_media`) to the job that created/updated them.  
- Allow **partial success**:
  - valid rows are applied,
  - invalid rows are logged with error reasons and can be re‑uploaded via correction files.

This pipeline is the **only official way** to perform mass operations on catalog and inventory data.

**Scale note (puluhan ribu ukuran / ribuan parent):** after download, `DownloadProductMedia` writes WebP `derivatives` (`thumb`/`card`/`pdp`) onto disk `media` (local or R2 via `MEDIA_DISK=s3`). Default `MEDIA_KEEP_ORIGINAL=false` discards the heavy JPG/PNG after WebP succeed (`stored_path` = pdp WebP). Storefront uses `ProductMedia::urlFor()`, never production hotlink of `source_url`. See `docs/media-storage-r2.md`. For local display work, prioritize only Home + first catalog pages with `php artisan media:download-pending --display-only`; do not drain the full media backlog unnecessarily. Full queue processing remains `php artisan queue:work --queue=media`. Backfill: `php artisan media:backfill-derivatives`. Prune existing originals: `php artisan media:prune-originals`.

**Product title SoT (Shopee admin):** live titles look like  
`Jendela Aluminium 3 Daun Swing Casement Ornamen Tinggi 200 cm x Panjang 160 cm (200x160)`.  
Older sample XLSX layouts are not the naming SoT. `ShopeeCatalogExport` stores `name` as-is and parses taxonomy/dimensions (case-insensitive). Public IDs (`parent_sku`) are never shown on the storefront.

---

## 2. Input Format – Shopee Excel Templates

### 2.1 Accepted File Types

The system accepts Shopee‑style spreadsheet files:

- `.xls`
- `.xlsx`
- `.xlsm` (macro‑enabled, as used by Shopee Mass Upload/Update templates)

Laravel Excel (maatwebsite/excel) and PhpSpreadsheet are used to read these formats and expose rows to the pipeline.

### 2.2 Key Columns from Shopee

For Ragil Aluminium, the pipeline expects Shopee templates with, at minimum, columns like:

- Product identification:
  - `parent_sku`
  - product name / title
  - Shopee category (`category_id`)

- Variant structure:
  - `variant_sku`
  - `variation_1_name`, `variation_1_option`
  - `variation_2_name`, `variation_2_option` (if used)

- Commercial attributes:
  - `price`
  - `stock`
  - `weight`
  - size/dimension fields (as per Shopee template)

- Media references:
  - `image_1` … `image_9` (catalog image URLs → `product_media` with `show_in_catalog=true`, `is_installation=false`)
  - `installation_slots` (optional, comma-separated positions e.g. `7,8,9`) — marks matching `image_*` rows also `is_installation=true` (same URL, dual use on Hasil Pemasangan)
  - `installation_image_1` … `installation_image_9` (extra installation URLs → `show_in_catalog=false`, `is_installation=true`; does not pollute PDP catalog gallery)

The pipeline maps these columns onto internal entities (`products`, `product_variants`, `product_attributes`, `product_media`) according to Stage 1–3 rules. Installation media uses the same `DownloadProductMedia` queue as catalog images. Public Hasil Pemasangan aggregates installation `product_media` plus manual `cms_gallery_items`.

---

## 3. Import Job Model & Structure

### 3.1 `import_jobs` Entity

`import_jobs` represents an import operation:

- Fields (example):
  - `id`
  - `type` – e.g.:
    - `catalog_products`
    - `catalog_variants`
    - `inventory_stock_price`
    - `catalog_media`
  - `file_path` – path or storage reference to the uploaded Excel file.
  - `status` – `pending`, `running`, `completed`, `failed`.
  - `rows_total` – total rows read.
  - `rows_success` – processed successfully.
  - `rows_failed` – processed with errors.
  - `created_by` – admin ID.
  - `created_at`, `updated_at`.

### 3.2 `import_job_rows` Entity

`import_job_rows` stores per‑row results:

- Fields (example):
  - `id`
  - `import_job_id`
  - `row_index` – row number in the spreadsheet.
  - `raw_data` – JSON snapshot of parsed columns (or key fields).
  - `status` – `success`, `failed`.
  - `error_reason` – text explaining why the row failed (e.g., “parent_sku missing”, “category not supported”).

`import_job_rows` is the basis for generating correction files.

---

## 4. Import Pipeline – Upload → Job → Queue

### 4.1 Upload Step (Admin UI)

Actor: **Store Admin**  
Modules: **Admin UI**, **Import**

Flow:

1. Admin goes to Import screen (e.g., “Bulk Catalog Import”).
2. Admin uploads Shopee Excel file:
   - Selects kind of import (`products`, `variants`, `inventory`, `media`).
   - Selects stock source: `file` (preserve each spreadsheet row) or `manual` (one non-negative integer applied to every processed variant).
   - Submits the form.

System actions:

- Store file in configured storage (`storage/app/imports/...`).
- Create `import_job` record with:
  - appropriate `type`,
  - `file_path`,
  - `status = pending`,
  - `stock_mode = file|manual` and nullable `manual_stock`,
  - `created_by`.

Admin sees job entry appear in job list with status `pending`.

### 4.2 Queueing the Import (Laravel Excel + Queued Import)

Actor: **System/Worker**  
Libraries: **Laravel Excel (maatwebsite/excel)**

Flow:

1. Import Module dispatches a Laravel Excel queued import, e.g.:

   - `Excel::queueImport(new CatalogProductsImport($jobId), $filePath);`
   - or `(new CatalogProductsImport($jobId))->queue($filePath);`

2. The `CatalogProductsImport` class:
   - Implements appropriate Laravel Excel concerns, e.g.:
     - `ToModel` or `OnEachRow`,
     - `WithHeadingRow`,
     - `WithChunkReading`,
     - `ShouldQueue`,
     - `SkipsErrors`, `SkipsFailures`.

3. `WithChunkReading` ensures the file is read in chunks (e.g., 1000 rows per chunk) to keep memory usage controlled.

`import_job.status` transitions to `running` when the queued import starts.

---

## 5. Import Processing – Per Chunk & Per Row

### 5.1 Chunk Processing

Each chunk (e.g., 1000 rows) is processed by Laravel Excel and Laravel queue:

- Worker reads a chunk from the Excel file.
- For each row in the chunk:
  - Validates required columns and business rules.
  - Calls internal services to create/update catalog/inventory data.
  - Records row status and error information.

Chunking ensures large files (tens of thousands of rows) can be processed safely without memory or timeout issues.

### 5.2 Row Validation & Mapping

For each row:

1. Validate required fields:
   - `parent_sku` present (for product jobs).
   - `variant_sku` present (for variant jobs).
   - numeric fields valid (price, stock, weight).
   - Shopee category valid for Ragil Aluminium scope.

2. Map Shopee columns to internal model DTOs, e.g.:

   - `parent_sku` → internal product `parent_sku`.
   - `variant_sku` → internal variant `variant_sku`.
   - variation names/options → internal variant attributes.
   - media URLs → `product_media` references.

3. Persist via appropriate module services:
   - Catalog Module: create/update `products`, `product_variants`, `product_attributes`.
   - Inventory/Price: update `product_variants.price` and `stock_quantity`.

Stock mapping:

- `stock_mode = file`: validate and persist the stock value from the current spreadsheet row.
- `stock_mode = manual`: ignore the row's stock value and persist `import_jobs.manual_stock` for every variant. Record the effective stock and stock mode in `import_job_rows.raw_data` for traceability.
- Retry must read the persisted mode/value from `import_jobs`; it must not silently revert to file stock.

If mapping and persistence succeed:

- Create `import_job_rows` with `status = success`.
- Increment `rows_success` on the job.

If validation or mapping fails:

- Create `import_job_rows` with `status = failed` and `error_reason`.
- Increment `rows_failed`.

---

## 6. Job Completion & Correction Files

### 6.1 Job Status Finalization

When all chunks are processed:

- `import_job.rows_total` is set to total processed rows.
- `import_job.rows_success` and `rows_failed` are finalized.
- `import_job.status` becomes:
  - `completed` if at least one row succeeded, and no fatal errors occurred.
  - `failed` only if a fatal condition prevented processing (e.g., unreadable file).

Admin can see per‑job statistics in the Admin UI:

- total,
- success,
- failed,
- timestamps.

### 6.2 Correction File Generation

For jobs with any failed rows:

- Admin can click “Download error correction file”.
- System generates an Excel/CSV file containing:
  - only failed rows,
  - original data columns,
  - an extra `Error Reason` column showing why each row failed.

Admin workflow:

- Opens correction file.
- Fixes data (e.g., fill missing SKU, correct category).
- Re‑uploads the correction file as a new import job.

Each correction job is a separate `import_job` that references the original job ID for traceability (e.g., `parent_import_job_id`).

---

## 7. Media Pipeline – From Import to Downloaded Files

### 7.1 Creating Media References from Import

During import jobs that touch media (e.g., `catalog_media` or `catalog_variants` with image URLs):

- For each row with image URL columns:
  - Create or update `product_media` records:
    - `product_id` or `product_variant_id`,
    - `source_url` (Shopee image URL),
    - index (1–9),
    - `status = pending_download`,
    - `created_by_import_job_id = import_job.id`.

This establishes a **trace link** between `product_media` and the import job that introduced it.

**Shopee `mass_update_media_info`:** `ShopeeMediaExport` maps `product_id` → cover (col 4) + item images (cols 5–12). Re-import **must** set cover as `is_main_image` and hide prior catalog `source_url`s not in the file (otherwise stale/wrong covers — e.g. boven photo on jendela — remain on cards). Repair existing DB: `php artisan catalog:resync-shopee-media --download`.

### 7.2 Media Download Worker

Media Module uses Laravel queue workers:

1. A scheduled or triggered job scans `product_media` where:
   - `status = pending_download`.

2. For each such record:

   - Worker attempts to download from `source_url`.
   - If download succeeds:
     - Save to internal storage/CDN (e.g., `storage/app/media/products/...` or S3).
     - Generate `stored_url` (public or CDN link).
     - Set `status = downloaded`.
     - Optionally store metadata (size, mime type, dimensions).
   - If download fails:
     - Set `status = failed`.
     - Fill `error_reason` (e.g., 404, timeout, invalid URL).

Media workers may:

- Process in chunks/batches to control concurrency.
- Retry failed downloads based on retry rules (network error vs permanent 404).

### 7.3 Frontend Usage & Fallback

Frontend (Public UI & Admin UI):

- Always prefers `stored_url` to display images.
- If `stored_url` is missing and `source_url` is present:
  - may display a placeholder,
  - or optionally use `source_url` as best‑effort fallback (depending on design).
- For records with `status = failed`, Admin UI should show media errors so admins can:
  - fix source URLs,
  - or upload media manually.

---

## 8. Traceability – Jobs, Rows, Media

To maintain strong traceability:

- Each `product_media` must store:
  - `created_by_import_job_id` or `last_updated_by_import_job_id`.
- Each `import_job` can list associated media changes (via `product_media` query).

This allows:

- Debugging: “Which import caused media problems for this product?”
- Auditing: “What job populated these images?”
- Recovery: “Re‑run media download job for all media created by import job X.”

---

## 9. Error Handling & Monitoring

### 9.1 Errors at Import Level

Common import error categories:

- File unreadable / wrong format:
  - Job status = `failed` with global message.
- Row‑level validation errors:
  - Captured in `import_job_rows.error_reason`.
- Database errors (e.g., unique constraint violations):
  - Row marked as `failed`, error reason logged, job continues.

Agents must ensure:

- Fatal errors are rare; row errors are preferred over job failure.
- Errors are meaningful and actionable.

### 9.2 Errors at Media Level

Media errors:

- `source_url` invalid or unreachable.
- File too large or unsupported type.
- Storage write failure.

Actions:

- Mark `product_media.status = failed`.
- Store `error_reason`.
- Provide Admin UI views to:
  - filter failed media by job or product,
  - re‑trigger downloads,
  - update source URLs.

---

## 10. Performance & Scalability Considerations

To keep imports stable:

- Use **WithChunkReading** and appropriate `chunkSize()` / `batchSize()` in Laravel Excel imports.
- Always import via **queues**, not synchronous HTTP:
  - `Excel::queueImport(...)` or `->queue(...)`.
- Set reasonable chunk sizes (e.g., 1000 rows per chunk) and tune based on production experience.
- Use dedicated queue workers for:
  - import jobs,
  - media download jobs.

Avoid:

- Running large imports directly in controller synchronously.
- Running media downloads on the same worker as imports if it risks blocking.

---

## 11. Agent Checklist

Before designing or implementing anything related to import or media, agents must:

- [ ] Use **Shopee Excel templates** (XLS/XLSX/XLSM) as the primary bulk input format; do not invent alternative spreadsheet formats for core operations.  
- [ ] Route all bulk catalog/inventory changes through the Import Module and `import_jobs` / `import_job_rows` structures; do not implement ad‑hoc bulk updates in controllers.  
- [ ] Implement imports via **Laravel Excel queued imports** with chunk reading; avoid synchronous large imports.  
- [ ] Ensure each row is validated and its success or failure is recorded in `import_job_rows` with `error_reason` for failures.  
- [ ] Generate correction files that contain only failed rows + error reasons for admin fixes.  
- [ ] Create media references (`product_media`) during imports, linking each record to the import job that introduced it.  
- [ ] Process media downloads via background workers, saving files to internal storage and updating `stored_url` and status.  
- [ ] Ensure frontend uses `stored_url` as primary image source and surfaces failed media in Admin UI for remediation.  
- [ ] Maintain traceability between import jobs, rows, and media records to support debugging and auditing.  
- [ ] Avoid building custom bulk logic that bypasses this pipeline or directly manipulates database tables without job/log coverage.

Any bulk import or media processing design that conflicts with this Stage 5 skill must be refactored to align with the Ragil Aluminium pipeline architecture.
