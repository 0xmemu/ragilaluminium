# Skema Maintenance — Ragil Aluminium (Produksi Live)

**Versi:** 1.0 — 2026-08-21
**Berlaku:** setelah cutover ke `ragilaluminium.com` di VPS produksi baru (209.23.10.62 saat ini = preview).
**Acuan:** `docs/DEPLOYMENT.md`, `docs/security/OWASP-REVIEW-2026-08-21.md`, `docs/plans/db-recovery-resilience-plan-2026-08-21.md`.
**Skill agent:** `ragil-alert-responder` (Hermes lokal) — lihat label alert Telegram.

---

## 1. Prinsip Operasional

1. **Kode = kebenaran.** Dokumen ini acuan operasional; kode aktual di repo/VPS adalah sumber kepastian. Bila dokumen kontradiktif dengan kode → kode menang, docs dikoreksi.
2. **Reversibel dulu.** Setiap perubahan: backup/copy dulu, lalu beri jalan mundur. Jangan pernah hapus tanpa arsip.
3. **Tidak campur kerja agent lain.** Periksa `git status` sebelum commit; commit hanya hunk milik sendiri.
4. **Data inti tak pernah dihapus.** `orders`, `order_items`, `payments`, `customers` = lifetime. Cleanup hanya untuk tabel sementara.
5. **Setiap tindakan punya verifikasi.** Jalankan lalu buktikan (curl, log, exit code), bukan klaim.

---

## 2. Arsitektur Backup & Monitoring (ringkas)

### Cron di VPS produksi

| Waktu | Task | Script | Gagal → |
|---|---|---|---|
| `17 3 * * *` | Dump harian MySQL → R2 `mysql/` | `scripts_backup_mysql.sh` | `ALERT-r2-upload` |
| `0 * * * *` | Upload binlog → R2 `binlogs/` | `scripts_backup_mysql_binlog.sh` | `ALERT-r2-upload` |
| `30 4 * * 1` | Restore test dump LATEST | `scripts_weekly_restore_test.sh` | `ALERT-stale-or-restore` |
| `0 5 * * 1` | Arsip mingguan → R2 `weekly/` | `scripts_weekly_mysql_archive.sh` | `ALERT-drill-*` |
| `0 5 1 * *` | Arsip bulanan → R2 `monthly/` | `scripts_monthly_mysql_archive.sh` | `ALERT-drill-*` |
| `0 6 * * 1` | Cleanup sessions > 14 hari | `scripts_weekly_cleanup.sh` | - |
| `30 6 * * *` | Live DB health (CHECK + audit + drift) | `scripts_db_live_health.sh` | `ALERT-db-live-health` |
| `0 7 * * 1` | PITR drill (binlog replay) | `scripts_drill_pitr.sh` | `ALERT-drill-pitr` |
| `30 7 * * 1` | Archive drill | `scripts_drill_archive.sh` | `ALERT-drill-archive` |
| `0 8 * * *` | Smoke test 24 cek | `scripts_smoke_test.sh` | `ALERT-smoke-test` |
| `*/5 * * * *` | Metrik CSV | `scripts_metrics.sh` | - |
| `*/5 * * * *` | Aggregator alert → Telegram | `scripts_alert_aggregator.sh` | - |

### Retensi

- Backup lokal (VPS): ~7 hari.
- Backup harian R2 `mysql/`: 30 hari (lifecycle).
- Binlog R2 `binlogs/`: 30 hari.
- Arsip `weekly/` + `monthly/`: **permanen** (tanpa lifecycle).
- Metrik CSV: 90 hari.
- Sessions DB: 14 hari (cleanup).
- `performance_visitor_events`: **jangan hapus** (KPI lifetime).

### Antisipasi freeze VPS (resource) — 2026-08-22

Lapis pencegahan sebelum VPS freeze karena disk/memory penuh (masalah umum yg jarang ter-monitor):

| Ambang | Tindakan |
|---|---|
| **Disk ≥75%** | Alert WARNING (pantau trend) |
| **Disk ≥85%** | Alert CRITICAL |
| **Disk ≥95%** | Alert EMERGENCY ("VPS berisiko FREEZE") |
| **Disk ≥80% & sisa <10G** | ALERT MANUAL (🛑). **AUTO-CLEANUP DINONAKTIFKAN** (2026-08-22, keputusan user) — risiko penghapusan data belum dipahami; jaring pengaman = alert + tindakan manual. Script `/root/scripts_auto_cleanup.sh` ada tapi TIDAK di-cron & tidak dieksekusi otomatis |
| **Inode ≥80/90%** | Alert WARNING/EMERGENCY (inode penuh juga bisa freeze) |
| **RAM ≥80/90/95%** | Alert WARNING/CRITICAL/EMERGENCY (OOM risk) |
| **Swap ≥90%** | Alert CRITICAL (jejak OOM) |
| **OOM historis** (dmesg) | Alert "OOM lockdown historis" (pernah freeze) |
| **Trend disk sentak ±15%/5menit** | Alert "pertumbuhan anomali" |

