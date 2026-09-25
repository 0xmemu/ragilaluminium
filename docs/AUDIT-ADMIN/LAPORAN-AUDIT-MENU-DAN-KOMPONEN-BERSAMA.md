# Laporan Audit Menu & Komponen Bersama Panel Admin

Tanggal audit: 25 September 2026  
Status: **Temuan teridentifikasi, sebagian diperbaiki, sisanya menunggu keputusan owner**  
Cabang kerja: `feat/admin-ui-redesign`

---

## 1. Definisi Istilah Sistem

Sebelum istilah teknis digunakan, berikut arti dan fungsinya:

- **Komponen bersama:** Komponen React tunggal di `resources/js/components/admin/` yang dipakai banyak halaman, supaya tampilan dan perilaku tidak berbeda antar halaman.
- **Halaman yatim:** Berkas halaman React yang ada tetapi tidak pernah dirender oleh rute mana pun, jadi tidak bisa dibuka admin.
- **Tombol salin:** Tombol kecil untuk menyalin nomor order, resi, atau SKU ke papan klip.
- **Hint melayang:** Keterangan tambahan yang muncul saat kursor diarahkan ke label.
- **Pengaman konfirmasi:** Dialog wajib sebelum tindakan berbahaya dijalankan.

---

## 2. Hasil Audit Menu: Semua Rute Hidup

Seluruh 33 pintu masuk menu pada `config/admin-sitemap.php` diuji langsung lewat kernel Laravel dengan sesi admin aktif.

| Grup Menu | Jumlah Item | Hasil Uji |
|---|---|---|
| Beranda (berisi Beranda, Performa Toko, Pesanan, Pembayaran, Pengiriman) | 5 | Semua HTTP 200 |
| Produk | 9 | Semua HTTP 200 |
| Harga & Promo | 3 | Semua HTTP 200 |
| Pelanggan & Komunikasi | 3 | Semua HTTP 200 |
| Pengaturan Website | 8 | Semua HTTP 200 |
| Akun & Sistem | 5 | Semua HTTP 200 |
| **Total** | **33** | **33 dari 33 hidup** |

Artinya tidak ada menu yang menuntun ke halaman rusak atau kosong.

---

## 3. Temuan A: Halaman Yatim (Ada Berkas, Tidak Ada Rute)

Enam berkas halaman admin tidak bisa dibuka admin karena tidak ada rute yang merendernya. Kolom terakhir menjelaskan alasan sebenarnya, yang penting untuk memutuskan apakah berkas ini layak dihapus.

| Berkas | Kondisi sebenarnya | Layak dihapus? |
|---|---|---|
| `Admin/Media/Index.tsx` | Digantikan `Admin/Media/Library.tsx` yang aktif dipakai | **Ya**, sisa versi lama |
| `Admin/Attributes.tsx` | Rute `products.attributes.index` justru mengalihkan ke tab Spesifikasi di form edit produk. Berkas ini tidak pernah dipanggil. | **Ya**, sisa sebelum penggabungan |
| `Admin/VariantEdit.tsx` | Rute `variants.edit` justru mengalihkan ke tab Varian di form edit produk. Berkas ini tidak pernah dipanggil. | **Ya**, sisa sebelum penggabungan |
| `Admin/InstallationGallery/Model.tsx` | Metode `model()` pada controller hanya mengembalikan pengalihan, tidak merender. | **Ya**, sisa sebelum penggabungan |
| `Admin/ApaKata/Index.tsx` | Rute `apa-kata-pelanggan` mengalihkan ke halaman Ulasan tab eksternal. Metode `index()` pada controller tidak pernah dirutekan. | **Ya**, tetapi perlu dicek dulu apakah masih dipakai sebagai tujuan pengalihan |
| `Admin/Beranda/KontakForm.tsx` | Rute `beranda.kontak.edit` mengalihkan ke Profil & Kontak Toko tab kontak. Metode `edit()` tidak pernah dirutekan. | **Ya**, sisa sebelum penggabungan |

Berkas `Admin/Error.tsx` juga muncul di deteksi otomatis, tetapi itu **sah**: dipakai oleh penangan galat di `bootstrap/app.php` untuk halaman error 403/404/500/503.

**Catatan sifat temuan:** keenam berkas ini adalah sisa penggabungan halaman yang sengaja dilakukan sebelumnya. Tidak ada fungsi yang hilang bagi admin; yang tersisa hanya kode mati yang menambah beban perawatan.

