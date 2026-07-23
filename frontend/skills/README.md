# Frontend Skills Registry

Untuk pekerjaan UI, baca `frontend/README.md`, skill area yang relevan, lalu kontrak yang dirujuk
skill tersebut.

## Project skills

- `ragil-public-ui/SKILL.md`: public storefront, catalog, cart, checkout, dan order status.
- `ragil-admin-ui/SKILL.md`: admin console dan operational workflows.
- `ragil-visual-qa/SKILL.md`: anti-slop, accessibility, responsive, dan performance gate.

## Technique skills used

- `.agents/skills/design-taste-frontend`: primary anti-slop guardrails untuk marketing/public page.
- `.agents/skills/frontend-design`: grounding desain pada material, audience, dan subject.
- `high-end-visual-design`: hanya prinsip spacing, material restraint, dan motion performance yang
  tidak bertentangan dengan usability.
- `.agents/skills/tailwind-design-system`: hierarchy token/component; contoh v4 harus diadaptasi
  ke Tailwind v3 yang digunakan repo.
- `.agents/skills/web-design-guidelines`: final interface review dengan guideline terbaru.
- `.agents/skills/laravel-testing`: PHPUnit 11 integration tests.
- `.agents/skills/documentation-and-adrs`: dokumentasi keputusan yang mahal untuk diubah.

## Precedence

1. Route, controller, schema, API, dan Product Handoff.
2. Brand Kit dan Design System proyek.
3. Project skill.
4. Technique skill.

Jika technique skill menyuruh membuat pola yang bertentangan dengan project guardrail, jangan
gunakan pola tersebut. Contoh yang ditolak: eyebrow pada setiap section, animation pada semua
elemen, atau nested bezel pada setiap card.
