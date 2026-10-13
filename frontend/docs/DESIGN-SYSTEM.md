# Ragil Aluminium Design System

Operational layout and consistency rules live in
`frontend/docs/UI-CONSISTENCY-CONTRACT.md`. This file remains the token and
principle reference; the consistency contract is the cross-page implementation
gate.

Panel admin memakai lapisan desain terpisah bernama **"Ink"** (dark-first,
primary monokrom) yang didokumentasikan di
`frontend/docs/ADMIN-DESIGN-LANGUAGE.md`. Token di berkas ini adalah konteks
storefront; jangan mengasumsikan nilainya sama di panel admin.

## Principles

1. **Clarity before decoration.** Pembeli harus memahami model, varian, harga, dan langkah berikutnya.
2. **Material restraint.** Referensi aluminium hadir lewat tone, edge, dan proporsi, bukan tekstur palsu.
3. **Red earns attention.** Signal Red hanya muncul ketika elemen membutuhkan perhatian atau tindakan.
4. **Real data, real states.** Tidak ada angka, ulasan, stok, atau promo fiktif.
5. **Mobile is a complete experience.** Semua multi-column layout memiliki fallback eksplisit.

## Design dials

### Public

- Design variance: 6/10
- Motion intensity: 4/10
- Visual density: 4/10

### Admin

- Design variance: 3/10
- Motion intensity: 2/10
- Visual density: 7/10

Detail lapisan admin (nama "Ink", token per mode, radius, density) ada di
`frontend/docs/ADMIN-DESIGN-LANGUAGE.md`.

## Semantic tokens

Runtime token berada di `resources/css/app.css`. **Nilai token berbeda per konteks**
(storefront, admin gelap, admin terang), jadi jangan mengasumsikan satu nilai sama di
seluruh aplikasi. Tabel berikut adalah konteks **storefront** (`:root`, baris ~26).
Lapisan admin "Ink" punya tabel token sendiri di
`frontend/docs/ADMIN-DESIGN-LANGUAGE.md`.

| Token | Hex | Peran |
|---|---|---|
| `background` | `#FFFFFF` | latar halaman |
| `surface` | `#FFFFFF` | panel dan kartu |
| `surface-muted` | `#F7F8F7` | panel/komponen in-page, bukan latar halaman |
| `foreground` | `#333333` | heading dan teks utama |
| `action-foreground` | `#282828` | teks aksi netral (kelas `text-action`) |
| `body-foreground` / `muted-foreground` | `#666666` | deskripsi, artikel, body text panjang |
| `primary` | `#C20000` | Signal Red, primary action storefront |
| `primary-hover` | `#9E0000` | hover primary |
| `primary-foreground` | `#FFFFFF` | teks di atas primary |
| `secondary` | `#ECEFED` | permukaan sekunder dan chip |
| `muted` | `#EEF1F0` | permukaan redup |
| `accent` | `#FCEDED` | tint merah lembut untuk hover/selection |
| `accent-foreground` | `#8F0000` | teks di atas accent |
| `sale` | `#C20000` | promo / flash sale |
| `border` | `#DEE3E0` | garis dan hairline |
| `input` | `#CED4D1` | garis kontrol input |
| `ring` / `focus` | `#C20000` | focus ring |
| `header-bg` | `#121212` | latar header, footer, dan band gelap beranda |
| `success` | `#2B734E` | status sukses |
| `warning` | `#F59F0A` | status peringatan |
| `info` | `#2C6D9B` | status informasi |
| `destructive` | `#BC1010` | status merusak dan error |
| `copper` | `#C66B2A` | aksen garansi dan kepercayaan brand |
| `whatsapp` | `#21C45D` | kanal WhatsApp |
| `on-dark-accent` | `#F78787` | aksen coral di atas band gelap |
| `radius` | `0.875rem` | panel, filter sheet, surface utilitas |
| `radius-control` | `0.5rem` | kontrol form, textarea, chip |

Catatan penggantian nilai. Empat nilai bergeser dari catatan lama dokumen ini karena
penyesuaian kontras, dan semuanya bergeser ke arah lebih gelap sehingga rasio kontras naik:

| Klaim lama (digantikan) | Nilai berlaku |
|---|---|
| `body` / `muted-foreground` `#737373` | `#666666` |
| `action` `#262626` | `#282828` (`--action-foreground`) |
| `primary` `#C00000` | `#C20000` |
| `border` `#DDE2E0` | `#DEE3E0` |

Dua token yang sebelumnya tidak terdokumentasi di sini: `--header-bg` (`#121212`, latar
chrome dan band gelap) dan `--copper` (`#C66B2A`, aksen garansi). `--copper` sudah dipakai
di `product-card.tsx` dan `trust-assurance-card.tsx`; nilainya berbeda per tema, lihat
`frontend/docs/ADMIN-DESIGN-LANGUAGE.md`.

## Kapan token baru boleh dibuat

Token adalah **kontrak makna, bukan alias nilai**. Token baru hanya layak dibuat bila
**ketiga** syarat berikut terpenuhi bersamaan.

1. **Dipakai minimal di DUA tempat terpisah.** Bila nilainya hanya dipakai di satu tempat,
   itu nilai lokal, bukan token. Pakai token yang sudah ada atau tulis nilai itu di
   komponen yang bersangkutan.
2. **Punya peran semantik yang belum diwakili token mana pun.** Bukan "warnanya mirip tapi
   beda sedikit", melainkan konsep yang berbeda. Dua abu-abu berjarak dua tingkat bukan dua
   token; abu-abu untuk teks dan abu-abu untuk garis adalah dua peran berbeda, dan itu layak
   dua token.
3. **Harus ikut berubah saat tema berganti.** Bila nilainya sama di mode terang dan mode
   gelap, kemungkinan besar itu konstanta, bukan token.

Kalau salah satu syarat tidak terpenuhi, jangan buat token baru. Pakai token yang sudah ada.

### Anti-pattern: token untuk melegalkan hex yang sudah terlanjur ditulis

Dilarang membuat token hanya untuk melegalkan nilai yang sudah terlanjur ditulis di kode.
Contoh terlarang: membuat `--heading-strong: #121212` hanya supaya hex di satu halaman punya
token. Perbuatan itu menyimpan kekeliruan sebagai standar, dan halaman berikutnya akan
mengikutinya karena mengira nilai itu disengaja. Perbaikan yang benar adalah mengganti hex
itu dengan token yang sudah ada.

### Contoh nyata: OrderConfirmation

`resources/js/pages/Public/OrderConfirmation.tsx` memuat 10 nilai warna berbeda, dan
**kesepuluhnya sudah punya token yang cocok**. Halaman itu tidak butuh token baru sama
sekali, hanya perlu memakai token yang ada.

| Hex di halaman | Token yang tersedia | Nilai token |
|---|---|---|
| `#333333` | `--foreground` | `#333333` |
| `#666666` | `--body-foreground` | `#666666` |
| `#c20000` | `--primary` | `#C20000` |
| `#dee3e0` | `--border` | `#DEE3E0` |
| `#2a734d` | `--success` | `#2B734E` |
| `#bd1111` | `--destructive` | `#BC1010` |
| `#6B7280` | `--muted-foreground` | `#666666` |
| `#d9d9d9` | `--secondary` | `#ECEFED` |
| `#ffd9d9` | `--accent` | `#FCEDED` |
| `#121212` | `--foreground` | `#333333` |

Catatan khusus `#121212`: nilai itu persis sama dengan token `--header-bg`, yaitu warna
**latar** header. Memakainya sebagai warna **teks** di halaman itu adalah salah token.
Warna teks yang benar adalah `--foreground` `#333333`. Inilah contoh kenapa token dinilai
dari peran, bukan dari kecocokan hex.

### Kandidat token yang belum dikerjakan

Dua celah berikut memang layak token baru, tetapi **belum dikerjakan** dan menunggu
keputusan terpisah. Jangan mengerjakannya tanpa persetujuan.

