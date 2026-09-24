# Audit Konsistensi UI, Komponen, dan Flow Panel Admin

Tanggal: 23 September 2026
Repo: `/root/ragilaluminium`, branch `feat/admin-ui-redesign`, commit `a4c6ca33` saat audit, `c20b06b7` setelah perbaikan P1
Sifat: audit **read-only**; perbaikan P1 dikerjakan setelah audit dan dicatat di bagian 12.
Metode: perjalanan nyata dari menu sidebar (klik, bukan slug), interaksi fitur, perbandingan
pattern antar halaman, dan verifikasi flow add/edit sampai ke lapisan route, controller, dan data.

Dokumen ini melengkapi audit sebelumnya (`LAPORAN-AUDIT-ADMIN.md`) yang bersifat inventaris dan
prioritas. Audit ini fokus pada **konsistensi**, jadi sebagian temuan di sini baru dan sebagian
memperkuat temuan lama dengan bukti berbeda.

Telaah P0 relasi kategori ada di dokumen terpisah: `TELAAH-P0-KATEGORI.md`.

Bukti pendukung:

| Berkas | Isi |
|---|---|
| `data/breadcrumb-audit.json` | hasil uji breadcrumb untuk 290 nama route admin |
| `screenshots2/` | tangkapan layar bukti temuan audit ini |
| `data/coverage-matrix.md` | tabel 80 surface (dari audit sebelumnya, dipakai ulang) |

---

## 1. Ringkasan hasil

| Metrik | Nilai |
|---|---|
| Menu sidebar dijelajahi lewat klik nyata | 31 dari 31 |
| Halaman berpindah sesuai menu yang diklik | 31 dari 31 |
| Menu aktif (aria-current) benar | 31 dari 31 |
| Halaman dengan error konsol saat dibuka | 0 |
| Nama route admin diuji terhadap resolver breadcrumb | 290 |
| Route dengan breadcrumb menyimpang | 2 |
| Form tambah diuji sampai submit kosong | 6 |
| Form dengan pesan validasi tidak sesuai label | 6 dari 6 |
| Modul dengan pola tambah dan edit berbeda | 3 |
| Temuan P0 | 2 |
| Temuan P1 | 4 |
| Temuan P2 | 8 |
| Total temuan konsistensi | 14 |

Kesimpulan singkat: **navigasi menu sangat sehat** (31 dari 31 benar, nol error konsol), dan
sebagian besar pattern inti sudah matang. Yang bermasalah ada tiga hal besar: **satu angka yang
salah di halaman Kategori** (P0), **pola tambah dan edit yang tidak seragam sampai di dalam satu
modul yang sama** (P1), dan **pesan validasi form yang memakai nama field berbahasa Inggris serta
kadang menunjuk field yang salah** (P1). Dua temuan P0 dari audit sebelumnya juga masih terbuka.

---

## 2. Flow coverage map (Lapisan 1)

Metode: setiap menu diklik dari sidebar, lalu dicatat perpindahan URL, menu aktif, breadcrumb,
judul, aksi header, dan jumlah kontrol. Kolom "Sesuai" berarti URL dan menu aktif benar.

