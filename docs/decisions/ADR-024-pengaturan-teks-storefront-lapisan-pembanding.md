# ADR-024: Pengaturan teks storefront adalah lapisan pembanding, bukan sumber teks

- **Status:** diterima
- **Tanggal:** 2026-09-20
- **Konteks:** halaman Pengaturan Website > CTA Storefront

## Masalah

Halaman pengaturan CTA Storefront dibangun dengan pola "nilai awal" di PHP:
`CtaSettings::INITIAL_TEXT`, `INITIAL_ACTIONS`, dan `INITIAL_ITEMS` menyalin teks
storefront ke dalam kode, lalu `get()` memakai nilai itu sebagai cadangan saat
`cms_pages` masih kosong.

Pola itu melahirkan tiga cacat nyata:

1. **Teks storefront membeku.** Karena `get()` mengembalikan nilai awal, halaman
   admin menampilkan teks yang tampak dapat disunting, lalu `update()` menulis
   salinannya ke DB. Begitu tersimpan, memperbarui teks di kode tidak lagi
   berpengaruh: storefront membaca salinan lama dari DB.
2. **Nilai awal dikarang untuk blok yang dinamis.** Daftar alasan belanja di
   halaman detail produk dihitung per produk (label garansi mengikuti promo yang
   berlaku, baris COD hilang saat produk tidak mendukung COD). Nilai awal berupa
   daftar statis menimpa hitungan itu. Warna banner dipaksa `#C00000` padahal
   storefront memakai token `bg-primary`.
3. **Dua sumber teks.** Teks storefront ada di komponen React, teks yang
   ditampilkan admin ada di konstanta PHP. Keduanya bisa berbeda tanpa ada yang
   tahu, dan memang berbeda: blok "Beranda: bagian Kami bantu" menampilkan kop
   dan judul banner, bukan isi kartunya.

Owner menemukan cacat ini sebagai admin yang melihat teks di halaman pengaturan
tetapi tidak menemukannya di storefront.

## Keputusan

**Pengaturan teks storefront adalah lapisan pembanding. Kolom yang belum
disimpan bernilai `null` (atau daftar kosong), dan komponen storefront memakai
teksnya sendiri.**

Konsekuensi yang mengikat:

1. `CtaSettings::get()` mengembalikan `null`/kosong untuk setiap kolom yang belum
   disimpan admin. Tidak ada nilai awal yang dikarang di PHP.
2. Membaca atau menyimpan pengaturan **tidak boleh** menyalin teks storefront ke
   `cms_pages`. Menyimpan hanya menulis nilai yang benar-benar diisi admin.
3. Teks live didefinisikan **satu kali** di `resources/js/lib/cta-live.json`,
   dibaca PHP untuk halaman admin dan diimpor React sebagai cadangan komponen.
   Halaman admin karena itu tidak mungkin menampilkan teks yang berbeda dari
   yang dirender storefront.
4. Kolom kosong berarti "pakai teks storefront", dan itu ditampilkan sebagai
   keadaan yang sah di halaman admin, bukan sebagai kesalahan isian.
5. Blok yang nilainya dihitung runtime (mis. daftar alasan belanja PDP) ditandai
   `dynamic` dan nilai contohnya tidak pernah menimpa hitungan komponen sampai
   admin benar-benar menyimpan.

## Alternatif yang ditolak

- **Tetap memakai nilai awal PHP, tetapi jangan ditulis saat simpan.** Mengatasi
  pembekuan teks, tetapi dua sumber teks tetap ada, jadi halaman admin masih
  bisa menampilkan teks yang tidak ada di storefront. Cacat nomor 3 di atas
  adalah buktinya.
- **Membaca teks live dari DOM storefront.** Tidak dapat dijalankan di server,
  dan halaman admin tidak boleh bergantung pada render storefront.
- **Memindahkan semua teks ke DB dan menghapus teks dari kode.** Mengubah
  storefront secara diam-diam saat deploy, dan menghilangkan kemampuan
  memperbarui teks lewat rilis kode. Bertentangan dengan kontrak "perubahan baru
  berlaku setelah admin menyimpan".

## Akibat

- Menambah atau mengubah blok CTA berarti mengubah `cta-live.json`, bukan
  menambah konstanta di PHP. Halaman admin dan komponen storefront ikut
  otomatis karena membaca berkas yang sama.
- Komponen wajib menyediakan teks cadangannya sendiri di kode. Itu memang
  keadaannya: teks itu sudah ada di sana sejak awal.
- Halaman admin menampilkan dua keadaan per blok ("Teks storefront" / "Diatur
  admin") dan menyediakan tombol "Salin teks storefront" serta "Pakai teks
  storefront", supaya admin menyunting dari keadaan nyata dan bisa membatalkan
  satu blok tanpa menyentuh blok lain.
- Kontrak detail untuk penulis kode ada di
  `frontend/docs/UI-CONSISTENCY-CONTRACT.md`, bagian "CTA storefront".
- Ditegakkan test `tests/Feature/CtaStorefrontTest.php`: kolom kosong sebelum
  disimpan, simpan hanya mengubah blok yang diisi, dan registry memuat seluruh
  blok yang tampil.
