# Log perubahan agent

Ledger tiap perubahan oleh agent. Append-only: tambahkan entri baru di BAWAH,
jangan menyunting entri lama. Tujuannya membuat pekerjaan tiap agent terlihat
oleh sesi berikutnya tanpa perlu bertanya.

Beda dengan `docs/MEMORY.md`: berkas ini mencatat SEMUA perubahan (mekanis,
ringkas, wajib tiap task). `docs/MEMORY.md` hanya keputusan dan milestone
(kurasi, tidak wajib tiap task). Kalau ragu, tulis di sini dulu.

## Format entri

    ## YYYY-MM-DD HH:MM UTC | <agent-id> | <tier> | <commit> | <status>
    Lingkup: apa yang diubah, berkas utama
    Dampak spec: tidak berubah | SPEC_CHANGED_AND_DOCS_UPDATED
    Untuk agent berikutnya: hal yang harus dijaga atau dihindari
    Bukti: perintah dan hasil nyata

- `<agent-id>`: nama sesi atau peran, misal `zcode-workflow` atau `agent-ulasan`.
- `<tier>`: Trivial | Standard | Deep sesuai anggaran di `AGENTS.md`.
- `<status>`: selesai | selesai-sebagian | diblokir.
- `<commit>`: hash pendek, atau `-` bila tidak ada commit.

Riwayat sebelum 2026-09-21 tidak diisi di sini, lihat `git log` untuk itu.
Prosedur lengkap kolaborasi: `docs/AGENT-COLLABORATION.md`.
Jalankan `bash scripts/agent-state.sh` sebelum mulai bekerja.

---

## 2026-09-20 18:38 UTC | zcode-workflow | Deep | b9f20142 | selesai
Lingkup: kontrak efisiensi agent. `docs/ORCHESTRATION.md` (tier Trivial/Standard/Deep
plus anggaran 15/60/270, aturan ssh sekali panggil, bukti visual sekali batch, aturan
sekali ditolak ganti pendekatan, aturan tool sesuai scope), `docs/decisions/ADR-002`
(amandemen tier), `AGENTS.md` (titik masuk tier di Non-negotiables),
`.compound-engineering/config.yaml` (baru, docs_root + plan_output).
Dampak spec: tidak berubah (tidak ada route, schema, enum, atau JSON).
Untuk agent berikutnya: anggaran tool berlaku per task. Skill ce-brainstorm, ce-plan,
ce-compound, ce-doc-review hanya dipanggil di tier Deep. `maxAttempts` 11 milik runtime
CLI, tidak bisa diubah dari config. Pre-push hook menjalankan build yang mengosongkan
`public/build` dan membuat situs live 500 sementara, jadi push perlu dipilih waktunya.
Bukti: `git log --oneline` tujuh commit (59020c53..b9f20142); alat ukur
`_agent-metrics/agent-metrics.sh` di workspace lokal; 3 permintaan push, 2 ditolak
karena ref branch bergerak, build pre-push lulus di semua percobaan.

## 2026-09-21 10:44 UTC | zcode-workflow | Standard | - | selesai
Lingkup: mekanisme dokumentasi lintas agent. Berkas BARU: `docs/AGENT-LOG.md`
(ledger ini), `docs/AGENT-COLLABORATION.md` (prosedur), `scripts/agent-state.sh`
(briefing pra-kerja). `AGENTS.md` mendapat bagian "Papan kolaborasi agent".
Dampak spec: tidak berubah.
Untuk agent berikutnya: jalankan `bash scripts/agent-state.sh` sebelum menyentuh
berkas. Berkas kotor ` M` milik agent lain JANGAN ditimpa; ikuti prosedur
`docs/AGENT-COLLABORATION.md`. Sertakan baris `Agent: <id>` di pesan commit karena
semua commit repo ini tercatat atas nama mesin `Ubuntu`.
Bukti: `bash scripts/agent-state.sh` mencetak berkas kotor, selisih origin, dan
entri log terakhir.

## 2026-09-21 11:02 UTC | zcode-workflow | Trivial | b102c5e3 | selesai
Lingkup: papan kolaborasi juga dipasang di sisi LOKAL `D:\website_5.0`.
`AGENTS.md` lokal (berkas yang disuntik harness ke setiap sesi workspace ini)
mendapat bagian "0. Papan kolaborasi agent", dan berkas baru
`_agent-metrics/agent-state.sh` menjadi pembungkus yang menyambung ke
`scripts/agent-state.sh` di VPS dalam SATU panggilan ssh (3,8 detik, bukan
berkali-kali).
Dampak spec: tidak berubah.
Untuk agent berikutnya: `AGENTS.md` repo VPS dan `AGENTS.md` lokal adalah DUA
berkas berbeda dengan isi berbeda. Repo VPS yang mengikat kode; versi lokal
mengikat sesi di workspace `D:\website_5.0`. Perubahan kontrak harus mendarat di
KEDUANYA, kalau tidak sesi lokal dan sesi VPS bisa memakai aturan berbeda.
Bukti: `bash _agent-metrics/agent-state.sh` dari workspace lokal mencetak
briefing lengkap dalam satu koneksi; `grep -c "Papan kolaborasi agent" AGENTS.md`
lokal = 1.

