#!/usr/bin/env bash
# Pemeriksaan kegagalan backup di VPS produksi 202.
#
# Mengapa ada: skrip backup sudah menulis penanda ALERT-* saat gagal, tetapi
# tidak ada yang membacanya di 202. Pemeriksa kebasian lama hanya melihat dump
# LOKAL yang segar, sehingga kegagalan unggah off-site ke R2 tidak pernah
# terlihat sampai salinan off-site benar-benar dibutuhkan.
#
# RANCANGAN: alarm diambil dari HASIL (kesegaran salinan off-site, umur dump,
# umur drill), bukan dari penanda internal. Alasannya ditemukan saat audit
# 2026-10-14: penanda ALERT-* di 202 tidak pernah bisa bersih. Skrip di 202
# memakai ": > berkas" untuk menyatakan sehat, sedangkan penandaan gagal
# memakai "touch"; keduanya meninggalkan berkas 0 byte, sehingga keberadaan
# berkas tidak membedakan gagal dari sehat. Di 209 kontraknya benar: skrip di
# sana MENGHAPUS penanda saat sukses, jadi keberadaan berkas berarti gagal.
# Karena itu penanda di sini hanya dicatat sebagai catatan, tidak dijadikan
# alarm, sampai konvensi di 202 diperbaiki.
#
# Dijalankan cron sebagai root (perlu baca /root/backups dan kredensial R2).
# Tidak mengubah berkas backup: hanya membaca, lalu mengirim alarm.
set -uo pipefail
source /root/ragil-backup/ragil-backup.env

LOG="$ALERT_DIR/backup-alert.log"
STATE="$ALERT_DIR/.backup-alert-state"
TG=/root/scripts_tg_alert.sh
FRESHNESS="$ALERT_DIR/r2_freshness.py"
TG_ENV=/root/.config/ragilaluminium/telegram.env
TG_SUBS="$ALERT_DIR/.tg-subscribers"

DUMP_MAX=93600     # 26 jam, selaras dengan pemeriksa kebasian dump harian
BINLOG_MAX=10800   # 3 jam, arsip binlog berjalan tiap jam
DRILL_MAX=691200   # 8 hari, drill dijadwalkan mingguan

catat() { printf '%s %s\n' "$(date '+%F %T')" "$1" >> "$LOG"; }
state_get() { [ -f "$STATE" ] && grep -qx "$1" "$STATE" 2>/dev/null; }
state_set() { touch "$STATE"; grep -qx "$1" "$STATE" 2>/dev/null || echo "$1" >> "$STATE"; }
state_clear() { if [ -f "$STATE" ]; then grep -vx "$1" "$STATE" > "$STATE.tmp" 2>/dev/null; mv "$STATE.tmp" "$STATE"; fi; }

kritis() {
  local KODE="$1"; shift
  if state_get "$KODE"; then
    catat "masih kritis: $KODE"
  else
    state_set "$KODE"
    catat "KRITIS: $KODE $*"
    bash "$TG" "ALARM BACKUP PRODUKSI 202
Kode: $KODE
$*" || true
  fi
}

pulih() {
  local KODE="$1"; shift
  if state_get "$KODE"; then
    state_clear "$KODE"
    catat "PULIH: $KODE"
    bash "$TG" "PULIH backup produksi 202
Kode: $KODE
$*" || true
  fi
}

umur_detik() {
  local berkas="$1" isi t
  [ -f "$berkas" ] || { echo -1; return; }
  isi=$(cat "$berkas")
  t=$(date -d "$isi" +%s 2>/dev/null) || t=""
  [ -n "$t" ] || { echo -1; return; }
  echo $(( $(date +%s) - t ))
}

catat "=== mulai pemeriksaan ==="

