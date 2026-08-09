# Role and Status Contract

Status: canonical runtime contract (2026-08-06).

## Admin identity

- Admin access requires an authenticated user with `status=active`.
- The canonical stored role is `admin`. Stage 2 is equal-admin: there is no
  active Super Admin, Staff, or Viewer hierarchy in the UI or authorization
  flow. Legacy enum values may remain in historical database rows, but new and
  updated users are normalized to `admin`.
- User management never exposes a role picker. It prevents self-deactivation
  and keeps at least one active admin. Archive/deactivate is preferred over
  destructive deletion.

## Order status

`orders.order_status` values used by controllers, services, UI, and API:

`pending_payment`, `processing`, `shipped`, `delivered`, `completed`, `issue`,
`return_in_process`, `cancelled`.

## Payment status

`orders.payment_status` values:

`pending`, `paid`, `refunded`.

## Shipping status

`orders.shipping_status` and `shipping_records.status` values:

`pending_pickup`, `in_process`, `in_transit`, `delivered`, `cancelled`.

`unpaid` and `awaiting_shipment` are legacy documentation aliases and must not
  be emitted by current UI/API contracts. User-facing labels are translated in
  `resources/js/lib/status.ts` and may differ from stored values.

## Contract hygiene

When a status or role changes, update this file, the database schema/API docs,
the corresponding controller validation, `resources/js/lib/status.ts`, and
feature/E2E assertions in the same change.
