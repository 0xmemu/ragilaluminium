# Orchestration — Ragil Aluminium

Cara berpikir agent (adaptasi LOOPKIT, **bukan** harness Claude):  
**kontrak → SoT → skill track → code → report → (opsional) memory.**

Baca file ini + [`AGENTS.md`](../AGENTS.md) sebelum implementasi.  
**Pindah server / deploy production** hanya setelah produk final & matang — jangan mulai sekarang.  
**DATABASE SAFETY:** jangan `migrate:fresh` / `db:wipe` / truncate / drop data pada DB app (MySQL `ragil` / `.env` aktif) kecuali user **eksplisit** meminta di query yang sama. Detail: [`AGENTS.md`](../AGENTS.md) § Agent Rules → DATABASE SAFETY.

Tidak ada `.claude/`, hooks, atau `run.sh`. Loop agent = baca dokumen ini → skill relevan → ubah code → laporkan format AGENTS.

```text
AGENTS + ORCHESTRATION  →  DESIGN / schema / API / sitemap
        →  skill tracks (domain + technique)
        →  code
        →  SCOPE / ROOT_CAUSE / CHANGE / SPEC_IMPACT / TEST_STATUS
        ⇢  docs/MEMORY.md (milestone saja)
```

| LOOPKIT | Padanan Ragil |
|---------|----------------|
| `CLAUDE.md` | `AGENTS.md` |
| settings / hooks | Aturan di sini + report format AGENTS |
| `agents/verifier` | §7 Verify (checklist, bukan subagent) |
| `skills/*` tracks | `skills/` + `.agents/skills/` + Cursor skills |
| `MEMORY.md` | `docs/MEMORY.md` |
| `run.sh` | Tidak — alur di §6 |

### Agent efficiency protocol

Ragil agents MUST use two complementary external techniques as process
helpers, not as application contracts:

1. **Caveman** — default compression for prose-like agent output. Preserve
   code, commands, paths, error strings, JSON, test evidence, contracts, and
   the exact report format. If the runtime does not support the plugin, apply
   the rule manually by removing repetition without changing meaning.
2. **Compound Engineering** — default task loop:
   **brainstorm → plan → work → review → compound**. If plugin commands are
   unavailable, perform equivalent local phases using this document, the
   relevant domain skills, tests, and `docs/MEMORY.md`.

The local Ragil hierarchy always wins: explicit user scope and safety rules,
`AGENTS.md`, this orchestration contract, canonical product/schema/API/UI
contracts, then external technique helpers. These repositories are therefore
agent-process references, not permission to invent routes, fields, statuses,
providers, or UI behavior. See
[`ADR-002`](decisions/ADR-002-agent-efficiency-and-compound-workflow.md).

---

## 1. Kontrak (selalu)

| File | Peran |
|------|--------|
| [`AGENTS.md`](../AGENTS.md) | Operating rules, phase timeline, **format laporan wajib** |
| [`AGENT-ARCHITECT-ORCHESTRATOR.md`](AGENT-ARCHITECT-ORCHESTRATOR.md) | Supplemental architecture, gap, ADR, CI/CD, and release-gate contract |
| File ini | Hierarki SoT, inventaris skill, alur baca, verify, out-of-scope |
| [`MEMORY.md`](MEMORY.md) | Shift log lintas sesi (isi hanya di milestone) |

---

## 2. Source of truth (prioritas)

| Prioritas | Sumber | Dipakai untuk |
|-----------|--------|----------------|
| 1 | [`PRODUCT-HANDOFF.md`](PRODUCT-HANDOFF.md) + route/controller/schema/API | Perilaku, data, dan inventaris layar |
2 | [`FULL-STACK-PRODUCTION-CHECKLIST.md`](FULL-STACK-PRODUCTION-CHECKLIST.md) | Release gate, security, operations, recovery, and production evidence |
3 | [`../frontend/brand/BRAND-KIT.md`](../frontend/brand/BRAND-KIT.md) + `frontend/docs/*` | Visual language, UX, dan quality gate |
4 | `docs/sitemap/*` + `config/sitemap.php` (+ `admin-sitemap.php`) | URL, label menu, status implemented/planned |
5 | `docs/logic/stage-9*.md`, `docs/logic/stage-10*.md`, `docs/logic/ui-*-flows-*.md` | Perilaku data & form UI |
6 | [`STOREFRONT-HOME.md`](STOREFRONT-HOME.md) | Peta beranda / ulasan / logo platform (Figma = referensi) |
7 | `skills/stage-1` … `stage-8` | Workflow domain |
8 | `frontend/skills/*` | Workflow UI storefront/admin/visual QA |

