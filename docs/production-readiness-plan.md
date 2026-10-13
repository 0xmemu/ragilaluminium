# Ragil Aluminium — Full-Stack Production Readiness Plan

Status: **not production-ready**  
Purpose: turn the preview application into a deployable, operable, recoverable
production service. This plan is valid for a human operator or an AI agent;
the runtime does not depend on AI.

The release gate remains
[FULL-STACK-PRODUCTION-CHECKLIST.md](FULL-STACK-PRODUCTION-CHECKLIST.md). This
document turns it into an actionable target architecture, workstream list,
evidence requirement, and go/no-go gate.

## Target architecture

```text
Customer
  -> Cloudflare DNS + TLS + WAF + rate rules
  -> Tunnel -> loopback Nginx, or Cloudflare proxy -> firewalled Nginx
  -> PHP-FPM -> Laravel 11 / Inertia React
       |          |             |
       |          |             +-> Meta WhatsApp / optional private BAILEYS
       |          +-> Redis: cache, sessions, queues
       +-> MySQL: system of record
       +-> R2: product/shared media and derivatives

Queue workers: imports, media, default
Private only: MySQL, Redis, BAILEYS, PHP-FPM, deployment/admin ports
Public reads: HTTPS storefront, approved webhooks, R2 media domain
```

Production uses MySQL, Redis, R2, Nginx/PHP-FPM, supervised queue workers,
HTTPS, and an approved Cloudflare ingress. SQLite, `php artisan serve`, local
media, and an interactive SSH queue worker are preview-only.

## Approved initial deployment profile

The current target supplied by the owner is:

| Item | Target | Assessment |
|---|---|---|
| Store domain | `ragilaluminium.com` | Approved target; DNS/TLS/ingress still require evidence |
| VPS CPU | 4 vCPU | Sufficient for low initial traffic and one application node |
| VPS RAM | 4 GB | Minimum viable; requires limits, swap, and no in-place production build |
| VPS disk | 60 GB | Sufficient only when media/backups/log archives stay external |
| Topology | Single VPS | No high availability; document this release limitation |

This profile is acceptable for a first low-traffic release, not a high-
availability or high-volume target. Apply these constraints:

- keep product/shared media in the production R2 bucket; do not use 60 GB as a
  media archive;
- store encrypted database backups and long-retention logs outside the VPS;
- build the frontend in CI/staging and deploy the artifact; do not run a large
  `npm ci`/build alongside customer traffic;
- provision a 2–4 GB swap file, reserve at least 20 GB free disk, rotate logs,
  and alert before disk/inode exhaustion;
- cap PHP-FPM and queue workers so MySQL/Redis retain memory; run imports in a
  controlled queue window rather than unconstrained concurrency;
- prefer Meta WhatsApp as the production provider and keep BAILEYS off unless its
  memory footprint and operational role are explicitly approved;
- if MySQL and Redis share this VPS, record the resource limit and upgrade
  trigger; managed/separate services are the stronger option;
- accept single-node downtime until a second node, shared sessions/queues, and
  a tested failover path exist.

Capacity triggers for the next upgrade: sustained RAM above 75%, swap activity
during normal traffic, disk below 20 GB free, queue backlog during imports,
database latency/error growth, or a requirement for zero/minimal downtime.

## Current baseline and release verdict

| Area | Current evidence | Status | Closure |
|---|---|---:|---|
| Laravel/catalog/admin | Preview pages, feature tests, build pass | `[~]` | Immutable approved release + external smoke |
| Database | Local SQLite preview and forward migrations | `[!]` | MySQL, backup/restore, clone migration, reconciliation |
| R2 | Preview `ra-media` PUT/GET/public GET/DELETE verified | `[~]` | Isolated production bucket/domain, scoped key, CORS/cache/lifecycle |
| Queue | Redis smoke passed; no production worker evidence | `[!]` | Private Redis, supervised workers, retry/failure/restart evidence |
| Sessions/cache | Preview configuration | `[~]` | Production Redis, secure cookies, invalidation tests |
| Cloudflare | Preview Tunnel decision documented | `[~]` | Hostname, WAF, origin lock, external checks, recovery test |
| WhatsApp | Code/webhook tests; provider approval not evidenced | `[!]` if enabled | Meta token/templates/webhook test or explicit disable |
| BAILEYS | Preview service exists | `[~]` | Disable or approve as private pinned fallback |
| J&T Cargo | Disabled/sandbox path | `[~]` | Keep disabled or complete production account sign-off |
| CI/CD | Frontend and PHPUnit checks exist | `[~]` | Required checks, immutable artifact, deploy/rollback |
| Security | Application baseline exists | `[~]` | IDOR/upload/SSRF review, firewall, least privilege, scans |
| Observability | Laravel logs/events exist | `[!]` | External errors, metrics, alerts, synthetic checks |
| Recovery | Runbooks/checklist exist | `[!]` | Encrypted backup, restore and incident drills |

