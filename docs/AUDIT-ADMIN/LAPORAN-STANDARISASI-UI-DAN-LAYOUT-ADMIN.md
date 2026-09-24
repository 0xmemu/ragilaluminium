# Laporan Standardisasi Tata Letak & Form Alignment Panel Admin

Tanggal: 2026-09-24  
Pelaksana: Agent zcode  
Komitmen Git: `3cca9f56` (perubahan kode UI) dan `07291ae5` (pencatatan log)  
Cabang: `feat/admin-ui-redesign` (terdorong ke origin remote)  

---

## 1. Ringkasan & Latar Belakang

Pekerjaan ini menindaklanjuti ketidaksamaan tata letak antarmuka dan sistem logika penataan form antarhalaman di panel admin Ragil Aluminium. Sebelum pembenahan, ditemukan beberapa pola yang tidak seragam:
1. **Pola Kartu Sempit (*Card-First*) di Layar Lebar:** Beberapa halaman formulir menggunakan lebar sempit atau satu kolom memanjang sehingga menyisakan ruang kosong besar yang tidak proporsional di sisi kanan monitor desktop (1440px+).
2. **Deviasi Perataan Baris (*Alignment*):** Beberapa formulir menggunakan penyesuaian padding manual (seperti padding atas kelas Tailwind `sm:pt-7`) untuk menyejajarkan kotak centang (*checkbox*) dengan kotak input di sebelahnya. Pendekatan manual ini melanggar kontrak arsitektur ADR-022 (*Architectural Decision Record 022*) yang mewajibkan penggunaan primitif bersama.
3. **Penempatan Tombol Aksi yang Tersebar:** Tombol aksi operasional (seperti proses status pesanan, simpan formulir, dan tombol kembali) sebagian ditaruh di dalam bodi kartu atau mengambang di bawah konten, alih-alih konsisten di baris header atas kanan sejajar judul halaman.
4. **Redundansi Kontrol:** Keberadaan tombol submit ganda di dasar form dan tombol kembali mandiri di bodi halaman yang fungsinya menduplikasi navigasi kembali pada header.

Melalui eksekusi terpadu, 10 berkas antarmuka admin ditata ulang sehingga mematuhi standar ADR-022, memanfaatkan ruang layar secara proporsional, dan menyatukan seluruh tombol aksi utama di header atas kanan.

---

## 2. Penjelasan Istilah Teknis Sistem

Sesuai kontrak dokumentasi, berikut definisi istilah internal yang digunakan dalam laporan ini:
- **ADR-022 (*Architectural Decision Record 022*):** Keputusan arsitektur tanggal 17 September 2026 yang menetapkan bahwa seluruh baris formulir admin wajib lurus menggunakan komponen bersama tanpa penyesuaian posisi manual.
- **Komponen Kisi Formulir (`FieldGrid`):** Primitif grid dua kolom di `resources/js/components/admin/ui/field.tsx` dengan properti perataan isi di awal baris (`content-start`) agar label dan kotak input antar-kolom selalu lurus sebaris meskipun ada pesan bantuan (*hint*) atau galat (*error*).
- **Komponen Kotak Centang (`CheckboxField`):** Primitif form khusus untuk kotak centang dengan pengatur jarak atas otomatis setinggi baris label kontrol di sebelahnya, sehingga titik tengah (*center Y*) centang dan input selalu sejajar presisi.
- **Kartu Bagian (`SectionCard`):** Komponen kartu pembungkus terstandarisasi di `resources/js/components/admin/section-card.tsx` dengan pemisah garis rambut (*hairline divider*) antara judul, deskripsi, aksi, dan area input.
- **Aksi Header Bingkai Halaman (`AdminLayout actions`):** Slot antarmuka pada tata letak utama admin untuk menempatkan tombol aksi utama halaman di sudut kanan atas sejajar dengan judul.
- **Tata Letak Berbasis Tabel (*Table-First*):** Pola penyusunan form dan data administrasi yang membentang penuh memanfaatkan lebar tabel HTML (`th`/`td`), kebalikan dari kartu sempit bertumpuk (*Card-First*).

---

## 3. Rincian Perubahan per Berkas

