# UI Consistency Contract · Ragil Aluminium

Status: canonical for active Inertia + React pages (2026-08-06).

This contract replaces legacy visual references to `docs/DESIGN.md`, Blade page
partials, Figma exports, and the former `website_2.0`/`website_3.0` split. The
active implementation is `resources/js` with tokens in `resources/css/app.css`.
It governs new UI and targeted visual fixes; it does not change routes, props,
database fields, or API payloads.

## Foundations

- Font: Apple system font (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`,
  sans-serif) for body, headings, labels, and controls. Use the
  existing `font-sans`/`font-display` mappings; do not introduce a second font.
- Canvas: Mineral Canvas `#FFFFFF`; heading text `#333333`; action text
  `#262626`; body/description text `#737373`; border Aluminium `#DDE2E0`;
  action/promo Signal Red `#C00000`.
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
- Text-heavy content is capped at `68ch`; tables and product grids may use the
  full container.

## Shape, type, and interaction

- Buttons and single-line inputs use the shared pill shape. Textareas and
  content panels use the existing control/panel radius tokens; listing cards
  stay edge-led and do not gain random rounded corners.
- Public navigation chrome (header, navbar, footer, and mobile bottom
  navigation) uses action graphite `#262626` via `bg-action`; header search is
  `36px` high via `h-9` at all breakpoints.
- Headings use sentence case in Indonesian copy unless a brand or proper noun
  requires otherwise. Existing user-facing copy is the assertion source for
  E2E tests; tests must not invent title-case variants.
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

Utang yang diketahui (belum dikerjakan):

- `pages/Public/About.tsx` masih memakai implementasi platform LOKAL (`PlatformGroup`,
  `PlatformChip`, `channelOf` sendiri) alih-alih `StorefrontPlatforms`, sehingga `channelOf` ada di
  dua berkas. Penyatuan belum dilakukan karena presentasinya memang berbeda: About memakai dua
  kartu panel berdampingan ("Ikuti kami", "Belanja di marketplace") dengan chip "Segera hadir" bila
  grup belum punya tautan aktif, sedangkan komponen bersama merender satu kolom bertingkat
  ("Marketplace", "Media Sosial"). Menyatukan berarti mengubah tampilan About, jadi butuh keputusan
  owner. Yang SUDAH diperbaiki: ikon chip placeholder di About diambil dari data, bukan hardcode.

## CTA storefront (teks, tombol, warna)

Semua CTA storefront diatur dari satu tempat: Pengaturan Website > CTA Storefront, dibaca lewat
prop bersama `ctaSettings`. Mencakup banner penutup per halaman DAN kartu reusable.

- **Tekstur data:** tiap blok punya `eyebrow`, `heading`, dan `actions`. Tombol berbentuk
  `{ label, destination, variant }` dengan `destination` dari `CtaSettings::DESTINATIONS`
  (kunci `whatsapp` atau nama route internal). DILARANG menyimpan URL bebas: jalur konsultasi dan
  checkout harus tetap utuh walau admin salah mengisi.
- **Batas tombol:** maksimal 2 per blok (kontrak owner 2026-09-02). Tombol tanpa label atau
  bertujuan tidak dikenal dibuang server. Daftar tombol kosong berarti blok itu kembali memakai
  tombol LIVE (`INITIAL_ACTIONS`), bukan berarti CTA tanpa tombol.
- **Warna:** satu `color` global (hex 6 digit, bawaan `#C00000`) dipakai semua banner. Server
  memvalidasi format; nilai tidak sah ditolak validasi, bukan disimpan.
- **Blok berbentuk daftar memakai `items`, bukan `actions`.** Sebagian CTA berupa kumpulan
  lencana/poin (mis. alasan belanja di PDP), bukan satu kop + judul. Untuk blok itu admin
  mengelola daftar baris teks (maksimal 6) dan pratinjau admin menampilkan daftarnya, bukan
  banner merah.
- **Hanya blok yang BENAR-BENAR tampil di storefront boleh didaftarkan.** Blok yang sumbernya
  komponen mati (tidak dirender) tidak didaftarkan: mengatur teks yang tidak pernah tampil
  hanya menyesatkan admin. Sebelum menambah kunci blok, buktikan komponennya dirender.
- **Pratinjau admin wajib mencerminkan CTA asli:** halaman pengaturan menampilkan pratinjau
  memakai WARNA dan TOMBOL yang sedang diatur, sehingga yang dilihat admin sama dengan yang
  tampil di storefront.

Komponen yang dipakai BERULANG tidak boleh menyimpan copy-nya sendiri bila isinya kalimat yang
mungkin berubah. Tambahkan kunci di `CtaSettings::PAGES` + `INITIAL_TEXT` + `INITIAL_ACTIONS`, lalu
baca lewat prop `ctaSettings` dengan teks kode sebagai cadangan.

## Teks komponen reusable storefront

Komponen yang dipakai BERULANG di beberapa halaman tidak boleh menyimpan copy-nya sendiri di kode
bila isinya kalimat yang mungkin berubah (jaminan, ajakan, bantuan). Copy seperti itu ditaruh di
`CtaSettings` dan dibaca lewat prop `ctaSettings`, dengan teks kode sebagai CADANGAN bila
pengaturan belum tersedia.

Pemakai saat ini:

| Komponen | Kunci pengaturan | Dipakai di |
|---|---|---|
| `TrustAssuranceCard` | `trust` | keranjang, checkout, konfirmasi pesanan, daftar pesanan, pelacakan |
| `SupportAction` (pelacakan) | `order-help` | halaman pelacakan pesanan |
| `ClosingCTASection` | nama halaman publik | beranda, detail model, tentang kami, FAQ, cara pemesanan, masalah & solusi |

Aturannya: menambah komponen reusable baru yang copy-nya berubah-ubah wajib menambah kuncinya di
`CtaSettings::PAGES` + `INITIAL_TEXT` dan memakainya lewat `forPage(<kunci>)`, bukan menulis
kalimat baru di komponen.

## Mode ringkasan halaman pengaturan (ADR-023)

Halaman pengaturan TIDAK membuka form yang langsung aktif. Aturannya:

- Halaman dibuka menampilkan nilai yang berlaku sebagai bacaan (mode ringkasan), termasuk nilai
  bawaan yang belum pernah disimpan admin.
- Tombol aksi utama di header berlabel kerja ("Ubah teks CTA", "Edit profil"), bukan "Simpan".
- Setelah menekan tombol itu baru form aktif, dengan "Batal" dan "Simpan".
- Simpan sukses WAJIB kembali ke ringkasan. Form tidak boleh tetap terbuka.
- Ringkasan bukan input `readOnly`: itu tampilan berbeda (kartu bacaan, pratinjau), bukan kontrol
  yang dikunci.

Pengecualian: halaman dashboard/beranda yang tugasnya menampilkan data, dan alur pembuatan entitas
baru (create) yang memang mengisi form dari nol.

Acuan implementasi: `resources/js/pages/Admin/TentangKami/Edit.tsx` dan
`resources/js/pages/Admin/CtaStorefront/Edit.tsx`.

## QA gate

Visual QA checks the same route at 360, 768, 1024, and 1440px. At each width
verify: no horizontal overflow, aligned container edges, stable card rhythm,
readable copy, keyboard focus, empty/loading/error states, and no accidental
desktop-only action. The browser E2E suite is the functional gate; screenshots
are evidence, not a substitute for route/controller integration.

## Change control

Changes to tokens, grid breakpoints, icon family, or page-family structure must
update this contract and the relevant frontend skill before implementation.
Changes to routes, props, status enums, or API fields must also update the
Product Handoff, sitemap, schema/API contract, and the role/status contract.
