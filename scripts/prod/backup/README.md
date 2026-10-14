# Skrip backup & monitoring produksi 202

Berkas di direktori ini adalah sumber versi terkontrol dari skrip yang berjalan
di VPS produksi 202 (202.74.74.87) di bawah `/root`. Disimpan di sini supaya tidak
hanya hidup di server, sesuai temuan audit 2026-10-14 bahwa skrip backup dan
monitoring tidak ada di Git.

## Isi

| Berkas | Tujuan |
|---|---|
| `backup-alert.sh` | Monitor kegagalan backup: kesegaran salinan off-site R2, umur dump lokal, umur drill restore, kelengkapan konfigurasi alarm |
| `r2_freshness.py` | Membaca umur objek terbaru di bucket backup R2 (dipakai `backup-alert.sh`) |
| `logrotate-ragil-backups` | Rotasi log di `/root/backups/*.log` (mingguan, simpan 8, terkompresi) |

## Pemasangan di 202

```bash
sudo install -m 750 -o root -g root backup-alert.sh  /root/backups/backup-alert.sh
sudo install -m 750 -o root -g root r2_freshness.py  /root/backups/r2_freshness.py
sudo install -m 644 -o root -g root logrotate-ragil-backups /etc/logrotate.d/ragil-backups
```

Tambahkan ke crontab root (sekali saja):

```
20 * * * * /root/backups/backup-alert.sh >> /root/backups/cron-health.log 2>&1
```

Jalankan sebagai root: perlu membaca `/root/backups` dan kredensial R2 dari
`shared/.env`.

## Mengapa alarm memakai HASIL, bukan penanda ALERT-*

Penanda `ALERT-*` di 202 **tidak pernah bisa bersih**. Skrip di sana memakai
`: > berkas` untuk menyatakan sehat, sedangkan penandaan gagal memakai `touch`;
keduanya meninggalkan berkas 0 byte, sehingga keberadaan berkas tidak
membedakan gagal dari sehat. Di 209 kontraknya benar: skrip di sana
MENGHAPUS penanda saat sukses (`rm -f`), jadi keberadaan berkas berarti gagal.

Karena itu `backup-alert.sh` mengambil alarm dari kesegaran salinan off-site,
umur dump, dan umur drill. Penanda hanya dicatat sebagai catatan. Ini juga
membuat monitor tetap benar walau konvensi penanda di 202 belum diperbaiki.

## Uji yang sudah dijalankan (14 Oktober 2026)

Harness terisolasi di `/tmp` dengan `ALERT_DIR`, `BACKUP_DIR`, dan `TG` dialihkan
ke stub, sehingga backup asli dan bucket produksi tidak tersentuh:

| Skenario | Hasil |
|---|---|
| Semua sehat | Tanpa alarm, state bersih |
| Penanda ada + dump basi + drill basi | Tiga alarm terkirim, state tercatat |
| Masih rusak (ulang) | Tanpa kirim ulang, hanya log "masih kritis" |
| Semua dipulihkan | Tiga alarm PULIH terkirim, state bersih |
| Off-site R2 basi | OFFSITE-DUMP dan OFFSITE-BINLOG terkirim |
| Konfigurasi alarm hilang | ALARM-CONFIG terkirim |
