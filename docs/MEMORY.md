# MEMORY — Ragil Aluminium

Cross-session shift log. **Update only on milestones** (section ship, big SoT change, baseline commit).  
Bukan changelog harian. Agent: 1–3 bullets pendek per entri.

### 2026-08-14 — Media: restore archive + bulk produk media (double-confirm) + GC pending

- Media Library: action restore (visibility -> visible) di bulk-action + filter Visibilitas
  (Aktif/Diarsipkan) di library(); base query hanya mengecualikan archived saat tanpa filter
  visibility (bug: filter archived tak pernah cocok sebelum diperbaiki).
- Halaman media produk (/admin/products/{id}/media): checkbox per row + bulk bar Arsipkan/Hapus
  via POST products/{product}/media/bulk (bulkProductMedia): archive semua; delete hanya row
  status failed (tanpa shared asset) -> file + row dihapus, lainnya di-archive.
  Hapus pakai double-konfirmasi: dialog wajib ketik "HAPUS" (tombol disabled sampai cocok).
- Pulihkan per-item: route POST media/{media}/restore + tombol Pulihkan (ConfirmAction) pada row
  visibility=archived di halaman media produk (terverifikasi: row 444 archived -> visible).
- Command media:prune-pending (opsi --hours, default 24; --dry-run): hapus objek pending/ yang
  tidak pernah difinalisasi + buat AdminNotification tipe media_cleanup dengan rincian
  (jumlah, MB, contoh file) -> jadwal harian 03:00 di routes/console.php.
  Terverifikasi: 2 objek pending -> dihapus, notifikasi muncul di /admin/notifications.

### 2026-08-14 — Media Library: seleksi massal, upload langsung, pencarian produk

- Seleksi multi-asset (checkbox per kartu + pilih semua halaman) + bulk bar Arsipkan/Hapus;
  endpoint POST admin.media.bulk-action: delete hanya aset tak terpakai (file R2 + row dihapus),
  aset yang dipakai produk/banner/galeri otomatis di-archive. Terverifikasi: 184/185 unused -> GONE,
  186 ter-attach -> archived.
- Tombol "Upload media" di library: presign -> PUT R2 (progress) -> finalize tanpa product_id
  (product_id nullable) -> redirect ke library; label auto media_{n}_{date}. Terverifikasi: asset 187
  ready + pdp/card/thumb WebP.
- Panel attach ganti dropdown 200 produk jadi pencarian live (debounce 300ms) via GET
  admin.media.products.search (name/parent_sku LIKE, limit 20). Terverifikasi: ketik "jendela" -> 20
  hasil -> attach ke produk 63 (row 440).

### 2026-08-14 — Admin: tombol hapus banner + Media Library global

- BannerController@destroy + route admin.banners.destroy: hapus banner + cleanup asset media & objek R2
  (asset dipakai entitas lain -> archived, bukan dihapus); tombol Hapus + konfirmasi di Index.tsx (grid & list).
- Halaman /admin/media/library (ProductMediaController@library) + menu sitemap "Media Library":
  browse semua shared asset, filter konteks (hasil-pemasangan/banner/media), pencarian label/source_url
  (LikeSearch ESCAPE), attach lintas produk (bulkAttach) tanpa buka halaman media produk.
