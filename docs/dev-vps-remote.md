# Dev VPS — Cursor Remote SSH (bukan production)

Workstation development untuk `website.4.0`: kode + PHP + Node + MySQL jalan di **VPS**; laptop hanya Cursor UI + browser.

**Bukan** hardcut production / DNS toko live. Lihat [`ORCHESTRATION.md`](ORCHESTRATION.md) Track F.  
WhatsApp produksi: [`whatsapp-production-setup.md`](whatsapp-production-setup.md).  
R2 media: [`media-storage-r2.md`](media-storage-r2.md) — di VPS **dev** pakai `MEDIA_DISK=local` dulu.

## Quick start (instruksi dari laptop — cukup ini)

Asumsi: kamu OK ketik chat agent di laptop; HP hanya untuk **lihat** hasil mobile.

```text
Laptop Cursor (Remote SSH)  →  edit + agent di VPS
HP browser                  →  https://domain-cadangan  (preview)
```

1. **VPS Ubuntu** 4–8 GB → catat IP.
2. Di laptop: SSH key + Host `ragil-dev` (§1) → `ssh ragil-dev` berhasil.
3. Di VPS: firewall + bootstrap (§1.3–2) → app di `:8200`.
4. **Cursor laptop:** Extensions → Remote SSH → Connect to Host `ragil-dev` → Open Folder `/var/www/website.4.0`.
5. Chat agent seperti biasa (“perbaiki sticky CTA cart mobile”). Build UI: `npm run build` di terminal remote.
6. **Preview HP:** arahkan domain cadangan ke VPS (§7) → buka `https://domain-mu` di HP.

Tidak perlu Cloudflare Tunnel untuk memberi instruksi. Tunnel/domain hanya untuk HP mengakses website.

## Kenapa Remote SSH

- Satu lingkungan (hindari Windows/WSL Node 18 vs Vite `public/hot`).
- Agent Cursor, `npm run build`, PHPUnit makan RAM **VPS**, bukan laptop.
- Sync harian lewat **git**, bukan copy folder Windows ↔ VPS.

## Spesifikasi VPS

| Item | Minimum | Nyaman |
|------|---------|--------|
| RAM | 4 GB | **8 GB** (MySQL + build + Cursor server) |
| CPU | 2 vCPU | 2–4 |
| Disk | 40 GB | 60+ GB |
| OS | Ubuntu 22.04 / 24.04 LTS | sama |
| Akses | SSH root atau sudo | |

## 1) Provision + SSH + firewall (laptop)

### 1.1 Beli/create VPS

Catat **IP publik** dan pastikan login SSH dengan password atau cloud-init key.

### 1.2 SSH key (Windows PowerShell / OpenSSH)

```powershell
# Jika belum punya key
ssh-keygen -t ed25519 -C "ragil-dev" -f $env:USERPROFILE\.ssh\id_ed25519_ragil_dev

# Salin public key ke VPS (ganti USER dan IP)
type $env:USERPROFILE\.ssh\id_ed25519_ragil_dev.pub | ssh ubuntu@VPS_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

Template config: salin [`scripts/dev-vps/ssh-config.example`](../scripts/dev-vps/ssh-config.example) ke `%USERPROFILE%\.ssh\config`, ganti `HostName` / path key.

Uji:

```powershell
ssh ragil-dev
```

### 1.3 Firewall di VPS

Setelah login SSH:

```bash
sudo bash /path/to/website.4.0/scripts/dev-vps/ufw-allow.sh
# atau manual:
# sudo ufw allow OpenSSH
# sudo ufw allow 8200/tcp   # artisan serve (dev)
# sudo ufw enable
```

Jangan buka MySQL (3306) ke publik. Opsional: batasi 8200 ke IP rumah (`ufw allow from YOUR_IP to any port 8200`).

---

## 2) Stack + clone aplikasi (di VPS)

Script otomatis (Ubuntu):

```bash
# Sebagai user sudo; set URL git kamu
export RAGIL_GIT_URL='git@github.com:ORG/website.4.0.git'   # atau https://...
export RAGIL_APP_DIR='/var/www/website.4.0'
export RAGIL_APP_URL='http://VPS_IP:8200'                   # ganti IP/domain

