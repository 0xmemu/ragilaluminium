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

## 6. Temuan D: Tindakan Berbahaya Tanpa Konfirmasi

Ini temuan paling berisiko dari seluruh audit.

Pada `WhatsApp/Pairing.tsx`, tombol **Reset & Hapus Sesi** mengirim form `POST` penghapusan sesi WhatsApp **tanpa dialog konfirmasi apa pun**. Sekali klik, sesi WhatsApp di server terhapus dan seluruh pengiriman pesan otomatis pesanan berhenti sampai admin melakukan pairing ulang lewat scan QR. Tindakan ini tidak bisa dibatalkan.

Temuan terkait: dua tombol lain di halaman yang sama memakai `window.confirm` bawaan browser, yang tampil sebagai kotak dialog sistem, bukan dialog panel yang seragam.

Perbaikan: ketiga tombol kini memakai komponen `ConfirmAction` bersama, dengan judul, penjelasan dampak, dan tombol batal yang seragam.

Bukti pengujian langsung di browser: dialog konfirmasi Putuskan Sambungan terbuka benar, tombol Batal menutup dialog tanpa mengirim form, dan sesi WhatsApp produksi tetap tersambung (`connected => 1`, nomor `62881080733754`) setelah pengujian.

---

## 7. Hasil Verifikasi

### 7.1 Pemeriksaan Kode

| Pemeriksaan | Hasil |
|---|---|
| TypeScript (`npm run typecheck`) | 0 error |
| ESLint pada 21 berkas yang diubah | 0 error, 0 warning |
| Karakter em dash pada berkas yang diubah | 0 kemunculan |
| Build Vite | Sukses 21 detik |

Catatan penting: ESLint pada **seluruh** direktori admin masih melaporkan 10 error dan 18 warning, tetapi semuanya berada di berkas milik pekerjaan lain yang belum di-commit (`media-picker.tsx`, `media-panel.tsx`, `ProductForm.tsx`, `InstallationGallery/Model.tsx`, dan sejenisnya). Berkas-berkas itu tidak disentuh dalam sesi ini.

### 7.2 Pengujian Otomatis

| Suite | Hasil |
|---|---|
| PHPUnit penuh (sebelum perubahan) | 1.172 passed, 1 skipped, 0 failed (11.895 assertions) |
| PHPUnit filter admin dan kontrak halaman | 260 passed (3.842 assertions) |
| PHPUnit filter WhatsApp | 70 passed (531 assertions) |
| Vitest frontend | 25 berkas, 203 test, semua lulus |

### 7.3 Pengujian Langsung di Browser

- Halaman Teruskan Popularitas: pil status Aktif tampil benar sebagai `StatusBadge`.
- Halaman Promo Toko: pil Berjalan dan Terjadwal tampil dengan warna benar.
- Halaman Daftar Pesanan: 20 pesanan tampil, tombol salin SKU bekerja, kotak dialog tidak tumpang tindih (diukur lewat koordinat elemen, jarak antar tombol 5 piksel, tidak ada irisan).
- Halaman Pairing WhatsApp: dialog konfirmasi berfungsi, sesi produksi tidak terganggu.

---

## 8. Pekerjaan yang Menunggu Keputusan

Enam berkas halaman yatim **belum dihapus**. Alasannya: menghapus kode orang lain bukan wewenang saya tanpa persetujuan, apalagi berkas itu berada di working tree bersama yang sedang dipakai agen lain.

Pilihan yang tersedia:

1. **Hapus semua enam berkas yatim**, karena semuanya terbukti sisa penggabungan dan tidak dirujuk rute mana pun.
2. **Hapus empat yang jelas** (`Media/Index`, `Attributes`, `VariantEdit`, `InstallationGallery/Model`), lalu periksa dulu dua sisanya (`ApaKata/Index`, `Beranda/KontakForm`) apakah masih dipakai sebagai tujuan pengalihan.
3. **Biarkan** sebagai catatan, tanpa perubahan.

Untuk kerapian jangka panjang, pilihan 2 paling aman: menghapus yang pasti mati lebih dulu, lalu memutuskan dua sisanya setelah memeriksa riwayat penggabungan.

---

## 9. Catatan Kolaborasi

Saat sesi ini berjalan, beberapa commit sempat menyertakan berkas milik agen lain karena staging per direktori. Kesalahan itu terdeteksi sebelum push dan diperbaiki dengan membatalkan commit lalu staging per berkas. Commit final hanya memuat berkas yang saya ubah. Kolom pesan commit mencatat bahwa beberapa berkas yang saya sentuh memang sudah membawa perubahan belum di-commit dari agen lain, dan perubahan mereka tidak saya ubah.