Script: aggregator (`/root/scripts_alert_aggregator.sh`) sudah inline-resource-check bertingkat;
auto-cleanup di `/root/scripts_auto_cleanup.sh`. Subscriber TG dipersistenkan di
`/root/backups/.tg-subscribers` (bukan getUpdates yang expanz 24 jam). Tambah: `/root/scripts_tg_add_subscriber.sh <chat_id>`.

### Proteksi trafik tinggi / bot (2026-08-22)

Melindungi server agar tidak lambat saat banjir trafik (bot/scraper/refresh massal), tanpa salah
memengaruhi admin:

| Lapis | Public (toko) | Admin (kantor) |
|---|---|---|
| **nginx limit_req** | 20r/s, burst 40, nodelay (zone `ragil_global`) | **EXEMPT** — `location /admin/` tanpa limit (banyak admin 1 IP/NAT) |
| **nginx limit_conn** | 30 conn/IP (zone `ragil_conn`) | tidak diterapkan |
| **fail2ban** | 4 jail aktif: sshd, nginx-http-auth, nginx-bad-request, nginx-botsearch | sama |
| **Laravel throttle** | route sensitif (cart 30, checkout 20, place-order 10) | 120/menit global + login throttle |

Note: admin dilindungi auth + EnsureUserIsAdmin + CSRF + Laravel throttle — cukup tanpa nginx limit.
Rate-limit nginx hanya di public (path rentan bot). Config: nginx.conf (zone) + sites-enabled/ragil
(location /admin/ exempt; location / limit_req+limit_conn). Backup di /root/backups/ragil-nginx.bak-*.

### Alert channel

- Bot Telegram `@ragilaluminium_bot` (publik — siapa pun Start = subscriber).
- Semua failure → file `ALERT-*` → aggregator `*/5` → pesan ke semua subscriber (dedupe).
- Skill `ragil-alert-responder` memetakan emoji alert → prosedur perbaikan.

---

## 3. Prosedur Perbaikan (Runbook Agent)

### A. Menanggapi alert Telegram

Lihat skill `ragil-alert-responder` untuk langkah detail per emoji:

| Emoji alert | Prosedur |
|---|---|
| `⚠️` ALERT-* | A-Backup: baca log dump/upload/restore/audit, perbaiki |
| `🔴` Service | A-Service: restart + cek log systemd |
| `💾` Disk/inode >85% | A-Disk: cek `df`/`du`, bersihkan log basi |
| `📦` Queue >500 | A-Queue: restart worker/`queue:restart`, retry failed |
| `🌐` HTTP !=200 | A-HTTP: cek nginx/fpm/laravel log |
| `⏰` Stale marker | A-Stale: jalankan script terkait |
| `📉` ROWCOUNT | A-Rowcount: DB live health drift — cek data hilang |

Langkah umum:
1. `ssh -i ~/.ssh/id_ed25519_209 root@<PROD_VPS>`.
2. Baca log terkait (`tail -30 /root/backups/<log>.log`, `journalctl -u <svc> -n 30`).
3. Kuasai akar masalah sebelum restart (jangan asal restart).
4. Perbaiki → jalankan verifikasi (`curl`, `systemctl is-active`, `exit code`).
5. Hapus `ALERT-*` hanya setelah fix (aggregator redetect in 5 menit).
6. Lapor format REPORT (Konteks → Akar → Perubahan → Verifikasi).

### B. Deploy (update kode ke produksi)

```bash
cd /root/ragilaluminium
# 1. Pre-check: pastikan working tree bersih & status check
git status && git fetch origin

# 2. Dry-run deploy (verifikasi target tanpa mengubah)
scripts/prod/deploy.sh --dry-run

# 3. Deploy live (backup .env + pre-deploy DB dump + checkout + migrate forward-only + cache + queue:restart)
scripts/prod/deploy.sh --tag=vX.Y.Z   # atau --branch=main / --ref=<sha>
```

- **Wajib**: backup DB (`scripts_prod` pre-deploy otomatis `scripts_backup_mysql.sh`).
- **Wajib**: `public/hot` dibapus (guard di script).
- **TIDAK PERNAH**: `migrate:fresh` / `db:wipe` / TRUNCATE.
- **Rollback deploy**: restore commit sebelumnya (`git checkout <prev-sha>` + redeploy) + `php artisan migrate:rollback` hanya jika migrasi terakhir reversible.

### C. Restore database (bencana / DB live rusak)

Urutan aman yang terbukti (drill 2026-08-21):

```bash
# 1. Identifikasi korupsi via live health: /root/scripts_db_live_health.sh
# 2. Restore dump LATEST ke DB stage dulu (dry-run rescue):
/root/scripts_restore_live_rescue.sh           # # default = dry-run, live tak disentuh
/root/scripts_restore_live_rescue.sh --apply   # swap live (backup live dulu ke live-before-rescue-*.sql.gz)

# 3. Atau PITR (pemulihan ke titik waktu) — bila butuh setelah titik backup:
/root/scripts_drill_pitr.sh       # senin-gw; manual saat darurat → restore dump + replay binlog R2
```