| Menu | Page | Entry | Aksi header terlihat | Subpage | Kembali | State | Hasil |
|---|---|---|---|---|---|---|---|
| Beranda | Dashboard | klik menu | Panduan, Refresh data | 8 tautan Antrean tindakan | ya | filter via URL, kembali benar | Sesuai |
| Performa Toko | Analytics | klik menu | Panduan, Refresh data, Unduh Laporan | Ekspor XLSX | ya | periode dibawa ke ekspor | Sesuai |
| Pesanan | Orders | klik menu | Panduan, Refresh, Unduh Laporan | Detail, lacak (drawer), status | ya | filter bertahan saat kembali | Sesuai |
| Pembayaran | Payments | klik menu | Panduan, Refresh data | Detail pesanan | ya | tab status | Sesuai |
| Pengiriman | Shipping | klik menu | Panduan, Refresh data | Detail resi | ya | tab status | Sesuai |
| Produk | Products | klik menu | Panduan, Refresh, Ekspor, Media Library, Tambah | Tambah, Edit, Detail, Varian, Media | ya | tab Produk/Kategori/Model/Sub | Sesuai |
| Kategori | Categories | klik menu | Panduan, Tambah | Edit (halaman) | ya | tanpa paginasi | Angka salah, lihat F-01 |
| Model Produk | ModelProducts | klik menu | Panduan, Refresh katalog, Urutkan, Tambah | Tambah, Edit | ya | tanpa paginasi | Sesuai, lihat F-09 |
| Sub Model | SubModels | klik menu | Panduan, Urutkan, Tambah | Tambah, Edit | ya | tanpa paginasi | Sesuai, lihat F-09 |
| Hasil Pemasangan | InstallationGallery | klik menu | Panduan, Urutkan, Lihat Publik, Tambah | Detail, Kelola | ya | penyaring tanpa label | Lihat F-11 |
| Import | Imports | klik menu | Panduan, Refresh, Mulai Import Baru | Detail, unduh template | ya | tab status | Sesuai |
| Teruskan Popularitas | PopularityBoosts | klik menu | Panduan, Kembali, Refresh, Tambah | Tambah | ya | tanpa paginasi | Sesuai |
| Paling Banyak Dipesan | BerandaPopular | klik menu | Panduan, Urutkan | Lihat semua | ya | 2 tabel di satu halaman | Sesuai |
| Media Library | Media Library | klik menu | Panduan, Unggah Media | Detail (500), Pasang | ya | folder, penyaring, massal | Detail 500, lihat F-02 |
| Promo Toko | Promotions | klik menu | Panduan | Diskon, Flash Sale, Voucher, Banner, Bar | ya | ringkasan kartu | Sesuai |
| Subsidi Ongkir | ShippingSubsidy | klik menu | Panduan, Simpan | tidak ada | ya | satu form | Breadcrumb salah, F-05 |
| Biaya COD | CodSettings | klik menu | Panduan, Simpan perubahan | tidak ada | ya | satu form | Kontrol tanpa label, F-11 |
| Customer | Customers | klik menu | Panduan, Refresh, Unduh Excel | Detail, Edit | ya | pencarian | Sesuai |
| Ulasan | Testimonials | klik menu | Panduan, Refresh, Lihat di toko, Ulasan dari order, Tambah | Tambah, Edit, Galeri | ya | tab Website/Eksternal | Sesuai |
| WhatsApp | WhatsApp Hub | klik menu | Panduan, 24 Jam, 7 Hari, 30 Hari, Semua, Refresh | Template, Sambungkan Nomor | ya | tab + rentang | Sesuai, lihat F-04 |
| Profil & Kontak Toko | StorefrontPlatforms | klik menu | Panduan, Refresh, Lihat di toko, Simpan perubahan | tidak ada | ya | form panjang | Sesuai |
| Sering Ditanyakan | Faq | klik menu | Panduan, Lihat publik, Pengaturan halaman, Urutkan, Tambah | panel inline | ya | tab aktif/arsip | Pola beda, F-02 |
| Masalah & Solusi | MasalahSolusi | klik menu | Panduan, Lihat publik, Urutkan, Tambah | Tambah (halaman) | ya | satu tabel | Pola beda, F-02 |
| Cara Pemesanan | CaraPemesanan | klik menu | Panduan, Lihat publik, Simpan | tidak ada | ya | satu form | Sesuai |
| Tentang Kami | TentangKami | klik menu | Panduan, Lihat di toko, Edit profil | Profil toko | ya | satu form | Sesuai |
| Dokumen Halaman | Documents | klik menu | Panduan, Batal, Urutkan, Simpan | Ketentuan, Privasi | ya | dua kartu | Sesuai |
| Log Aktivitas | ActivityLogs | klik menu | Panduan | Detail | ya | tab kategori, ekspor | Sesuai |
| Notifikasi | Notifications | klik menu | Panduan | tidak ada | ya | tanpa paginasi | Lihat F-09 |
| Profil Saya | Profile | klik menu | Panduan, Simpan profil | tidak ada | ya | satu form | Sesuai |
| Manajemen Admin | Users | klik menu | Panduan, Tambah | Tambah, Edit | ya | satu tabel | Sesuai |
| Pengaturan Sistem | SystemHealth | klik menu | Panduan, Jalankan pemeriksaan | tidak ada | ya | grafik | Sesuai, F-12 masih terbuka |

Catatan penting: **nol error konsol** pada 31 halaman. Ini menguatkan temuan audit sebelumnya
bahwa panel admin secara teknis sehat, dan masalahnya ada di konsistensi, bukan di kerusakan.

---

## 3. Reference pattern catalog

Pattern di bawah diturunkan dari halaman nyata yang paling matang, bukan dari asumsi desain.

