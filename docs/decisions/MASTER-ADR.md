# Keputusan Arsitektur (ADR) — Ragil Aluminium — MASTER

File master tunggal yang menggabungkan seluruh Architecture Decision Record (ADR)
proyek dalam satu dokumen, sesuai permintaan user (2026-08-21). Setiap keputusan arsitektur,
alur data, integrasi, trade-off performa, dan kebijakan dicatat di sini.

> **Konteks / Prinsip**
> - Kode menang atas docs (rule-of-truth) — ADR harus mengikuti implementasi nyata.
> - Setiap ADR berdiri sendiri; jangan asumsikan pembaca tahu percakapan.
> - Status: `Accepted` / `Proposed` / `Superseded by ADR-NNN`.
> - Bahasa: Indonesia (istilah teknis boleh English).

## Daftar Isi


- ADR-001-agent-architect-production-orchestrator.md  ::  ADR-001: Adopt an Agent Architect and Production Orchestrator Contract

- ADR-002-agent-efficiency-and-compound-workflow.md  ::  ADR-002: Adopt Caveman and Compound Engineering as Agent Process Helpers

- ADR-003-cloudflare-tunnel-ingress.md  ::  ADR-003: Use Cloudflare Tunnel for Preview Ingress; Harden Before Production

- ADR-004-database-backed-transaction-integrity.md  ::  ADR-004: Database-Backed Transaction Integrity Guards

- ADR-005-enterprise-quality-gates.md  ::  ADR-005: Enterprise Quality Gates and Incremental Ratchet

- ADR-006-order-state-machine.md  ::  ADR-006: Centralized Order and Shipping State Transitions

- ADR-008-d1-migration-proposal.md  ::  ADR-008 — Migrasi Database ke Cloudflare D1 (Proposal)

- ADR-009-baileys-long-session.md  ::  ADR-009: Baileys Long-Session Persistence and Liveness

- ADR-010-admin-navigation-performance-prefetch.md  ::  ADR-010: Admin Navigation Performance — Hover-Prefetch over Mount/CacheFor/Single-Bundle

- ADR-011-admin-ui-shadcn.md  ::  ADR-011: Admin UI — Komponen shadcn Asli + Palet Netral + Layout Table-First


- **ADR-012** — Arsitektur produksi: tetap Inertia, bukan SPA+API terpisah.
- **ADR-013** — Performa pindah menu & api. subdomain: cache Redis Lapis A, satu origin, tanpa API subdomain.

---


# ADR-001: Adopt an Agent Architect and Production Orchestrator Contract

## Status

Accepted

## Date

2026-08-06

## Context

Ragil Aluminium has repository rules, domain contracts, UI governance, and a
full-stack production checklist, but no single operating contract that explains
how an agent should turn those sources into architecture decisions, parallel
tasks, gap reports, CI requirements, and release decisions.

Without that contract, an agent can make a locally correct UI or backend change
while missing migrations, provider failure behavior, secret rotation, recovery
evidence, or production checklist gates. This is especially risky for checkout,
payment, shipping, WhatsApp, media, and infrastructure work.

## Decision

Adopt [`AGENT-ARCHITECT-ORCHESTRATOR.md`](../AGENT-ARCHITECT-ORCHESTRATOR.md) as
the supplemental contract for development architecture and production
orchestration.

The contract requires agents to:

- preserve the modular-monolith boundaries and canonical contracts;
- decompose work into 1–3 day tasks with dependencies, tests, and evidence;
- audit every affected production checklist section using `[x]`, `[~]`, `[ ]`,
  and `[!]` statuses;
- create or update ADRs for significant or costly-to-reverse decisions;
- treat CI/CD, observability, security, rollback, backup, and restore as part
  of feature completion;
- keep production cutover blocked while checklist blockers or unresolved secret
  exposure remain.

`AGENTS.md` remains authoritative for repository safety and the exact code
change report format. `docs/ORCHESTRATION.md` remains authoritative for source
of truth and skill routing. The production checklist remains the release gate.

## Alternatives considered

### Add all responsibilities directly to `AGENTS.md`

- Pros: one file to read.
- Cons: makes the mandatory coding rules harder to scan, mixes execution rules
  with release governance, and makes future orchestration changes noisy.
- Rejected: the responsibilities are related but have different audiences and
  change rates.

### Keep the responsibilities as informal prompt text

- Pros: no repository changes.
- Cons: not versioned, not reviewable, easy to forget, and impossible to audit
  against future sessions or agents.
- Rejected: production governance must be durable and repository-visible.

### Create a separate role contract without linking it from the operating docs

- Pros: minimal edits.
- Cons: agents may not discover it and the source-of-truth hierarchy remains
  ambiguous.
- Rejected: the contract must be discoverable from `AGENTS.md`,
  `ORCHESTRATION.md`, and the documentation index.

## Consequences

### Positive

- Planning outputs become consistent and issue-ready.
- Production gaps are expressed with priorities and evidence instead of vague
  readiness claims.
- Provider, security, recovery, and CI concerns are surfaced before cutover.
- Architecture decisions remain reversible through explicit ADR history.

### Trade-offs

- Non-trivial changes require more planning and documentation.
- Release approval can remain blocked when operational evidence is incomplete,
  even if application tests pass.
- Agents must inspect more than the immediate code path for cross-cutting work.

## Implementation notes

- Link the contract from `AGENTS.md`, `docs/ORCHESTRATION.md`, and
  `docs/README.md`.
- Keep the active production checklist at
  `docs/FULL-STACK-PRODUCTION-CHECKLIST.md`.
