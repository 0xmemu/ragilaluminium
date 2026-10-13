# Telaah P0: Relasi Kategori dan Produk

Tanggal: 23 September 2026
Sifat: analisis, **tanpa perubahan data atau skema**.
Pertanyaan yang dijawab: kalau `category_id` diubah, apa dampaknya; kalau
`Category::products()` dibiarkan, apa dampaknya; dan apakah ketimpangan yang sama
terjadi di tempat lain.

Status: **menunggu keputusan owner**. Belum dikerjakan.

---

## 1. Yang sebenarnya rusak, dan yang tidak

Ada dua kolom yang menyimpan kategori pada tabel `products`:

| Kolom | Tipe | Isi nyata | Ditulis oleh | Dipakai untuk |
|---|---|---|---|---|
| `product_category` | teks | `JENDELA`, `BOVEN`, `PINTU` | form produk admin, import, seeder | katalog publik, filter, URL kategori, form model produk |
| `category_id` | angka | `NULL` pada 137 baris, `0` pada 46 baris | hanya seeder dan import arsip Shopee | satu hal saja: `Category::products()` |

Fakta lapangan (diukur dari database produksi):

```text
Baris products                               183
category_id = NULL                           137
category_id = 0                               46
category_id cocok ke baris categories           0
product_category cocok ke categories.code     183  (semuanya cocok)
```

Kolom `category_id` **tidak punya foreign key**, jadi nilai `0` dan `NULL` itu
diterima tanpa peringatan. Migrasi
`database/migrations/2026_09_03_000001_make_products_category_id_nullable.php`
mencatat keputusan owner 2026-09-03: ID kategori Shopee dihapus dari alur admin,
kolom dipertahankan agar data historis utuh, tidak lagi wajib diisi. Jadi kolom itu
**memang sengaja ditinggalkan**, bukan lupa dikerjakan.

Yang ikut kolom itu mati hanyalah dua tempat, keduanya di panel admin:

1. **Kolom "Produk Terkait"** di `/admin/kelola/kategori` memakai
   `withCount('products')`. Hasilnya selalu 0 untuk ketiga kategori, padahal
   isinya 120, 62, dan 1 produk.
2. **Penjaga hapus kategori** di `CategoryController::destroy()`:
   `if ($category->products()->exists())` selalu `false`. Artinya kategori yang
   masih dipakai 120 produk **bisa dihapus**, dan setelah dihapus slug URL-nya
   hilang sehingga 120 produk kehilangan halaman kategorinya.

Yang **tidak** rusak, dan ini penting supaya perbaikannya tidak berlebihan:
halaman kategori publik, filter katalog, navigasi mega-menu, sitemap, dan form
model produk semuanya memakai `product_category` atau `categories.slug` yang
datanya utuh. Toko berjalan normal.

---

## 2. Opsi A: isi `category_id` dari `product_category`

Caranya: migrasi yang memetakan setiap baris `categories.code` ke `products.category_id`,
lalu menambah foreign key, lalu menulis `category_id` di form produk.

**Dampak positif**
- `Category::products()` hidup. Kolom "Produk Terkait" benar, penjaga hapus bekerja.
- Relasi kategori jadi kunci angka yang tahan perubahan kode, dan bisa dipakai
  `whereHas('category')` untuk query baru.

**Dampak negatif dan risiko**
- **Muncul sumber kebenaran kedua.** Setelah terisi, `category_id` dan
  `product_category` menyimpan fakta yang sama. Setiap tempat yang mengubah salah
  satunya harus mengubah keduanya, kalau tidak keduanya akan berbeda dan admin
  akan melihat dua angka berbeda untuk hal yang sama.
- **Menyentuh jalur produk yang sensitif**: form produk (create dan edit), import
  katalog V2 (produk baru dan update), serta seeder. Import adalah jalur yang
  paling berisiko, karena ia menulis produk massal dan saat ini tidak mengenal
  `category_id` sama sekali.
- **Menyentuh data produksi 183 baris.** Walaupun pemetaannya pasti cocok (183 dari
  183 produk punya `product_category` yang ada di `categories.code`), tetap perlu
  backup dan skrip yang bisa dibalik.
- **Foreign key akan bentrok dengan data lama.** Setelah FK dipasang,
  `category_id = 0` pada 46 baris menjadi tidak sah. Jadi 46 baris itu harus
  diubah lebih dulu (atau dijadikan `NULL`), sebelum FK bisa dipasang. Urutannya
  tidak boleh terbalik.
- Kategori yang dihapus di masa depan akan ditolak database bila masih dipakai,
  yang sebenarnya benar, tetapi perlu ditangani di UI supaya pesannya manusiawi.
- Workaround `['WINDOW','DOOR','BOUVEN']` di validasi produk dan fallback alias di
  `CategoryUrl` tetap harus dipertahankan, jadi kode tidak jadi lebih sederhana.

**Perkiraan lingkup**: 1 migrasi + 1 skrip pemetaan data + perubahan di 3-4 jalur
penulis + test.

---

