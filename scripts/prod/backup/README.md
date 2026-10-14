# Skrip backup & monitoring produksi 202

Sumber versi terkontrol dari skrip yang berjalan di VPS produksi 202 (202.74.74.87)
di bawah `/root`. Disimpan di sini supaya tidak hanya hidup di server.

## Isi

| Berkas | Tujuan |
|---|---|
| `backup-alert.sh` | Monitor kegagalan backup: kesegaran off-site R2, umur dump lokal, keberhasilan drill, jalur alarm |
| `r2_freshness.py` | Membaca umur objek terbaru di bucket backup R2 (dipakai `backup-alert.sh`) |
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

**Alarm diambil dari HASIL, bukan penanda internal.** Penanda `ALERT-*` di 202
tidak pernah bisa bersih: skrip di sana memakai penulisan kosong untuk menyatakan
sehat, sedangkan penandaan gagal memakai `touch`, sehingga keduanya meninggalkan
berkas 0 byte dan keberadaan berkas tidak membedakan gagal dari sehat. Di 209
kontraknya benar (skrip di sana menghapus penanda saat sukses). Penanda di 202
karena itu hanya dicatat, tidak dijadikan alarm.

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
