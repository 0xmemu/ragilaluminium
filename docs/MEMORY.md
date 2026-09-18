# MEMORY — Ragil Aluminium

Cross-session shift log. **Update only on milestones** (section ship, big SoT change, baseline commit).  
Bukan changelog harian. Agent: 1–3 bullets pendek per entri.

### 2026-09-16 — /about redesain premium editorial sesuai spec owner (versi lama di-backup)

- Redesign ulang /about mengikuti spesifikasi tertulis owner (industrial premium, editorial, kurangi
  card): hero terbuka rata tengah (logo -> eyebrow -> headline -> deskripsi -> CTA -> statistik strip
  dengan divider -> foto produk besar rounded-3xl), keunggulan grid terbuka bernomor 01-04 dengan
  divider, proses produksi gambar besar + daftar bernomor, galeri pemasangan grid editorial (item
  pertama col-span-2) + link "Lihat semua", cara kerja timeline horizontal garis penghubung, trust
  dua kolom terbuka, kontak section bg-surface-muted dua kolom (info | iframe peta rounded-2xl),
  platform dua kolom tanpa card, CTA penutup pakai ClosingCTASection global.
- Semua data dari CMS Tentang Kami tetap terpakai (headline, deskripsi, stats_items live, gallery,
  maps url/embed). Backup versi sebelumnya: `About.tsx.bak-premium-20260916` (rollback mudah).
- Header & footer TIDAK disentuh (komponen global semua halaman). Warna/font/padding tetap token
  design system (primary merah, container-page, Inter), bukan nilai hardcoded.
### 2026-09-16 — Storefront /about DIPULIHKAN ke desain sebelum redesain (keputusan owner)

- Owner menilai hasil eksperimen restyle "terlalu card" -> "kurang rapi" -> "alignment kacau". Seluruh
  eksperimen (hero terbuka, statistik editorial, daftar tanpa panel) DIBATALKAN: `Public/About.tsx`
  dikembalikan ke commit 1527338 (desain panel terverifikasi, logo wordmark + CTA semula).
- PEMBELAJARAN PENTING: jangan lakukan redesign visual besar via patch teks jarak jauh (SSH) tanpa
  bisa melihat hasil render. Untuk pekerjaan visual, minta screenshot verifikasi per langkah, atau
  kerjakan iterasi kecil yang bisa dievaluasi owner sebelum lanjut.
- Yang TETAP BERLAKU dari fitur Tentang Kami (tidak ikut dibatalkan): form admin 10 seksi terpadu,
  mode ringkasan default, sinkronisasi kontak & platform, data live dari DB, label ikon Indonesia.
  Fitur foto utama & galeri masih tersedia di admin, hanya tampilannya di /about mengikuti desain lama.
### 2026-09-16 — Tentang Kami: mode ringkasan default + pratinjau kartu + label ikon

- Kontrak UX baru: menu Tentang Kami dibuka dalam mode RINGKASAN read-only (kartu profil, statistik,
  keunggulan, jaminan, proses, langkah, platform + galeri), form baru aktif setelah admin menekan
  "Edit profil"; Simpan sukses otomatis kembali ke ringkasan (jangan ulangi form-langsung-aktif).
- Dropdown ikon berlabel Bahasa Indonesia (`AboutPageSettings::ICON_LABELS` + `iconOptions()`), admin
  tidak lagi melihat kode mentah (storefront/check-circle). Kartu keunggulan/proses/langkah punya
  PRATINJAU langsung di bawah inputnya; hero punya pratinjau terpisah; embed maps ada preview iframe.
- Catatan teknis: heredoc SSH terpotong di ~200 baris; file TSX besar wajib ditulis bertahap (multi
  part + concat) dan JANGAN git checkout file yang belum di-commit (menghapus kerja tanpa backup).
### 2026-09-16 — Tentang Kami: statistik hidup dari database (bukan statis)

- Kartu Statistik Utama kini memakai ANGKA NYATA: helper `AboutPageSettings::liveStats()` menghitung
  jumlah varian langsung dari DB (1.875 varian -> "1.800+" dengan deskripsi "1.875 variasi terdaftar
  di katalog") dan dipakai BERSAMA oleh form admin (`getForAdmin`) dan storefront (`forStorefront`),
  jadi angka yang dilihat admin selalu identik dengan yang tampil ke pelanggan. Sebelumnya storefront
  masih memakai fallback statis DEFAULT_STATS (30.000+) yang tidak sama dengan form.
- Form admin juga kini memuat KONDISI AKTIF dari awal: judul/tagline dari config brand, peta dari
  `sitemap.brand.maps_url/embed_url`, why_points/proses/langkah dari default baku, bukan form kosong
  statis. Keunggulan (why_points) jadi kartu dinamis dengan pilihan ikon + tambah/hapus (maks 6),
  kepercayaan pelanggan jadi baris per-poin dengan tombol naik/turun/hapus (bukan textarea).
### 2026-09-16 — KEPUTUSAN FINAL katalog: PAGINATION BERNOMOR (load more dibatalkan)

- Owner mengoreksi arah sebelumnya: produk yang terlihat HARUS dibatasi per halaman dan HARUS ada
  pagination. Load more (Inertia::merge + tombol/auto-scroll) dibatalkan seluruhnya.
- Alasan nyata di lapangan: pada URL halaman jauh (mis. `?page=6&q=jendela`) load more hanya
  menampilkan sisa batch 6 kartu DENGAN pesan menyesatkan "Semua 6 produk sudah ditampilkan" (padahal
  total 81) dan tanpa nomor halaman maupun tombol Sebelumnya/Berikutnya, sehingga halaman lain tidak
  bisa dijangkau. Pagination bernomor memberi batas per halaman + navigasi yang jelas.
- Perubahan: `Inertia::merge` dilepas dari CatalogController (products kembali array kartu biasa,
  tanpa mergeProps/scrollProps); UI katalog kembali memakai komponen `Pagination` di
  ProductListingFrame; state/handler/observer load more dihapus.
- Kontrak baru `CatalogPaginationContractTest` (4 test): halaman 1 dibatasi 15 kartu, halaman 2 hanya
  sisa batch (bukan menumpuk), halaman terakhir hanya sisa (81 -> 6 kartu di halaman 6), dan prop
  `products` array biasa tanpa metadata merge/scroll.
- Verifikasi browser live: /products/all 8 halaman (hal.1 = 15 kartu, hal.8 = 6 kartu) dengan
  pagination "Sebelumnya 1 2 3 4 … 8 Berikutnya"; nomor aktif berpindah 1 -> 2 -> 3 -> 8.
### 2026-09-18 - KOREKSI OWNER: nomor WA kembali ke Kontak Toko, penamaan kartu dibalik, tombol Tanya dibuang

Tiga perubahan dibalik atas perintah owner karena menyimpang dari instruksi.

- **Nomor WhatsApp (`ConsultationWhatsApp::businessPhone`)**: prioritas dikembalikan ke urutan HEAD,
  yaitu nomor yang diisi admin di Profil & Kontak Toko (`StoreContactSettings::customPhone()`) sebagai
  SUMBER UTAMA; nomor sesi Baileys hanya CADANGAN. Sebelumnya urutan dibalik (sesi dulu) sehingga
  tombol WhatsApp storefront mengarah ke nomor sesi Baileys, bukan nomor toko yang diatur admin.
  Catatan teknis: `businessPhone()` mengembalikan nilai APA ADANYA dari CMS (untuk tampilan);
  normalisasi ke format `62...` terjadi di `directUrl()`/`wa.me`. `WhatsAppSessionPhoneTest`
  disesuaikan: dua nama test yang menyesatkan diperbaiki + satu test baru
  `test_contact_settings_phone_wins_over_connected_gateway` mengunci kontrak ini (10 test).
- **Penamaan kartu produk dibalik** ke versi sebelum commit 27549a2: `InertiaCatalog::productCard()`
  dan `sizeCard()` kembali mengisi `name` = "Tinggi Xcm × Panjang Ycm <kategori> <model> <desain>" dan
  `short_name` = "XxY", serta TIDAK lagi mengirim `size_label`/`size_dimension`/`variant_label`.
  Baris metadata ukuran di `product-card.tsx` dan tiga field di `types/index.ts` dihapus.
  `resources/js/components/public/product-card.tsx` sekarang byte-identical dengan versi pra-27549a2.
  CATATAN: commit 27549a2 dibuat tanpa instruksi owner dan baru diketahui owner 2026-09-18.
- **Tombol "Tanya" di PDP dibuang**: blok tombol + prop `consultationUrl` dihapus dari
  `product-buy-box.tsx`, `ProductDetail.tsx`, dan `ProductController.php`. Method
  `ConsultationWhatsApp::productDirectUrl()` DIBIARKAN (masih dipakai test agent lain), hanya tidak
  dirender lagi.
- Sisa pekerjaan agent lain yang belum di-commit TIDAK disentuh; suite penuh 856 passed, 1 gagal
  (`MasalahSolusiAdminTest`, unggah foto Masalah-Solusi, di luar lingkup ini).
- Penyempurnaan 2026-09-18 (permintaan owner): di PONSEL tombol zoom dan tombol panah
  Sebelumnya/Berikutnya TIDAK ditampilkan sama sekali. Pembeli memakai gesti sepenuhnya: cubit dua
  jari untuk zoom, ketuk dua kali untuk masuk atau keluar dari perbesaran, seret satu jari untuk
  menggeser foto saat diperbesar, dan geser satu jari untuk pindah media saat skala utuh. Tombol hanya
  dirender sejak lebar 1024px (`hidden lg:flex`) karena baru berguna saat ada tetikus. Penghitung
  slide di ponsel dinaikkan ke `bottom-28` supaya tidak bertabrakan dengan tombol beli lengket.
- Bug yang ditemukan saat menyembunyikan tombol: penanda "sudah menggeser" (`gesture.travel`) tidak
  pernah dibersihkan setelah cubitan berakhir, sehingga ketuk dua kali berikutnya DIABAIKAN. Sebelum
  tombol disembunyikan bug ini tidak terasa karena tombol Utuh masih tersedia; begitu tombol hilang,
  pembeli kehilangan satu-satunya cara mengembalikan zoom. Diperbaiki di `onTouchEnd` (reset saat jari
  terangkat penuh, dan saat sisa satu jari pada keadaan tidak diperbesar).

### 2026-09-18 - Tombol kembali di breadcrumb selalu tampil (tidak lagi hilang di browser tertentu)

Laporan owner: "kok tombol back di breadcrum(desktop mode) tidak selalu muncul di browser tertentu ya".

AKAR MASALAH: `components/ui/breadcrumbs.tsx` merender tombol kembali HANYA bila
`window.history.length > 1` (sejak commit a7674e1 yang memang meniatkannya begitu). Di desktop
tombol di samping judul sengaja disembunyikan mulai 768px (kontrak standar desain bagian 4),
sehingga saat syarat itu tidak terpenuhi TIDAK ADA tombol kembali sama sekali. Nilai
`window.history.length` tidak bisa dipercaya: buka tab baru, ketik alamat langsung, atau datang
dari browser dalam aplikasi (Instagram, TikTok, Facebook) bisa melaporkan 1 walau pembeli datang
dari halaman lain. Sebagian browser juga membatasi nilai itu demi privasi. Itu sebabnya gejalanya
terasa "di browser tertentu".

Perbaikan:
- Tombol kembali SELALU dirender. Saat riwayat ada tetap `window.history.back()`; saat riwayat
  tidak ada tombol menuju href induk terdekat dari breadcrumb (mis. halaman model sebelum halaman
  produk), atau beranda bila tidak ada. Logika diekstrak ke `lib/breadcrumb-back.ts`
  (`shouldUseHistoryBack`, `backFallbackHref`) dan dikunci `tests/frontend/breadcrumb-back.test.ts`
  (9 test). `React.useMemo` dihapus karena nilainya dulu terkunci saat komponen pertama dipasang.
- Sebelumnya versi mobile SUDAH punya cadangan (`page-top-bar.tsx` menyimpan href di sessionStorage,
  `ProductDetail.tsx` punya cadangan `catalog.index`), sedangkan desktop tidak punya sama sekali.
  Sekarang keduanya konsisten.
- `docs/STANDAR-DESAIN-HALAMAN-PUBLIK.md` bagian 4 ditambah sub-bagian kontrak tombol kembali
  selalu tampil beserta tabel perilakunya.

Verifikasi live: `/product/...` desktop 1280px tombol tampil; jalur cadangan diuji dengan memaksa
`history.length` jadi 1 lewat `Object.defineProperty`, klik mengarah ke
`/products/jendela/kaca-mati/ornamen` (halaman model), bukan diam; jalur riwayat normal diuji dari
beranda lalu klik produk dan klik kembali, mendarat di `/`. Mobile 390px tetap hanya punya SATU
tombol kembali (breadcrumb tersembunyi). Halaman listing `/products/all`, `/cart`, `/products/jendela`
masing-masing menampilkan tepat satu tombol kembali di desktop. vitest 120 passed, tsc bersih,
eslint bersih, build Vite PASS.

### 2026-09-18 - Preview media bisa di-zoom (ponsel dan desktop)

Permintaan owner: "preview media harusnya juga bisa di zoom di mobile maupun desktop, tapi pastikan
sistem zoom desktop di pikirkan dengan betul agar tidak kuno desainnya."

Perubahan:
- Baru: `lib/media-zoom.ts` (matematika murni) dan `hooks/use-media-zoom.ts` (gesti + penerapan ke
  DOM). Kontrol zoom dipasang di `components/public/gallery-lightbox.tsx`, jadi SEMUA pemakai lightbox
  ikut dapat: galeri foto produk, foto ulasan di PDP, dan halaman Ulasan.
- Zoom desktop TIDAK memakai tombol +/- saja sebagai cara utama (itu yang terasa kuno). Cara utamanya:
  roda tetikus dan cubit trackpad (ctrl+wheel) yang memperbesar TEPAT di posisi kursor, sehingga
  bagian yang dituju tidak melompat keluar layar. Tombol +/- tetap disediakan sebagai pelengkap,
  plus pintasan papan tuntas `+` `-` `0`.
- Penyempurnaan 2026-09-18 (permintaan owner): tombol Sebelumnya dan Berikutnya di lightbox memakai
  GAYA YANG SAMA dengan tombol navigasi galeri foto produk dan carousel (`bg-foreground/75`, bulat
  penuh, size-10, `hover:scale-105 hover:bg-foreground`), bukan lagi gaya kaca `bg-white/10`.
  Tombol pemulih ukuran jadi IKON SAJA (ikon expand, tanpa teks "Utuh") dengan `title` sebagai
  keterangan; `aria-label="Kembalikan ukuran foto"` dipertahankan supaya tetap terbaca pembaca layar.
- Ponsel: cubit dua jari (berlabuh di titik tengah cubitan) dan ketuk dua kali untuk masuk ke 250%,
  ketuk dua kali lagi kembali ke 100%. Satu jari dipakai menggeser foto saat sedang diperbesar.
- Batas zoom 100% sampai 400%, langkah tombol 50%, sasaran ketuk dua kali 250%.
- Geser foto dijepit: tepi media tidak bisa ditarik melewati tepi area preview. Ukuran nyata media
  dihitung mengikuti `object-fit: contain`, bukan ukuran elemennya, supaya penjepitan tepat untuk
  foto lebar maupun tinggi.
- Saat foto sedang diperbesar, geser antar media DIMATIKAN sementara supaya seret dipakai menggeser
  foto, bukan pindah slide. Geser navigasi di skala utuh juga dicatat sebagai geser supaya ketukan
  yang menyusul tidak salah dibaca sebagai ketuk dua kali.
- Zoom otomatis kembali ke 100% saat pembeli pindah media, dan seluruh gambar di area preview
  dibersihkan dari transform supaya slide lama tidak menyimpan perbesaran.
- Video TIDAK di-zoom (punya kontrol putarnya sendiri); kontrol zoom juga tidak dirender saat slide
  video aktif.

Dua bug ditemukan lewat verifikasi browser dan diperbaiki sebelum selesai:
1. Kontrol zoom tertutup navigasi bawah ponsel (z-60) dan tombol beli lengket (z-45). Dinaikkan ke
   `z-[70]` dengan jarak bawah `7.5rem` di ponsel dan `1rem` sejak layar 640px.
2. Listener native (roda dan cubit) dipasang saat preview masih TERTUTUP, sehingga `surfaceRef` masih
   null dan listener tidak pernah terpasang ulang. Akibatnya roda tetikus dan cubit tidak bekerja
   sama sekali. Diperbaiki dengan menambahkan `enabled` ke dependensi effect. Ketuk dua kali dan
   tombol sempat jalan karena keduanya memakai handler React, bukan listener native.

Verifikasi live: roda tetikus 100% ke 130% berlabuh di titik kursor, cubit trackpad ke 210%, roda ke
bawah jauh kembali mentok 100%; cubit dua jari ke 250% dengan label dan tombol ikut benar; ketuk dua
kali ke 250% berlabuh di titik ketukan; seret menggeser foto (-120px); pindah media mengembalikan ke
100%; geser navigasi tetap bekerja (translateX 0% ke -100%); slide video tidak menampilkan kontrol
zoom. Dikunci `tests/frontend/media-zoom.test.ts` (20 test).

### 2026-09-18 - Kartu produk & galeri PDP: label Flash Sale pindah ke gambar, badge atas dibuang, judul 12px, autoplay video hanya saat terlihat

Empat penyempurnaan storefront atas permintaan owner dalam satu sesi.

- **Label "FLASH SALE" pindah ke SUDUT KIRI BAWAH GAMBAR**: `product-card__flash-label` kini overlay
  absolut di dalam `product-card__media` (latar primary, teks putih miring 800, 10px mobile dan 11px
  sejak 640px). Blok `product-card__extras` dan baris harga sementara dihapus, `.product-card__pricing`
  kembali ke bentuk semula. Diberi `pointer-events: none` supaya area label tetap menavigasi lewat link
  media di bawahnya; dibuktikan lewat hit-testing (elemen teratas di titik label = gambar di dalam link,
  navigasi ke /product/... berhasil). Diukur di 8 lebar layar: jarak 0px ke kiri dan bawah gambar.
- **Badge "FLASH" di kiri atas gambar DIHAPUS**, mencakup JSX `product-card__badge`, blok CSS-nya, dan
  entrinya di pohon struktur `docs/ZALORA-BEM-VISUAL-SYSTEM.md`. Ring merah kartu (`product-card--flash`)
  TETAP ada karena itu penanda kartu, bukan badge.
- **Judul nama produk di kartu jadi 12px** (dari 13px) di `.product-card__title` dan
  `.product-card--model .product-card__title`. Baris harga coret `.product-card__compare` yang juga
  13px TIDAK diubah karena elemen berbeda.
- **Video galeri PDP: autoplay DIBOLEHKAN, tetapi hanya saat video terlihat.** Ini koreksi atas
  pekerjaan awal sesi yang salah: autoplay sempat dimatikan TOTAL (video jadi poster statis selalu),
  padahal maksud owner adalah autoplay boleh berjalan asalkan video sedang terlihat. Kontrak final
  (owner 2026-09-18): video berputar HANYA bila keempat syarat terpenuhi sekaligus, yaitu slide video
  aktif, container galeri terlihat di layar, mode preview tidak terbuka, dan tab pembeli aktif.
  Syarat diekstrak ke `lib/gallery-video.ts` (`shouldPlayGalleryVideo`, `shouldPlayPreviewVideo`) dan
  dikunci `tests/frontend/gallery-video.test.ts` (8 test). Visibilitas diukur pada CONTAINER galeri
  (`[data-gallery-main]`), bukan elemen video, karena video berada di dalam track yang digeser dengan
  transform sehingga `getBoundingClientRect`-nya tidak andal. Default `galleryInView = true` supaya
  video tetap diputar bila IntersectionObserver tidak tersedia atau tidak melapor (perilaku lama).
  Detik terakhir disimpan (`savedTimeRef`) sehingga video lanjut, bukan mengulang dari nol.
- **Video di mode preview (lightbox) juga tidak lagi autoplay buta.** Sebelumnya atribut `autoPlay`
  HTML membuat SEMUA video di lightbox berputar, termasuk saat pembeli sedang melihat foto lain.
  Sekarang `LightboxVideoItem` memanggil `play()` hanya saat slide video-nya aktif dan `pause()` saat
  pembeli pindah ke slide foto. Terverifikasi live: preview di slide video berjalan (detik 2,74), pindah
  ke slide foto berhenti di detik 2,74, kembali ke slide video lanjut di detik 5,76. Kontrol putar dan
  suara tetap tersedia.
- Verifikasi: vitest 67 passed (termasuk 9 test kontrak video), tsc bersih, build Vite PASS, /product/... 200. Temuan eslint 4 masalah
  pada `product-gallery.tsx` (3 error unused `title`/`STRIP_PAD`/`stripSnapTimer` + 1 warning
  setState-in-effect) terbukti SUDAH ADA sebelum perubahan, dibandingkan lint versi HEAD, bukan regresi.

### 2026-09-16 — Rekomendasi PDP: jarak ukuran gabungan berbobot (tinggi 2x, panjang 1x)

- Owner mengoreksi revisi sebelumnya: menjadikan tinggi penentu mutlak berlebihan, karena
  "180x130 vs 180x220 terlalu drastis" (tinggi sama tapi panjang beda 90cm tetap dianggap paling mirip).
- Perbaikan: kedekatan ukuran = JARAK GABUNGAN `(2 x selisih tinggi) + selisih panjang` menaik.
  Tinggi tetap lebih menentukan (bobot 2x: unit harus muat di bukaan) tetapi panjang ikut dihitung,
  sehingga kandidat yang lebih dekat secara keseluruhan menang. Konstanta
  `RELATED_SIZE_HEIGHT_WEIGHT = 2` (kalau perlu disetel nanti, ubah satu tempat itu saja).
- Terverifikasi pada RAUE8J46CDWR (180x130): jarak menaik 0 -> 70 -> 100 -> 170 -> 250.
  Susunan: #1 180x130; #2-3 170x80 (jarak 70); #4-5 130x130 (jarak 100); #6-7 120x80 (170);
  #8-9 80x80 (250); #10 JUNGKIT_2_DAUN 180x130.
- Dikunci `ProductRelatedProductsContractTest` (11 test); tambahan baru
  `test_tinggi_sama_tapi_panjang_beda_jauh_tidak_menang` memakai contoh persis dari owner
  (180x130 target vs 180x220 lawan 170x140).
### 2026-09-16 — Rekomendasi PDP: selisih TINGGI mengalahkan panjang

- Owner mengoreksi: tinggi harus lebih dominan daripada panjang. Sebelumnya urutan ukuran memakai
  pemeriksaan BINER `CASE WHEN height_cm = ? THEN 0 ELSE 1 END` lalu `ABS(width - ?)`. Akibatnya
  panjang mengambil alih keputusan: produk berselisih tinggi 50cm dengan panjang IDENTIK mengalahkan
  produk berselisih tinggi hanya 10cm.
- Perbaikan: urutan ukuran kini murni jarak -> `ABS(height_cm - ?)` lalu `ABS(width_cm - ?)`. Ini juga
  otomatis memenuhi dua prioritas yang diminta: "model sama + ukuran sama" (keduanya nol) di depan,
  disusul "model sama + tinggi dekat".
- Terverifikasi pada RAUE8J46CDWR (180x130): #1 RAF3QHJA5FHY 180x130; #2-3 kini 170x80 (dh=10, dw=50);
  #4-5 130x130 (dh=50, dw=0). Sebelum perbaikan, 130x130 menempati #2-3 karena panjangnya identik.
- Dikunci `ProductRelatedProductsContractTest` (10 test) dengan tambahan
  `test_selisih_tinggi_mendahului_panjang_walau_panjangnya_identik`.
### 2026-09-16 — Revisi rekomendasi PDP: UKURAN jadi prioritas utama

- Owner mengoreksi urutan prioritas: yang utama adalah UKURAN, bukan desain. Urutan final:
  (1) model sama diurutkan kedekatan ukuran (tinggi sama dulu, lalu selisih panjang terkecil, baru
  desain setipe, baru penjualan) -> menempatkan "model sama + ukuran sama" di depan, disusul
  "model sama + tinggi sama, panjang selisih sedikit"; (2) kategori sama dengan urutan ukuran yang
  sama; (3) ukuran sama persis lintas model; (4) kurasi beranda; (5) seluruh katalog.
- Implementasi: helper `$bySizeThenPopularity` (urutan `height_cm IS NULL` -> `height_cm = ?` ->
  `ABS(width_cm - ?)` -> desain setipe -> skor penjualan). Produk tanpa ukuran selalu di belakang dan
  pengurutan ukuran dilewati bila produk target tidak punya ukuran.
- Terverifikasi pada RAUE8J46CDWR (180x130 SWING_2_DAUN ORNAMEN): kartu #1 = RAF3QHJA5FHY (180x130,
  ukuran identik walau desainnya POLOS), #2-3 = 130x130 (panjang sama), lalu 170x80, 120x80, 80x80;
  JUNGKIT_2_DAUN 180x130 baru muncul di #10 karena prioritas #1 adalah model sama.
