# Rencana: Template Import/Update Katalog v2 (3 berkas terpisah)

Status: RENCANA, belum dieksekusi.
Tanggal: 2026-09-18.
Sumber: berkas `template fix.xlsx` dari owner, diperiksa langsung dari berkasnya.

---

## 1. Keputusan owner (acuan)

1. "kedalaman itu lebar" sehingga kolom `Lebar (cm)` dipetakan ke `depth_cm`.
   Istilah "Kedalaman" tidak dipakai lagi di template.
2. "kolom berat, dan dimensi itu diisi untuk kebutuhan pengiriman bukan untuk
   spesifikasi produk yg tampil di storefront" sehingga 4 kolom pengiriman
   (Berat, Tinggi, Panjang, Lebar) tidak pernah dirender ke storefront.
   Sudah diperiksa: tidak ada pemakaian berat atau dimensi di komponen PDP.
3. "ini sepenuhnya menggantikan template yang lama" sehingga format lama
   dipensiunkan, tidak hidup berdampingan.
4. "nama header akan mengikuti yang baru" sehingga header Bahasa Indonesia
   menjadi nama resmi.
5. "pastikan sistem dapat mengenali format baru ini" sehingga importer wajib
   membaca header baru, bukan hanya eksportirnya yang berubah.
6. "ubah warna header per grup fungsi (misal sku-deskripsi) (harga-dimensi)
   (media)" sehingga header diwarnai per grup.
7. "pisahkan sheet yang saya kirim tadi menjadi 3 template yang terpisah,
   import produk, update produk, update media" sehingga hasilnya 3 BERKAS,
   bukan 1 berkas berisi 3 sheet.
8. "format unduhan harus termasuk produk yang ada di website (ini akan
   berdasarkan filter di menu import)" sehingga template update terisi data
   nyata dan bisa disaring.
9. "nantinya akan ditambahkan unduh laporan per model produk tertentu, sub
   model tertentu dan lainnya" sehingga filter harus mudah ditambah.
10. "data template update produk dan media ini juga harus di guard agar sku,
    varian dan semua kolom yang rawan jika dirubah agar di protected dan tidak
    bisa dirubah" sehingga kolom identitas dikunci.

---

## 2. Fakta terverifikasi

### 2.1 Isi berkas owner

| Sheet | Jumlah kolom | Baris terisi |
|---|---|---|
| Data | 24 | 12 baris data, 1 grup produk, 12 kombinasi (4 warna x 3 kaca) |
| Update Produk | 8 | hanya kolom `Variasi` terisi, 12 baris |
| Update Media | 11 | hanya kolom `Variasi` terisi, 12 baris |

Yang sudah bagus di berkas owner:
- Dropdown pada `Kategori Produk`, `Model Produk`, `Sub Model`.
- Isi dropdown sah semua: kategori `JENDELA, PINTU, BOVEN`, sub model
  `POLOS, ORNAMEN`, dan 9 model yang seluruhnya dikenal sistem.
- Header baris 1: tinggi 26, bold, teks putih, latar merah `C20000`.
- Satu baris = satu varian, sehingga tidak ada lagi kolom opsi 1 sampai 4.
  Ini menghapus seluruh kelas masalah urutan opsi yang pernah terjadi.

### 2.1b Perubahan pada berkas owner kedua (18 Sep, 20:40)

Owner mengirim ulang berkas dengan satu perubahan header: kolom J yang semula
`Gambar Opsi Variasi 1` menjadi `Foto Produk Varian`. Seluruh header lain
identik, struktur sheet tidak berubah. Berkas pertama 16.760 byte, berkas
kedua 16.689 byte.

Kemudian owner memutuskan menyeragamkan nama itu menjadi `Gambar per Varian`,
karena sebutan itu lebih tepat untuk foto yang menempel pada varian, dan nama
yang sama dipakai di template lain. Jadi kontrak final kolom J adalah
`Gambar per Varian`, dan kolom E pada template Update Media yang semula
`Gambar Opsi Variasi` ikut diseragamkan menjadi nama yang sama.

### 2.2 Masalah yang harus diperbaiki di versi baru