---

## 4. Temuan B: Duplikasi Komponen Bersama yang Sudah Diperbaiki

### 4.1 Lima Salinan Tombol Salin

Fungsi `CopyButton` disalin ulang di lima berkas dengan perilaku yang **berbeda-beda**:

| Berkas | Punya fallback `execCommand`? | Judul tombol |
|---|---|---|
| `Vouchers/Index.tsx` | Ya | `Salin kode voucher` |
| `Orders/Show.tsx` | Tidak | `Salin nomor resi` |
| `Orders/Index.tsx` | Tidak | `Salin SKU SP57802368148-340229981781` |
| `Payments/Index.tsx` | Tidak | `Salin nomor order` |
| `Shipping/Index.tsx` | Tidak | `Salin nomor resi` |

Perbedaan ini nyata dampaknya: pada koneksi internal tanpa HTTPS, Clipboard API ditolak browser, sehingga empat dari lima halaman **gagal menyalin tanpa umpan balik apa pun**, sedangkan halaman Voucher tetap berhasil karena punya fallback.

Perbaikan: dibuat `resources/js/components/admin/ui/copy-button.tsx` sebagai satu-satunya sumber. Kelima salinan lokal dihapus, termasuk `CopySkuButton` di Performa Toko yang berperilaku sama.

### 4.2 Dua Salinan Hint Melayang

Komponen `HintTip` bersama sudah ada di `components/admin/ui/hint-tip.tsx`, tetapi dua berkas masih menyalin ulang versi lama berbasis Tooltip Radix: `Customers/Index.tsx` dan `CodSettings/Edit.tsx`. Keduanya kini memakai komponen bersama, sehingga hint dapat diakses lewat tombol keyboard dan terbaca pembaca layar, bukan hanya saat kursor melayang.

### 4.3 Komponen Status yang Tidak Konsisten

- `Products/PopularityBoosts.tsx` menulis pil status dengan warna mentah (`bg-emerald-500/10`, `bg-zinc-500/15`), bukan `StatusBadge`. Kini memakai `StatusBadge`.
- `PromotionOverview.tsx` juga menulis pil sendiri untuk status Berjalan, Terjadwal, dan Draf. Kini memakai `StatusBadge` dengan nada eksplisit agar warna hijau dan biru tetap terjaga.

---

## 5. Temuan C: Formulir yang Belum Memakai Primitif ADR-022

Sebelas berkas masih memakai kotak centang mentah dengan pendorong manual `sm:pt-7` untuk menyejajarkan kontrol. Semua kini memakai `CheckboxField`, `FieldGrid`, dan `FieldAction`:

| Berkas | Yang diperbaiki |
|---|---|
| `Faq/Index.tsx` | Checkbox Terbitkan halaman |
| `ApaKata/Index.tsx` | Checkbox Terbitkan halaman |
| `CmsDocument/Edit.tsx` | Checkbox Terbitkan halaman, sekaligus kartu ke `SectionCard` |
| `ModelProducts/Form.tsx` | Checkbox Sertakan foto produk |
| `MasalahSolusi/Form.tsx` | Dua checkbox (opsi lanjutan dan daftar solusi) |
| `Attributes.tsx` | Grid form dan tombol simpan sebaris (`FieldAction`) |
| `Customers/Edit.tsx` | Kartu ke `SectionCard` dan grid ke `FieldGrid` |
| `ShippingSubsidy/Edit.tsx` | Dua checkbox |
| `CodSettings/Edit.tsx` | Checkbox Layanan COD aktif |
| `Vouchers/Form.tsx` | Checkbox Tumpuk dan Langsung aktifkan |
| `Banners/Index.tsx`, `Announcements/Index.tsx` | Checkbox banner otomatis dan aktifkan slide |
| `ResourceIndex.tsx` | Tiga toggle lampiran media |

### 5.1 Kartu yang Menyalin Ulang SectionCard

Selain checkbox, ditemukan kartu yang menulis ulang struktur `SectionCard` secara manual, padahal komponen bersama sudah ada. Yang paling jelas: `Products/Show.tsx` mengulang pola yang sama empat kali (ikon dalam kotak abu, judul, garis pemisah, isi) sehingga perubahan gaya kartu harus disunting di empat tempat.

