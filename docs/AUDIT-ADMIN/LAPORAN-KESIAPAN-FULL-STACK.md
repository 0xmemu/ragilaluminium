# Laporan Kesiapan Sistem (Full Stack Readiness Report)

Tanggal audit: 25 September 2026  
Host evaluasi: VPS 209 (`209.23.10.62` / `ra.333labs.tech`)  
Status kesimpulan: **Infrastructure and application readiness verified for tested scope.**

---

## 1. Definisi Istilah Sistem

Sebelum istilah teknis digunakan, berikut arti dan fungsinya:
- **Peladen Web Balik (Nginx Port 8200):** Perangkat lunak peladen web yang menerima lalu lintas dari tunnel Cloudflare dan meneruskannya ke pool worker PHP-FPM.
- **Pengelola Proses FastCGI (PHP 8.3-FPM):** Mesin pengeksekusi kode program Laravel 11.
- **Terowongan Cloudflare (Cloudflared Tunnel):** Penghubung terenkripsi antara domain `ra.333labs.tech` dan port lokal Nginx 8200.
- **Penyimpanan Objek R2 (Cloudflare R2):** Penyimpanan berkas media/gambar katalog berbasis protokol S3 SigV4.
- **Pekerja Antrean Sistem (ragil-queue.service):** Proses systemd di latar belakang untuk tugas antrean (impor katalog, pemrosesan media).
- **Simulasi Permintaan Kernel (Route Probe):** Pengecekan respons kode status HTTP dengan memanggil router Laravel langsung di lingkungan runtime lokal tanpa melalui jaringan publik internet.

---

## 2. Penilaian Status per Lapisan Sistem

| Lapisan Sistem | Status Terverifikasi | Batasan dan Ruang Lingkup yang Diuji |
|---|---|---|
| **Kode Aplikasi** | **Siap pada scope yang diuji** | Typecheck bersih 0 error, ESLint pada berkas aktif 0 error/warning, build aset Vite selesai 20.11 detik. |
| **Infrastruktur Server** | **Aktif** | Systemd `nginx`, `php8.3-fpm`, `mysql`, `redis-server`, dan `ragil-queue` berstatus active (running). Cloudflared tunnel aktif via token file. |
| **Route Publik & Admin** | **Terverifikasi (HTTP 200)** | 10 rute kanonik publik dan 17 rute kanonik admin terautentikasi menghasilkan HTTP 200 pada simulasi kernel lokal. |
| **Antarmuka Desktop 1440px** | **Terverifikasi** | Inspeksi visual DOM beranotasi via browser Chromium headless pada viewport desktop standar 1440x900 piksel. |
| **Alur Retur & Refund** | **Test backend lulus** | Pengujian unit lifecycle retur, capping refund berdasarkan uang bayar riil, dan pembatalan payment pending pada paket ditolak lulus 100%. |
| **Polling Resi J&T** | **Test dasar lulus** | Command `shipping:poll-jnt` teruji: seleksi resi aktif, isolasi status terminal, throttling, dan exponential backoff. |
| **Keuangan Toko** | **Rekonsiliasi internal** | Merupakan pembukuan internal toko (Gross, Net, Arus Kas Pembayaran Diterima), **bukan** integrasi mutasi perbankan otomatis. |
| **Webhook J&T** | **Unauthenticated path aman** | Jalur tanpa signature resmi kurir terbukti ditolak HTTP 401 Unauthorized dan CSRF-exempt; pengujian dengan tanda tangan valid terbukti via unit test suite bertanda tangan tiruan. |
| **Otomatisasi 72 Jam** | **Belum diterapkan** | Fitur otomatisasi pesanan delivered ke completed setelah 72 jam berada pada status: **menunggu eksekusi**. |

---

## 3. Batasan Uji & Catatan Kritis

Laporan ini secara sadar membatasi klaim kesiapan berdasarkan bukti nyata yang ada:

1. **Uji Antarmuka Terbatas pada Desktop 1440px:**
   Pengujian interaktif browser dilakukan pada viewport desktop 1440x900 piksel. Pengujian visual pada perangkat mobile 390px belum dijalankan dalam sesi audit ini.