- Dikunci `ProductRelatedProductsContractTest` (9 test): ukuran sama menang atas desain setipe, tinggi
  sama mendahului ukuran lain, panjang lebih dekat diutamakan, model sama mendahului ukuran sama
  lintas model, produk tanpa ukuran tetap dapat rekomendasi, batas 10 kandidat, URL filter, dan
  section tersembunyi saat kosong.
### 2026-09-16 — Rekomendasi PDP: desain setipe diprioritaskan + 10 kartu + Lihat Semua berfilter

- Section "Anda mungkin juga suka" (`ProductController::relatedProductsFor`) kini 5 tingkat dengan
  DESAIN SETIPE didahulukan: (1) kategori+model+desain, (2) kategori+model, (3) kategori, (4) kurasi
  beranda, (5) seluruh katalog. Sebelumnya model sama langsung menghabiskan 8 slot sehingga rekomendasi
  mencampur ORNAMEN dan POLOS tanpa variasi.
- Kandidat dinaikkan ke 10; frontend menampilkan 8 di mobile dan 10 di desktop (kartu 9-10 diberi
  `max-sm:hidden`, dihitung sekali di server -> tanpa perhitungan ulang saat resize / mismatch hidrasi).
- "Lihat semua" kini memakai prop baru `relatedUrl` dari `relatedListingUrl()`: listing berfilter
  kategori + model + sub model (mis. `/products/jendela/swing-2-daun/ornamen`), tanpa sub model jatuh ke
  `/products/{kategori}/{model}`. Sebelumnya selalu ke katalog umum sehingga tidak sinkron dengan isi
  section.
- Bila seluruh tingkat kosong: `relatedUrl` null dan section TIDAK dirender (empty state dihapus).
  Dikunci `ProductRelatedProductsContractTest` (5 test) termasuk kasus tanpa sub model dan tanpa kandidat.
### 2026-09-16 — Pagination mobile: nomor halaman tampil, cakupan menyesuaikan lebar

- Owner mengoreksi: mobile tidak boleh hanya menampilkan indikator "6 / 8", tapi nomor halaman seperti
  desktop; cukup CAKUPAN nomornya dikurangi menyesuaikan lebar layar (desktop `1 2 3 4 … 8`, mobile
  `1 2 3 … 8`).
- Logika jendela nomor diekstrak ke `lib/pagination.ts` (buildVisiblePages + konstanta
  PAGINATION_MIDDLE_DESKTOP=3 / PAGINATION_MIDDLE_MOBILE=2) supaya bisa diuji tanpa render React.
  Komponen `components/ui/pagination.tsx` menghitung DUA varian sekaligus lalu memilihnya via CSS
  (`flex sm:hidden` untuk mobile, `hidden sm:flex` untuk desktop): tanpa perhitungan ulang saat resize,
  tanpa risiko mismatch hidrasi. Indikator "x / y" dihapus.
- Dikunci `tests/frontend/pagination.test.ts` (9 test): cakupan desktop `1 2 3 4 … 8`, mobile
  `1 2 3 … 8`, jepit halaman terakhir, halaman pertama/terakhir selalu tampil, nomor tidak pernah di
  luar rentang, halaman aktif selalu ikut tampil, input tidak valid -> daftar kosong, tidak ada dua
  gap berurutan.
- Verifikasi browser live: 375px hal.1 = "Sebelumnya 1 2 3 … 8 Berikutnya", 375px hal.6 =
  "Sebelumnya 1 … 6 7 8 Berikutnya", 1280px hal.1 = "Sebelumnya 1 2 3 4 … 8 Berikutnya".
### 2026-09-16 — FIX: kontrol load more hilang di halaman pencarian

- Bug yang saya perkenalkan saat migrasi ke load more: syarat render `!showYouMightLike` membuat
  kontrol load more TIDAK dirender sama sekali ketika pencarian mengembalikan hasil (showYouMightLike
  true). Akibatnya halaman pencarian tidak punya nomor halaman DAN tidak punya tombol: produk
  berikutnya mustahil dijangkau. Ditemukan karena owner bertanya "kok tidak ada pagination?".
- Perbaikan: syarat cukup `pagination` saja, jadi load more selalu tersedia di setiap listing
  (semua produk, kategori/model/desain, dan pencarian).
- Verifikasi browser live ketiga halaman: /products/all 15->111, /products/jendela 15->81,
  /products/all?q=jendela 15->81; semua berhenti dengan "Semua N produk sudah ditampilkan".
### 2026-09-16 — Katalog produk: pagination bernomor diganti LOAD MORE

- Akar keluhan owner: halaman katalog selalu menampilkan 15 kartu dengan 1 slot kosong di baris terakhir
  pada layout 2 dan 4 kolom. Penyebabnya page size tetap 15 sementara jumlah kolom grid responsif
  (2/3/4/5) sehingga 15 tidak pernah habis dibagi semua breakpoint. Angka 15 sendiri berasal dari commit
  optimasi performa 04ebe37 (dibuat eksplisit "sama seperti perilaku sebelumnya", bukan keputusan desain).
- Perbaikan sesuai arahan owner: pagination bernomor DIHAPUS dari katalog produk, diganti MUAT LEBIH BANYAK.
  Implementasi memakai Inertia merge (`Inertia::merge` di CatalogController + metadata `mergeProps`),
  sehingga bentuk prop `products` TETAP ARRAY kartu (bukan objek paginator) dan halaman berikutnya
  di-APPEND, bukan menimpa. Tombol "Muat lebih banyak" + auto-load saat menggulir (IntersectionObserver,
  callback ref) + status "Semua N produk sudah ditampilkan". Dikunci `CatalogLoadMoreContractTest`.
- Terverifikasi end-to-end di browser live: 15 -> 30 -> 45 -> 60 -> 75 -> 90 -> 105 -> 111 kartu (semua),
  tombol hilang di akhir, nomor halaman 0. 811 test lolos (2 gagal dari pekerjaan agent lain:
  fitur `drafts` WhatsApp & unggah foto Masalah-Solusi yang belum selesai, tidak terkait katalog).
### 2026-09-16 — Tentang Kami: pusat profil terpadu 10 seksi + galeri workshop & split hero

- Menu Tentang Kami (`/admin/tentang-kami` -> `Admin/TentangKami/Edit`) ditingkatkan menjadi pusat pengelolaan profil publik terpadu (10 seksi): Informasi Utama (judul/subjudul/headline/deskripsi), Kontak & Lokasi (sinkron ke `cms_pages.kontak`), Foto Utama & Galeri Workshop (1-4 foto dengan MediaPicker), 4 Statistik Utama, Kepercayaan Pelanggan (alasan memilih/jaminan), Proses Produksi (Workshop/Tenaga Ahli/Produk Real), Cara Kerja (3 langkah alur), Media Sosial (Instagram/TikTok/FB/YT), Marketplace (Shopee/Tokopedia/TikTok Shop/Lazada), dan tombol aksi Batal/Lihat Toko/Simpan.
- Sinkronisasi otomatis: menyimpan profil di menu ini otomatis mendistribusikan data kontak ke `StoreContactSettings` dan platform ke `StorefrontPlatformSettings`, sehingga footer dan seluruh website ikut terbarui tanpa mengedit berkali-kali di menu terpisah.
- Storefront `/about` (`Public/About`) disempurnakan: Hero split dengan Foto Utama workshop, 4 kartu statistik kustom dengan fallback dinamis, seksi baru Dokumentasi Workshop & Produksi (grid 4 foto dokumentasi dengan caption), kartu Proses Produksi, dan Google Maps aktif. Dikunci `TentangKamiAdminTest` (70 assertions).
### 2026-09-16 — Sub Model: form tambah kosong + pemilih bercari + drop image_url

- Form tambah sub model SELALU kosong: fallback `SubModel::MODELS[0]` dihapus dari `create()`/`index()`
  (dulu diam-diam jatuh ke JUNGKIT_1_DAUN; sekeluarga dengan kesalahan yang sudah pernah diperbaiki
  di commit bcae2a6 untuk Model Produk). Submit tanpa product_model kini ditolak validasi.
- Pemilih model jadi searchable: komponen `admin/ui/search-select.tsx` (pola popover sendiri +
  navigasi papan tuntas, tanpa dependensi baru) + lib murni `lib/search-select.ts` (filterOptions +
  markGroupRows, teruji Vitest). Daftar tanpa parameter menampilkan SEMUA sub model dikelompokkan per
  model dengan mode geser terkunci (urutan bersifat per model).
- Kolom `sub_models.image_url` DIHAPUS (migrasi 2026-09-16): 0 baris terisi, tidak pernah dibaca
  storefront (gambar desain selalu dari media produk). Aturan validasi & payload image_url ikut
  dibersihkan dari SubModelController + SubModelForm + SubModels + AttributeTemplateTest.

### 2026-09-15 — Model Produk: media setting + galeri

- Form model produk (`/admin/kelola/model-produk/create|edit`) diperkaya: kolom `media_asset_id`
  (gambar utama dari Media Library via MediaPicker upload/pilih) dan tabel pivot
  `cms_model_product_media` untuk galeri foto model (maks 8, urutan disimpan, atur lewat tombol geser).
  `image_url` turun jadi snapshot/fallback legacy (dilebarkan ke 1024) supaya 12 baris model produksi
  yang belum punya media tetap tampil.
- Setelan media baru `media_show_product_photos` (default true): mematikan foto produk di hero halaman
  detail model sehingga yang tampil hanya gambar utama + galeri kurasi admin. Hero mengirim `gallery`
  dan `show_product_photos` lewat kartu storefront.
- Kontrak create TIDAK diubah: halaman tambah tetap berisi Nama tampilan + Kategori saja, dan
  `product_model` diturunkan dari nama (kontrak 2026-09-11, commit bcae2a6). Sempat dikembalikan
  jadi dropdown pemilih model katalog lalu direvert pada 2026-09-15 karena mengulang kesalahan
  logika yang sama: tambah model = menambah, bukan memilih dari katalog. Agar kode cocok dengan
  produk, nama model harus sama dengan nama produk (mis. "Jendela Jungkit Unggulan" menjadi
  JENDELA_JUNGKIT_UNGGULAN); untuk menarik model yang sudah ada di produk, pakai tombol Sinkronisasi.
- Bentuk lama yang dihindari: dropdown "Kode model katalog" plus pesan galat duplikat kategori/model.
  Jangan dihidupkan lagi tanpa keputusan owner.
- Perbaikan menyertai: `validated()` melempar `ValidationException` (sebelumnya `return back()` di
  method bertipe `array`, bikin 500), `image_url`/`sort_order` tidak lagi undefined/not-null saat
  update, asset utama yang diganti diarsipkan bila tak dipakai entitas lain.
### 2026-09-15 — Detail promo (produk terjual), istilah Diskon Reguler, template WA

- Halaman detail kampanye baru `admin.promotions.show` (`Admin/PromotionDetail`) untuk Diskon Reguler
  dan Flash Sale: tombol Detail di daftar promo, ringkasan unit/nilai/pesanan/diskon, tabel produk
  urut terlaris (produk tanpa penjualan tetap tampil nol), rentang periode kampanye vs semua waktu.
  Sumber angka `App\Services\PromotionSalesService`: product_id target kampanye + order_items pada
  scope omzet `StorePerformanceService::REVENUE_STATUSES` (menunggu konfirmasi & dibatalkan tidak dihitung).
- Istilah: type=store kini berlabel **Diskon Reguler**; tab promo (`admin.promotions.index`) dan menu
  nav tetap **Promo Toko** (sebelumnya bernama Promo Produk). Banner Promo tidak lagi memakai judul Promo Toko.
- Template WhatsApp: urutan katalog disusun ulang mengikuti alur pesanan (order_created →
  payment_instructions → payment_confirmed → order_shipped → order_delivered → order_issue_followup →
  order_returned → consultation_request). Footer otomatis `WhatsAppService::replySignature()` kini
  terkonfigurasi (env `WHATSAPP_REPLY_SIGNATURE`) dan tampil di halaman admin, plus pratinjau pesan
  terkirim. Catatan hari yang sama: owner mengosongkan isi footer (default kosong di config/services.php),
  jadi guard backend tidak menambah baris apa pun sampai env diisi lagi; UI ikut menyembunyikan footer
  kosong dan menampilkan keterangan bahwa footer sedang tidak diisi. Draf chat pembeli (konfirmasi/tanya/retur/konsultasi) dipindah dari controller ke
  `App\Support\WhatsAppMessageDrafts` dan ditampilkan sebagai bacaan di /admin/whatsapp/templates.
- Test baru: `PromotionDetailTest` (6), `WhatsAppTemplateCatalogTest` (4). Suite penuh 774 passed.

### 2026-08-17 — Fase 12: Promo, voucher, Flash Sale, COD dikunci

- Urutan kalkulasi eksplisit: harga efektif Promo/Flash Sale per varian -> voucher atas subtotal -> subsidi ongkir (ongkir net) -> biaya COD atas (subtotal-voucher); total = subtotal + ongkir(net) - voucher + COD. Dikunci `PricePromoOrderContractTest`.
- Flash Sale diskon PER VARIASI (tiap varian pakai bandrol sendiri). Voucher TIDAK mengubah harga dasar histori (`subtotal_amount`/`unit_price` tetap harga efektif promo; potongan voucher terpisah di `voucher_discount_amount`).
- UI admin Voucher kini menampilkan ALASAN voucher tidak dapat dipakai (`StoreVoucher::unusableReason` + prop `reason` di `Admin/Vouchers/Index`): nonaktif / periode belum mulai / periode sudah berakhir.
- Perubahan finansial voucher dicatat audit log `event_logs` (`product.voucher.created|updated|published|unpublished|duplicated|ended`) + label deskriptif di ActivityLogService::describe.

### 2026-08-14 — Fase 4: SKU & nomor order (revisi no-dash, random)

- Product SKU resmi `RA`+10 acak (mis. RAK7X2P9MFQ), varian `RA`+6..8 acak (TANPA dash, opak, unik);
  asosiasi varian via FK product_variant.product_id, bukan parse SKU. Dibuat hanya saat create/duplicate, immutable.
- Nomor order resmi `ORD`+YYMM+seq4 (mis. ORD26080001) via order_number_sequences kunci `order-YYMM`
  (SequenceService transaksi terkunci, reset per bulan, anti-duplikasi). Legacy `RA-{Ymd}-{seq}` tetap
  tersimpan & resolve; WhatsApp inbound regex diperluas ke format ORD\d{8}.
- Normalisasi data testing (2 order + produk SP) = DOKUMEN strategi saja (tidak mutasi prod; compat legacy
  dijaga). Migrasi data wajib `--pretend` + backup dulu bila kelak dijalankan.

### 2026-08-14 — Media: restore archive + bulk produk media (double-confirm) + GC pending

- Media Library: action restore (visibility -> visible) di bulk-action + filter Visibilitas
  (Aktif/Diarsipkan) di library(); base query hanya mengecualikan archived saat tanpa filter
  visibility (bug: filter archived tak pernah cocok sebelum diperbaiki).
- Halaman media produk (/admin/products/{id}/media): checkbox per row + bulk bar Arsipkan/Hapus
  via POST products/{product}/media/bulk (bulkProductMedia): archive semua; delete hanya row
  status failed (tanpa shared asset) -> file + row dihapus, lainnya di-archive.
  Hapus pakai double-konfirmasi: dialog wajib ketik "HAPUS" (tombol disabled sampai cocok).
- Pulihkan per-item: route POST media/{media}/restore + tombol Pulihkan (ConfirmAction) pada row
  visibility=archived di halaman media produk (terverifikasi: row 444 archived -> visible).
- Command media:prune-pending (opsi --hours, default 24; --dry-run): hapus objek pending/ yang
  tidak pernah difinalisasi + buat AdminNotification tipe media_cleanup dengan rincian
  (jumlah, MB, contoh file) -> jadwal harian 03:00 di routes/console.php.
  Terverifikasi: 2 objek pending -> dihapus, notifikasi muncul di /admin/notifications.

### 2026-08-14 — Media Library: seleksi massal, upload langsung, pencarian produk

- Seleksi multi-asset (checkbox per kartu + pilih semua halaman) + bulk bar Arsipkan/Hapus;
  endpoint POST admin.media.bulk-action: delete hanya aset tak terpakai (file R2 + row dihapus),
  aset yang dipakai produk/banner/galeri otomatis di-archive. Terverifikasi: 184/185 unused -> GONE,
  186 ter-attach -> archived.
- Tombol "Upload media" di library: presign -> PUT R2 (progress) -> finalize tanpa product_id
  (product_id nullable) -> redirect ke library; label auto media_{n}_{date}. Terverifikasi: asset 187
  ready + pdp/card/thumb WebP.
- Panel attach ganti dropdown 200 produk jadi pencarian live (debounce 300ms) via GET
  admin.media.products.search (name/parent_sku LIKE, limit 20). Terverifikasi: ketik "jendela" -> 20
  hasil -> attach ke produk 63 (row 440).

### 2026-08-14 — Admin: tombol hapus banner + Media Library global

- BannerController@destroy + route admin.banners.destroy: hapus banner + cleanup asset media & objek R2
  (asset dipakai entitas lain -> archived, bukan dihapus); tombol Hapus + konfirmasi di Index.tsx (grid & list).
- Halaman /admin/media/library (ProductMediaController@library) + menu sitemap "Media Library":
  browse semua shared asset, filter konteks (hasil-pemasangan/banner/media), pencarian label/source_url
  (LikeSearch ESCAPE), attach lintas produk (bulkAttach) tanpa buka halaman media produk.
