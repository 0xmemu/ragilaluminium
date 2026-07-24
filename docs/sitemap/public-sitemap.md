# Sitemap publik — Ragil Aluminium

**IA / menu / daftar halaman:** route + config di repo; referensi Figma lama hanya konteks historis.  
**Style visual aktif:** `frontend/brand/BRAND-KIT.md` + `frontend/docs/DESIGN-SYSTEM.md`.  
**Binding runtime:** `config/sitemap.php` · `routes/web.php`.

Jangan menambah URL baru tanpa update dokumen ini + `config/sitemap.php` + `docs/api-and-routes-ragil-aluminium.md`.

Status:

| Status | Arti |
|--------|------|
| `implemented` | Route + Inertia page dikontrak |
| `planned` | Belum di nav live; jangan link sampai fitur resmi dikontrak |

---

## 0. Global navigation (dari Figma)

### Hamburger mobile / desktop

| Label | Route | Status |
|-------|-------|--------|
| Model Produk | `catalog.index` `/products` | implemented |
| Semua Produk | `catalog.index?sort=newest` | implemented |
| Promo | `catalog.promo` `/promo` | implemented |
| Flash Sale | `catalog.flash-sale` `/flash-sale` | implemented — listing SKU `promo_flash_sale` (bukan section home) |
| Hasil Pemasangan | `installation.index` `/hasil-pemasangan` | implemented |
| Ulasan | `reviews` `/reviews` | implemented |
| Informasi Toko | `about` `/about` | implemented |
| Lacak Pengiriman | `order.status` | implemented |
| Konsultasi Gratis | `contact` | implemented |

Hamburger tampil di kiri pada semua breakpoint dengan drawer surface polos tanpa garis pembatas. **Mobile header (Figma):** hamburger · kolom cari inline · keranjang — tanpa logo wordmark dan tanpa ikon Pesanan di header (Pesanan ada di bottom nav). **Mobile:** tidak menampilkan footer situs; navigasi bawah: Beranda · Model Produk · Pesanan · Tentang. `Model Produk` menampilkan submenu hover/focus berisi model visible dari taxonomy katalog; pada layar sentuh submenu dapat dibuka dengan tap. Desktop menampilkan strip `desktop_main` di bawah bar logo/search: **Flash Sale** (ikon petir, Signal Red, hover putih) → `/flash-sale`; **Model Produk** → `/products` (hub model); **Produk** → `/products?sort=newest` (Semua Produk / listing SKU); **Testimoni** → `/reviews`; **Hasil Pemasangan**; **Informasi Toko**. Promo tidak ada di nav utama (halaman `/promo` tetap ada). Tidak ada carousel Flash Sale di beranda.

---

## 1. Halaman Figma → backend (audit Phase 0)

| Figma frame | Path | Route | View | Status |
|-------------|------|-------|------|--------|
| Halaman Beranda | `/` | `home` | `Public/Home` | implemented |
| Halaman Semua Model Produk | `/products` | `catalog.index` | `Public/ModelProduk` | implemented — **kartu model** (`card-model-produk`), bukan daftar SKU; kartu → penjelasan model |
| Halaman Penjelasan Model | `/model/{category}/{model}` | `model.show` | `Public/ModelShow` | implemented — hero + detail + spesifikasi + inspirasi pemasangan (bukan listing SKU) |
| Halaman Semua Produk | `/products?sort=newest` | `catalog.index` | `Public/Catalog` | implemented — **kartu produk/SKU** (`card-produk`); berbeda dari hub model |
| Halaman Tampilan Model Produk | `/windows` (+ doors/bouven) | `catalog.windows` dll. | `Public/Catalog` | implemented — daftar produk (`card-produk`) |
| Halaman Promo | `/promo` | `catalog.promo` | `Public/Catalog` | implemented — tanpa sidebar; toggle model di atas galeri; strip Flash Sale di atas listing |
| Halaman Flash Sale | `/flash-sale` | `catalog.flash-sale` | `Public/Catalog` | implemented — banner Signal Red (petir kuning + countdown Jam/Menit/Detik); tanpa sidebar / tanpa Urutkan; toggle model di atas galeri; hanya `promo_flash_sale` / `flash_sale` saat periode `cms_pages.flash-sale.content.period` live |
| Halaman Isi Model Produk | filter model/design di katalog | `catalog.*` + query | `Public/Catalog` | implemented |
| Halaman Model Produk | `/products` | `catalog.index` | `Public/ModelProduk` | implemented (alias Semua Model) |
| Halaman Produk Satuan | `/product/{parent_sku}` | `product.show` | `Public/ProductDetail` | implemented |

**Breadcrumb PDP (Produk Satuan):**  
`Semua Model Produk` → `{Kategori Model Desain}` (filter `?model=&design=`) → `{short_name|name}`.

| Halaman Paling Banyak Dipesan | `/products?sort=popular` | `catalog.index` | `Public/Catalog` | implemented — daftar produk (`card-produk`) |
| Halaman Keranjang Belanja | `/cart` | `cart.index` | `Public/Cart` | implemented |
| Halaman Order | `/checkout` | `checkout.index` | `Public/Checkout` | implemented |
| Halaman Setelah CO TF / COD | `/order/{n}/confirmation` | `order.confirmation` | `Public/OrderConfirmation` | implemented |
| Pesanan Saya / detail & lacak (*guest, no login*) | `/order/status` | `order.status` | `Public/OrderStatus` | implemented |
| Halaman Cara Pemesanan | `/cara-pemesanan` | `cara-pemesanan` | `Public/HowToOrder` | implemented |
| Halaman Sering Ditanyakan | `/faq` | `faq` | `Public/Faq` | implemented |
| Halaman Masalah & Solusi | `/masalah-dan-solusi` | `masalah-dan-solusi` | `Public/MasalahSolusi` | implemented |
| Halaman Kebijakan Privasi | `/policy/privacy` | `privacy` | `Public/CmsPage` | implemented |
| Halaman Ketentuan Layanan | `/policy/terms` | `terms` | `Public/CmsPage` | implemented |
| Informasi Toko | `/about` | `about` | `Public/CmsPage` | implemented |
| Halaman Apa Kata Pelanggan / Ulasan | `/reviews` | `reviews` | `Public/Reviews` | implemented — hero dari `cms_pages.testimoni` + `cms_testimonials`; PDP menampilkan subset testimoni tertaut `product_id` |
| Halaman Hasil Pemasangan (listing) | `/hasil-pemasangan` | `installation.index` | `Public/Installations` | implemented — kartu per produk dari `product_media.is_installation` ∪ `cms_gallery_items` |
| Halaman Isi Hasil Pemasangan (detail galeri) | `/hasil-pemasangan/{parent_sku}` | `installation.show` | `Public/InstallationDetail` | implemented — galeri foto instalasi per produk; kartu listing + link di kartu produk terkait |
| Pencarian | `/products?q=` (redirect dari `/search`) | `catalog.index` | `Public/Catalog` | implemented — hasil di listing katalog; tidak ada halaman `/search` terpisah |
| Hubungi Kami | `/contact` | `contact` | `Public/CmsPage` | implemented |
| Halaman Retur Diproses / Retur Selesai | — | — | — | **planned** |

---

## 2. User flow (ringkas)

```text
[Beranda] → [Model Produk hub] → [Penjelasan Model] → [Listing SKU / PDP] → [Keranjang] → [Order/Checkout]
                ↓                              ↓
         [Info CMS / FAQ]              [Konfirmasi] → [Status pesanan]
```

Visual semua halaman mengikuti Brand Kit, Design System, dan page blueprints di `frontend/`.
