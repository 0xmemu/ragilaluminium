# Audit UX Storefront — 2026-08-09

Metode: Chrome headless (lokal) + puppeteer-core, 4 viewport (1280/768/375/320)
terhadap `http://209.23.10.62:8200` (prod), 5 halaman: home, /flash-sale,
/products/windows/sliding, /product/DBG-1, /contact.
Screenshot: `audit-ux-20260809/*.png` (20 viewport + 6 full-page).
Catatan: model AI tidak bisa melihat gambar — audit berbasis DOM/computed-style
+ verifikasi HTTP; screenshot tersedia untuk review manual.

## Status keseluruhan
- Semua halaman 200, tidak ada horizontal overflow di semua viewport.
- **0 gambar broken** (setelah paksa loading='eager' semua 12 img lazy load;
  HTTP 200 + Content-Type image/webp untuk r2.dev dan /storage/media).
- Hierarki heading OK (h1 sr-only untuk SEO; FLASH SALE 36px/800; halaman
  lain 18px/700).
- Flash Sale: countdown berjalan, daftar produk, filter model/desain/harga OK.

## Temuan P1 — data tes live di prod
1. **Produk "Debug" (DBG-1, id 101, status active)** — muncul di home
   "Paling Banyak Dipesan" dan listing /flash-sale; product page menampilkan
   "Foto Belum Tersedia". Produk uji harus dihapus/di-archive.
2. **50 testimonial "Pelanggan Uji …"** di tabel `cms_testimonials` — tampil
   di section home "Apa Kata Pelanggan Kami". Harus dibersihkan.
3. Media duplikat di `product_media` (mis. id 405/518, 406/519 — baris sama
   dari re-import) — hygiene minor.
4. `/contact` (slug kontak) konten CMS kosong → "Konten belum tersedia."
   di body; section info toko tetap tampil.

## Temuan P2 — media delivery
- Payload Inertia mengirim URL **r2.dev langsung** (`pub-1fc70757941f423c8041475955b8ec66.r2.dev`).
  r2.dev diketahui throttled/blocked (lihat MEMORY) — `rewriteR2DevToAppProxy`
  (ProductMedia.php) sudah ada tapi dormant: `MEDIA_LEGACY_PUBLIC_URL` &
  `MEDIA_PROXY_URL` kosong di .env.
- Config cache (`bootstrap/cache/config.php`, dibangun 09:18 hari ini) memuat
  `filesystems.disks.media.url = r2.dev` — nilai beku dari .env lama
  (AWS_URL sekarang kosong). **Jangan `config:clear` tanpa men-set
  MEDIA_PUBLIC_URL dulu**, karena `$disk->url()` akan jadi path telanjang
  (`/products/95/...`) yang 404.
- Opsi perbaikan (keputusan user):
  A. `MEDIA_PUBLIC_URL=https://ra.333labs.tech/storage/media` → semua URL
     root-relative `/storage/media/...`, dilayani nginx dari file lokal
     (file ada di `storage/app/public/media`, 702 webp). Tanpa ketergantungan R2.
  B. Arsitektur R2: `MEDIA_LEGACY_PUBLIC_URL=r2.dev` + `MEDIA_PROXY_URL`
     + lokasi nginx `/media-cdn` proxy_pass ke R2.

## Temuan P3 — tap target & kenyamanan (minor)
- Ticker announcement = link 382x14 / 303x14 / 248x14 px (14px tinggi) —
  terlalu kecil untuk tap mobile; pertimbangkan row tap 24-32px atau non-link.
- Nav desktop: Produk 39x44, Ulasan 36x44, Home 33x44, Promo 36x44 (tinggi 44
  OK, lebar <44 — minor).
- Mobile: "Beli Sekarang" 139x40, "Keranjang" 119x40 (40px vs ideal 44px).
- Footer links 32px tinggi (pola umum, minor); "Lihat semua →" 74x24.
- Breadcrumb link 17px, "Lacak pesanan" 79x16 — kecil tapi sekunder.

## Temuan P4 — infrastruktur (fixed hari ini)
- **PROD DOWN → FIXED**: `Class "Redis" not found` (phpredis tidak terpasang,
  sesi+queue pakai redis). Solusi: `apt-get install php8.3-redis` +
  restart php8.3-fpm. Semua halaman 200 setelahnya.

## Yang TIDAK menjadi masalah (false positive audit)
- h1 home "Bukaan presisi…" 16px = `sr-only` (SEO, bukan visual).
- "Broken images" awal = artifact lazy-load harness (scrol + `loading=eager`
  → 0 broken).
- /bouven 301 = redirect canonical (normal).
