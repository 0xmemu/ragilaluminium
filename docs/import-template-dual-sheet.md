# Template Import Katalog: Skema Owner (Data/Contoh/Panduan)

Update: 2026-09-05. Menggantikan skema dua sheet (Varian+Kombinasi) sebagai
format default, sesuai rancangan owner (2026-09-05).

## Struktur file

Sheet 1 "Data" (diproses importer) - 1 baris = 1 KOMBINASI varian jadi:

- Identitas produk: name, description, product_category, product_model,
  design_variant, specifications. Cukup di baris pertama produk; baris
  lanjutan diwarisi.
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
