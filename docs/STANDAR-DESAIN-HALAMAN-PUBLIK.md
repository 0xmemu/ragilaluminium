# Standar Desain Halaman Publik

Berlaku untuk **semua halaman statis/konten** (kecuali Home, Catalog, Cart, Checkout).

---

## 1. Spacing Header

```
┌── section border-b bg-surface ────────┐
│  py-2 (8px): breadcrumb (>= 768px)   │  ← sembunyi di bawah md, membawa tombol back
│───────────────────────────────────────│
│  pt-4 (16px)                          │
│  [<] Judul Halaman (20px)             │  ← back button hanya < md
│  pb-4 (16px)                          │
└───────────────────────────────────────┘
```

| Elemen | Class | Nilai |
|--------|-------|-------|
| Breadcrumb padding | `py-2` | 8px |
| Breadcrumb | `hidden md:block` | tampil mulai 768px |
| Heading atas | `pt-4` | 16px |
| Heading bawah | `pb-4` | 16px |
| Section konten | `py-4` | 16px |

## 2. Tipografi

| Elemen | Class | Ukuran |
|--------|-------|--------|
| Judul halaman (h1) | `text-xl font-bold tracking-tight` | 20px |
| Body text | `text-xs leading-5` | 12px |
| Subtitle | **dibuang** | - |

## 3. Tombol Back (Mobile)

```tsx
<div className="flex items-center gap-2">
  <button
    type="button"
    onClick={() => window.history.back()}
    className="flex shrink-0 items-center justify-center md:hidden"
    aria-label="Kembali"
  >
    <Icon name="caret-left" className="size-5" aria-hidden="true" />
  </button>
  <h1 className="text-xl font-bold tracking-tight text-foreground">
    Judul Halaman
  </h1>
</div>
```

- Icon: `caret-left` (bukan arrow-left)
- Ukuran: `size-5` (20px)
- Tanpa frame/border/wrapper
- Hanya muncul di bawah `md` (`md:hidden`), karena mulai `md` breadcrumb sudah
  tampil dan membawa tombol kembalinya sendiri. Lihat bagian 4.

## 4. Breadcrumb

```tsx
<div className="container-page hidden py-2 md:block">
  <Breadcrumbs
    items={[
      { label: "Beranda", href: routeUrl("home") },
      { label: "Nama Halaman", href: null },
    ]}
  />
</div>
```

### Kontrak tombol kembali (keputusan owner 2026-09-18: opsi C)

Breadcrumb tampil mulai `md` (768px). Tombol back milik halaman WAJIB disembunyikan
mulai `md` (`md:hidden`) supaya tidak ada dua tombol kembali sekaligus, sebab
komponen `Breadcrumbs` sudah merender tombol backnya sendiri
(`components/ui/breadcrumbs.tsx`).

| Lebar | Breadcrumb | Tombol back di samping judul |
|---|---|---|
| < 768px | sembunyi | tampil (`md:hidden`) |
| >= 768px | tampil (membawa tombol backnya sendiri) | sembunyi |

Halaman yang mengikuti kontrak ini: `components/public/page-top-bar.tsx` (dipakai
semua halaman listing/statis lewat frame), `Public/Cart.tsx`, `Public/Checkout.tsx`,
`Public/OrderConfirmation.tsx`, dan `Public/ProductDetail.tsx`.

### Tombol kembali breadcrumb SELALU tampil (koreksi 2026-09-18)

Sebelumnya tombol kembali di `components/ui/breadcrumbs.tsx` hanya dirender bila
`window.history.length > 1`. Akibatnya di desktop tombol kembali bisa HILANG sama
sekali, karena mulai `md` tombol di samping judul memang sengaja disembunyikan
(tabel di atas). Laporan owner: "kok tombol back di breadcrumb (desktop mode) tidak
selalu muncul di browser tertentu".

Akar masalah: `window.history.length` bukan penanda yang bisa dipercaya. Buka tab
baru, ketik alamat langsung, atau datang dari browser dalam aplikasi (Instagram,
TikTok, Facebook) bisa melaporkan 1 walau pembeli sebenarnya datang dari halaman
lain. Sebagian browser juga membatasi nilai itu demi privasi, sehingga hasilnya
berbeda antar browser.

