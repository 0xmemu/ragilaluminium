# Production VPS — Environment Contract & Agent Handoff

Status: **required before production provisioning**
Applies to: Laravel app, PHP-FPM/Nginx, queue workers, MySQL, Redis, Cloudflare
Tunnel, Cloudflare R2, WhatsApp, and optional J&T Cargo.

This document is the handoff contract for an agent that will prepare a new
production VPS. It answers two questions before the agent changes the server:

1. Which values must the owner provide securely?
2. Which values can the agent generate or derive without guessing?

An environment file alone is not production readiness. The agent must also
provision the services, permissions, DNS/Tunnel, database, queue worker,
backups, and smoke tests listed below.

## Agent rule: request the packet before provisioning

The agent must request the following packet in a secret manager or a protected
file transfer. Do not ask the owner to paste secrets into chat, an issue, a
screenshot, terminal output, Git, or the browser.

The agent must stop with a clear missing-value report when a required value is
absent. It must not silently fall back to SQLite, `local` media, `sync` queue,
`APP_DEBUG=true`, Shopee source URLs, preview credentials, or a test provider.

Before accepting the packet, confirm:

- target is `production`, not preview/staging;
- production domain and `APP_URL` are approved;
- production R2 bucket is separate from preview (`ra-media` is the current
  preview bucket and must not be assumed to be production);
- release commit/build has been approved;
- database backup, restore owner, rollback authority, and maintenance window
  are known;
- each credential has an owner, scope, rotation date, and revocation path.

Never copy credentials from the current preview environment into production.
Every production provider credential must be newly scoped or explicitly
rotated.

## Required production application environment

Create a root-owned, mode `0600` file outside the repository, for example:

```text
/etc/ragilaluminium/app.env
```

The PHP-FPM application and every Laravel queue worker must receive the same
values. Laravel normally reads `.env` from the application root, so the agent
must either symlink the protected file to the release's `.env` or explicitly
inject the same values into the PHP-FPM pool and worker service. Do not assume
that variables available to a systemd unit are automatically visible to
PHP-FPM. `cloudflared` receives only its own tunnel token in a separate service
environment; Cloudflare provisioning tokens do not belong in `app.env`.

### Core Laravel

```env
APP_NAME="Ragil Aluminium"
APP_ENV=production
APP_KEY=<generate-new-with-php-artisan-key-generate-show>
APP_DEBUG=false
APP_TIMEZONE=Asia/Jakarta
APP_URL=https://<approved-store-domain>
FORCE_HTTPS=true
TRUSTED_PROXIES=127.0.0.1,::1
APP_LOCALE=id
APP_FALLBACK_LOCALE=id

LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=warning

BCRYPT_ROUNDS=12
SESSION_DRIVER=redis
SESSION_CONNECTION=default
SESSION_LIFETIME=120
SESSION_ENCRYPT=true
SESSION_SECURE_COOKIE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax
SESSION_DOMAIN=<store-domain-or-empty>
```

The agent may generate `APP_KEY` locally on the target VPS with
`php artisan key:generate --show`, then store it only in the protected secret
file. Do not regenerate it during a routine deploy: that invalidates encrypted
cookies and data.

`TRUSTED_PROXIES` must list only the local/private IPs or CIDRs that can reach
the origin as reverse proxies. Keep loopback for a same-host Cloudflare Tunnel;
add a private CIDR only when the proxy is on a separate private host. Wildcards
are rejected during production boot.

Minimum runtime checks before boot:

```bash
php -v                 # PHP >= 8.2
php -m | grep -E 'gd|pdo_mysql|redis|mbstring|curl|openssl|fileinfo|zip|xml'
```

`ext-gd` is required by Composer and media derivatives. `pdo_mysql` is
required for production, `redis` is required for the recommended queue/cache/
session topology, and the remaining extensions are required by Laravel,
uploads, Excel, HTTP, or encryption paths.

### MySQL production database

