# ADR-010: Admin Navigation Performance — Hover-Prefetch over Mount/CacheFor/Single-Bundle

## Status

Accepted

## Date

2026-08-21

## Context

Panel admin Ragil (Laravel + Inertia React) mengalami persepsi "lambat saat
pindah halaman/menu". Verifikasi dengan Playwright (browser nyata, sesi stabil,
desktop 1440px) menunjukkan:

- Navigasi Inertia biasa: URL berpindah 157–226 ms, render penuh 409–479 ms.
- Prefetch hangat (hover dulu → klik): URL berpindah **36–44 ms**, render
  **187–195 ms** (di bawah ambang persepsi manusia ≈100 ms → terasa instan).
- Backend TTFB 115–139 ms (diukur curl); 0 console error; 0 link rusak.

Berdasarkan data ini, ada beberapa opsi "lebih cepat" yang tersedia, namun
tidak semuanya sesuai untuk panel admin yang datanya bersifat operasional
real-time (orders, notifikasi) dan sering berubah.

## Decision

Gunakan **prefetch on hover + click** pada navigasi sidebar admin
(`@inertiajs/react` `<Link prefetch={["hover", "click"]}>`) + **preload chunk**
5 halaman admin utama di `app.tsx`. **Tidak** mengadopsi opsi yang lebih agresif.

Opsi yang ditimbang dan tidak dipilih:

1. **Prefetch `mount` (fetch semua halaman saat app dibuka)**
   - Pro: klik tanpa hover pun ~40 ms.
   - Kontra: boros bandwidth & request server (langsung ~20 request saat startup
     padahal hanya 2–3 yang akan dibuka); risiko data basi; anti-pola enterprise
     (Linear/Stripe memakai fetch-on-demand, bukan fetch-all-awal).
2. **`cacheFor` (cache halaman di memori browser, balik tanpa hit server)**
   - Pro: kembali ke halaman yang sudah dibuka = ~0 ms dari server.
   - Kontra: **risiko data basi (stale)** pada data operasional real-time
     (orders/notifikasi berubah terus); hasil cached bisa tidak sinkron dengan
     perubahan yang dilakukan di halaman itu; manfaat kecil karena hover-prefetch
     sudah membuat balik-ke-halaman cepat dengan data terbaru.
3. **Single bundle (tanpa code-splitting)**
   - Pro: tidak ada "tunggu load chunk".
   - Kontra: bundle membengkak (Performa Toko saja sudah 400 KB karena Recharts;
     gabung semua → beberapa MB JS) → **halaman pertama justru lambat** karena
     download besar; kontraproduktif.

Alasan pilihan hover-prefetch (pola enterprise, diukur → memadai):

| Kriteria | Hover-prefetch (terpilih) | Mount | cacheFor | Single-bundle |
|---|---|---|---|---|
| Kecepatan klik | ~40 ms | ~40 ms | ~0 ms (balik) | lambat awal |
| Bandwidth | hemat | boros | hemat | besar |
| Data selalu fresh | ya | bisa basi | rawan basi | ya |
| Overhead startup | kecil | besar | kecil | besar |
| Praktik enterprise | ya (Linear/Stripe) | anti-pola | bertingkat | tidak |

## Consequences

- Klik menu setelah hover → terasa instan (~40 ms), tanpa boros request.
- Klik tanpa hover → ~170 ms URL / ~430 ms render (masih cepat, tidak ada cache
  basi).
- Data operasional (orders, notifikasi) selalu fresh; tidak ada risiko menampilkan
  data usang karena cache.
- Overhead startup tetap kecil; buka pertama tidak dibebani fetch semua halaman.

## Alternatives considered

- `prefetch="mount"` untuk semua halaman.
- `cacheFor` Inertia (10–60 s) — ditolak untuk data operasional karena stale.
- Single bundle tanpa code-splitting — ditolak karena memperlambat buka pertama.

## References / Evidence

- Pengukuran Playwright: `_audit_admin.mjs`-style (di repo VPS saat run; tidak
  disimpan sebagai artefak).
- Inertia v2 `<Link prefetch>` & `router.prefetch` (cache semantics).
- Pola fetch-on-demand di Linear/Stripe/Slack.