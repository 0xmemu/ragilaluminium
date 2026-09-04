# Template Import Katalog: Skema Dua Sheet (Varian + Kombinasi)

Update: 2026-09-04. Menggantikan skema kolom tunggal lama sebagai template default.
File lama tetap bisa diproses (back-compat).

## Struktur file

Sheet 1 "Kombinasi" (sheet pertama, dibaca import engine):

```text
name, description, product_category, product_model, design_variant, specifications,
option_1, option_2, option_3, option_4, option_5,
price, stock, weight_kg, height_cm, width_cm, depth_cm,
installation_image_url
```

- 1 baris = 1 varian jadi (kombinasi opsi). `price` + `stock` WAJIB per baris.
- Kolom identitas (name s.d. specifications) cukup di baris PERTAMA produk;
  baris lanjutan diwarisi dari baris atasnya.
- `option_1` = nilai varian ke-1, `option_2` = varian ke-2, urut mengikuti
  urutan varian di sheet Varian.
- `installation_image_url` = foto hasil pemasangan umum (opsional).
- Dropdown validasi untuk kategori/model/desain tersedia di template.

Sheet 2 "Varian" (definisi opsi + gambar per opsi):

```text
varian_name | option | image_url | installation_image_url
Warna       | Hitam  | https://... |
            | Putih  | https://... |
Kaca        | Bening | https://... | https://... (pasang)
```

- 1 baris = 1 opsi. `varian_name` ditulis di baris opsi pertama varian itu.
- `image_url` per opsi: gambar ini dipakai varian mana pun yang memakai opsi tsb.
- `installation_image_url` per opsi: foto pemasangan khusus opsi (opsional).
- Tambah varian = tambah nama varian baru. Tambah opsi = tambah baris. Tanpa batas.

Sheet 3 "Panduan" berisi ringkasan aturan.

## Default template

- 2 varian name siap isi (Warna, Kaca), masing-masing baris opsi disiapkan 4.
- Kombinasi menyediakan kolom option_1..option_5 (varian ke-3..5 tinggal diisi;
  butuh varian ke-3 berarti isi option_3 di sheet Kombinasi).

## Batas

- Maks 5 varian name (kolom DB `product_variants.variation_1..5_*`).
- Opsi per varian bebas (baris bebas).
- 50.000 baris per file.
- Baris tanpa opsi varian sama sekali diabaikan importer.

## Back-compat (file lama)

Kolom legacy tetap diterima: `variation_1..5_name/option`, `image_1..9`,
`installation_image_1..9`. File yang punya sheet "Varian" otomatis diproses
dengan skema baru; gambar legacy tidak dicampur dengan gambar per opsi.
`parent_sku`/`variant_sku` eksplisit tetap didukung untuk mode update.

## Alur internal

- Template: `App\Exports\CatalogTemplateExport` (3 sheet class).
- Parser sheet Varian: `App\Support\VariantSheetParser`.
- Import: `App\Imports\CatalogProductsImport` (baca sheet pertama + parser).
- Row counting & preview: `Admin\ImportJobController@store/previewCatalog`.
