# Feature 05 — Order Lifecycle

**Status implementasi:** runtime memiliki state machine, tetapi label/transition perlu sync. **Aktor:** customer guest, admin, carrier/system.

## Status dan flow
Normal: Menunggu Konfirmasi → Pesanan Diproses → Sedang Dikirim → Pesanan Sampai → Pesanan Selesai. Exception: Pesanan Dibatalkan, Retur Diproses, Retur Selesai. Issue internal, bukan customer-facing.
Order baru pending; customer cancel hanya pending; admin cancel canonical pending/processing dengan reason; edit hanya pending; resi/pickup valid → dikirim; Sampai dari tracking terverifikasi tanpa Tandai Sampai; retur hanya Sampai/Selesai.

## Customer UI/UX
Satu Riwayat Pesanan/timeline status/timestamp/tracking/safe notification/CTA. Tidak ada issue/admin notes/refund detail. Refresh, lookup invalid, cancellation failure, tracking unavailable, return-not-eligible punya loading/error jelas.

## Admin dashboard UX
List → filter → detail → payment/shipping/tracking/return → timeline → action. Badge, primary action, reason, full timeline. Invalid action disabled/beralasan. Edit pending only. Target belum seluruhnya terimplementasi.

## Backend/API/state machine
Transition lewat service dengan guard actor/status/payment/stock/resi/tracking/reason; webhook/refresh/retry idempotent. Event before/after, actor System/Carrier/Admin/Customer, time, note/reference, visibility. Mismatch issue/return_completed/pending_payment dipetakan dahulu, jangan rename tanpa migration/docs/tests.

## Database/permissions/acceptance
Order status resmi; timeline/audit transition, actor, address/payment/shipping edit, WhatsApp. Guest view/cancel pending via nomor+HP; admin according state; carrier verified transition. Acceptance cancel/edit locked, no manual delivered, pre-arrival not return, invalid server rejection/audit. Open: final Selesai, webhook SLA, enum migration.
