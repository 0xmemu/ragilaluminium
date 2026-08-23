# ADR-015 — KPI Performa Toko dan Event Finansial

Tanggal draft: 2026-08-24
Dasar: implementasi KPI Task 1-4 (commit `d747e15` `3195faa` `ef825ab` `9cb88bf`) + final review.
ADR-015 KPI Performa Toko — disetujui (Accepted) 2026-08-24. Melengkapi definisi ADR-015 omzet yang ada.

## Status

**Accepted**

Tanggal approval: 2026-08-24

---

## Context

Performa Toko perlu memisahkan beberapa konsep untuk menghindari ambiguitas dan laporan yang
menyesatkan:

- **Penjualan (Gross)** vs **Penjualan Bersih** vs **Pembayaran Diterima**: nilai order yang masuk
  alur fulfillment (gross) bukan berarti uang sudah masuk. Pembayaran diterima adalah metrik
  cash-in terpisah. Penjualan bersih adalah gross dikurangi refund retur yang selesai.
- **Refund vs Retur**: refund adalah nominal uang yang dikembalikan pada kasus retur selesai;
  nilai retur adalah nilai produk yang dikembalikan; keduanya berbeda ukuran.
- **Pembatalan**: perlu berbasis event (`event_logs`) bukan snapshot `orders.created_at`, karena
  waktu pembatalan ≠ waktu pembuatan order, dan perlu dibedakan actor (pelanggan vs toko).
- **Produk engagement**: views vs clicks vs jumlah terjual harus dibedakan; data agregat harian.
- **Lifetime / comparison / period reporting**: semua metrik harus mendukung periode, perbandingan
  periode sebelumnya, dan granularity (sampai tahun) secara konsisten (WIB, half-open).

## Decisions

### 1. Penjualan (Gross)

- `SUM(orders.total_amount)`.
- Scope `order_status IN (REVENUE_STATUSES)` = `processing, shipped, delivered, completed,
  return_in_process, return_completed`.
- Basis waktu: `orders.created_at`.
- **Ini bukan** pembayaran diterima, settlement, atau laba. Semua pesanan (transfer & COD) dihitung
  sejak `processing` (ADR-015 existing, dipertahankan).

### 2. Penjualan Bersih

- `Gross - SUM(order_return_cases.refund_amount)` untuk return case yang `status='completed'`.
- Sumber refund: `order_return_cases.refund_amount` (bukan payment ledger).
- Basis waktu refund: `completed_at`.
- **Refund tidak boleh dihitung dua kali** dari payment ledger (payment `refunded` tidak dikurangi
  lagi dari net; `payments_received` hanya status `completed`).

### 3. Pembayaran Diterima

- `SUM(payments.amount)` WHERE `payments.status = 'completed'`.
- Event date: `payments.paid_at`.
- `payments` `refunded`, `cancelled`, `pending` TIDAK masuk.
- `paid_at` null dikeluarkan.

### 4. COD

- Pembayaran COD dianggap `paid` saat status pengiriman `delivered` sesuai lifecycle yang sudah
  ditetapkan (Sprint 2 retur), didukung `ReturnService::markDeliveredAndSettleCod` idempotent.
- `cod_paid` (KPI) = `SUM(payments.amount)` utk payment `payment_method='cod'` + `status='completed'`
  + `paid_at` in period. Dibaca dari **ledger**, bukan `SUM(orders.total_amount)`, untuk menghindari
  double-count.
- Definisi konsisten dengan payment ledger; tidak menghasilkan double-count.

### 5. Retur

- **Retur Diajukan** (`returns_created`): return case `created_at` in period.
- **Retur Aktif** (`returns_open`): return case `status='open'` **saat laporan dibuat** (snapshot
  current), BUKAN histori akhir periode (histori retur-aktif tidak dapat direkonstruksi dari struktur
  existing). Detail: "Kasus retur yang masih terbuka saat laporan dibuat."
- **Retur Selesai** (`returns_completed`): return case `status='completed'` + `completed_at` in period.
- **Refund Diberikan** (`refund_given`): `SUM(refund_amount)` pada return case selesai (konsisten
  dgn `financial.refund_adjustments`).
- **Nilai Retur** (`return_value`): `returned_quantity × order_items.unit_price` pada return case
  selesai.
