#!/usr/bin/env python3
"""Enkripsi salinan cadangan sebelum diunggah ke R2 (owner 2026-09-28).

Latar: berkas cadangan hanya dikompres, tidak dienkripsi, sehingga nama, nomor
HP, email, dan alamat pelanggan tersimpan terbaca apa adanya. Bila kredensial
R2 atau salinan itu bocor, identitas pelanggan langsung terbuka.

Kebijakan: HANYA salinan off-site (R2) yang dienkripsi. Berkas lokal tetap
polos supaya rantai pemulihan yang sudah terbukti (uji restore mingguan,
arsip dari dump lokal, drill PITR) tidak berubah sama sekali.

Kunci: /root/backups/.backup-key (mode 400). Tanpa kunci ini, salinan
terenkripsi TIDAK BISA dibuka. Kunci disalin ke Telegram pemilik saat dibuat.
"""
import os
import subprocess

KEY_FILE = "/root/backups/.backup-key"
ITER = "200000"


def key_available() -> bool:
    """True bila kunci ada dan tidak kosong."""
    try:
        return os.path.isfile(KEY_FILE) and os.path.getsize(KEY_FILE) > 0
    except OSError:
        return False


def _run(args: list[str], data: bytes) -> bytes:
    hasil = subprocess.run(
        args,
        input=data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if hasil.returncode != 0:
        raise RuntimeError(
            "openssl gagal: " + hasil.stderr.decode(errors="replace")[:200]
        )

    return hasil.stdout


def encrypt_bytes(data: bytes) -> bytes:
    """Enkripsi isi berkas dengan kunci lokal (AES-256-CBC + PBKDF2)."""
    return _run(
        [
            "openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", ITER, "-salt",
            "-pass", f"file:{KEY_FILE}",
        ],
        data,
    )


def decrypt_bytes(data: bytes) -> bytes:
    """Buka isi berkas terenkripsi dengan kunci lokal."""
    return _run(
        [
            "openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", ITER,
            "-pass", f"file:{KEY_FILE}",
        ],
        data,
    )