Verdict: **BLOCKED** while any `[!]` remains open. Preview HTTP 200, passing
PHPUnit, or a working Tunnel is not production evidence by itself.

## Workstreams

### P0 — Product and release authority

Owner: product/release owner. Dependency: none.

- Freeze the approved release SHA and sign off catalog, prices, promotions, CMS,
  payment instructions, support contacts, legal pages, and admin users.
- Decide whether WhatsApp and J&T are enabled on day one. Disabled providers
  must fail closed and show a customer-safe fallback.
- Name release authority, rollback authority, backup/restore owner, and support
  escalation contact. Approve initial RPO <=24h and RTO <=4h unless stricter.

Evidence: signed release ticket, approved SHA, owner matrix, maintenance copy,
and go/no-go record.

### P0 — VPS, OS, network, and supervision

Owner: infrastructure operator. Dependency: approved release.

Target: separate production VPS; Ubuntu LTS; PHP >=8.2; Nginx/PHP-FPM;
Composer; Node build toolchain; MySQL; Redis; `cloudflared` if selected; and
PHP extensions `gd`, `pdo_mysql`, `redis`, `mbstring`, `curl`, `openssl`,
`fileinfo`, `zip`, and `xml`.

- Use non-root deploy/PHP-FPM/worker identities with least privilege.
- Enforce SSH key-only access, no root/password login, firewall, and security
  updates. Do not expose 3306, 6379, BAILEYS, PHP-FPM, or unrestricted app ports.
- Use Nginx/PHP-FPM on loopback/private origin; never public `artisan serve`.
- Supervise Nginx, PHP-FPM, queue workers, scheduler, and `cloudflared`.
- Monitor disk/inode, memory, CPU, PHP-FPM, Redis, MySQL, queues, and TLS.

Evidence:

```bash
php -v
php -m
nginx -t
systemctl --failed
ss -lntup
```

### P0 — Domain, Cloudflare, and ingress

Owner: Cloudflare/infrastructure operator. Dependency: VPS and approved domain.

- Choose Tunnel or direct Cloudflare proxy in the release record.
- Tunnel: dedicated hostname, token in protected service env, loopback origin,
  supervision, restart test, and external `/up` check. Use two connectors for
  a real availability requirement or document the single-VPS limitation.
- Direct: Cloudflare DNS proxy, origin TLS, Full (Strict), firewall restrictions,
  and no origin bypass.
- Cache only immutable assets/public media. Bypass cache for admin, cart,
  checkout, order lookup, authenticated responses, and webhooks.
- Test HTTPS redirect, forwarded host/proto, HSTS rollout, upload size,
  timeout, Meta verification, J&T webhook, and BAILEYS callback.

Evidence must include external checks, not only localhost:

```bash
curl -fsS https://<store-domain>/up
curl -fsSI https://<store-domain>/
curl -fsSI https://<media-domain>/<known-test-object>
```

### P0 — Environment and secrets

Owner: release/infrastructure operator. Dependency: domain and provider accounts.

Use [production-vps-env-contract.md](production-vps-env-contract.md). Request
and verify a masked packet for Laravel, MySQL, Redis, R2, Tunnel, Meta, J&T,
mail, and business settings. Keep app env mode `0600`, outside Git, and make
PHP-FPM and every queue worker receive the same values.

- Never copy preview credentials into production.
- Never use a Cloudflare account API token as the Laravel R2 credential.
- Keep Tunnel runtime token separate from PHP env.
- Never print secrets in diagnostics, logs, CI, screenshots, or errors.
- Run `config:cache` only after the final production env is loaded.

