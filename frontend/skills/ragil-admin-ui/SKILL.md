---
name: ragil-admin-ui
description: Build and review Ragil Aluminium admin Inertia React operational pages.
---

# Ragil Admin UI

## Read first

1. `frontend/README.md`
2. `docs/PRODUCT-HANDOFF.md` sections 8.4, 10.2, and 13
3. `frontend/brand/BRAND-KIT.md`
4. `frontend/docs/DESIGN-SYSTEM.md`
5. `frontend/docs/UX-FLOWS.md`
6. `config/admin-sitemap.php`
7. Relevant admin controller and domain stage skill
8. `frontend/skills/ragil-ui-functional-integration/SKILL.md` — UI wajib fungsional + terintegrasi

## Rules

- Admin pages live in `resources/js/pages/Admin`.
- Sidebar labels and route names come from admin sitemap.
- Use existing generic `columns`, `rows`, `fields`, and `sections` contracts.
- Derive presentation from row keys without moving business rules into React.
- Archive or deactivate instead of hard delete.
- Bulk catalog changes remain in Import.
- Order detail links payment, shipping, and WhatsApp workflows.
- Critical actions require confirmation and clear result feedback.
- Flat permission behavior remains unchanged until backend roles are expanded.
- **Setiap perubahan tampilan/fitur harus dianalisis lalu disambungkan ke controller/service/route agar langsung fungsional — bukan mockup.**

## Density

- Prefer tables at desktop and record cards below tablet.
- Numbers use tabular numerals.
- Cards are reserved for KPIs, alerts, and grouped detail.
- Sidebar and topbar do not compete with work content.

## Verification

- Auth guard and login tests.
- Generic resource rendering with empty and paginated data.
- Product, import, order, payment, shipping, WhatsApp, CMS, user, and settings smoke tests.
- Keyboard navigation and mobile drawer audit.
