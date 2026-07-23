# Media storage — local (dev) & Cloudflare R2 (VPS)

Product images use the Laravel disk **`media`** (`config/filesystems.php`).

| Environment | `MEDIA_DISK` | Where files live |
|-------------|--------------|------------------|
| Laptop / WSL | `local` | `storage/app/public/media` |
| VPS production | `s3` | Cloudflare **R2** bucket (+ public URL) |

R2 is S3-compatible object storage (not a second app). Laravel still owns download/import; R2 only stores bytes.

---

## Dev (default)

```env
MEDIA_DISK=local
MEDIA_ALLOW_SOURCE_FALLBACK=true
APP_URL=http://127.0.0.1:8200
```

```bash
php artisan storage:link
php artisan media:disk-check
```

**Local preview URL:** buka **`http://127.0.0.1:8200`** (bukan hanya IP WSL `172.24.x.x`).  
- Tanpa Vite: `npm run build` (Windows Node 24+), pastikan `public/hot` tidak ada → asset dari `public/build`.  
- Hot reload: Windows `npm run dev`, WSL `php artisan serve --host=0.0.0.0 --port=8200`, browser tetap `http://127.0.0.1:8200`. Jangan jalankan Vite di WSL Node 18.

---

## Siapkan R2 sekarang (sebelum / saat pindah VPS)

### A. Di Cloudflare Dashboard

1. **R2 → Create bucket** — contoh nama: `ragil-media`.
2. **Settings → Public access**
   - Preferensi: **Custom domain** `media.ragilaluminium.com` (DNS di Cloudflare), **atau** temporarily `*.r2.dev` public URL.
3. **Manage R2 API Tokens → Create API token**
   - Permission: Object Read & Write (scoped ke bucket itu).
   - Simpan **Access Key ID** + **Secret Access Key** (sekali tampil).
4. Catat **Account ID** (sidebar R2) → endpoint:  
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
5. **CORS** pada bucket (atau di custom domain): izinkan `GET`/`HEAD` dari origin toko (`https://ragilaluminium.com`). Upload tetap dari server Laravel (API token), bukan dari browser.

### B. Di `.env` VPS (template)

```env
MEDIA_DISK=s3
MEDIA_ALLOW_SOURCE_FALLBACK=false

AWS_ACCESS_KEY_ID=<r2_access_key_id>
AWS_SECRET_ACCESS_KEY=<r2_secret_access_key>
AWS_DEFAULT_REGION=auto
AWS_BUCKET=ragil-media
AWS_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_URL=https://media.ragilaluminium.com
AWS_USE_PATH_STYLE_ENDPOINT=true
```

`AWS_URL` = URL publik yang memakai browser (custom domain / r2.dev), **bukan** endpoint API.

### C. Setelah deploy ke VPS

```bash
# PHP GD wajib untuk WebP derivatives
php -m | grep -i gd

composer install --no-dev -o
php artisan migrate --force
php artisan config:cache

# Smoke tulis/baca/hapus object di R2
php artisan media:disk-check

# Queue media (supervisor / systemd)
php artisan queue:work --queue=media,default --tries=3

# Jika ada original lama tanpa turunan
php artisan media:backfill-derivatives

# Hapus JPG/PNG lama setelah WebP ada (default MEDIA_KEEP_ORIGINAL=false)
php artisan media:prune-originals --dry-run
php artisan media:prune-originals
# Orphan di disk (tanpa baris DB), mis. setelah DB reset:
php artisan media:prune-originals --disk
```

### D. Checklist go-live singkat

- [ ] Bucket + custom domain / public URL hidup (`curl -I $AWS_URL/...` 200 setelah upload uji)
- [ ] `MEDIA_DISK=s3` dan `media:disk-check` PASS
- [ ] `MEDIA_ALLOW_SOURCE_FALLBACK=false` (jangan hotlink Shopee)
- [ ] Worker queue `media` jalan
- [ ] Import sampel → `product_media.status=downloaded` + `derivatives.card` terisi
- [ ] `MEDIA_KEEP_ORIGINAL=false` (default) — original berat tidak disimpan; prune lokal/R2 bila masih ada JPG lama

---

## Perilaku aplikasi

- Import XLSX → `source_url` (arsip unduh ulang) → `DownloadProductMedia` → WebP `thumb` / `card` / `pdp` di disk `media`.
- Default `MEDIA_KEEP_ORIGINAL=false`: **tidak** menyimpan JPG/PNG original; `stored_path` mengarah ke WebP terbesar (`pdp`). Set `true` hanya bila butuh arsip resolusi penuh permanen.
- Storefront: `ProductMedia::urlFor('card'|'thumb'|'pdp')` — lihat schema `product_media.derivatives`.
- Local disk menyajikan path relatif `/storage/media/...` (dibangun ulang dari `derivatives.*.path` / `stored_path` saat request), supaya gambar homepage tetap tampil meski `APP_URL` atau host preview berubah. Jangan andalkan `stored_url` absolut lama di DB untuk tampilan.

Deps: `league/flysystem-aws-s3-v3`, PHP **`ext-gd`**.

---

## Estimasi kapasitas R2 — mix Ragil (WebP-only)

Basis pengukuran library lokal (~799 set gambar):

| Varian | Rata-rata |
|--------|-----------|
| `*-thumb.webp` | ~24 KB |
| `*-card.webp` | ~62 KB |
| `*-pdp.webp` | ~103 KB |
| JPG/PNG original (lama, dihapus bila `MEDIA_KEEP_ORIGINAL=false`) | ~880 KB |

**Per 1 foto katalog (WebP-only):** ≈ **~189 KB** (thumb+card+pdp).

### Parent produk vs SKU ukuran

Angka “puluhan ribu” biasanya = **varian ukuran**, bukan parent. Storage mengikuti **jumlah parent** × foto, bukan jumlah `variant_sku` ukuran.

**Skenario Ragil (utama):** per parent = 4 foto warna + 1 foto pemasangan ≈ **5 × 189 KB ≈ 945 KB**, plus foto kaca & video **shared** (sekali per katalog / per model, jangan digandakan per baris import).

| Parent produk | ≈ 10 ukuran/parent | Estimasi R2 (foto + shared kecil) |
|---------------|--------------------|-----------------------------------|
| 500 | ~5k | **~0,7 GB** |
| 1.000 | ~10k | **~1,1 GB** |
| 3.000 | ~30k ukuran | **~3 GB** |
| 5.000 | ~50k | **~4,8 GB** |
| 10.000 | ~100k | **~9,4 GB** |

Rumus: `parent × 5 × 0,189 MB` (+ ~0,2 GB shared kaca/video).

Belum termasuk: banner CMS (kecil), **video besar** per model jika clip jauh di atas ~15 MB.

### vs kuota 10 GB R2

- **Aman** untuk pertumbuhan menengah (hingga ~3–8k parent dengan mix Ragil).
- ~10k parent dengan 5 foto ≈ mepet 10 GB.
- Jangan andalkan free 10 GB jika parent mendekati 10k+ atau video besar banyak.
- Pantau **jumlah parent**, bukan jumlah ukuran.
