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
