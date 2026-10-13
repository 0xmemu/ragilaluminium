# Admin Dashboard Status Transition Matrix

> Tujuan: menjadi sumber kebenaran untuk label status, transisi yang diizinkan, trigger, action admin, side effect, notifikasi, dan audit event lintas modul Ragil Aluminium.
>
> Prinsip utama:
>
> ```text
> Satu entity memiliki satu source of truth status.
> Satu tampilan hanya menampilkan status yang sesuai konteks.
> Status order, payment, fulfillment, dan shipping tidak boleh dicampur menjadi satu field.
> Setiap status transition yang penting harus diaudit.
> ```

---

# 1. Aturan Global

## 1.1 Domain status terpisah

Gunakan status terpisah untuk:

```text
Order status
Payment status
Fulfillment status
Shipping status
Return status
Product publication status
Promotion lifecycle status
Media processing status
Import job status
```

Jangan menggunakan satu status generik seperti `diproses` untuk menyimpan banyak makna sekaligus.

Contoh buruk:

```text
Order status = Diproses
```

Tanpa mengetahui apakah pembayaran sudah diterima, produk siap kirim, atau paket sudah di carrier.

Contoh benar:

```text
Order status       = confirmed
Payment status     = paid
Fulfillment status = ready_to_ship
Shipping status    = not_shipped
```

## 1.2 State visual standard

| State | Arti | Tone visual |
|---|---|---|
| Draft | Belum siap/diterbitkan | Neutral |
| Pending | Menunggu aksi atau sistem | Neutral/Warning tergantung SLA |
| Need action | Membutuhkan tindakan admin/customer | Warning |
| Processing | Sedang berjalan | Info |
| Active | Aktif berlaku | Success |
| Completed | Selesai sukses | Success |
| Failed | Gagal | Danger |
| Cancelled | Dibatalkan | Danger/Neutral |
| Archived | Disimpan, tidak aktif | Neutral |
| Exception | Memerlukan investigasi | Danger/Warning |

## 1.3 Rule transition

- Transisi hanya boleh bergerak sesuai state machine.
- Transition manual harus mencatat actor dan alasan bila dampaknya finansial/operasional.
- Transition otomatis harus mencatat source event/webhook/job.
- Tidak boleh ada state `completed` jika requirement domain lain belum valid.
- Rollback harus eksplisit; jangan melakukan rollback status secara silent.

---

# 2. Order Status

## 2.1 Canonical statuses

```ts
export type OrderStatus =
  | 'created'
  | 'awaiting_payment'
  | 'payment_verification'
  | 'confirmed'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'return_requested'
  | 'return_in_progress'
  | 'returned'
  | 'refunded'
  | 'on_hold'
  | 'exception'
```

## 2.2 Status meanings

| Internal key | Customer/admin label | Arti |
|---|---|---|
| `created` | Pesanan dibuat | Checkout/order berhasil dibuat, belum tentu siap diproses |
| `awaiting_payment` | Menunggu pembayaran | Transfer/payment gateway belum dibayar |
| `payment_verification` | Pembayaran diverifikasi | Bukti pembayaran diterima/menunggu validasi |
| `confirmed` | Pesanan dikonfirmasi | Order valid dan dapat masuk fulfillment |
| `ready_to_ship` | Siap dikirim | Ready-stock order siap diserahkan ke carrier |
| `shipped` | Dikirim | Paket telah diserahkan ke kurir / shipping aktif |
| `delivered` | Terkirim | Carrier menyatakan paket diterima |
| `completed` | Selesai | Order lifecycle ditutup sesuai kebijakan bisnis |
| `cancelled` | Dibatalkan | Order tidak dilanjutkan |
| `return_requested` | Retur diajukan | Customer/admin mengajukan retur |
| `return_in_progress` | Retur diproses | Retur sedang berjalan |
| `returned` | Retur diterima | Barang retur diterima/terverifikasi |
| `refunded` | Dana dikembalikan | Refund selesai |
| `on_hold` | Ditahan | Order tertahan karena masalah data/pembayaran/operasional |
| `exception` | Perlu perhatian | Ada exception yang menghalangi normal flow |

## 2.3 Allowed transitions