2. **Hasil Health Endpoint Terbatas pada Dependensi Dasar:**
   Respons `/api/health/ready` berbalas `{"status":"ok","checks":{"database":"pass","cache":"pass","storage":"pass"}}`. Endpoint ini membuktikan konektivitas MySQL, Redis, dan R2 aktif, tetapi **tidak** menjadi bukti bahwa WhatsApp sedang aktif mengirim pesan, bahwa kurir J&T sedang memancarkan webhook, atau bahwa antrean background sedang mengeksekusi job tertentu.
3. **Pemisahan Jalur Webhook Kurir:**
   Pengujian probe curl pada endpoint `/api/jnt` dan `/webhook/shipping/jnt` memverifikasi bahwa permintaan tanpa tanda tangan ditolak secara aman dengan HTTP 401 Unauthorized. Keberhasilan pemrosesan webhook dengan digest signature valid diverifikasi melalui pengujian otomatis unit backend (`ShippingStatusTest`), bukan melalui kiriman dari server J&T nyata.
4. **Status Eksekusi Auto-Complete 72 Jam:**
   Transisi otomatis pesanan `delivered` menuju `completed` setelah 72 jam **belum diaktifkan**. Penyelesaian pesanan saat ini sepenuhnya mengandalkan penekanan tombol manual oleh admin di panel pesanan.
5. **Ketiadaan Integrasi Kas Perbankan:**
   Pengembalian dana (refund) adalah angka pencatatan manual pengurang Penjualan Bersih di laporan toko. Pengiriman uang riil ke rekening pembeli dilakukan secara manual oleh admin di luar sistem (m-Banking/ATM).

---

## 4. Rincian Angka Konkret Rangkaian Pengujian

### A. Automated Backend Test Suite (PHPUnit)
- **Total Uji:** 1.164 test
- **Hasil:** 1.163 passed, 1 skipped, 0 failed
- **Total Asersi (Assertions):** 11.765 asersi
- **Waktu Eksekusi Penuh:** 143.79 detik
- *Catatan Skipped:* 1 test dilewati (`skip rename order_status` / `skip rename payments.status` akibat keterbatasan dialek SQLite memory test).

### B. Automated Frontend Test Suite (Vitest)
- **Berkas Uji (Test Files):** 25 passed dari 25 berkas (100%)
- **Total Uji Frontend:** 203 passed dari 203 test (100%)
- **Waktu Eksekusi:** 8.52 detik

### C. Simulasi Status Respons Rute (Kernel HTTP Probe)
- **Rute Publik (10 rute):** 10 dari 10 menghasilkan status HTTP 200 OK (`/`, `/products`, `/cara-pemesanan`, `/contact`, `/about`, `/reviews/web`, `/order/status`, `/login`, `/policy/privacy`, `/policy/terms`).
- **Rute Admin Terautentikasi (17 rute):** 17 dari 17 menghasilkan status HTTP 200 OK (`/admin`, `/admin/kelola/kategori`, `/admin/kelola/produk`, `/admin/orders`, `/admin/payments`, `/admin/shipping`, `/admin/analytics/store-performance`, `/admin/whatsapp`, `/admin/profile`, `/admin/settings`, `/admin/cod-settings`, `/admin/shipping-subsidy`, `/admin/customers`, `/admin/testimonials`, `/admin/cara-pemesanan`, `/admin/tentang-kami`, `/admin/users`).
- **Endpoint Health:** `/api/health/ready` menghasilkan status HTTP 200 OK.
- **Endpoint Webhook:** `/webhook/shipping/jnt` dan `/api/jnt` menghasilkan status HTTP 401 Unauthorized saat diakses tanpa signature resmi.

### D. Pengujian Integrasi Browser Interaktif (Chromium Headless)
- **Viewport:** 1440 x 900 piksel, scale factor 1.5.
- **Sesi:** Login admin atas nama `febrian`.
- **Halaman yang Ditinjau:** Dashboard admin (`/admin`) dan Daftar Produk (`/admin/kelola/produk`).
- **Hasil:** 44 elemen kontrol terdeteksi utuh, form alignment ADR-022 sejajar tanpa dorongan padding manual, nama produk berbobot font-normal (400), dan tombol aksi berada di baris judul kanan atas.