**Dilarang:** menyalin/port UI dari `website_2.0/ui` (Next.js). Sitemap/CTA/wireframe → `docs/sitemap/`.

**UI stack:** Laravel **Inertia + React + shadcn/Radix** (`resources/js`). Visual direction = **Precision Domestic** dari `frontend/`. `resources/` harus folder nyata (bukan junction ke website_2.0). Planned routes (Masalah & Solusi, Retur, …) **jangan** masuk nav live.

---

## 3. Skill tracks (inventaris keseluruhan)

**Legenda status**

| Label | Artinya |
|-------|---------|
| **Wajib lokal** | Kontrak / workflow produk — baca dulu; jangan diganti marketplace |
| **Ada** | Sudah terpasang di repo atau Cursor |
| **Gap** | Opsional dipasang nanti; sementara cukup docs/test yang ada |
| **Jangan** | Bentrok SoT (React/Next landing, shipping generik mengganti JNT+stage-4) |

Lokasi:

| Lokasi | Isi |
|--------|-----|
| `skills/*.md` | Domain Ragil stage 1–8 (**autoritatif**) |
| `frontend/skills/*` | Workflow UI Ragil public, admin, dan visual QA |
| `.agents/skills/*` | Teknik aktif: Laravel, Blade, Tailwind, frontend, docs, `design-taste-frontend`, `laravel-testing` |
| `.agents/skills-archive/*` | Teknik historis/nonaktif; dipakai hanya setelah scope eksplisit |
| Cursor skills | Review, PR, loop — hanya jika user minta |
| `docs/logic/*`, schema, API | Kontrak behaviour / data (bukan skill file) |

Marketplace **tidak** mengganti Product Handoff / frontend governance / schema / stage lokal.

### Track A — Kontrak & orkestrasi

| Kebutuhan | Sumber | Status |
|-----------|--------|--------|
| Operating rules + report | `AGENTS.md` | Ada |
| SoT + peta skill | `docs/ORCHESTRATION.md` (file ini) | Ada |
| Pola Agents.md | `.agents/skills-archive/create-agentsmd` | Arsip — tidak diperlukan runtime |
| Disiplin docs / ADR | `.agents/skills/documentation-and-adrs` | Ada |
| Cari skill baru | `.agents/skills-archive/find-skills` | Arsip — install manual bila dibutuhkan |
| Output efficiency | `JuliusBrussee/caveman` | Wajib sebagai teknik, plugin opsional |
| Task execution loop | `EveryInc/compound-engineering-plugin` | Wajib sebagai teknik, plugin opsional |

### Track B — Domain backend (Ragil-only)

| Area | Sumber | Status |
|------|--------|--------|
| Foundation / env / routes | `skills/stage-1-foundation.md` | Wajib lokal |
| Actors / roles | `skills/stage-2-actors-and-roles.md` | Wajib lokal |
| Modules | `skills/stage-3-modules.md` | Wajib lokal |
| Order / payment / shipping / WA events | `skills/stage-4-order-payment-shipping-whatsapp-workflow.md` | Wajib lokal |
| Import Shopee Excel + media | `skills/stage-5-import-and-media-pipeline.md` | Wajib lokal |
| Queue / storage | `skills/stage-6-laravel-queue-and-storage.md` | Wajib lokal |
| Perf + API security | `skills/stage-7-performance-and-api-security.md` | Wajib lokal |
| WhatsApp Business | `skills/stage-8-whatsapp-business-integration.md` | Wajib lokal |
| Schema / API / architecture | `docs/database-schema-*`, `docs/api-and-routes-*`, `docs/architecture/*` | Docs |
| JNT Cargo | `docs/jnt-cargo-integration.md` + stage-4 | Docs — **jangan** skill shipping generik |
| Laravel technique | `.agents/skills/laravel-specialist`, `laravel-blade` | Ada (bukan override schema) |