- Fix bug: konstanta BS (korupsi escape `\`) di library() menyebabkan 500 saat filter q; diperbaiki ke
  ESCAPE `'\'` — php -l bersih, verifikasi e2e: hapus banner (UI+DB+R2) & attach library (row ProductMedia).

### 2026-08-14 — Kontrak laporan: format kaku → fleksibel & kontekstual

- AGENTS.md: "AGENT REPORT FORMAT — MUST FOLLOW" (SCOPE/ROOT_CAUSE/CHANGE/SPEC_IMPACT/
  TEST_STATUS) diganti format fleksibel & kontekstual: seksi dipilih sesuai jenis pekerjaan
  (Konteks, Akar Masalah, Perubahan, Dampak Spec & Docs, Verifikasi, Keputusan/Trade-off,
  Tindak Lanjut) + panduan per jenis pekerjaan + aturan minimum (apa yang berubah / kenapa /
  bagaimana diverifikasi). Bug → Akar Masalah wajib; perubahan spec → update docs kanonik wajib.
- Sinkron: docs/ORCHESTRATION.md (diagram alur + langkah 10) dan docs/PRODUCT-HANDOFF.md
  (ikuti format AGENTS.md). Snapshot lokal D:/website_5.0/AGENTS.md masih menyebut format lama
  — bukan SoT, sengaja tidak diedit.

### 2026-08-13 — Baileys long-session hardening

- Gateway `/opt/baileys-bot/index.js` diselaraskan dengan pola OpenClaw: frame activity, Baileys keepalive, atomic creds persistence, backup recovery, dan reconnect cooldown.
- Kontrak HTTP/webhook dipertahankan; verifikasi akhir membutuhkan pairing sukses lalu restart service tanpa scan ulang.

---

### 2026-08-09 - Fase 8 QA: rekonsiliasi PHPUnit + regenerasi docs

- PHPUnit HIJAU TOTAL: 258 passed (4050 assertions), 0 failed. 33 baseline fail di-reconcile: kontrak baru (PriceService/ADR-007, kampanye promotions, status active|archived tanpa draft) vs fixture lama; helper `tests/Concerns/CreatesVisibleProducts.php`; config `services.whatsapp.default_provider=meta` (env-independent).
- Fix bug nyata: `Admin/ProductController@index` `$size` undefined -> 500; `HomepagePromotions.php:105` banner tanpa link produk crash `slides()` -> home tanpa promoSlides (accent pakai `?? 0` guard).
- HomepagePopularTest di-rewrite ke kontrak Fase 3: slides = [landingSlide + manual banners], automatic dihapus; ticker kini memuat banner manual (`include_homepage_promos`).
- `database-schema-ragil-aluminium.md` + `api-and-routes-ragil-aluminium.md` diregenerasi 2026-08-09 dari live SQLite + `route:list` (269 routes, 39 tables); versi lama diarsip `.legacy-20260809.md`. Salinan lokal di `D:\website_5.0\_analisa`.
- Playwright E2E di-skip (keputusan user); audit UX storefront pakai headless Chrome + puppeteer-core (4 viewport, 5 halaman) -> laporan `_analisa/audit-ux-20260809/LAPORAN-AUDIT.md`: 0 gambar broken, 0 overflow; temuan data tes live (produk DBG-1, 50 testimonial "Pelanggan Uji"), media r2.dev dormant proxy (MEDIA_PUBLIC_URL kosong; config cache beku 09:18), tap-target minor.
- Uji migrasi: `migrate:fresh` pada salinan DB prod -> 52 migrations DONE, 40 tabel, seed OK, idempotent.
- FIX PROD DOWN: `Class "Redis" not found` -> `apt-get install php8.3-redis` + restart php8.3-fpm (sesi/queue redis).

### 2026-08-08 - SPESIFIKASI-FINAL + Fase 1-6A tuntas (branch feat/admin-ui-redesign)

- SoT = `SPESIFIKASI-FINAL.md` (resolusi 23 keputusan bisnis: PriceService otomatis, kampanye promotions, status produk active|archived tanpa draft, nomor order `RA-{Ymd}-{seq}`, pagination 14, retur `return_completed`).
- Fase 1-6A selesai: migrations promotions/promotion_items/sub_models/order_number_sequences/admin_notifications, wizard produk, CRUD Promo Toko & Flash Sale (FS > Promo, max 1 aktif), performa toko, notifikasi admin.
- Snapshot WIP di-commit `d3efb1c` (797 file, CRLF warnings non-fatal).

### 2026-08-08/09 - WhatsApp (Fase 7) di-pause, diambil alih agent lain

- Prod IP 209.23.10.62 diblokir WhatsApp (`405`) di semua engine (GOWS/noweb, Baileys rc.9, 6.7.5 fork-master). Dev 49.51.136.145 jalan (GOWS -> SCAN_QR_CODE). Container BAILEYS prod di-down; sesi dev STOPPED; `.env` masih `WHATSAPP_PROVIDER=baileys`.
- HMAC webhook benar: header `X-Webhook-Hmac`, default sha512; POST 200 tervalidasi prod & dev->prod hook.

## How to write

```text
### YYYY-MM-DD — judul singkat
- Apa yang berubah (1 baris)
- Keputusan SoT / branch (jika ada)
- Cara undo (jika experimental)
```

### 2026-08-07 — Hero banner card

- Hero promo jadi kartu kompak rounded (referensi Zalora): container padding + rounded-2xl beige, grid [1fr_1.5fr_1fr] — gambar produk kiri, teks tengah, gambar kanan (mirror). Tinggi tetap 150/190/210px; `PROMO_CARD_VARIANTS` dihapus.
- Branch `feat/admin-ui-redesign` (belum commit).

### 2026-08-07 — Font scale & grid tablet

- Mikro-teks publik dinormalkan: konten -> min 12px, badge -> 11px; `FitTwoLineTitle` min 10->11px; clamp hero Home dinaikkan. Audit ulang: 0 teks <11px di 12 halaman @360px.
- Grid produk 768px 4->3 kolom (`md:grid-cols-3`), kartu 170->214px.
- Branch `feat/admin-ui-redesign` (belum commit).

### 2026-08-07 — Home density compression

- Home mobile dikompres: `section-space` 28->20px mobile, Cara Pesan kompak, KamiBantu+ClosingCta digabung jadi satu band gelap dengan 2 CTA (Pilih model produk / Konsultasi ukuran).
- Hasil: Home 4.9 -> 4.0 layar scroll @360x800; nav, bottom nav, 2 section testimoni dipertahankan atas permintaan owner.
- Branch `feat/admin-ui-redesign` (belum commit).

---

## Log

### 2026-08-07 — Mobile UI polish (touch target & layout)

- Audit mobile 13 halaman @360px: 0 overflow, 0 teks terpotong, 0 axe violation.
- 24 titik fix touch target: back button 17 halaman, breadcrumb, header logo+search,
  chip varian, stepper jumlah, sort/filter, tab Reviews, link lihat-semua, dots hero,
  CTA cara-pemesanan stack mobile, judul section wrap.
- Evidence: `storage/app/audit-evidence/2026-08-07/mobile/` (13 PNG + report.json);
  script audit di `scripts/qa-mobile-audit.mjs`.

### 2026-08-07 — Storefront P1 audit browser & alur utama selesai

- E2E 40 PASS / 3 SKIP / 1 flaky (retry PASS, cold-load VPS); verifikasi checkout baru:
  pending state, duplicate-click guard, persistence address_line2/notes ke e2e.sqlite
  (node:sqlite), axe di Checkout & PDP.
- PHPUnit 190 PASS / 3053 assertions; ShippingEstimateFallbackTest (J&T off/API gagal →
  rumus lokal) + persist address_line2/notes ke order di CheckoutFlowTest.
- QA screenshot admin (qa-final 12 + qa-full 39) PASS; evidence di
  `storage/app/audit-evidence/2026-08-07/` + `playwright-report/`.
- Akun dev baru: `qa.admin@example.com` (khusus script screenshot QA; kredensial di
  `scripts/qa-*.mjs`).
- Sisa P1: review 42 warning lint React. P2: branded 404, UI Import/Media/Payments,
  resend template WA.

### 2026-08-06 — Agent architect and production orchestrator contract

- Kontrak tambahan `docs/AGENT-ARCHITECT-ORCHESTRATOR.md` menjadi panduan arsitektur, GAP audit, task 1–3 hari, ADR, CI/CD, dan release gate.
- `AGENTS.md` tetap menjadi SoT keselamatan dan format laporan; `FULL-STACK-PRODUCTION-CHECKLIST.md` tetap menjadi gate produksi.

### 2026-07-28 — DATABASE SAFETY (no wipe without explicit user order)

- Hard rule di `AGENTS.md` + `docs/ORCHESTRATION.md`: dilarang `migrate:fresh` / `db:wipe` / truncate massal ke DB app tanpa instruksi eksplisit.
- Insiden 2026-07-27: wipe MySQL `ragil` saat debug; recovery katalog = re-import `storage/app/imports/catalog/`.

### 2026-07-26 — Shipping provider = J&T Cargo Open Platform

- Biteship ditolak (Express only). SoT shipping tetap Open Platform (`jnt:*`).
- `jnt:status` + `JntReadiness`; admin Settings menampilkan status Open Platform; sender Mandiraja diisi di `.env`.
- Live API masih menunggu `JNT_API_ACCOUNT` / `PRIVATE_KEY` / `CUSTOMER_*` + `JNT_ENABLED=true`.

### 2026-07-22 — Workflow audit P2 admin + docs

- Nav: Pembayaran, Pengiriman, Log Pesan WA, Performa Import.
- Orders filter payment/shipping/tanggal; Resource\* aksi Import/Media/Shipping.
- Handoff: Masalah & Solusi live (bukan planned); audit status diperbarui.

### 2026-07-23 — Admin search + theme

- Header admin: command search menu (`/` / “Cari menu admin”) + dark/light toggle (`ragil-admin-theme`); storefront tetap light-only.

### 2026-07-23 — Admin marketplace & social links

- Pengaturan Website → **Marketplace & Media Sosial** (`admin.storefront-platforms.*`): URL override di `cms_pages.storefront-platforms.content.links`; catalog di `config/sitemap.platforms`; share via `StorefrontPlatformSettings`.

### 2026-07-22 — Storefront home map + platforms/reviews

- Logo toko platform: `config/sitemap.platforms` → Tentang + footer; unit strip di beranda.
- `/reviews`: filter sumber marketplace vs website; home satu strip ulasan saja.
- Peta tunggal: `docs/STOREFRONT-HOME.md` (Figma = referensi).

### 2026-07-22 — P1/P2 workflow audit fixes

- Flash Sale publik: `/flash-sale` (+ `/promo`); **bukan** carousel di beranda. Popular → `#paling-banyak-dipesan`. Periode kampanye di `cms_pages.flash-sale.content.period`.
- Checkout wilayah: alert + retry; cart qty clamp ke stok; kontak: WA chat vs telepon terpisah.

### 2026-07-22 — P0 workflow audit fixes

- Hapus mock TEMP PROMO di katalog; seed 6 flash sale + 6 banner nyata (`ProductCardPromotionSeeder`).
- Konfirmasi order: metode bayar, instruksi rekening, CTA WhatsApp.
- Dashboard chip Pesanan: query `order_status`.

### 2026-07-22 — Workflow audit (customer + admin)

- Hasil simulasi journey: `docs/WORKFLOW-AUDIT.md` (+ canvas `workflow-audit`).
- P0: mock promo katalog, konfirmasi order tipis, deep-link Dashboard `status`≠`order_status`.

### 2026-07-22 — Equal-admin (hapus hierarki peran UI)

- Manajemen Admin: tidak ada picker Super Admin/Staf/Viewer; semua akun = `role=admin`; guard = minimal 1 aktif.
- UI dummy peran dihapus agar selaras Stage 2 + aturan UI fungsional.

### 2026-07-21 — Import & Media di bawah Produk

- Sidebar: hapus grup “Operasional Katalog”; Import + Media pindah ke grup **Produk** bersama Daftar Produk.
- Route/controller Import & Media tetap; hanya IA/nav + shortcut di daftar produk.

### 2026-07-17 — Unified UI Inertia parity

- Public + admin memakai satu sistem hitam–merah: token kanonis `app.css`, rail 1200/16–24, hierarki CTA merah, meta minimum 13px, dan shell Inertia aksesibel; kanvas Home tetap putih.
- Hero Home mengikuti Figma `10332:8645`: kartu promo gelap berputar dari `cms_banners` aktif, otomatis memakai gambar utama/nama produk dari link `/product/{parent_sku}`, lalu panel brand + trust putih.
- Seluruh route UI admin aktif (form/editor termasuk Product, Import, Variant, Attribute, User, CMS, Testimonial, Banner, WhatsApp) telah parity di React; Blade hanya shell/arsip/reference.
- Dashboard, resource table/detail, Order/Product workflow, storefront catalog–checkout–status, empty/trust/status state, dan dokumentasi desain disatukan tanpa perubahan schema/route/data contract.

### 2026-07-15 — Relume shell storefront penuh

- Home + Catalog + PDP + Cart + Checkout + Search + Reviews + Order + CMS: **Zalora rail** `max 1200` / gutter `16–24` (no carousel edge-bleed); shell putih + card shadow; hero cinematic + trust strip di bawah; CTA `#bf0000`.
- Footer: Temukan Kami ikon berwarna; hapus blok pembayaran (bukan di desain).
- Header/footer Inertia global tetap SoT shell.


- `resources/` materialisasi lokal; tidak ada junction ke website_2.0.
- Stack: Laravel 11 + Inertia React + shadcn/Radix; pages Public + Auth + Admin shell/lists.
- SoT delivery → Inertia; visual → `frontend/docs/UI-CONSISTENCY-CONTRACT.md` + Brand Kit + Design System.

### 2026-07-15 — R2 siap untuk VPS

- Docs go-live: `docs/media-storage-r2.md` (bucket, token, custom domain, checklist).
- Smoke: `php artisan media:disk-check` (local atau R2). VPS: `MEDIA_DISK=s3` + env AWS_*.

### 2026-07-15 — Scale-ready media & catalog

- Disk `media`: local (dev) atau R2/S3 (`MEDIA_DISK=s3`); lihat `docs/media-storage-r2.md`.
- `product_media.derivatives` JSON (WebP thumb/card/pdp) dari `DownloadProductMedia` + `media:backfill-derivatives`.
- Katalog/search paginate 24; storefront pakai `urlFor()`; no Shopee hotlink bila `MEDIA_ALLOW_SOURCE_FALLBACK=false`.

### 2026-07-15 — Phase 0 SoT switch (Figma IA + Home style)

- IA/menu/fitur SoT → `docs/PRODUCT-HANDOFF.md`, `docs/sitemap/*`, dan route/config aktif.
- Style SoT → `frontend/docs/UI-CONSISTENCY-CONTRACT.md`, Brand Kit, Design System; UI runtime = `resources/js`.
- Legacy Figma/Blade visual references dipindah ke arsip; tidak menjadi sumber implementasi.
- Planned (hidden nav): Masalah & Solusi, Retur, detail galeri hasil pemasangan.

### 2026-07-15 — Orchestration + skill tracks

- Rewrite `docs/ORCHESTRATION.md`: LOOPKIT-adapted (kontrak → SoT → tracks A–F → verify → report).
- Inventaris skill domain `skills/` + marketplace `.agents/skills/` + Cursor.
- Dipasang ke project: `design-taste-frontend` (overhaul saja), `laravel-testing` lokal (PHPUnit 11).
- Branch `overhaul-home`: Hero Home experimental; undo `git checkout master`.

### 2026-07-15 — Git baseline

- Repo di-init; commit baseline `0532f84` sebelum overhaul Hero.

### 2026-08-06 — UI/docs consistency audit

- Kontrak visual aktif ditetapkan di `frontend/docs/UI-CONSISTENCY-CONTRACT.md`; container desktop dinormalkan dari padding 15rem ke 3rem.
- Kontrak role/status ditetapkan di `docs/contracts/ROLE-AND-STATUS-CONTRACT.md`: role runtime `admin`, status payment `pending`, shipping `pending_pickup`.
- Audit backend lama dipisahkan dari audit runtime saat ini; lint React dan E2E menjadi gate wajib empat viewport.

### 2026-08-06 — Sinkronisasi dokumentasi runtime

- Schema/API dan logic docs disinkronkan dengan migration serta route aktif; dokumen API duplikat lama ditandai historical/non-canonical.
- Status terkini galeri Hasil Pemasangan dicatat: detail `/hasil-pemasangan/{parent_sku}` sudah implemented; retur publik tetap planned.

### 2026-08-06 — E2E storefront checkout dan browser matrix

- Playwright terisolasi SQLite lulus 33 test dengan 3 skip pada matrix desktop, 768 px, 1024 px, dan compact; alur checkout guest sampai order status tervalidasi.
- Kontras badge diskon, status danger admin, dan link Flash Sale diperbaiki; `npm run build` lulus. Kontrak schema, route, dan API tidak berubah.

### 2026-08-07 — Shared media library, video, dan bulk attach

- `media_assets` menjadi pemilik satu physical asset immutable; `product_media`
  menjadi attachment product/variant. Resolver dedupe berdasarkan normalized URL
  lalu checksum SHA-256, dengan object key `media-assets/{sha256}/...`.
- Admin Media dan `Admin/Products/Media` memiliki selector library dengan search,
  filter jenis/status, usage count, preview video, dan aksi `Pasang tanpa upload
  ulang`. Global Media menyediakan bulk attach satu asset ke maksimal 100 produk
  secara idempotent melalui `admin.media.attach`.
- Video upload/source URL tervalidasi MIME/ukuran, disimpan satu object MP4/WebM/MOV
  tanpa transcode; image tetap WebP thumb/card/pdp. `media:backfill-assets`
  menghubungkan legacy rows secara aman tanpa menghapus row/object.
- Kontrak schema/API/arsitektur/stage-9b/R2 diperbarui; Nginx media proxy tidak
  lagi memakai host hardcoded dan hanya aktif bila `MEDIA_R2_HOST` tersedia.
- Evidence: focused media/admin/import tests lulus; full suite 199 tests,
  3092 assertions dengan satu regresi dashboard lama diperbaiki (attention
  pending-payment tetap muncul); `npm run build` lulus.

### 2026-08-07 — Media migration dan legacy backfill selesai

- Pada database lokal SQLite `ragil_aluminium`, migrasi `media_assets` dan
  `product_media.media_asset_id` dijalankan forward-only. Baseline sebelum
  migrasi: 50 products, 329 product_media.
- `media:backfill-assets --dry-run` lalu backfill menghubungkan 329 attachment ke
  169 asset unik tanpa menghapus row/file. Repair legacy memprioritaskan
  `stored_path`/derivatives agar semua 329 URL lama tetap valid; hasil akhir:
  169 ready, 0 pending/failed, 0 missing card URL.
- Queue lokal dipindah dari `sync` ke Redis; worker smoke `imports,media,default`
  berhasil dengan 0 queued/failed jobs. R2 belum diaktifkan karena environment
  belum menyediakan bucket/public URL yang dapat diverifikasi read-only.

### 2026-08-07 — R2 `ra-media` diaktifkan pada preview

- Preview systemd memakai secret eksternal `/root/.config/ragilaluminium/cloudflare.env`,
  bucket `ra-media`, endpoint account R2, dan public delivery `r2.dev`; source URL
  fallback dimatikan.
- Smoke PUT/GET via S3 API, GET melalui public URL, dan DELETE lulus; preview HTTP
  200. `media:disk-check` kini membaca konfigurasi disk efektif sehingga fallback
  `CLOUDFLARE_R2_*` tidak false-negative.

### 2026-08-07 — Kontrak env VPS production dan Cloudflare Tunnel

- Agent production wajib meminta packet env melalui kanal secret terproteksi;
  R2 bucket credential, Tunnel token, dan Cloudflare provisioning API token
  dipisahkan. Global Cloudflare API token tidak boleh masuk Laravel runtime.
- Cloudflare Tunnel diterima untuk preview/staging dengan origin loopback;
  production memerlukan connector, WAF, webhook, monitoring, dan recovery
  evidence sebelum dipilih sebagai ingress customer-facing.
- Detail ada di `docs/production-vps-env-contract.md` dan ADR-003.

### 2026-08-07 — Full-stack production readiness plan

- Target production dipetakan sebagai MySQL + Redis + R2 + Nginx/PHP-FPM +
  supervised queue + Cloudflare ingress + provider controls + observability.
- Readiness plan menegaskan kondisi saat ini masih `BLOCKED` sampai backup/restore,
  worker, monitoring, security, provider, dan external smoke evidence lengkap.
- Human deployment runbook disediakan; AI bersifat opsional dan tidak menjadi
  dependency runtime.

### 2026-08-07 — Profil target initial production

- Owner menetapkan domain `ragilaluminium.com` dan VPS 4 vCPU / 4 GB RAM /
  60 GB disk.
- Profil ini cukup untuk first release bertrafik rendah sebagai single VPS,
  dengan R2 untuk media, backup eksternal, swap/resource limits, dan tanpa HA.
  Readiness plan mencatat trigger upgrade serta batas kapasitasnya.

### 2026-08-08 — Transaction integrity P0

- Checkout memakai UUID session + unique orders.checkout_idempotency_key; retry
  mengembalikan order yang sama tanpa decrement stok/payment kedua.
- Payment wajib positif dan order hanya paid setelah total completed settlement
  mencukupi; failed/refunded direkonsiliasi. Cancellation mengunci order dan
  mengembalikan stok varian tepat sekali.
- Import queue memakai unique dispatch + overlap lock; database/Redis
  retry_after=1860 di atas timeout 1.800 detik. J&T logs memakai allowlist
  dengan identifier ter-hash dan production boot menolak signing key kosong.
- ADR: docs/decisions/ADR-004-database-backed-transaction-integrity.md.

### 2026-08-11 - R2 aktif + PITR + session 5 hari + scheduler cron
- R2 media AKTIF di VPS 209.23.10.62: MEDIA_DISK=s3, bucket `ra-media` (public pub-1fc7....r2.dev), semua 234 product_media + 702 object tampil via R2 (200). Nginx /media-cdn proxy fixed (`proxy_ssl_server_name on`).
- Custom domain `media.333labs.tech` + CORS + DNS: TERTUNDA — butuh token CF permission Edit (token saat ini read-only). AWS_URL masih r2.dev.
- Session cart 5 hari: SESSION_LIFETIME=7200 + SESSION_DRIVER=database (tabel sessions) — tahan Redis restart.
- Cron Laravel terpasang: `* * * * * schedule:run` → queue:monitor + queue:prune-failed aktif.
- PITR: binlog sudah ON (ROW); script baru `/root/scripts_backup_mysql_binlog.sh` + `/root/scripts_r2_upload_binlog.py` arsip binlog ke ra-backup/binlogs/ tiap jam; RELOAD privilege ditambahkan ke user ragil.
- .env backup: .env.bak-r2-20260811-094452

### 2026-08-11 - Custom domain media.333labs.tech LIVE + backup hardening
- AWS_URL=https://media.333labs.tech (custom domain R2, SSL+DNS aktif, curl 200); nginx /media-cdn proxy ikut dialihkan; `.env.pre-customdomain-20260811` + nginx `ragil.pre-customdomain`.
- CORS R2: API Cloudflare menolak semua body (10040) — TIDAK dibutuhkan (upload server-side, baca via img). Bukan release gate.
- Backup DIHARDEN: enkripsi AES-256-CBC (keyfile /root/.config/ragilaluminium/backup-key, root 600) untuk dump harian + binlog hourly; kredensial CF/R2-backup DIHAPUS dari .env app (hanya AWS_* ra-media) → app tak bisa hapus arsip; lifecycle R2 ra-backup 30 hari (mysql/ + binlogs/) dipasang (PUT 200); restore drill mingguan (Sen 04:30, DB ragil_restore_test, rowcount vs prod — PASS 50/612/234/1); alert file (`/root/backups/ALERT-*`). .env.pre-hardened-20260811.

### 2026-08-11 - Backup tanpa enkripsi (keputusan user)
- Enkripsi backup DIHAPUS atas permintaan user (keyfile `/root/.config/ragilaluminium/backup-key` dihapus; tidak diperlukan). Pipeline kembali plaintext: dump harian .sql.gz + binlog .log → R2 ra-backup (lifecycle 30 hari). Semua artefak `.enc` (lokal 0 + R2 8 objek) dibersihkan. Restore drill tetap PASS (14:42:16, 50/612/234/1). Script: scripts_backup_mysql.sh, scripts_r2_upload_backup.py, scripts_r2_upload_binlog.py, scripts_restore_backup.sh, scripts_weekly_restore_test.sh.

### 2026-08-11 - Review design_thinking.md -> F1-F4 (E-channel lengkap)
- F1: Upload R2 gagal kini = alert file `/root/backups/ALERT-r2-upload` (backup harian & binlog; flush-logs gagal juga ber-alert).
- F2: `scripts_r2_upload_backup.py` / `scripts_r2_upload_binlog.py` exit 1 saat upload final gagal; loop binlog menangkap status per file (GAGAL=1 → notify + exit 1). Exit code diverifikasi (uji negatif kredensial hilang → exit 1).
- F3: retry 3x dengan backoff (2s/4s) untuk error 5xx/network; 4xx (auth) tidak di-retry.
- F4: stale-check binlog: `binlog-last-run` ditulis tiap run; drill mingguan membunyikan alert jika arsip tidak berjalan >27 jam.
- Catatan 2026-08-11: alert Telegram pernah ditambahkan di luar docs dan TELAH DIHAPUS (user request) — alert = file `/root/backups/ALERT-*` + log saja.

### 2026-08-11 - Catatan sesi refactor dashboard (AGENT review design_thinking)
- Refactor dashboard (DashboardQueryService + controller thin + types TS) sempat diimplementasikan lalu DI-ROLLBACK penuh karena menyimpang dari kontrak `tests/Feature/AdminDashboardTest.php` (diubah agent lain 15:24, belum commit): quickActions 3 item inline, statusOrder 5 item (bukan 9), performa pakai `StorePerformanceService::build()` period today/yesterday/last_7/last_30/this_month (BUKAN 7d/30d/90d + forPeriod/trend), attention href pakai `older_than=24h/2d/7d`, topEngaged `ProductEngagementService::topProducts($period, 8)`.
- File asli DashboardController.php (23614 B, git clean) sudah memakai pola modern tsb; refactor saya menyalin payload versi lama karena output `sed` via ssh terlihat terkorupsi (duplikasi baris) — pelajaran: verifikasi isi file dengan dua sumber (scp + baca) sebelum deploy.
- Final: baseline asli dikembalikan, PHPUnit **277 tests / 4141 assertions OK** (termasuk AdminDashboardTest baru agent lain). File buatan refactor dihapus (DashboardQueryService.php, admin-dashboard.ts); Dashboard.tsx tetap versi asli. Refactor dashboard bisa diulang dengan test tsb sebagai kontrak wajib.
- 2026-08-11 quirk terverifikasi (SQLite test): `PerformanceMetric.metric_date` cast `date` → tersimpan `Y-m-d 00:00:00`; `StorePerformanceService::visitorsBetween()` (dan series visitors) memakai `whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])` → row cast tidak ter-match (visitors 0 di SQLite). Uji empiris :memory: : row Eloquent-cast (nilai 5) tak terhitung, hanya row raw `Y-m-d` (nilai 9) yang match (sum 9). Produksi MySQL aman (kolom date men-trim). Kontrak test sudah memakai `DB::table()->insert()` dengan plain date (StorePerformanceContractTest:166). Dicatat di AGENTS.md gotchas.

### 2026-08-14 - Admin workflow: akun tes + admin-preview tool + verifikasi dashboard
- **Akun tes admin baru (id=12):** `dev.agent@ragilaluminium.test` / password `OiDrA_7nbIXjgX2K`
  (role=admin, status=active). Dipakai untuk semua verifikasi UI admin. QA admin
  (`qa.admin@example.com`) TIDAK disentuh lagi (password-nya sudah dikembalikan ke hash
  asli dari backup `ragil_aluminium-20260813-031701.sql.gz` setelah terlanjur diubah saat
  debugging banner).
- **Tool baru:** `scripts/admin-preview.cjs` (repo VPS, jalankan lokal): login otomatis
  akun tes + render halaman admin + dump DOM/console errors + screenshot, Node >= 22
  tanpa dependensi (WebSocket global + CDP). Contoh:
  `node scripts/admin-preview.cjs --url=/admin --find="Kelola banner" --mode=dump`
  Opsi: `--mode=dump|shot|both`, `--out=x.png`, `--wait=ms`, `--eval=<expr>`, `--find=a,b`.
  Tahan MSYS path-mangling (Git Bash) dan salah-tab CDP.
- **Dashboard admin = `/admin`** (BUKAN `/admin/dashboard` — URL itu bukan route; sejak
  2026-08-14 dirender sebagai 404 ber-brand `Admin/Error` via catch-all `admin/{any}` +
  fallback publik (tanpa crash React), tapi tetap jangan dipakai untuk verifikasi dashboard).
- **Verifikasi live 2026-08-14:** `/admin` render OK, "Kelola banner" ADA di section
  "Promo & flash sale aktif" (link ke `/admin/banners`); `/admin/banners`,
  `/admin/products`, `/admin/promotions` semua render OK (0 console error). Sidebar admin
  juga punya menu "Promo Toko" dan "Bar Promo".
- **Kondisi environment:** working tree dipakai agent lain (public homepage edits +
  rebuild 05:46/06:19/06:3x — asset hashed berubah tiap build); `routes/web.php` diubah
  agent lain (tambah routes documents). Selalu `git status` + verifikasi live.

### 2026-08-14 - Standar gambar banner promo (rasio dinamis, tanpa crop)
- **Standar baru (FINAL, setelah iterasi):** rasio layout banner PATEN `1024/426`
  (±2.4:1) via `aspect-[1024/426]` di `HomeHero` — tinggi otomatis = lebar ÷ rasio,
  proporsional di semua viewport. Gambar `object-cover`; admin menyiapkan canvas 2,4:1
  (2048×852 px) agar tidak ter-crop. (Pendekatan rasio-mengikuti-gambar via onImageLoad
  sempat dipakai lalu dihapus karena tinggi jadi tidak menentu: mobile 120px vs desktop 406px.)
- Fallback sebelum gambar termuat / saat semua slide placeholder = `1024/426` (±2.4:1),
  konsisten dengan canvas rekomendasi 2048×852 px di `frontend/docs/DESIGN-SYSTEM.md`.
- Hint form `/admin/banners` (Form.tsx) diperbarui: admin cukup upload 1 gambar (rasio
  ~2,4:1 disarankan); tidak perlu versi mobile terpisah, tinggi menyesuaikan otomatis.
- Verifikasi live: banner contoh (rasio 2.92:1) → mobile 350×120 / sm 600×206 / desktop
  1184×406, `imgFitsExactly=true` semua viewport, 0 error; fallback tanpa gambar = 2.40:1.
- Ukuran fixed px lama (134/132/148 → 176/200) dihapus karena menyebabkan crop
  (`object-cover` memotong gambar dengan rasio beda). Belum di-commit (WIP agent lain).


### 2026-08-14 — Direct upload produk media: browser → R2 (presigned) + WebP async

- **Masalah:** upload gambar produk selalu lewat VPS (temp → proses WebP → R2),
  lambat untuk file besar dan membebani server; request sinkron menunggu proses.
- **Solusi:** alur upload langsung `browser → R2` untuk media produk:
  - `MediaUploadController@presign` — validasi mime/ukuran → presigned PUT URL ke
    `pending/{uuid}.{ext}` (15 menit).
  - Browser PUT langsung ke R2 (progress via XHR) — bucket CORS dikonfigurasi
    (`AllowedOrigins: https://ra.333labs.tech`, `AllowedMethods: GET/PUT/HEAD`,
    `AllowedHeaders: Content-Type`) via S3 API.
  - `MediaUploadController@finalize` — verifikasi objek, buat `MediaAsset` +
    attach `ProductMedia`, dispatch `ProcessUploadedMediaAsset` (queue `media`).
  - `ProcessUploadedMediaAsset` — WebP derivatif thumb/card/pdp async, pindah
    objek `pending/` → `media-assets/{sha256}/`, status `ready`; dedup checksum
    tetap berlaku.
  - Frontend `Admin/Products/Media.tsx`: pilih file → presign → PUT + progress
    bar → finalize via Inertia. Alur lama (URL sumber / library attach) tetap ada.
- **Verifikasi:** typecheck/build PASS; e2e Playwright login admin → upload
  `b1.png` ke produk 51 → presign + PUT R2 + finalize + flash sukses + asset
  `ready` dengan pdp.webp; artefak uji dihapus (produk 51 kembali ke 1 media).
- **Catatan:** perubahan belum di-commit (working tree berisi WIP agent lain).


### 2026-08-14 — Banner promo ikut alur media produk: presigned upload + WebP derivatif

- **Tujuan:** banner promo diperlakukan sama seperti gambar produk — upload
  langsung browser → R2 (presigned PUT) + derivatif WebP async, sehingga landing
  page lebih cepat (banner pdp.webp maks 1400px vs PNG upload 1 MB+).
- **Perubahan:**
  - Migration: `cms_banners.media_asset_id` (FK nullable → media_assets).
  - `BannerController` (store/update): terima `object_key` hasil presign →
    buat `MediaAsset` (pending) + dispatch `ProcessUploadedMediaAsset` →
    `image_url` = URL object pending (fallback sementara) + `media_asset_id`;
    saat ganti gambar, asset lama di-archive. Alur legacy (file langsung / link
    produk) tetap ada. Form admin dapat prop `presignUrl`.
  - `ProcessUploadedMediaAsset`: setelah selesai, update `cms_banners.image_url`
    ke derivatif pdp WebP; saat dedup, arahkan banner ke asset canonical.
  - `HomepagePromotions::manualSlides()`: image di-resolve dari
    `banner->mediaAsset` (pdp/card/thumb) dulu — asset banner upload menang atas
    foto produk; fallback lama tetap untuk banner legacy (tanpa asset).
  - `Admin/Banners/Form.tsx`: presign → PUT R2 dengan progress bar → submit
    `object_key`; tombol menampilkan % upload.
- **Verifikasi (e2e Playwright + DB):** create banner via UI → presign + PUT R2 +
  redirect + flash; edit ganti gambar → asset baru ready + asset lama archived +
  `image_url` jadi `media-assets/{sha}/pdp.webp`; landing payload menyajikan
  derivatif WebP; b2.png 1,65 MB → pdp.webp 56 KB (~97% lebih ringan). Artefak
  uji dihapus. Worker queue di-restart untuk memuat kode job baru.
- **Catatan:** belum di-commit (working tree berisi WIP agent lain).


### 2026-08-14 — Auto-renaming media: pola {context}_{nomor}_{tanggal}

- **Tujuan:** semua file media yang di-upload diberi nama otomatis
  `{context}_{nomor}_{tanggal}.{ext}` (mis. `banner_1_20260814.png`,
  `logo_2_20260814.png`) — bukan nama asli acak / uuid — agar mudah dikenali di
  penyimpanan.
- **Helper baru `app/Support/MediaNamer.php`:**
  - `asset()` — alur presigned (MediaAsset): nomor monotonik dari label asset
    sejenis di DB (tidak reset saat pending dibersihkan).
  - `onDisk()` — file langsung di disk R2/local: nomor dari file sejenis di
    folder tujuan; `local()` — direktori lokal via glob().
- **Penerapan:**
  - `MediaUploadController` (presign): context opsional (`banner`/`media`) →
    object pending `pending/{context}_{n}_{date}.{ext}`; finalize set `label`
    dari nama key. Frontend Media.tsx & Form banner mengirim context.
  - `BannerController`: label asset banner; legacy upload → `banners/banner_{n}_{date}.*`.
  - `TestimonialController` → `testimonials/testimonial_{n}_{date}.*`;
    `ProblemsSolutionsSettings` → `masalah-solusi/masalah-solusi_{n}_{date}.*`.
  - `PageController` (branding): logo → `images/logo_{n}_{date}.png` dan
    favicon → `images/favicon_{n}_{date}.ico` (salinan versi; `site-logo.png` /
    `site-favicon.ico` tetap sebagai file aktif yang direferensikan app).
- **Verifikasi:** tinker — semua varian menghasilkan nama sesuai pola;
  e2e Playwright — PUT ke R2 bernama `banner_1_20260814.png`, asset label
  `banner_1_20260814`; build/typecheck/lint PASS. Artefak uji dihapus.
- **Catatan:** nomor unik per konteks; file checksum-based
  (`media-assets/{sha}`) tetap dipakai sebagai penyimpanan internal (dedup).


### 2026-08-14 — Renaming diperluas: hasil pemasangan (produk & gallery) + file import

- **Tujuan:** pola {context}_{nomor}_{tanggal} juga berlaku untuk media galeri
  hasil pemasangan dan lampiran file import; nama hasil pemasangan menyesuaikan
  otomatis berdasarkan produk/entitas yang ditambah.
- **Perubahan:**
  - `Admin/Products/Media.tsx`: saat checkbox "Hasil pemasangan" aktif, context
    upload = `hasil-pemasangan-{parent_sku}` (mis. `hasil-pemasangan-sp58155312043_1_20260814`),
    selain itu `media`.
  - Gallery item (`cms_gallery_items`): migration `media_asset_id` (FK nullable);
    `GalleryItemController` terima `object_key` → buat MediaAsset + dispatch job +
    arsip asset lama saat ganti gambar; `GalleryForm.tsx` dapat upload langsung
    (presign + PUT + progress) dengan context dari **label item** (fallback
    `hasil-pemasangan`); job `ProcessUploadedMediaAsset` kini update
    `cms_gallery_items.image_url` ke derivatif WebP (sukses & dedup).
  - `ImportJobController`: file lampiran import disimpan sebagai
    `catalog/import_{n}_{date}.{ext}` (disk imports) via MediaNamer::onDisk.
- **Verifikasi:** e2e Playwright — gallery item "Pemasangan Verifikasi" → PUT R2
  `pemasangan-verifikasi_1_20260814.png`, asset ready, `image_url` auto-jadi
  `media-assets/{sha}/pdp.webp` (worker di-restart agar memuat kode job baru);
  import rename tinker → `import_1_20260814.xlsx`; build/typecheck/lint PASS.
  Artefak uji dihapus.
- **Catatan:** belum di-commit (working tree berisi WIP agent lain).


### 2026-08-14 — Filter/pencarian label di Media Library (panel produk)

- **Tujuan:** asset bernama `hasil-pemasangan-*` (dan konteks lain) mudah
  ditemukan di panel "Media Library bersama" (`Admin/Products/Media`).
- **Perubahan (`Admin/Products/Media.tsx`):**
  - Chip preset konteks: Semua / Hasil pemasangan (`hasil-pemasangan`) /
    Banner (`banner`) / Media (`media`) — klik langsung filter (router.get q=…).
  - Pencarian label/URL live dengan debounce 350ms (tanpa harus klik Cari);
    dropdown jenis & status langsung terapkan saat berubah.
  - Refactor `runSearch()` (useCallback) dengan override q/kind/status agar
    chip/select memakai nilai baru tanpa menunggu state.
- **Verifikasi:** e2e Playwright — chip tampil, klik "Hasil pemasangan" →
  URL `q=hasil-pemasangan` dan asset berlabel hasil-pemasangan-* muncul di
  library; ketik di input → debounce menerapkan q; 0 error console.
  typecheck/eslint/build PASS. Asset uji dibersihkan.

## Milestone: Live status upload + notifikasi browser (2026-08-14)
- **Endpoint** `GET admin.media.status` (`ProductMediaController@status`, route `media.status`) —
  polling batch status ProductMedia (kind=product) / MediaAsset (kind=asset), validasi ids max 100,
  balikan status + error_reason + thumb_url (via `urlFor('thumb')`).
- **Media produk** (`Admin/Products/Media.tsx`) & **Media Library** (`Admin/Media/Library.tsx`):
  polling otomatis tiap 3 dtk hanya saat ada row/asset berstatus pending; badge
  `pending → ready` (atau `failed` + reason) berubah otomatis tanpa reload; thumb
  di-update dari respon poll; toast muncul saat ada yang selesai + notifikasi browser
  (judul "Media siap", body "N media siap digunakan").
- **Catatan e2e:** file PNG uji identik memicu dedup (asset baru langsung archived) —
  gunakan file unik per run; 404 chunk saat build menimpa file = transien (Cloudflare cache).
- **Verifikasi:** badge Menunggu→Ready auto tanpa reload (URL tetap), 3 poll sukses, notice
  muncul, 0 error console; `urlFor('thumb')` valid utk asset ready. Asset uji dibersihkan.

## Milestone: Suara notifikasi + badge counter media siap (2026-08-14)
- **`resources/js/lib/media-live.ts`** (baru, shared): `playReadySound()` — chime dua nada
  A5→D6 via Web Audio API (tanpa file aset, try/catch utk autoplay block); counter
  "media siap" di sessionStorage (`ragil.media.readyCount`) + event bus
  `ragil:media-ready` (CustomEvent) + `getReadyCount/addReadyCount/clearReadyCount/onReadyCountChange`.
- **Media.tsx & Library.tsx** — saat polling deteksi newlyReady: selain toast + Notification,
  kini memanggil `playReadySound()` + `addReadyCount(n)`.
- **AdminNavigation.tsx** — badge counter bulat (primary, "99+" cap) di item sidebar
  "Media Library" (`admin.media.library`); subscribe event bus; auto-clear (`clearReadyCount`)
  saat item diklik.
- **Verifikasi:** e2e Playwright — upload via UI library → sessionStorage count 0→1, badge "1"
  muncul di sidebar, klik Media Library → count 0 & badge hilang; AudioContext state "running"
  tanpa error; 0 error console di load library. Asset uji dibersihkan.

## Milestone: Halaman riwayat pemrosesan media (2026-08-14)
- **Tabel `media_processing_logs`** (migration 2026_08_14_000500) — log transisi status
  polimorfik (loggable = MediaAsset | ProductMedia), kolom entity_label (denormalisasi),
  event (queued|processing|success|failed|dedup|downloaded), message, created_at;
  index (loggable_type,loggable_id), event, created_at.
- **Model `MediaProcessingLog`** + `MediaProcessingLog::record($loggable, $event, $message)`.
- **Tracer di job**: ProcessUploadedMediaAsset (processing/success/failed/dedup),
  DownloadMediaAsset & DownloadProductMedia (processing/success/failed/dedup),
  MediaUploadController@finalize (queued).
- **Halaman `Admin/Media/History`** — `/admin/media/history` (route `admin.media.history`,
  menu sitemap "Riwayat Media" di grup Produk): tabel log (waktu, label media + tipe/id,
  badge status, pesan detail), chip filter status (Semua/Gagal/Siap/Diproses/Antre/Duplikat),
  pencarian label/pesan, filter rentang tanggal, pagination 30/halaman.
- **Verifikasi:** e2e — upload nyata via UI library → log queued→processing→success tercatat;
  seed failed+dedup tampil di tabel; klik chip Gagal → URL `?event=failed` dan hanya log
  failed yang tampil; menu sidebar tampil; 0 error console (404 = transien saat build).
  Data uji dibersihkan. Worker queue di-restart untuk memuat job versi baru.

## Milestone: Tombol retry di Riwayat Media (2026-08-14)
- **`ProductMediaController@retryLog(MediaProcessingLog $log)`** + route `POST media/logs/{log}/retry`
  (`admin.media.logs.retry`) — retry dari baris log gagal: set status pending + error_reason null,
  catat log `queued` baru, lalu dispatch job sesuai entitas:
  MediaAsset dengan source_url → `DownloadMediaAsset`; MediaAsset dengan object_key →
  `ProcessUploadedMediaAsset`; ProductMedia → `DownloadMediaAsset` (jika punya media_asset_id) /
  `DownloadProductMedia`.
- **History.tsx** — kolom Aksi (desktop) + tombol di card (mobile): tombol **"Coba lagi"** (ikon refresh)
  hanya muncul di baris `event=failed` (prop `retry_url` diisi backend); klik → router.post preserveScroll.
- **Verifikasi:** e2e — baris failed `retry_test_asset` tampil, tombol Coba lagi ada (2 baris failed),
  klik → flash "Pemrosesan media dijadwalkan ulang", URL tetap; DB: log baru `queued` + `processing`
  tercatat (job nyata jalan; asset kembali failed karena object_key uji palsu — loop lengkap terverifikasi).

## Milestone: Notifikasi admin otomatis saat media gagal (2026-08-14)
- **Migration** `2026_08_14_000600` — kolom `related_type`/`related_id` di `admin_notifications`
  (index gabungan) agar notifikasi bisa dikaitkan ke entitas media.
- **`App\Support\MediaFailureNotifier::notify($loggable, $reason)`** — buat notifikasi tipe
  `media_failed` (title "Media gagal diproses", body "label: alasan", href → riwayat media
  filter failed). **Dedupe**: jika sudah ada notifikasi media_failed BELUM dibaca utk entitas
  yang sama → update body lama, tidak menumpuk (retry tidak spam).
- **Hook di semua titik gagal**: ProcessUploadedMediaAsset (4 titik: file tak ditemukan, ukuran,
  mime, catch), DownloadMediaAsset (failAsset), DownloadProductMedia (fail()).
- **notification-bell.tsx** — ikon `warning` (merah/destructive) untuk `media_failed`;
  `media_cleanup` diwarnai amber.
- **Verifikasi:** e2e — dispatch job gagal nyata (object_key palsu) → asset `failed` +
  notifikasi `media_failed` tercipta otomatis (body berisi label + alasan, href riwayat);
  dispatch ulang → count tetap 1 (dedupe); badge unread "1" di bell + dropdown menampilkan
  notifikasi lengkap; 0 error console. Data uji dibersihkan.

## Milestone: Live polling di halaman Riwayat Media (2026-08-14)
- **History.tsx** — polling tiap 3 dtk saat ada baris `queued`/`processing`: endpoint
  `admin.media.status` dipanggil per kind (asset/product) dengan **id dedupe** (baris queued
  + processing utk entitas sama → 1 id; tanpa dedupe → 422 `distinct`).
  Update via **overrides per log id** (state `liveOverrides`, hanya di-set dari callback async —
  bebas warning `set-state-in-effect`): hanya baris non-terminal **terbaru per entitas** yang
  diubah (ready/downloaded → `success` "Derivatif WebP siap…", failed → `failed` + error_reason
  + retry_url); baris historis ("Antre" lama) tetap.
- **UI**: indikator **"Live"** (dot hijau ping + label) di kanan filter bar saat ada baris
  non-terminal; polling berhenti otomatis saat semua terminal.
- **Verifikasi:** e2e — buka riwayat asset dengan baris Diproses → **berubah jadi Siap tanpa
  reload** (URL tetap), indikator Live tampil, 0 error 422; build/tsc/eslint PASS.

## Milestone: Hapus & auto-prune log riwayat media (2026-08-14)
- **`ProductMediaController@destroyLog`** + route `DELETE media/logs/{log}`
  (`admin.media.logs.destroy`) — hapus permanen satu baris log; `delete_url` di-prop per baris.
- **`ProductMediaController@pruneLogs`** + route `POST media/logs/prune`
  (`admin.media.logs.prune`) — hapus log lebih tua dari N hari (validasi 1–365,
  default `config('media.log_retention_days', 30)`); flash jumlah terhapus.
- **`App\Console\Commands\PruneMediaLogs`** (`media:prune-logs {--days=30} {--dry-run}`) —
  auto-prune harian 03:30 (routes/console.php, tanpa overlapping).
- **config/media.php** — `log_retention_days` (env MEDIA_LOG_RETENTION_DAYS, default 30).
- **History.tsx** — tombol hapus per baris (ikon trash, ConfirmAction) di kolom Aksi
  desktop & card mobile; tombol **"Bersihkan log lama (N)"** di toolbar (hanya muncul
  jika ada log > retention) → ConfirmAction → prune.
- **Verifikasi:** e2e — tombol Bersihkan log lama (1) tampil, hapus per baris (dialog
  konfirmasi + flash sukses), prune via UI (flash) → DB 0 log; dry-run command benar
  (1 log 40 hari terdeteksi); schedule 03:30 tampil di schedule:list; build/tsc/eslint PASS.

### 2026-08-15 — Banner Promo: menu sidebar sendiri + label jelas
- Sidebar admin: item baru "Banner Promo" (grup Harga & Promo) -> admin.banners.index;
  'admin.banners.*' dipisah dari active Promo Toko.
- Label banner diubah: "Tambah Promo" -> "Tambah Banner", judul "Banner Promo"
  (Index.tsx/Form.tsx/BannerController@index).
- Peta akses banner: sidebar Banner Promo | dashboard "Kelola banner" (bawah) |
  Beranda Pembeli -> Banner Utama -> Edit konten (HomepageLayoutSettings:100).
- GOTCHA: live build bisa tertinggal dari working tree (Beranda/Index.tsx diedit
  setelah build) — verifikasi UI selalu via admin-preview/curl, bukan grep source.

### 2026-08-15 — Menu Pesanan (deep-dive #2): tombol salin produk + riwayat lengkap
- G1 (spek: ukuran & nama produk wajib dicopy-paste): tombol salin (ikon copy)
  per item produk di Daftar Pesanan (Index.tsx, helper copyItemText) dan
  Detail Pesanan (Show.tsx, pakai copyText existing).
- G2 (spek: default sebagian riwayat + tombol expand): tombol
  "Tampilkan Riwayat Lengkap" / "Sembunyikan riwayat" di Detail untuk
  Log perubahan status (events) dan Riwayat WA otomatis (whatsapp_messages)
  — expand di halaman yang sama via state showAllEvents/showAllWa.
- Verifikasi: typecheck/lint/build PASS; live via CDP — button salin ada di
  list (label "Salin ukuran & nama: <name>"), order RA-260810-0001 punya tombol
  expand, klik → li bertambah & jadi "Sembunyikan riwayat"; 0 console error.
- Commit 9153e51 (branch feat/admin-ui-redesign), pre-push hook build sukses.

### 2026-08-15 — Context ledger: Admin IA + search behavior (diskusi owner)

- Admin IA: Dashboard tanpa hamburger; Performa Toko menjadi menu utama; Log Aktivitas masuk Akun & Sistem; Import Performance berada di Produk → Import; filter payment/shipping/tanggal/umur tetap tersedia sebagai Filter Lanjutan.
- Search publik/admin harus pintar tanpa AI: normalisasi query, intent berbasis aturan, sinonim manual, ranking explainable, hasil exact dipisah dari rekomendasi, dan saran “Mungkin yang Anda maksud” tanpa mengganti query diam-diam.
- Dimensi memakai standar tinggi × panjang; konsep rekomendasi ukuran terbalik belum disetujui. Arah yang dibahas: rekomendasi berdasarkan kemiripan/range (mis. 210×60), dengan tier dan ambang yang masih terbuka. Query umum seperti “model minimalis” dan atribut seperti “abu doff” harus diperlakukan sebagai intent ambigu/komposit, bukan dipaksa menjadi model exact.

### 2026-08-15 — Context ledger: Search clarification (diskusi owner)

- Variant warna yang valid hanya mengikuti katalog: putih, hitam, coklat, dan serat kayu; search tidak boleh membuat atribut seperti “abu doff” seolah-olah variant tersedia.
- Typo dengan koreksi deterministik ber-confidence tinggi dinormalisasi langsung ke istilah katalog (contoh “slidding” → “sliding”); tidak perlu menampilkan kotak saran, tetapi query raw tetap dicatat untuk analitik.
- Query ambigu seperti “minimalis” atau “modern” tidak dipaksa menjadi nama model; sistem menyarankan istilah/query yang benar-benar ada di katalog aktif, berdasarkan model produk, model bukaan, ukuran, kategori, warna, atau atribut yang tersedia.

### 2026-08-15 — Context ledger: Share Produk (konteks dibuka)

- VPS belum memiliki fitur Share Produk khusus; yang tersedia baru helper umum URL WhatsApp. Konteks share produk dibuka sebagai fitur vital, belum ada keputusan implementasi yang dikunci.
- Kandidat rancangan awal: ikon di PDP, native share bila tersedia, WhatsApp dan salin link sebagai fallback, URL variant-aware, serta metadata Open Graph untuk preview sosial. Detail perilaku masih menunggu diskusi owner.

### 2026-08-15 — Context ledger: Share Produk WhatsApp scheme (diskusi owner)

- Pesan pada Share Produk adalah skema share-to-contact: user membagikan link ke pasangan/keluarga/customer melalui native share atau WhatsApp tanpa nomor tujuan tetap.
- Ini berbeda dari CTA “Konsultasi via WhatsApp” yang membuka chat ke nomor bisnis Ragil Aluminium, dan berbeda dari notifikasi WhatsApp otomatis untuk order.

### 2026-08-15 — Context ledger: Share Produk closed

- Share Produk ditutup sebagai baseline: share-to-contact melalui native share/WhatsApp/copy link; link dapat mempertahankan variant aktif; metadata preview sosial; terpisah dari Konsultasi WhatsApp dan notifikasi order.
- Belum ada kode aplikasi yang diubah; implementasi dapat dikerjakan sebagai pekerjaan terpisah setelah prioritas workflow berikutnya dipilih.

### 2026-08-15 — Context ledger: Checkout & Alamat (konteks dibuka)

- Markdown: guest checkout; nama/HP/provinsi/kabupaten/kecamatan/desa/detail alamat; kode pos otomatis; ongkir otomatis; transfer/COD; status awal Menunggu Konfirmasi; WhatsApp konfirmasi; edit order sebelum proses; log perubahan; catatan internal.
- VPS saat ini: cart selected-lines dan guest checkout sudah berjalan; estimasi ongkir menampilkan gross/subsidi/net; payment COD/transfer; idempotency dan session order sudah ada; postal_code masih wajib diinput manual.
- Open decisions: sumber data wilayah→kode pos dan fallback; apakah field email di checkout dihapus atau tetap opsional; perilaku saat estimasi ongkir gagal; kapan instruksi transfer ditampilkan.

### 2026-08-15 — Context ledger: Checkout corrections (diskusi owner)

- Cart: bila mode seleksi tidak aktif atau checkout tidak memakai checkbox, semua item cart masuk checkout; bila mode seleksi aktif, hanya item terpilih yang masuk.
- Catatan bukan bagian alamat/order global; catatan diisi per item produk, pada tahap checkout sebelum alamat.
- Email dihapus sepenuhnya dari checkout dan tidak dipakai sebagai fallback status order.
- ETA yang tampil = estimasi sistem + 1 hari. Status COD tidak tersedia dijelaskan saat user memilih metode COD, bukan sebagai gangguan awal.
- Wilayah dropdown saat ini berasal dari CSV lokal storage/app/wilayah/*.csv; map picker memakai Nominatim/OpenStreetMap dan dapat mengisi postcode. CSV lokal belum menyimpan kode pos, sehingga perlu sumber/mapping postcode; titik peta menjadi fallback tanpa input postal manual.




### 2026-08-15 - Checkout/Cart implementation batch (agent checkout_shipping)

- Cart checkout semantics are enforced end-to-end: all cart lines when selection is off, selected lines only when selection is active, empty active selection rejected, submitted IDs intersected with the live session cart, and selected state cleared after order creation.
- Voucher preview and place-order empty-cart guards use the same effective line set.
- Checkout has a dedicated per-item product-note section before the address form. Notes persist through POST /cart/update and remain mapped to order_items.note; the global checkout/address note field was removed.
- Public checkout no longer collects email. Public order lookup, cancellation, and API fallback now require order number plus phone only; legacy nullable email columns remain for historical data and admin compatibility.
- Canonical docs updated: docs/logic/stage-10-public-store-ui-and-checkout-contract.md and docs/PRODUCT-HANDOFF.md.
- No database migration or new route was added.

### 2026-08-16 — Fase 3: Dynamic taxonomy database (selesai)

- `categories` = sumber kategori kanonik end-to-end: nav mega menu, katalog (`/products/{slug}`),
  pencarian, sitemap, breadcrumb, dan validasi form admin produk/model memakai DB, bukan daftar
  tetap WINDOW/DOOR/BOUVEN. Admin CategoryController (`admin.categories.*`) sudah flush cache
  (`CategoryUrl::forgetCache` + `CatalogTaxonomy::forgetCache`) setelah create/update/delete.
- Validasi dinamis: `ProductController` & `ModelProductController` pakai
  `Rule::in(CategoryUrl::productCategoryCodes())`; model pakai `Rule::in(CatalogLabels::modelCodes())`
  (MODEL_ORDER + `sub_models.product_model` aktif) sehingga model baru bisa ditambahkan.
- `ShopeeCatalogTaxonomy` tidak lagi fallback diam-diam ke WINDOW → sentinel `UNKNOWN`;
  `CatalogProductsImport` menandai kategori tak dikenal/tidak diisi sebagai baris gagal
  (status `failed` + error_reason) untuk ditinjau admin, tanpa menebak Jendela.
- Compatibility resolver: `products.product_category` (VARCHAR) dipertahankan; legacy
  WINDOW/DOOR/BOUVEN dipetakan via `CategoryUrl::codeToProductCode`/`categoryToSlug`; kategori
  baru memakai kodenya sendiri. Kolom tersebut TIDAK dihapus.
- Migration: `2026_08_16_000001_normalize_category_slugs_to_indonesian.php` diperbaiki (grouped
  where/orWhere, preflight konflik unique code/slug, snapshot `category_normalize_snapshot` utk
  rollback penuh); tambah `2026_08_16_000002_relax_product_model_enum_to_string.php` (MySQL, ENUM->VARCHAR)
  [PENDING — tidak dieksekusi, hanya `migrate --pretend`].
- Test baru `tests/Feature/CatalogDynamicCategoryTest.php`; full suite 352 passed (4611 assertions).

### 2026-08-17 — Fase 10: Performa Toko (StorePerformance) locked

- Dashboard admin \"omzet/performa\" dan halaman Performa Toko / admin.analytics.store-performance memakai kontrak formula SAMA dari StorePerformanceService::build() (rule R1).
- Revenue scope (paidRevenueStatusSql) sekarang mengakui COD hanya saat order mencapai status completed (rule R4): di processing/shipped/delivered COD belum dihitung omzet/unit/model; transfer tetap dihitung mulai processing. Konsisten di metricsFor, series, topProducts, customers (total_spent CASE), paymentMix.
- Jumlah model (models_sold) dihitung via SQL DISTINCT COALESCE/NULLIF/TRIM pada order_items snapshot (rule R8) — kompatibel MySQL & SQLite, bukan dedupe collection PHP.
- Return/refund memakai ledger order_return_cases/items dan TIDAK menghapus order/order_items mentah (rule R9); refund_amount dari return case completed dikurangkan dari gross menjadi net (rule R10). products != units (rules R5). Histori & model dari order_items snapshot, perubahan katalog tidak mengubah performa lama (rules R6/R7).
- Test baru tests/Feature/StorePerformanceF10RulesTest.php (6 kasus). Full suite 401 passed (4951+ assertions).

### 2026-08-17 - Fase 13: Admin IA, notifikasi, log, keamanan dikunci
- Import Performance bukan nav terpisah; dibuka dari halaman Import (toolbar Performa Import).
- Notifikasi admin: import_failed (ImportFailureNotifier) + return_created (retur baru) ditambah.
- Kunci 9 aturan dgn test (Fase13*): dashboard summary+followup, Performa Toko terpisah, Log
  Aktivitas di Akun & Sistem, Import Performance di Import, rate-limit login (5x/60s), rotasi
  session tidak putus WhatsApp (daemon luar), admin hak setara, audit log append-only & traceable.

## 2026-08-18: Integration Feature Gates (Credential-Driven)

### Problem
- JNT webhook retried 22x/day when signing key not configured (J&T retries on non-2xx ACK)
- ShippingService logged 94 warnings/day when JNT tariff unavailable
- No clear mechanism to know when integrations are ready vs not

### Changes
- config/integrations.php: centralized feature gate; each integration checks ALL required credentials automatically.
- ShippingController@handleJnt: when signing key blank, returns ACK success (code 1) instead of error.
- ShippingService: tariff unavailable/failed logs downgraded from warning to debug.
- createShipment error message now lists all required .env keys.

### Principle
Integration = credential-driven. If credentials present -> auto-active. If missing -> silent fallback, no errors, no retries.

### Verification
- php -l (4 files) PASS, tsc --noEmit PASS, npm run build PASS (11.8s)

- [2026-08-18 14:00] CREDENTIAL-DRIVEN FEATURE GATE (JNT + WhatsApp):
  - NEW config/integrations.php: centralized feature gate dengan ready() callback.
  - PATCHED ShippingController@webhook: return ack(true) + debug log jika credential kosong (stop J&T retry forever)
  - PATCHED ShippingService: tariff unavailable -> debug level (bukan warning, stop log spam)
  - Backend DashboardController sudah pass integrationReadiness + jntReadiness
  - Frontend Dashboard.tsx belum render panel integrasi (WIP)
  - Alur: credential diisi -> integrasi aktif otomatis, kosong -> diam + ACK ke J&T

### 2026-09-16 — Detail kampanye promo: hapus rentang "Semua waktu" (feedback owner)
- Owner: tampilan "total 5 sepanjang waktu" di detail kampanye (contoh /admin/promotions/26,
  Flash Sale Agustus) tidak logis karena halaman detail kampanye seharusnya khusus menunjukkan
  penjualan selama kampanye aktif.
- Perubahan pada fitur baru yang sedang dikerjakan agent lain (working tree, belum di-commit):
  `PromotionSalesService` tidak lagi punya RANGE_ALL/param range; penjualan selalu periode
  kampanye. `PromotionController@show` tidak lagi baca query `range` (signature: show(Promotion)),
  `rangeOptions` dihapus dari props. `PromotionDetail.tsx`: toggle Periode kampanye/Semua waktu,
  sub-label "total N sepanjang waktu", field all-time, dan import routeUrl dihapus.
  `PromotionDetailTest`: test rentang dihapus (5 test tersisa).
- Sort rows: tiebreaker revenue_all_time dihapus (ikut kontrak baru), sekarang qty desc, nama asc.
- Verifikasi: PromotionDetailTest 5 passed; tsc/eslint bersih utk file ini (134 problem lain
  pre-existing WIP agent lain); build PASS setelah media-panel.tsx agent lain beres sendiri
  (sempat gagal: duplicate `library` saat agent lain sedang mengedit); grep build bersih dari
  label "sepanjang waktu"; /admin/promotions/26 live 302 ke login (route hidup).
- Data promo 26 (Flash Sale Agustus, 9-20 Agu): 0 terjual di periode kampanye; 5 unit pid 51
  terjual 21-25 Agu (di luar kampanye) sehingga tampilan all-time memang menyesatkan.
- Perubahan ini masih working tree bersama WIP agent lain; jangan di-revert.

### 2026-09-16 — Detail kampanye: kolom Pesanan jadi tautan ke detail pesanan
- Owner feedback di /admin/promotions/29: nomor pesanan terkait harus bisa diklik ke detail pesanan.
- `PromotionSalesService::ordersByProduct()` baru: order_lines per product_id pada rentang
  kampanye yang sama dengan aggregate() (scope omzet REVENUE_STATUSES), kirim `orders_list`
  di setiap row (order_id, order_number, order_status, qty, line_total, sold_at).
- `PromotionDetail.tsx`: kolom Pesanan render daftar tautan `admin.orders.show` per nomor
  pesanan + qty unit; import routeUrl kembali dipakai. 0 pesanan tetap tampil "0".
- `PromotionDetailTest`: asersi orders_list di test pertama (5 passed, 85 assertions).
- Verifikasi: tsc/eslint bersih utk PromotionDetail.tsx; build PASS (23s); data live promo 29
  (Promo September, ended): 2 row terjual memuat ORD26090003 (processing, 1 unit masing-masing,
  total 1.998.000 & 5.175.000). Semua masih working tree bersama WIP agent lain.

### 2026-09-16 — Detail kampanye: undo tautan pesanan (feedback owner)
- Tautan nomor pesanan ke detail pesanan di kolom Pesanan (orders_list) DIBATALK oleh owner
  karena halaman jadi crowded. Revert penuh: PromotionSalesService tanpa ordersByProduct,
  PromotionDetail.tsx kembali angka polos di kolom Pesanan, PromotionDetailTest kembali
  77 assertions. Kontrak final detail kampanye: periode kampanye saja, tanpa all-time,
  kolom Pesanan angka polos. Test 5 passed; tsc/eslint bersih; build PASS.

### 2026-09-16 — Popularity Boosts: perbaikan hasil audit e2e (P1/P2) + insiden write test dipulihkan
- Audit e2e (e2e.md + e2e2.md + gape2e.md) atas /admin/kelola/produk/popularity-boosts menemukan:
  P1 write-on-GET (index memanggil evaluateThreshold -> bisa menulis notification + event log
  saat sekadar membuka halaman, plus race notifikasi ganda); P2 re-enable boost dgn produk
  archived gagal tanpa feedback UI; P2 hapus permanen produk yang terikat boost -> 500 (FK restrict
  tidak ter-guard); P3 definisi penjualan valid beda dgn Performa Toko (status retur) TIDAK diubah,
  menunggu keputusan owner.
- Perbaikan:
  - ProductPopularityService::evaluateThreshold -> klaim atomik (update whereNull
    threshold_notified_at) sebelum kirim notification; tidak ada notifikasi ganda saat race.
  - ProductPopularityBoostController@index -> TIDAK lagi memanggil evaluateThreshold (GET bebas
    efek samping). Evaluasi berjalan saat enable() dan via command baru
    `popularity:evaluate-thresholds` (App/Console/Commands/EvaluatePopularityThresholds.php),
    dijadwalkan daily 04:00 tanpa overlapping (routes/console.php).
  - ProductController@destroy -> guard rail 3: tolak hapus permanen produk yang terikat
    popularityBoostsAsSource/Target dengan pesan operasional (sebelumnya 500).
  - PopularityBoosts.tsx -> badge warning "produk sudah diarsipkan" pada row boost yang
    source/target archived; productOption kirim status.
  - ProductPopularityBoostController@enable -> ValidationException ditangkap jadi flash error
    (banner global FlashMessages di AdminLayout sudah ada) sehingga tombol "Aktifkan kembali"
    yang gagal validasi tetap memberi feedback.
  - Canonical docs/api-and-routes-ragil-aluminium.md: 4 route admin.products.popularity-boosts.*
    ditambahkan (sebelumnya hanya ada di docs/logic/*).
- Test: ProductPopularityBoostTest 10 passed (3 test baru: index bebas notifikasi, atomic
  threshold once, destroy guard). Full suite 793 passed + 1 fail pre-existing WIP agent lain
  (MasalahSolusiAdminTest, file milik working tree agent lain, bukan area ini).
- VERIFIKASI LIVE: tsc/eslint bersih utk file terkait; build PASS; command CLI berjalan
  ("Dicek 1 boost, notifikasi ambang terkirim: 0"); schedule 04:00 terdaftar.
- INSIDEN SAAT AUDIT (jujur dilaporkan): pengetes dialog live dgn klik koordinat tidak sengaja
  men-disable boost #1 (reason "da", 18:47 UTC) dan sempat mengosongkan seed produk 53. Sudah
  dipulihkan PERSIS ke kondisi awal (enabled, seed=2, thr=100, seed produk53=2 dari src 95,
  updated_at 2026-09-07); notifikasi disable buatan test dihapus; event_log disabled #535
  dibiarkan (append-only). Verifikasi ulang via UI reload: status Aktif, angka konsisten.
- P3 tersisa (belum dikerjakan): samakan definisi penjualan valid (butuh keputusan owner soal
  status retur); partial unique index anti-boost-ganda-race; pagination riwayat; qa script e2e
  untuk halaman ini.

### 2026-09-16 — Teruskan Popularitas: kontrak dasar = penjualan + ulasan/rating (keputusan owner)
- Owner keputusan: dasar Teruskan Popularitas DIBATASI ke penjualan valid + ulasan/rating.
  View/klik TIDAK masuk kontrak (sudah dipastikan tidak pernah masuk ranking; engagement hanya
  untuk laporan Performa Toko, pipeline klik frontend memang tidak aktif).
- Analisa "populer" (konteks): ranking katalog = popularity_seed + penjualan valid saja;
  "Sering Dilihat" beranda = flag manual homepage_popular; view (4.498) & klik (316) tercatat
  di performance_metrics tapi hanya untuk laporan; rating tidak memengaruhi ranking.
- Perubahan pada halaman boost (kontrak tidak berubah, hanya dieksplisitkan + metrik tampil):
  - Controller index: metrik ulasan sumber per boost (source_review_count, source_avg_rating,
    definisi sama dengan inheritedTestimonials: published+approved+source=website).
  - PopularityBoosts.tsx: metric grid jadi 6 (Seed sumber, Penjualan target, Skor efektif,
    Ulasan sumber, Rata-rata rating sumber, Ambang); copy form & description eksplisit
    "dasar = penjualan + ulasan; view/klik/riwayat order tidak dipindahkan".
- Spec tidak berubah (schema/route/enum tetap); docs/admin-menu-functions.md sudah menyebut
  waris ulasan; MEMORY ini mencatat keputusan owner.
- Verifikasi: ProductPopularityBoostTest 11 passed (test baru metrik ulasan: 2 review published
  rata 4.5, draft tidak dihitung); tsc/eslint bersih; build PASS.

### 2026-09-16 — Audit UI/UX e2e tingkat 2: Teruskan Popularitas + fix error bag global (P1 lintas form)
- Audit UI/UX flow live (sesi admin real): create valid, create sumber=target, duplicate same-pair,
  duplicate beda-sumber, disable (tanpa alasan -> ditolak; dengan alasan -> sukses), re-enable,
  flash sukses/error, mobile 390px, a11y form.
- P1 DITEMUKAN + DIPERBAIKI (lintas-domain): App\Http\Middleware\HandleInertiaRequests tidak
  mewarisi parent::share() -> error bag validasi TIDAK PERNAH dikirim ke frontend, sehingga pesan
  validasi server semua form admin (useForm) tidak pernah tampil di UI. Karena share() kustom sudah
  memanggil ...parent::share($request), cukup MENGHAPUS patch manual 'errors' saya (closure ganda
  salah bentuk) agar errors dari Inertia::always(resolveValidationErrors) ikut ter-share.
  Terverifikasi live: submit sumber=target kini menampilkan Field error + FormErrorSummary
  "Produk sumber dan target harus berbeda."
- Pesan validasi store dilokalkan ke Indonesia (required/exists/different/min/integer).
- P0 terjadi saat audit dan DIPULIHKAN: /login & sebagian rute 500 karena syntax error PHP di
  InstallationGalleryController.php (baris 76/155/288/291 memakai \App\Models\ InstallationGroup,
  backslash korup dari WIP agent lain; file berubah-ubah selama diperbaiki). Dibetulkan minimal
  (normalisasi FQCN, tanpa menyentuh logika) -> login 200 kembali. PATCH INI MILIK AREA WIP AGENT
  LAIN: harus di-review agent pemilik sebelum commit.
- Hasil flow live: create 332->336 sukses (flash, row Aktif, seed 0, metrik ulasan "Belum ada");
  duplicate same-pair = upsert (1 row); beda-sumber ke target sama = ditolak dgn pesan; disable
  tanpa alasan ditolak; disable beralasan sukses (seed 336 dikosongkan, event log #541); re-enable
  sukses dgn flash. Cleanup: boost uji #3 ditinggal DISABLED beralasan "Selesai untuk uji E2E audit
  UI/UX (produk uji tanpa penjualan)" (state aman, seed 0; TIDAK dihapus agar event log tidak orphan).
- Mobile/a11y: 390px tanpa horizontal overflow, bottom nav ada, select terlabel+required, touch
  target tombol 28px (di bawah 44px rekomendasi - minor), kontras metrik baik di dark mode.
- Test: ProductPopularityBoostTest 11 passed setelah revert patch errors.
- Sisa P3: touch target tombol kecil; flash disable sempat tidak terlihat di sampling pertama
  (auto-dismiss 4s, bukti event log yang dipakai); qa script belum mencakup halaman ini.

### 2026-09-16 — Popularity Boosts: layout mengikuti pola standar admin (feedback owner)
- Owner feedback: tombol "Aktifkan" di header ambigu (bisa diklik sebelum form terisi, terpisah dari
  form, bentrok dgn "Aktifkan kembali" di riwayat). Owner minta tiru layout halaman admin lain.
- Perubahan PopularityBoosts.tsx: form create dipindah ke SectionCard standar (judul + deskripsi +
  icon), CTA submit dipindah KE DALAM form di bawah grid dgn label eksplisit "Aktifkan Teruskan
  Popularitas" (border-top seperti pola TentangKami/Edit), header hanya menyisakan Refresh data.
- Verifikasi live: submitInsideForm=true, label benar, invalid submit tampil Field error +
  FormErrorSummary dalam SectionCard; ProductPopularityBoostTest 11 passed; build PASS.

### 2026-09-16 - Popularity Boosts: layout mengikuti pola standar admin (feedback owner)
- Owner feedback: tombol Aktifkan di header ambigu (bisa diklik sebelum form terisi, terpisah dari
  form, bentrok dgn tombol Aktifkan kembali di riwayat). Owner minta tiru layout halaman admin lain.
- Perubahan PopularityBoosts.tsx: form create dipindah ke SectionCard standar (judul + deskripsi +
  icon), CTA submit dipindah KE DALAM form di bawah grid dengan label eksplisit Aktifkan Teruskan
  Popularitas (border-top seperti pola TentangKami/Edit), header hanya menyisakan Refresh data.
- Verifikasi live: submitInsideForm=true, label benar, invalid submit menampilkan Field error +
  FormErrorSummary dalam SectionCard; ProductPopularityBoostTest 11 passed; build PASS.

### 2026-09-16 - Popularity Boosts: model list-final (tambah via dialog, feedback owner)
- Owner: halaman harus berupa DAFTAR produk yang memakai Teruskan Popularitas; form create tidak
  boleh selalu tampil. Diterapkan: tombol Tambah (icon plus) di header -> Dialog (pola Testimonials)
  berisi form + FormErrorSummary + CTA Aktifkan Teruskan Popularitas; konten utama halaman =
  SectionCard "Produk dengan Teruskan Popularitas" (contentClassName p-0, list divide-y); empty
  state mengarahkan ke tombol Tambah. onSuccess menutup dialog. Deskripsi halaman di controller
  jadi list-oriented.
- Verifikasi live: dialog buka/tutup, create 334->337 via dialog sukses (flash + row baru +
  dialog tutup otomatis), cleanup: boost uji #4 ditinggal disabled beralasan. Tests 11 passed,
  eslint/tsc bersih, build PASS. Catatan deploy: ada dua build bersamaan (agent lain juga build);
  pastikan verifikasi pakai chunk terbaru.

### 2026-09-16 - Popularity Boosts: model tabel padat siap 100+ row (feedback owner)
- Owner: model kartu boros ruang, bayangkan 100 produk. Diubah jadi daftar tabel standar admin:
  - Controller index: server-side search q (SKU/nama sumber & target via whereHas + LikeSearch),
    filter status (all/active/disabled), paginate(15) withQueryString, InertiaAdmin::pagination.
    Product options di-cache 5 menit (admin:popularity-boost:product-options). boostRow() diekstrak.
    Props baru: filters {q,status}, summary {total,active}, pagination.
  - UI: ListToolbar (search + Select filter status) + tabel padat 7 kolom (Sumber ke Target, Seed,
    Terjual + sumber/skor, Ulasan + rating, Ambang, Status + alasan nonaktif + catatan archived,
    Aksi) + Pagination di footer card. Dialog Tambah tetap. Empty state beda utk no-result vs kosong.
- Verifikasi live: tabel render, filter Aktif = 1 row (boost #1), search SKU SP57803272101 =
  1 row, URL query benar (?q=...&status=...); ProductPopularityBoostTest 11 passed; tsc/eslint
  bersih; build PASS.
- Catatan: dialog sukses mengarah ke baris pertama halaman aktif; sort mengikuti updated_at desc
  (sama seperti sebelumnya). Per-page tetap 15 (standar admin lain 14, perbedaan disengaja agar
  konten tabel lebih banyak per layar).

### 2026-09-16 - Popularity Boosts: istilah awam + dropdown bercari (feedback owner)
- Owner: (1) dropdown pilih produk di dialog harus ada searchbar; (2) istilah jargon membingungkan -
  Seed/skor tidak awam, kolom Terjual & Ulasan belum jelas, ambang harusnya tercapai vs target (N/100).
- Perubahan:
  - Dialog create: kedua pemilih produk diganti SearchSelect (komponen standar admin, pola
    SubModelForm) - cari SKU/nama, keyboard nav, error prop. Build + live terverifikasi: cari
    "swing" -> 21 opsi, pilih, submit sukses membuat boost #5 (448 ke 397) via dialog.
  - Label tabel diganti ke bahasa awam: kolom "Penjualan sumber" (N unit), "Penjualan target"
    (N unit), "Ulasan sumber" (N ulasan + rata-rata bintang X dari 5 / Belum ada), "Ambang tercapai"
    (N / target unit; "Tidak diatur" jika kosong). Sub-teks "N sumber, skor N" dihapus. Tooltip
    penjelasan di tiap header & sel. Hint dialog tanpa kata seed/skor.
- Verifikasi live: header & isi sel tampil sesuai (2 unit, 1 ulasan rata-rata bintang 5 dari 5,
  2 / 100 unit); tsc/eslint bersih; build PASS.

### 2026-09-16 - Popularity Boosts: kolom ambang diganti "Progres notifikasi" (klarifikasi owner)
- Owner klarifikasi: ambang = TARGET penjualan yang ditetapkan admin saat create boost; notifikasi
  terkirim saat penjualan sumber mencapai target itu. Label "Ambang tercapai" ambigu (seolah
  ambangnya yang bergerak). Kolom diganti "Progres notifikasi" dgn isi progres penjualan sumber
  menuju target (mis. 2 / 100 unit); "Tidak diatur" bila tanpa target. Tooltip: progres penjualan
  sumber menuju target notifikasi; notifikasi terkirim saat target tercapai.
- Verifikasi live: header kolom baru tampil; tsc/eslint bersih; build PASS.

### 2026-09-16 - Popularity Boosts: kolom final sesuai keputusan owner
- Owner: hapus kolom "Penjualan target" dan "Progres notifikasi" (redundan); gabung penjualan+ulasan
  sumber jadi 1 kolom; ambang tampil N/100.
- Kolom final tabel: Sumber ke Target | Penjualan / ulasan sumber ("2 unit / 1 ulasan" + baris kecil
  "bintang 5 dari 5"; "belum ada ulasan" bila kosong) | Ambang ("2/100", "Tidak diatur" bila tanpa
  target) | Status | Aksi. min-w tabel 54rem -> 44rem. target_sold_count & effective_score tetap
  dikirim controller tapi tidak ditampilkan.
- Catatan penting semantik: angka pertama pada Ambang = penjualan produk SUMBER saat ini (notifikasi
  dipicu penjualan sumber, bukan penjualan target); tooltip kolom menjelaskan ini eksplisit.
- Data prod saat ini (hasil pengujian owner): boost#1 (95->53) NONAKTIF dgn alasan "end"
  (aksi owner 21:57), seed produk53=0; boost#3 & #4 nonaktif beralasan uji E2E; boost#5 (448->397)
  aktif. boost#1 tidak bisa diaktifkan ulang selama produknya archived (UI sudah memberi peringatan).
- Verifikasi live: header & sel tampil sesuai contoh owner; tsc/eslint bersih; build PASS.

### 2026-09-17 - Teruskan Popularitas: purge riwayat (perintah owner)
- Owner: hapus semua riwayat Teruskan Popularitas kecuali yang aktif.
- Dihapus: boost#1 (95->53, alasan "end"), boost#3 (332->336), boost#4 (334->337) - ketiganya
  disabled. Dipertahankan: boost#5 (448->397, aktif). Backup baris yang dihapus tersimpan di
  storage/app/backup-popularity-boosts-20260916-235237.json.
- Ikut dibersihkan: 5 admin_notifications yang menunjuk ke boost terhapus (tautan mati).
  event_logs TIDAK disentuh (append-only, 11 baris tetap, termasuk 10 utk boost terhapus).
- Tidak ada dampak katalog: semua yang dihapus sudah disabled sehingga seed produk target = 0.
- Verifikasi live: halaman menampilkan "1 aktif dari 1 konfigurasi" dengan 1 baris (boost#5).

### 2026-09-17 - Teruskan Popularitas: tombol Hapus per baris (permintaan owner)
- Tambah aksi Hapus di kolom Aksi (semua baris, aktif maupun nonaktif), dengan dialog konfirmasi
  (ConfirmAction, tanpa alasan wajib). Deskripsi konfirmasi menjelaskan konsekuensi seed.
- Backend: route baru DELETE admin.products.popularity-boosts.destroy; ProductPopularityService::purge()
  - transaksi: kosongkan seed target bila popularity_seed_source_product_id cocok dgn sumber boost,
    hapus admin_notifications yang menunjuk ke boost (tautan mati), hapus baris boost;
    ActivityLogService EVENT_DELETED (product_popularity_boost.deleted) tetap dicatat setelah transaksi.
- Docs kanonik routes diperbarui (route destroy). Test baru: hapus boost aktif mengosongkan seed +
  hapus baris + event log; suite ProductPopularityBoostTest 12 passed (55 assertions).
- Verifikasi E2E live: buat boost uji 332->336 via dialog, klik Hapus -> dialog "Hapus Teruskan
  Popularitas?", konfirmasi -> flash "Teruskan Popularitas dihapus permanen.", baris hilang,
  event_logs #559 product_popularity_boost.deleted tercatat, seed 332/336 = 0. Sisa boost: hanya #5 aktif.

### 2026-09-17 - Teruskan Popularitas: baris bisa diedit (pertanyaan owner "non editable?")
- Sebelumnya hanya bisa nonaktif/aktifkan/hapus; untuk ubah pasangan harus hapus+bikin ulang.
  Sekarang ada tombol Edit per baris -> dialog prefilled (SearchSelect sumber/target + ambang).
- Backend: ProductPopularityService::update() - validasi (sumber != target, keduanya aktif, pasangan
  unik, target tidak dipakai boost aktif lain), transaksi: target lama dibersihkan bila pasangan
  pindah, seed dihitung ulang dari penjualan sumber terbaru (hanya bila boost aktif), ambang berubah
  -> threshold_notified_at direset (siklus notifikasi baru); EVENT_UPDATED sebelum/after di log.
  Route PUT admin.products.popularity-boosts.update + edit_url di payload.
- Tests: 2 test baru (edit aktif pindah target+seed recompute+bersihkan target lama; edit ke pasangan
  duplikat ditolak) - suite 14 passed (69 assertions). Docs kanonik routes diperbarui.
- Verifikasi E2E live: boost uji 332->334 dibuat, Edit -> target 335 + ambang 25 -> tersimpan
  (target lama seed 0/source null, target baru source=332, ambang 25, event #561 updated),
  lalu dihapus via tombol Hapus. Produksi bersih: hanya boost #5 (448->397) yang aktif.
- Batasan yang disengaja: Edit tidak bisa menyelamatkan pasangan archived (sumber/target wajib aktif),
  konsisten dengan aturan Aktifkan kembali; catatan "Produk diarsipkan" tetap tampil di status.

### 2026-09-17 - Popularity Boosts: tombol aksi gaya halaman Produk + label nama (SKU)
- Owner: tiru tombol aksi halaman Produk; label produk pakai nama saja + SKU di belakang (nama (sku)).
- UI: kolom Aksi pakai RowActions + RowActionsMenu (pola Products/Index): tombol kecil "Edit"
  (variant secondary, size xs) + menu "Lainnya" (dots-three) berisi Nonaktifkan (ConfirmAction
  dgn alasan, trigger gaya menu) / Aktifkan kembali (dropdown item) / Hapus (trigger destructive
  gaya menu). Import row-actions + dropdown-menu.
- Controller productOption: label = "Nama Produk (SKU)" (sebelumnya "SKU · nama · KATEGORI · MODEL").
  Berlaku di tabel dan opsi SearchSelect dialog Tambah/Edit.
- Verifikasi live: sel pertama "swingswing (RAEGG3SZ2A3X)" / "Tinggi 120cm ... Ornamen (RAWSGXA25CHS)";
  tombol baris = Edit + Lainnya; menu berisi Nonaktifkan + Hapus; klik Nonaktifkan dari menu membuka
  dialog konfirmasi (Batal aman -> status tetap Aktif); opsi dropdown 111 item format "nama (SKU)".
  tsc/eslint bersih; build PASS.

### 2026-09-17 - Popularity Boosts: tombol aksi gaya halaman Produk + label nama (SKU)
- Owner: tiru tombol aksi halaman Produk; label produk pakai nama saja + SKU di belakang (nama (sku)).
- UI: kolom Aksi pakai RowActions + RowActionsMenu (pola Products/Index): tombol kecil "Edit"
  (variant secondary, size xs) + menu "Lainnya" (dots-three) berisi Nonaktifkan (ConfirmAction
  dgn alasan, trigger gaya menu) / Aktifkan kembali (dropdown item) / Hapus (trigger destructive
  gaya menu). Import row-actions + dropdown-menu.
- Controller productOption: label = "Nama Produk (SKU)" (sebelumnya "SKU, nama, KATEGORI, MODEL").
  Berlaku di tabel dan opsi SearchSelect dialog Tambah/Edit.
- Verifikasi live: sel pertama "swingswing (RAEGG3SZ2A3X)" / "Tinggi 120cm ... Ornamen (RAWSGXA25CHS)";
  tombol baris = Edit + Lainnya; menu berisi Nonaktifkan + Hapus; klik Nonaktifkan dari menu membuka
  dialog konfirmasi (Batal aman, status tetap Aktif); opsi dropdown 111 item format "nama (SKU)".
  tsc/eslint bersih; build PASS.

### 2026-09-17 - Popularity Boosts: baris "Diperbarui ..." dihapus dari tabel (perintah owner)
- Baris kecil "Diperbarui <tanggal>" di sel pertama dihapus; helper dateLabel ikut dihapus karena
  tidak lagi terpakai. Sel pertama kini hanya: nama sumber (SKU) + nama target (SKU).
- Verifikasi live: sel = "swingswing (RAEGG3SZ2A3X)" / "Tinggi 120cm ... Ornamen (RAWSGXA25CHS)",
  tidak ada teks "Diperbarui" di halaman; tsc/eslint bersih; build PASS.

### 2026-09-17 - Media Library: hapus 3 aset bermasalah (perintah owner, item 1 dan 2)
- Konteks diagnosa (gambar tidak muncul di /admin/media/library):
  1. Aset video #954 "Test Sliding 15 Detik.mp4" dirender lewat tag <img> sehingga browser tidak
     bisa menampilkannya (file sendiri ada, HTTP 200 video/mp4). Penyebab: video tanpa derivatives
     poster, dan MediaAsset::localUrlFor('thumb') fallback ke object_key (file video).
  2. Aset #946 & #947 "Asset Test Guard" (object_key test/guard_*.jpg): status DB "ready" tapi file
     sudah tidak ada di R2 (404) - sisa data uji.
  3. Aset #956/#957 "ChatGPT Image Sep 10 ... .png": status archived + file sudah dibersihkan,
     kartu menampilkan ikon placeholder (by design) - TIDAK dihapus.
- Tindakan (owner memilih hapus untuk item 1 dan 2): hapus #954, #946, #947 memakai alur yang sama
  dengan tombol hapus aplikasi (cek pemakaian produk/banner/gallery -> hapus file storage -> hapus
  baris; poster_asset_id turunan dinullkan). File video 2,3 MB terhapus dari R2.
- Verifikasi: total aset 857 -> 854; tidak ada sisa object_key test/*; video tanpa derivatives
  tersisa 0; cek storage exists=false; URL dengan cache-bust 404 (URL tanpa cache-bust masih 200
  karena cache CDN); halaman Media Library tidak lagi memuat "Test Sliding" / "Asset Test Guard".
- Catatan: item 3 sengaja dibiarkan karena memang perilaku by design untuk aset archived.

### 2026-09-17 - Media picker form produk TIDAK FUNGSIONAL: 3 bug ditemukan dan diperbaiki
Laporan owner: "media picker di form edit produk (hasil pemasangan) belum fungsional, tidak dapat
gunakan media". Investigasi live di /admin/kelola/produk/448/edit menemukan TIGA bug terpisah:

1. MISMATCH KEY PROP (akar utama, membuat "Gunakan media" crash):
   Controller mengirim mediaActionUrls dengan key `store`, `bulk`, `presign`, ... tanpa akhiran
   "Url", sementara kontrak frontend MediaPanelUrls (product-edit/types.ts) mengharapkan
   `storeUrl`, `bulkUrl`, `presignUrl`, `finalizeUrl`, `statusUrl`.
   Akibat: ProductForm membaca mediaActionUrls.storeUrl = undefined ->
   `router.post(undefined)` -> TypeError "Cannot read properties of undefined (reading 'toString')"
   di dalam Inertia saat tombol ditekan. Tombol tampak bisa diklik tapi tidak menyimpan apa pun.
   Terbukti dari stack trace live: media-picker onClick -> ProductForm onPick -> Inertia post -> crash.
   FIX: samakan semua key dengan kontrak (storeUrl/bulkUrl/presignUrl/finalizeUrl/statusUrl/
   pickerUrl/uploadUrl) di ProductController@edit.

2. PROP installationMedia TIDAK PERNAH DIKIRIM:
   Frontend membaca prop `installationMedia` (dipakai sebagai state awal instRows), tetapi
   ProductController tidak pernah mengirimnya -> section "Hasil Pemasangan" selalu 0 media meski
   barisnya ada di DB. Galeri katalog juga memfilter KELUAR media is_installation, jadi media
   tersebut tidak muncul di tempat lain -> seolah "tidak dapat digunakan".
   FIX: kirim prop installationMedia (query product->installationMedia() + mediaAsset, urut posisi,
   lengkap dgn update_url/archive_url). Route yang dipakai: admin.media.update & admin.media.archive
   (BUKAN admin.products.media.update/archive yang tidak ada).

3. TOMBOL TAMBAH HANYA TAMPIL SAAT DAFTAR KOSONG:
   Tombol "Pilih media dari Media Library sebagai hasil pemasangan" berada di cabang `: (` dari
   ternary `ada-media ? daftar : tombol`, sehingga begitu produk punya 1 media hasil pasang,
   admin tidak punya cara menambah media kedua dan seterusnya.
   FIX: keluarkan tombol dari ternary agar selalu tampil (tinggi menyesuaikan: h-20 saat sudah ada
   media, h-28 saat kosong).

Verifikasi (live, sesi admin):
- Tambah media kedua: buka picker (48 kartu) -> pilih -> "Gunakan media" -> POST
  /admin/kelola/produk/448/media status 200 -> hitungan section langsung 1 -> 2 media. Tanpa error.
- Tombol tambah terverifikasi tampil saat sudah ada 1 media (sebelumnya tidak ada).
- Baris uji yang dibuat sesi ini dihapus kembali; sisa 1 baris lama (id 3191) sesuai kondisi awal.
- Test media: AdminProductMediaVariantTest, MediaAssetWorkflowTest, MediaPickerEndpointTest,
  SharedMediaAssetTest, InstallationMediaImportTest, Phase11AdminMediaReviewGuardTest = 17 passed.
  (3 kegagalan awal ternyata murni masalah kepemilikan folder storage/framework/testing/disks
  milik root -> Permission denied; diperbaiki dgn chown www-data, bukan regresi kode.)
- tsc: tidak ada error di ProductForm.tsx; build Vite PASS.
Catatan: resources/js/pages/Admin/ProductForm.tsx sedang di-refactor besar oleh agent lain
(terlihat dari diff: penghapusan MediaRowsPanel/VariantRowsPanel, unused import tersisa). Perubahan
saya di file itu terbatas pada tombol tambah di atas; eslint masih melaporkan unused import
peninggalan refactor tersebut dan itu BUKAN dari perubahan ini.

### 2026-09-17 - Dropdown terpotong di form produk (dan komponen lain): pindah ke portal
Laporan owner: "dropdown picker terpotong. yg lain juga."
Gejala live yang terukur: dropdown Model di /admin/kelola/produk/448/edit dirender sebagai
popover `absolute` di dalam container `relative`, sedangkan ancestor-nya adalah
`<section class="overflow-hidden">`. Popover setinggi 289px membentang y=528..817 sementara
section berakhir di y=629 -> 188px (sekitar 65% daftar opsi) TERPOTONG dan tidak bisa diklik.

Akar masalah: pola popover absolut di dalam container. Setiap kali komponen ini dipakai di dalam
kartu/section ber-overflow hidden (pola umum di admin), daftar opsinya terpotong.

Perbaikan (portal + posisi fixed, mengikuti pola yang sudah dipakai dialog/opsi lain):
- resources/js/components/admin/ui/select.tsx (dipakai 43 file) - popover dirender via
  createPortal(document.body), posisi dihitung dari getBoundingClientRect trigger, ikut
  scroll/resize (listener capture), auto flip ke atas bila ruang bawah kurang, klik-di-luar
  mempertimbangkan popover portal. Ref trigger digabung (forwardRef eksternal + internal).
- resources/js/components/admin/ui/search-select.tsx - perlakuan sama (dipakai di dialog
  Teruskan Popularitas, form Sub Model, Media Attach).
- resources/js/components/admin/option-menu.tsx - perlakuan sama + dukungan align="right"
  lewat positioning fixed (bukan lagi right-0 absolut).

Verifikasi live (diukur, bukan sekadar build hijau):
- Select form produk: popover kini position:fixed, parent = BODY, rect y=379..668 sepenuhnya di
  dalam viewport 720 (sebelumnya terpotong di 629). Memilih opsi bekerja: "Swing Satu Daun" ->
  "Sliding Dua Daun", dropdown menutup.
- SearchSelect dialog Teruskan Popularitas: position:fixed, parent BODY, y=303..554 dalam viewport.
- OptionMenu dashboard: position:fixed, parent BODY, y=330..478 dalam viewport, 5 opsi.
- tsc bersih untuk ketiga file, eslint bersih, build Vite PASS.
- Regression: ProductPopularityBoostTest + AdminProductMediaVariantTest + MediaPickerEndpointTest +
  AdminRouteParameterNamingTest = 18 passed (101 assertions).
Catatan: perubahan pada form produk saat pengujian tidak disimpan (hanya state form), halaman
dimuat ulang sehingga tidak ada data produk yang berubah.

### 2026-09-17 - Media picker: dropdown folder bisa di-drag + pencarian folder mencakup sub-folder
Dua permintaan owner:
(1) dropdown folder media picker dapat diperpanjang dengan menarik tepi bawah;
(2) saat mencari folder, sub-folder harus ikut muncul (aset umumnya ada di sub-folder, bukan folder induk).

TEMUAN PENTING (lebih dalam dari yang tampak): filter folder di server memakai EXACT MATCH
(`where('folder_id', X)`), sehingga memilih folder induk seperti "Jendela Swing" (0 aset langsung,
11 sub-folder) menampilkan KOSONG walau total ada 48 aset di dalamnya. Terbukti live: endpoint
/admin/media/picker?folder_id=8 mengembalikan 48 aset SETELAH perbaikan (sebelumnya 0).

Perubahan:
- MediaPickerController@index: folder_id kini mencakup seluruh subtree (loop anak-turunan via
  MediaFolder) sehingga folder induk = folder + semua sub-folder.
- media-picker.tsx (FolderFilterCombobox, ditulis ulang):
  * buildFolderTree menghitung `assets_total` (aset sendiri + subtree) dan `path` lengkap
    (mis. "Jendela Swing / 70x60"). Angka di daftar kini memakai assets_total agar tidak
    menyesatkan (induk tidak lagi tampak 0 padahal ada 48 aset di bawahnya).
  * Pencarian memakai `path`, jadi query "swing" memunculkan folder induk + 11 sub-folder di
    dalamnya; sub-folder menampilkan breadcrumb induknya sebagai baris kecil.
  * Pegangan tarik (role="separator", cursor ns-resize) di tepi bawah dropdown untuk
    memperpanjang/memperpendek daftar; tinggi dibatasi (min 120, maks 560, dan tidak melebihi ruang
    viewport), diingat di localStorage `media-picker:folder-list-height`, klik dua kali = default.
    Drag memakai pointer events di window sehingga tetap halus meski kursor keluar dari handle.
  * Popover dipindah ke createPortal(document.body) + position fixed, karena daftar yang
    diperpanjang akan terpotong oleh kontainer scroll dialog (pola sama dengan perbaikan Select).
- Sekaligus membersihkan sisa lint lama di file yang sama (import router, tipe UploadResult, csrf
  yang tidak terpakai) dan menghindari setState di dalam effect untuk localStorage.

Verifikasi live (tab dengan build terbaru app-ClMi20sN.js / media-picker-BkBM_7pp.js):
- Handle tarik ada: role=separator, cursor ns-resize, daftar 224px. Simulasi drag +160px ->
  daftar menjadi 384px dan nilai tersimpan di localStorage ("384").
- Pencarian "swing": 12 hasil = folder induk + 11 sub-folder (dengan breadcrumb "Jendela Swing"),
  masing-masing menampilkan total aset subtree (12 per sub-folder).
- Memilih sub-folder "70x60" -> trigger menampilkan "↳ 70x60" dan galeri memuat 12 aset.
- Server: /admin/media/picker?folder_id=<Jendela Swing> = 48 aset (sebelumnya 0).
- Tests: MediaLibraryFolderTest + SharedMediaAssetTest = 9 passed; MediaPickerEndpointTest +
  AdminProductMediaVariantTest lulus. (Beberapa kegagalan awal murni karena folder
  storage/framework/testing/disks milik root dari proses test paralel; setelah chown + bersih,
  semuanya lulus - bukan regresi kode.)
- tsc bersih, eslint file terkait bersih (sisa 1 warning pre-existing), build Vite PASS.

### 2026-09-17 - Foto produk: urutan yang digeser admin TIDAK tersimpan (bug, diperbaiki)
Laporan owner: "sudah menyesuaikan urutan foto produk, tapi saat disimpan urutan tidak berubah".
Direproduksi penuh di /admin/kelola/produk/448/edit: geser foto -> Simpan -> buka ulang ->
urutan kembali seperti semula.

AKAR MASALAH 1 (utama): blok `variant_defs` di ProductController@update (bagian "Simpan foto per
opsi varian") memanggil MediaAssetResolver::attach() dengan 'position' => 50 + (slotNo-1)*10 untuk
SETIAP opsi varian pada SETIAP simpan. Baris yang sudah ada pun ditimpa kembali ke posisi band
(50/60/70), sehingga urutan yang baru diatur di loop media_asset_ids langsung tertimpa. Grid form
menampilkan media varian digabung dengan media katalog, jadi menggeser foto varian (yang justru
paling sering, 4 dari 8 slot di produk ini) selalu gagal tersimpan.
FIX: attach hanya mengirim 'position' bila baris varian tersebut BELUM ada (posisi band hanya untuk
baris baru); baris eksisting mempertahankan posisi hasil urutan form.

AKAR MASALAH 2: loop urutan media_asset_ids hanya memindahkan SATU baris per aset
($product->media->first(...)). Satu aset bisa punya beberapa baris varian sisa import (contoh:
asset 821 punya 3 baris varian; 825/835/839 masing-masing 3 baris). Akibatnya sebagian baris
tertinggal di posisi lama dan yang tampil di form bisa baris yang salah -> urutan tetap tampak
tidak berubah.
FIX: ditambahkan PASS PENEGAKAN URUTAN FINAL setelah semua blok selesai: nomor katalog 1..n dan
nomor varian 50..n dari urutan yang dikirim form, dan SEMUA baris milik aset yang sama diberi nomor
identik. Loop awal juga kini memberi nomor berurutan untuk baris varian (sebelumnya semua varian
memakai posisi lamanya).

Verifikasi live (end-to-end, bukan hanya build): geser foto varian terakhir ke kiri -> Simpan ->
buka ulang halaman -> urutan BARU bertahan (asset 4001617b tetap di depan e86fa6d2). Setelah
verifikasi, urutan dikembalikan ke susunan semula sehingga tidak ada perubahan data yang
ditinggalkan pada produk 448.
Tests: AdminProductMediaVariantTest + SharedMediaAssetTest + MediaLibraryFolderTest +
MediaPickerEndpointTest = 11 passed (78 assertions). (Kegagalan awal murni karena folder
storage/framework/testing/disks milik root dari proses paralel; setelah dibersihkan + chown, lulus.)

### 2026-09-17 (lanjutan) - Foto produk: kenapa urutan "tidak berubah" + aturan area katalog vs varian
Laporan owner masih "belum bisa tuh" setelah perbaikan pertama. Investigasi lanjutan dengan
merekam payload PUT menemukan penyebab sebenarnya:

1. KASUS yang gagal: owner memindahkan FOTO VARIAN (Hitam/Bening, Cokelat/Bening, Serat Kayu/Bening,
   Putih/Bening) ke depan, bercampur dengan foto katalog. Payload terkirim benar (mis.
   [839, 828, 278, 826, 228, 825, 835, 821]) TETAPI penyimpanan memang MEMISAHKAN dua area:
   band posisi 1-49 = foto katalog, 50-79 = foto varian (kontrak ini dipakai fitur lain, mis.
   UpdatePreviewDiff baca posisi-50 sebagai indeks opsi varian). Jadi foto varian tidak akan
   pernah bisa berada di urutan depan katalog - sebelumnya UI menerima gerakan itu lalu
   mengembalikannya tanpa penjelasan, sehingga tampak "urutan tidak tersimpan".

2. KASUS yang berhasil (setelah perbaikan pertama): memindahkan foto KATALOG sesama katalog.
   Diuji: geser foto katalog ke-3 ke kiri -> Simpan -> buka ulang halaman di tab baru ->
   urutan BARU bertahan (828, 826, 278, 228). Payload dan DB identik.

Perubahan lanjutan (UI ProductForm.tsx):
- moveSlot kini memisahkan jenis foto berdasarkan DATA (productVariantId / variantOptionMedia),
  bukan slot.type - karena di mode edit foto varian masuk daftar pickedMedia sehingga slot-nya
  bertipe "catalog" dan pengecekan berbasis slot tidak pernah aktif.
- Gerakan yang menyeberangi batas katalog<->varian DITOLAK dengan pesan jelas (orderNotice)
  alih-alih diterima lalu dikembalikan: "Foto varian hanya bisa diurutkan sesama foto varian.
  Untuk memindahkannya ke urutan katalog, ubah fotonya di Definisi Varian."
- Tombol panah kiri/kanan otomatis nonaktif di perbatasan area (terverifikasi: item katalog
  terakhir tidak punya panah kanan aktif; item varian pertama tidak punya panah kiri aktif).
- Keterangan section diperjelas: foto katalog dan foto varian berada di area terpisah, urutan
  foto varian dikelola di Definisi Varian.

Verifikasi: tests AdminProductMediaVariantTest + SharedMediaAssetTest + MediaLibraryFolderTest +
MediaPickerEndpointTest + ModelProductMediaTest = 20 passed (142 assertions). tsc bersih, build PASS.

### 2026-09-17 - Foto produk: urutan bebas (varian tetap urut) + foto sama boleh di Foto Produk & Hasil Pemasangan
Dua keputusan owner yang diimplementasikan:
(1) Foto varian tetap urut mengikuti opsi varian, sedangkan media non-varian (foto katalog, shared
    media, video) BEBAS dipindah ke mana saja termasuk ke belakang blok varian. Contoh nyata:
    shared media "AD.png" diletakkan di urutan paling akhir karena tidak prioritas di storefront.
(2) Satu aset foto boleh dipakai sekaligus di Foto Produk DAN di Hasil Pemasangan (sebelumnya
    saling menimpa sehingga foto hilang dari salah satu bagian).

Perubahan:
- app/Services/MediaAssetResolver.php: kunci pencarian baris kini memisahkan is_installation
  (katalog vs hasil pasang), sehingga attachment yang sama bisa punya dua baris terpisah. Paksaan
  band posisi (1-49 katalog / 50-79 varian) dihapus; posisi mengikuti nilai dari pemanggil.
- app/Http/Controllers/Admin/ProductController.php: urutan media pada update() menjadi murni 1..N
  sesuai susunan form, semua baris milik aset yang sama (termasuk sisa duplikat varian) mendapat
  nomor sama, media yang tidak dikirim lagi diarsipkan hanya pada is_installation=false (tidak
  menyentuh hasil pemasangan), sort prop edit() tidak lagi memaksa katalog di depan varian, dan
  prop installationMedia kini menyaring ->visible() agar baris terarsip tidak tampil di form.
- resources/js/pages/Admin/ProductForm.tsx: moveSlot() memakai deteksi berbasis data
  (productVariantId) dengan aturan: urutan relatif sesama foto varian harus tetap; media non-varian
  bebas. Tombol panah kiri/kanan hanya nonaktif bila tetangganya sesama varian. combinedErrors
  dipulihkan (gabungan form.errors + shared props) karena terhapus saat blok moveSlot diganti.
- Export & preview import (UpdatePreviewDiff, ProductExportFullUpdateSheet, MediaUpdateTemplateExport):
  klasifikasi foto tidak lagi memakai band posisi (tidak lagi akurat setelah urutan bebas), tetapi
  memakai penanda asli: product_variant_id / is_installation, dengan fallback band lama untuk data
  historis. Indeks array 1-based untuk main/shared/installation dipertahankan.

Verifikasi live (produk 448 / RAEGG3SZ2A3X):
- Shared media AD.png digeser ke urutan paling akhir (melewati 4 foto varian), Simpan, buka ulang:
  urutan bertahan. Urutan varian tetap Putih > Hitam > Cokelat > Serat Kayu.
- Foto katalog Utama (aset 828) ditambahkan sebagai Hasil Pemasangan: Hasil Pemasangan menjadi
  2 media dan Foto Produk tetap 8 foto (data uji ini sudah dibersihkan kembali).
- Tests: AdminProductMediaVariantTest, MediaAssetWorkflowTest, SharedMediaAssetTest,
  MediaLibraryFolderTest, MediaPickerEndpointTest, ModelProductMediaTest, InstallationMediaImportTest,
  ImportMediaUpdateTest, Phase11AdminMediaReviewGuardTest, AdminProductWizardTest,
  AdminProductStockInputTest, ModelProductAdminTest, ProductPopularityBoostTest = 68 passed.
- tsc bersih (tidak ada error di ProductForm/MediaPicker), build Vite PASS.
Catatan: PDP toko dibaca dari cache 5 menit (ProductCache) - setelah perubahan urutan perlu flush
agar langsung terlihat; video di galeri memakai elemen <video> sehingga poster-nya terbaca di
posisi strip, bukan berarti videonya dipindah ke belakang.

### 2026-09-17 - Foto hasil pemasangan yang dipakai di Foto Produk hilang saat disimpan (bug, diperbaiki)
Laporan owner: "foto hasil pemasangan yang dipakai di section foto produk belum work, masih hilang
saat disimpan." Direproduksi penuh: aset 817 (foto Hasil Pemasangan) dipakai juga di Foto Produk ->
tersimpan sementara (7 -> 8 foto) -> Simpan -> buka ulang -> foto itu HILANG dari Foto Produk
(payload PUT memang sudah mengirim 817, jadi bug ada di server).

AKAR MASALAH: blok "Normalisasi media" di ProductController@update (bagian akhir, setelah semua
blok media) mendeduplikasi SATU BARIS PER ASET tanpa memisahkan konteks. Loop `whereNull('product_variant_id')`
menghitung baris foto katalog DAN baris hasil pemasangan (keduanya product_variant_id NULL) sebagai
duplikat aset yang sama, lalu MENGARSIPKAN salah satunya (orderByDesc('is_main_image') lalu position:
baris katalog dibuat lebih dulu saat baru, tetapi pada penyimpanan berikutnya baris hasil-pasang yang
lolos dan baris katalog yang diarsipkan). Itu sebabnya foto "hilang" persis setelah Simpan.

PERBAIKAN: deduplikasi dipisah per konteks - loop varian dan loop katalog kini menambahkan
->where('is_installation', false), dan ditambah loop baru khusus is_installation = true yang
mendeduplikasi di dalam konteksnya sendiri. Dengan begitu satu aset boleh punya baris katalog dan
baris hasil-pasang sekaligus, dan masing-masing tetap unik di konteksnya.

VERIFIKASI LIVE (produk 448 / RAEGG3SZ2A3X): aset 817 dipakai di Foto Produk -> Simpan -> buka ulang:
Foto Produk 8 foto DAN Hasil Pemasangan 1 media, keduanya memuat aset 817 (sebelumnya hilang).
Baris uji dikembalikan ke keadaan semula setelah verifikasi (817 kembali arsip di katalog, tetap
tampil di Hasil Pemasangan).
Tests: AdminProductMediaVariantTest, MediaAssetWorkflowTest, SharedMediaAssetTest,
MediaLibraryFolderTest, MediaPickerEndpointTest, ModelProductMediaTest, AdminProductWizardTest,
ProductPopularityBoostTest = 40 passed (232 assertions).

### 2026-09-18 - "Pengunjung yang Membeli" 0,02%: definisi pengunjung diperbaiki (temuan owner)
Konteks: owner bertanya apakah persentase "Pengunjung yang Membeli" (0,02% = 7 pembeli / 42.042
pengunjung) sudah tepat. Audit menemukan dua masalah berbeda.

1. PENYEBUT MEMBENGKAK (diperbaiki). Middleware TrackStorefrontPageView hanya memfilter path,
   tidak memfilter jenis pengakses. Uji langsung: 3 permintaan tanpa cookie menambah 3 pengunjung
   (752 -> 755). Komposisi nyata dari log akses 6 hari untuk GET halaman depan: curl 4.188 (64%),
   Python-urllib 2.047 (32%), browser asli ~231 (3,6%) - jadi sekitar 96% "pengunjung" bukan manusia.
   Data pendukung: 42.364 baris kunjungan vs 42.270 pengunjung unik (rasio views/pengunjung ~1,03,
   normalnya 2-4x).

   Perbaikan (app/Http/Middleware/TrackStorefrontPageView.php): kunjungan dicatat hanya bila
   menyerupai navigasi browser manusia -
   (a) User-Agent tidak memuat pola bot/crawler/skrip/monitor (bot, crawl, spider, curl, python,
       urllib, headless, axios, go-http, semrush, ahrefs, palo alto, dll);
   (b) header Accept memuat text/html;
   (c) membawa cookie sesi ATAU header navigasi Sec-Fetch (mode/dest).
   Browser asli yang baru pertama datang tetap terhitung karena mengirim Sec-Fetch; skrip tanpa
   cookie tidak. Sesuai keputusan owner: "kunjungan dengan cookie sesi = pengunjung manusia".

   Verifikasi live: 4 permintaan non-browser (curl, Python-urllib, Googlebot, UA browser tanpa
   Accept html) = pengunjung tetap 826. Simulasi browser baru (UA Chrome + Accept html + Sec-Fetch,
   tanpa cookie) = 826 -> 827. Kunjungan browser dari sesi yang sudah dihitung hari itu tidak
   menambah (benar: satu sesi = satu pengunjung per hari).

2. METRIK BUKAN PENAUTAN SESI KE ORDER (dilaporkan, belum diubah - keputusan owner).
   conversion_rate = pembeli unik / pengunjung, di mana pengunjung dikenali dari hash sesi dan
   pembeli dari customer_phone; keduanya tidak pernah dipertemukan. Label "Pengunjung yang Membeli"
   karena itu mengklaim hubungan yang tidak diukur; yang benar-benar dihitung adalah rasio pembeli
   terhadap kunjungan. Angka "+100%" di sebelahnya juga palsu karena periode pembanding tidak punya
   order (denominator 0). Keduanya dicatat sebagai keputusan yang menunggu owner.

Dokumentasi: docs/decisions/ADR-015-kpi-performa-toko.md mendapat bagian "7b. Pengunjung
(Kunjungan)" berisi kontrak di atas (termasuk batasan rasio vs penautan sesi).
Tes: StorePerformanceTest + StorePerformanceContractTest + ProductEngagement etc = 64 passed
(368 assertions), termasuk 3 tes baru: kunjungan bot/skrip tidak dihitung (6 kasus),
browser dengan cookie sesi tetap dihitung, dan tes lama disesuaikan memakai header browser.
CATATAN: data historis pengunjung sebelum perbaikan masih membengkak (mis. 42.042 untuk 30 hari);
angka lama bisa dibersihkan bila owner menghendaki (belum dilakukan karena mengubah data produksi).

### 2026-09-18 - Halaman /flash-sale: judul jadi label Flash Sale + hitung mundur (permintaan owner)
Permintaan owner: "rubah jadi label flashsale, dengan countdownnya juga di taruh sini."

Perubahan:
- components/public/flash-sale-stage.tsx - ditambah DUA komponen bersama supaya tampilan
  Flash Sale tidak pernah berbeda antar tempat:
  * FlashSaleLabel: ikon petir + teks "FLASH SALE" miring warna primary (gaya yang sudah
    dipakai headline carousel).
  * FlashSaleCountdown: hitung mundur kotak hh:mm:ss, sumber sama dengan countdown nav
    (harian, bergulir tengah malam, berhenti di akhir kampanye); hanya tampil saat live.
- components/public/product-listing-frame.tsx - prop baru titleRight diteruskan ke
  PageTopBar (elemen kanan judul). Tidak mengubah halaman listing lain (opsional).
- components/public/flash-sale-carousel-section.tsx - memakai FlashSaleLabel +
  FlashSaleCountdown (perilaku sama, kode tidak lagi menduplikasi markup countdown).
- pages/Public/Catalog.tsx - judul halaman /flash-sale kini <FlashSaleLabel /> dan
  countdown ditaruh di kanan judul lewat titleRight. Halaman promo/katalog tidak berubah.
- docs/STANDAR-DESAIN-HALAMAN-PUBLIK.md - bagian baru "Label & Countdown Flash Sale
  (satu sumber)" mencatat kontrak dua komponen ini.

Verifikasi live:
- /flash-sale desktop 1280px: h1 = "FLASH SALE" + ikon petir, countdown 10:34:52 di kanan
  (x 1109..1217, dalam viewport), tanpa overflow horizontal.
- /flash-sale mobile 390px: judul dan countdown satu baris rapi, tidak terpotong
  (h1 204px + countdown 108px pada baris 364px).
- Carousel Flash Sale (halaman /promo?from=paling-banyak-dipesan) tetap benar: label
  "FLASH SALE" + ikon + countdown, 8 kartu.
- tsc bersih untuk 4 file, eslint 4 file exit 0, build Vite PASS.
- Tests: FlashSalePeriodTest + WorkflowAuditP1Test + SitemapTest = 10 passed (213 assertions).

### 2026-09-18 - Kartu carousel Flash Sale: font/ukuran disamakan dengan kartu produk biasa
Permintaan owner: "samakan desain font/ukuran dengan font yg dipakai card produk biasa."

AKAR MASALAH: kartu carousel Flash Sale memakai markup sendiri
(`<h3 class="product-card__title line-clamp-2">`) tanpa modifier `product-card--model`,
sedangkan kartu katalog memakai `product-card--model`. Akibatnya aturan
`.public-title-case h3` (15px, weight 600, line-height 1.5) menang atas
`.product-card__title` (13px, weight 400), sehingga judul di carousel tampil lebih besar
dan lebih tebal daripada kartu produk biasa. Harga juga ikut membesar (20px vs 14px)
karena skala container-query `product-card--model` tidak aktif.

PERBAIKAN (satu perubahan kecil, tanpa CSS baru):
- resources/js/components/public/flash-sale-carousel-section.tsx: class kartu carousel
  menjadi `product-card product-card--model ...` sehingga memakai varian tipografi kartu
  katalog yang sudah ada (judul 13px/400, harga & compare mengikuti lebar kartu,
  padding konten 10px).

BUKTI PENGUKURAN (lebar kartu sama, 221px, diukur langsung di browser):
                       katalog (acuan)      carousel sebelum   carousel sesudah
  judul                13px/400/17.55px     15px/600/22.5px    13px/400/17.55px
  harga                14px/700/18px        20px/700/24px      14px/700/18px
  compare              -                    14px/400/16px      11px/400/16px
  padding konten       10px                 -                  10px
Jadi setelah perbaikan, semua nilai tipografi kartu carousel identik dengan kartu produk biasa.

Verifikasi: tsc bersih, eslint exit 0, build Vite PASS. Tampilan dicek visual di
/promo?from=paling-banyak-dipesan (judul kartu kini seukuran kartu katalog).

### 2026-09-18 - Label "FLASH SALE" terpotong di carousel (permintaan owner)
Laporan owner: "label terpotong" pada label FLASH SALE di carousel.

AKAR MASALAH (terukur, bukan dugaan): span teks memakai kelas `truncate` yang membawa
`overflow: hidden`. Karena teksnya italic, tinta huruf terakhir (E) menonjol keluar dari
kotak teks. Pengukuran di live: box kanan = 141,48px dan tinta (Range.getClientRects)
juga berhenti di 141,48px sehingga `overflow: hidden` memotong bagian paling kanan huruf
terakhir. `scrollWidth == clientWidth` jadi truncate tidak pernah aktif secara logika,
tetapi tetap memotong tinta huruf miring.

PERBAIKAN (components/public/flash-sale-stage.tsx, FlashSaleLabel):
- Hapus `truncate` (overflow hidden) yang tidak diperlukan karena kata ini pendek.
- Tambah `shrink-0` + `whitespace-nowrap` supaya teks tidak mengecil/terlipat di layar sempit.
- Tambah `pr-0.5` sebagai ruang ekstra untuk kemiringan italic.
Sesudah perbaikan: `overflow: visible`, kotak kanan 143,48px dan tinta 141,48px sehingga
ada jarak 2px, `inkInsideBox = true` (tidak terpotong lagi).

Verifikasi live (mobile 425px, /products/all?from=paling-banyak-dipesan&sort=popular):
- Hanya ada SATU elemen label (dicek lewat elementFromPoint di 5 titik: label x=36..143,
  countdown x=290..410) - tidak ada label ganda.
- Screenshot tampilan penuh: "FLASH SALE" terbaca utuh dan countdown 09:56:01 di kanan.
- tsc bersih, eslint exit 0, build Vite PASS.


### 2026-09-18 - Tombol pill "Flash" di toolbar katalog tidak fungsional (bug cache key, diperbaiki)
Laporan owner: "tombol ini tidak fungsional" (menunjuk pill "Flash" di toolbar katalog
`https://ra.333labs.tech/products/all?from=paling-banyak-dipesan&sort=popular`).

AKAR MASALAH 1 (Utama - Server Cache Collision):
Di `CatalogController::category()`, hasil query katalog di-cache 5 menit via
`ProductCache::rememberCatalog($cacheKey)`. Kunci cache `$cacheKey` merangkai category, mode,
model, design, q, sort, from, price_min/max, dan page — TETAPI TIDAK MERANGKAI `$flashOnly`
(ataupun `$request->boolean('flash')`)!
Akibatnya: saat pembeli membuka halaman katalog umum (111 atau 130 barang), Redis menyimpan
hasil tersebut dengan key `cat||catalog||||popular|from-curated|||1`. Begitu pembeli mengklik
tombol pill "Flash" (`?flash=1`), server menghitung `$cacheKey` yang IDENTIK PERSIS, sehingga
query filter 18 barang flash sale diabaikan dan Redis menyajikan kembali 111 barang umum yang
tersimpan di cache. Tampilan daftar barang sama sekali tidak berubah dan tombol tampak mati.

AKAR MASALAH 2 (Navigasi /flash-sale):
Di `Catalog.tsx`, fungsi `toggleFlash()` sebelumnya menggunakan `basePath` apa adanya. Pada
halaman khusus `/flash-sale`, `basePath` bernilai `/flash-sale`, sehingga mematikan pill flash
hanya memuat ulang rute `/flash-sale` tanpa beralih ke daftar produk umum (`/products/all`).
Fungsi `visit()` juga sebelumnya membuang parameter `flash: 1` saat pembeli menyaring model/desain.

PERBAIKAN:
- `app/Http/Controllers/CatalogController.php`: `$cacheKey` kini merangkai `$flashOnly ? 'flash' : 'no-flash'`,
  sehingga hasil filter flash sale memiliki kunci cache mandiri dan tidak bertabrakan dengan listing umum.
- `resources/js/pages/Public/Catalog.tsx`: `toggleFlash()` kini mengarahkan ke `/products/all` saat mematikan
  flash dari rute `/flash-sale`, serta mempertahankan parameter filter lain (model, design, price, search, from);
  `visit()` mempertahankan `flash: isFlash ? 1 : undefined`.
- `resources/js/components/public/catalog-nav.tsx`: tombol pill Flash diberi `aria-label={isFlash ? "Matikan filter Flash Sale" : "Aktifkan filter Flash Sale"}`
  agar nama aksesibilitas bersih (tidak menggabungkan teks mobile "Flash" dan desktop "Flash Sale").

VERIFIKASI LIVE:
- Dari `https://ra.333labs.tech/products/all?from=paling-banyak-dipesan&sort=popular` (130 barang, pill mati):
  klik tombol Flash -> URL berganti ke `...&flash=1`, pill aktif (merah), daftar produk menyaring langsung
  menjadi 18 barang flash sale live.
- Klik tombol Flash sekali lagi -> URL kembali tanpa `flash=1`, pill mati, daftar produk kembali menjadi 130 barang.
- Dari `/flash-sale` (18 barang, pill aktif) -> klik tombol Flash -> beralih ke `/products/all` (130 barang, pill mati).
- Dari `/products/jendela?model=SWING_1_DAUN` (9 barang) -> klik tombol Flash -> URL menjadi `...&flash=1&model=SWING_1_DAUN`.
- Tests: full suite catalog & flash sale = 94 passed (687 assertions). tsc bersih, eslint exit 0, build Vite PASS.

### 2026-09-18 - Tombol kembali ganda di halaman publik (opsi C, keputusan owner)
Temuan saat memeriksa breadcrumb: komponen `Breadcrumbs` (components/ui/breadcrumbs.tsx)
merender tombol backnya SENDIRI tanpa batas breakpoint, sementara setiap halaman juga
merender tombol back sendiri dengan `lg:hidden`. Akibatnya pada rentang 768-1023px muncul
DUA tombol kembali sekaligus. Pola sama juga terjadi di Cart, Checkout (2 tempat),
OrderConfirmation, dan ProductDetail - di sana tombol ganda muncul di hampir semua ukuran
layar karena breadcrumb mereka juga tidak dibatasi `lg`.

Keputusan owner: OPSI C - breadcrumb TETAP tampil, tombol back di samping judul halaman
yang disembunyikan saat breadcrumb sudah terlihat.

Perubahan (ambang tombol back halaman lg:hidden -> md:hidden, sejajar ambang breadcrumb):
- components/public/page-top-bar.tsx (dipakai semua halaman statis/listing lewat frame)
- pages/Public/Cart.tsx
- pages/Public/Checkout.tsx (2 tombol)
- pages/Public/OrderConfirmation.tsx
- pages/Public/ProductDetail.tsx (tombol overlay di media)

Verifikasi live per lebar:
- /products/all?flash=1: pada 390/640/767px tombol "Kembali" halaman tampil (breadcrumb
  sembunyi); pada 768/900/1023/1024/1280px tombol halaman HILANG dan breadcrumb tampil
  (hanya menyisakan tombol "Kembali ke atas" dari back-to-top, memang berbeda fungsi).
- /product/RAEGG3SZ2A3X dan /cart: 390px -> tombol halaman tampil, breadcrumb sembunyi;
  900px dan 1280px -> tombol halaman hilang, breadcrumb tampil.

Docs: docs/STANDAR-DESAIN-HALAMAN-PUBLIK.md diselaraskan - breadcrumb `hidden md:block`
(sebelumnya tertulis sm), tombol back `md:hidden` (sebelumnya sm), plus bagian baru
"Kontrak tombol kembali (keputusan owner 2026-09-18: opsi C)" berisi tabel per breakpoint.

Catatan: temuan ini murni soal tampilan; tombol back di dalam Breadcrumbs tetap berfungsi
sehingga navigasi kembali tidak pernah hilang di lebar mana pun. tsc bersih, eslint 0 error
(3 warning pre-existing di Cart/Checkout), build Vite PASS.

### 2026-09-18 - Kolom specifications XLSX pakai KOMA sebagai pemisah
Permintaan owner: "pakai koma saja. Bahan: Aluminium, Kaca: Tempered, Kusen: 4inch dan
seterusnya, koma akan membuat baris baru".

Masalah: template sebelumnya hanya menerima titik koma dan baris baru sebagai pemisah
spesifikasi, sehingga pemilik toko yang menulis dengan koma (cara paling natural di Excel)
menghasilkan SATU atribut raksasa, bukan beberapa baris spesifikasi. Tapi koma tidak bisa
dijadikan pemisah naif: 44 dari 107 nilai di `sub_model_attribute_templates` mengandung koma
di DALAM nilai, mis. "EPDM kualitas ekstra, kedap debu dan air hujan" dan
"Kaca bening single glass 5 mm (opsi: riben, es, doble glass)". Pemisahan buta akan memecah
nilai-nilai itu.

Perubahan:
- `app/Imports/CatalogProductsImport.php` - `syncAttributes()` memakai closure
  `$pushAttributes` yang memecah per koma, tapi potongan koma hanya dianggap spesifikasi BARU
  bila mengandung ":". Bila tidak, potongan itu ditempelkan kembali ke nilai sebelumnya
  (dipisah ", "). Titik koma dan baris baru tetap diterima sebagai pemisah tingkat pertama.
  Jadi "Bahan: Aluminium, Kaca: Tempered" = 2 baris, sementara
  "Roll Karet: EPDM kualitas ekstra, kedap debu" = 1 baris utuh.
- `app/Exports/CatalogTemplateExport.php` - contoh baris sheet Contoh dan teks baris
  `specifications` di sheet Panduan diubah ke format koma, plus docblock kelas.
- `app/Exports/ProductExportFullUpdateSheet.php` - BUG: kolom specifications di sheet
  "Update Produk Lengkap" menulis `$product->specifications`, padahal itu bukan kolom
  `products` dan bukan accessor, jadi kolom itu SELALU kosong. Diganti helper
  `attributesCell()` yang membaca relasi `attributes` (hanya `product_variant_id` NULL,
  spesifikasi memang milik produk) dan menuliskannya "Nama: Nilai, Nama: Nilai" agar bisa
  dibaca balik oleh importer. Query eager load ikut menambah `attributes`.
- `docs/import-template-dual-sheet.md` - paragraf format specifications diselaraskan.

Verifikasi:
- Template XLSX nyata digenerate dari `CatalogTemplateExport`: kolom specifications = kolom X
  (ke-24) di sheet Data, contoh berisi "Bahan: Aluminium, Kaca: Tempered, Kusen: 4 inch",
  teks Panduan memuat aturan koma.
- Round-trip nyata: produk 156 (RACJKR2PBK2E, "Material = Aluminium") diekspor lewat
  ProductExportFullUpdateSheet -> kolom specifications berisi "Material: Aluminium"
  (sebelum perbaikan: kosong).
- Tests: ImportPipelineTest 4 passed (19 assertions) - koma jadi pemisah, koma di dalam nilai
  tetap utuh, titik koma dan baris baru tetap didukung. Suite terkait (ImportCatalogIndonesia,
  CatalogDynamicCategory, template 3 sheet) 6 passed (25 assertions).

Cakupan aman: 107 nilai template mengandung koma, 24 mengandung titik dua; parser koma
mempertahankan keduanya.

### 2026-09-18 - Sub model produk opsional dan bebas (tidak diikat daftar sub_models)
Konteks: saat memeriksa kolom XLSX specifications, muncul pertanyaan owner soal ZIGZAG
yang tidak punya sub model. Owner menetapkan kontrak baru, verbatim: "artinya sistem jangan
terlalu ketat disini. tidak masalah jika mungkin ada zigzag ornamen, walaupun tidak ada
secara nyata, artinya sistem berlaku dengan benar. jika tanpa memilih ornamen atau polos
atau sub model lain, maka dia memang tanpa sub model alias berdiri sendiri seperti zigzag."

Sebelumnya `design_variant` divalidasi `Rule::exists('sub_models','code')->where('product_model', ...)`,
jadi kode seperti ZIGZAG + ORNAMEN ditolak form admin walau storefront sudah permisif
(`CatalogTaxonomy::availableDesignFilters()` membangun chip dari desain yang benar-benar ada,
dan `CatalogController::designHasProducts()` mengalihkan URL desain kosong ke halaman model).

Perubahan:
- `app/Http/Controllers/Admin/ProductController.php` - validasi `design_variant` di store dan
  update dilonggarkan menjadi `['nullable','string','max:100']` (tidak lagi `Rule::exists`).
  Ditambah normalisasi `CatalogLabels::normalizeDesign()` sebelum simpan, supaya kode dari
  form selalu tersimpan kapital dan cocok dengan filter katalog.
- `app/Support/CatalogLabels.php` - `normalizeDesign()` kini melakukan `str_replace(' ','_')`
  sebelum `strtoupper`, sama seperti `normalizeModel()`. Sebelumnya spasi dibiarkan, sehingga
  "seri khusus" tersimpan sebagai "SERI KHUSUS" (berspasi) dan tidak pernah cocok dengan slug
  filter desain. Data lama sudah seragam kapital tanpa spasi, jadi tidak ada baris yang berubah.
- `resources/js/components/admin/ui/search-select.tsx` - prop baru `creatable`: baris
  "Pakai <ketikan>" muncul di bawah hasil filter bila nilai yang diketik belum ada padanannya.
  Nilai tersimpan dicocokkan tanpa peduli besar-kecil huruf, dan label nilai tersimpan yang
  belum terdaftar tetap ditampilkan HANYA pada pemilih creatable.
- `resources/js/lib/search-select.ts` - helper murni `withCreatableRow()` (dipakai komponen,
  diuji Vitest tanpa render).
- `resources/js/pages/Admin/ProductForm.tsx` - pemilih Sub Model memakai `SearchSelect`
  creatable; bawaannya kosong (tidak lagi dipaksa "POLOS"), daftar berisi sub model milik
  model terpilih plus "Tanpa sub model", dan kode bebas yang sudah tersimpan ikut ditampilkan.
- `app/Exports/CatalogTemplateExport.php` + `docs/import-template-dual-sheet.md` - baris
  panduan dipisah: `product_category / product_model` WAJIB, `design_variant` OPSIONAL dengan
  penjelasan kode baru boleh diketik dan kosong berarti berdiri sendiri.

Verifikasi:
- Live MySQL pada produk 360 (RAG6L2GPMGTQ, Boven Zigzag): input "ornamen" -> tersimpan
  ORNAMEN; "seri khusus" -> SERI_KHUSUS; "" -> NULL. Nama produk tidak tersentuh, data
  dipulihkan ke NULL setelah uji.
- Label storefront: ZIGZAG + ORNAMEN -> "Ornamen", productLine "Boven Zigzag Ornamen";
  ZIGZAG + NULL -> productLine "Boven Zigzag" (tanpa suffix).
- Tests: `ProductWithoutSubModelTest` 9 passed (16 assertions) - termasuk kode baru diterima,
  kode asing disimpan apa adanya, huruf kecil dinormalkan, dan normalisasi saat edit.
  Suite terkait (AdminProductWizard, AdminProductMediaVariant, ModelProductAdmin, ImportPipeline,
  ImportCatalogIndonesia, FlashSalePeriod) total 30 passed (271 assertions).
  Regresi luas `--filter="Catalog|Admin|Product"`: 402 passed, 1 gagal di MasalahSolusiAdminTest
  yang berasal dari perubahan agent lain yang belum di-commit (terbukti lolos saat perubahan
  itu di-stash, dan tidak ada berkas MasalahSolusi di perubahan ini).
- Vitest `tests/frontend/search-select.test.ts` 15 passed (7 test baru untuk withCreatableRow).
- tsc bersih; eslint ProductForm 16 masalah (9 error) identik sebelum dan sesudah patch, tidak
  ada error baru; build Vite PASS.
- Dropdown Excel kolom F tetap dibiarkan (showErrorMessage default false = saran, bukan
  larangan), jadi tidak memblokir kode sub model baru.

### 2026-09-18 - Katalog: jumlah kartu per halaman menyesuaikan lebar layar (mobile 16, desktop 15)
Keluhan owner: "card produk di halaman katalog kok masih 15 terus, sudah di ingatkan berulang kali
untuk jadi 16 untuk mobile view", lalu setelah percobaan pertama: "tapi di desktop view malah jadi
16 juga, harusnya tetap 15 dong".

Akar masalah dua lapis:
1. Angka 15 berasal dari commit optimasi performa 04ebe37 yang membuat kunci config eksplisit
   "sama seperti perilaku sebelumnya" (default bawaan paginator Laravel), bukan keputusan desain.
   Sebelum itu kunci storefront.catalog_page_size belum ada sehingga paginate(0) diam-diam memakai 15.
2. Jumlah kartu per halaman dihitung SERVER, sedangkan grid katalog responsif
   (grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5). Server tidak punya
   cara mengetahui lebar layar, jadi satu angka tidak bisa memenuhi 2 kolom (mobile) dan 5 kolom
   (desktop) sekaligus. Percobaan pertama mengganti angka global ke 16, dan itu memang membuat
   desktop ikut berubah, kesalahan yang ditegur owner.

Keputusan owner: mobile 16, desktop 15 (opsi A dari pilihan yang diajukan).

Perubahan:
- config/storefront.php - catalog_page_size tetap 15, ditambah catalog_page_size_mobile = 16.
- app/Http/Controllers/CatalogController.php - method catalogPageSize() membaca query per_page dan
  HANYA menerima dua ukuran resmi itu; nilai lain (mis. 1000) diabaikan sehingga URL tidak bisa
  memaksa pagination raksasa. Kunci cache katalog ikut memuat per_page karena potongan halaman 15
  dan 16 berbeda dan tidak boleh bertukar. Prop baru catalogPageSize: { desktop, mobile } supaya
  klien tidak menebak angka sendiri.
- resources/js/lib/catalog-page-size.ts - fungsi murni resolveCatalogPageSize() (lebar jadi ukuran),
  catalogPageSizeParam() (desktop = default server, jadi parameter tidak dikirim) dan
  clampCatalogPage() (jepit nomor halaman saat jumlah halaman menyusut).
- resources/js/hooks/use-catalog-viewport-width.ts - lebar viewport, awal 0 yang dipetakan ke
  ukuran desktop supaya render pertama sama dengan yang sudah dikirim server.
- resources/js/pages/Public/Catalog.tsx - visit() dan toggleFlash() selalu menyertakan per_page;
  ditambah efek koreksi SEKALI saat halaman dibuka untuk tautan dari luar halaman (menu header,
  Flash Sale, tautan lama, tautan dibagikan) yang tidak membawa per_page. Efek ini konvergen karena
  respons berikutnya sudah membawa ukuran yang cocok.

Verifikasi live di browser:
- Mobile 390px mendarat tanpa parameter: halaman mengoreksi sendiri ke ?per_page=16, 16 kartu, grid
  terhitung 2 kolom dengan 8 baris yang SEMUANYA berisi 2 kartu (tidak ada kartu menggantung).
- Desktop 1440px: 15 kartu, URL tetap bersih tanpa per_page.
- Desktop 1280px membuka ?per_page=16: terkoreksi kembali ke 15 kartu dan parameter dibuang.
- Halaman 2 = 16 kartu; halaman terakhir (9) = 2 kartu dari 130 produk (8 x 16 + 2).
- Tautan pagination membawa per_page=16 (?per_page=16&page=2).
- Catatan alat uji: setViewportSize pada browser in-app TIDAK mengirim event resize, sehingga
  koreksi baru terlihat setelah window.dispatchEvent(new Event('resize')). Browser sungguhan
  mengirim event ini, jadi bukan cacat kode.
- API /api/catalog/windows: 15 kartu; dengan ?per_page=16: 16 kartu; dengan ?per_page=1000: 15.

Test: CatalogPageSizeTest 7 passed (139 assertions; termasuk cache 15/16 tidak bertukar dan
per_page nakal diabaikan), Vitest catalog-page-size.test.ts 10 passed, regresi suite katalog
69 passed (740 assertions) - termasuk CatalogPaginationContractTest milik agent lain yang tetap sah
karena default desktop TIDAK berubah. tsc bersih, eslint bersih untuk berkas yang diubah, build Vite PASS.

### 2026-09-19 - Katalog: ukuran halaman dikenali server dari User-Agent (hapus kedip 15 kartu)
Koreksi owner atas pekerjaan 2026-09-18, verbatim: "pelanggan tentu menggunakan website untuk
testing antar device atau menghitung jumlah card antar perangkat, pelanggan pasti konsisten memakai
satu jenis device tanpa mengatur urutan viewport seperti developer, tolong nalarnya dipakai".

Dua hal yang owner tunjukkan:
1. Caveat "tautan tidak bisa dibagikan lintas perangkat" tidak relevan. Pelanggan memakai satu
   perangkat secara konsisten; mereka tidak mengubah-ubah lebar jendela seperti pengembang. Jadi
   sinyal perangkat tersedia di server dan tidak perlu menunggu JS.
2. Ukuran pengukuran waktu di browser menemukan cacat nyata: di HP, halaman sempat menampilkan 15
   kartu selama sekitar 1,2 detik sebelum permintaan ulang mengubahnya jadi 16. Itu flash of wrong
   content, dan kalau JS lambat atau gagal, pelanggan kembali melihat 15. Verifikasi: jejak kartu
   per 300ms saat mendarat di 390px menunjukkan n=15 pada 300 sampai 1200ms, baru n=16 pada 1500ms.

Perubahan:
- app/Http/Controllers/CatalogController.php - method looksLikePhone() + konstanta
  PHONE_AGENT_MARKERS (iphone, ipod, windows phone, opera mini, opera mobi, iemobile, blackberry,
  dan Android yang memuat "Mobile"). catalogPageSize() kini berurutan: per_page dari klien, lalu
  User-Agent telepon, lalu default desktop. Tablet Android dan iPad sengaja BUKAN telepon: lebarnya
  masuk grid 3 kolom sehingga 15 kartu pas.
- resources/js/pages/Public/Catalog.tsx - efek koreksi diturunkan perannya menjadi JARING PENGAMAN
  untuk kasus yang tidak terlihat User-Agent (jendela desktop dipersempit, telepon diputar ke
  lanskap). Komentarnya diperbarui supaya tidak lagi menyebut "tautan dari luar halaman", karena
  kasus utama itu sudah ditangani server.

Verifikasi live:
- curl dengan User-Agent Android Mobile pada URL bersih: per_page 16, payload awal memuat 16 kartu
  (24 tautan parent_sku termasuk 8 spotlight Flash Sale). Desktop: 15. iPad: 15.
- canonicalUrl tetap bersih tanpa query string, jadi perbedaan ukuran per perangkat tidak
  menimbulkan duplikat konten di mesin pencari.

Test: CatalogPageSizeTest 14 passed (233 assertions), termasuk telepon Android 16 tanpa parameter,
iPhone 16, desktop 15, tablet Android dan iPad 15, User-Agent kosong 15, dan per_page eksplisit
menang atas deteksi User-Agent. Regresi katalog 50 passed (744 assertions). Vitest 10 passed,
tsc bersih, eslint bersih, build Vite PASS.

### 2026-09-19 - Galeri PDP: panah geser foto utama digeser keluar seperti carousel
Laporan owner: "posisinya belum seperti carousel".

Perbandingan terukur sebelum perubahan:
- Carousel (beranda, hero, ModelDetail) memakai `carouselNavBtnClass` di
  carousel-controls.tsx: `md:-left-5` / `md:-right-5`, jadi panah MENGGANTUNG 20px di luar tepi
  track, ukuran 48px, latar hitam 60% bergaris tepi putih.
- Galeri foto utama PDP memakai `left-2.5` / `right-2.5`, jadi panah 40px berada 10px DI DALAM
  tepi gambar. Karena letaknya di dalam area foto, posisinya terasa berbeda dari carousel.

Keputusan owner: OPSI posisi saja. Yang disamakan hanya posisinya, bukan ukuran maupun warnanya.

Perubahan (resources/js/components/public/product-gallery.tsx):
- Panah "Lihat foto sebelumnya": `left-2.5` menjadi `-left-5`.
- Panah "Lihat foto berikutnya": `right-2.5` menjadi `-right-5`.
- Ukuran (40px), warna (`bg-foreground/75`), dan seluruh perilaku hover maupun disabled TIDAK diubah.
- Panah strip thumbnail di halaman yang sama TIDAK diubah karena posisinya sudah menonjol keluar
  (`-left-3.5` / `-right-3.5`).

Verifikasi live di browser (galeri punya 7 media):
- Sebelum: gambar 120..600, panah kiri di 130 (masuk 10px), panah kanan berakhir 590 (masuk 10px).
- Sesudah di 1024px, 1280px, dan 1440px: panah keluar 20px di KEDUA sisi, gambar tetap 480px,
  tidak ada panah yang terpotong tepi layar atau lebar kontainer. Ruang kiri minimum 28px pada
  1024px dan 100px pada 1440px, jadi panah selalu utuh.
- Tidak ada overflow yang memotong: satu-satunya klip leluhur adalah MAIN dengan
  `overflow-x-hidden` yang berada jauh di luar jangkauan panah.

Catatan: tidak ada test atau dokumen yang mengunci kelas posisi panah, jadi perubahan ini murni
tampilan tanpa dampak spec. `npm run typecheck` bersih dan build Vite PASS.

Sekalian di-commit: pekerjaan autoplay video galeri (lib/gallery-video.ts, gallery-video.test.ts,
dan perubahan product-gallery.tsx) yang sebelumnya sudah tercatat di MEMORY namun kodenya masih
di working tree. Test-nya 8 test dan semuanya lolos.

### 2026-09-19 - Galeri PDP: panah terpotong diperbaiki (kontainer pemotong) + ukuran 48px seperti carousel
Laporan owner: "tombol terpotong dan tombol kurang besar, lihat ukuran tombol corousel".

Temuan: perbaikan posisi sebelumnya (`-left-5` / `-right-5`) MENIMBULKAN cacat baru. Panah
diletakkan di dalam `[data-gallery-main]`, dan elemen itu memakai `overflow-hidden` untuk menggeser
track foto. Akibatnya panah yang menonjol keluar tepi foto TERPOTONG oleh induknya. Terukur di
1440px: hanya 20 dari 40px yang terlihat, yaitu separuh tombol.

Kesalahan verifikasi saya sebelumnya: saya memeriksa pemotongan terhadap TEPI LAYAR, bukan terhadap
induk ber-overflow. Panah lolos pemeriksaan itu padahal terpotong oleh kontainernya sendiri.

Perubahan (resources/js/components/public/product-gallery.tsx):
- Panah dikeluarkan dari `[data-gallery-main]` ke pembungkus baru
  `<div className="relative w-full lg:w-[480px] lg:max-w-[480px]">` yang TIDAK memotong. Lebar 480px
  desktop pindah ke pembungkus ini; area media cukup `aspect-square w-full overflow-hidden`.
- Ukuran panah dinaikkan `size-10` (40px) menjadi `size-12` (48px) dan ikon `size-5` menjadi
  `size-6`, MENYAMAI `carouselNavBtnClass` pada breakpoint md/lg (48px). Warna tetap
  `bg-foreground/75` sesuai keputusan owner sebelumnya: yang disamakan ukuran dan posisi, bukan
  gaya warnanya.
- `z-10` dinaikkan ke `z-20` supaya panah tetap di atas hitungan foto (1/7) dan elemen lain.

Verifikasi live (galeri 7 media):
- 1024 sampai 1920px: panah 48x48 utuh, keluar 20px di kedua sisi, `terpotong: false` (diperiksa
  dengan menelusuri SEMUA leluhur ber-overflow dan menghitung irisan kotaknya), tidak menabrak kolom
  info produk (jarak tetap 12px). Area media tetap 480px.
- Fungsi panah: klik berikutnya 1/7 ke 2/7, klik sebelumnya 2/7 ke 1/7 lalu panah kiri menjadi
  disabled dengan opacity 0 seperti sebelumnya.
- Lightbox masih terbuka dari klik foto (dialog dengan aria-label berisi nama produk dan nomor foto).
- Mobile 390px, 640px, 768px, 1023px: panah tetap `display: none` (memang hanya tampil sejak lg),
  hitungan 1/7 tetap di dalam gambar, tidak ada scroll horizontal. Restrukturisasi tidak mengubah
  perilaku ponsel dan tablet.
- Catatan alat uji: klik Playwright ber-timeout karena tab browser tidak aktif di depan sehingga
  requestAnimationFrame tidak berjalan; klik koordinat (cua.click) bekerja dan membuktikan handler
  panah normal. Bukan cacat kode.

Test: vitest galeri dan zoom 28 passed. eslint berkas ini tetap 4 masalah (3 error, 1 warning) sama
seperti sebelum perubahan, jadi tidak ada error baru. tsc bersih, build Vite PASS.

### 2026-09-19 - Toast: bahasa desain diseragamkan tanpa garis, acuan notifikasi langsung admin
Arahan owner: "admin notifikasi live sebenarnya cukup bagus sebagai dasar, tidak perlu stroke/line
yang membingkai toast, yg malah jadi terkesan tua".

Sebelumnya ada EMPAT implementasi notifikasi melayang dengan tiga bahasa desain berbeda: flash
storefront (kartu putih bergaris), flash admin (kartu gelap bergaris, karena panel admin dark-first),
undo keranjang (kartu bergaris merah tegas dengan sudut lebih besar), dan notifikasi langsung admin
(`rounded-xl` gelap dengan `shadow-2xl`, tanpa memperhatikan garis). Tidak ada panduan tertulis sama
sekali, jadi setiap tempat menulis gayanya sendiri.

Perubahan:
- Baru `resources/js/lib/toast.ts` berisi `TOAST_CARD_CLASS` = `rounded-xl border-0 bg-surface
  shadow-2xl`, satu sumber gaya kartu toast. `border-0` WAJIB ada karena komponen Alert membawa
  `border` di kelas dasarnya; tailwind-merge membuat `border-0` menang. Warna teks sengaja TIDAK
  dimasukkan supaya warna per nada dari Alert (success hijau, danger merah) tidak tertimpa.
- `components/shared/flash-messages.tsx` dan `components/admin/ui/flash-messages.tsx` memakai kelas
  itu (sebelumnya `bg-surface shadow-float` dan `bg-card shadow-float`).
- `pages/Public/Cart.tsx` toast undo memakai kelas itu, dan SEKALIAN diperbaiki: kontainernya
  sekarang punya `role="status"` + `aria-live="polite"` + `aria-atomic`. Sebelumnya satu-satunya
  toast di aplikasi yang tidak diumumkan pembaca layar, padahal jendela undo hanya 5 detik.
- `components/admin/live-notification-manager.tsx` sebagai acuan ikut dibersihkan: kartunya menjadi
  `rounded-xl bg-surface text-foreground shadow-2xl` (buang `border border-border` dan `bg-card`),
  dan badge ikon cadangan berganti dari `border border-border` menjadi isian `bg-muted`.
- Ditulis `### Toast dan notifikasi melayang` di frontend/docs/UI-CONSISTENCY-CONTRACT.md: aturan
  tanpa garis, satu kelas kartu, wajib `role="status"` + `aria-live`, posisi kanonik tengah atas
  dengan `z-toast` (60), larangan nilai seperti `z-[9999]`, durasi 4 detik, plus tabel pemakai.
  `COMPONENT-INVENTORY.md` ikut mencatat Toast sebagai primitif.

Verifikasi live (border diukur dari computed style):
- Sukses storefront dan undo keranjang: `border 0px`, radius 16px, latar putih. Undo juga terbukti
  membawa `aria-live="polite"` + `role="status"`.
- Flash admin dan notifikasi langsung admin: `border 0px`, radius 9px, latar gelap `rgb(28,28,33)`.
- Notifikasi langsung admin tetap pada `z-index 9999`; menyatukannya ke `z-toast` belum dikerjakan
  dan tercatat sebagai sisa pekerjaan.

Catatan: untuk memicu notifikasi langsung admin saya menyisipkan notifikasi uji dua kali, dan dua
duanya sudah dihapus. Jumlah notifikasi kembali 30 dengan id tertinggi 52, nol sisa baris uji.

tsc bersih, eslint berkas yang diubah tanpa error (2 warning lama di Cart), build Vite PASS.

### 2026-09-19 - Toast: posisi diturunkan ke bawah chrome halaman (bukan menimpa navbar)
Keluhan owner: "sebenarnya penempatannya benar benar kurang pas, dia ada diatas/ tengah tengah antara
halaman dan navbar".

Diukur di browser sebelum perbaikan, halaman keranjang desktop: header sticky 0 sampai 48px, menu
navigasi 48 sampai 92px, breadcrumb 100 sampai 144px, sedangkan toast berada di 80 sampai 134px.
Jadi toast MEMANG menimpa menu navigasi dan breadcrumb, terlihat mengambang di antaranya. Sebelumnya
posisinya `top-[calc(3rem+0.75rem)]` (60px) dengan `lg:top-20` (80px), hanya mengasumsikan header
48px dan mengabaikan menu navigasi serta breadcrumb.

Keputusan owner: opsi "tetap atas, turun di bawah breadcrumb".

Perubahan:
- `resources/css/app.css`: token baru `--toast-top` = 120px (storefront bawah md), 156px sejak
  min-width 768px, dan 96px di `html.admin-shell`. Nilainya ditulis PIXEL, bukan rem, karena root
  font-size admin 14px sedangkan storefront 16px; versi rem sempat menghasilkan 84px di admin
  (seharusnya 96px) dan ketahuan saat verifikasi.
- Empat pemakai toast memakai `top-[var(--toast-top)]`: flash storefront, toast undo keranjang,
  flash admin, dan notifikasi langsung admin.
- Notifikasi langsung admin sebelumnya `top-4` (16px) sehingga menimpa header admin 49px; sekarang
  ikut variabel dan duduk di 96px.
- Panduan di frontend/docs/UI-CONSISTENCY-CONTRACT.md diperbarui dengan nilai per konteks dan
  alasan pemakaian pixel.

Verifikasi terukur (elemen uji dengan kelas `top-[var(--toast-top)]`, dan toast asli pada uji undo):
- Storefront mobile 390px: header bawah 48px, breadcrumb TIDAK ditampilkan, toast 120px (di bawah
  header, tidak menimpa apa pun).
- Storefront desktop 1280px: breadcrumb bawah 144px, toast 156px, jarak 12px, tidak menimpa
  breadcrumb maupun menu.
- Admin desktop 1280px: header bawah 49px, breadcrumb bawah 84px, toast 96px, jarak 12px.
- Toast undo asli terpotret di 156px dengan breadcrumb berakhir 144px, terlihat utuh di bawahnya.
- tsc bersih, build Vite PASS.

Catatan alat uji: toast yang durasinya 4 detik sering lolos dari penangkapan karena tab browser
tidak aktif di depan sehingga promise di halaman menggantung. Pengukuran akhir memakai elemen uji
berkelas sama untuk mendapat nilai pasti, lalu dikonfirmasi sekali dengan toast undo asli.

### 2026-09-19 - Toast: lebar menyesuaikan isi, ruang kosong dihapus
Arahan owner: "dimensi toast jangan menyisakan space kosong di dalam toast. sesuaikan dengan isi dan
ukuran text, fleksible tiap toast".

Akar masalah: kartu toast diberi `w-full` sehingga selalu selebar kontainernya, sedangkan pesannya
pendek. Terukur di halaman keranjang desktop sebelum perbaikan, pesan "Produk ditambahkan ke
keranjang." memakai kartu 576px padahal teksnya hanya perlu sekitar 270px, jadi ada sekitar 300px
ruang kosong di dalam kartu.

Perubahan:
- Flash storefront dan toast undo keranjang: kartu dari `w-full max-w-xl` menjadi `w-fit max-w-full`.
  Pembungkusnya tetap `max-w-xl` (dinaikkan dari `max-w-lg` supaya pesan panjang tidak membungkus
  terlalu cepat).
- Flash admin: kartu dari tanpa kelas lebar menjadi `mx-auto w-fit max-w-full` supaya kartu yang
  mengecil tetap di tengah.
- Notifikasi langsung admin (acuan): kartu dari `w-fit` + rata kanan (`ml-auto`) supaya tidak lagi
  dipaksa selebar `max-w-sm` saat isinya pendek.
- `lib/toast.ts` mendokumentasikan bahwa lebar SENGAJA tidak diatur di kelas bersama, karena tiap
  pemakai punya batas pembungkus berbeda.

Verifikasi terukur (lebar kartu, bukan lebar kontainer):
- Storefront pesan pendek 330px (sebelumnya 576px), pesan sedang 543px, pesan panjang membungkus
  pada 1265px dengan sisa kanan 16px yang merupakan padding, bukan ruang kosong.
- Toast undo keranjang 339px, terpotret rapi bersama ikon dan tombol Urungkan.
- Flash admin 257px untuk pesan pendek dan 420px untuk pesan panjang, keduanya tetap tepat di
  tengah kontainer.
- Notifikasi langsung admin 312px, sebelumnya dipaksa selebar 360px.
- tsc bersih, build Vite PASS.

Catatan: untuk menguji notifikasi langsung admin saya menyisipkan notifikasi uji dan sudah
menghapusnya. Jumlah notifikasi kembali 30 dengan id tertinggi 52, nol sisa baris uji.
