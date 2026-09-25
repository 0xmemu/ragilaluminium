# Domain: Pengiriman, Ongkir, Berat, Asuransi

Semua fakta di bawah **terverifikasi terhadap endpoint produksi J&T Cargo**,
bukan dibaca dari dokumentasi saja. Sumber lengkap: skill
`docs/SKILL/ragil-shipping-chargeable-weight/`.

---

## 1. Kontrak owner (mengikat)

### J&T satu-satunya sumber angka ongkir dan asuransi

**DILARANG** membuat perhitungan paralel untuk apa pun yang sudah J&T berikan.
Kalau J&T hanya memberi total, turunkan ongkir = total dikurangi asuransi
(memakai angka J&T sendiri), **jangan** pakai rumus tarif lokal.
Commit `b68ccbc`.

Bukti: 21 pengukuran pada 3 rute, `offerFee` dari Rp 200 sampai Rp 100 juta,
`estimateCustomerCost` **tidak pernah** berubah atau hilang.

### Kurir yang benar

**J&T CARGO**, endpoint `openapi.jtcargo.co.id` (produksi) dan
`demoopenapi.jtcargo.co.id` (demo).

**Bukan** J&T Express. J&T Express pembagi volumetriknya 6000 dan membulatkan
berat per 1,3 kg. **Jangan dipakai.**

### Aturan resmi J&T Cargo (terverifikasi 12 Sep 2026)

| Aturan | Nilai |
|---|---|
| Berat volumetrik | P x L x T dibagi **5000** |
| Berat minimal | **10 kg** (di bawah itu tetap dihitung 10 kg) |
| Berat maksimal | 500 kg |
| Kelas layanan | H50 (di bawah 50 kg), H100 (50-100), H300 (100-300), H500 (300 ke atas) |

Berat minimal **diterapkan J&T sendiri**, sistem tidak menambah aturan minimum.
Terbukti: 0,5 kg sampai 10 kg tarifnya identik Rp 80.000 (rute Banjarnegara ke Kota Bogor).

Catatan penting: dokumen API tidak memuat aturan volumetrik. Sumber otoritatifnya
FAQ publik dan kanal resmi kurir. Cek itu dulu sebelum menyebut sebuah aturan
"tidak terdokumentasi".

---

## 2. Rumus resmi (kanonik)

Keputusan owner 2026-09-25 (**Metode A: Pendekatan Multi-Koli J&T Cargo**):
1. **Tanpa tambahan packing kayu:** Allowance kemasan kayu/pallet per sisi resmi diubah menjadi **0,0 cm** (dihapus). Perhitungan ongkir menggunakan dimensi dan berat paket aktual produk.
2. **Penjumlahan volume paket:** Untuk setiap pesanan, volume masing-masing paket produk dihitung lalu dijumlahkan.

```text
volume paket per unit = panjang x tebal x tinggi
total volume pesanan = jumlah(volume unit x kuantitas)
total berat aktual = jumlah(berat unit x kuantitas)
berat volumetrik = total volume pesanan / 5000
berat tagih = max(total berat aktual, berat volumetrik)
```

**Tidak ada penambahan ukuran packing kayu.** Boven atau produk kecil tidak lagi membuat volume pesanan membengkak secara artifisial, dan pembeli ditagih berdasarkan tarif yang lebih adil sesuai standar ekspedisi J&T Cargo.

### Contoh perbandingan terverifikasi

