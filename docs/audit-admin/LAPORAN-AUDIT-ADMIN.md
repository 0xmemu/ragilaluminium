# Audit UI Panel Admin, Laporan Fase A sampai D

Tanggal audit: 23 September 2026
Repo: `/root/ragilaluminium` di server 209, branch `feat/admin-ui-redesign`, commit `a4c6ca33`
Sifat: **read-only**. Tidak ada berkas produksi VPS yang diubah.
Metode: inventaris route otomatis, pemindaian source otomatis, probe live 80 halaman
lewat browser dalam aplikasi dengan akun admin, ditambah verifikasi data ke MySQL 209.

Dokumen pendukung ada di folder yang sama:

| Berkas | Isi |
|---|---|
| `data/coverage-map.json` | inventaris 290 route admin, 118 route baca, 172 route ubah |
| `data/coverage-matrix.md` | tabel 80 surface halaman: menu, state, interaksi, tabel, panduan |
| `data/page-profiles.json` | profil 72 berkas halaman admin |
| `data/static-scan.json` | hasil pemindaian pola di 131 berkas source |
| `snapshot-209/` | salinan beku source admin dari 209 pada commit `a4c6ca33`, dipakai oleh pemindai |
| `screenshots/` | 24 tangkapan layar representatif |

`snapshot-209/` adalah bekuan untuk keperluan audit, bukan tempat kerja. Jangan menyunting
berkas di dalamnya. Kalau repo 209 sudah berubah, tarik ulang snapshot baru lalu jalankan
ulang pemindainya, jangan mengedit snapshot lama.

Cara menjalankan ulang seluruhnya: `node data/build-coverage.mjs`, `node data/profile-pages.mjs`,
`node data/scan-static.mjs`, `node data/build-matrix.mjs`. Dua skrip Python
(`data/extract.py`, `data/extract-methods.py`) dijalankan **di server 209**, karena keduanya
membaca controller langsung dari repo untuk memetakan route ke view. Berkas hasilnya
(`views.json`, `methodviews.json`) sudah tersalin ke `data/` supaya pemindai lokal tetap bisa
jalan tanpa akses server.

---

## 1. Ringkasan eksekutif

Panel admin dalam kondisi **jauh lebih baik daripada yang biasa ditemukan di audit pertama**.
72 berkas halaman, semuanya memakai `AdminLayout`, semuanya punya judul dan deskripsi, dan
tangkap layar mode gelap maupun mode terang sama-sama rapi. Tidak ada halaman yang "bisa
dibuka tapi belum terdesain".

**Satu hal yang perlu diluruskan sejak awal.** Saya sempat menyimpulkan aturan teks paling
keras di repo ini sedang ditegakkan 100 persen. Itu **salah**, dan saya perlu mengoreksinya
sendiri. Pemindaian pertama saya hanya membaca berkas halaman dan komponen, sehingga melaporkan
nol. Setelah memindai seluruh `app`, `resources`, `routes`, dan `config`, ditemukan 159 berkas
mengandung em dash, dan yang lebih penting, ditemukan em dash yang **benar benar tampil di
mata pengguna** dari dua baris data di database. Rinciannya ada di F-15 dan F-16.

Angka ringkas:

| Metrik | Nilai |
|---|---|
| Total route aplikasi | 362 |
| Route admin | 290 |
| Route admin baca (GET) | 118 |
| Route admin ubah (POST/PUT/PATCH/DELETE) | 172 |
| Controller admin | 50 |
| Berkas halaman admin (`tsx`) | 72 |
| View Inertia unik | 63 |
| Route baca yang merender halaman | 80 |
| Surface tercover di coverage matrix | 80 |
| Route baca terjangkau menu | 74 dari 80 (6 sisanya JSON, redirect, atau yatim) |
| Halaman punya tombol Panduan | 30 route dari 88 route halaman |
| Tangkapan layar audit | 24 |
| Temuan P0 | 2 |
| Temuan P1 | 6 |
| Temuan P2 | 8 |
| Temuan P3 | 0 |
| Total temuan | 16 |

Modul paling berisiko: **Media** (satu halaman 500 yang bisa dicapai dari menu), lalu
**Pesanan** (baris tab status terpotong di halaman paling sering dipakai), lalu
**Beranda** dan **Halaman CMS** (dua pohon halaman hidup tanpa pintu masuk menu).

Yang **tidak** ditemukan, dan ini penting untuk dicatat supaya tidak diburu lagi:
tidak ada perhitungan bisnis yang dihitung ulang di frontend pada halaman metrik (aritmetika
yang ada hanya pemformatan angka dari backend), tidak ada `bg-white` di modal, tidak ada data
palsu atau mockup yang tidak tersambung ke service, dan tidak ada halaman tanpa state kosong.

---

## 2. Temuan prioritas

Skor prioritas memakai `Impact x Frequency x Confidence`. Effort dipakai untuk urutan batch,
bukan untuk menurunkan tingkat bahaya.

### F-01, Prioritas P0, Kategori NAVIGATION

| | |
|---|---|
| Skor | 5 x 4 x 5 = 100 |
| Modul/surface | Media, `Admin/Media/Attach` |
| Lokasi | `GET /admin/media/{asset}/attach` |
| Effort | Kecil, 2 baris source |

**Bukti.** Permintaan HTTP mengembalikan 500 dengan catatan produksi
`Route [media.attach] not defined` pada `storage/logs/laravel-2026-09-23.log` baris 17031,
dan `ProductMediaController->attachPage()` pada baris 17035. Tangkapan layar
`screenshots/media-attach-1440-light-error500.png` menampilkan halaman "Gangguan sementara".
30 tautan "Detail" di Media Library mengarah ke halaman ini. Saya klik tautan itu dari
`/admin/media/library` dan browser benar-benar mendarat di halaman 500
(`/admin/media/955/attach`), jadi ini bukan cacat yang tersembunyi.

**Masalah.** Halaman detail media memanggil dua nama route yang tidak ada. Route sebenarnya
bernama `admin.media.attach` dan `admin.media.assets.destroy`, sedangkan controller memanggil
`media.attach` dan `media.assets.destroy` (tanpa awalan `admin.`). Penyebabnya, semua route
admin didaftarkan di dalam grup `->name('admin.')`, sehingga nama lengkapnya selalu berawalan
`admin.`. Halaman ini menangkap galat setelah menyusun props, jadi yang muncul adalah
halaman 500 penuh, bukan 404.