1. Sheet `Data`: Harga, Stok, Berat, Tinggi, Panjang, Lebar, dan SELURUH kolom
   media (J, S sampai Y) kosong di 12 baris contoh. Template tanpa contoh
   terisi mengundang salah isi, dan ini punya sejarah: berkas import terakhir
   salah mengisi kolom dimensi.
2. Sheet `Update Produk` dan `Update Media`: hanya `Variasi` terisi, kolom lain
   kosong sehingga contoh tidak menunjukkan bentuk yang benar.
3. Tidak ada sheet Panduan. Template lama punya kamus kolom, ini hilang.

### 2.3 Kesiapan sistem (hasil pemeriksaan kode)

| Lapisan | Keadaan |
|---|---|
| Importer katalog sekarang | membaca 38 kolom gaya lama |
| Kecocokan kolom lama vs baru | 0 dari 24 kolom baru cocok |
| Jalur update harga/stok | `parent_sku`, `variant_sku`, `variant_combination`, `price`, `stock` |
| Jalur update media | `parent_sku`, `variant_sku`, `image_N`, `image_variation_N_option_M`, `shared_media_N`, `installation_image_N` |
| Pemecahan kombinasi | sudah ada, `explode` koma pada kombinasi varian |
| Proteksi sheet | tersedia di PhpSpreadsheet, belum dipakai di eksportir mana pun |
| Verifier | aturan V1 sampai V8, semuanya merujuk kolom lama |

Kesimpulan penting: karena 0 kolom cocok, format baru TIDAK akan terbaca bila
hanya eksportirnya diganti. Importer dan verifier wajib ikut diubah dan harus
rilis bersamaan.

### 2.4 Volume data (dasar perencanaan filter unduhan)

| Ukuran | Nilai |
|---|---|
| Produk | 179 |
| Varian | 2.138 |
| product_media | 1.335 |
| Produk per model | terbanyak JUNGKIT_2_DAUN 37, terkecil SWING_3_DAUN 2 |
| Produk per sub model | ORNAMEN 94, POLOS 81, kosong 3, KOMBINASI 1 |

Implikasi: unduhan penuh 2.138 baris masih aman, tetapi filter per model tetap
wajib karena admin akan sering mengunduh sebagian.

---

## 3. Peta kolom resmi (kontrak v2)

### 3.1 Template "Import Produk", sheet `Data`

Satu baris = satu varian. Grup menentukan warna header.

| Kol | Header | Kunci slug | Target | Grup |
|---|---|---|---|---|
| A | NO. ID | no_id | kunci grup internal, tidak disimpan | 1 |
| B | Nama Produk | nama_produk | `products.name` | 1 |
| C | Deskripsi Produk | deskripsi_produk | `products.description` | 1 |
| D | Spesifikasi | spesifikasi | `product_attributes` | 1 |
| E | Kategori Produk | kategori_produk | `products.product_category` | 1 |
| F | Model Produk | model_produk | `products.product_model` | 1 |
| G | Sub Model | sub_model | `products.design_variant` | 1 |
| H | Nama Variasi 1 | nama_variasi_1 | `variation_1_name` | 2 |
| I | Opsi Variasi 1 | opsi_variasi_1 | `variation_1_option` | 2 |
| J | Gambar per Varian | gambar_per_varian | media milik varian (per opsi) | 4 |
| K | Nama Variasi 2 | nama_variasi_2 | `variation_2_name` | 2 |
| L | Opsi Variasi 2 | opsi_variasi_2 | `variation_2_option` | 2 |
| M | Harga | harga | `product_variants.price` | 3 |
| N | Stok | stok | `product_variants.stock` | 3 |
| O | Berat (Kg) | berat_kg | `weight_kg` (pengiriman) | 3 |
| P | Tinggi (cm) | tinggi_cm | `height_cm` (pengiriman) | 3 |
| Q | Panjang (cm) | panjang_cm | `width_cm` (pengiriman) | 3 |
| R | Lebar (cm) | lebar_cm | `depth_cm` (pengiriman) | 3 |
| S | Gambar 1 (utama) | gambar_1_utama | media pos 1, penanda gambar utama | 4 |
| T | Gambar 2 | gambar_2 | media pos 2 | 4 |
| U | Gambar 3 | gambar_3 | media pos 3 | 4 |
| V | Media Bersama 1 | media_bersama_1 | media bersama | 4 |
| W | Media Bersama 2 | media_bersama_2 | media bersama | 4 |
| X | Gambar Hasil Pemasangan 1 | gambar_hasil_pemasangan_1 | media pemasangan | 4 |
| Y | Gambar Hasil Pemasangan 2 | gambar_hasil_pemasangan_2 | media pemasangan | 4 |

