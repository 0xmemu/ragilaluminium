# Storefront Audit TODO — Ragil Aluminium

**Diperbarui:** 2026-08-07  
**Status:** P1 audit browser & alur utama selesai — 40 PASS / 3 SKIP / 1 flaky (retry PASS); sisa P1: review 42 warning lint React
**Evidence:** playwright-report/ + storage/app/audit-evidence/2026-08-07/ (audit-final 12, audit-full 39)
**Branch:** feat/admin-ui-redesign  
**Baseline runtime:** 0591319
**Evidence visual sebelumnya:** 52e3e2f, cd302c0

## Tujuan dokumen

Dokumen ini adalah backlog lanjutan untuk audit UI/UX storefront setelah audit workflow
fungsional pada docs/WORKFLOW-AUDIT.md. Audit workflow tersebut tetap menjadi catatan
historis dengan status selesai per 2026-07-22; dokumen ini tidak mengubah status historis itu.

## Status dokumentasi audit

- Audit workflow pelanggan dan admin sudah terdokumentasi di docs/WORKFLOW-AUDIT.md.
- Milestone audit sampai 2026-07-28 tercatat di docs/MEMORY.md.
- Audit visual storefront 2026-08-03 sampai 2026-08-06 tercermin di riwayat Git dan checkpoint,
  tetapi sebelumnya belum memiliki TODO atau handoff terpisah.
- Tidak ditemukan log sesi atau dokumen khusus Cline di repository.
- Interupsi Cline dan keputusan pemulihan dicatat di bagian Insiden sesi Cline di bawah.

## Baseline yang sudah terverifikasi

- Workflow backend checkout tetap memakai dua langkah: /checkout/validate menyimpan detail
  pengiriman ke session, lalu /checkout/place-order menerima payment_method.
- Field checkout address_line2 dan notes tetap tersedia sebagai data opsional yang didukung
  kontrak dan OrderService.
- Audit workflow P0/P1/P2 publik dan admin pada 2026-07-22 tercatat selesai.
- Audit visual prioritas 1–2 sudah masuk commit 52e3e2f dan cd302c0, termasuk standardisasi
  back button mobile, breadcrumb, heading, OrderConfirmation, dan ProductDetail.
- php artisan test: PASS, 190 tests / 3053 assertions (per 2026-08-07).
- npm run build: PASS.
- npm run test: PASS, 17 tests.
- public/hot tidak ada dan public/build/manifest.json tersedia di VPS dev.
- Baseline runtime diperbarui ke `0591319`; commit visual `52e3e2f` dan `cd302c0` tetap dicatat sebagai evidence historis.

## Browser audit 2026-08-06

- `npm run test:e2e`: **PASS**, 33 tests / 3 skipped pada desktop, 768 px, 1024 px, dan compact Chromium.
- Alur nyata terverifikasi: PDP pilih varian → cart → checkout validate → transfer → confirmation → order status; termasuk `address_line2`, `notes`, guest lookup state, dan duplicate-click guard.
- E2E memakai SQLite terisolasi (`database/e2e.sqlite`) dan seeder katalog dev preview; tidak menyentuh database MySQL aplikasi.
- `npm run build`: **PASS** setelah perbaikan kontras badge publik, status danger admin, dan link Flash Sale.

## Browser audit 2026-08-07 — P1 selesai

- `npm run test:e2e`: **40 PASS / 3 SKIP / 1 flaky** (5.9 menit) di 4 viewport (1440, 1024,
  768, 360). Flaky = "catalog discovery" attempt-1 gagal cold-load VPS (teardown video terpotong, lihat `test-results/.../error-context.md`), retry #1 PASS dalam 4.9s — bukan
  regresi kode.
