# Teruskan Popularitas

Status: implemented

## Tujuan

Admin dapat mengarahkan popularitas produk aktif A ke produk aktif B tanpa memindahkan riwayat order.

## Alur

1. Admin memilih produk sumber A dan target B di Produk → Teruskan Popularitas.
2. Sistem menghitung penjualan valid A dari `order_items` yang order-nya berstatus fulfillment.
3. Nilai tersebut disimpan sebagai `seed_sold_count` pada konfigurasi dan `products.popularity_seed` pada target.
4. Skor target untuk ranking populer adalah `popularity_seed + penjualan valid target`.
5. A dan B tidak harus model yang sama dan tetap merupakan produk aktif terpisah.
6. Admin dapat menonaktifkan konfigurasi dengan alasan wajib. Seed target dikosongkan; order history tidak disentuh.
7. Ambang notifikasi opsional membuat notifikasi admin satu kali ketika penjualan aktual A mencapai ambang. Evaluasi otomatis berjalan saat order sumber masuk event fulfillment valid; halaman konfigurasi juga melakukan evaluasi ulang.

## Review

Saat boost aktif, ulasan website milik A ikut tampil pada PDP B. Data backend tetap menyimpan `cms_testimonials.product_id = A; payload PDP tidak menampilkan tautan produk sumber untuk ulasan turunan.

## Audit

Aktif, nonaktif, reaktif, dan notifikasi ambang dicatat di `event_logs`. Notifikasi admin memakai `admin_notifications`.

## Kontrak route

- `GET /admin/products/popularity-boosts`
- `POST /admin/products/popularity-boosts`
- `POST /admin/products/popularity-boosts/{boost}/disable`
- `POST /admin/products/popularity-boosts/{boost}/enable`
