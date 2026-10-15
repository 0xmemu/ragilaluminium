#!/usr/bin/env python3
"""Pulihkan objek media dari arsip tambah-saja ke bucket produksi.

Mengapa: bucket produksi tidak mendukung versioning, dan penghapusan media di
panel admin benar-benar menghapus berkasnya. Arsip tambah-saja menyimpan salinan
yang tidak pernah ditimpa, sehingga objek yang terhapus bisa dikembalikan.

Pakai:
  media-restore.py --daftar              # tampilkan objek yang ada di arsip
                                         # tapi tidak ada di produksi
  media-restore.py --key=<key>           # pulihkan satu objek
  media-restore.py --semua-hilang        # pulihkan semua objek yang hilang
  media-restore.py --semua-hilang --dry-run

Objek yang masih ada di produksi TIDAK pernah ditimpa, kecuali diminta eksplisit
dengan --timpa. Kredensial dibaca dari .env aplikasi.
"""
import sys
from urllib.parse import quote

ENV_FILE = '/var/www/ragilaluminium/shared/.env'
SRC_BUCKET = 'ra-backup-prod'
SRC_PREFIX = 'media/'
DST_BUCKET = 'ra-media-prod'


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


def list_keys(s3, bucket, prefix=''):
    keys = {}
    for page in s3.get_paginator('list_objects_v2').paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get('Contents', []):
            key = obj['Key']
            if bucket == SRC_BUCKET:
                key = key[len(prefix):] if key.startswith(prefix) else key
            keys[key] = obj['Size']
    return keys


def main():
    dry = '--dry-run' in sys.argv
    daftar = '--daftar' in sys.argv
    semua = '--semua-hilang' in sys.argv
    timpa = '--timpa' in sys.argv
    satu = None
    for arg in sys.argv[1:]:
        if arg.startswith('--key='):
            satu = arg[len('--key='):]

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

    arsip = list_keys(s3, SRC_BUCKET, SRC_PREFIX)
    produksi = list_keys(s3, DST_BUCKET)
    hilang = sorted(k for k in arsip if k not in produksi)

    if daftar or not (satu or semua):
        print('arsip    : %d objek (%.2f MB)' % (len(arsip), sum(arsip.values()) / 1048576))
        print('produksi : %d objek (%.2f MB)' % (len(produksi), sum(produksi.values()) / 1048576))
        print('hilang dari produksi tapi ada di arsip: %d objek' % len(hilang))
        for k in hilang[:40]:
            print('   %s (%.1f KB)' % (k, arsip[k] / 1024))
        if len(hilang) > 40:
            print('   ... dan %d lainnya' % (len(hilang) - 40))
        if not (satu or semua):
            print()
            print('Pakai --key=<key> atau --semua-hilang untuk memulihkan.')
        return 0

    if satu:
        if satu not in arsip:
            print('GAGAL: %s tidak ada di arsip' % satu, file=sys.stderr)
            return 1
        if satu in produksi and not timpa:
            print('objek sudah ada di produksi; pakai --timpa kalau memang ingin menimpa')
            return 0
        sasaran = [satu]
    else:
        if not hilang:
            print('tidak ada objek hilang; tidak ada yang dipulihkan')
            return 0
        sasaran = hilang

    print('akan dipulihkan: %d objek (%.2f MB)'
          % (len(sasaran), sum(arsip[k] for k in sasaran) / 1048576))
    if dry:
        for k in sasaran[:40]:
            print('   [dry-run] %s' % k)
        if len(sasaran) > 40:
            print('   ... dan %d lainnya' % (len(sasaran) - 40))
        print('mode dry-run: tidak ada yang disalin.')
        return 0

    ok = 0
    gagal = []
    for key in sasaran:
        try:
            s3.copy_object(
                Bucket=DST_BUCKET,
                Key=key,
                CopySource={'Bucket': SRC_BUCKET, 'Key': quote(SRC_PREFIX + key)},
                MetadataDirective='COPY',
            )
            ok += 1
        except Exception as exc:  # noqa: BLE001
            gagal.append('%s: %s' % (key, str(exc)[:90]))

    print('dipulihkan = %d, gagal = %d' % (ok, len(gagal)))
    for g in gagal[:10]:
        print('  GAGAL', g)

    # Verifikasi: objek yang dipulihkan harus ada lagi di produksi.
    produksi2 = list_keys(s3, DST_BUCKET)
    masih = [k for k in sasaran if k not in produksi2]
    print('sesudah pulih: produksi %d objek, belum kembali %d objek'
          % (len(produksi2), len(masih)))
    return 1 if (gagal or masih) else 0


if __name__ == '__main__':
    sys.exit(main())
