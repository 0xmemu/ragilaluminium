# UI Consistency Contract · Ragil Aluminium

Status: canonical for active Inertia + React pages (2026-08-06).

This contract replaces legacy visual references to `docs/DESIGN.md`, Blade page
partials, Figma exports, and the former `website_2.0`/`website_3.0` split. The
active implementation is `resources/js` with tokens in `resources/css/app.css`.
It governs new UI and targeted visual fixes; it does not change routes, props,
database fields, or API payloads.

## Foundations

- Font: **Inter self-hosted** (variable, weight 400 sampai 800) for body,
  headings, labels, and controls. It is loaded by two `@font-face` rules in
  `resources/css/app.css` from `public/fonts/inter/`. The `font-sans` and
  `font-display` mappings in `tailwind.config.js` are
  `['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif']`,
  so the Apple system font is only a fallback. The switch to Inter was made
  because the Apple system font does not exist on Windows and Android, which
  made rendering differ across devices. Use the existing mappings; do not
  introduce a second font family. The previous "Apple system font" claim is
  recorded as superseded.
- Canvas (storefront): Mineral Canvas `#FFFFFF`; heading text `#333333`; action
  text `#282828`; body/description text `#666666`; border Aluminium `#DEE3E0`;
  action/promo Signal Red `#C20000`; dark chrome and bands `#121212`. These are
  `:root` values. Token values DIFFER per context (storefront, admin dark, admin
  light), so never assume one value applies everywhere. The admin "Ink" layer is
  documented in `frontend/docs/ADMIN-DESIGN-LANGUAGE.md`.
- Superseded values from the earlier revision of this contract: action text
  `#262626` (now `#282828`), body text `#737373` (now `#666666`), border
  `#DDE2E0` (now `#DEE3E0`), Signal Red `#C00000` (now `#C20000`). All four moved
  darker, so contrast increased.
- Semantic colors (`success`, `warning`, `info`, `destructive`) are reserved
  for state communication. Red is not a decorative gradient or an all-page
  background.
- Icons come from `@phosphor-icons/react` through
  `resources/js/components/shared/icon.tsx`. Do not add emoji, Lucide, or a
  one-off SVG icon family.
- Product and customer content must be real backend data. Empty, loading,
  error, disabled, and success states are part of the page contract.

## Grid and container

- `.container-page` is the shared page container: `max-width: 112rem`, centered,
  with `1.25rem` mobile, `2rem` tablet, and `3rem` desktop inline padding.
- Public desktop layouts use a 12-column grid. Prefer `gap-5` (20px) for cards
  and `gap-6` (24px) for major page regions. At mobile, multi-column content
  falls back to one column unless it is a compact media/product strip.
- Product listing grids are 2 columns at mobile, 3 at tablet, 4 at desktop,
  and 5 only when the content and card width remain readable. Never compress a
  card merely to fill a row.
- Admin dashboard, index, detail, and form pages use the same 12-column shell.
  Dense tables may span all columns; filters, summaries, and form sections
  should occupy explicit columns rather than arbitrary nested widths.
- Admin pages additionally follow the "Ink" design language:
  `frontend/docs/ADMIN-DESIGN-LANGUAGE.md`. Key differences from the storefront
  that this contract must not accidentally override: admin is dark-first
  (`<html class="admin-shell">`, mode terang lewat `admin-shell light`),
  `--primary` is monochrome (white in dark mode, obsidian in light mode) rather
  than Signal Red, and radius is tighter (`--radius` `0.5rem`,
  `--radius-control` `0.375rem`).
- Text-heavy content is capped at `68ch`; tables and product grids may use the
  full container.

## Shape, type, and interaction

- Buttons and single-line inputs use the shared pill shape. Textareas and
  content panels use the existing control/panel radius tokens; listing cards
  stay edge-led and do not gain random rounded corners.
- Public navigation chrome (header, navbar, footer, and mobile bottom
  navigation) uses near-black `#121212` via `bg-header-bg` (`--header-bg`);
  header search is `36px` high via `h-9` at all breakpoints. The previous claim
  of action graphite `#262626` via `bg-action` is superseded: the class
  `bg-action` is used nowhere in the codebase, while `bg-header-bg` appears in
  `public-header.tsx` (lines 324 and 710), `public-footer.tsx` (line 77), and
  `home-sections.tsx` (line 308).