- **Rasio Retur Diajukan**: `returns_created / orders` (order fulfillment) × 100.
- **Rasio Retur Selesai**: `returns_completed / completed_orders` × 100.

### 6. Pembatalan

- Source: `event_logs`.
- `event_type = 'order_status_changed'`.
- `payload.order_status = 'cancelled'`.
- Event date: `event_logs.created_at`.
- `COUNT(DISTINCT entity_id)` (dedupe; `cancelled` terminal).
- Actor: `created_by_user_id IS NULL` = pelanggan; terisi = admin/toko.
- **`payload.source` TIDAK digunakan sebagai actor canonical** (selalu `admin_cancel`).
- `cancellation_rate` = `cancelled / (cancelled + orders_fulfillment) × 100`; 0 bila denom 0.

### 7. Pelanggan

- Identity key: `orders.customer_phone`.
- **Cancelled order tidak dihitung sebagai repeat order valid.**
- Repeat customers = phone dgn order prior (valid); new = phone pertama kali di periode.
- `repeat_order_rate` = `repeat / (new + repeat) × 100`.

### 8. Produk

- `top_products` legacy dipertahankan utk compatibility
  (berbasis omzet dari `order_items`).

  `best_sellers` adalah ranking terpisah berdasarkan
  `SUM(order_items.quantity)` dalam revenue scope.
- `most_viewed` = ranking `product_views` (`performance_metrics`).
- `most_clicked` = ranking `product_clicks`.
- `best_sellers` = ranking `SUM(order_items.quantity)` pada revenue scope.
- **Product metrics adalah agregat harian** (`performance_metrics.metric_date`), bukan per-event;
  `views` = jumlah tampilan, bukan pengunjung unik.

### 9. Waktu dan comparison

- Timezone: WIB (`Asia/Jakarta`).
- Half-open range (`[start, end)`).
- Period & comparison memakai `resolveRange()` existing (termasuk `is_running` potong di jam sama).
- Retur aktif adalah snapshot current (bukan histori akhir periode).

### 10. Export / UI

- UI memakai Inertia + React + TypeScript (bukan Blade).
- Export XLSX memakai `report`/`service` yang sama (tidak ada query definisi beda).
- `payment_pending_amount` **deferred** (belum tampil; snapshot nominal pending belum reliable).
- Catatan: label financial card masih legacy ("Omset gross/Omset net/Penyesuaian refund") — keputusan
  polish di Open items.
- Catatan: `ProductEngagementContractTest` pre-existing failure (href route) — task terpisah.
- Catatan: tab "Produk Terpopuler" belum memakai `most_popular` (views+clicks) — lihat Open items.

---

## Non-goals

- Tidak ada tabel `product_views` per event (tetap agregat harian `performance_metrics`).
- Tidak ada settlement bank otomatis.
- Tidak ada nominal ongkir retur otomatis.
- Tidak ada `payment_pending_amount` sampai ada snapshot yang reliable.
- Tidak ada perubahan schema payment hanya untuk KPI.
- Tidak ada perubahan lifecycle retur/order dari ADR ini.

---

## Compatibility

Implementasi saat ini menjaga:

- `StorePerformanceService::build()` signature (`build(period, from, to, granularity)`).
- `resolveRange()`.
- Timezone WIB.
- Half-open boundary.
- Semua key legacy & section existing.
- React/Inertia (`StorePerformance.tsx`).
- Export XLSX (`AnalyticsController`).
- Test existing (termasuk contract, F10 rules, export, Task 1-3).

---

## Open items

Hanya:

- Apakah label legacy financial card akan dipoles (dari "Omset gross/Omset net/Penyesuaian refund"
  ke "Penjualan (Gross)/Penjualan Bersih")? Ini butuh keputusan pemilik; bukan perubahan ADR ini.
- Apakah key `most_popular` (views + clicks) akan ditambahkan utk tab "Produk Terpopuler"?
- Apakah `ProductEngagementContractTest` diperbaiki dalam task terpisah (pre-existing failure)?

Tidak ada keputusan baru lain yang ditambahkan di draft ini.

---

## Konfirmasi

- File ini DRAFT lokal, tidak menggantikan ADR-015 yang ada sampai direview & disetujui.
- Tidak ada source code yang diubah.
- Tidak ada database/migration yang diubah.
- Tidak ada commit/push; tidak ada perubahan VPS.
- Tidak mengubah ADR existing.