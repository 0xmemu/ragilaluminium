# ADR-011: Admin UI — Komponen shadcn Asli + Palet Netral + Layout Table-First

## Status

Accepted

## Date

2026-08-21

## Context

Panel admin dikeluhkan "jauh dari kata shadcn". Audit menunjukkan komponen
admin (`components/admin/ui/`) memang berarsitektur shadcn (Radix + cva + Slot),
tetapi:

- Palet "Paper" warna-warni (primary merah `0 100% 38%`, secondary/muted hijau
  `150 8% 93%`, accent merah muda `0 72% 96%`) membuatnya terlihat bukan shadcn.
- Radius besar (`--radius 1rem` = 16px) dan `rounded-xl` (14px) menyimpang dari
  estetika shadcn new-york (radius kecil 6px).
- Beberapa komponen adalah custom fungsional (status-badge, field, list-toolbar,
  confirm-action, pagination, empty-state) yang tidak setara di shadcn.
- Terdapat duplikasi nama komponen antara `components/ui/` (storefront) dan
  `components/admin/ui/` (admin) — potensial bentrok.

## Decision

Arahkan panel admin ke **estetika & komponen shadcn asli**, dengan batas keras
tidak menyentuh storefront:

1. **Palet netral shadcn new-york** — `--primary: 0 0% 9%` (nyaris hitam),
   secondary/muted/accent `96.1%`, border/input `89.8%`, ring mengikuti primary.
   Warna hanya tersisa pada elemen semantik (destructive/success/warning/info).
2. **Radius kecil konsisten** — `--radius: 0.5rem`, `--radius-control: 0.375rem`;
   konversi 91× `rounded-xl` → `rounded-lg` di 39 file admin.
3. **Komponen shadcn asli via `npx shadcn add`** ke `admin/ui/`: badge, tabs,
   tooltip, separator, form, label, command, chart (Recharts). Button & dialog
   di-refactor ke kode shadcn resmi.
4. **Komponen custom fungsional dipertahankan** (status-badge, field,
   list-toolbar, confirm-action, pagination, empty-state, delta-badge) karena
   tidak punya setara shadcn langsung dan membawa logika domain (statusMeta,
   Label+error, dsb). Bukan menimpa dengan Badge shadcn yang hanya visual.
5. **Scope ketat**: hanya `admin/ui` + halaman Admin + token `html.admin-shell`.
   `components/ui` (storefront) & `pages/Public` TIDAK disentuh.
6. **Chart tren** di Performa Toko: `TrendSparkline` custom (div CSS) → komponen
   **Chart shadcn** (Recharts BarChart) via ChartContainer/ChartTooltip.

## Consequences

- Panel admin konsisten dengan ekosistem shadcn; estetika netral modern.
- Komponen asli di-maintain via CLI shadcn, mudah di-update.
- Komponen custom fungsional tetap sehat (tidak patah karena diganti paksa).
- Storefront tidak terpengaruh (batas scope ketat).
- `recharts` ditambahkan sebagai dependency (hanya untuk Chart admin).

## Alternatives considered

- **Overwrite semua custom ke shadcn** → menolak: status-badge/field/list-toolbar
  punya logika domain yang hilang.
- **Unifikasi penuh jadi 1 set komponen** → menolak: memaksa mengubah storefront,
  melanggar batas scope & risiko besar.
- **Pertahankan palet Paper** → menolak: itulah akar "jauh dari kata shadcn".

## References

- `components.json` (style new-york, base radix, iconLibrary phosphor).
- `npx shadcn add` registry (badge/tabs/tooltip/separator/form/label/command/chart).
- ADR-010 (navigasi prefetch) — berkaitan dgn performa render halaman admin.