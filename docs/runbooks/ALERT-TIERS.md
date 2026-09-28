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

## F. Berkas terkait

- Agregator: `/root/scripts_alert_aggregator.sh`, cermin `scripts/prod/alert-aggregator.sh`,
  cadangan versi lama `/root/backups/scripts_alert_aggregator.sh.bak-v2-20260928`
- Log: `alert-aggregator.log` (keputusan tiap 5 menit), `self-heal.log` (pemulihan mandiri),
  `alert-latest.txt` (ringkasan keadaan terakhir)
- Uji: agregator v3 diuji di sandbox dengan port situs dimatikan dan Telegram
  dinonaktifkan — terbukti mendeteksi 3 halaman gagal, menyusun pesan tiga bagian,
  dan dedupe menahan pengiriman ulang.
