# ADR-017: Retensi Data Pelanggan Lifetime dan Transparansi Kebijakan Privasi

## Status

Accepted

## Date

2026-09-02

## Context

THREAT-MODEL.md mencantumkan open item "tetapkan retensi/erasure PII". Pertanyaan yang
menggantung: jika pelanggan meminta penghapusan data, bagaimana arsip backup permanen
(prefix weekly/ dan monthly/, memuat snapshot PII historis) diperlakukan. Di sisi lain
data pesanan memang kebutuhan operasional nyata: pemrosesan pesanan, pengiriman ke alamat
pelanggan, garansi dan retur, pembukuan, serta pencegahan dan penyelesaian sengketa.

## Decision

Keputusan owner (2026-09-02):

1. Tidak ada mekanisme erasure PII otomatis dan tidak ada alur permintaan hapus mandiri.
   Retensi data pelanggan (customers, orders, order_items, payments, shipping, audit log)
   bersifat lifetime, konsisten dengan prinsip MAINTENANCE-SCHEMA "data inti tak pernah dihapus".
2. Kebijakan Privasi dan TOS wajib menjelaskan secara jujur bahwa data pesanan dipertahankan
   untuk kebutuhan operasional (pemrosesan, pengiriman, garansi/retur, pembukuan) dan TIDAK
   dipakai untuk tujuan lain (bukan profil iklan, bukan dibagikan ke pihak ketiga di luar
   kebutuhan pengiriman).
3. Arsip backup permanen boleh memuat PII historis tanpa prosedur purge khusus. Proteksinya
   adalah kontrol akses: bucket privat, kredensial terpisah per environment, tidak ada akses publik.
4. Open item retensi/erasure PII di THREAT-MODEL.md dianggap selesai oleh keputusan ini.
   Permintaan hapus individual (bila benar-benar terjadi) ditangani sebagai keputusan manual
   owner per kasus, bukan janji produk.

## Consequences

- Tidak ada biaya engineering untuk pipeline erasure/purge; kompleksitas arsip tetap rendah.
- Kebijakan Privasi dan TOS menjadi bagian kontrak pelanggan: copy storefront harus bahasa
  Indonesia sederhana, dan perubahan copy wajib review owner sebelum tayang.
- Backup tetap full-dump; tidak ada tabel PII yang dikecualikan dari backup harian maupun arsip.
- Jika suatu saat regulasi atau pola permintaan pelanggan berubah, keputusan ini dapat
  dipanggil kembali lewat ADR baru (bukan mengubah kebijakan diam-diam).

## Alternatives considered

- Erasure pipeline (hapus/anonimisasi per permintaan + purge arsip backup): kompleks,
  berisiko merusak integritas pembukuan/retur, dan permintaan hapus diprediksi sangat jarang
  untuk toko fisik yang melayani via WhatsApp. Ditolak untuk saat ini.
- Anonimisasi otomatis order lama: merusak KPI repeat customer, riwayat garansi, dan
  rekonsiliasi pembayaran. Ditolak.

## References / Evidence

- docs/security/THREAT-MODEL.md (open item retensi/erasure PII, ditandai selesai).
- docs/runbooks/MAINTENANCE-SCHEMA.md (prinsip data inti lifetime).
- docs/DEPLOYMENT.md bagian 8a (backup full 49 tabel, arsip mingguan/bulanan permanen).
- Percakapan owner 2026-09-02 (Hermes session).
