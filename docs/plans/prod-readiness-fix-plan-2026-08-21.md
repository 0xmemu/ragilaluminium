# Rencana Perbaikan Production Readiness — Ragil Aluminium

**Tanggal:** 2026-08-21
**Basis:** `docs/FULL-STACK-PRODUCTION-CHECKLIST.md` (169 item: 31 ✅ / 119 ⬜ / 15 ~ / 4 blocker) + review Design Thinking (X → Graph → Effect<A,E,R>)
**Status dokumen checklist:** `NOT PRODUCTION-READY` — benar, dan rencana ini adalah jalan untuk menutup gap.

## Prinsip eksekusi (aturan dari AGENTS.md & user)

- Setiap pekerjaan selesai → commit terpisah oleh agent yang mengerjakan; jangan campur commit agent lain.
- Perubahan schema/route/enum/JSON → update docs kanonik (`database-schema-ragil-aluminium.md`, `api-and-routes-ragil-aluminium.md`, sitemap) di commit yang sama.
- Reversibel: arsip, bukan hapus permanen; backup sebelum migrasi.
- Report format: Konteks → Perubahan → Verifikasi (setiap item butuh bukti nyata, bukan klaim).
- Jangan `migrate:fresh`/`db:wipe`/TRUNCATE terhadap DB aplikasi.

---

## FASE 0 — BLOCKER (WAJIB sebelum produksi, `[!]`)

### B1. Rotasi semua credential yang pernah terekspos
**Checklist:** baris 35 (`[!]`)
**Ruang lingkup:** token tunnel, API key R2, kredensial J&T, kredensial WhatsApp (Meta + Baileys), password DB, API key apa pun yang pernah muncul di chat/log/screenshot/repo.
**Langkah:**
1. Audit eksposur: `grep -rniE '(token|secret|password|key)' docs/ | grep -vE '\.md.*(contoh|placeholder)'` → daftar file yang menyebut kredensial.
2. Untuk tiap provider: buat credential BARU (bukan reuse) di dashboard masing-masing:
   - Cloudflare Tunnel: token baru per tunnel.
   - R2: buat access key baru bucket-scoped, hapus yang lama setelah `.env` diganti.
   - J&T: minta key baru dari console Open Platform.
   - Baileys: regenerasi pairing.
3. Ganti di `.env` (VPS) → `php artisan config:clear && php artisan config:cache`.
4. Hapus credential lama dari provider side (revoke).
5. Verifikasi: `.env` baru terbaca (`php artisan about | grep -i env`), app masih jalan, backup masih upload (`tail /root/backups/ragil-backup.log`).
6. Dokumentasikan tanggal rotasi di release ticket.
**Verifikasi:** tidak ada secret tersisa di git history: `git log --all --oneline | wc -l` + `git grep -l` untuk tiap pola; credential lama gagal dipakai (uji satu request dengan key lama → 401/403).

### B2. Bukti rollback + recovery sebelum migrasi produksi
**Checklist:** baris 32 (`[!]`), 287, 356, 367
**Langkah:**
1. Ambil backup penuh terbaru (`/root/backups/ragil/ragil_aluminium-latest.sql.gz`) + verifikasi restore test terakhir PASS (`tail /root/backups/restore-test.log`).
2. Tulis runbook rollback (lihat Fase 4, R1) dan latih sekali di VPS cadangan.
3. Verifikasi: `mysql` restore dari dump terakhir ke DB test berhasil, rowcount cocok, `CHECK TABLE` OK (sudah otomatis tiap Senin; catat bukti terakhir).
4. Simpan bukti (output log) di release ticket.
**Gate:** B1 dan B2 harus CLOSED sebelum fase cutover (Fase 8).

---

## FASE 1 — GAP KRITIS #1: NOTIFIKASI KEGAGALAN (alerting)

> Masalah inti: `ALERT-*` file di `/root/backups/` tidak terkirim ke mana pun. Kegagalan backup/app/queue/disk terjadi diam-diam.