Grup warna yang diusulkan:

| Grup | Nama | Kolom |
|---|---|---|
| 1 | Identitas & Produk | A sampai G |
| 2 | Variasi | H, I, K, L |
| 3 | Harga & Pengiriman | M sampai R |
| 4 | Media | J, S sampai Y |

Catatan: kolom J posisinya dekat variasi, tetapi warnanya ikut grup Media supaya
admin langsung tahu isinya URL gambar, bukan teks biasa.

### 3.2 Template "Update Produk"

| Kol | Header | Kunci slug | Bisa diubah admin |
|---|---|---|---|
| A | SKU Produk | sku_produk | TIDAK, dikunci |
| B | Nama Produk | nama_produk | TIDAK, dikunci |
| C | SKU Varian | sku_varian | TIDAK, dikunci |
| D | Variasi | variasi | TIDAK, dikunci |
| E | Harga | harga | ya |
| F | Stok | stok | ya |
| G | Deskripsi Produk | deskripsi_produk | ya |
| H | Spesifikasi | spesifikasi | ya |

### 3.3 Template "Update Media"

| Kol | Header | Kunci slug | Bisa diubah admin |
|---|---|---|---|
| A | SKU Produk | sku_produk | TIDAK, dikunci |
| B | Nama Produk | nama_produk | TIDAK, dikunci |
| C | SKU Varian | sku_varian | TIDAK, dikunci |
| D | Variasi | variasi | TIDAK, dikunci |
| E | Gambar per Varian | gambar_per_varian | ya |
| F | Gambar 1 (utama) | gambar_1_utama | ya |
| G | Gambar 2 | gambar_2 | ya |
| H | Gambar 3 | gambar_3 | ya |
| I | Media Bersama 1 | media_bersama_1 | ya |
| J | Media Bersama 2 | media_bersama_2 | ya |
| K | Gambar Hasil Pemasangan 1 | gambar_hasil_pemasangan_1 | ya |
| L | Gambar Hasil Pemasangan 2 | gambar_hasil_pemasangan_2 | ya |

Aturan sel kosong: sel kosong TIDAK mengubah data. Ini melanjutkan kontrak lama
6 Sep 2026. Penghapusan atau arsip media dilakukan lewat panel admin media,
bukan lewat template, sehingga "kosong" tidak pernah berarti "hapus"
(keputusan owner 19 Sep 2026: penanda hapus dihapus dari template).

### 3.4 Aturan penyeragaman nama kolom

Nama kolom media WAJIB sama persis di ketiga template, satu konsep satu nama
(selaras ADR-018). Karena itu kolom foto varian bernama `Gambar per Varian` di
template Import Produk maupun di template Update Media, bukan dua sebutan
berbeda.

| Konsep | Nama kolom kanonik | Slug |
|---|---|---|
| Foto yang menempel pada varian | Gambar per Varian | `gambar_per_varian` |
| Foto katalog posisi 1, penanda utama | Gambar 1 (utama) | `gambar_1_utama` |
| Foto katalog posisi 2 dan 3 | Gambar 2, Gambar 3 | `gambar_2`, `gambar_3` |
| Media dipakai bersama seluruh varian | Media Bersama 1, 2 | `media_bersama_1`, `media_bersama_2` |
| Dokumentasi pemasangan | Gambar Hasil Pemasangan 1, 2 | `gambar_hasil_pemasangan_1`, `gambar_hasil_pemasangan_2` |

