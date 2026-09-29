# Rencana Induk: Uji & Aktifasi Subscribe J&T (Push Status Paket) saat Cutover

Status: RENCANA, menunggu cutover produksi. Dibuat 2026-09-29 atas pertanyaan
owner "apakah subscribe lebih oke?" dengan keputusan sementara TIDAK aktif
sampai rencana ini dieksekusi. Saklar: `operations.shipping_pull.subscribe`
(config/operations.php) dan endpoint J&T `logistics/trace/subscribe`
(berlangganan push per resi). Kredensial produksi J&T ada di server 202.

## Latar

- Saat ini status paket didapat lewat PENARIKAN berkala (`shipping:pull-jnt`)
  yang memanggil `logistics/trace` satu resi per panggilan.
- Subscribe membalik arah: kita kirim satu permintaan per resi sekali, lalu
  J&T yang mengirim status berikutnya ke endpoint kita. Responsnya BELUM
  PERNAH dilihat hidup, sehingga bentuk payload push masih asumsi.
- Peluang lain yang dikenali 27-29 Sep: penggabungan `billCodes` sampai 30
  resi per panggilan trace, dan push `other/settlementReturn` (tagihan hasil
  audit J&T: waybillNo, totalFreight, packageChargeWeight, insuredFee,
  freight). Ongkir tersimpan sekarang berasal dari pelacakan, bukan audit.

## Prasyarat (semua wajib sebelum langkah 1)

1. Cutover produksi selesai dan kredensial J&T aktif di 202.
2. Endpoint uji dapat dijangkau J&T (domain publik + HTTPS).
3. Dukungan dari J&T: konfirmasi format payload `trace/subscribe` (contoh
   respons) dan `settlementReturn`. Tanpa contoh, langkah 3 memakai pendekatan
   tangkap-log-dulu.
4. Peta izin: `trace/subscribe` belum masuk daftar izin endpoint yang
   teruji, tambahkan dulu ke config izin + dokumentasi gateway.

## Langkah uji (urut, tiap langkah berhenti bila gagal)

### 1. Probe read-only dari 202 (tanpa mengubah sistem)

Skrip sekali pakai (tanda tangan: `digest = base64(md5(bizContent +
privateKey))`, form field `bizContent`, header `apiAccount`/`timestamp`/
`digest`, tujuan `/webopenplatformapi/api/logistics/trace`) memanggil:
- `trace` untuk 1 resi nyata (baseline sudah bekerja),
- `trace` untuk 5 resi sekaligus via `billCodes` dipisah koma, catat bentuk
  responsnya (bila beda bentuk dari satu resi, penarik batch perlu adapter),
- `trace/subscribe` untuk 1 resi uji, catat respons + verifikasi `pushUrl`
  diterima.
Kriteria lulus: respons 200 + payload terbaca. Simpan JSON mentahnya ke
dokumen temuan di log agent.

### 2. Sediakan endpoint penerima push (backend)

- Route `webhook/jnt-push` (CSRF-exempt sesuai kontrak `webhook/*` di
  `bootstrap/app.php`), controller baru terpisah dari PollJntTracking.
- Verifikasi tanda tangan payload push SEBELUM memproses (jangan percaya
  body mentah); kontrak verifikasi mengikuti contoh J&T dari langkah 1.
- Penanganan payload: peta status push ke status `shipping_records` yang
  sama dengan penarik (satu pemetaan status, dua pintu masuk). Idempoten
  per (waybill, status, timestamp): push ulang tidak membuat baris ganda.
- Menulis log push mentah ke `event_logs`/log khusus untuk audit selama uji.

### 3. Uji end-to-end push di 202

- Berlangganan 1-3 resi uji (pesanan uji RA-SIM dengan resi uji).
- Picu perubahan status nyata (atau tunggu gerakan kurir), buktikan:
  endpoint menerima push, status `shipping_records` berubah, EventLog
  kejadian `order_status_changed` tercatat, tidak ada duplikat.
- Uji kegagalan: kirim payload rusak/tanda tangan salah -> 4xx tanpa
  mengubah data; J&T tidak kirim push (telat) -> penarik berkala tetap
  mengisi (push TIDAK menggantikan penarik, hanya mempercepat).

### 4. Aktifasi terkendali

- Saklar `operations.shipping_pull.subscribe` dinyalakan HANYA setelah
  langkah 3 lulus.
- Strategi operasional disarankan: penarik berkala tetap jalan sebagai
  jaring pengaman dengan interval dilonggarkan (push yang dominan mengisi
  status); subscribe per resi dilakukan saat resi dibuat.
- Pemantauan: hitung push masuk vs penarikan harian; alert bila push
  diam > 24 jam pada resi aktif (push tidak dijamin J&T).

### 5. Evaluator (keputusan lanjutan setelah data)

Setelah 2 minggu berjalan, timbang: apakah push benar-benar lebih cepat
daripada penarikan 10 menit untuk kebutuhan admin, berapa penghematan
panggilan vs biaya kompleksitas (verifikasi tanda tangan, idempotensi,
pemantauan). Bila push tidak terbukti bernilai, matikan saklar dan kembali
ke penarikan murni; endpoint penerima dibiarkan sebagai kontrak mati yang
teruji.

## Batas & risiko yang sudah diketahui

- 209 tidak punya kredensial J&T; SEMUA langkah uji dari 202.
- Push butuh endpoint publik -> permukaan serangan baru; verifikasi tanda
  tangan wajib dan rate limit.
- Penarik batch 30 resi (langkah 1b) bisa dipakai TERLEPAS dari subscribe
  dan layak dieksekusi duluan bila angka panggilan masalah.
- `settlementReturn` (tagihan audit) terpisah dari alur status; kapan pun
  diaktifkan, nilainya harus direkonsiliasi dengan `shipping_cost` resi
  sebelum boleh menimpa angka laporan (kontrak ongkir di Performa Toko).

## Kriteria selesai

Semua langkah 1-3 lulus dengan bukti JSON tercatat, saklar menyala hanya
sampai tahap yang terbukti, dan keputusan lanjutan (langkah 5) tercatat di
AGENT-LOG.
