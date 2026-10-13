# Ragil Aluminium Brand Kit

## Brand idea

**Precision Domestic** memadukan ketelitian material aluminium dengan pengalaman belanja yang
tenang, jelas, dan dapat dipercaya. Tampilan tidak perlu terlihat seperti pabrik, marketplace,
atau showroom mewah generik.

## Brand roles

- Nama utama: **Ragil Aluminium**
- Nama panjang dari konfigurasi: **Jendela Ragil Aluminium**
- Tagline konfigurasi: **Pusat Belanja Jendela Aluminium**
- Bahasa pelanggan: Bahasa Indonesia
- Mata uang: IDR

## Color system

### Core

- Mineral Canvas: `#FFFFFF`
- Surface: `#FFFFFF`
- Aluminium: `#DEE3E0` (nilai token `--border` di `resources/css/app.css`; catatan lama `#DDE2E0` bergeser naik satu tingkat demi kontras)
- Graphite: `#1A1D1C` (lihat catatan status di bawah)
- Muted Graphite: `#5A635E` (adjusted to preserve WCAG AA on mineral-tint surfaces)
- Signal Red: `#C20000` (nilai token `--primary`; catatan lama `#C00000` bergeser gelap sedikit demi kontras. `#C00000` tetap menempel pada file logo `light-logo.png`)
- Near-black chrome: `#121212` (token `--header-bg`), lihat catatan status di bawah
- Copper: `#C66B2A` (token `--copper`), lihat catatan status di bawah

#### Catatan status nilai gelap

**Status 2026-09-20: DIDOKUMENTASIKAN, BELUM DIPAKAI di kode.** Nilai gelap yang benar-benar berjalan di kode adalah `#121212` lewat token
`--header-bg`, dipakai untuk header, footer, dan band gelap beranda. `#1A1D1C` tidak muncul di
kode mana pun (dicek dengan pencarian menyeluruh pada `resources/js`, `resources/css`, dan
`tailwind.config.js`). Nilai alternatif lain yang muncul hanya sekali adalah `#1A1E1C` di
`resources/js/components/shared/print-order-customer.tsx` (stylesheet cetak, nilai absolut).

Keputusan owner masih diperlukan: apakah `#1A1D1C` diimplementasikan sebagai token atau
ditandai tidak terpakai. Sampai keputusan itu diambil, nilai ini hanya berlaku sebagai
referensi merek, bukan kontrak kode. Klaim lama `bg-action` `#262626` untuk chrome storefront
juga **digantikan**: kelas `bg-action` tidak dipakai di mana pun dan komponen memakai
`bg-header-bg` `#121212`.

#### Catatan Copper (dokumentasi baru, sudah dipakai di kode)

**Status 2026-09-20: DIPAKAI di kode, BARU didokumentasikan sekarang.** Token `--copper` sudah
ada di `resources/css/app.css` dan sudah dipakai, tetapi sebelum 2026-09-20 belum tercatat di
dokumen mana pun. Perannya: aksen garansi dan kepercayaan brand, dipakai di
`resources/js/components/public/product-card.tsx` (ikon SealCheck label garansi) dan
`resources/js/components/public/trust-assurance-card.tsx`.

Nilainya berbeda per tema, jadi jangan mengasumsikan satu hex:

| Konteks | Token | Hex | HSL |
|---|---|---|---|
| Storefront | `--copper` | `#C66B2A` | `25 65% 47%` |
| Admin "Ink" gelap | `--copper` | `#E2975A` | `27 70% 62%` |
| Admin "Ink" terang | `--copper` | `#9B5727` | `25 60% 38%` |

Token pasangannya `--copper-foreground` juga berbeda per tema. Copper dipilih lebih hangat
dari warning emas supaya klaim garansi tidak terbaca sebagai peringatan. Rincian lapisan admin
ada di `frontend/docs/ADMIN-DESIGN-LANGUAGE.md`.

### Usage ratio

- 80% Mineral Canvas dan Surface
- 15% Graphite dan Aluminium
- 5% Signal Red

### Rules

Catatan: aturan di bawah adalah lapisan storefront. Panel admin tunduk pada nilai token
lapisan "Ink" yang berbeda, lihat `frontend/docs/ADMIN-DESIGN-LANGUAGE.md`.

- Signal Red hanya untuk primary action **di storefront**, focus ring, active navigation, promo, dan error penting. **Cakupan (2026-09-20):** peran "primary action" DIBATASI pada storefront. Panel admin memakai primary monokrom (putih solid di mode gelap, obsidian di mode terang) sesuai `frontend/docs/ADMIN-DESIGN-LANGUAGE.md`. Di panel admin Signal Red tetap dipakai untuk peran semantik (warning, destructive) dan aksen, bukan aksi utama.
- Jangan memakai merah sebagai latar seluruh section.
- Graphite menggantikan pure black. Latar halaman memakai putih `#FFFFFF` (background / surface). Nilai gelap yang berlaku di kode adalah `#121212` (`--header-bg`), bukan `#1A1D1C`.
- Gunakan satu keluarga neutral dingin. Jangan mencampur beige hangat atau gray kebiruan acak.
- Semua kombinasi teks wajib memenuhi WCAG AA.

## Typography

Satu keluarga font untuk seluruh situs memakai **Inter self-hosted**. Klaim lama "Apple system
font" dicatat sebagai digantikan.

