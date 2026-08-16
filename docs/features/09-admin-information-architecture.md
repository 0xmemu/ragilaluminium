# Feature 09 — Admin Information Architecture

**Status implementasi:** target IA; menu/label runtime perlu audit sitemap. Tujuan: workflow mudah ditemukan tanpa mengurangi fitur.

## Struktur target
Dashboard tanpa hamburger; Performa Toko; Produk (produk/varian/media/import; Import Performance di Import); Pesanan (list/detail/payment/shipping/tracking/return); Harga & Promo; Konten; Akun & Sistem (settings/Log Aktivitas/notifikasi/integrasi).
Payment/shipping/tanggal/umur tetap Filter Lanjutan Pesanan. Media Library global berbeda media scoped Hasil Pemasangan.

## Admin UX workflows and states
Order: Pesanan → filter → Filter Lanjutan → detail → payment/shipping/tracking/return → timeline. Produk: Produk → Import → upload/riwayat → Import Performance → validasi. Performa: periode → KPI → breakdown. Sistem: Akun & Sistem → log/notifikasi/settings.
Sidebar active/parent/keyboard/responsive/breadcrumb/title/loading/error/empty/notification clear. Narrow nav tidak menyembunyikan item penting; planned route tidak live.

## Backend/sitemap/permissions
IA tidak menambah route karena label. Audit config/admin-sitemap.php, docs/sitemap/admin-*, route/controller. Route/permission baru update API/routes/schema docs dan tests. Role equal admin. Target UI belum selesai sampai link diverifikasi.

## Acceptance/open
Performa top-level; Log Aktivitas di Akun & Sistem; Import Performance dari Produk; advanced filter tidak membanjiri sidebar; no dashboard hamburger; Media Library/Hasil Pemasangan jelas; links valid/active. Open urutan final/frekuensi/sitemap/responsive breakpoint. Pindah menu tidak menghapus backend feature.
