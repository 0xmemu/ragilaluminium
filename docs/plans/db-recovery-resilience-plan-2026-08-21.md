# Rencana Ketahanan Database — Backup yang Benar-Benar Menolong

**Tanggal:** 2026-08-21
**Masalah:** Backup dilakukan, tapi tidak ada yang membuktikan bahwa backup bisa menyelamatkan
database live saat rusak atau bermasalah. Backup yang tidak bisa dipulihkan = ilusi keamanan.

## Prinsip

Setiap lapisan backup harus diverifikasi: tidak cukup "file ada di R2" — harus terbukti
"data bisa dikembalikan ke kondisi tertentu" (restore full, PITR, atau partial rescue).

---

## Gap 1 — Live DB health check (deteksi dini korupsi)

**Sekarang:** audit semantik + CHECK TABLE hanya jalan di TEST DB (restore dari dump).
Jika live DB rusak sebelum dump, korupsi ikut ke dump → audit di test DB "lolos" karena
dump konsisten dengan dirinya sendiri.

**Yang perlu:**

1. Buat `/root/scripts_db_live_health.sh` — cron harian (mis. 06:00, sebelum backup 03:17? atau jam 12:00 siang):
   - `CHECK TABLE` untuk tabel utama (orders, order_items, payments, products, product_variants)
   - **Audit semantik terhadap LIVE DB** (`/root/scripts_semantic_audit.sh ragil_aluminium` — panggil dengan parameter DB name)
   - Cek umur transaksi macet (order `pending_payment` > 7 hari tanpa update)
   - Cek foreign key integrity (child row tanpa parent)
   - Jika GAGAL → tulis `ALERT-db-live-health` → aggregator kirim ke Telegram
2. **PENTING**: audit live bersifat **read-only** — SELECT, CHECK TABLE, tidak pernah DELETE/UPDATE.
3. Verifikasi: `mysqlcheck -c` + `php artisan tinker`? Tidak perlu — script `semantic_audit` sudah memeriksa semuanya via SELECT.

**Verifikasi:** matikan sementara foreign key (simulasi) → alert terkirim → pulihkan.

---

## Gap 2 — PITR replay test (buktikan binlog berguna)

**Sekarang:** binlog diupload ke R2 tiap jam (`scripts_backup_mysql_binlog.sh`),
tapi **tidak pernah diuji apakah bisa di-replay** ke titik waktu tertentu.

**Yang perlu:**

1. Buat `/root/scripts_drill_pitr.sh` — cron mingguan (Senin 07:00, setelah restore test 04:30):
   - Ambil dump LATEST dari backup lokal
   - Ambil binlog terkait dari R2 (download via SigV4 — pakai ulang pattern dari `scripts_r2_upload_binlog.py`)
   - Restore dump ke DB test (`ragil_pitr_test`)
   - Replay binlog: `mysqlbinlog binlog.xxx binlog.yyy | mysql ragil_pitr_test`
   - Verifikasi rowcount tabel utama cocok dengan live
   - `CHECK TABLE` + semantic audit
   - Hapus DB test
   - Jika GAGAL → alert

2. **Mulai sederhana dulu**: replay 1 jam terakhir ke test DB. Buktikan binlog bisa dipulihkan.

**Verifikasi:** log drill menunjukkan "PITR PASS" dengan rowcount cocok.

---

## Gap 3 — Live restore drill (buktikan restore bisa selamatkan live)

**Sekarang:** restore test hanya ke DB sementara, rowcount dibandingkan, lalu DB test di-drop.
Belum ada simulasi "ganti DB live dengan hasil restore".

**Yang perlu:**

1. Perluas game-day drill (lihat rencana F4):
   - Buat DB baru `ragil_restore_swap_test`
   - Restore backup LATEST ke DB baru
   - Verifikasi app bisa jalan dari DB baru: `php artisan config:cache` sementara arahkan ke DB baru
   - (Atau cukup verifikasi bahwa semua migration sudah ada, schema cocok, dan query SELECT backbone berjalan)
   - Hapus DB baru
   
