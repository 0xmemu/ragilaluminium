1# Persiapan Integrasi & Cutover — `website.4.0` (sebelum handoff)

> **Tujuan:** menyiapkan pekerjaan teknis di sisi `website.4.0` **sebelum** Owner meminta handoff file/akses dari former developer `ragilaluminium.com`.  
> **Bukan** cutover sekarang. **Bukan** ubah prod / console J&T.  
> **Tanggal:** 2026-07-27

---

## 1. Kesepahaman (kunci)

| Keputusan | Isi |
|-----------|-----|
| Prod tetap | VPS `202.74.74.87` + domain `ragilaluminium.com` |
| Hostname J&T | **`api.ragilaluminium.com` wajib tetap** |
| Webhook Trackback | **`https://api.ragilaluminium.com/api/jnt`** — jangan diganti di console |
| Dev preview | `ra.natauma.me` saja — jangan daftarkan sebagai webhook J&T |
| Stack lama | Proyek selesai; handoff saat Owner minta |
| Console Open Platform | Tidak perlu ulang joint debugging jika URL + kredensial sama |

---

## 2. Yang sudah punya (mirror / audit) — tidak menunggu handoff

| Aset | Lokasi / catatan |
|------|------------------|
| Kode stack live | Mirror: backend, frontend, infra |
| Dump DB `ragil_mebel` | Mirror `database/` |
| Kredensial JNT di DB | `logistik_jnt` → map ke `JNT_*` |
| `.env*` live (banyak) | Mirror `secrets/` |
| Route webhook live | `GET/POST /api/jnt` → `READY` / `SUCCESS` |
| Sandbox J&T Success | Add order, track, cancel, waybill template, wilayah, coverage |
| Trackback Success | URL `https://api.ragilaluminium.com/api/jnt` |
| Gap live | Admin **belum** one-click buat resi; print API **404** |
| `website.4.0` JNT client | `JntCargoClient`, `ShippingService`, `jnt:joint-debug`, webhook `/webhook/shipping/jnt` |

---

## 3. Checklist persiapan teknis (kerjakan di `website.4.0` / `ra.natauma.me`)

### A. Integrasi J&T (outbound + shim) — prioritas tinggi

| # | Tugas | Status |
|---|--------|--------|
| A1 | Isi `JNT_*` di `.env` dev dari mirror (`api_account`, `private_key`, `jnt_customer_vip`, `password`, `JNT_SENDER_*`) | ☐ |
| A2 | Samakan `JNT_API_ACCOUNT` dengan **Personal Centre** console (cek digit vs DB bila beda) | ☐ |
| A3 | `php artisan jnt:status` | ☐ |
| A4 | Uji outbound aman: `tariff`, `address`, `track` (`jnt:joint-debug --force` bila production keys) — **hindari `create` massal** | ☐ |
| A5 | Implement **shim routes** di `website.4.0`: | ☐ |
| | `GET\|POST /api/jnt` | |
| | `GET\|POST /api/logistik/jnt/callback` | |
| | `GET\|POST /api/logistik/jnt/webhook` | |
| | → handler yang ACK seperti live (`READY` / `SUCCESS`) + `applyCarrierUpdate` | |
| A6 | Diff payload live `LogistikJnt@webhook` vs `ShippingController@handleJnt` | ☐ |
| A7 | Uji ping shim di lokal/dev: GET → `READY`, POST kosong → `SUCCESS` | ☐ |
| A8 | Rencana admin **buat resi** (`createShipment` / `addOrder`) + print label (fitur yang kurang di live) | ☐ |

**Jangan:** daftarkan `ra.natauma.me` di console J&T.

### B. WhatsApp (Meta) — terpisah dari Baileys prod

| # | Tugas | Status |
|---|--------|--------|
| B1 | Pastikan `WHATSAPP_*` di `.env` dev valid (sudah ada di VPS dev) | ☐ |
| B2 | Template Meta Approved + map di admin WhatsApp Otomatis | ☐ |
| B3 | Uji checkout → WA ke nomor staff (bukan pelanggan prod) | ☐ |
| B4 | Webhook Meta ke natauma: **opsional** — tidak memutus J&T | ☐ |
| B5 | Catat: prod live = Baileys; `website.4.0` = Meta — cutover WA terpisah dari J&T | ☐ |

### C. Nginx / hostname cutover (desain dulu, eksekusi nanti)

| # | Tugas | Status |
|---|--------|--------|
| C1 | Draft nginx: `server_name api.ragilaluminium.com` → `website.4.0/public` | ☐ |
| C2 | Draft nginx: `ragilaluminium.com` (+ www) → same app (Inertia) | ☐ |
| C3 | Draft: `admin.*` → same app `/admin` **atau** tetap subdomain ke app yang sama | ☐ |
| C4 | `cdn.*` tetap Bunny sampai migrasi R2 dijadwalkan | ☐ |
| C5 | `wa-svc.*` — evaluasi (Baileys); boleh idle setelah Meta | ☐ |