### 1.1. Alert aggregator script (prioritas tertinggi)
**Tujuan:** satu script yang memeriksa semua sumber kegagalan dan mengirim satu pesan WA via Baileys bot (sudah ada, port 3005).
**Langkah:**
1. Buat `/root/scripts_alert_aggregator.sh`:
   - Periksa keberadaan & umur file `ALERT-*` di `/root/backups/` (r2-upload, stale-or-restore, semantic-audit, dll). Jika ada → kumpulkan nama file + `tail` isi log terkait.
   - Periksa status service: `systemctl is-active ragil-queue`, `php-fpm`, `nginx`, baileys (`curl -s http://127.0.0.1:3005/health` atau `systemctl is-active`).
   - Periksa disk: `df -h /` → alert jika usage > 85%.
   - Periksa queue depth: `redis-cli llen queues:default queues:imports queues:media` (atau query DB `jobs` table) → alert jika > threshold.
   - Kirim ringkasan via HTTP ke Baileys bot endpoint kirim WA (cek cara bot mengirim pesan — `WHATSAPP_ENGINE_URL` atau endpoint internal bot; fallback: `curl` ke bot API).
2. Cron: `*/5 * * * * /root/scripts_alert_aggregator.sh` (5 menit).
3. **PENTING (tahan dulu):** Baileys bot adalah jalur WA produksi — pastikan endpoint kirim pesan internal aman (auth key), dan jangan spam: dedupe alert (jangan kirim ulang alert yang sama; simpan state hash di `/root/backups/.alert-state`).
**Verifikasi:** `touch /root/backups/ALERT-test` → dalam ≤5 menit WA terkirim → hapus file test. `systemctl stop ragil-queue` → alert terkirim → start lagi.

### 1.2. Integrasi dengan backup scripts
**Langkah:**
1. `scripts_backup_mysql.sh`, `scripts_backup_mysql_binlog.sh`, `scripts_weekly_restore_test.sh`, `scripts_semantic_audit.sh` sudah menulis `ALERT-*` — **tidak perlu diubah**, aggregator yang membaca.
2. Pastikan semua jalur gagal menulis alert: grep tiap script untuk `touch "$ALERT"` — audit cakupan (dump GAGAL, upload GAGAL, restore GAGAL, audit GAGAL, STALE).
**Verifikasi:** daftar semua `ALERT-*` yang mungkin dibuat vs branch error di tiap script — tidak boleh ada error path yang lolos tanpa alert.

### 1.3. Health check publik + sintetik monitoring
**Checklist:** baris 344 (`[ ]`)
**Langkah:**
1. Pastikan `/up` route berfungsi (`curl http://127.0.0.1:8200/up` → 200).
2. Tambahkan monitoring sintetik: cron tiap 5 menit `curl -s -o /dev/null -w '%{http_code}' https://<domain>/` dan `/products`, `/cart` → jika != 200 → alert WA (masuk ke aggregator).
3. Cek `/up` tidak ter-trap oleh maintenance mode (`php artisan down` harus tetap mengecualikan `/up`).
**Verifikasi:** matikan sementara nginx (`systemctl stop nginx`), tunggu ≤5 menit, terima alert, hidupkan lagi. Catat RTO terukur.

### 1.4. Monitoring disk/inode/RAM/CPU
**Checklist:** baris 241 (`[ ]`)
**Langkah:**
1. Script `scripts_health_check.py` sudah ada (cron `*/5`). Audit isinya: apakah sudah cek disk, RAM, CPU, inode? (`df -i /` untuk inode).
2. Tambahkan threshold: disk > 85%, inode > 85%, RAM > 90%, loadavg > 4 (sesuaikan kapasitas VPS).
3. Gabungkan output ke aggregator → alert WA.
**Verifikasi:** `df -h` dan `df -i` dijalankan, threshold terlihat di log, simulasi dengan threshold rendah (mis. sementara set 5% → alert terkirim → kembalikan).

---

## FASE 2 — GAP KRITIS #2: INFRASTRUKTUR PRODUKSI (Redis, MySQL, Nginx)

