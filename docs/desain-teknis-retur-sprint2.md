# Desain Teknis Retur Sprint 2 — Revisi Berdasarkan Kode Existing

**Ragil Aluminium**
Status: Siap menjadi blueprint implementasi setelah review kode/lampiran validasi
Tanggal: 2026-08-24
Dasar: kebijakan retur final + hasil validasi terhadap struktur kode existing

---

## 1. Keputusan Arsitektur

Desain Sprint 2 **tidak membuat model paralel** untuk data yang sudah ada. Implementasi harus memperluas alur dan tabel existing:

- Status proses retur menggunakan `order_status` existing: `return_in_process` dan `return_completed`.
- Data kasus retur memakai `order_return_cases` existing.
- Data item retur memakai `order_return_items` existing.
- Waktu paket sampai diturunkan dari `shipping_records.last_status_at` saat status pengiriman adalah `delivered`.
- Tidak menambah `return_status`, `delivered_at`, `cod_paid_at`, atau `return_deadline_at` ke `orders`.
- Tidak menambah `refunded` atau `partially_refunded` sebagai arti baru untuk `payment_status`.

`order_return_cases.refund_amount` menjadi sumber data refund. Rekonsiliasi nilai dan laporan memakai `PaymentService::reconcile` existing, tanpa mengubah makna `payment_status` yang saat ini terbatas pada `pending | paid`.

---

## 2. Kebijakan Final

| Aturan | Implementasi |
|---|---|
| Waktu retur | Hanya dalam 48 jam sejak pengiriman berstatus `delivered` |
| Status yang boleh diretur | `delivered` saja |
| `completed` | Tidak dapat membuat retur; komplain berikutnya ditangani manual via WhatsApp |
| COD lunas | Ketika status pengiriman berubah menjadi `delivered` |
| Refund | Maksimal `order.total_amount` pada order yang sudah `paid` |
| Pilihan penyelesaian utama | `refund` atau `replacement` |
| Item pengganti | Auto-fill dari item yang diretur; terkunci default, dapat diedit admin |
| Stok pengganti | Dikurangi hanya saat retur replacement diselesaikan |
| Omzet replacement | Tidak membuat order baru dan tidak menduplikasi omzet |
| Ongkir retur | Ditanggung toko bila sepenuhnya kesalahan toko; kasus lain ditangani manual via WhatsApp |

---

## 3. Skema Data

### 3.1 `orders`

Tidak ada kolom status-retur atau timestamp retur baru. Gunakan:

```ts
type PaymentStatus = 'pending' | 'paid';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'return_in_process'
  | 'return_completed';
```

Aturan:

- `payment_status = 'paid'` berarti pembayaran order telah tercatat.
- Untuk transfer/gateway, pembayaran biasanya sudah menjadi `paid` sebelum pengiriman.
- Untuk COD, pembayaran harus diubah menjadi `paid` saat bukti shipping menjadi `delivered`.
- Pengembalian dana tidak mengubah `payment_status`; nilai refund tetap berada pada kasus retur.

### 3.2 `shipping_records`

Gunakan data existing untuk menghitung window retur:

```ts
const deliveredAt = shippingRecord.last_status_at;
const returnDeadlineAt = addHours(deliveredAt, 48);
```

Syarat `deliveredAt` valid:

- `shippingRecord` ada;
- status logistik/canonical shipping status adalah `delivered`;
- `last_status_at` tidak null.

Tidak perlu menyimpan `return_deadline_at`; hitung dinamis agar tidak berisiko inkonsistensi timestamp.

### 3.3 `order_return_cases`

Perluas tabel existing dengan field minimum berikut, dengan nama final mengikuti konvensi migration proyek:

```ts
type ReturnReason =
  | 'rusak'
  | 'pecah'
  | 'salah_ukuran'
  | 'salah_produk'
  | 'kurang'
  | 'lainnya';

type ResolutionType =
  | 'refund'
  | 'replacement'
  | 'reship'
  | 'compensation'
  | 'no_compensation';

type FaultParty = 'store' | 'customer' | 'other';

interface OrderReturnCase {
  id: string;
  order_id: string;
  reason: ReturnReason;
  reason_detail: string | null; // baru; wajib jika reason = 'lainnya'
  customer_chronology: string;
  admin_note: string | null;

  fault_party: FaultParty; // baru
  resolution_type: ResolutionType | null; // perlu ada/selaraskan dengan field existing
  refund_amount: number; // sumber truth nilai refund
  shipping_cost_borne_by_store: boolean; // baru

  created_at: Date;
  completed_at: Date | null;
}
```

