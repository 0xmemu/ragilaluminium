#!/usr/bin/env bash
# Pemeriksaan kegagalan backup di VPS produksi 202.
#
# Mengapa ada: skrip backup sudah menulis penanda ALERT-* saat gagal, tetapi
# tidak ada yang membacanya di 202. Pemeriksa kebasian lama hanya melihat dump
# LOKAL yang segar, sehingga kegagalan unggah off-site ke R2 tidak pernah
# terlihat sampai salinan off-site benar-benar dibutuhkan.
#
# RANCANGAN: alarm diambil dari HASIL (kesegaran salinan off-site, umur dump,
# umur keberhasilan drill, riwayat pengiriman alarm), bukan dari penanda
# internal. Alasannya ditemukan saat audit 2026-10-14: penanda ALERT-* di 202
# tidak pernah bisa bersih. Skrip di 202 memakai ": > berkas" untuk menyatakan
# sehat, sedangkan penandaan gagal memakai "touch"; keduanya meninggalkan berkas
# 0 byte, sehingga keberadaan berkas tidak membedakan gagal dari sehat. Di 209
# kontraknya benar: skrip di sana MENGHAPUS penanda saat sukses, jadi
# keberadaan berkas berarti gagal. Karena itu penanda di sini hanya dicatat
# sebagai catatan, tidak dijadikan alarm.
#
# PRINSIP: kegagalan PEMERIKSAAN tidak boleh dilaporkan sebagai sehat. Setiap
# pemeriksaan yang tidak bisa diselesaikan menghasilkan alarm tersendiri.
#
# Dijalankan cron sebagai root (perlu baca /root/backups dan kredensial R2).
# Tidak mengubah berkas backup: hanya membaca, lalu mengirim alarm.
set -uo pipefail
source /root/ragil-backup/ragil-backup.env

LOG="$ALERT_DIR/backup-alert.log"
STATE="$ALERT_DIR/.backup-alert-state"
LOCK="$ALERT_DIR/.backup-alert.lock"
TG=/root/scripts_tg_alert.sh
FRESHNESS="$ALERT_DIR/r2_freshness.py"
TG_ENV=/root/.config/ragilaluminium/telegram.env
TG_SUBS="$ALERT_DIR/.tg-subscribers"
TG_LOG="$ALERT_DIR/tg-alert.log"
DRILL_LOG="$ALERT_DIR/restore-drill.log"

DUMP_MAX=93600     # 26 jam, selaras dengan pemeriksa kebasian dump harian
BINLOG_MAX=10800   # 3 jam, arsip binlog berjalan tiap jam
DRILL_MAX=691200   # 8 hari, drill dijadwalkan mingguan
R2_TIMEOUT=60      # batas keras pemeriksaan R2, supaya monitor tidak menggantung

catat() { printf '%s %s\n' "$(date '+%F %T')" "$1" >> "$LOG"; }
state_get() { [ -f "$STATE" ] && grep -qx "$1" "$STATE" 2>/dev/null; }
state_set() { touch "$STATE"; grep -qx "$1" "$STATE" 2>/dev/null || echo "$1" >> "$STATE"; }
state_clear() { if [ -f "$STATE" ]; then grep -vx "$1" "$STATE" > "$STATE.tmp" 2>/dev/null; mv "$STATE.tmp" "$STATE"; fi; }

# Kirim satu pesan alarm. Mengembalikan status skrip pengirim: nol berarti
# benar-benar terkirim ke penerima, bukan sekadar "sudah dipanggil".
kirim_alarm() {
  bash "$TG" "$1" >>"$LOG" 2>&1
}

# Alarm: dikirim HANYA kalau belum pernah tercatat. State baru disimpan setelah
# pengiriman berhasil, supaya kegagalan kirim tidak membuat alarm hilang
# permanen; pemeriksaan berikutnya akan mencoba lagi.
kritis() {
  local KODE="$1"; shift
  if state_get "$KODE"; then
    catat "masih kritis: $KODE"
    return
  fi
  catat "KRITIS: $KODE $*"
  if kirim_alarm "ALARM BACKUP PRODUKSI 202
Kode: $KODE
$*"; then
    state_set "$KODE"
  else
    catat "GAGAL KIRIM alarm $KODE, akan dicoba lagi pada pemeriksaan berikutnya"
  fi
}