**Dampak.** Setiap admin yang menekan ikon "Detail" pada sebuah aset media mendapat halaman
galat. Alur memeriksa "media ini dipakai di produk mana" mati total, dan itu satu-satunya
cara melihat pemakaian sebuah aset.

**Rekomendasi.** Ganti dua pemanggilan di `app/Http/Controllers/Admin/ProductMediaController.php`
baris 247 dan 249 menjadi berawalan `admin.`. **Jangan mengubah nama route di `routes/web.php`**,
karena nama itu dipakai berkas lain. Pemetaan lengkapnya: baris 247 `route('media.attach', $asset)`
seharusnya `route('admin.media.attach', $asset)`, baris 249
`route('media.assets.destroy', $asset)` seharusnya `route('admin.media.assets.destroy', $asset)`.

**Test yang diperlukan.** Test rute yang menegaskan setiap nama route yang dipanggil dari
controller admin benar-benar terdaftar, bukan sekadar test halaman ini. Pemindaian repo
menemukan hanya dua pelanggaran seperti ini, jadi penjaga yang benar-benar menutup kelas
kesalahannya berukuran kecil.

---

### F-02, Prioritas P0, Kategori ACCESSIBILITY

| | |
|---|---|
| Skor | 5 x 2 x 5 = 50 |
| Modul/surface | Beranda Tata Letak (`Admin/Beranda/Index`), Halaman CMS (`Admin/ResourceIndex`) |
| Lokasi | Tombol Panduan di `resources/js/layouts/admin-layout.tsx` baris 297 |
| Effort | Kecil, satu berkas |

**Bukti.** Tombol "Panduan" diposisikan `absolute right-4 top-[30px]`. Karena ia tidak ikut
arus tata letak, ia melayang di atas tombol aksi header. Pada `/admin/beranda` tombol
"Simpan" tertimpa, dan `document.elementFromPoint` pada titik tengahnya mengembalikan tombol
Panduan, bukan tombol Simpan. Artinya tombol itu **tidak bisa diklik**. Pada `/admin/pages`
hal yang sama terjadi pada tombol "Tambah". Tangkapan layar
`screenshots/beranda-orphan-1440-light-collision.png` dan
`screenshots/cms-pages-orphan-1440-light-collision.png` menunjukkan tombol hitam kebiruan
yang tertutup sebagian. Pada `/admin/settings` tombol yang tertimpa adalah teks
"Pemeriksaan terakhir", lihat `screenshots/settings-system-health-1440-dark-collision.png`.

**Masalah.** Dua elemen bersaing untuk sudut kanan atas yang sama, dan karena Panduan memakai
`position: absolute` ia selalu menang. Pemicunya adalah baris aksi header yang cukup panjang
sehingga melebar ke kanan, bukan lebar layar tertentu.

**Dampak.** Aksi utama halaman tidak dapat dijalankan lewat klik. Admin harus tahu cara
menyiasatinya (misalnya menekan Enter di field, atau memperbesar jendela), dan tidak ada
petunjuk apa pun bahwa tombolnya tertutup.

**Rekomendasi.** Turunkan Panduan dari `absolute` menjadi elemen biasa di dalam baris
breadcrumb, atau beri ruang tetap pada wadah aksi header sehingga keduanya tidak bisa
bertumpuk. Menambah `shrink-0` pada kedua sisi saja tidak cukup, karena akar masalahnya
adalah posisi absolut, bukan penyusutan.

**Test yang diperlukan.** Test tata letak yang memeriksa setiap halaman admin: untuk setiap
tombol aksi header, `elementFromPoint` pada titik tengahnya harus mengembalikan tombol itu
sendiri atau keturunannya.

---

### F-03, Prioritas P1, Kategori TABLE_LIST

| | |
|---|---|
| Skor | 4 x 5 x 5 = 100 |
| Modul/surface | Pesanan, `Admin/Orders/Index` |
| Lokasi | Baris tab status di atas tabel pesanan |
| Effort | Sedang |

**Bukti.** Diukur langsung di browser pada dua lebar layar. Baris tab punya lebar isi 1089px
sedangkan wadahnya hanya 884px pada layar 1440px, jadi **205px isinya berada di luar pandangan**.
Tab terakhir yang terlihat, "Retur Selesai", terpotong. Satu tab, "Perlu Perhatian", sepenuhnya
tersembunyi. Wadahnya memang `overflow-x-auto`, tetapi kelas `scrollbar-none` menyembunyikan
bilah gulir, sehingga tidak ada tanda apa pun bahwa masih ada tab di sebelah kanan.
Tangkapan layar `screenshots/orders-index-1280-light-clippedtabs.png` menunjukkan baris
terpotong tepat setelah tab Dikirim pada layar 1280px.

**Masalah.** Dua belas tab status ditempatkan dalam satu baris yang tidak muat, dengan
petunjuk gulir yang dimatikan.

**Dampak.** Admin tidak akan pernah tahu ada tab "Perlu Perhatian" dan "Retur Selesai". Filter
yang tidak terlihat sama saja dengan filter yang tidak ada. Ini terjadi di halaman yang paling
sering dibuka admin.

**Catatan penting.** Angka pada tab sudah saya cocokkan dengan database dan **akurat**:
menunggu konfirmasi 5, diproses 10, sampai 2, selesai 1, dibatalkan 2, jumlahnya persis
seperti tampilan tab. Jadi masalahnya murni tata letak, bukan data.

**Rekomendasi.** Pilihan yang masuk akal: pindahkan tab yang jarang dipakai (Retur Diproses,
Retur Selesai, Perlu Perhatian) ke menu "Lainnya" di ujung baris, atau biarkan dua baris, atau
tampilkan bilah gulir tipis sebagai petunjuk. Jangan mengandalkan gulir horizontal tersembunyi.

---

### F-04, Prioritas P1, Kategori NAVIGATION

| | |
|---|---|
| Skor | 4 x 4 x 5 = 80 |
| Modul/surface | Beranda (Antrean tindakan), WhatsApp Hub |
| Lokasi | `DashboardController.php` baris 305 sampai 307 |
| Effort | Kecil |

**Bukti.** Dashboard menampilkan kartu "Pesan WhatsApp Gagal" bernilai 26. Kartu itu menautkan
ke `route('admin.whatsapp.templates.index')`. Halaman WhatsApp Hub default menampilkan rentang
7 hari, dan di rentang itu angkanya **0** (terlihat pada
`screenshots/whatsapp-hub-1440-dark-success.png`: "Gagal Terkirim (7 Hari) 0").
Verifikasi database: 26 pesan gagal sepanjang waktu, **0** dalam 7 hari terakhir, pesan gagal
tertua berumur 44 hari, 22 di antaranya terhubung ke pesanan dan 4 tidak.

