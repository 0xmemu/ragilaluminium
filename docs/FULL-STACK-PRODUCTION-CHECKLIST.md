# Ragil Aluminium — Full-Stack Production Checklist

Status: **NOT PRODUCTION-READY**  
Audit baseline: 2026-08-06  
Scope: Laravel 11 + Inertia React storefront/admin, MySQL production target,
Cloudflare/R2 media, WhatsApp, BAILEYS, J&T Cargo, and VPS operations.

This is the release gate for Ragil Aluminium. A dev preview being reachable is
not evidence that the transaction system is safe, recoverable, observable, or
ready to receive real orders.

## How to use this checklist

- `[x]` Verified in the repository or by a repeatable test.
- `[~]` Exists partially or is suitable for preview but not yet a production gate.
- `[ ]` Required work or evidence is missing.
- `[!]` Blocker: production cutover must not proceed while open.
- Every checked item needs evidence: command output, dashboard screenshot, CI run,
  backup restore log, or an incident drill record.
- Owner must be named in the release ticket. A checkbox without evidence is not
  complete.

## Current posture and non-negotiable boundaries

- `[~]` `209.23.10.62` is treated as the development/live-preview VPS, not the
  production cutover target.
- `[~]` The application is a modular monolith with Inertia React UI. The active
  contracts are [Product Handoff](PRODUCT-HANDOFF.md), [schema](database-schema-ragil-aluminium.md),
  [API/routes](api-and-routes-ragil-aluminium.md), and the role/status contract.
- `[~]` The active preview uses isolated SQLite in E2E and may use local media;
  production must use MySQL, a shared queue/cache strategy, and R2/object storage.
- `[!]` No production migration is allowed until product sign-off, rollback,
  backup, and recovery evidence exist. Never use `migrate:fresh`, `db:wipe`,
  truncate-massal, or destructive seeders against the application database.
- `[!]` Any token, private key, API secret, tunnel token, R2 key, J&T credential,
  or WhatsApp credential pasted into chat, logs, screenshots, or a repository
  must be rotated before production. Do not copy those values into this document.
- `[ ]` Record the production domain, VPS/provider, deployment owner, on-call
  owner, RPO, RTO, maintenance window, and rollback authority in the release ticket.

## 1. Frontend and user-facing runtime

### Build and asset integrity

- `[x]` `npm run typecheck` passes.
- `[x]` `npm run lint -- --max-warnings=0` passes with zero React warnings.
- `[x]` `npm run test` passes.
- `[x]` `npm run build` produces a Vite manifest and production assets.
- `[x]` Playwright covers 360, 768, 1024, and 1440px preview paths; latest run:
  25 passed and 3 desktop-only performance tests skipped.
- `[ ]` Add the four-viewport E2E suite to required CI status checks; local success
  is not sufficient for merge or release.
- `[ ]` Pin and review Node, npm, PHP, Composer, Vite, Playwright, and browser
  versions used by CI and deployment. Do not let a floating runtime silently
  change the production bundle.
- `[ ]` Generate a release manifest containing git SHA, build timestamp, Node/PHP
  versions, migration batch, and asset manifest checksum.
- `[ ]` Verify the production web server serves only the current `public/build`
  assets and does not retain stale `public/hot` or an old manifest.

### UX, accessibility, and failure states

- `[x]` UI consistency contract defines typography, colors, grid, icon family,
  page families, and four-viewport QA in [UI consistency contract](../frontend/docs/UI-CONSISTENCY-CONTRACT.md).
- `[x]` Public and admin routes have branded error rendering for 403/404/500/503.
- `[ ]` Run accessibility checks against the production-like build, including
  keyboard navigation, focus visibility, form errors, reduced motion, and screen
  reader names for every checkout/admin mutation.
- `[ ]` Verify error pages do not expose stack traces, SQL, environment values,
  customer PII, tokens, or internal hostnames when `APP_DEBUG=false`.
- `[ ]` Verify all customer-visible copy, prices, discounts, shipping states,
  stock, reviews, and installation media are backed by real data. No demo seed
  content may be exposed on the production hostname.
- `[ ]` Test slow network, failed asset, failed API, empty catalog, out-of-stock,
  expired promotion, failed payment recording, and unavailable shipping provider.

## 2. APIs and backend logic

### Contract and correctness

- `[x]` Route and API surface is documented in [API/routes contract](api-and-routes-ragil-aluminium.md).
- `[x]` Checkout feature tests cover order, item, payment, wilayah, COD, voucher,
  and shipping subsidy behavior.
