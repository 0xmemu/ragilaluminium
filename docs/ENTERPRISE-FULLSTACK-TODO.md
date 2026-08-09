# Enterprise Full-Stack Engineering Program

**Diperbarui:** 2026-08-08  
**Target:** advanced yang konsisten, lalu enterprise-grade yang dapat dibuktikan.

## Definition of Done

- [ ] Semua quality gate backend, frontend, E2E, security, dan dependency hijau di CI.
- [ ] Invariant domain dilindungi constraint database, transaksi, idempotency, dan state transition terpusat.
- [ ] Semua privileged action memiliki authentication, authorization, audit trail, dan rate limit yang sesuai.
- [~] Liveness, readiness, request correlation, structured request/checkout logs, metrics, alert, dan runbook tersedia sebagian; external sink/dashboard/alert belum ada.
- [ ] Performance, accessibility WCAG AA, backup/restore, rollback, dan capacity memiliki evidence terulang.

## Gate A — Baseline dan quality ratchet

- [x] TypeScript strict typecheck bersih.
- [x] ESLint bersih tanpa warning.
- [x] Vitest: 17 test lulus.
- [x] Production Vite build lulus.
- [x] Playwright: 41 lulus, 3 conditional performance skip, 0 gagal pada empat viewport.
- [~] PHPUnit: 232/238 lulus; 6 kontrak promo Home berubah paralel dan belum direkonsiliasi.
- [x] npm audit runtime dan development: 0 vulnerability.
- [~] Composer audit: 14 advisory ditutup; 3 advisory Laravel memerlukan upgrade major yang menunggu persetujuan.
- [~] Pint: file remediasi baru bersih; 99 file legacy masih menjadi debt terukur.
- [~] Workflow CI menjalankan seluruh gate dan semua Action dipin immutable; bukti run pada GitHub masih diperlukan.

## Gate B — Advanced domain dan data

- [x] Checkout idempotency key dengan unique constraint.
- [x] Payment transaction reference dinormalisasi dan dilindungi unique constraint lintas order.
- [x] Full-settlement payment dan refund reconciliation.
- [x] Cancellation mengembalikan stok tepat sekali.
- [x] Import job unique, overlap-locked, dan visibility timeout aman.
- [x] State transition order/payment/shipping dipusatkan, diaudit, row-locked, dan transition ilegal ditolak.
- [~] Checkout dan status carrier idempoten; inventaris replay key seluruh webhook/external command belum lengkap.
- [~] Semua route controller admin dikunci `auth` + `admin` dan regression-tested; granular policy menunggu matriks role bisnis.
- [ ] Foreign key, unique index, check constraint, dan query index diaudit pada MySQL nyata.
- [ ] Concurrency test MySQL mencakup checkout, payment, cancellation, dan webhook paralel.
- [ ] Data retention, PII classification, export, deletion, dan audit retention dikontrak.

## Gate C — Frontend engineering

- [x] React/TypeScript strict, shared components, Inertia contracts, dan responsive E2E tersedia.
- [x] WCAG AA blocker pada Home, footer, order lookup, dan checkout diperbaiki.
- [ ] Component tests mencakup form state, error boundary, loading, retry, dan optimistic action.
- [ ] API/Inertia prop schemas divalidasi pada boundary runtime untuk payload kritis.
- [~] Keyboard, form, WCAG axe, dan responsive matrix lulus; dialog, focus-order penuh, dan reduced-motion masih perlu bukti.
- [x] Bundle budget menjadi gate: entry 130 KB, chunk 90 KB, total JS 500 KB, CSS 25 KB, image 500 KB.
- [ ] Error, empty, offline/timeout, duplicate-submit, dan recovery UX dikontrak per flow utama.

## Gate D — Security dan supply chain

- [x] J&T webhook fail-closed dan log bebas credential/payload sensitif.
- [x] Meta/WAHA webhook fail-closed, signature/secret wajib, dan query-string secret ditolak.
- [x] Security headers baseline dan production J&T configuration gate tersedia.
- [x] Dependency advisory npm dibersihkan.
- [ ] Laravel di-upgrade ke versi patched setelah persetujuan explicit dan regression hijau.
- [~] Trusted proxy allowlist, secure cookie, dan HTTPS policy diuji; CSP nonce/report-only rollout belum dilakukan.
- [x] Rate limit diterapkan pada login, lookup, consultation, webhook, dan endpoint mahal.
- [x] CSV/XLSX export memakai formula-cell sanitizer dan batas 50000 baris dengan regression test serta runbook.
- [~] Secret scanning full history, dependency review PR, dan SBOM npm/Composer menjadi CI gate; artifact provenance belum dilakukan.
- [~] Threat model checkout, admin, import/media, webhook, WhatsApp, operasi, dan supply chain sudah didraft; sign-off bisnis belum tersedia.

## Gate E — Observability dan operations

- [x] Setiap request memiliki correlation ID yang diteruskan ke response, log context, dan queued job.
- [x] Endpoint liveness dan readiness memeriksa dependency tanpa membocorkan secret.
- [x] Structured request completion dan checkout outcome events memiliki schema version, correlation ID, safe-field allowlist, tests, dan runbook.
- [~] Queue backlog/failure, retry exhaustion, dan import failure memiliki alert; webhook/payment anomaly belum lengkap.
- [ ] Dashboard SLI mencakup availability, latency, error rate, queue lag, dan checkout success.
- [~] Queue incident/replay runbook tersedia; deploy, rollback, migration, provider outage, dan incident umum belum lengkap.
- [ ] Backup restore drill dan disaster recovery memiliki bukti waktu pemulihan.
- [ ] Load/capacity test menetapkan baseline, saturation point, dan scaling trigger.

## Blocker aktif

1. Persetujuan eksplisit upgrade Laravel 11 ke Laravel 12 patched.
2. Rekonsiliasi enam regression kontrak promo Home dari perubahan paralel.
3. Bukti MySQL concurrency dan Redis multi-worker.
4. Rotasi private key SSH yang pernah ditempel di chat.
5. Cleanup Pint legacy secara bertahap tanpa mencampur perubahan semantik.
6. Matriks role/permission bisnis untuk policy admin granular.
7. Bukti alert destination, backup/restore drill, dan load/capacity test nyata.
