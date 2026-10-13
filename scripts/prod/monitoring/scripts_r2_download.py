#!/usr/bin/env python3
"""Download object dari R2 (ra-backup) via SigV4 stdlib — untuk drill PITR.
Pakai: scripts_r2_download.py <key> <dest_file>
Exit 0 = sukses; 1 = gagal/not found.
"""
import datetime, hashlib, hmac, os, re, sys, urllib.request, urllib.error

CLOUD_ENV = "/root/.config/ragilaluminium/cloudflare.env"
APP_ENV = "/root/ragilaluminium/.env"
BUCKET = "ra-backup"

def env_get(path, key):
    try:
        for line in open(path):
            m = re.match(rf"^{key}=(.*)$", line.strip())
            if m:
                return m.group(1).strip()
    except FileNotFoundError:
        pass
    return ""

ACCOUNT_ID = env_get(CLOUD_ENV, "CLOUDFLARE_ACCOUNT_ID") or env_get(APP_ENV, "CLOUDFLARE_ACCOUNT_ID")
ACCESS_KEY = env_get(CLOUD_ENV, "CLOUDFLARE_R2_ACCESS_KEY_ID") or env_get(APP_ENV, "CLOUDFLARE_R2_ACCESS_KEY_ID")
SECRET_KEY = env_get(CLOUD_ENV, "CLOUDFLARE_R2_SECRET_ACCESS_KEY") or env_get(APP_ENV, "CLOUDFLARE_R2_SECRET_ACCESS_KEY")
if not all((ACCOUNT_ID, ACCESS_KEY, SECRET_KEY)):
    print("ERROR: R2 credentials incomplete", file=sys.stderr); sys.exit(1)
HOST = f"{ACCOUNT_ID}.r2.cloudflarestorage.com"
ENDPOINT = f"https://{HOST}"

def sign(method, path, body=b""):
    now = datetime.datetime.now(datetime.timezone.utc)
    amz, day = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
    payload = hashlib.sha256(body).hexdigest()
    headers = f"host:{HOST}\nx-amz-content-sha256:{payload}\nx-amz-date:{amz}\n"
    signed = "host;x-amz-content-sha256;x-amz-date"
    canonical = "\n".join((method, "/" + path, "", headers, signed, payload))
    scope = f"{day}/auto/s3/aws4_request"
    sts = "\n".join(("AWS4-HMAC-SHA256", amz, scope, hashlib.sha256(canonical.encode()).hexdigest()))
    def hm(key, msg): return hmac.new(key, msg.encode(), hashlib.sha256).digest()
    k = hm(hm(hm(hm(("AWS4" + SECRET_KEY).encode(), day), "auto"), "s3"), "aws4_request")
    auth = f"AWS4-HMAC-SHA256 Credential={ACCESS_KEY}/{scope}, SignedHeaders={signed}, Signature={hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()}"
    return amz, payload, auth

def get_object(key, dest):
    path = f"{BUCKET}/{key}"
    amz, payload, auth = sign("GET", path)
    req = urllib.request.Request(f"{ENDPOINT}/{path}", method="GET")
    req.add_header("Authorization", auth)
    req.add_header("x-amz-date", amz)
    req.add_header("x-amz-content-sha256", payload)
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            data = r.read()
            with open(dest, "wb") as f:
                f.write(data)
            print(f"download {BUCKET}/{key}: {r.status} ({len(data)} bytes)")
            return 0
    except urllib.error.HTTPError as e:
        print(f"download {BUCKET}/{key}: HTTP {e.code}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"download {BUCKET}/{key}: ERR {e}", file=sys.stderr)
        return 1

if len(sys.argv) != 3:
    print("usage: scripts_r2_download.py <key> <dest>", file=sys.stderr); sys.exit(2)
sys.exit(get_object(sys.argv[1], sys.argv[2]))
