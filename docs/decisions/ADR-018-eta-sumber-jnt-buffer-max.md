# ADR-018: Sumber ETA Estimasi Tiba = estimateTime J&T + Buffer 1 Hari di Batas Lambat

Status: Accepted
Tanggal: 2026-09-02
Keputusan: Owner (Ragil)

## Konteks

Checkout, konfirmasi order, halaman status pesanan, dan pesan WhatsApp menampilkan
"Estimasi tiba" (rentang tanggal). Sebelumnya rentang ini statis dari konfigurasi
(`SHIPPING_ETA_DELIVERY_MIN/MAX_DAYS`, default 2-5 hari) sehingga semua tujuan
mendapat angka yang sama dan tidak mencerminkan tarif/ETA J&T per rute.

Field `estimateTime` (mis. "1-3") tersedia di response `agingCost/get` J&T dan
selama ini tidak dipakai untuk ETA checkout. Spek (docs/features/04-address-shipping.md,
03-cart-checkout.md, 06-tracking.md) hanya menyebut "ETA hasil display, buffer +1
hari sekali" tanpa mendefinisikan sumber dasarnya; "carrier ETA" tercatat sebagai
Open di 06-tracking.md.

## Keputusan

1. Dasar estimasi = `estimateTime` resmi J&T untuk rute tujuan (dari quote
   `agingCost/get` saat checkout).
2. Buffer tampilan = +1 hari, diterapkan SEKALI dan HANYA di batas lambat (max).
   Min = ETA J&T apa adanya. Contoh: J&T "1-3" → tampil mulai hari ke-1,
   paling lambat hari ke-4 (dihitung dari tanggal order).
3. Tidak ada penambahan hari produksi terpisah ke rentang tampilan; ETA J&T
   sudah mencakup keseluruhan rantai kirim.
4. Fallback: bila J&T tidak mengembalikan `estimateTime` (provider down,
   estimasi provisional lokal), rentang dasar memakai konfigurasi
   (`delivery_min_days`/`delivery_max_days`) + buffer 1 hari di max.
5. `display_buffer_days` tetap dikontrol via konfigurasi/env
   (`SHIPPING_ETA_DISPLAY_BUFFER_DAYS`) dan OperationalSettings bila diisi.

## Implementasi

- `ShippingService::quote()` meneruskan `carrier_eta` (dari `estimateTime`).
- `CheckoutController` shipping preview + shipping quote API ikut membawa `carrier_eta`.
- Hook `use-checkout` menyimpan `carrier_eta` di shippingQuote.
- `CheckoutSummary` menghitung ETA live di frontend: min = carrier min, max = carrier max + 1.
- `OrderEta::forOrder(?Order, ?string $carrierEta)` + `carrierRange()` untuk sisi server
  (order sudah dibuat, WA, tracking).

## Konsekuensi

- Estimasi dinamis per alamat tujuan (Blora ≠ Jakarta).
- Rentang lebih sempit dan jujur dibanding rentang statis.
- Fallback tetap aman saat provider tidak tersedia.
- Spek features 04/06 di-update: sumber ETA = J&T estimateTime; item "carrier ETA"
  pada 06-tracking.md dipindah dari Open ke Defined.
