# ADR-021: Ulang Model Varian & Form Produk Sesuai Format Katalog Ragil

- Status: **Accepted** (2026-09-03)
- Pemutus: Owner (Ragil)
- Ruang lingkup: Admin, form Tambah/Edit Produk (UI, payload, dan pengalaman)

## Konteks

Form varian saat ini membingungkan: "Nama opsi 1/Nilai opsi 1", lima pasang input sekaligus, harga/stok/dimensi dicampur di baris varian, dan dimensi dikira per varian. Pola input marketplace (Tiara/TikTok Shop) yang biasa dipakai tim juga tidak direplikasi. Kontrak J&T Cargo memakai berat paket per pengiriman (kg) plus dimensi kubikasi, bukan per kombinasi varian.

## Keputusan (verbatim owner, distrukturkan)

1. **Nama varian bisa diubah**, mis. "Warna" atau "Kaca" (bukan terkunci "Nama opsi 1").
2. **Nilai opsi di bawah nama varian**: mis. Warna → Hitam, Putih; Kaca → Bening, Kaca Es.
3. **Nilai opsi bisa ditambah** dalam varian yang sama.
4. **Harga & stok per KOMBINASI opsi** (Hitam+Kaca Es ≠ Hitam+Bening), diisi **setelah semua varian & opsi tersimpan**, dalam tabel matriks.
5. **Stok mendukung format acak**: "random 8000-9000" per kombinasi.
6. **Lebar/Tinggi/Tebal/Berat pindah ke pengaturan utama produk** (identitas/pengiriman), TIDAK per varian.
7. **Media (foto/video) jadi tahap setelah** harga & stok selesai.
8. **Taksonomi (Kategori/Model/Sub Model) masuk ke section Identitas**.
9. **Section Beranda dihapus** dari form produk.
10. **Nama pendek dihapus** dari form; dibuat **sepenuhnya otomatis** (turunan dari varian/nama produk).
11. Format pengiriman mengikuti kebutuhan **J&T Cargo** (berat kg + dimensi cm di level produk).

## Desain baru (3 tahap ringkas)

```
Tahap 1  Identitas   : Nama*, Deskripsi*, Kategori*, Model*, Sub Model,
                       Berat*, Lebar*, Tinggi*, Tebal*  (J&T: kg + cm)
Tahap 2  Varian      : Nama varian bebas (mis. Warna) + daftar Nilai opsi
                       (Hitam/Putih) + tambah baris opsi & tambah varian;
                       tanpa harga/stok/dimensi di sini
Tahap 2b Harga&Stok  : matriks kombinasi (Hitam×Bening, Hitam×Kaca Es, …)
                       kolom Harga, Stok (angka atau "random 8000-9000")
Tahap 3  Media       : MediaPicker (upload langsung / dari Media Library)
Tahap 3b Publish     : Simpan draf | Simpan & tambah baru | Aktifkan (checklist)
```

- Checklist aktivasi tetap server-side (aturan lama), kini menunjuk tahap yang kurang.
- SKU varian tetap otomatis (`ShopeeStyleSku`), tidak diisi manual.
- Tanpa varian → satu varian tunggal otomatis (harga/stok di Tahap 2b).

## Konsekuensi

- Positif: alur sama persis dengan intuisi admin & format katalog (1 baris = 1 opsi, harga per kombinasi), sesuai kontrak J&T, form lebih pendek.
- Netral: import XLSX tidak berubah (sudah 1 baris per kombinasi).
- Risiko: migrasi kebiasaan admin lama, ditangani teks panduan di tiap tahap.
