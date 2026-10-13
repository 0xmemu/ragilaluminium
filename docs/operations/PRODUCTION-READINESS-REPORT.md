# Kesiapan produksi, audit 13 Oktober 2026

**Keputusan: NO-GO untuk rilis aplikasi; persiapan infrastruktur parsial.** Ini adalah hasil audit, bukan klaim bahwa fase persiapan selesai. Tidak ada aplikasi final, tag rilis, atau migrasi produksi yang dibuat dalam audit ini.

- Host: `ragil-aluminium`, Ubuntu 24.04, `202.74.74.87`; domain produksi `ragilaluminium.com` (keputusan akhir domain kanonik belum dicatat). DNS melalui Cloudflare, sertifikat utama/www/api valid sampai 8 Desember 2026, Nginx lolos uji sintaks, Redis/MySQL/PHP-FPM hidup.
- Jalur aplikasi yang ada `/var/www/ragilaluminium` belum berisi rilis; `releases/shared/current` dan pengguna deploy khusus belum ada. Vhost Laravel belum aktif. Halaman publik adalah laman statis, dan `/up` di origin bernilai 404, jadi health aplikasi belum dapat diuji.
- Cadangan 202 berjalan, arsip lolos pemeriksaan format, unggahan terpisah berhasil, dan drill memulihkan isi database yang saat ini memang kosong (0 tabel ke 0 tabel). Ini sesuai fase standby, bukan blocker tersendiri. Ulangi pembuktian pemulihan saat data aplikasi benar-benar masuk, tanpa mengganti sistem cadangan yang sudah bekerja.
- Masalah prioritas tinggi: `/api/jnt` mengembalikan sukses statis dari Nginx selagi tidak ada aplikasi aktif. Jangan menganggap callback J&T berhasil diterima aplikasi. Perubahan perilaku endpoint membutuhkan koordinasi pemilik integrasi dan pengujian yang tidak mengirim pesanan nyata sebelum cutover.
- Belum diverifikasi: izin tulis untuk release/storage, autentikasi deploy key baca-saja, komponen queue/scheduler pada 202, kebijakan monitoring notifikasi, pemulihan data aplikasi setelah cutover, aturan redirect www, akses health aplikasi, dan proteksi berkas internal ketika vhost Laravel benar-benar aktif.
- Wajib ditunda: merge ke main, tag rilis, pemasangan dependensi rilis final, pemasangan `current`, pengalihan trafik ke aplikasi, migrasi atau pemindahan data, serta pembersihan berkas lama. Jangan menjalankan `scripts/prod/deploy.sh` dari 209 sebagai cara cutover: skrip itu checkout branch pada working tree, memigrasi otomatis, dan backup gagal hanya menjadi peringatan.

**Langkah aman berikutnya:** sepakati pemilik perubahan J&T dan identitas deploy, lalu buat rancangan release terpisah yang hanya menerima tag yang disetujui, mencadangkan sebelum perubahan, dan dalam mode simulasi tidak mengubah state. Uji independen pada 202 tanpa menyentuh vhost aktif, database lama, atau berkas staging. Ukur kembali sumber daya serta bukti pemulihan saat data yang sah tersedia. Laporan baru diperlukan setelah semua gerbang lulus.

Dokumen pendamping: [inventaris aktual](PRODUCTION-INVENTORY.md). Prosedur rollback saat ini hanyalah rencana staging, bukan rollback aplikasi tervalidasi. Spesifikasi aplikasi tidak berubah.
