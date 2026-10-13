# Ragil Aluminium — PRODUCTION RUNBOOK (zero-AI)

**Versi:** 1.0 — 2026-08-21
**Tujuan:** Membawa app ke produksi **tanpa sentuh AI**. Semua kebutuhan tercatat; Anda (manusia)
cukup ikut langkah & isi data. Setiap langkah punya verifikasi.

> Filosofi: **kode di repo = kebenaran**. Bila ada beda antara doc ini & kode, kode menang —
> perbarui doc. Script yang dirujuk ada di `/root/ragilaluminium/scripts/` (prod) dan `/root/` (ops).

---

## 0. Prasyarat (siapkan sebelum mulai)

| Item | Detail | Diisi |
|---|---|---|
| Domain final | `ragilaluminium.com` (+ akses zona Cloudflare) | ☐ |
| VPS produksi baru | Ubuntu 24.04, ≥2 vCPU / 4GB RAM / 50GB disk (terpisah dari preview 209.23.10.62) | ☐ |
| Akses SSH (key) | `ssh -i ~/.ssh/id_ed25519_209 root@<VPS_PROD>`, password-auth OFF | ☐ |
| Kredensial W/A | J&T, WhatsApp (Baileys), Cloudflare R2 — **kredensial produksi baru (bukan preview)** | ☐ |
| Le plan diri | Deployment owner, on-call, RPO (≤1 jam), RTO, maintenance window | ☐ |

---

## 1. Provision VPS (otomatis, tanpa AI)

```bash
# Dari repo di VPS baru (clone dulu), atau salin scripts/prod/provision.sh
bash /root/ragilaluminium/scripts/prod/provision.sh
```

Script menginstal & konfigurasi otomatis: Nginx, PHP 8.3-FPM, MySQL 8 (timezone UTC), Redis
(localhost+maxmemory), Composer, Node 22, ufw (deny+22/443), fail2ban. **Idempotent.**

**Verifikasi:** output berakhir "Service siap"; `nginx -t` OK; `systemctl is-active nginx php8.3-fpm mysql redis-server` semua `active`.

> ⚠️ Sebelum ufw enable, PASTIKAN SSH pakai key (bukan password). Jika ragu, selesaikan SSH dulu.

---

## 2. Deploy aplikasi (git clone + isi .env)

```bash
cd /root
git clone git@github.com:0xmemu/ragilaluminium.git   # atau transfer repo
cd ragilaluminium

# Ubah .env: SEMUA kredensial produksi baru (B1 blocker — jangan reuse preview!)
cp .env.example .env
$EDITOR .env   # isi APP_KEY? APP_URL, DB_*, R2, JNT, WA, SOCIAL, BANK, WhatsApp

# App key (random) + optimasi
php artisan key:generate
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

### Isi wajib `.env` produksi (lihat `.env.example` untuk komentar penuh)

| Kelompok | Variabel | Wajib |
|---|---|---|
| App | `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://ragilaluminium.com`, `APP_KEY` | ✅ |
| Security | `SESSION_SECURE_COOKIE=true`, `FORCE_HTTPS=true`, `LOG_LEVEL=info` | ✅ |
| DB | `DB_*` (MySQL prod, password kuat, user terpisah) | ✅ |
| Media | `MEDIA_DISK=s3`, `AWS_*` + `CLOUDFLARE_R2_*` → bucket `ra-media` | ✅ |
| WhatsApp | `WHATSAPP_PROVIDER=baileys`, `WHATSAPP_BAILEYS_*`, `WHATSAPP_API_TOKEN` dirotasi | ✅ |
| J&T | `JNT_ENABLED=true`, `JNT_*` kredensial **produksi** | ✅ |
| Bank | `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER` | ✅ |
| Social | `SOCIAL_*` (FB/IG/TikTok/YT/Shopee/Lazada/Tokped) | optional |

---

## 3. Setup Nginx (HTTPS) + Cloudflare

Satu dari dua (lihat `docs/DEPLOYMENT.md` §8):

- **A. Cloudflare Tunnel (disarankan)** — tidak buka port publik:
  ```bash
  docker run -d --name ragil-cloudflared --restart unless-stopped \
    -v /etc/cloudflared/ragil-prod-token:/etc/cloudflared/token:ro \
    cloudflare/cloudflared:latest tunnel --no-autoupdate run --token-file /etc/cloudflared/token
  # Di dashboard: public hostname ragilaluminium.com -> service http://localhost:8200
  ```
- **B. DNS proxy langsung** (A record proxied + Nginx TLS) — harus `TRUSTED_PROXIES` berisi IP CF + cert.

**Nginx vhost → `/root/ragilaluminium/public` di port 8200** (atau 80/443 sesuai). Pastikan `public/hot`.
**Verifikasi:** `curl -s -o /dev/null -w '%{http_code}' https://ragilaluminium.com/` → 200.

---

## 4. Deploy kode + migrasi (forward-only)

