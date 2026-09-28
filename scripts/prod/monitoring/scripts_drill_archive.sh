#!/usr/bin/env bash
# Drill arsip R2 (G5) — buktikan arsip mingguan/bulanan di R2 bisa direstore.
# Download arsip terbaru dari R2 → restore ke DB test → rowcount + CHECK TABLE + audit.
# Cron Senin 07:30 (setelah PITR 07:00). Gagal → ALERT-drill-archive.
set -uo pipefail

ENV_FILE=/root/ragilaluminium/.env
DL=/root/backups/archive-download
LOG=/root/backups/archive-drill.log
ALERT=/root/backups/ALERT-drill-archive
TEST_DB=ragil_archive_test

DB_USER=$(awk -F= '/^DB_USERNAME=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_PASS=$(awk -F= '/^DB_PASSWORD=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=$(awk -F= '/^DB_HOST=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")
DB_HOST=${DB_HOST:-127.0.0.1}
DB_NAME=$(awk -F= '/^DB_DATABASE=/{gsub(/\r/,"",$2); print $2}' "$ENV_FILE")

: "${DB_USER:?}" "${DB_PASS:?}" "${DB_NAME:?}"
M() { env MYSQL_PWD="$DB_PASS" mysql -N --user="$DB_USER" --host="$DB_HOST" "$1" -e "$2" 2>/dev/null; }

echo "=== $(date '+%F %T') archive drill ===" >> "$LOG"
rm -rf "$DL"; mkdir -p "$DL"

# --- 1. Listing arsip dari R2 (monthly > weekly; prefix di-URL-encode %2F) ---
LIST=$(python3 - <<'PY'
import datetime, hashlib, hmac, re, urllib.request, urllib.error
CLOUD_ENV="/root/.config/ragilaluminium/cloudflare.env"; APP_ENV="/root/ragilaluminium/.env"; BUCKET="ra-backup"
def env_get(path,key):
    try:
        for line in open(path):
            m=re.match(rf"^{key}=(.*)$", line.strip())
            if m: return m.group(1).strip()
    except FileNotFoundError: pass
    return ""
AID=env_get(CLOUD_ENV,"CLOUDFLARE_ACCOUNT_ID") or env_get(APP_ENV,"CLOUDFLARE_ACCOUNT_ID")
AK=env_get(CLOUD_ENV,"CLOUDFLARE_R2_ACCESS_KEY_ID") or env_get(APP_ENV,"CLOUDFLARE_R2_ACCESS_KEY_ID")
SK=env_get(CLOUD_ENV,"CLOUDFLARE_R2_SECRET_ACCESS_KEY") or env_get(APP_ENV,"CLOUDFLARE_R2_SECRET_ACCESS_KEY")
if not all((AID,AK,SK)): sys.exit(1)
HOST=f"{AID}.r2.cloudflarestorage.com"
def list_prefix(prefix):
    now=datetime.datetime.now(datetime.timezone.utc); amz=now.strftime("%Y%m%dT%H%M%SZ"); day=now.strftime("%Y%m%d")
    ph=hashlib.sha256(b"").hexdigest()
    q=f"list-type=2&prefix={prefix}%2F"
    headers=f"host:{HOST}\nx-amz-content-sha256:{ph}\nx-amz-date:{amz}\n"
    signed="host;x-amz-content-sha256;x-amz-date"
    canon="\n".join(("GET","/"+BUCKET+"/",q,headers,signed,ph))
    scope=f"{day}/auto/s3/aws4_request"
    sts="\n".join(("AWS4-HMAC-SHA256",amz,scope,hashlib.sha256(canon.encode()).hexdigest()))
    def hm(k,m): return hmac.new(k,m.encode(),hashlib.sha256).digest()
    k=hm(hm(hm(hm(("AWS4"+SK).encode(),day),"auto"),"s3"),"aws4_request")
    sig=hmac.new(k,sts.encode(),hashlib.sha256).hexdigest()
    auth=f"AWS4-HMAC-SHA256 Credential={AK}/{scope}, SignedHeaders={signed}, Signature={sig}"
    req=urllib.request.Request(f"https://{HOST}/{BUCKET}/?{q}",method="GET")
    req.add_header("Authorization",auth); req.add_header("x-amz-date",amz); req.add_header("x-amz-content-sha256",ph)
    try:
        with urllib.request.urlopen(req,timeout=30) as r:
            body=r.read().decode()
            return [m.group(1) for m in re.finditer(r"<Key>([^<]+)</Key>", body)]
    except Exception as e:
        print(f"ERR:{e}",file=sys.stderr); return []
for p in ("monthly","weekly"):
    keys=list_prefix(p)
    for k in sorted(keys):
        print(k)
PY
)

ARCHIVE_KEY=$(echo "$LIST" | grep -E '^(monthly|weekly)/' | sort | tail -1)
if [ -z "$ARCHIVE_KEY" ]; then
  echo "FATAL: tidak ada arsip monthly/weekly di R2" >> "$LOG"; touch "$ALERT"; exit 1
fi
echo "  arsip terpilih: $ARCHIVE_KEY" >> "$LOG"

# --- 2. Download + restore + verifikasi ---
if ! python3 /root/scripts_r2_download.py "$ARCHIVE_KEY" "$DL/archive.sql.gz" >> "$LOG" 2>&1; then
  echo "FATAL: download arsip gagal" >> "$LOG"; touch "$ALERT"; exit 1
fi
echo "  download: OK" >> "$LOG"

env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE IF EXISTS $TEST_DB; CREATE DATABASE $TEST_DB;" 2>/dev/null || { echo "FATAL: buat DB test gagal" >> "$LOG"; exit 1; }
zcat "$DL/archive.sql.gz" | env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" "$TEST_DB" 2>/dev/null \
  || { echo "FATAL: restore arsip gagal" >> "$LOG"; touch "$ALERT"; env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null; exit 1; }
echo "  restore arsip: OK" >> "$LOG"

OK=1
for t in orders order_items payments customers products product_variants; do
  C=$(M "$TEST_DB" "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo 0)
  P=$(M "$DB_NAME" "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo 0)
  printf '  %-18s arsip=%-8s live=%-8s\n' "$t" "$C" "$P" | tee -a "$LOG"
  if [ "$C" -eq 0 ] && [ "$P" -gt 0 ]; then echo "  GAGAL: arsip kosong tapi live ada data" >> "$LOG"; OK=0; fi
done
env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "CHECK TABLE $TEST_DB.orders, $TEST_DB.products;" >> "$LOG" 2>&1 || OK=0
if ! /root/scripts_semantic_audit.sh "$TEST_DB" >> "$LOG" 2>&1; then OK=0; fi

env MYSQL_PWD="$DB_PASS" mysql --user="$DB_USER" --host="$DB_HOST" -e "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null

if [ "$OK" = "1" ]; then
  echo "ARCHIVE DRILL PASS ($ARCHIVE_KEY, drill $(date '+%F %T'))" >> "$LOG"
  date +%FT%T > /root/backups/last-archive-pass
  rm -f "$ALERT"
  exit 0
fi
echo "ARCHIVE DRILL GAGAL — cek log" >> "$LOG"; touch "$ALERT"
exit 1