## 2026-09-21 12:05 UTC | zcode | Standard | - | selesai
Lingkup: memperbaiki penyebab halaman gagal dimuat (HTTP 500) setiap kali build
frontend berjalan di server 209. Ini bagian pertama dari diagnosa kondisi server;
kelambatan situs adalah masalah terpisah dan belum diperbaiki.
Akar masalah: perintah npm run build menulis langsung ke public/build dan mengosongkan
folder itu lebih dulu. Selama jendela build, berkas public/build/manifest.json (daftar
nama berkas hasil build yang dipakai Laravel untuk memanggil CSS dan JS) tidak ada,
sehingga setiap halaman dijawab 500 ViteManifestNotFoundException. Dua pemicunya:
scripts/prod/deploy.sh baris 78, dan .git/hooks/pre-push baris 28 (hook ini tidak
terlacak git, jadi perubahannya hanya ada di server ini).
Perubahan: berkas BARU scripts/prod/build-assets.sh. Build ditulis ke salah satu dari
dua slot di dalam public/ sehingga masih satu filesystem dengan public/build dan
pemindahannya hanya rename, bukan salin. public/build ditukar hanya setelah
manifest.json hasil build terverifikasi, jadi tidak pernah ada jendela waktu tanpa
manifest. Dua slot dipakai bergantian sehingga tidak diperlukan perintah hapus. deploy.sh
dan pre-push hook kini memanggil skrip itu. .gitignore menambah /public/build-slot-*.
Dampak spec: tidak berubah (tidak ada route, schema, enum, atau JSON).
Verifikasi: dua putaran build sambil halaman dipantau tiap 0,2 detik, hasil 45/45 dan
46/46 jawaban HTTP 200, manifest.json tidak pernah hilang, nol error Vite setelah
perbaikan, dan aset yang dirujuk halaman tersaji 200 dari build baru.
Untuk agent berikutnya: jangan memanggil npm run build langsung di repo 209, pakai
bash scripts/prod/build-assets.sh. Kalau ada sisa public/build-slot-a atau
public/build-slot-b, berarti ada run yang gagal, jalankan skrip sekali lagi untuk
membereskannya. Kelambatan situs BELUM diperbaiki: terowongan QUIC hanya mengalir 1
sampai 80 KB per detik padahal aplikasi membalas 0,24 detik. Uji berikutnya adalah
menjalankan cloudflared dengan --protocol http2.

## 2026-09-21 13:00 UTC | zcode | Standard | - | selesai (percobaan, tidak ada perubahan perilaku)
Lingkup: menguji apakah protokol terowongan Cloudflare penyebab situs lambat dimuat
(bagian kedua diagnosa kondisi server 209). Hasil: BUKAN. Tidak ada perubahan yang
dipertahankan, konfigurasi terowongan dikembalikan ke keadaan semula.
Cara uji: kontainer kedua dijalankan dengan token yang sama plus --protocol http2,
sehingga terdaftar sebagai 4 koneksi ke edge Dallas dengan protocol=http2, lalu
kontainer QUIC lama dihentikan supaya tunnel dilayani hanya oleh http2. Tidak ada
jeda mati karena kedua saluran sempat hidup bersamaan. Catatan teknis: citra
cloudflare/cloudflared default berjalan sebagai nonroot sedangkan berkas token mode
600 milik root, jadi kontainer perlu --user 0:0 (kontainer lama juga berjalan sebagai
root, itu sebabnya ia berhasil).
Hasil ukur dari komputer klien: http2 tetap liar, 18 dari 40 permintaan /up di atas
1,5 detik, rentang 0,46 sampai 17,6 detik. Baseline QUIC juga liar, 3 dari 10 di atas
1,5 detik, rentang 0,5 sampai 38,5 detik. Dari dalam server, kedua protokol sama
stabilnya sekitar 0,1 detik. Kesimpulan: protokol terowongan bukan penyebabnya.
Pembanding yang mengunci kesimpulan: dari klien yang sama pada saat yang sama,
cloudflare.com 0,35 sampai 0,49 detik, google.com 0,15 sampai 0,88 detik, github.com
0,12 sampai 0,19 detik, semuanya stabil, sedangkan situs kita 0,45 sampai 6,3 detik.
Jadi kelambatan spesifik pada jalur situs kita, bukan pada link ISP klien.
Yang sempat menyesatkan dan sudah dibersihkan: (1) Cloudflare WARP sempat dicurigai
mengacaukan pengukuran, ternyata statusnya Disconnected (manual) dan tidak diubah,
(2) satu permintaan sempat dilayani colo Marseille (MRS), itu anomali sesaat, sepuluh
sampel berikutnya konsisten Singapura dan Hong Kong, (3) IPv6 dari ISP klien gagal
total, itu cacat ISP lokal, bukan cacat situs.
Untuk agent berikutnya: semua 4 koneksi terowongan berada di edge Dallas (dfw),
sehingga permintaan dari pengunjung Asia Tenggara harus diteruskan Singapura ke Dallas
di dalam jaringan Cloudflare lalu masuk terowongan. Kandidat perbaikan berikutnya,
keduanya butuh keputusan owner: (a) arahkan DNS langsung ke origin sebagai A record
proxied dan hentikan pemakaian tunnel, karena jalur Cloudflare ke 209 lewat TCP
terukur sangat baik (RTT 1,9 ms, 0 persen paket hilang) dan ufw sudah membuka 443,
tetapi 443 belum ada yang listen di nginx dan belum ada sertifikat origin Cloudflare;
(b) pindahkan origin lebih dekat ke pengunjung, server 202 masih standby.
Verifikasi pemulihan: hanya ragil-cloudflared yang berjalan, halaman 200, health check
127.0.0.1:8200/up 200, tidak ada berkas ALERT-health, jalur websocket Reverb /app/
menjawab 101.

