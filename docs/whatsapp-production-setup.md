# WhatsApp Cloud API — penyiapan produksi (Ragil)

Dokumen operasional terpisah dari kontrak Stage 8.  
Kontrak teknis: [`skills/stage-8-whatsapp-business-integration.md`](../skills/stage-8-whatsapp-business-integration.md).  
UI admin: **WhatsApp Otomatis → Koneksi**.

**Status saat parkir (2026-07):** sandbox / nomor uji Meta (`+1 555…`) sudah punya Phone Number ID + temporary token di `.env` lokal. Pesan uji sering `accepted` di API tetapi tidak muncul di HP — lanjut produksi nomor bisnis + template. **Webhook ditunda** sampai ada URL HTTPS publik. Fokus produk sementara: polish UI storefront/admin.

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

Route Ragil sudah ada: `GET/POST /webhook/whatsapp` (CSRF exempt).

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

---

## 4. Template yang dipetakan ke Ragil

Nama Meta harus exact dengan `provider_template_name` di admin. Bahasa disarankan `id`.

Ragil mengirim parameter body **berurutan** (`{{1}}`, `{{2}}`, …) sesuai kode `WhatsAppService` (bukan semua token di copy katalog UI).

| Admin `internal_key` | Kapan | Nama Meta (disarankan) | Variabel body |
|----------------------|--------|-------------------------|---------------|
| `order_created` | Order COD | `order_created_cod` | `{{1}}` nomor, `{{2}}` item, `{{3}}` total |
| `payment_instructions` | Order transfer | `payment_instructions` | sama |
| `payment_confirmed` | Pembayaran / diproses | `payment_confirmed` | `{{1}}` nomor order |
| `order_shipped` | Resi | `order_shipped` | (lihat listener Stage 8 / service) |
| `order_delivered` | Sampai | `order_delivered` | (lihat listener Stage 8 / service) |

Contoh body Meta (3 variabel):

```text
Terima kasih telah berbelanja di Ragil Aluminium.

Pesanan {{1}} sedang kami proses.
Rincian: {{2}}
Total: {{3}}

Salam,
Ragil Aluminium
```

Minimal produksi: dua template pertama (COD + transfer).

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
