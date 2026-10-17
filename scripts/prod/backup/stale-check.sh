#!/usr/bin/env bash
# Pemeriksaan kesehatan backup: dump harian dan arsip binlog tidak boleh basi.
# Menulis berkas ALERT-local-stale supaya kebasian senyap terlihat, dan MENGHAPUSNYA
# saat sehat. Penanda ini hanya milik pemeriksaan ini; penanda unggah R2 dan drill
# punya berkas sendiri supaya keberhasilan di sini tidak menghapus kegagalan di sana.
set -uo pipefail
source /root/ragil-backup/ragil-backup.env

LOG="$ALERT_DIR/backup-health.log"
NOW=$(date +%s)
MASALAH=0

umur_detik() {
  local berkas="$1"
  local isi
  if [ ! -f "$berkas" ]; then
    echo "-1"
    return
  fi
  isi=$(cat "$berkas")
  local t
  t=$(date -d "$isi" +%s 2>/dev/null) || t=""
  if [ -z "$t" ]; then
    echo "-1"
    return
  fi
  echo $(( NOW - t ))
}

UMUR_DUMP=$(umur_detik "$BACKUP_DIR/last-dump")
if [ "$UMUR_DUMP" -lt 0 ] || [ "$UMUR_DUMP" -gt 93600 ]; then
  echo "$(date '+%F %T') dump harian basi atau belum ada (umur=${UMUR_DUMP}s)" >> "$LOG"
  touch "$ALERT_DIR/ALERT-local-stale"
  MASALAH=1
fi

UMUR_BINLOG=$(umur_detik "$BACKUP_DIR/binlog-last-run")
if [ "$UMUR_BINLOG" -lt 0 ] || [ "$UMUR_BINLOG" -gt 7200 ]; then
  echo "$(date '+%F %T') arsip binlog basi atau belum ada (umur=${UMUR_BINLOG}s)" >> "$LOG"
  touch "$ALERT_DIR/ALERT-local-stale"
  MASALAH=1
fi

UKURAN=$(du -sm "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "$(date '+%F %T') ukuran_lokal=${UKURAN}MB umur_dump=${UMUR_DUMP}s umur_binlog=${UMUR_BINLOG}s masalah=$MASALAH" >> "$LOG"

if [ "$MASALAH" = "0" ]; then
  rm -f "$ALERT_DIR/ALERT-local-stale"
fi
exit "$MASALAH"
