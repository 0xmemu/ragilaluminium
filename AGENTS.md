# AGENTS.md — Ragil Aluminium

Laravel 11 + Inertia React (TypeScript) modular monolith: public storefront + admin panel.
Runtime: `resources/js/app.tsx` (Inertia), routes in `routes/web.php` (285 routes), thin
controllers → `app/Services/*` → Eloquent. Prod DB MySQL (`DB_DATABASE=ragil`), Redis
queue/cache/session, media Cloudflare R2 (`MEDIA_DISK`), WhatsApp Meta/BAILEYS, J&T Cargo.

**Read first:** `docs/ORCHESTRATION.md` (source-of-truth hierarchy + skill tracks) →
`docs/AGENT-ARCHITECT-ORCHESTRATOR.md` (architect/orchestrator contract, ADR-001) →
`docs/PRODUCT-HANDOFF.md` (product behavior). Session context: `docs/MEMORY.md`.

## Non-negotiables

- **DATABASE SAFETY (hard rule):** never `migrate:fresh` / `migrate:refresh` / `db:wipe` /
  TRUNCATE / mass destructive seeder against the app DB (MySQL `ragil` or whatever `.env`
  points to) unless the user explicitly orders it in the same request. Forward-only `migrate`
  is allowed when relevant to the task. Test with PHPUnit (sqlite `:memory:` per `phpunit.xml`);
  `--env=testing` in `Artisan::call` does NOT switch the DB connection. Incident 2026-07-27:
  `migrate:fresh` wiped `ragil`, catalog/orders lost, recovery needed re-import.
- **Report format below is mandatory** for every code change or error fix.
- No new route / URL / schema field / enum / status / JSON shape without updating the
  canonical docs (`docs/database-schema-ragil-aluminium.md`,
  `docs/api-and-routes-ragil-aluminium.md`, `docs/sitemap/*` + `config/sitemap.php`,
  `config/admin-sitemap.php`) → then report `SPEC_CHANGED_AND_DOCS_UPDATED`.
- UI changes must be wired to real routes/controllers/services — functional, responsive,
  accessible. Mockups or fake data are NOT completion (`frontend/skills/ragil-ui-functional-integration/SKILL.md`).
- Do NOT port UI from `website_2.0/ui` (Next.js). `resources/` is a real folder, not a junction.
- Archive instead of hard-delete. Guest-only checkout (no customer accounts).
- Customer-facing copy in Bahasa Indonesia; currency IDR.

---

## AGENT REPORT FORMAT — MUST FOLLOW

Every time you change code or fix an error, report using EXACTLY this structure. Do NOT add extra narrative or steps.

1) SCOPE:
   - One short line.
   - Example: "Admin product create form"
              "API /api/products detail WIN-JUNG-001"

2) ROOT_CAUSE:
   - One line, directly stating the real cause.
   - Example: "Null product_media->url caused blade error"
              "variants relation not loaded, property access in loop"

3) CHANGE:
   - Maximum two lines.
   - Name the files and what you changed.
   - Example: "Added null-check in resources/views/admin/products/create.blade.php"
              "Loaded variants relation in ProductController@show before rendering"

4) SPEC_IMPACT:
   - Choose ONE of these and write it exactly:
     - "SPEC_UNCHANGED" → schema, routes, and JSON contracts are all unchanged.
     - "SPEC_CHANGED_AND_DOCS_UPDATED" → spec changed AND docs have been updated.

5) TEST_STATUS:
   - One line about tests or manual checks.
   - Example: "Smoke test admin create product: PASS"
              "Route /api/products/WIN-JUNG-001: 200 OK, payload matches api-and-routes spec"

Extra rules:
- Do NOT describe internal process (e.g. "let me check the log").
- Focus only on: scope, root cause, concrete code changes, impact on spec, and test status.

---

## Commands (verified from package.json / composer.json)

- `composer dev` — artisan serve + `queue:listen --queue=default,media --tries=3` + pail + vite
- `npm run typecheck` · `npm run lint` (eslint, `--max-warnings=0` — zero warnings required) ·
  `npm run test` (Vitest) · `npm run build` (Vite; required before checking Inertia asset updates)
- `npm run test:php` — PHPUnit; **on Windows it spawns WSL** (`wsl php vendor/bin/phpunit`)
- `php artisan test --filter=NameOfTest` — single PHPUnit test
- `npm run test:e2e` (build + Playwright) · `npm run test:e2e:only` (no build)
- `npm run quality` = typecheck + lint + test + build + budget
- Prod queue worker: `artisan queue:work --queue=imports,media,default --tries=3 --timeout=1800 --max-time=3600` (systemd `ragil-queue`)

## Testing quirks

- `phpunit.xml` pins `DB_CONNECTION=sqlite` `:memory:`, `QUEUE_CONNECTION=sync`, `CACHE_STORE=array`, `SESSION_DRIVER=array` — tests never touch MySQL.
- E2E/audit helpers live in `scripts/qa-*.mjs` (historical storefront audits used headless Chrome + puppeteer-core; evidence under `storage/app/audit-evidence/`).