### 2.1. Redis produksi
**Checklist:** baris 186 (`[ ]`), 188 (`[ ]`), 191 (`[ ]`), 194 (`[ ]`)
**Kondisi saat ini:** `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`, `SESSION_DRIVER=database` — Redis di VPS sama tanpa monitoring.
**Langkah:**
1. Dokumentasikan keputusan: Redis lokal VPS (bukan managed) untuk fase pertama — dengan catatan "single VPS, no load balancer" (baris 324).
2. Hardening Redis: bind `127.0.0.1` saja (cek `redis-cli config get bind`), `requirepass` atau proteksi minimal, nonaktifkan `CONFIG` command publik.
3. Persistensi: cek konfigurasi AOF/RDB — pilih RDB snapshot berkala (backup Redis opsional; data Redis = cache/queue, hilang = aman, bukan data bisnis).
4. Monitoring Redis: `redis-cli INFO` → memory used vs maxmemory, keyspace hits/misses → masuk aggregator.
5. Tes cache invalidation (baris 194): setelah import katalog / edit CMS / ubah promo, pastikan cache modelMenu dll ter-refresh (cek `Cache::remember` key mana yang perlu di-flush — `php artisan cache:clear` saat deploy).
**Verifikasi:** `redis-cli ping` → PONG; `redis-cli INFO memory` tercatat; simulasikan import produk → halaman beranda menampilkan data baru.

### 2.2. MySQL produksi hardening
**Checklist:** baris 106, 108, 110, 112, 114, 116, 118
**Langkah:**
1. Versi: MySQL 8.0.46 sudah OK (di atas 8.0 minimum yang disarankan).
2. UTF-8/UTC policy: verifikasi `character_set_server=utf8mb4`, `collation_server=utf8mb4_unicode_ci`, `time_zone` DB = UTC (cek `SHOW VARIABLES`). Aplikasi menulis `created_at` UTC (Laravel default).
3. Migrasi forward-only pada clone dulu (baris 108): prosedur = restore backup terbaru ke `ragil_migrate_test`, jalankan `php artisan migrate --force` di sana, verifikasi sukses, drop. Dokumentasikan sebagai runbook.
4. Validasi FK/index/enum (baris 110): `SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema='ragil_aluminium'` → pastikan FK utama ada (orders.customer_id, payments.order_id, order_items.order_id).
5. Confirm tidak ada command destruktif (baris 112): `grep -rniE 'migrate:fresh|db:wipe|truncate' app/ routes/ database/seeders/ scripts/` → audit hasil; tambahkan guard di deploy hook bila perlu.
6. Retention & deletion rules (baris 114): putuskan & tulis kebijakan — sesi (`sessions`) > 5 hari hapus; `performance_visitor_events` agregasi → arsip bulanan lalu hapus detail > X bulan; `event_logs` arsip. **Jangan hapus orders/order_items (data lifetime)**.
7. Kredensial injeksi deploy-time (baris 118): `.env` tidak di-commit (sudah), pastikan deploy tidak menulis password ke log (`grep` deploy script).
**Verifikasi:** output per langkah dicatat; `SHOW VARIABLES` disimpan.

### 2.3. Nginx/PHP-FPM produksi
**Checklist:** baris 226 (`[~]`), 228, 235, 237, 239
**Langkah:**
1. Audit konfigurasi saat ini: `cat /etc/nginx/sites-enabled/*`, `php-fpm pool config`, systemd units (`ragil-queue`, `ragil-scheduler`).
2. Port 8200 adalah preview — produksi harus HTTPS di domain resmi (tunnel Cloudflare atau TLS langsung). Tentukan target domain final dulu (dengan user).
3. Nginx limits: `client_max_body_size` (upload media), `client_body_timeout`, `fastcgi_read_timeout`, slowlog (`slowlog = /var/log/php-fpm-slow.log; request_slowlog_timeout = 10s`).
4. Service account non-root (baris 237): cek user PHP-FPM (`www-data`), pastikan kode dibaca read-only, `.env` `chown root:www-data chmod 640` (sudah ada catatan di DEPLOYMENT.md).
5. Ownership/permission audit (baris 239): `find storage bootstrap/cache -maxdepth 2 -ls`, pastikan milik www-data; `ls -la .env /root/backups` — backup jangan bisa diubah www-data.
**Verifikasi:** `nginx -t` OK; curl local 200; slowlog muncul saat request lambat (simulasi).

