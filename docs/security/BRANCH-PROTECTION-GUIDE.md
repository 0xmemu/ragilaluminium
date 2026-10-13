# Branch Protection Guide — Ragil Aluminium (2026-08-21)

Cara menyetel proteksi branch di GitHub repo `0xmemu/ragilaluminium` agar
perubahan tidak bisa masuk ke `main` tanpa lolos checks.

## Langkah (dashboard GitHub, ±5 menit)

1. Buka **https://github.com/0xmemu/ragilaluminium/settings/branches**
2. Di bagian **Branch protection rules**, klik **Add branch protection rule**.
3. **Branch name pattern**: ketik `main`
4. Centang opsi berikut:

| Opsi | Nilai |
|---|---|
| **Require a pull request before merging** | ✅ ON; *Require approvals* = **1**; *Dismiss stale approvals* = ON |
| **Require status checks to pass before merging** | ✅ ON. Set **Build status checks / Require branches to be up to date** = ON. Lalu pilih semua check dari `ci.yml`: `frontend`, `php`, `security`, `supply-chain`, `e2e` (beberapa di antaranya hanya jalan di PR — GitHub menunjukkannya sebagai **Required** setelah satu kali jalan hijau) |
| **Do not allow bypassing the above settings** | ✅ ON (agar admin juga terikat) |
| **Restrict who can push to matching branches** | Opsional — biarkan default (semua collaborator) |

5. Klik **Create**.

## Job CI yang jadi required (dari `.github/workflows/ci.yml`)

- `frontend` — `npm run quality` (typecheck + lint zero-warning + Vitest + build)
- `php` — composer validate + Pint changed files + `npm run build` + PHPUnit
- `security` — `npm audit` (moderate) + `composer audit` (continue-on-error)
- `supply-chain` — gitleaks secret scan + dependency-review (moderate) + SBOM
- `e2e` — Playwright 4 viewport (resposif + aksesibilitas + performa)

> **Catatan**: `e2e` dan `security` mungkin tampil "ghost" sampai pernah jalan hijau sekali.
> Setup rule intra; jika `e2e` belum pernah hijau di repo, prior belajar semula.

## Akibat setelah dipakai

- `main` tidak bisa di-push langsung (harus lewat PR + minimal 1 approval).
- Semua 5 check harus hijau sebelum merge; PR dengan test gagal tidak bisa merge.
- Admin (Anda) juga terikat — tidak ada bypass.
- Ini menutup item checklist: "Add the four-viewport E2E suite to required CI status checks" dan mencegah kode broken masuk `main` / produksi.

## Verifikasi

- Buat PR percobaan yang sengaja merusak `npm run typecheck` → tombol Merge harus abu-abu (blocked).
- Buat PR sehat → merge diperbolehkan, checks hijau.

## Tidak bisa dari VPS

Saya tidak punya `gh` CLI / token dengan izin repo-admin di VPS, jadi langkah di atas
memang butuh akses dashboard Anda.