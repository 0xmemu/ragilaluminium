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

## Amendment 2026-09-21: Tier work and step budget

### Context

Runtime logs from one full working day (2026-09-20) quantified the cost of the
loop adopted above:

- 10,114 model requests and 5,289 tool calls in a single day.
- Median model request latency 11.4 seconds, p90 38 seconds, maximum 11.6 minutes.
- Median Bash tool call 3.2 seconds, so one tool call costs 13 to 24 seconds
  end-to-end once the following model round trip is counted.
- Completed turn duration: median 4.3 minutes, p75 11.2 minutes, p90 26.8 minutes,
  maximum 78.7 minutes.
- 145 model request failures on the day (109 of them HTTP 503 provider overload),
  with 113 scheduled retries and `maxAttempts` set to 11.

A compliant run of the four phases (brainstorm, plan, work, compound) needs an
estimated 162 to 267 tool calls, which at roughly 20 seconds each is 54 to 89
minutes for one task. This confirms the trade-off recorded above, that very small
tasks carry a process overhead, and shows the overhead is not lightweight in
practice. The compound archive is also still empty (zero learnings recorded), so
the compound phase has not yet produced durable value to offset its cost.

### Decision

Introduce an explicit tier plus a binding tool-call budget. Trivial and Standard
work runs plan and work only; brainstorm and compound are skipped, not run in a
compact form. Deep work keeps the full loop. Budgets are 15 tool calls for
Trivial, 60 for Standard, and 150 for Deep. Exceeding the budget stops the run and
reports, rather than continuing silently.

The tier never relaxes the non-negotiables: database safety, the mandatory report
format, canonical documentation updates when a spec changes, and verification
evidence all apply at every tier. Tier selection is recorded in the report, and
Deep work may not be downgraded to save time.

### Consequences

- Small tasks stop paying for two turn-ending confirmation gates and two archival phases.
- Trade-off: some small tasks lose the brainstorm framing and the compound archive
  entry. Accepted because the measured overhead was the dominant cost and because
  the archive is currently empty.
- Item 2 of the original decision still governs Deep work unchanged.

## Verification

- `AGENTS.md` makes both techniques mandatory and defines precedence and
  preservation rules.
- `docs/ORCHESTRATION.md` routes all agents through the same fallback loop.
- This ADR records the decision without changing product schema, routes, API,
  status values, or runtime dependencies.