---

## FASE 3 — GAP KRITIS #3: CI/CD

### 3.1. CI sebagai required gate
**Checklist:** baris 51 (`[ ]`), 273 (`[ ]`), 274 (`[ ]`), 276 (`[ ]`), 278 (`[ ]`)
**Langkah:**
1. GitHub Actions sudah jalan (typecheck/lint/Vitest/PHPUnit) — verifikasi file `.github/workflows/*` dan status run terakhir.
2. Proteksi branch `main`: di GitHub → Settings → Branches → require status checks (semua job hijau) + require PR review + no direct push.
3. Tambah job: `composer audit` + `npm audit --omit=dev` (baris 274) — jadikan warning dulu, lalu required.
4. Tambah job: PHPStan/Pint static analysis tingkat dasar (`vendor/bin/pint --test`, PHPStan level sesuai).
5. E2E job terisolasi (baris 276): Playwright dengan browser install, 4 viewport, jalankan di CI (bukan hanya lokal).
6. Secret scanning: GitHub Secret Scanning (built-in) + `gitleaks` di CI (baris 298).
**Verifikasi:** push ke branch + buka PR → semua check jalan; PR dengan test gagal TIDAK bisa merge; `git log` main hanya via merge.

### 3.2. Release workflow & manifest
**Checklist:** baris 56 (`[ ]`), 58 (`[ ]`), 278 (`[ ]`), 424 (`[ ]`)
**Langkah:**
1. Buat workflow `release.yml`: trigger tag `v*` → build sekali → catat git SHA + timestamp + versi Node/PHP + manifest checksum → upload artifact.
2. Deploy script `/root/scripts_deploy.sh`: pull → `composer install --no-dev` → `npm ci && npm run build` → `php artisan migrate --force` (forward-only) → `config:cache route:cache view:cache` → `php artisan queue:restart` → `systemctl reload nginx`.
3. `public/hot` harus dihapus di produksi (baris 58): guard di deploy script `rm -f public/hot`.
4. Manifest disimpan ke `storage/app/releases/manifest-<sha>.json`.
**Verifikasi:** jalankan deploy script sekali → app jalan; manifest terisi; `public/hot` tidak ada.

---

## FASE 4 — GAP KRITIS #4: ROLLBACK & RUNBOOK

### 4.1. Runbook (baris 356)
**Tulis dokumen `docs/runbooks/*.md` (folder sudah ada):**
1. `deploy.md` — langkah deploy + rollback deploy (git checkout SHA sebelumnya + rebuild + `php artisan migrate:rollback` hanya jika migrasi terakhir bisa di-rollback).
2. `database-restore.md` — restore dari dump R2: download → `zcat | mysql` → migrate forward-only yang belum ada → verifikasi rowcount.
3. `r2-restore.md` — jika bucket media hilang: restore dari file asli admin (media tidak di-backup otomatis — keputusan user).
4. `rollback.md` — batas rollback: migrasi forward-only (baris 287) → cara mundur = restore DB dari backup terakhir + redeploy SHA lama.
5. `incident.md` — severity, channel komunikasi, notifikasi pelanggan (baris 370).
**Verifikasi:** dokumen ada, langkah bisa diikuti orang lain (uji satu runbook restore di clone).

### 4.2. Game-day recovery drill (baris 367)
**Langkah:**
1. Di VPS klon (bukan produksi): `systemctl stop nginx` → restore DB dari R2 → start → verifikasi halaman.
2. Catat waktu tiap langkah (RTO terukur).
3. Ulangi untuk skenario: DB korup, R2 media tak bisa diakses, queue mati.
**Verifikasi:** log drill dengan timestamp; hasil dibandingkan target RPO ≤ 1 jam.

