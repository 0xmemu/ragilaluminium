# WhatsApp Cloud API — penyiapan produksi (Ragil)

Dokumen operasional terpisah dari kontrak Stage 8.  
Kontrak teknis: [`skills/stage-8-whatsapp-business-integration.md`](../skills/stage-8-whatsapp-business-integration.md).  
UI admin: **WhatsApp Otomatis → Koneksi**.

**Status saat parkir (2026-07):** sandbox / nomor uji Meta (`+1 555…`) sudah punya Phone Number ID + temporary token di `.env` lokal. Pesan uji sering `accepted` di API tetapi tidak muncul di HP — lanjut produksi nomor bisnis + template. **Webhook ditunda** sampai ada URL HTTPS publik. Fokus produk sementara: polish UI storefront/admin.

Mode sekarang mendukung **dua provider**:
- `WHATSAPP_PROVIDER=meta|waha` → provider aktif.
- `WHATSAPP_COMPARE_PROVIDER=meta|waha` → provider pembanding opsional.
- `WHATSAPP_COMPARE_ALLOWLIST=62812...,62857...` → hanya nomor uji ini yang menerima pesan ganda untuk perbandingan langsung.

---

## 1. Yang sudah vs belum

| Item | Peran | Status tipikal di fase uji |
|------|--------|----------------------------|
| `WHATSAPP_API_TOKEN` | Auth kirim pesan | Temporary OK untuk uji; produksi = System User **permanen** |
| `WHATSAPP_BUSINESS_NUMBER_ID` | Endpoint kirim | ID **Phone number**, bukan WABA ID |
| `WHATSAPP_BUSINESS_PHONE` | Referensi nomor tampilan | Opsional; format `62…` |
| `WHATSAPP_VERIFY_TOKEN` | Cocokkan verify webhook Meta | Sudah di-generate di `.env` lokal |
| Nomor bisnis nyata + payment Meta | Syarat kirim template bisnis | **Belum** (masih nomor uji) |
| Template Meta **Approved** | Wajib outbound order | **Belum** |
| Webhook publik | Status delivered / inbound | **Ditunda** (bukan blocker kirim order) |

Jangan commit `.env` / token ke git.

---

## 2. Webhook — apa artinya (boleh dilewati dulu)

```text
Kirim notifikasi order (tanpa webhook):
  Checkout → Ragil → Meta Graph API → WhatsApp pelanggan

Webhook (nanti):
  Meta → https://domain/webhook/whatsapp → Ragil (status / balasan)
```

Di wizard Meta **Langkah 2 → Konfigurasikan Webhooks**:

- **Boleh collapse / kosongkan** jika belum punya HTTPS publik.
- Jangan isi `http://127.0.0.1:…` — Meta tidak bisa verify.
- Lanjut ke bagian wizard: **Daftarkan nomor telepon** lalu **Tambahkan pembayaran**.

Saat siap webhook:

| Field Meta | Nilai |
|------------|--------|
| URL Callback | `https://DOMAIN/webhook/whatsapp` |
| Verifikasi token | sama dengan `WHATSAPP_VERIFY_TOKEN` di `.env` |
| Sertifikat klien | mati |

Route Ragil sudah ada: `GET/POST /webhook/whatsapp` untuk Meta dan `POST /webhook/whatsapp/waha` untuk WAHA (CSRF exempt).

Kotak oranye “terbitkan aplikasi”: app Development hanya menerima webhook uji dari dashboard. Publish (Live) menyusul bila butuh event produksi penuh; **kirim** template dari nomor bisnis tetap mengutamakan nomor + payment + template approved + token.

---

## 3. Urutan produksi (kerjakan di Meta)