| Pattern | Reference page | Komponen | Alasan dipilih |
|---|---|---|---|
| Page shell | `Admin/Orders/Index` | `AdminLayout` + `AdminBreadcrumbs` + `PageGuide` | Semua halaman memakai ini, judul dan deskripsi konsisten, aksi di header kanan |
| List table | `Admin/Orders/Index` | `ListToolbar`, tabel token, `Pagination` | Grid kolom sesuai kontrak, chip filter aktif, penyaring reset, ekspor membawa filter |
| Card list | `Admin/Promotions` | `SectionCard` + kartu ringkasan | Data promo memang naratif, bukan baris kolom |
| Filter | `Admin/Orders/Index` | `ListToolbar` + chip Filter Aktif | Filter terlihat sebagai chip, bisa dihapus satu per satu, ada Reset Semua |
| Search | `Admin/Customers/Index` | `ListToolbar` search + `apply({ q })` | Konsisten di 22 halaman, masuk ke query URL |
| Sort | `Admin/Customers/Index` | `Select` berlabel "Urutkan" | Label aksesibel ada, opsi terbaca |
| Add form | `Admin/Banners/Form` | `CmsPageForm` sejenis, `FieldGrid` | Halaman tersendiri, breadcrumb + tail benar, tombol Simpan di header |
| Edit form | `Admin/Banners/Form` | idem | Prefill terverifikasi (4 field terisi), tidak ada field yang salah terkunci |
| Detail (drawer) | `Admin/Orders/Show` lacak pesanan | `Sheet` sisi kanan | Konten panjang, konteks tetap terlihat, Esc bekerja |
| Detail (halaman) | `Admin/ImportShow` | halaman penuh | Data besar dan berdiri sendiri |
| Modal konfirmasi | `Admin/Orders/Show` batalkan pesanan | `ConfirmAction` | Menyebut akibatnya, tombol jelas, fokus kembali ke pemicu setelah Esc |
| Export | `Admin/Customers/Index` | tautan langsung dengan query | Membawa filter aktif, terverifikasi `?q=sari` |
| State kosong | `Admin/Orders/Index` | `EmptyState` | Ada judul, penjelasan, dan tombol Reset Filter |

Empat pattern yang **belum punya reference tunggal** dan jadi sumber inkonsistensi:
pola tambah/edit (dua gaya hidup bersama), paginasi (sebagian halaman punya, sebagian tidak),
aksi massal (hanya Media Library), dan state galat (primitif ada tetapi tidak dipakai).

---

## 4. Inconsistency matrix (Lapisan 3)

| ID | Modul/page | Reference | Yang teramati | Bukti | Jenis | Dampak | Prioritas |
|---|---|---|---|---|---|---|---|
| F-01 | Kategori | Angka harus mencerminkan data | Kolom "Produk Terkait" menampilkan 0 untuk ketiga kategori, padahal nyatanya 120, 1, dan 62 produk | screenshot2 `kategori-1440-light-produkterkait-nol.png`, query DB | Accidental | Admin menyimpulkan kategori tidak dipakai, padahal dipakai | P0 |
| F-02 | FAQ dan Masalah & Solusi | satu gaya tambah/edit | FAQ tambah/edit panel inline di halaman list, Masalah & Solusi halaman `/create` dan `/edit`, padahal keduanya di grup menu sama | live: FAQ `navigasi: false`, Masalah `navigasi: true` | Unknown | Admin harus belajar dua cara berbeda | P1 |
| F-03 | Kategori | satu gaya di dalam satu modul | **Tambah** membuka panel inline tanpa pindah URL, **Edit** membuka halaman `/kategori/1/edit` | live: tambah `urlSetelah: /admin/kelola/kategori`, edit `navigasi: true` | Accidental | Dalam satu modul, dua tugas mirip punya alur berbeda | P1 |
| F-04 | Validasi form (6 modul) | label berbahasa Indonesia | Pesan memakai nama field Inggris dan kadang field salah: "Kode voucher wajib diisi" muncul di field "Kode" Sub Model, "Nama lengkap wajib diisi" di field "Nama sub model" | screenshot2 `submodel-create-1440-light-validation-mismatch.png` | Accidental | Admin tidak tahu field mana yang dimaksud | P1 |
| F-05 | Subsidi Ongkir | breadcrumb tidak memuat grup yang salah | Breadcrumb "Beranda / Pengiriman / Harga & Promo / Subsidi Ongkir", memuat grup "Pengiriman" yang bukan induknya | screenshot2 `subsidi-ongkir-1440-light-breadcrumb-salah.png` | Accidental | Jejak hierarki salah dan bisa diklik | P2 |
| F-06 | Semua halaman filter | riwayat filter konsisten | Filter menumpuk riwayat di Customer, tetapi tidak di Pesanan (memakai `replace: true`) | live: back di Customer kembali ke filter sebelumnya, di Pesanan langsung ke halaman lain | Accidental | Tombol Back berperilaku berbeda tanpa alasan | P2 |
| F-07 | Tombol Panduan | tidak menutupi aksi | Tombol Panduan menutupi tombol Urutkan dan Simpan di `/admin/beranda`, serta Tambah di `/admin/pages` | live `elementFromPoint` mengembalikan tombol Panduan | Accidental | Aksi utama tidak bisa diklik | P0 |
| F-08 | Pesanan | baris tab muat penuh | Baris tab 205px lebih lebar dari wadahnya di 1440px, "Retur Selesai" terpotong dan "Perlu Perhatian" tersembunyi, bilah gulir dimatikan | audit sebelumnya, screenshot `orders-index-1280-light-clippedtabs.png` | Accidental | Filter tidak terlihat, dianggap tidak ada | P1 |
| F-09 | Paginasi | ada bila data banyak | Sub Model memuat 63 baris tanpa paginasi, Notifikasi 32, Model Produk 20, sedangkan Pesanan, Produk, Ulasan, Log Aktivitas punya paginasi | live: `pagerAda: false` untuk Sub Model | Unknown | Halaman berat saat data bertambah, pola tak terduga | P2 |
| F-10 | Ukuran halaman | kontrol ukuran per halaman | Tidak ada satu pun kontrol "tampilkan N per halaman" di seluruh panel | live: `pageSize: []` di 8 halaman | Unknown | Admin tidak bisa mengatur kerapatan | P2 |
| F-11 | Form setelan | setiap kontrol berlabel | COD 2 input tanpa label, Subsidi Ongkir 1 input tanpa label, Hasil Pemasangan select tanpa label | live: `controlsTanpaLabel` | Accidental | Pembaca layar tidak tahu isi field | P2 |
| F-12 | Label aksi | satu istilah | "Refresh data" (17 kali) bercampur "Refresh katalog", "Muat ulang" (2), "Segarkan status"; ekspor "Unduh Excel", "Ekspor Produk ke Excel", "Unduh Laporan", "Unduh XLSX" | pemindaian source | Accidental | Aksi yang sama punya nama berbeda | P2 |
| F-13 | Aksi massal | konsisten bila ada | Hanya Media Library punya pilihan kotak centang, dan tidak ada "pilih semua" di mana pun | live: `checkboxes: 30` hanya di Media Library, 0 di 7 halaman lain | Unknown | Admin tidak bisa memproses banyak baris sekaligus | P2 |
| F-14 | Drawer | nama aksesibel deskriptif, fokus kembali | Drawer lacak pesanan bernama aksesibel "Panel samping" (judul terlihatnya "Status Pengiriman & Lacak Pesanan"), dan fokus tidak kembali ke tombol pemicu setelah Esc | live: `aria-labelledby` menunjuk teks "Panel samping", `activeAfter: BODY` | Accidental | Navigasi keyboard kehilangan jejak | P2 |

