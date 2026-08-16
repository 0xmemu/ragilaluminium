# Feature 04 — Alamat, Kode Pos, dan Ongkir

**Status implementasi:** region/ongkir dasar ada; mapping kode pos belum lengkap dan prioritas. **Aktor:** customer, provider/system, admin.

## Customer flow
1. Provinsi → kabupaten/kota → kecamatan → desa.
2. Lookup kode pos otomatis dari mapping desa/kelurahan internal.
3. Tampilkan kode pos/detail alamat (patokan/RT/RW).
4. Jika alamat atau kode pos tidak terdaftar, titik lokasi/peta dapat dipakai sebagai fallback opsional untuk membantu menemukan dan mengonfirmasi alamat; koordinat tidak menjadi sumber kode pos.
5. Hitung ongkir destination/berat/dimensi/service.
6. Tampilkan normal, subsidi, net, ETA sistem + 1 hari.
CSV storage/app/wilayah/*.csv belum lengkap kode pos. Target dataset up-to-date, parent-child konsisten, source/version, update terverifikasi.

## UI/UX states
Dependent child disabled; kode pos tampil tepat di bawah desa dan otomatis dari mapping desa/kelurahan aktif; jika mapping belum tersedia, input manual menjadi pengecualian; fallback titik/peta opsional tidak menimpa kode pos internal; dataset desa aktif menjadi fallback bila peta tidak tersedia; ongkir loading/success/pending review/provider unavailable/invalid tanpa angka palsu. COD reason saat dipilih dan Transfer ditawarkan.

## Optional location pin fallback
- Fallback hanya untuk membantu customer menemukan dan mengonfirmasi titik alamat ketika lookup internal tidak menemukan alamat.
- Postal code final tetap berasal dari mapping desa/kelurahan internal; titik/koordinat tidak menjadi sumber atau pengganti kode pos.
- UI boleh menampilkan konfirmasi titik lokasi, tetapi penyimpanan koordinat bukan kontrak order yang ditetapkan di fitur ini.
- Jika fallback tidak tersedia atau gagal, customer tetap memakai daftar wilayah internal atau input manual postal exception sesuai validasi.

## Admin UX/notifikasi
Ongkir tidak pasti membuat notifikasi ikon dedupe: alasan, order link, Review Ongkir. Admin edit ongkir/subsidi/total, wajib alasan, simpan nilai resmi, timeline/log, WhatsApp ulang. UI ini perlu implementasi/audit.

## Backend/API/database
Region parent-child; postal import source/version/updated-at; normalize provider + snapshot alamat; estimator idempotent/cacheable; failure → pending/manual review tanpa partial order. Edit audit before/after/actor/reason/time. API/schema notification baru update docs canonical.

## Permissions/acceptance/open
Customer alamat checkout; admin review/edit; worker authorized. Acceptance kode pos otomatis dari dataset internal, dataset integrity, titik lokasi opsional dapat dikonfirmasi tanpa mengubah postal code internal, ETA +1, breakdown, manual review, audited edit. Open dataset nasional/jadwal/rollback/read-only correction/J&T mapping/subsidi. Tidak mencakup address book.