1. **Phone numbers** — [WhatsApp Manager](https://business.facebook.com/wa/manage/phone-numbers/) → daftar nomor bisnis Ragil.
2. **Payment method** — wajib untuk pesan dimulai bisnis.
3. Salin **Phone number ID** baru → ganti `WHATSAPP_BUSINESS_NUMBER_ID` (bukan WABA ID).
4. **System User token permanen** — Business Settings → System users → Generate token (Never) dengan `whatsapp_business_messaging` + `whatsapp_business_management` → `WHATSAPP_API_TOKEN`.
5. **Template approved** (lihat §4) → map di admin WhatsApp Otomatis.
6. Uji checkout storefront ke nomor HP sendiri → chat dari **nomor bisnis**, bukan `+1 555…`.
7. **Webhook** + (opsional) publish app — setelah ada domain/tunnel.

Setelah punya ID + token baru: minta agent isi `.env` lokal + `php artisan config:clear`. Jangan paste token ke docs/PR.

### 3.1 Compare mode aman

Untuk membandingkan Meta vs WAHA langsung tanpa spam pelanggan umum:

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_COMPARE_PROVIDER=waha
WHATSAPP_COMPARE_ALLOWLIST=6281234567890,6285711122233
```

- Provider aktif menerima semua notifikasi order.
- Provider pembanding hanya menerima salinan ke nomor allowlist.
- Saat ingin pindah permanen, cukup ubah `WHATSAPP_PROVIDER` dan kosongkan compare mode bila tidak perlu.

---

## 4. Template yang dipetakan ke Ragil

Nama Meta harus exact dengan `provider_template_name` di admin. Bahasa disarankan `id`.

Ragil mengirim parameter body **berurutan** (`{{1}}`, `{{2}}`, …) sesuai `WhatsAppService` + `WhatsAppAutomationCatalog`. Di Meta pilih jenis variabel **Nomor** (bukan Nama). Naskah + emoji mengikuti katalog admin.

Setiap indeks `{{n}}` **hanya sekali** di body Meta (tidak boleh `{{1}}` dua kali). Nama di sapaan = `{{1}}`; nama di blok DATA PENERIMA = `{{3}}` (nilai sama, slot beda).

| Admin `internal_key` | Kapan | Nama Meta (disarankan) | Variabel body |
|----------------------|--------|-------------------------|---------------|
| `order_created` | Order COD | `order_created_cod` | `{{1}}` nama · `{{2}}` nomor · `{{3}}` nama lagi · `{{4}}` alamat · `{{5}}` detail · `{{6}}` produk · `{{7}}` ETA · `{{8}}` total |
| `payment_instructions` | Order transfer | `payment_instructions` | sama + `{{9}}` bank · `{{10}}` no.rek · `{{11}}` atas nama |
| `payment_confirmed` | Admin Proses Pesanan | `payment_confirmed` | `{{1}}` nama · `{{2}}` nomor · `{{3}}` ETA |
| `order_shipped` | Resi diinput / in_transit | `order_shipped` | `{{1}}` nama · `{{2}}` nomor · `{{3}}` ekspedisi · `{{4}}` resi · `{{5}}` link · `{{6}}` ETA |
| `order_delivered` | Tracking delivered | `order_delivered` | `{{1}}` nama · `{{2}}` nomor |

Gaya naskah final (semua template): sapaan `Halo Kak *{{1}}*,` di baris sendiri, judul blok kapital + bold (`*DATA PENERIMA*`), nilai penting di-bold, `Estimasi sampai Tujuan`, total `*Rp {{8}}*` (angka tanpa `Rp`), penutup `Terima kasih … 🙏`.

Contoh body Meta COD (`order_created_cod`) — salin dari katalog admin:

```text
Halo Kak *{{1}}*,
terima kasih sudah order di Ragil Aluminium 😊

Berikut rincian pesanan Kakak dengan nomor order : *{{2}}*
Mohon bantu dicek kembali, apakah rincian produk dan alamat pengiriman di bawah ini sudah sesuai ya Kak 🙏

*DATA PENERIMA*
Nama: {{3}}
Alamat: {{4}}
Detail tambahan: {{5}}

*RINCIAN PRODUK*
{{6}}

Estimasi sampai Tujuan : *{{7}}*
Metode Pembayaran : *COD*
Total Tagihan : *Rp {{8}}*

Mohon menyiapkan pembayaran *COD* saat barang diterima ya Kak.

Untuk konfirmasi pesanan, tolong tekan tombol dibawah ya kak,
agar pesanan kakak segera diproses

Terima kasih Kak 🙏
```

**Tombol konfirmasi COD:** tambahkan **Quick reply** (mis. label `Konfirmasi Pesanan`) di template Meta. Quick reply statis tidak perlu parameter dari backend; balasan pelanggan masuk sebagai inbound `whatsapp_messages` lewat webhook. Jangan pakai URL button dengan variabel sampai backend mengirim komponen `button`.

Minimal produksi: dua template pertama (COD + transfer). Rekening transfer diisi dari `BankTransferInstructions` / `sitemap.brand.bank` (bukan hardcode di Meta kecuali Anda sengaja menyamakan teks statis).

Catatan: perkiraan sampai (`{{6}}` / ETA) saat ini mengirim teks `menyusul` sampai kolom ETA/SLA tersedia di order.

### 4.1 WhatsApp Flow “konfirmasi pesanan” (opsional)

Flow di WhatsApp Manager **bukan** pengganti template Stage 8. Template tetap wajib untuk outbound bisnis; Flow = UI interaktif (bisa dilampirkan ke tombol template / pesan interactive nanti).

Screenshot draft Meta yang masih Hello World diganti dengan JSON di repo:

| File | Versi Flow JSON | Kegunaan |
|------|-----------------|----------|
| [`docs/whatsapp-flow-konfirmasi-pesanan.static.json`](whatsapp-flow-konfirmasi-pesanan.static.json) | **`7.3`** (publish) | Paste langsung; teks statis |
| [`docs/whatsapp-flow-konfirmasi-pesanan.json`](whatsapp-flow-konfirmasi-pesanan.json) | **`7.3`** + `${data.*}` | Nomor/item/total dinamis saat kirim Flow dengan payload |

**Versi:** editor Meta hanya menerima versi **publish** (`5.1`–`7.3`). `2.1` / `3.1` hanya untuk *mengirim* Flow yang sudah terbit — bukan untuk draft di Editor. Pakai **`7.3`** ([changelog supported versions](https://developers.facebook.com/docs/whatsapp/flows/changelogs#currently-supported-versions)).

Langkah di Meta: **Flows → konfirmasi pesanan → Editor** → ganti JSON → **Simpan** → uji **Jalankan** → **Terbitkan** setelah lolos validasi.

Mapping data dinamis (Flow) ke variabel template Ragil (setelah naskah 2026-07):

| Flow `data` | Template Meta / `WhatsAppService` |
|-------------|-----------------------------------|
| `customer_name` | `{{1}}` sapaan + `{{3}}` data penerima (nilai sama) |
| `order_number` | `{{2}}` nomor order |
| `address` / `items_summary` / `total` | `{{4}}`–`{{8}}` (lihat §4) |
| `payment_note` | teks statis COD vs transfer di body template |
| `status_url` | `{{5}}` pada `order_shipped` (atau route `order.status`) |

Backend belum mengirim Flow message (hanya template). Endpoint Flow / tombol template Flow = follow-up setelah template Approved + `WHATSAPP_BUSINESS_NUMBER_ID` terisi.

---

## 5. Mapping `.env`

```env
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v21.0
WHATSAPP_API_TOKEN=           # System User permanent
WHATSAPP_BUSINESS_NUMBER_ID=  # Phone Number ID nomor bisnis
WHATSAPP_VERIFY_TOKEN=        # string acak; sama di Meta Webhook
WHATSAPP_BUSINESS_PHONE=62…   # opsional, E.164 tanpa +
WHATSAPP_LANGUAGE=id
```

WABA ID (contoh uji: `1370284015237455`) **tidak** dipakai langsung di `.env` Ragil saat ini.

Admin cek: `/admin/whatsapp/connection` → token + number ID terisi = “terhubung” (konfig server), bukan jaminan delivery Meta.

---

## 6. Tes cepat

1. Connection page: configured.
2. Template Approved + mapped di admin.
3. Place order (COD / transfer) ke HP sendiri.
4. Admin Messages / `whatsapp_messages`: `sent` atau `failed` + `error_reason`.
5. Webhook: belakangan dengan tunnel/domain.

PHPUnit `WhatsApp*` = kontrak lokal, bukan bukti Cloud API live.

---

## 7. Kembali ke topik ini

Checklist singkat: nomor bisnis → payment → Phone Number ID + token permanen di `.env` → template Approved + map admin → uji order → webhook saat HTTPS siap.

Detail token/System User: Stage 8 §2.3.  
UI Koneksi admin memuat ringkasan langkah produksi yang sama.