**Masalah.** Angka di dashboard memakai cakupan sepanjang waktu, sedangkan halaman tujuannya
memakai cakupan 7 hari. Ditambah lagi, halaman tujuan itu adalah daftar template pesan, bukan
daftar pesan gagal, sehingga tidak ada satu pun tempat di panel admin yang benar-benar
menampilkan 26 pesan gagal itu.

**Dampak.** Admin menekan angka 26, mendarat di halaman yang menampilkan 0, dan menyimpulkan
sistem salah atau datanya hilang. Tindak lanjut nyata (mengirim ulang pesan yang gagal) tidak
punya tujuan.

**Rekomendasi.** Pilih satu dari dua arah dan nyatakan mana yang dipilih, karena ini menyentuh
cakupan metrik yang tidak boleh diubah diam diam. Arah pertama: angka dashboard ikut dibatasi
ke cakupan yang sama dengan halaman tujuan, jadi konsisten sejak awal. Arah kedua: sediakan
daftar pesan gagal sepanjang waktu sebagai tujuan kartu, misalnya tab pada WhatsApp Hub
dengan filter `status=failed`. Saya condong ke arah kedua karena pesan gagal berumur 44 hari
justru yang paling perlu ditindaklanjuti.

**Keputusan owner diperlukan.** Lihat D-4.

---

### F-05, Prioritas P1, Kategori SECURITY_PERMISSION

| | |
|---|---|
| Skor | 4 x 3 x 5 = 60 |
| Modul/surface | Seluruh panel |
| Lokasi | `resources/js/components/admin/ui/permission-denied.tsx` |
| Effort | Sedang |

**Bukti.** Komponen `PermissionDeniedState` sudah ditulis lengkap dengan teks dan ikon, tetapi
**tidak dipakai di satu halaman pun**. Pemindaian 131 berkas menemukan nol pemakaian di luar
berkas definisinya sendiri. Kapabilitas admin sendiri sudah ada dan dipakai untuk menyembunyikan
menu (`can()` dan `useAdminCapabilities` pada `admin-navigation.tsx`), jadi sistem izinnya hidup,
hanya permukaan "aksemu ditolak" yang belum pernah dipakai.

**Masalah.** Menu yang tidak diizinkan disembunyikan, tetapi halaman yang dibuka langsung lewat
URL tidak punya permukaan sendiri. Yang muncul adalah halaman 403 global, yang isinya memakai
tata letak yang sama dengan 404 dan hanya menawarkan "Ke Dashboard" atau "Daftar pesanan".

**Dampak.** Admin yang membuka tautan dari rekan kerja dan ditolak tidak tahu apakah ia kurang
hak akses atau salah alamat. Dua keadaan berbeda itu diberi wajah yang sama.

**Rekomendasi.** Pakai `PermissionDeniedState` pada halaman yang memerlukan kapabilitas
tertentu, dan bedakan pesan 403 dari 404. Sebelum itu, perlu keputusan owner soal halaman mana
yang boleh dibaca terbatas versus disembunyikan sepenuhnya. Lihat D-6.

---

### F-06, Prioritas P1, Kategori TABLE_LIST

| | |
|---|---|
| Skor | 3 x 5 x 5 = 75 |
| Modul/surface | 34 halaman daftar |
| Lokasi | `resources/js/components/admin/ui/table.tsx` |
| Effort | Besar |

**Bukti.** Dari 72 berkas halaman, **34 menulis elemen `<table>` sendiri**, dan hanya 6 yang
memakai komponen tabel bersama. Halaman Penjualan/Pelanggan memang tampak rapi, tetapi
perataan angka, bobot huruf header, dan perilaku pada layar sempit ditentukan ulang di
masing masing halaman.

**Masalah.** Tidak ada satu tabel bersama yang dipakai mayoritas. Konsistensi yang terlihat
sekarang adalah hasil kerja manual yang kebetulan seragam, bukan hasil satu sumber.

**Dampak.** Setiap perbaikan tabel harus dikerjakan 34 kali. Perbedaan kecil sudah mulai
terlihat, misalnya penulisan header yang menggunakan huruf besar semua di sebagian halaman
dan tidak di halaman lain.

**Rekomendasi.** Ini pekerjaan besar dan tidak mendesak untuk dikerjakan sekaligus. Urutan
yang saya sarankan: pilih tiga halaman yang paling sering dipakai (Pesanan, Produk, Pelanggan)
sebagai contoh migrasi, kunci primitifnya, baru sebar bertahap. Jangan kerjakan 34 halaman
dalam satu batch tanpa contoh yang disepakati lebih dulu.

---

### F-07, Prioritas P1, Kategori NAVIGATION

| | |
|---|---|
| Skor | 3 x 2 x 5 = 30 |
| Modul/surface | Beranda Tata Letak, Halaman CMS |
| Lokasi | `/admin/beranda`, `/admin/pages` |
| Effort | Kecil untuk memutuskan, sedang untuk mengerjakan |

**Bukti.** Kedua pohon halaman hidup dan bisa diakses langsung, mengembalikan 200, dan punya
controller sendiri, tetapi tidak satu pun item menu mengarah ke sana. Pencarian menyeluruh di
seluruh `resources/js`, `app`, dan `routes` menemukan nol tautan masuk selain tautan "Batal"
di dalam halamannya sendiri. Riwayat git menunjukkan menu "Tata Letak Beranda" pernah dibuang
pada commit `10e813b9`, pernah dikembalikan pada `586c687c`, dan dibuang lagi, jadi ini sudah
dua kali bolak balik.

Halaman `/admin/beranda` mengatur on/off banner dan teks "Cara Pesan" yang dibaca beranda
publik, keterangan di controller menyebutnya "Kelola urutan section dan konten yang tampil di
halaman utama toko". Halaman `/admin/pages` menampilkan 15 baris CMS, dan antar mukanya
**tumpang tindih** dengan menu "Dokumen Halaman" yang mengarah ke konten yang sama.

**Dampak.** Dua hal berbeda. Pertama, ada pengaturan hidup yang tidak punya pintu masuk, jadi
perubahan pada beranda publik hanya bisa dilakukan oleh orang yang tahu URL-nya. Kedua,
halaman CMS yang tidak terpakai membingungkan saat nanti ada yang menemukannya lewat pencarian
menu.