```text
created
├── awaiting_payment
├── payment_verification
├── confirmed                 (COD atau payment otomatis sukses)
├── cancelled
└── on_hold

awaiting_payment
├── payment_verification
├── confirmed                 (payment gateway settled)
├── cancelled
├── on_hold
└── exception                 (payment abnormal)

payment_verification
├── confirmed
├── awaiting_payment          (proof rejected, jika bisnis memperbolehkan bayar ulang)
├── cancelled
└── on_hold

confirmed
├── ready_to_ship
├── cancelled                 (sebelum diserahkan ke carrier dan sesuai policy)
└── on_hold

ready_to_ship
├── shipped
├── on_hold
└── cancelled                 (hanya bila belum handed-over dan sesuai policy)

shipped
├── delivered
├── exception
├── return_in_progress        (return-to-sender / delivery failure)
└── on_hold                   (carrier issue, jika perlu)

delivered
├── completed
├── return_requested
└── exception                 (dispute after delivery)

completed
└── return_requested          (jika return window masih aktif)

return_requested
├── return_in_progress
├── cancelled                 (request ditolak/ditarik sesuai policy)
└── on_hold

return_in_progress
├── returned
├── exception
└── on_hold

returned
├── refunded
├── completed                 (return tanpa refund sesuai policy)
└── on_hold
```

## 2.4 Admin action per status

| Status | Primary action | Secondary action |
|---|---|---|
| Created | Tinjau pesanan | Lihat detail, hubungi customer |
| Awaiting payment | Lihat pembayaran | Kirim pengingat, batalkan |
| Payment verification | Verifikasi pembayaran | Tolak bukti, hubungi customer |
| Confirmed | Tandai siap kirim | Lihat detail, hold, batalkan |
| Ready to ship | Input resi / serahkan ke kurir | Print, edit pengiriman |
| Shipped | Lihat tracking | Segarkan tracking, hubungi carrier |
| Delivered | Selesaikan pesanan | Lihat bukti, tangani dispute |
| Completed | Lihat detail | Buat follow-up/review request |
| On hold/Exception | Tangani masalah | Hubungi customer, lihat log |
| Cancelled | Lihat alasan | Proses refund bila perlu |
| Return requested | Review retur | Tolak/terima sesuai policy |
| Return in progress | Update status retur | Lihat tracking retur |
| Returned | Proses refund | Selesaikan retur |

## 2.5 Required audit events

```text
order.created
order.confirmed
order.put_on_hold
order.cancelled
order.ready_to_ship
order.shipped
order.delivered
order.completed
order.exception_raised
order.return_requested
order.return_approved
order.return_rejected
order.return_received
order.refunded
```

Audit payload minimum:

```text
actor
source (admin/system/webhook/customer)
timestamp
order_id
previous_status
next_status
reason
notes
```

---

# 3. Payment Status

## 3.1 Canonical statuses

```ts
export type PaymentStatus =
  | 'unpaid'
  | 'proof_received'
  | 'pending_verification'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'refund_requested'
  | 'refund_in_progress'
  | 'refunded'
  | 'pending_collection'
  | 'collected'
  | 'collection_failed'
  | 'not_required'
```

## 3.2 Payment methods

```ts
export type PaymentMethod =
  | 'bank_transfer'
  | 'payment_gateway'
  | 'cod'
  | 'cash'
  | 'manual'
```

## 3.3 Transfer/payment gateway flow

```text
unpaid
├── proof_received
├── pending_verification
├── paid                  (gateway settlement/capture)
├── failed
├── expired
└── cancelled

proof_received
└── pending_verification

pending_verification
├── paid
├── unpaid                (rejected; if re-payment allowed)
├── failed
└── on_hold

paid
├── refund_requested
└── refunded              (rare direct refund)

refund_requested
├── refund_in_progress
└── on_hold

refund_in_progress
├── refunded
└── failed
```

## 3.4 COD flow

```text
pending_collection
├── collected             (carrier/COD settlement confirmed)
├── collection_failed     (refused/unpaid/failed delivery)
├── on_hold
└── refunded              (if special policy)
```

Important rule:

```text
COD pending_collection is not the same as transfer unpaid.
```

Customer/admin UI labels:

```text
Bank transfer unpaid       → Menunggu pembayaran
COD pending collection     → Dibayar saat barang diterima
COD collected              → Pembayaran COD diterima
COD collection failed      → Pembayaran COD belum berhasil
```

## 3.5 Payment-to-order synchronization

| Payment condition | Default order behavior |
|---|---|
| Transfer unpaid | Order remains `awaiting_payment` |
| Transfer verification | Order becomes `payment_verification` |
| Transfer paid | Order becomes `confirmed` if other validation passes |
| COD pending collection | Order can be `confirmed`, `ready_to_ship`, `shipped`, or `delivered` |
| COD collected | Order can proceed from `delivered` to `completed` |
| Payment failed | Order moves to `on_hold`, `awaiting_payment`, or `cancelled` based on policy |
| Refund in progress | Order remains completed/cancelled/returned; payment manages refund state |

