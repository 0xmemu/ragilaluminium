# AGENTS.md — Ragil Aluminium

Laravel 11 + Inertia React (TypeScript) modular monolith: public storefront + admin panel.
Runtime: `resources/js/app.tsx` (Inertia), routes in `routes/web.php` (285 routes), thin
controllers → `app/Services/*` → Eloquent. Prod DB MySQL (`DB_DATABASE=ragil`), Redis
queue/cache/session, media Cloudflare R2 (`MEDIA_DISK`), WhatsApp Meta/BAILEYS, J&T Cargo.

**Read first:** `docs/ORCHESTRATION.md` (source-of-truth hierarchy + skill tracks) →
`docs/AGENT-ARCHITECT-ORCHESTRATOR.md` (architect/orchestrator contract, ADR-001) →
`docs/PRODUCT-HANDOFF.md` (product behavior). Session context: `docs/MEMORY.md`.

## Non-negotiables

- **DATABASE SAFETY (hard rule):** never `migrate:fresh` / `migrate:refresh` / `db:wipe` /
  TRUNCATE / mass destructive seeder against the app DB (MySQL `ragil` or whatever `.env`
  points to) unless the user explicitly orders it in the same request. Forward-only `migrate`
  is allowed when relevant to the task. Test with PHPUnit (sqlite `:memory:` per `phpunit.xml`);
  `--env=testing` in `Artisan::call` does NOT switch the DB connection. Incident 2026-07-27:
  `migrate:fresh` wiped `ragil`, catalog/orders lost, recovery needed re-import.
- **Report format below is mandatory** for every code change or error fix.
- No new route / URL / schema field / enum / status / JSON shape without updating the
  canonical docs (`docs/database-schema-ragil-aluminium.md`,
  `docs/api-and-routes-ragil-aluminium.md`, `docs/sitemap/*` + `config/sitemap.php`,
  `config/admin-sitemap.php`) → then report `SPEC_CHANGED_AND_DOCS_UPDATED`.
- UI changes must be wired to real routes/controllers/services — functional, responsive,
  accessible. Mockups or fake data are NOT completion (`frontend/skills/ragil-ui-functional-integration/SKILL.md`).
- Do NOT port UI from `website_2.0/ui` (Next.js). `resources/` is a real folder, not a junction.
- Archive instead of hard-delete. Guest-only checkout (no customer accounts).
- Customer-facing copy in Bahasa Indonesia; currency IDR.

---

## AGENT REPORT FORMAT — MUST FOLLOW

Every time you change code or fix an error, report using EXACTLY this structure. Do NOT add extra narrative or steps.

1) SCOPE:
   - One short line.
   - Example: "Admin product create form"
              "API /api/products detail WIN-JUNG-001"

2) ROOT_CAUSE:
   - One line, directly stating the real cause.
   - Example: "Null product_media->url caused blade error"
              "variants relation not loaded, property access in loop"

3) CHANGE:
   - Maximum two lines.
   - Name the files and what you changed.
   - Example: "Added null-check in resources/views/admin/products/create.blade.php"
              "Loaded variants relation in ProductController@show before rendering"

4) SPEC_IMPACT:
   - Choose ONE of these and write it exactly:
     - "SPEC_UNCHANGED" → schema, routes, and JSON contracts are all unchanged.
     - "SPEC_CHANGED_AND_DOCS_UPDATED" → spec changed AND docs have been updated.

5) TEST_STATUS:
   - One line about tests or manual checks.
   - Example: "Smoke test admin create product: PASS"
              "Route /api/products/WIN-JUNG-001: 200 OK, payload matches api-and-routes spec"

Extra rules:
- Do NOT describe internal process (e.g. "let me check the log").
- Focus only on: scope, root cause, concrete code changes, impact on spec, and test status.

---

## Commands (verified from package.json / composer.json)

- `composer dev` — artisan serve + `queue:listen --queue=default,media --tries=3` + pail + vite
- `npm run typecheck` · `npm run lint` (eslint, `--max-warnings=0` — zero warnings required) ·
  `npm run test` (Vitest) · `npm run build` (Vite; required before checking Inertia asset updates)
