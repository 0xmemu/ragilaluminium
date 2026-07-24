# Ragil Aluminium Design System

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

## Semantic tokens

Runtime token berada di `resources/css/app.css`.

- `background`: `#FFFFFF`
- `surface`: `#FFFFFF`
- `surface-muted`: Aluminium tint (panel/komponen in-page, bukan latar halaman)
- `foreground`: Graphite
- `muted-foreground`: Muted Graphite
- `primary`: Signal Red (`#C00000`, dari logo)
- `primary-foreground`: Surface
- `sale`: Signal Red (promo / flash sale)
- `border`: Aluminium
- `focus` / `ring`: Signal Red
- `accent`: tint merah lembut untuk hover/selection
- `success`, `warning`, `info`, `destructive`: hanya untuk status semantik

## Layout

- Container (`.container-page`): mengikuti kontainer IKEA (`hnf-content-container`) — `max-width: 112rem` (1792px) di-center, padding samping `1.25rem` mobile, `2rem` mulai `37.5em` (600px), `3rem` mulai `56.25em` (900px). Gutter besar di layar sangat lebar berasal dari sisa ruang `max-width`, bukan padding.
- Public reading width: maksimum 68ch.
- Grid desktop: 12 columns; mobile selalu satu column kecuali data ringkas. Gutter grid/carousel storefront: `1.25rem` (20px, `gap-5`) mengikuti gutter grid IKEA.
- Header desktop: 68-76px.
- Section public: ritme vertikal ala IKEA via utility `.section-space` — `padding-block: 1.875rem` (30px) mobile, `3.75rem` (60px) mulai `56.25em`.
- Admin: 20-32px panel spacing, 12-20px internal spacing.
- Hero memakai `min-height` berbasis `dvh`, bukan `h-screen`.
- Hero Home adalah campaign slider full-bleed (lebar penuh layar, gaya campaign IKEA): track `translateX` per slide, dimensi mengikuti rasio referensi campaign IKEA `aspect-[1024/426]` (±2.4:1, min-height `320px` di layar kecil), tombol back/next bulat putih di tepi kiri/kanan banner, dot indikator di bawah, auto-advance 6 detik, dan menghormati reduced motion. CTA graphite `Belanja Sekarang` (`rounded-full`).
- Tipografi: capitalize pada heading/nav/CTA saja; body/subtitle sentence case. **Jangan em dash (—)** pada copy pelanggan; pakai titik, koma, atau titik dua. Hindari kata informal seperti “mencolok” / “rekaan”.
- `layout: landing` (fallback slide pertama): overlay teks + baris badge layanan (aturan 60-30-10): logo COD (`/images/icons/cod.svg`, 34×17px) + "Bayar Di Tempat", shield "Garansi 100%" (`hero-shield.svg`), truck "Kirim Ke Seluruh Indonesia" (`hero-truck.svg`); label `text-xs` white/85. Accent diskon (jika ada) Signal Red.
- `layout: promo_card` / `sticker: true` (standar banner manual + otomatis + fallback promo): foto produk full-bleed di belakang, kartu rasio 3:4 di kiri (tinggi 72% banner, radius `14px`, drop shadow lembut). Warna kartu dirotasi per posisi slide dari 3 variasi brand: (1) Signal Red `bg-primary` teks putih + chip persen putih berteks merah, (2) Graphite `#1A1D1C` teks putih + chip persen merah, (3) Aluminium `#DDE2E0` teks Graphite + aksen eyebrow merah + chip persen merah + CTA Graphite. Struktur konten sama di semua variasi: eyebrow **Promo Diskon** (kata "Diskon" extrabold 1.5em; **bukan** label Flash Sale — Flash Sale punya halaman sendiri), headline = **model produk** (mis. `Boven\nJungkit` / `Jendela\nSwing`, bukan ukuran SKU seperti `110x70`), chip persen opsional, subheadline `Harga miring, kualitas terjamin`, CTA "Belanja sekarang" (`rounded-full`) menuju listing model, disclaimer kecil dari `slide.disclaimer`.

## Components

### Typography casing