**Rekomendasi.** Jangan hapus dulu. Ini perlu keputusan owner karena menyangkut konten publik
yang sedang dipakai. Lihat D-1 dan D-2.

---

### F-08, Prioritas P2, Kategori COPY_TERMINOLOGY

| | |
|---|---|
| Skor | 2 x 4 x 5 = 40 |
| Modul/surface | 35 dari 63 view |
| Lokasi | `resources/js/components/admin/page-guide.tsx` baris 52 sampai 56 |
| Effort | Kecil |

**Bukti.** Tombol Panduan dirender di header halaman tanpa memeriksa apakah panduannya ada.
Bila tidak ada, dropdownnya berisi kalimat "Panduan untuk halaman ini belum tersedia".
Daftar panduan memuat 30 route, sedangkan route halaman ada 88, sehingga **35 view atau sekitar
separuh halaman** menampilkan tombol yang isinya hanya kalimat kosong itu.

**Masalah.** Kontrol yang selalu ada tetapi sering tidak berguna. Komentar di berkas sumber
bahkan menyatakan "halaman tanpa panduan terdaftar tidak menampilkan tombol", padahal perilaku
kodenya justru sebaliknya. Jadi ada perbedaan antara niat yang tertulis dan perilaku nyata.

**Rekomendasi.** Sembunyikan tombol bila `adminPageGuides[routeName]` tidak ada, supaya sesuai
dengan yang sudah diniatkan. Setelah itu putuskan apakah separuh halaman sisanya memang perlu
panduan atau tidak. Lihat D-5.

---

### F-09, Prioritas P2, Kategori COPY_TERMINOLOGY

| | |
|---|---|
| Skor | 2 x 4 x 5 = 40 |
| Modul/surface | 22 halaman |
| Lokasi | Contoh: `TentangKami/Edit.tsx`, `StorefrontPlatforms/Edit.tsx`, `Customers/Index.tsx` |
| Effort | Kecil |

**Bukti.** Pemindaian menemukan 75 pemakaian kelas `uppercase` atau `tracking-wider` pada 34
berkas. Yang paling padat: `TentangKami/Edit.tsx` 15 kali, `StorefrontPlatforms/Edit.tsx`
5 kali, `Customers/Index.tsx` 5 kali. Contoh nyata: judul kartu di
`StorefrontPlatforms/Edit.tsx` baris 143 memakai `text-xs font-semibold uppercase
tracking-wider text-foreground`.

**Masalah.** Kontrak domain panel admin melarang teks sekunder huruf besar semua untuk judul
kartu analitik: "Dilarang all-caps `uppercase tracking-wider`", dan mewajibkan Title Case
`font-medium text-muted-foreground`. Aturan itu tertulis khusus untuk Performa Toko, tetapi
pemakaiannya menyebar ke halaman lain tanpa keputusan.

**Dampak.** Dua jenis judul kartu hidup berdampingan di panel yang sama. Pada layar kecil
huruf besar semua dengan pelacakan lebar lebih sulit dibaca.

**Rekomendasi.** Putuskan lebih dulu apakah larangan itu berlaku seluruh panel atau hanya
Performa Toko, lalu kerjakan sekali jadi. Ini keputusan owner karena menyangkut standar visual,
bukan sekadar kode. Lihat D-8. Pelajaran dari repo ini: mengoreksi satu pola dua kali membuat
owner marah, jadi konvensinya harus ditetapkan lengkap baru dikerjakan.

---

### F-10, Prioritas P2, Kategori NAVIGATION

| | |
|---|---|
| Skor | 2 x 3 x 5 = 30 |
| Modul/surface | 10 lokasi di 6 berkas |
| Lokasi | Contoh: `Announcements/Index.tsx` baris 175, `Banners/Index.tsx` baris 179 |
| Effort | Kecil |

**Bukti.** `router.get("/admin/announcements", ...)`, `router.get("/admin/banners", ...)`,
`endpoint="/admin/promotions/products"`, `href="/admin/whatsapp/pairing"`, dan enam lainnya
menuliskan alamat admin sebagai teks biasa, bukan lewat `routeUrl()`.

**Masalah.** Alamat halaman tertanam di kode. Halaman lain di repo yang sama sudah memakai
`routeUrl()`, jadi konvensinya ada, hanya tidak dipatuhi di sini.

**Dampak.** Bila slug berubah, seperti yang sudah pernah terjadi pada promo dan voucher,
tautan ini rusak tanpa peringatan dari typecheck. Voucher sendiri sudah pernah berpindah dari
`/admin/vouchers` ke `/admin/promotions/vouchers` dan menyisakan route pengalihan.

**Rekomendasi.** Ganti sepuluh pemakaian itu dengan `routeUrl()`. Ini pekerjaan mekanis dan
aman, cocok digabung ke batch konsistensi.

---

### F-11, Prioritas P2, Kategori RESPONSIVE

| | |
|---|---|
| Skor | 2 x 3 x 5 = 30 |
| Modul/surface | Pesanan, Produk |
| Effort | Kecil |

**Bukti.** Pada layar 1280px, placeholder pencarian Pesanan "Cari nomor order, nama penerima,
no. HP, provinsi, kota..." terpotong menjadi "Cari nomor order, nama penerima, no. HP".
Tabel Produk juga melebar melebihi wadahnya (isi 1091px pada wadah 997px).

**Masalah.** Kolom pencarian dan penyaring berebut ruang pada layar 1280, dan teks bantuan
input terpotong. Pada layar 1440 masalahnya tidak muncul, jadi ini khusus layar 1280.

**Dampak.** Ringan. Admin tetap bisa mencari, tetapi petunjuk "bisa dicari pakai provinsi dan
kota" menjadi tidak terbaca, padahal itu informasi berguna.

**Rekomendasi.** Pendekkan placeholder atau biarkan kolom pencarian melebar pada barisnya
sendiri di bawah 1360px.

---

### F-12, Prioritas P2, Kategori HIERARCHY

| | |
|---|---|
| Skor | 2 x 3 x 4 = 24 |
| Modul/surface | 8 halaman |
| Effort | Kecil sampai sedang |

**Bukti.** Delapan halaman tidak melewatkan aksi apa pun ke header: `InstallationGallery/Show`,
`Media/Attach`, `Media/Index`, `Notifications`, `Orders/Show`, `PromotionOverview`,
`WhatsApp/Index`, dan `Admin/Error`. Sebagian memang beralasan, misalnya `Orders/Show` yang
aksi utamanya berupa baris tombol di bawah kartu ringkasan, dan `Admin/Error` yang hanya punya
tombol navigasi. Tetapi `PromotionOverview` dan `WhatsApp/Index` adalah halaman kerja biasa.