| Kasus | Ukuran & Berat Aktual | Rumus Lama (Packing Kayu +6cm) | Keputusan Baru (Metode A, Murni Aktual) |
|---|---|---|---|
| 1 unit Jendela Kecil | 120x60x7,5 cm / 15,9 kg | 126x66x13,5 cm, vol 22,453 kg (volumetrik menang) | 120x60x7,5 cm, vol 10,800 kg $\rightarrow$ **berat aktual 15,9 kg menang** (hemat tarif 7 kg!) |
| 2 unit Jendela Kecil | 120x60x7,5 cm / 31,8 kg total | paket ber-allowance: vol 38,934 kg | vol 120x60x15 = 108.000 cm³ $\rightarrow$ vol 21,6 kg $\rightarrow$ **berat aktual 31,8 kg menang** |
| 1 Pintu + 1 Boven | Pintu 200x90x10 (25kg) + Boven 50x60x7,5 (5kg) | Bounding box membengkak: vol 100+ kg | Vol pintu (180.000) + Vol boven (22.500) = 202.500 cm³ $\rightarrow$ **vol 40,5 kg** (hemat drastis) |
### Contoh terverifikasi

| Kasus | Ukuran | Hasil |
|---|---|---|
| Kecil | 120x60x7,5 cm / 15,9 kg | paket 66x13,5x126 (pallet 3cm), berat tagih 22,453 kg (volumetrik menang), Rp 69.000 (23 kg x 3.000) |
| Besar (produk katalog terbesar) | 180x160x7,5 cm / 63,4 kg | paket 166x13,5x186, volumetrik 83,365 kg, Rp 239.400 (tier diskon volume) |

### Tarif live (terverifikasi 11 Sep 2026)

Rute Banjarnegara/Mandiraja ke Kota Semarang:

| Berat | Tarif |
|---|---|
| sampai 10 kg | flat Rp 60.000 (minimum charge J&T sendiri, **bukan** bug sistem) |
| 11 sampai 50 kg | Rp 3.000/kg linear (12 jadi 36k, 20 jadi 60k, 50 jadi 150k) |
| di atas 50 kg | diskon volume sekitar Rp 2.850/kg (83 kg jadi 239,4k) |

Lompatan non-monoton (10 kg Rp 60.000 vs 12 kg Rp 36.000) itu **batas minimum
charge J&T**. Karakterisasi dengan probe antara sebelum menyimpulkan, jangan
ditambal di kode.

---

## 3. Pallet / packing kayu allowance: default 0.0 (dihapus)

Sumber tunggal: `ShippingPalletSettings::allowancePerSideCm()`, membaca
`config/shipping.php`:

```
pallet_allowance_per_side_cm   (env SHIPPING_PALLET_ALLOWANCE_CM, default 0.0)
```

Sesuai keputusan owner 2026-09-25, default allowance diubah dari 3.0 menjadi **0.0** (tanpa tambahan ukuran packing kayu). Nilai lama tetap didukung sebagai fallback kompatibilitas bila env `SHIPPING_PALLET_ALLOWANCE_CM` diset eksplisit > 0.

`OrderService` meneruskannya ke `ShipmentPackageCalculator` di dua tempat:
`cartPackage()` dan `packageForResolvedLines()`.

### Ada halaman admin, lalu DIHAPUS

Halaman `/admin/shipping-pallet` (controller + route + entri sitemap + halaman React,
lewat ledger `OperationalSettings`) dibangun lalu dihapus atas instruksi owner:
nilainya stabil dan diset sekali selamanya, jadi permukaan maintenance tidak
sepadan (commit `22194da`).

**JANGAN usulkan halaman admin untuk setelan ini lagi.**
**JANGAN sambungkan ulang lewat `OperationalSettings`.**

### Field pallet per produk DIHAPUS dari runtime

Commit `ef02c84` (12 Sep 2026) menghapus `pallet_allowance_per_side_cm` dan
`pallet_weight_kg` dari: ProductForm, fillable/casts Product, validasi
ProductController, logika item ShipmentPackageCalculator, dan array item OrderService.

Kolom DB dipertahankan sebagai legacy tapi **tidak pernah dibaca**.
Parameter `$palletWeightKg` dihapus dari constructor (commit `22194da`).

**JANGAN tambahkan field pallet per produk lagi.**
**JANGAN sarankan mengisi `pallet_weight_kg` per produk**, dan jangan anggap
field kosong itu sebagai data gap.

