#!/usr/bin/env python3
"""Umur objek terbaru di bucket backup R2, untuk pemeriksaan kebasian.

Mencetak dua angka detik ke stdout: <umur_dump> <umur_binlog>.
Keluar 0 kalau berhasil, 1 kalau gagal (kredensial hilang, jaringan, dsb).

Kredensial dibaca dari .env aplikasi, sama seperti proses backup lain, supaya
tidak ada salinan rahasia baru di disk. Skrip ini hanya membaca daftar objek.
"""
import sys
from datetime import datetime, timezone

ENV_FILE = '/var/www/ragilaluminium/shared/.env'
BUCKET = 'ra-backup-prod'
DUMP_PREFIX = 'mysql/'
BINLOG_PREFIX = 'binlogs/'


def load_env(path):
    env = {}
    with open(path, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            env[key.strip()] = value.strip().strip('"')
    return env


def newest_age_seconds(s3, bucket, prefix):
    """Umur objek terbaru di bawah prefix, atau -1 kalau tidak ada objek."""
    newest = None
    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get('Contents', []):
            stamp = obj['LastModified']
            if newest is None or stamp > newest:
                newest = stamp
    if newest is None:
        return -1
    return int((datetime.now(timezone.utc) - newest).total_seconds())


def main():
    try:
        import boto3

        env = load_env(ENV_FILE)
        s3 = boto3.client(
            's3',
            endpoint_url=env['AWS_ENDPOINT'],
            aws_access_key_id=env['CLOUDFLARE_R2_ACCESS_KEY_ID'],
            aws_secret_access_key=env['CLOUDFLARE_R2_SECRET_ACCESS_KEY'],
            region_name='auto',
        )
        dump_age = newest_age_seconds(s3, BUCKET, DUMP_PREFIX)
        binlog_age = newest_age_seconds(s3, BUCKET, BINLOG_PREFIX)
    except Exception as exc:  # noqa: BLE001 - apa pun penyebabnya, laporkan gagal
        print('ERR %s' % str(exc)[:160], file=sys.stderr)
        return 1

    print('%d %d' % (dump_age, binlog_age))
    return 0


if __name__ == '__main__':
    sys.exit(main())
