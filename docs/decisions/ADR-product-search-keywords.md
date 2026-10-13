# ADR: Product Search Keywords & Short Name Generator

- Status: Accepted (2026-08-25)
- Konteks: Task import-katalog-indonesia Fase 3 (owner).

## Apa
Service `App\Support\ProductSearchKeywordService` meng-generate dua kolom
produk: `short_name` (format dimensi `200x180`) dan `search_keywords` (teks
gabungan token pencarian), otomatis via observer dan setelah import.

## Kenapa
Pencarian katalog saat ini hanya LIKE terhadap `name` & `short_name` (yang
sebagian besar kosong). Pengguna mencari "200x180" atau "jungkit ornamen"
tanpa mengetik nama lengkap; token berdimensi tidak ada di kolom mana pun.

## Bagaimana
3 lapis berjenjang (struktur > parse nama > fallback):
1. short_name dari varian aktif pertama yang punya dimensi ({tinggi}x{panjang},
   angka tanpa nol belakang) + label kategori/model/desain.
2. Parse nama: regex dimensi cm (x/×) -> token `{h}x{w}`; token kata bebas
   dengan stopword minimal (tinggi/panjang/cm/mm/x; aluminium TETAP disimpan).
3. Tanpa dimensi: short_name tetap null (tidak mengarang); keywords tetap terisi.
`search_keywords` selalu ditimpa; `short_name` hanya diisi bila masih kosong
(nilai manual admin dilindungi). Nama mentah tetap dicari via LIKE name.

Pemicu: observer Product::saved & ProductVariant::saved; setelah import sukses;
command `catalog:regenerate-search {--fresh}` (chunk 200).

## Dampak
- Pencarian "200x180" & "jungkit ornamen" jauh lebih akurat.
- Beban: regenerate ringan (observer dijalankan tiap save produk/varian).
- Index biasa pada search_keywords (FULLTEXT tidak wajib pada skala ini).

## Pertimbangan
- FULLTEXT ditunda: LIKE cukup utk skala saat ini; hindari kompleksitas parser
  MySQL vs sqlite di test.
- Stopword dijaga MINIMAL: kata kunci seperti "daun"/"aluminium" penting.

## Alternatif
- FULLTEXT index: ditolak (kompleksitas + tidak mendukung sqlite test).
- Parse di frontend: ditolak (inkonsisten lintas halaman).