Evidence: masked completeness report, permissions, secret scan, and resolved
non-secret config review.

### P0 — MySQL and migration safety

Owner: database/release owner. Dependency: approved release and backup owner.

- Provision MySQL with `utf8mb4`, UTC policy, strict mode, indexes, foreign keys,
  and a least-privileged app user. Database/3306 stays private.
- Take an encrypted backup and restore it to a separate clone before cutover.
- Run migrations on a production-like clone first; capture duration, locks,
  row counts, and compatibility notes.
- On the target use only forward-only `php artisan migrate --force` after
  approval. Never use `migrate:fresh`, `migrate:refresh`, `db:wipe`, `DROP`,
  truncate, or destructive seeders.
- Reconcile product, variant, media, order, payment, shipping, import, and CMS
  counts. Test deadlock/connection behavior and order-number uniqueness.

Evidence: backup hash/location, restore log, clone migration log, target
migration output, row-count report, and corrective migration/rollback plan.

### P0 — R2 media and import pipeline

Owner: media/infrastructure operator. Dependency: production bucket and workers.

- Create a production-only R2 bucket/domain; do not reuse preview `ra-media`.
- Use immutable shared asset keys and WebP derivatives; originals remain off
  unless explicitly required for archival.
- Configure public/custom domain, `GET`/`HEAD` CORS, cache headers, lifecycle,
  ownership, and restore procedure.
- Set `MEDIA_DISK=s3` and `MEDIA_ALLOW_SOURCE_FALLBACK=false`.
- Run `media:disk-check`, external public GET, sample derivative, shared asset
  attachment, video path if enabled, and cleanup.
- Run a small import through `imports` and `media`; verify status, derivatives,
  deduplication, and failed-job replay.

Evidence: bucket/config, scoped credential proof, smoke output, public URL,
sample import report, and queue failure/retry evidence.

### P0 — Redis, queue, sessions, cache, scheduler

Owner: application/infrastructure operator. Dependency: Redis and MySQL.

- Use Redis for cache, sessions, `imports`, `media`, and `default` queues.
- Supervise workers with retry/timeout/max-time appropriate for long imports:

```bash
php artisan queue:work redis --queue=imports,media,default \
  --sleep=1 --tries=3 --timeout=1800 --max-time=3600
```

Keep database and Redis `retry_after=1860` (or higher) so visibility timeout
always exceeds the longest import execution timeout. Catalog import dispatches
must retain `ShouldBeUnique` plus the application overlap lock.

- Verify failed-job visibility/replay, worker restart during media/import work,
  idempotency, session persistence, secure cookies, and cache invalidation after
  import/CMS/media changes.
- Configure scheduler/cron only for commands that exist and are approved.

Evidence: service unit, Redis ping, worker status, queue depth/failure report,
restart test, and successful import/media job.

### P0 — Security, authorization, and privacy

Owner: application/security reviewer. Dependency: production domain and env.

- Test admin authorization and IDOR for products, media, orders, imports, and
  CMS; preserve active-admin and last-admin protections.
- Keep CSRF on browser routes. Webhooks require provider verification,
  signatures/replay protection, bounded bodies, idempotency, and rate limits.
- Review SSRF allowlist, upload MIME/magic bytes, request size, pagination,
  export limits, open redirects, mass assignment, and log injection.
- Use `APP_DEBUG=false`, secure cookies, safe headers/CSP, dotfile blocking,
  no directory listing, and no public `.env`/backup/log/session files.
- Confirm credentials, payment data, and unnecessary customer PII are absent
  from URLs, logs, analytics, browser bundles, and error reports.

Evidence: security review, IDOR report, route/middleware matrix, dependency and
secret scans, header check, and sanitized log sample.

### P1 — External providers

Owner: provider/integration owner. Dependency: provider accounts and approval.

WhatsApp: approve Meta number, WABA, permanent token, templates/languages,
app secret, verification, webhook, and test recipient. Send one approved order
or consultation template and verify one inbound webhook, delivery status,
deduplication, retry, and provider-outage fallback. Disable compare mode and
BAILEYS unless explicitly approved.

