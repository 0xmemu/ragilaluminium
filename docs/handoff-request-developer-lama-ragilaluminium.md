# Handoff Proyek Selesai — `ragilaluminium.com` (Stack Live)

> **Kesepahaman:** `ragilaluminium.com` (stack Docker di VPS `202.74.74.87`) adalah **proyek yang sudah selesai**.  
> **Update 2026-07-28:** Owner sudah memegang penuh VPS, Bunny, J&T Open Console, dan registrar Biznet; DNS akan dikuasai via Opsi B (NS ke Cloudflare Owner). **Dokumen ini tidak wajib lagi sebagai blocker teknis** — simpan hanya untuk formalitas/legal bila Owner masih ingin checklist tertulis ke former.  
> Jalur teknis cutover: [`cutover-prep-website-4.0-before-handoff.md`](cutover-prep-website-4.0-before-handoff.md).

---

## 1. Pihak & peran

| Pihak | Peran |
|-------|--------|
| **Developer sebelumnya** | Menyerahkan kepemilikan akses, kredensial, dokumen, dan aset proyek live |
| **Owner** | Menerima handoff; mengoperasikan toko live; menindaklanjuti development website baru |

---

## 2. Yang tidak berubah saat handoff

Handoff = **serah akses & dokumentasi**, bukan cutover sistem baru.

- Toko live tetap jalan di subdomain dan VPS yang sama.
- **URL webhook J&T** di console Open Platform **tidak diubah** hanya karena handoff.
- Session WhatsApp Baileys prod **tidak** di-scan ulang di mesin lain tanpa koordinasi Owner.
- DNS record harus tetap mengarah ke origin yang sama kecuali Owner meminta perubahan terjadwal.

---

## 3. Daftar penyerahan ke Owner

Centang saat diserahkan. Preferensi: **invite Owner ke akun** (Super Admin / Owner) + catatan singkat. Secret via password manager, bukan chat plain text.

### A. Domain & DNS (wajib)

| # | Yang diserahkan | Keterangan | Status |
|---|-----------------|------------|--------|
| A1 | Akses **registrar** domain `ragilaluminium.com` | Login / transfer kepemilikan | ☐ |
| A2 | Akses **Cloudflare** (zone domain) | Invite Owner sebagai Super Admin **atau** transfer zone | ☐ |
| A3 | Export / daftar DNS record | `@`, `www`, `api`, `admin`, `wa-svc`, TTL, Proxied vs DNS-only | ☐ |
| A4 | Mode SSL Cloudflare | Flexible / Full / Full (strict) | ☐ |
| A5 | Origin target | IP VPS / CNAME yang dipakai sekarang | ☐ |

### B. CDN & media (wajib)

| # | Yang diserahkan | Keterangan | Status |
|---|-----------------|------------|--------|
| B1 | Akses **Bunny.net** | Storage + pull zone / custom hostname `cdn.ragilaluminium.com` | ☐ |
| B2 | Konfirmasi kredensial CDN | Apakah key di `.env` prod masih valid | ☐ |
| B3 | Catatan struktur folder media | Path upload produk / banner di bucket | ☐ |

### C. VPS produksi (wajib)

| # | Yang diserahkan | Keterangan | Status |
|---|-----------------|------------|--------|
| C1 | Panel **provider VPS** + billing | Invoice, tanggal perpanjangan, kontak support | ☐ |
| C2 | Akses SSH / sudo Owner | User aktif, daftar user lain (`jidane-dev`, dll.) | ☐ |
| C3 | Lokasi kode di server | Path backend, frontend, infra Docker | ☐ |
| C4 | Cara deploy | `deploy.sh` / CI; estimasi downtime | ☐ |
| C5 | SSL / Let's Encrypt | Cara renew; cron jika ada | ☐ |
| C6 | Backup | Apakah ada backup DB/file otomatis di luar VPS | ☐ |
| C7 | Firewall / port terbuka | Termasuk MySQL `:1439` jika sengaja | ☐ |

### D. Kode sumber & Git (wajib)

| # | Yang diserahkan | Keterangan | Status |
|---|-----------------|------------|--------|
| D1 | Repo **backend** GitHub | Transfer atau invite Admin ke Owner | ☐ |
| D2 | Repo **frontend** GitHub | Transfer atau invite Admin ke Owner | ☐ |
| D3 | Repo / folder **infra** (docker-compose, nginx) | Sumber yang dipakai prod | ☐ |
| D4 | CI/CD & deploy key | GitHub Actions secret, SSH deploy | ☐ |
| D5 | Commit / tag yang jalan di prod | Branch + hash / tag | ☐ |
| D6 | Repo legacy (jika masih relevan) | Daftar URL + apakah masih dipakai | ☐ |

### E. Kredensial aplikasi (wajib)