Catatan:

- Jika `reason = 'lainnya'`, `reason_detail` wajib ada setelah trim whitespace.
- `refund_amount` tidak boleh negatif dan tidak boleh melebihi `order.total_amount`.
- `fault_party` dapat dipilih/diubah admin. Sistem hanya memberi default.
- Flag ongkir tidak perlu menyimpan nominal atau membangun kalkulator ongkir.

### 3.4 `order_return_items`

Gunakan tabel existing untuk item yang dikembalikan dan perluas untuk item pengganti. Nama kolom final mengikuti struktur existing.

```ts
interface OrderReturnItem {
  id: string;
  return_case_id: string;
  order_item_id: string;
  returned_quantity: number;

  // Baru: item untuk dikirim sebagai penggantian
  replacement_product_id: string | null;
  replacement_variant_id: string | null;
  replacement_quantity: number | null;
}
```

Aturan:

- `returned_quantity` wajib lebih dari 0 dan tidak boleh melebihi qty item order.
- Saat form dibuka untuk replacement, field `replacement_*` diinisialisasi dari item order yang dipilih untuk retur.
- Nilai awal tersebut read-only/terkunci pada UI.
- Admin dapat memilih aksi "Ubah item pengganti" untuk membuka editing produk, varian, dan qty.
- Item pengganti boleh berbeda dari item awal jika admin memang mengubahnya.

---

## 4. Transisi Status

### 4.1 Pengiriman sampai dan COD

Ketika sinkronisasi/logistik menandai pengiriman sebagai `delivered`:

```ts
await transaction(async (tx) => {
  await tx.shippingRecords.update(record.id, {
    // status dan last_status_at mengikuti mekanisme existing
  });

  await tx.orders.update(order.id, {
    order_status: 'delivered',
    ...(order.payment_method === 'cod' && order.payment_status !== 'paid'
      ? { payment_status: 'paid' }
      : {}),
  });
});
```

Pembaruan harus idempotent: sinkronisasi `delivered` berulang tidak boleh menimbulkan efek tambahan.

### 4.2 Memulai retur

```text
delivered + dalam 48 jam + payment_status=paid
  -> return_in_process
```

Saat admin memilih "Catat Retur":

1. Validasi kelayakan retur.
2. Buat `order_return_cases`.
3. Buat `order_return_items`.
4. Ubah `order_status` menjadi `return_in_process`.
5. Kirim notifikasi follow-up WhatsApp bila integrasi notifikasi tersedia.

Seluruh langkah database harus atomik.

### 4.3 Menyelesaikan retur

```text
return_in_process
  -> return_completed
```

Saat admin memilih "Selesaikan Retur":

- Validasi keputusan akhir.
- Bila replacement, validasi stok dan kurangi stok item pengganti dalam transaksi yang sama.
- Simpan `resolution_type`, `refund_amount`, dan metadata penyelesaian.
- Isi `completed_at` pada kasus retur.
- Ubah `order_status` menjadi `return_completed`.
- Jalankan rekonsiliasi pembayaran/laporan melalui mekanisme `PaymentService::reconcile` existing.

Order tidak kembali ke `completed`; `return_completed` menjadi terminal status bisnis untuk order yang selesai melalui retur.

---

## 5. Validasi Bisnis

### 5.1 Kelayakan membuat retur