J&T: keep `JNT_ENABLED=false` until account, sender address, keys, endpoint, and
sandbox joint-debugging are signed off. If enabled, verify quote/order/track/
webhook/status cascade and outage behavior. Never enable because env exists.

Evidence: provider approvals, sanitized test messages, webhook logs, J&T debug
evidence, and named activation authority.

### P1 — CI/CD and operations

Owner: repository/release owner. Dependency: approved branch and deploy identity.

- Require PHPUnit, TypeScript, ESLint, Vitest, Vite build, relevant Playwright,
  Composer/npm audit, secret scan, migration check, and provider/storage smoke.
- Build an immutable artifact from an approved SHA and record its manifest.
- Separate deploy, migration, worker restart, cache/config, and traffic steps.
- Test interrupted deploy and graceful queue drain. Git revert alone is not a
  database rollback.
- Centralize/retain Nginx, PHP-FPM, Laravel, queue, MySQL, Redis, cloudflared,
  Cloudflare, and deploy logs with PII/token scrubbing.
- Add alerts for `/up`, 5xx/latency, queue failures, import/media failures,
  webhook rejects, disk/RAM/CPU, DB/Redis, R2, DNS/TLS, Tunnel, and backups.
- Automate encrypted MySQL backups outside VPS and test restore; write runbooks
  for DB/R2 restore, queue stuck, provider/Cloudflare outage, compromised key,
  admin lockout, and disk full.

Evidence: required CI run, artifact SHA, deploy/rollback drill, dashboards,
alert delivery, backup/restore drill, RPO/RTO result, and escalation contacts.

## Human deployment runbook

AI is optional. A human operator can follow this sequence:

1. Approve release SHA, owner matrix, RPO/RTO, maintenance window, and provider
   enablement flags.
2. Provision separate production VPS, private MySQL/Redis, SSH/firewall/users,
   filesystem permissions, and process supervision.
3. Create production R2 bucket/domain and Cloudflare ingress. Store credentials
   in protected files; never paste them into Git or chat.
4. Deploy code/build assets; confirm `public/hot` is absent.
5. Verify env, extensions, MySQL, Redis, Nginx/PHP-FPM, and `cloudflared`.
6. Restore/clone-test database, run approved forward migrations, and reconcile
   counts. Never reset the application database.
7. Cache config/routes/views only after env verification. Start workers/scheduler
   and run media/import smoke tests.
8. Run external storefront, admin, checkout, media, webhook, and provider tests.
9. Enable traffic only when all P0 gates pass and release authority signs
   `PRODUCTION_GO=ALLOWED`.
10. Monitor the launch window and record every incident/follow-up.

## Go/no-go

### Go only when all are true

- all `[!]` blockers in the production checklist are closed;
- MySQL backup has a successful independent restore;
- production R2 public URL passes external smoke;
- Redis, workers, failed-job replay, and restart behavior pass;
- HTTPS/Cloudflare ingress, firewall, WAF, webhooks, and origin lock pass;
- admin authorization, checkout/order, media/import, and provider flows pass;
- secrets are scoped/protected/owned and absent from logs/repo;
- monitoring alerts and recovery runbooks have evidence;
- release and rollback owners sign the record.

### Automatic no-go conditions

- SQLite or preview bucket in production;
- `APP_DEBUG=true`, `MEDIA_ALLOW_SOURCE_FALLBACK=true`, or `QUEUE_CONNECTION=sync`;
- public MySQL, Redis, BAILEYS, PHP-FPM, or unrestricted application port;
- no verified database restore or no supervised queue worker;
- missing R2 public domain, webhook verification, provider approval, or secret
  rotation owner;
- test credential, preview domain, or unapproved provider enabled;
- destructive reset required or recovery is undefined if deploy stops halfway.

## Related contracts

- [Production VPS environment contract](production-vps-env-contract.md)
- [Full-Stack Production Checklist](FULL-STACK-PRODUCTION-CHECKLIST.md)
- [Cloudflare Tunnel ADR](decisions/ADR-003-cloudflare-tunnel-ingress.md)
- [Media storage R2](media-storage-r2.md)
- [API and routes](api-and-routes-ragil-aluminium.md)
- [Database schema](database-schema-ragil-aluminium.md)
