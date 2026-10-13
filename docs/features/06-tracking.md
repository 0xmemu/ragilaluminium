# Feature 06 — Tracking Pesanan

**Status implementasi:** UI target belum dianggap selesai; J&T adapter bertahap. Carrier tracking sumber kebenaran delivered.

## Customer UI flow
Order number+HP menampilkan courier, resi, normalized status, scan timeline, last update, ETA hasil display (buffer +1 hari sudah diterapkan sekali). Empty: resi belum diterbitkan; resi menunggu tracking; provider unavailable; resi invalid. Tidak ada fake data.

## Admin dashboard UI/UX
Detail order panel Lacak Pesanan: courier/service, resi+copy, status, last update/source, scan timeline, Refresh Tracking, loading/success/stale/provider-unavailable. Admin boleh resi/refresh; tidak manual delivered. Target belum dianggap ada sampai verifikasi.

## Backend/API/database
Adapter carrier terisolasi (J&T first). Webhook signature/idempotency; duplicate scan tidak menggandakan timeline; poll timeout/retry/backoff/rate/stale. Delivered tervalidasi → Sampai; provider failure tidak delivered dan dapat internal issue/notification. Gunakan entity existing; field/event baru update schema/API docs sebelum migration. Event minimal order/shipment ref, provider, resi, provider/normalized status, occurred_at, location/description, source, hash, created_at. Redact token/PII.

## Permissions/acceptance/open
Customer safe subset; admin full ops; worker signed. Loading/stale tidak optimistic. Acceptance panel/empty, no Tandai Sampai, idempotent refresh, failure not delivered, event state-machine/timeline, usable sebelum J&T. Open credential/webhook/status mapping/poll/SLA/carrier ETA/raw retention.