### Dua jebakan saat penghapusan (keduanya bisa merusak ongkir diam-diam)

1. **Menghapus key ledger tanpa memperbarui konsumennya.** `ShippingPalletSettings`
   masih memanggil `OperationalSettings::current('shipping_pallet')` setelah key
   dihapus dari `normalize()`, sehingga melempar `InvalidArgumentException` di
   SETIAP quote. Sebelum menghapus key ledger, grep semua konsumen kelas pembungkusnya.
2. **Parameter constructor dorman yang jadi hidup.** `$palletWeightKg` tampak mati
   (dikirim 0, tidak pernah dibaca) karena field per produk selalu menyuplai berat.
   Begitu field itu dihapus, dia jadi satu-satunya sumber dan diam-diam menambah
   berat (test menangkap 17,6 jadi 20,6 kg).

---

## 4. Asuransi pengiriman

### Fitur ini dulu MATI, bukan sekadar jarang dipakai

Kode, kolom DB, dan tarif J&T semuanya ada, tapi **tidak ada pembeli yang bisa
menyalakannya**. Tiga bug terpisah (commit `8e64632`, 12 Sep 2026):

**1. Self-gating deadlock (yang paling penting).**
`offerFee` dikirim ke J&T **hanya bila pembeli sudah mencentang** asuransi,
padahal checkbox muncul **hanya bila biaya asuransi sudah diketahui**.
Rantainya menunjuk balik ke dirinya sendiri, jadi opsi itu tidak pernah muncul.

Perbaikan: kirim `offerFee` **setiap kali nilai barang diketahui**. Yang menentukan
apakah biaya **ditagih** adalah pilihan pembeli, bukan apakah `offerFee` dikirim.

> **Aturan umum:** kalau kontrol UI dikunci oleh data yang baru ada setelah kontrol
> itu dipakai, fiturnya tidak terjangkau. Buktikan keterjangkauan dengan memanggil
> service seperti halaman memanggilnya saat **pertama dimuat**, bukan setelah interaksi.

Penyebab kedua, pintu yang sama: props checkout awal tidak memuat
`insurance`/`insurance_available` sama sekali, jadi opsi tetap tersembunyi
sebelum alamat dikirim ulang. Prop yang hanya ditambahkan di satu jalur kode
**bukan** berarti "tersedia".

**2. Nilai diasuransikan salah.** `offerFee` bernilai konstanta 200, jadi pembeli
membayar floor Rp 5.000 untuk perlindungan Rp 200. Sekarang `offerFee` = subtotal
keranjang, di-resolve di `ShippingService::resolveInsuredValue()`.

**3. Kehilangan data diam-diam.** `shipping_insurance_amount` tidak ada di
`Order::$fillable`, jadi nilainya dibuang saat mass assignment (dikirim 50.000,
tersimpan 0). Setiap menambah field uang baru ke order, tambahkan ke `$fillable`
**dan** buktikan round-trip ke DB di tugas yang sama.

### `offerFee` = nilai barang, bukan biaya

`offerFee` adalah **nilai yang diasuransikan** (保价金额, IDR), bukan flag dan
bukan biaya tetap. Tarifnya **0,2% dengan floor Rp 5.000**:

| Nilai barang | Biaya asuransi |
|---|---|
| 1.000.000 | 5.000 (kena floor) |
| 5.000.000 | 10.000 |
| 10.283.000 | 20.566 |

### Semantik field respons tarif (terverifikasi live 12 Sep 2026)

Jangan mengasumsikan endpoint quote sudah memasukkan add-on ke angka utamanya.
Diukur di produksi (`agingCost/get`, 30 kg Banjarnegara ke Kota Bogor, satu variabel diubah):