## 3. Opsi B: arahkan `Category::products()` ke `product_category`

Caranya: ubah relasi menjadi pencocokan kode, misalnya
`hasMany(Product, 'product_category', 'code')`, dan biarkan `category_id` sebagai
kolom warisan yang tidak dipakai.

**Dampak positif**
- **Satu sumber kebenaran.** Admin cukup mengisi Kategori di form produk seperti
  sekarang, dan angka "Produk Terkait" langsung benar tanpa ada data yang harus
  disinkronkan.
- **Nol perubahan data.** Tidak ada migrasi data, tidak ada risiko 183 baris
  produksi, tidak ada backup khusus.
- **Lingkup kecil dan terlokalisasi**: satu model, plus test.
- Sejalan dengan keputusan owner 2026-09-03 yang memang sudah memensiunkan
  `category_id` dari alur admin. Opsi ini menyelesaikan sisa terakhirnya.

**Dampak negatif dan risiko**
- **Butuh normalisasi kode.** Relasi Eloquent sederhana mencocokkan nilai apa
  adanya. Saat ini semua data sudah kanonik (`JENDELA`/`BOVEN`/`PINTU`), tetapi
  validasi produk masih mengizinkan nilai warisan `WINDOW`/`DOOR`/`BOUVEN`, dan
  alias itu juga diizinkan di
  `app/Support/CategoryUrl.php`. Kalau nanti ada satu produk ber-`WINDOW`,
  relasi akan melewatkannya. Jadi relasi harus didefinisikan lewat kode produk
  kanonik (atau query khusus), bukan `hasMany` apa adanya.
- `category_id` tetap ada sebagai kolom mati, sehingga seseorang di masa depan bisa
  tertipu lagi. Ini perlu penanda jelas, misalnya komentar migrasi dan catatan di
  dokumen skema, atau kolomnya di-rename agar jelas warisan.
- Kunci relasi jadi teks, sehingga lebih rapuh bila kode kategori berubah. Perlu
  kebijakan bahwa `categories.code` untuk kategori yang sudah dipakai tidak boleh
  diubah. (Form kategori saat ini mengizinkan edit `code`.)
- Rentang waktu: tidak ada risiko data sama sekali.

**Perkiraan lingkup**: 1 model + 1-2 test, tanpa migrasi data.

---

## 4. Opsi C: tetap seperti sekarang

**Dampak**
- Angka "Produk Terkait" terus menampilkan 0. Admin tidak bisa tahu kategori mana
  yang terpakai, dan itu informasi yang wajar dicari saat merapikan katalog.
- Penjaga hapus tetap buta. Menghapus kategori yang dipakai akan berhasil, dan
  akibatnya slug URL kategori hilang sehingga halaman kategori publik untuk
  produk-produk itu mati. Ini kerusakan yang tidak bisa dibatalkan dari UI.
- Tidak ada biaya perbaikan sekarang, tetapi biayanya tidak hilang, hanya
  dipindahkan ke kemungkinan kerusakan data nanti.

**Catatan**: satu-satunya hal yang membuat opsi ini masih bisa ditahan adalah
karena kategori baru bisa ditambah lewat form produk, jadi admin mungkin cukup
puas dengan angka 0. Tetapi penjaga hapus yang buta menurut saya tetap terlalu
berisiko untuk dibiarkan.

---

## 5. Rekomendasi

**Kerjakan Opsi B sekarang** (satu sumber kebenaran, tanpa risiko data), lalu
jadikan Opsi A sebagai keputusan terpisah kalau owner memang ingin relasi kategori
yang kuat untuk fitur baru.

Alasannya:
1. Opsi B menyelesaikan **kedua** kerusakan nyata (angka dan penjaga hapus) tanpa
   menyentuh data produksi sama sekali.
2. Opsi A menambah sumber kebenaran kedua pada sistem yang justru sedang berusaha
   memensiunkan `category_id`. Itu berlawanan dengan arah keputusan 2026-09-03.
3. Bisa dibalik dalam satu berkas kalau ternyata salah, sedangkan A tidak.

Kalau owner memilih Opsi A, urutannya wajib: backup, petakan 46 baris `category_id = 0`,
tulis `category_id` di semua jalur penulis termasuk import, baru pasang foreign key.
Jangan pasang foreign key lebih dulu.

Dua hal yang saya sarankan dikerjakan bersamaan, terlepas dari pilihan mana pun:
- **Beri penanda pada `category_id`** bahwa kolom itu warisan dan bukan sumber
  kebenaran, supaya tidak ada yang tertipu lagi.
- **Batasi perubahan `categories.code`** untuk kategori yang sudah dipakai produk,
  karena kode itu dipakai sebagai kunci pencocokan.

---

## 6. Hasil sisir menyeluruh: apakah ketimpangan ini ada di tempat lain

Saya menyisir seluruh `app/Models/*` dan setiap pemanggilan `withCount`,
`whereHas`, dan `join` untuk mencari pola yang sama: kolom yang dibaca tetapi
tidak pernah ditulis. Hasilnya:

**A. Relasi mati dengan pola yang sama**