- Heading, label navigasi, dan CTA: capitalize each word.
- Body, subtitle, helper, dan deskripsi: **sentence case** (bukan capitalize setiap kata).
- Akronim resmi seperti COD, SKU, IDR, dan J&T tetap memakai kapital baku. Nilai sumber tetap disimpan apa adanya; kapitalisasi hanya diterapkan pada tampilan.
- Letter-spacing heading/label/CTA di seluruh halaman memakai `tracking-tight` (gaya IKEA). Jangan memakai tracking lebar (`0.06em`–`0.16em`) atau `tracking-wide` pada teks UI.
- Halaman storefront **tidak** memakai eyebrow dekoratif (label kecil `text-primary` di atas h1/h2). Judul section langsung memimpin hierarchy; Signal Red tetap untuk aksi, status, dan chip fungsional.
- Copy pelanggan: **tanpa em dash (—)**; tanpa kata informal seperti “mencolok” atau “rekaan”.

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
- Sudut (radius): panel, filter sheet, dan surface utilitas memakai token `--radius` (14px). Search bar, input satu baris, dan **tombol aksi berlabel** memakai `rounded-full` (pill). Textarea / field multi-baris memakai `rounded-md` → token `--radius-control` (8px), **bukan** pill — jangan map `rounded-md` ke `9999px`. **Chip status, badge singkat, dan chip pilihan varian PDP** tetap `rounded-full` (selaras BRAND-KIT). **Hanya listing cards** (product / model / testimonial / galeri hasil pemasangan) yang wajib sudut siku — frame dan media 1:1 tanpa `rounded-*`. Kontrol ikon lingkaran tetap `rounded-full`.
- Product card standar (semua halaman, gaya listing Zalora): gambar `aspect-square` (1:1) bersudut siku, judul maksimal 2 baris memakai kolom `products.name` persis dari impor Shopee (tanpa label model/brand buatan), harga Signal Red, harga asli dicoret + persentase potongan ketika promo valid, ikon COD, label `FLASH SALE` merah bold italic uppercase tanpa background (ukuran font mengikuti dimensi ikon petir: 14px mobile / 16px lg), Garansi 100%, dan jumlah terjual light di kanan bawah. Seluruh card membuka PDP; tidak ada CTA keranjang/checkout agar pelanggan memilih varian dari detail produk. Frame tanpa border dan tanpa radius. Grid wajib lewat `ProductCardGrid`; Home dibatasi 4 kolom desktop agar metadata terbaca, sedangkan Catalog / Search / PDP related memakai `2/3/4/5` kolom. Semua card media (product / model / testimonial) memakai rasio 1:1.
- **Flash Sale / Promo listing** (`/flash-sale`, `/promo`): **tanpa sidebar filter.** Di atas galeri: toggle pill model (`Semua` / Jungkit / Swing / … → `?model=`). `/flash-sale` memakai **banner Signal Red marketplace** (petir kuning, `FLASH SALE` + `PENAWARAN TERBATAS`, countdown `Jam : Menit : Detik` dari `flashSalePeriod.seconds_remaining` nyata) + intro “Penawaran terbatas…”; tanpa kontrol Urutkan; kartu `emphasis="flash"`. `/promo` memakai header biasa + strip Flash Sale merah yang sama di atas listing. Tidak ada countdown palsu.
- Model card memakai meta tetap `3 Model Kaca | 4 Model Warna`; jumlah unik `design_variant` tidak ditampilkan sebagai “Pilihan Desain”.
- Tipografi product card menskalakan pada `lg:`: judul `text-base`, harga `text-lg`→`text-2xl` (lg), harga coret `text-sm`→`text-base` (lg), chip diskon `text-xs`→`text-sm` (lg).
- Model card tipografi mengikuti lebar card lewat container query (bukan viewport `lg:`): acuan homepage 4 kolom (~16–22rem) memakai judul 13px dan meta/desc 12px; card lebih sempit turun ke 12px/11px, card lebih lebar naik maksimal ke 14px/13px. Area teks ~5.75–7rem.
- Halaman **Semua Model Produk** (`/products`) = grid kartu model. Halaman **Semua Produk** (`/products?sort=newest`) = listing SKU (`Public/Catalog`); jangan hilangkan `sort` saat filter/reset atau akan jatuh ke hub model.
- Katalog per kategori (`/windows`, `/doors`, `/bouven`) dan listing Semua Produk memakai sidebar Zalora: lebar `20rem`, **Filter Terpasang**, accordion **Model Bukaan** / **Desain** / **Rentang Harga** / **Kategori**, kartu **Konsultasi WhatsApp**.
- Kontrol **Filter Berdasarkan** / urutan katalog memakai pill `h-8 rounded-lg border-[#DEDEDE]`: label opsi aktif + ikon sort dua arah di kanan (referensi Zalora `Abjad`); klik membuka menu dropdown custom (bukan native select) dengan checkmark opsi aktif. Mobile Catalog memakai bottom sheet **Sort & Filter** (`FilterSheetContent`): drag handle, kartu accordion filter, daftar urutan, footer sticky **Reset** + **Terapkan Filter**.
- Galeri Model Produk, Paling banyak dipesan, Hasil pemasangan, dan Ulasan di Home memakai horizontal scroll-snap (maks. 10 item). **Desktop (`md+`):** tombol back/next lingkaran putih semi-opak di tepi track (sama bahasa visual banner promo), hanya tampil bila masih ada konten pada arah tersebut, label aksesibel, hormati reduced motion. **Mobile:** tanpa tombol next/back — navigasi sepenuhnya swipe (`touch-pan-x` + snap); setelah kartu terakhir ada slot **Lihat selengkapnya** yang mengarah ke route listing nyata (`/products`, `?sort=popular`, `/hasil-pemasangan`, `/reviews`). CTA “Lihat semua” di judul section disembunyikan di mobile agar fokus swipe. Banner promo mobile juga swipe (tanpa panah), dots tetap. Catalog / Search / PDP related tetap memakai `ProductCardGrid`.
- Metadata promo card memakai atribut produk internal: `promo_compare_price` (harga asli; wajib lebih tinggi dari harga jual), `promo_flash_sale` (`true`/`false`, default `false`), `promo_cod` (`true`/`false`), dan `promo_warranty` (label garansi). Alias lama `compare_price`, `harga_asli`, `harga_sebelum_diskon`, `flash_sale`, `cod`, `warranty`, dan `garansi` tetap dibaca. Atribut harga asli menjadi sumber utama; event global opsional memakai `STOREFRONT_PRODUCT_CARD_DISCOUNT_PERCENT` dan default `0`. Demo event beberapa produk dapat diaktifkan secara idempotent lewat `ProductCardPromotionSeeder`.
- Precision Frame tidak boleh dipakai pada setiap card.
- PDP memakai galeri fokus tunggal di kiri: satu gambar utama `aspect-square` dengan `object-contain`, tombol sebelumnya/berikutnya bulat Graphite di luar sisi frame gambar pada desktop dan hanya terlihat ketika galeri di-hover atau menerima focus (tetap terlihat pada mobile/touch), serta thumbnail horizontal di bawah dengan border Graphite pada pilihan aktif. Lebar galeri dibatasi `min(100%, calc(100dvh - 12rem))` pada kolom `1.4fr`, sehingga gambar square + thumbnail muat satu frame layar tanpa scroll vertikal. Galeri mengikuti media varian yang dipilih, kembali ke foto pertama saat varian berubah, serta menyediakan label tombol dan status foto untuk aksesibilitas. Buy box sticky di kanan berisi rating chip (link ke blok ulasan, radius kontrol), harga Signal Red + harga coret + chip diskon + badge Flash sale, pemilih variasi/ukuran berbentuk **pill** (`rounded-full`, terpilih = Graphite bg), CTA primary merah `Tambah ke keranjang` + quantity control, CTA secondary `Beli sekarang` selebar penuh di bawahnya untuk lanjut langsung ke checkout, box Pengiriman ber-border, 3 kartu benefit pastel (garansi / COD / pengiriman) dengan ikon dekoratif besar, accordion `Informasi produk` / `Tentang produk`, dan blok `Penilaian & ulasan` (rata-rata x/5 + daftar ulasan berpembatas divider). Section `Anda mungkin juga suka` memakai grid product card standar + tombol `Lihat semua`.
- Card storefront (product / model / testimonial / galeri hasil pemasangan) memakai drop shadow lembut `0 1px 3px rgba(10,0,0,0.08)` saat idle. Hover lift: terangkat `-translate-y-1` + shadow `0 10px 24px rgba(10,0,0,0.14)`; card bergambar juga zoom gambar `scale-[1.03]` (durasi 300ms, dinonaktifkan pada reduced motion). Card info statis (langkah Cara Pesan, Kami Bantu) memakai lift halus `-translate-y-0.5` + shadow `0 6px 16px rgba(10,0,0,0.1)`.

