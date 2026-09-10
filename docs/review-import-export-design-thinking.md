# Review Hasil Kerja Sesi Ini terhadap docs/design-thinking-stack.md

Tanggal: 2026-09-05. Objek: sistem import katalog (id_key + V1-V8), update
harga/stok, update media, export produk 5 sheet, flow Periksa file wajib.
Dokumen acuan: `docs/design-thinking-stack.md` (adaptasi Laravel dari
`docs/design_thinking.md`, X -> Graph -> Effect<A,E,R>).

## Graph utama yang dibangun

```
Admin upload file
  -> FormRequest validasi (type, mimes, max 50MB)     [boundary]
  -> previewUpdate / previewCatalog (Periksa file)    [boundary schema]
       -> Verifier (katalog V1-V8 / update U,M)       [unknown -> trusted]
  -> Mulai Import aktif hanya jika lolos
  -> ImportJob create -> dispatch ProcessCatalogImport
       -> pre-pass verify ulang (lapis kedua)         [E: die sebelum eksekusi]
       -> DB::transaction { Excel::import(onRow) }    [scope: commit/rollback]
            -> per baris: updateOrCreate produk/varian/media
            -> per baris error -> ImportJobRow failed [E: escape, job tetap]
  -> summary sukses/failed/skipped per baris
```

## Hasil review per poin

- S1 Shapes: OK. Shapes eksplisit: id_key (grup sesi), parent_sku/variant_sku
  (identitas permanen), kombinasi (baris varian jadi), ImportJobRow.status
  (success/failed/skipped). Kontrak id_key vs SKU dipisah tegas dan didokumentasi.
- S2 A (happy path): OK. Graph A jelas dan diikuti kode: upload -> periksa ->
  eksekusi -> summary. Periksa file wajib sebelum Mulai Import membuat A tidak
  bisa di-skip.
- S3 Cardinality: OK. Upload/preview = sekali (request). Eksekusi = queue job
  (berulang asinkron), polling UI untuk progres. Media download = job terpisah.
- S4 E: OK setelah review. Klasifikasi jelas:
  - die: file gagal verifikasi (throw sebelum eksekusi), host media tidak
    diizinkan (invariant), variant_sku milik produk lain (invariant).
  - escape: baris tanpa gambar = skipped (media_update), URL internal pakai
    aset existing tanpa download, stok kosong + mode manual = fallback manual.
  - retry: download media 429/5xx lewat queue retry.
- S5 R: OK. Verifier menerima dependency eksplisit (type, manualStock), importer
  menerima jobId + path. UI menerima previewUrl/previewUpdateUrl/csrf sebagai
  props. Tidak ada hidden dependency yang ditemukan.
- S6 Boundary: OK. Semua input file tervalidasi di controller (mimes, size,
  type in:). CSRF ditambahkan ke fetch manual (kesalahan lama yang sudah
  dikoreksi). Verifier = schema yang mengubah file tak tepercaya jadi data
  terpercaya, satu definisi dipakai di 3 titik (preview, store, job).
- S7 Behavior: OK. Verifikasi pre-pass, summary, dan correction file membungkus
  flow tanpa mengubah logika baris. All-or-nothing ditambah sebagai lapisan
  terpisah, bukan menyisipkan if di tiap baris.
- S8 Scope: DIPERBAIKI saat review ini. Temuan: eksekusi import TIDAK dibungkus
  DB::transaction, artinya error runtime di tengah eksekusi menyisakan data
  parsial dan melanggar kontrak all-or-nothing. Fix: Excel::import dibungkus
  DB::transaction di ProcessCatalogImport (commit 5eef752). Commit = sukses,
  throw = rollback struktural. 19 test import lulus setelah fix.
- S9 Test swap R: OK. 19 test import lulus dengan R test (Queue::fake,
  config media host test, sqlite). Kegagalan test di domain lain (search, ETA,
  retur) terverifikasi pre-existing via git stash, bukan regresi graph import.
- S10 A/E separation: OK setelah review. Importer onRow = happy path; error
  baris ditangkap di catch tunggal akhir; verifier throw di awal; controller/
  job yang menerjemahkan error ke pesan. Sheet export membaca kontrak importer
  (dataHeaders) alih-alih mendefinisikan format sendiri, mencegah dua sumber
  kebenaran format.

## Temuan & perbaikan

1. (FIXED) Eksekusi import tanpa DB::transaction -> dibungkus transaction
   (5eef752). Ini temuan paling penting: kontrak all-or-nothing sebelumnya
   hanya setengah benar (pre-pass menangkap error struktur, error runtime
   tengah eksekusi menyisakan data parsial).
2. (FIXED lebih awal) Preview fetch tanpa CSRF -> 419 tersamarkan pesan
   "format salah". Diperbaiki: token dikirim, 419 diberi pesan jujur (3acbdff).
3. (FIXED lebih awal) Sheet export Update Media mengisi media per varian
   padahal media tersimpan product-level -> 574/579 baris kosong. Dikoreksi
   mengikuti kontrak importer: variant_sku kosong = level produk (bde516f).
4. (DOKUMENTASI) Kontrak media_update diverifikasi ulang dari importer:
   variant_sku kosong = level produk, sel kosong = tidak diubah. Komentar kode
   sheet export dikoreksi agar mencerminkan kontrak (82d6fb2).

## Kesimpulan

Graph import/export sekarang konsisten dengan dokumen design thinking:
boundary memvalidasi, verifier adalah schema, all-or-nothing adalah scope
(transaction), error diklasifikasikan die/escape/retry, dan format export
mengambil kontrak dari importer (satu sumber kebenaran). Tidak ada pelanggaran
struktural yang tersisa dari hasil kerja sesi ini.