- `[x]` Order creation revalidates catalog data and writes transactional snapshots;
  status values are covered by the role/status contract.
- `[x]` Import, media, WhatsApp webhook, J&T webhook, payment, and order privacy
  tests exist in `tests/Feature`.
- `[ ]` Run a production-like smoke suite against the deployed release: home,
  catalog, PDP, cart, checkout validation, order placement, confirmation,
  order lookup, admin login, admin order update, media upload, queue job, and
  webhook signature rejection.
- `[ ]` Confirm every public JSON endpoint returns the documented content type,
  status code, error shape, pagination shape, and cache headers.
- `[~]` Checkout now uses a session-scoped UUID plus unique database constraint;
  repeated placement returns the same order and stock is decremented once. Other
  write endpoints still require a complete duplicate/replay inventory.
- `[~]` J&T uses bounded timeout/retry policy and allowlist logs with hashed
  identifiers; provider payload/message/credentials are excluded. Remaining external
  clients and production failure drills still require verification.
- `[~]` Catalog imports now have explicit timeout, unique dispatch, overlap lock,
  failure recording, and database/Redis `retry_after=1860`; production multi-worker
  and failed-job replay evidence is still required.

### Database and transaction safety

- `[ ]` Provision production MySQL with the supported version, UTF-8/UTC policy,
  strict SQL mode, TLS connection where available, and a least-privileged app user.
- `[ ]` Run migrations forward-only on a disposable production clone first;
  capture duration, locks, row counts, and rollback/forward recovery notes.
- `[ ]` Validate foreign keys, indexes, uniqueness, enum/status compatibility,
  transaction isolation, deadlock retry behavior, and order number collision handling.
- `[ ]` Confirm no migration, seeder, debug command, or deploy hook can wipe the
  application database. Add a CI guard that rejects destructive commands in deploy scripts.
- `[ ]` Define retention and deletion rules for orders, payments, customer data,
  WhatsApp messages, event logs, import rows, and media metadata.
- `[ ]` Test restore of a recent database backup into a separate instance and run
  application smoke checks without modifying the source database.
- `[ ]` Confirm database credentials are injected at deploy time, never committed,
  printed by diagnostics, or included in exception context.

### API security and abuse controls

- `[x]` Admin middleware requires an active authenticated canonical `admin` user.
- `[x]` Webhook routes are CSRF-exempt only because they use provider verification
  and signature paths; this must be tested in production configuration.
- `[x]` Rate limiting exists on API/webhook paths and login-related flows.
- `[ ]` Inventory every route with `php artisan route:list --columns=method,uri,name,middleware`
  and verify auth, throttle, CSRF, signature, and content-type requirements per route.
- `[ ]` Add/verify limits for login, order lookup, cart mutation, checkout, uploads,
  imports, admin exports, media downloads, and webhook replay.
- `[ ]` Verify request size, upload MIME/magic bytes, URL host allowlist, SSRF
  protection, query length, pagination bounds, and CSV/export limits.
- `[ ]` Verify CORS is deny-by-default and only explicitly allows required origins;
  do not expose admin or webhook endpoints to arbitrary browser origins.
- `[ ]` Run dependency vulnerability checks for Composer and npm and document
  accepted exceptions with expiry dates.

## 3. Database, storage, and data lifecycle

### Primary database

- `[x]` Production `DB_CONNECTION` is MySQL with a dedicated database and user;
  preview SQLite values are not reused. PITR binlog arsip R2 hourly (verified 2026-08-11).
- `[~]` Database backups are automated (daily 03:17 + binlog hourly), stored
  outside the VPS (R2 `ra-backup`, lifecycle 30 days), NOT encrypted — user
  decision 2026-08-11 (backup key removed, keyfile deleted). App account holds
  no backup credentials (CF token + R2 backup keys removed from `.env`).
- `[~]` Backup monitoring: failure/stale detection writes alert files
  `/root/backups/ALERT-stale-or-restore` + `/root/backups/ALERT-r2-upload`;
  no external notification channel (per project docs).
- `[x]` Restore drill weekly (Mon 04:30): full restore to `ragil_restore_test`
  + CHECK TABLE + rowcount compare — PASS 2026-08-11 (products 50, variants 612,
  product_media 234, orders 1). RPO ≤1h (binlog hourly), RTO depends on dump size.

### Object storage and media