Tidak perlu skill marketplace baru untuk Excel, WhatsApp Cloud, atau JNT.

### Track C — UI Inertia React storefront & admin

| Area | Sumber | Status |
|------|--------|--------|
| Public storefront | `frontend/skills/ragil-public-ui/SKILL.md` | Wajib lokal |
| Admin console | `frontend/skills/ragil-admin-ui/SKILL.md` | Wajib lokal |
| UI harus fungsional (bukan mockup) | `frontend/skills/ragil-ui-functional-integration/SKILL.md` + `.cursor/rules/ui-must-be-functional.mdc` | Wajib lokal — selalu |
| Visual QA | `frontend/skills/ragil-visual-qa/SKILL.md` | Wajib lokal |
| Checkout / store behaviour | `docs/logic/stage-10-*.md` | Kontrak |
| Admin CMS / ops UI | `docs/logic/stage-9a-*.md`, `stage-9b-*.md` | Kontrak |
| Visual + URL | `frontend/brand/*`, `frontend/docs/*`, sitemap/config | SoT visual + IA |
| React / Tailwind / Radix | `frontend-design`, `tailwind-design-system` | Ada |
| A11y / quality frontend | `.agents/skills/web-design-guidelines`, `frontend-design` | Ada |
| Anti-slop / redesign overhaul | `.agents/skills/design-taste-frontend` | Ada |
| PHPUnit feature/unit tests | `.agents/skills/laravel-testing` | Ada (lokal PHPUnit 11) |

Visual mengikuti Brand Kit dan Design System di `frontend/`; route, props, dan planned/live state tetap mengikuti kontrak produk.

### Track D — Design sync (Figma / assets)

| Kebutuhan | Sumber | Status |
|-----------|--------|--------|
| Brand assets | `frontend/brand/assets/README.md` | Lokal |
| Optional Figma sync | Figma MCP bila user meminta | Tool |

**Jangan** jadikan library atau marketplace skill sebagai SoT storefront.

### Track E — Testing, review, git

| Kebutuhan | Sumber | Status |
|-----------|--------|--------|
| Feature tests (checkout, import, WA) | `.agents/skills/laravel-testing` + `tests/Feature/*` | Ada |
| Security review diff | Cursor `review-security` | Ada |
| Bugbot-like review | Cursor `review-bugbot` | Ada |
| PR / CI babysit | Cursor `babysit`, `split-to-prs` | Ada |
| Agent loop / automate | Cursor `loop`, `automate` | Ada — hanya jika user minta |

### Track F — Out of scope (bukan “kerjakan sekarang”)

- Deploy / VPS / Docker **production** hardcut
- Rewrite penuh ke Next.js storefront
- Skill React/shadcn sebagai SoT UI publik
- Hard-delete data (pakai archive per schema)
- **Reset DB / wipe data** (`migrate:fresh`, `migrate:refresh`, `db:wipe`, truncate massal) tanpa instruksi eksplisit user — lihat `AGENTS.md` DATABASE SAFETY
- Menambah URL tanpa update `docs/sitemap/` + config sitemap + API routes doc

**Dev remote OK:** VPS sebagai workstation Cursor Remote SSH (bukan toko live) — lihat [`docs/dev-vps-remote.md`](dev-vps-remote.md) + `scripts/dev-vps/`.

---

## 4. Peta tugas → track / skill

| Area kerja | Baca wajib |
|------------|------------|
| Storefront Inertia (home, katalog, PDP, cart, checkout) | Track C: `ragil-public-ui`, **`ragil-ui-functional-integration`**, Brand Kit, stage-10, `docs/sitemap/public-*` |
| Admin Inertia | Track C: `ragil-admin-ui`, **`ragil-ui-functional-integration`**, Brand Kit, stage-9a/9b, `docs/sitemap/admin-*` |
| Import & media | Track B: stage-5 + schema |
| Queue / storage | Track B: stage-6 |
| WhatsApp | Track B: stage-8 (+ stage-4 untuk event order) |
| Order / payment / shipping | Track B: stage-4 + `docs/jnt-cargo-integration.md` bila JNT |
| Perf / API security | Track B: stage-7 |
| Visual overhaul | Track C: Brand Kit + `ragil-visual-qa` + `design-taste-frontend` technique |
| Tests PHPUnit | Track E: `.agents/skills/laravel-testing` + `tests/Feature/*`; jangan invent kontrak di luar schema/API |

