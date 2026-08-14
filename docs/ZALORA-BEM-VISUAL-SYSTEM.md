# Zalora-Inspired BEM & Visual System Guideline

## Tujuan

Dokumen ini menjadi pedoman implementasi untuk agents yang membangun komponen katalog produk/e-commerce dengan pendekatan enterprise-grade, terinspirasi dari pola visual Zalora.

Fokus utama:

- Menerjemahkan struktur visual menjadi komponen BEM yang jelas.
- Menjaga konsistensi ukuran, spacing, typography, warna, dan hierarchy.
- Menggunakan design tokens agar sistem mudah dikembangkan.
- Menggunakan data-driven rendering, bukan duplikasi komponen.
- Menghindari penggunaan `absolute positioning` untuk layout utama.

> Catatan: Spesifikasi sumber berasal dari dump layout Figma. Nilai posisi absolut dari Figma tidak boleh diterjemahkan secara mentah menjadi CSS produksi. Gunakan flexbox/grid untuk flow layout dan gunakan absolute positioning hanya untuk overlay.

---

## Prinsip Utama

### 1. Component-first

Setiap komponen harus mempunyai tanggung jawab yang jelas. Jangan membangun UI berdasarkan nama teknis seperti `container-1`, `container-margin`, atau `frame-204`.

Gunakan nama berdasarkan domain dan fungsi:

- `product-card`
- `product-grid`
- `product-card__media`
- `product-card__title`
- `product-card__pricing`
- `product-card__button`

### 2. Satu block untuk satu domain component

Gunakan satu block `product-card` untuk berbagai kondisi produk.

Gunakan modifier untuk perbedaan state:

```text
.product-card
.product-card--discounted
.product-card--regular
.product-card--compact
.product-card--no-action
.product-card--horizontal
```

Jangan membuat banyak block yang hanya berbeda karena ada/tidaknya diskon.

### 3. Layout menggunakan flow

Gunakan:

- `display: flex` untuk struktur vertikal dan horizontal.
- `display: grid` untuk kumpulan produk.
- `gap` untuk spacing antar-elemen.
- `min-height` untuk menjaga stabilitas layout.
- `line-clamp` untuk membatasi teks.

Gunakan `position: absolute` hanya untuk:

- Wishlist button di atas image.
- Discount badge.
- Floating action.
- Icon overlay.
- Carousel navigation.

### 4. Konsistensi lebih penting daripada pixel-copy

Nilai dari Figma harus dipakai sebagai referensi sistem, bukan sebagai kumpulan angka yang berdiri sendiri. Pertahankan relasi antar-ukuran:

```text
card width
  -> card padding
    -> content width
      -> image width
      -> text width
      -> button width
```

---

## Struktur Komponen

Struktur BEM utama:

```text
product-grid
└── product-card
    ├── product-card__media
    │   ├── product-card__link
    │   ├── product-card__image
    │   ├── product-card__favorite
    │   └── product-card__badge
    ├── product-card__content
    │   ├── product-card__brand
    │   ├── product-card__title
    │   └── product-card__pricing
    │       ├── product-card__price
    │       ├── product-card__original-price
    │       └── product-card__discount
    └── product-card__action
        └── product-card__button
```

### HTML reference

```html
<article class="product-card product-card--discounted">
  <div class="product-card__media">
    <a class="product-card__link" href="/products/example">
      <img
        class="product-card__image"
        src="/images/product.webp"
        alt="Terry Tonal Logo Pullover Hoodie"
      />
    </a>

    <button
      class="product-card__favorite"
      type="button"
      aria-label="Tambahkan ke wishlist"
      aria-pressed="false"
    >
      <svg aria-hidden="true"></svg>
    </button>
  </div>

  <div class="product-card__content">
    <a class="product-card__brand" href="/brands/example">
      GAP
    </a>

    <a class="product-card__title" href="/products/example">
      Terry Tonal Logo Pullover Hoodie
    </a>

    <div class="product-card__pricing">
      <span class="product-card__price">Rp1.479.000</span>
      <span class="product-card__original-price">Rp1.499.000</span>
      <span class="product-card__discount">-1%</span>
    </div>
  </div>

  <div class="product-card__action">
    <button class="product-card__button" type="button">
      Pesan
    </button>
  </div>
</article>
```