**Perbedaan yang saya nilai intentional (bukan inkonsistensi):**

| Perbedaan | Alasan |
|---|---|
| Produk diurutkan `updated_at`, Pesanan/Ulasan `created_at` | Label Produk jujur "Baru saja diubah", bukan "Terbaru". Katalog memang dikurasi, transaksi diurutkan waktu masuk. |
| Model Produk dan Sub Model tanpa opsi sort | Keduanya memakai urutan manual lewat tombol Urutkan, jadi memang tidak perlu sort kolom. |
| Promo Toko memakai kartu, bukan tabel | Isinya kampanye naratif dengan rentang tanggal, bukan baris kolom sejenis. |
| Detail Pesanan memakai halaman, lacak pengiriman memakai drawer | Data pesanan besar dan berdiri sendiri, lacak pengiriman adalah konteks tambahan di atas halaman yang sudah terbuka. |

---

## 5. Add/edit report (Lapisan 4)

Setiap baris di bawah diuji dengan membuka form dari tombol yang terlihat, lalu submit kosong.
**Tidak ada data yang ditulis.** Semua submit kosong ditolak validasi.

| Modul | Entry tambah | Hasil create (submit kosong) | Entry edit | Prefill | Validasi | Persistensi | Redirect | Risiko data hilang | Prioritas |
|---|---|---|---|---|---|---|---|---|---|
| FAQ | panel inline | ditolak, 2 field ditandai | panel inline | tidak diuji | ada, teks salah | n/a | tetap di halaman | rendah | P1 (F-04) |
| Ulasan | `/testimonials/create` | ditolak, pesan jelas | `/testimonials/{id}/edit` | tidak diuji | ada, teks benar | n/a | tetap di form | rendah | - |
| Model Produk | `/model-produk/create` | ditolak, teks salah | `/model-produk/{id}/edit` | tidak diuji | ada, teks salah | n/a | tetap di form | rendah | P1 (F-04) |
| Kategori | panel inline | panel terbuka, form tampil | `/kategori/{id}/edit` **halaman** | tidak diuji | tidak ada pesan pada submit kosong | n/a | tidak pindah | rendah | P1 (F-03) |
| Sub Model | `/sub-model/create` | ditolak, teks salah | `/sub-model/{id}/edit` | tidak diuji | ada, teks salah | n/a | tetap di form | rendah | P1 (F-04) |
| Masalah & Solusi | `/masalah-solusi/create` | ditolak, teks salah | `/masalah-solusi/{id}/edit` | tidak diuji | ada, teks salah | n/a | tetap di form | rendah | P1 (F-04) |
| Banner | `/banners/create` | tidak diuji | `/banners/{id}/edit` | **4 field terisi benar**, tidak ada field salah terkunci | tidak diuji | n/a | tetap di form | rendah | - |