- Record future changes to this governance model in a new ADR rather than
  deleting or rewriting the historical decision.

## Verification

- The contract file exists and states precedence, architecture invariants,
  task/GAP/ADR output requirements, safety boundaries, and release decisions.
- The three active entry points link to the contract.
- Markdown diff and secret scans pass.


---


# ADR-002: Adopt Caveman and Compound Engineering as Agent Process Helpers

## Status

Accepted

## Date

2026-08-07

## Context

Ragil Aluminium uses multiple agents and agent runtimes. Their output can be
verbose and their execution order can vary, which wastes context budget and
causes agents to skip planning or review. Two external repositories address
different parts of this problem:

- [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) compresses
  prose-like agent output while preserving technical text.
- [`EveryInc/compound-engineering-plugin`](https://github.com/EveryInc/compound-engineering-plugin)
  provides a repeatable brainstorm, plan, work, review, and compound workflow.

Neither repository defines Ragil's product behavior, database schema, API,
frontend governance, security requirements, or release gates. The repository
also cannot assume that every agent runtime has either plugin installed.

## Decision

Adopt both repositories as mandatory **agent process helpers**:

1. Agents use Caveman-style compression by default for explanatory prose and
   repetitive progress text. Code, commands, paths, errors, JSON, test output,
   contracts, and mandatory reports remain exact and uncompressed.
2. Agents use the Compound Engineering loop for every task:
   **brainstorm → plan → work → review → compound**. Small tasks may execute
   each phase in a compact form; non-trivial tasks must show appropriate
   planning and review evidence.
3. When plugin commands are unavailable, agents follow equivalent local rules
   in `AGENTS.md` and `docs/ORCHESTRATION.md`; no installation or network fetch
   is required to comply.
4. The Ragil source-of-truth hierarchy and explicit user safety instructions
   take precedence over both external techniques.

## Alternatives considered

### Install both plugins as repository dependencies

- Pros: identical command availability for every agent.
- Cons: couples the project to client-specific tooling, adds maintenance and
  supply-chain risk, and does not work for agents without those runtimes.
- Rejected: process rules must remain usable without installing third-party
  agent plugins.

### Use only Caveman

- Pros: lower output token usage.
- Cons: does not enforce planning, review, or durable learning.
- Rejected: compression alone does not improve task correctness.

### Use only Compound Engineering

- Pros: repeatable execution phases.
- Cons: does not address unnecessary prose and context consumption.
- Rejected: the two techniques solve complementary problems.

## Consequences

### Positive

- Different agents share a predictable task lifecycle.
- Prose-heavy context and status output use fewer tokens without losing
  copy/paste-critical evidence.
- Review and durable milestone capture become explicit parts of completion.

### Trade-offs

- Agents must distinguish compressible prose from exact technical artifacts.
- Very small tasks still carry a lightweight process overhead.
- Plugin behavior may differ across runtimes, so local fallback instructions
  remain necessary.

## Verification

- `AGENTS.md` makes both techniques mandatory and defines precedence and
  preservation rules.
- `docs/ORCHESTRATION.md` routes all agents through the same fallback loop.
- This ADR records the decision without changing product schema, routes, API,
  status values, or runtime dependencies.


---


# ADR-003: Use Cloudflare Tunnel for Preview Ingress; Harden Before Production

## Status

Accepted for preview/staging; production ingress decision deferred pending
production infrastructure evidence.

## Date

2026-08-07

## Context

Ragil Aluminium currently needs a safe HTTPS path from a phone/browser to a VPS
preview while the application is still being built. The preview service runs
Laravel on a VPS and must not require a public application port. Production will
also need Cloudflare DNS, TLS, WAF, origin access control, webhook reachability,
monitoring, and a recoverable deployment path.

The two realistic ingress choices are:

1. Cloudflare Tunnel from the VPS to a Cloudflare hostname.
2. Cloudflare-proxied DNS to a hardened Nginx origin with TLS and firewall
   controls.

## Decision

Use Cloudflare Tunnel for the current preview/staging phase. The Tunnel routes a
dedicated preview hostname to a loopback Nginx/PHP-FPM listener. The origin
application port remains private. Cloudflare Access may add an outer preview
boundary, but Laravel admin authentication and authorization remain mandatory.

Do not use the preview Tunnel hostname, preview R2 bucket, or preview secrets for
customer-facing production.

For production, Cloudflare Tunnel remains an allowed option only after these
gates are evidenced:

- at least two supervised connectors, or an explicitly accepted single-VPS
  availability exception;
- Cloudflare-only origin access and no public application/BAILEYS/Redis/MySQL port;
- external checks for DNS, TLS, `/up`, catalog, media, checkout, and webhooks;
- WAF/rate rules that do not block Meta verification, J&T webhook, or checkout;
- connector restart/recovery test, monitoring, and documented rollback;
- Nginx/PHP-FPM origin, not `php artisan serve`.

The application receives only the R2 bucket credential and normal Laravel env.
The Tunnel connector receives its own tunnel token. A Cloudflare account API
token is provisioning-only and is never loaded into PHP or committed to the
repository.

## Alternatives considered

### Direct Cloudflare-proxied DNS to Nginx

- Pros: fewer moving parts at request time; conventional TLS and origin
  operations; easier to reason about for a single production VPS.
- Cons: requires correct origin firewall, TLS/origin certificate, port exposure,
  and explicit protection against origin bypass.
- Decision: keep as the production alternative when the team is ready to own
  direct-origin TLS and firewall operations.

### Public `artisan serve` port

- Pros: fastest preview setup.
- Cons: not a production server; weaker process and request handling; exposes an
  application port; does not establish a durable ingress/security boundary.
- Rejected for production.

## Consequences

### Positive

- Preview can be accessed over HTTPS without exposing the VPS app port.
- Origin access can be restricted to Cloudflare and the Tunnel connector.
- The same hostname, WAF, and observability model can be exercised before launch.

### Trade-offs

- Tunnel availability and connector health become production dependencies.
- Webhook, upload-size, timeout, and long-running request behavior must be
  tested through the edge, not only on localhost.
- A single connector on one VPS is not high availability.

## Implementation notes

- Runtime token: `CLOUDFLARE_TUNNEL_TOKEN` in a root-readable protected service
  environment, never in the Laravel app environment.
- R2 runtime: bucket-scoped access key/secret; custom public media domain
  preferred over `r2.dev` for production.
- Preview: dedicated hostname and separate R2 bucket/prefix.
- Origin: loopback Nginx -> PHP-FPM; queue workers and BAILEYS remain private.
- See [production VPS environment contract](../production-vps-env-contract.md)
  for the agent request packet and verification order.

## Verification and rollback

Preview acceptance requires:

```bash
systemctl is-active cloudflared
curl -fsS https://<preview-host>/up
curl -fsS https://<preview-host>/products
php artisan media:disk-check
```

Rollback is to the approved direct/private preview path or a maintenance page;
it is not to a public `artisan serve` port. For production, the release record
must name the ingress rollback owner and verify the origin remains inaccessible
when the Tunnel is stopped.


---


# ADR-004: Database-Backed Transaction Integrity Guards

## Status

Accepted.

## Date

2026-08-08

## Context

The checkout, payment, cancellation, and long-running import paths could violate
business invariants under retry, double-click, partial settlement, or parallel
workers. The audit baseline showed that a repeated checkout could create two
orders and decrement stock twice, a partial payment could mark an order paid,
cancellation did not compensate inventory, and queue visibility could expire
before a 30-minute import completed.

These paths are part of one Laravel modular monolith and share the same
transactional database. Introducing distributed services would add operational
cost without strengthening these invariants.

## Decision

Use database-backed guards inside the existing modular monolith:

1. Assign each checkout flow a server-generated, session-scoped UUID. Persist it
   as nullable unique orders.checkout_idempotency_key. A retry returns the
   existing order; the unique constraint is the final concurrency guard.
2. Route cancellation through OrderService::cancel(). Lock the order, aggregate
   item quantities by variant, lock variants in stable ID order, restore stock,
   append the event, and commit cancelled exactly once.
3. Route payment completion through PaymentService. Reject non-positive
   amounts, lock order/payment rows, sum completed payments, and mark the order
   paid only when the sum covers orders.total_amount. Reconcile failed/refunded
   rows without automatically regressing fulfillment status.
4. Keep catalog import timeout at 1,800 seconds, set database/Redis retry_after
   to 1,860 seconds, and retain both unique dispatch and an application overlap
   lock keyed by import job ID.
5. Keep J&T webhooks fail-closed and use allowlist logs with hashed identifiers.
   Production boot fails when J&T is enabled without a signing key.

## Alternatives considered

### Client-only disabled submit button

Rejected as the integrity control. It improves UX but cannot protect network
retry, two tabs, replay, or parallel HTTP requests.

### Cache-only idempotency and cancellation locks

Rejected as the primary guard. Cache eviction or Redis outage could remove the
guard while the database write remains. Cache locks may complement, but cannot
replace, unique constraints and row locks.

### Add a partially-paid order status

Deferred. The canonical order payment statuses remain
pending|paid|refunded; partial settlement is represented by payment rows while
the order remains pending. A new public/admin status requires a separate
business decision and full contract/UI migration.

### Split payment, inventory, and import into services

Rejected for current scale. The modular monolith provides stronger local
transaction boundaries and lower operational complexity.

## Consequences

### Positive

- Checkout retries converge on one durable order.
- Stock decrement and cancellation compensation are paired and idempotent.
- Payment confirmation reflects actual settlement instead of one row's status.
- Import jobs cannot become visible to a second worker before their timeout.
- J&T operational logs retain correlation evidence without raw credentials or
  customer/provider payloads.

### Trade-offs

- The checkout idempotency migration adds a nullable unique index to orders;
  production migration timing and lock impact must be tested on a disposable
  MySQL clone.
- Session-scoped idempotency assumes the normal guest checkout flow. A future
  public API must accept and authenticate an explicit idempotency header/key.
- Cancellation currently restores variant stock only. Product-level inventory
  for non-variant items remains a separate P1 design.
- Payment reconciliation does not reverse fulfillment automatically; refund
  operations still require an explicit operational workflow.

## Implementation notes

- Migration:
  2026_08_08_010000_add_checkout_idempotency_key_to_orders_table.php.
- Services: OrderService, PaymentService.
- HTTP entry points: CheckoutController, admin order/payment controllers.
- Queue: ProcessCatalogImport, config/queue.php, production env contract.
- Security boundary: ShippingController, JntCargoClient, AppServiceProvider.
- No production/application database migration was executed as part of this
  change.

## Verification and rollback

Required evidence before production migration:

1. PHPUnit transaction, checkout retry, queue safety, webhook, and logging tests.
2. Two-worker import test with Redis and a job exceeding the old 90-second
   visibility timeout.
3. Parallel checkout test against production-like MySQL proving one order,
   payment, and stock decrement.
4. Forward migration timing/lock evidence on a disposable production clone.

Rollback keeps the nullable column/index in place and rolls application code
forward to a corrective version. Do not drop the index during an incident or
assume a down migration can safely merge duplicate orders. If the new code must
be disabled before production traffic, stop checkout writes first, deploy the
previous application version, and retain the column for forensic correlation.


---


# ADR-005: Enterprise Quality Gates and Incremental Ratchet

- Status: Accepted
- Date: 2026-08-08

## Context

The repository already has broad PHP, Vitest, Playwright, typecheck, lint, and build coverage. The baseline also contains 99 legacy PHP style findings and concurrent in-progress work. A whole-repository formatting rewrite would obscure semantic review and risk overwriting unrelated changes.

## Decision

1. CI treats TypeScript errors, ESLint warnings, Vitest failures, build failures, npm advisories, PHPUnit failures, and Playwright failures as blocking.
2. PHP formatting uses a changed-file ratchet: every added or modified PHP file must pass Pint.
3. Existing Pint debt is removed by bounded domain batches; the ratchet prevents new debt.
4. E2E owns its production build and isolated SQLite database so it is reproducible from a clean checkout.
5. Composer advisory output remains visible but temporarily non-blocking until the approved Laravel major upgrade removes the final framework advisories.
6. Failed Playwright reports and traces are retained as CI artifacts.

## Consequences

- New code cannot increase known style or frontend quality debt.
- Browser, accessibility, responsive, and checkout regressions become review blockers.
- CI takes longer because the E2E matrix runs independently.
- Enterprise completion remains blocked while any security scan is non-blocking.
- The Laravel major upgrade requires explicit approval and a full regression run.

## Rollback

The workflow jobs can be reverted independently. Removing the ratchet does not alter runtime behavior, but it reopens the ability to add unformatted PHP and must be recorded as a governance regression.


---


# ADR-006: Centralized Order and Shipping State Transitions

- Status: Accepted
- Date: 2026-08-08

## Context

Order status was writable from controllers, payment reconciliation, and carrier
updates. An admin could jump directly from `pending_payment` to `completed`,
cancellation could restore stock after shipment, and a stale carrier event could
regress a delivered shipment.

## Decision

`App\Domain\Orders\OrderStateMachine` is the only component that changes
`orders.order_status`. It owns the legal transition graph, row lock, actor,
source, and audit event. Cancellation inventory restoration runs inside the
same locked transition. Payment settlement and carrier cascades call this
component instead of updating order status directly.

Shipping milestones also use a monotonic transition graph. Carrier events older
than `last_status_at`, and regressions such as `delivered → in_transit`, are
recorded as safe operational warnings and cannot overwrite the canonical
milestone. Carrier payloads and exception messages are not logged.

Terminal order states are `completed` and `cancelled`. Cancellation is valid
only before shipment. Returns use `return_in_process` rather than cancellation.

## Consequences

- Illegal admin jumps return a validation error without partial payment or stock
  side effects.
- Payment, admin, WhatsApp, and carrier flows share one audited transition graph.
- New statuses or recovery paths require an explicit graph change and tests.
- MySQL concurrency verification remains a release gate even though row locks
  and transactional tests are present.


---


# ADR-008 — Migrasi Database ke Cloudflare D1 (Proposal)

Status: **Rejected** — keputusan 2026-08-11: pertahankan MySQL + PITR (RPO ≤1 jam sudah live)
Tanggal: 2026-08-11

## 1. Konteks & masalah
MySQL lokal di VPS 209.23.10.62 (3.3 MB, 40 tabel, data terkecil <1k baris).
Kekhawatiran user: risiko kehilangan data pada DB lokal VPS.

## 2. Keputusan yang diajukan
Migrasi sistem of record ke Cloudflare **D1** (SQLite serverless, managed,
backup otomatis Cloudflare).

## 3. Alternatif yang dipertimbangkan
- **PITR + arsip binlog ke R2 (DIPILIH SEKARANG, sudah live)**: RPO ~1 jam,
  nol perubahan arsitektur, gratis. Menjawab risiko kehilangan data langsung.
- MySQL managed eksternal (Aiven/DO): biaya + akun eksternal.
- Replikasi VPS kedua: biaya VPS tambahan.

## 4. Analisis teknis D1
- Data saat ini kecil (3.3 MB) — layak.
- **Hambatan utama**: Laravel memakai PDO/MySQL; D1 = SQLite via HTTP API.
  Tidak ada driver Laravel resmi → butuh adapter HTTP (community/buat sendiri),
  rework: migrations (20+ kolom enum, 8 kolom JSON → SQLite CHECK/JSON),
  queue driver (redis tetap), session (DB driver perlu tabel D1), FK.
- Koneksi app VPS → D1 via HTTP API publik (butuh auth token D1).
- Testing: sqlite lokal dekat dengan D1 → risiko lebih rendah dari MySQL.
- Butuh penulisan ulang `config/database.php` + `DB::` layer adapter; risiko
  regresi tinggi untuk perubahan sebesar ini pada tahap dev/live-preview.

## 5. Konsekuensi
- Pro: DB dikelola Cloudflare (durability, replica, backup otomatis).
- Kontra: effort besar (adapter + schema rework), test ulang menyeluruh,
  kontrak docs (database-schema) berubah dialek, checklist produksi harus
  ditutup dulu (blocker [!] masih open), D1 limits (SQLite concurrency,
  ‎10 GB max, per-query limits) sesuai skala saat ini.

## 6. Implementasi (jika disetujui)
1. ADR ini di-set Accepted oleh user.
2. Riset adapter Laravel-D1 (eksisting vs tulis sendiri).
3. Ekspor schema MySQL → SQLite compat; jalankan vs tests (sqlite sudah basis
   phpunit.xml — sinyal positif).
4. Migration bertahap: dual-write/read-only window, verifikasi, cutover.

## 7. Verifikasi & rollback
- PHPUnit hijau (sudah sqlite) + E2E storefront/checkout.
- Rollback: kembalikan MySQL (binlog PITR masih aktif sebagai jaring).

## 8. Keputusan yang dibutuhkan user
- Setujui migrasi D1 (mulai riset adapter) ATAU pertahankan MySQL + PITR
  (rekomendasi untuk tahap ini).


---


# ADR-009: Baileys Long-Session Persistence and Liveness

## Status

Accepted

## Date

2026-08-13

## Context

The Ragil gateway uses Baileys with a multi-file auth directory, but the first
OpenClaw-inspired adaptation only copied the reconnect and watchdog shape. It
did not observe Baileys protocol-frame activity, used an overly short idle
threshold, and wrote the primary credentials file through Baileys' normal
non-atomic writer. That combination could make a healthy linked connection look
stale and could weaken recovery after a process interruption.

The gateway is a separate Node service at `/opt/baileys-bot/index.js` and its
auth state is stored at `/opt/baileys-bot/session`. A normal network reconnect
must reuse that auth state without requiring another QR scan. A WhatsApp
`loggedOut` response remains a real relink condition.

## Decision

Use the OpenClaw long-session pattern at the gateway boundary:

- keep Baileys `useMultiFileAuthState` and cacheable signal keys;
- persist `creds.json` through a serialized, atomic write with a valid backup;
- restore a missing or invalid primary credentials file from the backup;
- observe `sock.ws` `frame` events as transport activity, while leaving
  Baileys' own keepalive responsible for protocol pings;
- use a 25-second Baileys keepalive, a 5-minute transport-stale threshold, and
  a 2-hour application-silence threshold by default;
- reconnect 408/network losses with exponential backoff and resume attempts
  after a cooldown instead of permanently stopping the daemon;
- preserve the existing gateway HTTP/webhook contract; explicit force-connect,
  `/disconnect`, and WhatsApp logout remain the only session-clearing paths.

## Alternatives Considered

### Raw WebSocket `ping()` as the heartbeat

Rejected. `sock.ws` is Baileys' socket event emitter, not the underlying `ws`
client, and the wrapper does not expose `ping()`. The existing call was a
no-op. Baileys already sends protocol keepalive requests and emits decoded
frames that can be observed safely.

### Treat application messages as the only liveness signal

Rejected. A linked WhatsApp account can be idle for hours. Message activity is
not a transport-health signal and would cause false reconnects.

### Disable the watchdog completely

Rejected. A dead TCP/WebSocket connection still needs bounded detection and
recovery. The watchdog remains, but its thresholds and activity source match
the transport behavior.

## Consequences

- Normal Baileys/network reconnects reuse the saved linked-device credentials.
- Idle healthy connections are no longer closed after a few minutes merely
  because no chat message arrived.
- A logged-out or deliberately cleared auth directory still requires a new QR
  scan or pairing code; long-session logic cannot override WhatsApp invalidation.
- Operational validation must include one successful pairing, a service
  restart, and observation that the gateway returns to `open` without another
  pairing action.


---


# ADR-010: Admin Navigation Performance — Hover-Prefetch over Mount/CacheFor/Single-Bundle

## Status

Accepted

## Date

2026-08-21

## Context

Panel admin Ragil (Laravel + Inertia React) mengalami persepsi "lambat saat
pindah halaman/menu". Verifikasi dengan Playwright (browser nyata, sesi stabil,
desktop 1440px) menunjukkan:

- Navigasi Inertia biasa: URL berpindah 157–226 ms, render penuh 409–479 ms.
- Prefetch hangat (hover dulu → klik): URL berpindah **36–44 ms**, render
  **187–195 ms** (di bawah ambang persepsi manusia ≈100 ms → terasa instan).
- Backend TTFB 115–139 ms (diukur curl); 0 console error; 0 link rusak.

Berdasarkan data ini, ada beberapa opsi "lebih cepat" yang tersedia, namun
tidak semuanya sesuai untuk panel admin yang datanya bersifat operasional
real-time (orders, notifikasi) dan sering berubah.

## Decision

Gunakan **prefetch on hover + click** pada navigasi sidebar admin
(`@inertiajs/react` `<Link prefetch={["hover", "click"]}>`) + **preload chunk**
5 halaman admin utama di `app.tsx`. **Tidak** mengadopsi opsi yang lebih agresif.

Opsi yang ditimbang dan tidak dipilih:

1. **Prefetch `mount` (fetch semua halaman saat app dibuka)**
   - Pro: klik tanpa hover pun ~40 ms.
   - Kontra: boros bandwidth & request server (langsung ~20 request saat startup
     padahal hanya 2–3 yang akan dibuka); risiko data basi; anti-pola enterprise
     (Linear/Stripe memakai fetch-on-demand, bukan fetch-all-awal).