- **Palet cetak.** `resources/js/components/shared/print-order-customer.tsx` memuat
  puluhan penulisan nilai hex langsung karena stylesheet cetak butuh nilai absolut (hasil
  hitung: 56 penulisan, 9 nilai unik). Kandidat nama: `--print-ink`, `--print-muted`,
  `--print-rule`. Perlu dihitung lebih dulu apakah ketiganya memenuhi tiga syarat, termasuk
  apakah warna cetak memang perlu mengikuti tema.
- **Graphite `#1A1D1C`.** Nilai ini didokumentasikan di `frontend/brand/BRAND-KIT.md`
  tetapi tidak dipakai di kode. Butuh keputusan owner: diimplementasikan sebagai token atau
  ditandai tidak terpakai.


## Layout

- Container (`.container-page`): mengikuti kontainer IKEA (`hnf-content-container`), `max-width: 112rem` (1792px) di-center, padding samping `1.25rem` mobile, `2rem` mulai `37.5em` (600px), `3rem` mulai `56.25em` (900px). Gutter besar di layar sangat lebar berasal dari sisa ruang `max-width`, bukan padding.
- Public reading width: maksimum 68ch.
- Grid desktop: 12 columns; mobile selalu satu column kecuali data ringkas. Gutter grid/carousel storefront: `1.25rem` (20px, `gap-5`) mengikuti gutter grid IKEA.
- Header desktop: 68-76px.
- Public navigation chrome (header, navbar, footer, dan mobile bottom navigation) memakai `#121212` melalui token `bg-header-bg` (`--header-bg`); teks dan ikon memakai `text-background`.
- Section public: ritme vertikal via utility `.section-space`, `padding-block: 1.75rem` (28px) mobile, `2.75rem` (44px) mulai `56.25em`. Home memakai band `bg-surface` / `bg-surface-muted` selang-seling dengan seluruh heading section H2 tetap `18px`. Strip carousel berurutan tidak memakai padding 80px agar jarak antar section tidak terasa jauh.
- Admin: 20-32px panel spacing, 12-20px internal spacing. Radius admin lebih rapat dari storefront (`--radius` `0.5rem`, `--radius-control` `0.375rem`) dan root font-size admin `14px`. Rincian di `frontend/docs/ADMIN-DESIGN-LANGUAGE.md`.
- Hero memakai `min-height` berbasis `dvh`, bukan `h-screen`.
- Hero Home adalah campaign slider full-bleed (lebar penuh layar, gaya campaign IKEA): track `translateX` per slide. **Standar gambar banner PATEN (2026-08-14): rasio layout tetap `1024/426` (±2.4:1) di semua breakpoint (`aspect-[1024/426]`): tinggi otomatis = lebar ÷ rasio sehingga proporsional di desktop maupun mobile; gambar dirender `object-cover` (admin menyiapkan canvas 2,4:1, mis. `2048 × 852 px`, agar tidak ter-crop).** Tombol back/next bulat putih di tepi kiri/kanan banner, dot indikator di bawah, auto-advance 5 detik, dan menghormati reduced motion. **Upload banner admin memakai alur presigned langsung ke R2 + derivatif WebP (thumb/card/pdp) via queue**: slide landing memakai `pdp` (maks 1400px, `image/webp`), bukan PNG asli upload (bisa 1 MB+), sehingga hero lebih cepat termuat. CTA graphite `Belanja Sekarang` (`rounded-full`).
- Tipografi global memakai **Inter self-hosted** (variable, weight 400 sampai 800) lewat dua `@font-face` di `resources/css/app.css` (baris 6-19), file `public/fonts/inter/inter-latin-var.woff2` dan `inter-latin-ext-var.woff2`. Pemetaan `font-sans` dan `font-display` di `tailwind.config.js` adalah `['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif']`, jadi system font hanya cadangan. Peralihan ke Inter disengaja: Apple system font tidak tersedia di Windows dan Android, sehingga tampilan akan berbeda antar perangkat bila dipakai. Jangan menambah keluarga font kedua. Klaim lama (Apple system font sebagai font utama) dicatat sebagai digantikan. Capitalize pada heading/nav/CTA saja; body/subtitle sentence case. **Jangan memakai em dash (U+2014)** pada copy pelanggan; pakai titik, koma, atau titik dua. Hindari kata informal seperti “mencolok” / “rekaan”.
- `layout: landing` (fallback slide pertama): overlay teks + baris badge layanan (aturan 60-30-10): logo COD (`/images/icons/cod.svg`, 34×17px) + "Bayar Di Tempat", shield "Garansi 100%" (`hero-shield.svg`), truck "Kirim Ke Seluruh Indonesia" (`hero-truck.svg`); label `text-xs` white/85. Accent diskon (jika ada) Signal Red.
- `layout: promo_card` / `sticker: true` (standar banner manual + otomatis + fallback promo): foto produk full-bleed di belakang, banner dan kartu rasio 3:4 di kiri memakai `rounded-md` (radius `8px`), tinggi kartu 72% banner, padding dalam mobile `px-5 py-5` / `sm+` `px-8 py-9`, drop shadow lembut. Warna kartu dirotasi per posisi slide dari 3 variasi brand: (1) Signal Red `bg-primary` teks putih + chip persen putih berteks merah, (2) Graphite `#1A1D1C` teks putih + chip persen merah, (3) Aluminium `#DDE2E0` teks Graphite + chip persen merah + CTA Graphite. **Status klaim (2026-09-20):** `HeroPromoCard` di `resources/js/components/public/home-hero.tsx` saat ini hanya merender `bg-primary` dan tidak memuat rotasi 3 variasi itu, dan `#1A1D1C` tidak muncul di kode mana pun. Perlakukan klaim ini sebagai belum berlaku; verifikasi ke pemilik sebelum dipakai sebagai acuan. Struktur konten sama di semua variasi, dimulai dari headline **model produk** (mis. `Boven\nJungkit` / `Jendela\nSwing`, bukan ukuran SKU seperti `110x70`), chip persen opsional, subheadline `Harga miring, kualitas terjamin`, CTA "Belanja sekarang" (`rounded-full`) menuju listing model, disclaimer kecil dari `slide.disclaimer`.