Temuan penting dari tabel ini: **pola tambah dan edit tidak seragam**, dan yang paling jelas
adalah Kategori, karena tambah memakai panel inline sedangkan edit memakai halaman penuh di
modul yang sama. Dari tujuh modul yang saya uji, hanya Ulasan dan Banner yang punya alur
tambah dan edit seragam berbasis halaman.

Catatan kejujuran: saya **tidak** menyelesaikan satu pun create yang valid, jadi klaim soal
persistensi dan redirect setelah sukses belum saya buktikan. Submit kosong sudah cukup untuk
memverifikasi validasi, tetapi tidak untuk memverifikasi penyimpanan. Itu batas audit ini.

---

## 6. Flow bugs terprioritas

### P0

**P0-1 (F-01). Angka "Produk Terkait" di Kategori selalu 0.**
Halaman Kategori menampilkan kolom "Produk Terkait" bernilai 0 untuk ketiga kategori.
Kenyataannya Jendela berisi 120 produk, Boven 62 produk, dan Pintu 1 produk. Akar masalahnya
relasi `Category::products()` memakai `hasMany(Product, 'category_id')`, sedangkan form produk
hanya menulis kolom `product_category` (berisi kode seperti `JENDELA`), tidak pernah menulis
`category_id`. Akibatnya 46 produk memiliki `category_id` bernilai 0 yang tidak cocok dengan
kategori mana pun. Ini angka bisnis yang salah ditampilkan ke admin, tepat kategori P0 menurut
rubrik (data salah), dan tidak boleh saya perbaiki sendiri karena menyentuh pemetaan relasi data.

**P0-2 (F-07). Tombol Panduan menutupi tombol aksi.**
Sudah dilaporkan di audit sebelumnya, dan **masih terbuka**. Terverifikasi ulang hari ini:
di `/admin/beranda` tombol Panduan menutupi "Urutkan" dan "Simpan", di `/admin/pages` menutupi
"Tambah". Tombol yang tertutup tidak bisa diklik.

### P1

**P1-1 (F-02, F-03). Pola tambah dan edit tidak seragam, termasuk di dalam satu modul.**
FAQ dan Kategori memakai panel inline, sedangkan Masalah & Solusi, Sub Model, Model Produk,
Banner, Ulasan, Voucher, dan Manajemen Admin memakai halaman tersendiri. Yang paling
merugikan adalah Kategori: **tambah inline, edit halaman penuh**. Artinya pola ini belum
diputuskan, bukan sekadar belum seragam.

**P1-2 (F-04). Pesan validasi memakai nama field Inggris dan kadang menunjuk field salah.**
Terbukti pada 6 form: FAQ ("Question", "Answer"), Sub Model ("Product model", "Kode voucher",
"Nama lengkap"), Model Produk ("Nama lengkap", "Product category"), Masalah & Solusi ("Problem").
Akarnya `lang/id/validation.php` hanya punya pemetaan `attributes` untuk field checkout dan
katalog umum (`name` berarti "Nama lengkap", `code` berarti "Kode voucher"), sehingga field admin
yang kebetulan bernama `code` mewarisi label voucher. Visualnya bisa dilihat di
`screenshots2/submodel-create-1440-light-validation-mismatch.png`: satu form menampilkan tiga
pesan yang semuanya menunjuk nama field yang berbeda dari label di sebelahnya.

**P1-3 (F-08). Baris tab status Pesanan terpotong.**
Sudah dilaporkan di audit sebelumnya, masih terbuka. "Retur Selesai" terpotong 205px dan
"Perlu Perhatian" sepenuhnya tersembunyi, sementara bilah gulir dimatikan sehingga tidak ada
petunjuk. Di halaman yang paling sering dibuka admin.

**P1-4 (F-02 lanjutan). Detail media 500.**
Sudah dilaporkan di audit sebelumnya, masih terbuka. 30 tautan "Detail" di Media Library
menuju halaman 500 karena `ProductMediaController` memanggil nama route tanpa awalan `admin.`.

### P2

**P2-1 (F-05). Breadcrumb Subsidi Ongkir memuat grup "Pengiriman" yang salah.**
Hasil uji 290 nama route menemukan tepat dua route yang menyimpang, keduanya di modul yang
sama. Akarnya pola `admin.shipping.*` di `admin-sitemap.php` dicocokkan dengan regex yang
**tidak melepaskan titik**, sehingga titik diperlakukan sebagai wildcard dan `admin.shipping.*`
ikut mencocokkan `admin.shipping-subsidy.*`. Menu sidebar tidak terkena karena memakai matcher
lain (Ziggy), jadi hanya breadcrumb yang salah.

**P2-2 (F-06). Riwayat filter menumpuk di sebagian halaman saja.**
Customer tidak memakai `replace: true` sehingga Back mengembalikan setiap langkah filter,
sedangkan Pesanan memakainya sehingga Back langsung melompat ke halaman sebelumnya. Keduanya
sama-sama benar secara teknis, tetapi berbeda tanpa alasan yang tercatat.