```env
DB_CONNECTION=mysql
DB_HOST=<private-mysql-host-or-127.0.0.1>
DB_PORT=3306
DB_DATABASE=<production-database>
DB_USERNAME=<least-privileged-app-user>
DB_PASSWORD=<production-database-password>
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci
# Set only when MySQL TLS is provisioned and the CA exists on the VPS:
# MYSQL_ATTR_SSL_CA=/etc/ssl/certs/<mysql-ca>.pem
```

Required owner inputs: host/network policy, database name, app username,
password, backup destination, retention, and restore owner. The database user
must not be root and MySQL/3306 must not be public.

### Redis, cache, sessions, and queues

```env
REDIS_CLIENT=phpredis
REDIS_HOST=<private-redis-host-or-127.0.0.1>
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password-or-empty-if-loopback-protected>
REDIS_DB=0
REDIS_CACHE_DB=1
REDIS_QUEUE_CONNECTION=default
REDIS_QUEUE=default
REDIS_QUEUE_RETRY_AFTER=1860

CACHE_STORE=redis
CACHE_PREFIX=ragil_production_
QUEUE_CONNECTION=redis
QUEUE_FAILED_DRIVER=database-uuids
OPS_ALERT_LOG_CHANNEL=slack
QUEUE_MONITOR_ENABLED=true
QUEUE_MONITOR_CONNECTION=redis
QUEUE_MONITOR_QUEUES=default,imports,media
QUEUE_MONITOR_MAX_JOBS=100
QUEUE_FAILED_RETENTION_HOURS=168
```

Required operational target:

```bash
php artisan queue:work redis --queue=imports,media,default \
  --sleep=1 --tries=3 --timeout=1800 --max-time=3600
```

`REDIS_QUEUE_RETRY_AFTER=1860` must stay above the import worker
`--timeout=1800`; lowering it can execute one import on two workers.

Run this under Supervisor or systemd, not an interactive SSH session. The
worker service must load `/etc/ragilaluminium/app.env`, use the production app
directory, and restart gracefully after deploys.

The scheduler must also run under supervision so `queue:monitor` executes every
minute and failed-job retention is enforced. Provision and test
`LOG_SLACK_WEBHOOK_URL` before selecting the `slack` alert channel; otherwise
point `OPS_ALERT_LOG_CHANNEL` at the approved centralized structured-log
channel. Follow [Queue Operations Runbook](runbooks/queue-operations.md) for
triage and replay safety.

### Cloudflare R2 media

Use a production-only bucket and preferably a custom browser domain such as
`https://media.ragilaluminium.com`. Do not use the S3 API endpoint as the
browser URL.

```env
MEDIA_DISK=s3
MEDIA_PUBLIC_URL=https://<approved-media-domain>
MEDIA_ALLOW_SOURCE_FALLBACK=false
MEDIA_KEEP_ORIGINAL=false
MEDIA_R2_HOST=

AWS_ACCESS_KEY_ID=<R2-bucket-scoped-access-key>
AWS_SECRET_ACCESS_KEY=<R2-bucket-scoped-secret>
AWS_DEFAULT_REGION=auto
AWS_BUCKET=<production-r2-bucket>
AWS_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
AWS_URL=https://<approved-media-domain>
AWS_USE_PATH_STYLE_ENDPOINT=true
```

The R2 credential must be an R2 S3-compatible credential scoped to the
production bucket with only the required object read/write permissions. A
Cloudflare account API token is not an R2 application credential. Configure
bucket CORS for the approved storefront origin with `GET`/`HEAD` as needed;
browser uploads are not part of this application contract.

Required owner inputs:

- production bucket name and whether it is isolated from preview;
- R2 access key and secret, created for that bucket;
- Cloudflare account ID and S3 endpoint;
- approved public/custom media domain;
- public access, CORS, cache, lifecycle, and restore policy.

After the values are loaded, the agent must run:

```bash
php artisan media:disk-check
```

The command must pass PUT, GET, public URL, and DELETE verification. The agent
must also upload a non-production sample derivative, open it from an external
network, and remove only that sample object.

### Media ingestion limits

