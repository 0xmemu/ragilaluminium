# Kebijakan Retur & SOP (DRAF untuk review)

Status: DRAFT - 2026-08-23, direvisi 2026-09-21 (skema retur full manual)
Sumber: workflow nyata (kode) + keputusan pemilik. Belum dieksekusi / belum jadi desain sistem.
Lokasi final: menunggu review. Ini dokumen kebijakan bisnis, bukan teknis.

---

## 1. Prinsip

1. Retur dimulai dari order `delivered` (Sampai). Status `completed` (Selesai) **tidak** bisa
   diretur di sistem. Sebelum barang sampai, paket ditangani lewat pembatalan kurir, bukan retur.
2. Retur selalu dicatat lewat form admin. Pelanggan mengirim kronologi/foto via WhatsApp; admin
   menginput ke sistem. (Tidak ada form retur publik.) Yang tersedia untuk pelanggan hanya tombol
   "Pengembalian Barang" di kartu status Sampai, dan tombol itu sekadar membuka chat WhatsApp.
   Keputusan 2026-09-21: skema retur **full manual**, jadi tidak ada form pengajuan dari pelanggan.
3. Alasan retur wajib dari daftar pilihan tetap.
4. Refund dana hanya dipertimbangkan bila pembeli benar-benar sudah membayar (lihat bagian D).
   Ini pertimbangan bisnis, bukan pagar sistem: sejak 2026-09-21 pesanan yang belum lunas tetap
   bisa dicatat returnya, dengan peringatan yang tampil ke admin.

## 2. Alasan retur (select wajib)

Nilai database | Label UI
---|---
`rusak` | Barang rusak
`pecah` | Kaca pecah / barang pecah
`salah_ukuran` | Salah ukuran
`salah_produk` | Salah produk
`kurang` | Barang kurang
`lainnya` | Lainnya

Aturan:
- Wajib pilih salah satu.
- Jika `lainnya`, wajib mengisi keterangan tambahan (field teks wajib muncul kondisional).

KEPUTUSAN PEMILIK (2026-08-23): `rusak` dan `pecah` dipisah menjadi dua opsi (sesuai spek).

## 3. Alur retur (SOP admin)

```
1. Pelanggan menekan tombol "Pengembalian Barang" di kartu status Sampai, yang membuka chat
   WhatsApp berisi nomor pesanan, atau menghubungi toko langsung. Admin berdiskusi dulu di
   WhatsApp; belum ada apa pun yang tercatat di sistem pada tahap ini.
2. Buka Detail Pesanan -> section "Retur & penyelesaian".
3. Isi alasan (wajib) + kronologi pelanggan (wajib) + catatan admin (opsional).
4. Tandai item & jumlah yang ingin diretur.
5. Klik "Catat retur":
   -> order menjadi "Retur Diproses" (return_in_process)
   -> notifikasi admin + WA follow-up ke pelanggan.
6. Barang diterima kembali; kondisi diperiksa oleh admin.
7. Admin melengkapi penyelesaian: jenis penyelesaian, catatan admin,
   nominal refund (bila layak), jumlah item yang benar-benar dikembalikan.
8. Klik "Selesaikan Retur":
   -> kasus retur "Selesai", order "Retur Selesai" (return_completed)
   -> WA notifikasi ke pelanggan.
```

## 4. Jenis penyelesaian (resolution_type)

Nilai | Makna | Refund dana?
---|---
`refund` | Pengembalian dana (bisa penuh) | Ya, bila layak (bagian D)
`replacement` | Ganti barang | Tidak (kirim barang pengganti)
`reship` | Kirim ulang barang yang sama | Tidak
`compensation` | Kompensasi (sebagian barang / goodwill) | Tergantung
`no_compensation` | Tanpa kompensasi | Tidak

