# Skrip backup & monitoring produksi 202

Sumber versi terkontrol dari skrip yang berjalan di VPS produksi 202 (202.74.74.87)
di bawah `/root`. Disimpan di sini supaya tidak hanya hidup di server.

## Isi

| Berkas | Tujuan |
|---|---|
| `backup-alert.sh` | Monitor kegagalan backup: penanda `ALERT-*`, kesegaran off-site R2, umur dump lokal, keberhasilan drill, jalur alarm |
| `r2_freshness.py` | Membaca umur objek terbaru di bucket backup R2 (dipakai `backup-alert.sh`) |
| `daily-db-backup.sh` | Dump harian, verifikasi gzip, rotasi 7 slot, unggah R2 |
| `hourly-binlog-backup.sh` | Arsip binlog tiap jam untuk pemulihan titik-waktu |
| `stale-check.sh` | Pemeriksa kebasian dump dan arsip binlog lokal |
| `weekly-restore-drill.sh` | Drill restore mingguan ke DB uji `ragil_restore_test` |
| `logrotate-ragil-backups` | Rotasi log `/root/backups/*.log` (mingguan, simpan 8, terkompresi) |

## Pemasangan di 202

```bash
sudo install -m 750 -o root -g root backup-alert.sh /root/backups/backup-alert.sh
sudo install -m 750 -o root -g root r2_freshness.py /root/backups/r2_freshness.py
```

Tambahkan ke crontab root (sekali saja):

```
20 * * * * /root/backups/backup-alert.sh >> /root/backups/cron-health.log 2>&1
```

Dijalankan sebagai root: perlu membaca `/root/backups` dan kredensial R2 dari
`shared/.env`.

## Prinsip rancangan

**Dua lapis: penanda dan hasil.** Sejak 17 Okt 2026 penanda `ALERT-*` di 202
memakai kontrak yang sama dengan 209: **berkas ADA berarti gagal, dan skrip
penulis MENGHAPUSNYA saat sukses.** Sebelumnya penanda memakai penulisan kosong
untuk sehat dan `touch` untuk gagal, sehingga keduanya 0 byte dan tidak bisa
dibedakan; karena itu penanda lama hanya dicatat dan tidak pernah jadi alarm.

Kontrak baru ini perlu karena pemeriksaan berbasis HASIL terlambat: pada 17 Okt
unggah R2 mati pukul 03:17, tetapi alarm baru berbunyi 15:20 setelah umur dump
melewati batas 26 jam. Dengan penanda, kegagalan terlihat pada jam kejadiannya.

Lapis hasil tetap dipertahankan karena penanda bisa hilang bersama berkasnya, dan
karena hasil mengukur akibat, bukan niat skrip.

**Satu penanda, satu pemilik.** Sebelum 17 Okt dua penanda dipakai bersama oleh
beberapa skrip, sehingga keberhasilan satu tahap bisa menghapus kegagalan tahap
lain. Misalnya unggah dump yang berhasil menghapus penanda yang baru dipasang
oleh unggah binlog yang gagal. Sekarang setiap penanda hanya ditulis dan dihapus
oleh satu skrip:

| Penanda | Pemilik | Arti |
|---|---|---|
| `ALERT-dump-local` | `daily-db-backup.sh` | Dump atau verifikasi gzip gagal |
| `ALERT-r2-dump` | `daily-db-backup.sh` | Unggah dump harian ke R2 gagal |
| `ALERT-r2-binlog` | `hourly-binlog-backup.sh` | Unggah arsip binlog ke R2 gagal |
| `ALERT-local-stale` | `stale-check.sh` | Dump atau arsip binlog lokal basi |

`weekly-restore-drill.sh` tidak lagi menulis penanda, karena `backup-alert.sh`
sudah membaca hasil drill langsung dari `restore-drill.log` (kode `DRILL-RUN`).

