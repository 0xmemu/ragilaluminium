# Observability Operations Runbook

## Scope

The application emits safe structured events for request completion and
checkout outcomes. These events are correlation-friendly but do not replace an
external log/metrics platform or an on-call alert path.

## Event contract

http_request_completed contains schema_version, request_id, HTTP method, named
route (or unmatched), response status, and duration_ms. Failed exceptions add
only the exception class. The middleware never records query strings, request
bodies, headers, cookies, tokens, customer contact data, or exception messages.

checkout_outcome contains schema_version, request_id, outcome, payment_method,
and idempotency_replay. Current outcomes are order_created, duplicate_replay,
missing_details, empty_cart, cod_unavailable, and order_rejected. Customer
name, phone, email, address, order total, voucher code, and provider payloads
are intentionally excluded.

## Operator use

1. Filter logs by request_id to follow one HTTP request and its queued work.
2. Plot http_request_completed.duration_ms by route and status class.
3. Count checkout_outcome by outcome and payment method; treat order_rejected
   and unexpected 5xx request events as investigation signals.
4. Correlate queue alerts using the same request context where available.
5. Never copy raw log lines containing customer data into tickets; the event
   contract is safe by design, but adjacent application logs still require
   normal access controls and retention.

## Production gap

An external structured-log sink, dashboard, threshold alerts, retention policy,
and named on-call owner are still required before production readiness can be
declared. The local events and tests are implementation evidence only.