- `[x]` Laravel has a `media` disk abstraction and R2 guidance in [media storage docs](media-storage-r2.md).
- `[x]` R2 bucket `ra-media` live on VPS, custom domain `media.333labs.tech`
  ACTIVE (SSL + DNS, curl 200 real object), `media:disk-check` PASS 2026-08-11.
  `AWS_URL=https://media.333labs.tech`. CORS: not required (server-side upload,
  `<img>` reads) — CF CORS API rejected configs with 10040; noted as non-gate.
- `[~]` Production uses dedicated bucket `ra-media` (decision 2026-08-11) but it
  is shared with dev imports (702 objects pre-existing); preview env uses its own
  disk, so test imports do not touch the live catalog.
- `[x]` `MEDIA_DISK=s3` and `MEDIA_ALLOW_SOURCE_FALLBACK=false` set in
  production `.env` (verified 2026-08-11).
- `[x]` Public browser URL for reads (`media.333labs.tech`), scoped S3 creds
  (AWS_*) in app runtime; CF account API token and R2 backup keys REMOVED from
  `.env` — app cannot delete backup objects (verified 2026-08-11).
- `[x]` Bucket lifecycle verified: `ra-backup` expires mysql/ + binlogs/ after
  30 days (PUT 200 2026-08-11); CORS GET/HEAD only — not required for current
  server-side architecture.
- `[ ]` Run upload, derivative generation, read, cache purge/revalidation, orphan
  detection, and restore tests using non-production media before cutover.
- `[x]` Stale r2.dev hostnames removed: nginx `/media-cdn` proxy + `AWS_URL`
  point to `media.333labs.tech` (2026-08-11, curl 200 both).
- `[x]` Media metadata backed up daily (product_media + media tables inside the
  encrypted SQL dump); recovery path = restore DB (encrypted) + objects already
  in R2 `ra-media`.

### Sessions, cache, and queue state

- `[~]` Sessions are database-backed by decision (cart 5 days,
  `SESSION_LIFETIME=7200`); cache/queue use Redis (volatile — acceptable while
  sessions live in DB). Load-tested high-traffic posture still a release gate.
- `[ ]` Choose and document production Redis or managed equivalent for cache,
  queue coordination, rate limits, and sessions where operationally justified.
- `[ ]` If database drivers remain, provision indexes, retention cleanup, worker
  capacity, and lock/deadlock monitoring for `jobs`, `failed_jobs`, `sessions`,
  and cache tables.
- `[ ]` Confirm session cookies are Secure, HttpOnly, SameSite appropriate, scoped
  to the production domain, encrypted where required, and invalidated on logout/
  password change.
- `[ ]` Test cache invalidation after catalog import, CMS edit, promotion change,
  media replacement, and deployment. Never cache private admin/customer responses.

## 4. Auth, permissions, and privacy

- `[x]` Admin routes use authentication plus active-user/admin middleware.
- `[x]` Runtime role is canonical `admin`; role/status behavior is documented in
  [ROLE-AND-STATUS-CONTRACT.md](contracts/ROLE-AND-STATUS-CONTRACT.md).
- `[x]` Self-deactivation and last-active-admin protections are feature-tested.
- `[x]` Storefront checkout is guest-based and order lookup requires identity fields.
- `[ ]` Review every admin controller for authorization at the action/resource
  level, not only route-group access. Test IDOR using another product, order,
  payment, media, customer, import, and CMS ID.
- `[ ]` Enforce least privilege for deploy user, PHP-FPM user, queue user, database
  user, R2 credential, WhatsApp credential, J&T credential, and monitoring token.
- `[ ]` Define admin session lifetime, password policy, password reset policy,
  brute-force lockout, audit log retention, and emergency account recovery.
- `[ ]` Confirm customer PII is absent from URLs, analytics payloads, logs,
  exception reports, exports without authorization, and WhatsApp debug logs.
- `[ ]` Publish and verify privacy/legal pages, data retention, customer support
  contact, consent language where required, and a process for deletion/access requests.
- `[ ]` MySQL has no native Postgres-style RLS requirement for this single-store
  deployment; document the equivalent controls: application authorization,
  scoped queries, least-privileged DB user, IDOR tests, and audit logging.

## 5. Hosting, deployment, and cloud/compute

### VPS baseline

- `[ ]` Provision a dedicated production VPS or managed compute target separate
  from preview. Record region, CPU/RAM/disk, supported OS, PHP-FPM, MySQL/Redis,
  Node build environment, and expected traffic envelope.
- `[~]` Existing Nginx/systemd scripts are preview-oriented: port `8200`, local
  paths, and no production TLS/cutover automation.
