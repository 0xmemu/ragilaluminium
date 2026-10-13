# Inventaris VPS produksi, 13 Oktober 2026

Status: audit baca-saja, belum siap menerima rilis aplikasi. Host yang diaudit: `202.74.74.87` sebagai `jendelaragilaluminium`. Jangan menaruh rahasia di berkas ini.

| Komponen | Kondisi terukur |
|---|---|
| Identitas | `ragil-aluminium`, Ubuntu 24.04, waktu Asia/Jakarta tersinkronisasi; alamat publik 202.74.74.87 |
| Sumber daya | 4 CPU, RAM 3,8 GiB, swap 2 GiB; disk root 58 GiB dengan 52 GiB bebas; inode 2 persen terpakai |
| Runtime | PHP 8.3.6, Composer 2.10.3, Node 20.20.2, npm 10.8.2, Git 2.43.0, MySQL 8.0.46 |
| Layanan | Nginx, PHP-FPM 8.3, MySQL, Redis, pembaruan sertifikat aktif; socket PHP-FPM `/run/php/php8.3-fpm.sock` |
| Akses | pengguna sudo `jendelaragilaluminium` (anggota grup www-data); pengguna `deploy` belum ada; SSH menolak password, root masih boleh memakai kunci; firewall menerima 22/80/443 |
| Database | `ragil_aluminium`, `ragil_restore_test`, pengguna aplikasi `ragil_app@localhost`; keduanya 0 tabel pada pemeriksaan ini; MySQL hanya di 127.0.0.1:3306 |
| Penyimpanan dan antrian | Redis hanya di loopback 6379; unit pekerja antrian aplikasi dan jadwal aplikasi belum ada; `/var/www/ragilaluminium` hanya berisi staging J&T yang dilindungi, tanpa `current` |
| Web publik | domain utama, www, dan api bersertifikat hingga 8 Desember 2026; DNS melewati Cloudflare; tiga domain HTTPS 200 dari origin dan HTTP 301 ke HTTPS, www belum dialihkan ke domain kanonik |
| Konfigurasi web | vhost aktif `sites-enabled/default` melayani halaman statis `/var/www/html`; vhost Laravel `sites-available/ragilaluminium.com` tersedia tetapi tidak aktif; `nginx -t` berhasil |
| Webhook J&T | origin mengembalikan jawaban statis sukses untuk `/api/jnt` sebelum aplikasi aktif; ini bukan bukti penerimaan callback oleh aplikasi dan berpotensi mengakui kiriman sungguhan tanpa pemrosesan |
| Cadangan | cron root harian untuk dump, per jam untuk log perubahan database (binary log), pemeriksaan kesegaran, dan drill pemulihan mingguan; dump 13 Oktober lolos `gzip -t`, R2 merespons 200; drill 12 Oktober lulus hanya untuk 0 tabel ke 0 tabel, belum membuktikan pemulihan data aplikasi |
| Operasi | sertifikat mempunyai timer aktif; tidak ada unit pekerja antrian, jalur `releases/shared/current`, identitas deploy, atau pemeriksaan aplikasi `/up` pada 202 |

Bukti utama: `systemctl is-active`, `ss -lnt`, `sudo ufw status verbose`, `sudo nginx -t`, `sudo certbot certificates`, `sudo crontab -l`, `sudo mysql -N -e` (metadata saja), `sudo gzip -t /root/backups/ragil/dump-slot-1.sql.gz`, `curl --resolve` ke origin. Tanggal jam dari VPS: 13 Oktober 2026 WIB. Alamat balik sumber J&T dan isi rahasia staging tidak dibuka.

Sumber kebenaran kerja aplikasi berbeda: repo aktif `/root/ragilaluminium` di 209 dan masih memuat banyak berkas belum di-commit; tidak boleh disalin langsung menjadi rilis. Bukti kondisi terkini harus diambil ulang sebelum perubahan jaringan atau rilis.