| Berkas | Jumlah kartu | Yang diperbaiki |
|---|---|---|
| `Products/Show.tsx` | 4 | Varian, Spesifikasi, Media (dengan aksi), Deskripsi |
| `SubModelForm.tsx` | 2 | Template spesifikasi produk dan Template default model |

Setelah konversi, kedua berkas kehilangan 96 baris dan hanya menambah 49 baris, karena header kartu tidak lagi ditulis berulang.

### 5.2 Fungsi Kode Mati di Halaman Publik

Pada `Public/OrderStatus.tsx` ditemukan fungsi `_cancelOrder()` yang tidak pernah dipanggil dari mana pun. Fungsi itu juga memakai `window.confirm` bawaan. Fungsi ini sengaja dinamai dengan garis bawah depan sebagai penanda tidak dipakai, jadi bukan bug aktif, tetapi tetap kode mati yang menyimpan dialog konfirmasi gaya lama.

Status: **belum dihapus**, menunggu keputusan bersama temuan yatim lainnya.

---

## 5A. Temuan E: Komponen Bersama yang Mati dan Pohon Kembar

Setiap komponen di `resources/js/components/admin/` dihitung jumlah pengimpornya di seluruh `resources/js`.

### 5A.1 Komponen Mati Total

Sembilan berkas, sekitar 1.625 baris kode, tidak diimpor siapa pun:

| Berkas | Baris | Padanan/Akibat |
|---|---|---|
| `admin/product-edit/media-panel.tsx` | 841 | Panel pemilih media ketiga; `media-picker.tsx` yang aktif memanggil endpoint yang sama |
| `admin/ui/chart.tsx` | 367 | Pembungkus Recharts tidak dipakai; setiap halaman menata tema grafiknya sendiri |
| `admin/ui/form.tsx` | 178 | Pembungkus react-hook-form; 43 halaman memakai `useForm` Inertia, jadi ini menyesatkan seolah ada dua konvensi form |
| `admin/product-edit/variant-panel.tsx` | 97 | Panel varian sisa refactor |
| `admin/ui/tabs.tsx` | 53 | Primitif tab mati padahal dua komponen tab tulis-tangan justru ada |
| `admin/ui/badge.tsx` | 36 | Mengekspor nama `badgeVariants` yang sama dengan `status-badge.tsx`, rawan salah pilih impor |
| `admin/ui/separator.tsx` | 29 | Mati, kembarannya di `components/ui/` juga mati |
| `admin/ui/label.tsx` | 24 | Mati transitif: hanya diimpor `form.tsx` yang mati |
| `components/ui/{badge,confirm-action,price,separator,status-select,switch,tabs,tooltip}.tsx` | 349 | Delapan berkas di pohon lama, tampak aktif padahal tidak dipakai |

### 5A.2 Duplikasi Komponen Bersama

| Pasangan | Temuan |
|---|---|
| `manage-products-tabs.tsx` (4 impor) dan `whatsapp-tabs.tsx` (3 impor) | Isi kedua berkas identik baris per baris; hanya daftar tab, nama fungsi, dan label aksesibilitas yang berbeda |
| `media-library-select.tsx`, `media-picker.tsx`, dan `media-panel.tsx` | Tiga pemilih media ke endpoint yang sama; satu di antaranya sudah mati |
| `admin/ui/status-badge.tsx` dan `components/ui/status-badge.tsx` | Dua peta nada berbeda: yang admin memakai gaya batas dan lapisan tipis, yang publik memakai token |
| `admin/ui/breadcrumb.tsx` dan `components/ui/breadcrumbs.tsx` | Dua komponen remah roti di dua pohon berbeda |
| `admin/ui/flash-messages.tsx` dan `components/shared/flash-messages.tsx` | Dua salinan komponen pesan kilat, hanya berbeda dua baris |
| `admin/ui/ProductPicker.tsx` | Bersaing dengan `search-select.tsx` untuk fungsi memilih produk, dan mendefinisikan pemformat mata uang lokal padahal `lib/format.ts` sudah ada |

Akibat yang sudah nyata terlihat: `Orders/Show.tsx` menampilkan status yang sama dengan **dua palet berbeda** dalam satu halaman, karena berkas itu mengimpor `StatusBadge` dari pohon admin sekaligus panel pelacakan dari komponen bersama yang memakai `StatusBadge` pohon publik.

### 5A.3 Duplikasi Logika (Bukan Komponen)

