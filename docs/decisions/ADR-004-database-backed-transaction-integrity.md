# ADR-004: Database-Backed Transaction Integrity Guards

## Status

Accepted.

## Date

2026-08-08

## Context

The checkout, payment, cancellation, and long-running import paths could violate
business invariants under retry, double-click, partial settlement, or parallel
workers. The audit baseline showed that a repeated checkout could create two
orders and decrement stock twice, a partial payment could mark an order paid,
cancellation did not compensate inventory, and queue visibility could expire
before a 30-minute import completed.

These paths are part of one Laravel modular monolith and share the same
transactional database. Introducing distributed services would add operational
cost without strengthening these invariants.

## Decision

Use database-backed guards inside the existing modular monolith:

1. Assign each checkout flow a server-generated, session-scoped UUID. Persist it
   as nullable unique orders.checkout_idempotency_key. A retry returns the
   existing order; the unique constraint is the final concurrency guard.
2. Route cancellation through OrderService::cancel(). Lock the order, aggregate
   item quantities by variant, lock variants in stable ID order, restore stock,
   append the event, and commit cancelled exactly once.
3. Route payment completion through PaymentService. Reject non-positive
   amounts, lock order/payment rows, sum completed payments, and mark the order
   paid only when the sum covers orders.total_amount. Reconcile failed/refunded
   rows without automatically regressing fulfillment status.
4. Keep catalog import timeout at 1,800 seconds, set database/Redis retry_after
   to 1,860 seconds, and retain both unique dispatch and an application overlap
   lock keyed by import job ID.
5. Keep J&T webhooks fail-closed and use allowlist logs with hashed identifiers.
   Production boot fails when J&T is enabled without a signing key.

## Alternatives considered

### Client-only disabled submit button

Rejected as the integrity control. It improves UX but cannot protect network
retry, two tabs, replay, or parallel HTTP requests.

### Cache-only idempotency and cancellation locks

Rejected as the primary guard. Cache eviction or Redis outage could remove the
guard while the database write remains. Cache locks may complement, but cannot
replace, unique constraints and row locks.

### Add a partially-paid order status

Deferred. The canonical order payment statuses remain
pending|paid|refunded; partial settlement is represented by payment rows while
the order remains pending. A new public/admin status requires a separate
business decision and full contract/UI migration.

### Split payment, inventory, and import into services

Rejected for current scale. The modular monolith provides stronger local
transaction boundaries and lower operational complexity.

## Consequences

### Positive

- Checkout retries converge on one durable order.
- Stock decrement and cancellation compensation are paired and idempotent.
- Payment confirmation reflects actual settlement instead of one row's status.
- Import jobs cannot become visible to a second worker before their timeout.
- J&T operational logs retain correlation evidence without raw credentials or
  customer/provider payloads.

### Trade-offs

- The checkout idempotency migration adds a nullable unique index to orders;
  production migration timing and lock impact must be tested on a disposable
  MySQL clone.
- Session-scoped idempotency assumes the normal guest checkout flow. A future
  public API must accept and authenticate an explicit idempotency header/key.
- Cancellation currently restores variant stock only. Product-level inventory
  for non-variant items remains a separate P1 design.
- Payment reconciliation does not reverse fulfillment automatically; refund
  operations still require an explicit operational workflow.

## Implementation notes

- Migration:
  2026_08_08_010000_add_checkout_idempotency_key_to_orders_table.php.
- Services: OrderService, PaymentService.
- HTTP entry points: CheckoutController, admin order/payment controllers.
- Queue: ProcessCatalogImport, config/queue.php, production env contract.
- Security boundary: ShippingController, JntCargoClient, AppServiceProvider.
- No production/application database migration was executed as part of this
  change.

## Verification and rollback

Required evidence before production migration:

1. PHPUnit transaction, checkout retry, queue safety, webhook, and logging tests.
2. Two-worker import test with Redis and a job exceeding the old 90-second
   visibility timeout.
3. Parallel checkout test against production-like MySQL proving one order,
   payment, and stock decrement.
4. Forward migration timing/lock evidence on a disposable production clone.

Rollback keeps the nullable column/index in place and rolls application code
forward to a corrective version. Do not drop the index during an incident or
assume a down migration can safely merge duplicate orders. If the new code must
be disabled before production traffic, stop checkout writes first, deploy the
previous application version, and retain the column for forensic correlation.
