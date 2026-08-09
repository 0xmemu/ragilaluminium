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