---

## 5. Skills layout (ringkas)

| Lokasi | Isi |
|--------|-----|
| `skills/*.md` | Domain stage 1–8 |
| `frontend/skills/*` | Public/admin/visual QA lokal |
| `.agents/skills/*` | Teknik aktif (Laravel, Blade, Tailwind, frontend, docs, design-taste, laravel-testing) |
| `.agents/skills-archive/*` | Teknik yang tidak dipakai oleh runtime saat ini |
| Cursor skills | Review / PR / loop |
| `docs/logic/stage-9*`, `stage-10*` | Kontrak UI (bukan marketplace) |

---

## 6. Alur kerja agent (urutan)

1. Jalankan fase **brainstorm** Compound Engineering secara ringkas: pahami tujuan, risiko, dan batasan.
2. Baca `AGENTS.md` (format laporan) dan terapkan kompresi prose Caveman tanpa mengubah bukti teknis.
3. Bila merencanakan, mengaudit, membuat ADR, atau menilai release: baca `AGENT-ARCHITECT-ORCHESTRATOR.md`.
4. Jalankan fase **plan**: baca file ini, pilih **track**, skill wajib, SoT, dan strategi test.
5. Baca SoT yang relevan (Product Handoff / frontend / sitemap / schema / API / logic).
6. Baca skill domain di `skills/` dan UI di `frontend/skills/`.
7. Bila perlu teknik saja: skill di `.agents/skills/` (boleh; jangan override SoT).
8. Jalankan fase **work**: ubah code; jangan invent field/route/JSON di luar schema & API docs.
   - **UI/fitur:** analisis aksi di layar → sambungkan ke backend yang ada → verifikasi fungsional (lihat `ragil-ui-functional-integration`). Dilarang selesai sebagai mockup.
9. Jalankan fase **review**: cek diff, kontrak, keamanan, regression, dan test evidence.
10. Laporkan SCOPE / ROOT_CAUSE / CHANGE / SPEC_IMPACT / TEST_STATUS.
11. Jalankan fase **compound**: hanya catat keputusan, gotcha, atau milestone reusable di `docs/MEMORY.md`.

---

## 7. Verify (pengganti subagent verifier)

Sebelum menutup tugas, cek:

- [ ] Tidak menambah route/URL tanpa update sitemap + config + docs API
- [ ] Tidak port UI Next.js dari `website_2.0/ui`
- [ ] Field/JSON/status enum masih dalam schema & API docs; bila berubah → docs ikut + `SPEC_CHANGED_AND_DOCS_UPDATED`
- [ ] UI memakai satu icon family dari registry dan tidak mengarang icon brand
- [ ] Archive bukan hard-delete
- [ ] Report memakai format AGENTS tepat
- [ ] Mode visual: ikut Brand Kit + Design System dan lulus `ragil-visual-qa`
- [ ] Jangan expose nav ke halaman `planned` (Masalah & Solusi, Retur, …)

---

## 8. Gap skill (opsional, tidak blokir kerja)

| Gap | Status |
|-----|--------|
| Laravel testing | **Ada lokal:** `.agents/skills/laravel-testing` (PHPUnit 11 + pola `tests/Feature/*`). Pack marketplace penuh (`AsyrafHussin/agent-skills`) opsional bila Node ≥20. |
| Eloquent/MySQL khusus | Biasanya cukup `laravel-specialist` — jangan duplikasi tanpa alasan |
| Design taste overhaul | **Ada:** `.agents/skills/design-taste-frontend`, tunduk pada frontend governance |

---

## 9. Out of scope (sekarang)

Lihat **Track F**. Ringkas: tidak deploy production hardcut; tidak rewrite Next.js; tidak invent URL/schema.