**Catatan kejujuran.** Tingkat keyakinan saya di sini 4, bukan 5, karena sebagian dari delapan
halaman itu kemungkinan memang sengaja tanpa aksi header. Ini perlu dilihat satu per satu,
bukan diperbaiki borongan.

**Rekomendasi.** Periksa dua halaman yang paling mungkin bermasalah (`PromotionOverview`,
`WhatsApp/Index`), lalu putuskan sisanya.

---

### F-13, Prioritas P2, Kategori STATE_EMPTY_LOADING_ERROR

| | |
|---|---|
| Skor | 3 x 3 x 5 = 45 |
| Modul/surface | Seluruh panel |
| Lokasi | `resources/js/components/admin/ui/empty-state.tsx` baris 36 |
| Effort | Sedang |

**Bukti.** `ErrorState` didefinisikan di dalam `empty-state.tsx` dan **tidak dipakai di satu
halaman pun**. Sebaliknya, `EmptyState` dipakai di 28 halaman. Jadi permukaan "tidak ada data"
sudah mapan, sedangkan permukaan "gagal memuat" belum pernah dipakai.

**Masalah.** Bila permintaan data gagal, halaman tidak punya wajah khusus untuk keadaan itu,
sehingga yang muncul bisa berupa tabel kosong yang terlihat sama dengan "tidak ada data".
Perbedaan antara "kosong" dan "gagal" hilang.

**Dampak.** Admin bisa mengira data hilang padahal hanya gagal memuat, atau sebaliknya
mengira tidak ada data padahal ada masalah server.

**Rekomendasi.** Pakai `ErrorState` pada halaman daftar utama, mulai dari Pesanan, Produk,
Pelanggan, dan Impor. Pastikan teksnya membedakan "belum ada data" dari "gagal memuat data".

---

### F-14, Prioritas P2, Kategori FORM

| | |
|---|---|
| Skor | 3 x 3 x 4 = 36 |
| Modul/surface | 13 route hapus |
| Effort | Sedang |

**Bukti.** Ada 13 route `DELETE` (hapus pengumuman, banner, FAQ, kategori, produk, media, log
media, balasan ulasan, dan lain lain). `ConfirmAction` dipakai di 29 berkas, jadi konfirmasi
sudah menjadi kebiasaan, tetapi tidak ada penjaga otomatis yang memastikan setiap aksi hapus
melewatinya.

**Catatan kejujuran.** Tingkat keyakinan 4 karena saya memverifikasi keberadaan komponen
konfirmasi dan jumlah aksi hapus, bukan memasangkan keduanya satu per satu. Perlu pemeriksaan
per route sebelum menyimpulkan ada yang bocor.

**Rekomendasi.** Telusuri 13 route hapus dan pastikan masing masing punya konfirmasi yang
menyebut nama objek yang dihapus.

---

### F-15, Prioritas P1, Kategori COPY_TERMINOLOGY

| | |
|---|---|
| Skor | 3 x 2 x 5 = 30 |
| Modul/surface | Halaman publik Cara Pemesanan, Notifikasi admin |
| Lokasi | Baris data `cms_pages` id 12, dan `admin_notifications` id 8 |
| Effort | Kecil, tetapi menyentuh data |

**Bukti.** Em dash adalah karakter terlarang di seluruh teks repo ini, aturannya ditulis
dengan huruf besar semua dan pernah ditegaskan owner secara verbatim. Saya mengukur teks yang
benar benar tampil di browser pada 29 halaman admin, dan menemukan satu kebocoran nyata:
kartu notifikasi `/admin/notifications` berbunyi "WhatsApp terputus [em dash] sesi logout"
(karakter yang dimaksud adalah U+2014, sengaja saya tulis sebagai kode agar laporan ini sendiri
tidak memuatnya). Sumbernya
bukan kode, melainkan **baris lama di tabel `admin_notifications` id 8**. Kode yang membuat
notifikasi itu sekarang sudah benar memakai tanda hubung, jadi ini sisa data sebelum
perbaikan. Notifikasi id 17 adalah versi barunya yang sudah benar.

Kebocoran kedua ada di **halaman publik**: `/cara-pemesanan` menampilkan kalimat
"Untuk COD, tidak perlu konfirmasi [U+2014] pesanan langsung diproses." Em dash itu berasal dari
baris `cms_pages` id 12 yang berstatus terbit. Ini teks yang dibaca calon pembeli, bukan
teks internal.

**Masalah.** Aturan em dash ditegakkan sepenuhnya di kode, tetapi tidak di data. Semua perbaikan
teks selama ini menyunting kode dan melewatkan isi database, padahal untuk halaman CMS dan
notifikasi, database adalah sumber kebenaran yang tampil ke pengguna.

**Dampak.** Teks berhadapan pelanggan melanggar aturan yang paling keras di repo ini. Karena
letaknya di data, mengedit kode tidak akan pernah menghilangkannya, dan penjaga gaya kode
tidak akan pernah menangkapnya.

**Rekomendasi.** Perbaiki dua baris data itu lewat editor admin, bukan lewat SQL langsung,
supaya riwayat perubahan tercatat. Lalu tambahkan pemindai berkala yang membaca kolom teks
yang tampil ke pengguna dan melaporkan em dash, karena penjaga berbasis kode tidak menjangkau
wilayah ini. Sebelum memutuskan cakupan pemindainya, perlu keputusan owner. Lihat D-9.

---

### F-16, Prioritas P2, Kategori COPY_TERMINOLOGY

| | |
|---|---|
| Skor | 1 x 4 x 5 = 20 |
| Modul/surface | Seluruh repo, 159 berkas |
| Effort | Besar bila dikejar semua, kecil bila dibatasi |

**Bukti.** Pemindaian `app`, `resources`, `routes`, `config`, `database`, dan `tests` menemukan
159 berkas mengandung em dash. Di dalam lingkup panel admin sendiri ada dua baris komentar yang
melanggar: `InstallationGalleryController.php` baris 36 dan `ProductMediaController.php`
baris 155. Sisanya tersebar di komentar kode, dokumentasi konfigurasi, header blok di berkas
`config`, dan berkas cadangan `*.bak-*`.