### Status

- Warna selalu ditemani teks.
- Mapping status ada di satu helper.
- Admin boleh lebih padat; public menggunakan label manusiawi.

### Navigation

- Header publik = Graphite gelap (`bg-foreground`), bukan strip merah penuh; Signal Red untuk aksen (search, badge, Flash Sale).
- Ikon aksi header (hamburger, search mobile, Pesanan, Keranjang) memakai hover ala IKEA: latar pill/lingkaran `bg-muted` muncul saat hover (`rounded-full`, `transition-colors`), `bg-border` saat ditekan; tanpa perubahan opacity ikon.
- Search bar desktop (dan dialog mobile) memakai placeholder berputar (contoh: `Cari: jendela sliding / 120x80`) via `useRotatingPlaceholder`; berhenti saat fokus/isi teks atau `prefers-reduced-motion`.
- Header memakai hamburger di kiri logo pada semua breakpoint. **Mobile:** emblem logo (`BrandWordmark mark`) di kiri search pill; aksi kanan = ikon saja. **Tablet/`md`–`lg`:** wordmark dipersempit, search absolute dibatasi agar tidak menabrak aksi; Pesanan + Keranjang **ikon saja** (`aria-label` tetap). **`lg+`:** label teks Pesanan/Keranjang tampil (`lg:w-auto` wajib agar tidak overlap); wordmark melebar penuh di `xl`. Strip navigasi utama di bawah bar dari `config/sitemap.php → navigation.desktop_main` (**Flash Sale** pertama dengan ikon petir, Signal Red, hover putih; tanpa item Promo).
- Mobile bottom navigation (`MobileBottomNav`): tinggi tetap `h-14`, 4 kolom `flex-1` rata tengah (ikon + label), ikon `22px`, label `10px` truncate, indikator aktif garis `w-7` di atas item.
- **Announcement bar** (Signal Red di atas header): **Mobile (`< md`)**: 1 promo per slide, rata tengah, ganti slide ~5.5s (fade). **Desktop (`md+`)**: marquee kontinu (hover menjeda). Copy sentence-case fokus model/benefit (bukan ALL CAPS). Flash Sale di bar **maksimal 1 item** dan hanya saat periode kampanye live (`FlashSalePeriodSettings`); teks "Flash Sale" dari config/CMS/banner difilter. Ikon konteks + chip persen putih bila ada `-N%`; tanpa separator diamond/◆.
- Drawer membuka dari kiri dengan surface polos tanpa border, divider, atau shadow. `Model Produk` dan `Semua Produk` menjadi heading utama. Submenu model memakai **accordion caret** di semua breakpoint (bukan hover-only di desktop); tap caret membuka panel taxonomy.
- Ikon keranjang desktop menampilkan hover/focus preview sesuai Figma `10374:5562`: panel 360px berujung panah merah yang tepat di bawah pusat ikon cart, header Signal Red dengan judul + tombol tutup, daftar isi keranjang pada surface putih (maks 5 baris dari shared prop `cartPreview`: thumbnail 1:1, nama produk 2 baris, variasi, `qty × harga`; sisanya diringkas satu baris) atau empty state, dan CTA merah setinggi 55px (`rounded-full`). Badge jumlah pada ikon cart berbentuk lingkaran (`rounded-full`) Signal Red. Panel tetap dapat dioperasikan via keyboard; mobile memakai navigasi langsung ke halaman keranjang.
- Link drawer sekunder mengikuti `config/sitemap.php`: Flash Sale (urutan pertama + ikon), Hasil Pemasangan, Ulasan, Informasi Toko, Lacak Pengiriman, dan Konsultasi Gratis. Promo tidak ada di nav (route `/promo` tetap tersedia).
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

Versi pertama default ke light mineral untuk menjaga fidelity foto produk. Token disusun semantik
agar dark theme dapat ditambahkan tanpa mengubah komponen. **Storefront publik** tetap light-only
hingga foto, status, form, dan contrast diaudit.

**Admin panel:** toggle mode gelap/terang di header (`localStorage` key `ragil-admin-theme`).
Token `.dark` di `resources/css/app.css` dipakai hanya saat layout admin aktif; keluar admin
mengembalikan light agar toko publik tidak ikut gelap.
