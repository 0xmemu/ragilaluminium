# Tingkat Alert & Rencana Antisipasi (2026-09-28)

Keputusan owner 2026-09-28: **hanya masalah yang berdampak ke pelanggan atau uang
yang dikirim ke Telegram.** Sisanya dicegah agar tidak terjadi, dan bila bocor
ditangani sistem sendiri tanpa agent.

Cermin kode: `scripts/prod/alert-aggregator.sh` (dijalankan di server sebagai
`/root/scripts_alert_aggregator.sh` oleh cron tiap 5 menit sebagai root).

---

## A. Dikirim ke Telegram (dampak pelanggan atau uang)

| Kode | Kondisi | Kenapa layak sampai owner |
|---|---|---|
| `HTTP_MATI` | `/`, `/products`, `/cart` bukan 200 | pelanggan tidak bisa melihat produk atau memesan |
| `WA_PUTUS` | sesi WhatsApp bukan `open` walau sudah dicoba sambung ulang | notifikasi pelanggan berhenti, balasan pelanggan tidak masuk panel |
| `LAYANAN:<nama>` | layanan inti tetap mati setelah dihidupkan otomatis | bagian sistem berhenti melayani |
| `TUNNEL_MATI` | kontainer cloudflared tidak jalan setelah dicoba hidupkan | situs tidak bisa dibuka dari luar |
| `QUEUE_TUMPUK` | antrean pekerjaan > 500 | pesanan tertunda diproses |
| `DISK_DARURAT` | disk >= 92% setelah pembersihan cache otomatis | situs dan pencatatan pesanan bisa berhenti |
| `RAM_DARURAT` | RAM >= 95% | server berisiko membeku |

Format pesan wajib menjawab tiga hal supaya bisa ditindaklanjuti: **Artinya**
(apa yang rusak), **Dampak** (efeknya ke toko), **Tindakan** (harus apa).

Dedupe berbasis **kode jenis**, bukan kalimat, sehingga angka yang berubah
(mis. persentase disk atau umur marker) tidak memicu pesan berulang. Saat
keadaan pulih, dikirim satu kabar "masalah selesai" sekali per insiden.

## B. Tidak dikirim ke Telegram (log saja, untuk dibaca agent)

- Penanda `ALERT-*` dari pemeriksa mingguan/harian: audit semantik, kesehatan DB
  live, drill PITR, drill arsip, uji restore, smoke test, unggah binlog cadangan.
- Umur penanda (restore test, audit semantik, arsip binlog).
- Inode, tren pertumbuhan disk, swap, jejak OOM historis.

Alasannya: keempat dari enam alert terakhir di kelompok ini **bukan kerusakan
sistem**, melainkan kesalahan alat pemeriksanya sendiri. Alert jenis ini tidak
memerlukan keputusan pemilik toko.

## C. Antisipasi (agar tidak terjadi) dan penyembuhan mandiri (bila bocor)

| Masalah | Dicegah dengan | Bila bocor, ditangani sendiri dengan |
|---|---|---|
| Layanan inti mati | (menunggu izin) kebijakan restart systemd untuk nginx, php8.3-fpm, laravel-reverb | Fase 1a agregator: `systemctl restart` lalu cek ulang; dicatat ke `self-heal.log` |
| Tunnel Cloudflare mati | — | Fase 1b: `docker start ragil-cloudflared` |
| Sesi WhatsApp putus | pemeriksaan **sambungan**, bukan sekadar proses hidup | Fase 1c: `POST /connect` lalu cek ulang status |
| Disk terisi perkakas kerja | pemangkasan cache bertingkat | Fase 1d: >=80% pangkas cache ringan (npm, pnpm, pip, uv, playwright, copilot, bun); >=92% pangkas cache besar (JetBrains, cargo, rustup). **Tidak pernah menyentuh data, cadangan, atau kode** |
| Unggah cadangan binlog gagal | percobaan ulang di dalam skrip unggah | Fase 1e: jalankan ulang skrip unggah; penanda hilang bila berhasil |
| Penanda menempel berhari-hari | semua skrip mengosongkan penandanya saat sukses (diverifikasi 7 dari 7 skrip) | — |
| Alarm palsu karena rumus/harapan salah | rumus audit disamakan dengan rumus kode (menyertakan asuransi), smoke test menerima 302 di `/checkout`, `CleanupDummyData` mereset `payment_status` | — |
| Pesan berulang tiap jam | dedupe berbasis kode jenis | — |

## D. Yang TIDAK bisa diselesaikan sendiri (butuh manusia)

| Masalah | Sebab |
|---|---|
| Sesi WhatsApp ter-logout total | WhatsApp mewajibkan pindai QR dari HP bernomor toko |
| Kapasitas server kurang | keputusan pemilik |
| Bug di dalam kode atau skrip | butuh tinjauan |
| Keputusan bisnis (mis. nominal refund) | butuh pertimbangan manusia |