---

## Visual Formula

### Product card

```text
Outer item width       : 145px
Card width             : 139px
Card padding           : 6px
Inner content width    : 127px
Image size             : 127px x 183.21px
Content top padding    : 8px
Action button          : 127px x 40px
Card radius            : 12px
Image radius           : 8px
Button radius          : 8px
Wishlist size          : 28px x 20px
```

Relationship:

```text
item-width = card-width + right-spacing
item-width = 139px + 6px = 145px

content-width = card-width - horizontal-padding
content-width = 139px - 6px - 6px = 127px
```

Semua elemen utama di dalam kartu harus menggunakan `127px` atau `width: 100%` dari content wrapper agar sejajar.

### Product media

```text
width: 100%;
aspect-ratio: 127 / 183.21;
overflow: hidden;
border-radius: 8px;
background: rgba(244, 244, 244, 0.5);
```

Gunakan `object-fit: cover` bila semua image harus memenuhi frame. Gunakan `object-fit: contain` bila produk perlu terlihat utuh dan background image bersifat penting.

### Product content

Urutan informasi:

```text
brand
product title
current price
original price
promotion badge
```

Brand dan title harus tetap mempunyai tinggi terkontrol agar kartu dalam satu row tetap stabil.

### Action

```text
button width  : 100%
button height : 40px
button radius : 8px
button border : 1px solid #474747
```

Action button harus ditempatkan setelah content menggunakan normal document flow. Jangan memposisikan button dengan koordinat absolut.

---

## Design Tokens

Gunakan token berikut sebagai baseline. Token dapat diubah melalui theme tanpa mengubah struktur komponen.

```css
:root {
  /* Color */
  --color-text-primary: #000000;
  --color-text-secondary: #737373;
  --color-text-default: #262626;
  --color-text-muted: #6d6e6e;
  --color-brand-red: #b81818;
  --color-discount-text: #c81e1e;
  --color-discount-bg: #fdf2f2;
  --color-border: #474747;
  --color-border-muted: #e5e7eb;
  --color-surface: #ffffff;
  --color-image-surface: rgba(244, 244, 244, 0.5);

  /* Typography */
  --font-family-base: "Segoe UI", sans-serif;
  --font-size-xs: 10px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 24px;

  --line-height-xs: 16px;
  --line-height-sm: 20px;
  --line-height-md: 24px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 6px;
  --space-3: 8px;
  --space-4: 12px;
  --space-5: 16px;
  --space-6: 20px;
  --space-7: 24px;
  --space-8: 40px;

  /* Radius */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Component dimensions */
  --product-card-width: 139px;
  --product-card-padding: 6px;
  --product-card-content-width: 127px;
  --product-card-image-height: 183.21px;
  --product-card-action-height: 40px;
  --product-card-item-spacing: 6px;
}
```

---

## CSS Reference

```css
.product-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--product-card-width), 1fr)
  );
  gap: 12px var(--product-card-item-spacing);
}

.product-card {
  display: flex;
  flex-direction: column;
  width: var(--product-card-width);
  min-width: 0;
  padding: var(--product-card-padding);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.product-card__media {
  position: relative;
  width: 100%;
  height: var(--product-card-image-height);
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--color-image-surface);
}

.product-card__link {
  display: block;
  width: 100%;
  height: 100%;
}

.product-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-card__favorite {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  width: 28px;
  height: 20px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.product-card__content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-top: var(--space-3);
}

.product-card__brand,
.product-card__title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  text-decoration: none;
}

.product-card__brand {
  color: var(--color-text-primary);
  font: 700 var(--font-size-sm)/var(--line-height-sm) var(--font-family-base);
  -webkit-line-clamp: 1;
}

.product-card__title {
  min-height: 40px;
  color: var(--color-text-secondary);
  font: 400 var(--font-size-sm)/var(--line-height-sm) var(--font-family-base);
  -webkit-line-clamp: 2;
}

.product-card__pricing {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 44px;
  margin-top: var(--space-1);
}

.product-card__price {
  color: var(--color-brand-red);
  font: 700 var(--font-size-sm)/var(--line-height-sm) var(--font-family-base);
}

.product-card__original-price {
  position: absolute;
  top: 24px;
  left: 0;
  color: var(--color-text-default);
  font: 400 var(--font-size-sm)/var(--line-height-sm) var(--font-family-base);
  text-decoration: line-through;
}

.product-card__discount {
  position: absolute;
  top: 24px;
  right: 0;
  padding: 0 2px;
  border-radius: var(--radius-md);
  background: var(--color-discount-bg);
  color: var(--color-discount-text);
  font: 400 var(--font-size-xs)/var(--line-height-xs) var(--font-family-base);
}

.product-card__action {
  padding-top: var(--space-6);
}

.product-card__button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--product-card-action-height);
  padding: 0 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-default);
  font: 400 var(--font-size-sm)/var(--line-height-sm) var(--font-family-base);
  cursor: pointer;
}
```