- Headings use sentence case in Indonesian copy unless a brand or proper noun
  requires otherwise. Existing user-facing copy is the assertion source for
  E2E tests; tests must not invent title-case variants.
- **Kapitalisasi teks: huruf besar semua HANYA untuk nilai sistem.** Keputusan
  desain 13 Oktober 2026. Kelas `uppercase` dilarang untuk label UI; yang
  tersisa huruf besar hanyalah (a) nilai yang memang identitas sistem apa adanya
  (kode SKU, kode voucher, nomor pesanan, nomor resi, ID), (b) input yang
  mengubah ketikan pengguna menjadi huruf besar (mis. isian kode voucher), dan
  (c) dokumen cetak (label alamat/resi). Semua label lain, termasuk judul kolom
  tabel, label grup baris, kategori, judul seksi, judul grup sidebar, label
  dropdown, dan label metrik, memakai Kapital Per Kata tanpa paksaan CSS.
  Alasan pemisahannya: huruf besar pada nilai sistem mengikuti data, sedangkan
  pada label UI ia hanya hiasan yang membuat teks salah baca. Label micro
  memakai `tracking-tight`, bukan `tracking-wide` (lihat BRAND-KIT).

  Cakupan per 13 Oktober 2026: `uppercase` sudah nol di seluruh
  `resources/js/pages/Admin`, `resources/js/components/admin`, dan
  `resources/js/layouts`, kecuali satu isian kode voucher di
  `resources/js/pages/Admin/Vouchers/Form.tsx` (kategori b). Penjaga:
  `tests/frontend/uppercase-guard.test.ts`.
- Every interactive element has a visible focus state, a keyboard path, and a
  useful accessible name. Icon-only actions require `aria-label`.
- Motion is restrained and respects `prefers-reduced-motion`. Do not use motion
  to hide loading or validation feedback.

### Label tombol tambah

Semua tombol, tautan, dan tombol submit yang menambah entitas atau baris baru
berlabel **"Tambah"** saja, tanpa imbuhan konteks (kontrak global, 20 Sep 2026).

| Dilarang | Wajib |
|---|---|
| "Tambah spesifikasi" | "Tambah" |
| "Tambah produk" | "Tambah" |
| "Tambah langkah", "Tambah kartu" | "Tambah" |
| "Tambah media", "Tambah foto" | "Tambah" |
| "Tambah kategori", "Tambah admin" | "Tambah" |
| "Tambah baris template" | "Tambah" |

Alasannya: konteks sudah dibawa judul seksi atau kartu di sekitarnya, sehingga
imbuhan itu mubazir dan membuat label tidak seragam antar halaman.

Berlaku juga untuk label tombol yang datang dari controller (prop `createLabel`,
`quickActions.label`), bukan hanya yang ditulis di JSX.

Yang **tidak** termasuk aturan ini: judul halaman dan judul modal, heading,
atribut `title`, dan `aria-label` yang memang boleh deskriptif karena bukan
label tombol yang dibaca mata. Storefront tidak terikat ("Tambah ke keranjang").

Verifikasi setelah mengubah tombol tambah:

```bash
grep -rn "Tambah [a-z]" resources/js/pages/Admin resources/js/components/admin
```

Hasilnya hanya boleh menyisakan judul, deskripsi, dan atribut title.

### Dropdown admin (Select)

Components in resources/js/components/admin/ui/select.tsx widen to the longest
option label by default (matchOptionWidth), so the width does not jump when the
selection changes and option labels are not clipped. Rules:

- Control width is capped at 384px and popover width at 480px. Options can be
  full product names; without a cap one dropdown widens its whole row and the
  page scrolls horizontally.
- min-width is applied to both the container and the button, so a flex-wrap row
  wraps instead of pushing the button out of its parent box.
- Popover labels wrap (break-words) instead of being clipped. A clipped button
  label must carry a title attribute with the full text.
- A select that must match its parent cell exactly (for example a form grid
  column) sets matchOptionWidth={false}.
- SearchSelect (search-select.tsx) follows the same popover rule, but its trigger
  deliberately does not widen because its option lists can run to hundreds.
