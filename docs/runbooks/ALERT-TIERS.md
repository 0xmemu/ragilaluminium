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

## E. Keputusan yang menunggu owner

1. Pindahkan skrip pemantauan `/root/scripts_*.sh` ke repo supaya ber-versi,
   bisa ditinjau, dan punya test (sekarang hanya ada di server, tanpa versi).
2. Boleh cache perkakas dipangkas otomatis? Pagarnya: hanya direktori cache,
   ambang disk minimum, dan tidak pernah menyentuh data, cadangan, maupun kode.
3. Aktifkan kebijakan restart systemd untuk nginx, php8.3-fpm, dan laravel-reverb
   (butuh menulis ke `/etc/systemd/system`)?

## F. Berkas terkait

- Agregator: `/root/scripts_alert_aggregator.sh`, cermin `scripts/prod/alert-aggregator.sh`,
  cadangan versi lama `/root/backups/scripts_alert_aggregator.sh.bak-v2-20260928`
- Log: `alert-aggregator.log` (keputusan tiap 5 menit), `self-heal.log` (pemulihan mandiri),
  `alert-latest.txt` (ringkasan keadaan terakhir)
- Uji: agregator v3 diuji di sandbox dengan port situs dimatikan dan Telegram
  dinonaktifkan — terbukti mendeteksi 3 halaman gagal, menyusun pesan tiga bagian,
  dan dedupe menahan pengiriman ulang.