- `npm run test:php` — PHPUnit; **on Windows it spawns WSL** (`wsl php vendor/bin/phpunit`)
- `php artisan test --filter=NameOfTest` — single PHPUnit test
- `npm run test:e2e` (build + Playwright) · `npm run test:e2e:only` (no build)
- `npm run quality` = typecheck + lint + test + build + budget
- Prod queue worker: `artisan queue:work --queue=imports,media,default --tries=3 --timeout=1800 --max-time=3600` (systemd `ragil-queue`)

## Testing quirks

- `phpunit.xml` pins `DB_CONNECTION=sqlite` `:memory:`, `QUEUE_CONNECTION=sync`, `CACHE_STORE=array`, `SESSION_DRIVER=array` — tests never touch MySQL.
- E2E/audit helpers live in `scripts/qa-*.mjs` (historical storefront audits used headless Chrome + puppeteer-core; evidence under `storage/app/audit-evidence/`).

## Read before code (routing)

| Area | Read |
|------|------|
| Public storefront / checkout | `docs/logic/stage-10-*`, `docs/sitemap/public-*`, `frontend/skills/ragil-public-ui/SKILL.md`, `ragil-ui-functional-integration`, `docs/STANDAR-DESAIN-HALAMAN-PUBLIK.md` |
| Admin UI | `docs/logic/stage-9a-*` / `9b-*`, `docs/sitemap/admin-*`, `frontend/skills/ragil-admin-ui/SKILL.md` |
| Visual | `frontend/brand/BRAND-KIT.md`, `frontend/docs/DESIGN-SYSTEM.md`, `frontend/skills/ragil-visual-qa/SKILL.md` |
| Import & media | `skills/stage-5-import-and-media-pipeline.md` |
| WhatsApp / order events | `skills/stage-8-*`, `skills/stage-4-*` |
| Order / payment / shipping | `skills/stage-4-*`, `docs/jnt-cargo-integration.md` |
| Queue / storage | `skills/stage-6-laravel-queue-and-storage.md` |
| PHPUnit | `tests/Feature/*` patterns (`.agents/skills/laravel-testing`) |

Marketplace `.agents/skills/` = technique helpers only; never override schema / sitemap / Product Handoff contracts.

## Gotchas (verified hard-earned fixes)

- Public layout must use `route('privacy')` / `route('terms')` — route names are `privacy`/`terms`, NOT `policy/privacy` (was a 500 on every page).
- `whenLoaded()` is not an Eloquent base method — use `relationLoaded(...)` guards. `$this->attributes` collides with Eloquent's internal property — use `getRelation('attributes')`.
- `config/app.php` overrides the `aliases` array — don't drop `Auth`; views use `auth()->user()`.
- Queue jobs must be serializable: dispatch IDs, not models (`DownloadProductMedia::dispatch($media->id)`).
- `webhook/*` routes are CSRF-exempt (`bootstrap/app.php` `validateCsrfTokens`) — contract, not a bug.
- `products.design_variant` is a nullable string (sub-models since 2026-08-08); validated against `sub_models`, fallback legacy map in `CatalogLabels::design()`.
- Excel import must NOT implement `WithEvents` (500s) — route through `App\Jobs\ProcessCatalogImport` (holds only `$jobId`/`$storedPath`).
- SQLite test quirk: `PerformanceMetric.metric_date` cast `date` tersimpan sebagai `Y-m-d 00:00:00` di SQLite — `whereBetween("metric_date", [..toDateString()..])` TIDAK match row cast; test yang butuh metric harus insert via `DB::table(...)->insert([... "metric_date" => now()->toDateString()])` (sudah dipraktikkan di StorePerformanceContractTest:166). Produksi MySQL aman (kolom date men-trim time). Bukan bug runtime.

## Current status

### 2026-08-13 — Pill nav rounded-md + hapus dropdown Kategori

**Done (commit batch ini):**
- Semua pill/tab kategori & model (homepage segment tab, nav katalog CatalogNav,
  tabs ModelProduk) diubah rounded-lg -> rounded-md.
- Dropdown "Kategori lain" dihapus dari CategoryMenu (homepage) dan CatalogNav —
  urutan pill dikelola langsung oleh admin di dashboard, semua pill tetap
  terlihat via scroll. CATEGORY_LINKS + import dropdown ikut dibersihkan.

**File diubah:** category-menu.tsx, catalog-nav.tsx, pages/Public/ModelProduk.tsx.

### 2026-08-13 — Menu kategori homepage gaya segment tab Zalora