**Catatan penilaian.** Saya menilai temuan ini P2 dan bukan P1 justru karena mayoritasnya
komentar kode, dan owner sendiri pernah mengoreksi dua kali untuk satu pola visual, jadi
mengejar 159 berkas sekaligus berisiko besar terhadap manfaatnya. Aturan tertulis memang
menyebut komentar kode termasuk sasaran larangan, jadi ini tetap pelanggaran kontrak, hanya
bukan pelanggaran yang terlihat pengguna.

**Rekomendasi.** Batasi perbaikan pada berkas yang aktif dipakai saja, dua komentar di
controller admin itu masuk di dalamnya. Berkas `*.bak-*` sebaiknya tidak dihitung sama sekali
karena itu arsip, bukan kode hidup.

---

## 3. Pattern scorecard

Nilai di bawah dihitung dari 72 berkas halaman, bukan dari kesan visual.

| Pola | Tercover | Dari | Nilai | Catatan |
|---|---|---|---|---|
| Shell halaman (AdminLayout) | 72 | 72 | A | Semua halaman memakai layout bersama |
| Judul dan deskripsi halaman | 72 | 72 | A | Tidak ada halaman tanpa keterangan |
| Tombol aksi di header | 64 | 72 | B | 8 halaman tanpa aksi header, sebagian beralasan |
| Daftar berpenyaring (ListToolbar) | 21 | 80 | C | Banyak daftar menyusun penyaring sendiri |
| Paginasi | 17 | 80 | C | Hanya halaman yang benar benar perlu |
| State kosong (EmptyState) | 28 | 72 | B | Pola sudah mapan |
| State galat (ErrorState) | 0 | 72 | F | Primitif ada, tidak dipakai sama sekali |
| State izin ditolak | 0 | 72 | F | Primitif ada, tidak dipakai sama sekali |
| Konfirmasi aksi (`ConfirmAction`) | 24 | 72 | B | 29 berkas memakai, perlu audit per aksi hapus |
| Tabel bersama | 6 | 34 | D | 34 halaman menulis tabel sendiri |
| Dialog | 9 | 72 | C | |
| Drawer atau side sheet | 3 | 72 | C | Drawer lacak pesanan bekerja baik |
| Pencarian | 35 | 72 | B | |
| Penyaring | 47 | 72 | A | |
| Pengurutan | 27 | 72 | B | |
| Aksi massal | 4 | 72 | D | Hanya sebagian daftar punya |
| Unggah | 38 | 72 | A | Termasuk pemilih media yang dipakai berulang |
| Unduh atau ekspor | 8 | 72 | B | Sesuai kebutuhan, tidak semua halaman perlu |
| Formulir (`useForm`) | 38 | 72 | A | Halaman form memakai pola yang sama |
| Primitif field (ADR-022) | 32 | 38 | B | Belum semua form memakai `FieldGrid` |
| Petunjuk hover (`HintTip`) | 1 | 80 | F | Hampir tidak dipakai |

Pola yang sudah bagus dan layak jadi contoh: **shell halaman**, **state kosong**, **formulir**,
dan **penyaring**. Pola yang paling perlu dibenahi: **state galat dan izin**, **tabel bersama**,
dan **petunjuk hover**.

---

## 4. Halaman yang sudah baik, layak jadi acuan

Ini bukan daftar pelengkap. Halaman halaman ini sudah memenuhi pola dan sebaiknya dipakai
sebagai contoh saat memperbaiki yang lain.

| Halaman | Kenapa layak jadi acuan |
|---|---|
| `Admin/Orders/Index` | Grid 7 kolom sesuai kontrak, chip penyaring aktif, state kosong dengan tombol Reset Filter, ekspor yang **mempertahankan penyaring** (terbukti: `/admin/orders/export?order_status=delivered`), drawer lacak pesanan yang bersih |
| `Admin/Products/Index` | Tab Produk, Kategori, Model, Sub Model; penyaring lengkap; jumlah hasil terlihat; perataan kolom angka tegak |
| `Admin/Customers/Index` | Kartu ringkasan di atas tabel, tabel rapi, alamat panjang dibungkus dengan benar |
| `Admin/Dashboard` | Kartu KPI dengan pembanding, Antrean tindakan yang bisa diklik, tabel pesanan terbaru dengan aksi WhatsApp langsung |
| `Admin/SystemHealth` | Kartu metrik server, grafik riwayat, pemilih rentang waktu yang jelas, satuan menempel pada nilai |
| `Admin/WhatsApp/Hub` | Tab Ringkasan, Template Pesan, Sambungkan Nomor; kartu status koneksi |
| `Admin/ProductForm` (tambah dan edit) | Aksi Simpan dan Simpan draf di header, section memakai skala padding seragam, grid field lurus |
| `Admin/Media/Library` | Pohon folder bertingkat, penyaring, tampilan kisi dan daftar, pilihan massal dengan petunjuk |
| `Admin/Error` | 403, 404, 500, dan 503 punya teks sendiri yang jelas dan konsisten |
| `Admin/Imports/Index` dan `ImportShow` | Riwayat impor dengan status, baris gagal bisa diunduh |
| `Admin/ActivityLogs/Index` | Tab kategori, penyaring, ekspor, status berwarna konsisten |

Empat hal yang berlaku menyeluruh dan patut dipertahankan: **nol em dash** di seluruh source
admin, **mode terang "Cool Slate"** tanpa nuansa krem, **mode gelap** tanpa teks hantu, dan
**tidak ada perhitungan bisnis** yang dihitung ulang di frontend (aritmetika yang ditemukan
hanya pemformatan tampilan).

---

## 5. Roadmap batch perbaikan

Disusun menurut ketergantungan, bukan menurut urutan menu. Setiap batch boleh besar, yang
penting checkpoint di ujungnya bukan pembatasan waktu.

### Batch 0, perbaikan sistem bersama

1. F-01, ganti dua nama route di `ProductMediaController` menjadi berawalan `admin.`.
2. F-02, turunkan tombol Panduan dari posisi absolut.
3. F-15 sisi admin, perbaiki notifikasi id 8 lewat antarmuka admin.
4. Tambahkan dua penjaga test: satu untuk nama route yang dipanggil controller, satu untuk
   tombol header yang tidak boleh tertimpa.

Alasan Batch 0 dikerjakan lebih dulu: F-01 adalah satu satunya halaman 500, F-02 mekanismenya
menyentuh layout yang dipakai seluruh panel, dan keduanya harus beres sebelum pekerjaan visual
lain dimulai.

Checkpoint: kedua test penjaga hijau, tidak ada halaman 500 yang bisa dicapai dari menu, dan
notifikasi admin bersih dari em dash.