- `[ ]` Production ingress is HTTPS on the approved domain; port 8200 is not
  publicly exposed unless explicitly required and restricted by firewall.
- `[ ]` Configure firewall with SSH key-only access, restricted source IPs where
  possible, HTTP/HTTPS only, no public database/Redis/BAILEYS ports, and automatic
  security updates.
- `[ ]` Disable password SSH login/root login, install intrusion protection,
  rotate keys, and record break-glass access securely.
- `[ ]` Configure Nginx/PHP-FPM limits, upload size, request timeout, slowlog,
  worker counts, OPcache, gzip/brotli as appropriate, and safe dotfile blocking.
- `[ ]` Run the app under a non-root service account with read-only code and
  write access only to required storage/cache/log paths.
- `[ ]` Set filesystem ownership/permissions and confirm `.env`, backups, logs,
  `.baileys-sessions`, and uploaded files cannot be downloaded via the web root.
- `[ ]` Add disk/inode/RAM/CPU/PHP-FPM/queue/database monitoring and alert thresholds.

### Cloudflare and edge

- `[ ]` Create production DNS, TLS mode, origin policy, tunnel/connector, and
  WAF configuration from a written change record.
- `[ ]` Rotate any tunnel/API/R2 credential exposed outside the secret manager.
- `[ ]` Restrict origin access so the VPS cannot be bypassed where the architecture
  requires Cloudflare-only ingress.
- `[ ]` Configure cache rules only for immutable assets/public media; bypass cache
  for admin, checkout, cart, order lookup, webhooks, and authenticated responses.
- `[ ]` Configure upload/request limits and bot/rate controls without breaking
  checkout, Meta verification, J&T webhook, or BAILEYS webhook traffic.
- `[ ]` Verify forwarded host/proto handling, canonical HTTPS redirects, HSTS
  rollout, origin certificate validity, and no redirect loops.
- `[ ]` Run external checks from a network outside the VPS: DNS, TLS, headers,
  cache behavior, webhook reachability, asset URLs, and `/up`.

### BAILEYS and provider boundaries

- `[x]` BAILEYS compose pins a `noweb` image tag, binds its port to loopback, uses a
  session volume, and supports a webhook path.
- `[ ]` Pin and approve the exact BAILEYS image digest for production; do not use
  `latest` or expose BAILEYS directly to the Internet.
- `[ ]` Store BAILEYS API key/webhook secret in deployment secrets, rotate them,
  restrict sessions volume permissions, and test restart/session recovery.
- `[ ]` Decide whether Meta or BAILEYS is primary; keep compare mode limited to an
  explicit test allowlist and disable it before real customer traffic.

## 6. CI/CD and version control

- `[x]` GitHub Actions currently runs frontend typecheck/lint/Vitest and PHPUnit.
- `[ ]` Make CI required for pull requests and protect `main` from direct pushes.
- `[ ]` Add PHP static analysis, Composer audit, npm audit/dependency scan, secret
  scan, migration check, build artifact check, and route/API contract checks.
- `[ ]` Add isolated E2E job with browser installation and all four viewports;
  never point CI at the application database or a production host.
- `[ ]` Add a release workflow that builds once, records the SHA, creates an
  immutable artifact, runs migrations separately, and supports a documented rollback.
- `[ ]` Define deployment environment separation: preview, staging, and production
  secrets/configuration cannot be substituted by branch name alone.
- `[ ]` Require review for migrations, auth/permissions, payment/shipping,
  webhook, secret/config, and infrastructure changes.
- `[ ]` Do not auto-deploy unreviewed migration or seed changes to production.
- `[ ]` Test deploy interruption at every stage: before migration, during migration,
  after app release, during queue restart, and during cache invalidation.
- `[ ]` Document rollback limits: forward-only database migrations may require a
  corrective migration or restore, not `git revert` alone.

## 7. Security and RLS-equivalent controls

- `[x]` Baseline security headers exist: frame, content type, referrer, permissions,
  and conditional HSTS.
- `[ ]` Add a reviewed Content Security Policy compatible with Inertia/Vite,
  Cloudflare, R2 media, Meta/WhatsApp, and any analytics actually used.
- `[ ]` Run OWASP-style review for XSS, CSRF, SSRF, SQL injection, mass assignment,
  file upload, open redirects, session fixation, IDOR, webhook replay, and log injection.
- `[ ]` Verify secrets are absent from git history, Docker layers, CI logs, browser
  bundles, source maps, screenshots, error reports, and `php artisan about` output.
