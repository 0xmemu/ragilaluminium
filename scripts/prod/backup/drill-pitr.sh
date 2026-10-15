#!/usr/bin/env bash
# Drill PITR (point-in-time recovery) terisolasi.
#
# Mengapa ada: dump dan arsip binlog sudah berjalan, tetapi replay binlog belum
# pernah diuji di 202. Drill lama hanya menghitung jumlah tabel, tidak membuktikan
# data bisa dipulihkan sampai titik waktu tertentu, dan tidak mengukur durasi.
#
# KESELAMATAN (pelajaran uji 15 Oktober 2026):
# 1. Peristiwa binlog berbasis baris membawa NAMA DATABASE ASAL. Tanpa
#    --rewrite-db, penulisan tetap mengarah ke database produksi. Drill ini WAJIB
#    memakai --rewrite-db, dan memverifikasi bahwa database uji benar-benar
#    bertambah sesudah replay.
# 2. Drill memakai database uji BERNAMA UNIK per jalannya, sehingga sisa jalannya
#    sebelumnya tidak pernah tercampur.
# 3. Setiap tahap diperiksa: jumlah tabel sesudah restore harus utuh, dan tidak
#    boleh turun sesudah replay. Penurunan dihentikan sebagai kegagalan, bukan
#    dilaporkan sebagai hasil.
# 4. Database uji dibersihkan di akhir, termasuk saat gagal.
#
# Pakai:
#   drill-pitr.sh                              # sampai binlog terakhir
#   drill-pitr.sh --stop="2026-10-15 12:00:00" # sampai titik waktu
#   drill-pitr.sh --simpan                     # jangan hapus database uji
set -uo pipefail
source /root/ragil-backup/ragil-backup.env

LOG=/root/backups/pitr-drill.log
DUMP=/root/backups/ragil/dump-slot-1.sql.gz
BINLOG_DIR=/var/lib/mysql
STAMP=$(date +%H%M%S)
TEST_DB="ragil_pitr_uji_${STAMP}"
STOP=""
SIMPAN=0

for a in "$@"; do
  case "$a" in
    --stop=*)  STOP="${a#--stop=}" ;;
    --simpan)  SIMPAN=1 ;;
  esac
done

catat() { printf '%s %s\n' "$(date '+%F %T')" "$1" | tee -a "$LOG"; }
jumlah_tabel() { mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$1'" 2>/dev/null || echo 0; }

bersihkan() {
  if [ "$SIMPAN" = "1" ]; then
    catat "database uji disimpan atas permintaan: $TEST_DB"
  else
    mysql -e "DROP DATABASE IF EXISTS \`$TEST_DB\`" 2>/dev/null || true
  fi
}
trap bersihkan EXIT

MULAI=$(date +%s)
catat "=== drill PITR mulai (database uji: $TEST_DB) ==="

[ -f "$DUMP" ] || { catat "GAGAL: dump tidak ada: $DUMP"; exit 1; }
gzip -t "$DUMP" || { catat "GAGAL: dump korup"; exit 1; }

POSISI=$(zcat "$DUMP" | grep -m1 -oE "MASTER_LOG_FILE='[^']+', MASTER_LOG_POS=[0-9]+")
[ -n "$POSISI" ] || { catat "GAGAL: dump tidak memuat posisi binlog"; exit 1; }
MULAI_FILE=$(printf '%s' "$POSISI" | sed -E "s/.*FILE='([^']+)'.*/\1/")
MULAI_POS=$(printf '%s' "$POSISI" | sed -E 's/.*POS=([0-9]+).*/\1/')
catat "dump $(basename "$DUMP") ($(du -h "$DUMP" | cut -f1)), titik awal $MULAI_FILE pos $MULAI_POS"

shopt -s nullglob
KANDIDAT=("$BINLOG_DIR"/binlog.*)
shopt -u nullglob
URUT=()
for f in "${KANDIDAT[@]}"; do
  case "$f" in *.index) continue ;; esac
  nama=$(basename "$f")
  if [[ "$nama" > "$MULAI_FILE" || "$nama" == "$MULAI_FILE" ]]; then
    URUT+=("$f")
  fi
