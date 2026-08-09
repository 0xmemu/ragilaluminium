# Threat Model Ragil Aluminium

**Status:** draft teknis; persetujuan pemilik bisnis dan matriks role masih diperlukan.  
**Diperbarui:** 2026-08-08  
**Cakupan:** storefront, checkout/order, admin, import/media, webhook J&T, WhatsApp Meta/BAILEYS, queue, storage, dan CI.

## Batas kepercayaan dan aset

1. Browser publik memasuki Laravel melalui route storefront/API; semua input dianggap tidak tepercaya.
2. Browser admin melewati session authentication, status akun aktif, role `admin`, CSRF, dan rate limit login.
3. Provider eksternal memasuki webhook tanpa session; signature/secret, replay behavior, dan rate limit menjadi boundary utama.
4. Laravel keluar menuju J&T, Meta/BAILEYS, media CDN, object storage, database, cache, dan queue.
5. CI memperoleh source/lockfile dan mengunduh tool; Action, binary, checksum, serta artifact adalah bagian supply chain.

Data paling sensitif adalah PII pelanggan/order, status pembayaran dan pengiriman, stok/harga, session admin, credential provider, media import, serta audit log. Secret tidak boleh masuk log, source, artifact publik, query string, atau response readiness.

## Register ancaman dan kontrol

| Permukaan | Ancaman utama | Kontrol yang sudah ada | Risiko residual / pekerjaan wajib |
|---|---|---|---|
| Checkout dan order | manipulasi harga, duplicate submit, oversell, replay, IDOR status order | total dihitung server, transaksi dan row lock, checkout idempotency unique, payment reference unique, state machine order/payment/shipping, lookup memerlukan nomor order + telepon/email, confirmation terikat session, rate limit | buktikan race pada MySQL nyata; inventaris replay key seluruh external command; tetapkan retensi/erasure PII |
| Admin dan session | credential stuffing, privilege bypass, CSRF, akun nonaktif, penguncian seluruh admin | login limiter, session regeneration, route `auth` + `admin`, active-account check, CSRF web group, audit login/mutasi, larangan self/last-admin deactivation | semua admin saat ini setara; matriks least-privilege dan MFA belum disahkan; session revocation terpusat belum ada |
| Import dan media | file bomb, MIME spoofing, SSRF, redirect ke jaringan privat, resource exhaustion, formula injection | ukuran dan extension import dibatasi, media MIME/magic bytes dan byte limit, host allowlist + blok IP privat, DNS kosong ditolak fail-closed, formula-cell sanitizer + batas export 50000 baris, outbound redirect dimatikan, queue retry/unique/timeout | PII export review dan retention policy masih perlu evidence eksplisit |
| J&T shipping | forged callback, replay/regression, secret leakage, provider outage | production config gate, signature fail-closed, safe logging, stale/regressive carrier event ditolak, state machine terpusat | replay identifier provider perlu constraint; alert anomaly dan outage drill belum tersedia |
| Meta/BAILEYS | forged webhook, query secret leak, duplicate message/action, provider outage | signature/secret wajib, query secret ditolak, production boot gate, rate limit, safe logging, state transition idempoten | event/message replay ledger menyeluruh dan delivery SLI belum tersedia |
| Supply chain dan operasi | dependency compromise, leaked credential, unpinned Action, queue loss, unobserved failure | immutable Action SHA, Gitleaks full-history + checksum-pinned binary, npm/Composer audit, dua CycloneDX SBOM, request ID, readiness, queue failure/backlog alert | Laravel advisory menunggu major upgrade; artifact attestation/provenance, signed release, backup restore drill, SLI dashboard, dan capacity test belum tersedia |

## Kontrak authorization saat ini

- Satu role kanonik tersedia: `admin`; semua admin aktif memiliki hak yang sama.
- Guest diarahkan ke login, akun aktif non-admin menerima 403, dan admin nonaktif diarahkan ke login.
- Semua controller namespace `App\Http\Controllers\Admin` wajib berada di prefix `/admin` dan memiliki middleware `auth` serta `admin`.
- Perubahan akun melarang menonaktifkan diri sendiri dan menjaga minimal satu admin aktif.
- Granular policy tidak boleh diciptakan tanpa keputusan bisnis tentang role, aksi, pemilik approval, dan separation of duties.

Kontrak route di atas dijaga oleh `AdminAuthorizationBoundaryTest`; perubahan route admin yang keluar dari boundary harus menggagalkan CI.

## Keputusan dan sign-off yang belum tersedia

1. Definisikan role minimal (misalnya owner, operations, catalog, finance, content, read-only) dan hak setiap mutasi/export.
2. Tentukan apakah pembayaran/refund, perubahan user, dan export PII membutuhkan re-authentication atau four-eyes approval.
3. Tetapkan RPO/RTO, retensi PII/audit, legal basis, proses export/delete, serta pemilik incident.
4. Setujui risk acceptance sementara untuk tiga advisory Laravel sampai upgrade major mendapat otorisasi.
5. Rotasi private key SSH yang pernah dibagikan dan dokumentasikan tanggal/pemilik rotasi.

## Evidence berulang

```bash
php artisan test --filter=AdminAuthorizationBoundaryTest
php artisan test --filter=OrderPrivacyTest
php artisan test --filter=OrderStateMachineTest
php artisan test --filter=WhatsAppWebhookSecurityTest
php artisan test --filter=JntProductionGateTest
scripts/ci/secret-scan.sh /tmp/ragil-gitleaks.sarif
```

Dokumen ini menjadi baseline review setiap perubahan trust boundary, provider, role, data sensitif, atau flow pembayaran/pengiriman.