**Done (commit batch ini):**
- CategoryMenu homepage di-restyle mengikuti segment tab Zalora: pill abu muda
  tanpa border (bg-secondary), pill aktif hitam + teks putih (cursor-default),
  padding px-4 py-2.5 rounded-lg, mr-2 antar pill, pill pertama inset kiri di
  mobile (ml-4, hilang di desktop), font text-sm font-medium.
- Container scroll horizontal tanpa scrollbar (scrollbar-none + overflow-x-scroll
  + overscroll-x-contain), rata tengah di layar besar (xl:justify-center — dipakai
  xl bukan md agar 8 pill tidak terpotong sisi kirinya saat overflow).
- Edge fade kiri/kanan ala Zalora hanya di mobile/tablet (md:hidden, pointer-events-none).
- Section bg putih (bg-background) + border-b, padding vertikal py-3 (12px).
- Iterasi berikutnya: wrapper full-bleed tanpa container padding (hanya first:ml-4
  di mobile), section py-2, pill px-3.5 py-2 — padding lebih ramping (b3c3a8d lanjutan).

**File diubah:** resources/js/components/public/category-menu.tsx.

### 2026-08-12 — "Lihat semua" accent secondary biru (#2563EB)

**Done (commit setelah batch ini):**
- Semua elemen ber-maksud "lihat semua" (link teks+panah, pill mobile, "Lihat semua ulasan") di seluruh website diubah warnanya jadi biru slate/navy #2563EB, hover lebih gelap #1D4ED8; panah ikut warna teks (currentColor). Ukuran font/alignment/spacing tidak berubah.
- File: home-sections (SectionTitle), product-related-section, product-info-sections (2), paling-banyak-dipesan (link + pill), home-carousels (pill), flash-sale-stage (pill), ModelDetail (2).
- Yang TIDAK diubah: "Lihat semua →" putih di banner flash sale merah (kontras), varian on-primary (bg gelap), tombol filter "Lihat semua model" di sidebar katalog (CTA filter), harga/badge/promo bar.

### 2026-08-12 — Homepage: bar promo slider vertikal -> horizontal ticker (translateX)

**Done (commit setelah batch ini):**
- Arah slider bar promo diubah dari vertikal (translateY, rata tengah) menjadi horizontal ticker (translateX, rata kiri): track flex-row, tiap slide w-full basis-full shrink-0, konten justify-start, teks whitespace-nowrap satu baris (bullet + teks sebaris).
- Pesan aktif keluar ke kiri, pesan berikutnya masuk dari kanan. Tetap 3 detik diam + transisi 400ms (duration-[400ms] ease-emphasized), tanpa marquee infinite.
- Loop seamless tetap (duplikat item pertama + reset timeout 450ms), tinggi bar tetap h-8, overflow-hidden, pause hover/focus, prefers-reduced-motion nonaktifkan autoplay & transisi.

**File diubah:** resources/js/components/public/home-hero.tsx.

### 2026-08-12 — Homepage: bar promo merah marquee -> discrete announcement slider

**Done (commit setelah batch ini):**
- Bar promo merah di atas banner diganti dari continuous marquee (announcement-marquee) menjadi discrete announcement slider stateful: satu teks promo tampil penuh 3 detik, lalu bergeser vertikal 400ms (translateY, ease-emphasized) ke teks berikutnya. Tidak ada animasi berjalan terus-menerus / CSS animation infinite.
- Loop seamless: item pertama diduplikasi di akhir track; dari item terakhir maju ke duplikat, lalu reset diam-diam ke index 0 (timeout 450ms + cadangan transitionend) supaya tidak scroll-back terlihat.
- Tinggi bar tetap sama (h-8 = 32px, sama dengan py-2 + text-xs sebelumnya), tetap full-width edge-to-edge tanpa rounded, overflow-hidden.
- Pause saat hover/focus; prefers-reduced-motion menonaktifkan autoplay DAN transisi (item pertama tampil statis).

**File diubah:** resources/js/components/public/home-hero.tsx.

### 2026-08-12 — Homepage: strip marquee full-width + timing carousel promo (5s / 350ms)

