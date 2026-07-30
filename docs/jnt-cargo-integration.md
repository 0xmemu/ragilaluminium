# Integrasi J&T Cargo — Ragil Aluminium (`website.4.0`)

> **Sumber:** [J&T Cargo Open Platform](https://open.jtcargo.co.id/#/apiDoc) (spesifikasi resmi console).
> **Status:** Implementasi backend selesai; aktivasi menunggu kredensial sandbox/production dari console.
> **Lingkup:** transport, tanda tangan, buat/batal resi, cek tarif, tracking, push (webhook).
> **Provider decision (2026-07-26):** jalur resmi **Open Platform langsung**. Aggregator Biteship **ditolak** (hanya J&T Express `jnt`/`ez`, bukan Cargo). KiriminAja / rate-only API tidak dipakai kecuali SoT diubah eksplisit.

---

## 0. Provider yang didukung

| Provider | Status di Ragil |
|----------|-----------------|
| **J&T Cargo Open Platform** | **Aktif sebagai SoT shipping** — `config/jnt.php` + `JntCargoClient` |
| Biteship | Tidak — katalog `jnt` = Express, bukan Cargo |
| KiriminAja / AgenWebsite Rate | Tidak diintegrasikan (opsional bisnis terpisah) |

Cek kesiapan env:

```bash
php artisan jnt:status
php artisan jnt:joint-debug --times=3   # setelah kredensial + JNT_ENABLED=true
```

---

## 1. Arsitektur

| Komponen | File | Fungsi |
|----------|------|--------|
| Config terpusat | `config/jnt.php` | endpoint, kredensial, default field, pemetaan status, ACK |
| Client transport | `app/Services/Shipping/JntCargoClient.php` | signing (2 digest), POST form, retry aman, log metadata |
| Response wrapper | `app/Services/Shipping/JntResponse.php` | sukses transport vs bisnis, ambil `billCode` (list) |
| Orkestrasi domain | `app/Services/ShippingService.php` | estimasi ongkir, buat/batal resi, refresh, cascade status |
| Webhook | `app/Http/Controllers/Webhook/ShippingController.php` | verifikasi tanda tangan, parse push, ACK |
| Event | `app/Events/ShippingStatusUpdated.php` + listener WA | notifikasi milestone ke pelanggan |
| Joint-debug | `app/Console/Commands/JntJointDebug.php` | uji sandbox (bukti sukses ≥3×) |
| Status / readiness | `app/Console/Commands/JntStatus.php` + `App\Support\JntReadiness` | checklist kredensial + pengirim |
| Audit log | `config/logging.php` channel `jnt` → `storage/logs/jnt-*.log` | metadata request/response tanpa credential/PII |

**Prinsip:** semua nilai spesifik akun (endpoint path, field, kode status) ada di `config/jnt.php` dan bisa di-override lewat `.env` **tanpa mengubah kode**.

---

## 2. Transport & Tanda Tangan

- **Metode:** `POST`, `Content-Type: application/x-www-form-urlencoded`.
- **Form field:** `bizContent` = string JSON data bisnis.
- **Header:** `apiAccount`, `timestamp` (epoch ms), `digest`.

Dua tanda tangan berbeda:

```
HEADER digest = Base64( MD5( bizContent + privateKey ) )

INNER digest  = Base64( MD5( customerCode + cipher + privateKey ) )
  cipher      = STRTOUPPER( MD5( plainPassword + "jadada236t2" ) )
```

- HEADER `digest` dikirim di header, untuk **semua** interface.
- INNER `digest` disisipkan **di dalam bizContent** bersama `customerCode`, hanya untuk interface order/tarif (addOrder, getOrders, cancelOrder, agingCost/get, getDispatchCode, getAddress, getBatchBillCode). Interface `logistics/trace` & `trace/subscribe` **tidak** memakai inner digest.

Implementasi: `JntCargoClient::sign()` (header) dan `JntCargoClient::innerDigest()` (inner).

---

## 3. Endpoint yang Dipetakan

| Interface | Path (default, `config/jnt.php`) | Dipakai oleh |
|-----------|----------------------------------|--------------|
| Create/Modify Order | `/webopenplatformapi/api/order/addOrder` | `createShipment` (`operateType` 1=add, 2=modify) |
| Check Order | `/webopenplatformapi/api/order/getOrders` | `getOrders` (opsional) |
| Cancel Order | `/webopenplatformapi/api/order/cancelOrder` | `cancelShipment` |
| Freight & Aging | `/webopenplatformapi/api/agingCost/get` | `estimateCost` |
| Track | `/webopenplatformapi/api/logistics/trace` | `refreshStatus` (`billCodes` comma-string, ≤30) |
| Track Subscribe | `/webopenplatformapi/api/trace/subscribe` | `subscribe` |
| Dispatch Code (10-char) | `/webopenplatformapi/api/order/getDispatchCode` | `dispatchCode` |
| Address Validate | `/webopenplatformapi/api/order/getAddress` | `address` |
| Batch billCode | `/webopenplatformapi/api/billCode/getBatchBillCode` | `getBatchBillCode` |

> Doc order menampilkan path tanpa prefix (`/api/order/addOrder`) sedangkan `trace` menampilkan prefix penuh (`/webopenplatformapi/...`). Kami memakai prefix konsisten; **override via `.env`** (`JNT_EP_*`) bila console memberi path berbeda.

---

## 4. Pemetaan Status → Internal

Status internal: `pending_pickup | in_process | in_transit | delivered | returned | cancelled`.

**Order-level (getOrders / push status order):**
`100` not dispatched, `101` outlet dispatched, `102` salesperson → `pending_pickup`; `103` picked up → `in_process`; `104` cancelled, `105` pickupFail → `cancelled`.

**Trace `scanType` (logistics/trace & push trajektori):**
`1` collection → `in_process`; `3/4/5` scan gudang/transit → `in_transit`; `10` delivery → `delivered`; `11` problem → `in_transit`; `12` return → `returned`; `13` pickup failed → `cancelled`.

**`scanTypeCode`** (pembeda tanda tangan pada `scanType=10`): `100` Delivered Sign → `delivered`; `101` Return Sign → `returned`. Ini **diprioritaskan** di `ShippingService::mapCarrierStatus()`.

Cascade ke `order_status`: `in_transit`→`shipped`, `delivered`→`delivered`, `returned`→`return_in_process`. Perubahan dicatat di `EventLog` dan memicu `ShippingStatusUpdated`.

---

## 5. Field Utama `addOrder` (bizContent)

`txlogisticId` (= `order_number` kita), `operateType`, `expressType`, `orderType`, `serviceType` (01 pickup/02 store), `deliveryType` (101), `payType` (`PP_PM`/`CC_CASH` untuk COD), `goodsType` (bm000001..bm000011), `weight` (kg, string), `totalQuantity`, `remark`, `sender{...}`, `receiver{...}` (**`countryCode` = `IDN`, tiga huruf**), `items[]{itemName,number,itemValue,priceCurrency,desc}`.

Respons sukses: `billCode` (**List<String>** → ambil elemen pertama sebagai nomor resi), `txlogisticId`, `sortingCode`, `sumFreight`, `estimateTime`, dst.

---

## 6. Webhook (Push J&T)

Route: `POST /webhook/shipping/jnt` (CSRF dikecualikan, throttle 120/mnt).

Alur `ShippingController::handleJnt`:
1. Ambil `bizContent` (JSON) + header `digest`.
2. Kunci webhook wajib tersedia dan signature diverifikasi secara aman. Kunci kosong atau signature gagal akan ditolak.
3. Parse: `details[]` (push trajektori) ambil scan terbaru, atau field root (push status order). Ambil `scanType`, `scanTypeCode`, `desc`, `scanTime`.
4. Cari `ShippingRecord` via `billCode` atau `txlogisticId`.
5. `applyCarrierUpdate()` (idempoten, transaksional, cascade + event).
6. Balas ACK `{code:"1", msg:"success", data:"SUCCESS"}`.

> URL callback ini yang didaftarkan di console J&T (Order Status Return & Logistics Trajectory Return).

---

## 7. Joint-Debugging Sandbox (WAJIB ≥3× sukses)

Persyaratan J&T sebelum ajukan environment formal:
> "perform joint debugging of all the interfaces... succeed three or more times before submitting the application for the formal environment."

```bash
# Isi kredensial sandbox + data uji di .env (JNT_*), lalu:
php artisan jnt:joint-debug --times=3            # semua interface
php artisan jnt:joint-debug --interface=track --times=3
```

- Berjalan hanya saat `JNT_ENV=sandbox` (kecuali `--force`).
- Menembak `tariff, address, create, track, cancel` masing-masing N kali.
- Metadata request/response tercatat di channel log J&T tanpa digest, credential, alamat, nomor telepon, atau payload pelanggan.
- Mencetak ringkasan rasio sukses per interface.

---

## 8. Konfigurasi `.env`

Lihat blok **J&T Cargo Open Platform** di `.env.example`. Minimal yang wajib diisi dari console:
`JNT_ENABLED=true`, `JNT_ENV`, `JNT_API_ACCOUNT`, `JNT_PRIVATE_KEY`, `JNT_CUSTOMER_CODE`, `JNT_CUSTOMER_PASSWORD`, data `JNT_SENDER_*`, dan default order (`JNT_EXPRESS_TYPE`, `JNT_GOODS_TYPE`, dll — sesuaikan dengan tipe layanan akun).

> **Catatan `goodsType`:** produk aluminium (jendela/pintu) → default `bm000010` (bahan bangunan). Konfirmasi kategori yang benar dengan outlet J&T dan sesuaikan `JNT_GOODS_TYPE`.

---

## 9. Checklist sebelum Production

- [ ] Semua interface online sukses ≥3× di sandbox (`jnt:joint-debug`), log tersimpan.
- [ ] URL webhook status & trajektori didaftarkan di console + tanda tangan terverifikasi.
- [ ] `JNT_GOODS_TYPE`, `serviceType`, `payType` dikonfirmasi sesuai kontrak akun.
- [ ] Alamat pengirim (`JNT_SENDER_*`) lengkap & valid via `getAddress`.
- [ ] Ubah `JNT_ENV=production` + base URL production, uji 1 order nyata bernilai kecil.