### Batch 1, P0 dan data, izin, serta state kritis

5. F-03, rapikan baris tab status Pesanan.
6. F-04, samakan cakupan angka WhatsApp gagal dengan halaman tujuannya, setelah keputusan D-4.
7. F-05, pasang `PermissionDeniedState` dan bedakan 403 dari 404, setelah keputusan D-6.
8. F-15 sisi publik, bersihkan konten CMS dari em dash, setelah keputusan D-9.

Checkpoint: halaman Pesanan tidak lagi menyembunyikan tab, kartu Antrean tindakan tidak lagi
menuju halaman bernilai nol, 403 punya wajah sendiri, dan halaman publik bebas em dash.

### Batch 2, halaman yang paling sering dipakai

9. F-13, pasang `ErrorState` pada Pesanan, Produk, Pelanggan, Impor.
10. F-11, rapikan kolom pencarian pada layar 1280.
11. F-14, telusuri 13 route hapus dan pastikan konfirmasinya lengkap.

Checkpoint: perbedaan "kosong" dan "gagal" terlihat jelas di empat halaman utama.

### Batch 3, konsistensi tabel, drawer, dan penyaring

12. F-06, migrasi tabel bersama dengan tiga halaman contoh lebih dulu (Pesanan, Produk,
    Pelanggan), lalu kunci primitifnya baru sebar bertahap.
13. F-10, ganti sepuluh alamat admin yang ditulis sebagai teks menjadi `routeUrl()`.
14. F-12, tinjau delapan halaman tanpa aksi header, putuskan mana yang memang sengaja.

Checkpoint: primitif tabel disepakati dan tiga halaman contoh lulus, sebelum menyentuh 31
halaman sisanya.

### Batch 4, P2 polish visual dan copy

15. F-09, terapkan keputusan huruf besar semua secara menyeluruh, sekali jadi, setelah D-8.
16. F-08, sembunyikan tombol Panduan saat panduannya belum ada, setelah D-5.
17. F-16, bersihkan em dash di komentar kode yang aktif dipakai saja.
18. Rapikan sisa judul kartu agar skalanya seragam.

### Batch 5, enhancement

19. F-07, putuskan nasib dua halaman yatim lalu kerjakan, setelah D-1 dan D-2.
20. Tambah panduan halaman untuk view yang memang perlu, sesuai D-5.
21. Tambah `HintTip` pada metrik yang sering ditanya, mulai dari Performa Toko yang baru
    memakai satu.

---

## 6. Keputusan owner yang diperlukan

Delapan keputusan ini tidak boleh saya ambil sendiri karena menyentuh kontrak data, standar
visual, atau konten publik yang sedang dipakai.

**D-1. Halaman CMS (`/admin/pages`) dan Dokumen Halaman, digabung atau dibiarkan dua?**
Keduanya menampilkan 15 baris CMS yang sama dari sudut berbeda. Menu "Dokumen Halaman" sekarang
yang terdaftar, sedangkan `/admin/pages` hidup tanpa pintu masuk. Pilihan: gabung ke satu
halaman, atau kembalikan menu `/admin/pages` dan bedakan fungsinya dengan jelas.

**D-2. Pengaturan Tata Letak Beranda (`/admin/beranda`), dipulihkan menunya atau halamannya
yang dipensiunkan?**
Halaman ini masih mengatur on/off banner dan teks "Cara Pesan" yang dibaca beranda publik.
Menunya sudah dibuang dan dikembalikan dua kali. Pilihan: kembalikan ke sidebar di grup
Pengaturan Website, atau alihkan pengaturannya ke halaman lain lalu pensiunkan halaman ini.
Menghapus halaman tanpa memindahkan pengaturannya akan membuat beranda publik tidak bisa diatur.

**D-3. Baris tab status Pesanan, bagaimana sebaiknya?**
Ada tiga jalan: pindahkan tab jarang ke menu "Lainnya", biarkan dua baris, atau tampilkan
bilah gulir tipis. Saya sarankan menu "Lainnya" karena menjaga baris tetap satu tingkat dan
menghemat ruang untuk tab yang sering dipakai.

**D-4. Angka "Pesan WhatsApp Gagal" di dashboard, dibatasi ke 7 hari atau tujuannya yang
disediakan?**
Saya sarankan menyediakan tujuan berupa daftar pesan gagal sepanjang waktu, karena 26 pesan
tertua berumur 44 hari dan justru itu yang perlu ditindaklanjuti. Mengubah angkanya menjadi 7
hari akan menyembunyikan masalah, bukan menyelesaikannya.

**D-5. Panduan halaman, ditambah untuk 35 view sisanya atau tombolnya disembunyikan saja?**
Saya sarankan sembunyikan dulu tombolnya sesuai niat yang sudah tertulis di kode, lalu tambah
panduan hanya untuk halaman kerja yang benar benar butuh, bukan untuk semua halaman form.

**D-6. Izin baca, mana yang boleh dibuka terbatas dan mana yang disembunyikan sepenuhnya?**
Menu sudah menyembunyikan item tanpa kapabilitas, tetapi URL langsung belum punya permukaan
tersendiri. Perlu daftar tegas: halaman mana yang ketika ditolak menampilkan penjelasan, dan
halaman mana yang memang tidak boleh terlihat sama sekali.

**D-7. Tabel bersama, migrasi 34 halaman atau cukup tiga contoh utama?**
Saya sarankan mulai dari tiga halaman utama, kunci primitifnya, lalu sebar bertahap. Migrasi
34 halaman sekaligus berisiko menyentuh halaman yang sudah benar dan tidak punya masalah.

**D-8. Larangan huruf besar semua, berlaku seluruh panel atau hanya Performa Toko?**
Kontrak yang tertulis menyebutnya untuk judul kartu analitik, tetapi pemakaiannya sudah
menyebar ke 34 berkas. Tetapkan cakupannya lebih dulu supaya pengerjaannya sekali jadi.

**D-9. Aturan bebas em dash, apakah juga berlaku untuk isi database?**
Aturan tertulisnya menyasar "semua teks", dan sekarang terbukti ada dua baris data yang
melanggar serta tampil ke pengguna, satu di halaman publik. Perlu ditetapkan: apakah aturan
ini juga berlaku untuk konten yang diisi owner lewat editor, dan apakah perlu pemindai berkala
yang membaca kolom teks pengguna. Tanpa keputusan ini, pelanggaran akan terus muncul kembali
dari sisi data walaupun kode sudah bersih.