2. Untuk phase 1 (belum punya VPS produksi kedua), cukup buktikan bahwa **restore ke DB baru + semua query utama berjalan** tanpa error.

**Verifikasi:** `php artisan tinker` query `DB::table('orders')->count()` dari DB restore berhasil.

---

## Gap 4 — Rowcount drift monitoring (deteksi penghapusan data)

**Sekarang:** tidak ada yang membandingkan jumlah baris hari ini vs kemarin.
Jika data terhapus (bug, human error, malware), baru ketahuan saat backup gagal atau
user melihat order hilang.

**Yang perlu:**

1. Tambahkan ke `/root/scripts_db_live_health.sh`:
   - Simpan rowcount tabel utama ke file `/root/backups/rowcount-baseline.json`:
     `{"orders": 2, "order_items": 2, "payments": 2, "customers": 2, "products": 50, "users": 3, "sessions": 2470}`
   - Setiap kali dijalankan, bandingkan dengan baseline:
     - Jika penurunan > 10% (kecuali `sessions` yang fluktuatif) → alert
     - Jika ada tabel yang tadinya 0 jadi > 0 (normal) tidak perlu alert
     - Update baseline setelah alert terkirim (supaya tidak alert terus)
   - Baseline disimpan di file, bukan DB (tidak ikut terhapus jika DB rusak)

2. **Khusus `sessions`**: fluktuasi normal (turun naik tiap hari). Jangan alert untuk sessions.

**Verifikasi:** hapus sementara 1 baris dari tabel orders (simulasi) → alert "ROWCOUNT ORDERS: 2→1" → restore.

---

## Gap 5 — Archive restore test (buktikan arsip berguna)

**Sekarang:** restore test hanya menguji LATEST dump. Arsip mingguan/bulanan di R2
tidak pernah diuji apakah file-nya masih bagus.

**Yang perlu:**

1. Tambahkan ke `/root/scripts_weekly_restore_test.sh` (atau script terpisah bulanan):
   - Setiap bulan, ambil satu arsip bulanan dari R2 (download via SigV4)
   - Restore ke DB test
   - Rowcount + CHECK TABLE + semantic audit
   - Hapus DB test
   - Jika GAGAL → alert

2. Untuk mingguan: cukup ambil arsip mingguan terakhir.

**Verifikasi:** log "ARCHIVE RESTORE TEST PASS" untuk arsip tertentu.

---

## Prioritas eksekusi

| Urut | Gap | Estimasi | Dampak jika tidak ada |
|---|---|---|---|
| 1 | **G1 — Live DB health check** | 0,5 hari | Korupsi live tidak terdeteksi sampai dump berikutnya |
| 2 | **G4 — Rowcount drift** | 0,5 hari | Data hilang baru ketahuan saat ada yang lapor |
| 3 | **G2 — PITR replay test** | 1 hari | Binlog di R2 tidak berguna — tidak bisa PITR |
| 4 | **G3 — Live restore drill** | 0,5 hari | Restore penuh belum pernah diuji end-to-end |
| 5 | **G5 — Archive restore test** | 0,5 hari | Arsip bulanan tidak pernah diverifikasi |

**Total: ±3 hari kerja agent.** Paralel: G1+G4 bisa digabung (satu script live health).
G2+G3+G5 bisa digabung (satu script drill mingguan).

## Catatan arsitektur

Rencana ini melengkapi rantai E-node yang sudah ada:

```
DUMP HARIAN → restore test → audit test DB → marker PASS
(sekarang)     ✅            ✅ (F1)        ✅

BINLOG JAM → PITR replay test → marker PITR PASS
(baru)        ❌ (G2)           ❌

LIVE DB → health check live → audit live → alert
(baru)    ❌ (G1)             ❌ (G1)      ✅ (F1)

ROWCOUNT → drift monitor → alert
(baru)     ❌ (G4)          ✅ (F1)

ARCHIVE → archive restore test → marker ARCHIVE PASS
(baru)   ❌ (G5)                  ❌
```

Semua alert melalui aggregator → Telegram bot yang sudah ada di F1.