### D. Data & operasional

| # | Tugas | Status |
|---|--------|--------|
| D1 | Mapping tabel `ragil_mebel` → schema `website.4.0` (produk, order, pelanggan) | ☐ |
| D2 | Putuskan: cutover dengan migrasi data penuh vs soft-launch katalog baru | ☐ |
| D3 | Runbook cutover 15–30 menit (freeze resi → switch nginx → ping `/api/jnt` → matikan Docker lama) | ☐ |
| D4 | Rollback plan: nginx kembali ke stack Docker lama | ☐ |

### E. Dokumentasi internal

| # | Tugas | Status |
|---|--------|--------|
| E1 | Dokumen ini + plan cutover | ☐ |
| E2 | Handoff former developer — daftar **minimal kritis** (§4) | ☐ |
| E3 | Update `docs/jnt-cargo-integration.md` saat shim `/api/jnt` di-merge | ☐ |

---

## 4. Keputusan DNS — Opsi B (NS ke Cloudflare Owner)

**Keputusan Owner:** tidak menunggu akses zone Cloudflare lama. Domain di **Biznet** (registrar sudah dipegang); nameserver diganti ke **Cloudflare akun Owner**.

### 4.1 Risiko

| Risiko | Tingkat | Keterangan | Mitigasi |
|--------|---------|------------|----------|
| Toko / admin down sementara | Sedang | Propagasi NS 15 menit–beberapa jam | Jadwal sepi; TTL rendah dulu di CF lama jika sempat; siap rollback NS |
| **`api.*` salah/hilang** | **Tinggi** | Webhook J&T putus | Record `api` A → `202.74.74.87` Proxied **wajib** sebelum ganti NS; uji `curl` setelah Active |
| `cdn.*` salah | Sedang | Gambar putus | CNAME ke `cdn-ragilaluminium.b-cdn.net`, biasanya **DNS only** |
| MX / email putus | Sedang–Tinggi | Jika email domain pakai record di CF lama yang tidak diketahui | Inventaris email dulu; salin MX/TXT jika ada; atau terima risiko email sementara |
| TXT (SPF/DKIM/verifikasi) hilang | Sedang | Email spam / verifikasi Meta gagal | Cek `dig TXT ragilaluminium.com` **sebelum** ganti NS; salin ke zone baru |
| SSL Cloudflare / origin | Sedang | 525/526 setelah pindah | SSL mode Full (strict); cert origin VPS tetap |
| Salah akun / typo NS di Biznet | Tinggi | Domain “mengambang” | Double-check NS dari dashboard CF baru; jangan campur Neo DNS Biznet |
| Rollback gagal | Sedang | NS lama CF developer mungkin masih valid sementara | Simpan NS lama (`arushi` / `kolton`) untuk rollback cepat di Biznet |

**Yang tidak ikut rusak hanya karena ganti NS:** isi console J&T (URL tetap `https://api.ragilaluminium.com/api/jnt`) — asal host `api.` resolve lagi ke VPS yang sama.

### 4.2 Workflow paling aman (Opsi B)

**Sebelum sentuh Biznet nameserver**

1. Inventaris DNS publik (bisa tanpa login CF lama):
   ```bash
   dig NS ragilaluminium.com +short
   dig A ragilaluminium.com +short
   dig A api.ragilaluminium.com +short
   dig A admin.ragilaluminium.com +short
   dig A wa-svc.ragilaluminium.com +short
   dig CNAME cdn.ragilaluminium.com +short
   dig MX ragilaluminium.com +short
   dig TXT ragilaluminium.com +short
   dig TXT _dmarc.ragilaluminium.com +short
   ```
2. Catat NS lama Biznet: `arushi.ns.cloudflare.com`, `kolton.ns.cloudflare.com` (untuk rollback).
3. Di **Cloudflare akun Owner**: Add site `ragilaluminium.com` → catat **NS baru** yang diberikan CF.
4. Buat record di zone baru **sebelum** ganti NS:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `202.74.74.87` | Proxied |
| A | `www` | `202.74.74.87` | Proxied |
| A | `api` | `202.74.74.87` | Proxied |
| A | `admin` | `202.74.74.87` | Proxied |
| A | `wa-svc` | `202.74.74.87` | Proxied |
| CNAME | `cdn` | `cdn-ragilaluminium.b-cdn.net` | DNS only |
| MX / TXT | (hasil dig) | salin 1:1 | — |

5. SSL/TLS di CF baru: **Full (strict)** (setelah pastikan origin HTTPS).
6. (Opsional) Turunkan TTL di CF lama jika kebetulan dapat akses sebentar.

**Hari-H (jadwal sepi, ±30–60 menit siaga)**

