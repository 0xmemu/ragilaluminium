# ADR-019: Template Atribut Otomatis per Sub Model

- Status: **Accepted** (2026-09-03)
- Pemutus: Owner (Ragil)
- Ruang lingkup: Produk admin + impor katalog + Sub Model admin

## Konteks

Spesifikasi/atribut produk dihitung opsional (ADR: ADR-019 terkait — lihat commit `0031ee5`: spesifikasi dilepas dari checklist publish). Namun produk yang punya atribut menampilkan info lebih baik ke pembeli (bagian "Informasi produk" di halaman produk). Mengisi atribut manual untuk setiap produk (UI maupun kolom `specifications` JSON di import) berulang dan rawan dilupakan.

## Keputusan

1. **Template atribut per Sub Model**: tabel `sub_model_attribute_templates` menyimpan daftar pasangan nama/nilai yang menempel ke `sub_model_id` (desain) dengan `product_model` sebagai keyer.
2. **Fallback default model**: bila sub model sebuah produk tidak punya template, sistem memakai template default model (`sub_model_id` NULL, `product_model` sama).
3. **Otomatis & tidak menimpa**: template diterapkan saat (a) produk dibuat dari UI (POST store), dan (b) impor masal yang barisnya tidak membawa spesifikasi. Atribut yang sudah ada TIDAK pernah ditimpa.
4. **Manajemen**: daftar template di-editing di halaman Edit Sub Model (seksi "Template atribut produk"); daftar menggantikan template lama (replace strategi).
5. **Sumber atribut**: selalu `internal`.

## Konsekuensi

- Produk baru otomatis mendapat atribut default tanpa input admin tambahan.
- Import masal cukup kosongkan kolom `specifications`; template mengisi sisanya.
- Admin dapat mengosongkan daftar template untuk mematikan otomatisasi.
- **Diterima 2026-09-03** dengan implementasi `AttributeTemplateService` di commit khusus.