done
IFS=$'\n' URUT=($(printf '%s\n' "${URUT[@]}" | sort))
[ ${#URUT[@]} -gt 0 ] || { catat "GAGAL: tidak ada binlog dari $MULAI_FILE"; exit 1; }
catat "binlog: ${#URUT[@]} berkas (${URUT[0]##*/} sampai ${URUT[-1]##*/})"

# --- 1. Bangun database uji dari dump ---------------------------------------
catat "tahap 1: restore dump"
T1=$(date +%s)
mysql -e "CREATE DATABASE \`$TEST_DB\`"
if ! zcat "$DUMP" | mysql "$TEST_DB"; then
  catat "GAGAL: restore dump"
  exit 1
fi
T2=$(date +%s)
TABEL_AWAL=$(jumlah_tabel "$TEST_DB")
BARIS_AWAL=$(mysql -N -e "SELECT COUNT(*) FROM \`$TEST_DB\`.system_health_snapshots" 2>/dev/null || echo 0)
catat "  restore selesai $((T2 - T1)) detik: $TABEL_AWAL tabel, system_health_snapshots=$BARIS_AWAL"
if [ "$TABEL_AWAL" -lt 30 ]; then
  catat "GAGAL: restore hanya menghasilkan $TABEL_AWAL tabel, tidak wajar. Drill dihentikan sebelum replay."
  exit 1
fi

# --- 2. Replay binlog ke database uji ---------------------------------------
catat "tahap 2: replay binlog (rewrite-db $DB_NAME -> $TEST_DB)"
T3=$(date +%s)
OPSI=()
[ -n "$STOP" ] && OPSI+=(--stop-datetime="$STOP")

idx=0
TURUN=0
for f in "${URUT[@]}"; do
  idx=$((idx + 1))
  nama=$(basename "$f")
  ARG=(--rewrite-db="$DB_NAME->$TEST_DB")
  [ "$nama" = "$MULAI_FILE" ] && ARG+=(--start-position="$MULAI_POS")
  mysqlbinlog "${ARG[@]}" "${OPSI[@]}" "$f" 2>>"$LOG" | mysql "$TEST_DB" 2>>"$LOG" || true

  n=$(jumlah_tabel "$TEST_DB")
  if [ "$n" -lt "$TABEL_AWAL" ]; then
    catat "  BERHENTI: sesudah $nama jumlah tabel turun ($TABEL_AWAL -> $n). Replay dihentikan."
    TURUN=1
    break
  fi
  [ $((idx % 4)) -eq 0 ] && catat "  ... $idx/${#URUT[@]} berkas, $n tabel"
done
T4=$(date +%s)
TABEL_AKHIR=$(jumlah_tabel "$TEST_DB")
catat "  replay selesai $((T4 - T3)) detik: $TABEL_AKHIR tabel"

if [ "$TURUN" = "1" ]; then
  catat "GAGAL: replay menurunkan jumlah tabel. Hasil tidak dianggap sah."
  exit 1
fi

BARIS_AKHIR=$(mysql -N -e "SELECT COUNT(*) FROM \`$TEST_DB\`.system_health_snapshots" 2>/dev/null || echo 0)
if [ "$BARIS_AKHIR" -le "$BARIS_AWAL" ]; then
  catat "GAGAL: database uji tidak bertambah ($BARIS_AWAL -> $BARIS_AKHIR). Replay tidak masuk."
  exit 1
fi
catat "database uji bertambah: system_health_snapshots $BARIS_AWAL -> $BARIS_AKHIR"

# --- 3. Verifikasi isi ------------------------------------------------------
catat "tahap 3: verifikasi isi"
SRC_TABEL=$(jumlah_tabel "$DB_NAME")
catat "  tabel: sumber=$SRC_TABEL hasil=$TABEL_AKHIR"

BEDA=0
for t in system_health_snapshots media_assets cms_pages users products postal_code_mappings jnt_address_masters media_folders cms_testimonials; do
  s=$(mysql -N -e "SELECT COUNT(*) FROM \`$DB_NAME\`.\`$t\`" 2>/dev/null || echo "-")
  d=$(mysql -N -e "SELECT COUNT(*) FROM \`$TEST_DB\`.\`$t\`" 2>/dev/null || echo "-")
  tanda="sama"
  [ "$s" != "$d" ] && { tanda="BEDA"; BEDA=$((BEDA + 1)); }
  catat "  $t: sumber=$s hasil=$d ($tanda)"
done

T5=$(date +%s)
catat "durasi total: $((T5 - MULAI)) detik (restore $((T2 - T1))s + replay $((T4 - T3))s)"
if [ "$BEDA" -eq 0 ]; then
  catat "HASIL: COCOK"
  date +%FT%T > /root/backups/ragil/last-pitr-drill
  exit 0
fi
catat "HASIL: ADA BEDA ($BEDA tabel berbeda)"
exit 1