| Relasi | Kolom | Kenapa mati | Akibat di admin |
|---|---|---|---|
| `Category::products()` | `products.category_id` | tidak ada penulis aktif | temuan P0 ini |
| `MediaAsset::poster()` | `media_assets.poster_asset_id` | tidak ada penulis sama sekali; 9 titik pembuatan `MediaAsset` tidak mengisinya | relasi selalu `null`. **Tidak berdampak terlihat**, karena poster video sesungguhnya datang dari `ProblemsSolutionsSettings`, bukan kolom ini. Jadi ini kode mati, bukan angka salah. |
| `InstallationProject::product()`, `::modelProduct()`, `::mainImageAsset()`, `::mainVideoAsset()` | `installation_projects.*` | seluruh tabel tidak punya penulis, tidak ada controller, route, job, atau seeder yang menyentuhnya | model sepenuhnya menganggur. Galeri pemasangan memakai `product_media` dan `installation_groups`, bukan tabel ini. |

Jadi `Category::products()` adalah **satu-satunya relasi mati yang menghasilkan
angka salah**. Dua lainnya adalah kode mati tanpa efek ke tampilan. Itu kabar baik:
masalahnya tidak menyebar.

**B. Kolom yang ditulis sebagian (bukan mati, tapi timpang)**

`order_items.product_model` dan `order_items.design_variant` diisi oleh
`OrderService::createFromCart`, tetapi **tidak** oleh jalur edit pesanan
`OrderService::editOrder`. Pada 29 baris `order_items` yang ada, 1 baris punya
`design_variant` kosong. Efeknya: laporan performa yang menghitung sub model
terjual dari `order_items` akan kurang menghitung untuk pesanan yang pernah
diedit. Ini berbeda sifatnya dari P0, dan saya sarankan diperiksa terpisah, bukan
disatukan ke perbaikan kategori.

**C. Ketimpangan format (belum jadi masalah, tapi berpotensi)**

Ada satu titik yang perlu diwaspadai, dan ini yang paling mirip dengan kekhawatiran
owner soal "ketimpangan format":

Alias kategori warisan (`WINDOW`, `DOOR`, `WINDOWS`, `DOORS`, `BOUVEN`) diperlakukan
**tidak seragam** oleh tiga helper:

| Helper | Mengenali alias plural (`WINDOWS`/`DOORS`) | Mengenali alias tunggal (`WINDOW`/`DOOR`) |
|---|---|---|
| `CatalogLabels::normalizeCategory()` | ya | ya |
| `CategoryUrl::CODE_TO_PRODUCT` | ya | ya |
| `CatalogLabels::categoryCodesWithLegacy()` | **tidak** | ya |
| `CategoryUrl::FALLBACK_SLUG_BY_CODE` | **tidak** | ya |

`categoryCodesWithLegacy()` dipakai oleh `whereIn` di `CatalogController`,
`PageController`, dan `PromotionController`. Kalau ada satu produk dengan nilai
`WINDOWS`, produk itu akan tersaring keluar dari daftar katalog, sedangkan
`normalizeCategory()` akan menerimanya. Ini ketimpangan nyata, tetapi **belum
meledak** karena data sekarang bersih: 0 produk memakai kode warisan apa pun.

Satu lagi: `ModelProductService` mencocokkan `cms_model_products.product_category`
langsung ke `products.product_category` **tanpa normalisasi**, sedangkan
`CatalogTaxonomy` menormalkan. Untuk baris model produk yang kategorinya ditulis
dalam bentuk warisan, jumlah produknya akan terbaca 0 dan kartu model itu
**dilewati sepenuhnya** dari katalog dan mega-menu. Ini juga bergantung pada data
warisan yang saat ini tidak ada.

**Kesimpulan bagian ini**: tidak ada ketimpangan format yang sedang aktif
merusak tampilan hari ini, karena seluruh data kategori sudah kanonik. Yang ada
adalah **jalur warisan yang setengah dibersihkan**: sebagian helper menerima alias
lama, sebagian tidak. Selama tidak ada yang menulis alias lama, tidak ada masalah;
begitu ada (misalnya lewat import lama atau input manual), tiga permukaan berbeda
akan bereaksi berbeda. Ini layak ditutup sebagai perbaikan kecil tersendiri.

---

## 7. Yang perlu diputuskan owner

**D-1. Pilih Opsi A, B, atau C untuk `category_id`.**
Rekomendasi saya Opsi B (satu sumber kebenaran, tanpa risiko data), dengan A
sebagai keputusan terpisah bila relasi kategori kuat memang dibutuhkan.

**D-2. Apakah alias kategori warisan (`WINDOW`/`DOOR`/`DOORS`/`WINDOWS`/`BOUVEN`)
masih perlu didukung?**
Kalau tidak ada data dan tidak ada import lama yang bisa memasukkannya, seluruh
penanganan alias bisa disederhanakan dan ketimpangan di bagian 6C hilang dengan
sendirinya. Kalau masih perlu, ketiga helper itu harus diseragamkan.