7. Biznet Neo Domain → Manage nameservers → ganti ke **NS Cloudflare Owner** → Save.  
8. Jangan sentuh Neo DNS Biznet (`satu.neodns.id`) — biarkan tidak dipakai.  
9. Tunggu status zone Cloudflare **Active**.  
10. Verifikasi:
    ```bash
    dig NS ragilaluminium.com +short   # harus NS akun Anda
    curl -I https://ragilaluminium.com
    curl -I https://api.ragilaluminium.com/api/jnt
    curl -s https://api.ragilaluminium.com/api/jnt   # harap READY
    curl -I https://cdn.ragilaluminium.com/
    ```
11. **Jangan** ubah URL di console J&T.  
12. Setelah stabil 24 jam: nyalakan **Registrar Lock** di Biznet.

**Rollback (jika gagal)**

13. Biznet → kembalikan NS ke `arushi.ns.cloudflare.com` + `kolton.ns.cloudflare.com` → Save.  
14. Tunggu propagasi; toko kembali ke DNS Cloudflare lama.

### 4.3 Checklist Opsi B

- [ ] Inventaris dig (A/CNAME/MX/TXT) tersimpan  
- [ ] NS lama dicatat untuk rollback  
- [ ] Zone baru + record lengkap di CF Owner  
- [ ] `api` A → `202.74.74.87` Proxied  
- [ ] `cdn` CNAME Bunny DNS only  
- [ ] Jadwal sepi + orang siaga  
- [ ] Ganti NS di Biznet  
- [ ] Zone Active + curl toko/api/jnt/cdn OK  
- [ ] Console J&T tidak diedit  
- [ ] Registrar Lock ON setelah stabil  

---

## 5. Handoff former developer — **bukan blocker teknis lagi**

**Status Owner (2026-07-28):** sudah memegang penuh **VPS**, **Bunny**, **J&T Open Console**, plus **registrar Biznet**. Mirror kode/DB/`.env` sudah ada. Opsi B DNS menghilangkan ketergantungan Cloudflare lama.

| Item | Status |
|------|--------|
| Registrar Biznet | ✓ Owner |
| VPS `202.74.74.87` | ✓ Owner |
| Bunny CDN | ✓ Owner |
| J&T Open Console | ✓ Owner |
| Cloudflare zone (live) | → diganti Opsi B ke CF Owner |
| Mirror stack live | ✓ di staging |

**Kesimpulan:** file [`handoff-request-developer-lama-ragilaluminium.md`](handoff-request-developer-lama-ragilaluminium.md) **tidak wajib** untuk jalan teknis cutover. Minta ke former hanya jika mau formalitas/legal (mis. transfer GitHub, konfirmasi tertulis customer password J&T, atau screenshot DNS lama).

Yang masih dikerjakan **sendiri** (bukan handoff): Opsi B DNS + shim `/api/jnt` + uji di `ra.natauma.me` + runbook cutover aplikasi.

---

## 6. Urutan kerja yang disarankan

```text
Sekarang
  1. Opsi B DNS: inventaris dig → zone CF Owner → record lengkap
  2. (Jadwal sepi) Ganti NS Biznet → verifikasi api/jnt → Registrar Lock
  3. Isi JNT_* di .env ra.natauma.me + jnt:status / tariff+track
  4. Kode shim /api/jnt (+ siblings) di website.4.0
  5. Uji WA Meta outbound di natauma
  6. Draft nginx cutover + runbook + mapping DB

Nanti (cutover aplikasi)
  7. Staging di VPS prod
  8. Freeze singkat → switch nginx → ping /api/jnt
  9. Matikan Docker lama
  → Console J&T: idealnya TIDAK diedit
```

---

## 7. Definisi “siap cutover aplikasi” (gate)

- [ ] DNS Opsi B selesai: NS = CF Owner; `api`/`cdn`/toko OK  
- [ ] Shim `/api/jnt` GET/POST lulus uji lokal  
- [ ] `jnt:status` hijau; tariff/track outbound OK  
- [ ] Admin buat resi (addOrder) diuji di staging (bukan massal production)  
- [ ] WA Meta template order OK di preview  
- [ ] Runbook + rollback tertulis (DNS rollback NS sudah teruji atau tercatat)  
- [ ] Console J&T URL tetap `/api/jnt`  

---

## 8. Referensi

| Dokumen | Path |
|---------|------|
| Handoff proyek selesai | [`handoff-request-developer-lama-ragilaluminium.md`](handoff-request-developer-lama-ragilaluminium.md) |
| Integrasi J&T 4.0 | [`jnt-cargo-integration.md`](jnt-cargo-integration.md) |
| WA Meta | [`whatsapp-production-setup.md`](whatsapp-production-setup.md) |
| Product contract | [`PRODUCT-HANDOFF.md`](PRODUCT-HANDOFF.md) |
| Plan cutover | `.cursor/plans/prod_ragil_+_jnt_webhook_*.plan.md` |

---

*Persiapan ini agar Owner menguasai DNS tanpa akses CF lama, tetap menjaga `api.ragilaluminium.com` untuk J&T, dan cutover aplikasi tidak bergantung pada joint debugging ulang.*
