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

## 2026-09-21 22:45 UTC | zcode | Deep | - | selesai
Lingkup: relayout halaman Cek Status Pesanan sekaligus mengeksekusi temuan audit UI/UX.
Owner menilai data uji lamanya tidak menyeluruh, jadi fixture dibuat ulang lebih dulu.
(1) Fixture menyeluruh. `database/seeders/OrderStatusShowcaseSeeder.php` (BARU) membuat 19
pesanan uji `RA-UI-2209-01` sampai `-19`, satu untuk setiap keadaan yang bisa dihasilkan view
model: menunggu pembayaran, COD dikonfirmasi, menyiapkan, dalam perjalanan, sedang diantar,
menunggu penjemputan, sampai, selesai, retur diproses, retur selesai, dibatalkan, perlu
perhatian, pengiriman gagal, tiga item sekaligus, refund, dan dua keadaan Sampai TANPA catatan
resi. Lengkap dengan pengiriman, riwayat pelacakan, dan kasus retur. Idempoten, tidak menyentuh
`order_number_sequences`, dan hanya menyentuh awalan `RA-UI-2209-`.
(2) Bug badge: pesanan yang sudah Sampai tetapi belum punya catatan resi tampil "Menunggu
pembayaran" (transfer) atau "Pesanan dikonfirmasi" (COD) padahal barangnya sudah diterima,
karena `primaryStatus()` memutuskan label dari keadaan pembayaran/pengiriman lebih dulu. Status
pesanan sekarang diperiksa lebih dulu, dan badge storefront memakai label serta nada DARI VIEW
MODEL, bukan dipetakan ulang lewat `STATUS_MAP` (dulu 11 label dan 6 nada berbeda antara badge
dan teks di kartu yang sama).
(3) Bug produksi yang ditemukan dari fixture baru: `OrderTrackingPresenter::timeline()`
memanggil `merge()` milik Eloquent Collection pada item yang sudah berupa array, sehingga
muncul "Call to a member function getKey() on array" dan SELURUH halaman status pelanggan
berbalas HTTP 500 begitu pesanan punya satu saja riwayat pelacakan. Terbukti pada pesanan ASLI
`ORD26080001` (13 baris riwayat), bukan hanya data uji. Diperbaiki dengan `toBase()`.
(4) Relayout: celah kosong 405px di kolom kiri pada layar 1280px ke atas, karena grid membagi
tinggi baris dan kartu J&T (557px) jauh lebih tinggi daripada sapaan "sudah sampai" (177px).
Kolom kiri kini satu wadah yang mengalir sendiri (`contents` di mobile plus `order-*` untuk
urutan), sehingga tidak ada lagi celah yang ditentukan kartu kanan.
(5) Pemilih pesanan: `setActiveNumber` ada tetapi TIDAK ADA yang memanggilnya, jadi pelanggan
dengan lebih dari satu pesanan hanya bisa membuka yang pertama. Pemilih ditambahkan, dan
pilihannya disimpan per perangkat supaya bertahan setelah muat ulang.
(6) Tombol salin nomor pesanan: terukur 14x20px karena tidak punya `shrink-0` sehingga diperas
teks di sebelahnya. Kini 32px dengan `shrink-0` dan latar hover.
Dampak spec: tidak berubah. Tidak ada route, kolom, enum, atau bentuk JSON baru. `vm` dan
`return_block` tetap seperti sebelumnya; yang berubah hanya nilai label/nada yang sudah ada.
Untuk agent berikutnya: (a) `OrderTrackingPresenter::timeline()` WAJIB memakai `toBase()` pada
koleksi log sebelum `merge()`. (b) Badge storefront memakai `label` dan `tone` dari
`vm.primaryStatus`; jangan mengembalikannya ke pemetaan `STATUS_MAP`, karena di situlah bug
"Menunggu pembayaran" lahir. (c) Seeder `OrderStatusShowcaseSeeder` menulis ke DB LIVE dan
memengaruhi laporan: 19 pesanan uji menaikkan Penjualan Gross dari 56.053.745 menjadi
120.278.745 dan `refused_goods_value` dari 0 menjadi 2.845.000. Data uji SUDAH DIHAPUS dan
laporan sudah kembali persis ke angka semula (diverifikasi). Jalankan seeder ini hanya saat
mengaudit tampilan, lalu bersihkan dengan blok SQL di docblock seeder. (d) `dev:cleanup-dummy`
belum mengenal awalan `RA-UI`.
Bukti: suite PHP penuh 1 skipped 1113 passed (11170 assertions), TANPA kegagalan, dengan 3 test
penjaga baru di `CustomerOrderStatusContractTest` (riwayat pelacakan tidak boleh membuat halaman
gagal, pesanan Sampai tanpa catatan kurir tetap "Sampai", dan nada badge harus salah satu nada
yang dikenal). `tsc --noEmit` bersih, eslint bersih, build sukses. Audit badge atas 19 keadaan
menunjukkan 0 kunci hilang. Verifikasi live di browser: pemilih pesanan menampilkan 7 pesanan
dengan label view model, pilihan bertahan setelah muat ulang (satu chip aktif), celah 405px
hilang, dan pesanan `RA-UI-2209-18` (Sampai tanpa resi, COD) kini berbunyi "Sampai" bukan
"Menunggu pembayaran". Lima pesanan yang sebelumnya berbalas HTTP 500 (RA-UI-2209-05, -10, -11,
-17, -18) kini semua 200.