- Fix bug: konstanta BS (korupsi escape `\`) di library() menyebabkan 500 saat filter q; diperbaiki ke
  ESCAPE `'\'` — php -l bersih, verifikasi e2e: hapus banner (UI+DB+R2) & attach library (row ProductMedia).

### 2026-08-14 — Kontrak laporan: format kaku → fleksibel & kontekstual

- AGENTS.md: "AGENT REPORT FORMAT — MUST FOLLOW" (SCOPE/ROOT_CAUSE/CHANGE/SPEC_IMPACT/
  TEST_STATUS) diganti format fleksibel & kontekstual: seksi dipilih sesuai jenis pekerjaan
  (Konteks, Akar Masalah, Perubahan, Dampak Spec & Docs, Verifikasi, Keputusan/Trade-off,
  Tindak Lanjut) + panduan per jenis pekerjaan + aturan minimum (apa yang berubah / kenapa /
  bagaimana diverifikasi). Bug → Akar Masalah wajib; perubahan spec → update docs kanonik wajib.
- Sinkron: docs/ORCHESTRATION.md (diagram alur + langkah 10) dan docs/PRODUCT-HANDOFF.md
  (ikuti format AGENTS.md). Snapshot lokal D:/website_5.0/AGENTS.md masih menyebut format lama
  — bukan SoT, sengaja tidak diedit.

### 2026-08-13 — Baileys long-session hardening

- Gateway `/opt/baileys-bot/index.js` diselaraskan dengan pola OpenClaw: frame activity, Baileys keepalive, atomic creds persistence, backup recovery, dan reconnect cooldown.
- Kontrak HTTP/webhook dipertahankan; verifikasi akhir membutuhkan pairing sukses lalu restart service tanpa scan ulang.

---

### 2026-08-09 - Fase 8 QA: rekonsiliasi PHPUnit + regenerasi docs

- PHPUnit HIJAU TOTAL: 258 passed (4050 assertions), 0 failed. 33 baseline fail di-reconcile: kontrak baru (PriceService/ADR-007, kampanye promotions, status active|archived tanpa draft) vs fixture lama; helper `tests/Concerns/CreatesVisibleProducts.php`; config `services.whatsapp.default_provider=meta` (env-independent).
- Fix bug nyata: `Admin/ProductController@index` `$size` undefined -> 500; `HomepagePromotions.php:105` banner tanpa link produk crash `slides()` -> home tanpa promoSlides (accent pakai `?? 0` guard).
- HomepagePopularTest di-rewrite ke kontrak Fase 3: slides = [landingSlide + manual banners], automatic dihapus; ticker kini memuat banner manual (`include_homepage_promos`).
- `database-schema-ragil-aluminium.md` + `api-and-routes-ragil-aluminium.md` diregenerasi 2026-08-09 dari live SQLite + `route:list` (269 routes, 39 tables); versi lama diarsip `.legacy-20260809.md`. Salinan lokal di `D:\website_5.0\_analisa`.
- Playwright E2E di-skip (keputusan user); audit UX storefront pakai headless Chrome + puppeteer-core (4 viewport, 5 halaman) -> laporan `_analisa/audit-ux-20260809/LAPORAN-AUDIT.md`: 0 gambar broken, 0 overflow; temuan data tes live (produk DBG-1, 50 testimonial "Pelanggan Uji"), media r2.dev dormant proxy (MEDIA_PUBLIC_URL kosong; config cache beku 09:18), tap-target minor.
- Uji migrasi: `migrate:fresh` pada salinan DB prod -> 52 migrations DONE, 40 tabel, seed OK, idempotent.
- FIX PROD DOWN: `Class "Redis" not found` -> `apt-get install php8.3-redis` + restart php8.3-fpm (sesi/queue redis).

### 2026-08-08 - SPESIFIKASI-FINAL + Fase 1-6A tuntas (branch feat/admin-ui-redesign)

- SoT = `SPESIFIKASI-FINAL.md` (resolusi 23 keputusan bisnis: PriceService otomatis, kampanye promotions, status produk active|archived tanpa draft, nomor order `RA-{Ymd}-{seq}`, pagination 14, retur `return_completed`).
- Fase 1-6A selesai: migrations promotions/promotion_items/sub_models/order_number_sequences/admin_notifications, wizard produk, CRUD Promo Toko & Flash Sale (FS > Promo, max 1 aktif), performa toko, notifikasi admin.
- Snapshot WIP di-commit `d3efb1c` (797 file, CRLF warnings non-fatal).

### 2026-08-08/09 - WhatsApp (Fase 7) di-pause, diambil alih agent lain

- Prod IP 209.23.10.62 diblokir WhatsApp (`405`) di semua engine (GOWS/noweb, Baileys rc.9, 6.7.5 fork-master). Dev 49.51.136.145 jalan (GOWS -> SCAN_QR_CODE). Container BAILEYS prod di-down; sesi dev STOPPED; `.env` masih `WHATSAPP_PROVIDER=baileys`.
- HMAC webhook benar: header `X-Webhook-Hmac`, default sha512; POST 200 tervalidasi prod & dev->prod hook.

## How to write

```text
### YYYY-MM-DD — judul singkat
- Apa yang berubah (1 baris)
- Keputusan SoT / branch (jika ada)
- Cara undo (jika experimental)
```

### 2026-08-07 — Hero banner card

- Hero promo jadi kartu kompak rounded (referensi Zalora): container padding + rounded-2xl beige, grid [1fr_1.5fr_1fr] — gambar produk kiri, teks tengah, gambar kanan (mirror). Tinggi tetap 150/190/210px; `PROMO_CARD_VARIANTS` dihapus.
- Branch `feat/admin-ui-redesign` (belum commit).

### 2026-08-07 — Font scale & grid tablet

- Mikro-teks publik dinormalkan: konten -> min 12px, badge -> 11px; `FitTwoLineTitle` min 10->11px; clamp hero Home dinaikkan. Audit ulang: 0 teks <11px di 12 halaman @360px.
- Grid produk 768px 4->3 kolom (`md:grid-cols-3`), kartu 170->214px.
- Branch `feat/admin-ui-redesign` (belum commit).

### 2026-08-07 — Home density compression

- Home mobile dikompres: `section-space` 28->20px mobile, Cara Pesan kompak, KamiBantu+ClosingCta digabung jadi satu band gelap dengan 2 CTA (Pilih model produk / Konsultasi ukuran).
- Hasil: Home 4.9 -> 4.0 layar scroll @360x800; nav, bottom nav, 2 section testimoni dipertahankan atas permintaan owner.
- Branch `feat/admin-ui-redesign` (belum commit).

---

## Log

### 2026-08-07 — Mobile UI polish (touch target & layout)

- Audit mobile 13 halaman @360px: 0 overflow, 0 teks terpotong, 0 axe violation.
- 24 titik fix touch target: back button 17 halaman, breadcrumb, header logo+search,
  chip varian, stepper jumlah, sort/filter, tab Reviews, link lihat-semua, dots hero,
  CTA cara-pemesanan stack mobile, judul section wrap.
- Evidence: `storage/app/audit-evidence/2026-08-07/mobile/` (13 PNG + report.json);
  script audit di `scripts/qa-mobile-audit.mjs`.

### 2026-08-07 — Storefront P1 audit browser & alur utama selesai

- E2E 40 PASS / 3 SKIP / 1 flaky (retry PASS, cold-load VPS); verifikasi checkout baru:
  pending state, duplicate-click guard, persistence address_line2/notes ke e2e.sqlite
  (node:sqlite), axe di Checkout & PDP.
- PHPUnit 190 PASS / 3053 assertions; ShippingEstimateFallbackTest (J&T off/API gagal →
  rumus lokal) + persist address_line2/notes ke order di CheckoutFlowTest.
- QA screenshot admin (qa-final 12 + qa-full 39) PASS; evidence di
  `storage/app/audit-evidence/2026-08-07/` + `playwright-report/`.
- Akun dev baru: `qa.admin@example.com` (khusus script screenshot QA; kredensial di
  `scripts/qa-*.mjs`).
- Sisa P1: review 42 warning lint React. P2: branded 404, UI Import/Media/Payments,
  resend template WA.

### 2026-08-06 — Agent architect and production orchestrator contract

- Kontrak tambahan `docs/AGENT-ARCHITECT-ORCHESTRATOR.md` menjadi panduan arsitektur, GAP audit, task 1–3 hari, ADR, CI/CD, dan release gate.
- `AGENTS.md` tetap menjadi SoT keselamatan dan format laporan; `FULL-STACK-PRODUCTION-CHECKLIST.md` tetap menjadi gate produksi.

### 2026-07-28 — DATABASE SAFETY (no wipe without explicit user order)

- Hard rule di `AGENTS.md` + `docs/ORCHESTRATION.md`: dilarang `migrate:fresh` / `db:wipe` / truncate massal ke DB app tanpa instruksi eksplisit.
- Insiden 2026-07-27: wipe MySQL `ragil` saat debug; recovery katalog = re-import `storage/app/imports/catalog/`.

### 2026-07-26 — Shipping provider = J&T Cargo Open Platform

- Biteship ditolak (Express only). SoT shipping tetap Open Platform (`jnt:*`).
- `jnt:status` + `JntReadiness`; admin Settings menampilkan status Open Platform; sender Mandiraja diisi di `.env`.
- Live API masih menunggu `JNT_API_ACCOUNT` / `PRIVATE_KEY` / `CUSTOMER_*` + `JNT_ENABLED=true`.

### 2026-07-22 — Workflow audit P2 admin + docs

- Nav: Pembayaran, Pengiriman, Log Pesan WA, Performa Import.
- Orders filter payment/shipping/tanggal; Resource\* aksi Import/Media/Shipping.
- Handoff: Masalah & Solusi live (bukan planned); audit status diperbarui.

### 2026-07-23 — Admin search + theme

- Header admin: command search menu (`/` / “Cari menu admin”) + dark/light toggle (`ragil-admin-theme`); storefront tetap light-only.

### 2026-07-23 — Admin marketplace & social links

- Pengaturan Website → **Marketplace & Media Sosial** (`admin.storefront-platforms.*`): URL override di `cms_pages.storefront-platforms.content.links`; catalog di `config/sitemap.platforms`; share via `StorefrontPlatformSettings`.

### 2026-07-22 — Storefront home map + platforms/reviews

- Logo toko platform: `config/sitemap.platforms` → Tentang + footer; unit strip di beranda.
- `/reviews`: filter sumber marketplace vs website; home satu strip ulasan saja.
- Peta tunggal: `docs/STOREFRONT-HOME.md` (Figma = referensi).

### 2026-07-22 — P1/P2 workflow audit fixes

- Flash Sale publik: `/flash-sale` (+ `/promo`); **bukan** carousel di beranda. Popular → `#paling-banyak-dipesan`. Periode kampanye di `cms_pages.flash-sale.content.period`.
- Checkout wilayah: alert + retry; cart qty clamp ke stok; kontak: WA chat vs telepon terpisah.

### 2026-07-22 — P0 workflow audit fixes

- Hapus mock TEMP PROMO di katalog; seed 6 flash sale + 6 banner nyata (`ProductCardPromotionSeeder`).
- Konfirmasi order: metode bayar, instruksi rekening, CTA WhatsApp.
- Dashboard chip Pesanan: query `order_status`.

### 2026-07-22 — Workflow audit (customer + admin)

- Hasil simulasi journey: `docs/WORKFLOW-AUDIT.md` (+ canvas `workflow-audit`).
- P0: mock promo katalog, konfirmasi order tipis, deep-link Dashboard `status`≠`order_status`.

### 2026-07-22 — Equal-admin (hapus hierarki peran UI)

- Manajemen Admin: tidak ada picker Super Admin/Staf/Viewer; semua akun = `role=admin`; guard = minimal 1 aktif.
- UI dummy peran dihapus agar selaras Stage 2 + aturan UI fungsional.

### 2026-07-21 — Import & Media di bawah Produk

- Sidebar: hapus grup “Operasional Katalog”; Import + Media pindah ke grup **Produk** bersama Daftar Produk.
- Route/controller Import & Media tetap; hanya IA/nav + shortcut di daftar produk.

### 2026-07-17 — Unified UI Inertia parity

- Public + admin memakai satu sistem hitam–merah: token kanonis `app.css`, rail 1200/16–24, hierarki CTA merah, meta minimum 13px, dan shell Inertia aksesibel; kanvas Home tetap putih.
- Hero Home mengikuti Figma `10332:8645`: kartu promo gelap berputar dari `cms_banners` aktif, otomatis memakai gambar utama/nama produk dari link `/product/{parent_sku}`, lalu panel brand + trust putih.
- Seluruh route UI admin aktif (form/editor termasuk Product, Import, Variant, Attribute, User, CMS, Testimonial, Banner, WhatsApp) telah parity di React; Blade hanya shell/arsip/reference.
- Dashboard, resource table/detail, Order/Product workflow, storefront catalog–checkout–status, empty/trust/status state, dan dokumentasi desain disatukan tanpa perubahan schema/route/data contract.

### 2026-07-15 — Relume shell storefront penuh

- Home + Catalog + PDP + Cart + Checkout + Search + Reviews + Order + CMS: **Zalora rail** `max 1200` / gutter `16–24` (no carousel edge-bleed); shell putih + card shadow; hero cinematic + trust strip di bawah; CTA `#bf0000`.
- Footer: Temukan Kami ikon berwarna; hapus blok pembayaran (bukan di desain).
- Header/footer Inertia global tetap SoT shell.


- `resources/` materialisasi lokal; tidak ada junction ke website_2.0.
- Stack: Laravel 11 + Inertia React + shadcn/Radix; pages Public + Auth + Admin shell/lists.
- SoT delivery → Inertia; visual → `frontend/docs/UI-CONSISTENCY-CONTRACT.md` + Brand Kit + Design System.

### 2026-07-15 — R2 siap untuk VPS

- Docs go-live: `docs/media-storage-r2.md` (bucket, token, custom domain, checklist).
- Smoke: `php artisan media:disk-check` (local atau R2). VPS: `MEDIA_DISK=s3` + env AWS_*.

### 2026-07-15 — Scale-ready media & catalog

- Disk `media`: local (dev) atau R2/S3 (`MEDIA_DISK=s3`); lihat `docs/media-storage-r2.md`.
- `product_media.derivatives` JSON (WebP thumb/card/pdp) dari `DownloadProductMedia` + `media:backfill-derivatives`.
- Katalog/search paginate 24; storefront pakai `urlFor()`; no Shopee hotlink bila `MEDIA_ALLOW_SOURCE_FALLBACK=false`.

### 2026-07-15 — Phase 0 SoT switch (Figma IA + Home style)

- IA/menu/fitur SoT → `docs/PRODUCT-HANDOFF.md`, `docs/sitemap/*`, dan route/config aktif.
- Style SoT → `frontend/docs/UI-CONSISTENCY-CONTRACT.md`, Brand Kit, Design System; UI runtime = `resources/js`.
- Legacy Figma/Blade visual references dipindah ke arsip; tidak menjadi sumber implementasi.
- Planned (hidden nav): Masalah & Solusi, Retur, detail galeri hasil pemasangan.

### 2026-07-15 — Orchestration + skill tracks

- Rewrite `docs/ORCHESTRATION.md`: LOOPKIT-adapted (kontrak → SoT → tracks A–F → verify → report).
- Inventaris skill domain `skills/` + marketplace `.agents/skills/` + Cursor.
- Dipasang ke project: `design-taste-frontend` (overhaul saja), `laravel-testing` lokal (PHPUnit 11).
- Branch `overhaul-home`: Hero Home experimental; undo `git checkout master`.

### 2026-07-15 — Git baseline

- Repo di-init; commit baseline `0532f84` sebelum overhaul Hero.

### 2026-08-06 — UI/docs consistency audit

- Kontrak visual aktif ditetapkan di `frontend/docs/UI-CONSISTENCY-CONTRACT.md`; container desktop dinormalkan dari padding 15rem ke 3rem.
- Kontrak role/status ditetapkan di `docs/contracts/ROLE-AND-STATUS-CONTRACT.md`: role runtime `admin`, status payment `pending`, shipping `pending_pickup`.
- Audit backend lama dipisahkan dari audit runtime saat ini; lint React dan E2E menjadi gate wajib empat viewport.

### 2026-08-06 — Sinkronisasi dokumentasi runtime

- Schema/API dan logic docs disinkronkan dengan migration serta route aktif; dokumen API duplikat lama ditandai historical/non-canonical.
- Status terkini galeri Hasil Pemasangan dicatat: detail `/hasil-pemasangan/{parent_sku}` sudah implemented; retur publik tetap planned.

### 2026-08-06 — E2E storefront checkout dan browser matrix

- Playwright terisolasi SQLite lulus 33 test dengan 3 skip pada matrix desktop, 768 px, 1024 px, dan compact; alur checkout guest sampai order status tervalidasi.
- Kontras badge diskon, status danger admin, dan link Flash Sale diperbaiki; `npm run build` lulus. Kontrak schema, route, dan API tidak berubah.

### 2026-08-07 — Shared media library, video, dan bulk attach

- `media_assets` menjadi pemilik satu physical asset immutable; `product_media`
  menjadi attachment product/variant. Resolver dedupe berdasarkan normalized URL
  lalu checksum SHA-256, dengan object key `media-assets/{sha256}/...`.
- Admin Media dan `Admin/Products/Media` memiliki selector library dengan search,
  filter jenis/status, usage count, preview video, dan aksi `Pasang tanpa upload
  ulang`. Global Media menyediakan bulk attach satu asset ke maksimal 100 produk
  secara idempotent melalui `admin.media.attach`.
- Video upload/source URL tervalidasi MIME/ukuran, disimpan satu object MP4/WebM/MOV
  tanpa transcode; image tetap WebP thumb/card/pdp. `media:backfill-assets`
  menghubungkan legacy rows secara aman tanpa menghapus row/object.
- Kontrak schema/API/arsitektur/stage-9b/R2 diperbarui; Nginx media proxy tidak
  lagi memakai host hardcoded dan hanya aktif bila `MEDIA_R2_HOST` tersedia.
- Evidence: focused media/admin/import tests lulus; full suite 199 tests,
  3092 assertions dengan satu regresi dashboard lama diperbaiki (attention
  pending-payment tetap muncul); `npm run build` lulus.

### 2026-08-07 — Media migration dan legacy backfill selesai

- Pada database lokal SQLite `ragil_aluminium`, migrasi `media_assets` dan
  `product_media.media_asset_id` dijalankan forward-only. Baseline sebelum
  migrasi: 50 products, 329 product_media.
- `media:backfill-assets --dry-run` lalu backfill menghubungkan 329 attachment ke
  169 asset unik tanpa menghapus row/file. Repair legacy memprioritaskan
  `stored_path`/derivatives agar semua 329 URL lama tetap valid; hasil akhir:
  169 ready, 0 pending/failed, 0 missing card URL.
- Queue lokal dipindah dari `sync` ke Redis; worker smoke `imports,media,default`
  berhasil dengan 0 queued/failed jobs. R2 belum diaktifkan karena environment
  belum menyediakan bucket/public URL yang dapat diverifikasi read-only.

### 2026-08-07 — R2 `ra-media` diaktifkan pada preview

- Preview systemd memakai secret eksternal `/root/.config/ragilaluminium/cloudflare.env`,
  bucket `ra-media`, endpoint account R2, dan public delivery `r2.dev`; source URL
  fallback dimatikan.
- Smoke PUT/GET via S3 API, GET melalui public URL, dan DELETE lulus; preview HTTP
  200. `media:disk-check` kini membaca konfigurasi disk efektif sehingga fallback
  `CLOUDFLARE_R2_*` tidak false-negative.

### 2026-08-07 — Kontrak env VPS production dan Cloudflare Tunnel

- Agent production wajib meminta packet env melalui kanal secret terproteksi;
  R2 bucket credential, Tunnel token, dan Cloudflare provisioning API token
  dipisahkan. Global Cloudflare API token tidak boleh masuk Laravel runtime.
- Cloudflare Tunnel diterima untuk preview/staging dengan origin loopback;
  production memerlukan connector, WAF, webhook, monitoring, dan recovery
  evidence sebelum dipilih sebagai ingress customer-facing.
- Detail ada di `docs/production-vps-env-contract.md` dan ADR-003.

### 2026-08-07 — Full-stack production readiness plan

- Target production dipetakan sebagai MySQL + Redis + R2 + Nginx/PHP-FPM +
  supervised queue + Cloudflare ingress + provider controls + observability.
- Readiness plan menegaskan kondisi saat ini masih `BLOCKED` sampai backup/restore,
  worker, monitoring, security, provider, dan external smoke evidence lengkap.
- Human deployment runbook disediakan; AI bersifat opsional dan tidak menjadi
  dependency runtime.

### 2026-08-07 — Profil target initial production

- Owner menetapkan domain `ragilaluminium.com` dan VPS 4 vCPU / 4 GB RAM /
  60 GB disk.
- Profil ini cukup untuk first release bertrafik rendah sebagai single VPS,
  dengan R2 untuk media, backup eksternal, swap/resource limits, dan tanpa HA.
  Readiness plan mencatat trigger upgrade serta batas kapasitasnya.

### 2026-08-08 — Transaction integrity P0

- Checkout memakai UUID session + unique orders.checkout_idempotency_key; retry
  mengembalikan order yang sama tanpa decrement stok/payment kedua.
- Payment wajib positif dan order hanya paid setelah total completed settlement
  mencukupi; failed/refunded direkonsiliasi. Cancellation mengunci order dan
  mengembalikan stok varian tepat sekali.
- Import queue memakai unique dispatch + overlap lock; database/Redis
  retry_after=1860 di atas timeout 1.800 detik. J&T logs memakai allowlist
  dengan identifier ter-hash dan production boot menolak signing key kosong.
- ADR: docs/decisions/ADR-004-database-backed-transaction-integrity.md.

### 2026-08-11 - R2 aktif + PITR + session 5 hari + scheduler cron
- R2 media AKTIF di VPS 209.23.10.62: MEDIA_DISK=s3, bucket `ra-media` (public pub-1fc7....r2.dev), semua 234 product_media + 702 object tampil via R2 (200). Nginx /media-cdn proxy fixed (`proxy_ssl_server_name on`).
- Custom domain `media.333labs.tech` + CORS + DNS: TERTUNDA — butuh token CF permission Edit (token saat ini read-only). AWS_URL masih r2.dev.
- Session cart 5 hari: SESSION_LIFETIME=7200 + SESSION_DRIVER=database (tabel sessions) — tahan Redis restart.
- Cron Laravel terpasang: `* * * * * schedule:run` → queue:monitor + queue:prune-failed aktif.
- PITR: binlog sudah ON (ROW); script baru `/root/scripts_backup_mysql_binlog.sh` + `/root/scripts_r2_upload_binlog.py` arsip binlog ke ra-backup/binlogs/ tiap jam; RELOAD privilege ditambahkan ke user ragil.
- .env backup: .env.bak-r2-20260811-094452

### 2026-08-11 - Custom domain media.333labs.tech LIVE + backup hardening
- AWS_URL=https://media.333labs.tech (custom domain R2, SSL+DNS aktif, curl 200); nginx /media-cdn proxy ikut dialihkan; `.env.pre-customdomain-20260811` + nginx `ragil.pre-customdomain`.
- CORS R2: API Cloudflare menolak semua body (10040) — TIDAK dibutuhkan (upload server-side, baca via img). Bukan release gate.
- Backup DIHARDEN: enkripsi AES-256-CBC (keyfile /root/.config/ragilaluminium/backup-key, root 600) untuk dump harian + binlog hourly; kredensial CF/R2-backup DIHAPUS dari .env app (hanya AWS_* ra-media) → app tak bisa hapus arsip; lifecycle R2 ra-backup 30 hari (mysql/ + binlogs/) dipasang (PUT 200); restore drill mingguan (Sen 04:30, DB ragil_restore_test, rowcount vs prod — PASS 50/612/234/1); alert file (`/root/backups/ALERT-*`). .env.pre-hardened-20260811.

### 2026-08-11 - Backup tanpa enkripsi (keputusan user)
- Enkripsi backup DIHAPUS atas permintaan user (keyfile `/root/.config/ragilaluminium/backup-key` dihapus; tidak diperlukan). Pipeline kembali plaintext: dump harian .sql.gz + binlog .log → R2 ra-backup (lifecycle 30 hari). Semua artefak `.enc` (lokal 0 + R2 8 objek) dibersihkan. Restore drill tetap PASS (14:42:16, 50/612/234/1). Script: scripts_backup_mysql.sh, scripts_r2_upload_backup.py, scripts_r2_upload_binlog.py, scripts_restore_backup.sh, scripts_weekly_restore_test.sh.

### 2026-08-11 - Review design_thinking.md -> F1-F4 (E-channel lengkap)
- F1: Upload R2 gagal kini = alert file `/root/backups/ALERT-r2-upload` (backup harian & binlog; flush-logs gagal juga ber-alert).
- F2: `scripts_r2_upload_backup.py` / `scripts_r2_upload_binlog.py` exit 1 saat upload final gagal; loop binlog menangkap status per file (GAGAL=1 → notify + exit 1). Exit code diverifikasi (uji negatif kredensial hilang → exit 1).
- F3: retry 3x dengan backoff (2s/4s) untuk error 5xx/network; 4xx (auth) tidak di-retry.
- F4: stale-check binlog: `binlog-last-run` ditulis tiap run; drill mingguan membunyikan alert jika arsip tidak berjalan >27 jam.
- Catatan 2026-08-11: alert Telegram pernah ditambahkan di luar docs dan TELAH DIHAPUS (user request) — alert = file `/root/backups/ALERT-*` + log saja.

### 2026-08-11 - Catatan sesi refactor dashboard (AGENT review design_thinking)
- Refactor dashboard (DashboardQueryService + controller thin + types TS) sempat diimplementasikan lalu DI-ROLLBACK penuh karena menyimpang dari kontrak `tests/Feature/AdminDashboardTest.php` (diubah agent lain 15:24, belum commit): quickActions 3 item inline, statusOrder 5 item (bukan 9), performa pakai `StorePerformanceService::build()` period today/yesterday/last_7/last_30/this_month (BUKAN 7d/30d/90d + forPeriod/trend), attention href pakai `older_than=24h/2d/7d`, topEngaged `ProductEngagementService::topProducts($period, 8)`.
- File asli DashboardController.php (23614 B, git clean) sudah memakai pola modern tsb; refactor saya menyalin payload versi lama karena output `sed` via ssh terlihat terkorupsi (duplikasi baris) — pelajaran: verifikasi isi file dengan dua sumber (scp + baca) sebelum deploy.
- Final: baseline asli dikembalikan, PHPUnit **277 tests / 4141 assertions OK** (termasuk AdminDashboardTest baru agent lain). File buatan refactor dihapus (DashboardQueryService.php, admin-dashboard.ts); Dashboard.tsx tetap versi asli. Refactor dashboard bisa diulang dengan test tsb sebagai kontrak wajib.
- 2026-08-11 quirk terverifikasi (SQLite test): `PerformanceMetric.metric_date` cast `date` → tersimpan `Y-m-d 00:00:00`; `StorePerformanceService::visitorsBetween()` (dan series visitors) memakai `whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])` → row cast tidak ter-match (visitors 0 di SQLite). Uji empiris :memory: : row Eloquent-cast (nilai 5) tak terhitung, hanya row raw `Y-m-d` (nilai 9) yang match (sum 9). Produksi MySQL aman (kolom date men-trim). Kontrak test sudah memakai `DB::table()->insert()` dengan plain date (StorePerformanceContractTest:166). Dicatat di AGENTS.md gotchas.

### 2026-08-14 - Admin workflow: akun tes + admin-preview tool + verifikasi dashboard
- **Akun tes admin baru (id=12):** `dev.agent@ragilaluminium.test` / password `OiDrA_7nbIXjgX2K`
  (role=admin, status=active). Dipakai untuk semua verifikasi UI admin. QA admin
  (`qa.admin@example.com`) TIDAK disentuh lagi (password-nya sudah dikembalikan ke hash
  asli dari backup `ragil_aluminium-20260813-031701.sql.gz` setelah terlanjur diubah saat
  debugging banner).
- **Tool baru:** `scripts/admin-preview.cjs` (repo VPS, jalankan lokal): login otomatis
  akun tes + render halaman admin + dump DOM/console errors + screenshot, Node >= 22
  tanpa dependensi (WebSocket global + CDP). Contoh:
  `node scripts/admin-preview.cjs --url=/admin --find="Kelola banner" --mode=dump`
  Opsi: `--mode=dump|shot|both`, `--out=x.png`, `--wait=ms`, `--eval=<expr>`, `--find=a,b`.
  Tahan MSYS path-mangling (Git Bash) dan salah-tab CDP.
- **Dashboard admin = `/admin`** (BUKAN `/admin/dashboard` — URL itu bukan route; sejak
  2026-08-14 dirender sebagai 404 ber-brand `Admin/Error` via catch-all `admin/{any}` +
  fallback publik (tanpa crash React), tapi tetap jangan dipakai untuk verifikasi dashboard).
- **Verifikasi live 2026-08-14:** `/admin` render OK, "Kelola banner" ADA di section
  "Promo & flash sale aktif" (link ke `/admin/banners`); `/admin/banners`,
  `/admin/products`, `/admin/promotions` semua render OK (0 console error). Sidebar admin
  juga punya menu "Promo Toko" dan "Bar Promo".
- **Kondisi environment:** working tree dipakai agent lain (public homepage edits +
  rebuild 05:46/06:19/06:3x — asset hashed berubah tiap build); `routes/web.php` diubah
  agent lain (tambah routes documents). Selalu `git status` + verifikasi live.

### 2026-08-14 - Standar gambar banner promo (rasio dinamis, tanpa crop)
- **Standar baru (FINAL, setelah iterasi):** rasio layout banner PATEN `1024/426`
  (±2.4:1) via `aspect-[1024/426]` di `HomeHero` — tinggi otomatis = lebar ÷ rasio,
  proporsional di semua viewport. Gambar `object-cover`; admin menyiapkan canvas 2,4:1
  (2048×852 px) agar tidak ter-crop. (Pendekatan rasio-mengikuti-gambar via onImageLoad
  sempat dipakai lalu dihapus karena tinggi jadi tidak menentu: mobile 120px vs desktop 406px.)
- Fallback sebelum gambar termuat / saat semua slide placeholder = `1024/426` (±2.4:1),
  konsisten dengan canvas rekomendasi 2048×852 px di `frontend/docs/DESIGN-SYSTEM.md`.
- Hint form `/admin/banners` (Form.tsx) diperbarui: admin cukup upload 1 gambar (rasio
  ~2,4:1 disarankan); tidak perlu versi mobile terpisah, tinggi menyesuaikan otomatis.
- Verifikasi live: banner contoh (rasio 2.92:1) → mobile 350×120 / sm 600×206 / desktop
  1184×406, `imgFitsExactly=true` semua viewport, 0 error; fallback tanpa gambar = 2.40:1.
- Ukuran fixed px lama (134/132/148 → 176/200) dihapus karena menyebabkan crop
  (`object-cover` memotong gambar dengan rasio beda). Belum di-commit (WIP agent lain).


### 2026-08-14 — Direct upload produk media: browser → R2 (presigned) + WebP async

- **Masalah:** upload gambar produk selalu lewat VPS (temp → proses WebP → R2),
  lambat untuk file besar dan membebani server; request sinkron menunggu proses.
- **Solusi:** alur upload langsung `browser → R2` untuk media produk:
  - `MediaUploadController@presign` — validasi mime/ukuran → presigned PUT URL ke
    `pending/{uuid}.{ext}` (15 menit).
  - Browser PUT langsung ke R2 (progress via XHR) — bucket CORS dikonfigurasi
    (`AllowedOrigins: https://ra.333labs.tech`, `AllowedMethods: GET/PUT/HEAD`,
    `AllowedHeaders: Content-Type`) via S3 API.
  - `MediaUploadController@finalize` — verifikasi objek, buat `MediaAsset` +
    attach `ProductMedia`, dispatch `ProcessUploadedMediaAsset` (queue `media`).
  - `ProcessUploadedMediaAsset` — WebP derivatif thumb/card/pdp async, pindah
    objek `pending/` → `media-assets/{sha256}/`, status `ready`; dedup checksum
    tetap berlaku.
  - Frontend `Admin/Products/Media.tsx`: pilih file → presign → PUT + progress
    bar → finalize via Inertia. Alur lama (URL sumber / library attach) tetap ada.
- **Verifikasi:** typecheck/build PASS; e2e Playwright login admin → upload
  `b1.png` ke produk 51 → presign + PUT R2 + finalize + flash sukses + asset
  `ready` dengan pdp.webp; artefak uji dihapus (produk 51 kembali ke 1 media).
- **Catatan:** perubahan belum di-commit (working tree berisi WIP agent lain).


### 2026-08-14 — Banner promo ikut alur media produk: presigned upload + WebP derivatif

- **Tujuan:** banner promo diperlakukan sama seperti gambar produk — upload
  langsung browser → R2 (presigned PUT) + derivatif WebP async, sehingga landing
  page lebih cepat (banner pdp.webp maks 1400px vs PNG upload 1 MB+).
- **Perubahan:**
  - Migration: `cms_banners.media_asset_id` (FK nullable → media_assets).
  - `BannerController` (store/update): terima `object_key` hasil presign →
    buat `MediaAsset` (pending) + dispatch `ProcessUploadedMediaAsset` →
    `image_url` = URL object pending (fallback sementara) + `media_asset_id`;
    saat ganti gambar, asset lama di-archive. Alur legacy (file langsung / link
    produk) tetap ada. Form admin dapat prop `presignUrl`.
  - `ProcessUploadedMediaAsset`: setelah selesai, update `cms_banners.image_url`
    ke derivatif pdp WebP; saat dedup, arahkan banner ke asset canonical.
  - `HomepagePromotions::manualSlides()`: image di-resolve dari
    `banner->mediaAsset` (pdp/card/thumb) dulu — asset banner upload menang atas
    foto produk; fallback lama tetap untuk banner legacy (tanpa asset).
  - `Admin/Banners/Form.tsx`: presign → PUT R2 dengan progress bar → submit
    `object_key`; tombol menampilkan % upload.
- **Verifikasi (e2e Playwright + DB):** create banner via UI → presign + PUT R2 +
  redirect + flash; edit ganti gambar → asset baru ready + asset lama archived +
  `image_url` jadi `media-assets/{sha}/pdp.webp`; landing payload menyajikan
  derivatif WebP; b2.png 1,65 MB → pdp.webp 56 KB (~97% lebih ringan). Artefak
  uji dihapus. Worker queue di-restart untuk memuat kode job baru.
- **Catatan:** belum di-commit (working tree berisi WIP agent lain).


### 2026-08-14 — Auto-renaming media: pola {context}_{nomor}_{tanggal}

- **Tujuan:** semua file media yang di-upload diberi nama otomatis
  `{context}_{nomor}_{tanggal}.{ext}` (mis. `banner_1_20260814.png`,
  `logo_2_20260814.png`) — bukan nama asli acak / uuid — agar mudah dikenali di
  penyimpanan.
- **Helper baru `app/Support/MediaNamer.php`:**
  - `asset()` — alur presigned (MediaAsset): nomor monotonik dari label asset
    sejenis di DB (tidak reset saat pending dibersihkan).
  - `onDisk()` — file langsung di disk R2/local: nomor dari file sejenis di
    folder tujuan; `local()` — direktori lokal via glob().
- **Penerapan:**
  - `MediaUploadController` (presign): context opsional (`banner`/`media`) →
    object pending `pending/{context}_{n}_{date}.{ext}`; finalize set `label`
    dari nama key. Frontend Media.tsx & Form banner mengirim context.
  - `BannerController`: label asset banner; legacy upload → `banners/banner_{n}_{date}.*`.
  - `TestimonialController` → `testimonials/testimonial_{n}_{date}.*`;
    `ProblemsSolutionsSettings` → `masalah-solusi/masalah-solusi_{n}_{date}.*`.
  - `PageController` (branding): logo → `images/logo_{n}_{date}.png` dan
    favicon → `images/favicon_{n}_{date}.ico` (salinan versi; `site-logo.png` /
    `site-favicon.ico` tetap sebagai file aktif yang direferensikan app).
- **Verifikasi:** tinker — semua varian menghasilkan nama sesuai pola;
  e2e Playwright — PUT ke R2 bernama `banner_1_20260814.png`, asset label
  `banner_1_20260814`; build/typecheck/lint PASS. Artefak uji dihapus.
- **Catatan:** nomor unik per konteks; file checksum-based
  (`media-assets/{sha}`) tetap dipakai sebagai penyimpanan internal (dedup).


### 2026-08-14 — Renaming diperluas: hasil pemasangan (produk & gallery) + file import

- **Tujuan:** pola {context}_{nomor}_{tanggal} juga berlaku untuk media galeri
  hasil pemasangan dan lampiran file import; nama hasil pemasangan menyesuaikan
  otomatis berdasarkan produk/entitas yang ditambah.
- **Perubahan:**
  - `Admin/Products/Media.tsx`: saat checkbox "Hasil pemasangan" aktif, context
    upload = `hasil-pemasangan-{parent_sku}` (mis. `hasil-pemasangan-sp58155312043_1_20260814`),
    selain itu `media`.
  - Gallery item (`cms_gallery_items`): migration `media_asset_id` (FK nullable);
    `GalleryItemController` terima `object_key` → buat MediaAsset + dispatch job +
    arsip asset lama saat ganti gambar; `GalleryForm.tsx` dapat upload langsung
    (presign + PUT + progress) dengan context dari **label item** (fallback
    `hasil-pemasangan`); job `ProcessUploadedMediaAsset` kini update
    `cms_gallery_items.image_url` ke derivatif WebP (sukses & dedup).
  - `ImportJobController`: file lampiran import disimpan sebagai
    `catalog/import_{n}_{date}.{ext}` (disk imports) via MediaNamer::onDisk.
- **Verifikasi:** e2e Playwright — gallery item "Pemasangan Verifikasi" → PUT R2
  `pemasangan-verifikasi_1_20260814.png`, asset ready, `image_url` auto-jadi
  `media-assets/{sha}/pdp.webp` (worker di-restart agar memuat kode job baru);
  import rename tinker → `import_1_20260814.xlsx`; build/typecheck/lint PASS.
  Artefak uji dihapus.
- **Catatan:** belum di-commit (working tree berisi WIP agent lain).


### 2026-08-14 — Filter/pencarian label di Media Library (panel produk)

- **Tujuan:** asset bernama `hasil-pemasangan-*` (dan konteks lain) mudah
  ditemukan di panel "Media Library bersama" (`Admin/Products/Media`).
- **Perubahan (`Admin/Products/Media.tsx`):**
  - Chip preset konteks: Semua / Hasil pemasangan (`hasil-pemasangan`) /
    Banner (`banner`) / Media (`media`) — klik langsung filter (router.get q=…).
  - Pencarian label/URL live dengan debounce 350ms (tanpa harus klik Cari);
    dropdown jenis & status langsung terapkan saat berubah.
  - Refactor `runSearch()` (useCallback) dengan override q/kind/status agar
    chip/select memakai nilai baru tanpa menunggu state.
- **Verifikasi:** e2e Playwright — chip tampil, klik "Hasil pemasangan" →
  URL `q=hasil-pemasangan` dan asset berlabel hasil-pemasangan-* muncul di
  library; ketik di input → debounce menerapkan q; 0 error console.
  typecheck/eslint/build PASS. Asset uji dibersihkan.

## Milestone: Live status upload + notifikasi browser (2026-08-14)
- **Endpoint** `GET admin.media.status` (`ProductMediaController@status`, route `media.status`) —
  polling batch status ProductMedia (kind=product) / MediaAsset (kind=asset), validasi ids max 100,
  balikan status + error_reason + thumb_url (via `urlFor('thumb')`).
- **Media produk** (`Admin/Products/Media.tsx`) & **Media Library** (`Admin/Media/Library.tsx`):
  polling otomatis tiap 3 dtk hanya saat ada row/asset berstatus pending; badge
  `pending → ready` (atau `failed` + reason) berubah otomatis tanpa reload; thumb
  di-update dari respon poll; toast muncul saat ada yang selesai + notifikasi browser
  (judul "Media siap", body "N media siap digunakan").
- **Catatan e2e:** file PNG uji identik memicu dedup (asset baru langsung archived) —
  gunakan file unik per run; 404 chunk saat build menimpa file = transien (Cloudflare cache).
- **Verifikasi:** badge Menunggu→Ready auto tanpa reload (URL tetap), 3 poll sukses, notice
  muncul, 0 error console; `urlFor('thumb')` valid utk asset ready. Asset uji dibersihkan.

## Milestone: Suara notifikasi + badge counter media siap (2026-08-14)
- **`resources/js/lib/media-live.ts`** (baru, shared): `playReadySound()` — chime dua nada
  A5→D6 via Web Audio API (tanpa file aset, try/catch utk autoplay block); counter
  "media siap" di sessionStorage (`ragil.media.readyCount`) + event bus
  `ragil:media-ready` (CustomEvent) + `getReadyCount/addReadyCount/clearReadyCount/onReadyCountChange`.
- **Media.tsx & Library.tsx** — saat polling deteksi newlyReady: selain toast + Notification,
  kini memanggil `playReadySound()` + `addReadyCount(n)`.
- **AdminNavigation.tsx** — badge counter bulat (primary, "99+" cap) di item sidebar
  "Media Library" (`admin.media.library`); subscribe event bus; auto-clear (`clearReadyCount`)
  saat item diklik.
- **Verifikasi:** e2e Playwright — upload via UI library → sessionStorage count 0→1, badge "1"
  muncul di sidebar, klik Media Library → count 0 & badge hilang; AudioContext state "running"
  tanpa error; 0 error console di load library. Asset uji dibersihkan.

## Milestone: Halaman riwayat pemrosesan media (2026-08-14)
- **Tabel `media_processing_logs`** (migration 2026_08_14_000500) — log transisi status
  polimorfik (loggable = MediaAsset | ProductMedia), kolom entity_label (denormalisasi),
  event (queued|processing|success|failed|dedup|downloaded), message, created_at;
  index (loggable_type,loggable_id), event, created_at.
- **Model `MediaProcessingLog`** + `MediaProcessingLog::record($loggable, $event, $message)`.
- **Tracer di job**: ProcessUploadedMediaAsset (processing/success/failed/dedup),
  DownloadMediaAsset & DownloadProductMedia (processing/success/failed/dedup),
  MediaUploadController@finalize (queued).
- **Halaman `Admin/Media/History`** — `/admin/media/history` (route `admin.media.history`,
  menu sitemap "Riwayat Media" di grup Produk): tabel log (waktu, label media + tipe/id,
  badge status, pesan detail), chip filter status (Semua/Gagal/Siap/Diproses/Antre/Duplikat),
  pencarian label/pesan, filter rentang tanggal, pagination 30/halaman.
- **Verifikasi:** e2e — upload nyata via UI library → log queued→processing→success tercatat;
  seed failed+dedup tampil di tabel; klik chip Gagal → URL `?event=failed` dan hanya log
  failed yang tampil; menu sidebar tampil; 0 error console (404 = transien saat build).
  Data uji dibersihkan. Worker queue di-restart untuk memuat job versi baru.

## Milestone: Tombol retry di Riwayat Media (2026-08-14)
- **`ProductMediaController@retryLog(MediaProcessingLog $log)`** + route `POST media/logs/{log}/retry`
  (`admin.media.logs.retry`) — retry dari baris log gagal: set status pending + error_reason null,
  catat log `queued` baru, lalu dispatch job sesuai entitas:
  MediaAsset dengan source_url → `DownloadMediaAsset`; MediaAsset dengan object_key →
  `ProcessUploadedMediaAsset`; ProductMedia → `DownloadMediaAsset` (jika punya media_asset_id) /
  `DownloadProductMedia`.
- **History.tsx** — kolom Aksi (desktop) + tombol di card (mobile): tombol **"Coba lagi"** (ikon refresh)
  hanya muncul di baris `event=failed` (prop `retry_url` diisi backend); klik → router.post preserveScroll.
- **Verifikasi:** e2e — baris failed `retry_test_asset` tampil, tombol Coba lagi ada (2 baris failed),
  klik → flash "Pemrosesan media dijadwalkan ulang", URL tetap; DB: log baru `queued` + `processing`
  tercatat (job nyata jalan; asset kembali failed karena object_key uji palsu — loop lengkap terverifikasi).

## Milestone: Notifikasi admin otomatis saat media gagal (2026-08-14)
- **Migration** `2026_08_14_000600` — kolom `related_type`/`related_id` di `admin_notifications`
  (index gabungan) agar notifikasi bisa dikaitkan ke entitas media.
- **`App\Support\MediaFailureNotifier::notify($loggable, $reason)`** — buat notifikasi tipe
  `media_failed` (title "Media gagal diproses", body "label: alasan", href → riwayat media
  filter failed). **Dedupe**: jika sudah ada notifikasi media_failed BELUM dibaca utk entitas
  yang sama → update body lama, tidak menumpuk (retry tidak spam).
- **Hook di semua titik gagal**: ProcessUploadedMediaAsset (4 titik: file tak ditemukan, ukuran,
  mime, catch), DownloadMediaAsset (failAsset), DownloadProductMedia (fail()).
- **notification-bell.tsx** — ikon `warning` (merah/destructive) untuk `media_failed`;
  `media_cleanup` diwarnai amber.
- **Verifikasi:** e2e — dispatch job gagal nyata (object_key palsu) → asset `failed` +
  notifikasi `media_failed` tercipta otomatis (body berisi label + alasan, href riwayat);
  dispatch ulang → count tetap 1 (dedupe); badge unread "1" di bell + dropdown menampilkan
  notifikasi lengkap; 0 error console. Data uji dibersihkan.

## Milestone: Live polling di halaman Riwayat Media (2026-08-14)
- **History.tsx** — polling tiap 3 dtk saat ada baris `queued`/`processing`: endpoint
  `admin.media.status` dipanggil per kind (asset/product) dengan **id dedupe** (baris queued
  + processing utk entitas sama → 1 id; tanpa dedupe → 422 `distinct`).
  Update via **overrides per log id** (state `liveOverrides`, hanya di-set dari callback async —
  bebas warning `set-state-in-effect`): hanya baris non-terminal **terbaru per entitas** yang
  diubah (ready/downloaded → `success` "Derivatif WebP siap…", failed → `failed` + error_reason
  + retry_url); baris historis ("Antre" lama) tetap.
- **UI**: indikator **"Live"** (dot hijau ping + label) di kanan filter bar saat ada baris
  non-terminal; polling berhenti otomatis saat semua terminal.
- **Verifikasi:** e2e — buka riwayat asset dengan baris Diproses → **berubah jadi Siap tanpa
  reload** (URL tetap), indikator Live tampil, 0 error 422; build/tsc/eslint PASS.

## Milestone: Hapus & auto-prune log riwayat media (2026-08-14)
- **`ProductMediaController@destroyLog`** + route `DELETE media/logs/{log}`
  (`admin.media.logs.destroy`) — hapus permanen satu baris log; `delete_url` di-prop per baris.
- **`ProductMediaController@pruneLogs`** + route `POST media/logs/prune`
  (`admin.media.logs.prune`) — hapus log lebih tua dari N hari (validasi 1–365,
  default `config('media.log_retention_days', 30)`); flash jumlah terhapus.
- **`App\Console\Commands\PruneMediaLogs`** (`media:prune-logs {--days=30} {--dry-run}`) —
  auto-prune harian 03:30 (routes/console.php, tanpa overlapping).
- **config/media.php** — `log_retention_days` (env MEDIA_LOG_RETENTION_DAYS, default 30).
- **History.tsx** — tombol hapus per baris (ikon trash, ConfirmAction) di kolom Aksi
  desktop & card mobile; tombol **"Bersihkan log lama (N)"** di toolbar (hanya muncul
  jika ada log > retention) → ConfirmAction → prune.
- **Verifikasi:** e2e — tombol Bersihkan log lama (1) tampil, hapus per baris (dialog
  konfirmasi + flash sukses), prune via UI (flash) → DB 0 log; dry-run command benar
  (1 log 40 hari terdeteksi); schedule 03:30 tampil di schedule:list; build/tsc/eslint PASS.

### 2026-08-15 — Banner Promo: menu sidebar sendiri + label jelas
- Sidebar admin: item baru "Banner Promo" (grup Harga & Promo) -> admin.banners.index;
  'admin.banners.*' dipisah dari active Promo Toko.
- Label banner diubah: "Tambah Promo" -> "Tambah Banner", judul "Banner Promo"
  (Index.tsx/Form.tsx/BannerController@index).
- Peta akses banner: sidebar Banner Promo | dashboard "Kelola banner" (bawah) |
  Beranda Pembeli -> Banner Utama -> Edit konten (HomepageLayoutSettings:100).
- GOTCHA: live build bisa tertinggal dari working tree (Beranda/Index.tsx diedit
  setelah build) — verifikasi UI selalu via admin-preview/curl, bukan grep source.