- Never insert a wide measuring element into the DOM: lists can hold hundreds of
  options. Select uses a zero-width element; SearchSelect measures with canvas.

### Toast dan notifikasi melayang

Satu gaya kartu untuk semua notifikasi melayang, di storefront maupun admin.
Acuan tampilannya notifikasi langsung admin (`live-notification-manager.tsx`).

- **Tanpa garis tepi.** Pemisahan dari latar ditanggung bayangan (`shadow-2xl`),
  bukan stroke. Kartu berbingkai terlihat tua (keputusan owner 2026-09-19).
- Kelas kartu ada di SATU tempat: `TOAST_CARD_CLASS` di `resources/js/lib/toast.ts`
  (`rounded-xl border-0 bg-surface shadow-2xl`). `border-0` wajib karena komponen
  Alert membawa `border` di kelas dasarnya dan tailwind-merge membuat `border-0`
  menang.
- Permukaan memakai `bg-surface`, yang otomatis putih di storefront dan gelap
  raised di panel admin. Jangan menulis `bg-white` atau `bg-card` di toast.
- Warna belum ditetapkan di kelas kartu: komponen Alert yang menentukan warna
  teks dan ikon per nada (success, danger, info). Menambahkan `text-*` di kelas
  kartu akan menimpa warna itu lewat tailwind-merge dan menghapus maknanya.
- **Wajib diumumkan pembaca layar.** Kontainer toast memakai `role="status"` dan
  `aria-live="polite"` (dan `aria-atomic="true"` bila isinya diganti utuh).
  Toast yang punya tombol aksi seperti "Urungkan" tidak boleh mengandalkan
  penglihatan saja, karena jendelanya pendek.
- **Posisi: tengah atas, TURUN SAMPAI DI BAWAH CHROME halaman**, memakai variabel
  `--toast-top` (didefinisikan di `resources/css/app.css`). Toast tidak boleh
  menimpa header sticky, menu navigasi, atau breadcrumb. Nilai variabel berbeda
  per konteks karena tinggi chrome berbeda:
  - Storefront di bawah 768px (breadcrumb disembunyikan): 120px.
  - Storefront sejak 768px (header 48 + menu 44 + breadcrumb 44 + jarak 12): 156px.
  - Panel admin (header 49 + breadcrumb 35 + jarak 12): 96px.
- Nilai ditulis dalam **PIXEL, bukan rem**: root `font-size` panel admin 14px
  sedangkan storefront 16px, sehingga `rem` menghasilkan piksel berbeda dan
  posisi toast meleset 12px di admin.
- Skala lapisan resmi hanya header 30, overlay 40, modal 50, toast 60. Nilai
  seperti `z-[9999]` dilarang.
- Durasi tampil 4 detik untuk pesan hasil aksi. Durasi lain hanya bila ada
  alasan kuat, misalnya jendela undo yang butuh waktu memutuskan.
- **Lebar mengikuti isi, bukan lebar kontainer.** Kartu memakai `w-fit` dengan
  batas `max-w-full` (atau `max-w-xl` untuk teks panjang). Dilarang memberi
  `w-full` pada kartu: itu memaksa kartu selebar kontainer sehingga pesan pendek
  menyisakan ruang kosong besar di dalamnya (dikeluhkan owner 2026-09-19).
  Sebelum perbaikan, "Produk ditambahkan ke keranjang." memakai kartu 576px
  padahal teksnya hanya perlu sekitar 270px.
- Kontainer pembungkus tetap boleh selebar halaman karena hanya mengatur posisi;
  yang menyesuaikan isi adalah kartunya. Kartu yang mengecil tetap diletakkan di
  tengah pembungkus (`mx-auto`), kecuali notifikasi langsung admin yang memang
  rata kanan (`ml-auto`).
- Batas lebar dibuat supaya teks panjang membungkus, bukan memanjang satu baris:
  storefront `max-w-full` di dalam pembungkus `max-w-xl`, admin `max-w-full` di
  dalam pembungkus `max-w-lg` (768px), notifikasi langsung admin lebar `max-w-sm`.
- Bentuk: kartu notifikasi boleh punya slot ikon, judul, isi, tautan tindakan,
  dan tombol tutup, mengikuti struktur notifikasi langsung admin.
