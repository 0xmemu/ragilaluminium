# Export Operations Runbook

## Scope

Admin CSV and correction XLSX exports are protected against spreadsheet formula
injection and unbounded row volume. The existing routes and filenames remain
unchanged.

## Controls

- ExportSafety prefixes any string beginning with =, +, -, or @ with an
  apostrophe before it reaches CSV/XLSX output.
- Numeric values remain numeric; headings and raw correction-row values are
  sanitized as well.
- EXPORT_MAX_ROWS defaults to 50000 and is configurable in the environment.
- Product, customer, order, and activity exports preflight their row count.
- Store-performance and correction exports preflight their bounded payload or
  collection size.
- An over-limit request fails with a validation response instructing the admin
  to narrow the filter or period.

## Operator guidance

1. Prefer date, status, category, or search filters for large exports.
2. Treat an over-limit response as a data-selection issue, not a reason to
   increase the limit ad hoc.
3. Review exported files in a safe viewer before sharing; customer and order
   exports contain sensitive business data and remain admin-only.
4. If a business export must exceed 50000 rows, schedule a reviewed paginated
   export design rather than removing the guard.

## Verification

Run the focused regression test:

php artisan test --compact tests/Feature/ExportSafetyTest.php

The control prevents spreadsheet execution of attacker-controlled values; it
does not replace authorization, retention, access control, or PII governance.
