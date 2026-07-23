---
name: ragil-visual-qa
description: Run Ragil Aluminium anti-slop, accessibility, responsive, and performance checks.
---

# Ragil Visual QA

## Inputs

- `frontend/brand/BRAND-KIT.md`
- `frontend/docs/DESIGN-SYSTEM.md`
- `frontend/docs/ACCESSIBILITY-AND-QA.md`
- Changed React and CSS files

## Mechanical checks

- Count accent families: exactly one brand accent.
- Count icon families: exactly one.
- Check every image has alt and reserved aspect ratio.
- Check every form control has a visible label.
- Check primary CTA contrast and no desktop wrapping.
- Check hero height, nav single-line behavior, and mobile safe area.
- Check loading, empty, error, disabled, and pending state.
- Check reduced-motion CSS.
- Search for pure black, pure white as major theme values, hardcoded WhatsApp, planned route,
  fake scarcity, and duplicate CTA intent.

## Visual review

Capture 360, 768, 1024, and 1440 screenshots. Compare:

- hierarchy and reading order
- spacing rhythm
- image quality and crop
- active/focus/hover states
- table/card fallback
- fixed and sticky collision

## Required commands

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- `php artisan test`

Do not mark complete while a new warning, failing test, overflow, unreadable control, or placeholder
hero remains.
