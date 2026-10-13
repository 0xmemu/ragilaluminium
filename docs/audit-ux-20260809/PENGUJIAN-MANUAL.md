# Pengujian Manual — Storefront Mobile & Admin Dashboard Desktop

Tanggal: 2026-08-09
Branch: `feat/admin-ui-redesign`
Metode: pengujian manual (tanpa Playwright / audit otomatis), sesuai keputusan tim.
Base commit polish: `216d234` (build hijau, PHPUnit 263 passed, app melayani 200).

Gunakan DevTools (toggle device toolbar) dengan lebar viewport:
- Storefront mobile: **320 / 375 / 414 px**
- Admin desktop: **1280 / 1440 px**

---

## A. Storefront Mobile (320 / 375 / 414)

### A1. Standar halaman publik
Periksa pada /flash-sale, /kontak, halaman CMS, /faq, /cara-pesan, /pusat-bantuan dsb.
- [ ] Breadcrumb hanya tampil di `sm:` ke atas (tersembunyi di mobile).
- [ ] Tombol kembali (caret-left `size-5`) di samping judul halaman.
- [ ] Heading h1 `text-xl` (20px) font-bold — CATATAN: sudah diseragamkan dari `text-lg` (18px) di 15 halaman.
- [ ] Konten tidak meluber horizontal (tidak ada scroll-x tak diinginkan).

### A2. Tap target & kenyamanan (P3)
- [ ] Link ticker/promo di announcement bar memiliki area tap ≥ 32px (sudah diberi `py-2`).
- [ ] Tombol "Beli Sekarang" & "Keranjang" di ProductDetail ≥ 44px (sudah `h-10`→`h-11`).
- [ ] Link "Lihat semua"/"Lihat semua →" ≥ 32px (flash-sale banner sudah `h-6`→`h-8`; lainnya sudah `min-h-11`).
- [ ] Link footer `min-h-8` (≥ 32px) dan jarak antar link nyaman untuk jari.

### A3. Halaman utama (Home)
- [ ] Announcement bar tidak menutupi konten & bisa ditutup (X).
- [ ] Bagian hero/mega menu tidak meluber; CTA utama terlihat jelas.
- [ ] Kartu produk rapi, teks tidak terpotong, tidak ada tumpang tindih.
- [ ] Mobile bottom nav & sticky CTA tidak menutupi konten terakhir (spacer cukup).

### A4. Alur & kosmetik
- [ ] Tidak ada horizontal overflow di 320px paling sempit.
- [ ] Kontras teks memenuhi WCAG AA (skor audit sebelumnya OK).
- [ ] Fokus keyboard terlihat saat tab navigation.

---

## B. Admin Dashboard Desktop (1280 / 1440)

### B1. Layout
- [ ] Sidebar tetap (sticky) 15rem; konten mengisi sisa lebar tanpa desak.
- [ ] Header sticky dengan backdrop-blur, search `⌘K`, toggle tema, lonceng notif, menu akun.
- [ ] Skip-link "Lewati ke konten admin" bekerja (fokus keyboard).

### B2. Kartu KPI & omzet
- [ ] Angka memakai `tabular-nums` (sejajar vertikal) — sudah diterapkan.
- [ ] DeltaBadge (naik/turun) konsisten warnanya.
- [ ] Grid KPI responsif: 1 kolom → 2 → 3/5 sesuai lebar.

### B3. Tabel & resource pages
- [ ] Tabel orders terbaru: kolom sejajar, status badge mudah dibaca, tidak meluber.
- [ ] Halaman resource (Orders/Products dst.) konsisten memakai komponen shared (Button, Input, Select, Pagination, StatusBadge, EmptyState).
- [ ] Pagination & filter bekerja; empty state tampil saat tidak ada data.

### B4. Aksesibilitas
- [ ] Fokus terlihat; area target tombol ≥ 32px.
- [ ] Mode gelap/terang tidak merusak kontras.

---

## C. Temuan & catatan
- Temuan yang sudah diperbaiki di commit `216d234`:
  - Tap target ticker promo, tombol Beli/Keranjang, dan link "Lihat semua".
  - Konsistensi heading h1 (text-lg → text-xl) di 15 halaman publik.
- Yang dianggap sudah sesuai standar dan tidak diubah:
  - Footer link sudah `min-h-8`.
  - Admin dashboard sudah memakai `tabular-nums` + komponen shared.
- Verifikasi visual final terhadap browser fisik tetap direkomendasikan sebagai langkah QA dirilis.