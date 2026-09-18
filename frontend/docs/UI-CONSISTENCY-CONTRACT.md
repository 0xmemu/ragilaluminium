# UI Consistency Contract — Ragil Aluminium

Status: canonical for active Inertia + React pages (2026-08-06).

This contract replaces legacy visual references to `docs/DESIGN.md`, Blade page
partials, Figma exports, and the former `website_2.0`/`website_3.0` split. The
active implementation is `resources/js` with tokens in `resources/css/app.css`.
It governs new UI and targeted visual fixes; it does not change routes, props,
database fields, or API payloads.

## Foundations

- Font: Apple system font (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`,
  sans-serif) for body, headings, labels, and controls. Use the
  existing `font-sans`/`font-display` mappings; do not introduce a second font.
- Canvas: Mineral Canvas `#FFFFFF`; heading text `#333333`; action text
  `#262626`; body/description text `#737373`; border Aluminium `#DDE2E0`;
  action/promo Signal Red `#C00000`.
- Semantic colors (`success`, `warning`, `info`, `destructive`) are reserved
  for state communication. Red is not a decorative gradient or an all-page
  background.
- Icons come from `@phosphor-icons/react` through
  `resources/js/components/shared/icon.tsx`. Do not add emoji, Lucide, or a
  one-off SVG icon family.
- Product and customer content must be real backend data. Empty, loading,
  error, disabled, and success states are part of the page contract.

## Grid and container

- `.container-page` is the shared page container: `max-width: 112rem`, centered,
  with `1.25rem` mobile, `2rem` tablet, and `3rem` desktop inline padding.
- Public desktop layouts use a 12-column grid. Prefer `gap-5` (20px) for cards
  and `gap-6` (24px) for major page regions. At mobile, multi-column content
  falls back to one column unless it is a compact media/product strip.
- Product listing grids are 2 columns at mobile, 3 at tablet, 4 at desktop,
  and 5 only when the content and card width remain readable. Never compress a
  card merely to fill a row.
- Admin dashboard, index, detail, and form pages use the same 12-column shell.
  Dense tables may span all columns; filters, summaries, and form sections
  should occupy explicit columns rather than arbitrary nested widths.
- Text-heavy content is capped at `68ch`; tables and product grids may use the
  full container.

## Shape, type, and interaction

- Buttons and single-line inputs use the shared pill shape. Textareas and
  content panels use the existing control/panel radius tokens; listing cards
  stay edge-led and do not gain random rounded corners.
- Public navigation chrome (header, navbar, footer, and mobile bottom
  navigation) uses action graphite `#262626` via `bg-action`; header search is
  `36px` high via `h-9` at all breakpoints.
- Headings use sentence case in Indonesian copy unless a brand or proper noun
  requires otherwise. Existing user-facing copy is the assertion source for
  E2E tests; tests must not invent title-case variants.
- Every interactive element has a visible focus state, a keyboard path, and a
  useful accessible name. Icon-only actions require `aria-label`.
- Motion is restrained and respects `prefers-reduced-motion`. Do not use motion
  to hide loading or validation feedback.

### Dropdown admin (Select)

Components in resources/js/components/admin/ui/select.tsx widen to the longest
option label by default (matchOptionWidth), so the width does not jump when the
selection changes and option labels are not clipped. Rules:

- Control width is capped at 384px and popover width at 480px. Options can be
  full product names; without a cap one dropdown widens its whole row and the
  page scrolls horizontally.
- min-width is applied to both the container and the button, so a flex-wrap row
  wraps instead of pushing the button out of its parent box.
- Popover labels wrap (break-words) instead of being clipped. A clipped button
  label must carry a title attribute with the full text.
- A select that must match its parent cell exactly (for example a form grid
  column) sets matchOptionWidth={false}.
- SearchSelect (search-select.tsx) follows the same popover rule, but its trigger
  deliberately does not widen because its option lists can run to hundreds.
- Never insert a wide measuring element into the DOM: lists can hold hundreds of
  options. Select uses a zero-width element; SearchSelect measures with canvas.

### Toast dan notifikasi melayang

Satu gaya kartu untuk semua notifikasi melayang, di storefront maupun admin.
Acuan tampilannya notifikasi langsung admin (`live-notification-manager.tsx`).

- **Tanpa garis tepi.** Pemisahan dari latar ditanggung bayangan (`shadow-2xl`),
  bukan stroke. Kartu berbingkai terlihat tua (keputusan owner 2026-09-19).
- Kelas kartu ada di SATU tempat: `TOAST_CARD_CLASS` di `resources/js/lib/toast.ts`
  (`rounded-xl border-0 bg-surface shadow-2xl`). `border-0` wajib karena komponen
  Alert membawa `border` di kelas dasarnya dan tailwind-merge membuat `border-0`
  menang.
- Permukaan memakai `bg-surface`, yang otomatis putih di storefront dan gelap
  raised di panel admin. Jangan menulis `bg-white` atau `bg-card` di toast.
- Warna belum ditetapkan di kelas kartu: komponen Alert yang menentukan warna
  teks dan ikon per nada (success, danger, info). Menambahkan `text-*` di kelas
  kartu akan menimpa warna itu lewat tailwind-merge dan menghapus maknanya.
- **Wajib diumumkan pembaca layar.** Kontainer toast memakai `role="status"` dan
  `aria-live="polite"` (dan `aria-atomic="true"` bila isinya diganti utuh).
  Toast yang punya tombol aksi seperti "Urungkan" tidak boleh mengandalkan
  penglihatan saja, karena jendelanya pendek.
- **Posisi: tengah atas, TURUN SAMPAI DI BAWAH CHROME halaman**, memakai variabel
  `--toast-top` (didefinisikan di `resources/css/app.css`). Toast tidak boleh
  menimpa header sticky, menu navigasi, atau breadcrumb. Nilai variabel berbeda
  per konteks karena tinggi chrome berbeda:
  - Storefront di bawah 768px (breadcrumb disembunyikan): 120px.
  - Storefront sejak 768px (header 48 + menu 44 + breadcrumb 44 + jarak 12): 156px.
  - Panel admin (header 49 + breadcrumb 35 + jarak 12): 96px.
- Nilai ditulis dalam **PIXEL, bukan rem**: root `font-size` panel admin 14px
  sedangkan storefront 16px, sehingga `rem` menghasilkan piksel berbeda dan
  posisi toast meleset 12px di admin.
- Skala lapisan resmi hanya header 30, overlay 40, modal 50, toast 60. Nilai
  seperti `z-[9999]` dilarang.
- Durasi tampil 4 detik untuk pesan hasil aksi. Durasi lain hanya bila ada
  alasan kuat, misalnya jendela undo yang butuh waktu memutuskan.
- Bentuk: kartu notifikasi boleh punya slot ikon, judul, isi, tautan tindakan,
  dan tombol tutup, mengikuti struktur notifikasi langsung admin.

Pemakai saat ini:

| Notifikasi | Berkas | Sumber |
|---|---|---|
| Flash storefront (sukses/info/error) | `components/shared/flash-messages.tsx` | flash session |
| Flash admin (sukses/info/error) | `components/admin/ui/flash-messages.tsx` | flash session |
| Undo keranjang | `pages/Public/Cart.tsx` | state klien |
| Notifikasi langsung admin | `components/admin/live-notification-manager.tsx` | Reverb + polling |

## Page family templates

| Family | Grid contract | Required shared states |
|---|---|---|
| Catalog, search, flash sale, promo | Breadcrumb/heading row, filter rail or toolbar, responsive product grid | loading, empty, filter reset, error |
| Product detail | 6/6 media and purchase columns on desktop; stacked on mobile | media empty, variant error, stock, reviews, related empty |
| Cart, checkout, order | 7/5 content-summary split on desktop; one column on mobile | empty cart, validation, shipping loading/error, success |
| Public CMS | reading column plus optional 4-column supporting media/grid | content empty, media missing, WhatsApp fallback |
| Admin index | heading/actions, filter row, full-width data region | loading, empty, error, pagination |
| Admin detail/form | primary form/detail column plus secondary summary/action column | dirty, validation, disabled, saved/error |

## QA gate

Visual QA checks the same route at 360, 768, 1024, and 1440px. At each width
verify: no horizontal overflow, aligned container edges, stable card rhythm,
readable copy, keyboard focus, empty/loading/error states, and no accidental
desktop-only action. The browser E2E suite is the functional gate; screenshots
are evidence, not a substitute for route/controller integration.

## Change control

Changes to tokens, grid breakpoints, icon family, or page-family structure must
update this contract and the relevant frontend skill before implementation.
Changes to routes, props, status enums, or API fields must also update the
Product Handoff, sitemap, schema/API contract, and the role/status contract.
