# Feature 07 — Retur, Refund, dan Penggantian

**Status implementasi:** admin-only record target belum selesai. Customer via WhatsApp; admin form internal; tidak ada form publik.

## Customer flow
Setelah Sampai atau Selesai, customer kirim kronologi dan foto/unboxing via WhatsApp. Sebelum tiba adalah shipping exception/support.

## Admin dashboard UI/UX
Panel case: reason wajib (rusak/pecah/salah ukuran/salah produk/kurang/lainnya), detail, kronologi, evidence/reference pesan, inspeksi, tanggal/actor, item/qty, resolution, before/after total, completion. Save/error mencegah catatan hilang; empty evidence = belum diterima. Public timeline aman; notes/evidence admin-only; Issue tetap internal.

## Resolution/finance
Refund penuh/sebagian (amount/method/date/reference/proof), replacement product/variant/size+qty, reship, kompensasi, selisih harga, ongkir tambahan/subsidi, no compensation. Retur Selesai berarti dokumentasi selesai, bukan otomatis refund.

## Backend/API/database
Guard order Sampai/Selesai; reason/detail lainnya wajib; refund > refundable perlu override/alasan; replacement valid; selisih/ongkir jelas; completion butuh resolution/financial/replacement docs; action idempotent. Endpoint/form baru belum terkontrak; update docs dahulu. Database terstruktur return case/items, resolution, refund/adjustment, evidence, actor/timestamps; status tidak hanya order_status. Semua report/note/resolution/refund/replacement/shipping adjustment masuk Riwayat Pesanan.

## Permissions/acceptance/open
Customer report WhatsApp; admin create/complete; worker authorized kelak. Acceptance no public form, reason/resolution/finance documented, pre-arrival excluded, completion tidak otomatis potong omzet, timeline aman. Open multiple/partial, approval, automatic refund, SLA/template.
