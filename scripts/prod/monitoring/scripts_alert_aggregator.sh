#!/usr/bin/env bash
# ============================================================================
# Aggregator alert v3 — 2026-09-28 (keputusan owner)
#
# Prinsip:
#   1. Telegram HANYA untuk masalah berdampak ke pelanggan atau uang dan masih
#      menunggu tindakan. Masalah teknis murni cukup masuk log untuk agent.
#   2. Sistem memulihkan sendiri lebih dulu. Yang berhasil pulih TIDAK dikirim
#      ke Telegram, cukup dicatat sebagai pemulihan mandiri.
#   3. Identitas alert stabil (berbasis kode jenis, bukan kalimat yang memuat
#      angka berubah) supaya satu masalah tidak mengirim pesan berulang.
#
# Dipanggil cron tiap 5 menit sebagai root.
# ============================================================================
set -uo pipefail

BACKUP_DIR=/root/backups
STATE="$BACKUP_DIR/.alert-state"
LOG="$BACKUP_DIR/alert-aggregator.log"
HEAL_LOG="$BACKUP_DIR/self-heal.log"
TG=/root/scripts_tg_alert.sh
ENV_FILE=/root/ragilaluminium/.env
BASE=http://127.0.0.1:8200

WA_KEY=$(awk -F= '/^WHATSAPP_BAILEYS_API_KEY=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE" 2>/dev/null)

KRITIS=""    # dikirim ke Telegram
KODE=""      # identitas stabil untuk dedupe
PULIH=""     # catatan pemulihan mandiri (ikut pesan, tapi bukan masalah)

catat() { printf '%s %s\n' "$(date '+%F %T')" "$1" >> "$LOG"; }
pulih() { PULIH="${PULIH}$1\n"; printf '%s PULIH: %s\n' "$(date '+%F %T')" "$1" >> "$HEAL_LOG"; }
kritis() { # <KODE> <judul> <artinya> <dampak> <tindakan>
  KODE="${KODE}$1;"
  KRITIS="${KRITIS}$2\n   Artinya : $3\n   Dampak  : $4\n   Tindakan: $5\n"
}

catat "=== $(date '+%F %T') agregator v3 ==="

# ============================================================================
# FASE 1 — PEMULIHAN MANDIRI (sebelum apa pun dinilai)
# ============================================================================

# 1a. Layanan inti mati -> hidupkan sendiri. Baru jadi masalah bila tetap mati.
for svc in nginx.service php8.3-fpm.service mysql.service redis-server.service ragil-queue.service baileys-bot.service laravel-reverb.service; do
  if ! systemctl is-active --quiet "$svc" 2>/dev/null; then
    systemctl restart "$svc" >/dev/null 2>&1 || true
    sleep 2
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      pulih "layanan ${svc%.service} mati, dihidupkan sendiri"
    else
      kritis "LAYANAN:${svc}" \
        "Layanan ${svc%.service} mati dan tidak bisa dihidupkan" \
        "${svc%.service} berhenti dan upaya menghidupkan otomatis gagal." \
        "Bagian sistem yang dilayani layanan ini tidak bekerja." \
        "Beritahu agent sekarang, ini butuh tindakan teknis."
    fi
  fi
done

# 1b. Tunnel Cloudflare (kontainer Docker).
if ! docker inspect -f '{{.State.Running}}' ragil-cloudflared 2>/dev/null | grep -q true; then
  docker start ragil-cloudflared >/dev/null 2>&1 || true
  sleep 3
  if docker inspect -f '{{.State.Running}}' ragil-cloudflared 2>/dev/null | grep -q true; then
    pulih "tunnel cloudflared mati, dihidupkan sendiri"
  else
    kritis "TUNNEL_MATI" \
      "Sambungan internet ke situs toko terputus" \
      "Tunnel yang menghubungkan server ke alamat ra.333labs.tech berhenti." \
      "Situs tidak bisa dibuka pelanggan dari luar." \
      "Beritahu agent sekarang."
  fi
fi

# 1c. Sesi WhatsApp: yang diperiksa SAMBUNGANNYA, bukan sekadar prosesnya hidup.
WA_STATUS=$(curl -s --max-time 8 http://127.0.0.1:3005/status 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ "$WA_STATUS" != "open" ]; then
  curl -s --max-time 20 -X POST -H "X-Api-Key: ${WA_KEY}" -H 'Content-Type: application/json' \
    -d '{}' http://127.0.0.1:3005/connect >/dev/null 2>&1 || true
  sleep 5
  WA_STATUS=$(curl -s --max-time 8 http://127.0.0.1:3005/status 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ "$WA_STATUS" = "open" ]; then
    pulih "sesi WhatsApp tersambung kembali setelah dipulihkan sendiri"
  else
    kritis "WA_PUTUS" \
      "Notifikasi WhatsApp berhenti terkirim" \
      "Sambungan nomor toko ke WhatsApp terputus (status: ${WA_STATUS:-tidak diketahui})." \
      "Pelanggan tidak menerima pemberitahuan pesanan, dan balasan pelanggan tidak masuk ke panel." \
      "Beritahu agent. Bila WhatsApp meminta taut ulang, hanya bisa dengan memindai QR dari HP bernomor toko."
  fi
fi

# 1d. Disk tinggi -> bersihkan cache alat kerja. Cache boleh hilang (bisa dibuat
#     ulang); data, cadangan, dan kode TIDAK PERNAH disentuh di sini.
DISK_PCT=$(df -h / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ "${DISK_PCT:-0}" -ge 80 ]; then
  for d in /root/.npm /root/.cache/pnpm /root/.cache/uv /root/.cache/pip /root/.cache/ms-playwright /root/.cache/copilot /root/.bun/install/cache; do
    if [ -d "$d" ]; then
      MB=$(du -sm "$d" 2>/dev/null | cut -f1); MB=${MB:-0}
      if [ "$MB" -ge 200 ]; then
        find "$d" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
        pulih "cache alat kerja dibersihkan: $d (${MB} MB)"
      fi
    fi
  done
fi
DISK_PCT=$(df -h / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ "${DISK_PCT:-0}" -ge 92 ]; then
  for d in /root/.cache/JetBrains /root/.cargo /root/.rustup; do
    if [ -d "$d" ]; then
      MB=$(du -sm "$d" 2>/dev/null | cut -f1); MB=${MB:-0}
      if [ "$MB" -ge 500 ]; then
        find "$d" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
        pulih "cache alat kerja besar dibersihkan: $d (${MB} MB)"
      fi
    fi
  done
  DISK_PCT=$(df -h / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
fi

# 1e. Cadangan binlog gagal -> coba unggah ulang sendiri.
if [ -f "$BACKUP_DIR/ALERT-r2-upload" ]; then
  /root/scripts_backup_mysql_binlog.sh >/dev/null 2>&1 || true
  if [ ! -f "$BACKUP_DIR/ALERT-r2-upload" ]; then
    pulih "unggahan cadangan binlog berhasil setelah dicoba ulang"
  fi
fi

# ============================================================================
# FASE 2 — PENILAIAN (hanya yang berdampak ke pelanggan atau uang)
# ============================================================================

# 2a. Situs toko tidak menjawab. Digabung satu entri supaya tidak berulang.
RUSAK=""
for path in / /products /cart; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${BASE}${path}" 2>/dev/null)
  [ "$CODE" != "200" ] && RUSAK="${RUSAK}${path}(${CODE:-timeout}) "
done
if [ -n "$RUSAK" ]; then
  kritis "HTTP_MATI" \
    "Situs toko tidak bisa dibuka pelanggan" \
    "Halaman yang gagal menjawab: ${RUSAK}" \
    "Pelanggan tidak bisa melihat produk atau menyelesaikan pesanan." \
    "Beritahu agent sekarang."
fi

# 2b. Antrean menumpuk ekstrem (pekerjaan pelanggan tidak terproses).
if command -v redis-cli >/dev/null 2>&1; then
  QD=$(redis-cli -n 0 llen queues:default 2>/dev/null || echo 0)
  QI=$(redis-cli -n 0 llen queues:imports 2>/dev/null || echo 0)
  QM=$(redis-cli -n 0 llen queues:media 2>/dev/null || echo 0)
  QTOTAL=$(( ${QD:-0} + ${QI:-0} + ${QM:-0} ))
  if [ "$QTOTAL" -gt 500 ]; then
    kritis "QUEUE_TUMPUK" \
      "Antrean pekerjaan menumpuk (${QTOTAL} tugas)" \
      "default=${QD:-0}, import=${QI:-0}, media=${QM:-0} menunggu diproses." \
      "Pesanan baru bisa tertunda diproses." \
      "Beritahu agent."
  fi
fi

# 2c. Sumber daya darurat SETELAH pembersihan mandiri di Fase 1.
if [ "${DISK_PCT:-0}" -ge 92 ]; then
  SISA=$(df -h / | awk 'NR==2 {print $4}')
  kritis "DISK_DARURAT" \
    "Ruang penyimpanan server hampir penuh (${DISK_PCT}%, sisa ${SISA})" \
    "Disk terpakai ${DISK_PCT}% walau cache alat kerja sudah dibersihkan otomatis." \
    "Bila penuh total, situs dan pencatatan pesanan bisa berhenti." \
    "Butuh keputusan Anda: tambah kapasitas, atau setujui pembersihan yang lebih luas."
fi
RAM_PCT=$(free -m | awk 'NR==2 {printf "%d", $3*100/$2}' 2>/dev/null || echo 0)
if [ "${RAM_PCT:-0}" -ge 95 ]; then
  kritis "RAM_DARURAT" \
    "Memori server hampir habis (${RAM_PCT}%)" \
    "Pemakaian memori ${RAM_PCT}% dari kapasitas." \
    "Server berisiko membeku dan situs berhenti melayani." \
    "Beritahu agent sekarang."
fi

# ============================================================================
# FASE 3 — LAPORAN
# ============================================================================
KRITIS_JUMLAH=$(printf '%b' "$KRITIS" | grep -c 'Artinya' || true)
PULIH_JUMLAH=$(printf '%b' "$PULIH" | grep -c . || true)
catat "ringkas: kritis=${KRITIS_JUMLAH:-0} pulih=${PULIH_JUMLAH:-0}"

if [ -n "$PULIH" ]; then
  printf '%b' "$PULIH" >> "$LOG"
fi

# Catatan teknis (TIDAK dikirim ke Telegram, hanya log untuk agent).
TEKNIS=""
FILES=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'ALERT-*' 2>/dev/null)
for f in $FILES; do
  TEKNIS="${TEKNIS}$(basename "$f") "
done
[ -n "$TEKNIS" ] && catat "catatan teknis (log saja): $TEKNIS"
for pair in "Restore test:$BACKUP_DIR/last-restore-test-pass:604800" "Semantic audit:$BACKUP_DIR/last-semantic-audit-pass:604800" "Binlog arsip:$BACKUP_DIR/binlog-last-run:10800"; do
  NAME=$(echo "$pair" | cut -d: -f1); FILE=$(echo "$pair" | cut -d: -f2); MAX=$(echo "$pair" | cut -d: -f3)
  if [ -f "$FILE" ]; then
    AGE=$(( $(date +%s) - $(stat -c %Y "$FILE") ))
    [ "$AGE" -gt "$MAX" ] && catat "catatan teknis: $NAME terakhir $((AGE / 3600)) jam lalu (log saja)"
  else
    catat "catatan teknis: $NAME belum ada jejak (log saja)"
  fi
done
INODE_PCT=$(df -i / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
[ "${INODE_PCT:-0}" -ge 80 ] && catat "catatan teknis: inode ${INODE_PCT}% (log saja)"

# Kirim ke Telegram hanya bila ada yang kritis. Dedupe berbasis KODE stabil,
# jadi satu masalah = satu pesan, tidak berulang walau angkanya berubah.
SIG=$(printf '%s' "$KODE" | md5sum | cut -d' ' -f1)
LAST=$(cat "$STATE" 2>/dev/null || echo "")
CATATAN_PULIH=""
[ -n "$PULIH" ] && CATATAN_PULIH=" (ada pemulihan mandiri, cek self-heal.log)"

if [ -n "$KRITIS" ]; then
  if [ "$SIG" != "$LAST" ]; then
    JUMLAH=$(printf '%b' "$KRITIS" | grep -c 'Artinya')
    MSG="🚨 Masalah server ($JUMLAH)\n\n$(printf '%b' "$KRITIS")"
    [ -n "$PULIH" ] && MSG="${MSG}\nSudah dicoba sistem sendiri:\n$(printf '%b' "$PULIH")"
    MSG="${MSG}\nWaktu: $(date '+%d %b %Y %H:%M')"
    printf '%b' "$MSG" > "$BACKUP_DIR/alert-latest.txt"
    if $TG "$(printf '%b' "$MSG")" >> "$LOG" 2>&1; then
      printf '%s' "$SIG" > "$STATE"
      catat "alert kritis terkirim (kode: $KODE)"
    else
      catat "GAGAL kirim alert kritis ke Telegram"
    fi
  else
    catat "alert kritis sama (dedupe kode), lewati"
  fi
else
  catat "sehat — tidak ada masalah berdampak pelanggan$CATATAN_PULIH"
  # Kabari penyelesaian HANYA bila sebelumnya memang ada masalah terkirim,
  # supaya tidak jadi kebisingan baru.
  if [ -n "$LAST" ]; then
    MSG="✅ Masalah server selesai\n\nSistem memeriksa ulang dan semuanya sudah normal.\nWaktu: $(date '+%d %b %Y %H:%M')"
    $TG "$MSG" >> "$LOG" 2>&1 && catat "kabar pulih terkirim ke Telegram"
  fi
  : > "$STATE"
  printf '✅ Server sehat%s\nWaktu: %s\n' "$CATATAN_PULIH" "$(date '+%d %b %Y %H:%M')" > "$BACKUP_DIR/alert-latest.txt"
fi