| No | Modul / Halaman | Berkas Sumber Daya (`resources/js/pages/Admin/`) | Inti Perubahan yang Diterapkan |
|---|---|---|---|
| 1 | **Formulir Kategori** | `Categories/Form.tsx` | Menerapkan `SectionCard` untuk blok Identitas Kategori dan SEO. Mengganti grid manual dengan `FieldGrid`. Mengubah kotak centang status aktif menjadi `CheckboxField` mandiri (*standalone*). Menghapus tombol simpan dan tombol kembali duplikat di bilah samping kanan. Membatasi lebar kontainer maksimal `max-w-5xl` agar seimbang di monitor lebar. |
| 2 | **Detail Pesanan** | `Orders/Show.tsx` | Mengangkat seluruh tombol aksi operasional (Chat WhatsApp, Balas Ulasan, tombol proses status berikutnya, dan dialog pembatalan pesanan) ke header kanan atas (`AdminLayout actions`). Menghilangkan kartu aksi mengambang redundan yang sebelumnya berada di tengah antara ringkasan pesanan dan daftar produk. |
| 3 | **Detail Produk** | `Products/Show.tsx` | Menyelaraskan tipografi nama produk pada kartu identitas produk dari huruf tebal (`font-bold`) menjadi normal (`font-normal`/400) sesuai aturan tipografi kanonik panel admin. |
| 4 | **Edit Varian Produk** | `VariantEdit.tsx` | Mengadopsi `FieldGrid` untuk opsi kombinasi (Opsi 1, Opsi 2) dan kolom harga/stok varian. Memperlebar batas kontainer dari `max-w-3xl` menjadi `max-w-4xl` untuk kenyamanan visual desktop. |
| 5 | **Profil Admin** | `Profile/Edit.tsx` | Mengubah susunan satu kolom yang menyisakan ruang kosong besar di sebelah kanan menjadi format dua kolom proporsional menggunakan `SectionCard` dan `FieldGrid` untuk data nama, nama pengguna (*username*), password baru, dan konfirmasi password. |
| 6 | **Platform Toko & Kontak** | `StorefrontPlatforms/Edit.tsx` | Merapikan tab Informasi Kontak dan Lokasi Workshop menggunakan `SectionCard` dan `FieldGrid` dua kolom (telepon dan email), menggantikan pemisahan 2 kartu terpisah yang renggang. Merapikan tab aset merek (*brand assets*) dengan `SectionCard` dan menyelaraskan tombol aksi di header. |
| 7 | **Cara Pemesanan** | `CaraPemesanan/Edit.tsx` | Menghilangkan perataan manual kelas Tailwind `sm:pt-7` pada baris terbitkan halaman; menggantinya dengan `FieldGrid` dan `CheckboxField` yang sejajar otomatis. |
| 8 | **Template WhatsApp** | `WhatsApp/Edit.tsx` | Menghubungkan tautan navigasi kembali ke header (`backUrl`), menghapus tombol kembali mandiri di bodi formulir, dan menerapkan `FieldGrid` pada kolom nama template dan kode bahasa. |
| 9 | **Formulir Banner Promo** | `Banners/Form.tsx` | Menerapkan `FieldGrid` dan `CheckboxField` untuk informasi promo; memperluas lebar kontainer dari `max-w-3xl` menjadi `max-w-4xl`. |
| 10 | **Formulir Bar Pengumuman** | `Announcements/Form.tsx` | Menerapkan `FieldGrid` dan `CheckboxField`; kontainer diperluas ke `max-w-4xl` agar seragam dengan form banner. |

---

## 4. Hasil Pengujian & Verifikasi

Semua pengujian dijalankan langsung pada repositori peladen VPS (`/root/ragilaluminium`):

1. **Linter Kode JavaScript/TypeScript (ESLint):**
   - Perintah: `npx eslint` pada 10 berkas yang dimodifikasi.
   - Hasil: **Lolos 100% tanpa galat dan tanpa peringatan (0 error, 0 warning)**.
2. **Pemeriksaan Ketik Statis (TypeScript Compiler / `tsc --noEmit`):**
   - Perintah: `npm run typecheck`.
   - Hasil: **Lolos bersih 0 error**.
3. **Kompilasi Aset Bundler (Vite Build):**
   - Perintah: `npm run build`.
   - Hasil: **Sukses terkompilasi** dalam 20,11 detik.
4. **Pemeriksaan Karakter Terlarang Em Dash (U+2014):**
   - Perintah: `grep -P '\x{2014}' <10 berkas>`.
   - Hasil: **Terverifikasi bersih 0 kemunculan em dash** (`VERIFIED: NO EM DASH`).
5. **Uji Render Halaman Langsung (HTTP Status Probe):**
   - Pengujian dilakukan via eksekusi kernel web Laravel dengan autentikasi sesi admin aktif:
     - `/admin/kelola/kategori/create` => **HTTP 200 OK**
     - `/admin/kelola/produk/51` => **HTTP 200 OK**
     - `/admin/orders/1` => **HTTP 200 OK**
     - `/admin/profile` => **HTTP 200 OK**
     - `/admin/storefront-platforms?tab=kontak` => **HTTP 200 OK**
     - `/admin/storefront-platforms?tab=brand` => **HTTP 200 OK**
     - `/admin/banners/create` => **HTTP 200 OK**
     - `/admin/announcements/create` => **HTTP 200 OK**
     - `/admin/cara-pemesanan` => **HTTP 200 OK**
6. **Izin Berkas Sistem (*File Ownership & Permissions*):**
   - Menjalankan `scripts/prod/fix-storage-perms.sh` untuk memastikan direktori penyimpanan log (`storage/logs`) dan cache bootstrap tetap dimiliki serta dapat ditulis penuh oleh pengguna server web (`www-data`).
7. **Pemeriksaan Browser Visual Interaktif:**
   - Halaman admin diverifikasi langsung menggunakan browser Chromium interaktif terintegrasi pada viewport desktop 1440×900 piksel dengan anotasi elemen.

---

## 5. Kesimpulan & Panduan untuk Pekerjaan Berikutnya

Standardisasi ini menegaskan kembali konvensi desain panel admin:
- Seluruh formulir baru atau revisi berikutnya wajib menggunakan primitif `FieldGrid`, `Field`, dan `CheckboxField` dari `@/components/admin/ui/field`.
- Dilarang menambahkan pendorong perataan manual seperti `items-end`, `sm:self-end`, atau `sm:pt-*`.
- Tombol aksi utama (Simpan, Batal, Tambah) wajib dipasang di header atas kanan melalui properti aksi (`AdminLayout actions`) dengan atribut HTML5 `form="id-form"`, bukan ditaruh menduplikasi di dasar bodi formulir.
- Kontainer formulir pada halaman administratif wajib proporsional (`max-w-4xl` atau `max-w-5xl`) untuk mencegah ruang kosong berlebih di desktop lebar.