- `[ ]` Use separate credentials and scopes for preview/staging/production.
- `[ ]` Add secret rotation dates and revoke procedure for every external provider.
- `[ ]` Confirm production debug, verbose logs, exception pages, directory listing,
  source maps, `/storage` exposure, and framework diagnostic routes are safe.
- `[~]` J&T webhook signature validation is constant-time and fail-closed; enabling
  J&T in production without a signing key now fails application boot. Timestamp/replay
  protection, bounded body size, and durable event keys remain open.
- `[ ]` Keep an audit trail for admin login, permission-sensitive actions, order/
  payment/shipping status, imports, media archive, CMS edits, and settings changes.

## 8. Rate limiting, caching, CDN, and scaling

- `[~]` Existing application throttles cover several API/webhook paths, but the
  production policy and edge limits are not yet one documented matrix.
- `[ ]` Publish a rate-limit matrix by route class: login, catalog/search, cart,
  checkout, order lookup, admin, exports, uploads, media, Meta webhook, BAILEYS,
  and J&T webhook. Define limit, key, response, retry-after, and alert behavior.
- `[ ]` Verify trusted proxy/IP handling so Cloudflare does not collapse all users
  into one throttle key and clients cannot spoof their source IP.
- `[ ]` Cache immutable Vite assets and public media with content-hash/long TTL;
  purge or version CMS/catalog responses deliberately.
- `[ ]` Confirm cart/session/order/admin responses are never served from shared CDN cache.
- `[ ]` Define scaling thresholds for PHP-FPM, queue depth, DB connections,
  Redis memory, disk, request latency, error rate, and origin bandwidth.
- `[ ]` For the first production release, explicitly document “single VPS, no load
  balancer” as an accepted limit and the trigger for adding a load balancer.
- `[ ]` Before horizontal scaling, make sessions/cache/queues shared, media fully
  object-backed, workers independently scalable, and migrations single-writer.
- `[ ]` Load-test browse, search, PDP, checkout validation, order placement, admin
  import, and media jobs with production-like data and declared concurrency.

## 9. Error tracking, logs, metrics, and alerting

- `[~]` Laravel has application/J&T log channels and event/activity logs, but no
  verified external error tracker, centralized retention, or on-call alert path.
- `[ ]` Choose an error tracker and configure release/environment tagging, PII
  scrubbing, source map policy, alert ownership, and issue deduplication.
- `[ ]` Centralize or ship Nginx, PHP-FPM, Laravel, queue, MySQL/Redis, BAILEYS,
  Cloudflare, and deployment logs with retention and access control.
- `[ ]` Emit metrics for request rate/latency/errors, checkout conversion,
  payment status, shipping status, queue depth/failures, import failures, media
  download failures, WhatsApp sends, webhook rejects, and disk/DB health.
- `[ ]` Create alerts with actionable thresholds and runbook links; avoid alerting
  on every expected validation error.
- `[ ]` Add synthetic monitoring for `/up`, homepage, catalog, checkout validation,
  admin login, media CDN, WhatsApp/J&T webhook verification, and DNS/TLS expiry.
- `[ ]` Confirm logs never contain access tokens, private keys, full payment data,
  passwords, or unnecessary customer addresses/phone numbers.
- `[ ]` Keep correlation IDs across browser request, Laravel log, queue job,
  provider request, webhook event, order number, and deployment SHA.

## 10. Availability, backup, recovery, and incident response

- `[ ]` Approve initial targets: proposed RPO ≤1h (binlog PITR hourly to R2,
  verified 2026-08-11) and RTO ≤4h for the first production release; tighten them
  when order volume requires it.
- `[ ]` Write runbooks for: deploy, rollback, database restore, R2 restore,
  queue stuck, failed import, WhatsApp outage, J&T outage, Cloudflare outage,
  compromised credential, admin lockout, disk full, and accidental bad CMS edit.
- `[ ]` Test graceful degradation: catalog remains readable if WhatsApp/J&T is
  unavailable; order state is not falsely advanced; queued notification retries.
- `[ ]` Test maintenance mode and health checks without trapping health probes,
  webhook verification, or recovery operators.
- `[ ]` Verify process supervision auto-restarts PHP-FPM, queue workers, Nginx,
  Redis/BAILEYS where applicable, and does not create duplicate workers.
- `[ ]` Verify queue deployment uses `queue:restart`/graceful drain and failed
  jobs are visible, retryable, and not silently discarded.
- `[ ]` Run a game-day recovery drill on a non-production clone and record:
  detection time, decision owner, restore time, data loss, customer impact,
  and follow-up actions.
