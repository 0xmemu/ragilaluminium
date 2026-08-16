# Feature Specifications — Ragil Aluminium

Dokumen ini adalah rujukan desain UI, backend/API, database, QA, dan implementasi bertahap. Sumber keputusan: PRODUCT-HANDOFF, MEMORY, web_spek, admin_spek, dan keputusan owner. Tidak mengubah runtime dengan sendirinya.

## Status dan aturan
- Draft terkonsolidasi; setiap file menandai target yang belum ada di VPS.
- Coding agent wajib membaca kontrak kanonik sebelum mengubah runtime.
- Schema/route/enum/JSON baru wajib sinkron ke docs kanonik.
- Customer guest; admin login; arsipkan, jangan hard-delete transaksi.
- Admin melihat operasional lengkap; customer hanya subset aman.
- Perubahan penting masuk timeline Riwayat Pesanan dan audit log.

## Peta fitur
| Dokumen | Fitur | Status |
|---|---|---|
| 01-search.md | Search pintar tanpa AI | Baseline dikunci; ranking terbuka |
| 02-share-product.md | Share Produk | Baseline dikunci; coding belum ada |
| 03-cart-checkout.md | Cart dan Checkout | Aturan dikunci; sebagian berjalan |
| 04-address-shipping.md | Alamat/kode pos/ongkir | Dataset kode pos prioritas |
| 05-order-lifecycle.md | Siklus order | Aturan dikunci; status perlu sync |
| 06-tracking.md | Tracking order | UI target; adapter bertahap |
| 07-return-refund.md | Retur/refund/penggantian | Admin-only record |
| 08-store-performance.md | Performa Toko | Dampak retur dikunci |
| 09-admin-information-architecture.md | IA Admin | Arah navigasi dikunci |