## Read before code (routing)

| Area | Read |
|------|------|
| Public storefront / checkout | `docs/logic/stage-10-*`, `docs/sitemap/public-*`, `frontend/skills/ragil-public-ui/SKILL.md`, `ragil-ui-functional-integration`, `docs/STANDAR-DESAIN-HALAMAN-PUBLIK.md` |
| Admin UI | `docs/logic/stage-9a-*` / `9b-*`, `docs/sitemap/admin-*`, `frontend/skills/ragil-admin-ui/SKILL.md` |
| Visual | `frontend/brand/BRAND-KIT.md`, `frontend/docs/DESIGN-SYSTEM.md`, `frontend/skills/ragil-visual-qa/SKILL.md` |
| Import & media | `skills/stage-5-import-and-media-pipeline.md` |
| WhatsApp / order events | `skills/stage-8-*`, `skills/stage-4-*` |
| Order / payment / shipping | `skills/stage-4-*`, `docs/jnt-cargo-integration.md` |
| Queue / storage | `skills/stage-6-laravel-queue-and-storage.md` |
| PHPUnit | `tests/Feature/*` patterns (`.agents/skills/laravel-testing`) |

Marketplace `.agents/skills/` = technique helpers only; never override schema / sitemap / Product Handoff contracts.

## Gotchas (verified hard-earned fixes)

- Public layout must use `route('privacy')` / `route('terms')` — route names are `privacy`/`terms`, NOT `policy/privacy` (was a 500 on every page).
- `whenLoaded()` is not an Eloquent base method — use `relationLoaded(...)` guards. `$this->attributes` collides with Eloquent's internal property — use `getRelation('attributes')`.
- `config/app.php` overrides the `aliases` array — don't drop `Auth`; views use `auth()->user()`.
- Queue jobs must be serializable: dispatch IDs, not models (`DownloadProductMedia::dispatch($media->id)`).
- `webhook/*` routes are CSRF-exempt (`bootstrap/app.php` `validateCsrfTokens`) — contract, not a bug.
- `products.design_variant` is a nullable string (sub-models since 2026-08-08); validated against `sub_models`, fallback legacy map in `CatalogLabels::design()`.
- Excel import must NOT implement `WithEvents` (500s) — route through `App\Jobs\ProcessCatalogImport` (holds only `$jobId`/`$storedPath`).
- SQLite test quirk: `PerformanceMetric.metric_date` cast `date` tersimpan sebagai `Y-m-d 00:00:00` di SQLite — `whereBetween("metric_date", [..toDateString()..])` TIDAK match row cast; test yang butuh metric harus insert via `DB::table(...)->insert([... "metric_date" => now()->toDateString()])` (sudah dipraktikkan di StorePerformanceContractTest:166). Produksi MySQL aman (kolom date men-trim time). Bukan bug runtime.

## Current status (2026-08-11)

- Phases 1–6A + WhatsApp BAILEYS pairing + QA reconciliation done; PHPUnit 258 green / 4050 assertions (2026-08-09). HEAD `765e50b`.
- **Working tree is dirty (~136 entries)** with many `*.bak-*` files — review carefully before committing; some backups are intentionally kept.
- opencode: read-only subagent `cx-architect` (Customer Experience Architect) in `.opencode/agents/cx-architect.md`; `opencode.json` = `$schema` only. Delegate UX analysis to it.
- VPS 209.23.10.62 runs an opencode binary that **crashes (CPU lacks AVX)** — run opencode on a capable machine; the repo is only reachable via SSH from here.
- Production cutover NOT started; release governed by `docs/FULL-STACK-PRODUCTION-CHECKLIST.md` (no cutover while any `[!]` open).

## Communication

- Lead with outcome; keep updates concise; preserve exact commands, paths, errors, and test evidence.
- Ask questions only when genuinely blocking; otherwise make a safe assumption and state it.
- Efficiency protocols (Caveman / Compound Engineering loop) are process helpers only — they never override the rules above.
## WORKFLOW CONTRACT — TANPA KERJA LOKAL/TEMP (disepakati user 2026-08-12)

Berlaku untuk SEMUA agent di repo ini, termasuk agent lain/sebelumnya.

1. **Edit langsung di repo VPS** — satu-satunya sumber kebenaran. Akses via
   SSH ke /root/ragilaluminium. DILARANG membuat salinan file di mesin lain,
   folder temp lokal, atau scp bolak-balik: kerja lokal membuat git log repo
   kehilangan jejak perubahan dan konteks antar agent terputus.
2. **Commit + push per batch yang selesai** (setelah typecheck + build +
   verifikasi live). Jangan menumpuk perubahan tanpa commit — git history
   adalah kontrak antar agent.
3. Jangan commit: .env.pre-*, .backup-*, *.bak-* (kecuali diminta user).
4. Sebelum menyentuh file: cek git status — agent lain boleh bekerja di
   working tree yang sama; report format (SCOPE/ROOT_CAUSE/CHANGE/SPEC_IMPACT/
   TEST_STATUS) tetap wajib di setiap laporan perubahan.