Inter disajikan sebagai variable font weight 400 sampai 800 lewat dua `@font-face` di
`resources/css/app.css` (baris 6-19), subset latin dan latin-ext, file
`public/fonts/inter/inter-latin-var.woff2` dan `public/fonts/inter/inter-latin-ext-var.woff2`. Pemetaan
`font-sans` dan `font-display` di `tailwind.config.js` adalah
`['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif']`, jadi system font
hanya cadangan bila Inter gagal dimuat.

Alasan peralihan: Apple system font (`-apple-system`, `BlinkMacSystemFont`) hanya tersedia di
perangkat Apple. Di Windows dan Android, font itu jatuh ke `Segoe UI` atau Roboto, sehingga
bobot, lebar, dan metrik huruf berbeda antar perangkat. Inter self-hosted membuat tampilan sama
di semua perangkat dan tidak bergantung pada font sistem pengunjung.

### Display

**Inter**, weight 600-800 (variable range 400 sampai 800).

Dipakai untuk H1, H2, angka KPI besar, dan title utama. Tracking rapat (`tracking-tight` / sekitar `-0.025em`) diterapkan di **seluruh halaman** (public, admin, auth) untuk heading, eyebrow, label kolom, dan CTA. Hindari tracking lebar (`0.06em`–`0.16em`) dan `tracking-wide`. Akronim status seperti `FLASH SALE` tetap boleh uppercase, tetap dengan tracking rapat.
Headline public maksimal dua baris pada hero desktop.

### Body and UI

**Inter**, weight 400-700.

Dipakai untuk body, navigation, form, button, table, dan helper text. Body ideal 16-18px dengan
line-height 1.6.

### Technical data

SKU, dimensi, harga, order number, dan angka tabel memakai tabular numerals. System monospace
hanya boleh dipakai pada string teknis pendek, bukan body copy.

## Type hierarchy

- Display XL: clamp 44-72px, Inter 700, line-height 0.98-1.05
- H1: clamp 38-60px, Inter 700
- H2: clamp 30-46px, Inter 650; heading section homepage dikunci 18px
- H3: 22-28px, Inter 600
- Body large: 18px, Inter 450
- Body: 16px, Inter 450
- Small: 14px, Inter 500
- Micro label: 12px, Inter 650; bukan default pada setiap section

## Shape and material

- Surface utama (panel, filter, sheet): radius 14px (`--radius`).
- Control, search bar, dan button berlabel: **pill penuh** (`rounded-full`), yaitu search header, CTA, dan input satu baris. Jangan siku tajam (`rounded-none`).
- **Listing cards** (product, model, testimonial, galeri hasil pemasangan): sudut siku, frame dan foto 1:1 tanpa radius.
- Chip/status dan **chip pilihan varian PDP**: tetap pill (`rounded-full`).
- Panel besar / sheet / textarea multi-baris: tetap `--radius`, bukan pill.
- Nilai radius di atas adalah konteks storefront (`--radius` `0.875rem`, `--radius-control`
  `0.5rem`). Panel admin memakai radius lebih rapat (`--radius` `0.5rem`, `--radius-control`
  `0.375rem`), lihat `frontend/docs/ADMIN-DESIGN-LANGUAGE.md`.
- Shadow sangat lembut dan berwarna neutral; depth utama berasal dari spacing dan surface.
- Precision Frame hanya untuk hero media, galeri utama, dan featured product.

## Header storefront

- Header publik, navbar, footer, dan bottom navigation memakai **near-black** `#121212` lewat
  token `bg-header-bg` (`--header-bg`), dengan teks/ikon terang. Aksen merah hanya pada search
  submit, badge keranjang, active indicator, dan Flash Sale.
- Klaim lama `#262626` lewat kelas `bg-action` **digantikan**: kelas `bg-action` tidak dipakai
  di kode mana pun, sedangkan `bg-header-bg` dipakai di `public-header.tsx` (baris 324 dan 710),
  `public-footer.tsx` (baris 77), dan `home-sections.tsx` (baris 308). Di panel admin
  `--header-bg` bernilai `#FFFFFF`.

## Wordmark and logo

Repo belum memiliki logo resmi. Sampai aset resmi tersedia:

- Gunakan wordmark teks “Ragil Aluminium” dengan Inter 700.
- Jangan membuat simbol, monogram, atau logo permanen baru.
- Sisakan slot rasio horizontal untuk file resmi di kemudian hari.
- Logo resmi tidak boleh diubah warna, proporsi, atau clear space tanpa persetujuan brand owner.

## Photography

- Prioritaskan foto produk dan hasil pemasangan asli.
- Gunakan derivative `thumb`, `card`, dan `pdp` dari media backend.
- Latar foto sebaiknya terang, natural, dan menunjukkan skala produk.
- Hindari stock photo rumah mewah generik, render 3D palsu, dan filter warna berlebihan.
- Placeholder hanya untuk state data kosong dan harus netral, bukan visual hero permanen.

## Voice

- Jelas, langsung, membantu.
- Gunakan kata kerja yang menjelaskan hasil: “Lihat produk”, “Tambah ke keranjang”, “Cek pesanan”.
- Hindari klaim yang tidak memiliki data, urgensi stok palsu, dan jargon teknis tanpa penjelasan.
- Satu intent memakai satu label CTA yang konsisten di seluruh flow.
- **Jangan memakai em dash (U+2014)** pada copy pelanggan. Pakai titik, koma, atau titik dua.
- Hindari kata informal atau meta seperti “mencolok”, “rekaan”, “dummy”. Tulis netral dan profesional.
