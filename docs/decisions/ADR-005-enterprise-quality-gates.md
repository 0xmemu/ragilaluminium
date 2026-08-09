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