**Penanda yang tidak dikenal dicatat, tidak dibisukan.** Penanda baru yang belum
terdaftar di `backup-alert.sh` muncul di log sebagai catatan, supaya tidak
diabaikan diam diam tanpa memicu alarm dengan pesan yang tidak jelas.

**Kegagalan pemeriksaan tidak pernah dilaporkan sebagai sehat.** Setiap
pemeriksaan yang tidak bisa diselesaikan menghasilkan alarm tersendiri, dengan
kode berbeda dari "basi":

| Kode | Arti |
|---|---|
| `OFFSITE-DUMP` | Dump terbaru di R2 lebih tua dari 26 jam |
| `OFFSITE-BINLOG` | Binlog terbaru di R2 lebih tua dari 3 jam |
| `OFFSITE-CHECK` | Pemeriksaan R2 gagal atau melewati batas waktu |
| `LOCAL-DUMP` | Dump lokal lebih tua dari 26 jam |
| `DRILL` | Keberhasilan drill terakhir lebih tua dari 8 hari |
| `DRILL-RUN` | Eksekusi drill terakhir tidak berakhir berhasil |
| `ALARM-CONFIG` | Konfigurasi alarm tidak lengkap |
| `ALARM-KIRIM` | Pengiriman alarm terakhir gagal sebagian |
| `DUMP-LOCAL` | Penanda `ALERT-dump-local` ada |
| `R2-DUMP-UPLOAD` | Penanda `ALERT-r2-dump` ada |
| `R2-BINLOG-UPLOAD` | Penanda `ALERT-r2-binlog` ada |
| `STALE-LOCAL` | Penanda `ALERT-local-stale` ada |

Umur drill merujuk **keberhasilan terakhir** (`last-drill` hanya ditulis saat
drill lulus), bukan sekadar waktu ubah log.

**State disimpan setelah pengiriman berhasil.** Kalau pengiriman gagal, state
tidak diset sehingga pemeriksaan berikutnya mencoba lagi; alarm tidak hilang
permanen. Untuk notifikasi pulih, state dibersihkan setelah kabar pulih terkirim.

**Kunci `flock`** mencegah dua eksekusi bersamaan menggandakan notifikasi.

## Uji yang sudah dijalankan (14 Oktober 2026)

Harness terisolasi di `/tmp` dengan `ALERT_DIR`, `BACKUP_DIR`, dan pengirim
dialihkan ke stub. Backup asli dan bucket produksi tidak tersentuh.

| Skenario | Hasil |
|---|---|
| Sehat | Tanpa alarm, state bersih |
| Off-site basi | `OFFSITE-DUMP` + `OFFSITE-BINLOG` |
| Akses R2 gagal | `OFFSITE-CHECK` (bukan sehat) |
| Pemeriksaan R2 timeout | `OFFSITE-CHECK`, monitor berhenti di batas waktu |
| Drill gagal | `DRILL-RUN` |
| Kirim gagal | State tetap kosong, percobaan berikutnya mengirim |
| Kegagalan berulang | Kirim sekali, putaran berikutnya tidak mengulang |
| Pemulihan | Notifikasi pulih terkirim, state bersih |
| Eksekusi bersamaan | 3 serentak, 1 mengirim, 2 dilewati kunci |

Catatan kejujuran: seluruh hasil di tabel ini adalah **PASS dengan pengirim
stub**, bukan bukti pengiriman Telegram sungguhan. Pengiriman nyata hanya
terbukti lewat riwayat `tg-alert.log` (kirim sukses terakhir sebelum 14 Oktober)
dan tidak diuji ulang pada penyelesaian ini.

## Alarms palsu 21:07 sudah dikoreksi

Revisi pertama menjadikan penanda `ALERT-*` sebagai alarm, sehingga saat
dijalankan terhadap keadaan nyata ia mengirim alarm palsu ke Telegram owner
pukul 21:07 (kode `MARKER`). Revisi final tidak lagi memakai penanda sebagai
alarm, hanya mencatatnya.