### 4.3. Graceful degradation test (baris 359)
**HASIL UJI (2026-08-22):** Saat `CACHE_STORE=redis` dan Redis di-stop, app response **500**
(tanpa fallback — PhpRedisConnector lempar exception, semua `Cache::get/remember` gagal). Kesimpulan
arsitektur: **Redis = dependency critical** (setara MySQL), BUKAN graceful-degradable. Pendekatan yang
benar = **deteksi + monitoring + cepat pulih**, bukan fallback cache (biaya & risiko > manfaat).
Aggregator sudah memonitor `redis-server.service` (alert 🔴 saat down). Grafis graceful-degradation
berlaku untuk media/R2 (MediaDisk sudah punya fallback sementara di media R2 down), bukan untuk cache
store. Redis pulih di-stop → app kembali 200 (terverifikasi).

**Langkah:**
1. Matikan Baileys (`systemctl stop baileys`) → katalog tetap terbaca (storefront tidak boleh bergantung WA).
2. Matikan J&T (`JNT_ENABLED=false` sementara) → checkout tetap jalan (fallback ongkir manual? verifikasi kode ShippingService).
3. Redis mati → app harus tetap jalan (fallback cache array? verifikasi; kalau tidak → dokumentasikan sebagai keterbatasan fase 1).
**Verifikasi:** tiap skenario → curl halaman tetap 200, log error tidak crash.

### 4.4. Process supervision (baris 363, 365)
**Langkah:**
1. Audit systemd: `systemctl list-units --type=service | grep -E 'nginx|php|queue|redis|mysql'` — semua `enabled` + `running`?
2. Pastikan `Restart=always` untuk queue worker & scheduler.
3. Queue deployment pakai `php artisan queue:restart` (graceful drain) — dokumentasikan di deploy runbook.
4. Failed jobs: verifikasi handler `failed_jobs` tercatat + alert via aggregator (baris 365).
**Verifikasi:** `systemctl status` semua hijau; kill queue worker → auto-restart; job gagal → muncul di `failed_jobs` + alert.

---

## FASE 5 — GAP KRITIS #5: METRIK & OBSERVABILITAS

### 5.1. Metrik dasar (baris 339)
**Langkah:**
1. Tanpa infra baru: script `scripts_metrics.sh` tiap 5 menit → `redis-cli INFO stats`, `mysql -e 'SHOW GLOBAL STATUS'` (Questions, Threads_running, Slow_queries), `df`, `loadavg` → tulis ke `/root/backups/metrics/$(date +%F).csv`.
2. Tambahkan ke aggregator: threshold slow queries > 10/5menit, Threads_running > 20.
**Verifikasi:** file CSV bertambah tiap 5 menit; angka terbaca.

### 5.2. Correlation ID (baris 348)
**Langkah:**
1. `RequestContext` middleware sudah ada — verifikasi ia menambahkan `X-Request-Id` ke response & log context (`grep RequestContext`).
2. Queue jobs: pastikan `RequestContext` (atau job id) ikut di log worker.
**Verifikasi:** dua request → header `X-Request-Id` berbeda; log error memuat id yang sama dengan request.

### 5.3. Log hygiene (baris 346, 302)
**Langkah:**
1. `grep -rniE '(password|secret|token|key)' storage/logs/ | head` → pastikan tidak ada credential di log.
2. `APP_DEBUG=false` di produksi (`grep APP_DEBUG .env`) → halaman error tidak menampilkan stack/SQL.
3. `APP_LOG_LEVEL=info` (bukan debug).
**Verifikasi:** buka halaman error (404) → tidak ada stack trace; log tidak mengandung secret.

### 5.4. Error tracker (baris 335, 337)
**Keputusan (perlu user):** pilih Sentry (self-host di VPS? atau cloud) / Flare / file log saja fase 1.
- Fase 1 minimal: log structured + aggregator alert untuk 500.
- Opsional: Sentry cloud dengan PII scrubbing.
**Verifikasi:** simulasikan error → tercatat di log + alert.

---

## FASE 6 — KEAMANAN (non-blocker tapi penting)

