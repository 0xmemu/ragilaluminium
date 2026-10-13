# Arsip status AGENTS.md (2026-08-11 sampai 2026-08-13)

Dipindah dari `AGENTS.md` pada 2026-09-21 karena berkas itu dimuat otomatis ke
setiap sesi dan isi ini sudah basi. Dipindah APA ADANYA, tidak disunting.

**Berkas ini arsip beku. JANGAN dianggap kondisi terkini.** Untuk kondisi
sekarang, lihat `docs/AGENT-LOG.md`, `git log`, dan `docs/TEKNIS/`.

## Current status

### 2026-08-13 - Pill nav rounded-md + hapus dropdown Kategori

**Done (commit batch ini):**
- Semua pill/tab kategori & model (homepage segment tab, nav katalog CatalogNav,
  tabs ModelProduk) diubah rounded-lg -> rounded-md.
- Dropdown "Kategori lain" dihapus dari CategoryMenu (homepage) dan CatalogNav -
  urutan pill dikelola langsung oleh admin di dashboard, semua pill tetap
  terlihat via scroll. CATEGORY_LINKS + import dropdown ikut dibersihkan.

**File diubah:** category-menu.tsx, catalog-nav.tsx, pages/Public/ModelProduk.tsx.

### 2026-08-13 - Menu kategori homepage gaya segment tab Zalora

**Done (commit batch ini):**
- CategoryMenu homepage di-restyle mengikuti segment tab Zalora: pill abu muda
  tanpa border (bg-secondary), pill aktif hitam + teks putih (cursor-default),
  padding px-4 py-2.5 rounded-lg, mr-2 antar pill, pill pertama inset kiri di
  mobile (ml-4, hilang di desktop), font text-sm font-medium.
- Container scroll horizontal tanpa scrollbar (scrollbar-none + overflow-x-scroll
  + overscroll-x-contain), rata tengah di layar besar (xl:justify-center - dipakai
  xl bukan md agar 8 pill tidak terpotong sisi kirinya saat overflow).
- Edge fade kiri/kanan ala Zalora hanya di mobile/tablet (md:hidden, pointer-events-none).
- Section bg putih (bg-background) + border-b, padding vertikal py-3 (12px).
- Iterasi berikutnya: wrapper full-bleed tanpa container padding (hanya first:ml-4
  di mobile), section py-2, pill px-3.5 py-2 - padding lebih ramping (b3c3a8d lanjutan).

**File diubah:** resources/js/components/public/category-menu.tsx.

### 2026-08-12 - "Lihat semua" accent secondary biru (#2563EB)

**Done (commit setelah batch ini):**
- Semua elemen ber-maksud "lihat semua" (link teks+panah, pill mobile, "Lihat semua ulasan") di seluruh website diubah warnanya jadi biru slate/navy #2563EB, hover lebih gelap #1D4ED8; panah ikut warna teks (currentColor). Ukuran font/alignment/spacing tidak berubah.
- File: home-sections (SectionTitle), product-related-section, product-info-sections (2), paling-banyak-dipesan (link + pill), home-carousels (pill), flash-sale-stage (pill), ModelDetail (2).
- Yang TIDAK diubah: "Lihat semua →" putih di banner flash sale merah (kontras), varian on-primary (bg gelap), tombol filter "Lihat semua model" di sidebar katalog (CTA filter), harga/badge/promo bar.

### 2026-08-12 - Homepage: bar promo slider vertikal -> horizontal ticker (translateX)

**Done (commit setelah batch ini):**
- Arah slider bar promo diubah dari vertikal (translateY, rata tengah) menjadi horizontal ticker (translateX, rata kiri): track flex-row, tiap slide w-full basis-full shrink-0, konten justify-start, teks whitespace-nowrap satu baris (bullet + teks sebaris).
- Pesan aktif keluar ke kiri, pesan berikutnya masuk dari kanan. Tetap 3 detik diam + transisi 400ms (duration-[400ms] ease-emphasized), tanpa marquee infinite.
- Loop seamless tetap (duplikat item pertama + reset timeout 450ms), tinggi bar tetap h-8, overflow-hidden, pause hover/focus, prefers-reduced-motion nonaktifkan autoplay & transisi.

**File diubah:** resources/js/components/public/home-hero.tsx.

### 2026-08-12 - Homepage: bar promo merah marquee -> discrete announcement slider

**Done (commit setelah batch ini):**
- Bar promo merah di atas banner diganti dari continuous marquee (announcement-marquee) menjadi discrete announcement slider stateful: satu teks promo tampil penuh 3 detik, lalu bergeser vertikal 400ms (translateY, ease-emphasized) ke teks berikutnya. Tidak ada animasi berjalan terus-menerus / CSS animation infinite.
- Loop seamless: item pertama diduplikasi di akhir track; dari item terakhir maju ke duplikat, lalu reset diam-diam ke index 0 (timeout 450ms + cadangan transitionend) supaya tidak scroll-back terlihat.
- Tinggi bar tetap sama (h-8 = 32px, sama dengan py-2 + text-xs sebelumnya), tetap full-width edge-to-edge tanpa rounded, overflow-hidden.
- Pause saat hover/focus; prefers-reduced-motion menonaktifkan autoplay DAN transisi (item pertama tampil statis).

**File diubah:** resources/js/components/public/home-hero.tsx.

### 2026-08-12 - Homepage: strip marquee full-width + timing carousel promo (5s / 350ms)

