# ADR-006: Centralized Order and Shipping State Transitions

- Status: Accepted
- Date: 2026-08-08

## Context

Order status was writable from controllers, payment reconciliation, and carrier
updates. An admin could jump directly from `pending_payment` to `completed`,
cancellation could restore stock after shipment, and a stale carrier event could
regress a delivered shipment.

## Decision

`App\Domain\Orders\OrderStateMachine` is the only component that changes
`orders.order_status`. It owns the legal transition graph, row lock, actor,
source, and audit event. Cancellation inventory restoration runs inside the
same locked transition. Payment settlement and carrier cascades call this
component instead of updating order status directly.

Shipping milestones also use a monotonic transition graph. Carrier events older
than `last_status_at`, and regressions such as `delivered → in_transit`, are
recorded as safe operational warnings and cannot overwrite the canonical
milestone. Carrier payloads and exception messages are not logged.

Terminal order states are `completed` and `cancelled`. Cancellation is valid
only before shipment. Returns use `return_in_process` rather than cancellation.

## Consequences

- Illegal admin jumps return a validation error without partial payment or stock
  side effects.
- Payment, admin, WhatsApp, and carrier flows share one audited transition graph.
- New statuses or recovery paths require an explicit graph change and tests.
- MySQL concurrency verification remains a release gate even though row locks
  and transactional tests are present.
