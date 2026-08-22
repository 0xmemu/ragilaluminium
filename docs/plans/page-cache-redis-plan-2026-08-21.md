# Rencana Optimasi — Cache Halaman Penuh Redis untuk Navigasi Mendekati Instan

**Tanggal:** 2026-08-21
**Status:** SEBAGIAN DIEKSEKUSI (2026-08-21) — Lapis A full-response cache **DIBATALKAN**
(karena CSRF token Inertia berputar per request → cache response basi menyebabkan 419/keamanan;
lihat ADR-013 "Execution result"). Komponen berat (storefrontCards/categoryMenu/promo_slides/home)
sudah di-cache Redis + query dioptimasi (catalog 15→7, home 69→30). Alternatif cache props-data (tanpa
CSRF) atau Nginx microcache untuk halaman statis di-defer; tidak dieksekusi.
**Tujuan:** Membuat pindah menu Inertia mendekati instan (seperti SPA murni) tanpa pindah arsitektur
ke Laravel API + frontend terpisah. Tetap Laravel/Inertia, tapi bobot server per navigasi diminalkan.

---

## 1. Latar belakang & mengapa perlu

| Kondisi sekarang | Fakta terukur |
|---|---|
| Navigasi Inertia = 1 request server per pindah menu | 150–270ms via https (sudah dioptimasi dari 600–790ms) |
| SPA murni (Orbitrix) = 0 request saat navigasi | "instan" (0ms) |
| Owner protes **fitur & desain**, bukan arsitektur | Inertia tetap pilihan (fitur sudah kaya, SEO baik) |
| Tapi "rasa instan" tetap diinginkan | **Cache halaman penuh** menutup gap 150–270ms → ~50ms |

**Keputusan di luar scope** (tidak dibahas di rencana ini):
- Tambah fitur kaya sesuai konsep desain owner
- Poles desain frontend
- Masalah arsitektur (tidak pindah ke SPA+API — sudah disepakati tetap Inertia)

---

## 2. Strategi cache halaman penuh (3 lapis, bertahap)

### Lapis A — Response cache (cepat, dampak terbesar)
Cache **response Inertia penuh** (HTML + props) per kombinasi URL+state, di Redis, dengan TTL.

```php
// Middleware / helper: cache key = md5(url + request->query + auth-state + flash-session)
$key = 'page.'.md5($request->fullUrl().'|'.($user?->id ?? 'guest'));
```

- Hanya untuk halaman **publik & read-only** (home, catalog, model, artiel, kebijakan).
- **TIDAK untuk**: admin (ada data user-specific), checkout/cart (sesi), halaman pasca-login.
- Issue benar dengan `Cache::remember($key, 120, fn () => renderPage())`.
- **Invalidate**: saat CMS/produk berubah → `forgetCache` (sudah ada, tinggal tambah key).

**Efek**: navigasi ke halaman umum = hit cache Redis (~10-50ms), bukan query DB + render PHP.

### Lapis B — Fragment/partial cache untuk komponen berat di halaman dinamis
Untuk halaman yang **harus dinamis** (katalog dengan filter/search), simpan **bagian yang statis**:
- `storefrontCards`, `categoryMenu`, `promoSlides` (SUDAH di-cache sesi lalu)
- Tambahkan: header/footer legacy, banner, installation gallery section

### Lapis C — Nginx microcache (opsional, tahap lanjut)
Cache halaman umum di Nginx (fastcgi_cache / proxy_cache) di depan PHP-FPM.
- **Kecepatan**: paling ekstrem (~10ms), nol PHP.
- **Kompleksitas**: perlu urus vary header, invalidate saat publish, purge.
- **Direkomendasikan**: setelah Lapis A terbukti, jika masih kurang.

---

## 3. Detail implementasi Lapis A (prioritas)

