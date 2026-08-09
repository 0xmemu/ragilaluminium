# ADR-003: Use Cloudflare Tunnel for Preview Ingress; Harden Before Production

## Status

Accepted for preview/staging; production ingress decision deferred pending
production infrastructure evidence.

## Date

2026-08-07

## Context

Ragil Aluminium currently needs a safe HTTPS path from a phone/browser to a VPS
preview while the application is still being built. The preview service runs
Laravel on a VPS and must not require a public application port. Production will
also need Cloudflare DNS, TLS, WAF, origin access control, webhook reachability,
monitoring, and a recoverable deployment path.

The two realistic ingress choices are:

1. Cloudflare Tunnel from the VPS to a Cloudflare hostname.
2. Cloudflare-proxied DNS to a hardened Nginx origin with TLS and firewall
   controls.

## Decision

Use Cloudflare Tunnel for the current preview/staging phase. The Tunnel routes a
dedicated preview hostname to a loopback Nginx/PHP-FPM listener. The origin
application port remains private. Cloudflare Access may add an outer preview
boundary, but Laravel admin authentication and authorization remain mandatory.

Do not use the preview Tunnel hostname, preview R2 bucket, or preview secrets for
customer-facing production.

For production, Cloudflare Tunnel remains an allowed option only after these
gates are evidenced:

- at least two supervised connectors, or an explicitly accepted single-VPS
  availability exception;
- Cloudflare-only origin access and no public application/WAHA/Redis/MySQL port;
- external checks for DNS, TLS, `/up`, catalog, media, checkout, and webhooks;
- WAF/rate rules that do not block Meta verification, J&T webhook, or checkout;
- connector restart/recovery test, monitoring, and documented rollback;
- Nginx/PHP-FPM origin, not `php artisan serve`.

The application receives only the R2 bucket credential and normal Laravel env.
The Tunnel connector receives its own tunnel token. A Cloudflare account API
token is provisioning-only and is never loaded into PHP or committed to the
repository.

## Alternatives considered

### Direct Cloudflare-proxied DNS to Nginx

- Pros: fewer moving parts at request time; conventional TLS and origin
  operations; easier to reason about for a single production VPS.
- Cons: requires correct origin firewall, TLS/origin certificate, port exposure,
  and explicit protection against origin bypass.
- Decision: keep as the production alternative when the team is ready to own
  direct-origin TLS and firewall operations.

### Public `artisan serve` port

- Pros: fastest preview setup.
- Cons: not a production server; weaker process and request handling; exposes an
  application port; does not establish a durable ingress/security boundary.
- Rejected for production.

## Consequences

### Positive

- Preview can be accessed over HTTPS without exposing the VPS app port.
- Origin access can be restricted to Cloudflare and the Tunnel connector.
- The same hostname, WAF, and observability model can be exercised before launch.

### Trade-offs

- Tunnel availability and connector health become production dependencies.
- Webhook, upload-size, timeout, and long-running request behavior must be
  tested through the edge, not only on localhost.
- A single connector on one VPS is not high availability.

## Implementation notes

- Runtime token: `CLOUDFLARE_TUNNEL_TOKEN` in a root-readable protected service
  environment, never in the Laravel app environment.
- R2 runtime: bucket-scoped access key/secret; custom public media domain
  preferred over `r2.dev` for production.
- Preview: dedicated hostname and separate R2 bucket/prefix.
- Origin: loopback Nginx -> PHP-FPM; queue workers and WAHA remain private.
- See [production VPS environment contract](../production-vps-env-contract.md)
  for the agent request packet and verification order.

## Verification and rollback

Preview acceptance requires:

```bash
systemctl is-active cloudflared
curl -fsS https://<preview-host>/up
curl -fsS https://<preview-host>/products
php artisan media:disk-check
```

Rollback is to the approved direct/private preview path or a maintenance page;
it is not to a public `artisan serve` port. For production, the release record
must name the ingress rollback owner and verify the origin remains inaccessible
when the Tunnel is stopped.