2. **`cacheFor` (cache halaman di memori browser, balik tanpa hit server)**
   - Pro: kembali ke halaman yang sudah dibuka = ~0 ms dari server.
   - Kontra: **risiko data basi (stale)** pada data operasional real-time
     (orders/notifikasi berubah terus); hasil cached bisa tidak sinkron dengan
     perubahan yang dilakukan di halaman itu; manfaat kecil karena hover-prefetch
     sudah membuat balik-ke-halaman cepat dengan data terbaru.
3. **Single bundle (tanpa code-splitting)**
   - Pro: tidak ada "tunggu load chunk".
   - Kontra: bundle membengkak (Performa Toko saja sudah 400 KB karena Recharts;
     gabung semua → beberapa MB JS) → **halaman pertama justru lambat** karena
     download besar; kontraproduktif.

Alasan pilihan hover-prefetch (pola enterprise, diukur → memadai):

| Kriteria | Hover-prefetch (terpilih) | Mount | cacheFor | Single-bundle |
|---|---|---|---|---|
| Kecepatan klik | ~40 ms | ~40 ms | ~0 ms (balik) | lambat awal |
| Bandwidth | hemat | boros | hemat | besar |
| Data selalu fresh | ya | bisa basi | rawan basi | ya |
| Overhead startup | kecil | besar | kecil | besar |
| Praktik enterprise | ya (Linear/Stripe) | anti-pola | bertingkat | tidak |

