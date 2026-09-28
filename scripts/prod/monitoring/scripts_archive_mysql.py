#!/usr/bin/env python3
"""Archive a verified daily dump to R2 weekly/monthly prefix."""
import datetime, hashlib, hmac, os, re, sys, time, urllib.request, urllib.error

CLOUD_ENV = "/root/.config/ragilaluminium/cloudflare.env"
APP_ENV = "/root/ragilaluminium/.env"
BUCKET = "ra-backup"
RETRIES = 3

def env_get(path, key):
    try:
        for line in open(path):
            m = re.match(rf"^{key}=(.*)$", line.strip())
            if m: return m.group(1).strip()
    except FileNotFoundError: pass
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

def request(method, key, body=b""):
    path = f"{BUCKET}/{key}"
    amz, payload, auth = sign(method, path, body)
    req = urllib.request.Request(f"{ENDPOINT}/{path}", data=body if method == "PUT" else None, method=method)
    req.add_header("Authorization", auth); req.add_header("x-amz-date", amz); req.add_header("x-amz-content-sha256", payload)
    try:
        with urllib.request.urlopen(req, timeout=600) as r: return r.status
    except urllib.error.HTTPError as e: return e.code
    except Exception as e: return f"ERR:{str(e)[:100]}"

def upload(src, key):
    body = open(src, "rb").read()
    if request("HEAD", key) == 200:
        print(f"skip: {BUCKET}/{key} already exists"); return 0
    for attempt in range(1, RETRIES + 1):
        result = request("PUT", key, body)
        if isinstance(result, int) and 200 <= result < 300:
            print(f"upload {BUCKET}/{key}: {result} ({len(body)} bytes)"); return 0
        if isinstance(result, int) and 400 <= result < 500: break
        if attempt < RETRIES: time.sleep(attempt * 2)
    print(f"upload {BUCKET}/{key} FAILED: {result}", file=sys.stderr); return 1

if len(sys.argv) != 3:
    print("usage: scripts_archive_mysql.py SOURCE_GZ R2_KEY", file=sys.stderr); sys.exit(2)
src, key = sys.argv[1:]
if not os.path.isfile(src):
    print(f"ERROR: source not found: {src}", file=sys.stderr); sys.exit(1)
sys.exit(upload(src, key))