- Verifikasi checkout P1 ditambahkan di `tests/e2e/storefront.spec.ts`:
  - State pending: tombol place-order menampilkan "Membuat pesanan..." dan disabled selama
    request berjalan (route place-order di-delay 2 detik).
  - Duplicate-click: klik kedua saat pending tidak memicu request tambahan (tepat 1 POST
    `/checkout/place-order`).
  - Validation error: form kosong tetap di /checkout dan langkah pembayaran disabled
    (sudah ada, dipertahankan).
  - Persistence `address_line2` & `notes`: diverifikasi langsung ke `database/e2e.sqlite`
    via `node:sqlite` setelah halaman confirmation — "Dekat gerbang utama" dan
    "Hubungi sebelum pengiriman" benar-benar tersimpan di record order.
  - Shipping fallback: di-cover PHPUnit (ShippingEstimateFallbackTest).
- Axe (serious/critical = 0) + overflow horizontal di Home, Catalog, Cart, PDP (baru),
  Checkout langkah pembayaran (baru), Order Status, /login, Dashboard admin; keyboard
  focus non-BODY di PDP dan /login.
- `php artisan test`: **190 PASS / 3053 assertions**. Baru: `CheckoutFlowTest`
  (persist address_line2+notes ke order) + `ShippingEstimateFallbackTest` (3 tes:
  J&T off → rumus lokal, API gagal → fallback lokal, tariff ok → dipakai).
- `npm run typecheck` PASS, `npm run lint` PASS (warning non-blocking tetap ada).
- `scripts/qa-final.mjs` (12 screenshot) dan `scripts/qa-full.mjs` (39 screenshot) **PASS**
  terhadap server dev :8200; akun login `qa.admin@example.com` dibuat di DB dev (satu-satunya
  akun baru, password sesuai script). Evidence: `storage/app/audit-evidence/2026-08-07/`.

## Mobile UI polish 2026-08-07 — touch target & layout mobile

Audit mobile programatik (Playwright, 360x800, 13 halaman publik) terhadap dev :8200,
sebelum dan sesudah polish. Semua halaman: 0 overflow horizontal, 0 teks terpotong,
0 violation axe serious/critical.

Perbaikan touch target (dibawa ke >= 44px kecuali item ber-eksespsi WCAG):
- Tombol "Kembali" — 17 halaman, class seragam: hit area 20–36px -> 44px (`size-11`).
- Breadcrumb back + link breadcrumb — 32px -> 44px (komponen `ui/breadcrumbs.tsx`).
- Logo & search header mobile — 36px -> 44px (`public-header.tsx`).
- Chip varian PDP — 32px -> 44px mobile (`min-h-11 sm:min-h-8`).
- Stepper jumlah (PDP/cart) — 24px -> 44px (`ui/quantity-control.tsx`).
- Sort/filter ("Populer", "Filter", "Urutan model") — 32px -> 44px (`filter-berdasarkan-control.tsx`).
- Tab Reviews + tombol "selengkapnya" — 36px/16px -> 44px.
- Link "Lihat semua/selengkapnya" — 28px -> 44px (Home/ProductDetail/ModelDetail).
- Dots hero carousel — 8px -> 32px hit area (lolos WCAG 2.2 min 24px).
- CTA "cara-pemesanan" — 2 tombol berdesakan -> stack penuh di mobile (`flex-col sm:flex-row`).
- Judul section "Hasil pemasangan" — terpotong ellipsis -> wrap 2 baris (`whitespace-normal`).

Hasil audit akhir: 10/13 halaman 0 temuan; sisa = dots carousel (32px), satu inline link
"Lacak pesanan" (eksespsi WCAG inline link), link breadcrumb 34–37px lebar x 44px tinggi.
Evidence: `storage/app/audit-evidence/2026-08-07/mobile/` (13 screenshot + report.json).
Validasi: `npm run build` PASS, typecheck PASS, lint PASS, E2E penuh PASS (bagian bawah).

## Density compression 2026-08-07 — Home lebih padat (benchmark e-commerce app mobile)

Audit density (Playwright 360x800) terhadap dev :8200, tolok ukur aplikasi e-commerce
(Shopee/Tokopedia): padat, minim scroll. Nav, bottom nav, dan dua section testimoni
(Apa Kata Pelanggan + Ulasan Website) **tidak diubah** atas permintaan owner.

