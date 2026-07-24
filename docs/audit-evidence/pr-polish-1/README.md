# PR Polish Pass 1 — evidence

Branch: `polish/ui-pass-1` (dari `origin/main` @ Batch 4 / #10).

## Catatan stack
Skill meminta #11–#14 merged dulu. Saat eksekusi, #11–#14 masih **OPEN** — lanjut dari `main` terbaru; item yang bergantung stack di-SKIP.

## Screenshot before/after
SKIP capture otomatis di lingkungan agent (tidak ada browser headed untuk evidence PNG). Smoke path tercatat per seksi di file `seksi-*.md`.

## SKIP ringkas
| Item | Alasan |
|------|--------|
| 2.5 `SectionHeading size="display"` | Prop `size` belum ada di `main` (PR #13 belum merge); Home memakai `SectionTitle` lokal |
| 3.3 Catalog `router.on` skeleton | Sudah ada `loading` + `ProductGridSkeleton` |
| Screenshot PNG | Lingkungan agent tanpa capture visual otomatis |
