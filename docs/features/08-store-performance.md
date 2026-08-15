# Feature 08 — Performa Toko

Status implementasi: P0 selesai di backend/UI; P1 reconciliation dikunci oleh test. Aktor: admin. Route existing: admin.analytics.store-performance (+ export).

## Kontrak sumber data

- Gross/Omset berasal dari order yang sudah masuk fulfillment: processing, shipped, delivered, completed, return_in_process, return_completed. pending_payment, cancelled, dan issue tidak dihitung sebagai retur.
- Pesanan Selesai hanya order_status=completed; delivered tidak dianggap selesai.
- Unit/model membaca snapshot order_items (product_category, product_model, design_variant, SKU/nama fallback), bukan katalog live. Ini menjaga histori ketika katalog berubah/dihapus.
- Retur hanya dihitung dari order_return_cases yang completed + completed_at pada periode, dan order_return_items.returned_quantity > 0. Nilai retur memakai unit price snapshot x jumlah benar-benar kembali. Refund adjustment terpisah dari nilai barang; net = gross - refund_adjustments.
- Waktu konfirmasi memakai event log pending_payment ke processing, bukan payment paid_at. Waktu proses memakai event processing dan waktu pembuatan resi pertama.
- Visitor memakai event dedupe visitor_hash + visit_date; periode menghitung distinct visitor hash. Legacy performance_metrics hanya fallback untuk data sebelum migration.

## Admin UI/UX end-to-end

Performa Toko -> pilih periode/granularitas -> ringkasan gross/refund/net -> 3 grup KPI (Penjualan, Kunjungan & Layanan, Operasional), masing-masing 5 KPI -> trend revenue/visitor/unit -> top products/customer/payment mix -> export CSV. UI tetap 15 KPI, responsif, keyboard-accessible, dan memberi loading/empty/error lewat layout/list existing. Financial summary bukan KPI tambahan.

KPI:
1. Omset gross; 2. Jumlah Pesanan; 3. Model/Sub Model Terjual; 4. Unit; 5. Harga rata-rata/unit; 6. unique visitors; 7. conversion; 8. customer baru; 9. customer repeat historis; 10. completed; 11. belum selesai; 12. jumlah order retur aktual; 13. nilai barang retur; 14. rata-rata konfirmasi; 15. rata-rata proses.

## Backend/database/permission

Migration forward-only menambah snapshot item, return ledger minimum (order_return_cases + order_return_items), dan performance_visitor_events. Admin-only controller memakai service; customer tidak menerima analytics atau PII. Event/status, shipping record, dan ledger menjadi jejak audit yang dapat direkonsiliasi. Cancellation history tetap tersimpan di orders dan event log meski tidak menjadi KPI utama.

## Acceptance criteria

- Report selalu mengirim 15 KPI + financial gross/refund/net.
- Delivered tidak masuk completed; issue tidak menaikkan retur.
- Return case tanpa returned_quantity tidak menaikkan return count/value.
- Model count tidak memakai SQL || atau katalog live.
- Repeat customer memiliki order non-cancelled sebelum periode.
- Visitor unik tidak double-count dalam hari/periode; series mengikuti granularitas yang dipilih.
- Timing hanya menghitung pasangan event valid; order tanpa event/resi tidak dipaksa menjadi nol sample.
- Export memakai data service yang sama; tidak ada fake data.

## Open risks / pekerjaan lanjutan

- Admin form workflow untuk mengisi order_return_cases/order_return_items tetap bagian fitur Order Lifecycle & Retur; Performa Toko membaca ledger dan menampilkan nol bila ledger belum diisi.
- Revenue pada issue setelah pembayaran masih memerlukan keputusan akuntansi eksplisit; saat ini issue dikecualikan agar tidak mengakui nilai yang belum punya status fulfillment final.
- Visitor hash berbasis session; dedupe lintas browser/perangkat belum mungkin tanpa identifier consented.
