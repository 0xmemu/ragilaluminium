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

## Docs

- `AGENTS.md` + `docs/ORCHESTRATION.md` — agent rules
- `docs/PRODUCT-HANDOFF.md` — functional UI and backend contract
- `frontend/README.md` — active brand, design, UX, and UI skills
- `docs/sitemap/*` + `config/sitemap.php` — routes/pages

**Do not** port UI from `website_2.0/ui` (Next.js). `resources/` is a real folder in this repo (not a junction).