Perbaikan:
- Section rhythm mobile — `section-space` 28px -> 20px (`app.css`; desktop 44px tetap).
- Carousel produk — bottom padding dirapatkan (`pb-3.5` -> `pb-3`).
- Cara Pesan — kartu + ikon + judul dikompakkan (ikon 56->48px, judul 11->12px mobile).
- **KamiBantu + ClosingCta digabung** menjadi satu band gelap (`#kami-bantu`, bg-foreground
  text-background) dengan 2 CTA: "Pilih model produk" + "Konsultasi ukuran" (wa.me). Heading
  section yang sama (0.875rem) & CTA 44px dipertahankan. `id="closing-cta"` tidak lagi ada.
- Kartu bantuan: grid-cols-2 di mobile (4 kartu -> 2 baris), ikon 48->40px mobile
  (desktop 48px kembali via sm:), deskripsi `line-clamp-2` mobile / `sm:line-clamp-none`,
  padding 16->12px mobile / sm:p-4 desktop.
- Aksen band gelap memakai token baru `--on-dark-accent` (0 88% 75%) di app.css
  (blok :root + .dark) — `text-primary` gagal kontras (2.64:1), token lolos AA (7.4:1).
- Catatan: `.section-space` global — perubahan ritme 28->20px mobile berlaku ke semua
  halaman yang memakai class ini; audit ulang menunjukkan halaman lain tidak bergeser.

Hasil (layar scroll @360x800, sebelum -> sesudah):
- Home: **4.9 -> 4.0** layar (section terbesar KamiBantu: 950px -> 574px).
- Halaman lain tidak berubah (catalog 4.7 wajar listing, PDP 2.8, lainnya <=1.4).

Validasi: build PASS, typecheck PASS, lint PASS, E2E penuh PASS (lihat bagian bawah),
console 0 error, CTA wa.me & /products terverifikasi di DOM.

## Font scale & grid tablet 2026-08-07 — mikro-teks publik naik ke >=11px, grid 768px 3 kolom

Audit DOM (Playwright 360x800) menemukan 106 teks 10px & 85 teks 11px di halaman publik
(sebelumnya terhitung lewat grep). Patch 48+ spot + 2 komponen auto-fit.

Perbaikan:
- **Konten teks yang dibaca** -> `text-xs` (12px): bottom nav label, announcement bar,
  meta kartu (harga coret/harga sale/warning), cart line item (harga, error, specs),
  model card deskripsi, kartu bantuan/pemasangan, trust assurance, link "Lihat semua",
  tab Reviews, tombol size `sm` Button, dst.
- **Badge/indikator kecil** -> 11px (bukan 12, menjaga proporsi): badge diskon, badge
  "FLASH SALE", badge variant, tombol aksi h-7 di Cart, step number bulat, footer icon.
- **Badge count dalam lingkaran 16px** & dot carousel -> tetap 10px (dekoratif, muat).
- **`FitTwoLineTitle`** (product-card): min font 10px -> 10.5px (`Math.max(10.5, base-2)`)
  — akar masalah judul varian panjang jadi 10px walau class `text-xs`. Min 11px ternyata
  meng-klip judul panjang (line-clamp-2) sama banyaknya dengan baseline 10px; 10.5px =
  kompromi: font lebih besar tanpa tambahan truncation (26/50 terpotong = identik dengan
  baseline — judul "Tinggi 50cm x Panjang 200cm..." butuh 3+ baris di kartu 2-kolom
  165px, kondisi bawaan). `FitOneLine` (harga coret+badge) min 8px -> 10.5px.
- **Clamp hero Home**: eyebrow 0.72->0.8rem, subheadline/CTA/disclaimer 0.68/0.55->0.75/0.7rem
  (terukur 10.88px & 8.8px di 360px -> sekarang >=11.2px).
