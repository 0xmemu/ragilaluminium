#!/usr/bin/env python3
"""
diagnose_522.py - Diagnosa terpadu saat Error 522 (atau 520/524/525) muncul lagi.

Dipakai di VPS produksi 202, sebagai root, dengan token Cloudflare berizin
"Account Analytics Read" disediakan lewat variabel lingkungan.

Contoh pakai (waktu WIB, sama dengan yang tampil di dashboard dan jam dinding):

    CF_API_TOKEN=xxx CF_ACCOUNT_ID=05b9c205... \
      python3 diagnose_522.py --since "2026-10-16 09:00" --until "2026-10-16 09:50"

Bila hanya satu jam yang ingin diperiksa:

    ... python3 diagnose_522.py --at "2026-10-16 09:00"

Keluaran: lima bagian bukti plus satu KESIMPULAN. Bagian KESIMPULAN itulah yang
menjawab "ada apa": apakah yang rusak aplikasi kita, atau jalur Cloudflare ke
server. Itu dua hal yang penanganannya berbeda jauh.

Tanpa token Cloudflare, skrip tetap jalan dan hanya bagian server yang keluar.
"""

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

WIB = dt.timezone(dt.timedelta(hours=7))
ACCT_DEFAULT = "05b9c2057a97d6b2874536dfcf922058"
ZONE_DEFAULT = "4be7d56dd651136991f8ea3fba832f17"
GQL = "https://api.cloudflare.com/client/v4/graphql"
NGINX_ACCESS = ["/var/log/nginx/access.log", "/var/log/nginx/access.log.1"]
NGINX_ERROR = ["/var/log/nginx/error.log", "/var/log/nginx/error.log.1"]
PHP_FPM_LOG = "/var/log/php8.3-fpm.log"
HEALTH_LOG = "/root/backups/health-alert.log"

BAR = "=" * 78


def head(title):
    print()
    print(BAR)
    print(title)
    print(BAR)


def sh(cmd):
    """Jalankan perintah shell, kembalikan stdout. Aman bila gagal."""
    try:
        p = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120)
        return p.stdout
    except Exception as e:
        return ""


def parse_wib(s):
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return dt.datetime.strptime(s, fmt).replace(tzinfo=WIB)
        except ValueError:
            continue
    sys.exit("Format waktu tidak dikenal: %r (pakai 'YYYY-MM-DD HH:MM')" % s)


# ---------------------------------------------------------------------------
# Bagian 1: analitik Cloudflare
# ---------------------------------------------------------------------------

def gql(token, query, variables):
    body = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(
        GQL, data=body,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=120).read().decode())
    except urllib.error.HTTPError as e:
        return {"http": e.code, "body": e.read().decode()[:400]}
    except Exception as e:
        return {"exception": repr(e)}


WRAP = """query ($a: Time!, $b: Time!) {
  viewer { accounts(filter: {accountTag: "%s"}) {
    httpRequestsAdaptiveGroups(limit: 500,
      filter: {datetime_geq: $a, datetime_leq: $b%s},
      orderBy: [%s]) {
      count
      dimensions { %s }
    }
  } }
}"""


def cf_rows(token, acct, filt, order, dims, a_utc, b_utc):
    q = WRAP % (acct, filt, order, dims)
    r = gql(token, q, {"a": a_utc, "b": b_utc})
    if not isinstance(r, dict):
        print("  (jawaban tidak terduga)")
        return []
    if r.get("errors"):
        print("  DITOLAK: %s" % str(r["errors"][0].get("message", ""))[:180])
        return []
    if r.get("http") or r.get("exception"):
        print("  GAGAL: %s" % json.dumps(r)[:200])
        return []
    try:
        return r["data"]["viewer"]["accounts"][0]["httpRequestsAdaptiveGroups"]
    except Exception:
        print("  bentuk tak terduga: %s" % json.dumps(r)[:200])
        return []