Nama kanonik ini dipakai di eksportir, importer, Panduan, dan UI admin. Dilarang
memakai sebutan lama `Gambar Opsi Variasi` atau `Foto Produk Varian`.


---

## 4. Rencana eksekusi per fase

### Fase 0: Kunci kontrak di dokumen kanonik

- Perbarui `docs/DOMAIN/import-export-katalog.md`: format v2 menggantikan v1.
- Perbarui `docs/import-template-dual-sheet.md` atau tandai usang dengan
  penunjuk ke v2.
- Tambah ADR di `docs/decisions/`: "Template katalog v2: header Indonesia,
  tiga berkas terpisah, kolom identitas dikunci".
- Syarat: tanpa em dash, Bahasa Indonesia.

### Fase 1: Tiga eksportir template

| Berkas | Kelas | Sheet | Isi baris data |
|---|---|---|---|
| Import Produk | `ProductImportTemplateExport` | `Data`, `Contoh`, `Panduan` | Contoh TERISI lengkap |
| Update Produk | `ProductUpdateTemplateExport` | `Update Produk`, `Panduan` | Data nyata dari DB, tersaring |
| Update Media | `MediaUpdateTemplateExport` (ubah yang lama) | `Update Media`, `Panduan` | Data nyata dari DB, tersaring |

Keputusan owner: sheet `Contoh` hanya ada di Import Produk. Template update
cukup `Panduan` karena bentuk barisnya sudah nyata dari data yang diunduh.

Pekerjaan:
1. Header persis seperti bagian 3, dengan warna empat grup fungsi:
   Identitas & Produk, Variasi, Harga & Pengiriman, Media. Warna grup dipakai
   konsisten di ketiga berkas.
2. Sheet Contoh (hanya Import Produk) TERISI LENGKAP: harga, stok, berat,
   dimensi, dan URL media. Ini memperbaiki kelemahan berkas owner yang
   contohnya kosong dan pernah memicu salah isi kolom dimensi.
3. Sheet Panduan per berkas: kamus kolom, aturan sel kosong, dan catatan tegas
   bahwa berat serta dimensi hanya untuk pengiriman dan tidak tampil di
   storefront. Penghapusan media lewat panel admin, bukan lewat template.
4. Dropdown kategori, model, sub model. Daftar dibaca dari database
   (`sub_models`, `CatalogLabels`), bukan ditulis tetap, supaya model atau sub
   model baru ikut otomatis.
5. Freeze pane di baris data pertama, tinggi baris header 26.
6. Format sel `@` (teks) untuk kolom SKU dan URL supaya tidak berubah jadi
   notasi ilmiah, mengikuti pelajaran kolom identitas 12 Sep 2026.
7. Template Update diisi data nyata: kolom identitas TERISI, kolom Harga/Stok/
   Deskripsi/Spesifikasi diisi NILAI SEKARANG, kolom Media DIBIARKAN KOSONG.

### Fase 2: Importer format v2 untuk Import Produk

1. Kelas importer baru, misalnya `CatalogProductsImportV2`, dengan aturan:
   - Satu baris = satu varian, grup ditentukan kolom `NO. ID`.
   - Nama, deskripsi, kategori, model, sub model diwarisi dari baris pertama
     grup, mengikuti perilaku marketplace yang sudah dipakai.
   - Harga dan stok dibaca per baris.
   - `Gambar per Varian` menempel pada varian barisnya masing-masing. URL
     berbeda untuk opsi yang sama dipasang semua pada variannya masing-masing
     (keputusan owner 19 Sep 2026), dengan catatan di Periksa file. Upserter
     idempoten, jadi tidak ada baris media kembar.
   - SKU induk dan SKU varian di-generate otomatis (awalan `RA` plus 10
     karakter acak), karena template tidak menyediakan kolom SKU.
2. Verifier disesuaikan ke kolom baru:
   - V1 grup kontigu berdasarkan `NO. ID`.
   - V2 satu `NO. ID` satu nama.
   - V3 kombinasi Opsi 1 dan Opsi 2 unik dalam satu grup.
   - V4 daftar opsi konsisten dalam satu grup.
   - V5 harga lebih dari 0 di setiap baris.
   - V7 `Gambar 1 (utama)` wajib supaya produk bisa aktif.
   - V8 berat dan dimensi wajib di baris pertama grup.