**Done (commit setelah batch ini):**
- Strip marquee promo di atas banner -> FULL-WIDTH edge-to-edge: dipindah keluar dari container ber-padding (jadi sibling langsung section, bukan full-bleed hack), hapus rounded-md, tanpa padding/margin horizontal, teks marquee tetap berjalan (announcement-marquee). Tidak menyebabkan horizontal overflow (overflow-hidden).
- Timing carousel promo: autoplay 5 detik per slide (sebelumnya 6s), perpindahan pakai transform translateX dengan transisi 350ms (duration-[350ms], ease-emphasized = cubic-bezier), loop tak terbatas, tanpa animasi terus-menerus.
- Timer autoplay di-reset tiap navigasi manual (klik dot/panah) supaya slide tidak langsung berpindah lagi setelah interaksi.
- Pagination dot aktif -> merah (bg-primary, w-3.5), nonaktif bg-primary/40 (w-1.5) - kontras dengan strip merah/banner. Pause saat hover/focus tetap, hormati prefers-reduced-motion.

**File diubah:** resources/js/components/public/home-hero.tsx.

### 2026-08-12 - Homepage: navbar kategori model-only, banner 10 slot polos, marquee berjalan

**Done (commit setelah batch ini):**
- Navbar kategori homepage -> hanya pill model (Boven Jungkit, Boven Sliding, Jendela Swing, dst; 8 model), tanpa link desain Ornamen/Polos (masuk dalam 1 model, tampil bersamaan di halaman model). Label pendek dari CatalogLabels (category + model), bukan nama CMS. Gaya pill = contoh nav katalog: frame abu-abu (border-border bg-surface) / hitam saat aktif (bg-foreground), font 12px, padding frame 12px, plus dropdown "Kategori lain" (kategori + model).
- Banner promo homepage -> 10 slot polos (placeholder bg-secondary, tanpa konten). Admin tinggal isi gambar banner sendiri via CMS Banner (cms_banners) - slide manual tampil lebih dulu, placeholder mengisi sampai 10. Ukuran = lebar container (padding halaman !px-5 md:!px-8 lg:!px-12 py-[10px]); kartu p-3/rounded lama dihapus.
- Marquee berjalan (announcement-marquee) di atas banner promo - men-scroll poin layanan (COD, garansi, kirim, harga pabrik). Konten statis, tidak menduplikasi AnnouncementBar.
- Landing slide teks ("Diskon 20%", IntroCards) dihapus dari carousel hero.

**File diubah:** app/Services/ModelProductService.php, app/Support/HomepagePromotions.php, app/Support/ActiveAnnouncements.php, resources/js/components/public/category-menu.tsx, resources/js/components/public/home-hero.tsx.

**Catatan:** slide placeholder di-skip dari ticker announcement (ActiveAnnouncements). Tombol "Kategori lain" = dropdown; pill model pakai text-xs px-3.

### 2026-08-12 - Sebelumnya
- PDP: rating ke atas "pilih varian", font nama produk body, sentence case, padding container 10px (revert PDP), ulasan multi-foto + badge + lightbox swipe, varian & stok sebaris rata kanan, label 12px bold.
- Kontrak workflow (AGENTS.md): edit langsung di repo VPS, commit per batch.
 (2026-08-12)

- Batch polish detail produk #2 selesai (86a1294): grid rekomendasi, ulasan berfoto + lightbox, warning varian kondisional, chip varian kecil, clearance sticky bottom ~19px.
- Batch polish #3 selesai (fc9b4ed + 59fbd80): label "Pilih varian" 14px bold + varian&stok sebaris rata kanan (font light), heading "Alasan harus belanja di Ragil Aluminium", rating frame rounded kanan sejajar baris 1, judul split otomatis ukuran/model via regex.
- Batch ulasan multi-foto (commit berikutnya): kolom JSON image_urls di cms_testimonials (migrasi 2026_08_12_010000) + payload images[]; PDP ulasan menampilkan badge jumlah foto + overlay "N foto" saat hover + GalleryLightbox swipeable (drag/panah/keyboard); admin form punya textarea "URL gambar tambahan" (satu per baris). Demo: ulasan Siti Rahayu (testimonial id 51, produk SP58155312043) diberi 3 foto - 2 di antaranya pinjam dari testimonial lain (data demo).
- Riwayat: `e492484` polish PDP #1 (accordion default tertutup, bintang #F5A623, ulasan tanpa bg & label source, tombol ulasan teal, tipografi lihat semua seragam); `708c0bd` product card BEM visual system (wishlist, stok habis, flash badge) + 5 file agent lain.
- Working tree saat ini: 3 file modif batch ini (product-buy-box, product-info-sections, product-related-section) - di-commit bersama update status ini. docs/ZALORA-BEM-VISUAL-SYSTEM.md masih untracked (milik agent lain, belum di-commit).
- Folder lokal `D:/website_5.0` (admin-orders-work dll) adalah SNAPSHOT LAMA (2026-08-10/11) - JANGAN dijadikan sumber, JANGAN di-scp ke server (akan menurunkan versi). Selalu edit di repo VPS ini.

## Current status (2026-08-11)

- Phases 1–6A + WhatsApp BAILEYS pairing + QA reconciliation done; PHPUnit 258 green / 4050 assertions (2026-08-09). HEAD `765e50b`.
- **Working tree is dirty (~136 entries)** with many `*.bak-*` files - review carefully before committing; some backups are intentionally kept.
- opencode: read-only subagent `cx-architect` (Customer Experience Architect) in `.opencode/agents/cx-architect.md`; `opencode.json` = `$schema` only. Delegate UX analysis to it.
- VPS 209.23.10.62 runs an opencode binary that **crashes (CPU lacks AVX)** - run opencode on a capable machine; the repo is only reachable via SSH from here.
- Production cutover NOT started; release governed by `docs/FULL-STACK-PRODUCTION-CHECKLIST.md` (no cutover while any `[!]` open).