def cf_section(token, acct, a_utc, b_utc):
    head("1. ANALITIK CLOUDFLARE (yang dilihat pengunjung)")
    if not token:
        print("  Dilewati: CF_API_TOKEN tidak diberikan.")
        return None

    print("  -- status tepi per menit --")
    rows = cf_rows(token, acct, "", "datetimeMinute_ASC",
                   "datetimeMinute edgeResponseStatus", a_utc, b_utc)
    per_status = {}
    for r in rows:
        st = r["dimensions"]["edgeResponseStatus"]
        per_status[st] = per_status.get(st, 0) + r["count"]
    if per_status:
        for st, c in sorted(per_status.items(), key=lambda x: -x[1]):
            tanda = "  <-- perhatian" if st in (520, 521, 522, 523, 524, 525) else ""
            print("     %-5s %6d%s" % (st, c, tanda))
    else:
        print("     (tidak ada data)")

    print()
    print("  -- jalur yang paling sering gagal (5xx) --")
    rows = cf_rows(token, acct, ", edgeResponseStatus_geq: 500", "count_DESC",
                   "clientRequestPath edgeResponseStatus", a_utc, b_utc)
    if not rows:
        print("     (tidak ada 5xx pada rentang ini)")
    for r in rows[:15]:
        d = r["dimensions"]
        print("     %-5s %-44s %d" % (d["edgeResponseStatus"], d["clientRequestPath"][:44], r["count"]))

    print()
    print("  -- 522 per titik data center (colo) --")
    rows = cf_rows(token, acct, ", edgeResponseStatus: 522", "count_DESC", "coloCode", a_utc, b_utc)
    if not rows:
        print("     (tidak ada 522)")
    for r in rows[:12]:
        print("     colo %-8s %d" % (r["dimensions"]["coloCode"], r["count"]))

    print()
    print("  -- status balasan origin (0 = origin tidak menjawab sama sekali) --")
    rows = cf_rows(token, acct, "", "count_DESC", "originResponseStatus", a_utc, b_utc)
    origin_zero = 0
    for r in rows[:12]:
        st = r["dimensions"]["originResponseStatus"]
        if str(st) == "0":
            origin_zero = r["count"]
        print("     origin %-5s %d" % (st, r["count"]))
    return {"per_status": per_status, "origin_zero": origin_zero}


# ---------------------------------------------------------------------------
# Bagian 2 sampai 4: bukti dari server
# ---------------------------------------------------------------------------

def shell_quote(s):
    return "'" + s.replace("'", "'\\''") + "'"


def server_section(a_wib, b_wib):
    """Cari bukti di log server pada rentang waktu yang sama."""
    stamp_fmt = "%d/%b/%Y:%H:%M"
    # Rentang menit untuk dicocokkan ke format log nginx.
    stamps = []
    cur = a_wib.replace(second=0, microsecond=0)
    while cur <= b_wib:
        stamps.append(cur.strftime(stamp_fmt))
        cur += dt.timedelta(minutes=1)
    # Pola: ":HH:MM:" untuk setiap menit pada rentang.
    pat_min = "|".join(re.escape(s.split(":", 1)[1]) for s in stamps)

    head("2. LOG AKSES NGINX (yang dicatat server kita)")
    print("  -- status kode yang dicatat nginx pada rentang ini --")
    txt = sh("grep -hE %s /var/log/nginx/access.log /var/log/nginx/access.log.1 2>/dev/null"
             % shell_quote("(%s)" % pat_min))
    total = 0
    counter = {}
    for line in txt.splitlines():
        m = re.search(r'"\s+(\d{3})\s', line)
        if m:
            counter[m.group(1)] = counter.get(m.group(1), 0) + 1
            total += 1
    if not counter:
        print("     (TIDAK ADA permintaan tercatat di server pada rentang ini)")
    for st, c in sorted(counter.items(), key=lambda x: -x[1]):
        tanda = "  <-- perhatian" if st.startswith("5") else ""
        print("     %-5s %6d%s" % (st, c, tanda))
    print("     total permintaan tercatat: %d" % total)

    print()
    print("  -- galat nginx (bila ada) --")
    err = sh("grep -hE %s /var/log/nginx/error.log /var/log/nginx/error.log.1 2>/dev/null | tail -20"
             % shell_quote("(upstream timed out|connect\\(\\) failed|worker_connections|no live upstreams|SSL_do_handshake)"))
    print(err.rstrip() if err.strip() else "     (tidak ada galat upstream/TLS)")

    head("3. KOLAM PHP (bila penuh, server yang salah)")
    warn = sh("grep -hE %s %s 2>/dev/null | tail -15"
              % (shell_quote("(busy|max_children|max_requests)"), shell_quote(PHP_FPM_LOG)))
    print(warn.rstrip() if warn.strip() else "     (tidak ada peringatan kolam penuh)")

    head("4. PENGAWAS SENDIRI DAN BEBAN MESIN")
    print("  -- entri KRITIS pengawas pada rentang ini --")
    day = a_wib.strftime("%Y-%m-%d")
    krit = sh("grep -hE %s %s 2>/dev/null | tail -15"
              % (shell_quote("^%s.*(KRITIS|masih kritis|PULIH)" % day), shell_quote(HEALTH_LOG)))
    print(krit.rstrip() if krit.strip() else "     (tidak ada entri pada tanggal itu)")

    print()
    print("  -- beban mesin (sar) --")
    sarfile = "/var/log/sysstat/sa%s" % a_wib.strftime("%d")
    if os.path.exists(sarfile):
        cpu = sh("LC_ALL=C sar -u -f %s -s %s -e %s 2>/dev/null | head -14"
                 % (shell_quote(sarfile), shell_quote(a_wib.strftime("%H:%M:00")),
                    shell_quote(b_wib.strftime("%H:%M:00"))))
        print(cpu.rstrip() if cpu.strip() else "     (sar tidak tersedia)")
    else:
        print("     (berkas sar %s tidak ada)" % sarfile)

    print()
    print("  -- penghitung kernel yang penting --")
    nstat = sh("nstat -az 2>/dev/null | grep -E "
               "'ListenOverflows|ListenDrops|SyncookiesSent|TCPBacklogDrop|TCPReqQFullDrop'")
    print(nstat.rstrip() if nstat.strip() else "     (nstat tidak tersedia)")

    return {"total": total, "counter": counter}


