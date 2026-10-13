# Design Language Admin · "Ink"

Status: kanonik untuk panel admin (2026-09-20). Berkas ini melengkapi
`frontend/docs/DESIGN-SYSTEM.md` dan tunduk pada
`frontend/docs/UI-CONSISTENCY-CONTRACT.md`.

## Nama dan filosofi

Panel admin Ragil Aluminium memakai design language bernama **"Ink"**. Nama dan
filosofinya tertulis di komentar `resources/css/app.css` tepat di atas blok
`html.admin-shell`:

> ADMIN DESIGN LANGUAGE : "Ink" (dark command-center, fintech bento)

Dua acuan gaya itu berarti:

- **dark command-center**: kanvas gelap, kepadatan tinggi, kontrol terpusat.
  Panel admin dipakai berulang sepanjang hari kerja, jadi tampilannya dirancang
  seperti konsol kerja, bukan halaman marketing.
- **fintech bento**: konten disusun sebagai kartu rapat dengan hairline tipis di
  atas kanvas near-black, seperti grid bento dashboard keuangan.

Lima aturan bentuk dari komentar yang sama:

| Aspek | Aturan |
|---|---|
| Kanvas | mono near-black |
| Kartu | dark raised + hairline |
| CTA | putih solid |
| Aksen fungsional | netral (monochrome) |
| Status | semantik |

## Prinsip

### Primary monokrom, bukan Signal Red

Di panel admin, `--primary` **bukan** Signal Red.

- Mode gelap (default): `--primary` = `#F5F5F5` (putih solid), dengan
  `--primary-foreground` = `#0F0F0F`. Tombol aksi utama tampil sebagai tombol
  putih berteks hampir hitam.
- Mode terang: `--primary` = `#0F1729` (obsidian), sehingga tombol aksi utama
  tampil gelap berteks terang.

Alasannya: panel admin bukan halaman jualan. Merah di storefront bertugas
menarik perhatian pembeli; kalau dipakai di setiap tombol simpan, filter, dan
aksi tabel, merah kehilangan makna dan panel terasa berteriak sepanjang hari.

**Signal Red tetap dipakai di admin**, tetapi hanya untuk peran semantik dan
aksen, bukan aksi utama:

- status semantik: `--destructive`, `--warning`, `--sale`
- penanda peringatan dan validasi gagal
- aksen terbatas seperti indikator aktif

Signal Red sendiri hidup di token storefront `--primary` (`#C20000`).
Halaman admin TIDAK mewarisi nilai itu karena `html.admin-shell` menimpanya.

### Dark-first

Admin default **GELAP**. Mode terang adalah alternatif opsional, bukan default.

Bukti implementasi:

- `resources/js/lib/admin-theme.ts`, fungsi `readAdminTheme()`, mengembalikan
  `"dark"` bila `localStorage` kosong. Komentarnya: `Admin "Ink" adalah
  dark-first: default gelap, light jadi alternatif`.
- Storage key: `ragil-admin-theme`.
- Kelas `admin-shell` dipasang di `resources/js/layouts/admin-layout.tsx`
  (baris 112), dan dilepas saat keluar admin supaya storefront tetap terang.
- Kelas mode terang adalah `<html class="admin-shell light">`.

Konsekuensi yang perlu dijaga saat menulis komponen:

- Jangan menganggap permukaan default itu putih. Pakai `bg-surface`, `bg-card`,
  `text-foreground`, `text-body`. Lihat larangan `bg-white` di
  `frontend/skills/ragil-admin-ui/SKILL.md`.
- Jangan menulis nilai hex langsung. Token yang sama menunjuk warna berbeda di
  tiga konteks (storefront, admin gelap, admin terang).

## Token

Nilai di bawah dibaca dari `resources/css/app.css` dan dikonversi dari triple
HSL ke hex. Triple HSL adalah sumber kebenaran; sebagian komentar inline di
`app.css` ditulis sebagai aproksimasi dan bisa meleset 1 sampai 2 tingkat.

### Mode gelap (default), `html.admin-shell`

