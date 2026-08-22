# Keputusan Arsitektur (ADR) — Ragil Aluminium

Seluruh keputusan arsitektur proyek digabung dalam **satu file master**:

## 📄 **[MASTER-ADR.md](MASTER-ADR.md)** — semua ADR dalam satu dokumen

File master menggabungkan ADR-001 s/d ADR-013 (arsitektur, integrasi, trade-off performa,
kebijakan, kontrak domain). Setiap keputusan dicatat dengan Status / Date / Context / Decision /
Consequences / Alternatives / References.

## Status aturan

- Gunakan **MASTER-ADR.md** sebagai satu-satunya sumber keputusan arsitektur.
- Keputusan baru: tambahkan sebagai **ADR-014+** di file master (atau buat file `ADR-NNN-*.md`
  lalu gabung via `scripts/` jika diperlukan), dan perbarui daftar isi di master.
- Kode menang atas docs (rule-of-truth).
- Bahasa: Indonesia (istilah teknis boleh English).

## Daftar ADR (ringkas)

| ADR | Judul | Status |
|-----|-------|--------|
| ADR-001 | Agent Architect & Production Orchestrator contract | Accepted |
| ADR-002 | Agent efficiency & compound workflow | Accepted |
| ADR-003 | Cloudflare Tunnel ingress | Accepted |
| ADR-004 | Database-backed transaction integrity | Accepted |
| ADR-005 | Enterprise quality gates | Accepted |
| ADR-006 | Order state machine | Accepted |
| ADR-008 | D1 migration proposal | Proposed |
| ADR-009 | Baileys long session | Accepted |
| ADR-010 | Admin navigation performance — hover-prefetch | Accepted |
| ADR-011 | Admin UI — shadcn asli + palet netral | Accepted |
| ADR-012 | Arsitektur produksi — tetap Inertia, bukan SPA+API | Accepted |
| ADR-013 | Performa pindah menu & api. subdomain — cache Redis Lapis A, satu origin | Accepted |
| ADR-014 | Platform VPS produksi — Ubuntu (bukan Debian) | Accepted |

> Detail lengkap setiap ADR ada di [MASTER-ADR.md](MASTER-ADR.md).
