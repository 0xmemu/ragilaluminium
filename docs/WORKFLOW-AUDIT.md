# Workflow Audit — Simulasi Pelanggan & Admin Toko

**Tanggal:** 2026-07-22  
**Metode:** Simulasi journey end-to-end (kontrak SoT + routes/controllers/Inertia), bukan E2E browser.  
**SoT acuan:** `PRODUCT-HANDOFF.md`, `config/sitemap.php`, `config/admin-sitemap.php`, Stage 2/9B/10.

Status: `COMPLETE` | `PARTIAL` | `MISSING` | `BROKEN`

---

## Ringkasan

| Area | Verdict |
|------|---------|
| Inti jual beli publik (browse → cart → checkout → status) | **Bisa dipakai** (P0/P1/P2 publik ditutup 2026-07-22) |
| Inti operasi admin (order fulfill, katalog, promo, CMS, WA template) | **Bisa dipakai**; shell Resource\* diperkaya aksi + nav orphan wired |
| Mock / gimmick | **Selesai** — TEMP PROMO dihapus |
| Planned (sengaja belum) | Retur publik |

### Prioritas perbaikan

| P | Item | Dampak |
|---|------|--------|
| **P0** | ~~Hapus `TEMP PROMO PREVIEW`~~ **DONE** | — |
| **P0** | ~~Lengkapi konfirmasi order~~ **DONE** | — |
| **P0** | ~~Dashboard `order_status`~~ **DONE** | — |
| **P1** | ~~Anchor `#flash-sale`~~ **DONE** | — |
| **P1** | ~~Wilayah checkout gagal diam-diam~~ **DONE** | — |
| **P1** | ~~Qty cart tanpa batas stok~~ **DONE** | — |
| **P2** | ~~Contact: ikon WhatsApp + `tel:`~~ **DONE** | — |
| **P2** | ~~Shell Resource\* ops (Import/Media/Payments/Shipping)~~ **DONE** (aksi baris + link performa) | — |
| **P2** | ~~Orphan nav: payments, shipping, import-performance, WA log~~ **DONE** | CMS pages generik tetap orphan (disengaja) |
| **P2** | ~~Filter list pesanan payment/shipping/tanggal~~ **DONE** | — |
| **P3** | ~~Docs drift Masalah & Solusi planned~~ **DONE** (handoff + audit) | — |
| **P3** | ~~Peta beranda/ulasan/logo~~ **DONE** → `docs/STOREFRONT-HOME.md` | — |

---

## 1. Simulasi Pelanggan (Public)

### 1.1 Alur yang dijalankan

```text
Beranda → Model/Kategori → Filter → PDP → Pilih varian → Keranjang
       → Checkout (COD | Transfer + voucher + wilayah)
       → Konfirmasi → Cek status
+ Search, Promo, CMS, Konsultasi WA, Reviews
```

### 1.2 Skor journey

| # | Journey | Status | Catatan |
|---|---------|--------|---------|
| 1 | Home → kategori → filter → PDP → cart | **COMPLETE** | Stok clamp di cart; promo nyata |
| 2 | Search | **COMPLETE** | Header → `/products?q=`; `/search` redirect |
| 3 | Cart → checkout COD/TF → konfirmasi → WA | **COMPLETE** | Metode + rekening + CTA WA |
| 4 | Order status (session + form) | **COMPLETE** | |
| 5 | CMS (about, faq, contact, cara pesan, masalah-solusi, privacy, terms, reviews) | **COMPLETE** | Contact WA/`tel:` terpisah; logo platform di Informasi Toko + footer |
| 6 | Edge (empty cart/katalog, SKU invalid, validasi, CSRF) | **PARTIAL** | Empty state ada; 404 tidak branded |

### 1.3 Planned (MISSING dari nav — sesuai SoT)

- Halaman Retur Diproses / Retur Selesai  
- Detail galeri Hasil Pemasangan (saat ini section di `/reviews`)