## Components

### Typography casing

- Heading, label navigasi, dan CTA: capitalize each word.
- Body, subtitle, helper, dan deskripsi: **sentence case** (bukan capitalize setiap kata).
- Akronim resmi seperti COD, SKU, IDR, dan J&T tetap memakai kapital baku. Nilai sumber tetap disimpan apa adanya; kapitalisasi hanya diterapkan pada tampilan.
- Letter-spacing heading/label/CTA di seluruh halaman memakai `tracking-tight` (gaya IKEA). Jangan memakai tracking lebar (`0.06em`–`0.16em`) atau `tracking-wide` pada teks UI.
- Halaman storefront **tidak** memakai eyebrow dekoratif (label kecil `text-primary` di atas h1/h2). Judul section langsung memimpin hierarchy; Signal Red tetap untuk aksi, status, dan chip fungsional.
- Copy pelanggan: **tanpa em dash (U+2014)**; tanpa kata informal seperti “mencolok” atau “rekaan”.

### Buttons

- Primary: Signal Red, satu primary action per decision area.
- Secondary: Surface dengan Graphite border/foreground.
- Pasangan CTA horizontal (contoh: katalog + konsultasi WA): **secondary di kiri, primary/WhatsApp di kanan** agar aksi konsultasi mudah dijangkau; di stack mobile, WhatsApp di bawah (urutan DOM sama).
- Ghost: hanya pada surface yang jelas.
- Destructive: dipisahkan secara visual dan selalu meminta konfirmasi.
- Sudut tombol aksi (teks/CTA) dan search bar: selalu `rounded-full` (pill). Jangan `rounded-none` dan jangan `rounded-md` pada tombol berlabel / search input.
- `rounded-full` juga untuk kontrol ikon lingkaran (carousel, tutup, hover ikon header) dan badge/chip singkat.
- Minimum touch target 44x44px; label tidak wrap pada desktop.

### Forms