---

## 2026-09-21 14:40 UTC | zcode | Trivial | 70a4ce0c | selesai
Lingkup: membuang enam elemen dari halaman Performa Toko atas permintaan owner
("buang ini", dengan enam elemen ditunjuk). Berkas: `resources/js/pages/Admin/Analytics/StorePerformance.tsx`.
Yang dibuang: (1) tombol "Rincian Retur dan Pembatalan" dan (2) "Detail Rekonsiliasi"
di kartu Ringkasan Keuangan, (3) label "Periode:", (4) "Granularitas:", (5) "Detail:",
(6) toggle model grafik "Line Chart"/"Bar Chart".
Dampak spec: tidak berubah. Tidak ada route, schema, JSON, atau enum yang disentuh.
Untuk agent berikutnya: dua tombol itu duplikat dropdown Detail, dan penghapusannya
SUDAH DIBUKTIKAN tidak menghilangkan akses (dropdown tetap memuat 8 kategori termasuk
Retur & Pembatalan dan Arus Kas, dan memilihnya membuka drawer). Toggle model grafik
dibuang seluruhnya, bukan hanya tombol "Bar Chart", karena toggle dengan satu pilihan
tidak berfungsi; state `chartModel` dan prop `chartType` ikut dilepas, jadi grafik
kembali selalu garis. Kalau nanti perlu grafik batang lagi, tambahkan toggle yang
benar-benar punya dua pilihan, jangan menghidupkan satu tombol.
Bukti: `tsc --noEmit` dan `eslint --max-warnings=0` bersih (tanpa import menganggur;
`Button`, `cn`, dan `bukaKategori` masih dipakai di tempat lain). `npm run test`
21 berkas 179 test lulus. `php artisan test --filter=StorePerformance` 1 skipped 129
passed. `npm run build` sukses (StorePerformance-CUknURzc.js 70,02 kB).
Diperiksa live di browser: keenam elemen tidak ada, ketiga dropdown tetap berfungsi,
dan drawer Arus Kas terbukti masih terbuka dari dropdown Detail.

---