| Token | HSL | Hex | Peran |
|---|---|---|---|
| `--background` | `0 0% 7%` | `#121212` | kanvas halaman |
| `--foreground` | `0 0% 96%` | `#F5F5F5` | judul dan teks utama |
| `--action-foreground` | `0 0% 94%` | `#F0F0F0` | teks aksi |
| `--body-foreground` | `0 0% 62%` | `#9E9E9E` | body dan deskripsi |
| `--muted-foreground` | `0 0% 62%` | `#9E9E9E` | teks sekunder |
| `--card` | `240 8% 12%` | `#1C1C21` | kartu konten |
| `--card-foreground` | `0 0% 96%` | `#F5F5F5` | teks di kartu |
| `--popover` | `240 8% 12.5%` | `#1D1D22` | dropdown, popover |
| `--sidebar` | `240 8% 7.3%` | `#111114` | rel navigasi kiri |
| `--surface` | `240 8% 12%` | `#1C1C21` | panel konten |
| `--surface-muted` | `240 8% 15.5%` | `#24242B` | panel sekunder, chip |
| `--primary` | `0 0% 96%` | `#F5F5F5` | CTA utama, monokrom |
| `--primary-hover` | `0 0% 82%` | `#D1D1D1` | hover CTA utama |
| `--primary-foreground` | `0 0% 6%` | `#0F0F0F` | teks di atas CTA |
| `--secondary` | `0 0% 16%` | `#292929` | hover di atas kartu |
| `--muted` | `0 0% 14%` | `#242424` | chip di atas kartu |
| `--accent` | `0 0% 15%` | `#262626` | permukaan terangkat |
| `--border` | `0 0% 16.5%` | `#2A2A2A` | hairline |
| `--input` | `0 0% 18%` | `#2E2E2E` | garis kontrol input |
| `--ring` | `0 0% 72%` | `#B8B8B8` | focus ring |
| `--success` | `151 55% 48%` | `#37BE7D` | status sukses |
| `--warning` | `36 92% 58%` | `#F6A831` | status peringatan |
| `--warning-foreground` | `36 95% 82%` | `#FDDAA5` | teks status peringatan |
| `--destructive` | `0 74% 56%` | `#E23C3C` | aksi merusak, error |
| `--sale` | `0 74% 56%` | `#E23C3C` | penanda promo |
| `--info` | `207 82% 62%` | `#4FA6EE` | status informasi |
| `--info-foreground` | `207 90% 84%` | `#B1DAFB` | teks status informasi |
| `--copper` | `27 70% 62%` | `#E2975A` | aksen garansi |
| `--copper-foreground` | `0 0% 12%` | `#1F1F1F` | teks di atas copper |
| `--radius` | | `0.5rem` | panel dan sheet |
| `--radius-control` | | `0.375rem` | kontrol form |
| `--toast-top` | | `96px` | posisi atas toast admin |

### Mode terang, `html.admin-shell.light`

| Token | HSL | Hex | Peran |
|---|---|---|---|
| `--background` | `210 20% 98%` | `#F9FAFB` | kanvas slate tipis |
| `--sidebar` | `210 20% 98%` | `#F9FAFB` | sidebar menyatu dengan kanvas |
| `--header-bg` | `0 0% 100%` | `#FFFFFF` | header putih murni |
| `--foreground` | `222 47% 11%` | `#0F1729` | teks obsidian slate |
| `--action-foreground` | `222 47% 11%` | `#0F1729` | teks aksi |
| `--body-foreground` | `215 16% 42%` | `#5A687C` | body slate sejuk |
| `--muted-foreground` | `215 16% 45%` | `#607085` | teks sekunder |
| `--card` | `0 0% 100%` | `#FFFFFF` | kartu putih murni |
| `--popover` | `0 0% 100%` | `#FFFFFF` | dropdown dan popover |
| `--surface` | `0 0% 100%` | `#FFFFFF` | panel konten |
| `--surface-muted` | `215 20% 95%` | `#F0F2F5` | panel sekunder |
| `--primary` | `222 47% 11%` | `#0F1729` | CTA utama, obsidian |
| `--primary-hover` | `222 47% 20%` | `#1B294B` | hover CTA utama |
| `--primary-foreground` | `210 40% 98%` | `#F8FAFC` | teks di atas CTA |
| `--secondary` | `215 20% 94%` | `#EDEFF3` | chip dan tombol sekunder |
| `--muted` | `215 20% 94%` | `#EDEFF3` | permukaan redup |
| `--accent` | `215 25% 92%` | `#E6EAF0` | permukaan terangkat |
| `--border` | `215 20% 89%` | `#DDE2E9` | garis pembatas slate |
| `--input` | `215 20% 89%` | `#DDE2E9` | garis kontrol input |
| `--ring` | `222 47% 11%` | `#0F1729` | focus ring |
| `--success` | `158 42% 32%` | `#2F745B` | status sukses |
| `--warning` | `36 75% 38%` | `#AA6F18` | status peringatan |
| `--warning-foreground` | `36 80% 26%` | `#774D0D` | teks status peringatan |
| `--destructive` | `0 84.2% 60.2%` | `#EF4444` | aksi merusak, error |
| `--sale` | `0 84.2% 60.2%` | `#EF4444` | penanda promo |
| `--info` | `207 55% 38%` | `#2C6696` | status informasi |
| `--copper` | `25 60% 38%` | `#9B5727` | aksen garansi |
| `--radius` | | `0.5rem` | panel dan sheet |
| `--radius-control` | | `0.375rem` | kontrol form |