| Field | Arti |
|---|---|
| `estimateCustomerCost` | ongkir standar SAJA, asuransi **TIDAK** termasuk |
| `estimateInsuranceCost` | biaya asuransi, komponen TERPISAH |
| `estimateSumFreight` | total = `estimateCustomerCost` + `estimateInsuranceCost` |

**Jebakan:** `estimateSumFreight` **sudah memuat asuransi**. Kalau dipakai mentah
sebagai ongkir lalu ditambah asuransi lagi, **asuransi tertagih dua kali**.

### Pemisahan ongkir dan asuransi

Dulu `net` (ongkir net + asuransi) disimpan apa adanya sebagai `shipping_amount`,
sehingga kolom "Ongkir" diam-diam membawa asuransi sementara
`shipping_insurance_amount` tetap 0.

Sekarang:
- `net_ongkir` = ongkir net TANPA asuransi
- `shipping_amount` = ongkir saja
- total = `subtotal + ongkir + asuransi - voucher + biaya COD`
- `shipping_raw` (yang dipotong J&T) **juga** menambah asuransi, karena J&T memotongnya

**Konsekuensi:** asuransi **saling meniadakan di laba bersih** (ditambah ke total,
dikurangi lagi sebagai potongan J&T). Perbaikan yang menyentuh hanya satu sisi
membuat laba bersih salah.

### Jebakan yang menyembunyikan ini

`shipping_amount` sudah memuat asuransi, jadi laporan yang dibangun di atas
`shipping_amount` **benar secara aritmetika** sementara label "Ongkir"-nya bohong.

Sesi sebelumnya menguji order buatan tangan (shipping_amount tanpa asuransi +
total_amount dengan asuransi), bentuk yang **tidak pernah** dihasilkan
`createFromCart`, lalu salah menyimpulkan laporan membuang Rp 50.000.

> **Bangun order uji lewat jalur produksi** (`OrderService::createFromCart`)
> sebelum mengklaim bug uang. Baris buatan tidak membuktikan apa pun.

### Ongkir asli sudah otomatis dari endpoint pelacakan (commit `6b85cd0`)

`logistics/trace` (dipakai tombol Refresh J&T dan webhook) mengembalikan per nomor resi:
`totalFreight` (total tagihan, **sudah termasuk asuransi**), `freight` (ongkir saja),
`insuredFee` (asuransi), `weight` (berat tagih versi J&T, angka final).

`ShippingService::syncActualCost` menyimpannya ke `shipping_records`
(migrasi `2026_09_12_000003`). Input manual **DIHAPUS** atas permintaan owner
("murni saja otomatis").

Terbukti pada resi nyata `201718781511`: 57.500 = 52.500 + 5.000, stabil 3 kali
panggilan, ada di 13 dari 13 scan.

Sistem dulu **menerima data ini tiap hari lalu membuangnya**
(`shipping_tracking_events` tidak punya kolom biaya). Akibatnya ORD26080001
diasumsikan 70.000 padahal J&T menagih 57.500, laba bersih kurang 12.500.

---

## 5. Master alamat J&T

Hierarki J&T **berbeda** dari dataset wilayah internal:

- Kota/kabupaten sering disingkat: `Kab Karanganyar` (bukan `KABUPATEN KARANGANYAR`)
- Kecamatan bisa beda spasi: `Kebak Kramat` (J&T) vs `KEBAKKRAMAT` (input form)
- Kecamatan bisa diklasifikasi sebagai `townName`, bukan `areaName`

Contoh nyata: `Temas, Kota Batu` dipetakan J&T jadi `cityName=Kota Batu`,
`areaName=Batu`, `townName=Temas`.

Aturan payload ke `agingCost/get`:

1. API mengharapkan `areaName` untuk `receiveArea`. Kalau pelanggan memilih
   kecamatan yang dipetakan ke `townName`, resolve dan kirim `areaName` induknya.
2. Selalu normalisasi prefiks kota/kabupaten (`KABUPATEN`, `KAB.`, `KOTA`, `ADM.`)
   dan buang spasi untuk pencocokan kunci.