## 2026-09-21 16:03 UTC | zcode | Standard | b5c88a9e | selesai
Lingkup: merapikan drawer Performa Toko atas permintaan owner ("ubah text yang dipilih dan
semua yang terkait menjadi text hint hover, pastikan drawer rapi tanpa banyak penjelasan yg
membuat penuh ui"). Berkas: `resources/js/pages/Admin/Analytics/StorePerformance.tsx`.
Yang dipindah ke hover: (1) penjelasan per baris tabel, yang sebelumnya menempati satu baris
tabel tersendiri (satu sel `colspan=4`) di bawah tiap barisnya, (2) keterangan pada blok
"Catatan di Luar Kas" (blok items), (3) kotak "Sumber Data" dan kotak "Catatan Batas Data",
keduanya digabung menjadi satu penanda info di header drawer.
Yang SENGAJA tidak dipindah: angka (label, operasi, nilai, kolom perubahan) tetap terlihat
seluruhnya; kotak "Rumus" tetap tampil karena isinya rumus dan hanya satu baris; data `sub`
dan `note` di service maupun halaman tidak diubah, karena perender memang sudah menggabungkan
keduanya menjadi satu kalimat sehingga yang berubah hanya tempat menampilkannya.
Dampak spec: tidak berubah.
Untuk agent berikutnya: TIGA ANGKA kini hanya terbaca lewat hover, dan ini disengaja supaya
diketahui: `shipping_subsidy`, `refused_shipping_cost`, dan `refused_cod_fee` memang hanya
muncul di dalam kalimat penjelas, tidak punya baris sendiri. Ketiganya komponen rincian dari
angka induk yang tetap terlihat (Tagihan J&T, dan Retur Paket Ditanggung Toko) dan semuanya
ada di ekspor XLSX. Kalau ada keluhan angka "hilang", periksa tiga nama itu dulu. Aturan
umumnya: di drawer ini penjelasan boleh ke hover, angka tidak.
Bukti: `tsc --noEmit` dan `eslint --max-warnings=0` bersih. `npm run test` 21 berkas 179 test
lulus. `php artisan test --filter=StorePerformance` 1 skipped 129 passed (2090 assertions).
Build sukses lewat `scripts/prod/build-assets.sh`. Diperiksa live di browser: 0 sel `colspan=4`
di kategori Penjualan, Referensi, dan Arus Kas; kedua kotak penjelasan hilang; hover pada label
"Model Produk Terjual" memunculkan "Jenis model yang terjual, tanpa membedakan desain. Satu
model dengan dua desain tetap dihitung satu."; isi drawer Arus Kas muat tanpa gulir
(855px isi = 855px terlihat).

---

## 2026-09-22 01:45 UTC | zcode | Deep | 414f5388 | selesai
Lingkup: Batch 5 halaman Performa Toko, tiga hal yang semuanya diukur lebih dulu.
(1) Tujuh indeks baru lewat migrasi `2026_09_22_000100_add_store_performance_indexes`, diverifikasi
belum ada sebelum dibuat dan diverifikasi lewat EXPLAIN bahwa optimizer MEMILIH tiap indeks baru
untuk kuerinya. Migrasi memakai `Schema::hasIndex` sehingga aman dijalankan ulang, dijalankan
sebagai www-data forward-only.
(2) Pengaman masukan rentang. Tanggal hanya dipakai bila bentuknya persis YYYY-MM-DD; nilai seperti
"monday" atau "2026-13-45" diabaikan dan dilaporkan lewat `range.input_diabaikan`. Rentang yang
melewati hari ini dipotong ke hari ini dan dilaporkan lewat `range.rentang_dipotong`, karena
sebelumnya jendela pembandingnya menciut sampai panjang NOL detik sehingga seluruh kolom pembanding
kehilangan arti. Dipilih memotong, bukan menolak dengan galat, supaya admin tetap bisa memperbaiki
salah ketiknya sendiri.
(3) Jumlah kueri tidak lagi tumbuh sebanding jumlah pesanan. Ini akar masalah sebenarnya di balik
`period=all`: rentangnya bukan penyebabnya, melainkan kueri per pesanan. Terukur: last_30 dari 185
menjadi 139 kueri, all dari 188 menjadi 132. `statusEventsFor` dan `firstWaybillAtFor` menggantikan
`statusEventAt` yang kini kode mati dan sudah dihapus.
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED. `docs/database-schema-ragil-aluminium.md` memuat tujuh
indeks baru; `docs/sitemap/admin-sitemap.md` memuat perilaku pengaman masukan dan jaminan jumlah
kueri.
Untuk agent berikutnya: `range.input_diabaikan` dan `range.rentang_dipotong` adalah kunci payload
BARU. Jangan menyimpulkan rentang yang tampil selalu sama dengan rentang yang diminta tanpa
memeriksa kedua kunci itu. Test penjaga: `StorePerformanceInputGuardTest`, dan test jumlah kuerinya
sudah dibuktikan non vakuum (dipasang kembali kueri per pesanan, 40 pesanan menambah tepat 40 kueri,
test merah, lalu dikembalikan). Catatan fixture yang sempat menipu: periode "Hari ini" membandingkan
sampai JAM yang sama, jadi fixture pembanding yang memakai jam tetap (mis. 10:00) akan gagal bila
suite dijalankan pagi; taruh di awal hari kemarin.
Retensi BELUM mendesak dan TIDAK diputuskan sendiri: event_logs 681 baris (0,3 MB), kunjungan 22
baris dalam 4 hari, orders 20. Tabel terbesar justru jnt_address_masters 37 MB dan
postal_code_mappings 22 MB. Usulan: pangkas event_logs dan performance_visitor_events bila lewat 12
bulan, terjadwal, setelah data produksi berjalan beberapa bulan.
Bukti: 8 test baru lulus; suite performa 1 skipped 137 passed (1872 assertions); suite frontend 21
berkas 179 test lulus; tsc dan eslint bersih; build sukses lewat `scripts/prod/build-assets.sh`;
permintaan rentang masa depan diverifikasi live dipotong ke hari ini dengan pemberitahuan tampil.
