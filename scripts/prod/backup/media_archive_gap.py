#!/usr/bin/env python3
"""Jumlah objek media yang belum masuk arsip tambah-saja.

Mencetak satu angka ke stdout: jumlah objek yang ada di bucket produksi tetapi
belum ada di arsip. Angka 0 berarti arsip lengkap. Keluar 0 kalau berhasil,
1 kalau gagal (kredensial, jaringan), supaya kegagalan pemeriksaan tidak
terbaca sebagai "arsip lengkap".

Kredensial dibaca dari .env aplikasi. Hanya membaca daftar objek.
"""
import sys

ENV_FILE = '/var/www/ragilaluminium/shared/.env'
SRC_BUCKET = 'ra-media-prod'
DST_BUCKET = 'ra-backup-prod'
DST_PREFIX = 'media/'
SKIP_PREFIXES = ('test/', 'healthchecks/', 'pending/')


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


def main():
    try:
        import boto3
        from botocore.config import Config

        env = load_env(ENV_FILE)
        s3 = boto3.client(
            's3',
            endpoint_url=env['AWS_ENDPOINT'],
            aws_access_key_id=env['CLOUDFLARE_R2_ACCESS_KEY_ID'],
            aws_secret_access_key=env['CLOUDFLARE_R2_SECRET_ACCESS_KEY'],
            region_name='auto',
            config=Config(connect_timeout=10, read_timeout=30,
                          retries={'max_attempts': 2, 'mode': 'standard'}),
        )

        src = set()
        for page in s3.get_paginator('list_objects_v2').paginate(Bucket=SRC_BUCKET):
            for obj in page.get('Contents', []):
                if not obj['Key'].startswith(SKIP_PREFIXES):
                    src.add(obj['Key'])

        dst = set()
        for page in s3.get_paginator('list_objects_v2').paginate(
                Bucket=DST_BUCKET, Prefix=DST_PREFIX):
            for obj in page.get('Contents', []):
                dst.add(obj['Key'][len(DST_PREFIX):])
    except Exception as exc:  # noqa: BLE001
        print('ERR %s' % str(exc)[:160], file=sys.stderr)
        return 1

    print(len(src - dst))
    return 0


if __name__ == '__main__':
    sys.exit(main())
