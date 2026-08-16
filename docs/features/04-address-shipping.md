# Feature 04 — Alamat, Kode Pos, dan Ongkir

**Status implementasi:** region/ongkir dasar ada; mapping kode pos belum lengkap dan prioritas. **Aktor:** customer, provider/system, admin.

## Customer flow
1. Provinsi → kabupaten/kota → kecamatan → desa.
2. Sistem mengisi kode pos otomatis hanya setelah mapping internal lolos quality gate; field kode pos readonly bagi customer.
3. Tampilkan kode pos/detail alamat (patokan/RT/RW).
4. Jika mapping kode pos kosong atau belum terverifikasi, kode pos tetap kosong dan customer diminta mengonfirmasi ulang alamat lengkap atau mencoba pencarian wilayah lagi; titik lokasi/peta hanya fallback opsional untuk membantu menemukan dan mengonfirmasi alamat, bukan sumber kode pos.
5. Hitung ongkir destination/berat/dimensi/service.
6. Tampilkan normal, subsidi, net, dan ETA hasil display yang sudah termasuk buffer +1 hari sekali.
CSV storage/app/wilayah/*.csv belum lengkap kode pos. Target dataset up-to-date, parent-child konsisten, source/version, update terverifikasi.

## UI/UX states
Dependent child disabled; kode pos tampil tepat di bawah desa dan readonly; auto-fill hanya dari mapping internal aktif yang lolos quality gate; mapping kosong/tidak terverifikasi menampilkan state kosong + konfirmasi ulang alamat/pencarian wilayah, tanpa input kode pos customer; fallback titik/peta opsional hanya konteks alamat; ongkir loading/success/pending review/provider unavailable/invalid tanpa angka palsu. COD reason saat dipilih dan Transfer ditawarkan.

## Optional location pin fallback
- Fallback hanya untuk membantu customer menemukan dan mengonfirmasi titik alamat ketika lookup internal tidak menemukan alamat.
- Kode pos hanya diisi dari dataset internal yang aktif dan lolos quality gate; customer tidak mengedit field tersebut.
- Titik/koordinat hanya konteks alamat dan tidak menjadi sumber atau pengganti kode pos; penyimpanan koordinat bukan kontrak order yang ditetapkan di fitur ini.
- Jika fallback tidak tersedia atau gagal, kode pos tetap kosong dan customer mengulang konfirmasi alamat/wilayah; manual review hanya digunakan bila quote/provider ongkir bermasalah.

## Admin UX/notifikasi
Ongkir tidak pasti membuat notifikasi ikon dedupe: alasan, order link, Review Ongkir. Admin edit ongkir/subsidi/total, wajib alasan, simpan nilai resmi, timeline/log, WhatsApp ulang. UI ini perlu implementasi/audit.

## Backend/API/database
Region parent-child; postal import source/version/updated-at dengan baseline Satu Data Indonesia/data.go.id dan cross-check Pos Indonesia; activation hanya setelah quality gate; normalize provider + snapshot alamat; estimator idempotent/cacheable; failure → pending/manual review tanpa partial order. Edit audit before/after/actor/reason/time. API/schema notification baru update docs canonical.

## Permissions/acceptance/open
Customer alamat checkout; admin review/edit; worker authorized. Acceptance auto-fill kode pos hanya dari dataset internal tervalidasi, field readonly, mapping kosong/tidak terverifikasi menghasilkan blank + reconfirm address/retry state, titik lokasi opsional tidak menjadi postal source, ETA +1, breakdown, manual review hanya untuk quote/provider failure, audited edit. Open dataset nasional/jadwal/rollback/read-only correction/J&T mapping/subsidi. Tidak mencakup address book.
