---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-brainstorm
title: Admin Product Creation, Shared Media, and R2 Efficiency
date: 2026-08-07
status: proposed
---

# Admin Product Creation, Shared Media, and R2 Efficiency

## Problem frame

Prioritas utama adalah membuat operator toko dapat menambah satu produk lengkap
dengan cepat dan aman: identitas, banyak varian, harga/stok, gambar/video,
review, lalu publish. Media yang sama harus dapat dipakai pada banyak produk,
varian, dan halaman hasil pemasangan tanpa upload atau penyimpanan ulang.

Implementasi sekarang belum memenuhi itu. `Admin/ProductForm` adalah satu form
panjang dengan paling banyak satu varian awal. Varian dan media dikerjakan
setelah produk tersimpan melalui halaman lain. `product_media` sekaligus
menyimpan file dan relasi pemakaian, selalu wajib memiliki `product_id`, dan
object key masih bergantung pada product ID. Akibatnya shared media tidak benar-
benar shared, import URL yang sama dapat membuat salinan fisik, dan perubahan
URL/storage lebih sulit dikelola.

## Verdict

Bangun alur **Tambah Produk** sebagai draft wizard 4 langkah:

1. Identitas produk
2. Varian, harga, stok, dan dimensi
3. Media produk, dengan pilihan upload baru atau pasang dari Media Library
4. Review, simpan draft, atau publish

Produk draft dibuat setelah langkah identitas pertama. Setiap langkah menyimpan
ke backend sehingga browser tertutup tidak menghilangkan pekerjaan. Produk
aktif hanya boleh dipublish jika memiliki minimal satu varian aktif, harga yang
valid, dan satu gambar utama katalog yang sudah siap atau memiliki fallback
status yang jelas.

Pisahkan data menjadi:

```text
media_assets       = satu aset fisik kanonik di R2
product_media      = pemakaian aset pada product/variant
```

`is_main_image`, `position`, `show_in_catalog`, `is_installation`, dan caption
adalah properti pemakaian, bukan properti aset. Satu aset dapat menjadi gambar
utama pada produk A, gambar biasa pada produk B, dan media instalasi pada produk
C tanpa menggandakan byte di R2.

## Requirements

### R1. Product creation must be task-oriented

- Admin melihat progress wizard dan dapat kembali ke langkah sebelumnya.
- SKU parent/variant tetap dibuat server-side dan hanya ditampilkan di admin.
- `category_id` tidak boleh menjadi angka kosong yang harus ditebak operator.
  Controller harus memberi default mapping kategori yang valid; field marketplace
  yang jarang diubah dapat ditempatkan di bagian Advanced.
- Produk baru selalu mulai sebagai `draft` kecuali admin memilih publish dan
  seluruh publish checks lulus.
- Tombol akhir harus membedakan `Simpan sebagai draft` dan `Simpan & publikasikan`.
- Error validasi tampil pada langkah dan field yang relevan, bukan hanya setelah
  operator kembali ke daftar.

### R2. Variant entry must support normal catalog work

- Satu langkah menyediakan tabel varian dengan tambah, edit, dan archive row.
- SKU dibuat otomatis; nama opsi, harga, stok, berat, dan dimensi dapat diisi
  inline.
- Admin dapat menyalin row terakhir untuk mempercepat ukuran yang berulang.
- Tidak boleh memaksa operator membuka halaman Kelola Varian untuk membuat
  varian pertama.
- Publish check menolak produk aktif tanpa varian aktif.

### R3. Shared Media Library must be understandable

- Selector media tersedia langsung pada langkah Media produk.
- Search/filter minimal: label, tipe image/video, motif/keyword, status proses,
  dan jumlah produk yang memakai.
- Setiap kartu menampilkan preview, label, status, dan teks seperti
  `Dipakai di 18 produk`.
- Aksi utama bernama `Pasang ke produk`, bukan `Upload ulang`.
- Saat memasang, admin memilih scope: seluruh produk atau varian tertentu.
- Admin dapat mengatur urutan, gambar utama, tampil di katalog, hasil
  pemasangan, dan caption sebagai properti attachment.