## E. Status keputusan owner (dijawab "proses", 2026-09-28)

1. **SELESAI: skrip pantau kini di repo.** 26 skrip disalin ke
   `scripts/prod/monitoring/` dan dijaga `tests/Feature/MonitoringScriptsContractTest.php`:
   sintaks setiap skrip shell dan python diperiksa, skrip pembuat penanda wajib
   mengosongkan penandanya saat sukses, dan agregator wajib memisahkan alert
   kritis (Telegram) dari catatan teknis (log).
   Penjaga terbukti menggigit: pengosong penanda sengaja dihapus, test langsung
   gagal di asersi yang tepat, lalu dipulihkan dan hijau kembali.

2. **SUDAH AKTIF: pemangkasan cache.** Berjalan di agregator Fase 1d — disk >=80%
   memangkas cache ringan (npm, pnpm, pip, uv, playwright, copilot, bun), >=92%
   memangkas cache besar (JetBrains, cargo, rustup). Pagar: hanya direktori cache
   yang bisa dibuat ulang; data, cadangan, dan kode tidak pernah disentuh.

3. **BELUM: kebijakan restart systemd untuk nginx dan php8.3-fpm.** Butuh menulis
   ke `/etc/systemd/system`, dan guard keselamatan memblokir direktori sistem
   (aturan keras yang tidak diakali). Perintah siap tempel di server:

   ```bash
   for d in nginx php8.3-fpm laravel-reverb; do
     mkdir -p /etc/systemd/system/$d.service.d
     printf '[Service]\nRestart=always\nRestartSec=5\n' \
       > /etc/systemd/system/$d.service.d/restart.conf
   done
   systemctl daemon-reload
   systemctl show nginx.service php8.3-fpm.service -p Restart -p RestartSec
   ```

   Selama belum dipasang, lubang "situs mati" **sudah tertutup** oleh pengawas
   5 menit (agregator Fase 1a menghidupkan ulang layanan yang mati). Bedanya
   hanya kecepatan pemulihan: detik versus maksimal lima menit.

## G. Backup pelanggan dan trafik (2026-09-28)

### Backup: kuat, dengan tiga celah yang ditutup

Yang sudah kokoh: dump seluruh database dengan `--single-transaction`, gzip,
diverifikasi `gzip -t` sebelum sah, backup lama tidak pernah ditimpa sebelum yang
baru sukses, disimpan lokal 7 hari plus off-site R2 (retensi 30 hari), binlog tiap
jam untuk pemulihan ke titik waktu, arsip mingguan dan bulanan, uji restore
mingguan, dan drill PITR mingguan. Dibuktikan langsung: dump memuat baris
`customers` lengkap dengan nama, nomor HP, email, dan alamat.

Tiga celah yang diperbaiki hari ini:

1. **Uji restore tidak memverifikasi data pelanggan.** Sebelumnya hanya lima tabel
   (produk, varian, media produk, pesanan, item pesanan). Kini `customers`,
   `users`, dan `payments` ikut diverifikasi dan dibuktikan cocok: 8 pelanggan,
   1 pengguna, 20 pembayaran.
2. **Arsip mingguan bisa terblokir diam-diam.** Aturan lama membatalkan arsip bila
   belum ada bukti uji restore terbaru, sehingga W35 dan W38 hilang. Kini arsip
   tetap dibuat dan ditandai BELUM TERVERIFIKASI (`ALERT-archive-unverified`).
3. **Salinan R2 tidak terenkripsi.** Identitas pelanggan tadinya terbaca apa adanya.
   Kini salinan off-site dienkripsi (AES-256-CBC + PBKDF2) memakai kunci di
   `/root/backups/.backup-key`; berkas lokal tetap polos supaya rantai pemulihan
   tidak berubah. Dibuktikan bolak-balik: unggah terenkripsi, unduh dari R2,
   dekripsi, sidik jari identik dengan dump asli.

**PENTING:** tanpa kunci itu, salinan di R2 TIDAK BISA dibuka. Kunci dibuat
2026-09-28 dan disalin ke Telegram pemilik; simpan di pengelola kata sandi. Bila
kunci hilang, seluruh cadangan off-site menjadi tidak berguna.

### Trafik

Yang ada: pembatas nginx `limit_req` 20 permintaan/detik dan `limit_conn`;
pencatatan kunjungan produk di `performance_metrics`; snapshot kesehatan tiap 15
menit; dan pencatat trafik baru (`scripts_traffic_check.sh`, tiap jam) yang mengisi
`/root/backups/traffic-daily.csv` serta mencatat pemakaian bandwidth harian.

