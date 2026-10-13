# Feature 02 — Share Produk

**Status implementasi:** belum dianggap diimplementasikan. **Aktor:** customer guest dari PDP. Baseline share-to-contact dikunci.

## End-to-end customer flow
1. User membuka PDP dan memilih varian.
2. Menekan ikon Bagikan.
3. Sistem membentuk canonical URL dengan variant context bila valid.
4. Native Web Share bila tersedia; fallback WhatsApp atau Salin Link.
5. Feedback tidak mengubah cart/varian.
Share WhatsApp tidak memiliki nomor tujuan tetap; berbeda dari Konsultasi ke nomor bisnis dan notifikasi order.

## UI/UX states
Ikon accessible “Bagikan produk”; sheet Native Share/WhatsApp/Salin Link; copy nama-varian-link; loading URL/metadata; clipboard denied; native cancel/unsupported; error Bahasa Indonesia. Fallback selalu tersedia.

## Admin, backend, database
Tidak ada workflow admin wajib. Analytics share bila dipilih hanya agregat Performa Toko; UI admin belum dikunci. Baseline tidak perlu tabel/endpoint bila client membentuk URL canonical. Resolver validasi product/variant aktif dan fallback parent. OpenGraph/Twitter title, deskripsi aman, cover, canonical URL. URL/pesan tidak memuat PII/order. Analytics anonim membutuhkan update docs sebelum migration.

## Permissions, edge cases, acceptance
Guest hanya produk visible; archived/unpublished not-found; deleted variant fallback; clipboard failure manual copy. Ikon responsive/accessible, variant context, native/WhatsApp/copy fallback, preview benar, tanpa data customer. Parameter variant-aware dan analytics masih terbuka; tidak mencakup konsultasi/checkout/referral.