# 1) Penanda kegagalan: CATATAN saja, bukan alarm. Lihat catatan rancangan di
#    atas berkas. Dicatat supaya jejaknya tetap terlihat di log.
shopt -s nullglob
MARKERS=("$ALERT_DIR"/ALERT-*)
shopt -u nullglob
if [ ${#MARKERS[@]} -gt 0 ]; then
  DAFTAR=""
  for m in "${MARKERS[@]}"; do
    DAFTAR="$DAFTAR $(basename "$m")"
  done
  catat "catatan: penanda ada:${DAFTAR} (tidak dijadikan alarm; konvensi 202 belum bisa membersihkan)"
else
  catat "catatan: tidak ada penanda ALERT-*."
fi

# 2) Kesegaran salinan off-site di R2. Ini yang sebelumnya tidak diperiksa:
#    dump lokal bisa segar sementara unggahannya ke R2 gagal. Karena memeriksa
#    HASIL, jalur ini tetap benar walau penanda internal bermasalah.
if OUT=$(python3 "$FRESHNESS" 2>>"$LOG"); then
  DUMP_AGE=$(printf '%s' "$OUT" | awk '{print $1}')
  BINLOG_AGE=$(printf '%s' "$OUT" | awk '{print $2}')

  if [ "${DUMP_AGE:-0}" -lt 0 ] || [ "${DUMP_AGE:-0}" -gt "$DUMP_MAX" ]; then
    kritis "OFFSITE-DUMP" "Dump terbaru di R2 berumur ${DUMP_AGE}s (batas ${DUMP_MAX}s). Salinan off-site tidak dapat diandalkan."
  else
    pulih "OFFSITE-DUMP" "dump off-site segar kembali (umur ${DUMP_AGE}s)."
  fi

  if [ "${BINLOG_AGE:-0}" -lt 0 ] || [ "${BINLOG_AGE:-0}" -gt "$BINLOG_MAX" ]; then
    kritis "OFFSITE-BINLOG" "Binlog terbaru di R2 berumur ${BINLOG_AGE}s (batas ${BINLOG_MAX}s). Pemulihan titik-waktu terputus."
  else
    pulih "OFFSITE-BINLOG" "binlog off-site segar kembali (umur ${BINLOG_AGE}s)."
  fi
else
  kritis "OFFSITE-CHECK" "Pemeriksaan kesegaran R2 gagal dijalankan. Kesegaran off-site tidak dapat dipastikan; lihat $LOG."
fi

# 3) Dump lokal
DUMP_LOKAL=$(umur_detik "$BACKUP_DIR/last-dump")
if [ "$DUMP_LOKAL" -lt 0 ] || [ "$DUMP_LOKAL" -gt "$DUMP_MAX" ]; then
  kritis "LOCAL-DUMP" "Dump lokal berumur ${DUMP_LOKAL}s (batas ${DUMP_MAX}s)."
else
  pulih "LOCAL-DUMP" "dump lokal segar kembali (umur ${DUMP_LOKAL}s)."
fi

# 4) Drill restore, bukti arsip benar-benar bisa dipulihkan
DRILL=$(umur_detik "$BACKUP_DIR/last-drill")
if [ "$DRILL" -lt 0 ] || [ "$DRILL" -gt "$DRILL_MAX" ]; then
  kritis "DRILL" "Drill restore terakhir berumur ${DRILL}s (batas ${DRILL_MAX}s). Kesiapan pemulihan belum dibuktikan ulang."
else
  pulih "DRILL" "drill restore kembali teratur (umur ${DRILL}s)."
fi

# 5) Jalur alarm itu sendiri. Alarm yang tidak bisa terkirim sama berbahayanya
#    dengan tidak ada alarm, jadi kelengkapan konfigurasi diperiksa. Pengiriman
#    sungguhan tidak diuji dari sini karena itu tindakan terpisah.
if [ -s "$TG_ENV" ] && [ -s "$TG_SUBS" ] && [ -x "$TG" ]; then
  pulih "ALARM-CONFIG" "konfigurasi alarm lengkap kembali."
else
  kritis "ALARM-CONFIG" "Konfigurasi alarm tidak lengkap (token/subscriber/skrip kirim). Alarm lain tidak akan sampai ke penerima."
fi

catat "=== selesai ==="