| Pola | Salinan | Catatan |
|---|---|---|
| Pembangun URL filter halaman (`visit`) | **12 berkas**: Categories, SubModels, Vouchers, Notifications, Orders, Payments, Imports, Products, PopularityBoosts, Shipping, Banners, Announcements | Aturan "nilai default tidak ditulis ke URL" dan pemangkasan kata kunci tersebar di 12 tempat. `ResourceIndex.tsx` memakai cara ketiga (`URLSearchParams`) |
| Mesin mode Urutkan (geser, simpan, batal, sinkron snapshot) | **9 berkas**: ApaKata, Faq, MasalahSolusi, ModelProducts, SubModels, Testimonials, InstallationGallery, Beranda, PopularityBoosts | Blok geser dan penomoran ulang identik. Bahkan ada penamaan yang menyesatkan: `cancelOrder()` di dua berkas sebenarnya membatalkan mode urutkan, bukan membatalkan pesanan |
| Blok status koneksi WhatsApp | **3 berkas**: Hub, Index, Pairing | Sudah bercabang pada radius, padding, dan bayangan |

Ini bukan sekadar kerapian. Komentar panjang di `ApaKata/Index.tsx` dan `InstallationGallery/Index.tsx` mencatat bug sinkronisasi snapshot yang sudah pernah terjadi; setiap perbaikan baru harus diulang di sembilan tempat.

---

## 6. Temuan D: Tindakan Berbahaya Tanpa Konfirmasi

Ini temuan paling berisiko dari seluruh audit.

Pada `WhatsApp/Pairing.tsx`, tombol **Reset & Hapus Sesi** mengirim form `POST` penghapusan sesi WhatsApp **tanpa dialog konfirmasi apa pun**. Sekali klik, sesi WhatsApp di server terhapus dan seluruh pengiriman pesan otomatis pesanan berhenti sampai admin melakukan pairing ulang lewat scan QR. Tindakan ini tidak bisa dibatalkan.

Temuan terkait: dua tombol lain di halaman yang sama memakai `window.confirm` bawaan browser, yang tampil sebagai kotak dialog sistem, bukan dialog panel yang seragam.

Perbaikan: ketiga tombol kini memakai komponen `ConfirmAction` bersama, dengan judul, penjelasan dampak, dan tombol batal yang seragam.

Bukti pengujian langsung di browser: dialog konfirmasi Putuskan Sambungan terbuka benar, tombol Batal menutup dialog tanpa mengirim form, dan sesi WhatsApp produksi tetap tersambung (`connected => 1`, nomor `62881080733754`) setelah pengujian.

### 6.1 Sidik Menyeluruh Tindakan Destruktif

Setelah pairing diperbaiki, seluruh 71 berkas halaman admin disisir ulang dengan dua lapis pemeriksaan: pencocokan label destruktif yang tidak berdekatan dengan `ConfirmAction`, dan pelacakan fungsi bermutasi yang dipanggil dari `onClick` jauh dari definisinya. Setiap kandidat ditelusuri ke rute, controller, dan service di backend untuk memastikan sifatnya benar-benar merusak.

Hasilnya: **26 berkas sudah memakai `ConfirmAction`**, **14 berkas memanggil `router.delete` dan semuanya sudah di belakang konfirmasi**, dan **nol berkas masih memakai `window.confirm`** di area admin. Namun ditemukan **empat jalur yang masih berjalan satu klik**, dan semuanya sudah diperbaiki:

| Jalur | Tindakan nyata | Akibat tanpa konfirmasi | Perbaikan |
|---|---|---|---|
| `ProductForm.tsx` tombol lepas media hasil pemasangan | `POST` arsip media | Foto hilang dari daftar media produk dan dari halaman publik hasil pemasangan. Rute pemulihan ada di backend tetapi tidak punya pemanggil di antarmuka, sehingga penghapusan praktis satu arah | `ConfirmAction` |
| `Orders/Index.tsx` dan `Orders/Show.tsx` tombol Hapus Catatan | `PUT` catatan internal bernilai kosong | Catatan internal admin hilang permanen dari database, tanpa riwayat, dan modal langsung tertutup sehingga tidak ada kesempatan membatalkan | `ConfirmAction` di dua tempat |
| `ModelProducts/Index.tsx` tombol Muat ulang katalog | `POST` sinkronisasi katalog | Bukan hanya menambah model baru: model yang tidak lagi punya produk aktif otomatis berstatus nonaktif sehingga hilang dari katalog dan beranda publik | `ConfirmAction` dengan penjelasan dampak |
| `ResourceIndex.tsx` aksi baris generik | `POST` atau `DELETE` generik | Pengaman konfirmasi bergantung pada penanda `action.confirm` yang **tidak pernah dikirim server mana pun** di seluruh backend. Jalur ini kini dorman karena `row.actions` selalu kosong, tetapi menjadi lubang begitu ada controller yang mengisinya | Default aman dibalik: setiap metode non-GET wajib dikonfirmasi, teks dari server dipakai sebagai judul bila tersedia |

