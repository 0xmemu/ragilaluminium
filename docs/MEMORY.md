# MEMORY — Ragil Aluminium (`website_3.0`)

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

---

## Log

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
- Seluruh route UI admin aktif (form/editor termasuk Product, Import, Variant, Attribute, User, CMS, Testimonial, Banner, WhatsApp) telah parity di React; Blade menjadi arsip/reference.
- Dashboard, resource table/detail, Order/Product workflow, storefront catalog–checkout–status, empty/trust/status state, dan dokumentasi desain disatukan tanpa perubahan schema/route/data contract.

### 2026-07-15 — Relume shell storefront penuh

- Home + Catalog + PDP + Cart + Checkout + Search + Reviews + Order + CMS: **Zalora rail** `max 1200` / gutter `16–24` (no carousel edge-bleed); shell putih + card shadow; hero cinematic + trust strip di bawah; CTA `#bf0000`.
- Footer: Temukan Kami ikon berwarna; hapus blok pembayaran (bukan di desain).
- Header/footer Inertia global tetap SoT shell.


- `resources/` materialisasi lokal (junction ke website_2.0 diputus).
- Stack: Inertia Laravel + React + shadcn; pages Public + Auth + Admin shell/lists.
- SoT delivery → Inertia; visual tetap Home live tokens. Skill: `skills/ui-inertia-public.md`.

### 2026-07-15 — R2 siap untuk VPS

- Docs go-live: `docs/media-storage-r2.md` (bucket, token, custom domain, checklist).
- Smoke: `php artisan media:disk-check` (local atau R2). VPS: `MEDIA_DISK=s3` + env AWS_*.

### 2026-07-15 — Scale-ready media & catalog

- Disk `media`: local (dev) atau R2/S3 (`MEDIA_DISK=s3`); lihat `docs/media-storage-r2.md`.
- `product_media.derivatives` JSON (WebP thumb/card/pdp) dari `DownloadProductMedia` + `media:backfill-derivatives`.
- Katalog/search paginate 24; storefront pakai `urlFor()`; no Shopee hotlink bila `MEDIA_ALLOW_SOURCE_FALLBACK=false`.

### 2026-07-15 — Phase 0 SoT switch (Figma IA + Home style)

- IA/menu/fitur SoT → Figma Web Ragil Aluminium (`ujOeCwCyj69WF4ddmpE6Dv` · Web pembeli).
- Style SoT → Home live (`home-desktop.blade.php` / `overhaul-home`); UI FINALE = legacy.
- Docs: DESIGN, ORCHESTRATION, public-sitemap (implemented/planned), wireframes, handoff, ui-blade-public.
- Planned (hidden nav): Masalah & Solusi, Retur, detail galeri hasil pemasangan.

### 2026-07-15 — Orchestration + skill tracks

- Rewrite `docs/ORCHESTRATION.md`: LOOPKIT-adapted (kontrak → SoT → tracks A–F → verify → report).
- Inventaris skill domain `skills/` + marketplace `.agents/skills/` + Cursor.
- Dipasang ke project: `design-taste-frontend` (overhaul saja), `laravel-testing` lokal (PHPUnit 11).
- Branch `overhaul-home`: Hero Home experimental; undo `git checkout master`.

### 2026-07-15 — Git baseline

- Repo di-init; commit baseline `0532f84` sebelum overhaul Hero.
