# Storefront Home & Social Proof — Repo Map

**SoT untuk layout beranda publik:** kode + config di repo ini.  
**Figma** ([Web Ragil Aluminium — Halaman Beranda](https://www.figma.com/design/ujOeCwCyj69WF4ddmpE6Dv/Web-Ragil-Aluminium?node-id=145-12668)) = **referensi visual saja**, bukan kontrak.

Dokumen ini **satu file** menggantikan catatan gap yang terpisah-pisah soal beranda / ulasan / logo platform.

---

## Keputusan produk (2026-07-22)

| Topik | Keputusan |
|-------|-----------|
| Dual strip ulasan di Figma (home) | **Tidak dipakai.** Satu strip cuplikan di home → detail di `/reviews`. |
| Ulasan Shopee / WA / website | **Satu halaman** `/reviews` dengan filter sumber: Semua · Shopee & WhatsApp · Website. |
| Logo toko di platform lain | Tampil di **Informasi Toko** (`/about`) + **footer**, dipisah **Marketplace** (Shopee/Tokopedia/Lazada/TikTok Shop — jual-beli) vs **Media Sosial** (Instagram/TikTok/YouTube/Facebook — konten). |
| Social proof unit di home | **Dihapus.** Label unit tetap bisa dipakai di Informasi Toko (`brand.units_installed_label`). |
| Informasi Toko outline | Esensi Figma Tentang: intro + stats + Kenapa Memilih + Dipercaya + Cara Kerja + kontak (alamat/WA/email/jam + **Google Maps embed**) + Ikuti Kami. Maps: `brand.maps_query` / `BRAND_MAPS_*`. |
| Hero / Precision Domestic | **Tetap** desain live (promo carousel). Jangan diganti hero sinematik Figma. |
| Foto/Video di kartu galeri | `photo_count` dari ada `image_url`; `video_count` = 0 sampai schema video ditambah. |
| Kami Bantu | Copy default di `Home.tsx` `HELP_STEPS` (sudah selaras intent Figma). |

---

## Peta section beranda → kode

Route: `GET /` → `HomeController@index` → Inertia `Public/Home`  
File UI: `resources/js/pages/Public/Home.tsx`  
Layout CMS (urutan/enable + sorotan layanan + cara pesan): `HomepageLayoutSettings` + admin Beranda.

| Urutan (live) | Section | Sumber data | Catatan vs Figma |
|---------------|---------|-------------|------------------|
| 1 | Hero promo | `promoSlides` / banners | Live = carousel promo, bukan hero cinematic Figma |
| — | ~~Sorotan layanan~~ | dihapus | Figma hanya **Trust Badges di dalam hero**, bukan strip terpisah COD/Garansi/Ongkir |
| — | ~~Social proof unit~~ | dihapus | Strip Signal Red “Unit Terpasang” dihapus dari beranda |
| 2 | Pilih model | `modelCards` | |
| 3 | Paling banyak dipesan | `popularProducts` / featured | Anchor `#paling-banyak-dipesan`; boleh berisi SKU flash sale tanpa carousel Flash Sale terpisah |
| — | ~~Flash Sale home~~ | dihapus | Flash Sale hanya `/promo` + `/flash-sale` |
| — | ~~Pembatas metal~~ | dihapus | Section memakai `border-t border-border` saja |
| 4 | Cara pesan | `homepageLayout.how_to_order` | CMS enable/copy; **fixed** di bawah produk populer |
| 5 | Hasil pemasangan | `CmsGalleryItem` (+ fallback foto testimoni) | Caption `N Foto` / `N Video` |
| 6 | Apa kata pelanggan | `CmsTestimonial` published (cuplikan) | **Satu** carousel; CTA ke `/reviews` |
| 7 | Kami bantu | `HELP_STEPS` di `Home.tsx` | Dekat frame `services` Figma |
| 8 | Closing CTA | hardcoded + WA shared | |

Managed keys (`sections[].key`): `banner` · `how_to_order` (enable/copy saja; urutan publik fixed di `Home.tsx`).  
(`service_highlights` retired — bukan section beranda.)

---

## Logo platform (marketplace vs media sosial)

| Apa | Di mana |
|-----|---------|
| Catalog | `config/sitemap.php` → `platforms[]` (`key`, `label`, `channel`, `icon`; `href` default/env fallback) |
| Admin edit URL | Pengaturan Website → **Marketplace & Media Sosial** (`admin.storefront-platforms.*`) → `cms_pages.slug = storefront-platforms` (`content.links`) |
| Runtime merge | `App\Support\StorefrontPlatformSettings` |
| Share Inertia | `HandleInertiaRequests` → `platforms` (+ `brand.years_experience_label`) |
| Komponen | `resources/js/components/public/storefront-platforms.tsx` (grouped Marketplace / Media Sosial; footer: `iconsOnly` = logo tanpa nama platform) |
| Informasi Toko | `Public/CmsPage` — kontak kiri + **Ikuti Kami** kanan (section gelap yang sama) |
| Footer | `public-footer.tsx` — kolom kanan; tetap terpisah Marketplace vs Media Sosial, **tanpa label nama** di tiap ikon |
| Catatan | Facebook & YouTube = media sosial/konten, **bukan** marketplace; URL kosong/`#` = tile tampil tanpa tautan aktif |

Edit teks unit terpasang (Informasi Toko): `config/sitemap.php` → `brand.units_installed_label` atau env `BRAND_UNITS_INSTALLED_LABEL`. Strip beranda sudah dihapus.

---

## Halaman ulasan

| Item | Lokasi |
|------|--------|
| Route | `GET /reviews` → `PageController@reviews` → `Public/Reviews` |
| Model | `CmsTestimonial` (`source`: `shopee` \| `whatsapp` \| `website` \| `other`) |
| Query filter | `?source=all\|marketplace\|website` + `?sort=` |
| marketplace | `source IN (shopee, whatsapp, other)` |
| website | `source = website` |
| Galeri hasil pemasangan | Halaman `/hasil-pemasangan` + detail `/hasil-pemasangan/{parent_sku}`; beranda memakai `InstallationCard` (layout sama ModelCard) dengan keterangan total foto/video; kartu selalu clickable |

Home **tidak** menduplikasi dua strip Figma; cukup cuplikan + link “Semua ulasan”.

---

## File terkait (repo)

```text
resources/js/pages/Public/Home.tsx
resources/js/pages/Public/Reviews.tsx
resources/js/pages/Public/CmsPage.tsx
resources/js/components/public/public-footer.tsx
resources/js/components/public/storefront-platforms.tsx
app/Http/Controllers/HomeController.php
app/Http/Controllers/PageController.php
app/Http/Middleware/HandleInertiaRequests.php
config/sitemap.php          # brand, platforms, footer, nav
frontend/brand/BRAND-KIT.md
frontend/docs/DESIGN-SYSTEM.md
frontend/skills/ragil-public-ui/SKILL.md
docs/PRODUCT-HANDOFF.md
docs/WORKFLOW-AUDIT.md
```

---

## Planned (belum di schema)

- Kolom / media **video** pada `cms_gallery_items` → baru `video_count` nyata.
- Sinkron otomatis ulasan Shopee API (saat ini entry admin CMS).

---

## Cara update dokumen ini

Ubah section beranda / filter ulasan / lokasi logo → **edit file ini dulu atau bersamaan**, jangan buka dokumen gap terpisah baru.