```ts
function canCreateReturn(order, shippingRecord, now = new Date()) {
  if (order.order_status !== 'delivered') {
    return { allowed: false, reason: 'Retur hanya dapat dicatat untuk pesanan berstatus Sampai.' };
  }

  if (!shippingRecord || shippingRecord.status !== 'delivered' || !shippingRecord.last_status_at) {
    return { allowed: false, reason: 'Waktu paket sampai belum tersedia.' };
  }

  const deadline = addHours(shippingRecord.last_status_at, 48);
  if (now > deadline) {
    return { allowed: false, reason: 'Batas retur 48 jam telah lewat. Tindak lanjuti melalui WhatsApp.' };
  }

  if (order.payment_status !== 'paid') {
    return { allowed: false, reason: 'Pesanan belum tercatat lunas.' };
  }

  return { allowed: true, deadline };
}
```

Aturan tambahan:

- `completed` selalu tidak lolos karena bukan `delivered`.
- `return_in_process` dan `return_completed` tidak boleh membuat kasus retur baru.
- Validasi ini wajib berada di backend/API, bukan hanya tombol UI.

### 5.2 Validasi alasan

```ts
function validateReason(reason, reasonDetail) {
  if (reason === 'lainnya' && !reasonDetail?.trim()) {
    return { valid: false, error: 'Keterangan wajib diisi untuk alasan Lainnya.' };
  }
  return { valid: true };
}
```

Default `fault_party`:

```ts
function defaultFaultParty(reason) {
  const storeFaultReasons = ['rusak', 'pecah', 'salah_ukuran', 'salah_produk', 'kurang'];
  return storeFaultReasons.includes(reason) ? 'store' : 'other';
}
```

Admin selalu dapat mengubah default tersebut setelah memeriksa bukti dan kronologi.

### 5.3 Validasi refund

```ts
function validateRefundAmount(order, refundAmount) {
  if (!Number.isFinite(refundAmount) || refundAmount < 0) {
    return { valid: false, error: 'Nominal refund harus bernilai nol atau lebih.' };
  }

  if (refundAmount > order.total_amount) {
    return { valid: false, error: 'Nominal refund tidak boleh melebihi total pembayaran pesanan.' };
  }

  return { valid: true };
}
```

Aturan:

- Refund hanya dapat dipilih jika `payment_status = paid`.
- Untuk `resolution_type = 'refund'`, nilai `refund_amount` mengikuti nominal yang disetujui admin, maksimal `order.total_amount`.
- Ongkir retur yang dibayar toko bukan angka refund tambahan dalam sistem; tidak menaikkan batas maksimum refund.
- Sistem boleh menyimpan refund parsial untuk `compensation` jika mekanisme existing memang mendukungnya.
- Tidak ada perubahan enum/makna `payment_status` menjadi `refunded` atau `partially_refunded`.

### 5.4 Validasi replacement dan stok

```ts
function validateReplacement(items) {
  for (const item of items) {
    if (!item.replacement_product_id || !item.replacement_quantity || item.replacement_quantity < 1) {
      return { valid: false, error: 'Item pengganti dan jumlahnya wajib lengkap.' };
    }
  }
  return { valid: true };
}
```

Pada finalisasi replacement:

1. Lock/ambil data stok produk-varian pengganti.
2. Pastikan stok cukup.
3. Kurangi stok tepat satu kali.
4. Simpan final `replacement_*` di `order_return_items`.
5. Selesaikan retur dan ubah `order_status` dalam transaksi yang sama.

Jika transaksi gagal, stok dan status retur tidak boleh berubah sebagian.

---

## 6. Aturan Ongkir Retur

| Kondisi | `fault_party` | `shipping_cost_borne_by_store` | Perlakuan sistem |
|---|---|:---:|---|
| Barang rusak/cacat | `store` | `true` | Toko menanggung ongkir retur |
| Kaca pecah | `store` | `true` | Toko menanggung ongkir retur |
| Salah produk/ukuran/kiriman | `store` | `true` | Toko menanggung ongkir retur |
| Kesalahan pelanggan / berubah pikiran | `customer` | `false` | Tindak lanjut manual melalui WhatsApp |
| Kasus tidak jelas/lainnya | `other` | `false` secara default | Admin dapat override setelah investigasi |

Tidak ada perhitungan nominal ongkir, split ongkir, atau pembayaran ongkir yang diotomasi pada Sprint 2.

---

## 7. Alur UI Admin

### 7.1 Detail Pesanan

Tampilkan:

- status order;
- status pembayaran;
- status terakhir dan waktu `delivered` dari `shipping_records`;
- countdown/label tenggat: `last_status_at + 48 jam`;
- tombol "Catat Retur".

Tombol "Catat Retur" hanya aktif apabila hasil `canCreateReturn(...)` mengizinkan. Jika tidak aktif, tampilkan alasan akurat, terutama:

> Batas retur 48 jam telah lewat. Untuk komplain lebih lanjut, hubungi pelanggan melalui WhatsApp.

### 7.2 Form "Catat Retur"

Field:

- alasan retur (wajib);
- `reason_detail` kondisional (wajib untuk `lainnya`);
- kronologi pelanggan (wajib);
- catatan admin (opsional);
- daftar item order dengan checkbox dan `returned_quantity`;
- `fault_party`, terisi otomatis lalu dapat dioverride admin;
- tampilan read-only apakah ongkir akan ditanggung toko; mengikuti `fault_party` dan bisa diubah admin bila dibutuhkan.

Submit membuat kasus retur dan mengubah order menjadi `return_in_process`.

### 7.3 Form "Selesaikan Retur"

Field keputusan utama:

- `resolution_type`: `refund`, `replacement`, `reship`, `compensation`, atau `no_compensation`.

Jika **refund**:

- tampilkan input `refund_amount`;
- tunjukkan batas maksimum = `order.total_amount`;
- validasi backend sebelum simpan.

Jika **replacement**:

- auto-generate item pengganti dari setiap item yang diretur;
- tampilkan data produk, varian, dan qty dalam keadaan terkunci;
- sediakan aksi eksplisit "Ubah item pengganti" agar admin membuka editing secara sadar;
- cek ketersediaan stok sebelum finalisasi.

Saat selesai:

- tampilkan ringkasan final (tipe penyelesaian, jumlah refund atau item pengganti, penanggung ongkir);
- minta konfirmasi di UI;
- jalankan endpoint atomik untuk finalisasi.

---

## 8. Rekonsiliasi Pembayaran dan Laporan

### 8.1 Sumber Data

- Pembayaran order: `orders.payment_status` (`pending | paid`).
- Refund: `order_return_cases.refund_amount`.
- Status bisnis retur: `orders.order_status` dan status/penyelesaian kasus retur existing.

### 8.2 Rumus

Untuk laporan yang mencerminkan pendapatan bersih:

```text
net_revenue = gross_revenue - sum(completed_return_case.refund_amount)
```

Ketentuan:

- Hanya kasus retur yang benar-benar selesai yang masuk pengurang omzet.
- Replacement tidak mengurangi omzet kecuali ada `refund_amount` yang memang diisi.
- Replacement tidak membuat order baru, sehingga tidak menambah gross revenue kedua kali.
- `PaymentService::reconcile` harus membaca sumber refund ini sesuai pola kode existing, tanpa memperluas enum `payment_status`.

---

## 9. Migrasi dan Kompatibilitas

### 9.1 Migration minimum

Tambahkan hanya kolom yang benar-benar belum tersedia:

- `order_return_cases.reason_detail` nullable;
- `order_return_cases.fault_party` dengan default aman (`other` atau sesuai keputusan migration);
- `order_return_cases.shipping_cost_borne_by_store` dengan default `false`;
- `order_return_cases.resolution_type` jika belum tersedia;
- `order_return_cases.refund_amount` jika belum tersedia;
- `order_return_items.replacement_product_id` nullable;
- `order_return_items.replacement_variant_id` nullable;
- `order_return_items.replacement_quantity` nullable.

Jangan menambah tabel `returns` baru. Jangan menambah `return_status` pada `orders`.

**VALIDASI KOLOM AKTUAL (2026-08-24):**
- `order_return_cases` SUDAH punya: `resolution_type`, `refund_amount`, `replacement_amount`,
  `additional_shipping_amount`.
- `order_return_cases` BELUM punya: `reason_detail`, `fault_party`, `shipping_cost_borne_by_store`.
- `order_return_items` SUDAH punya: `requested_quantity`, `returned_quantity`.
- `order_return_items` BELUM punya: `replacement_product_id`, `replacement_variant_id`,
  `replacement_quantity`.