KEPUTUSAN PEMILIK (2026-08-23):
- Pelanggan punya **dua opsi utama**: refund penuh ATAU ganti barang.
- **Ongkir retur ditanggung oleh toko.**
- `refund` bisa bernilai penuh (mengembalikan yang sudah dibayar).

## 5. Kelayakan refund dana

Aturan (keputusan pemilik, 2026-08-23):

> Refund dana hanya bila: kurir sudah menyerahkan paket ke pembeli, pembeli sudah membayar
> (tunai/QRIS ke kurir utk COD, atau transfer lunas utk transfer, atau gateway), DAN pengajuan
> retur masih dalam batas waktu retur.

### 5.1 Per metode

**Alur COD (state machine, keputusan pemilik):**

```
COD belum dibayar
  ├─ pelanggan menolak paket
  │    └─ cancelled / delivery_failed
  │
  └─ pelanggan menerima DAN membayar ke kurir
       └─ delivered + payment_status = paid
            ├─ tidak ada retur sampai batas waktu retur
            │    └─ completed
            └─ ada retur dalam batas waktu retur
                 └─ return_in_process → return_completed
```

- Transfer / gateway: layak refund bila `payment_status = paid` (lunas sebelum dikirim).
- COD: layak refund bila pembeli sudah membayar ke kurir = saat paket sampai (`delivered`).
  KEPUTUSAN PEMILIK (2026-08-23): pembayaran COD dicatat `paid` saat status pengiriman menjadi
  `delivered`, BUKAN saat `completed`. Tujuannya agar sistem tidak salah menolak refund COD yang
  sah (pembeli sudah membayar ke kurir saat barang diterima). Implikasi desain:
  - Saat `delivered`, COD dicatat lunas (`payment_status = paid`, `payments.status = completed`).
  - Refund COD menjadi layak sejak `delivered` (dalam batas waktu retur).
  - Jika pelanggan menolak paket sebelum bayar -> `cancelled` / `delivery_failed`, TIDAK ada
    pembayaran yang dicatat (tidak layak refund karena tidak ada dana diterima).
  - CATATAN: saat ini kode mencatat COD `paid` di `completeCodAtCompletion` (saat `completed`).
    Perubahan ke `delivered` akan dilakukan pada Sprint 2 (bukan sekarang, masih preflight).
- COD yang belum sampai / belum dibayar: TIDAK layak refund (tidak ada uang yang diterima pembeli).

## 6. Batas waktu retur (KEPUTUSAN PEMILIK, 2026-08-23, direvisi 2026-09-21)

- Batas retur: **48 jam** sejak status pengiriman menjadi `delivered` (Sampai).
- **Revisi 2026-09-21: batas 48 jam adalah imbauan, bukan penghalang.** Melewatinya tidak
  membuat retur ditolak. Nilainya muncul sebagai peringatan yang wajib terbaca admin di panel
  retur, dan sebagai `return_block.warnings` di halaman pelanggan. Alasannya: keputusan retur
  diambil admin setelah diskusi WhatsApp, dan memblokir sistem hanya memindahkan pekerjaan ke
  luar sistem sehingga tidak tercatat di laporan.
- Syarat yang sama berlaku untuk status lunas: pesanan yang belum dibayar tetap boleh diretur,
  dengan peringatan "Pembayaran pesanan ini belum tercatat lunas." Kasus nyatanya adalah paket
  COD yang ditolak kurir sehingga uang tidak pernah masuk.
- Retur dari status **`completed` TETAP TIDAK diizinkan**. Retur hanya dari `delivered`. Ini
  satu-satunya syarat yang mengikat di sistem.
- CATATAN VALIDASI vs KODE SAAT INI:
  - Kode sekarang mengizinkan retur dari `delivered` ATAU `completed`. Kebijakan baru = hanya `delivered`.
    Perlu perubahan di `createReturn` (Sprint 2).
  - Sistem belum punya mekanisme batas 48 jam. Perlu window retur (Sprint 2).
