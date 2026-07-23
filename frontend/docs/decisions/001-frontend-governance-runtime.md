# ADR-001: Separate Frontend Governance from Runtime

## Status

Accepted

## Date

2026-07-17

## Context

Ragil membutuhkan folder frontend khusus untuk brand kit, UX, dokumentasi, dan skill. Aplikasi
yang ada adalah Laravel 11 modular monolith dengan Inertia, React, Vite, dan alias TypeScript yang
semuanya berakar di `resources/js`.

Memindahkan runtime ke `frontend/src` akan mengubah Vite input, Tailwind content scanning,
TypeScript path, shadcn aliases, dan konvensi Laravel tanpa memberi manfaat produk.

## Decision

Gunakan:

- `frontend/` untuk governance, brand, design, UX, ADR, dan project skills.
- `resources/js` dan `resources/css` untuk semua runtime UI.

`frontend/README.md` memetakan kedua area dan menjadi entry point untuk pekerjaan UI.

## Alternatives considered

### Move runtime to frontend/src

Ditolak karena menambah konfigurasi, mempersulit tooling Laravel, dan mencampur keputusan
organisasi dokumen dengan arsitektur build.

### Put all design docs under docs/

Ditolak karena kebutuhan proyek meminta area frontend yang dapat ditemukan dengan cepat dan
menggabungkan brand, UX, dan skill tanpa mencampur kontrak backend.

## Consequences

- Tooling Laravel tetap konvensional.
- Dokumentasi visual memiliki rumah yang jelas.
- Future agent harus membaca `frontend/README.md` untuk tugas UI.
- Visual docs tidak boleh mengubah route/schema/data contract.
