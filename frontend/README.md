# Ragil Aluminium Frontend

Folder ini adalah pusat governance untuk UI/UX Ragil Aluminium. Kode runtime tetap berada di
`resources/js` dan `resources/css` agar mengikuti konvensi Laravel, Inertia, dan Vite.

## Source of truth

Urutan prioritas ketika ada perbedaan:

1. `docs/PRODUCT-HANDOFF.md`, route, controller, schema, dan API untuk perilaku/data.
2. `frontend/brand/BRAND-KIT.md` untuk identitas visual.
3. `frontend/docs/UI-CONSISTENCY-CONTRACT.md`, `frontend/docs/DESIGN-SYSTEM.md`, dan `frontend/docs/UX-FLOWS.md` untuk pola UI/UX.
4. `config/sitemap.php` dan `config/admin-sitemap.php` untuk IA dan navigasi.
5. `frontend/skills/*` untuk workflow implementasi dan quality gate.
6. Skill teknik eksternal hanya membantu teknik dan tidak boleh mengubah kontrak di atas.

## Struktur

- `brand/`: brand kit dan spesifikasi aset resmi.
- `docs/`: design system, alur, blueprint halaman, komponen, content guide, dan QA.
- `docs/decisions/`: keputusan yang mahal untuk diubah.
- `skills/`: skill khusus proyek untuk public storefront, admin, dan visual QA.

## Runtime map

- Inertia entry: `resources/js/app.tsx`
- Pages: `resources/js/pages`
- Layouts: `resources/js/layouts`
- Components: `resources/js/components`
- Types and helpers: `resources/js/types`, `resources/js/lib`
- Design tokens: `resources/css/app.css`, `tailwind.config.js`

## Visual direction

Nama arah desain: **Precision Domestic**.

Ragil harus terasa presisi seperti profil aluminium, tetapi tetap ramah untuk pembeli rumah dan
kontraktor. Basis visual adalah mineral neutral dan aluminium dingin. Graphite memberi struktur.
Signal Red hanya dipakai untuk aksi, fokus, status aktif, dan promo.

## Definition of done

- Semua halaman yang dipanggil `Inertia::render()` tersedia dan memakai data nyata.
- Route name, URL, schema, enum, dan JSON contract tidak berubah tanpa pembaruan spesifikasi.
- Public storefront selesai sebelum fase admin dinyatakan selesai.
- Loading, empty, error, success, disabled, dan reduced-motion state tersedia.
- Build, typecheck, lint, test frontend, dan PHPUnit lulus.
- Tidak ada nav ke halaman berstatus `planned`.