---

## Data Model

Komponen harus menerima data, bukan mempunyai data produk hardcoded di dalam UI component.

```ts
export type ProductCardData = {
  id: string
  brand: string
  name: string
  image: string
  imageAlt?: string
  href: string
  brandHref?: string
  price: number
  originalPrice?: number
  discountPercentage?: number
  isWishlisted?: boolean
  actionLabel?: string
  isAvailable?: boolean
}
```

Contoh transformasi state:

```ts
const classes = [
  'product-card',
  product.originalPrice && 'product-card--discounted',
  !product.isAvailable && 'product-card--unavailable',
  !product.actionLabel && 'product-card--no-action',
].filter(Boolean).join(' ')
```

Aturan:

- `originalPrice` menentukan apakah harga coret ditampilkan.
- `discountPercentage` menentukan apakah discount badge ditampilkan.
- `isWishlisted` hanya menentukan visual/icon state.
- `isAvailable` menentukan disabled/unavailable state.
- `actionLabel` menentukan label action button.

---

## Responsive Layout

Sumber layout menunjukkan area mobile sekitar `430px` dengan padding horizontal `16px`, menghasilkan content width sekitar `398px`.

Gunakan formula berikut:

```css
.page-section {
  width: min(calc(100% - 32px), 1280px);
  margin-inline: auto;
}
```

Contoh responsive grid:

```css
.product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 8px;
}

@media (min-width: 640px) {
  .product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .product-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
```

Jika desain membutuhkan ukuran kartu tetap seperti referensi Figma, gunakan:

```css
.product-grid {
  grid-template-columns: repeat(auto-fill, 139px);
  justify-content: space-between;
}
```

Pilih salah satu strategi dan konsisten. Jangan mencampur fixed card width dan fractional width tanpa alasan desain yang jelas.

---

## Typography Hierarchy

```text
Product brand       : 14px / 20px, weight 700, #000000
Product title       : 14px / 20px, weight 400, #737373
Current price       : 14px / 20px, weight 700, #B81818
Original price      : 14px / 20px, weight 400, #262626
Discount label      : 10px / 16px, weight 400, #C81E1E
Body content        : 16px / 24px, weight 400, #6D6E6E
Section heading     : 14px / 20px, weight 700, uppercase
Large page heading  : 24px / 24px, weight 400
```

Aturan typography:

- Gunakan line-height eksplisit.
- Jangan mengandalkan default browser line-height.
- Brand maksimal satu baris.
- Product title maksimal dua baris.
- Jangan memperkecil font hanya untuk menghindari overflow.
- Gunakan ellipsis/line clamp untuk menjaga konsistensi.

---

## Accessibility

Implementasi production wajib memperhatikan:

- Image memiliki `alt` yang relevan.
- Wishlist button memiliki `aria-label`.
- State wishlist menggunakan `aria-pressed`.
- Semua interactive element dapat diakses melalui keyboard.
- Focus state harus terlihat.
- Jangan menggunakan `div` sebagai pengganti button/link.
- Link brand dan product title harus memiliki target yang jelas.
- Kontras teks dan background harus tetap terbaca.

Contoh focus state:

```css
.product-card__button:focus-visible,
.product-card__favorite:focus-visible,
.product-card__link:focus-visible,
.product-card__brand:focus-visible,
.product-card__title:focus-visible {
  outline: 2px solid var(--color-brand-red);
  outline-offset: 2px;
}
```

---

## Do and Don't

### Do