- `[ ]` Define incident severity, communication channel, customer notification,
  evidence preservation, postmortem owner, and credential revocation procedure.
- `[ ]` Confirm backups and logs are themselves monitored and cannot be deleted by
  a compromised application credential.

## 11. External integration release gates

### WhatsApp / BAILEYS

- `[ ]` Meta production number, permanent system-user token, approved templates,
  payment method, business verification, and webhook URL are verified.
- `[ ]` Send and receive a test order notification with real template mapping,
  delivery status, inbound message logging, and duplicate/retry behavior.
- `[ ]` Confirm BAILEYS is either disabled or explicitly configured for the approved
  compare/backup role; no test allowlist receives accidental customer traffic.

### J&T Cargo

- `[ ]` J&T account, customer code/password, private keys, sender address,
  service/pay type, goods type, webhook signing, and production endpoint are
  verified against [J&T integration docs](jnt-cargo-integration.md).
- `[ ]` Run sandbox joint-debug and one approved production smoke shipment only
  after product/operations sign-off; never enable J&T production on preview.
- `[ ]` Verify cost estimate, shipment/waybill, refresh, webhook, status mapping,
  order cascade, WhatsApp notification, timeout, retry, and provider outage behavior.
- `[ ]` Record who may activate `JNT_ENABLED=true` and who may rotate credentials.

### R2 / Cloudflare

- `[ ]` Production bucket/domain is approved, tested, isolated from preview, and
  covered by object retention and restore procedures.
- `[ ]` Cloudflare DNS, tunnel, WAF, cache, TLS, origin access, and API token
  scopes are reviewed by an owner other than the person who created them.

## 12. Launch sequence and go/no-go

### T-14 to T-7 days

- `[ ]` Product catalog, prices, promotions, CMS copy, legal pages, shipping,
  payment instructions, support contacts, and admin users are signed off.
- `[ ]` Production infrastructure, secrets, database clone, R2 bucket, domain,
  TLS, monitoring, backups, and rollback path are provisioned.
- `[ ]` Staging runs the complete automated suite and production-like smoke flow.

### T-1 day

- `[ ]` Freeze schema/config changes except approved emergency changes.
- `[ ]` Take and verify final source/database/media backups.
- `[ ]` Reconfirm secret rotation, DNS/TLS, WAF, rate limits, queue workers,
  cron/scheduler, webhooks, provider credentials, and on-call contact.
- `[ ]` Prepare a customer-safe maintenance message and rollback decision window.

### Cutover

- `[ ]` Deploy immutable release artifact and verify git SHA/build manifest.
- `[ ]` Run forward-only migrations with captured output; do not wipe/reset data.
- `[ ]` Cache config/routes/views only after environment values are correct.
- `[ ]` Start/restart workers gracefully, verify failed-job handling, then enable
  traffic after health and smoke checks pass.
- `[ ]` Verify `/up`, HTTPS, homepage, catalog, media, checkout validation,
  order placement, admin login, provider webhooks, and monitoring alerts.
- `[ ]` Keep rollback authority and operator access active for the agreed window.

### T+1 hour / T+1 day

- `[ ]` Review error rate, latency, queue depth, DB load, storage, provider
  delivery, orders, payment, shipping, and customer support signals.
- `[ ]` Compare production data against expected counts; investigate every failed
  order, payment, webhook, queue job, and media download.
- `[ ]` Record launch outcome, incidents, follow-up owners, and whether the next
  release gate remains open or is closed.

## Definition of production-ready

Ragil Aluminium is production-ready only when:

1. All `[!]` blockers are closed with evidence.
2. Every `[ ]` item marked “release gate” has an owner, test result, and runbook.
3. Database and media restore drills meet the approved RPO/RTO.
4. CI blocks regressions and includes the four-viewport E2E suite.
5. Monitoring can detect a broken checkout, queue, provider, database, storage,
   TLS, or origin before customers report it.
6. A named operator can deploy, rollback, rotate secrets, restore data, and
   communicate an incident without relying on undocumented personal knowledge.

## Evidence log

| Date | Release/SHA | Environment | Check | Evidence link | Owner | Result |
|---|---|---|---|---|---|---|
| 2026-08-06 | `0591319` | dev preview | lint/typecheck/Vitest/PHPUnit/build/E2E | repository test output | — | PASS |
|  |  | staging | backup restore + full smoke |  |  |  |
|  |  | production | cutover + rollback drill |  |  |  |
