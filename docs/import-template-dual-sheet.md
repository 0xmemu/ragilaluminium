# Template Import Katalog: Skema Owner (Data/Contoh/Panduan) + ID KEY & Verifikasi

Update 2026-09-05 (v3): kolom id_key + verifikasi pre-pass all-or-nothing (V1-V6).

## ID KEY (kolom paling kiri)

- id_key = penanda grup produk. Semua baris dengan id_key sama = satu produk.
- WAJIB di baris pertama grup; disarankan diisi di SEMUA baris grup.
- Baris pertama grup = baris dengan id_key baru muncul; kolom identitas &
  definisi opsi cukup di baris itu.
- id_key bebas angka/teks (1, 2, PROD-A). Tidak disimpan ke DB, tidak
  memengaruhi SKU.

## Verifikasi otomatis (all-or-nothing, V1-V6)

Dijalankan saat upload (preview + store) dan lagi di job sebelum eksekusi.
Satu pelanggaran = import dibatalkan, NOL produk dibuat:

- V1: id_key tidak boleh muncul kembali setelah digantikan (grup kontigu).
- V2: satu id_key = satu name (nama beda dalam grup = gagal).
- V3: variantion_combination unik dalam satu id_key.
- V4: daftar opsi varian identik di semua baris satu id_key.
- V5: price wajib > 0 pada tiap baris kombinasi.
- V6: id_key adalah kunci grup (fallback name bila kolom tidak ada).

Pelaksana: App\Support\CatalogImportVerifier (store, previewCatalog,
CatalogProductsImport pre-pass).

Update: 2026-09-05. Menggantikan skema dua sheet (Varian+Kombinasi) sebagai
format default, sesuai rancangan owner (2026-09-05).

## Struktur file

Sheet 1 "Data" (diproses importer) - 1 baris = 1 KOMBINASI varian jadi:

- Identitas produk: name, description, product_category, product_model,
  design_variant, specifications. Cukup di baris pertama produk; baris
  lanjutan diwarisi. Format specifications: "Nama: Nilai" dipisah koma,
  contoh "Bahan: Aluminium, Kaca: Tempered, Kusen: 4 inch". Titik koma dan
  baris baru juga diterima. Koma di dalam nilai aman (koma hanya memulai
  spesifikasi baru bila diikuti "Nama: Nilai"), mis. "Finishing: Powder
  coating (pilihan: hitam, putih, cokelat)".
- Definisi varian (sekali di baris pertama produk): variation_1_name +
  variation_1_option_1..4, variation_2_name + variation_2_option_1..4.
  Tambah pilihan = copy kolom (option_5, option_6, dst). Maks 5 varian name.
- Per kombinasi: variantion_combination ("Putih, Kaca Bening", urut sesuai
  varian), price_variantion_combination, stock (opsional).
- Gambar: image_1..2 (katalog umum), image_variation_1_option_1..4 +
  image_variation_2_option_1..4 (per opsi; cukup diisi sekali di baris
  pertama produk), shared_media_1..2 (media bersama, boleh video),
  installation_image_1..2 (tambah = copy kolom).
- Baris penanda "CONTOH: hapus..." diabaikan importer.

Sheet 2 "Contoh": ilustrasi 12 kombinasi (4 warna x 3 kaca), tidak diproses.
Sheet 3 "Panduan": penjelasan kolom.

Ejaan: importer menerima variantion_* dan variation_* (termasuk
image_variantion_name_N_option_M dari file rancangan owner).

## Back-compat

- Skema dua sheet sebelumnya (Varian + Kombinasi): tetap diproses.
- Skema lama: variation_1..5_name/option, image_1..9, installation_image_1..9:
  tetap diproses.
- File owner yang dicampur (image_1 umum + gambar per opsi): didukung;
  gambar per opsi ditaruh di posisi 10+, shared media di 51+, installation 100+.

## Alur internal

- Template: App\Exports\CatalogTemplateExport (Data/Contoh/Panduan).
- Import: App\Imports\CatalogProductsImport (cell() toleran ejaan,
  groupVariantNames/groupOptionImages per grup produk).
- Parser sheet Varian lama: App\Support\VariantSheetParser (dipertahankan).
