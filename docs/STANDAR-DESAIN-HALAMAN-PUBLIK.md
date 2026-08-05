# Standar Desain Halaman Publik

Berlaku untuk **semua halaman statis/konten** (kecuali Home, Catalog, Cart, Checkout).

---

## 1. Spacing Header

```
┌── section border-b bg-surface ────────┐
│  py-4 (16px) — breadcrumb (desktop)   │  ← hidden di mobile
│───────────────────────────────────────│
│  pt-4 (16px)                          │
│  [<] Judul Halaman (20px)             │  ← back button mobile only
│  pb-4 (16px)                          │
└───────────────────────────────────────┘
```

| Elemen | Class | Nilai |
|--------|-------|-------|
| Breadcrumb padding | `py-4` | 16px |
| Breadcrumb mobile | `hidden sm:block` | sembunyi |
| Heading atas | `pt-4` | 16px |
| Heading bawah | `pb-4` | 16px |
| Section konten | `py-4` | 16px |

## 2. Tipografi

| Elemen | Class | Ukuran |
|--------|-------|--------|
| Judul halaman (h1) | `text-xl font-bold tracking-tight` | 20px |
| Body text | `text-xs leading-5` | 12px |
| Subtitle | **dibuang** | — |

## 3. Tombol Back (Mobile)

```tsx
<div className="flex items-center gap-2">
  <button
    type="button"
    onClick={() => window.history.back()}
    className="flex shrink-0 items-center justify-center sm:hidden"
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
- Hanya muncul di mobile (`sm:hidden`)

## 4. Breadcrumb

```tsx
<div className="container-page hidden py-4 sm:block">
  <Breadcrumbs
    items={[
      { label: "Beranda", href: routeUrl("home") },
      { label: "Nama Halaman", href: null },
    ]}
  />
</div>
```

## 5. CTA Buttons

- Container: `flex items-center justify-center gap-3` (horizontal, **tanpa** `flex-wrap`)
- Tidak boleh tumpuk vertikal

## 6. Checklist Tambah Halaman Baru

- [ ] Breadcrumb `py-4` + `hidden sm:block`
- [ ] Heading `pt-4 pb-4`, rata kiri, `text-xl`
- [ ] Back button mobile `<` (`caret-left`) tanpa frame
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
- `pages/Public/Home.tsx` — **acuan utama**
- `components/public/flash-sale-stage.tsx`
- `components/public/paling-banyak-dipesan-section.tsx`
