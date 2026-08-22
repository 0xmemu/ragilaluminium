# Decision Log — Arsitektur & Performa (2026-08-21)

Arsip keputusan yang disepakati selama sesi ini. Setiap keputusan dicatat dengan alasan berbasis
bukti (bukan asumsi). Kode = kebenaran; bila konteks berubah, dokumen ini diperbarui.

---

## 1. Arsitektur produksi — TETAP Inertia (Laravel 11 monolitik)

**Keputusan:** Sistem produksi memakai arsitektur **Inertia (Laravel 11 render + React)**, BUKAN
pindah ke pola **Laravel API + frontend SPA terpisah** (seperti yang dipakai vendor Orbitrix di VPS prod).

**Rasio:**
- **Kontek owner**: Website Orbitrix (Laravel 12 API + SPA React + DB `ragil_mebel`) dinilai "kurang
  bagus fiturnya, kurang kaya, tidak sesuai konsep desain" oleh owner → diminta dibuat dari 0.
  Arsitekturnya dianggap "cukup bagus", tapi **masalahnya adalah fitur & desain**, BUKAN arsitektur.
- **Investasi**: Fitur sistem kita (sitemap, backup 49 tabel, alerting, performa toko, voucher, review,
  OWASP-reviewed) semuanya melekat di Inertia. Pindah API = tulis ulang seluruh frontend (62 admin +
  18 publik) = minggu/bulan, investasi hilang.
- **Trade-off** kecepatan navigasi SPA murni (0ms) vs Inertia (150–270ms setelah optimasi) sudah
  dipertimbangkan; gap ditutup via cache (lihat #2), bukan pindah arsitektur.

**Dampak SPECT:**
- SPECT_CHANGED: tidak (arsitektur stabil).
- Konsekuensi negatif yang disadari: navigasi Inertia selalu ada 1 request server per pindah menu.

---

## 2. Target performa pindah menu — DITUTUP via cache Redis Lapis A, bukan arsitektur

**Keputusan:** Untuk "rasa instan" pindah menu, gunakan **cache halaman penuh / props di Redis**
(Lapis A) pada halaman publik read-only. Target: navigasi 150–270ms → ~50ms. **Bukan** pindah ke SPA
atau Nginx microcache untuk semua.

**Rasio:**
- Nginx microcache utk semua navigasi Inertia memicu bootstrap per-user (bocor data), invalidasi sulit,
  dan keuntungan (~15ms vs ~50ms) tidak sebanding risiko.
- Cache Redis Lapis A aman (guest only), cepat diimplementasi (2–4 jam), invalidasi via `forgetCache`.

**Detail rencana:** `docs/plans/page-cache-redis-plan-2026-08-21.md` (belum dieksekusi).

---

## 3. Nginx microcache — DIPAKAI TERBATAS (opsional, hanya halaman statis publik)

**Keputusan:** Nginx microcache (Lapis C) **TIDAK** dipakai untuk navigasi Inertia umum. Boleh dipakai
khusus nanti untuk **halaman statis publik** (landing / CMS / service yang sama untuk semua user, tanpa
login), bila ada. Efek performa utk Inertia marginal (~15ms) dengan risiko bocor data & kompleksitas.

---

## 4. Subdomain `api.ragilaluminium.com` — TIDAK DI-AKTIFKAN untuk Inertia

**Keputusan:** Subdomain API terpisah **tidak perlu & tidak diaktifkan** untuk sistem Inertia kita.
Semua route (web + `/api/*`) berjalan di **satu origin `ragilaluminium.com`**.

**Rasio (dari segi performa):**
- Inertia memakai route `web` (session + CSRF), BUKAN `/api/*` → tidak ada konsumen `api.`.
- Satu origin = 1 koneksi HTTP/2, tanpa CORS preflight, tanpa 2× DNS/TLS handshake = **paling cepat**.
- `api.` terpisah malah berpotensi lambat utk frontend (CORS + 2 origin).
- Routes `/api/*` (health, catalog, search, orders/status, wilayah, shipping) sudah ada di
  `routes/api.php` (46 baris, throttle 60/min) — **aset latent-siap**, di-deploy di origin yang sama.

**Kapan `api.` akan berguna di kemudian hari:** bila ada konsumen nyata terpisah (mobile app,
integrasi eksternal, dashboard pihak ke-3) yang butuh origin/scale tersendiri. Saat itu, aktifkan
subdomain — bukan untuk kecepatan Inertia.

---

## 5. VPS produksi — OS & platform (keputusan sesi sebelumnya)

**Keputusan:** VPS produksi di-rebuild ke **Ubuntu** (bukan Debian yang sedang dipertimbangkan).
`provision.sh` (Ubuntu + MySQL 8 + PHP 8.3 + Nginx + Redis + ufw + fail2ban) sudah ditulis & diuji
install di container Ubuntu 24.04. `PRODUCTION.md` runbook + `.env.example` lengkap siap.

**Rasio:** Ubuntu sesuai `provision.sh` & preview (MySQL 8, kompatibilitas penuh). Menghindari
komplikasi Debian/MariaDB.

---

## 6. VPS prod saat ini (202.74.74.87) — dipakai Orbitrix, bukan dituju

**Keputusan:** VPS prod 202.74.74.87 saat ini berisi sistem **Orbitrix** (Laravel 12 API + SPA React +
DB `ragil_mebel`, docker-compose) yang **bukan codebase kita**. Ini bukan target deploy sistem kita;
hanya tempat penyimpanan data lama (ragil_mebel) yang **mungkin** perlu dimigrasi (belum dieksekusi).

---

## 7. Backup, alerting, dan rantai ketahanan DB — SUDAH SELESAI (rekapitulasi)

Berikut sudah diputuskan & dieksekusi tanpa revisi di sesi ini:
- Backup DB live multi-layer + PITR + rescue + archive (G1-G5) ✅ selesai.
- Alerting via Telegram bot (F1) ✅ selesai.
- Live DB health check + rowcount drift ✅ selesai.
- Cleanup: sessions 14 hari; `performance_visitor_events` TIDAK dihapus (KPI lifetime) ✅.
- Metrik CSV tiap 5 menit (F5) ✅.
- Kuota: ufw, fail2ban, CSP report-only, throttle, Laravel 11.56 (F6) ✅.
- Smoke test harian 24/24 (F7) ✅.
- Release workflow + deploy script (F3) ✅.

---

## Daftar dokumen acuan

- `docs/plans/prod-readiness-fix-plan-2026-08-21.md` — rencana fix prod (F0–F8).
- `docs/plans/db-recovery-resilience-plan-2026-08-21.md` — ketahanan DB.
- `docs/plans/page-cache-redis-plan-2026-08-21.md` — cache Redis (belum eksekusi).
- `PRODUCTION.md` — runbook zero-AI go-live.
- `scripts/prod/provision.sh`, `scripts/prod/deploy.sh` — provision + deploy.
- `docs/runbooks/MAINTENANCE-SCHEMA.md` — operasi pasca-live.
- `docs/security/OWASP-REVIEW-2026-08-21.md` — audit keamanan.

---
**Status: ARAK-ARSIP KEPUTUSAN — semua keputusan di atas disetujui untuk sesi saat ini.
Jika konteks berubah (mis. owner benar-benar minta mobile app), perbarui dokumen ini.**