## Perbedaan dari storefront

Tiga perbedaan ini disengaja dan bukan utang teknis.

### Radius lebih rapat

| Konteks | `--radius` | `--radius-control` |
|---|---|---|
| Storefront | `0.875rem` (14px) | `0.5rem` (8px) |
| Admin gelap | `0.5rem` (8px) | `0.375rem` (6px) |
| Admin terang | `0.5rem` (8px) | `0.375rem` (6px) |

Storefront memakai sudut lembut karena halaman jualan butuh kesan lapang dan
ramah. Admin memakai sudut lebih siku karena grid data, tabel, dan form rapat;
radius besar membuat baris tabel tampak goyah.

### Density lebih tinggi

- Root `font-size` admin `14px`, sedangkan storefront `16px`. Karena itu ukuran
  berbasis `rem` menghasilkan piksel berbeda di kedua konteks.
- `.text-xs` dikunci setara 12px literal di root 14px lewat override
  `html.admin-shell .text-xs { font-size: 0.857rem }`.
- Jarak panel admin 20 sampai 32px, jarak internal 12 sampai 20px.
- `--toast-top` admin `96px` (header 49 + breadcrumb 35 + jarak 12), bukan
  `120px` atau `156px` seperti storefront.
- Karena density berbeda, nilai posisi ditulis dalam PIXEL, bukan `rem`.

### Motion lebih rendah

- Admin memakai dial motion 2/10, storefront 4/10.
- Transisi dibatasi pada perubahan state yang perlu dijelaskan (hover, buka
  panel), tanpa entrance animation dekoratif.
- `prefers-reduced-motion` tetap dihormati.

## Hubungan dengan dokumen lain

| Berkas | Hubungan |
|---|---|
| `frontend/docs/DESIGN-SYSTEM.md` | prinsip dan token dasar. Berkas ini melengkapinya untuk konteks admin dan memuat tabel token Ink yang tidak ada di sana |
| `frontend/docs/UI-CONSISTENCY-CONTRACT.md` | gerbang visual lintas halaman. Aturan layout, label tombol, dropdown, dan toast di sana berlaku juga untuk halaman admin. Bila berbeda, kontrak konsistensi yang menang |
| `frontend/brand/BRAND-KIT.md` | peran merek dan cakupan Signal Red. Signal Red dibatasi pada storefront untuk peran primary action |
| `frontend/skills/ragil-admin-ui/SKILL.md` | kontrak operasional panel admin (header aksi, Table-First, ADR-022, larangan `bg-white` di modal, jarak form) |

## Kapan token baru boleh dibuat

Aturan lengkap ada di `frontend/docs/DESIGN-SYSTEM.md`, bagian "Kapan token baru
boleh dibuat". Ringkasnya: token baru hanya layak bila dipakai minimal di dua
tempat terpisah, punya peran semantik yang belum diwakili token lain, dan ikut
berubah saat tema berganti. Selama satu syarat belum terpenuhi, pakai token
yang sudah ada.

Secara khusus di panel admin: karena `--primary` monokrom, jangan mengarang
token baru hanya untuk mendapatkan tombol merah. Tombol destruktif memakai
`--destructive`; tombol aksi utama tetap `--primary`.