## Consequences

- Klik menu setelah hover → terasa instan (~40 ms), tanpa boros request.
- Klik tanpa hover → ~170 ms URL / ~430 ms render (masih cepat, tidak ada cache
  basi).
- Data operasional (orders, notifikasi) selalu fresh; tidak ada risiko menampilkan
  data usang karena cache.
- Overhead startup tetap kecil; buka pertama tidak dibebani fetch semua halaman.

## Alternatives considered

- `prefetch="mount"` untuk semua halaman.
- `cacheFor` Inertia (10–60 s) — ditolak untuk data operasional karena stale.
- Single bundle tanpa code-splitting — ditolak karena memperlambat buka pertama.

## References / Evidence

- Pengukuran Playwright: `_audit_admin.mjs`-style (di repo VPS saat run; tidak
  disimpan sebagai artefak).
- Inertia v2 `<Link prefetch>` & `router.prefetch` (cache semantics).
- Pola fetch-on-demand di Linear/Stripe/Slack.


---


# ADR-011: Admin UI — Komponen shadcn Asli + Palet Netral + Layout Table-First

## Status

Accepted

## Date

2026-08-21

## Context

Panel admin dikeluhkan "jauh dari kata shadcn". Audit menunjukkan komponen
admin (`components/admin/ui/`) memang berarsitektur shadcn (Radix + cva + Slot),
tetapi:

- Palet "Paper" warna-warni (primary merah `0 100% 38%`, secondary/muted hijau
  `150 8% 93%`, accent merah muda `0 72% 96%`) membuatnya terlihat bukan shadcn.
- Radius besar (`--radius 1rem` = 16px) dan `rounded-xl` (14px) menyimpang dari
  estetika shadcn new-york (radius kecil 6px).
- Beberapa komponen adalah custom fungsional (status-badge, field, list-toolbar,
  confirm-action, pagination, empty-state) yang tidak setara di shadcn.
- Terdapat duplikasi nama komponen antara `components/ui/` (storefront) dan
  `components/admin/ui/` (admin) — potensial bentrok.

## Decision

Arahkan panel admin ke **estetika & komponen shadcn asli**, dengan batas keras
tidak menyentuh storefront:

1. **Palet netral shadcn new-york** — `--primary: 0 0% 9%` (nyaris hitam),
   secondary/muted/accent `96.1%`, border/input `89.8%`, ring mengikuti primary.
   Warna hanya tersisa pada elemen semantik (destructive/success/warning/info).
2. **Radius kecil konsisten** — `--radius: 0.5rem`, `--radius-control: 0.375rem`;
   konversi 91× `rounded-xl` → `rounded-lg` di 39 file admin.
3. **Komponen shadcn asli via `npx shadcn add`** ke `admin/ui/`: badge, tabs,
   tooltip, separator, form, label, command, chart (Recharts). Button & dialog
   di-refactor ke kode shadcn resmi.
4. **Komponen custom fungsional dipertahankan** (status-badge, field,
   list-toolbar, confirm-action, pagination, empty-state, delta-badge) karena
   tidak punya setara shadcn langsung dan membawa logika domain (statusMeta,
   Label+error, dsb). Bukan menimpa dengan Badge shadcn yang hanya visual.
5. **Scope ketat**: hanya `admin/ui` + halaman Admin + token `html.admin-shell`.
   `components/ui` (storefront) & `pages/Public` TIDAK disentuh.
6. **Chart tren** di Performa Toko: `TrendSparkline` custom (div CSS) → komponen
   **Chart shadcn** (Recharts BarChart) via ChartContainer/ChartTooltip.

## Consequences

- Panel admin konsisten dengan ekosistem shadcn; estetika netral modern.
- Komponen asli di-maintain via CLI shadcn, mudah di-update.
- Komponen custom fungsional tetap sehat (tidak patah karena diganti paksa).
- Storefront tidak terpengaruh (batas scope ketat).
- `recharts` ditambahkan sebagai dependency (hanya untuk Chart admin).

## Alternatives considered

- **Overwrite semua custom ke shadcn** → menolak: status-badge/field/list-toolbar
  punya logika domain yang hilang.
- **Unifikasi penuh jadi 1 set komponen** → menolak: memaksa mengubah storefront,
  melanggar batas scope & risiko besar.
- **Pertahankan palet Paper** → menolak: itulah akar "jauh dari kata shadcn".

## References

