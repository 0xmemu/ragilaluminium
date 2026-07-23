---
name: ragil-public-ui
description: Build and review Ragil Aluminium public Inertia React storefront pages.
---

# Ragil Public UI

## Read first

1. `frontend/README.md`
2. `docs/PRODUCT-HANDOFF.md` sections 8, 10, and 13
3. `frontend/brand/BRAND-KIT.md`
4. `frontend/docs/DESIGN-SYSTEM.md`
5. `frontend/docs/UX-FLOWS.md`
6. `config/sitemap.php`
7. Relevant public controller
8. `frontend/skills/ragil-ui-functional-integration/SKILL.md` — UI wajib fungsional + terintegrasi

## Rules

- React pages live in `resources/js/pages/Public`.
- Use the exact Inertia props and action field names from controllers.
- Do not invent URL, route name, enum, or JSON shape.
- Keep all customer copy in Bahasa Indonesia and currency in IDR.
- Use backend-provided href/media and derivative URLs.
- Do not hardcode WhatsApp number or template.
- Do not expose planned pages.
- Product variant selection must resolve an actual active variant.
- Add, update, remove, validate, place order, and lookup use existing Inertia routes.
- Every data area supports loading, empty, error, and reduced-motion states.
- **Setiap perubahan tampilan/fitur harus dianalisis lalu disambungkan ke controller/service/route agar langsung fungsional — bukan mockup.**

## Visual gate

- Precision Domestic tokens only.
- Signal Red remains an accent.
- Hero has real media and fits the initial viewport.
- One CTA label per intent.
- Mobile navigation follows sitemap.
- No fake data, fake scarcity, or generic stock photography.

## Verification

- Typecheck and build.
- Public PHPUnit/Inertia tests.
- Playwright browse, PDP, cart, checkout, and order lookup.
- Keyboard and 360/768/1024/1440 responsive audit.