- Jika pelanggan memaksakan retur setelah Selesai / di luar 48 jam: **ditangani manual oleh admin
  lewat WhatsApp**, di luar scope website.

## 7. Dampak ke omzet & pembukuan

- Order retur yang selesai (return_completed) tetap dihitung omzet (masuk REVENUE_STATUSES).
- Omzet net dikurangi refund: `netRevenue = revenue - refund_amount`.
- Untuk konsistensi: refund yang LAYAK harus juga mengubah pencatatan pembayaran (payment status
  menjadi `refunded`), bukan hanya mengurangi omzet. Kalau tidak, Performa Toko dan modul
  Pembayaran bertentangan.

## 8. Item yang diretur

- Nilai retur (KPI) dihitung dari `returned_quantity > 0` pada item yang benar-benar dikembalikan.
- Jumlah retur per item tidak boleh melebihi qty di pesanan (sudah di-enforce di kode).
- `resolution_type = refund` tidak otomatis berarti seluruh nominal dibalik; `refund_amount`
  adalah nominal aktual yang disepakati admin.

---

## Lampiran: pertanyaan yang sudah dijawab (2026-08-23)

- [x] Batas waktu retur: **48 jam** sejak `delivered`.
- [x] Retur dari status `completed`: **TIDAK diizinkan** (hanya dari `delivered`; lewat batas
      manual via WhatsApp, di luar scope website).
- [x] Kapan dana COD dianggap lunas utk kelayakan refund: saat `delivered` (pembeli bayar kurir).
- [x] Ongkir retur: ditanggung toko.
- [x] Opsi pelanggan: refund penuh ATAU ganti barang.

## Pertanyaan yang MASIH terbuka (untuk desain teknis Sprint 2)

- [x] Validasi refund maksimum: **refund_amount <= total yang dibayarkan di detail pesanan**
      (`order.total_amount` saat `payment_status=paid`). Mencegah refund melebihi total tagihan.
- [x] Ongkir retur ditanggung toko, **dikembalikan ke harga produk** (boleh minus dari total).
- [x] Ganti barang (replacement): dicatat sebagai retur. Detail rancangan di bawah.
- [ ] (tersisa) Penegakan jadwal & penyelarasan replacement dengan omzet/laporan di modul.

## Detail rancangan: Ganti Barang (replacement) dicatat sebagai retur

Prinsip: `replacement` diperlakukan sebagai **retur dengan resolusi ganti barang**, bukan order
baru. Tujuannya agar riwayat & pembukuan tetap satu jejak pesanan asal.

Alur (SOP admin):
1. Retur dicatat dari `delivered` dalam 48 jam (alasan wajib, item + qty yang diretur).
2. Order jadi `return_in_process`.
3. Admin pilih `resolution_type = replacement`.
4. Barang pengganti dikirim ke pelanggan (ongkir retur ditanggung toko).
5. Selesaikan retur -> order `return_completed`.

Implikasi pembukuan/omzet:
- Order tetap dihitung omzet (return_completed tetap masuk REVENUE_STATUSES), dan dikurangi
  `refund_amount` bila ada. Untuk replacement, `refund_amount` umumnya 0 (tidak ada uang kembali),
  karena penggantian barang, bukan dana.
- `replacement_amount` mencatat nilai barang pengganti (bisa menjelaskan biaya penggantian).
- Nilai retur (KPI) dihitung dari returned_quantity > 0 seperti retur biasa.

Pertanyaan teknis tersisa utk replacement (perlu diputuskan saat desain):
- Apakah perlu pencatatan barang pengganti (item baru) tersendiri di sistem, atau cukup catatan
  teks + nominal replacement_amount? (Rekomendasi awal: cukup replacement_amount + catatan admin,
  tanpa membuat order pengganti agar tidak menduplikasi omzet.)

