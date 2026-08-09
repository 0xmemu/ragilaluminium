# MEMORY — Ragil Aluminium

Cross-session shift log. **Update only on milestones** (section ship, big SoT change, baseline commit).  
Bukan changelog harian. Agent: 1–3 bullets pendek per entri.

---

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
