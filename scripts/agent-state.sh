#!/usr/bin/env bash
# agent-state.sh - briefing pra-kerja untuk agent.
#
# Jalankan SEBELUM menyentuh berkas. Mencetak kondisi terkini working tree
# supaya agent tidak menimpa pekerjaan agent lain dan tidak salah paham
# soal kondisi repo. Prosedur: docs/AGENT-COLLABORATION.md
#
# Pakai: bash scripts/agent-state.sh [jumlah entri log, default 3]

set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "bukan repo git"; exit 1; }

N="${1:-3}"
BR="$(git branch --show-current)"
KONTRAK="AGENTS.md docs/MEMORY.md docs/ORCHESTRATION.md docs/AGENT-LOG.md docs/AGENT-COLLABORATION.md"

echo "=============================================================="
echo "KONDISI REPO SAAT INI  ($(date -u "+%Y-%m-%d %H:%M UTC"))"
echo "=============================================================="
echo "  branch : $BR"
echo "  HEAD   : $(git log --oneline -1)"
if git rev-parse --verify --quiet origin/"$BR" >/dev/null; then
  echo "  origin : $(git log --oneline -1 origin/"$BR")"
  echo "  selisih: $(git rev-list --count origin/"$BR"..HEAD) belum di-push, $(git rev-list --count HEAD..origin/"$BR") di origin belum ditarik"
else
  echo "  origin : (belum ada cabang origin untuk $BR)"
fi

echo
echo "--- WORKING TREE ---"
echo "  total berkas kotor: $(git status --porcelain | wc -l)"
echo "  (berkas kotor BUKAN milik Anda; JANGAN ditimpa atau di-git add massal)"

echo
echo "  Berkas KONTRAK yang sedang kotor (hati-hati, ini milik agent lain):"
FOUND=0
for f in $KONTRAK; do
  S="$(git status --porcelain "$f" 2>/dev/null)"
  if [ -n "$S" ]; then echo "    $S"; FOUND=1; fi
done
[ "$FOUND" -eq 0 ] && echo "    (tidak ada, semua bersih)"

echo
echo "--- 8 COMMIT TERAKHIR ---"
git log --format="  %ad %h %an %s" --date=short -8

echo
echo "--- $N ENTRI TERAKHIR docs/AGENT-LOG.md ---"
if [ -f docs/AGENT-LOG.md ]; then
  grep "^## 2026" docs/AGENT-LOG.md | tail -"$N" | sed "s/^/  /"
  echo "  (isi lengkap: docs/AGENT-LOG.md)"
else
  echo "  BELUM ADA docs/AGENT-LOG.md"
fi

echo
echo "--- PERINGATAN KESEGARAN ---"
if [ -f docs/MEMORY.md ]; then
  LAST="$(grep -o "^### 2026-[0-9][0-9]-[0-9][0-9]" docs/MEMORY.md | tail -1 | sed "s/### //")"
  echo "  Entri terakhir docs/MEMORY.md: ${LAST:-tidak diketahui}"
  echo "  (log keputusan, bisa tertinggal dari kode; verifikasi bila jadi dasar keputusan)"
fi
if grep -q "^## Current status" AGENTS.md 2>/dev/null; then
  echo "  AGENTS.md punya bagian Current status yang bersifat RIWAYAT, bukan kondisi terkini."
fi
echo "  docs/TEKNIS/ selalu akurat (dihasilkan dari kode). docs/KONTRAK/ dan docs/ADR/ bisa basi."

echo
echo "--- SEBELUM MULAI ---"
echo "  1. Tetapkan tier (Trivial/Standard/Deep) sesuai anggaran di AGENTS.md."
echo "  2. Jangan timpa berkas kotor milik agent lain; lihat docs/AGENT-COLLABORATION.md."
echo "  3. Setelah selesai, tambahkan entri di docs/AGENT-LOG.md."
echo "  4. Sertakan baris Agent: <id> di pesan commit."
echo "=============================================================="