# ---------------------------------------------------------------------------
# Kesimpulan
# ---------------------------------------------------------------------------

def verdict(cf, srv):
    head("KESIMPULAN")
    if srv is None:
        print("  Data server tidak terbaca, tidak bisa menyimpulkan.")
        return
    counter = srv["counter"]
    total = srv["total"]
    err5 = sum(c for st, c in counter.items() if st.startswith("5"))

    cf5 = 0
    origin_zero = 0
    if cf:
        for st, c in cf["per_status"].items():
            if st in (520, 521, 522, 523, 524, 525):
                cf5 += c
        origin_zero = cf.get("origin_zero", 0)

    print("  Ringkas:")
    print("    permintaan tercatat di server      : %d" % total)
    print("    galat 5xx yang dicatat server      : %d" % err5)
    print("    galat 5xx yang dilihat Cloudflare  : %d" % cf5)
    print("    permintaan dengan origin diam (0)  : %d" % origin_zero)
    print()

    if cf5 == 0 and err5 == 0:
        print("  BACAAN: tidak ada kegagalan pada rentang ini.")
        print("  Periksa ulang jamnya, dan pastikan zona waktu WIB (+07).")
        return

    if total == 0:
        print("  BACAAN: TIDAK ADA permintaan sampai ke server, padahal Cloudflare")
        print("  mencatat kegagalan. Artinya paketnya tidak pernah tiba di mesin.")
        print("  Ini ciri jalur Cloudflare ke server, bukan aplikasi.")
        print("  Langkah: minta Ray ID, hubungi penyedia (Biznet Gio), dan periksa")
        print("  pengawas dari luar.")
        return

    if err5 == 0 and cf5 > 0:
        print("  BACAAN: server kita MELAYANI permintaan dengan baik (nol 5xx di log")
        print("  sendiri), tetapi Cloudflare melaporkan kegagalan. Artinya balasan")
        print("  tidak kembali ke Cloudflare, atau sambungan gagal terbentuk.")
        print("  Ini ciri jalur Cloudflare ke server, bukan aplikasi.")
        return

    if err5 > 0:
        print("  BACAAN: server kita SENDIRI mencatat galat 5xx. Jadi kali ini")
        print("  masalahnya di aplikasi atau kapasitas server, bukan jalur.")
        print("  Periksa bagian 3 (kolam PHP) di atas, dan jalur yang gagal di")
        print("  bagian 1.")
        return

    print("  BACAAN: campuran. Bandingkan bagian 1 dan 2 di atas.")


def main():
    ap = argparse.ArgumentParser(description="Diagnosa Error 522 dan kerabatnya.")
    ap.add_argument("--since", help="awal rentang, waktu WIB, mis. '2026-10-16 09:00'")
    ap.add_argument("--until", help="akhir rentang, waktu WIB, mis. '2026-10-16 09:50'")
    ap.add_argument("--at", help="satu jam saja, mis. '2026-10-16 09:00' (menjadi 60 menit)")
    args = ap.parse_args()

    if args.at:
        a_wib = parse_wib(args.at)
        b_wib = a_wib + dt.timedelta(hours=1)
    elif args.since:
        a_wib = parse_wib(args.since)
        b_wib = parse_wib(args.until) if args.until else a_wib + dt.timedelta(hours=1)
    else:
        ap.error("berikan --at atau --since")

    token = os.environ.get("CF_API_TOKEN", "").strip()
    acct = os.environ.get("CF_ACCOUNT_ID", ACCT_DEFAULT).strip()

    a_utc = a_wib.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    b_utc = b_wib.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    print(BAR)
    print("DIAGNOSA ERROR 522")
    print("Rentang WIB : %s sampai %s" % (a_wib.strftime("%Y-%m-%d %H:%M"),
                                         b_wib.strftime("%Y-%m-%d %H:%M")))
    print("Rentang UTC : %s sampai %s" % (a_utc, b_utc))
    print("Token CF    : %s" % ("ada" if token else "TIDAK ADA (bagian 1 dilewati)"))

    cf = cf_section(token, acct, a_utc, b_utc)
    srv = server_section(a_wib, b_wib)
    verdict(cf, srv)

    print()
    print(BAR)
    print("Bila kesimpulannya jalur Cloudflare, yang perlu diminta ke Cloudflare")
    print("adalah RAY ID dari halaman error, karena di situ terlihat IP origin")
    print("yang gagal dihubungi.")
    print(BAR)


if __name__ == "__main__":
    main()
