# Laporan Eksekusi Tunggal: Audit dan Perbaikan Konsistensi Panel Admin

Tanggal: 2026-09-24. Eksekutor: zcode-admin-audit.
Instruksi: satu task besar, satu eksekusi terintegrasi, keputusan default B1 sampai B13.
Commit: `130ef214` (fitur), `b23f6f88` dan sebelumnya (P1 awal + Opsi B).
Push: `ba719f8c..130ef214 feat/admin-ui-redesign -> origin`, pre-push hook lolos.

---

## 1. Ringkasan

Dari 30 temuan awal kedua audit: **5 sudah selesai sebelum task ini** (media 500,
tombol Panduan menimpa aksi, tab Pesanan terpotong, label validasi, relasi kategori
Opsi B). Sisa **23 temuan terbuka ditangani dalam eksekusi ini** dengan hasil:

| Status | Jumlah | Keterangan |
|---|---|---|
| Resolved (di-commit `130ef214`) | 14 | lihat tabel 2 |
| Resolved di working tree (tertahan koordinasi commit) | 8 | lihat bagian 4 |
| Intentional (diputuskan sesuai B) | 6 | lihat bagian 3 |
| Deferred dengan alasan | 3 | lihat bagian 5 |
| Blocked | 1 | notifikasi id 8 (bagian 6) |

Verifikasi: suite PHP penuh **1 skipped, 1147 passed, 0 gagal**; Vitest 25 berkas
203 test lulus; typecheck bersih; build sukses (dua kali: eksekusi dan pre-push);
browser live dari menu nyata; data produksi tidak berubah kecuali satu konten
em dash lewat UI admin (bagian 6).

---

## 2. Temuan yang resolved di commit `130ef214`

| Temuan | Inti perbaikan |
|---|---|
| B12 alias helper | `categoryCodesWithLegacy` mengenal WINDOWS/DOORS; fallback slug `CategoryUrl` diselaraskan |
| B12 pencocokan | `ModelProductService` dan `ModelProductPresentation` menormalkan kode produk, produk warisan tak lagi hilang dari hitungan |
| B13 `design_variant` | `OrderService::editOrder` menulis snapshot taxonomy pada item baru + test `AdminOrderEditTaxonomyTest` |
| Admin F-10 hardcoded URL | 7 berkas diganti `routeUrl()`; `notification-bell` intentional |
| Admin F-11 placeholder | pencarian Pesanan diperpendek, terbaca di 1280px |
| Admin F-15 (data) | cms_pages id 12 dibersihkan lewat UI admin (bagian 6) |
| Admin F-16 (kode) | 3 em dash kode aktif dibersihkan |
| Admin Batch 0 penjaga | `AdminRouteNameGuardTest` memindai semua `route('...')` controller admin |
| B4 istilah | `Muat ulang`, `Ekspor`, `Simpan` seragam (termasuk dua berkas terlindungi lewat grup B2) |
| B8 all-caps | 45 baris judul sekunder di 18 berkas |
| B10 Panduan kosong | tombol disembunyikan bila `adminPageGuides[routeName]` tidak ada (terverifikasi: Kategori hilang, FAQ ada) |
| B9 halaman yatim | menu Halaman CMS + Tata Letak Beranda dikembalikan di `admin-sitemap.php` |
| Konsistensi F-05 breadcrumb | `routeMatches` meng-escape regex; Subsidi Ongkir kini "Beranda / Harga & Promo / Subsidi Ongkir" (terverifikasi live) |
| Konsistensi F-06 riwayat filter | `replace: true` seragam di Customer, Log Aktivitas, Masalah & Solusi |

Juga ikut di-commit: `ErrorState` baru di Orders/Media (F-13 parsial), sheet
aksesibel deskriptif (F-14), kontrol ukuran halaman Notifikasi (F-10 parsial,
terverifikasi live: pilih 50 baris, URL `?per_page=50`, tabel 32 baris).

---

## 3. Intentional (keputusan default diterapkan, bukan dianggarkan)

| Temuan | Keputusan | Dasar |
|---|---|---|
| Bulk Pesanan/Produk tidak ada | tidak dibuat; hanya Media Library diperkuat (select-all benar, indeterminate, pembersihan pilihan) | B3: jangan buat endpoint mutation baru demi tampilan |
| `notification-bell.tsx` hardcoded string | biarkan; itu pencocokan pemilah, bukan navigasi | B4 terbatas aksi UI |
| Header tabel tetap uppercase | disengaja; B8 hanya judul sekunder | B8 |
| 5 halaman tanpa aksi header (Orders/Show, Media/Attach, InstallationGallery/Show, Notifications, Error) | intentional; tidak ada aksi wajar | Admin F-12 |
| URL alias lama tetap dialihkan | tidak diubah menjadi 404 | B12 |
| `stats.failed` Hub tetap terfilter rentang | angka dashboard dipertahankan definisinya | B5 |