KEPUTUSAN PEMILIK (2026-08-23): **barang pengganti dicatat sebagai item tersendiri.**
- Saat admin buka form retur-replacement, item pengganti **terisi otomatis = item yang dibeli
  pelanggan lengkap dengan variasinya** (produk + varian + qty), **terkunci secara default**
  untuk menghindari human error.
- **Editable oleh admin bila perlu** (mis. ganti varian, ukuran, atau produk lain sebagai kompensasi).
- Saat selesaikan retur, pengiriman barang pengganti dapat mengurangi stok varian pengganti.
- Barang pengganti bagian dari kasus retur (bukan order baru) -> tidak menduplikasi omzet.

## Batasan ongkir retur (KEPUTUSAN PEMILIK, 2026-08-23)

Ongkir retur **ditanggung toko hanya bila retur sepenuhnya karena kesalahan toko**, contoh:
- barang cacat/rusak,
- kaca pecah,
- kesalahan pengiriman (salah produk, salah ukuran, salah alamat, dll).

Di luar itu (mis. pembeli berubah pikiran, salah order dari sisi pembeli, dll):
- **TIDAK perlu dibangun logika ongkir di sistem**
- ditindaklanjuti **manual via WhatsApp** antara admin dan pelanggan.

Kesimpulan scope: sistem hanya perlu mendukung **dua skenario**:
1. Retur karena kesalahan toko -> ongkir retur ditanggung toko (tercermin dari resolution_type
   dan/atau flag di retur).
2. Retur bukan karena kesalahan toko -> sistem tidak menghitung ongkir; admin bebas negosiasi di WA.

## Keputusan kebijakan yang dikunci (rekap 2026-08-23)

Item pengganti (replacement):
- Default: otomatis terisi dari item yang dibeli (produk + varian + qty).
- Field terkunci secara default (hindari human error).
- Editable oleh admin bila perlu (ganti varian, ukuran, atau produk lain sebagai kompensasi).

Ongkir retur:
- Ditanggung toko bila retur sepenuhnya kesalahan toko.
- Di luar itu: manual via WA, tidak dibangun di sistem.

Refund:
- Maksimum = total yang dibayarkan di detail pesanan (`order.total_amount` saat `paid`).
- Refund penuh ATAU ganti barang.
- COD `paid` saat `delivered`.

Batas retur:
- 48 jam sejak `delivered`; retur dari `completed` tidak diizinkan.

---

## Implikasi desain teknis Sprint 2 (asumsi rancangan)

Field pada kasus retur:
- `return_type`: `refund` | `replacement`.
- `resolution_reason` (atau `fault_party`): `store` | `customer` | `other` (opsional, utk laporan).
- `replacement_items`: array item pengganti (auto-filled dari item dibeli + varian + qty, editable).
- `refund_amount`: validasi `0 <= refund_amount <= order.total_amount`.
- `shipping_cost_borne_by_store`: boolean (true bila kesalahan toko).

Validasi & logika:
- Bila `fault_party = store` -> `shipping_cost_borne_by_store = true`.
- Bila `fault_party != store` -> `shipping_cost_borne_by_store = false`; admin menangani ongkir
  di luar sistem (WA).
- Untuk replacement: kurangi stok item pengganti saat "Selesaikan Retur"; tidak ada order baru,
  tidak ada duplikasi omzet.

UI admin:
- Saat admin pilih alasan retur (rusak, pecah, salah_produk, salah_ukuran, kurang, lainnya):
  sistem bisa **otomatis menandai `fault_party = store`** untuk alasan yang jelas kesalahan toko
  (rusak, pecah, salah_produk, salah_ukuran, kurang).
- Admin tetap bisa **override** bila perlu (mis. "lainnya" tapi ternyata kesalahan pembeli).

## Status
DRAF ini belum dieksekusi. Selanjutnya: selesaikan pertanyaan terbuka -> finalisasi SOP ->
baru susun desain teknis retur/refund yang konsisten.