- Label selalu di atas control.
- Helper di bawah label atau control; error di bawah control.
- Placeholder bukan label.
- Focus ring terlihat; pending state menonaktifkan repeat submit.
- Field group mengikuti urutan tugas pengguna, bukan urutan schema.

### Cards and surfaces

- Card hanya ketika enclosure membantu hierarchy atau action.
- Daftar sederhana memakai spacing dan divider ringan.
- Sudut (radius): panel, filter sheet, dan surface utilitas memakai token `--radius` (14px). Search bar, input satu baris, dan **tombol aksi berlabel** memakai `rounded-full` (pill). Textarea / field multi-baris memakai `rounded-md` → token `--radius-control` (8px), **bukan** pill: jangan map `rounded-md` ke `9999px`. **Chip status, badge singkat, dan chip pilihan varian PDP** tetap `rounded-full` (selaras BRAND-KIT). **Hanya listing cards** (product / model / testimonial / galeri hasil pemasangan) yang wajib sudut siku, yaitu frame dan media 1:1 tanpa `rounded-*`. Kontrol ikon lingkaran tetap `rounded-full`.
- Product card standar (semua halaman, gaya listing Zalora): gambar `aspect-square` (1:1) bersudut siku, judul maksimal 2 baris memakai kolom `products.name` persis dari impor Shopee (tanpa label model/brand buatan), elemen judul memakai semantic `h3` dengan `data-slot="product-item-name"`, warna `hsl(var(--action-foreground))` (`#282828` di storefront), bobot `font-light`, dan ukuran `14px`; harga Signal Red, harga asli dicoret + persentase potongan ketika promo valid, ikon COD, label `FLASH SALE` merah bold italic uppercase tanpa background (ukuran font mengikuti dimensi ikon petir: 14px mobile / 16px lg), Garansi 100%, dan jumlah terjual light di kanan bawah. Seluruh card membuka PDP; tidak ada CTA keranjang/checkout agar pelanggan memilih varian dari detail produk. Frame tanpa border dan tanpa radius. Grid wajib lewat `ProductCardGrid`; Home dibatasi 4 kolom desktop agar metadata terbaca, sedangkan Catalog / Search / PDP related memakai `2/3/4/5` kolom. Semua card media (product / model / testimonial) memakai rasio 1:1.
- **Flash Sale / Promo listing** (`/flash-sale`, `/promo`): **tanpa sidebar filter.** `/flash-sale`: breadcrumbs + banner Signal Red strip + toolbar (chip **Populer** / **Terbaru** / **Terlaris**, **Filter harga** → `price_min`/`price_max`, ikon **cari ukuran** → `?q=` pada `/flash-sale`) + galeri produk. `/promo`: header biasa + strip Flash Sale (intro + Lihat Semua) + toggle pill model di listing. Kartu Flash Sale `emphasis="flash"`. Tidak ada countdown palsu.
- Model card memakai meta tetap `3 Model Kaca | 4 Model Warna`; jumlah unik `design_variant` tidak ditampilkan sebagai “Pilihan Desain”.
- Tipografi product card menskalakan pada `lg:`: judul `text-base`, harga `text-lg`→`text-2xl` (lg), harga coret `text-sm`→`text-base` (lg), chip diskon `text-xs`→`text-sm` (lg).
- Model card memakai judul `h3` 14px dengan meta/desc 12px. Area teks ~5.75–7rem.
- Section **Kami bantu dari awal sampai jadi** memakai empat kartu infografis, satu kartu per poin, dengan skala lebih kecil dari banner promo, `rounded-md`, ikon, nomor urut, judul, dan deskripsi. Kartu tetap memakai data nyata dari `HELP_STEPS` dan CTA katalog/WhatsApp di bawahnya.
- Halaman **Semua Model Produk** (`/products`) = grid kartu model. Halaman **Semua Produk** (`/products?sort=newest`) = listing SKU (`Public/Catalog`); jangan hilangkan `sort` saat filter/reset atau akan jatuh ke hub model.
- Katalog per kategori (`/windows`, `/doors`, `/bouven`) dan listing Semua Produk memakai sidebar Zalora: lebar `20rem`, **Filter Terpasang**, accordion **Model Bukaan** / **Desain** / **Rentang Harga** / **Kategori**, kartu **Konsultasi WhatsApp**.
- Kontrol **Filter Berdasarkan** / urutan katalog memakai pill `h-8 rounded-lg border-[#DEDEDE]`: label opsi aktif + ikon sort dua arah di kanan (referensi Zalora `Abjad`); klik membuka menu dropdown custom (bukan native select) dengan checkmark opsi aktif. Mobile Catalog memakai bottom sheet **Sort & Filter** (`FilterSheetContent`): drag handle, kartu accordion filter, daftar urutan, footer sticky **Reset** + **Terapkan Filter**.
- Galeri Model Produk, Paling banyak dipesan, Hasil pemasangan, dan Ulasan di Home memakai horizontal scroll-snap (maks. 10 item). Strip **Paling banyak dipesan**: judul section di permukaan halaman biasa; **Signal Red (`bg-primary`) full-bleed ke samping**, tinggi band **mengikuti tinggi kartu** (gutter tipis `py-2`, tanpa padding berlebih). Dipakai juga di hub **Semua Model Produk** (`/products`) dan listing **Semua Produk** (`/products?sort=…`) via `PalingBanyakDipesanSection` + props `popularProducts` (kurasi `homepage_popular`, fallback penjualan). **Desktop (`md+`):** tombol back/next lingkaran di **dalam** tepi track (`left-2`/`right-2`, bukan half-outside) agar tidak terpotong overflow; hanya tampil bila masih ada konten pada arah tersebut, label aksesibel, hormati reduced motion. **Mobile:** tanpa tombol next/back, yaitu navigasi sepenuhnya swipe (`touch-pan-x` + snap); setelah kartu terakhir ada slot **Lihat semua** yang mengarah ke route listing nyata (`/products`, `?sort=popular`, `/hasil-pemasangan`, `/reviews`). CTA section memakai label **Lihat semua →** berukuran `12px` dan `font-bold`, lalu disembunyikan di mobile agar fokus swipe. Banner promo mobile juga swipe (tanpa panah), dots tetap. Catalog / Search / PDP related tetap memakai `ProductCardGrid`.
- Metadata promo card memakai atribut produk internal: `promo_compare_price` (harga asli; wajib lebih tinggi dari harga jual), `promo_flash_sale` (`true`/`false`, default `false`), `promo_cod` (`true`/`false`), dan `promo_warranty` (label garansi). Alias lama `compare_price`, `harga_asli`, `harga_sebelum_diskon`, `flash_sale`, `cod`, `warranty`, dan `garansi` tetap dibaca. Atribut harga asli menjadi sumber utama; event global opsional memakai `STOREFRONT_PRODUCT_CARD_DISCOUNT_PERCENT` dan default `0`. Demo event beberapa produk dapat diaktifkan secara idempotent lewat `ProductCardPromotionSeeder`.
- Precision Frame tidak boleh dipakai pada setiap card.
- PDP memakai galeri fokus tunggal di kiri: satu gambar utama `aspect-square` dengan `object-contain`, tombol sebelumnya/berikutnya bulat Graphite di luar sisi frame gambar pada desktop dan hanya terlihat ketika galeri di-hover atau menerima focus (tetap terlihat pada mobile/touch), serta thumbnail horizontal di bawah dengan border Graphite pada pilihan aktif. Lebar galeri dibatasi `min(100%, calc(100dvh - 12rem))` pada kolom `1.4fr`, sehingga gambar square + thumbnail muat satu frame layar tanpa scroll vertikal. Galeri mengikuti media varian yang dipilih, kembali ke foto pertama saat varian berubah, serta menyediakan label tombol dan status foto untuk aksesibilitas. Buy box sticky di kanan berisi rating chip (link ke blok ulasan, radius kontrol), harga Signal Red + harga coret + chip diskon + badge Flash sale, pemilih variasi/ukuran berbentuk **pill** (`rounded-full`, terpilih = Graphite bg), CTA primary merah `Tambah ke keranjang` + quantity control, CTA secondary `Beli sekarang` selebar penuh di bawahnya untuk lanjut langsung ke checkout, box Pengiriman ber-border, 3 kartu benefit pastel (garansi / COD / pengiriman) dengan ikon dekoratif besar, accordion `Informasi produk` / `Tentang produk`, dan blok `Penilaian & ulasan` (rata-rata x/5 + daftar ulasan berpembatas divider). Section `Anda mungkin juga suka` memakai grid product card standar + tombol `Lihat semua`.
- Card storefront (product / model / testimonial / galeri hasil pemasangan) memakai drop shadow lembut `0 1px 3px rgba(10,0,0,0.08)` saat idle. Hover lift: terangkat `-translate-y-1` + shadow `0 10px 24px rgba(10,0,0,0.14)`; card bergambar juga zoom gambar `scale-[1.03]` (durasi 300ms, dinonaktifkan pada reduced motion). Card info statis (langkah Cara Pesan, Kami Bantu) memakai lift halus `-translate-y-0.5` + shadow `0 6px 16px rgba(10,0,0,0.1)`.