```env
MEDIA_ALLOWED_HOSTS=cf.shopee.co.id,down-id.img.susercontent.com,cvws.img.susercontent.com,deo.shopeemobile.com
MEDIA_MAX_BYTES=10485760
MEDIA_MAX_VIDEO_BYTES=52428800
MEDIA_DOWNLOAD_TIMEOUT=60
MEDIA_DERIV_THUMB=400
MEDIA_DERIV_CARD=800
MEDIA_DERIV_PDP=1400
MEDIA_WEBP_QUALITY=82
MEDIA_PLACEHOLDER=images/home/product-flash.png
```

Do not enable `MEDIA_ALLOW_SOURCE_FALLBACK` in production. The storefront must
show the configured placeholder or a failed-media state, never hotlink a
Shopee URL as an accidental availability workaround.

## Cloudflare credentials: three different things

Do not collapse these into one “Cloudflare API key”. They have different trust
boundaries:

| Credential | Used by | Required? | Rule |
|---|---|---:|---|
| R2 access key + secret | Laravel media disk | Yes for R2 | R2 token, bucket-scoped, object read/write only |
| Tunnel token | `cloudflared` service | Yes when Tunnel is used | Runtime connector token for the named tunnel only |
| Cloudflare API token | Agent/DNS/Tunnel provisioning | Only if automation is requested | Separate, least-privileged, never loaded by PHP |

Provisioning-only values may be supplied in a separate protected file:

```env
CF_ACCOUNT_ID=<cloudflare-account-id>
CF_ZONE_ID=<zone-id-if-dns-automation-is-approved>
CF_API_TOKEN=<short-lived-least-privileged-provisioning-token>
CF_TUNNEL_ID=<tunnel-id>
```

Runtime Tunnel configuration uses:

```env
CLOUDFLARE_TUNNEL_TOKEN=<tunnel-token-for-this-environment>
```

If the agent is not authorized to provision Cloudflare, the owner must create
the tunnel, hostname route, and token in the dashboard and provide only the
runtime token through the protected channel. The agent must not ask for a
global account token when a tunnel token and bucket-scoped R2 credential are
enough.

## Cloudflare Tunnel decision for the current phase

Cloudflare Tunnel is effective now for preview/staging and controlled admin
access. It keeps the origin port private, avoids exposing `8200`, provides a
stable HTTPS hostname, and works well while the VPS is still a development or
preview workstation.

Recommended current topology:

```text
Browser / HP
    -> Cloudflare edge + optional Access/WAF
    -> cloudflared on VPS
    -> 127.0.0.1:<Nginx-port>
    -> Nginx -> PHP-FPM -> Laravel
```

Rules for the current Tunnel:

- bind Nginx/PHP-FPM to loopback; do not expose Laravel's `8200` directly;
- use a dedicated preview hostname, never the customer production hostname;
- keep Laravel admin authentication enabled; Cloudflare Access is an extra
  perimeter, not a replacement for app authorization;
- allow webhook routes and Meta verification explicitly when they are routed
  through the Tunnel;
- monitor `cloudflared`, origin health, request size, timeout, and 5xx rate;
- do not put R2 media behind the app Tunnel; deliver media through the approved
  R2 public/custom domain.

For customer-facing production, Tunnel is still viable but must not be treated
as a single-process shortcut. Require at least two connectors (or a documented
availability exception), a supervised service, Cloudflare-only origin access,
external synthetic checks, webhook tests, WAF/rate rules, and a rollback path.
Direct Cloudflare-proxied DNS to a hardened Nginx origin is simpler when the
team already has TLS, firewall, and origin-certificate operations. The final
production choice is deferred until the production VPS, DNS, TLS, monitoring,
and recovery owner are approved.

## WhatsApp / Meta variables

These are required only when `WHATSAPP_PROVIDER=meta` is enabled for real
traffic. They do not replace provider-side template approval and webhook setup.

```env
WHATSAPP_ALLOW_UNSIGNED_WEBHOOKS=false
WHATSAPP_PROVIDER=meta
WHATSAPP_COMPARE_PROVIDER=
WHATSAPP_COMPARE_ALLOWLIST=
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v25.0
WHATSAPP_API_TOKEN=<Meta-system-user-or-approved-production-token>
WHATSAPP_BUSINESS_NUMBER_ID=<Meta-phone-number-id>
WHATSAPP_WABA_ID=<WhatsApp-business-account-id>
WHATSAPP_VERIFY_TOKEN=<webhook-verification-secret>
WHATSAPP_APP_SECRET=<Meta-app-secret>
WHATSAPP_BUSINESS_PHONE=<E164-number>
WHATSAPP_LANGUAGE=id
WHATSAPP_TIMEOUT=15
STOREFRONT_CONSULTATION_TEMPLATE_KEY=consultation_request
```