## 2026-09-21 19:12 UTC | zcode | Deep | - | selesai
Lingkup: skema retur sisi pelanggan diubah menjadi FULL MANUAL, sesuai perintah owner. Empat
bagian, semuanya diverifikasi live.
(1) Jalur admin dari Sampai ke Retur Diproses dibuka. `Admin\OrderController@returnEligibility`
dan `ReturnService::canCreateReturn` masih menghitung batas 48 jam dan status lunas, tetapi
keduanya kini mengembalikan `warnings` dan bukan penolakan; satu-satunya syarat mengikat tinggal
`order_status = delivered`. Ambang 48 jam dibaca dari `ReturnService::RETURN_WINDOW_HOURS` di
kedua sisi, jadi salinan ketiga di `Show.tsx` (`48 * 60 * 60 * 1000`) sudah dibuang.
`updateStatus` TETAP menolak `return_in_process`; pemblokiran itu sengaja dipertahankan karena
dulu dipasang untuk menutup bug yang membuat `returned_quantity` tidak tercatat sehingga laporan
uang salah. Jalur satu-satunya tetap form retur.
(2) Tampilan pelanggan saat status sudah retur dirapikan lewat `OrderTrackingViewModel`: ada
`returnFlow()` baru berisi 3 langkah (Pengembalian diterima, Sedang ditangani, Selesai) yang
MENGGANTIKAN stepper pengiriman 4 tahap, karena tahap "Selesai" tidak akan pernah tercapai pada
pesanan yang diretur. Badge retur selesai diperbaiki dari kunci `refunded` (yang membuatnya
tampil "Dikembalikan") menjadi `return_completed`. `actionRequired()` tidak lagi memunculkan
banner "pengiriman bermasalah" saat status retur. Waktu kejadian dibaca dari
`order_return_cases.created_at`/`completed_at`, bukan `orders.updated_at` yang bisa bergeser.
(3) Kartu status Sampai kini memuat tiga hal: tombol Chat WhatsApp (`whatsapp_url`), tombol Beri
Ulasan, dan tombol Pengembalian Barang gaya merah redup di bawah kartu (`return_whatsapp_url`).
Dua kunci payload itu sebelumnya dihitung backend tetapi TIDAK dirender siapa pun. Tombol
pengembalian hanya membuka chat WhatsApp dan TIDAK mengubah status pesanan. Kartu bantuan umum
("Hubungi Kami" ke `/contact`) disembunyikan untuk pesanan Sampai karena fungsinya sudah diambil
alih chat WhatsApp.
(4) Panel retur admin selalu tampil untuk pesanan Sampai, termasuk saat tidak memenuhi syarat,
karena sebelumnya panelnya disembunyikan sehingga tombol "Catat Retur" melompat ke bagian kosong
dan alasan penolakannya tidak pernah terbaca.
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED. `docs/api-and-routes-ragil-aluminium.md` memuat aturan
kelayakan baru dan pemakaian `return_block`/`return_whatsapp_url`; `docs/kebijakan-retur-draf.md`
bagian 1, 3, dan 6 direvisi. Tidak ada route, kolom, enum, atau bentuk JSON yang ditambah atau
hilang; `return_block` hanya bertambah kunci `warnings`, dan `vm` bertambah `returnFlow`.
Untuk agent berikutnya: (a) JANGAN mengaktifkan kembali `updateStatus` untuk `return_in_process`.
(b) `docs/kontrak` di workspace lokal sudah disesuaikan: item 13 di
`docs/KONTRAK/ANTREAN-PEKERJAAN.md` berstatus DIGANTIKAN (form pengajuan pelanggan dengan foto
TIDAK jadi dikerjakan), dan `docs/DOMAIN/retur-pengembalian.md` bagian 1, 2, 3, 10, 12 diubah
beserta bagian 4D yang baru. Jangan memakai item 13 sebagai rencana. (c) Tiga keputusan owner
masih terbuka dan dicatat di bagian 12 dokumen domain: retur dari pesanan Selesai, aturan refund
untuk pesanan belum lunas, dan koreksi retur yang salah dicatat. (d) Test batas 48 jam pada
halaman pelanggan WAJIB mematikan `ShippingService::refreshStatus` lewat partialMock, karena
halaman itu menyegarkan J&T saat dibuka dan menulis ulang `last_status_at` menjadi waktu sekarang
sehingga batasnya tidak pernah terlihat lewat. (e) Rumus uang TIDAK disentuh sama sekali; lihat
bukti di bawah.
Bukti: suite PHP penuh 1 skipped 1110 passed (11105 assertions), TANPA kegagalan. Suite frontend
21 berkas 179 test lulus. `tsc --noEmit` bersih, eslint bersih pada 5 berkas yang diubah, build
sukses. Test baru: 3 di `AdminReturnWorkflowTest` (lewat 48 jam tetap boleh, peringatan lunas,
waktu sampai belum tercatat) dan 4 di `OrderReturnCtaTest` (wajib Sampai, peringatan 48 jam,
`return_completed` memakai kunci sendiri, alur retur menggantikan stepper). Verifikasi live:
payload `RA-SIM-2609-02` (delivered) memberi `return_block.eligible=true` dengan
`warnings=["Waktu paket sampai belum tercatat di sistem."]`, `returnFlow` null, dan stepper tetap
4 makro; payload `RA-SIM-2609-01` setelah dipindah ke `return_in_process` memberi badge "Retur
diproses", `actionRequired` null, dan `summary.steps` berisi
`return_recorded/return_handling/return_finished`. Di browser: tombol Chat WhatsApp berdampingan
dengan Beri Ulasan di dalam kartu Sampai, tombol Pengembalian Barang tampil redup di bawah kartu
dengan tautan `wa.me` bernomor pesanan, dan saat status retur tombol itu hilang bersama kartu
ulasan. Data verifikasi sementara (satu pesanan `RA-VERIFY-SAMPAI` dan satu kasus retur) sudah
dihapus dan `RA-SIM-2609-01` dikembalikan ke `delivered`; kasus retur yang tersisa hanya kasus
lama id 1 dari 2026-08-24 pada `RA-260810-0001`. Rumus uang tidak berubah:
`StorePerformanceService.php`, `app/Exports/`, dan `IncomeDetailQuery.php` tidak disentuh sama
sekali, dan test uang tetap lulus (`StorePerformanceF10RulesTest` "r9 return and refund keep raw
rows and r10 refund cuts net", `StorePerformanceRefusedReturnTest`, `StorePerformanceTask1Test`,
`StorePerformanceRefusedCostTest`).

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