3. Format lama: ditolak dengan pesan yang menunjuk tombol unduh template baru,
   karena keputusan owner adalah sepenuhnya menggantikan. Menolak lebih selamat
   daripada memelihara dua format sekaligus.

### Fase 3: Importer Update Produk dan Update Media

1. `ProductUpdateImport`: membaca `sku_produk`, `sku_varian`, `harga`, `stok`,
   `deskripsi_produk`, `spesifikasi`.
2. `MediaUpdateImport`: pemetaan kolom lama dipindahkan ke kolom baru.
3. Kolom identitas yang dikirim balik wajib cocok dengan database. Bila tidak
   cocok, baris gagal dengan pesan jelas. Ini melanjutkan aturan lama bahwa
   salah induk adalah error per baris, bukan diam-diam diabaikan.
4. Sel kosong berarti tidak mengubah. Penghapusan gambar dilakukan lewat panel
   admin media sesuai keputusan owner 19 Sep 2026; penanda `hapus` dihapus dan
   sel berisi "hapus" kini gagal sebagai URL tidak valid.
5. Stok menerima angka biasa MAUPUN format acak seperti `random 1000-8000`,
   diproses `StockCellParser` seperti jalur import sebelumnya.
6. Preview diff sebelum simpan tetap wajib, melanjutkan kontrak 6 Sep 2026.

### Fase 4: Filter dan unduhan

1. Tambah filter di menu import: kategori produk, model produk, sub model, dan
   kata kunci. Filter yang sudah ada sekarang: status, tipe, pencarian.
2. Endpoint unduhan menerima filter yang sama sehingga admin mengunduh tepat
   bagian yang dibutuhkan.
3. Unduhan Update Produk dan Update Media terisi data nyata dari database:
   kolom identitas terisi, kolom Harga/Stok/Deskripsi/Spesifikasi terisi nilai
   sekarang, kolom Media dibiarkan kosong.
3b. Unduhan penuh tanpa filter tetap SATU BERKAS: 2.138 baris varian dari 179
   produk. Angka ini kecil untuk Excel. Yang menyelesaikan masalah kegunaan
   adalah filter, bukan pemecahan berkas. Per model terbesar 444 baris
   (JUNGKIT_2_DAUN), terkecil 24 baris (SWING_3_DAUN).
4. Siapkan agar filter mudah ditambah: satu penyaring bersama, misalnya
   `CatalogDownloadFilter`, supaya "unduh per model" dan "per sub model"
   berikutnya tidak menyalin logika.
5. Sertakan ringkasan kecil di sheet Panduan: jumlah produk, jumlah varian, dan
   filter yang dipakai, supaya admin tahu cakupan unduhannya.

### Fase 5: Proteksi kolom identitas

1. Aktifkan proteksi sheet pada ketiga template.
2. Kolom terkunci:
   - Update Produk: A sampai D (SKU Produk, Nama Produk, SKU Varian, Variasi).
   - Update Media: A sampai D.
   - Import Produk: tidak ada kolom terkunci mutlak; cukup lindungi sel di luar
     area data.
3. Gaya sel terkunci: latar abu dan teks lebih redup, supaya admin melihat
   kolom mana yang tidak boleh disentuh.
4. Catatan jujur yang WAJIB ada di Panduan: proteksi sheet Excel adalah
   pencegah salah isi, bukan keamanan. Proteksi bisa dilepas siapa pun yang
   membuka berkas. Pertahanan yang sebenarnya ada di sisi server: importer
   tetap memvalidasi dan MENOLAK perubahan SKU atau identitas, apa pun isi
   berkasnya.

### Fase 6: Verifikasi dan pembersihan

1. Tes per jalur: importer v2, verifier v2, update produk, update media.
2. Tes penjaga: header wajib persis, dan identitas tidak boleh berubah walau
   sel dikirim berbeda.