## 3.6 Required fields per payment action

### Approve manual transfer

```text
Payment proof
Amount received
Bank/source
Received timestamp
Verifier
Optional note
```

### Reject manual transfer

```text
Reject reason
Optional admin note
Whether customer may submit new proof
```

### Refund

```text
Refund amount
Refund reason
Refund destination/method
Approver
Reference number
```

---

# 4. Fulfillment Status for Ready-Stock

## 4.1 Canonical statuses

```ts
export type FulfillmentStatus =
  | 'not_ready'
  | 'ready_to_ship'
  | 'handed_to_carrier'
  | 'on_hold'
  | 'cancelled'
```

## 4.2 Meaning

| Key | Admin label | Meaning |
|---|---|---|
| `not_ready` | Belum siap kirim | Order belum boleh diserahkan ke carrier |
| `ready_to_ship` | Siap dikirim | Ready-stock item siap diproses untuk pengiriman |
| `handed_to_carrier` | Diserahkan ke kurir | Paket telah diberikan ke carrier/waybill aktif |
| `on_hold` | Fulfillment ditahan | Ada blocker operasional |
| `cancelled` | Fulfillment dibatalkan | Tidak perlu diproses lagi |

## 4.3 Ready-stock rules

- Jangan tampilkan produksi, QC, atau packing sebagai customer milestone default.
- Internal warehouse process boleh ada sebagai internal sub-event jika bisnis membutuhkannya.
- Order tidak dapat menjadi `ready_to_ship` jika payment rule belum terpenuhi.
- Order COD dapat menjadi `ready_to_ship` setelah order dikonfirmasi.
- `handed_to_carrier` harus membutuhkan kurir/resi atau bukti handover sesuai policy.

---

# 5. Shipping Status

## 5.1 Canonical statuses

```ts
export type ShippingStatus =
  | 'not_shipped'
  | 'waybill_created'
  | 'picked_up'
  | 'in_transit'
  | 'at_destination_hub'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_failed'
  | 'returned_to_sender'
  | 'unknown'
```

## 5.2 Meaning and customer-friendly label

| Key | Admin/customer label | Meaning |
|---|---|---|
| `not_shipped` | Belum dikirim | Belum ada proses carrier aktif |
| `waybill_created` | Resi dibuat | Nomor resi tersedia, belum tentu dijemput |
| `picked_up` | Dijemput kurir | Paket diambil/diterima carrier |
| `in_transit` | Dalam perjalanan | Bergerak antar hub/gateway |
| `at_destination_hub` | Tiba di hub tujuan | Sudah dekat area tujuan |
| `out_for_delivery` | Sedang diantar | Kurir menuju alamat penerima |
| `delivered` | Terkirim | Paket diterima |
| `delivery_failed` | Pengiriman belum berhasil | Carrier gagal menyelesaikan pengantaran |
| `returned_to_sender` | Dikembalikan ke pengirim | Paket kembali ke origin |
| `unknown` | Status belum tersedia | Belum ada data valid dari carrier |

## 5.3 Shipping transitions

```text
not_shipped
├── waybill_created
└── cancelled

waybill_created
├── picked_up
├── in_transit             (carrier may skip pickup event)
├── delivery_failed
└── cancelled              (only before handover if policy allows)

picked_up
├── in_transit
├── at_destination_hub
├── out_for_delivery
├── delivered
└── delivery_failed

in_transit
├── at_destination_hub
├── out_for_delivery
├── delivered              (carrier may skip intermediate scan)
├── delivery_failed
└── returned_to_sender

at_destination_hub
├── out_for_delivery
├── delivered
├── delivery_failed
└── returned_to_sender

out_for_delivery
├── delivered
├── delivery_failed
└── returned_to_sender
```

## 5.4 Mapping to order status

| Shipping status | Suggested order status |
|---|---|
| not_shipped / waybill_created | confirmed or ready_to_ship |
| picked_up / in_transit / destination hub / out for delivery | shipped |
| delivered | delivered |
| delivery_failed | exception or on_hold |
| returned_to_sender | return_in_progress or exception |

## 5.5 Tracking refresh policy

```text
Manual refresh
- Allowed to authorized admin.
- Must show loading, result, error, cooldown, and last sync time.

Automatic refresh
- Poll/webhook based according to carrier policy.
- Must persist source timestamp and received timestamp.

Stale tracking
- Trigger warning if no update exceeds configurable SLA.
```

---

# 6. Return and Refund Status

## 6.1 Return status

