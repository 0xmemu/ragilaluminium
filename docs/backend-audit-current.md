# Backend Audit — Current Runtime

Audit date: 2026-08-06. Scope: Laravel 11 application in this repository,
including `app/`, `routes/`, `config/`, migrations, tests, and the active
Inertia shell. This document supersedes the historical audit in
`docs/archive/backend/backend-audit-and-improvement-plan-2026-07-12.md`.

## Current verdict

The runtime is coherent enough for dev preview: route/controller contracts,
checkout creation, import processing, WhatsApp webhook logging, J&T webhook
status propagation, media jobs, and the existing PHPUnit suite are covered.
The application database was not reset during this audit.

## Verified strengths

- Admin access is authenticated + active and uses equal-admin semantics;
  `UserController` normalizes writes to `role=admin`.
- Order creation revalidates catalog data in a transaction and writes order,
  item, and payment records.
- Shipping and payment status values are now aligned with the schema and
  `resources/js/lib/status.ts`; see `docs/contracts/ROLE-AND-STATUS-CONTRACT.md`.
- Media downloads run through the queued pipeline and archive actions rather
  than hard-delete catalog media.
- Feature coverage currently includes checkout, import, and WhatsApp webhook
  paths; run `php artisan test` for the current count.

## Remaining operational gaps

| Priority | Area | Evidence / follow-up |
|---|---|---|
| P1 | J&T production activation | Credentials and `JNT_ENABLED` remain deployment-scoped; do not enable on preview. Validate from the production migration checklist only after product sign-off. |
| P1 | Observability | Add structured queue/shipping failure metrics and alerting before production; current graceful fallbacks are suitable for preview but can hide integration outages. |
| P2 | Analytics | `PerformanceMetric` aggregation and visitor/conversion sources need a defined event source before claiming complete analytics. |
| P2 | Import scale | Streaming and per-job batching can be optimized for very large workbooks; current queued path is functional. |
| P2 | Upload hardening | Keep MIME/size/host validation under review for any newly introduced upload source. |
| P3 | Contract drift | Run the role/status grep and route/API contract checks whenever order or admin workflows change. |

## Audit rules

- Do not treat archived Blade/Figma or split-repository paths as current
  evidence.
- Do not add a status or role without updating the role/status contract, schema,
  API docs, UI status map, and tests together.
- Do not run destructive database commands against the application database.
