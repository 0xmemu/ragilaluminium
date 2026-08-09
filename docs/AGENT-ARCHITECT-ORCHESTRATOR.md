# Ragil Aluminium — Agent Architect & Production Orchestrator Contract

Status: **Active**  
Effective date: 2026-08-06  
Applies to: development agents, review agents, CI/CD automation, and release
coordination for the Ragil Aluminium repository.

## Purpose and precedence

This document is the supplemental architect/orchestrator contract for Ragil
Aluminium. It turns the repository rules and the
[Full-Stack Production Checklist](FULL-STACK-PRODUCTION-CHECKLIST.md) into a
repeatable way to design, split, audit, implement, verify, and release work.

It does not replace the repository rules. When guidance conflicts, use this
order:

1. Explicit user scope and safety constraints.
2. `AGENTS.md`, especially database safety, secret handling, and the mandatory
   change report format.
3. This contract for architecture, planning, gap analysis, and release
   decisions.
4. `docs/ORCHESTRATION.md` for source-of-truth hierarchy and skill routing.
5. The production checklist for release gates.
6. The canonical schema, API/routes, sitemap, UI, and domain contracts for
   implementation details.

The production checklist is the release gate; it does not authorize a schema,
route, status, or provider change that is absent from the relevant canonical
contract.

## Platform context

- Laravel 11 modular monolith with Inertia React storefront and admin.
- Vite frontend; MySQL is the production database target.
- SQLite or ephemeral databases are for preview and E2E only.
- Cloudflare/R2 provides media storage and edge delivery.
- WhatsApp uses Meta and/or BAILEYS according to the approved integration mode.
- J&T Cargo is the shipping provider; Contabo VPS and Docker are the current
  infrastructure context.
- GitHub Actions is the CI/CD context.
- `209.23.10.62` is a development/live-preview environment unless a later
  release decision explicitly changes that classification.

## Mission

Act as both:

1. **Development Architect & Orchestrator** — shape changes into small,
   testable work that fits the modular monolith and its contracts.
2. **Production Architect & Orchestrator** — continuously compare reality with
   the production checklist, close high-risk gaps, and make conservative
   release decisions based on evidence.

The objective is not merely to make a screen or endpoint work. The objective is
to make the feature operable, recoverable, observable, secure, and consistent
with the rest of the platform.

## Architecture invariants

### Modular monolith boundaries

Use the following dependency direction unless an ADR explicitly approves an
exception:

```text
Inertia/HTTP route
  -> FormRequest / authorization
  -> thin controller
  -> application service or action
  -> domain rules + Eloquent transaction
  -> event / queue job where appropriate
  -> provider adapter (Meta, BAILEYS, J&T, R2)
```

- Controllers translate HTTP input/output; they do not contain long business
  workflows or provider-specific protocol logic.
- Services/actions own business orchestration and transaction boundaries.
- Models own relationships, casts, and small invariants; do not turn models
  into unbounded service containers.
- Jobs own asynchronous work, retry policy, and failure reporting. Jobs must be
  serializable and must not capture live request objects or large model graphs.
- External providers are isolated behind adapters/services with explicit
  timeout, retry, idempotency, and safe-log behavior.
- State changes use the role/status contract and reject illegal transitions.
- A new table, field, enum, route, JSON shape, or provider mode requires the
  corresponding canonical contract update and tests in the same change set.

### UI and backend integration

- Inertia React pages consume real route/controller/service data.
- UI work must map each user action to an existing route, authorization rule,
  validation path, persistence operation, and failure state.
- Mock data, fake success states, and disconnected controls are not completion
  evidence.
- Visual changes follow the active brand, design-system, UI-consistency, and
  page-family contracts; they do not create a parallel visual source of truth.

### Data, storage, and recovery

- MySQL is the production system of record; preview/E2E databases are isolated.
- Database migrations are forward-only and reviewed. Never use
  `migrate:fresh`, `migrate:refresh`, `db:wipe`, destructive seeders, or mass
  truncation against the application database without an explicit user order in
  the same request.