3. Bukti dengan mutasi: matikan pengunci, tes harus GAGAL, lalu pulihkan.
4. Uji unduhan bertfilter: per model, per sub model, dan penuh.
5. Pensiunkan template lama, perbarui rujukan route dan UI.
6. Jalankan quality gate: typecheck, lint, tes, build.
7. Simpan sampel hasil ke `xlsx-review/` sesuai standar "selesai".

---

## 5. Berkas yang akan disentuh

Eksportir:
- `app/Exports/ProductImportTemplateExport.php` (baru)
- `app/Exports/ProductUpdateTemplateExport.php` (baru)
- `app/Exports/MediaUpdateTemplateExport.php` (diubah ke format v2)
- `app/Exports/CatalogTemplateExport.php` (pensiun)
- `app/Exports/StockPriceTemplateExport.php` (pensiun, digantikan Update Produk)

Importer:
- `app/Imports/CatalogProductsImportV2.php` (baru)
- `app/Imports/ProductUpdateImport.php` (baru)
- `app/Imports/MediaUpdateImport.php` (baru)
- `app/Support/CatalogImportVerifier.php` (aturan v2)

Controller dan route:
- `app/Http/Controllers/Admin/ImportJobController.php`
- `routes/web.php` (3 endpoint unduhan template, menerima parameter filter)

UI:
- `resources/js/pages/Admin/ImportCreate.tsx` (pemilih template dan filter)
- `resources/js/pages/Admin/Imports/` (panel unduhan bertfilter)

Dokumen:
- `docs/DOMAIN/import-export-katalog.md`
- `docs/plans/template-katalog-v2.md` (berkas ini)
- ADR baru di `docs/decisions/`

---

## 6. Keputusan owner (sudah diputuskan 18 Sep 2026)

1. **Isi kolom saat unduhan.** Mengikuti rekomendasi: kolom yang boleh diubah
   pada template Update Produk diisi NILAI SEKARANG (harga, stok, deskripsi,
   spesifikasi), sehingga admin melihat angka lama dan preview diff punya
   pembanding. Seluruh kolom media pada template Update Media DIBIARKAN KOSONG,
   supaya tidak ada gambar tertimpa tanpa sengaja. Aturan sel kosong tetap:
   kosong berarti tidak mengubah.
2. **Penghapusan gambar lewat panel admin.** Penanda `hapus` pada kolom media
   dihapus (keputusan owner 19 Sep 2026) karena tidak ada skenario admin yang
   membutuhkannya; arsip media cukup lewat panel admin media.
3. **Sheet Contoh dan Panduan.** Sheet Contoh HANYA ada di template Import
   Produk. Template Update Produk dan Update Media hanya berisi sheet Panduan,
   tanpa Contoh, karena bentuk barisnya sudah nyata dari data yang diunduh.
4. **Stok format acak.** Tetap didukung. Nilai seperti `random 1000-8000`
   diterima dan diproses `StockCellParser` seperti pada import sebelumnya,
   di samping angka biasa.
5. **Cakupan unduhan penuh.** Diputuskan owner: TIDAK dipecah, tetap satu
   berkas. Penjelasan angkanya di bagian 6b.
6. **Penyeragaman nama kolom media.** Diputuskan owner: kolom foto varian
   bernama `Gambar per Varian`, dan nama yang sama dipakai di semua template.
   Aturan lengkapnya di bagian 3.4.

### 6b. Penjelasan pertanyaan unduhan penuh

Yang ditanyakan: ketika admin mengunduh template Update Produk atau Update
Media TANPA memilih filter, isinya adalah SELURUH katalog, yaitu 2.138 baris
varian dari 179 produk. Pertanyaannya apakah itu dijadikan satu berkas atau
dipecah beberapa berkas.

Data pendukung:

| Cakupan | Baris varian |
|---|---|
| Seluruh katalog tanpa filter | 2.138 |
| Per model terbesar, JUNGKIT_2_DAUN | 444 |
| Per model terkecil, SWING_3_DAUN | 24 |
| Jumlah product_media | 1.335 |