- **Grid produk tablet**: `productCardGridClassName` 768px 4 -> 3 kolom
  (`md:grid-cols-4` -> `md:grid-cols-3`, lg tetap 4). Kartu 768px: 170px -> 214px lebar.

Hasil audit ulang (12 halaman publik @360px): **0 elemen teks <11px** (sebelum: Home 106 x 10px).
Grid /products/all @768px: 3 kolom terverifikasi (x: 41/277/513, kartu 214px).

Validasi: build PASS, typecheck PASS, lint PASS (0 error; 2 warning pre-existing
Admin/ProductForm.tsx), E2E penuh 40 PASS / 3 SKIP / 1 flaky (admin login tablet-768
attempt-1 cold-load navigasi lambat, retry PASS 2.4s — bukan regresi).

## Heading section alignment 2026-08-07 — judul + link sejajar

Audit geometri (Playwright 360px & 1280px) pada SectionHeading align="left" + action
("Paling banyak dipesan" / section Home lain). Masalah: link action min-h-11 (44px)
di-align `items-end` -> judul (24px) terdorong ke bawah dengan ~20px ruang kosong di
atasnya, dan teks link misalign ~10px dari center judul. Eyebrow->judul hanya 4px.

Perbaikan (`section-heading.tsx`):
- Row judul+action: `items-end` -> `items-center` — teks link & judul center sejajar
  (diff 0px mobile & desktop, sebelumnya 10px). Berlaku ke 2 pemakaian align="left"
  (paling-banyak-dipesan-section + Home section produk).
- Container gap `gap-1` (4px) -> `gap-1.5` (6px) — eyebrow->judul lebih lega
  (mobile 24->14px gap total, desktop 12->8px).

Hasil: h2Center == linkCenter (0px offset) di 360px & 1280px; judul tidak lagi
terdorong (h2Top 780->770 mobile). E2E shell 4/4 PASS. Evidence:
`storage/app/audit-evidence/2026-08-07/heading-fix/` (mobile + desktop).

## Hero banner card 2026-08-07 — kartu kompak rounded (referensi Zalora)

Hero promo sebelumnya full-bleed image + floating card (533px desktop) — terasa bulky.
Didesain ulang menjadi **banner kartu horizontal kompak dengan rounded corners** seperti
banner promo e-commerce (Zalora): duduk di dalam padding container, background beige,
gambar produk di kiri & kanan, teks promo di tengah.

