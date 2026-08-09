# Queue Operations Runbook

## Purpose

This runbook covers queue backlog and permanently failed jobs. It is safe for
operators because application alerts contain identifiers and exception class,
not serialized job payloads, exception messages, or credentials.

## Required production wiring

- Run exactly one effective Laravel scheduler per environment. The repository
  provides `scripts/dev-vps/ragil-scheduler.service` as a systemd template.
- Run supervised workers for `imports,media,default` with retry-after greater
  than the longest worker timeout.
- Route `OPS_ALERT_LOG_CHANNEL` to an observed channel. Use `slack` only after
  `LOG_SLACK_WEBHOOK_URL` is provisioned and tested; a central structured-log
  channel is also valid.
- Set queue monitor connection, queue names, threshold, and failed-job
  retention explicitly in production environment configuration.

## Signals

`queue_busy` is warning severity and includes connection, queue, current size,
and threshold. `queue_job_failed` is critical and includes connection, queue,
job ID, job class, attempts, and exception class. Correlation context from the
originating request is attached by Laravel Context when available.

## Triage

1. Record alert time, release SHA, queue, job ID, worker status, and backlog.
2. Run `php artisan queue:monitor <connection>:<queue> --max=<threshold>` and
   `php artisan queue:failed`; do not copy serialized payloads into chat/tickets.
3. Inspect application logs by request/job identifiers and exception class.
4. Stop the affected producer or isolate its queue if failures are repeating.
5. Fix the cause and verify the job is idempotent before using
   `php artisan queue:retry <job-uuid>`.
6. Confirm backlog falls, a representative job succeeds, and no new critical
   alert is emitted before closing the incident.

Never run `queue:flush`, delete failed jobs, or retry all jobs before evidence
is captured and replay safety is confirmed. Failed jobs are pruned by the
scheduler after `QUEUE_FAILED_RETENTION_HOURS` (default seven days).
