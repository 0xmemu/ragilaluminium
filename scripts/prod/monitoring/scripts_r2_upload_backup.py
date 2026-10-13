#!/usr/bin/env python3
"""Upload backup MySQL ke R2 (ra-backup, prefix mysql/) — SigV4 stdlib + retry.
Kredensial dari /root/.config/ragilaluminium/cloudflare.env (fallback .env).
Exit 0 = sukses/skip. Exit 1 = upload final GAGAL (5xx/network setelah 3x retry, atau 4xx).
"""
import datetime, hashlib, hmac, os, re, sys, time, urllib.request

CLOUD_ENV = "/root/.config/ragilaluminium/cloudflare.env"
APP_ENV = "/root/ragilaluminium/.env"
BUCKET = "ra-backup"
PREFIX = "mysql/"
BACKUP_DIR = "/root/backups/ragil"
LATEST_NAME = "ragil_aluminium-latest.sql.gz"
RETRIES = 3

def env_get(path, key):
    try:
        with open(path) as f:
            for line in f:
                m = re.match(rf"^{key}=(.*)$", line.strip())
                if m:
                    return m.group(1).strip()
    except FileNotFoundError:
        pass
    return ""

ACCOUNT_ID = env_get(CLOUD_ENV, "CLOUDFLARE_ACCOUNT_ID") or env_get(APP_ENV, "CLOUDFLARE_ACCOUNT_ID")
ACCESS_KEY = env_get(CLOUD_ENV, "CLOUDFLARE_R2_ACCESS_KEY_ID") or env_get(APP_ENV, "CLOUDFLARE_R2_ACCESS_KEY_ID")
SECRET_KEY = env_get(CLOUD_ENV, "CLOUDFLARE_R2_SECRET_ACCESS_KEY") or env_get(APP_ENV, "CLOUDFLARE_R2_SECRET_ACCESS_KEY")
if not ACCOUNT_ID or not ACCESS_KEY or not SECRET_KEY:
    print("ERROR: R2 kredensial tidak lengkap (cloudflare.env / .env)", file=sys.stderr); sys.exit(1)

HOST = f"{ACCOUNT_ID}.r2.cloudflarestorage.com"
ENDPOINT = f"https://{HOST}"

def sign_v4(method, path, body=b""):
    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    region, service = "auto", "s3"
    payload_hash = hashlib.sha256(body).hexdigest()
    canonical_uri = "/" + path
    canonical_headers = f"host:{HOST}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n"
    signed_headers = "host;x-amz-content-sha256;x-amz-date"
    canonical_request = "\n".join([method, canonical_uri, "", canonical_headers, signed_headers, payload_hash])
    scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string_to_sign = "\n".join(["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical_request.encode()).hexdigest()])
    def hmac_sha256(key, msg):
        return hmac.new(key, msg.encode(), hashlib.sha256).digest()
    k_date = hmac_sha256(("AWS4" + SECRET_KEY).encode(), date_stamp)
    k_region = hmac_sha256(k_date, region)
    k_service = hmac_sha256(k_region, service)
    k_signing = hmac_sha256(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode(), hashlib.sha256).hexdigest()
    auth = (f"AWS4-HMAC-SHA256 Credential={ACCESS_KEY}/{scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}")
    return amz_date, payload_hash, auth

def head_object(key):
    path = f"{BUCKET}/{key}"
    amz_date, payload_hash, auth = sign_v4("HEAD", path)
    req = urllib.request.Request(f"{ENDPOINT}/{path}", method="HEAD")
    req.add_header("Authorization", auth)
    req.add_header("x-amz-date", amz_date)
    req.add_header("x-amz-content-sha256", payload_hash)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return f"ERR:{str(e)[:100]}"

def put_object(key, body):
    path = f"{BUCKET}/{key}"
    amz_date, payload_hash, auth = sign_v4("PUT", path, body)
    req = urllib.request.Request(f"{ENDPOINT}/{path}", data=body, method="PUT")
    req.add_header("Authorization", auth)
    req.add_header("x-amz-date", amz_date)
    req.add_header("x-amz-content-sha256", payload_hash)
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return f"ERR:{str(e)[:100]}"

def put_with_retry(key, body):
    for attempt in range(1, RETRIES + 1):
        res = put_object(key, body)
        if isinstance(res, int) and 200 <= res < 300:
            return res
        if isinstance(res, int) and 400 <= res < 500:
            return res
        if attempt < RETRIES:
            wait = 2 * attempt
            print(f"  upload retry {attempt}/{RETRIES - 1} setelah {wait}s ({res})", file=sys.stderr)
            time.sleep(wait)
    return res

# Enkripsi salinan off-site (owner 2026-09-28). Modul ada di direktori yang
# sama; berkas lokal tetap polos agar rantai pemulihan tidak berubah.
try:
    from scripts_backup_crypto import encrypt_bytes, key_available
except Exception as _e:
    print(f"WARN: modul enkripsi tidak terbaca ({_e})", file=sys.stderr)
    encrypt_bytes = None
    def key_available():
        return False

latest = os.path.join(BACKUP_DIR, LATEST_NAME)
if not os.path.exists(latest):
    print("ERROR: dump latest tidak ditemukan", file=sys.stderr); sys.exit(1)

remote_key = PREFIX + os.path.basename(os.path.realpath(latest))
if key_available():
    remote_key += ".enc"
st = head_object(remote_key)
if st == 200:
    print(f"skip: {remote_key} sudah di R2")
    sys.exit(0)
with open(latest, "rb") as f:
    body = f.read()
if key_available():
    body = encrypt_bytes(body)
else:
    print("WARN: kunci enkripsi tidak ada; salinan off-site TIDAK terenkripsi", file=sys.stderr)
    open("/root/backups/ALERT-backup-tanpa-enkripsi", "w").close()
final = put_with_retry(remote_key, body)
if isinstance(final, int) and 200 <= final < 300:
    print(f"upload {BUCKET}/{remote_key}: {final}")
    sys.exit(0)
print(f"upload {BUCKET}/{remote_key} GAGAL: {final}", file=sys.stderr)
sys.exit(1)