Perubahan (`Home.tsx`, `HeroPromoCard` + section #promo):
- Section: wrapper `container-page !px-5 md:!px-8 lg:!px-12` -> kartu
  `rounded-2xl bg-surface-muted shadow` (bukan full-bleed).
- Layout grid `[1fr_1.5fr_1fr]` di semua breakpoint: **gambar produk kiri · teks
  center-aligned tengah (eyebrow merah, headline bold, chip diskon, subheadline
  sm+, CTA "Belanja sekarang") · gambar produk kanan (mirror `-scale-x-100`
  karena tiap slide hanya punya 1 gambar)**.
- Tinggi tetap kompak: `h-[150px] sm:h-[190px] lg:h-[210px]` (bukan aspect ratio).
- `PROMO_CARD_VARIANTS` dihapus (tidak dipakai lagi); `variantIndex`/`index`
  passthrough dibersihkan.

Hasil terukur (Playwright):
- Desktop 1280: kartu **210px tinggi x 1184px lebar**, radius 16px, kolom 338/507/338px.
- Mobile 360: kartu **150px x 320px**, kolom 91/137/91px (3 kolom tetap seperti referensi).
- Tanpa overflow teks, tanpa console error. E2E penuh 41 PASS / 3 SKIP / 0 FAIL,
  build PASS, lint 0 error (2 warning pre-existing Admin/ProductForm.tsx).

Evidence: `storage/app/audit-evidence/2026-08-07/hero-card/` (mobile + desktop).

## Performance audit 2026-08-06

Status batch: diterapkan dan tervalidasi di VPS.

- Update quantity cart sekarang optimistik di UI, didebounce 220 ms, dikirim ke endpoint JSON, dan tidak lagi melakukan redirect ke /cart pada setiap klik. Validasi stok server tetap berlaku; response server dapat meng-clamp quantity dan UI melakukan rollback saat gagal.
- Cart preview dikeluarkan dari shared Inertia props. Preview dihitung hanya saat hover atau focus melalui /cart/preview, sehingga pricing cart tidak ikut setiap navigasi.
- Shared model menu memakai cache aplikasi dua menit.
- Page-view tracking tidak lagi menulis metrik untuk Inertia atau AJAX partial request; hanya full document view yang dicatat.
- Bootstrap production dioptimalkan dengan php artisan optimize: config, events, routes, dan views cached.
- Evidence VPS: partial Inertia /cart 313 byte dan sekitar 127 ms; endpoint cart update JSON sekitar 151 ms; aset JS Cloudflare content-encoding br, cf-cache-status HIT, cache-control public max-age 604800.
- Validasi aman: php artisan test 184 tests / 3018 assertions PASS setelah cache dibersihkan sementara untuk konfigurasi SQLite testing lalu cache production dipulihkan; npm run typecheck, npm run test, dan npm run build PASS.

Remaining performance follow-up:

- [ ] Ambil browser Performance/Network trace nyata pada perangkat mobile dan desktop.
- [ ] Evaluasi pemecahan bundle routes 236 KB dan app 362 KB bila cold-load masih terasa lambat setelah cache browser.
- [ ] Tambahkan invalidasi eksplisit cache model menu setelah perubahan CMS model product jika TTL dua menit tidak cukup.

## Insiden sesi Cline

Perubahan uncommitted dari sesi yang terputus sempat:

1. Membuat PlaceOrderRequest mewajibkan seluruh detail customer dan alamat.
2. Mengubah CheckoutController::placeOrder() agar membaca detail dari request pembayaran.
3. Menghapus field patokan dan catatan dari form checkout.

Perubahan tersebut tidak sesuai alur UI dua langkah: form pembayaran hanya mengirim
payment_method, sehingga order selalu gagal validasi. Penghapusan address_line2 juga tidak
sesuai kontrak Stage 10. Perubahan backend dan UI yang belum selesai dipulihkan ke baseline
kontrak; tidak ada perubahan database atau migrasi yang dilakukan.

## TODO aktif berdasarkan prioritas

### P0 — quality gate sebelum menyatakan audit storefront selesai

- [x] Perbaiki error TypeScript Cart.tsx pada undoItem.name dan pastikan npm run typecheck PASS.
- [x] Bersihkan tiga lint blocker yang memblokir CI:
      FlashSaleSectionIntro tidak terpakai di flash-sale-stage.tsx, serta Link dan
      ContactRow tidak terpakai di InformasiToko.tsx.
- [x] Jalankan npm run typecheck dan npm run lint sampai keduanya PASS; lint kini PASS dengan warning non-blocking.
- [x] Jalankan `npm run test:e2e` memakai database SQLite E2E terisolasi, bukan koneksi DB aplikasi.
      Hasil final: 33 PASS / 3 SKIP; tidak ada screenshot/trace gagal dan tidak ada reset terhadap
      database MySQL aplikasi.

### P1 — audit browser dan alur utama

- [x] Lengkapi Playwright untuk alur nyata: PDP pilih varian → cart → checkout validate →
      pilih COD/transfer → confirmation → order status.
- [x] Tambahkan verifikasi checkout untuk validation error, state pending, duplicate-click,
      shipping fallback, address_line2, dan notes.
- [x] Jalankan matrix responsive minimal pada 360, 768, 1024, dan 1440 px; cek horizontal
      overflow, heading/breadcrumb, dan serious/critical accessibility violations. Review CTA
      sticky mobile, focus ring, dan safe-area tetap menjadi follow-up manual.
- [x] Jalankan scripts/qa-final.mjs dan scripts/qa-full.mjs setelah server dev tersedia;
      arsipkan hasil yang relevan sebagai evidence audit.
- [x] Audit keyboard dan axe pada Home, Catalog, PDP, Cart, Checkout, Order Status, dan
      halaman admin yang disentuh; catat violation serious/critical per halaman (0 serious/critical).
- [ ] Review 42 warning lint React setelah error blocker selesai, terutama
      set-state-in-effect, akses ref saat render, dan missing hook dependencies.

### P1 — sinkronisasi dokumentasi

- [x] Sinkronkan schema, route, taxonomy, status, dan guest checkout dengan runtime per 2026-08-06; tidak ada perubahan schema database atau route runtime.
- [x] Setelah setiap batch audit, update bagian status di dokumen ini dengan commit, command,
      dan evidence yang benar-benar dijalankan.
- [ ] Update docs/WORKFLOW-AUDIT.md hanya untuk perubahan status workflow; jangan menghapus
      catatan historis 2026-07-22.
- [x] Tambahkan milestone penting ke docs/MEMORY.md, bukan log harian atau output mentah.
- [ ] Jika kontrak route, field, atau status berubah, update schema/API/logic docs pada commit
      yang sama dan gunakan SPEC_CHANGED_AND_DOCS_UPDATED.

### P2 — backlog audit fungsional yang bukan blocker checkout

- [ ] Branded public 404 untuk menggantikan fallback 404 generik.
- [ ] Evaluasi dedicated UI Import/Media/Payments bila Resource shell masih kurang nyaman
      setelah audit browser.
- [ ] Evaluasi manual resend template WA dari log, tetap melalui WhatsApp Module.
- [ ] Tambah evidence untuk media R2, queue worker, J&T sandbox, dan template Meta setelah
      kredensial/integrasi tersedia.

## Di luar scope audit storefront saat ini

Item DNS cutover, shim /api/jnt, kredensial J&T/Meta, nginx, dan rollback tetap berada di
docs/cutover-prep-website-4.0-before-handoff.md. Item tersebut jangan dicampur ke audit UI
sebelum ada jadwal cutover dan akses integrasi yang jelas.

## Urutan eksekusi yang disarankan

1. Fix TypeScript dan tiga lint error blocker.
2. Jalankan typecheck, lint, PHPUnit, Vitest, dan build sebagai baseline hijau.
3. Lengkapi serta jalankan Playwright checkout dan responsive matrix.
4. Perbaiki temuan browser berdasarkan severity, bukan preferensi visual semata.
5. Update evidence di dokumen ini dan milestone singkat di docs/MEMORY.md.
6. Baru lanjutkan backlog P2 atau audit visual batch berikutnya.

## Announcement bar 2026-08-07 — dipindah dari header ke atas banner promo

Bar promosi merah (AnnouncementBar) yang sebelumnya dirender di `public-layout.tsx`
(full-width di atas header, hanya di Home) dipindah ke dalam section `#promo` di
`resources/js/pages/Public/Home.tsx`, tepat di atas kartu banner.

- `public-layout.tsx`: render + import AnnouncementBar dan `usePage`/`isHome` dihapus.
- `Home.tsx`: `<AnnouncementBar className="mb-3 overflow-hidden rounded-xl md:mb-4 lg:mb-5" />`
  di dalam container `container-page !px-5 md:!px-8 lg:!px-12` — padding samping bar
  otomatis sama persis dengan kartu banner (20/32/48px).
- `announcement-bar.tsx`: menerima `className` opsional (di-merge via `cn`).

Ritme vertikal terukur (Playwright):
| Viewport | gap header->bar | bar kiri/kanan vs banner | gap bar->banner |
|---|---|---|---|
| Mobile 360 | 20px (pt-5) | 0px (20=20) | 12px (mb-3) |
| Desktop 1280 | 48px (pt-12, setelah nav desktop) | 0px (48=48) | 20px (mb-5) |

- Bar `bg-primary` (#c20000), radius 16px (skala project: `rounded-xl` = `rounded-2xl` = 16px).
- 0 console error · build PASS · lint 0 error · typecheck bersih di 3 file yang diubah ·
  E2E shell 4/4 PASS (desktop/mobile/tablet/compact).
- Evidence: `storage/app/audit-evidence/2026-08-07/announce-move/` (mobile + desktop).

## Model card 2026-08-07 — deskripsi dihilangkan dari carousel Home

Kartu model di carousel section "Pilih model produk" (Home) tidak lagi menampilkan
paragraf deskripsi agar lebih kompak dan padat informasi.

- `model-card.tsx`: prop baru `showDesc` (default `true`) — blok deskripsi hanya
  dirender bila `showDesc && model.desc`.
- `Home.tsx` (`ModelCardCarousel`): `<ModelCard model={model} showDesc={false} />`.
- Halaman ModelProduk (grid katalog) tidak berubah — tetap menampilkan deskripsi
  (default `true`).

Terverifikasi: tiap kartu carousel Home kini hanya punya 1 baris teks
("4 produk | Ornamen · Polos"), tinggi kotak teks seragam 92px. Build PASS ·
lint 0 error · typecheck bersih · E2E shell 4/4 PASS.
- Evidence: `storage/app/audit-evidence/2026-08-07/model-desc/`.

## Bar promo 2026-08-08 — kembali ke header, statis, dikelola dari admin + tombol tutup

Perubahan besar pada announcement bar (bar merah):

1. **Posisi dikembalikan ke header** — `public-layout.tsx` render `<AnnouncementBar />`
   di atas `<PublicHeader />` (hanya di Home, seperti semula). Dihapus dari section
   `#promo` di `Home.tsx`.
2. **Bar statis** — `announcement-bar.tsx` ditulis ulang: tidak ada marquee desktop
   maupun carousel rotasi mobile. Hanya menampilkan **satu promo teratas** (item
   pertama `announcements`, prioritas admin via urutan).
3. **Dikelola dari dashboard admin** — modul baru:
   - Tabel `announcements` (text, href, starts_at, ends_at, sort_order, published).
   - Model `App\Models\Announcement` (scope `published` + `active` periode tanggal).
   - `Admin\AnnouncementController` (CRUD + publish/unpublish), rute `admin.announcements.*`.
   - Halaman `Admin/Announcements/Index` + `Form` (tanpa gambar — bar teks murni).
   - Nav admin "Harga & Promo → Bar Promo" (`megaphone`).
   - `ActiveAnnouncements::items()` baca item DB dulu; fallback ke sumber lama
     (config/cms/promo/flash-sale) hanya saat tabel kosong. 5 item awal di-seed dari
     config dengan href relatif.
   - Href di-normalisasi ke path relatif saat simpan (strip `app.url`) agar aman
     saat domain publik berganti.
4. **Ikon X menutup bar** — dismiss disimpan di localStorage dengan kunci
   `ra.announcement.dismissed.v1` berisi *fingerprint* teks+link. Kalau admin
   mengganti promo (fingerprint berubah), bar muncul lagi untuk pengunjung yang
   pernah menutupnya. State turunan murni (tanpa effect).

Terverifikasi (Playwright, 16/16):
- Bar di atas header (barTop 0 < headerTop 32), bg merah #c20000, 1 link statis,
  teks tidak berubah setelah 6s (tidak rotasi), X menutup & persist reload.
- Admin: login → halaman "Bar Promo" (h1, nav, 5 baris seed) → buat promo baru
  (dengan publish) → bar storefront muncul lagi menampilkan promo baru.
- 0 console error · build PASS · lint 0 error · typecheck bersih · E2E shell 4/4 PASS.
- Evidence: `storage/app/audit-evidence/2026-08-08/announce-bar/` + `announce-admin/`.

## Referensi

- docs/WORKFLOW-AUDIT.md
- docs/MEMORY.md
- docs/logic/stage-10-public-store-ui-and-checkout-contract.md
- frontend/docs/ACCESSIBILITY-AND-QA.md
- tests/e2e/storefront.spec.ts
- playwright.config.ts