- Detach hanya melepas hubungan produk. Tidak boleh menghapus aset fisik yang
  masih dipakai attachment lain.
- Library global tetap menyediakan filter media gagal/pending untuk operasi
  recovery.

### R4. Import Shopee remains compatible

- Template Mass Upload/Mass Update resmi Shopee tidak diubah.
- URL `image_1..image_9` yang sama otomatis memakai satu `media_asset`.
- URL berbeda dengan byte yang sama dideduplikasi lewat SHA-256 setelah download
  sebelum object derivative baru ditulis.
- Re-import harus idempoten pada produk, varian, asset, dan attachment.
- Sinkronisasi cover Shopee tetap boleh menyembunyikan media katalog lama yang
  berasal dari import, tetapi tidak boleh menimpa attachment manual admin.
- Untuk relasi shared yang tidak dapat diekspresikan oleh URL Shopee, sediakan
  import mapping Ragil terpisah atau langkah mapping setelah import. Jangan
  merusak template resmi dengan kolom custom wajib.
- Detail job menampilkan minimal asset baru, asset yang dipakai ulang,
  attachment yang dibuat, dan error media.

### R5. R2 delivery must be immutable and independent of product IDs

- Object key baru tidak boleh memakai `products/{product_id}`.
- Gunakan checksum-based key, misalnya:

  ```text
  media-assets/{sha256}/thumb.webp
  media-assets/{sha256}/card.webp
  media-assets/{sha256}/pdp.webp
  media-assets/{sha256}/video.mp4
  media-assets/{sha256}/poster.webp
  ```

- URL publik diturunkan dari object key dan konfigurasi disk, bukan disalin ke
  setiap row attachment sebagai sumber kebenaran.
- Gunakan domain publik R2/custom domain sebagai jalur delivery kanonik.
  Proxy Nginx `/media-cdn` hanya boleh dipakai bila host upstream configurable,
  bukan hardcoded ke domain R2 lama.
- Checksum-based key memungkinkan `Cache-Control: immutable`; perubahan file
  menghasilkan key baru dan tidak terkena stale cache.
- Gambar memakai WebP `thumb/card/pdp`. Video menyimpan satu original browser-
  compatible dan poster opsional; video tidak dipaksa melalui image derivative.

### R6. Queue must actually be asynchronous

- `QUEUE_CONNECTION=sync` tidak boleh dipakai untuk preview yang menguji import
  atau media besar.
- Database queue boleh menjadi fallback, Redis menjadi target utama.
- Worker harus mengonsumsi queue yang benar. Unit saat ini menjalankan worker
  tanpa `--queue`, sehingga job `imports` dan `media` berisiko tertinggal pada
  queue `default`.
- Pisahkan kapasitas import dan media bila memungkinkan: import membutuhkan
  timeout panjang dan media membutuhkan concurrency network/GD.
- Admin menerima status pending/downloading/failed yang jujur; UI tidak boleh
  menampilkan sukses final sebelum worker menyelesaikan aset.

## Customer/operator journey

```text
Daftar Produk
  -> Tambah Produk
  -> Identitas: kategori/model/desain/nama
  -> Simpan draft & lanjut
  -> Varian: tambah banyak row, harga/stok/dimensi
  -> Media: pilih library atau upload baru
  -> Atur main/catalog/installation/variant scope
  -> Review: tampilkan blocker dan status media
  -> Simpan draft atau Publikasikan
  -> Detail produk dengan link nyata ke varian, media, dan import
```

Untuk produk yang sudah ada di Shopee, jalur yang lebih cepat tetap:

```text
Import Shopee
  -> job pending/running
  -> product + variant + attachment dibuat
  -> asset resolver dedupe URL/checksum
  -> media worker download/derivative
  -> admin hanya menangani failed rows/media atau mapping yang ambigu
```

## Proposed data ownership

### `media_assets`

Table baru untuk aset fisik kanonik. Minimum ownership:

- `id`
- `kind`: `image` atau `video`
- `source_url` dan hash URL untuk dedupe ingest
- `checksum` SHA-256, unique setelah tersedia
- `object_key` atau base key kanonik di disk media
- `derivatives` JSON untuk image sizes/poster
- `mime_type`, `size_bytes`, `width_px`, `height_px`, serta metadata video bila
  dibutuhkan