### Status

- Warna selalu ditemani teks.
- Mapping status ada di satu helper.
- Admin boleh lebih padat; public menggunakan label manusiawi.
- Status di panel admin memakai token semantik lapisan "Ink" (`--success` `#37BE7D`, `--warning` `#F6A831`, `--destructive` `#E23C3C` di mode gelap), bukan nilai storefront.

### Navigation

- Header publik = near-black `#121212` (`bg-header-bg`, token `--header-bg`), bukan strip merah penuh; Signal Red untuk aksen (search, badge, active indicator, Flash Sale).
- Ikon aksi header (hamburger, search mobile, Pesanan, Keranjang) memakai hover ala IKEA: latar pill/lingkaran `bg-muted` muncul saat hover (`rounded-full`, `transition-colors`), `bg-border` saat ditekan; tanpa perubahan opacity ikon.
- Search bar header memakai tinggi `36px` (`h-9`) dan placeholder berputar (contoh: `Cari: jendela sliding / 120x80`) via `useRotatingPlaceholder`; berhenti saat fokus/isi teks atau `prefers-reduced-motion`.
- Header memakai hamburger di kiri logo pada semua breakpoint. **Mobile:** emblem logo (`BrandWordmark mark`) di kiri search pill; aksi kanan = ikon saja. **Tablet/`md`–`lg`:** wordmark dipersempit, search absolute dibatasi agar tidak menabrak aksi; Pesanan + Keranjang **ikon saja** (`aria-label` tetap). **`lg+`:** label teks Pesanan/Keranjang tampil (`lg:w-auto` wajib agar tidak overlap); wordmark melebar penuh di `xl`. Strip navigasi utama di bawah bar dari `config/sitemap.php → navigation.desktop_main` (**Flash Sale** pertama dengan ikon petir, Signal Red, hover putih; tanpa item Promo).
- Mobile bottom navigation (`MobileBottomNav`): tinggi tetap `h-14` + `safe-area-inset-bottom`, `max-w-[100vw]` + grid kolom sama lebar (`minmax(0,1fr)`), ikon Phosphor statis `22px`, label `10px` truncate, indikator aktif `w-7`, `z-[60]`.
- Storefront layout + home carousels: `overflow-x-clip` / `min-w-0` agar track horizontal tidak melebarkan dokumen (yang sebelumnya mendorong tab kanan nav keluar viewport).
- Home rails: touch native `touch-action: pan-x pan-y` + `snap-proximity` (swipe kartu + scroll halaman); `useDragScroll` hanya mouse-drag + inertia desktop, dan menahan klik kartu setelah swipe.
- **Announcement bar** (Signal Red di atas header): **Mobile (`< md`)**: 1 promo per slide, rata tengah, ganti slide ~5.5s (fade). **Desktop (`md+`)**: marquee kontinu (hover menjeda). Copy sentence-case fokus model/benefit (bukan ALL CAPS). Flash Sale di bar **maksimal 1 item** dan hanya saat periode kampanye live (`FlashSalePeriodSettings`); teks "Flash Sale" dari config/CMS/banner difilter. Ikon konteks + chip persen putih bila ada `-N%`; tanpa separator diamond/◆.
- Drawer membuka dari kiri dengan surface polos tanpa border, divider, atau shadow. `Model Produk` dan `Semua Produk` menjadi heading utama. Submenu model memakai **accordion caret** di semua breakpoint (bukan hover-only di desktop); tap caret membuka panel taxonomy.
- Ikon keranjang desktop menampilkan hover/focus preview sesuai Figma `10374:5562`: panel 360px berujung panah merah yang tepat di bawah pusat ikon cart, header Signal Red dengan judul + tombol tutup, daftar isi keranjang pada surface putih (maks 5 baris dari shared prop `cartPreview`: thumbnail 1:1, nama produk 2 baris, variasi, `qty × harga`; sisanya diringkas satu baris) atau empty state, dan CTA merah setinggi 55px (`rounded-full`). Badge jumlah pada ikon cart berbentuk lingkaran (`rounded-full`) Signal Red. Panel tetap dapat dioperasikan via keyboard; mobile memakai navigasi langsung ke halaman keranjang.
- Link drawer sekunder mengikuti `config/sitemap.php`: Flash Sale (urutan pertama + ikon), Hasil Pemasangan, Ulasan, Informasi Toko, Lacak Pengiriman, dan Konsultasi Gratis. Promo tidak ada di nav (route `/promo` tetap tersedia).
- Drawer hamburger: tombol caret di **Model Produk** membuka panel daftar model di **kanan** (nav menyusut ke kiri), pola yang sama di mobile dan desktop, bukan accordion di bawah.
- Mobile tetap memakai bottom navigation dari sitemap untuk tujuan utama.
- Halaman `planned` tidak pernah masuk navigation.
- Active state menggunakan weight, underline/edge, dan red secara terbatas.