3. Kalau pemetaan gagal, API mengembalikan `145003066: Address matching failed`.
   Sistem harus mundur dengan anggun ke estimasi lokal dengan `manual_review`,
   **bukan** membuat checkout rusak, dan catat lokasi yang tidak terpetakan.

Dataset alamat internal tetap dipakai untuk struktur wilayah/kode pos.
Payload J&T wajib memakai mapping master J&T terverifikasi.

---

## 6. Peta izin endpoint (diuji 12 Sep 2026)

**JANGAN berasumsi endpoint bisa dipanggil.** Peta nyata akun Ragil:

| Status | Endpoint |
|---|---|
| BOLEH | `logistics/trace` (pelacakan), `address/query`, `agingCost/get` (tarif) |
| DIBLOKIR | `orderserve/query` (getOrders), `spmComCost/getComCost` (tarif dimensi) |

Blokir berbunyi `145003012 API account has no interface permissions`.
Tidak masalah: `trace` sudah membawa tagihan asli.

Ada juga push `other/settlementReturn` (J&T mengirim balik tagihan hasil audit:
waybillNo, totalFreight, packageChargeWeight, insuredFee, freight, customerCode).
Belum dipakai.

---

## 7. Subsidi ongkir

Subsidi ongkir = **PENGATURAN TOKO** (`ShippingSubsidySettings`, `cms_pages` slug
`checkout` / `OperationalSettings`), tipe `percent` atau `fixed`, diterapkan pada
**quote J&T**.

**Bukan** biaya J&T. Nilainya pernah 50% (pesanan Agustus: quote 70.000 jadi
subsidi 35.000) lalu 10% (September: 70.000 jadi 7.000).

Jadi asumsi pembukuan (ongkir pembeli + subsidi + asuransi) tidak dikarang:
gross-nya adalah quote J&T saat checkout, subsidinya diskon toko.

---

## 8. Jebakan skema DB (terverifikasi dari kode VPS)

`products` **TIDAK PUNYA** kolom `length_cm`. Query `length_cm` melempar
`SQLSTATE 42S22`.

Kolom yang benar-benar ada: `weight_kg`, `width_cm`, `height_cm`, `depth_cm`,
`pallet_weight_kg` (legacy, tidak dibaca).

### Konvensi Ragil: nama kolom DB berbeda dari maknanya

| Kolom DB | Arti sebenarnya |
|---|---|
| `width_cm` | **Panjang** (length) |
| `depth_cm` | **Lebar** / tebal |
| `height_cm` | Tinggi |

### Pemetaan ke item array (dari `OrderService`)

`ShipmentPackageCalculator` menerima array item dengan kunci `length_cm`,
`width_cm`, `height_cm`. Kunci itu **bukan** nama kolom DB. Pemetaannya
(di `OrderService.php` baris 437-438 dan 820-821):

```php
'length_cm' => (float) ($product->width_cm ?? $variant?->width_cm ?? 0),  // DB width_cm  = Panjang
'width_cm'  => (float) ($product->depth_cm ?? $variant?->depth_cm ?? 0),  // DB depth_cm  = Lebar
'height_cm' => ...                                                        // DB height_cm = Tinggi
```

**Jadi ada dua lapis penamaan yang berbeda.** Kalau menambah field dimensi baru,
perhatikan lapis mana yang sedang disentuh:

| Lapis | Kunci | Sumber |
|---|---|---|
| DB | `width_cm` (Panjang), `depth_cm` (Lebar), `height_cm` (Tinggi) | tabel `products` |
| Item array calculator | `length_cm`, `width_cm`, `height_cm` | hasil pemetaan `OrderService` |

Juga: ada fallback ke `$variant?->width_cm` dan seterusnya, jadi dimensi bisa
berasal dari produk **atau** varian. Nilai 0 dipakai bila keduanya kosong,
yang seharusnya memicu `manual_review`, bukan dimensi karangan.

