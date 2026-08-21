# OWASP Review — Ragil Aluminium (2026-08-21)

Status: **Lulus sebagian besar kontrol inti.** Berikut audit baris-per-lapisan terhadap
kode aktual di VPS (bukan asumsi). Tidak ada blocker blokir-produksi yang ditemukan di area ini.

## Ringkasan per kategori

| Kategori | Verdict | Bukti |
|---|---|---|
| **XSS** | ✅ Aman | Semua `dangerouslySetInnerHTML` (7 titik: HowToOrder, CmsPage, CmsPageForm, CmsDocument, CaraPemesanan) lewat `DOMPurify.sanitize` di frontend; backend `strip_tags` whitelist (`<p><br><strong>...`) di CmsDocumentSettings/CaraPemesananSettings. DOMPurify FORBID `script/iframe/object/embed/h1-h6/style` + FORBID_ATTR `style/onerror/onclick`. React auto-escape untuk non-HTML input. |
| **Mass assignment** | ✅ Aman | Semua model punya `$fillable` (tidak ada model tanpa). |
| **SQL injection** | ✅ Aman | Semua `DB::raw` hanya memakai konstanta/agregasi (`COUNT`, `SUM`, `CASE WHEN` dengan `$this->paidRevenueStatusSql()`), bukan input user langsung. Eloquent parameter binding untuk input. |
| **File upload** | ✅ Aman | `MediaUploadController@presign`: `kind` (image/video) + MIME whitelist `config('media.allowed_mime')` + max bytes + extension dari MIME (tidak dari filename). Upload langsung ke R2 via presigned URL. |
| **SSRF** | ✅ Aman | Tidak ada fetch URL dari input user. External client hanya JNT/R2/WhatsApp, URL hardcoded di config/service. |
| **CSRF** | ✅ Aman | Token aktif di semua route; dikecualikan hanya `webhook/*` (yang diveifikasi signature) + admin WA pairing (auth+admin+API key). |
| **Webhook signature** | ✅ Aman | JNT: `verifyWebhookSignature($rawJson, $signature)` (HMAC). WhatsApp: `hash_hmac` + `hash_equals` (timing-safe), plain secret via `X-Webhook-Secret` (query-string ditolak). 403 untuk secret invalid. |
| **Open redirect** | ✅ Aman | Hanya `CatalogController`: `redirect()->route('catalog.all', $request->query())` — meneruskan query ke named route, bukan redirect eksternal. |
| **IDOR / order access** | ✅ Aman | Order confirmation/cancel hanya untuk `order_number` yang sudah di-confirm di session (`$confirmed` array), bukan sembarang order. |
| **Rate limiting** | ✅ Aman | Login 20/1m + RateLimiter 5/60s; order status 15/1m & 10/1m; checkout 10/1m; review/cancel 10/1m; cart/engage 30/1m (tambah F6). |
| **Session fixation** | ✅ Aman | `session()->regenerate()` setelah login; login/logout dicatat. Sesi database-backed, cleanup 14 hari. |
| **Dependency** | ✅ Aman (partial) | Laravel 11.56.0; `composer audit` & `npm audit` jalan di CI. 2 advisory sisa (signed URL — tidak dipakai; CRLF email — MAIL_MAILER=log, risiko rendah). Upgrade major 12/13 ditunda — tidak sebanding risiko regresi. |

## Yang PERLU ditindak sebelum cutover (bukan blocker keamanan, tapi hygiene)

1. **Secrets di git history**: gitleaks sudah jalan di CI (`scripts/ci/secret-scan.sh`), tapi belum
   dieksekusi untuk histori saat ini di VPS. Jalankan `scripts/ci/secret-scan.sh` sebelum cutover;
   jika ada secret historis → rotasi (sesuai F0 blocker).
2. **`ragil_aluminium.bak-*` & `.bak-*` di repo root** — file backup `.bak` di-working-tree (lihat
   laporan sebelumnya). Pastikan tidak masuk ke bundle produksi.
3. **CSP masih report-only** — observasi pelanggaran di log/browser dulu, lalu enforce (F6 lanjutan).

## Rekomendasi lanjutan (opsional, non-blokir)

- Enforce CSP setelah periode observasi report-only.
- Job bersih `fail2ban` aksi ban dikirim ke Telegram (via aggregator) — opsional UX ops.
- Pertimbangkan audit tahunan ulang setelah perubahan besar (mis. setelah fitur pembayaran gateway).

---
Komit terkait: `c9509cd` (throttle + CSP), `88ba7e6` (laravel 11.56.0), `593cf13` (F6 checklist).