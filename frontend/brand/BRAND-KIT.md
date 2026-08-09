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
- Aluminium: `#DDE2E0`
- Graphite: `#1A1D1C`
- Muted Graphite: `#5A635E` (adjusted to preserve WCAG AA on mineral-tint surfaces)
- Signal Red: `#C00000` (dari lingkaran logo `light-logo.png`)

### Usage ratio

- 80% Mineral Canvas dan Surface
- 15% Graphite dan Aluminium
- 5% Signal Red

### Rules

- Signal Red hanya untuk primary action, focus ring, active navigation, promo, dan error penting.
- Jangan memakai merah sebagai latar seluruh section.
- Graphite menggantikan pure black. Latar halaman memakai putih `#FFFFFF` (background / surface).
- Gunakan satu keluarga neutral dingin. Jangan mencampur beige hangat atau gray kebiruan acak.
- Semua kombinasi teks wajib memenuhi WCAG AA.

## Typography

Satu keluarga font untuk seluruh situs memakai Apple system font.

### Display

**Apple system font**, weight 600-800: `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif.

Dipakai untuk H1, H2, angka KPI besar, dan title utama. Tracking rapat (`tracking-tight` / sekitar `-0.025em`) diterapkan di **seluruh halaman** (public, admin, auth) untuk heading, eyebrow, label kolom, dan CTA. Hindari tracking lebar (`0.06em`–`0.16em`) dan `tracking-wide`. Akronim status seperti `FLASH SALE` tetap boleh uppercase, tetap dengan tracking rapat.
Headline public maksimal dua baris pada hero desktop.

### Body and UI

**Apple system font**, weight 400-700: `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif.

Dipakai untuk body, navigation, form, button, table, dan helper text. Body ideal 16-18px dengan
line-height 1.6.

### Technical data

SKU, dimensi, harga, order number, dan angka tabel memakai tabular numerals. System monospace
hanya boleh dipakai pada string teknis pendek, bukan body copy.

## Type hierarchy

- Display XL: clamp 44-72px, Apple system font 700, line-height 0.98-1.05
- H1: clamp 38-60px, Apple system font 700
- H2: clamp 30-46px, Apple system font 650; heading section homepage dikunci 18px
- H3: 22-28px, Apple system font 600
- Body large: 18px, Apple system font 450
- Body: 16px, Apple system font 450
- Small: 14px, Apple system font 500
- Micro label: 12px, Apple system font 650; bukan default pada setiap section

## Shape and material

- Surface utama (panel, filter, sheet): radius 14px (`--radius`).
- Control, search bar, dan button berlabel: **pill penuh** (`rounded-full`) — search header, CTA, dan input satu baris. Jangan siku tajam (`rounded-none`).
- **Listing cards** (product, model, testimonial, galeri hasil pemasangan): sudut siku — frame dan foto 1:1 tanpa radius.
- Chip/status dan **chip pilihan varian PDP**: tetap pill (`rounded-full`).
- Panel besar / sheet / textarea multi-baris: tetap `--radius` (14px), bukan pill.
- Shadow sangat lembut dan berwarna neutral; depth utama berasal dari spacing dan surface.
- Precision Frame hanya untuk hero media, galeri utama, dan featured product.

## Header storefront

- Header publik, navbar, footer, dan bottom navigation memakai **action graphite** `#262626` (`bg-action`) dengan teks/ikon terang. Aksen merah hanya pada search submit, badge keranjang, active indicator, dan Flash Sale.

## Wordmark and logo

Repo belum memiliki logo resmi. Sampai aset resmi tersedia:

- Gunakan wordmark teks “Ragil Aluminium” dengan Apple system font 700.
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
- **Jangan memakai em dash (—)** pada copy pelanggan. Pakai titik, koma, atau titik dua.
- Hindari kata informal atau meta seperti “mencolok”, “rekaan”, “dummy”. Tulis netral dan profesional.