---

## 4. Resolved di working tree, tertahan koordinasi commit (B penting)

39 berkas yang dikerjakan eksekusi ini ternyata juga memuat pekerjaan belum-commit
agent lain (tidak ada commit baru sejak baseline). Sesuai kontrak "jangan menimpa
perubahan agent lain", commit `130ef214` hanya memuat 24 berkas bersih. Perubahan
grup C dan B1 pada 39 berkas itu **sudah terpasang di server dan terverifikasi**
tetapi menunggu di-commit bersama pemilik baseline:

| Temuan | Perubahan (di working tree) |
|---|---|
| Konsistensi F-03 add/edit Kategori | create kini full-page memakai `Categories/Form`; inline panel dihapus; test baru 2 kasus |
| Konsistensi F-09/F-10 paginasi | Sub Model, Model Produk, Notifikasi: `per_page` 20/50/100, paginasi bersama, guard `Urutkan` saat multi-halaman; test allowlist |
| Admin F-06 tabel bersama | `table.tsx` diperkuat (`TableScroll`, kolom numerik); 3 halaman migrasi (Notifications, ModelProducts, Categories) |
| Admin F-14 konfirmasi hapus | 12 dari 13 route aman; 1 diperbaiki (InstallationGallery/Model kini `ConfirmAction`); `media.destroy` orphan tercatat |
| Admin F-12 aksi header | PromotionOverview dapat `Buat Flash Sale`/`Buat Diskon Reguler`; WhatsApp/Index aksi diangkat ke header |
| B4/B8 sisanya | istilah dan all-caps pada 39 berkas tumpang tindih |

---

## 5. Deferred dengan alasan

| Item | Alasan |
|---|---|
| Migrasi tabel beranda sibuk (Produk, Pelanggan, Sub Model, Pesanan) | halaman paling sering dipakai, butuh QA visual khusus; Pesanan grid kartu sesuai kontrak |
| `ErrorState` pada Produk/Pelanggan/Imports | jalur muat ulangnya `router.reload()` polos tanpa onError; tidak ada jalur galat nyata untuk ditempeli |
| Sheet publik "Panel navigasi" | di luar cakupan admin |
| `media.destroy` route yatim | tidak ada pemanggil UI; perlu keputusan arsip/hapus terpisah |
| Notifikasi id 8 em dash | blocked, lihat bawah |

---

## 6. Data produksi