- **Ikon nada 20px dan sejajar TENGAH dengan garis pertama teks.** Ikon dibungkus
  `<span className="flex h-5 shrink-0 items-center">` supaya pusatnya sama dengan
  pusat baris pertama (line-height `text-sm` = 20px), baik pesan satu baris maupun
  banyak baris. Jangan memakai margin atas manual seperti `mt-0.5`: pengukuran
  menunjukkan itu membuat ikon 2px terlalu rendah. Ukuran 20px berlaku sama di
  storefront dan admin.
- **Tombol tutup rata tengah kartu**, bukan dipatok dari atas: pakai
  `absolute right-2 top-1/2 -translate-y-1/2`. Ukuran dan bentuknya sama di kedua
  tema: `size-8 rounded-full`. Sebelumnya admin memakai `h-7 w-7 rounded-md`
  dengan `top-2`, sehingga pusatnya 2px terlalu tinggi dan gayanya berbeda.
- Teks diberi `pr-9` saat tombol tutup ada, supaya tidak bertabrakan dengan tombol.
- Semua ukuran di atas memakai SPACING, bukan ukuran tetap: root `font-size` admin
  14px sedangkan storefront 16px, jadi ikon 20px menjadi 17,5px di admin. Itu
  memang diinginkan supaya ikon tetap sebanding dengan teks di temanya masing-masing.

Pemakai saat ini:

| Notifikasi | Berkas | Sumber |
|---|---|---|
| Flash storefront (sukses/info/error) | `components/shared/flash-messages.tsx` | flash session |
| Flash admin (sukses/info/error) | `components/admin/ui/flash-messages.tsx` | flash session |
| Undo keranjang | `pages/Public/Cart.tsx` | state klien |
| Notifikasi langsung admin | `components/admin/live-notification-manager.tsx` | Reverb + polling |

## Page family templates

| Family | Grid contract | Required shared states |
|---|---|---|
| Catalog, search, flash sale, promo | Breadcrumb/heading row, filter rail or toolbar, responsive product grid | loading, empty, filter reset, error |
| Product detail | 6/6 media and purchase columns on desktop; stacked on mobile | media empty, variant error, stock, reviews, related empty |
| Cart, checkout, order | 7/5 content-summary split on desktop; one column on mobile | empty cart, validation, shipping loading/error, success |
| Public CMS | reading column plus optional 4-column supporting media/grid | content empty, media missing, WhatsApp fallback |
| Admin index | heading/actions, filter row, full-width data region | loading, empty, error, pagination |
| Admin detail/form | primary form/detail column plus secondary summary/action column | dirty, validation, disabled, saved/error |
| Admin pengaturan (edit nilai) | lihat ADR-023: dibuka MODE RINGKASAN read-only, form aktif setelah tombol ubah | ringkasan nilai efektif, saved/error |

## Daftar platform (sosial & marketplace)

Komponen bersama: `components/public/storefront-platforms.tsx` (`StorefrontPlatforms`), dipakai
footer dengan prop `layout` grouped/inline, `variant` light/dark, `align`, `iconsOnly`.

- **Ikon platform WAJIB dari data, bukan daftar di kode.** `SocialLink.icon` dikirim server
  (`StorefrontPlatformSettings::forStorefront()` membaca `config/sitemap.php`), dan berlaku juga
  untuk platform yang belum punya tautan. Dilarang menyalin daftar ikon ke dalam komponen: salinan
  seperti itu tidak ikut berubah saat ikon diganti, sehingga tampilan jadi tidak konsisten.

Status duplikasi logika (selesai 2026-09-20):

- `channelOf` dan `isLiveHref` kini HANYA ada di `lib/platforms.ts`, dipakai bersama
  `storefront-platforms.tsx` (footer) dan `pages/Public/About.tsx`. Sebelumnya keduanya disalin di
  dua berkas. Dikunci `tests/frontend/platforms.test.ts`.

Utang yang masih terbuka (butuh keputusan owner):