| # | Yang diserahkan | Keterangan | Status |
|---|-----------------|------------|--------|
| E1 | `.env` backend prod | Atau konfirmasi Owner sudah punya salinan lengkap | ☐ |
| E2 | `.env` WA engine | Termasuk URL webhook ke backend | ☐ |
| E3 | `.env.docker` / kredensial MySQL | User, password, nama DB | ☐ |
| E4 | Dump DB terbaru (opsional) | `ragil_mebel` — jika Owner minta snapshot resmi | ☐ |
| E5 | Admin panel | URL login + akun Owner (atau cara reset) | ☐ |

### F. J&T Cargo (wajib — operasional pengiriman)

| # | Yang diserahkan | Keterangan | Status |
|---|-----------------|------------|--------|
| F1 | Akses console [open.jtcargo.co.id](https://open.jtcargo.co.id) | Invite Owner ke **akun production yang sama** | ☐ |
| F2 | **URL callback / webhook** yang terdaftar | Exact string (path di bawah `api.ragilaluminium.com`) | ☐ |
| F3 | Environment | sandbox / production | ☐ |
| F4 | Catatan setting layanan | `goodsType`, service type, pay type yang dipakai | ☐ |
| F5 | Kontak outlet / CS J&T | Jika ada | ☐ |

### G. WhatsApp (wajib — operasional notifikasi)

| # | Yang diserahkan | Keterangan | Status |
|---|-----------------|------------|--------|
| G1 | Nomor WA bisnis yang terhubung | Nomor + status session Baileys | ☐ |
| G2 | Cara reconnect jika session putus | QR / runbook singkat | ☐ |
| G3 | Mapping otomasi | Order event → template / pesan mana | ☐ |
| G4 | Meta Business (jika pernah dipakai) | WABA, Phone Number ID, token — atau nyatakan “hanya Baileys” | ☐ |

### H. Email & tracking (jika dipakai)

| # | Yang diserahkan | Keterangan | Status |
|---|-----------------|------------|--------|
| H1 | SMTP / App Password | Akun pengirim email transaksi | ☐ |
| H2 | Analytics / Pixel | GA, Meta Pixel, dll. | ☐ |
| H3 | Payment gateway | Midtrans/Xendit/manual — akses dashboard jika ada | ☐ |

### I. Dokumentasi proyek (disarankan)

| # | Yang diserahkan | Status |
|---|-----------------|--------|
| I1 | Ringkasan arsitektur (1–2 halaman) | ☐ |
| I2 | Daftar subdomain + fungsi | ☐ |
| I3 | Runbook operasional (order, resi, WA) | ☐ |
| I4 | Known issues / technical debt | ☐ |
| I5 | Kontak vendor (hosting, J&T, Bunny, registrar) | ☐ |

---

## 4. Referensi teknis singkat (stack live)

| Host | Peran |
|------|--------|
| `ragilaluminium.com` / `www` | Toko (frontend) |
| `admin.ragilaluminium.com` | Admin |
| `api.ragilaluminium.com` | API Laravel + webhook |
| `wa-svc.ragilaluminium.com` | WA engine (opsional eksternal) |
| `cdn.ragilaluminium.com` | Media (Bunny, bukan Cloudflare) |

VPS: `202.74.74.87` — Docker: nginx, Laravel, frontend main/admin, worker, MySQL, WA Baileys.

---

## 5. Setelah handoff (tindak lanjut Owner)

Owner menggunakan hasil handoff untuk:

1. Mengoperasikan toko live mandiri (DNS, VPS, J&T, WA, CDN).
2. Mengarsipkan kredensial & dokumen di tempat aman Owner.
3. Menindaklanjuti **development website terbaru** di environment terpisah (preview bukan produksi), tanpa mengubah webhook / DNS prod sampai cutover dijadwalkan.

---

## 6. Format serah terima

```
handoff-ragilaluminium-YYYY-MM-DD/
├── README.md                 # kontak developer + ringkasan
├── dns-export.csv
├── akses-akun.md             # daftar panel + status invite (tanpa secret di git publik)
├── jnt-webhook-url.txt
├── github-repos.md
├── vps-notes.md
└── runbooks/                 # opsional
```

Atau isi kolom **Status** di dokumen ini dan kembalikan ke Owner.

---

## 7. Verifikasi Owner (setelah terima)

- [ ] Login Cloudflare — lihat record `api`, `admin`, `@`
- [ ] Login Bunny — bucket + hostname CDN
- [ ] Login J&T console — webhook URL masih sama dengan prod
- [ ] Clone repo GitHub backend + frontend
- [ ] SSH VPS — `docker ps` sehat
- [ ] Smoke: buka toko, admin, API HTTPS

---

## 8. Kontak

| Pihak | Nama | Email / WA |
|-------|------|------------|
| Owner | | |
| Developer sebelumnya | | |

---

*Dokumen ini adalah daftar penyerahan proyek selesai dari Developer → Owner. Update status checklist saat setiap item diserahkan.*
