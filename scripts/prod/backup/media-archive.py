#!/usr/bin/env python3
"""Arsipkan objek media produksi ke bucket backup, TAMBAH-SAJA.

Mengapa: bucket `ra-media-prod` tidak mendukung versioning (R2 menjawab
NotImplemented untuk PutBucketVersioning), sehingga objek yang terhapus atau
tertimpa tidak bisa dipulihkan. Penghapusan media lewat panel admin juga sudah
benar-benar menghapus berkasnya di R2.

Sifat arsip ini:
  - TAMBAH-SAJA. Objek yang sudah ada di arsip tidak pernah ditimpa atau dihapus,
    jadi objek yang hilang dari bucket produksi tetap bisa diambil dari arsip.
  - Bukan mirror. Tidak ada sinkronisasi dua arah dan tidak ada penghapusan.
  - Salinan antar bucket dilakukan sisi server, jadi tidak ada unduhan ke disk.

Pakai:
  media-archive.py              # arsipkan objek yang belum ada di arsip
  media-archive.py --lapor      # hanya melaporkan selisih, tanpa menyalin
  media-archive.py --verifikasi # bandingkan arsip dengan sumber, tanpa menyalin

Kredensial dibaca dari .env aplikasi. Keluar 0 kalau sukses, 1 kalau ada gagal.
"""
import sys
from urllib.parse import quote

ENV_FILE = '/var/www/ragilaluminium/shared/.env'
SRC_BUCKET = 'ra-media-prod'
DST_BUCKET = 'ra-backup-prod'
DST_PREFIX = 'media/'
# Awalan yang tidak perlu diarsipkan: berkas uji dan penanda kesehatan, bukan media.
SKIP_PREFIXES = ('test/', 'healthchecks/', 'pending/')
BATCH = 500


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


def list_objects(s3, bucket, prefix=''):
    """Peta key -> ukuran, memakai paginator."""
    out = {}
    for page in s3.get_paginator('list_objects_v2').paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get('Contents', []):
            key = obj['Key']
            if bucket == SRC_BUCKET and key.startswith(SKIP_PREFIXES):
                continue
            if bucket == DST_BUCKET:
                key = key[len(prefix):] if key.startswith(prefix) else key
            out[key] = obj['Size']
    return out


def main():
    lapor = '--lapor' in sys.argv
    verifikasi = '--verifikasi' in sys.argv

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
            config=Config(retries={'max_attempts': 3, 'mode': 'standard'},
                          connect_timeout=15, read_timeout=60),
        )
    except Exception as exc:  # noqa: BLE001
        print('GAGAL menyiapkan klien: %s' % str(exc)[:160], file=sys.stderr)
        return 1

    print('membaca daftar objek sumber...')
    sumber = list_objects(s3, SRC_BUCKET)
    print('  sumber (%s): %d objek, %.2f MB'
          % (SRC_BUCKET, len(sumber), sum(sumber.values()) / 1048576))

    print('membaca daftar objek arsip...')
    arsip = list_objects(s3, DST_BUCKET, DST_PREFIX)
    print('  arsip  (%s/%s): %d objek, %.2f MB'
          % (DST_BUCKET, DST_PREFIX, len(arsip), sum(arsip.values()) / 1048576))

    belum = sorted(k for k in sumber if k not in arsip)
    hilang = sorted(k for k in arsip if k not in sumber)
    print()
    print('belum diarsipkan : %d objek (%.2f MB)'
          % (len(belum), sum(sumber[k] for k in belum) / 1048576))
    print('ada di arsip tapi tidak di sumber : %d objek' % len(hilang))

    if verifikasi:
        beda = [k for k in sumber if k in arsip and sumber[k] != arsip[k]]
        print('ukuran berbeda antara sumber dan arsip : %d objek' % len(beda))
        for k in beda[:10]:
            print('   %s (sumber=%d arsip=%d)' % (k, sumber[k], arsip[k]))
        for k in hilang[:10]:
            print('   hanya di arsip: %s' % k)
        return 0

    if lapor or not belum:
        print()
        print('mode lapor: tidak ada yang disalin.' if lapor else 'arsip sudah lengkap.')
        return 0

    print()
    print('menyalin (sisi server)...')
    ok = 0
    gagal = []
    for i, key in enumerate(belum, 1):
        try:
            s3.copy_object(
                Bucket=DST_BUCKET,
                Key=DST_PREFIX + key,
                CopySource={'Bucket': SRC_BUCKET, 'Key': quote(key)},
                MetadataDirective='COPY',
            )
            ok += 1
            if ok % 100 == 0:
                print('  ... %d/%d' % (ok, len(belum)))
        except Exception as exc:  # noqa: BLE001
            gagal.append('%s: %s' % (key, str(exc)[:90]))

    print('disalin = %d, gagal = %d' % (ok, len(gagal)))
    for g in gagal[:10]:
        print('  GAGAL', g)

    # Verifikasi sesudah salin: arsip harus memuat seluruh objek sumber.
    arsip2 = list_objects(s3, DST_BUCKET, DST_PREFIX)
    kurang = [k for k in sumber if k not in arsip2]
    print('sesudah salin: arsip %d objek, sumber belum terarsip %d objek'
          % (len(arsip2), len(kurang)))
    for k in kurang[:10]:
        print('   belum terarsip: %s' % k)

    return 1 if (gagal or kurang) else 0


if __name__ == '__main__':
    sys.exit(main())