Bukti pengujian langsung di browser: dialog konfirmasi Muat ulang katalog terbuka dengan penjelasan dampaknya, tombol Batal menutup dialog tanpa mengirim permintaan, dan halaman tetap di rute yang sama.

### 6.2 Tindakan yang Terverifikasi Aman (Bukan Temuan)

Pemeriksaan yang sama menyaring sejumlah hal yang tampak berisiko tetapi sebenarnya tidak:

- Tombol Hapus dan Kosongkan di `TentangKami/Edit`, `CaraPemesanan/Edit`, `Beranda/HowToOrderForm`, `MasalahSolusi/Form`, `ModelProducts/Form`, `PromotionForm`, `SubModelForm`, `Vouchers/Form`, dan `Announcements/Form` hanya mengubah keadaan form di layar; tidak ada perubahan tersimpan sebelum admin menekan Simpan.
- Aksi Pulihkan, Aktifkan, dan Reset filter bersifat memulihkan atau tidak merusak.
- `Orders/Index.tsx` tombol aksi sekunder tidak pernah membawa status berikutnya, sehingga tidak ada mutasi tak terduga dari jalur itu.
- `WhatsApp/Edit.tsx` dan `WhatsApp/Index.tsx` tombol Nonaktifkan template bersifat reversibel (tombol Aktifkan tersedia). Ini tetap dicatat sebagai ketidakseragaman gaya, bukan risiko data.
- `ResourceShow.tsx` tombol Jalankan ulang menunjuk rute yang tidak ada sehingga `routeUrl` gagal dan jatuh ke beranda, tetapi cabang itu sudah tidak terjangkau dari rute mana pun, jadi tetap kode mati.

---

## 7. Hasil Verifikasi

### 7.1 Pemeriksaan Kode

| Pemeriksaan | Hasil |
|---|---|
| TypeScript (`npm run typecheck`) | 0 error |
| ESLint pada seluruh berkas yang diubah sesi ini | 0 error, 0 warning |
| Karakter em dash pada berkas yang diubah | 0 kemunculan |
| Build Vite | Sukses 21 detik |

Catatan penting: ESLint pada **seluruh** direktori admin masih melaporkan 10 error dan 18 warning, tetapi semuanya berada di berkas milik pekerjaan lain yang belum di-commit (`media-picker.tsx`, `media-panel.tsx`, `ProductForm.tsx` bagian efek lama, `InstallationGallery/Model.tsx`, dan sejenisnya). Berkas-berkas itu tidak disentuh dalam sesi ini. Berkas `ProductForm.tsx` sendiri disentuh, tetapi 7 warning di dalamnya sudah ada sebelum perubahan dan berasal dari efek React lama, bukan dari tombol konfirmasi yang ditambahkan.

### 7.2 Pengujian Otomatis

| Suite | Hasil |
|---|---|
| PHPUnit penuh (sebelum perubahan) | 1.172 passed, 1 skipped, 0 failed (11.895 assertions) |
| PHPUnit penuh (setelah pemecahan warna dan komponen) | 1.172 passed, 1 skipped, 0 failed (11.907 assertions) |
| PHPUnit filter admin dan kontrak halaman | 260 passed (3.842 assertions) |
| PHPUnit filter WhatsApp | 70 passed (531 assertions) |
| Vitest frontend | 25 berkas, 203 test, semua lulus |

### 7.3 Pengujian Langsung di Browser