### 6.1. SSH & firewall (baris 230, 233)
**Langkah:**
1. `sshd_config`: `PermitRootLogin prohibit-password` (sudah pakai key), `PasswordAuthentication no`.
2. `ufw`: allow 22 (SSH, source IP sendiri), 80/443 (atau tunnel saja), deny rest. **Hati-hati: jangan kunci diri sendiri — uji dari sesi kedua.**
3. fail2ban: install + konfigurasi sshd.
**Verifikasi:** `ssh -i key` jalan; `ssh password` ditolak; `ufw status` sesuai.

### 6.2. CSP (baris 294)
**Langkah:**
1. Baseline security headers sudah ada (`SecurityHeaders` middleware). Tambahkan CSP bertahap: mulai `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://media.333labs.tech; connect-src 'self'` — **uji dulu di staging** karena Inertia/Vite butuh `'unsafe-inline'` untuk style dan mungkin `'unsafe-eval'` dev.
2. Verifikasi tidak ada warning di console browser (gunakan report-only dulu: `Content-Security-Policy-Report-Only`).
**Verifikasi:** halaman utama + checkout jalan tanpa error CSP di console; report-only tidak ada pelanggaran.

### 6.3. OWASP review (baris 296)
**Langkah:** checklist singkat: XSS (React auto-escape — verifikasi tidak ada `dangerouslySetInnerHTML` di input user), CSRF (token sudah), SSRF (cek fetch URL dari input — `grep -rniE 'file_get_contents|curl|Http::' app/ | grep request`), SQL injection (Eloquent parameter binding), mass assignment (`$fillable` audit model).
**Verifikasi:** tiap item = grep + hasil audit.

### 6.4. Rate limit matrix (baris 312, 314, 317)
**Langkah:**
1. Inventory route: `php artisan route:list --columns=method,uri,name,middleware` → group by kelas.
2. Buat tabel matriks di docs: login (20/1m), checkout (10/1m), order lookup (15/1m), review (10/1m), upload, webhook — bandingkan dengan throttle yang ada.
3. Trusted proxies (baris 317): `TRUSTED_PROXIES` sudah diset (bootstrap) — verifikasi nilai (`grep TRUSTED_PROXIES .env`).
**Verifikasi:** matriks terisi; tiap kelas punya throttle; curl berulang → 429.

### 6.5. PII & privacy (baris 211, 213)
**Langkah:**
1. Audit URL: tidak ada PII di URL (order lookup pakai `order_number` + phone di body/query? cek route `order.status.lookup`).
2. Halaman privacy/legal: `/policy/privacy` & `/policy/terms` sudah ada (sitemap) — verifikasi isi CMS lengkap.
3. Data retention policy tertulis (baris 114).
**Verifikasi:** curl halaman privacy → konten lengkap; grep URL pattern.

### 6.6. Dependency vulnerability (baris 135)
**Langkah:** `composer audit` + `npm audit --omit=dev` → daftar CVE → update minor yang aman → retest.
**Verifikasi:** audit bersih atau risiko terdokumentasi.

---

## FASE 7 — PENGUJIAN TAMBAHAN

### 7.1. Load test (baris 328)
**Langkah:**
1. ApacheBench/`hey` sederhana: `hey -n 2000 -c 50 https://<domain>/products` → catat req/s, p99 latency.
2. Bandingkan dengan target (mis. < 500ms p99).
3. Skenario: browse, search, PDP, checkout validation, order placement, admin.
**Verifikasi:** output benchmark tercatat; identifikasi bottleneck (PHP-FPM pm.max_children).

### 7.2. A11y audit (baris 66)
**Langkah:** axe-core via Playwright (sudah ada tooling `scripts/qa-*.mjs`?) — jalankan di 4 viewport untuk halaman kunci (home, catalog, PDP, checkout, cart, order status, admin login).
**Verifikasi:** laporan temuan; perbaiki yang serius (focus, aria-label).