**P2-3 (F-09). Paginasi tidak konsisten.**
Sub Model memuat 63 baris sekaligus, Notifikasi 32, Model Produk 20, sedangkan Pesanan, Produk,
Ulasan, dan Log Aktivitas punya paginasi. Untuk saat ini datanya masih kecil, jadi ini belum
mendesak, tetapi polanya tidak bisa diprediksi admin.

**P2-4 (F-10). Tidak ada kontrol ukuran halaman.**
Tidak satu pun halaman daftar menyediakan pilihan "tampilkan N per halaman".

**P2-5 (F-11). Kontrol tanpa label** di COD, Subsidi Ongkir, dan Hasil Pemasangan.

**P2-6 (F-12). Istilah aksi tidak seragam** untuk refresh dan ekspor.

**P2-7 (F-13). Aksi massal hanya ada di Media Library**, dan tidak ada "pilih semua".

**P2-8 (F-14). Drawer punya nama aksesibel generik** dan fokus tidak kembali ke pemicu.

---

## 7. Roadmap perbaikan

Urutan disusun menurut keamanan data lebih dulu, lalu kebenaran flow, lalu potensi pakai ulang,
lalu frekuensi, baru konsistensi visual. Perbaikan pada komponen bersama dikerjakan lebih dulu
karena satu perubahan menyentuh banyak halaman.

### Batch 0, keamanan data dan aksi yang tidak bisa diklik

1. **P0-1 (F-01)** perbaiki hitungan "Produk Terkait". Perlu keputusan owner dulu karena
   menyentuh pemetaan relasi: apakah `category_id` akan diisi ulang, atau relasi diarahkan ke
   `product_category`. Lihat D-1. Jangan ubah form produk dulu sebelum arahnya jelas.
2. **P0-2 (F-07)** turunkan tombol Panduan dari posisi absolut di `admin-layout.tsx`.
3. **P1-4 (media 500)** perbaiki dua nama route di `ProductMediaController`.

Checkpoint: tidak ada halaman 500 yang bisa dicapai dari menu, dan tombol aksi header bisa diklik.

### Batch 1, kebenaran flow form

4. **P1-2 (F-04)** tambahkan pemetaan `attributes` untuk field admin di `lang/id/validation.php`.
   Satu berkas, memperbaiki 6 form sekaligus. Ini contoh perbaikan berpotensi pakai ulang tinggi.
5. **P1-1 (F-02, F-03)** putuskan satu pola tambah/edit, lalu samakan. Lihat D-2.
6. **P1-3 (F-08)** rapikan baris tab status Pesanan.

Checkpoint: pesan validasi memakai istilah yang sama dengan label, dan satu modul memakai satu
pola tambah/edit.

### Batch 2, navigasi dan state

7. **P2-1 (F-05)** perbaiki pencocokan pola di `breadcrumb.tsx` agar titik dilepaskan.
8. **P2-2 (F-06)** seragamkan pemakaian `replace` pada navigasi filter.
9. **P2-3, P2-4 (F-09, F-10)** samakan kebijakan paginasi, dan tambahkan kontrol ukuran halaman
   bila diputuskan perlu. Lihat D-3.

### Batch 3, aksesibilitas

10. **P2-5 (F-11)** beri label pada kontrol COD, Subsidi Ongkir, Hasil Pemasangan.
11. **P2-8 (F-14)** pakai judul terlihat untuk `aria-labelledby` drawer, dan kembalikan fokus ke pemicu.

### Batch 4, konsistensi istilah dan komponen

12. **P2-6 (F-12)** samakan istilah refresh dan ekspor.
13. **P2-7 (F-13)** putuskan cakupan aksi massal, lalu samakan bila perlu. Lihat D-4.
14. Migrasi tabel ke komponen bersama, mulai dari tiga halaman contoh (sudah ada di roadmap
    audit sebelumnya sebagai F-06).

---

## 8. Keputusan owner yang diperlukan

**D-1. Relasi kategori dan produk, mana yang jadi sumber kebenaran?**
Saat ini form produk menulis `product_category` (kode teks) sedangkan kolom "Produk Terkait"
menghitung dari `category_id` (kunci angka) yang tidak pernah diisi. Pilihannya: (a) isi ulang
`category_id` dari `product_category` lalu pertahankan kolom hitungan, atau (b) ubah hitungan
agar memakai `product_category` dan biarkan `category_id` sebagai kolom warisan. Pilihan (b)
lebih kecil risikonya tetapi meninggalkan kolom mati. Saya condong ke (a) bila ada rencana
memakai relasi kategori secara serius, karena kunci angka lebih tahan terhadap perubahan kode.