- Gunakan `product-card` sebagai block utama.
- Gunakan element BEM untuk bagian internal.
- Gunakan modifier untuk variant.
- Gunakan CSS variables/design tokens.
- Gunakan flexbox/grid untuk struktur.
- Gunakan line clamp pada text yang tidak stabil.
- Gunakan data model yang eksplisit.
- Buat komponen mudah di-render dari API.
- Pertahankan lebar internal image, text, dan button tetap sejajar.

### Don't

- Jangan menyalin nama `Container` dari Figma sebagai class production.
- Jangan membuat `.container-1`, `.container-2`, dan seterusnya.
- Jangan menggunakan `position: absolute` untuk menyusun seluruh kartu.
- Jangan hardcode data produk di dalam komponen presentational.
- Jangan membuat komponen duplikat untuk setiap kondisi diskon.
- Jangan mengandalkan tinggi teks natural tanpa line clamp.
- Jangan memakai angka order seperti `order: 204` sebagai sistem layout.
- Jangan memperbaiki overflow dengan mengecilkan typography secara acak.
- Jangan menghapus focus state.
- Jangan membuat button hanya berupa anchor jika aksinya mengubah state.

---

## Agent Implementation Checklist

### Struktur

- [ ] Ada block `product-card`.
- [ ] Internal elements mengikuti format `product-card__element`.
- [ ] Variant menggunakan modifier `product-card--modifier`.
- [ ] Tidak ada nama class berbasis urutan export Figma.

### Visual

- [ ] Card menggunakan padding yang konsisten.
- [ ] Image, content, dan button memiliki alignment yang sama.
- [ ] Image ratio konsisten.
- [ ] Brand maksimal satu baris.
- [ ] Product title maksimal dua baris.
- [ ] Harga diskon menggunakan warna merah.
- [ ] Harga asli memakai strike-through.
- [ ] Discount badge menggunakan background merah muda.
- [ ] Wishlist button menjadi overlay di area image.

### Layout

- [ ] Struktur utama menggunakan flex/grid.
- [ ] Absolute positioning hanya untuk overlay.
- [ ] Product grid responsive.
- [ ] Tidak ada layout yang bergantung pada koordinat absolut dari Figma.
- [ ] Tidak ada elemen yang keluar dari card pada nama produk panjang.

### Data dan state

- [ ] Komponen menerima data melalui props.
- [ ] Diskon ditentukan dari data.
- [ ] Wishlist state dapat berubah secara independen.
- [ ] Product availability diperlakukan sebagai state.
- [ ] Action button mendukung loading, disabled, dan success state jika diperlukan.

### Accessibility

- [ ] Semua image memiliki alt.
- [ ] Button memiliki label yang jelas.
- [ ] Focus state terlihat.
- [ ] Keyboard interaction berjalan.
- [ ] Semantic HTML digunakan.

---

## Recommended Component API

```tsx
<ProductCard
  product={{
    id: 'prod-001',
    brand: 'GAP',
    name: 'Terry Tonal Logo Pullover Hoodie',
    image: '/images/hoodie.webp',
    imageAlt: 'Terry Tonal Logo Pullover Hoodie',
    href: '/products/terry-tonal-logo-pullover-hoodie',
    price: 1479000,
    originalPrice: 1499000,
    discountPercentage: 1,
    isWishlisted: false,
    isAvailable: true,
    actionLabel: 'Pesan',
  }}
  onWishlistChange={handleWishlistChange}
  onAction={handleProductAction}
/>
```

Component API harus stabil dan tidak mengekspos detail layout internal seperti `containerWidth`, `innerTop`, atau `absoluteTop`. Expose hanya data dan behavior yang benar-benar diperlukan.

---

## Definition of Done

Implementasi dianggap selesai apabila:

1. Struktur HTML mengikuti BEM.
2. Semua visual utama berasal dari token.
3. Card tetap stabil untuk nama produk pendek maupun panjang.
4. Layout tidak bergantung pada absolute positioning untuk flow utama.
5. Komponen dapat menampilkan produk normal, diskon, unavailable, dan wishlist state.
6. Grid berjalan pada mobile dan desktop.
7. Interactive element dapat digunakan melalui keyboard.
8. Tidak ada class berbasis nama layer atau nomor urutan Figma.
9. Tidak ada duplikasi komponen untuk perbedaan state kecil.
10. Component dapat menerima data dari API tanpa perubahan struktur visual.