- Halaman Teruskan Popularitas: pil status Aktif tampil benar sebagai `StatusBadge` bersama.
- Halaman Promo Toko: pil Berjalan dan Terjadwal tampil dengan warna benar.
- Halaman Daftar Pesanan: 20 pesanan tampil, tombol salin SKU bekerja, kotak dialog tidak tumpang tindih (diukur lewat koordinat elemen: jarak antar tombol 5 piksel, tidak ada irisan).
- Halaman Pairing WhatsApp: dialog konfirmasi berfungsi, sesi produksi tidak terganggu.
- Halaman Pengaturan Sistem: peta status memakai token tema, grafik dan kartu render normal.
- Form Cara Pesan: dua `SectionCard` tampil, tombol Kembali hanya muncul sekali di remah roti.
- Halaman Model Produk: dialog konfirmasi Muat ulang katalog terbuka dengan penjelasan dampak, tombol Batal menutup tanpa mengirim permintaan.
- Halaman Detail Produk id 51: tab Varian, Spesifikasi, dan Media tampil, 12 varian terdaftar, `SectionCard` baru tanpa masalah tata letak.

### 7.4 Pemeriksaan Rujukan Rute

Seluruh nama rute admin yang dipanggil antarmuka dicocokkan dengan 290 rute yang benar-benar terdaftar di Laravel.

Hasil: **bersih, kecuali satu**. Satu-satunya rujukan yang tidak punya rute adalah `admin.imports.retry` di `ResourceShow.tsx:63`. Karena `routeUrl` gagal dan jatuh ke beranda, tombol itu akan mengirim permintaan ke halaman depan, bukan menjalankan ulang impor. Tetapi cabang itu sudah tidak bisa dijangkau dari rute mana pun, jadi ini kode mati, bukan bug aktif.

Tidak ditemukan pula handler `onClick` yang badan fungsinya kosong di seluruh halaman admin.

---

## 8. Pekerjaan yang Menunggu Keputusan

### 8.1 Berkas Halaman Yatim

Enam berkas halaman yatim **belum dihapus**. Alasannya: menghapus kode orang lain bukan wewenang saya tanpa persetujuan, apalagi berkas itu berada di working tree bersama yang sedang dipakai agen lain. Tiga di antaranya bahkan sedang dalam keadaan termodifikasi oleh pekerjaan lain yang belum di-commit (`product-edit/media-panel.tsx`, `product-edit/variant-panel.tsx`, `Beranda/KontakForm.tsx`).

Pilihan yang tersedia:

1. **Hapus semua enam berkas yatim**, karena semuanya terbukti sisa penggabungan dan tidak dirujuk rute mana pun.
2. **Hapus empat yang jelas** (`Media/Index`, `Attributes`, `VariantEdit`, `InstallationGallery/Model`), lalu periksa dulu dua sisanya (`ApaKata/Index`, `Beranda/KontakForm`) apakah masih dipakai sebagai tujuan pengalihan.
3. **Biarkan** sebagai catatan, tanpa perubahan.

Untuk kerapian jangka panjang, pilihan 2 paling aman: menghapus yang pasti mati lebih dulu, lalu memutuskan dua sisanya setelah memeriksa riwayat penggabungan.

### 8.2 Komponen Bersama yang Mati

Sembilan berkas komponen mati (sekitar 1.625 baris) diusulkan dihapus, tetapi ada satu catatan penting: `admin/product-edit/media-panel.tsx` justru memuat **satu-satunya padanan berkonfirmasi** untuk tombol lepas media di `ProductForm.tsx` yang baru diperbaiki. Menghapusnya aman karena berkas itu sendiri tidak dipakai, tetapi urutannya sebaiknya setelah tombol di `ProductForm.tsx` dipastikan berjalan di lingkungan nyata.

### 8.3 Duplikasi Logika yang Perlu Refactor Terarah

Dua pola terbesar, yaitu pembangun URL filter (12 salinan) dan mesin mode Urutkan (9 salinan), layak dijadikan hook bersama. Keduanya menyentuh banyak halaman sekaligus, jadi sebaiknya dikerjakan sebagai satu tugas tersendiri dengan pengujian menyeluruh, bukan disisipkan ke sesi perapian ini.

---

## 9. Catatan Kolaborasi

Saat sesi ini berjalan, beberapa commit sempat menyertakan berkas milik agen lain karena staging per direktori. Kesalahan itu terdeteksi sebelum push dan diperbaiki dengan membatalkan commit lalu staging per berkas. Commit final hanya memuat berkas yang saya ubah. Kolom pesan commit mencatat bahwa beberapa berkas yang saya sentuh memang sudah membawa perubahan belum di-commit dari agen lain, dan perubahan mereka tidak saya ubah.