**D-2. Pola tambah dan edit, halaman tersendiri atau panel inline?**
Saat ini keduanya hidup. Panel inline lebih cepat untuk data pendek seperti FAQ dan Kategori,
sedangkan halaman tersendiri lebih lega untuk form panjang. Perlu satu keputusan: apakah
aturannya berdasarkan panjang form (pendek inline, panjang halaman), atau semua diseragamkan.
Saya sarankan aturan berdasarkan panjang form, karena memaksa form panjang jadi panel inline
akan membuat panel sempit dan sulit dipakai.

**D-3. Paginasi, apakah semua daftar wajib punya, dan perlukah kontrol ukuran halaman?**
Sub Model saat ini memuat 63 baris sekaligus. Tentukan ambang kapan paginasi wajib, dan apakah
admin perlu bisa memilih jumlah baris per halaman.

**D-4. Aksi massal, seberapa luas cakupannya?**
Hanya Media Library yang punya. Tentukan halaman mana yang benar-benar perlu (kandidat kuat:
Pesanan, Produk, Ulasan) dan mana yang tidak, supaya tidak dikerjakan borongan.

**D-5. Tombol Panduan untuk halaman tanpa panduan.**
Tombol dirender di semua halaman, tetapi hanya 30 dari 88 route punya isi panduan. Sudah
dilaporkan di audit sebelumnya, keputusannya masih tertahan: sembunyikan tombolnya, atau isi
panduannya.

---

## 9. Risiko data dan kontrak yang tidak boleh diselesaikan dalam audit

**R-1. Perbaikan hitungan kategori menyentuh pemetaan data.**
Mengubah cara "Produk Terkait" dihitung bisa mengubah angka yang dibaca admin, dan bila nanti
ada filter atau laporan yang memakai relasi yang sama, hasilnya ikut berubah. Harus lewat
keputusan D-1 dan dicatat sebagai perubahan kontrak data.

**R-2. `category_id` saat ini tidak konsisten dan jangan dibersihkan (pembersihan massal
sebelum arahnya diputuskan).**
46 produk punya `category_id` bernilai 0. Menghapus atau menulis ulang kolom itu sekarang,
sebelum D-1 diputuskan, bisa menghapus satu-satunya jejak relasi yang tersisa.

**R-3. Pembersihan riwayat filter (`replace`) mengubah perilaku tombol Back.**
Menyamakan perilaku berarti memilih salah satu: Back mengembalikan filter sebelumnya, atau
melewatinya. Ini keputusan pengalaman kerja, bukan sekadar teknis, dan menyentuh banyak halaman
sekaligus.

**R-4. Perbaikan 500 media hanya boleh menyentuh pemanggil, bukan nama route.**
Sudah tercatat di audit sebelumnya dan tetap berlaku. `admin.media.attach.show` dipakai benar
oleh Media Library.

**R-5. Angka pada tab status Pesanan sudah benar.**
Sudah dicocokkan dengan database. Perbaikan tata letak tidak boleh mengubah angkanya.

---

## 10. Verifikasi audit

| Butir | Status |
|---|---|
| Semua menu sidebar dijelajahi lewat klik nyata | Ya, 31 dari 31 |
| Semua perpindahan URL dan menu aktif diverifikasi | Ya, 31 dari 31 benar |
| Tombol yang tidak bisa diklik dicatat sebagai temuan flow | Ya, F-07 |
| Subpage yang terlihat dibuka dan dikembalikan | Ya, detail pesanan, banner edit, sub model edit, kategori edit |
| Filter, search, sort, paginasi dicoba | Ya, pada 14 halaman daftar |
| Drawer, modal, Esc, fokus diuji | Ya, drawer lacak pesanan dan modal batalkan pesanan |
| Ekspor membawa filter diuji | Ya, 3 halaman, semua membawa query |
| Add/edit diuji sebagai flow data | Ya, 7 modul, sampai submit kosong saja |
| Reference pattern ditetapkan dari halaman nyata | Ya, bagian 3 |
| Perbedaan intentional dipisahkan dari accidental | Ya, bagian 4 |
| Setiap temuan punya bukti | Ya, nomor baris, tangkapan layar, atau hasil ukur live |
| Tidak ada perubahan kode selama audit | Ya, read-only |
| Tangkapan layar representatif desktop gelap dan terang | Ya, folder `screenshots2/` ditambah `screenshots/` dari audit sebelumnya |
| Tidak ada em dash pada dokumen baru | Ya, diperiksa dengan pencarian kode U+2014 |

**Batasan yang perlu diketahui.**

Pertama, saya **tidak berhasil memverifikasi apakah tombol Enter mengirimkan pencarian**.
Harness browser yang saya pakai ternyata tidak bisa menghasilkan pengiriman form bawaan browser:
saya menguji dengan form kontrol polos yang saya sisipkan sendiri di halaman yang sama, dan form
itu juga tidak terkirim. Karena kontrolnya juga gagal, hasil ini **bukan bukti bug aplikasi**,
dan saya tidak melaporkannya sebagai temuan. Yang bisa saya pastikan: pengiriman form secara
programatik bekerja (pencarian menyaring dari 10 baris menjadi 2 di Customer), dan **tidak ada
tombol kirim maupun tombol bersihkan pencarian** di dalam form pencarian mana pun.