- Dua target em dash: `cms_pages` id 12 **selesai** lewat UI admin
  (`/admin/cara-pemesanan`, langkah 3, kolom Deskripsi: "tidak perlu konfirmasi,
  pesanan langsung diproses."), flash "Cara pemesanan disimpan.", verifikasi
  `INSTR(content, em dash) = 0` dan halaman publik menampilkan teks baru.
- `admin_notifications` id 8 **blocked**: halaman Notifikasi tidak punya UI edit
  atau hapus sama sekali (hanya daftar tautan). Sesuai stop condition "data
  produksi harus diubah di luar UI", tidak saya ubah via SQL. Butuh keputusan:
  tambahkan aksi hapus notifikasi di UI, atau izinkan penanganan khusus sekali
  ini.
- Selain itu nol mutasi data. Setelah eksekusi: 3 kategori, 183 produk, 20
  pesanan, 51 sub model, 10 pelanggan. Katalog publik `/`, `/products`,
  `/products/all`, `/products/jendela`, `/hasil-pemasangan` tetap 200.

---

## 7. Keputusan default yang dipakai

B1 (add/edit: full-page bila edit full-page), B2 (paginasi 20/50/100 hanya UI
list, export tidak disentuh), B3 (tanpa endpoint baru), B4 (kamus istilah), B5
(angka dashboard dipertahankan, tujuan kartu diperbaiki via `?status=failed`),
B6/B7 dicatat, B8 (Title Case judul sekunder), B9 (entry point dikembalikan,
tanpa menghapus), B10 (sembunyikan Panduan kosong), B11 (UI admin untuk data),
B12 (tulis kanonik, baca kompatibel, URL lama redirect), B13 (perbaiki tulis,
histori tidak diubah). Semua diterapkan atau dicatat; tidak ada yang bentrok
struktur kode.

---

## 8. Bukti verifikasi

| Perintah | Hasil |
|---|---|
| `php artisan test` (penuh) | 1 skipped, 1147 passed, 0 gagal |
| `npx vitest run` | 25 berkas, 203 test lulus |
| `npm run typecheck` | 0 error |
| `npm run build` | sukses (2 kali, termasuk pre-push) |
| `git push` | pre-push hook lolos, `ba719f8c..130ef214` |
| Browser | dari menu nyata: Beranda, Pesanan, Kategori, Sub Model, Model Produk, Notifikasi, Media, Pelanggan, WhatsApp, Pengaturan, Subsidi Ongkir, Cara Pemesanan; search/filter/ukuran halaman/combobox/drawer/Esc diuji pada yang relevan |

Test baru: `AdminOrderEditTaxonomyTest` (2), `AdminRouteNameGuardTest` (1),
`WhatsAppHubFailedMessagesTest` (3), `CategoryAutoCodeTest` +2, `SubModelAdminTest`
+1. Semua lulus.

## 9. Sisa yang perlu keputusan/tindak lanjut owner

1. Koordinasi commit 39 berkas tumpang tindih (bagian 4): perubahan sudah live
   dan terverifikasi, tinggal diputuskan masuk commit siapa.
2. Notifikasi id 8: tambahkan UI hapus notifikasi, atau izinkan penanganan
   sekali lewat SQL.
3. `media.destroy` route yatim: arsipkan atau hapus.
4. Bulk Produk/Pesanan: bila diinginkan, endpoint massal harus dibuat lebih
   dulu (di luar audit UI).
5. Audit alias kategori lanjutan: tetap mengacu
   `docs/audit-admin/audit-alias-kategori.md` (URL English tetap redirect).

---

## Lampiran progres (2026-09-24 03:55 UTC, setelah ronde "eksekusi semua")

Ronde kedua mengeksekusi seluruh sisa keputusan. Status pada bagian 1 sampai 6
di atas kini bertambah lampiran ini sebagai status terbaru. Commit ronde kedua:
`13c9fae2` (39 berkas tumpang tindih), `f622437a` (notifikasi + alias),
`593f8041` dan `62017c51` (laporan dan log). Semua ter-push, pre-push hook lolos.

| Entri lama | Status terbaru |
|---|---|
| 8 temuan "Resolved di working tree, tertahan koordinasi commit" (bagian 4) | **Resolved penuh**: masuk commit `13c9fae2` (add/edit Kategori full-page, paginasi 20/50/100 tiga daftar, tabel primitif + 3 migrasi, konfirmasi hapus InstallationGallery/Model, aksi header PromotionOverview dan WhatsApp, istilah dan all-caps pada 39 berkas) |
| Blocked: notifikasi id 8 em dash (bagian 6) | **Resolved**: dibuatkan UI hapus notifikasi (route `notifications.destroy` + tombol per baris), lalu baris id 8 dihapus lewat UI itu dengan jejak activity log `notification.deleted`. Tersisa 31 notifikasi, 0 em dash |
| Deferred: ErrorState Produk/Pelanggan/Imports (bagian 5) | **Resolved**: ketiga halaman kini punya penanganan galat + tombol Coba lagi |
| Deferred: migrasi tabel beranda sibuk | **Sebagian selesai**: primitif `table.tsx` diperkuat (`TableScroll`, kolom numerik) dan 3 halaman dimigrasi; Pesanan (grid kartu sesuai kontrak), Produk, Pelanggan, Sub Model tetap deferred dengan alasan yang sama |
| Tugas terpisah: audit alias kategori (bagian 9 poin 5) | **Selesai**: 76 berkas fixture test dimigrasi ke kode kanonik, peta alias dihapus dari helper, 13 pemanggil dikonversi, URL English tetap 301. Dua cacat laten tersingkap dan diperbaiki (label slide promo kanonik, satu slug test) |
| Keputusan tertunda: bulk Produk/Pesanan (bagian 9 poin 4) | Tetap dibatalkan sesuai B3: tidak ada endpoint massal, tidak dibuat demi tampilan |

Ronde kedua juga menambahkan hal yang bukan temuan audit melainkan fitur
permintaan owner: pemangkasan otomatis notifikasi (`notifications.prune`,
retensi `NOTIFICATION_RETENTION_DAYS` default 90 hari, dibaca dari
`config/operations.php`) dan tombol "Bersihkan lama".

Verifikasi akhir ronde kedua: suite PHP penuh 1 skipped **1152 passed, 0 gagal**
(naik dari 1147 lewat 5 test baru: NotificationManageTest 5 kasus), vitest 25
berkas 203 test, typecheck bersih, build sukses, pre-push hook lolos setiap
push, smoke HTTP katalog 200 dan redirect URL English 301 ke slug kanonik.

Status akhir seluruh 30 temuan: **27 resolved, 6 intentional (dokumentasi,
bukan pekerjaan), 2 deferred dengan alasan tercatat (migrasi tabel beranda
sibuk, sheet publik), 0 blocked.** Data produksi berubah hanya dua hal yang
diizinkan: satu konten em dash via UI admin, dan satu baris notifikasi
dihapus lewat UI baru.
| Admin F-05: PermissionDeniedState dan 403/404 (bagian 2) | **Resolved** (tambahan ronde ketiga, commit `6e61ceb6`): satu-satunya temuan yang terlewat dari eksekusi tunggal; 403 kini merender PermissionDeniedState, 404/500/503 tetap kartu semula |
