# Ragil Aluminium – Documentation Index

Inertia + React storefront and admin. Visual direction and UI skills live under `frontend/`;
backend contracts stay in `docs/`.

## Start here
1. [`PRODUCT-HANDOFF.md`](PRODUCT-HANDOFF.md) — consolidated product/backend handoff + functional page inventory.
2. [`../START-HERE.md`](../START-HERE.md) — local setup and quality scripts.
3. [`../frontend/README.md`](../frontend/README.md) — brand, visual, UX, and UI skill governance (**Precision Domestic**).
4. [`ORCHESTRATION.md`](ORCHESTRATION.md) — agent operating contract, SoT, and tracks.
5. [`../AGENTS.md`](../AGENTS.md) — phases + mandatory report format.
6. [`MEMORY.md`](MEMORY.md) — cross-session milestone log.
7. [System Architecture](architecture/system-architecture-ragil-aluminium.md) — modules, data flow, integrations.
8. [Full-Stack Production Checklist](FULL-STACK-PRODUCTION-CHECKLIST.md) — release gates for frontend, backend, infrastructure, security, observability, and recovery.
9. [Agent Architect & Production Orchestrator Contract](AGENT-ARCHITECT-ORCHESTRATOR.md) — planning, gap analysis, ADR, CI/CD, and release governance.
10. [Agent efficiency and compound workflow ADR](decisions/ADR-002-agent-efficiency-and-compound-workflow.md) — Caveman compression and Compound Engineering process rules.
11. [Production VPS environment contract](production-vps-env-contract.md) — agent request packet, secret boundaries, R2, and Cloudflare Tunnel setup.
12. [Full-stack production readiness plan](production-readiness-plan.md) — target architecture, workstreams, evidence, human runbook, and go/no-go.

## Contracts (canonical — do not invent beyond these)
- [Database Schema](database-schema-ragil-aluminium.md)
- [API & Routes](api-and-routes-ragil-aluminium.md)

## Behaviour contracts (functional, not visual)
- [Public store & checkout](logic/stage-10-public-store-ui-and-checkout-contract.md)
- [Admin CMS & performance](logic/stage-9a-admin-cms-and-performance-ui-contract.md)
- [Admin operational UI](logic/stage-9b-admin-operational-ui-contract.md)
- [Public store flows](logic/ui-public-store-flows-ragil-aluminium.md)
- [Admin flows](logic/ui-admin-flows-ragil-aluminium.md)

## Information architecture (URLs / labels / status)
- [Sitemap index](sitemap/README.md), [Public sitemap](sitemap/public-sitemap.md), [Admin sitemap](sitemap/admin-sitemap.md)

## Domain workflows
- `skills/stage-1-foundation.md` … `skills/stage-8-whatsapp-business-integration.md`

## Other
- [JNT Cargo integration](jnt-cargo-integration.md)
- [Media storage (R2/local)](media-storage-r2.md)
- [Current storefront audit TODO](STOREFRONT-AUDIT-TODO.md)
- [Current backend audit](backend-audit-current.md)
- [Recommended skills and contracts](RECOMMENDED-SKILLS-AND-CONTRACTS.md)
- [Architecture decisions](decisions/ADR-001-agent-architect-production-orchestrator.md), [agent efficiency workflow](decisions/ADR-002-agent-efficiency-and-compound-workflow.md)
- [Cloudflare Tunnel ingress decision](decisions/ADR-003-cloudflare-tunnel-ingress.md)

> Old visual-design docs (`DESIGN.md`, wireframes, Next.js archive) were removed. Active replacement:
> `frontend/`. Marketplace skills under `.agents/skills/` are technique-only.