```ts
export type ReturnStatus =
  | 'not_requested'
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'in_transit_to_seller'
  | 'received_by_seller'
  | 'resolved'
  | 'cancelled'
```

## 6.2 Return transition

```text
not_requested
└── requested

requested
├── approved
├── rejected
├── cancelled
└── on_hold

approved
├── in_transit_to_seller
├── received_by_seller
└── cancelled

in_transit_to_seller
├── received_by_seller
└── exception

received_by_seller
├── resolved
└── refund_in_progress
```

## 6.3 Required return information

```text
Reason
Photo/video evidence when required
Customer note
Admin decision
Return shipment/resi when applicable
Item condition received
Resolution type: replacement/refund/partial refund/no refund
```

---

# 7. Product Publication Status

## 7.1 Canonical statuses

```ts
export type ProductStatus =
  | 'draft'
  | 'incomplete'
  | 'ready_for_review'
  | 'active'
  | 'archived'
```

## 7.2 Meaning

| Key | Label | Rule |
|---|---|---|
| `draft` | Draft | Baru dibuat, belum lengkap |
| `incomplete` | Perlu dilengkapi | Ada requirement publish belum terpenuhi |
| `ready_for_review` | Siap ditinjau | Semua requirement data ada, belum publish |
| `active` | Aktif | Dapat tampil dan dibeli di storefront |
| `archived` | Diarsipkan | Tidak dijual/ditampilkan, histori tetap ada |

## 7.3 Publish requirements

Minimum sebelum `active`:

```text
Identity product complete
Category/model valid
At least one active variant
Price per required variant
Stock rule valid
Primary catalog image
Variant media group complete when required
Shipping data per variant
Description/specification required
```

## 7.4 Product transition

```text
draft → incomplete → ready_for_review → active
active → archived
archived → draft / ready_for_review / active (depending on reactivation validation)
```

Rules:

- Produk dengan order history tidak boleh hard delete.
- Archive harus memeriksa promo/banner/collection dependency.
- Product active tidak boleh kehilangan primary media tanpa replacement/warning.

---

# 8. Media Processing Status

## 8.1 Canonical statuses

```ts
export type MediaStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'duplicate'
  | 'archived'
```

## 8.2 Transition

```text
uploaded → queued → processing → ready
processing → failed
uploaded/ready → duplicate
ready → archived
failed → queued (retry)
```

## 8.3 Rules

- `ready` required before asset can be used as public primary product image.
- `failed` must expose retry action to authorized admin.
- Deleting/archiving media with usage count > 0 requires dependency warning.
- Duplicate decision should preserve original source relationship.

---

# 9. Import Job Status

## 9.1 Canonical statuses

```ts
export type ImportStatus =
  | 'draft'
  | 'uploaded'
  | 'validating'
  | 'validation_failed'
  | 'ready_to_run'
  | 'queued'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled'
```

## 9.2 Transition

```text
draft → uploaded → validating
validating → validation_failed
validating → ready_to_run
ready_to_run → queued → running
running → completed
running → completed_with_errors
running → failed
queued → cancelled
```

## 9.3 Required impact preview before queue

```text
Rows detected
Valid rows
Invalid rows
Will create
Will update
Will archive
Will skip
Potential duplicates
Affected products/variants
```

---

# 10. Promotion Lifecycle Status

## 10.1 Canonical statuses

```ts
export type PromotionStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'expired'
  | 'disabled'
  | 'archived'
```

## 10.2 Transition

```text
draft → scheduled
scheduled → active
scheduled → disabled
active → expired
active → disabled
expired → archived
active → archived (only when historical integrity preserved)
```

## 10.3 Rules

- Period must use explicit timezone.
- Active promotion must obey stacking/priority rules.
- Flash sale may have exclusivity rule.
- Promotion linked to completed order cannot be hard deleted.
- Archive preserves historical discount calculation.

---

# 11. CMS Content Lifecycle Status

## 11.1 Canonical statuses

```ts
export type ContentStatus =
  | 'draft'
  | 'in_review'
  | 'published'
  | 'archived'
```

## 11.2 Transition

```text
draft → in_review → published → archived
published → draft (for major edit/review policy)
archived → draft
```

## 11.3 Rules

- Published content must retain revision history.
- Content with unsafe HTML must not publish.
- Ordering changes must be explicit and have unsaved/saved state.
- Published content requires storefront preview before high-impact changes when feasible.

---

# 12. Admin Account Status

## 12.1 Canonical statuses

```ts
export type AdminStatus =
  | 'invited'
  | 'active'
  | 'suspended'
  | 'deactivated'
```

## 12.2 Transition