### 1.4 Temuan detail pelanggan

1–6. **DONE** (lihat prioritas P0–P2 di atas). Detail implementasi: `docs/STOREFRONT-HOME.md` untuk beranda/ulasan/logo.

---

## 2. Simulasi Admin Toko

### 2.1 Alur yang dijalankan

```text
Login → Dashboard → Pesanan (status/bayar/kirim/WA)
      → Produk (CRUD/varian/atribut/media) → Import → Media hub
      → Harga & Promo → WhatsApp Otomatis
      → Monitoring → Pengaturan Website → Akun
```

### 2.2 Skor journey

| # | Journey | Status | Catatan |
|---|---------|--------|---------|
| 1 | Login → Dashboard → sidebar | **COMPLETE** | Deep-link `order_status` fixed; nav ops lengkap |
| 2 | Orders list → detail → status → pay → ship → WA log | **COMPLETE** | Filter payment/shipping/tanggal + export ikut filter |
| 3 | Produk → varian → atribut → media → import → hub | **PARTIAL** | Dedicated produk kuat; Import/Media hub = Resource\* + aksi baris |
| 4 | Harga & Promo | **COMPLETE** | |
| 5 | WhatsApp templates + connection + messages | **COMPLETE** | Log Pesan di sidebar Komunikasi |
| 6 | Monitoring | **COMPLETE** | Performa Import di nav |
| 7 | CMS Pengaturan Website | **COMPLETE** | `admin.pages.*` generik tetap orphan (editor khusus di nav) |
| 8 | Akun | **COMPLETE** | Equal-admin |
| 9 | Edge (failed rows, redownload) | **COMPLETE** | Aksi di list Import/Media hub |

### 2.3 Sidebar (setelah P2)

| Modul | Route | Nav |
|-------|-------|-----|
| Pembayaran | `admin.payments.*` | Core |
| Pengiriman | `admin.shipping.*` | Core |
| Log Pesan WA | `admin.whatsapp.messages.*` | Komunikasi |
| Performa Import | `admin.analytics.import-performance` | Monitoring |
| CMS Pages generik | `admin.pages.*` | Orphan disengaja |

### 2.4 Temuan detail admin

1. **Deep-link** — ~~DONE~~ `order_status`.
2. **Shell operasional** — ~~DONE~~ aksi baris Import/Media/Shipping; dedicated pages tetap opsional.
3. **Order list filters** — ~~DONE~~ payment / shipping / today|7d|range.
4. **Equal-admin** — sudah.

---

## 3. Matriks backend ↔ frontend (inti)

| Kapabilitas | Backend | UI | Gap |
|------------|---------|-----|-----|
| Catalog browse + PDP | ✅ | ✅ | — |
| Cart / checkout / voucher / COD fee / subsidi | ✅ | ✅ | — |
| Order status | ✅ | ✅ | — |
| Admin order fulfill + list filters | ✅ | ✅ | — |
| Import pipeline | ✅ queue | ⚠️ Resource\* + aksi | Dedicated UI opsional |
| Media download | ✅ queue | ✅ per-produk + hub aksi | — |
| WA otomasi Stage-8 | ✅ | ✅ | Manual resend belum |
| J&T | ✅ graceful | ✅ order detail + list shipping | — |
| CMS storefront | ✅ | ✅ editors khusus | pages generik orphan |

---

## 4. Rekomendasi sisa (opsional)

1. Dedicated pages Import/Media/Payments bila UX shell masih kurang nyaman.  
2. Manual resend template WA dari log.  
3. Branded public 404.

---

## 5. Batasan audit ini

- Tidak menjalankan Playwright penuh / klik browser pada setiap layar.  
- Tidak menguji credential production (Meta WA, J&T, R2) — hanya jalur kode + graceful degrade.  
- Konten CMS kosong di DB = “Konten belum tersedia” (bukan bug route).

---

*Update 2026-07-22: P2 admin nav/filters/shell actions + P3 docs drift ditutup.*