- `pages/Public/About.tsx` masih memakai komponen platform LOKAL (`PlatformGroup`, `PlatformChip`)
  alih-alih `StorefrontPlatforms`, walau logika klasifikasinya sudah bersama. Penyatuan komponen
  belum dilakukan karena presentasinya memang berbeda: About memakai dua kartu panel berdampingan
  ("Ikuti kami", "Belanja di marketplace") dengan chip "Segera hadir" bila grup belum punya tautan
  aktif, sedangkan komponen bersama merender satu kolom bertingkat ("Marketplace", "Media Sosial").
  Menyatukan berarti mengubah tampilan About.

## Penutup halaman publik

Halaman publik boleh punya penutup, tidak wajib. Ketentuannya:

- **Halaman informasi** (beranda, tentang kami, FAQ, cara pemesanan, masalah & solusi, detail model)
  memakai `ClosingCTASection` sebagai penutup.
- **Halaman transaksi** (keranjang, checkout, konfirmasi pesanan, daftar pesanan, status pesanan,
  detail produk) TIDAK memakai banner penutup. Alasannya: halaman ini sudah punya aksi utama sendiri
  (tombol beli, checkout, lacak) dan menambah ajakan di bawahnya bisa mengalihkan perhatian dari
  langkah yang sedang dikerjakan. Penutup yang dipakai adalah kartu jaminan (`TrustAssuranceCard`).
- **Halaman legal** (kebijakan privasi, ketentuan layanan) tidak diberi ajakan jualan.
- **Halaman katalog dan daftar** (katalog, model produk, hasil pemasangan, ulasan) diakhiri daftar
  itu sendiri (pagination), tanpa banner penutup.

Keputusan ini mencatat keadaan yang berlaku, bukan menambah pekerjaan: 13 halaman yang tidak punya
banner penutup sudah sesuai ketentuan di atas.

## CTA storefront (teks, tombol, warna)

Teks CTA storefront hidup di KODE, bukan di panel admin. Sumber tunggalnya
`resources/js/lib/cta-content.ts`: konstanta TypeScript bertipe `CTA_CONTENT` (peta kunci halaman
ke `{ eyebrow, heading, actions, items }`) dan `CTA_DESTINATIONS` (daftar tujuan tombol yang
sah). Komponen storefront membacanya langsung lewat helper `ctaBlock(key)` dan
`ctaActionLabel(key, fallback)`.

**Tidak ada halaman pengaturan CTA (dihapus 2026-09-20).** Halaman `/admin/cta-storefront`,
controller `Admin\CtaSettingsController`, support `App\Support\CtaSettings`, berkas
`resources/js/lib/cta-live.json`, dan shared prop `ctaSettings` sudah TIDAK ADA; arsipnya ada di
`_archive/cta-storefront/`. Alasannya: lapisan admin itu tidak pernah dipakai (0 dari 23 blok
terisi di database) dan menimbulkan duplikasi sumber teks, karena `cta-live.json` harus dijaga
sinkron manual dengan kalimat yang sama di komponen. Mengubah teks CTA sekarang berarti
mengubah `resources/js/lib/cta-content.ts` lalu build ulang.

- **Tombol memakai KUNCI tujuan, bukan URL.** `destination` dipilih dari `CTA_DESTINATIONS`
  (kunci `whatsapp` atau nama route internal); href diselesaikan runtime oleh
  `resolveCtaActions` di `resources/js/lib/cta-actions.ts`, sehingga `whatsapp` selalu memakai
  nomor toko yang aktif tanpa disalin ke kode. DILARANG menulis URL bebas.
- **Batas (kontrak owner 2026-09-02):** maksimal 2 tombol dan 6 baris `items` per blok.
- **Blok `section` (tombol di samping judul section) hanya menyimpan LABEL.** Tautannya menempel
  pada tata letak section, jadi `destination` diabaikan untuk jenis blok ini.
- **Blok dinamis tidak boleh dikunci dari kode.** Daftar alasan belanja PDP (`pdp-benefits`)
  dihitung per produk (label garansi ikut promo, baris COD hilang saat produk tidak mendukung
  COD); `CTA_CONTENT` hanya menyediakan nilai bawaan, komponen tetap memakai hasil hitungannya.
- **Hanya blok yang BENAR-BENAR tampil di storefront boleh didaftarkan.** Sebelum menambah kunci
  baru, buktikan komponennya dirender; teks yang tidak pernah tampil hanya menyesatkan.