## Motion

- Fast: 160ms untuk hover/press.
- Standard: 260ms untuk disclosure.
- Slow: 420ms untuk hero/media entrance.
- Ease: cubic-bezier yang natural, bukan linear.
- Hanya animasikan transform dan opacity.
- No scroll hijack, perpetual marquee, magnetic cursor, atau parallax berat.
- Semua motion berhenti saat `prefers-reduced-motion: reduce`.

## Responsive breakpoints

- Mobile: 0-639
- Small tablet: 640-767
- Tablet: 768-1023
- Desktop: 1024-1279
- Wide: 1280+

Audit minimum dilakukan pada 360, 768, 1024, dan 1440px.

## Theme

Storefront publik **light-only**, memakai lapisan `:root` di `resources/css/app.css` untuk
menjaga fidelity foto produk.

**Admin panel: DARK-FIRST.** Default-nya gelap, mode terang adalah alternatif opsional.
Toggle ada di header, storage key `ragil-admin-theme`, dan `readAdminTheme()` di
`resources/js/lib/admin-theme.ts` mengembalikan `"dark"` saat storage kosong. Kelas
`admin-shell` dipasang di `resources/js/layouts/admin-layout.tsx` dan dilepas saat keluar
admin supaya storefront tetap light.

Ada EMPAT lapisan token di `resources/css/app.css`:

| Lapisan | Baris | Konteks |
|---|---|---|
| `:root` | ~26 | storefront light |
| `.dark` | ~98 | dark generik |
| `html.admin-shell` | ~141 | admin "Ink" gelap (default admin) |
| `html.admin-shell.light` | ~185 | admin "Ink" mode terang |

Karena `html.admin-shell` lebih spesifik dan dimuat setelah `.dark`, nilai admin selalu
menang saat panel admin aktif. Klaim lama bahwa admin cukup memakai token `.dark` dengan
dasar sidebar `#131212` dicatat sebagai **digantikan**: `#131212` hanya muncul sebagai
komentar penjelas di `app.css` dan tidak pernah menjadi nilai token. Nilai kanvas admin
gelap yang berlaku adalah `--background` `#121212`.

Tabel token kedua mode admin ada di `frontend/docs/ADMIN-DESIGN-LANGUAGE.md`.
