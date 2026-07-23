---
name: ragil-ui-functional-integration
description: >-
  Memastikan setiap perubahan tampilan/UI/fitur Ragil Aluminium langsung
  terintegrasi dengan backend (route, controller, service, schema) dan fungsional
  end-to-end — bukan mockup. Wajib dibaca saat edit UI admin/public, Figma→code,
  menambah tombol/form/panel, atau menyambungkan alur order/payment/shipping/WA.
---

# UI Functional Integration (Ragil)

## Prinsip

**Jika ada perubahan tampilan atau fitur, outputnya harus sudah terintegrasi dengan sistem dan fungsional.**

Ini selalu diterapkan. Analisis fungsi/fitur setelah mengubah UI, lalu sambungkan ke backend agar langsung jalan — bukan cuma mockup.

## Kapan memakai skill ini

- Edit halaman Inertia React (`resources/js/pages/**`, komponen terkait)
- Port / adaptasi dari Figma
- Menambah tombol, tab, form, badge, panel, empty state, atau aksi kartu
- Menyentuh alur order, payment, shipping/JNT, WhatsApp, import, CMS

## Alur wajib (setelah UI berubah)

```text
UI change → daftar aksi/data yang terlihat
         → petakan ke kontrak (schema / API / sitemap / stage skill)
         → wire controller + service + route + props Inertia
         → verifikasi happy path
         → laporan AGENT (TEST_STATUS = jalur nyata)
```

### 1. Inventaris fitur di layar

Untuk setiap elemen interaktif / data:

| Elemen | Pertanyaan |
|--------|------------|
| Tombol / CTA | Route apa? Method? Payload? Side-effect? |
| Form | Field validasi backend? Error props? |
| Tab / filter | Query string? Scope Eloquent? |
| Badge / status | Enum schema? Label dari `statusMeta`? |
| Panel data (lacak, bayar, WA) | Relasi model? Refresh/poll? Webhook? |
| Empty / loading | Dari props kosong vs belum di-fetch? |

### 2. Petakan ke sistem

Baca sesuai area:

- Schema: `docs/database-schema-ragil-aluminium.md`
- Routes/API: `docs/api-and-routes-ragil-aluminium.md`
- Domain: `skills/stage-*.md` (order → stage-4; JNT → `docs/jnt-cargo-integration.md`)
- UI skill: `ragil-admin-ui` atau `ragil-public-ui`
- Sitemap: `config/admin-sitemap.php` / `config/sitemap.php`

**Jangan** invent field, enum, atau URL di luar kontrak.

### 3. Sambungkan (checklist)

- [ ] Controller mengirim props yang UI butuhkan (bukan placeholder React)
- [ ] Aksi UI memanggil route bernama yang ada (`routeUrl` / Ziggy)
- [ ] Mutasi menulis DB / service domain (Order, Payment, Shipping, WA, …)
- [ ] Event/listener yang kontrak wajibkan ikut terpicu bila relevan
- [ ] Error & flash success ditampilkan
- [ ] Docs route diperbarui bila endpoint baru (`SPEC_CHANGED_AND_DOCS_UPDATED`)

### 4. Definisi “selesai”

Belum selesai jika:

- Tombol tidak mengubah state sistem, atau
- Data di UI tidak berasal dari DB/service, atau
- Ada label Figma “Lacak / Bayar / Proses” tanpa jalur backend.

Selesai jika admin/customer bisa menyelesaikan intent layar itu pada data nyata (atau graceful degrade yang jujur, mis. `JNT_ENABLED=false` + pesan jelas + fallback manual).

## Contoh

| UI | Integrasi yang benar |
|----|----------------------|
| Lacak pesanan di detail order | `shipping_records` + `ShippingService::createShipment` / `refreshStatus` + route per order |
| Proses pesanan Transfer | Konfirmasi payment → `payment_status=paid` + `processing` |
| Proses pesanan COD | Majukan order tanpa lunas; lunas saat delivered/completed |
| Chat WA | URL dari nomor ternormalisasi / template service — bukan nomor hardcode |

## Anti-pola

```text
❌ Figma panel → React static copy → “nanti backend”
❌ Button onClick={() => {}} atau toast sukses palsu
❌ Fake waybill / omzet / visitor di admin
❌ Hanya ResourceIndex generik padahal Figma minta aksi domain
```

```text
✅ UI + props dari controller + aksi ke service/route + uji jalur
```

## Laporan

Di `TEST_STATUS`, sebut jalur yang diuji atau yang harus di-smoke (bukan hanya “lint OK”).