### `pallet_weight_kg`

Grep seluruh `app/` tidak menemukan pemakaian apa pun. Kolom ini **legacy murni**,
dipertahankan di DB tapi tidak pernah dibaca. Jangan diisi, jangan dianggap
data gap.

---

## 9. Gerbang verifikasi

- Test unit mencakup contoh 40x100, allowance global seragam, susunan multi-kuantitas,
  dimensi tidak valid, dan batas volumetrik 16 kg.
- Test guard eksplisit memastikan field pallet per produk, kalau masih dikirim,
  **DIABAIKAN** (`ShipmentPackageCalculatorGlobalAllowanceTest`).
- Pastikan checkout dan pembuatan order memanggil calculator yang **sama** dan
  menyimpan snapshot yang **sama**.
- Bandingkan probe provider **hanya bila** keranjang, hierarki alamat, kode pos,
  layanan, pembayaran, dimensi, berat, jumlah paket, dan endpoint **identik**.
- Jalankan cek sintaks PHP, PHPUnit tertarget, typecheck frontend, build, dan
  `git diff --check`.

### Metode menjawab pertanyaan kelas ini

Panggil endpoint yang **sama** dua kali untuk lane dan berat yang **sama**,
ubah **tepat satu** input, lalu bandingkan field.

Satu panggilan, satu nama field, atau probe yang mengubah dua hal **tidak membuktikan apa pun**.

### Cara membuktikan tidak ada pembengkakan ongkir

Panggil endpoint tarif beberapa kali pada rute dan berat sama, ubah HANYA `offerFee`
(0, 200, 1 juta, 2,5 juta, 5 juta, 11 juta, 100 juta), lalu pastikan:

1. `estimateCustomerCost` **konstan** dan selalu ada
2. `estimateSumFreight` == `estimateCustomerCost` + `estimateInsuranceCost`

Kalau ongkir ikut naik karena nilai barang tinggi, deklarasi nilai otomatis berbahaya.

---

## 10. Keputusan owner: kenapa tidak menimbang paket

Owner **MENOLAK** usul "timbang paket dulu sebelum ongkir keluar":
*"kalau berat yang benar-benar ditimbang itu tidak logis... nalar dong"*.

Preseden resmi (Shopee): harga keluar seketika dari data katalog yang diisi penjual,
berat yang diisi **wajib sudah termasuk kemasan**, ditimbang **sekali** setelah
dikemas saat mengisi produk (bukan per pesanan), kurir verifikasi saat serah terima
lalu pilih yang lebih besar, selisih ditanggung penjual.

Owner memilih: **biarkan** (serap selisih).

**Jangan usulkan timbang sebagai langkah checkout lagi.**

---

## 11. Yang masih terbuka

| Temuan | Status |
|---|---|
| `localEstimate()` 15000 + 2000/kg dipakai saat J&T mati | Terkarantina di UI (label "Estimasi ongkir sementara"), **tapi terbukti jadi `shipping_amount`** pesanan. Terbukti uji HTTP checkout dengan `jnt.enabled=false`: tersimpan 17.000. Ini satu-satunya tempat hitungan sendiri jadi harga ditagih. Jangan ubah sepihak karena memengaruhi apakah pesanan bisa dibuat saat J&T down |
| Label "Estimasi ongkir sementara" mati | Dijaga `effectiveShipping?.provisional`, padahal backend tidak pernah mengirim `provisional` (yang dikirim `state` ready/fallback/manual_review + `is_final`). Akibat: saat J&T gagal dan jatuh ke rumus lokal, ongkir fallback tampil seolah tarif final. Akar struktural: 3 definisi tipe terpisah untuk satu payload. Detail: `docs/SKILL/checkout-ui-reconciliation/references/payload-field-drift-dead-branch.md` |