Kedua, **tidak ada satu pun create yang saya selesaikan**, jadi persistensi, redirect setelah
sukses, dan risiko duplikasi submit belum terverifikasi. Ini butuh akun uji khusus di luar data
produksi, dan sebagian halaman seperti Ulasan memang sudah punya halaman khusus untuk pengujian.

Ketiga, pengujian perilaku **ketika kapabilitas admin kurang** belum dilakukan, karena sesi ini
memakai akun admin penuh (Dev Agent).

---

## 11. Tindak lanjut

Kerjakan **Batch 0** lebih dulu karena satu di antaranya adalah angka bisnis yang salah dan dua
lainnya adalah aksi yang tidak bisa diklik. Batch 0 hanya menyentuh tiga titik dan tidak butuh
keputusan besar, kecuali arah relasi kategori yang perlu D-1.

Sesudah Batch 0, **Batch 1** adalah yang paling berdampak luas terhadap pekerjaan admin sehari
hari: satu berkas `lang/id/validation.php` memperbaiki pesan validasi di enam form sekaligus.
Itu perbaikan berpotensi pakai ulang paling tinggi di seluruh daftar ini.

Jangan mulai dari migrasi tabel atau penyeragaman visual. Keduanya menyentuh puluhan halaman
dan lebih baik dikerjakan setelah pola tambah/edit dan paginasi diputuskan, supaya tidak
dikerjakan dua kali.

---

## 12. Perbaikan P1 yang sudah dikerjakan (commit `c20b06b7`)

Empat temuan P1 diperbaiki setelah audit selesai, atas instruksi owner. Semuanya
diverifikasi di browser dengan akun admin, bukan hanya dari kode.

| Temuan | Berkas | Inti perbaikan | Bukti verifikasi |
|---|---|---|---|
| F-04 label validasi | `lang/id/validation.php` (+208 label) dan 5 controller admin | field admin kini punya label Indonesia; `name` dan `code` diberi label khusus form karena dipakai checkout dengan arti berbeda | FAQ: "Pertanyaan"/"Jawaban"; Sub Model: "Model produk"/"Kode"/"Nama sub model"; Model Produk: "Nama tampilan"/"Kategori produk" |
| F-07 Panduan menutupi aksi | `resources/js/layouts/admin-layout.tsx` | tombol Panduan tidak lagi `position: absolute`, ikut arus tata letak sebaris breadcrumb | 24 halaman kali 2 lebar layar (1440 dan 1280), nol tabrakan; tombol Simpan di Beranda dan Tambah di Halaman CMS bisa diklik |
| F-02 media 500 | `ProductMediaController.php` | dua nama route diberi awalan `admin.` | `/admin/media/1/attach` kembali 200 |
| F-08 tab pesanan | `resources/js/pages/Admin/Orders/Index.tsx` | baris tab membungkus alih-alih menggulir tersembunyi | 10 tab muat penuh, lebar isi 883px pada wadah 884px |

Verifikasi: `php artisan test` **1129 lulus, 1 dilewati, 0 gagal**; `npm run typecheck`
bersih; build sukses. Catatan: satu warning eslint `react-hooks/exhaustive-deps` pada
`Orders/Index.tsx` sudah ada sebelum perubahan (terverifikasi dengan memeriksa berkas
asli), bukan berasal dari perbaikan ini.

### Jebakan yang ditemukan saat mengerjakan

**Skrip penambah label sempat menghasilkan `validate()` dengan 4 argumen.**
Laravel hanya menerima 3 (`$rules, $messages, $attributes`). Bila pemanggilan sudah
punya `$messages`, menyisipkan `[]` menghasilkan `validate($rules, $messages, [], $attrs)`
dan argumen keempat diabaikan PHP **tanpa error apa pun**, sehingga label tampak tidak
bekerja. Terjadi pada 1 titik (`SubModelController`). Sudah diperbaiki, dan seluruh 95
pemanggilan `$request->validate()` di controller admin kini diverifikasi bermaksimal 3
argumen. Pembelajaran: hasil penyisipan argumen wajib dihitung ulang, bukan diasumsikan.

**Build frontend di repo ini dijalankan sebagai root, bukan `www-data`.**
`node_modules/.vite-temp` dan `public/build` dimiliki root, sehingga menjalankan
`npm run build` sebagai `www-data` gagal dengan `EACCES`. Perlu diperhatikan karena
AGENTS.md menyarankan menjalankan artisan sebagai `www-data`; untuk build, kepemilikan
direktori menentukan. Setelah build, `storage/logs` dan `bootstrap/cache` tetap
`www-data` dan bisa ditulis, jadi tidak ada risiko 500.