---

## 2026-09-22 15:06 UTC | zcode | Standard | 2ce2653e | selesai
Lingkup: P0.3 dari rekomendasi audit dokumentasi, yaitu menutup lubang pada penjaga
kelengkapan cakupan metrik. Berkas: `app/Services/StorePerformanceService.php`,
`resources/js/pages/Admin/Analytics/StorePerformance.tsx`,
`tests/Feature/StorePerformanceMetricBasisTest.php`.
Akar masalah: penjaga `test_setiap_kpi_punya_deklarasi_cakupan` hanya menelusuri
`sections[].kpis[]`, sehingga kunci yang hanya hidup di bagian `financial` tidak pernah
diperiksa padahal halaman membacanya. Penjaga itu sekarang memeriksa seluruh angka keluaran
`build()`, ditambah daftar putih eksplisit untuk kunci yang memang tidak perlu cakupan
sendiri (alias dan komponen), plus test baru yang gagal bila daftar putih itu menua.
TIGA metrik ternyata lolos tanpa deklarasi: `cod_pending_in_period_amount`,
`cod_pending_in_period_count` (keduanya ditemukan dari pembacaan manual), dan `buyers`
(ditemukan OTOMATIS oleh penjaga yang sudah dilebarkan, yang sekaligus membuktikan lebarnya
memang perlu). Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED untuk METRIC_BASIS, yang bertambah
tiga deklarasi.
Untuk agent berikutnya: dokumen `docs/dokumentasi-teknis-ragil-aluminium.html` masih menyebut
42 kunci cakupan dan 44 nilai terdokumentasi. Setelah commit ini jumlahnya 45 kunci dan tiga
label baru di tabel Dasar Setiap Metrik, jadi dokumen itu PERLU dibuat ulang. Jangan
menyalin angkanya dari dokumen, ambil dari `METRIC_BASIS` di kode.
Bukti: 14 test cakupan lulus; penjaga baru dibuktikan NON VAKUM dengan menghapus deklarasi
`cod_pending_in_period_amount` lalu test merah dengan pesan yang tepat, lalu dikembalikan.
Suite performa 1 skipped 138 passed. Suite penuh 1 skipped 1116 passed TANPA kegagalan
(OrderReturnCtaTest yang dulu selalu merah sudah dibereskan agen lain). tsc dan eslint bersih.

---

## 2026-09-23 17:45 UTC | zcode | Deep | 24d45b71 | selesai
Lingkup: Batch N+1 Performa Toko, empat item dari instruksi owner 2026-09-22. Berkas:
StorePerformanceService.php, StorePerformance.tsx, StorePerformanceMetricBasisTest.php,
StorePerformanceRecognitionFreezeTest.php (baru), TanamEventPengakuan.php (baru), OrderExport.php,
OrderExportContractTest.php, 11 berkas fixture test, ADR-015, api-and-routes, dokumen HTML lokal.
Item 1 (P0.4+P0.5, commit 9985fb7a): build() mengirim date_contract (zona waktu, semantik batas,
periode berjalan, pengakuan) dan metric_basis membawa unit untuk 45 metrik dari kosakata sah;
tabel Referensi menambah kolom Satuan dan blok Kontrak Tanggal. Invarian keluaran dibuktikan pada
dua rentang data live: nol angka berubah, hanya 51 kunci baru per rentang.
Item 2 (P0.2, commit 918e50f5): Pengakuan Penjualan Gross dibekukan menurut keputusan owner,
yaitu pesanan dibuat dalam periode DAN tercatat mencapai Diproses pada event_logs paling lambat
akhir periode (recognizedOrderIds, cache per jendela, reset per build). Satu himpunan dipakai
metrik penjualan, grafik, top produk, pelanggan, dan campuran pembayaran; rasio pembatalan
memakai penyebut gabungan agar tidak hitung ganda; VALID_ORDER_STATUSES dan SQL mentah
paidRevenueStatusSql dihapus. Test diskriminatif membuktikan dua arah pembekuan, dan service lama
dipasang kembali untuk membuktikan 4 dari 5 test merah.
Item 3 (P0.1, commit 021b47df): label ekspor pesanan diganti Kas Bersih per Produk / KAS BERSIH
TOKO sebagai KONSEP TERPISAH dari Penjualan Bersih; deklarasi OrderExport::EXPORT_BASIS dijaga
dua arah (penjaganya langsung menangkap kolom T yang terlewat saat pengerjaan); backlog #3 dan
#14 ditutup sebagai keputusan di docs/KONTRAK/ANTREAN-PEKERJAAN.md lokal.
Item 4: dokumen HTML lokal diregenerasi dengan stempel 021b47df, formula pengakuan, 14 anchor
keluarga penjualan, tabel payload 45 kartu + date_contract, dan catatan revisi.
TEMUAN TERPISAH (tidak diperbaiki, sesuai syarat owner): semua kueri memakai zona Asia/Jakarta
(APP_TIMEZONE) tetapi batas akhir rentang INKLUSIF akhir hari (endOfDay + whereBetween), bukan
end_exclusive. Pergeseran ke end_exclusive akan mengubah angka dan sengaja tidak dikerjakan di
dalam batch kontrak ini.
Efek samping pada data: pesanan uji di server 209 tidak punya event pengakuan sehingga laporan
periode Hari ini menunjukkan nol; periode 30 hari menunjukkan Rp 40.643.746 dari 6 pesanan yang
berevent, dan kartu-grafik tetap sinkron. Ini perilaku baru yang benar menurut formula, bukan bug.
Bukti: suite penuh 1 skipped 1125 passed TANPA kegagalan; Vitest 179 lulus; tsc bersih; eslint
tertarget bersih; push lewat hook build sukses (f933daf1..24d45b71); verifikasi live di browser:
drawer Referensi menampilkan blok Kontrak Tanggal dan kolom Satuan dengan tata letak rapi.
Untuk agent berikutnya: fixture pesanan uji yang berstatus penjualan wajib menanam event pengakuan
(gunakan trait Tests\Concerns\TanamEventPengakuan); logika perhatian dashboard membaca event
status terbaru sebagai waktu masuk status, jadi simulasi umur status harus memundurkan waktu event.