```bash
cd /root/ragilaluminium
scripts/prod/deploy.sh --dry-run          # verifikasi target tanpa ubah
scripts/prod/deploy.sh --tag=v1.0.0       # atau --branch=main — deploy live
```

Deploy otomatis: backup .env + pre-deploy DB dump → checkout → `composer --no-dev` → `npm build`
→ `migrate --force` (forward-only) → config/route/view cache → `queue:restart` → reload fpm.

**Verifikasi:** log `/root/backups/deploy.log` "DEPLOY COMPLETE"; `curl /` 200.

---

## 5. Setup layanan eksternal & backup ops

### WhatsApp (Baileys)
- `WHATSAPP_PROVIDER=baileys`, `WHATSAPP_BAILEYS_BASE_URL`, `WHATSAPP_BAILEYS_API_KEY`.
- Jalankan bot engine (lihat `docs/whatsapp-production-setup.md`), isi `AUTH_DIR=auth_info_baileys`.
- **Verifikasi:** order test → notifikasi WA terkirim.

### J&T shipping
- `JNT_ENABLED=true`, isi `JNT_*` produksi.
- `php artisan jnt:status` → OK; `jnt:joint-debug --force` sandbox dulu.
- **Verifikasi:** satu shipment sandbox success, track ter-update.

### Backup + monitoring (salur dari preview — script di `/root/`)
Salin seluruh script backup/health/alert dari preview VPS ke produksi:
```bash
# Di VPS prod (setelah diagnosa env):
cp /root/backups/scripts/{scripts_*.sh, scripts_*.py} /root/ 2>/dev/null || true
# Atau jalankan ulang setup dari docs/DEPLOYMENT.md §8a + MAINTENANCE-SCHEMA.md
```
- Setup cron (lihat MAINTENANCE-SCHEMA §2) + Telegram bot alert (F1).
- Ganti IP target di semua script: `209.23.10.62` → VPS prod.

---

## 6. Secure + CI (final gate)

- **Rotasi credential** (F0 B1): ufw deny-all + 22/443 (provision sudah), pastikan tidak ada
  port lain publik (`ss -tlnp`), SSH key-only.
- **Branch protection** (F3): set `main` wajib PR + checks di GitHub (lihat `docs/security/BRANCH-PROTECTION-GUIDE.md`).
- **Secret scan** (F0): `scripts/ci/secret-scan.sh` dari repo; jika ada ya → rotasi.
- **/J&T/WA** opsional tambahan; bukan blocker jika belum aktif di preview saat ini.

---

## 7. Cutover hari-H (urutan)

1. Freeze deploy; backup DB penuh terakhir (`/root/scripts_backup_mysql.sh`).
2. Set DNS final → `ragilaluminium.com` (via tunnel/proxy).
3. Jalankan smoke: `/root/scripts_smoke_test.sh` (atau manual curl semua route).
4. Verifikasi: HTTPS, home, catalog, PDP, cart, checkout, order status, admin login, media, WA.
5. `php artisan down` saat transfer? — gunakan maintenance mode bila perlu.
6. Live traffic; monitoring 24–48 jam (MAINTENANCE-SCHEMA §1).
7. Catat post-launch: error rate, latency, queue, DB load.

**Rollback:** lihat `MAINTENANCE-SCHEMA.md §3E` — restore backup / checkout SHA lama.

---

## 8. Checklist final sebelum nyala (cek semua)

- [ ] Provision selesai, service active, ufw deny+22/443
- [ ] `.env` terisi penuh (APP_DEBUG=false, APP_KEY gen, DB/WA/JNT/R2/BANK/SOCIAL)
- [ ] `php artisan migrate --force` sukses (forward-only, tanpa fresh/wipe)
- [ ] `config:cache route:cache view:cache` OK, `public/hot` dihapus
- [ ] HTTPS domain final 200, smoke test PASS
- [ ] WhatsApp order test terkirim
- [ ] J&T sandbox shipment success
- [ ] Backup harian pertama OK + restore test pertama PASS
- [ ] Alert Telegram terkirim (lakukan stop-service test → notify → start)
- [ ] Branch protection ON di GitHub
- [ ] Credential produksi berbeda dari preview; secret scan bersih

---

## Dokumen pendukung

- `docs/DEPLOYMENT.md` — arsitektur backup/alerting/deploy/ingress detail.
- `docs/MAINTENANCE-SCHEMA.md` / `docs/runbooks/MAINTENANCE-SCHEMA.md` — ops pasca-live.
- `docs/security/OWASP-REVIEW-2026-08-21.md` — hasil audit + tindak lanjut.
- `.env.example` — template env penuh dengan komentar.
- `scripts/prod/provision.sh` — instalasi VPS otomatis.
- `scripts/prod/deploy.sh` — deploy aplikasi (dry-run default).
- Repo ops `/root/scripts_*.sh|py` — backup/health/alert (lihat MAINTENANCE-SCHEMA).