Rekomendasi: TETAP SATU BERKAS untuk unduhan penuh. Alasannya 2.138 baris
dengan 11 kolom masih kecil untuk Excel dan tidak bermasalah dibuka, sementara
memecah otomatis menimbulkan pertanyaan baru (dipecah per apa, dan bagaimana
admin menggabungkan kembali hasilnya). Yang menyelesaikan masalah kegunaan
bukan pemecahan berkas, melainkan FILTER: admin yang hanya ingin mengurus satu
model cukup memilih model itu dan mengunduh 24 sampai 444 baris.

Bila nanti terbukti lambat, batas aman bisa ditambahkan sebagai pengaman:
unduhan tanpa filter di atas ambang tertentu dipecah per model secara otomatis
dengan nama berkas memuat nama modelnya.

## 7. Urutan pengerjaan yang disarankan

Fase 1 dan Fase 2 harus rilis bersamaan, karena menambah dukungan baca tanpa
template baru tidak berguna, dan sebaliknya template baru tanpa dukungan baca
membuat admin tidak bisa import sama sekali.

Urutan aman:
1. Fase 0 (kontrak dokumen) dan Fase 1 (eksportir) lebih dulu, supaya template
   baru bisa diunduh dan diperiksa owner.
2. Fase 2 (importer import produk) menyusul, langsung diikuti uji coba import
   nyata dengan berkas kecil.
3. Fase 3 (update produk dan media) setelah import produk terbukti benar.
4. Fase 4 (filter dan unduhan) menyusul.
5. Fase 5 (proteksi) dan Fase 6 (verifikasi) menutup.

---

## 8. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kolom identitas diubah di berkas update | Data produk tertukar | Kunci di Excel dan tolak di server |
| Proteksi dilepas manual | Guard tampak gagal | Validasi server sebagai pertahanan utama |
| Unduhan penuh 2.138 baris berat | Proses lambat | Filter per model, batas baris, unduhan per bagian |
| Satu opsi muncul di banyak baris | Gambar opsi menjadi banyak baris kembar | Upserter idempoten per varian + aset; catatan di Periksa file bila URL berbeda antar baris |
| Template baru belum terbaca importer | Import gagal total | Fase 1 dan 2 rilis bersamaan |
| Berkas lama sudah beredar di tangan admin | Upload gagal | Pesan galat menunjuk tombol unduh template baru |
| Contoh kosong ditiru admin | Data tidak lengkap, produk tidak aktif | Contoh terisi lengkap dan verifier menolak yang kosong |

---

## 9. Ringkasan perbedaan v1 ke v2

| Aspek | v1 | v2 |
|---|---|---|
| Jumlah berkas | 1 berkas, banyak sheet | 3 berkas terpisah |
| Bahasa header | Inggris teknis | Indonesia |
| Opsi varian | kolom opsi 1 sampai 4 di baris pertama grup | satu baris satu varian |
| Kunci grup | `id_key` | `NO. ID` |
| Kombinasi varian | kolom khusus, mudah salah | terbentuk dari Opsi Variasi 1 dan 2 |
| Kedalaman | kolom `depth_cm` | kolom `Lebar (cm)` |
| Kolom identitas | bebas diubah | dikunci dan divalidasi server |
| Unduhan update | kosong | terisi data nyata, tersaring |
| Contoh | terisi sebagian | terisi lengkap |
| Panduan | ada | ada per berkas |

---

## Catatan keputusan owner (19 Sep 2026)

- Import Produk hanya membuat produk BARU (pola Shopee Mass Upload). Baris
  yang identitasnya (nama + kategori + model + sub-model) cocok dengan produk
  aktif yang sudah ada ditolak saat Periksa file dengan menyebut SKU existing.
  Duplikat identitas dalam satu berkas juga ditolak (verifier V8).
- Perubahan isi produk selalu lewat template Update Produk / Update Media
  yang berbasis SKU Produk dan SKU Varian.
- Sel angka menerima format ribuan Indonesia (1.250.000) dan desimal koma
  (1.250,50); harga 0 atau negatif ditolak.
- Penanda hapus media dihapus dari template; arsip media lewat panel admin.