```text
invited → active
active → suspended
active → deactivated
suspended → active
deactivated → active (new approval / reactivation)
```

## 12.3 Rules

- Admin cannot deactivate themselves without explicit secure flow.
- Last active owner/admin cannot be deactivated.
- Role/capability changes require audit.
- Credential reset/invite acceptance must be secure and time-bound.

---

# 13. Notification Status

## 13.1 Canonical statuses

```ts
export type NotificationStatus =
  | 'unread'
  | 'read'
  | 'dismissed'
  | 'expired'
```

## 13.2 Severity

```ts
export type NotificationSeverity =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'action_required'
```

Rules:

- `action_required` should have deep link or CTA.
- Read/dismissed must not delete audit source event.
- Expired notification must follow retention policy.

---

# 14. Required UI Mapping Rules

## Order row

Show separately:

```text
Order: [order status]
Payment: [payment status + method]
Shipping: [shipping status + carrier]
```

## Customer tracking page

Show simplified customer milestones only:

```text
Pesanan dibuat
Pembayaran/konfirmasi
Siap dikirim
Diserahkan ke kurir
Dalam perjalanan
Sedang diantar
Terkirim
```

Do not expose raw internal status names or raw carrier payloads.

## Dashboard queue

Map status to action:

```text
awaiting_payment         → payment reminder/monitor
payment_verification     → verify payment
confirmed                → prepare shipping
ready_to_ship            → input resi/handover
exception                → handle issue
shipping stale           → refresh/investigate
whatsapp failed          → retry/reconnect
```

---

# 15. Status Matrix Definition of Done

- [ ] All entity statuses are defined with key, label, meaning, and tone.
- [ ] All allowed transitions are documented.
- [ ] All manual transitions define required permission and audit requirement.
- [ ] Order/payment/fulfillment/shipping are represented separately in database/view model/UI.
- [ ] COD has a distinct lifecycle from transfer/payment gateway.
- [ ] Product, promotion, content, import, media, and admin lifecycle rules are documented.
- [ ] UI labels are customer/admin friendly and do not expose raw technical state unnecessarily.
- [ ] Exception and rollback behavior is documented for all critical domains.


---

# Lampiran: Gap Implementasi vs Matriks (2026-08-23, dari audit 3 halaman)

Matriks ini mendefinisikan lifecycle payment penuh (proof_received, pending_verification,
COD pending_collection, refunded, dsb.). Namun implementasi saat ini BELUM memiliki field
terpisah untuk status-status tsb. Kondisi nyata:

- `orders.payment_status` HANYA `pending | paid`.
- `orders.order_status` menggabungkan makna (mis. `awaiting_confirmation` utk baik transfer
  belum dibayar maupun COD).
- `payment_method` (transfer/cod) + `cod_flag` + `payment_status` + `order_status` dipakai
  untuk menyimpulkan kondisi pembayaran.

Keputusan (technical debt, fase ini):

```text
JANGAN klaim status yang field-nya belum ada (proof_received, pending_verification,
pending_collection, refunded).
Mapping aman berdasarkan field existing:
- Transfer unpaid : cod_flag=false AND payment_status=pending AND order_status=awaiting_confirmation
- COD pending     : cod_flag=true AND payment_status=pending
- Paid            : payment_status=paid
- Ambigu lain     : "Perlu ditinjau" (jangan auto-transition)
Label UI aman:
- Transfer         : "Menunggu pembayaran"
- COD              : "COD, bayar saat barang diterima"
- Paid             : "Lunas"
- Ambigu           : "Perlu ditinjau"
```

Abstraction: `app/Support/OrderStatusView.php` (paymentBucket/paymentLabel) adalah satu sumber
pembacaan payment state yang aman. Bila skema payment di-migrasi (menambah kolom
proof_received/pending_verification/refunded dll.), hanya normalizer ini yang disesuaikan;
komponen UI (Dashboard, Orders/Index, Orders/Show) tetap memakai field `payment_bucket` /
`payment_label` yang diproduksi backend.

## Gap yang di-defer (future decision)

- Queue "Payment verification" TIDAK dibuat (pending belum membedakan unpaid vs proof_received).
- Lifecycle COD (pending_collection/collected/collection_failed) belum terepresentasi sebagai
  field; ditangani lewat nota COD (pending) utk sekarang.
- Refund state (requested/in_progress/refunded) belum didukung penuh di order payment_status.

Perbaikan ini adalah kandidat migrasi skema masa depan; jangan dilakukan tanpa keputusan ADR
karena berdampak pada omzet/pembukuan yang baru diselaraskan.