curl -fsSL -o /tmp/ragil-bootstrap.sh https://...   # atau scp script dari laptop
# Disarankan: git clone dulu lalu:
sudo -E bash scripts/dev-vps/bootstrap.sh
```

Dari laptop (setelah repo lokal ada script):

```powershell
scp -r scripts/dev-vps ragil-dev:/tmp/dev-vps
ssh ragil-dev
# Opsi A — clone dari Git:
sudo RAGIL_GIT_URL='git@github.com:ORG/website.4.0.git' RAGIL_APP_URL='http://IP:8200' bash /tmp/dev-vps/bootstrap.sh

# Opsi B — kirim tree dari laptop (WSL/Git Bash punya rsync):
# bash scripts/dev-vps/rsync-to-vps.sh
# lalu di VPS: sudo RAGIL_APP_URL='http://IP:8200' bash /var/www/website.4.0/scripts/dev-vps/bootstrap.sh
```

Bootstrap memasang: PHP 8.2+, Composer, Node **20**, MySQL, git; clone/composer/npm; `.env` dev; migrate; `npm run build`.

### `.env` dev (inti)

```env
APP_ENV=local
APP_DEBUG=true
APP_URL=http://VPS_IP:8200

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=ragil
DB_USERNAME=ragil
DB_PASSWORD=...   # di-generate bootstrap

QUEUE_CONNECTION=database
DB_QUEUE_RETRY_AFTER=1860
MEDIA_DISK=local
SESSION_DRIVER=database
```

Salin token WA dari laptop hanya jika perlu tes Cloud API; **jangan** commit `.env`.

### Jalankan app + queue

```bash
cd /var/www/website.4.0
sudo bash scripts/dev-vps/serve-dev.sh   # Nginx :8200 + php-fpm (bukan artisan serve)
# terminal lain:
php artisan queue:work database --queue=imports,media,default --tries=3 --timeout=1800
```

Atau pakai helper:

```bash
bash scripts/dev-vps/serve-dev.sh
```

Browser laptop: `http://VPS_IP:8200` (bukan `127.0.0.1` di laptop — itu mesin lokal).

---

## 3) Cursor Remote SSH

1. Laptop: pasang extension **Remote - SSH** (Cursor/VS Code).
2. `F1` → **Remote-SSH: Connect to Host** → `ragil-dev`.
3. **Open Folder** → `/var/www/website.4.0`.
4. Terminal terintegrasi = shell VPS. Agent Cursor index & edit di remote.
5. Smoke: `/`, `/admin/login` (atau dashboard), katalog, cart.

Tutup workspace lokal berat / WSL untuk proyek ini agar laptop tenang.

---

## 4) Vite / frontend (penting)

| Jangan | Lakukan |
|--------|---------|
| Andalkan `npm run dev` + `public/hot` dari IP lain | `npm run build` lalu browse via `APP_URL` |
| Buka Vite HMR `http://127.0.0.1:5173` dari laptop ke proses VPS tanpa tunnel | Setelah ubah React: build ulang di VPS |

White-screen klasik:
1. HTML mengarah ke Vite HMR di IP yang tidak bisa dicapai browser → **build assets**, hapus `public/hot`.
2. `php artisan serve` single-thread mengantri `/build` + gambar besar → React belum mount (putih lama). Dev VPS wajib **Nginx + php-fpm** via `sudo bash scripts/dev-vps/serve-dev.sh`.

```bash
rm -f public/hot
npm run build
sudo bash scripts/dev-vps/serve-dev.sh
```

---

## 5) Alur kerja harian

```text
Laptop Cursor Remote → edit di VPS → npm run build (bila UI) → refresh http://VPS_IP:8200
                     → git commit / push dari VPS
```

Clone kedua di laptop opsional (backup baca saja). Source of truth saat remote-dev = **VPS working tree** + git remote.

---

## 6) Checklist verifikasi

