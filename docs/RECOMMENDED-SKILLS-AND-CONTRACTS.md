# Recommended Skills and Contract Inventory

Audit date: 2026-08-06.

## Keep and use

- `frontend/skills/ragil-public-ui` and `ragil-admin-ui`: page-family rules.
- `frontend/skills/ragil-ui-functional-integration`: route/controller/schema
  integration gate for every UI change.
- `frontend/skills/ragil-visual-qa`: the four-viewport visual gate.
- `laravel-specialist`, `laravel-testing`, and `documentation-and-adrs`: backend
  implementation, tests, and decisions.
- `skills/stage-1` through `stage-8`: Ragil domain workflows; these remain the
  authoritative source for import, queue, shipping, WhatsApp, and order rules.

## Use selectively

- `frontend-design`, `tailwind-design-system`, and `web-design-guidelines` are
  technique references only and remain subordinate to the local UI contract.
- `laravel-blade` is retained only for the Laravel shell and legacy-compatible
  views; it is not a storefront visual source of truth.
- `design-taste-frontend` is appropriate for deliberate redesign work, not as
  a replacement for the brand, sitemap, or functional-integration contracts.

## Archived from the active registry

The following were not referenced by active Ragil routes, skills, or build
scripts during this audit and are archived under `.agents/skills-archive/`:

- `alpine-js`
- `self-made-web-designer`
- `create-agentsmd`
- `find-skills`

They can be restored for a specifically scoped task. The active registry only
contains skills that exist in this workspace.

## New contract recommendations

- `frontend/docs/UI-CONSISTENCY-CONTRACT.md` is now the operational visual SoT
  for grids, typography, color, icons, shapes, page families, and QA widths.
- `docs/contracts/ROLE-AND-STATUS-CONTRACT.md` is the cross-layer SoT for
  equal-admin access and order/payment/shipping statuses.
- Keep `docs/MEMORY.md` as a milestone log, not as a second design system.