**Done (commit setelah batch ini):**
- Strip marquee promo di atas banner -> FULL-WIDTH edge-to-edge: dipindah keluar dari container ber-padding (jadi sibling langsung section, bukan full-bleed hack), hapus rounded-md, tanpa padding/margin horizontal, teks marquee tetap berjalan (announcement-marquee). Tidak menyebabkan horizontal overflow (overflow-hidden).
- Timing carousel promo: autoplay 5 detik per slide (sebelumnya 6s), perpindahan pakai transform translateX dengan transisi 350ms (duration-[350ms], ease-emphasized = cubic-bezier), loop tak terbatas, tanpa animasi terus-menerus.
- Timer autoplay di-reset tiap navigasi manual (klik dot/panah) supaya slide tidak langsung berpindah lagi setelah interaksi.
- Pagination dot aktif -> merah (bg-primary, w-3.5), nonaktif bg-primary/40 (w-1.5) — kontras dengan strip merah/banner. Pause saat hover/focus tetap, hormati prefers-reduced-motion.

**File diubah:** resources/js/components/public/home-hero.tsx.

### 2026-08-12 — Homepage: navbar kategori model-only, banner 10 slot polos, marquee berjalan

**Done (commit setelah batch ini):**
- Navbar kategori homepage -> hanya pill model (Boven Jungkit, Boven Sliding, Jendela Swing, dst; 8 model), tanpa link desain Ornamen/Polos (masuk dalam 1 model, tampil bersamaan di halaman model). Label pendek dari CatalogLabels (category + model), bukan nama CMS. Gaya pill = contoh nav katalog: frame abu-abu (border-border bg-surface) / hitam saat aktif (bg-foreground), font 12px, padding frame 12px, plus dropdown "Kategori lain" (kategori + model).
- Banner promo homepage -> 10 slot polos (placeholder bg-secondary, tanpa konten). Admin tinggal isi gambar banner sendiri via CMS Banner (cms_banners) - slide manual tampil lebih dulu, placeholder mengisi sampai 10. Ukuran = lebar container (padding halaman !px-5 md:!px-8 lg:!px-12 py-[10px]); kartu p-3/rounded lama dihapus.
- Marquee berjalan (announcement-marquee) di atas banner promo - men-scroll poin layanan (COD, garansi, kirim, harga pabrik). Konten statis, tidak menduplikasi AnnouncementBar.
- Landing slide teks ("Diskon 20%", IntroCards) dihapus dari carousel hero.

**File diubah:** app/Services/ModelProductService.php, app/Support/HomepagePromotions.php, app/Support/ActiveAnnouncements.php, resources/js/components/public/category-menu.tsx, resources/js/components/public/home-hero.tsx.

**Catatan:** slide placeholder di-skip dari ticker announcement (ActiveAnnouncements). Tombol "Kategori lain" = dropdown; pill model pakai text-xs px-3.

### 2026-08-12 — Sebelumnya
- PDP: rating ke atas "pilih varian", font nama produk body, sentence case, padding container 10px (revert PDP), ulasan multi-foto + badge + lightbox swipe, varian & stok sebaris rata kanan, label 12px bold.
- Kontrak workflow (AGENTS.md): edit langsung di repo VPS, commit per batch.
 (2026-08-12)

- Batch polish detail produk #2 selesai (86a1294): grid rekomendasi, ulasan berfoto + lightbox, warning varian kondisional, chip varian kecil, clearance sticky bottom ~19px.
- Batch polish #3 selesai (fc9b4ed + 59fbd80): label "Pilih varian" 14px bold + varian&stok sebaris rata kanan (font light), heading "Alasan harus belanja di Ragil Aluminium", rating frame rounded kanan sejajar baris 1, judul split otomatis ukuran/model via regex.
- Batch ulasan multi-foto (commit berikutnya): kolom JSON image_urls di cms_testimonials (migrasi 2026_08_12_010000) + payload images[]; PDP ulasan menampilkan badge jumlah foto + overlay "N foto" saat hover + GalleryLightbox swipeable (drag/panah/keyboard); admin form punya textarea "URL gambar tambahan" (satu per baris). Demo: ulasan Siti Rahayu (testimonial id 51, produk SP58155312043) diberi 3 foto — 2 di antaranya pinjam dari testimonial lain (data demo).
- Riwayat: `e492484` polish PDP #1 (accordion default tertutup, bintang #F5A623, ulasan tanpa bg & label source, tombol ulasan teal, tipografi lihat semua seragam); `708c0bd` product card BEM visual system (wishlist, stok habis, flash badge) + 5 file agent lain.
- Working tree saat ini: 3 file modif batch ini (product-buy-box, product-info-sections, product-related-section) — di-commit bersama update status ini. docs/ZALORA-BEM-VISUAL-SYSTEM.md masih untracked (milik agent lain, belum di-commit).
- Folder lokal `D:/website_5.0` (admin-orders-work dll) adalah SNAPSHOT LAMA (2026-08-10/11) — JANGAN dijadikan sumber, JANGAN di-scp ke server (akan menurunkan versi). Selalu edit di repo VPS ini.