Yang ditambahkan ke agregator: **uji keterjangkauan dari LUAR**
(`SITUS_TAK_TERJANGKAU`) — satu-satunya ujian yang membuktikan pelanggan bisa
membuka situs, karena ujian internal tetap lulus walau tunnel atau DNS rusak —
plus ambang bandwidth (`BANDWIDTH_TINGGI`, kritis di 50 GB, catatan di 20 GB).

### IP asli pengunjung: temuan dan tambalannya (2026-09-28)

Seluruh trafik masuk lewat tunnel `cloudflared` yang berjalan di host ini, dan
nginx belum membaca header `CF-Connecting-IP`. Akibatnya, sebelum tambalan ini:

1. **Semua pengunjung terlihat sebagai satu IP.** `limit_req` 20 permintaan/detik
   dan `limit_conn` 30 di situs berlaku **GLOBAL untuk seluruh situs**, bukan per
   pengunjung. Lonjakan trafik wajar bisa membuat pelanggan menerima 503.
2. **Aplikasi menerima `REMOTE_ADDR 127.0.0.1` untuk setiap permintaan**, karena
   `sites-enabled/ragil` baris 86 memakukannya, dan `fastcgi_params` tidak
   meneruskan satu pun header HTTP. Jadi pembatas Laravel (throttle) juga global,
   dan log aplikasi tidak menunjukkan IP asli.
3. **Analisa trafik hanya perkiraan**, karena pemisahan pengunjung dari trafik
   internal tidak bisa dilakukan dari kolom IP.

**Tambalannya**: `scripts/prod/nginx-real-ip.sh`. Skrip itu (a) mempercayai HANYA
peer tunnel plus loopback lalu membaca `CF-Connecting-IP`, dan (b) meneruskan IP
asli ke aplikasi lewat `X-Forwarded-For` yang diambil dari `$remote_addr` hasil
real_ip, bukan dari header kiriman klien. `REMOTE_ADDR` sengaja tetap 127.0.0.1
karena Laravel mempercayai alamat itu sebagai proxy (`TRUSTED_PROXIES`).

Port 8200 tidak terbuka ke publik (firewall hanya 22 dan 443), jadi header itu
tidak bisa dipalsukan dari luar. Bila `CF-Connecting-IP` tidak ada, `$remote_addr`
kembali ke IP peer atau perilaku sekarang, sehingga tambalan ini tidak bisa
merusak. Skrip menyimpan cadangan, menguji dengan `nginx -t`, memuat ulang tanpa
memutus koneksi, dan mengembalikan cadangan bila uji gagal.

Jalankan sebagai root di server, satu kali:

```bash
bash /root/ragilaluminium/scripts/prod/nginx-real-ip.sh
```

Buktikan berhasil: buka situs dari perangkat lain, lalu
`tail -5 /var/log/nginx/access.log`; kolom pertama harus IP publik perangkat itu,
bukan IP server.

Cara membuktikan tambalannya tidak rusak sebelum dipasang: `scripts/prod/uji-tambalan-nginx.sh`
menyalin konfigurasi ke direktori sementara, menerapkan sisipan yang sama, dan
menjalankan `nginx -t` terhadap salinan itu. Hasil 2026-09-28: **syntax is ok, test
is successful**.

**Pemantau pendamping:** agregator kini menghitung penolakan ke pengunjung
(503/429) pada jam berjalan dengan kode `PELANGGAN_DITOLAK`. Sebelum tambalan
dipasang, ini menangkap risiko pembatas global; sesudahnya, ini tetap berguna
sebagai tanda nyata ada pelanggan yang ditolak. Diverifikasi dengan log buatan:
tiga penolakan pengunjung terhitung, satu penolakan curl dikecualikan.

**Catatan lama yang belum ditutup:** nginx belum membaca IP asli pengunjung. Seluruh
trafik masuk lewat tunnel Cloudflare sehingga tercatat sebagai satu IP
(209.23.10.62). Akibatnya (a) `limit_req` per IP efektif menjadi batas bersama
untuk semua pengunjung, bukan per pengunjung, dan (b) pemisahan pengunjung dari
trafik internal di log hanya perkiraan. Perbaikannya menuntut
`set_real_ip_from` dan `real_ip_header CF-Connecting-IP` di konfigurasi nginx
(`/etc/nginx`, di luar area tulis agent).

## F. Berkas terkait

- Agregator: `/root/scripts_alert_aggregator.sh`, cermin `scripts/prod/alert-aggregator.sh`,
  cadangan versi lama `/root/backups/scripts_alert_aggregator.sh.bak-v2-20260928`
- Log: `alert-aggregator.log` (keputusan tiap 5 menit), `self-heal.log` (pemulihan mandiri),
  `alert-latest.txt` (ringkasan keadaan terakhir)
- Uji: agregator v3 diuji di sandbox dengan port situs dimatikan dan Telegram
  dinonaktifkan — terbukti mendeteksi 3 halaman gagal, menyusun pesan tiga bagian,
  dan dedupe menahan pengiriman ulang.
