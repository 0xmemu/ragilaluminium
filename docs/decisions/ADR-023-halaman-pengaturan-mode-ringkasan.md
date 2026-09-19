# ADR-023: Halaman pengaturan dibuka dalam mode RINGKASAN, bukan form langsung aktif

- Status: Accepted
- Tanggal: 2026-09-19
- Konteks pemilik (verbatim): *"kenapa form edit langsung aktif, ini sering terjadi, logika
  editing halaman atau membuat fitur baru harus di perbaiki untuk kontrak kerja atau aturan
  desain"*
- Terkait: ADR-011 (admin UI), ADR-022 (alignment form admin)

## Masalah

Halaman pengaturan storefront membuka FORM YANG LANGSUNG AKTIF. Admin yang hanya ingin
memeriksa nilai terpaksa melihat puluhan kotak input, scroll panjang, dan risiko tidak sengaja
mengubah atau menyimpan data.

Aturannya sebenarnya sudah pernah ditetapkan: `docs/MEMORY.md` 2026-09-16 mencatat kontrak UX
"menu Tentang Kami dibuka dalam mode RINGKASAN read-only, form aktif setelah menekan Edit profil,
dan Simpan sukses kembali ke ringkasan (jangan ulangi form-langsung-aktif)".

Kenapa terulang: aturan itu HANYA hidup di log sesi, tidak di kontrak desain. Halaman yang dibuat
sesudahnya (CTA Storefront dibuat 2026-09-18, dua hari setelah kontrak itu dicatat) tidak
mewarisinya. Jadi masalahnya bukan halaman ini, tapi aturan yang tidak punya tempat tetap.

Keadaan sebelum ADR ini, dari 27 halaman admin ber-nama Form/Edit:
Tentang Kami satu-satunya yang menerapkan mode ringkasan. Sisanya, termasuk CTA Storefront,
Cod Settings, Shipping Subsidy, Cara Pemesanan, dan Storefront Platforms, membuka form langsung.

## Keputusan

Setiap halaman pengaturan (halaman yang tugasnya mengubah nilai yang sudah ada, bukan membuat
entitas baru) WAJIB mengikuti pola tiga bagian:

1. **Mode ringkasan (bawaan).** Halaman dibuka menampilkan NILAI YANG BERLAKU sebagai bacaan,
   bukan input. Ringkasan wajib menampilkan nilai efektif, termasuk nilai bawaan yang belum
   pernah disimpan admin, supaya admin melihat keadaan sebenarnya.
2. **Tombol pindah mode di header kanan.** Saat ringkasan: tombol aksi utama berlabel kerja
   ("Ubah teks CTA", "Edit profil"), bukan "Simpan". Saat mode edit: "Batal" dan "Simpan".
3. **Simpan kembali ke ringkasan.** `onSuccess` mengembalikan mode ke ringkasan, dan status
   tersimpan tercermin di ringkasan. Form TIDAK boleh tetap terbuka setelah berhasil simpan.

Tambahan yang berlaku:

- Lencana status (`StatusBadge`) diletakkan di header, bukan di tengah kartu.
- Kontrol di mode edit TIDAK memakai `readOnly` sebagai pengganti mode ringkasan. Ringkasan
  adalah tampilan berbeda, bukan input yang dikunci.
- Pratinjau nilai (mis. banner CTA merah) tetap memakai warna dan bentuk asli tampilan publik,
  karena token tema admin berbeda.

## Pengecualian

- **Halaman beranda/dashboard** yang tugasnya menampilkan data, bukan mengubah satu nilai.
- **Alur pembuatan entitas baru** (`create`) yang memang tugasnya mengisi form dari nol, mis.
  tambah produk, tambah voucher, tambah banner. Aturan ini untuk EDIT nilai yang sudah ada.
- **Halaman form yang isinya satu-dua kontrol** boleh langsung aktif bila tidak ada nilai
  berarti untuk diringkas. Keputusan itu harus disebut di deskripsi halaman.

## Konsekuensi

- Halaman pengaturan baru WAJIB mengikuti pola ini sejak awal. Review UI menolak form
  pengaturan yang langsung aktif tanpa alasan yang disebut di halaman.
- Halaman pengaturan lama yang belum mengikuti dicatat sebagai utang, dikerjakan bertahap.
- Menambah mode ringkasan berarti menambah satu state dan satu blok render per halaman. Itu
  biaya yang diterima karena menghilangkan risiko salah ubah dan salah simpan.

## Acuan implementasi

`resources/js/pages/Admin/TentangKami/Edit.tsx` adalah implementasi acuan pola ini
(`const [mode, setMode] = React.useState<"view" | "edit">("view")`, tombol header per mode,
`onSuccess: () => setMode("view")`).

`resources/js/pages/Admin/CtaStorefront/Edit.tsx` adalah penerapan kedua, dipakai sebagai
contoh bentuk ringkasan untuk nilai berbentuk teks per halaman.

## Halaman yang menunggu diterapkan

Diurutkan dari yang paling mirip halaman pengaturan teks:

1. `Admin/CodSettings/Edit.tsx`
2. `Admin/ShippingSubsidy/Edit.tsx`
3. `Admin/StorefrontPlatforms/Edit.tsx`
4. `Admin/CaraPemesanan/Edit.tsx`
5. `Admin/CmsDocument/Edit.tsx` (kebijakan privasi, ketentuan layanan)
6. `Admin/Beranda/HowToOrderForm.tsx`, `Admin/Beranda/KontakForm.tsx`
7. `Admin/CmsPageForm.tsx`