- `label`/title yang dapat dicari admin
- `status`: pending, downloading, ready, failed, archived
- error dan audit creator/updater

`poster_asset_id` boleh nullable untuk video dan harus menunjuk asset image.
Jangan menambahkan transcode pipeline sebelum kebutuhan video nyata terbukti.

### `product_media`

Pertahankan nama tabel dan route lama sebagai compatibility boundary, tetapi
ubah perannya menjadi attachment:

- tambah nullable `media_asset_id` untuk migrasi bertahap;
- pertahankan `product_id`, nullable `product_variant_id`, position, main,
  catalog, installation, visibility, caption, dan import/user audit;
- field physical legacy (`source_url`, `stored_path`, `stored_url`, derivatives,
  mime/size/dimensions/status) dibaca sebagai fallback selama migrasi lalu
  menjadi read-only/deprecated;
- tambahkan index `media_asset_id` dan index attachment lookup;
- cegah duplicate attachment secara idempotent pada scope product/variant.

Satu asset dapat memiliki attachment yang berbeda. Jangan menyimpan `is_main`
atau `is_installation` di `media_assets`.

### Import traceability

Pertahankan `created_by_import_job_id` dan `last_updated_by_import_job_id` pada
attachment. Jika summary job diperlukan, tambahkan counter media pada
`import_jobs` atau hitung dari event/row yang terstruktur; jangan menjadikan
string log sebagai sumber angka dashboard.

## Routing and API impact

Pertahankan route utama yang sudah ada:

- `admin.products.create/store/update`
- `admin.products.variants.*`
- `admin.products.media.byProduct/store`
- `admin.media.index` dan media action routes
- `admin.imports.*`

Perubahan yang diperlukan:

- `POST /admin/products/{product}/media` menerima `media_asset_id` selain upload
  baru/source URL, sehingga selector shared media memakai route existing.
- `GET /admin/media` menjadi library + operational status, dengan query search,
  kind, status, dan usage tanpa membuat URL baru.
- Bulk attach lintas produk memerlukan action route khusus dan harus ditambahkan
  bersama sitemap, API/routes docs, authorization, audit log, dan feature test.
- API storefront mempertahankan field media yang ada dengan URL yang diturunkan
  dari asset. Jika video atau `kind` diekspos ke public JSON, update schema/API
  docs dan contract tests pada perubahan yang sama.

## Migration and rollout

1. Tambah `media_assets` dan `product_media.media_asset_id`; jangan drop kolom
   legacy atau menghapus object R2.
2. Backfill asset dari existing rows. Kelompokkan dulu berdasarkan stored path,
   source URL yang dinormalisasi, lalu checksum bila perlu. Semua flag attachment
   harus tetap identik.
3. Ubah reader/API/admin agar eager-load asset dan fallback ke kolom legacy.
4. Ubah upload/import/download baru ke Asset Resolver dan checksum key.
5. Verifikasi count product media, main image, installation media, public URL,
   dan status pending/failed.
6. Rekey/dedupe object lama sebagai operasi terpisah dengan dry-run, checksum,
   HTTP smoke test, dan grace period. Jangan menghapus object lama pada langkah
   backfill.
7. Setelah seluruh row memiliki asset valid, baru pertimbangkan menjadikan
   `media_asset_id` non-null. Penghapusan kolom legacy adalah migration lanjutan,
   bukan bagian MVP.

## Implementation sequence

### Phase 0: unblock runtime

- Ganti preview dari `sync` ke `database` atau Redis.
- Perbaiki worker service agar mengonsumsi `imports,media,default` atau buat
  worker terpisah.
- Jadikan route/host delivery R2 configurable dan hilangkan upstream hardcoded.

### Phase 1: product wizard without shared asset migration

- Refactor `resources/js/pages/Admin/ProductForm.tsx` menjadi wizard draft.
- Tambah service/action catalog untuk save draft, variants, publish checks, dan
  audit.
- Integrasikan langkah varian ke route/controller yang sudah ada.
- Tambah feature/browser tests untuk draft -> variants -> publish/blocker.

### Phase 2: canonical asset layer