- [ ] `ssh ragil-dev` tanpa password (key)
- [ ] `php -v` ≥ 8.2, `node -v` = 20.x
- [ ] `curl -I http://127.0.0.1:8200` di VPS = 200
- [ ] Browser laptop ke `http://VPS_IP:8200` = storefront
- [ ] Cursor Remote: folder terbuka, agent bisa baca `AGENTS.md`
- [ ] Tidak ada `public/hot`; HTML memakai `/build/assets/...`
- [ ] (Opsional) HP buka `https://domain-cadangan` = storefront mobile

---

## 7) Preview di HP lewat domain cadangan

Domain **bukan** `ragilaluminium.com` — hanya untuk live preview mobile. Bukan produksi toko.

### Opsi A — DNS A record → VPS (paling langsung)

1. Di penyedia DNS domain cadangan: record **A** `@` (dan/atau `preview`) → **IP VPS**.
2. Tunggu propagasi (menit–jam).
3. Di VPS, pasang Nginx + HTTPS (contoh Certbot) mengarah ke `127.0.0.1:8200`, atau sementara uji dulu `http://IP:8200` dari HP (butuh UFW 8200).
4. `.env` di VPS:

```env
APP_URL=https://preview.domain-cadangan.com
```

5. `php artisan config:clear` dan `npm run build`.
6. HP: buka URL itu (Chrome/Safari).

### Opsi B — Cloudflare Tunnel (domain sudah di Cloudflare)

1. Domain cadangan di akun Cloudflare.
2. Di VPS: install `cloudflared`, login, buat tunnel → public hostname `preview.domain-cadangan.com` → `http://127.0.0.1:8200`.
3. App cukup listen localhost; **tidak wajib** buka port 8200 ke internet.
4. `APP_URL=https://preview.domain-cadangan.com` → config:clear → build.
5. HP buka hostname itu.

Setelah UI berubah di Cursor remote: selalu `rm -f public/hot && npm run build`, lalu hard-refresh di HP.

---

## 8) Backup kode hasil coding di VPS

VPS bisa hilang/di-reset. **Backup utama = Git remote** (GitHub/GitLab), bukan mengandalkan disk VPS saja.

### Alur wajib (setiap selesai kerja berarti)

```text
Di VPS (terminal Cursor Remote):
  git status
  git add …
  git commit -m "…"
  git push origin BRANCH
```

- Jangan commit `.env`, credential, `storage/app` media besar.
- Pastikan `.gitignore` sudah mengabaikan `node_modules/`, `vendor/`, `public/hot`, `.env`.

### Kalau repo belum ada di GitHub (sekali saja)

Di laptop atau VPS:

1. Buat repo kosong di GitHub (private disarankan).
2. Di folder project:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:ORG/website.4.0.git
git push -u origin main
```

3. Di VPS: `git clone` dari remote itu (atau `git remote add` + push dari tree yang sudah di-bootstrap).

Setelah itu, **source of truth** = GitHub. VPS dan laptop hanya working copy.

### Cadangan ekstra (opsional)

| Metode | Kapan |
|--------|--------|
| GitHub + branch/`main` | Setiap hari (wajib) |
| Tag release `v0.x` | Milestone stabil |
| Snapshot VPS (provider) | Mingguan — recovery mesin, bukan pengganti git |
| `rsync` tree ke laptop | Darurat saja; rawan lupa & bentrok |

Jangan mengandalkan hanya folder di VPS tanpa `git push`.

---

## File terkait

| File | Fungsi |
|------|--------|
| [`scripts/dev-vps/bootstrap.sh`](../scripts/dev-vps/bootstrap.sh) | Install stack + app |
| [`scripts/dev-vps/ufw-allow.sh`](../scripts/dev-vps/ufw-allow.sh) | UFW SSH + 8200 |
| [`scripts/dev-vps/ssh-config.example`](../scripts/dev-vps/ssh-config.example) | SSH config laptop |
| [`scripts/dev-vps/serve-dev.sh`](../scripts/dev-vps/serve-dev.sh) | artisan serve + catatan queue |
| [`scripts/dev-vps/rsync-to-vps.sh`](../scripts/dev-vps/rsync-to-vps.sh) | Kirim tree ke VPS tanpa Git remote |
