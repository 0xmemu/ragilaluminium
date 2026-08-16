# Feature 03 — Cart dan Checkout Guest

**Status implementasi:** cart/guest checkout sebagian berjalan di VPS; target belum dianggap selesai. **Aktor:** customer guest, sistem, admin.

## Customer flow
1. Cart menampilkan line/varian/qty/stok/harga/subtotal; catatan diisi per item pada tahap checkout, bukan di alamat/cart global.
2. Selection mode off: semua cart masuk checkout. On: hanya checked lines. On tanpa pilihan meminta user memilih; lainnya tetap cart.
3. Catatan per produk sebelum alamat; tidak ada catatan alamat/global.
4. Alamat, ongkir, payment, review.
5. Item, ongkir normal, subsidi, net, ETA hasil display (sudah termasuk buffer +1 hari sekali), total.
6. Submit idempotent → Menunggu Konfirmasi, nomor order, WhatsApp.
Email dihapus sepenuhnya dan bukan fallback status.

## UI/UX dan admin
Loading cegah double submit; retry aman. Empty cart, stock/price changed, archived variant, shipping pending/error, COD unavailable punya state Bahasa Indonesia. COD dijelaskan saat dipilih dan Transfer ditawarkan. Admin melihat pending, snapshot/catatan, breakdown, lifecycle; manual-review ongkir notifikasi. Edit/status perlu audit.

## Backend/API/database
Server hitung ulang subtotal/promo/ongkir/subsidi/total. Session/idempotency dipertahankan; stock tepat sekali. WhatsApp failure tidak menggandakan. orders: customer/phone/address/payment/shipping/status. order_items: product/variant/qty/price/dimensi/note. Timeline/audit. Jangan tambah email/catatan global; schema/API baru update docs dahulu.

## Permissions/validation/acceptance
Guest session/order sendiri via nomor+HP; admin role contract. Validasi qty/stok/variant/address/payment/COD/duplicate. Selection, catatan, no email, total server-side, idempotency, pending, COD reason, no partial/duplicate harus lulus. Instruksi transfer/optimistic UI/reserve policy terbuka.