- **Warna tidak lagi dapat diatur admin.** Banner memakai token brand storefront (`bg-primary`);
  kolom `color` hex sudah tidak ada.
- **Jenis blok adalah penanda baca** di komentar `CTA_CONTENT`: `banner` (banner penutup
  halaman), `card` (kartu reusable halaman transaksi), `section` (tombol judul section beranda),
  `empty` (tampilan saat isi belum ada), `list` (daftar langkah/kartu).

## Teks komponen reusable storefront

Komponen yang dipakai BERULANG di beberapa halaman menyimpan kalimat bawaannya di
`resources/js/lib/cta-content.ts`, dan tetap menerima props supaya halaman baru bisa memakai
kalimatnya sendiri. Tidak ada lagi prop `ctaSettings`; props halaman menjadi CADANGAN bila
kuncinya tidak ada di `CTA_CONTENT`.

Pemakai saat ini:

| Komponen | Kunci `CTA_CONTENT` | Dipakai di |
|---|---|---|
| `TrustAssuranceCard` | `trust` | keranjang, checkout, konfirmasi pesanan, daftar pesanan, pelacakan |
| `SupportAction` (pelacakan) | `order-help` | halaman pelacakan pesanan |
| `ClosingCTASection` | nama halaman publik | beranda, detail model, tentang kami, FAQ, cara pemesanan, masalah & solusi |
| panel kontak `About` | `about-contact` | tentang kami |
| tombol judul section beranda | `home-model`, `home-popular`, `home-howto`, `home-installation`, `home-testimonial`, `home-review-website` | beranda |
| kondisi kosong beranda | `home-empty-model`, `home-empty-popular`, `home-empty-installation`, `home-empty-testimonial`, `home-empty-review` | beranda |
| `KamiBantuSection` | `home-help` | beranda |
| `SearchFallbackEmpty` | `catalog-empty` | katalog |
| daftar alasan belanja PDP | `pdp-benefits` (dinamis) | detail produk |

Aturannya: menambah komponen reusable baru yang copy-nya berubah-ubah wajib menambahkan
bloknya di `resources/js/lib/cta-content.ts` dan memakainya lewat helper `ctaBlock` /
`ctaActionLabel`, bukan menulis kalimat baru yang menyimpang di komponen.

## Mode ringkasan halaman pengaturan (ADR-023)

Halaman pengaturan TIDAK membuka form yang langsung aktif. Aturannya:

- Halaman dibuka menampilkan nilai yang berlaku sebagai bacaan (mode ringkasan), termasuk nilai
  yang benar-benar dipakai storefront saat ini, bukan kolom kosong.
- Tombol aksi utama di header berlabel kerja ("Ubah teks CTA", "Edit profil"), bukan "Simpan".
- Setelah menekan tombol itu baru form aktif, dengan "Batal" dan "Simpan".
- Simpan sukses WAJIB kembali ke ringkasan. Form tidak boleh tetap terbuka.
- Ringkasan bukan input `readOnly`: itu tampilan berbeda (kartu bacaan, pratinjau), bukan kontrol
  yang dikunci.

Pengecualian: halaman dashboard/beranda yang tugasnya menampilkan data, dan alur pembuatan entitas
baru (create) yang memang mengisi form dari nol.

Acuan implementasi: `resources/js/pages/Admin/TentangKami/Edit.tsx` (halaman CTA Storefront
dihapus 2026-09-20; arsipnya di `_archive/cta-storefront/`).

## QA gate

Visual QA checks the same route at 360, 768, 1024, and 1440px. At each width
verify: no horizontal overflow, aligned container edges, stable card rhythm,
readable copy, keyboard focus, empty/loading/error states, and no accidental
desktop-only action. The browser E2E suite is the functional gate; screenshots
are evidence, not a substitute for route/controller integration.

## Change control

Changes to tokens, grid breakpoints, icon family, or page-family structure must
update this contract, `frontend/docs/ADMIN-DESIGN-LANGUAGE.md` when the admin
layer is affected, and the relevant frontend skill before implementation.
Changes to routes, props, status enums, or API fields must also update the
Product Handoff, sitemap, schema/API contract, and the role/status contract.