- Migration/model/relation `media_assets` dan `product_media.media_asset_id`.
- Asset Resolver, image dedupe, safe upload, and legacy backfill command.
- Update `ProductMedia`, `Product`, public serializers, admin media controller.
- Test shared attachment, detach safety, and legacy fallback.

### Phase 3: library and wizard selector

- Refactor `resources/js/pages/Admin/Products/Media.tsx` and global media index
  into asset-aware library/selector.
- Add usage count, search/filter, attach/detach, variant scope, and failure
  recovery states.
- Test one asset attached to multiple products and admin error states.

### Phase 4: import integration and video

- Resolve repeated Shopee URLs to one asset and merge same-checksum URLs.
- Preserve official Shopee template and add optional Ragil mapping flow only when
  needed.
- Add video validation, R2 object handling, poster support, and public contract
  only if video is included in storefront responses.
- Test re-import idempotency, stale cover hiding, different URL same checksum,
  and failed download retry.

## Acceptance checks

- Operator can create a draft product, add at least three variants, attach an
  existing image, upload another image, review blockers, and publish without
  leaving the wizard.
- The same asset appears in two products with one physical R2 key and two
  attachment rows.
- Detaching product A leaves product B and the R2 object intact.
- Re-importing the same Shopee file does not create duplicate assets or
  attachments.
- Two different URLs yielding the same bytes converge to one asset.
- Main image and installation flags remain product-specific.
- A failed image is visible with an actionable retry and does not claim ready.
- Public catalog/PDP still emits working `thumb/card/pdp` URLs and never falls
  back to Shopee in production.
- Import jobs continue processing asynchronously and media workers consume the
  dedicated queue.
- Existing 329 media rows and their public URLs remain readable throughout
  migration; no reset, truncate, or destructive database operation is allowed.

## Non-goals for the first implementation

- Replacing the official Shopee spreadsheet format.
- Browser-direct uploads with temporary signed URLs before the server-side flow
  is stable.
- Video transcoding, adaptive streaming, or a video editor.
- Hard deletion of media records or immediate deletion of R2 objects.
- A new public media proxy route in Laravel when the R2 public/custom domain is
  healthy.

## Open decisions before schema migration

1. Confirm the real default Shopee category IDs used by manual products; the
   current form has no authoritative category option source.
2. Confirm the maximum accepted video size and whether MP4 alone is sufficient.
3. Confirm whether global bulk attach is required in MVP or can follow the
   single-product wizard.
4. Confirm the preferred R2 public/custom domain for production delivery.

## Product Contract preservation

Product Contract meaning is preserved. This document proposes a new asset
ownership boundary and wizard workflow; no route, schema, or public JSON has
been changed yet. Those changes require schema/API/docs updates before coding.

## Implementation units

### U1. Queue and media delivery runtime

Update preview/service configuration so `imports` and `media` jobs are consumed,
and make the R2 public/proxy host configurable. Preserve external secret files.
Verify with config inspection and a queued job smoke test.

### U2. Product draft wizard and publish validation

Refactor the existing product create/edit flow into persisted draft steps,
support multiple variants in one flow, and enforce publish checks through a
catalog application service. Reuse existing routes where possible.
Verify with PHPUnit feature coverage and a browser smoke at 360px and desktop.

### U3. Canonical media asset layer

Add `media_assets`, link `product_media` through `media_asset_id`, implement
asset resolution/dedupe, and retain a legacy fallback for the existing 329
media rows. Do not remove legacy columns or R2 objects in this unit.
Verify migration/backfill on isolated SQLite fixtures and R2-free service tests.

### U4. Shared media selector and import integration

Expose asset-aware library props and product attachment actions in the admin
wizard/media pages. Make repeated Shopee URLs idempotent and attach one asset to
multiple products. Add video metadata only if the current upload contract can
support it without an unrelated transcode pipeline.
Verify attachment, detach safety, repeated import, and media failure recovery.

## Verification contract

- `php artisan test --filter='AdminProduct|ImportPipeline|Media'`
- `npm run build`
- `git diff --check`
- Route and props smoke for `/admin/products/create`, product media, and import.
- No destructive migration/database command is permitted.
