# ADR-020: Form Produk Satu Halaman Tanpa Gerbang Simpan-Dulu

- Status: **Accepted** (2026-09-03)
- Pemutus: Owner (Ragil)
- Ruang lingkup: Admin, alur Tambah/Edit Produk
- Referensi riset: pola upload produk Shopify (single page, wajib minimal), TikTok Shop/Tokopedia (1 halaman section terlihat, live checklist, draf vs publish), Shopee (foto di posisi pertama)

## Konteks

Flow tambah produk lama mengikuti pola wizard tersirat: identitas harus disimpan dulu (sebagai arsip) sebelum bagian varian, media, dan review terbuka. Media dikelola lewat halaman terpisah dengan tautan Media Library. Akibatnya admin butuh 12-15 interaksi untuk produk pertama, kehilangan data bila keluar sebelum simpan pertama, dan berpindah halaman hanya untuk memasang foto.

## Keputusan

1. **Satu halaman penuh.** Semua section langsung tersedia pada produk baru tanpa gerbang "simpan dulu": Foto, Informasi produk, Varian & harga, Pengiriman. Checklist aktivasi tetap sticky di kanan.
2. **Foto paling atas** (pola Shopee/Shopify): media adalah input pertama.
3. **Dua jalur media di dalam form** (keputusan owner): **upload langsung dari form** (drag & drop / file picker) **atau pilih dari Media Library**. Tidak ada kewajiban membuka halaman Media Library.
   - Upload langsung memakai endpoint `admin.media.upload` yang sudah ada (browser → disk media, aset langsung `ready`), lalu dilampirkan via `MediaAssetResolver::attach()` dengan flag `show_in_catalog`/`is_installation`.
   - Pilih dari Media Library = pencarian aset `ready` + attach serupa.
4. **Simpan sekali jadi.** Satu submit menyimpan identitas + media + varian + pengiriman sekaligus. Endpoint `products.store` diperluas menerima seluruh payload; bagian yang belum diisi boleh kosong (produk tetap arsip).
5. **Publish tetap keputusan eksplisit**: tombol "Aktifkan" divalidasi checklist server-side (semua aturan lama tetap). "Simpan draf" kapan saja. "Simpan & tambah baru" untuk input massal.
6. **Endpoint & relasi tidak berubah**: tetap `products.store/update`, `products.variants.bulk`, `products.media.store`, `media.attach`, `media.upload`. Perubahan ini murni orkestrasi UI + penggabungan payload.

## Konsekuensi

- Positif: interaksi produk baru turun ke ±6-8 langkah; data tidak hilang sebelum simpan pertama; media tidak lagi halaman terpisah.
- Positif: Media Library tetap satu sumber aset; upload dari form masuk ke library yang sama.
- Risiko: payload store lebih besar (media + varian sekaligus) → divalidasi bertahap di server, error per-section.
- Netral: produk yang dibuat cara lama (bertahap) tetap kompatibel karena endpoint tidak berubah.

## Alternatif yang ditolak

- Wizard multi-langkah eksplisit (progress bar per layar): ditolak karena riset menunjukkan marketplace besar memilih single-scroll, dan model ini yang memicu keluhan "rumit".
- Menghilangkan checklist aktivasi: ditolak; gerbang mutu sebelum live tetap diinginkan owner.