Kontrak baru:

| Keadaan | Perilaku tombol |
|---|---|
| Riwayat browser ada (`history.length > 1`) | `window.history.back()` |
| Riwayat tidak ada | menuju href induk terdekat dari breadcrumb (mis. halaman model sebelum halaman produk), atau beranda bila tidak ada |

Logikanya ada di `lib/breadcrumb-back.ts` (`shouldUseHistoryBack`, `backFallbackHref`)
dan dikunci `tests/frontend/breadcrumb-back.test.ts`. Tombol TIDAK boleh
disembunyikan lagi, karena di desktop tidak ada tombol kembali pengganti.

## 5. CTA Buttons

- Container: `flex items-center justify-center gap-3` (horizontal, **tanpa** `flex-wrap`)
- Tidak boleh tumpuk vertikal

## 6. Checklist Tambah Halaman Baru

- [ ] Breadcrumb `py-2` + `hidden md:block`
- [ ] Heading `pt-4 pb-4`, rata kiri, `text-xl`
- [ ] Back button `<` (`caret-left`) tanpa frame, `md:hidden` (lihat bagian 4)
- [ ] **Tidak ada** subtitle di bawah heading
- [ ] Body text `text-xs leading-5`
- [ ] Section konten `py-4`
- [ ] Tidak pakai `text-center` pada heading
- [ ] Tidak pakai `section-space` (pakai `py-4`)

## 6. Halaman yang Sudah Mengikuti

| Halaman | File |
|---------|------|
| Hubungi Kami | `CmsPage.tsx` (isContact) |
| Cara Pemesanan | `HowToOrder.tsx` |
| Sering Ditanyakan | `Faq.tsx` |
| Informasi Toko | `InformasiToko.tsx` |
| Masalah & Solusi | `MasalahSolusi.tsx` |
| Ulasan Pelanggan | `Ulasan.tsx` |
| Reviews | `Reviews.tsx` |
| Hasil Pemasangan | `Installations.tsx` |
| Detail Pemasangan | `InstallationDetail.tsx` |
| Product Detail | `ProductDetail.tsx` (sebagian) |

## 7. Standar Carousel

Acuan: **Homepage** (`resources/js/pages/Public/Home.tsx`).
Semua carousel produk wajib mengikuti class yang sama.

### Track
```
scrollbar-x flex min-w-0 snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-3.5 md:pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] [scroll-behavior:auto] data-[dragging=true]:snap-none data-[dragging=true]:cursor-grabbing
```

### Card Width
```
w-[calc((100%-1rem)*6/13)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/3.5)] md:w-[calc((100%-1.5rem)/4)] xl:w-[calc((100%-2rem)/5)]
```

| Breakpoint | Item terlihat |
|-----------|--------------|
| Mobile | ~2.1 |
| SM | ~3.5 |
| MD | 4 |
| XL | 5 |

### Nav Button
- Desktop: `absolute top-1/2 z-20 hidden size-11 md:flex md:size-12`
- Mobile: tidak ditampilkan (pakai swipe horizontal)

### File yang Wajib Sinkron
- `pages/Public/Home.tsx`: **acuan utama**
- `components/public/flash-sale-stage.tsx`
- `components/public/paling-banyak-dipesan-section.tsx`

### Label & Countdown Flash Sale (satu sumber)

`components/public/flash-sale-stage.tsx` menyediakan dua komponen bersama supaya
tampilan Flash Sale tidak pernah berbeda antar tempat:

- `FlashSaleLabel`: ikon petir + teks `FLASH SALE` miring warna primary. Dipakai di
  headline carousel Flash Sale dan judul halaman `/flash-sale` (dibungkus `h1`/`h2`
  oleh pemanggil agar hierarki heading tetap benar).
- `FlashSaleCountdown`: hitung mundur kotak `hh:mm:ss` (sumber sama dengan countdown
  nav: harian, bergulir tengah malam, berhenti di akhir kampanye). Tampil hanya saat
  kampanye live.

Halaman `/flash-sale` memakai keduanya di header: label di posisi judul, hitung mundur
di kanan judul (lewat prop `titleRight` pada `ProductListingFrame` → `PageTopBar`).