# Pemulihan: state baru dibersihkan setelah notifikasi pulih terkirim, supaya
# penerima tidak melewatkan kabar baik karena gangguan sesaat.
pulih() {
  local KODE="$1"; shift
  state_get "$KODE" || return 0
  catat "PULIH: $KODE"
  if kirim_alarm "PULIH backup produksi 202
Kode: $KODE
$*"; then
    state_clear "$KODE"
  else
    catat "GAGAL KIRIM notifikasi pulih $KODE, akan dicoba lagi"
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

# Angka sah: hanya bilangan bulat (boleh negatif untuk penanda "tidak ada").
angka_sah() { [[ "${1:-}" =~ ^-?[0-9]+$ ]]; }

# Kunci: dua eksekusi bersamaan tidak boleh menggandakan notifikasi.
exec 9>"$LOCK"
if ! flock -n 9; then
  catat "lewati: eksekusi lain sedang berjalan"
  exit 0
fi

catat "=== mulai pemeriksaan ==="

# 1) Penanda kegagalan: CATATAN saja, bukan alarm. Kontraknya ambigu di 202
#    (lihat catatan rancangan di atas).
shopt -s nullglob
MARKERS=("$ALERT_DIR"/ALERT-*)
shopt -u nullglob
if [ ${#MARKERS[@]} -gt 0 ]; then
  DAFTAR=""
  for m in "${MARKERS[@]}"; do
    DAFTAR="$DAFTAR $(basename "$m")"
  done
  catat "catatan: penanda ada:${DAFTAR} (tidak dijadikan alarm; kontrak 202 belum bisa membersihkan)"
else
  catat "catatan: tidak ada penanda ALERT-*."
fi

# 2) Kesegaran salinan off-site di R2. Ini yang sebelumnya tidak diperiksa:
#    dump lokal bisa segar sementara unggahannya ke R2 gagal. Dijalankan dengan
#    batas waktu keras supaya jaringan yang menggantung tidak membekukan monitor.
if OUT=$(timeout "$R2_TIMEOUT" python3 "$FRESHNESS" 2>>"$LOG"); then
  DUMP_AGE=$(printf '%s' "$OUT" | awk '{print $1}')
  BINLOG_AGE=$(printf '%s' "$OUT" | awk '{print $2}')

  if ! angka_sah "$DUMP_AGE" || ! angka_sah "$BINLOG_AGE"; then
    kritis "OFFSITE-CHECK" "Pemeriksaan kesegaran R2 mengembalikan nilai tidak sah (keluaran: '${OUT}'). Keadaan salinan off-site tidak dapat dipastikan."
  else
    if [ "$DUMP_AGE" -lt 0 ] || [ "$DUMP_AGE" -gt "$DUMP_MAX" ]; then
      kritis "OFFSITE-DUMP" "Dump terbaru di R2 berumur ${DUMP_AGE}s (batas ${DUMP_MAX}s). Salinan off-site tidak dapat diandalkan."
    else
      pulih "OFFSITE-DUMP" "dump off-site segar kembali (umur ${DUMP_AGE}s)."
    fi

    if [ "$BINLOG_AGE" -lt 0 ] || [ "$BINLOG_AGE" -gt "$BINLOG_MAX" ]; then
      kritis "OFFSITE-BINLOG" "Binlog terbaru di R2 berumur ${BINLOG_AGE}s (batas ${BINLOG_MAX}s). Pemulihan titik-waktu terputus."
    else
      pulih "OFFSITE-BINLOG" "binlog off-site segar kembali (umur ${BINLOG_AGE}s)."
    fi
  fi
else
  RC=$?
  if [ "$RC" = "124" ]; then
    kritis "OFFSITE-CHECK" "Pemeriksaan kesegaran R2 melewati batas ${R2_TIMEOUT}s (timeout). Keadaan off-site tidak dapat dipastikan."
  else
    kritis "OFFSITE-CHECK" "Pemeriksaan kesegaran R2 gagal dijalankan (kode $RC). Keadaan off-site tidak dapat dipastikan; lihat $LOG."
  fi
fi

# 3) Dump lokal
DUMP_LOKAL=$(umur_detik "$BACKUP_DIR/last-dump")
if [ "$DUMP_LOKAL" -lt 0 ] || [ "$DUMP_LOKAL" -gt "$DUMP_MAX" ]; then
  kritis "LOCAL-DUMP" "Dump lokal berumur ${DUMP_LOKAL}s (batas ${DUMP_MAX}s)."
else
  pulih "LOCAL-DUMP" "dump lokal segar kembali (umur ${DUMP_LOKAL}s)."
fi

# 4) Drill restore: dua sisi. Umur merujuk KEBERHASILAN terakhir (berkas
#    last-drill hanya ditulis saat drill lulus), dan hasil eksekusi terakhir
#    dibaca dari log supaya kegagalan baru terlihat tanpa menunggu 8 hari.
DRILL_OK=$(umur_detik "$BACKUP_DIR/last-drill")
if [ "$DRILL_OK" -lt 0 ] || [ "$DRILL_OK" -gt "$DRILL_MAX" ]; then
  kritis "DRILL" "Keberhasilan drill restore terakhir berumur ${DRILL_OK}s (batas ${DRILL_MAX}s). Kesiapan pemulihan belum dibuktikan ulang."
else
  pulih "DRILL" "keberhasilan drill restore kembali teratur (umur ${DRILL_OK}s)."
fi

if [ -f "$DRILL_LOG" ]; then
  # Ambil blok eksekusi terakhir, lalu periksa apakah blok itu berakhir "drill OK".
  LAST_RUN=$(awk '/drill mulai/{buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}' "$DRILL_LOG")
  if [ -z "$LAST_RUN" ]; then
    kritis "DRILL-RUN" "Log drill ada tetapi tidak memuat jejak eksekusi. Hasil drill terakhir tidak dapat dipastikan."
  elif printf '%s' "$LAST_RUN" | grep -q 'drill OK'; then
    pulih "DRILL-RUN" "eksekusi drill terakhir berhasil."
  else
    kritis "DRILL-RUN" "Eksekusi drill restore terakhir TIDAK berhasil (lihat $DRILL_LOG)."
  fi
else
  kritis "DRILL-RUN" "Log drill belum ada di $DRILL_LOG. Hasil drill terakhir tidak dapat dipastikan."
fi

# 5) Jalur alarm itu sendiri. Alarm yang tidak bisa terkirim sama berbahayanya
#    dengan tidak ada alarm. Konfigurasi diperiksa lengkap, dan riwayat
#    pengiriman terakhir dibaca dari log. Pengiriman sungguhan tidak diuji dari
#    sini karena itu tindakan terpisah.
if [ -s "$TG_ENV" ] && [ -s "$TG_SUBS" ] && [ -x "$TG" ]; then
  pulih "ALARM-CONFIG" "konfigurasi alarm lengkap kembali."
else
  kritis "ALARM-CONFIG" "Konfigurasi alarm tidak lengkap (token/subscriber/skrip kirim). Alarm lain tidak akan sampai ke penerima."
fi

if [ -f "$TG_LOG" ]; then
  LAST_KIRIM=$(tail -1 "$TG_LOG")
  if printf '%s' "$LAST_KIRIM" | grep -qE 'kirim: [0-9]+ ok, [1-9][0-9]* gagal'; then
    kritis "ALARM-KIRIM" "Pengiriman alarm terakhir gagal sebagian: ${LAST_KIRIM}"
  else
    pulih "ALARM-KIRIM" "pengiriman alarm terakhir berhasil."
  fi
fi

# 6) Arsip media tambah-saja. Bucket produksi tidak mendukung versioning, dan
#    penghapusan media di panel admin benar-benar menghapus berkasnya, jadi
#    arsip ini satu-satunya jalan memulihkan objek yang terhapus. Arsip yang
#    tertinggal harus terlihat sebelum objeknya benar-benar dibutuhkan.
if OUT_MEDIA=$(timeout "$R2_TIMEOUT" python3 "$ALERT_DIR/media_archive_gap.py" 2>>"$LOG"); then
  GAP=$(printf '%s' "$OUT_MEDIA" | tr -d '[:space:]')
  if ! angka_sah "$GAP"; then
    kritis "MEDIA-ARCHIVE" "Pemeriksaan arsip media mengembalikan nilai tidak sah (keluaran: '${OUT_MEDIA}'). Keadaan arsip tidak dapat dipastikan."
  elif [ "$GAP" -gt 0 ]; then
    kritis "MEDIA-ARCHIVE" "Ada ${GAP} objek media di produksi yang belum masuk arsip. Objek itu belum terlindungi dari penghapusan."
  else
    pulih "MEDIA-ARCHIVE" "arsip media lengkap kembali."
  fi
else
  RC=$?
  if [ "$RC" = "124" ]; then
    kritis "MEDIA-ARCHIVE" "Pemeriksaan arsip media melewati batas ${R2_TIMEOUT}s (timeout). Keadaan arsip tidak dapat dipastikan."
  else
    kritis "MEDIA-ARCHIVE" "Pemeriksaan arsip media gagal dijalankan (kode $RC). Keadaan arsip tidak dapat dipastikan; lihat $LOG."
  fi
fi

# 7) Pencatat trafik. Sebelumnya jadwalnya rusak senyap: dijalankan scheduler
#    Laravel sebagai www-data yang tidak bisa membaca /root, sehingga tidak ada
#    yang menyadari pemantauan trafik tidak berjalan. Sekarang diperiksa dari
#    hasilnya, yaitu kesegaran berkas CSV yang dihasilkan.
CSV_TRAFIK="$ALERT_DIR/traffic-daily.csv"
if [ -f "$CSV_TRAFIK" ]; then
  UMUR_CSV=$(( $(date +%s) - $(stat -c %Y "$CSV_TRAFIK" 2>/dev/null || echo 0) ))
  if [ "$UMUR_CSV" -gt 7200 ]; then
    kritis "TRAFIK" "Berkas catatan trafik terakhir diperbarui ${UMUR_CSV}s lalu (batas 7200s). Pencatat trafik tidak berjalan."
  else
    pulih "TRAFIK" "pencatat trafik berjalan kembali (umur ${UMUR_CSV}s)."
  fi
else
  kritis "TRAFIK" "Berkas catatan trafik belum ada di $CSV_TRAFIK. Pencatat trafik tidak pernah berhasil."
fi

catat "=== selesai ==="
