# Ragil Aluminium

Laravel modular monolith: **Inertia + React + shadcn** storefront & admin, plus domain services (catalog, order, import, WhatsApp, JNT).

## Stack

| Layer | Tech |
|-------|------|
| Backend | Laravel 11, queues, Excel import |
| UI | Inertia.js + React 18 + Tailwind/Radix (Precision Domestic design system) |
| Assets | Vite (`resources/js/app.tsx`, `resources/css/app.css`) |
| Media | Disk `media` (local or Cloudflare R2) — see `docs/media-storage-r2.md` |

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm install
npm run build   # or: npm run dev
php artisan serve
php artisan queue:work --queue=media,default
```

## Admin Management

Buat user admin via CLI (tidak ada UI pendaftaran admin):

```bash
# Interaktif (prompt nama, username, email, role, password)
php artisan admin:create

# Non-interaktif
php artisan admin:create \
  --name="Owner" \
  --username="owner" \
  --email="owner@ragilaluminium.com" \
  --password="<min-8-karakter>" \
  --role="super_admin"

# Output sukses
Admin user 'owner' created successfully!
```

- Validasi: username unik, email unik (bila diisi), role enum
  (`super_admin`, `admin`, `staff`, `viewer`), password min 8 karakter.
- Password di-hash bcrypt; user dibuat dengan status `active`.
- Best practice: password kuat, minimalkan jumlah `super_admin`.
- Detail lanjutan: `docs/admin-management.md` (di repo lokal workspace).

## Docs

- `AGENTS.md` + `docs/ORCHESTRATION.md` — agent rules
- `docs/PRODUCT-HANDOFF.md` — functional UI and backend contract
- `frontend/README.md` — active brand, design, UX, and UI skills
- `docs/sitemap/*` + `config/sitemap.php` — routes/pages

**Do not** port UI from `website_2.0/ui` (Next.js). `resources/` is a real folder in this repo (not a junction).