### File yang diubah
| File | Perubahan |
|---|---|
| `bootstrap/app.php` | Daftarkan middleware `CachePublicPages` |
| `app/Http/Middleware/CachePublicPages.php` (baru) | Logika cache response |
| `app/Services/PageCacheService.php` (baru) | Key builder + invalidator |
| `CatalogTaxonomy::forgetCache()` | Tambah key page cache |
| HandleInertiaRequests | Pastikan props flash/auth tidak masuk cache |

### Logika middleware
```php
public function handle($request, $next): Response
{
    // Hanya GET publik, bukan admin/checkout/cart/login/webhook/api
    if (! $this->cacheable($request)) return $next($request);

    $key = PageCacheService::key($request); // url + auth + role + query
    return Cache::remember($key, 120, fn () => $next($request)); // Response serializable?
}
```

**Tantangan**: Response Inertia berisi props user-specific (auth, flash). Solusi:
1. **Exclude halaman authenticated** (auth guard di cacheable).
2. **Flash session** — pastikan ping controller tidak memakainya, atau set `Cache::tags` dipecah per guest.
3. Jika Response tidak cacheable langsung → cache **data props** di controller (bukan Response utuh).

**Rekomendasi paling aman**: cache **data props** (array) per controller, bukan Response Inertia — karena React Inertia hanya butuh props, dan flash/auth bisa di-handle terpisah. Detail ini diverifikasi saat implementasi (ini RENCANA).

---

## 4. Apa yang di-cache vs tidak (keputusan penting)

| Cache (publik read-only) | JANGAN cache |
|---|---|
| ✅ `/` (home — sudah 30 query, cache penuh makin cepat) | ❌ `/checkout` (keranjang/sesi) |
| ✅ `/products`, `/products/all` (katalog) | ❌ `/cart` (sesi user) |
| ✅ `/products/{cat}/{model}` (detail) | ❌ Admin ** (user-specific) |
| ✅ `/faq`, `/about`, `/cara-pemesanan`, `/masalah`, `/hasil` | ❌ `/order/*` (status) |
| ✅ `/policy/*`, artikel CMS | ❌ Setelah login |
| - | ❌ API/webhook |

---

## 5. Verifikasi (setelah implementasi)

1. **Latency**: ukur navigasi `/` & `/products` via https sebelum/sesudah → target ≤ 50ms.
2. **Query count**: hitung query sebelum/sesudah cache → target 0–2 query untuk halaman ter-cache.
3. **Stale check**: ubah produk di admin → pastikan halaman refresh (invalidate bekerja), tidak tampil data usang > TTL.
4. **Autentikasi**: pastikan admin/login TIDAK pernah ter-cache leak.
5. **Test**: `php artisan test` area publik + cal.
6. **Smoke**: halaman ter-cache masih 200 & benar.

---

## 6. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| **Data usang** tampil saat admin update | Invalidate via `forgetCache`; TTL rendah (120s) |
| **Flash/auth bocor** dari cache | Cache hanya guest; flash dikirim terpisah |
| **Response dengan CSRF token** basi | CSRF di-cookie, bukan di body → aman |
| **Vary per user** | Key sertakan user_id; admin tidak di-cache |
| **Memori Redis** | Monitor; TTL 120s; hapus jika membengkak |

---

## 7. Estimasi

| Item | Waktu |
|---|---|
| Lapis A (middleware + service + invalidate) | ~2-4 jam agent |
| Verifikasi & test | ~1 jam |
| Lapis B (fragment tambahan) | ~1-2 jam (paralel) |
| Lapis C (Nginx cache) | ~1 hari (fase lanjut, opsional) |

**Prasyarat**: cache session (alasan lampau TTL), sudah Redis aktif (sudah).

---

## 8. Dokumen terkait
- Perbaikan performa sesi ini (query 15→7, home 69→30, prefetch)
- `docs/DEPLOYMENT.md` (cache Redis, config)
- Proyek: tetap Inertia (Laravel 11) — tidak pindah arsitektur

---
**Status: RENCANA DISETUJUI — eksekusi ditunda sampai pembahasan topik lain selesai.**