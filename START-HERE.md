# START HERE — Ragil Aluminium website.4.0

Laravel modular monolith with **Inertia + React** storefront and admin. Visual governance lives under
`frontend/`; application runtime stays in `resources/js` and `resources/css`.

## Read first
- [`docs/PRODUCT-HANDOFF.md`](docs/PRODUCT-HANDOFF.md) — product behaviour, data model, and functional page inventory (section 10).
- [`frontend/README.md`](frontend/README.md) — brand kit, design/UX docs, and project UI skills (**Precision Domestic**).
- [`AGENTS.md`](AGENTS.md) — mandatory report format and phases.
- [`docs/ORCHESTRATION.md`](docs/ORCHESTRATION.md) — SoT hierarchy and skill tracks.
- [`docs/database-schema-ragil-aluminium.md`](docs/database-schema-ragil-aluminium.md) and
  [`docs/api-and-routes-ragil-aluminium.md`](docs/api-and-routes-ragil-aluminium.md) — canonical contracts.

## Runtime map
- Entry: `resources/js/app.tsx` + `resources/views/app.blade.php`
- Pages: `resources/js/pages/{Public,Admin,Auth}/`
- Layouts: `resources/js/layouts/`
- Tokens: `resources/css/app.css`, `tailwind.config.js`
- Governance: `frontend/brand/`, `frontend/docs/`, `frontend/skills/`

## Local setup
```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
# SQLite: create the DB file, then migrate (adjust .env DB_* as needed)
php artisan migrate
composer dev   # serves app + queue + vite
```

### Quality scripts
```bash
npm run typecheck
npm run lint
npm run test          # Vitest
npm run test:e2e      # Playwright (may use WSL on Windows)
npm run test:php      # PHPUnit
npm run build
```

Notes:
- Queues (`imports`, `media`, `default`), WhatsApp, and J&T degrade gracefully without credentials in dev.
- Do not restore UI from `website_2.0/ui` (Next.js).

## Hard constraints
- Do NOT change routes, URL paths, or route names without updating specs.
- Do NOT change the database schema, field names, or enum/status values.
- Guest-only checkout (no customer accounts); archive instead of delete.
- Customer-facing copy in Bahasa Indonesia; currency in IDR.
- If a page needs data the controller doesn't pass, coordinate a backend change — don't invent client fields.

See `docs/PRODUCT-HANDOFF.md` section 13 for the full exclusions/constraints list.
