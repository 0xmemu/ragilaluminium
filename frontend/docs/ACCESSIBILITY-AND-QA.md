# Accessibility and QA

## Accessibility baseline

- HTML landmark dan heading order semantik.
- Skip link menuju main content.
- Semua control memiliki accessible name.
- Focus ring terlihat pada keyboard.
- Touch target minimum 44x44px.
- Body text memenuhi WCAG AA; target AAA untuk copy utama.
- Status tidak disampaikan dengan warna saja.
- Dialog/sheet memiliki title, description, focus trap, Escape, dan focus return.
- Form error terhubung melalui `aria-describedby` dan form summary bila perlu.
- Image dekoratif memakai alt kosong; product image memakai nama produk.
- Reduced motion menonaktifkan non-essential animation.

## Responsive matrix

- 360x800
- 390x844
- 768x1024
- 1024x768
- 1440x900

Periksa overflow horizontal, CTA wrap, sticky collision, nav line wrap, table fallback, dan safe
area mobile.

## Functional matrix

- Home dengan dan tanpa promo/media.
- Catalog normal, empty, multi-page, dan filter aktif.
- PDP tanpa media, satu varian, multi-axis variant, dan out of stock.
- Cart empty, quantity update, dan remove.
- Checkout validation error, pending, success, shipping fallback, dan duplicate-click resistance.
- Order lookup found/not found/mismatch.
- Admin resource empty, paginated, error flash, create/edit, archive, dan upload failure.

## Visual anti-slop gate

- Satu accent red dan satu keluarga neutral.
- Satu icon family.
- Hero muat viewport dan CTA terlihat.
- Tidak ada tiga feature cards identik hanya untuk mengisi ruang.
- Tidak ada eyebrow pada setiap section.
- Tidak ada fake dashboard, angka rekaan, atau stock photo generik.
- Precision Frame dipakai terbatas.
- Tidak ada border/shadow berlebihan.
- Copy dibaca ulang dan tidak terdengar generik.

## Performance targets

- LCP di bawah 2.5 detik pada kondisi representatif.
- INP di bawah 200ms.
- CLS di bawah 0.1.
- Product image memiliki reserved aspect ratio.
- Above-fold image eager; media lainnya lazy.
- Tidak ada scroll listener manual atau animation layout property.

## Required commands

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- `php artisan test`