- `components.json` (style new-york, base radix, iconLibrary phosphor).
- `npx shadcn add` registry (badge/tabs/tooltip/separator/form/label/command/chart).
- ADR-010 (navigasi prefetch) — berkaitan dgn performa render halaman admin.


---


# ADR-012: Arsitektur produksi — tetap Inertia (Laravel 11 monolitik), bukan SPA+API terpisah

## Status

Accepted (2026-08-21)

## Date

2026-08-21

## Context

Sistem produksi saat ini (VPS prod 202.74.74.87) dipakai vendor **Orbitrix** dengan arsitektur
Laravel 12 API-only + frontend React SPA terpisah + DB `ragil_mebel`, di-depploy via docker-compose.
Owner menilai website Orbitrix "kurang bagus fiturnya, kurang kaya, tidak sesuai konsep desain" dan
meminta dibuat dari 0. Arsitekturnya dinilai "cukup bagus".

Sistem yang kami kembangkan (preview 209.23.10.62) memakai **Inertia (Laravel 11 render + React)**,
monolitik, dengan seluruh fitur (sitemap, backup 49 tabel, alerting, performa toko, voucher, review,
OWASP-reviewed) melekat di arsitektur itu.

Pertanyaan kunci: arsitektur produksi pakai yang mana untuk sistem baru?

## Decision

Tetap gunakan arsitektur **Inertia** untuk produksi, BUKAN pindah ke pola Laravel API + SPA terpisah
(seperti Orbitrix).

- Seluruh route (web + api `/api/*`) berjalan di satu origin `ragilaluminium.com`.
- Frontend tidak dipecah menjadi SPA terpisah; Inertia merender setiap halaman di server + hydnasia React.

## Consequences

Positif:
- Investasi fitur yang sudah dibangun (sitemap, backup, alerting, performa, security) tetap valid.
- SEO baik (server-rendered); data langsung tersedia di props (tanpa fetching tambahan); 1 codebase.
- Sederhana & aman (session + CSRF same-origin, tanpa CORS).

Negatif:
- Navigasi pindah menu selalu ada 1 request server per pindah (~150-270ms setelah optimasi; ditutup
  via cache — lihat ADR-013). Tidak mungkin se-instan SPA murni (0ms).
- Arsitektur tidak terpisah front/backend; scale horizontal less ideal untuk kasus mobile app masif.

## Alternatives considered

1. **Pindah ke Laravel API + SPA terpisah (pola Orbitrix)** — navigasi instan, front/backend pisah.
   Ditolak: biaya tulis ulang seluruh frontend (62 admin + 18 publik) = minggu-bulan; investasi fitur
   hilang; masalah owner adalah fitur/desain/arsitektur cukup, jadi meniru arsitektur tidak menjawab
   masalah; SEO/kompleksitas/multi-origin lebih berat.
2. **Adopsi langsung kode Produksi Orbi (Laravel 12)** — ditolak: bukan codebase kita, fitur kurang.

## References / Evidence

- Pengukuran navigasi Inertia (Playwright, https): 150–270ms setelah optimasi (ADR-010, ADR-013).
- VPS prod 202.74.74.87: `docker ps` → 7 kontainer Orbi (laravel_app, laravel_worker, frontend_main,
  frontend_admin, nginx_app, wa_app, mysql_db). Cek Docker-compose & composer.json (Laravel 12, DB
  ragil_mebel, APP_URL https://api.ragilaluminium.com, frontend "Orbitrix Tech Developer").
- Konfirmasi owner: website Orbi "kurang bagus fiturnya ... tidak sesuai konsep desain".


---


# ADR-013: Performa pindah menu & `api.` subdomain — cache Redis Lapis A, satu origin, tanpa API subdomain

## Status

Accepted (2026-08-21). Eksekusi cache Lapis A tertunda menunggu kesepakatan topik lain (plan di
`docs/plans/page-cache-redis-plan-2026-08-21.md`).

## Date

2026-08-21

## Context

Pindah halaman/menu di Inertia dirasa "lambat" walau backend cepat (TTFB 54–260ms, query sudah
dioptimasi: catalog 15→7, home 69→30). Gejala spesifik: "loading bar selesai tapi masih di halaman
yang sama" — ternyata dari gaya akses via HTTP port 8200 (aset JS/CSS dipaksa https oleh
`APP_URL=https` + `FORCE_HTTPS=true` → ERR_SSL_PROTOCOL_ERROR → app.js gagal dimuat). Via domain
https `ra.333labs.tech`, seluruh valid & navigasi 150–270ms (Playwright, 0 error).

Sistem Orbitrix (SPA murni) di VPS prod terasa "instan" karena navigasi sepenuhnya client-side
(0 request server per pindah). Dibahas apakah perlu meniru pola itu atau `api.` subdomain.

## Decision

1. **Perbaiki akses**: akses app via **https domain** (`ra.333labs.tech` / produksi `ragilaluminium.com`),
   bukan HTTP port 8200. (Akar gejala "bar selesai tapi halaman sama" = akses HTTP → aset https gagal.)
2. **Percepat pindah menu via cache Redis Lapis A** (props/content cache untuk halaman publik
   read-only, TTL ~120s, invalidate via `CatalogTaxonomy::forgetCache`). Target navigasi ~50ms.
   Bukan pindah arsitektur ke SPA. Rencana: `docs/plans/page-cache-redis-plan-2026-08-21.md`.