## Current status (2026-08-11)

- Phases 1–6A + WhatsApp BAILEYS pairing + QA reconciliation done; PHPUnit 258 green / 4050 assertions (2026-08-09). HEAD `765e50b`.
- **Working tree is dirty (~136 entries)** with many `*.bak-*` files — review carefully before committing; some backups are intentionally kept.
- opencode: read-only subagent `cx-architect` (Customer Experience Architect) in `.opencode/agents/cx-architect.md`; `opencode.json` = `$schema` only. Delegate UX analysis to it.
- VPS 209.23.10.62 runs an opencode binary that **crashes (CPU lacks AVX)** — run opencode on a capable machine; the repo is only reachable via SSH from here.
- Production cutover NOT started; release governed by `docs/FULL-STACK-PRODUCTION-CHECKLIST.md` (no cutover while any `[!]` open).

## Landing pill segment tab — DISABLED (2026-08-13)

- Fitur landing berbasis pill segment tab (`SegmentLanding.tsx`, route
  `/segment`, serta pendahulunya `ModelLanding.tsx` / route `/model/...`)
  **dimatikan** — akan didesain ulang di masa depan.
- Kode lengkap semua iterasi tersimpan aman di git history:
  - `9af09e5` model landing ala Zalora (route `/model/...`)
  - `6e58213` segment landing dinamis satu template (route `/segment`)
  - `c1b1746` slider promo segment ala "cara pesan jendela anda"
- Pill segment tab homepage saat ini kembali mengarah ke halaman model produk
  (`/products/{category}/{model}` → `Public/ModelDetail.tsx`), seperti sebelum
  fitur landing dibuat. Override `menu_href` admin tetap dihormati.

## Communication

- Lead with outcome; keep updates concise; preserve exact commands, paths, errors, and test evidence.
- Ask questions only when genuinely blocking; otherwise make a safe assumption and state it.
- Efficiency protocols (Caveman / Compound Engineering loop) are process helpers only — they never override the rules above.
## WORKFLOW CONTRACT — TANPA KERJA LOKAL/TEMP (disepakati user 2026-08-12)

Berlaku untuk SEMUA agent di repo ini, termasuk agent lain/sebelumnya.

1. **Edit langsung di repo VPS** — satu-satunya sumber kebenaran. Akses via
   SSH ke /root/ragilaluminium. DILARANG membuat salinan file di mesin lain,
   folder temp lokal, atau scp bolak-balik: kerja lokal membuat git log repo
   kehilangan jejak perubahan dan konteks antar agent terputus.
2. **Commit + push per batch yang selesai** (setelah typecheck + build +
   verifikasi live). Jangan menumpuk perubahan tanpa commit — git history
   adalah kontrak antar agent.
3. Jangan commit: .env.pre-*, .backup-*, *.bak-* (kecuali diminta user).
4. Sebelum menyentuh file: cek git status — agent lain boleh bekerja di
   working tree yang sama; report format (SCOPE/ROOT_CAUSE/CHANGE/SPEC_IMPACT/
   TEST_STATUS) tetap wajib di setiap laporan perubahan.
5. **Instruksi ambigu → TANYA DULU, jangan tebak** (disepakati user 2026-08-13):
   kalau instruksi kurang jelas, menyebut elemen UI yang bisa menunjuk ke
   beberapa komponen (mis. "bar merah", "pill", "tombol lihat semua"), atau
   target/perilaku yang kamu ragukan — tanyakan ke user SEBELUM mengubah kode
   atau data. Jangan berasumsi lalu mengubah komponen yang salah; konfirmasi
   singkat (1 kalimat) dengan menyebutkan target yang kamu pahami.