### 7.3. Smoke suite production-like (baris 88, 92)
**Langkah:** script `scripts/smoke-prod.sh`: curl semua route publik + login admin + 1 order flow di staging → status code + konten penting (title, harga).
**Verifikasi:** exit 0.

### 7.4. Failure-state tests (baris 74)
**Langkah:** simulasikan: slow network (Playwright `route.abort`/throttle), asset gagal, empty catalog, out-of-stock, promo expired, payment recording gagal, shipping provider down → halaman tidak crash, pesan error tampil.
**Verifikasi:** tiap simulasi → screenshot + status.

---

## FASE 8 — CUTOVER (urutan eksekusi hari-H)

**Checklist:** baris 38, 245, 247, 248, 250, 252, 254, 256, 263, 265, 267, 280, 282, 284, 300, 301, 379-395 (J&T), 399-401, 408-412, 416-431
**Langkah berurutan:**
1. **Pilih domain produksi final** (ragilaluminium.com vs ra.333labs.tech) — keputusan user + akses zona Cloudflare.
2. DNS + TLS: record A/proxy, tunnel final, HSTS (`Strict-Transport-Security`).
3. Rotasi semua kredensial (B1) dengan credential produksi terpisah dari preview (baris 300).
4. Provision VPS produksi terpisah ATAU klaim 209.23.10.62 sebagai produksi (keputusan — baris 223): rekomendasi: VPS terpisah dari preview, atau setidaknya preview dimatikan setelah cutover.
5. Deploy via `scripts_deploy.sh` (Fase 3.2) → verifikasi manifest SHA.
6. Migrasi forward-only dengan output tercapture (baris 425) → verifikasi rowcount vs staging.
7. `config:cache route:cache view:cache` (baris 426) → restart queue gracefully (baris 427).
8. Verifikasi `/up`, HTTPS, homepage, catalog, media, checkout validation, order placement (baris 429).
9. J&T: isi kredensial produksi, `jnt:joint-debug --force` sandbox dulu, satu smoke shipment disetujui (baris 388-393).
10. WhatsApp: putuskan Meta vs BAILEYS primary (baris 267, 379-383); test order notification end-to-end.
11. Freeze schema/config kecuali emergency (baris 416); backup final + verifikasi (baris 417).
12. Maintenance message + window rollback disepakati (baris 420).
13. External checks dari jaringan luar: DNS, TLS, headers, error pages (baris 256).
14. **Post-launch monitoring 24-48 jam** (baris 435-439): error rate, latency, queue depth, DB load; bandingkan data count; catat incident + follow-up.
15. Tutup checklist: semua `[!]` CLOSED + release gate berisi owner, test result, runbook (baris 446-447).

---

## PRIORITAS EKSEKUSI (urutan yang saya rekomendasikan)

| Urut | Fase | Alasan |
|---|---|---|
| 1 | F0 (B1+B2) | Blocker — tidak bisa produksi tanpa ini |
| 2 | F1 (alerting) | Tanpa ini, kegagalan apa pun tidak terdeteksi |
| 3 | F2 (Redis/MySQL/Nginx) | Fondasi infra |
| 4 | F6.1 (SSH/firewall) | Keamanan dasar murah & cepat |
| 5 | F3 (CI/CD) | Kualitas terjamin sebelum fitur baru |
| 6 | F4 (runbook/drill) | Kemampuan recovery |
| 7 | F5 (metrik) | Visibilitas berkelanjutan |
| 8 | F6 lainnya | Hardening lanjutan |
| 9 | F7 (test tambahan) | Bukti kualitas |
| 10 | F8 (cutover) | Eksekusi hari-H |

## Estimasi kasar

- F0: 0,5–1 hari
- F1: 0,5–1 hari (script + integrasi + test)
- F2: 1–2 hari
- F3: 1–2 hari (CI workflows + deploy script)
- F4: 1 hari (runbook + drill)
- F5: 0,5 hari
- F6: 1–2 hari
- F7: 1–2 hari
- F8: 1 hari (H-1 + H-day)

**Total: ±7–12 hari kerja agent** (paralelizable: F2/F3/F6 bisa paralel setelah F1).