- Maka migrasi yang benar-benar perlu: 3 kolom baru di `order_return_cases`
  (`reason_detail`, `fault_party`, `shipping_cost_borne_by_store`) + 3 kolom baru di
  `order_return_items` (replacement_*). `resolution_type` & `refund_amount` TIDAK perlu ditambah.

### 9.2 Backfill COD

Untuk order COD existing yang sudah mempunyai bukti pengiriman `delivered` tetapi `payment_status = pending`:

- Lakukan backfill menjadi `paid` setelah audit data agar tidak menandai pengiriman gagal sebagai lunas.
- Gunakan timestamp `shipping_records.last_status_at` sebagai bukti waktu delivered.
- Jalankan migration/backfill secara idempotent dan log jumlah order terdampak.

### 9.3 Order lama

- Order `completed` tidak dibuka kembali untuk retur otomatis.
- Tidak perlu membuat deadline tersimpan untuk histori; tenggat dihitung dinamis dari shipping record pada order yang masih `delivered`.

---

## 10. Pengujian Wajib

### COD

- [ ] COD `shipped → delivered` mengubah `payment_status` dari `pending` ke `paid` sekali saja.
- [ ] COD `delivered` dapat dibuatkan retur sebelum 48 jam.
- [ ] COD `delivered` tidak dapat dibuatkan retur setelah 48 jam.
- [ ] COD `completed` tidak dapat dibuatkan retur dari UI maupun API.

### Refund

- [ ] Refund dengan nilai negatif ditolak.
- [ ] Refund lebih besar dari `order.total_amount` ditolak.
- [ ] Refund pada order `pending` ditolak.
- [ ] Refund tersimpan pada kasus retur tanpa mengubah arti `payment_status`.
- [ ] Rekonsiliasi laporan mengurangi net revenue hanya dari kasus retur selesai.

### Replacement

- [ ] Item pengganti auto-fill dari item retur.
- [ ] Item pengganti terkunci default dan hanya editable setelah aksi eksplisit admin.
- [ ] Produk/varian/qty pengganti yang diedit tersimpan benar.
- [ ] Stok berkurang hanya ketika finalisasi berhasil.
- [ ] Stok tidak berkurang dua kali bila request diulang.
- [ ] Replacement tidak menciptakan order baru atau omzet tambahan.

### Alasan dan ongkir

- [ ] `lainnya` tanpa `reason_detail` ditolak di UI dan backend.
- [ ] Alasan rusak/pecah/salah produk/default mengisi `fault_party = store` dan flag ongkir `true`.
- [ ] Admin dapat override pihak penyebab dan flag ongkir.
- [ ] Kasus non-store tidak memicu perhitungan ongkir otomatis.

---

## 11. Urutan Implementasi

1. Audit struktur aktual `order_return_cases`, `order_return_items`, `shipping_records`, enum `order_status`, dan `PaymentService::reconcile`.
2. Buat migration kecil untuk kolom yang benar-benar belum ada.
3. Implementasikan idempotent transition saat shipping menjadi `delivered`, termasuk COD → `paid`.
4. Tambahkan service/backend validation: window 48 jam, alasan lainnya, refund maksimum, dan replacement stok.
5. Implementasikan endpoint atomik: create return dan complete return.
6. Implementasikan UI Detail Pesanan, Catat Retur, dan Selesaikan Retur.
7. Hubungkan notifikasi WhatsApp sesuai flow existing.
8. Tambahkan test unit, integration test, dan uji manual untuk seluruh checklist.
9. Audit dampak `PaymentService::reconcile` terhadap dashboard omzet sebelum deploy produksi.

---

## 12. Batas Sprint 2

Tidak termasuk dalam Sprint 2:

- Form retur publik untuk pelanggan.
- Otomasi pickup/label pengembalian oleh kurir.
- Kalkulasi, split, atau pembayaran nominal ongkir retur.
- Retur otomatis untuk order `completed` atau lewat 48 jam.
- Order baru khusus replacement.
- Perluasan nilai `payment_status` menjadi `refunded`/`partially_refunded`.

Kasus di luar batas ini ditangani manual melalui WhatsApp.