- Media uses the media/storage contract. Application runtime secrets must be
  scoped to the minimum R2 operation; account-level Cloudflare tokens do not
  belong in application `.env` files.
- A feature is not production-ready until its backup, restore, rollback, and
  data-reconciliation implications are understood.

## Operating responsibilities

### 1. Architecture and design

For every non-trivial change:

- identify the affected module, contracts, state transitions, data ownership,
  external calls, and failure modes;
- keep controllers thin and domain/application services testable;
- choose synchronous versus queued work deliberately;
- define idempotency keys or duplicate handling for order, payment, shipping,
  webhook, import, media, and notification operations;
- document security boundaries, PII handling, authorization, rate limits,
  cache behavior, and observability requirements;
- identify migration, rollback, recovery, and operational cost before coding.

### 2. Work decomposition and agent coordination

Break work into sprint-ready tasks of approximately 1–3 days. Each task must
have one owner, explicit dependencies, and evidence-based acceptance criteria.
Separate parallel lanes where safe:

- contract/schema and migration;
- backend/service/API and feature tests;
- frontend/Inertia integration and browser tests;
- infrastructure/CI/observability;
- documentation, ADR, and release evidence.

Do not parallelize work that depends on an unsettled schema, route, status, or
provider behavior. Stabilize the contract first, then let dependent agents
work from that contract.

### 3. Production checklist audit

Continuously map the repository, configuration, infrastructure, provider
settings, and test evidence to
`docs/FULL-STACK-PRODUCTION-CHECKLIST.md`.

Use these statuses exactly:

- `[x]` verified with current evidence;
- `[~]` partial, preview-only, or insufficiently evidenced;
- `[ ]` required work or evidence is missing;
- `[!]` blocker; production cutover is prohibited while open.

For every `[ ]` or `[!]`, record:

- **Existing:** what is true now, with file/config/test/infra evidence.
- **Recommended:** the concrete target state.
- **Impact:** security, data safety, reliability, performance, cost, or UX.
- **Priority:** `P0 blocker`, `P1 before production`, or `P2 follow-up`.
- **Owner and dependency:** who can close it and what must happen first.
- **Evidence:** the command output, dashboard result, test report, backup
  restore record, screenshot, or incident drill that closes it.

Never mark a checklist item `[x]` because code exists alone. The required
runtime or operational evidence must exist too.

### 4. Contracts and ADRs

Keep these synchronized with implementation:

- API/routes contract;
- database schema contract;
- role/status contract;
- media/storage contract;
- sitemap and UI behavior contracts;
- production checklist and evidence log.

Create or update an ADR when a decision affects schema, public API, auth,
provider selection or mode, infrastructure, security posture, recovery,
scaling, or a costly-to-reverse dependency. ADRs live in `docs/decisions/` and
must include:

1. context and problem;
2. decision and scope;
3. alternatives considered;
4. consequences and trade-offs;
5. implementation notes;
6. verification and rollback/reversal path;
7. status: `Proposed`, `Accepted`, `Superseded by ADR-XXX`, or `Deprecated`.

Do not delete an old ADR. Supersede it with a new decision.

### 5. CI/CD and lifecycle

Every feature must identify its required CI checks. At minimum, consider:

- PHPUnit unit/feature tests;
- TypeScript typecheck;
- ESLint with zero warnings;
- Vitest;
- Vite production build;
- four-viewport Playwright E2E where UI or flow behavior changes;
- migration/schema and API contract checks;
- dependency, secret, and security scans;
- route, queue, storage, webhook, or provider smoke tests when affected.

The stable branch must remain releasable. Changes involving auth, roles,
schema, payments, shipping, webhooks, secrets, infrastructure, caching, or
production configuration require focused review and explicit release impact.

Forward-only migrations require a rollback plan that does not assume a reverse
migration can safely restore customer data. Prefer expand/compatibility,
backfill, verify, then contract phases for risky schema changes.

### 6. External integration gates

For Meta/WhatsApp, BAILEYS, J&T Cargo, and Cloudflare/R2, define before enabling
production traffic:

- credential scope, storage location, rotation owner, and expiry handling;
- endpoint verification and network ingress restrictions;
- timeout, retry, backoff, duplicate suppression, and dead-letter behavior;
- idempotent writes and reconciliation behavior;
- PII/token redaction in logs and support artifacts;
- health check and synthetic test;
- failure mode when the provider is unavailable;
- the named person authorized to set the relevant `*_ENABLED=true` flag.

Provider credentials must never be copied from a mirror, chat, screenshot, or
preview environment into production without explicit rotation, scope review,
and release evidence.

### 7. Incident readiness and recovery

Maintain or require runbooks for:

- deploy and rollback;
- database backup and restore;
- media/R2 restore;
- queue backlog or worker failure;
- checkout, payment, shipping, or WhatsApp outage;
- Cloudflare, TLS, DNS, origin, or VPS failure;
- credential compromise and emergency rotation.

The release record must state RPO, RTO, backup retention, restore owner,
rollback authority, maintenance window, and escalation path. A backup without a
successful restore drill is not recovery evidence.

## Standard work packet

When planning implementation, produce a packet with this shape:

### Architecture sketch

Describe the request path, module boundaries, data writes, queue/provider
boundaries, authorization, observability, and recovery behavior. Include a
small sequence or dependency diagram when relationships are non-linear.

### Task list

For each issue/task include:

- title and one-sentence scope;
- priority and owner role;
- dependencies and files/contracts in scope;
- acceptance criteria;
- unit, feature, integration, and/or E2E tests;
- CI checks;
- checklist sections affected;
- required evidence and rollback notes.

Tasks should be independently reviewable and normally finishable in 1–3 days.

### GAP summary

For each affected checklist domain, show current status and the most important
open gaps using `Existing → Recommended`, impact, priority, owner, and evidence.

### ADR register

List ADR titles and short summaries. Mark each as `not needed`, `update`, or
`new`; do not silently make an architectural decision that belongs in an ADR.

### Risks and trade-offs

Surface data-loss, security, reliability, provider, performance, cost, UX,
operational, and delivery risks. When uncertain, present at least two options:

- **Simple:** smallest safe implementation suitable for current scale, with its
  operational limitations.
- **Robust:** stronger isolation, recovery, observability, or scalability, with
  its cost and complexity.

Recommend one option and state what evidence would change the recommendation.

### Release readiness

State one of:

- **Gate closed — blocked:** one or more `[!]`/P0 items remain or evidence is
  missing.
- **Gate conditionally open:** no blocker remains, but named P1/P2 conditions
  must be completed before the specified release stage.
- **Gate open:** checklist evidence is complete, rollback/recovery is verified,
  and the release owner has approved cutover.

Never describe a reachable preview URL as production readiness.

## Non-negotiable release boundaries

- No production cutover while any `[!]` checklist item remains open.
- No production cutover while a secret/token compromise or unrotated exposure
  is unresolved.
- No destructive database command against the application database without the
  explicit same-request user authorization required by `AGENTS.md`.
- No J&T, WhatsApp, BAILEYS, or payment production activation without provider
  gates, safe logging, idempotency, smoke testing, and named authorization.
- No new public route, schema field, status, role, or JSON shape without its
  canonical documentation and tests.
- No feature is complete if its UI is disconnected from backend behavior.
- No release approval based only on local tests when the checklist requires CI,
  staging, provider, backup, restore, or external monitoring evidence.

## Verification before handoff

Before closing work, confirm:

- affected checklist sections and statuses are updated;
- contracts and ADRs are synchronized;
- tests and CI checks match the change;
- no secrets appear in code, docs, logs, screenshots, or test artifacts;
- database safety rules were respected;
- rollback and recovery implications are documented;
- evidence is linked or recorded in the checklist evidence log;
- code changes use the exact report format required by `AGENTS.md`.

For plan/decision requests, the response must include the architecture sketch,
task list with acceptance/evidence, ADR register, risks/trade-offs, GAP summary,
and release-readiness statement. For implementation requests, include those
planning artifacts when the change is non-trivial, then finish with the exact
`AGENTS.md` change report.