3. **Nginx microcache** dipakai TERBATAS/opsional — hanya halaman statis publik (landing/CMS yang sama
   utk semua, tanpa login). TIDAK untuk navigasi Inertia umum (risiko bocor data per-user, invalidasi
   sulit, manfaat ~15ms vs risiko). Ini adalah Lapis C yang opsional, bukan default.
4. **`api.` subdomain TIDAK diaktifkan.** Semua route (web + `/api/*`) di satu origin
   `ragilaluminium.com`. Rute `/api/*` (health, catalog, search, orders/status, wilayah, shipping)
   sudah ada di `routes/api.php` (46 baris, throttle 60/min) sebagai aset latent siap-dipakai.

## Consequences

Positif:
- Satu origin = 1 koneksi HTTP/2, tanpa CORS preflight, tanpa 2× DNS/TLS handshake = paling cepat.
- `api.` terpisah malah berpotensi lebih lambat utk frontend (CORS + 2 origin) — dihindari.
- Cache Lapis A memberi "rasa instan" aman (guest only) tanpa rombak.

Negatif:
- Navigasi Inertia tetap 1 request server (tidak 0ms seperti SPA). Gap ditutup cache, bukan hilang total.
- Cache Lapis A perlu perawatan invalidasi saat CMS/produk berubah.

## Alternatives considered

1. **Pindah ke SPA terpisah demi navigasi instan** — ditolak (ADR-012); cache memberi 90% manfaat.
2. **Nginx microcache umum** — ditolak untuk navigasi Inertia (per-user, invalidasi; risiko bocor data).
3. **Aktifkan `api.` subdomain** — ditolak: tanpa konsumen nyata; kompleksitas CORS/origin; performa
   tidak lebih baik; hanya berguna nanti jika ada mobile app / integrasi eksternal / dashboard pihak ke-3.

## References / Evidence

- Pengukuran: navigasi https 150–270ms; HTTP:8200 aset https → ERR_SSL_PROTOCOL_ERROR (app.js gagal).

## Execution result (2026-08-21) — Lapis A full-response cache DIBATALKAN

Saat implementasi, ditemukan bahwa **response halaman Inertia berisi CSRF token yang berputar
tiap request** (`meta csrf-token` + prop `csrf`). Cache full-response akan menyajikan token basi
kepada user lain → form POST / request AJAX bergantung CSRF gagal (419) & membuka celah keamanan.
Oleh karena itu **approach cache seluruh Response dibatalkan** (revert middleware + service;
`bootstrap/app.php` & `CatalogTaxonomy.php` dikembalikan bersih).

**Yang TETAP dipertahankan (aman, sudah sesi ini):**
- Optimasi komponen berat: `storefrontCards` (0 COUNT), `storefrontCategoryMenu`, `promo_slides`,
  home `popular_cards`/`featured_products` → cache Redis.
- Optimasi query: catalog 15→7, home 69→30.
- Prefetch dini (500ms) + progress 100ms (app.tsx).

**Alternatif aman untuk performa lebih lanjut (belum dieksekusi):** cache **props data** di level
controller (tanpa CSRF token), bukan Response penuh; atau Nginx microcache hanya untuk halaman
CMS/landing statis tanpa sesi. Keputusan di-defer ke sesi lanjutan bila masih butuh.

- Optimasi sesi: catalog 15→7 query (8 COUNT eliminated), home 69→30 query (cache Redis).
- `routes/api.php`, `docs/plans/page-cache-redis-plan-2026-08-21.md`, `ADR-010`, `ADR-012`.

---

# ADR-014: Platform VPS produksi — Ubuntu (bukan Debian) + ringkasan tujuan infra

## Status

Accepted (2026-08-21)

## Date

2026-08-21

## Context

VPS produksi awalnya dipertimbangkan Debian. Pengecekan kompatibilitas (PHP 8.2, MariaDB vs MySQL 8)
menemukan potensi perbedaan (Debian default MariaDB, bukan MySQL 8 dengan kolasi `utf8mb4_0900_ai_ci`).
Keputusan sementara: rebuild VPS prod ke Ubuntu agar konsisten dengan preview dan `provision.sh`.

Juga: VPS prod 202.74.74.87 saat ini berisi sistem Orbitrix (Laravel 12 API + SPA React + DB
`ragil_mebel`, docker-compose) — BUKAN codebase kita, dan bukan target deploy.

## Decision

1. VPS produksi baru di-rebuild ke **Ubuntu** (bukan Debian). `provision.sh` (Ubuntu + MySQL 8 +
   PHP 8.3 + Nginx + Redis + ufw + fail2ban) sudah ditulis & diuji install di container Ubuntu 24.04.
2. `PRODUCTION.md` runbook + `.env.example` lengkap sebagai panduan zero-AI go-live.
3. VPS prod 202.74.74.87 (Orbitrix) bukan target deploy sistem kita; data `ragil_mebel` mungkin
   dimigrasi (belum dieksekusi — butuh keputusan owner).

## Consequences

Positif: konsisten dgn preview (MySQL 8), kompatibilitas penuh, provision teruji.
Negatif: perlu provisioning VPS baru (failover/hand-holding ke backend).

## Alternatives considered

- Pakai Debian (PHP 8.2 + MariaDB) — ditimbang, tapi risiko perbedaan kolasi/DB & perlu penyesuaian
  provision; ditolak demi konsistensi Ubuntu.

## References / Evidence

- `scripts/prod/provision.sh` (uji container Ubuntu 24.04: PHP 8.3.33, Composer 2.10, Node 22 OK).
- `PRODUCTION.md`, `docs/plans/prod-readiness-fix-plan-2026-08-21.md`.
