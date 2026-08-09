# UI Consistency Contract — Ragil Aluminium

Status: canonical for active Inertia + React pages (2026-08-06).

This contract replaces legacy visual references to `docs/DESIGN.md`, Blade page
partials, Figma exports, and the former `website_2.0`/`website_3.0` split. The
active implementation is `resources/js` with tokens in `resources/css/app.css`.
It governs new UI and targeted visual fixes; it does not change routes, props,
database fields, or API payloads.

## Foundations

- Font: Apple system font (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`,
  sans-serif) for body, headings, labels, and controls. Use the
  existing `font-sans`/`font-display` mappings; do not introduce a second font.
- Canvas: Mineral Canvas `#FFFFFF`; heading text `#333333`; action text
  `#262626`; body/description text `#737373`; border Aluminium `#DDE2E0`;
  action/promo Signal Red `#C00000`.
- Semantic colors (`success`, `warning`, `info`, `destructive`) are reserved
  for state communication. Red is not a decorative gradient or an all-page
  background.
- Icons come from `@phosphor-icons/react` through
  `resources/js/components/shared/icon.tsx`. Do not add emoji, Lucide, or a
  one-off SVG icon family.
- Product and customer content must be real backend data. Empty, loading,
  error, disabled, and success states are part of the page contract.

## Grid and container

- `.container-page` is the shared page container: `max-width: 112rem`, centered,
  with `1.25rem` mobile, `2rem` tablet, and `3rem` desktop inline padding.
- Public desktop layouts use a 12-column grid. Prefer `gap-5` (20px) for cards
  and `gap-6` (24px) for major page regions. At mobile, multi-column content
  falls back to one column unless it is a compact media/product strip.
- Product listing grids are 2 columns at mobile, 3 at tablet, 4 at desktop,
  and 5 only when the content and card width remain readable. Never compress a
  card merely to fill a row.
- Admin dashboard, index, detail, and form pages use the same 12-column shell.
  Dense tables may span all columns; filters, summaries, and form sections
  should occupy explicit columns rather than arbitrary nested widths.
- Text-heavy content is capped at `68ch`; tables and product grids may use the
  full container.

## Shape, type, and interaction

- Buttons and single-line inputs use the shared pill shape. Textareas and
  content panels use the existing control/panel radius tokens; listing cards
  stay edge-led and do not gain random rounded corners.
- Public navigation chrome (header, navbar, footer, and mobile bottom
  navigation) uses action graphite `#262626` via `bg-action`; header search is
  `36px` high via `h-9` at all breakpoints.
- Headings use sentence case in Indonesian copy unless a brand or proper noun
  requires otherwise. Existing user-facing copy is the assertion source for
  E2E tests; tests must not invent title-case variants.
- Every interactive element has a visible focus state, a keyboard path, and a
  useful accessible name. Icon-only actions require `aria-label`.
- Motion is restrained and respects `prefers-reduced-motion`. Do not use motion
  to hide loading or validation feedback.

## Page family templates

| Family | Grid contract | Required shared states |
|---|---|---|
| Catalog, search, flash sale, promo | Breadcrumb/heading row, filter rail or toolbar, responsive product grid | loading, empty, filter reset, error |
| Product detail | 6/6 media and purchase columns on desktop; stacked on mobile | media empty, variant error, stock, reviews, related empty |
| Cart, checkout, order | 7/5 content-summary split on desktop; one column on mobile | empty cart, validation, shipping loading/error, success |
| Public CMS | reading column plus optional 4-column supporting media/grid | content empty, media missing, WhatsApp fallback |
| Admin index | heading/actions, filter row, full-width data region | loading, empty, error, pagination |
| Admin detail/form | primary form/detail column plus secondary summary/action column | dirty, validation, disabled, saved/error |

## QA gate

Visual QA checks the same route at 360, 768, 1024, and 1440px. At each width
verify: no horizontal overflow, aligned container edges, stable card rhythm,
readable copy, keyboard focus, empty/loading/error states, and no accidental
desktop-only action. The browser E2E suite is the functional gate; screenshots
are evidence, not a substitute for route/controller integration.

## Change control

Changes to tokens, grid breakpoints, icon family, or page-family structure must
update this contract and the relevant frontend skill before implementation.
Changes to routes, props, status enums, or API fields must also update the
Product Handoff, sitemap, schema/API contract, and the role/status contract.