Owner must provide approved template names/languages, Meta webhook callback,
verification secret, app secret, token expiry/rotation owner, and a test
recipient. Production boot fails when unsigned webhooks are enabled or an active provider lacks its signing secret.
Disable compare mode before customer traffic unless explicitly
approved.

## WAHA variables (conditional)

Ask for these only if WAHA is the approved primary or fallback provider:

```env
WHATSAPP_WAHA_BASE_URL=http://127.0.0.1:<waha-port>
WHATSAPP_WAHA_API_KEY=<waha-api-key>
WHATSAPP_WAHA_SESSION=ragil
WHATSAPP_WAHA_WEBHOOK_SECRET=<waha-webhook-secret>
WHATSAPP_WAHA_TIMEOUT=15
```

WAHA webhook secrets must use `X-Webhook-Secret` or `X-WAHA-Secret`; query-string secrets are rejected.

WAHA must bind to loopback, use a pinned image/session volume, and never be
exposed directly to the Internet. If Meta is primary and WAHA is not approved,
leave the provider disabled instead of requesting unused secrets.

## J&T Cargo variables (conditional)

Keep J&T disabled until production account verification and sandbox
joint-debugging are signed off:

```env
JNT_ENABLED=false
JNT_ENV=sandbox
JNT_API_ACCOUNT=<J&T-api-account>
JNT_PRIVATE_KEY=<J&T-private-key>
JNT_CUSTOMER_CODE=<J&T-customer-code>
JNT_CUSTOMER_PASSWORD=<J&T-customer-password>
JNT_WEBHOOK_PRIVATE_KEY=<webhook-key-or-empty-to-reuse-private-key>
JNT_SENDER_NAME="Ragil Aluminium"
JNT_SENDER_COMPANY="Ragil Aluminium"
JNT_SENDER_PHONE=<sender-phone>
JNT_SENDER_MOBILE=<sender-mobile>
JNT_SENDER_PROV=<sender-province>
JNT_SENDER_CITY=<sender-city>
JNT_SENDER_AREA=<sender-area>
JNT_SENDER_ADDRESS=<sender-address>
JNT_SENDER_POSTCODE=<sender-postcode>
```

When enabled, set `JNT_ENV=production` only after production account approval,
then confirm the production endpoint and every sender/service setting in
`config/jnt.php`. Never enable `JNT_ENABLED=true` merely because the variables
exist.

## Mail, storefront business settings, and social links

Choose one production mail provider and test it; `MAIL_MAILER=log` is not a
production delivery configuration:

```env
MAIL_MAILER=smtp
MAIL_HOST=<smtp-host>
MAIL_PORT=587
MAIL_USERNAME=<smtp-user>
MAIL_PASSWORD=<smtp-password>
MAIL_SCHEME=tls
MAIL_FROM_ADDRESS=<verified-sender-email>
MAIL_FROM_NAME="Ragil Aluminium"
```

The business owner must also approve non-secret values used by the storefront:
`BRAND_PHONE`, `BRAND_HOURS`, `BRAND_MAPS_URL`, `BANK_NAME`,
`BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`, and the `SOCIAL_*` links. These are
not infrastructure secrets but missing values can make checkout/support copy
misleading.

## Cloudflare Tunnel service example

Production should use Nginx/PHP-FPM, not `php artisan serve`. Keep the origin
private and route the Tunnel to the local Nginx listener:

```ini
# /etc/systemd/system/cloudflared-ragil.service
[Unit]
Description=Cloudflare Tunnel for Ragil Aluminium
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=cloudflared
EnvironmentFile=/etc/ragilaluminium/cloudflare-tunnel.env
ExecStart=/usr/bin/cloudflared tunnel run --token ${CLOUDFLARE_TUNNEL_TOKEN}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

The exact systemd interpolation and Tunnel ingress method must be validated
against the installed `cloudflared` version. The agent must not paste the token
into the unit file or repository. If using a named-tunnel credentials file
instead of a token, protect that file mode `0600` and use the dashboard-created
hostname route.

## Provisioning and verification order

The agent must follow this order and capture evidence without printing secrets:

1. Provision VPS, non-root deploy user, SSH keys, firewall, automatic security
   updates, Nginx, PHP-FPM, required PHP extensions, Composer, Node build
   toolchain, MySQL/Redis, and supervised workers.
2. Install the approved release into a versioned application directory; set
   ownership so the PHP-FPM user can write only `storage/` and `bootstrap/cache/`.
3. Install `/etc/ragilaluminium/app.env` and the separate Tunnel environment;
   verify file ownership and mode.
4. Run `composer install --no-dev --optimize-autoloader` and `npm ci && npm run
   build`; remove `public/hot` before production traffic.
5. Run `php artisan config:clear`, inspect the resolved non-secret settings,
   then `php artisan config:cache`. Never cache config before the correct env is
   loaded.
6. Verify MySQL connectivity and run forward-only `php artisan migrate --force`
   only after backup/clone approval. Never run `migrate:fresh`, `migrate:refresh`,
   `db:wipe`, truncate, or destructive seeders.
7. Run `php artisan media:disk-check`, Redis health, queue worker health, and
   external media URL checks.
8. Start Nginx/PHP-FPM, `cloudflared`, scheduler if used, and queue workers;
   verify restart behavior.
9. Run external smoke checks for `/up`, homepage, catalog, product media,
   admin login, checkout validation, order creation in the approved test mode,
   Meta verification/webhook, and J&T only if enabled.
10. Record release SHA, environment name, migration output, smoke results,
    backup evidence, and unresolved `[~]`/`[ ]` checklist items. Production
    traffic stays blocked while any `[!]` gate remains open.

## Minimum handoff response the agent must request

```text
TARGET_ENV=production
APP_URL=<approved HTTPS store URL>
MEDIA_PUBLIC_URL=<approved HTTPS media URL>
PRODUCTION_R2_BUCKET=<separate bucket name>
PRODUCTION_R2_CREDENTIAL=<secure attachment/reference>
MYSQL_CREDENTIAL=<secure attachment/reference>
REDIS_CREDENTIAL=<secure attachment/reference>
TUNNEL_MODE=cloudflare-tunnel|direct-cloudflare-proxy
TUNNEL_CREDENTIAL=<secure attachment/reference if tunnel>
WHATSAPP_MODE=disabled|meta|waha
WHATSAPP_CREDENTIAL=<secure attachment/reference if enabled>
JNT_MODE=disabled|sandbox|production
JNT_CREDENTIAL=<secure attachment/reference if enabled>
MAIL_MODE=log|smtp|resend
MAIL_CREDENTIAL=<secure attachment/reference if delivery enabled>
RELEASE_SHA=<approved commit>
BACKUP_AND_ROLLBACK_OWNER=<name or team>
```

The agent returns a masked completeness report, not the values themselves:

```text
CORE_ENV: PASS|MISSING
MYSQL: PASS|MISSING
REDIS/QUEUE: PASS|MISSING
R2_API_AND_PUBLIC_URL: PASS|MISSING
CLOUDFLARE_TUNNEL: PASS|MISSING|NOT_USED
WHATSAPP: PASS|MISSING|DISABLED
JNT: PASS|MISSING|DISABLED
MAIL: PASS|MISSING|NOT_USED
BACKUP/RESTORE_EVIDENCE: PASS|MISSING
PRODUCTION_GO: ALLOWED|BLOCKED
```

Related release gates: [Full-stack production readiness plan](production-readiness-plan.md),
[Full-Stack Production Checklist](FULL-STACK-PRODUCTION-CHECKLIST.md), [Media storage R2](media-storage-r2.md),
and [Cloudflare Tunnel ADR](decisions/ADR-003-cloudflare-tunnel-ingress.md).
