# ADR-008 — Migrasi Database ke Cloudflare D1 (Proposal)

Status: **Rejected** — keputusan 2026-08-11: pertahankan MySQL + PITR (RPO ≤1 jam sudah live)
Tanggal: 2026-08-11

## 1. Konteks & masalah
MySQL lokal di VPS 209.23.10.62 (3.3 MB, 40 tabel, data terkecil <1k baris).
Kekhawatiran user: risiko kehilangan data pada DB lokal VPS.

## 2. Keputusan yang diajukan
Migrasi sistem of record ke Cloudflare **D1** (SQLite serverless, managed,
backup otomatis Cloudflare).

## 3. Alternatif yang dipertimbangkan
- **PITR + arsip binlog ke R2 (DIPILIH SEKARANG, sudah live)**: RPO ~1 jam,
  nol perubahan arsitektur, gratis. Menjawab risiko kehilangan data langsung.
- MySQL managed eksternal (Aiven/DO): biaya + akun eksternal.
- Replikasi VPS kedua: biaya VPS tambahan.

## 4. Analisis teknis D1
- Data saat ini kecil (3.3 MB) — layak.
- **Hambatan utama**: Laravel memakai PDO/MySQL; D1 = SQLite via HTTP API.
  Tidak ada driver Laravel resmi → butuh adapter HTTP (community/buat sendiri),
  rework: migrations (20+ kolom enum, 8 kolom JSON → SQLite CHECK/JSON),
  queue driver (redis tetap), session (DB driver perlu tabel D1), FK.
- Koneksi app VPS → D1 via HTTP API publik (butuh auth token D1).
- Testing: sqlite lokal dekat dengan D1 → risiko lebih rendah dari MySQL.
- Butuh penulisan ulang `config/database.php` + `DB::` layer adapter; risiko
  regresi tinggi untuk perubahan sebesar ini pada tahap dev/live-preview.

## 5. Konsekuensi
- Pro: DB dikelola Cloudflare (durability, replica, backup otomatis).
- Kontra: effort besar (adapter + schema rework), test ulang menyeluruh,
  kontrak docs (database-schema) berubah dialek, checklist produksi harus
  ditutup dulu (blocker [!] masih open), D1 limits (SQLite concurrency,
  ‎10 GB max, per-query limits) sesuai skala saat ini.

## 6. Implementasi (jika disetujui)
1. ADR ini di-set Accepted oleh user.
2. Riset adapter Laravel-D1 (eksisting vs tulis sendiri).
3. Ekspor schema MySQL → SQLite compat; jalankan vs tests (sqlite sudah basis
   phpunit.xml — sinyal positif).
4. Migration bertahap: dual-write/read-only window, verifikasi, cutover.

## 7. Verifikasi & rollback
- PHPUnit hijau (sudah sqlite) + E2E storefront/checkout.
- Rollback: kembalikan MySQL (binlog PITR masih aktif sebagai jaring).

## 8. Keputusan yang dibutuhkan user
- Setujui migrasi D1 (mulai riset adapter) ATAU pertahankan MySQL + PITR
  (rekomendasi untuk tahap ini).