---

## 2026-09-23 19:05 UTC | zcode | Standard | 37d6610f | selesai
Lingkup: instruksi owner 2026-09-23, Frozen Contract Perhitungan v1. Berkas:
ADR-026 (baru), MASTER-ADR.md, StorePerformanceGoldenTest.php (baru),
tests/Expectations/store-performance-golden-v1.json (baru), .github/PULL_REQUEST_TEMPLATE.md
(baru), header FROZEN pada StorePerformanceService.php dan OrderExport.php.
Isi: delapan lapis perhitungan dibekukan versi 1.0.0 (batas rentang, deklarasi metrik,
pengakuan, rantai uang inti, pembayaran dan kas, retur dan pembatalan, permukaan turunan,
permukaan ekspor). IncomeDetailQuery di luar beku (konsep terpisah hasil backlog #3);
end_exclusive ditunda batch tersendiri menunggu keputusan owner soal restatement, sesuai
instruksi owner. Golden test: dataset deterministik (semua kelas kejadian penentu angka,
setTestNow 2026-09-30 10:00, periode Agustus 2026), seluruh keluaran build() dibekukan pada
berkas expectation; angka diverifikasi manual (Gross 4.950.000, Net 4.030.000, Pembayaran
Diterima 3.500.000, pesanan diakui 5 dari 9, rasio pembatalan 16,67). Disiplin perubahan:
GOLDEN_UPDATE=1, expectation di PR yang sama, naik versi kontrak di ADR-026 dan komentar
FROZEN; gerbang juga dipasang di template PR (berkas .github baru).
Bukti: golden test 4 passed; sabotase satu angka expectation membuktikan test merah dengan
pesan jalur (.financial.net_revenue 4030001 menjadi 4030000) lalu dipulihkan; suite penuh
1 skipped 1129 passed TANPA kegagalan; push lewat hook build sukses (0a19b0d5..37d6610f).
Untuk agent berikutnya: menyentuh StorePerformanceService.php atau OrderExport.php tanpa
memperbarui expectation = PR ditolak gerbang; versi kontrak disamakan di tiga tempat
(ADR-026, berkas expectation, komentar FROZEN).

---

## 2026-09-23 21:10 UTC | zcode | Deep UI | 850db814 | selesai
Lingkup: instruksi owner 2026-09-23, perapian UI Performa Toko dengan renderer pasif.
Berkas: StorePerformance.tsx, lib/format.ts, components/admin/ui/hint-tip.tsx (baru),
tests/frontend/renderer-pasif.test.ts (baru), tests/frontend/store-performance-dom.test.ts (baru).
Perubahan: halaman jadi renderer pasif. Tujuh hitungan frontend dihapus: potongan retur
gabungan di panel dan di drawer, selisih durasi, rasio porsi penjualan pada payment_mix,
rasio klik-lihat, dua total reduce pada modal produk terlaris, dan pembagian transfer-COD.
Label, nilai, hint, satuan, dan delta kartu kini murni dari payload tanpa fallback tetap;
formatter visual terpusat di lib/format.ts; HintTip satu komponen (hover, fokus, ketukan,
Esc, fokus tetap); data-metric-key pada kartu, kotak keuangan, grafik, baris drawer, dan
referensi; panel Ringkasan Keuangan jadi tiga angka plus tombol Detail perhitungan; banner
periode membawa hint Kontrak Tanggal dari payload. Golden expectation TIDAK berubah.
Bukti: golden 4 passed tanpa perubahan expectation; suite PHP penuh 1 skipped 1129 passed;
Vitest 23 berkas 189 test lulus termasuk 4 test guard pasif dan 8 test DOM dari fixture;
tsc dan eslint bersih; push hook build sukses (c585544c..850db814); live: angka identik
dengan sebelumnya, panel tiga angka plus Detail perhitungan tampil, keyboard terverifikasi
(urutan fokus filter ke kartu ke hint, Enter membuka hint dari payload, Esc menutup, fokus
tetap). Screenshot sebelum/sesudah tema gelap tersimpan di artefak sesi.
Untuk agent berikutnya: dilarang menambah hitungan bisnis di StorePerformance.tsx, guard
renderer-pasif.test.ts akan merah; label fallback tetap juga dilarang oleh guard yang sama.

---

## 2026-09-24 10:50 UTC | zcode | Deep UI | 746da576 | selesai
Lingkup: instruksi owner 2026-09-24, pemetaan scope metrik drawer Performa Toko. Berkas:
StorePerformance.tsx, tests/frontend/scope-mapping.test.ts (baru), scope-dom.test.ts (baru).
Fondasi: helper scopeMetrik, displayComparison, kelompokMetrik membaca metric_basis sebagai
satu-satunya sumber scope; kpiRow menolak delta untuk scope current. Drawer dipecah: Arus Kas
menjadi D. Kas Periode Terpilih dan E. Posisi Kas Saat Ini (bauran F, ongkir retur G);
Operasional Antrean Saat Ini vs Metrik Periode Terpilih vs Kondisi Saat Ini; Retur memisahkan
Retur Aktif Saat Ini dari Retur dan Pembatalan Periode Terpilih; Referensi menambah kolom
Perbandingan (Periode sebelumnya / Tidak dibandingkan) dari scope. Semua baris manual drawer
kini membawa data-metric-key, termasuk baris baru jumlah pesanan belum masuk pada kedua
cakupan supaya mapping satu-ke-satu.
Golden expectation TIDAK berubah; tidak ada formula, angka, atau kunci kontrak yang tersentuh.
Bukti: mapping 7 passed; DOM 4 passed; Vitest penuh 25 berkas 202 test; tsc, lint bersih;
golden 4 passed tanpa perubahan; suite PHP penuh 1 skipped 1129 passed; push hook build sukses
(89f43f1e..746da576); live: drawer Arus Kas dan Operasional menunjukkan pemisahan, blok
snapshot tanpa kolom perubahan berisi, screenshot dark dan light tersimpan di artefak sesi.
Untuk agent berikutnya: helper scope (scopeMetrik/displayComparison/kelompokMetrik) adalah
satu-satunya jalur menentukan penyajian perbandingan; dilarang menyimpulkan scope dari nilai
atau label; metrik baru wajib masuk kelompok drawer yang sesuai scope-nya atau test mapping
merah.

---

## 2026-09-24 12:20 UTC | zcode | Deep UI | 97b7501e | selesai
Lingkup: instruksi owner 2026-09-24, perbaikan presentation drawer Performa Toko.
Berkas: StorePerformance.tsx saja (renderer CategoryDetailPanel). Kontrak data TIDAK
berubah: golden expectation utuh, tidak ada formula/angka/payload/metric_basis yang
tersentuh, UI tetap renderer pasif.
Perubahan presentation: baris rows drawer kini kartu metrik (label, nilai besar,
keterangan, delta dari payload dengan pembandingnya); tanda operasi (±) turun ke
keterangan kartu, bukan lagi kolom utama; formula pindah dari blok paling atas ke
bagian lipat Dasar perhitungan di bawah (tetap dapat diakses untuk audit); mode
tabel kompak dipertahankan khusus kategori teknis Referensi (Kontrak Tanggal,
Rentang Laporan) dan tabel Dasar Setiap Metrik; hint konversi menjelaskan bahwa
angkanya persentase pembeli unik dibanding pengunjung unik, bukan jumlah orang.
Pola dibuktikan dulu di satu drawer (Penjualan) lewat screenshot before/after, baru
disebar; semua drawer memakai renderer sama sehingga ikut berubah.
Bukti: screenshot before (drawer Penjualan tabel rumus, artefak sesi) vs after
(Penjualan kartu, Dasar perhitungan terbuka, Retur kartu per kelompok, Referensi
tabel teknis, Arus Kas kartu); Vitest 25 berkas 202 test lulus tanpa penyesuaian
(asersi berbasis teks bukan struktur); tsc dan lint bersih; golden 4 passed tanpa
perubahan expectation; suite PHP penuh 1 skipped 1129 passed; push hook build
sukses dua kali (591f5bdf..cfdaf8fc..97b7501e); live: interaksi drawer, kategori,
Esc, dan hint terverifikasi.
Untuk agent berikutnya: renderer rows punya dua mode, kartu (default) dan tabel
(mode: tabel untuk Referensi); jangan memunculkan kembali kolom ± sebagai struktur
utama atau formula di puncak drawer; formula hidup di DasarPerhitungan yang terlipat.

---

## 2026-09-24 13:10 UTC | zcode | Standard | 6f2c3e6e | selesai
Lingkup: pembeda visual metrik periode vs snapshot di kartu drawer, atas umpan balik
owner bahwa pemisahan belum terlihat. Berkas: StorePerformance.tsx, scope-dom.test.ts.
Perubahan: setiap kartu drawer membawa badge cakupan di bawah labelnya, sumbernya
metric_basis payload melalui anotasi scope yang dianotasi SATU tempat pada
buildCategoryDetail (DetailRow mendapat field scope dan marker). Badge periode abu
Periode terpilih, badge snapshot amber memakai marker payload (kondisi saat ini atau
semua waktu). Test DOM baru menegaskan badge kedua cakupan dan snapshot tetap tanpa
delta. Golden expectation utuh; tidak ada angka atau kontrak yang berubah.
Bukti: Vitest 25 berkas 203 test lulus; tsc dan lint bersih; golden 4 passed; push
hook build sukses (8ef4af9c..6f2c3e6e); live diverifikasi: badge terlihat di drawer
Arus Kas dengan dua gaya berbeda, screenshot di artefak sesi.

---

## 2026-09-23 16:30 UTC | zcode-admin-audit | Deep | c20b06b7 | selesai
Lingkup: audit konsistensi UI, komponen, dan flow panel admin, lalu perbaikan P1
atas instruksi owner. Audit read-only; perbaikan dikerjakan sesudah audit selesai.

Audit: 31 menu sidebar dijelajahi lewat klik nyata (bukan slug), 0 error konsol,
semua URL dan menu aktif benar. 290 nama route diuji terhadap resolver breadcrumb
dan ditemukan 2 route menyimpang. 6 form tambah diuji sampai submit kosong.
7 modul add/edit dibandingkan. Luaran: docs/AUDIT-ADMIN (laporan konsistensi,
telaah P0 kategori, coverage matrix, 26 tangkapan layar, skrip analisis).

Temuan P0: (1) kolom "Produk Terkait" di halaman Kategori selalu 0, karena
Category::products() membaca products.category_id yang tidak pernah ditulis
sejak keputusan owner 2026-09-03 memensiunkan ID kategori Shopee; akibat
lanjutannya penjaga hapus kategori ikut buta sehingga kategori berisi 120 produk
bisa terhapus. Telaah dampak ubah versus tetap ada di TELAAH-P0-KATEGORI.md,
menunggu keputusan owner. (2) tombol Panduan menutupi tombol aksi header.

Perbaikan P1 di commit ini: label validasi Indonesia untuk 208 field admin plus
label khusus form untuk name dan code yang bertabrakan dengan checkout; tombol
Panduan dipindah ke arus tata letak; baris tab status pesanan membungkus alih-alih
menggulir tersembunyi; dua nama route di ProductMediaController diberi awalan
admin. sehingga halaman detail media yang 500 kembali normal.

Bukti: php artisan test 1 skipped 1129 passed 0 gagal; tsc bersih; build sukses;
live diverifikasi dengan akun admin untuk keempat perbaikan (media attach 200,
label validasi berbahasa Indonesia, nol tabrakan Panduan di 24 halaman kali dua
lebar layar, 10 tab pesanan muat penuh).

Untuk agent berikutnya: (a) skrip penyisip label sempat membuat validate() dengan
4 argumen dan argumen keempat diabaikan PHP tanpa error, jadi label tampak tidak
bekerja; hitung ulang jumlah argumen setiap kali menyisipkan, jangan diasumsikan.
(b) build frontend di repo ini dijalankan sebagai root karena node_modules/.vite-temp
dan public/build dimiliki root; menjalankannya sebagai www-data gagal EACCES.
(c) satu perubahan belum commit milik agent lain pada tautan Kembali di
admin-layout.tsx (mb-1 menjadi mb-5px) sengaja TIDAK ikut di-commit dan tetap ada
di working tree untuk pemiliknya.

---

## 2026-09-24 00:35 UTC | zcode-admin-audit | Deep | bb3b10b6 | selesai
Lingkup: eksekusi Opsi B telaah P0 kategori atas keputusan owner, plus tugas
terpisah untuk audit alias. Sumber kebenaran kategori dipindah ke
products.product_category yang dicocokkan ke categories.code; kolom warisan
category_id ditandai dan tidak dipakai apa pun.

Perubahan: Category::products() mencocokkan product_category ke code; penjaga
hapus kategori kini bekerja (sebelumnya selalu lolos); penjaga baru mengunci
kode kategori bila sudah dipakai produk (dibaca dari permintaan agar berdiri
sendiri, tidak bergantung pada refactor agent lain yang belum commit); jalur
tulis produk menolak kode warisan WINDOW/DOOR/BOUVEN; scopeCategory mati
dihapus; docs skema menandai category_id warisan; test baru
CategoryProductRelationTest 9 kasus; dokumen tugas terpisah
docs/audit-admin/audit-alias-kategori.md.

Bukti: php artisan test 1 skipped 1138 passed 0 gagal (9 test baru termasuk);
typecheck dan build sukses; live diverifikasi: angka Produk Terkait di halaman
Kategori admin Jendela 120, Pintu 1, Boven 62 (sebelumnya semuanya 0); form
edit kategori menampilkan kolom kode terkunci dengan petunjuk jumlah produk;
katalog publik /, /products/jendela, /products/pintu, /products/boven tetap 200.

Untuk agent berikutnya: (a) tugas audit alias kategori warisan didokumentasikan
lengkap di docs/audit-admin/audit-alias-kategori.md, termasuk 74 berkas fixture
test yang memakai kode warisan dan keputusan URL English; jangan hapus peta
alias sebelum fixture dimigrasi. (b) dua berkas tetap membawa perubahan saya
yang TIDAK ikut di-commit karena bergantung pada refactor agent lain yang
belum commit: CategoryController.php (penjaga kode sudah dipindah ke versi
mandiri dan ikut di-commit) dan Categories/Form.tsx (petunjuk kolom kode
terkunci), serta HomepagePopularTest.php (satu payload form milik test baru
agent lain).

---

## 2026-09-24 01:05 UTC | zcode-admin-audit | Trivial | d1cee145 | selesai
Tindak lanjut laporan owner: setelah perbaikan Panduan, tombol itu bergeser ke
kiri dan terlihat aneh. Penyebab: baris breadcrumb ditaruh di dalam kolom judul,
jadi ml-auto mendorong Panduan mengikuti lebar kolom kiri, bukan ke sudut kanan
halaman. Perbaikan: baris breadcrumb dan Panduan dipindah jadi baris penuh di
atas baris judul, sehingga Panduan kembali ke sudut kanan atas dan tetap tidak
mungkin menimpa tombol aksi.

Bukti: diukur di 8 halaman layar 1440px dan 3 halaman layar 1280px, tepi kanan
tombol konsisten di 1237-1412px (mengikuti padding halaman dan scrollbar), nol
tabrakan, tombol Batal/Urutkan/Simpan/Tambah bisa diklik, diverifikasi visual di
halaman yang dulu paling parah. typecheck bersih, build sukses.

Untuk agent berikutnya: kalau mengubah struktur header admin-layout, ukur posisi
dan tabrakan tombol aksi di halaman yang aksinya panjang (Beranda, Halaman CMS,
Pengaturan Sistem), bukan hanya memeriksa tidak ada error.

---

## 2026-09-24 02:20 UTC | zcode-admin-audit | Deep | 593f8041 | selesai
Lingkup: satu eksekusi terintegrasi menutup seluruh temuan terbuka dua audit
plus telaah P0, sesuai keputusan default B1-B13 dari owner. Empat subagent
paralel (backend/data, sapuan frontend, Hub+Dashboard, struktur/flow) ditambah
perbaikan residual manual.

Hasil: dari 30 temuan awal (5 selesai sebelum task), 23 terbuka ditangani:
14 resolved di commit 130ef214, 8 resolved di working tree tertahan koordinasi
commit (39 berkas tumpang tindih dengan pekerjaan belum commit agent lain,
sengaja tidak di-commit agar tidak mencuri kredit/perubahan mereka), 6
intentional sesuai B3/B4/B5/B8/B12, 3 deferred dengan alasan, 1 blocked
(notifikasi id 8 tidak punya UI hapus; tidak diubah via SQL sesuai stop
condition). Em dash data cms_pages id 12 dibersihkan lewat UI admin
(/admin/cara-pemesanan), terverifikasi INSTR=0 dan halaman publik benar.

Verifikasi: suite PHP 1 skipped 1147 passed 0 gagal; vitest 25 berkas 203 test;
typecheck bersih; build sukses; pre-push hook lolos; browser live dari menu:
breadcrumb Subsidi Ongkir benar, Panduan kosong tersembunyi, per_page Notifikasi
berfungsi (combobox kustom, bukan select native), toko 200. Data produksi nol
mutasi selain satu konten via UI.

Commit: 130ef214 (fitur, 24 berkas bersih), 593f8041 (laporan). Laporan akhir:
docs/audit-admin/LAPORAN-EKSEKUSI-TUNGGAL.md (status per temuan, intentional/
deferred/blocked, sisa keputusan owner).

Untuk agent berikutnya: (1) 39 berkas working tree memuat perubahan grup C/B1
yang live dan terverifikasi tapi belum di-commit; koordinasikan dengan pemilik
baseline sebelum commit, jangan commit utuh. (2) Kontrol ukuran halaman admin
adalah combobox kustom Select (tombol + popover role=option), bukan select
native; uji lewat role=option bukan query select. (3) Notifikasi id 8 butuh
keputusan owner (UI hapus vs penanganan SQL sekali).

---

## 2026-09-24 03:40 UTC | zcode-admin-audit | Deep | f622437a | selesai
Lingkup: eksekusi semua sisa keputusan owner setelah laporan eksekusi tunggal.
Tiga pekerjaan: (1) commit 13c9fae2 mengunci 39 berkas tumpang tindih yang
sebelumnya sengaja ditunda; (2) Grup D: manajemen notifikasi; (3) Grup E:
hapus total alias kategori warisan plus ErrorState tiga halaman.

Grup D: route notifications.destroy dan notifications.prune (retensi
NOTIFICATION_RETENTION_DAYS default 90 hari, dibaca dari config/operations),
UI hapus per baris dengan ConfirmAction dan tombol Bersihkan lama, activity
log notification.deleted/notification.pruned, test NotificationManageTest
5 kasus, dokumen route kanonik diperbarui. Baris id 8 ber-em dash dihapus
LEWAT UI baru ini (bukan SQL), terverifikasi DB 0 em dash dan jejak log.

Grup E: 76 berkas fixture test dimigrasi ke kode kanonik (134 kemunculan +
suntingan manual slug/asersi); peta alias dihapus dari CategoryUrl dan
CatalogLabels serta 13 pemanggil dikonversi; URL English lama tetap 301
lewat LEGACY_URL_REDIRECT; ErrorState dipasang di Products, Customers,
Imports. Dua cacat laten tersingkap dan diperbaiki: label slide promo
salah untuk kode kanonik, satu slug test terlewat.

Bukti: suite PHP penuh 1 skipped 1152 passed 0 gagal; vitest 25 berkas 203
test; typecheck bersih; build sukses; pre-push hook lolos (cc94c629..
f622437a); smoke HTTP katalog 200 dan redirect English 301; data produksi:
31 notifikasi (id 8 terhapus via UI), 0 em dash tersisa, 183 produk dan
20 pesanan utuh.

Untuk agent berikutnya: (1) fixture test kini 100 persen kode kanonik,
WINDOW/DOOR/BOUVEN tidak boleh dipakai lagi di test baru; (2) sisa alias
runtime yang sengaja tidak disentuh tercatat di laporan eksekusi (sinonim
pencarian CatalogSearch, parsing Shopee, cabang BOUVEN mati di
HomepagePromotions); (3) routes/web.php masih memuat penghapusan menu CTA
milik agent lain yang sengaja tidak di-commit.

## 2026-09-24, hermes-desktop-ragil: hapus halaman attach media + route yatim

Keputusan owner 2026-09-24: halaman detail media `/admin/media/{asset}/attach`
tidak diperlukan, dibersihkan route dan UI-nya sekalian dengan route yatim
`media.assets.destroy` yang tersisa dari audit. Commit `badae4db` (push
`60a94a9f..badae4db`, pre-push lolos): GET `admin.media.attach.show`
(`attachPage`), DELETE `admin.media.assets.destroy` (`destroyAsset`), properti
`attach_url` di daftar Media Library, tautan Detail per aset, dan berkas
`Admin/Media/Attach.tsx` dihapus. POST `admin.media.attach` (`bulkAttach`)
dipertahankan karena masih dipakai dialog Pasang ke produk di Media Library dan
dialog di Ulasan. ziggy.js diregenerasi (sekalian mensinkronkan 25 route yang
sudah ter-commit sebelumnya namun belum masuk berkas hasil generate).

Bukti: 27 test media/guard lulus; typecheck 0 error; build sukses dua kali
(mandiri + pre-push); route:list tidak lagi memuat kedua route; sisa referensi
nol di app/routes/resources. Commit per-hunk: penghapusan menu CTA milik agent
lain di routes/web.php sengaja dibiarkan di working tree.

Untuk agent berikutnya: pemakaian aset media kini hanya terlihat dari angka
"Dipakai Nx" di Media Library; hapus permanen aset lewat UI tidak ada lagi,
sisa jalur lifecycle adalah arsip/restore.

## 2026-09-24, hermes-desktop-ragil: mode pilih media + pratinjau klik kartu

Keputusan owner 2026-09-24 via komentar di preview pane Media Library:
pemilihan massal default tidak aktif, klik gambar membuka pratinjau.
Commit `a6fd69c1` (push `e1bc6e43..a6fd69c1`): klik kartu kini membuka
overlay pratinjau (gambar public URL atau pemutar video, tutup via Esc/klik
luar/tombol X); checkbox per kartu dan bilah "Pilih semua di halaman ini"
hanya muncul saat mode "Pilih Media" dinyalakan dari tombol header
(AdminLayout actions); keluar mode mengosongkan pilihan; role kartu adaptif
button/checkbox.

Bukti: typecheck 0 error; eslint 3 warning pre-existing (dibuktikan dengan
stash); build sukses; MediaAssetWorkflowTest 3 lulus.

## 2026-09-24, hermes-desktop-ragil: logika tombol mode pilih media

Koreksi owner: ikon mengikuti logika tombol, bukan statis. Commit `11c1050f`
(push `57cffb62..11c1050f`): mode aktif = ikon centang berlabel Selesai,
mode nonaktif = ikon kotak seleksi berlabel Pilih Media.

Bukti: typecheck 0 error, build sukses.

## 2026-09-24, hermes-desktop-ragil: searchbar khusus folder di Media Library

Keputusan owner (Comment 3 di preview pane Media Library):
Tambahkan searchbar khusus folder dengan cara kerja sama seperti media picker.

Commit `833b67b7` (push `b6dc18a2..833b67b7`):
- Menambahkan searchbar folder di sidebar Media Library di bawah header Folder.
- Pencarian mencocokkan path lengkap folder (nama folder induk dan anak).
- Tampilan hasil pencarian menampilkan nama folder, breadcrumb path induk, dan
  jumlah aset total subtree (identik dengan implementasi MediaPicker).
- Enter memilih hasil pertama, Escape / klik tombol X membersihkan pencarian.
- Menu aksi 3-titik (buat subfolder, ganti nama, arsipkan, hapus) tetap dapat
  diakses dari setiap baris hasil pencarian.
- Navigasi mulus: klik folder memfilter galeri aset; membersihkan query
  mengembalikan ke tampilan pohon dengan folder aktif tetap terpilih dan induknya
  terbentang otomatis (auto-expanded).

Bukti: typecheck 0 error, build sukses, MediaAssetWorkflowTest 3 passed.

## 2026-09-24, hermes-desktop-ragil: login admin jadi username-only + bersihkan akun

Perintah owner: hapus semua akun login kecuali Febrian, buat login benar-benar
hanya dengan username (termasuk pembuatan akun), bersihkan dengan rapi.

Commit `b6dc18a2` (push `90a8e8a8..b6dc18a2`):
- LoginController hanya menerima username. Percabangan email sebagai kredensial
  dihapus total, termasuk pesan error email dipakai beberapa akun.
- resources/js/pages/Auth/Login.tsx: label dan placeholder jadi Username.
- UserFactory tidak lagi mengisi email (test tidak butuh).
- Test yang login diperbarui: AdminLoginTest, Fase13LoginSecurityTest,
  ActivityLogAdminTest.

Commit lanjutan (2 berkas):
- app/Models/User.php: 'email' dibuang dari daftar `$fillable`. Kolom tetap ada
  di DB (nullable) tapi tidak bisa lagi diisi diam-diam lewat mass assignment.
- app/Console/Commands/CleanupDummyData.php: target akun dev diubah dari
  email ke username. Versi lama menyertakan febrian@333labs.tech sebagai
  akun dev, padahal itu akun owner.

Data produksi (lewat UserController::deactivate() agar tercatat di log aktivitas):
- 7 akun dinonaktifkan lebih dulu, lalu dihapus permanen.
- Akun 21 (owner), 22 (agent-ops), 24 (budi) dihapus permanen.
- stock_movements.changed_by_user_id dan product_price_logs.changed_by_user_id
  yang ber-FK NO ACTION dinolkan manual sebelum hapus (2 + 0 baris).
- 113 sesi milik akun yang sudah dihapus dibersihkan dari tabel sessions
  (driver database). Sesi febrian (18 baris) tidak disentuh.
- Akun verifikasi sementara (id 46) ikut dihapus setelah dipakai membuktikan
  login username berhasil secara live.

JEJAK DATA AKUN 22 SEBELUM DIHAPUS (dicek dulu, tidak ada yang live):
- 31 baris event_logs, 20 di antaranya auth.login.
- 2 promosi (status ended), 2 promotion_items, 7 product_media untuk produk 156.
- Produk 156 sendiri berstatus archived, bukan published.
- FK semua kolom ini delete_rule=SET NULL, jadi riwayatnya tetap ada dengan
  kolom-panel emptiness (created_by_user_id kosong), tidak ikut terhapus.

Bukti:
- Tabel users akhir: 1 baris, id 13 username febrian status active role admin.
- Verifikasi live (browser, 2026-09-24): halaman login hanya menampilkan
  Username*, tidak ada teks Email sama sekali. Login dengan
  febrian@333labs.tech ditolak Username/Password Salah. Login dengan
  username verif.sementara berhasil masuk ke /admin.
- AdminLoginTest 4 lulus (17 assertion).
- Suite penuh: 1 skipped, 1152 passed (11763 assertion).
- typecheck 0 error; build sukses; eslint 0 masalah di berkas yang diubah
  (19 error pre-existing di resources/js/pages/Public/* sudah ada sebelumnya).

Catatan: pemangkasan sesi tamu (user_id null) dilewati karena kolom
last_activity di tabel sessions bertipe integer Unix, bukan datetime, dan
pembersihan itu di luar lingkup perintah owner.
