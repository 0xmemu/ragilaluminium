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

Catatan 2026-09-20: halaman CTA Storefront yang disebut di paragraf ini sudah DIHAPUS
bersama seluruh lapisan pengaturannya (lihat ADR-024 yang berstatus SUPERSEDED), jadi contoh
halaman yang menunggu aturan ini tinggal Tentang Kami dan daftar utang di bagian Akibat.

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

`resources/js/pages/Admin/CtaStorefront/Edit.tsx` dulu adalah penerapan kedua, dipakai sebagai
contoh bentuk ringkasan untuk nilai berbentuk teks per halaman. Halaman itu DIHAPUS 2026-09-20
(lihat catatan di bagian Masalah dan ADR-024 yang berstatus SUPERSEDED); arsipnya ada di
`_archive/cta-storefront/resources/js/pages/Admin/CtaStorefront/Edit.tsx`, jadi contoh bentuknya
masih bisa dibaca dari arsip, bukan dari halaman yang aktif.

## Halaman yang menunggu diterapkan

Diurutkan dari yang paling mirip halaman pengaturan teks:

1. `Admin/CodSettings/Edit.tsx`
2. `Admin/ShippingSubsidy/Edit.tsx`
3. `Admin/StorefrontPlatforms/Edit.tsx`
4. `Admin/CaraPemesanan/Edit.tsx`
5. `Admin/CmsDocument/Edit.tsx` (kebijakan privasi, ketentuan layanan)
6. `Admin/Beranda/HowToOrderForm.tsx`, `Admin/Beranda/KontakForm.tsx`
7. `Admin/CmsPageForm.tsx`

## Penegakan dan bukti pengulangan (2026-10-12)

Kontrak ini ditetapkan 2026-09-19, tetapi TERUS TERULANG karena hanya hidup di log sesi dan di
berkas ADR ini, tidak di kontrak kerja yang dimuat setiap sesi. Bukti owner menyampaikan hal yang
sama berkali-kali:

| Tanggal | Sumber |
|---|---|
| 2026-09-16 | log sesi: "menu Tentang Kami dibuka dalam mode RINGKASAN read-only, form aktif setelah menekan Edit profil" |
| 2026-09-19 | "kenapa form edit langsung aktif, ini sering terjadi, logika editing halaman atau membuat fitur baru harus di perbaiki untuk kontrak kerja atau aturan desain" |
| 2026-09-29 | "kalau modelnya form, jangan defaultnya aktif, tapi harus ada tombol edit/simpan" |
| 2026-10-11 | "form dan edit box harusnya disable/read only kalau belum menekan tombol edit" (Biaya COD, Subsidi Ongkir) |
| 2026-10-12 | "sekali lagi berulang kali saya bilang, kalau form atau input atau checkbox harus di guard dengan tombol edit, secara default ini tidak bisa dirubah dan read only kecuali tombol edit ditekan" |

Dua tindakan yang menutup akarnya:

1. **Aturan ini dipromosikan menjadi non-negotiable di `AGENTS.md`**, sejajar dengan kontrak
   alignment ADR-022. Akar masalahnya memang itu: aturan yang tidak punya tempat tetap tidak
   diwarisi halaman baru, persis seperti yang sudah dicatat di bagian Masalah di atas.
2. **Penjaga otomatis `tests/frontend/admin-edit-guard.test.ts`** memaku daftar halaman pengaturan
   yang wajib terkunci (WAJIB_TERKUNCI) dan daftar utang (UTANG). Halaman baru yang lupa terkunci
   gagal di test; halaman utang yang sudah diperbaiki wajib dipindahkan ke daftar wajib, karena
   test menolak halaman utang yang ternyata sudah terkunci. Penjaga ini sudah dibuktikan menangkap
   pelanggaran (mematikan jalur mode edit halaman Biaya COD sesaat membuat test gagal).

Dikerjakan 2026-10-12: bagian "Slide bar promo" di `Admin/Announcements/Index.tsx` (setelan di
dalam halaman daftar Bar Promo) kini terkunci varian B, jadi masuk daftar WAJIB_TERKUNCI.
Tujuh halaman di bagian "Halaman yang menunggu diterapkan" di atas masih utang; itulah isi
daftar UTANG di penjaga test.
