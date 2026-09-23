# Tugas Terpisah: Audit Alias Kategori Warisan

Dibuat: 2026-09-24. Status: **belum dikerjakan**, tugas berdiri sendiri.
Pemicu: eksekusi Opsi B (commit `bb3b10b6`) menyisakan satu hal yang sengaja
belum dibersihkan, yaitu dukungan baca atas kode kategori warisan.

Owner meminta: gunakan format yang aktif saja, tanpa mengabaikan kategori baru
di masa depan, dan kondisinya harus rapi untuk cutover. Tugas ini melengkapi
permintaan itu; eksekusinya sengaja dipisah karena dampaknya menyentuh 74
berkas test.

---

## 1. Kondisi sekarang

Data produksi **bersih**: tidak ada satu pun produk yang memakai kode warisan.

```text
products.product_category  =  JENDELA (120), BOVEN (62), PINTU (1)
kode warisan di data       =  0 baris
```

Karena itu seluruh dukungan alias yang tersisa di kode **tidak berpengaruh ke
tampilan hari ini**. Ia hanya hidup karena 74 berkas fixture test masih membuat
produk dengan `product_category = 'WINDOW'` / `'DOOR'` / `'BOUVEN'`.

Kalau dukungan alias dipindahkan sekarang tanpa memigrasi fixture, suite test
akan merah di banyak tempat. Itu sebabnya tugas ini dipisah.

---

## 2. Permukaan yang harus dibersihkan

Semua di bawah `app/Support/` kecuali disebut lain.

| Lokasi | Yang perlu dilakukan |
|---|---|
| `CategoryUrl::CODE_TO_PRODUCT` | hapus peta alias, sisakan identitas |
| `CategoryUrl::FALLBACK_SLUG_BY_CODE` | hapus; `categoryToSlug()` sudah punya fallback `strtolower` |
| `CategoryUrl::ALIAS_SLUG_TO_CODE` | hapus; `categoryFromSlug()` cukup membaca tabel `categories.slug` |
| `CatalogLabels::CATEGORY` | hapus 3 baris alias English (`WINDOW`, `DOOR`, `BOUVEN`) |
| `CatalogLabels::categoryCodesWithLegacy()` | hapus fungsi, ubah 10 pemanggil jadi `where('product_category', $code)` |
| `CatalogLabels::normalizeCategory()` | hapus peta alias di dalamnya, sisakan resolusi dari tabel |
| `CatalogLabels::categoryCodes()` | hapus (kode mati, tanpa pemanggil) |

Perhatikan dua pemanggil yang mencocokkan tanpa normalisasi dan harus ikut
dirapikan di tugas ini:

- `ModelProductService` (pencocokan `cms_model_products.product_category` ke
  `products.product_category`): tanpa normalisasi, kartu model produk bisa
  hilang bila ada produk berkode warisan.
- `ModelProductPresentation::inspirationByPair()`: jumlah foto inspirasi
  membaca `products.product_category` mentah.

---

## 3. Migrasi fixture test (sisi terbesar)

74 berkas test, 143 kemunculan. Pola yang aman diubah otomatis:

```text
'product_category' => 'WINDOW'  ->  'product_category' => 'JENDELA'
'product_category' => 'DOOR'    ->  'product_category' => 'PINTU'
'product_category' => 'BOUVEN'  ->  'product_category' => 'BOVEN'
```

Perkiraan 134 dari 143 kemunculan berbentuk fixture seperti itu. Sisanya perlu
dibaca satu per satu karena bukan fixture:

- `activeModel => 'WINDOW|SLIDING'` dan sejenisnya: asersi kode aktif.
- `route('installation.model', ['category' => 'window', ...])`: slug URL.
- `$this->get('/products/bouven')`: URL publik.
- `CatalogSearch::normalizeQuery('jendela bouven')`: normalisasi pencarian.
- `'parent_sku' => 'DOOR-S-1'`: penamaan SKU, **jangan diubah**.
- komentar kode: boleh diperbarui, boleh dibiarkan.

Alat bantu yang sudah ada dan bisa dipakai ulang:
`docs/AUDIT-ADMIN/tools/migrate-test-form-payloads.mjs` (migrasi payload form,
sudah dipakai untuk 4 berkas pada Opsi B) dan
`docs/AUDIT-ADMIN/tools/migrate-test-form-payloads.mjs` perlu diperluas agar
juga menangani fixture `Product::create`.

---

## 4. Keputusan yang dibutuhkan owner

**K-1. URL English lama, tetap dialihkan atau dibiarkan 404?**
Saat ini `categoryFromSlug('window')` memetakan ke `JENDELA`, sehingga tautan
lama bertahan. Setelah peta alias dihapus, tautan itu 404. Karena slug kanonik
di `categories.slug` adalah `jendela`/`pintu`/`boven` sejak migrasi normalisasi,
kemungkinan besar tidak ada tautan `window` yang terindeks. Perlu dipastikan
sebelum dihapus; bila ingin aman, redirect 301 bisa dipertahankan hanya di
lapisan URL tanpa memasukkan alias ke pemetaan kode.

**K-2. Apakah `categories.code` boleh berubah untuk kategori yang belum dipakai?**
Saat ini boleh (penjaga hanya mengunci yang sudah dipakai produk). Kalau ingin
lebih ketat, kode bisa dikunci permanen sejak dibuat.

---

## 5. Langkah eksekusi yang disarankan

1. Jalankan migrasi fixture otomatis (bagian 3), lalu suite penuh.
2. Tangani sisa kemunculan manual satu per satu (bagian 3).
3. Hapus peta alias di `CategoryUrl` dan `CatalogLabels` (bagian 2).
4. Rapikan dua pemanggil tanpa normalisasi (bagian 2).
5. Putuskan K-1, lalu seragamkan perilaku URL.
6. Jalankan suite penuh, build, dan verifikasi katalog publik plus mega-menu.
7. Perbarui dokumen skema bila ada kolom atau indeks yang berubah.

Estimasi lingkup: 74 berkas test + 4 berkas `app/Support` + 2 berkas service +
3 berkas controller. Tidak menyentuh data produksi sama sekali.