**D-10. Cakupan perbaikan em dash di 159 berkas, sejauh mana?**
Saya sarankan batasi pada berkas aktif saja dan lewati seluruh `*.bak-*`, karena mayoritas
temuan adalah komentar kode dan pengejaran menyeluruh berisiko besar terhadap manfaatnya.
Perlu persetujuan owner sebelum dikerjakan.

---

## 7. Risiko data dan kontrak yang tidak boleh diselesaikan dalam audit

Daftar ini adalah hal yang saya temukan tetapi **sengaja tidak saya sentuh**, karena
menyentuh kontrak atau data. Jangan dikerjakan tanpa keputusan dan catatan ADR.

**R-1. Cakupan angka WhatsApp gagal menyentuh definisi metrik.**
Memindahkan angka dashboard dari sepanjang waktu ke 7 hari akan mengubah angka yang dibaca
owner. Ini harus lewat keputusan (D-4) dan, bila mengubah definisi, lewat ADR.

**R-2. Halaman CMS dan Beranda Tata Letak menyimpan konfigurasi yang dibaca halaman publik.**
Menghapus salah satu route berisiko membuat pengaturan yang sedang aktif tidak bisa diubah.
Periksa dulu pengaturan mana yang benar benar dipakai beranda publik sebelum memensiunkan apa pun.

**R-3. Perbaikan 500 media hanya boleh mengubah pemanggil, bukan nama route.**
Kedua nama route itu dipakai berkas lain, dan `admin.media.attach.show` sudah dipakai benar
oleh Media Library. Mengubah `routes/web.php` akan merusak pemanggil yang sekarang sehat.

**R-4. Route pengalihan lama adalah kontrak, bukan sampah.**
`/admin/vouchers`, `/admin/vouchers/{any}`, `/admin/beranda/kontak`, dan
`/admin/apa-kata-pelanggan` semuanya mengembalikan pengalihan 301 dengan sengaja, agar tautan
lama tidak rusak. Jangan dihapus karena terlihat tidak dipakai.

**R-5. Grid 7 kolom Pesanan dan susunan kolomnya dibekukan kontrak.**
Perbaikan baris tab status tidak boleh menggeser atau mengubah susunan kolom tabel di bawahnya.

**R-6. Angka pada tab status Pesanan sudah benar dan cocok dengan database.**
Jangan "memperbaiki" angkanya saat merapikan tata letak. Sudah saya cocokkan satu per satu.

**R-7. Perbaikan em dash di data hanya boleh lewat antarmuka admin, bukan SQL langsung.**
Dua baris yang melanggar ada di database. Mengubahnya langsung lewat SQL akan melewati
pencatatan aktivitas admin dan kontrak sumber naskah tunggal, sehingga perubahan tidak
terlacak. Pakai editor CMS dan halaman terkait supaya jejak perubahannya tercatat.

**R-8. Notifikasi id 8 dan 17 menunjukkan bahwa em dash bisa masuk lewat dua jalur.**
Id 8 dibuat oleh kode lama, id 17 oleh kode baru. Artinya sebelum memperbaiki baris lama,
pastikan dulu semua penghasil teks dinamis sudah bersih, supaya tidak muncul lagi setelah
dibersihkan. Dua baris komentar di controller admin termasuk yang perlu dibereskan lebih dulu.

---

## 8. Verifikasi audit

Daftar periksa sebelum laporan ini dianggap selesai.

| Butir | Status |
|---|---|
| Semua route admin masuk coverage map | Ya, 290 dari 290 |
| Route duplikat dan pengalihan dikelompokkan dengan alasan | Ya, 13 pengalihan dan 8 titik JSON dipisahkan dari 80 halaman |
| Setiap pola punya tangkapan layar wakil | Ya, 24 tangkapan layar untuk 12 pola |
| Semua temuan punya bukti | Ya, masing masing menyebut berkas, nomor baris, tangkapan layar, atau catatan log |
| Tidak ada temuan tanpa label keyakinan | Ya, kolom Confidence dicantumkan per temuan |
| Tidak ada berkas produksi berubah | Ya, seluruh audit read-only |
| Tidak ada em dash di dokumen baru | Ya, diperiksa dengan pencarian kode U+2014 di seluruh hasil audit |
| Jumlah halaman dan route bisa ditelusuri ke sumber | Ya, lewat `data/coverage-map.json` yang dihasilkan dari `route:list` |

**Batasan audit yang perlu diketahui.** Enam route baca mengembalikan status 0 pada pengukuran
otomatis karena berbentuk pengalihan 302, dan itu memang perilaku yang diniatkan, bukan cacat.
Tiga route lain gagal terukur sekali karena koneksi terputus lalu berhasil saat diulang. Audit
ini memakai akun admin penuh, jadi **perilaku halaman ketika kapabilitas kurang belum diuji
secara langsung**, hanya disimpulkan dari kode. Perilaku zoom 125 persen dan navigasi keyboard
menyeluruh juga belum diuji; yang diuji adalah keberadaan nama aksesibel pada 103 kontrol di
halaman Pesanan, dan hasilnya semua bernama, tidak ada kontrol tanpa nama.

Pemeriksaan em dash di teks tampilan dilakukan pada 29 halaman admin yang saya pilih, bukan
pada seluruh 80 halaman. Jadi temuan F-15 kemungkinan **belum lengkap**, dan pengukuran
lengkap sebaiknya dilakukan sebagai bagian dari pekerjaan Batch 1. Saya mencatat ini supaya
angka "satu kebocoran" tidak disalahartikan sebagai "hanya ada satu".

Untuk transparansi metode: laporan ini awalnya menyatakan nol em dash. Angka itu benar hanya
untuk lingkup yang saya pindai saat itu, yaitu berkas halaman dan komponen admin. Setelah
cakupan pemindaian diperluas ke seluruh `app`, `resources`, `routes`, dan `config`, hasilnya
159 berkas. Saya memilih mengoreksi angka itu di laporan ini daripada membiarkannya berdiri,
karena angka yang salah lebih berbahaya daripada angka yang tidak ada.

---

## 9. Tindak lanjut

Kerjakan **Batch 0** lebih dulu. Isinya tiga hal kecil dengan hasil yang langsung terasa:
satu halaman 500 hilang, satu tombol yang tertutup bisa diklik kembali, dan dua penjaga test
mencegah kedua kelas kesalahan itu terulang. Sesudah Batch 0 hijau dengan verifikasi live
di browser, lanjut ke Batch 1, dan seterusnya sesuai keputusan owner pada bagian 6.