- Backup live pra-rescue selalu dibuat sebelum swap (`live-before-rescue-*.sql.gz`).
- Untuk insiden produksi: segera buka tunnel/redirect agar pelanggan tidak lihat error page polos.

### D. Restore dari R2 (VPS mati total / pindah VPS)

```bash
# 1. Siapkan VPS baru (Nginx, PHP-FPM 8.3, MySQL 8, Redis)
# 2. Restore dump pilihan (harian / mingguan / bulanan): from ra-backup
#    - harian  : mysql/ragil_aluminium-YYYYMMDD-HHMMSS.sql.gz   (30 hari)
#    - mingguan: weekly/ragil_aluminium-YYYY-Www.sql.gz          (permanen)
#    - bulanan : monthly/ragil_aluminium-YYYY-MM.sql.gz          (permanen)
# 3. zcat | mysql ragil_aluminium; lalu php artisan migrate --force (forward-only yg belum ada)
# 4. config:cache route:cache view:cache; queue:restart; nginx reload
# 5. Verifikasi: smoke test / products, login admin, rowcount
```

Media: bucket R2 media aktif (`ra-media`) tidak di-backup terpisah — file asli di komputer admin; arahkan app ke bucket yang sama.

### E. Rollback

- **App**: checkout SHA lama + redeploy; bila migrasi berjalan, `php artisan migrate:rollback --step=1` (jika reversible).
- **DB**: restore dari backup R2 (lihat D).
- **DNS/TLS**: kembalikan record / matikan tunnel (saat cutover).

---

## 4. Perbaikan Rutin (Preventive)

### Mingguan / Bulanan (checklist manual — opsional, sudah banyak otomatis)

- [ ] Baca `tail -5 /root/backups/ragil-backup.log` → semua backup OK.
- [ ] Cek semua marker `last-*pass` (restore, pitr, archive, semantic, binlog) → tidak stale.
- [ ] Verifikasi `systemctl is-active` semua service (nginx, fpm, queue, mysql, redis, baileys, cloudflared).
- [ ] `composer audit` + `npm audit --omit=dev` → tidak ada advisory baru yang high.
- [ ] Cek metrik disk/CPU/RAM di `/root/backups/metrics/` → tidak ada tren naik mengkhawatirkan.

### Kuarter / Cabut pra-penutupan (menjelang kepegunungan)

- [ ] Secret scan git history: `scripts/ci/secret-scan.sh`.
- [ ] OWASP ulang (XSS, SQLi, IDOR, webhook) setelah perubahan besar.
- [ ] Update dependensi minor + retest.

---

## 5. Aturan Khusus (non-negotiables)

1. **`migrate:fresh`/`refresh`/`db:wipe`/TRUNCATE di DB aplikasi = DILARANG** tanpa perintah eksplisit user.
2. **`orders`/`order_items`/`payments`/`customers` = jangan pernah dihapus** (lifetime + sumber omzet). Cleanup HANYA sessions (14 hari) — `performance_visitor_events` dipertahankan.
3. **Stop service di preview bukan masalah; stop di produksi = emergensi.** Cek impact sebelum.
4. **Setiap commit**: tidak campur milik agent lain; `git status` dulu.
5. **`.env`/credential**: jangan pernah ke chat/log/repo; jika terekspos → rotasi segera (F0).
6. **Restart MySQL** → jalankan `scripts_backup_mysql_binlog.sh` manual (file binlog baru belum di-R2) — dokumentasi DEPLOYMENT.md.

---

## 6. Kontak & Eskalasi Insiden

| Level | Contoh | Respons |
|---|---|---|
| **Sev-1 (downtime penuh)** | DB live korup, situs down, order gagal | Respon < 15 menit. Restore DB / restart service. Telegram + panggil owner. |
| **Sev-2 (gangguan)** | Queue tersumbat, media lambat, disk >90% | Respon < 1 jam. Delegasi agent (skill `ragil-alert-responder`). |
| **Sev-3 (kosmetik)** | Laporan KPI detail beda tipis, log warning | Respon < 1 hari. Catat di backlog. |

Insiden wajib dicatat: apa, kapan, dampak, akar masalah, perbaikan, pencegahan (post-mortem singkat).

---

## 7. Dokumen Terkait

- `docs/DEPLOYMENT.md` — arsitektur backup/alerting/deploy terperinci.
- `docs/security/OWASP-REVIEW-2026-08-21.md` — hasil audit keamanan + tindak lanjut.
- `docs/security/BRANCH-PROTECTION-GUIDE.md` — setup proteksi branch.
- `docs/plans/db-recovery-resilience-plan-2026-08-21.md` — rencana ketahanan DB (G1–G5).
- `docs/plans/prod-readiness-fix-plan-2026-08-21.md` — rencana fix prod-readiness (F0–F8).
- Skill lokal `ragil-alert-responder` — prosedur perbaikan agent per alert type.