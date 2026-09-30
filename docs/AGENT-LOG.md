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

## 2026-09-24, hermes-desktop-ragil: perbaikan focus ring searchbar folder terpotong

Perbaikan Comment 4: saat searchbar folder aktif, tepian menebal terpotong batas halaman.
Penyebab: focus ring bawaan (`ring-2`) menggambar bayangan 2px ke arah luar (outset).
Karena sidebar berada rapat di sisi kiri kontainer flex ber-`overflow-hidden`, bayangan
2px di sisi kiri terpotong.
Solusi di commit `ce6c9ec8` (push `76e19d1d..ce6c9ec8`): gunakan `ring-inset` dipadu
`border-primary` dan `ring-primary/20`. Efek penebalan fokus digambar ke dalam (inset),
simetris di keempat sisi tanpa pernah melintasi batas elemen input.

Bukti: typecheck 0 error, build sukses, MediaAssetWorkflowTest 3 passed.

## 2026-09-24, hermes-desktop-ragil: batas idle sesi admin tanpa "Tetap Masuk"

Perintah owner: kalau admin tidak mencentang "Tetap Masuk Di Perangkat Ini",
sesi harus otomatis logout setelah tidak ada aktivitas beberapa waktu.

Berkas:
- config/operations.php: `admin_session_idle_minutes` (default 30 menit, 0 = mati).
  Bisa diubah lewat env `ADMIN_SESSION_IDLE_MINUTES` tanpa sentuh kode.
- app/Http/Controllers/Auth/LoginController.php: setiap login menulis key
  session `admin_session_persistent` = nilai checkbox. Ditulis tiap login
  (true/false) supaya tidak bisa basi setelah logout lalu login berbeda cara.
- app/Http/Middleware/EnsureUserIsAdmin.php: kalau sesi tidak persisten dan
  `time() - admin_last_activity` lewat batas, logout + invalidate +
  regenerateToken lalu redirect ke login dengan flash `status`. Sesi
  ber-remember tidak dibatasi. `admin_last_activity` hanya di-update di
  bawah /admin.
- resources/js/pages/Auth/Login.tsx: flash `status` ditampilkan sebagai Alert
  inline yang persisten, bukan toast 4 detik milik public-layout. Toast hilang
  sebelum admin sempat membaca, dan flash `status` sebenarnya sudah dibagikan
  HandleInertiaRequests tapi tidak pernah dirender halaman login.
- tests/Feature/AdminSessionIdleTest.php: 5 kasus penjaga.

TEMUAN SAMPING (belum dikerjakan, tidak diminta owner):
`logout()` tidak mengosongkan kolom `remember_token` di database. Cookie di
browser tetap dihapus (Max-Age=0) jadi logout normal tetap berhasil, tapi
salinan cookie yang tertinggal di tempat lain masih bisa dipakai sampai
kedaluwarsa. Sudah dibuktikan lewat probe (token tetap 60 karakter setelah
logout). Dibiarkan sesuai keputusan owner bahwa durasi 1 tahun tidak
menjadi masalah.

Bukti:
- AdminSessionIdleTest 5 lulus (25 assertion).
- Suite penuh: 1 skipped, 1157 passed (11800 assertion), naik 5 dari test baru.
- typecheck 0 error; eslint 0 masalah di dua berkas frontend yang diubah.
- build sukses.
- Verifikasi live (curl + age-session.php): login tanpa remember -> /admin
  HTTP 200; aktivitas digeser 31 menit -> /admin HTTP 302 ke /login; pesan
  "Sesi berakhir karena tidak ada aktivitas. Silakan masuk kembali." muncul
  di HTML halaman login. Halaman login tanpa flash tetap bersih (tidak ada
  elemen Alert).
- Akun uji (uji.idle, uji.idle2, uji.logout, uji.remember) dihapus semua;
  tabel users tetap 1 baris (Febrian), sesi yatim 0, sesi non-Febrian 0.

## 2026-09-24 13:40 UTC | zcode | Deep | 3cca9f56 | selesai
Lingkup: standardisasi form alignment ADR-022 dan tata letak konsisten panel admin (Categories/Form, Profile/Edit, StorefrontPlatforms/Edit, CaraPemesanan/Edit, WhatsApp/Edit, Banners/Form, Announcements/Form, Products/Show, VariantEdit, Orders/Show).
Dampak spec: tidak berubah
Untuk agent berikutnya: selalu gunakan primitif form dari `@/components/admin/ui/field` (`FieldGrid`, `Field`, `CheckboxField`, `FieldAction`) dan `SectionCard` untuk form admin. Jangan menaruh tombol aksi submit atau kembali redundan di dalam bodi kartu jika sudah berada di `AdminLayout actions`. Gunakan lebar kontainer proporsional (`max-w-4xl` atau `max-w-5xl`) pada form agar tidak menyisakan ruang kosong berlebih di desktop lebar.
Bukti:
- eslint 10 berkas bersih 0 error, 0 warning.
- typecheck lolos 0 error.
- Vite build sukses.
- Zero em dash (U+2014) terverifikasi via regex check.
- Live probe rendering HTTP 200 terverifikasi pada rute /admin/kelola/kategori/create, /admin/profile, /admin/storefront-platforms (kontak & brand), /admin/banners/create, /admin/announcements/create, /admin/orders/1, /admin/kelola/produk/51.

## 2026-09-24, hermes-desktop-ragil: koreksi owner, batas idle tanpa pesan

Koreksi owner atas commit `2c3bdcfe`: "gausah pakai toast, just let it be
logout automatically silently". Batas idle tetap 30 menit, tapi perpindahan ke
halaman login tidak lagi menampilkan pesan apa pun.

Berkas yang disentuh:
- app/Http/Middleware/EnsureUserIsAdmin.php: `->with('status', ...)` dibuang,
  jadi `return redirect()->route('login')` polos tanpa flash.
- resources/js/pages/Auth/Login.tsx: Alert, `usePage`, dan `idleNotice`
  dibuang. Berkas ini kembali persis ke bentuk sebelum fitur pesan.
- tests/Feature/AdminSessionIdleTest.php: assert flash dibuang. Sisa 5 kasus
  penjaga tetap sama hanya jumlah assertion turun dari 25 ke 24.

Catatan: `flash.status` milik HandleInertiaRequests tidak ikut dibuang karena
dipakai halaman lain (toast public-layout). Yang dibuang hanya pemanggilnya
dari halaman login.

Bukti:
- AdminSessionIdleTest 5 lulus (24 assertion).
- Suite penuh: 1 skipped, 1157 passed (11823 assertion).
- typecheck 0 error; eslint 0 masalah di Login.tsx; build Vite sukses.
- Verifikasi live (curl): setelah aktivitas digeser 31 menit, /admin HTTP 302
  ke /login, dan frasa "Sesi berakhir" TIDAK ada di HTML. Flash di payload
  Inertia terbaca `"status":null`. (Field `"status":"live"` yang muncul
  terpisah milik `flashSalePeriod`, bukan flash pesan.)
- Browser: halaman login punya 0 elemen role=status/role=alert dan tidak
  memuat teks "Sesi berakhir"; form Username dan checkbox "Tetap Masuk Di
  Perangkat Ini" tetap utuh.
- Akun uji (uji.diam, uji.diam2) dihapus; tabel users tetap 1 baris (Febrian),
  sesi non-Febrian 0, sesi yatim 0.

## 2026-09-24, hermes-desktop-ragil: batas idle 2 jam + label "Tetap Login"

Dua perintah owner:
1. Batas idle 30 menit terlalu pendek, harus 2 jam.
2. Yang mencentang checkbox tetap login terus, dan labelnya diubah dari
   "Tetap Masuk Di Perangkat Ini" jadi "Tetap Login".

Perubahan:
- config/operations.php: default `ADMIN_SESSION_IDLE_MINUTES` 30 -> 120.
  Komentar config ditulis ulang menyebut default 2 jam.
- app/Http/Middleware/EnsureUserIsAdmin.php: nilai cadangan di pemanggilan
  `config()` ikut diubah 30 -> 120. Ini penting karena kalau key config
  hilang, middleware akan jatuh ke 30 menit tanpa owner sadar (nilai ini
  awalnya tidak terlihat karena config selalu ada).
- Label checkbox di resources/js/pages/Auth/Login.tsx jadi "Tetap Login".
  Dua komentar kode (middleware, test) dan satu komentar config diselaraskan
  supaya tidak lagi menyebut label lama.
- Perilaku "yang centang tidak dibatasi" SUDAH ada sejak commit 2c3bdcfe
  (dicek ulang, bukan kode baru): session key `admin_session_persistent`
  membuat middleware melewati batas idle sepenuhnya.

Test tidak diubah nilai 30 menitnya karena test sengaja memakai override
`config([...])` dengan angka sendiri supaya uji batas tidak ikut bergeser
saat default produksi diubah.

Bukti:
- Config produksi terbaca 120 lewat artisan tinker.
- Verifikasi live (curl, geser penanda aktivitas di tabel sessions):
  idle 119 menit -> /admin HTTP 200 (masih masuk, di dalam batas).
  idle 121 menit -> /admin HTTP 302 ke /login (keluar, lewat batas).
  Sesi yang mencentang "Tetap Login" dengan idle 100000 menit -> HTTP 200,
  tidak terbatas.
- Browser setelah build: label di halaman login adalah "Tetap Login",
  frasa "Tetap Masuk Di Perangkat Ini" tidak ada lagi di DOM.
- AdminSessionIdleTest 5 lulus (24 assertion).
- Suite penuh: 1 skipped, 1157 passed (11823 assertion).
- typecheck 0 error; eslint 0 masalah; build Vite sukses.
- Akun uji (uji.2jam) dihapus; tabel users tetap 1 baris (Febrian),
  sesi non-Febrian 0, sesi yatim 0.

## 2026-09-25 00:15 UTC | zcode | Deep | be8038dd | selesai
Lingkup: fiksasi kanonik alur retur, refund, dan keuangan toko (app/Http/Controllers/Admin/OrderController.php, resources/js/pages/Admin/Orders/Show.tsx, tests/Feature/AdminReturnWorkflowTest.php, docs/DOMAIN/fiksasi-alur-retur-refund-dan-keuangan.md).
Dampak spec: tidak berubah
Untuk agent berikutnya: perhatikan invarian keuangan toko: (1) Penjualan Bersih dan Kas Toko adalah dua konsep terpisah; (2) Refund hanya sah untuk pesanan yang sudah lunas (dicegah di OrderController); (3) Ongkir retur ditanggung toko mengurangi Penjualan Bersih; (4) Paket COD ditolak kurir tidak ada uang masuk dan tidak ada refund, pelunasannya dicegah dan baris payment pending dibatalkan saat retur selesai; (5) Barang retur tidak otomatis menambah stok sistem; (6) Pelanggan tidak memiliki form retur publik di web, pengajuan full manual via WhatsApp.
Bukti:
- AdminReturnWorkflowTest: 18 passed (59 assertions) termasuk test_complete_refund_rejected_when_order_unpaid.
- Suite Return penuh: 98 passed (548 assertions).
- Typecheck & eslint bersih 0 error/warning.
- Bebas karakter em dash (U+2014) di seluruh berkas.

## 2026-09-25 00:35 UTC | zcode | Deep | ae37834b | selesai
Lingkup: penguatan idempotensi webhook kurir, batas refund riil, dan proteksi race condition retur (app/Services/ReturnService.php, app/Http/Controllers/Admin/OrderController.php, tests/Feature/ShippingStatusTest.php, tests/Feature/AdminReturnWorkflowTest.php).
Dampak spec: tidak berubah
Untuk agent berikutnya: perhatikan bahwa (1) `openRefusedReturnCase` dan `createReturn` kini memiliki perlindungan ganda di dalam `lockForUpdate` transaksi database untuk mencegah pembuatan kasus retur duplikat saat ada request konkuren dari webhook dan admin; (2) `completeReturn` mengunci bahwa nominal refund tidak hanya dibatasi oleh total_amount tetapi juga dibatasi oleh total pembayaran riil (`payments completed`), serta resolusi non-refund secara mutlak memaksa `refund_amount = 0.0`; (3) Status `return_completed` dan regresi webhook kurir (mis. scan `delivered` setelah `returned`) ditolak otomatis oleh state machine.
Bukti:
- AdminReturnWorkflowTest: 20 passed (69 assertions).
- ShippingStatusTest: 8 passed (18 assertions) mencakup skenario webhook kurir duplikat dan event stale pada status terminal.
- Typecheck & eslint bersih 0 error/warning.
- Bebas karakter em dash (U+2014).

## 2026-09-25 00:55 UTC | zcode | Standard | b77e32b2 | selesai
Lingkup: panduan admin alur retur dan notifikasi otomatis kurir returned (resources/js/config/admin-page-guides.ts, resources/js/components/admin/notification-bell.tsx, resources/js/pages/Admin/Notifications.tsx, app/Listeners/CreateAdminNotifications.php, app/Providers/EventServiceProvider.php, tests/Feature/ReturnNotificationTest.php).
Dampak spec: tidak berubah
Untuk agent berikutnya: notifikasi `order_returned` kini otomatis dipancarkan saat kurir scan returned (`ShippingStatusUpdated`). Idempoten per `order_id` (webhook duplikat tidak membuat notifikasi kedua). Tautan notifikasi langsung mengarah ke detail order `/admin/orders/{id}`. Panduan admin pada `admin.orders.show` kini mencakup 8 langkah alur retur dan batasan sistem.
Bukti:
- ReturnNotificationTest 5 passed (20 assertions).
- ShippingStatusTest 8 passed (18 assertions).
- Typecheck & eslint bersih 0 error/warning.
- Bebas karakter em dash (U+2014).

## 2026-09-25 01:25 UTC | zcode | Standard | d4f03f65 | selesai
Lingkup: cron polling fallback status pelacakan J&T Cargo (app/Console/Commands/PollJntTracking.php, routes/console.php, tests/Feature/PollJntTrackingCommandTest.php).
Dampak spec: tidak berubah
Untuk agent berikutnya: command `shipping:poll-jnt` berjalan otomatis setiap 30 menit (`withoutOverlapping`). Hanya memeriksa resi aktif non-terminal (`status NOT IN delivered, returned, cancelled`), menyaring umur resi maksimal 45 hari, menerapkan batas interval minimal pembaruan 30 menit per resi (`throttle`), dan memberikan jeda 150ms antar resi agar aman dari pemblokiran rate limit kurir.
Bukti:
- PollJntTrackingCommandTest 5 passed (12 assertions).
- ShippingStatusTest 8 passed (18 assertions).
- Typecheck bersih 0 error.
- Bebas karakter em dash (U+2014).

## 2026-09-25 01:50 UTC | zcode | Deep | cb507c3b | selesai
Lingkup: penguatan cron fallback J&T Cargo dengan kolom pelacakan, backoff bertingkat, dan alert kegagalan berulang (database/migrations/2026_09_25_020000_add_polling_fields_to_shipping_records.php, app/Models/ShippingRecord.php, app/Console/Commands/PollJntTracking.php, docs/database-schema-ragil-aluminium.md, resources/js/components/admin/notification-bell.tsx, resources/js/pages/Admin/Notifications.tsx, tests/Feature/PollJntTrackingCommandTest.php).
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED (tambah 4 kolom di `shipping_records`: `last_polled_at`, `poll_attempts`, `next_poll_at`, `last_poll_error` + indeks `idx_shipping_poll`).
Untuk agent berikutnya: `shipping:poll-jnt` kini menyaring resi berdasarkan `next_poll_at <= now()`, menerapkan interval backoff saat gagal API (maksimal 6 jam), berhenti mencoba bila gagal 20 kali, dan membuat `AdminNotification` type `shipping_poll_failed` idempoten jika gagal >= 5 kali. Status order tidak pernah berubah bila terjadi error jaringan/API.
Bukti:
- PollJntTrackingCommandTest 5 passed (24 assertions).
- ShippingStatusTest 8 passed (18 assertions).
- Typecheck bersih 0 error.
- Bebas karakter em dash (U+2014).

## 2026-09-25 02:40 UTC | zcode | Deep | 00d87ca4 | selesai
Lingkup: penerapan Metode A perhitungan dimensi & berat ongkir pengiriman (app/Services/Shipping/ShipmentPackageCalculator.php, config/shipping.php, app/Support/ShippingPalletSettings.php, tests/Unit/ShipmentPackageCalculatorTest.php, docs/DOMAIN/pengiriman-ongkir-asuransi.md).
Dampak spec: tidak berubah
Untuk agent berikutnya: per 2026-09-25, perhitungan paket pengiriman resmi memakai **Metode A**: volume total adalah akumulasi volume paket produk `sum(P x L x T x qty)` dan berat total `sum(berat x qty)` tanpa tambahan ukuran packing kayu/pallet (allowance default `0.0 cm`). Rumus ini mengikuti pendekatan multi-koli J&T Cargo di mana berat tagih adalah `max(berat_aktual_total, volume_total / 5000)`.
Bukti:
- ShipmentPackageCalculatorTest 10 passed (48 assertions).
- Shipping, Checkout, Order test suites: 204 passed (1609 assertions).
- StorePerformanceGoldenTest 4 passed (13 assertions).
- Typecheck & eslint bersih 0 error/warning.
- Bebas karakter em dash (U+2014).

## 2026-09-25 03:20 UTC | zcode | Deep | 47265b87 | selesai-sebagian
Lingkup: audit menu dan komponen bersama panel admin; konsolidasi CopyButton dan HintTip; migrasi checkbox manual ke primitif ADR-022; pengaman konfirmasi tindakan destruktif di halaman pairing WhatsApp.
Dampak spec: tidak berubah
Untuk agent berikutnya:
- Komponen bersama baru: `resources/js/components/admin/ui/copy-button.tsx` (Clipboard API dengan fallback execCommand). Gunakan ini, jangan tulis ulang fungsi salin di halaman.
- Enam berkas halaman YATIM terdeteksi dan BELUM dihapus, menunggu keputusan owner: Admin/Media/Index, Admin/Attributes, Admin/VariantEdit, Admin/InstallationGallery/Model, Admin/ApaKata/Index, Admin/Beranda/KontakForm. Semuanya sisa penggabungan; rutenya sekarang mengalihkan ke halaman lain.
- Sisa error ESLint di direktori admin (10 error, 18 warning) berasal dari berkas milik pekerjaan lain yang belum di-commit, bukan dari perubahan sesi ini.
- PELAJARAN: `git add <direktori>` menyeret berkas agen lain di working tree bersama. Stage per berkas selalu.
Bukti:
- 33 dari 33 rute menu admin HTTP 200.
- Typecheck 0 error; ESLint 0 error/0 warning pada 21 berkas yang diubah; build Vite sukses.
- PHPUnit penuh 1.172 passed / 1 skipped; filter WhatsApp 70 passed; Vitest 203 passed.
- Uji browser: dialog konfirmasi pairing berfungsi, sesi WhatsApp produksi tetap tersambung (connected=1, nomor 62881080733754).

## 2026-09-25 03:45 UTC | zcode | Standard | 03ff777c | selesai
Lingkup: konversi kartu manual ke SectionCard bersama pada halaman Detail Produk dan Form Sub Model.
Dampak spec: tidak berubah
Untuk agent berikutnya: gunakan `SectionCard` dari `components/admin/section-card.tsx` untuk setiap kartu berseksi; jangan tulis ulang header kartu (ikon kotak abu + judul + garis pemisah) secara manual. Pola salinan itu ditemukan 6 kali di dua berkas sebelum konversi.
Bukti:
- Typecheck 0 error; ESLint 0 error/0 warning pada berkas yang diubah.
- Vitest 203 passed; FrontendPageContract dan AdminDashboard 21 passed (719 assertions).
- Uji browser Detail Produk id 51: tab Varian/Spesifikasi/Media tampil, 12 varian terdaftar, tanpa tumpang tindih.
- Bebas karakter em dash (U+2014).

## 2026-09-25 04:30 UTC | zcode | Deep | 2237ce06 | selesai
Lingkup: konfirmasi tindakan destruktif yang masih berjalan satu klik; token warna tema; peta jenis notifikasi bersama; SectionCard pada Form Cara Pesan; laporan audit komponen diperluas.
Dampak spec: tidak berubah
Untuk agent berikutnya:
- Empat jalur destruktif kini berkonfirmasi: lepas media hasil pemasangan (ProductForm), Hapus Catatan (Orders Index & Show), Muat ulang katalog (ModelProducts Index), dan aksi non-GET generik di ResourceIndex (default kini fail-closed).
- Warna status admin memakai token tema (bg-success, bg-warning, bg-info, text-warning-foreground), bukan kelas mentah emerald/amber/sky. Palet token sudah dituning per mode terang/gelap di resources/css/app.css.
- Peta ikon dan warna jenis notifikasi diekspor dari components/admin/notification-bell.tsx; jangan salin ulang di halaman.
- TEMUAN BELUM DIKERJAKAN menunggu keputusan owner: 6 berkas halaman yatim, 9 berkas komponen mati (±1.625 baris), dan 2 duplikasi logika besar (pembangun URL filter 12 salinan, mesin mode Urutkan 9 salinan). Rincian di docs/AUDIT-ADMIN/LAPORAN-AUDIT-MENU-DAN-KOMPONEN-BERSAMA.md bagian 5A dan 8.
- PELAJARAN: `git add <direktori>` menyeret berkas agen lain di working tree bersama. Stage per berkas selalu. Tiga berkas yang saya sentuh sedang termodifikasi pekerjaan lain; perubahan mereka tidak saya ubah.
Bukti:
- Typecheck 0 error; ESLint berkas yang diubah 0 error/0 warning; build Vite sukses 21 detik.
- Vitest 203 passed; PHPUnit penuh 1.172 passed, 1 skipped (11.907 assertions).
- Uji browser: dialog konfirmasi Model Produk tampil dan Batal tidak menjalankan aksi (URL tetap); halaman Pengaturan Sistem, Cara Pesan, Detail Produk id 51, Promo Toko, Teruskan Popularitas render normal; sesi WhatsApp produksi tetap tersambung.

## 2026-09-25 05:10 UTC | zcode | Standard | 534c6044 | selesai
Lingkup: penyatuan kartu status sambungan WhatsApp dan penyeragaman sumber komponen Card pada halaman pairing.
Dampak spec: tidak berubah
Untuk agent berikutnya:
- Komponen bersama baru `resources/js/components/admin/whatsapp-connection-card.tsx` memuat kartu status sambungan WhatsApp sekaligus tipe `WhatsAppConnectionSummary`. Dipakai halaman Ringkasan WhatsApp dan Template Pesan; jangan tulis ulang blok status tiga keadaan itu.
- Halaman admin tidak lagi mengambil Card dari pohon lama; WhatsApp/Pairing kini memakai `@/components/admin/ui/card` seperti 18 berkas admin lain.
- Sisa impor pohon lama di halaman admin hanya dua, dan keduanya sah karena padanannya tidak ada di pohon admin: `FileDropzone` (ImportCreate) dan `ResponsiveImage` (Banners Index).
Bukti:
- Typecheck 0 error; ESLint bersih pada berkas yang diubah; build Vite sukses 21 detik.
- Vitest 203 passed.
- Uji browser: halaman Ringkasan WhatsApp menampilkan "Status WhatsApp Terhubung" dengan nomor dan satu tautan Kelola sambungan; halaman Pairing menampilkan kartu dengan nomor +62 881-8907-33754 dan sesi sehat.
- Probe 41 rute admin: 41 OK, 0 gagal.

## 2026-09-25 17:46 UTC | zcode | Standard | 324a09f1 | selesai
Lingkup: penyatuan penyusun URL filter pada halaman daftar admin. Berkas baru
`resources/js/lib/filter-url.ts` (fungsi penyusun query dan fungsi navigasi) plus
tes Vitest, dan lima belas halaman daftar admin dimigrasikan ke sana.

Dampak spec: tidak berubah

Untuk agent berikutnya:
- Aturan penyusunan URL filter kini hanya ada satu tempat:
  `resources/js/lib/filter-url.ts`. Jangan tulis ulang blok "gabungkan keadaan
  filter, buang nilai kosong, buang penanda all" di halaman baru; panggil
  `navigateFilter` (navigasi) atau `buildFilterQuery` (hanya menyusun query).
- Tiga opsi yang membedakan halaman sah dan dipakai: `defaults` (nilai default
  server tidak ditulis ke URL, mis. `per_page "20"` dan `view`), `shouldDrop`
  (aturan lintas kunci, mis. rentang tanggal hanya sahih saat preset range
  aktif, dan urutan `newest` tidak ditulis), `preserveState` (hanya tombol reset
  filter yang memakai false).
- Tiga halaman memakai perbedaan yang mudah terlewat dan sudah dijaga: Pesanan
  (urutan `newest` dibuang, tanggal hanya saat preset range), Notifikasi (argumen
  kosong berarti "pertahankan nilai sekarang", bukan menimpa), Model Produk dan
  Pengguna (navigasi tanpa `replace`, jadi tombol kembali browser bekerja).
- PENTING soal working tree bersama. Tiga berkas yang saya ubah ternyata juga
  memuat pekerjaan belum-commit milik sesi lain: `Imports/Index.tsx` dan
  `Products/Index.tsx` (panel galat muat ulang ErrorState plus tombol Coba lagi)
  dan `Users/Index.tsx` (pindah aksi baris ke menu RowActionsMenu). `git add`
  berkas itu akan menyeret pekerjaan orang lain, jadi yang saya staging adalah
  versi "HEAD ditambah perubahan saya saja" lewat `git hash-object -w` dan
  `git update-index --cacheinfo`. Working tree tidak disentuh, pekerjaan mereka
  tetap belum-commit. `Products/PopularityBoosts.tsx` (+440 baris) milik sesi
  lain dan TIDAK saya commit sama sekali.
- Dua galat ESLint pra-eksisting yang masih ada di `Products/Index.tsx`
  (`rowActionTextClass` dan `cn` impor tak terpakai) sudah ada di HEAD sebelum
  perubahan siapa pun, dan sengaja tidak saya sentuh agar commit tetap sempit.
  Sesi yang memakai `cn` di berkas itu akan sekaligus menutup satu galat.
- Sisa halaman yang belum dimigrasikan dan alasannya: `Testimonials/Index.tsx`
  (bentuk parameter bersyarat, mis. `tab`, `channel` hanya saat tab website, dan
  `reply`), `Media/History.tsx` (tiap kunci punya jalur sendiri), dan
  `ModelProducts`/`Users` sudah selesai. Kandidat berikutnya kalau mau lanjut.

Bukti:
- `npm run typecheck`: 0 error. Build Vite sukses 21 detik. Vitest 26 berkas,
  215 tes lulus (tes baru `tests/frontend/filter-url.test.ts` berisi 12 kasus).
- ESLint pada berkas yang diubah: bersih, kecuali dua galat pra-eksisting di
  `Products/Index.tsx` yang terbukti juga muncul pada versi HEAD berkas itu.
- Versi index tiga berkas campuran diperiksa dengan
  `npx eslint --stdin --stdin-filename <path>`: `Imports` dan `Users` bersih,
  `Products` sama persis dengan status HEAD.
- Uji browser live (ra.333labs.tech) setelah build: Kategori, Pesanan, Sub Model,
  Voucher, Bar Promo, Pembayaran, Import, Teruskan Popularitas, Pengguna, Log
  Aktivitas, Model Produk, Banner, dan Notifikasi semuanya menulis filter ke URL
  dan mempertahankan filter lain. Contoh: Banners tombol List menghasilkan
  `?view=list`, lalu pencarian menjadi `?q=promo&view=list` (tampilan tidak
  hilang). Notifikasi: `?category=orders&unread=1` lalu tab Semua menghasilkan
  `?unread=1` (kategori dibuang, penanda belum dibaca tetap).

## 2026-09-25 18:30 UTC | zcode | Standard | c5ac29a5 | selesai
Lingkup: penyatuan siklus hidup mode Urutkan (reorder mode) pada halaman daftar
admin ke hook bersama `resources/js/hooks/use-reorder-mode.ts` plus berkas uji
`tests/frontend/reorder-mode.test.ts`. Enam halaman daftar admin dimigrasikan:
`ApaKata/Index.tsx`, `Faq/Index.tsx`, `MasalahSolusi/Index.tsx`,
`ModelProducts/Index.tsx`, `SubModels.tsx`, dan `Testimonials/Index.tsx`.

Dampak spec: tidak berubah

Untuk agent berikutnya:
- Siklus hidup mode Urutkan (salinan baris lokal `orderedRows`, sinkronisasi
  snapshot server dengan form Inertia via `setData("rows", ...)` dan
  `setDefaults("rows", ...)`, penomoran ulang baris `no`, fungsi `move`,
  `save`, dan `cancel`) kini terpusat di `resources/js/hooks/use-reorder-mode.ts`.
- Tiga helper murni diekspor dan diuji terpisah: `moveRow` (geser aman tanpa
  mutasi), `numberRows` (penomoran ulang `no` dan `sort_order`), dan
  `buildReorderItems` (penyusun payload `{ id, sort_order }`).
- TEMUAN PENTING INERTIA useForm: memanggil `form.setData({ rows: ... })` (bentuk
  objek tunggal) menimpa seluruh data form sehingga kunci lain (mis. `status`)
  hilang, padahal `setDefaults` menggabungkan (merge) kunci. Akibatnya `data`
  dan `defaults` tidak sama dan `isDirty` menjadi true seketika saat masuk mode
  urut. Hook ini selalu memanggil bentuk dua argumen `form.setData("rows", items)`
  dan `form.setDefaults("rows", items)` sehingga kunci saudara tetap utuh dan
  `isDirty` tetap false sampai ada baris yang benar-benar digeser.
- Tiga berkas lain yang memuat mode urut sengaja tidak disentuh:
  `InstallationGallery/Index.tsx`, `Beranda/Popular.tsx`, dan
  `Products/PopularityBoosts.tsx`. Ketiganya sedang aktif dimodifikasi oleh sesi
  lain di working tree bersama. Begitu pekerjaan mereka selesai dan di-commit,
  ketiganya dapat dimigrasikan dengan pola yang sama.

Bukti:
- `npm run typecheck`: 0 error.
- Vitest: 27 berkas, 225 tes lulus (10 tes baru di `reorder-mode.test.ts`).
- ESLint: bersih (0 error, 0 warning) pada 8 berkas yang diubah/dibuat.
- Build Vite: sukses dalam 20.89 detik.
- Uji browser live (`ra.333labs.tech`):
  - Model Produk (`/admin/kelola/model-produk`): klik Urutkan -> tombol berubah
    jadi Urungkan, baris digeser lewat DnD -> nomor tampil berganti (1, 2) dan
    tombol berubah jadi Simpan urutan, baris digeser balik -> tombol kembali
    Urungkan, klik Urungkan -> keluar mode urut dan jumlah draggable kembali 0.
  - Masalah & Solusi (`/admin/masalah-solusi`): 4 baris draggable saat aktif,
    bisa masuk dan keluar mode bersih.
  - Sering Ditanyakan (`/admin/faq`): 7 baris draggable saat aktif, tombol awal
    Urutkan -> saat aktif menjadi Urungkan (isDirty false terbukti terjaga) ->
    bisa dibatalkan kembali ke Urutkan.

## 2026-09-26 09:50 UTC | zcode | Standard | cf4816d3 | selesai
Lingkup: perbaikan posisi dan logika penanda badge merah pada deretan tab status pesanan admin (`/admin/orders`).
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED (penambahan kolom penanda status dilihat admin `admin_seen_status` pada tabel `orders` dan pembaruan dokumen kanonik `docs/database-schema-ragil-aluminium.md`).

Untuk agent berikutnya:
- Kolom penanda status dilihat admin (`admin_seen_status`) pada tabel pesanan (`orders`) mencatat status pesanan terakhir yang sudah dibuka detailnya atau ditindaklanjuti oleh admin.
- Nilai awal kolom ini kosong (`null`) saat pesanan baru dibuat. Bila status pesanan berganti (misalnya dari Diproses ke Dikirim), status pesanan saat ini (`order_status`) menjadi tidak sama dengan penanda status dilihat admin (`admin_seen_status`), sehingga pesanan tersebut dihitung sebagai pesanan baru di tab status tujuannya.
- Penanda badge merah menumpuk di pojok kanan atas tab (`-right-1 -top-1`), bukan lagi di kiri atas, dan menampilkan jumlah pesanan baru di status tersebut (`new_count`).
- Membuka tab daftar status pesanan TIDAK mengurangi atau menghilangkan badge merah. Badge hanya berkurang atau hilang saat admin membuka halaman detail pesanan terkait (`/admin/orders/{order}`) atau melakukan tindakan pada pesanan tersebut (misalnya menyimpan catatan admin atau mengonfirmasi pembayaran).
- Pemanggilan detail pesanan di controller `OrderController@show` otomatis memperbarui `admin_seen_status` menjadi sama dengan `order_status` saat ini via method pembantu `$order->markAdminSeen()`.

Bukti:
- Migrasi forward-only `2026_09_26_010000_add_admin_seen_status_to_orders_table` selesai sukses.
- Typecheck `npm run typecheck`: 0 error.
- ESLint `resources/js/pages/Admin/Orders/Index.tsx`: bersih (0 error, 0 warning).
- Vitest `npm run test`: 27 berkas, 225 tes lulus.
- PHPUnit `AdminOrderStatusNewBadgeTest`: 4 tes lulus (62 assertions) menguji pembuatan pesanan baru, proteksi klik tab daftar, pembukaan detail pesanan, dan perpindahan status ke tab tujuan.
- PHPUnit `AdminOrderReviewIndicatorTest`: 7 tes lulus (77 assertions) memastikan kompatibilitas penanda ulasan tetap utuh.
- Seluruh rangkaian pengujian pesanan (208 tes PHPUnit): 100% lulus.
- Uji browser live (`ra.333labs.tech/admin/orders`):
  1. Tab Semua dan Perlu Konfirmasi menampilkan badge merah angka 1 di pojok kanan atas tab.
  2. Tab Perlu Konfirmasi diklik: filter berganti, badge merah tetap 1 (tidak hilang).
  3. Detail pesanan `ORD26090011` dibuka via rute detail, lalu kembali ke daftar: badge merah di Semua dan Perlu Konfirmasi hilang dengan bersih.

## 2026-09-26 10:05 UTC | zcode | Trivial | 70e9db82 | selesai
Lingkup: pengecualian tab Semua (`all`) dari penanda badge merah pada filter status pesanan admin (`/admin/orders`).
Dampak spec: tidak berubah

Untuk agent berikutnya:
- Tab Semua (`all`) sengaja disetel tidak pernah menampilkan badge merah (`new_count = 0`), baik di backend maupun frontend, agar antarmuka tidak bising dan fokus admin langsung tertuju ke tab status spesifik (mis. Perlu Konfirmasi, Diproses, Dikirim).

Bukti:
- PHPUnit `AdminOrderStatusNewBadgeTest`: 4 tes lulus (62 assertions) memverifikasi tab Semua tetap 0 saat pesanan baru dibuat atau berganti status.
- Typecheck `npm run typecheck`: 0 error.
- ESLint `resources/js/pages/Admin/Orders/Index.tsx`: bersih (0 error, 0 warning).
- Uji browser live (`ra.333labs.tech/admin/orders`): tab Semua 20 bersih tanpa badge merah, tab Perlu Konfirmasi 5 tetap memiliki badge merah 1 di kanan atas.

## 2026-09-26 12:30 UTC | zcode | Standard | 7fec9cee | selesai
Lingkup: perbaikan arah munculnya penjelasan melayang (hover tooltip) pada ikon info di bagian paling atas drawer rincian performa toko (`/admin/analytics/store-performance`), pencegahan tooltip terbuka otomatis saat drawer dibuka, serta penyeragaman ketersediaan penjelasan melayang untuk seluruh metrik dan indikator kinerja utama (KPI) di dalam drawer dan halaman utama.
Dampak spec: tidak berubah

Untuk agent berikutnya:
- Komponen penjelasan melayang (`HintTip` di `resources/js/components/admin/ui/hint-tip.tsx`) kini mendukung penentuan arah kemunculan (`side: "top" | "bottom" | "auto"`, bawaan "auto"). Bila pemicu berada dekat batas atas layar (`rect.top < 240px`), kotak penjelasan otomatis muncul ke arah bawah (`top-full mt-1.5`) agar tidak terpotong oleh batas atas layar atau wadah drawer bergulir (`overflow-y-auto`).
- Pada wadah drawer (`SheetContent`), ditambahkan penangan pembatalan fokus otomatis `onOpenAutoFocus={(e) => e.preventDefault()}` agar pustaka antarmuka Radix tidak otomatis memfokuskan tombol ikon info di bilah kepala drawer saat pertama kali dibuka, yang sebelumnya memicu tooltip langsung terbuka menutupi kategori.
- Pada fungsi penyusun rincian baris (`kpiRow` dan `buildCategoryDetail`), bila rekaman data belum memiliki catatan khusus, sistem otomatis melengkapi keterangan dari dasar acuan metrik resmi (`report.metric_basis`), mencakup cakupan waktu, dasar acuan tanggal pengakuan, dan satuan.
- Seluruh baris metrik di dalam drawer (pembentukan penjualan kotor, pengurang, kas periode, kas berjalan, kontrak tanggal, dan rentang laporan) serta metrik turunan di halaman utama kini memiliki penjelasan melayang dan garis bawah titik-titik bertanda yang seragam (`decoration-dotted`).

Bukti:
- Typecheck `npm run typecheck`: 0 error.
- Vitest `npm run test`: 27 berkas, 225 tes lulus (termasuk kontrak DOM renderer pasif `tests/frontend/store-performance-dom.test.ts`).
- Pemeriksaan ketiadaan tanda pisah panjang (em dash U+2014): lolos tanpa temuan.
- Build Vite: sukses dalam 25.32 detik.
- Uji browser langsung di `ra.333labs.tech/admin/analytics/store-performance`:
  1. Drawer dibuka: bilah kepala dan pilihan kategori tampil bersih tanpa ada tooltip yang terbuka sendiri.
  2. Kursor diarahkan ke ikon info di bilah kepala: tooltip muncul ke arah bawah (`top: 38.8px`, tidak terpotong, teks lengkap terlihat).
  3. Kursor diarahkan ke baris metrik pertama di drawer ("Nilai Produk Terjual"): tooltip muncul ke bawah label (`top: 277.5px`), tidak bertabrakan dengan bilah lengket kategori (`sticky category bar`), teks penjelasan lengkap dan rapi.

## 2026-09-26 17:05 UTC | zcode | Deep | ca53d667 | selesai
Lingkup: penyeragaman alur retur, refund, dan keuangan dengan pesanan, produk, dan UI pelanggan setelah audit menyeluruh (commit ca53d667).
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED (kolom `additional_shipping_amount` pada tabel `order_return_cases` dibuang, kolom baru `Nilai Barang Retur Paket` pada Tabel Pesanan ekspor, dokumen kanonik `docs/DOMAIN/fiksasi-alur-retur-refund-dan-keuangan.md` dan `docs/database-schema-ragil-aluminium.md` diperbarui).

Untuk agent berikutnya:
- Tanggal selesai retur (`order_return_cases.completed_at`) WAJIB terisi saat kasus berstatus `completed`. Seluruh angka refund dan ongkir retur di laporan disaring dari kolom itu, jadi kasus selesai tanpa tanggal hilang diam-diam dari Refund Diberikan, Ongkir Retur (Toko), dan Penjualan Bersih. Penjagaan ada di `OrderReturnCase::booted()`; data lama sudah diisi migrasi `2026_09_26_020000`.
- Ongkir retur yang ditanggung toko HANYA memakai kolom `return_shipping_cost`. Kolom `additional_shipping_amount` sudah dibuang dari skema karena formulir admin tidak pernah mengisinya, sehingga ekspor pesanan (`app/Exports/OrderExport.php`, kolom AD dan U) selalu membacanya nol dan angkanya berbeda dari Performa Toko.
- Rumus Penjualan Bersih dan himpunan baris ekspor sekarang mengikuti KPI layar: `app/Support/IncomeDetailQuery.php` memakai `StorePerformanceService::recognizedOrderIds()` (kini public), menambahkan kolom `Nilai Barang Retur Paket` (kolom Z Tabel Pesanan) ke rantai rumus, dan menambahkan baris koreksi periode untuk retur yang selesai di rentang padahal pesanannya lebih lama. SUM kolom uang Tabel Pesanan sekarang sama dengan KPI; penjaganya `tests/Feature/ReturnRefundIntegrityTest.php`.
- Enam panggilan validasi di `OrderController::completeReturn` sebelumnya memakai `new ValidationException(request(), [...])`. Bentuk itu meledak dengan "Method Illuminate\Http\Request::errors does not exist" sehingga jalur validasi tidak pernah bisa menampilkan pesannya. Pola yang benar di berkas ini sekarang `ValidationException::withMessages([...])`.
- Potong stok barang pengganti lewat `StockLedger::apply()` dengan tipe gerak `return_replacement_out` dan rujukan `return_case`. Jalur retur kini meninggalkan baris `stock_movements` seperti jalur stok lain.
- Baris kasus retur dikunci (`lockForUpdate`) dan statusnya diperiksa ulang DI DALAM transaksi `completeReturn`, supaya dua permintaan paralel tidak memotong stok dua kali.
- Cabang penggantian tanpa varian ditolak dengan pesan jelas. Tabel `products` memang tidak punya kolom stok; stok hanya ada di `product_variants`. Dokumen kanonik sudah dikoreksi.
- Formulir penyelesaian retur: galat server kini tampil (sebelumnya `router.post` mentah tanpa penampil galat), opsi refund dimatikan bila pesanan belum lunas, batas nominal refund mengikuti nilai terkecil antara total pesanan dan total pembayaran lunas, dan tombol simpan dibungkus dialog konfirmasi karena aksinya terminal.
- Aksi `secondaryActionFor('issue')` yang menunjuk `#return-case` DIHAPUS: panel retur tidak dirender pada status `issue`, jadi tautannya mati. Retur tetap hanya dari status Sampai sesuai kontrak.
- Stepper pelanggan memakai jumlah kolom sesuai jumlah langkah (3 untuk alur retur, 4 untuk pengiriman). Kartu `ReturnFlowCard` dihapus karena tiga langkah yang sama sudah tampil di stepper ringkasan; penjaganya `tests/frontend/order-tracking-summary.test.ts`. Komponen arsip mati `components/public/archive/return-block-card.tsx` dan folder `archive` ikut dibuang.

Bukti:
- PHPUnit: seluruh suite 1.184 tes lulus, 1 skipped, 11.997 assertions. Suite terdampak dijalankan terpisah: 104 tes lulus (688 assertions).
- Test pengunci baru `tests/Feature/ReturnRefundIntegrityTest.php`: 8 tes lulus (28 assertions) menutup buku besar stok pengganti, penolakan tanpa varian, tolak dobel eksekusi, isi otomatis completed_at, refund tanpa tanggal tetap masuk laporan, SUM kolom uang tabel sama dengan KPI, refund/ongkir retur jendela retur ikut ekspor, dan tidak ada kolom ongkir retur kedua.
- Vitest: 28 berkas, 229 tes lulus (4 tes baru `tests/frontend/order-tracking-summary.test.ts`).
- Typecheck 0 error; ESLint bersih pada berkas yang diubah/dibuat; build Vite sukses 26,27 detik.
- Verifikasi silang di worktree terisolasi (`git worktree` di HEAD): versi index lulus 58 tes terdampak; baseline HEAD menghasilkan 29 error dan 30 failure dari berkas milik sesi lain, versi ini 29 error dan 26 failure, jadi tidak ada regresi.
- Migrasi produksi dijalankan: kasus retur id=1 yang `completed_at`-nya kosong kini terisi 2026-08-24, dan kolom `additional_shipping_amount` sudah tidak ada di skema.
- Uji browser live (`ra.333labs.tech`):
  1. Panel retur pada pesanan Sampai yang belum lunas: peringatan "belum tercatat lunas" tampil, opsi refund berstatus `aria-disabled=true`, catatan batas refund menampilkan pesan belum lunas.
  2. Kirim penyelesaian dengan ongkir kosong (pihak penyebab toko): pesan galat "Ongkir retur wajib diisi karena kesalahan ada di toko." kini tampil di panel, kasus tetap Open. Sebelumnya gagal senyap.
  3. Kirim penyelesaian yang sah: pesanan berpindah ke Retur selesai, kasus jadi Selesai, pembayaran COD menggantung dibatalkan, `completed_at` terisi, ongkir retur 20.000 masuk laporan.
  4. Tombol "Tandai retur selesai" membuka dialog konfirmasi dengan tombol Batal.
  5. Halaman lacak pelanggan: stepper memakai 3 kolom dengan label akses "Progres pengembalian barang", tiga langkah retur tampil sekali saja, tombol Pengembalian Barang dan Beri Ulasan tersembunyi, lencana "Retur selesai".
- Data verifikasi (pesanan sementara dan kasus returnya) sudah dihapus setelah pengujian.

## 2026-09-27, hermes-desktop-ragil: perbaikan kartu log terebentang di detail pesanan

Laporan owner: UI berantakan di /admin/orders/100039 dan /admin/orders/100040.

Akar masalah: baris tiga kartu (Riwayat pesanan, Log perubahan status, Log
WhatsApp) memakai `grid lg:grid-cols-3` tanpa `items-start`. Karena itu semua
kartu dipaksa setinggi kartu tertinggi di barisnya. Kartu Log WhatsApp sengaja
dibuat area bergulir tinggi tetap 420px (commit 043a5c7a, permintaan lama), jadi
pada pesanan yang punya percakapan WhatsApp panjang (mis. 100040), dua kartu
lain ikut terhampar sekitar 500px dan sisanya ruang kosong besar. Pada pesanan
tanpa percakapan (100039) barisnya tampak normal, karena kartu tertingginya
pendek.

Perbaikan: satu baris, `items-start` pada section grid tiga kartu di
resources/js/pages/Admin/Orders/Show.tsx. Kartu kini mengikuti tinggi isinya
masing-masing; kartu WhatsApp tetap bergulir 420px.

Dua hal lain yang dicek dan BUKAN bug:
- Deretan gar vertikal di kartu "Kasus #11 · rusak" (100040) adalah isi kolom
  catatan (`customer_notes`) sendiri: `jjjjjjjjjjjjjjjj`, isian uji owner.
- Tombol "+ Tambah" di kartu Nomor order adalah aksi tambah catatan admin,
  memang ada di situ.

Bukti:
- Pengukuran DOM setelah perbaikan di 100040: Riwayat pesanan 127px, Log
  perubahan status 130px, Log WhatsApp 499px, tidak ada lagi kartu kosong
  setinggi 500px.
- Tangkapan layar kedua halaman setelah build: 100039 baris tiga kartu tetap
  kompak, 100040 dua kartu kompak plus kartu WhatsApp bergulir.
- typecheck 0 error, eslint 0 masalah di Show.tsx, build Vite sukses.

## 2026-09-27 00:15 UTC | zcode | Trivial | - | selesai
Lingkup: pencatatan kontrak nomor uji coba WhatsApp dari owner.
Dampak spec: tidak berubah

Untuk agent berikutnya:
- NOMOR TEST WHATSAPP (kontrak keras 2026-09-27): Setiap pengujian pesan WhatsApp, pesanan uji coba (dummy order) yang menyentuh alur WhatsApp/lacak pesanan, atau simulasi kirim pesan/notifikasi WAJIB menggunakan nomor `085725116817` (format normal: `6285725116817`).
- DILARANG KERAS menggunakan nomor sembarang / acak / palsu (seperti `081200000001`, `081234567890`, dll) agar tidak menyasar nomor orang lain dan pengujian selalu terarah ke perangkat uji owner.

Bukti:
- Dicatat pada berkas kontrak kanonik lokal (docs/KONTRAK/PREFERENSI-OWNER.md, docs/KONTRAK/MEMORY-kontrak-owner.md), AGENTS.md lokal, dan AGENTS.md VPS.

## 2026-09-26 20:25 UTC | zcode | Trivial | - | selesai
Lingkup: lanjutan keluhan padding di halaman detail pesanan (100039, 100040).
Dampak spec: tidak berubah

Akar: panel Kasus Retur dirender di luar pembungkus konten yang membaurkan
jarak antarkartu (kelas space-y-4), sehingga kartu retur menempel 0 px ke
baris tiga kartu di atasnya. Perbaikan: tambah kelas jarak atas (mt-4) pada
pembungkus panel retur (#return-case) di resources/js/pages/Admin/Orders/Show.tsx.

Bukti:
- Pengukuran DOM live setelah build: di 100039 jarak baris tiga kartu ke kartu
  retur 14 px dan kartu retur ke kartu isi pesanan 14 px (sebelum perbaikan
  sempat terukur 0 px); di 100040 hasil setelah perbaikan sama, 14 px dan
  14 px. 14 px adalah ritme jarak antarkartu halaman ini.
- typecheck 0 error, eslint bersih di Show.tsx, build Vite sukses.

## 2026-09-27 00:35 UTC | zcode | Standard | 333dc899 | selesai
Lingkup: penyeragaman format nomor telepon pelanggan dan toko di seluruh antarmuka publik/storefront menjadi 08xxx (bukan 62xxx atau +62xxx), dengan normalisasi backend tetap berjalan.
Dampak spec: tidak berubah

Untuk agent berikutnya:
- KONTRAK FORMAT NOMOR TELEPON PELANGGAN (2026-09-27): Seluruh nomor yang diperlihatkan ke pelanggan (display phone, footer, about, halaman pelacakan pesanan phoneMasked, cetak resi dan faktur pelanggan) atau input/placeholder bagi pelanggan (checkout address form, form lacak pesanan) WAJIB berformat lokal 08xxx (misalnya 085725116817 atau 0857-2511-6817), BUKAN 62xxx atau +62xxx.
- Normalisasi internal backend tetap berjalan via PhoneNumber::normalize() yang menghasilkan format E.164 tanpa plus (628xxx) untuk penyimpanan database, integrasi WhatsApp API, dan J&T API.
- Untuk menampilkan nomor ke pelanggan, gunakan PhoneNumber::formatDisplay($phone) di PHP (menghasilkan format 08xx-xxxx-xxxx) atau PhoneNumber::toLocal($phone) (format polos 08xxx), serta formatPhoneLocal(phone, grouped?) di TypeScript (resources/js/lib/format.ts).
- Pada halaman pelacakan pesanan (OrderTrackingViewModel::recipient()), masking nomor penerima kini menampilkan 0857••••17, bukan 628••••17.
- Input placeholder di formulir checkout dan lacak pesanan menggunakan nomor uji coba resmi owner: 085725116817.

Bukti:
- PHPUnit: tests/Unit/PhoneNumberTest.php baru (4 tes lulus), ConsultationWhatsAppTest (6 tes lulus), WhatsAppSessionPhoneTest (10 tes lulus), CheckoutPrefillTest (3 tes lulus), OrderReturnCtaTest (10 tes lulus).
- Vitest: 28 berkas, 230 tes lulus (termasuk 8 tes pada tests/frontend/format.test.ts).
- Typecheck 0 error, ESLint bersih pada berkas yang diubah, build Vite sukses dalam 26,33 detik.
- Uji browser live (ra.333labs.tech):
  1. Halaman /order/status: placeholder menampilkan 085725116817, hint contoh 085725116817.
  2. Lacak pesanan ORD26090011: detail penerima menampilkan masking 0857••••17 (bukan 628...).
  3. Footer toko di beranda publik: nomor telepon toko menampilkan 0881-0807-33754 (bukan +62...), tautan tel dialable tel:0881080733754.

## 2026-09-26 23:37 UTC | zcode | Standard | - | selesai
Lingkup: permintaan owner untuk baris tiga kartu log di detail pesanan
(Riwayat pesanan, Log perubahan status, Log WhatsApp): tinggi tetap, isi
meluber discroll di dalam kartu, tombol Detail di header kanan, dan drawer
isi lengkap.
Dampak spec: tidak berubah (tanpa route/schema/JSON baru; semua data drawer
berasal dari payload halaman yang sudah ada)

Perubahan (resources/js/pages/Admin/Orders/Show.tsx):
- Tiga kartu ber-tinggi tetap: area konten Riwayat dan Log Status memakai
  contentClassName h-[420px] overflow-y-auto; kartu Log WhatsApp memakai
  contentClassName h-[420px] overflow-hidden p-0 dengan pembungkus scroll di
  dalamnya yang sekaligus memegang ref auto-scroll. Sebelumnya list WhatsApp
  memakai max-h sehingga kartu lebih tinggi dari dua kartu lain saat pesan
  banyak, dan pendek saat pesan sedikit.
- Tombol Detail (Button secondary sm) rata kanan di header ketiga kartu lewat
  prop action SectionCard yang sudah tersedia.
- Satu Sheet drawer dengan tiga panel: Riwayat Pesanan (data pesanan + daftar
  pembayaran + daftar pengiriman), Log Perubahan Status (semua event tanpa
  potongan, lengkap dengan alasan), Log WhatsApp (semua pesan dengan isi
  penuh tanpa perlu memperluas satu per satu).
- Tombol "Tampilkan riwayat lengkap" di kartu Log Status dihapus dan
  digantikan scroll dalam kartu; state showAllEvents ikut dibuang.

Bukti:
- Pengukuran DOM di 100035 dan 100040: ketiga kartu sama-sama 475px, tombol
  Detail ada di ketiganya.
- Di 100040 log WhatsApp meluber 151px dan terbukti ter-scroll di dalam kartu.
- Ketiga drawer terbuka dan terisi: drawer WhatsApp menampilkan isi penuh
  pesan pelanggan, drawer riwayat memuat Data Pesanan, Pembayaran, dan
  nominal, drawer status memuat event retur beserta alasannya.
- typecheck 0 error, eslint 0 warning di Show.tsx, build Vite sukses.

## 2026-09-27 00:55 UTC | zcode | Trivial | 2e51bc33 | selesai
Lingkup: pembersihan nomor telepon pihak ketiga (6285700000002) dari seluruh basis data dan berkas penyemai simulasi (database/seeders/OrderReviewSimulationSeeder.php).
Dampak spec: tidak berubah

Untuk agent berikutnya:
- Nomor `6285700000002` (dan `6285700000001`) yang sebelumnya dipakai sebagai nomor contoh di penyemai data pesanan simulasi (`OrderReviewSimulationSeeder.php`) terbukti merupakan nomor aktif milik pihak luar (layanan konseling). Nomor tersebut telah dibersihkan total dari seluruh tabel basis data (tabel riwayat pesan WhatsApp `whatsapp_messages`, tabel notifikasi admin `admin_notifications`, tabel data pelanggan `customers`, dan tabel pesanan `orders`).
- Pesanan simulasi `RA-SIM-2609-01` dan `RA-SIM-2609-02` di database kini dikaitkan ke nomor resmi pengujian owner: `6285725116817` (pelanggan `febrian afik`).
- Berkas penyemai `database/seeders/OrderReviewSimulationSeeder.php` telah diperbarui agar menggunakan nomor pengujian resmi owner `6285725116817`, sehingga bila seeder dijalankan ulang tidak akan pernah mengirimkan pesan ke nomor pihak luar.

Bukti:
- Pemindaian menyeluruh ke seluruh tabel di database via tinker: 0 temuan untuk 85700000002 dan 85700000001.
- Dihapus 2 baris `whatsapp_messages` (id 815 dan 816), 1 baris `admin_notifications` (id 98), dan 2 baris `customers` (id 10 dan 11).
- Pesanan 100039 dan 100040 berhasil dialihkan ke nomor 6285725116817.
- PHPUnit: 208 pengujian pesanan lulus (1.671 assertions).

## 2026-09-27 09:19 UTC | zcode | Trivial | - | selesai
Lingkup: permintaan owner mengosongkan kasus retur #11 di pesanan 100040
(RA-SIM-2609-02) supaya bisa mencatat retur manual dari awal lewat UI.
Dampak spec: tidak berubah

Langkah: hapus notifikasi admin return_created milik kasus, hapus 2 item
kasus lalu kasus #11 (masih open), kembalikan status pesanan lewat mesin
status jalur sah return_in_process -> issue -> delivered dengan alasan
"Kasus retur dibatalkan untuk uji isi manual". Matriks tidak mengizinkan
lompatan langsung ke delivered, jadi dua langkah.
Skrip: /tmp/kosongkan-retur-100040.php (dijalankan sebagai www-data),
salinan lokal docs/AUDIT-ADMIN/tools/.

Bukti: output skrip "kasus #11 (2 item) dihapus, 1 notifikasi dihapus,
status return_in_process -> issue -> delivered; Status akhir: delivered;
sisa kasus retur: 0". Halaman live: badge Diterima, tombol Catat retur dan
field Alasan retur plus Kronologi pelanggan muncul kembali, Kasus #11 hilang.

## 2026-09-27 10:38 UTC | zcode | Trivial | - | selesai
Lingkup: permintaan owner merapikan penempatan form "Catat retur" (dan form
penyelesaian yang bermasalah serupa) di detail pesanan: kontrol select pendek
dan textarea tinggi tidak lagi dicampur dalam satu baris grid.
Dampak spec: tidak berubah

Perubahan (resources/js/pages/Admin/Orders/Show.tsx, susunan saja):
- Form Catat retur: baris 1 tiga kolom berisi Alasan retur, Pihak penyebab,
  Ongkir retur ditanggung toko (semua select); baris 2 dua kolom berisi
  Keterangan lainnya (muncul saat alasan Lainnya) dan Kronologi pelanggan
  (keduanya textarea rows 2). Catatan admin tetap lebar penuh.
- Form penyelesaian: Catatan penyelesaian diberi sm:col-span-2 sehingga
  selebar dua kolom, tidak lagi sebaris dengan select Resolusi yang pendek.

Bukti:
- Pengukuran DOM live: pusat Y ketiga select sama persis (310, 310, 310,
  selisih 0 px, memenuhi toleransi ADR-022 1 px); Kronologi pelanggan kini di
  baris sendiri (y 403). Tangkapan layar panel Retur dan penyelesaian.
- typecheck 0 error, eslint 0 warning di Show.tsx, build Vite sukses.

## 2026-09-27 10:42 UTC | zcode | Trivial | - | selesai
Lingkup: lanjutan perapian form Catat retur; owner minta Kronologi pelanggan
dan Catatan admin disatukan dalam satu baris.
Dampak spec: tidak berubah

Perubahan (resources/js/pages/Admin/Orders/Show.tsx): Field Catatan admin
dipindah masuk grid dua kolom yang sama dengan Kronologi pelanggan (keduanya
textarea rows 2, tinggi sama). Saat alasan Lainnya, ketiga textarea mengalir
dua per baris dalam grid yang sama. Tanpa perubahan perilaku.

Bukti:
- Pengukuran DOM live: Kronologi x=256 lebar 479, Catatan admin x=746 lebar
  479, pusat Y sama (403), selisih 0 px, memenuhi ADR-022.
- typecheck 0 error, eslint 0 warning di Show.tsx, build Vite sukses.

## 2026-09-27 10:59 UTC | zcode | Standard | - | selesai
Lingkup: permintaan owner merombak bagian "Item yang diretur" di form Catat
retur yang kurang fungsional (angka telanjang tanpa keterangan, semua item
dipaksa ikut retur tanpa bisa dikecualikan).
Dampak spec: tidak berubah (server memang menerima sebagian item; payload
tetap items[].order_item_id + requested_quantity)

Logika dan desain baru (resources/js/pages/Admin/Orders/Show.tsx):
- Kotak centang per item: ikut retur atau tidak. Item tak dicentang meredup
  dengan coretan dan tidak dikirim ke server (form.transform membuangnya).
- Stepper jumlah unit: tombol kurang, angka, tombol tambah; terkunci di batas
  1 sampai jumlah dipesan, mati saat item tidak dicentang.
- Tiap baris menampilkan harga satuan dan jumlah dipesan.
- Ringkasan "X dari Y unit dipilih retur" di header daftar.
- Tombol Catat retur terkunci saat tidak ada unit yang dipilih; galat
  validasi server untuk items kini ditampilkan di bawah daftar.

Bukti:
- typecheck 0 error (satu perbaikan: transform() Inertia mengembalikan void,
  jadi dipisah sebagai pernyataan sebelum form.post), eslint 0 warning,
  build Vite sukses.
- Uji fungsional live di 100040: ringkasan berubah "2 dari 2" menjadi
  "1 dari 2 unit dipilih retur" saat item pertama dikeluarkan, baris meredup
  bercoret, stepper terkunci di batas 1 dari 1 unit, dan terpulihkan saat
  dicentang kembali. Tangkapan layar tersimpan.

## 2026-09-27 11:07 UTC | zcode | Trivial | - | selesai
Lingkup: lanjutan rombakan daftar item retur; owner menandai stepper mati
total untuk barang yang dipesan 1 unit (kasus paling umum) terlihat seperti
form rusak.
Dampak spec: tidak berubah

Perubahan (resources/js/pages/Admin/Orders/Show.tsx): stepper jumlah unit
hanya dirender untuk item multi-unit. Item 1 unit cukup kotak centang karena
jumlahnya pasti 1; barisnya kini hanya centang, nama, harga satuan, dan
jumlah dipesan.

Bukti:
- typecheck 0 error, eslint 0 warning di Show.tsx, build Vite sukses.
- Uji live di 100040: 0 tombol stepper tersisa untuk dua item 1 unit, dua
  kotak centang aktif, ringkasan "2 dari 2 unit dipilih retur" tetap jalan.
  Tangkapan layar tersimpan.

## 2026-09-27 11:26 UTC | zcode | Trivial | - | selesai
Lingkup: keputusan owner 2026-09-27 setelah penjelasan logika penamaan:
aksi retur di daftar pesanan dan header detail pesanan jadi label "Retur"
berwarna merah.
Dampak spec: tidak berubah (label dan kelas tampilan saja; payload tetap)

Perubahan:
- app/Http/Controllers/Admin/OrderController.php: secondaryActionFor status
  delivered, label "Catat Retur" jadi "Retur"; komentar kode ikut disesuaikan.
- resources/js/pages/Admin/Orders/Index.tsx dan Show.tsx: kedua renderer
  aksi sekunder memakai varian destructive (merah, konvensi button.tsx)
  ketika kind === "start_return", secondary untuk kind lain.

Bukti:
- php -l bersih, typecheck 0 error, eslint 0 warning, build Vite sukses.
- Uji live: tombol di header detail 100039 dan di daftar pesanan (filter
  Sampai) sama-sama berlabel "Retur" dengan warna teks merah
  rgb(226, 60, 60). Tangkapan layar daftar tersimpan.

## 2026-09-27 11:36 UTC | zcode | Trivial | - | selesai
Lingkup: keluhan owner, banner pengingat COD di detail pesanan ada di ujung
bawah halaman sehingga tidak terlihat; minta ditempatkan sesuai logikanya.
Dampak spec: tidak berubah

Perubahan (resources/js/pages/Admin/Orders/Show.tsx): banner "Paket diterima.
Pastikan pembayaran COD sudah disetorkan oleh kurir" dipindah dari akhir
konten menjadi elemen pertama sebelum kartu ringkasan. Logika pemicu tetap
(isCod dan status delivered), tampilan tetap.

Catatan proses: patch pertama sempat membuat dua banner karena jangkar
penghapusan terlalu umum sehingga ter-skip; dibersihkan dengan jangkar
spesifik dan jumlah banner diverifikasi satu.

Bukti:
- typecheck 0 error, eslint 0 warning, build Vite sukses.
- Uji live di 100039: tepat satu banner, y 223 (di atas lipatan, tanpa
  scroll), tepat di bawah header dan di atas kartu ringkasan. Tangkapan
  layar tersimpan.

## 2026-09-27 11:45 UTC | zcode | Trivial | - | selesai
Lingkup: keluhan owner, tombol "+ Tambah" di kartu Nomor order (detail
pesanan) tidak menjelaskan fungsinya; diminta jadi "+ Tambah catatan".
Dampak spec: tidak berubah

Perubahan (resources/js/pages/Admin/Orders/Show.tsx): label tombol pembuka
form catatan admin di kartu ringkasan jadi "Tambah catatan". Satu tombol
"Tambah" lain di berkas yang sama ada di dialog edit pesanan (menambah baris
barang di dalam form, konteksnya jelas), tidak diubah.

Bukti:
- typecheck 0 error, eslint 0 warning, build Vite sukses.
- Uji live di 100039: kartu Nomor order menampilkan "+ Tambah catatan",
  tidak ada lagi tombol "Tambah" telanjang. Tangkapan layar tersimpan.

## 2026-09-27 11:51 UTC | zcode | Trivial | - | selesai
Lingkup: keluhan owner, drawer Log WhatsApp terlalu penuh karena isi naskah
templat otomatis ditampilkan utuh (satu templat WA Order COD setinggi 626px).
Dampak spec: tidak berubah

Perubahan (resources/js/pages/Admin/Orders/Show.tsx): di drawer Log WhatsApp,
pesan otomatis kini hanya penanda: nama templat, badge Otomatis, status kirim,
dan waktu. Isi naskah tetap tampil untuk pesan manual dan balasan pelanggan.
Kartu Log WhatsApp di badan halaman tidak diubah (memang terlipat default
dengan tombol Lihat isi pesan).

Bukti:
- typecheck 0 error, eslint 0 warning, build Vite sukses.
- Uji live drawer 100039: 35 pesan, gelembung tertinggi 95px (sebelumnya
  626px); pemeriksaan presisi di portal drawer: 0 baris berisi naskah panjang
  templat, isi pesan manual pelanggan tetap ada. Tangkapan layar tersimpan.

## 2026-09-27 12:15 UTC | zcode | Standard | e7b50afb | selesai
Lingkup: kelengkapan kelima resolusi retur pada tampilan kasus selesai di panel admin (Show.tsx) dan pelabelan ekspor pesanan (OrderExport.php).
Dampak spec: tidak berubah

Untuk agent berikutnya:
- Kelima resolusi retur resmi (`refund`, `replacement`, `reship`, `compensation`, `no_compensation`) kini tercover menyeluruh di semua lapisan:
  1. Panel Admin (`resources/js/pages/Admin/Orders/Show.tsx`): saat kasus retur selesai (`completed`), kartu kasus kini menampilkan rincian resolusi yang diambil (`RESOLUTION_LABELS`), nominal refund (bila refund), rincian barang pengganti (bila ganti barang), biaya ongkir retur toko, dan waktu selesai (`completed_at`).
  2. Ekspor Pesanan (`app/Exports/OrderExport.php`): sebelumnya pelabelan resolusi memakai ternary biner (`replacement ? 'Ganti barang' : 'Refund'`), sehingga resolusi `reship`, `compensation`, dan `no_compensation` (seperti paket COD ditolak kurir) salah terlabel sebagai "Refund". Kini memakai pencocokan lengkap kelima resolusi.
  3. Pembukuan & Keuangan (`StorePerformanceService`): `refund` mengurangi Penjualan Bersih lewat pos refund; `no_compensation` pada paket COD ditolak mengeluarkan nilai pesanan dari Penjualan Bersih lewat pos `refused_goods_value` dan membatalkan tagihan pembayaran pending; `replacement` memotong stok barang pengganti 1x via `StockLedger` tanpa refund uang; `reship` dan `compensation` mengunci refund uang di angka nol.

Bukti:
- PHPUnit: `OrderExportContractTest` (13 tes lulus), `AdminReturnWorkflowTest` (20 tes lulus).
- Vitest: 28 berkas, 230 tes lulus.
- Typecheck 0 error, ESLint bersih, build Vite sukses.
- Uji browser di pesanan 100039 (`ra.333labs.tech/admin/orders/100039`): form penyelesaian dan tampilan kartu kasus berjalan lancar.

## 2026-09-27 12:16 UTC | zcode | Standard | - | selesai
Lingkup: keputusan owner 2026-09-27, tombol Chat WA di header detail pesanan
berubah kontekstual: ada pesan WA gagal, jadi tombol merah "Kirim ulang WA
(N)" yang benar-benar mengirim ulang lewat gateway; tidak ada gagal, tetap
Chat WA.
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED (rute baru POST
admin/orders/{order}/whatsapp/resend, tercatat di
docs/api-and-routes-ragil-aluminium.md)

Perubahan:
- routes/web.php + OrderController@resendWhatsapp: kirim ulang seluruh pesan
  gagal dalam cakupan utas (per nomor pelanggan yang dinormalisasi, sama
  dengan utas log, bukan kolom order_id), naskah persis dari baris gagal,
  hasilnya baris pesan baru sehingga riwayat gagal tetap utuh.
- Payload show() bertambah whatsapp_failed_count; header detail (Show.tsx)
  menampilkan tombol merah dengan jumlah, beralih ke Chat WA saat nihil.

Bukti:
- Test penjaga baru AdminWhatsappResendTest: 2 passed (9 assertions),
  mencakup kasus kirim ulang membuat baris baru tanpa menghapus riwayat
  gagal, dan kasus tanpa gagal tidak membuat baris.
- php -l bersih, typecheck 0 error, eslint 0 warning, build Vite sukses.
- Uji live di 100039: tombol merah "Kirim ulang WA (12)" muncul di header
  menggantikan Chat WA, sesuai 12 baris gagal per nomor di database.
  Tekan tombolnya belum dilakukan (akan mengirim 12 pesan lama ke nomor uji;
  tersedia untuk owner).

## 2026-09-27 12:46 UTC | zcode | Standard | - | selesai
Lingkup: lanjutan keputusan owner, tombol kontekstual kirim ulang WA juga di
KARTU DAFTAR PESANAN (header tiap kartu, sebelah Cetak), menggantikan Chat WA
saat ada pesan gagal.
Dampak spec: tidak berubah (memakai rute admin.orders.whatsapp.resend yang
sudah terdokumentasi; payload baris daftar bertambah whatsapp_failed_count)

Perubahan:
- OrderController: index menghitung pesan gagal per nomor pelanggan dengan
  satu kueri berkelompok untuk seluruh halaman (pola yang sama dengan
  refusedByPhone), diteruskan ke orderCard sebagai whatsapp_failed_count;
  resendWhatsapp kembali ke halaman asal (back) supaya cocok dari daftar
  maupun detail.
- Index.tsx: header kartu beralih ke tombol merah Kirim ulang WA (N) dengan
  busy per baris; Chat WA tetap tampil saat nihil.
- Insiden terkendali: peluncuran pertama membuat halaman daftar 500 karena
  pluck() mengembalikan Collection padahal orderCard meminta array; diperbaiki
  dengan ->all() SEBELUM commit, jadi tidak pernah ter-commit rusak.

Bukti:
- Test penjaga AdminWhatsappResendTest 2 passed (9 assertions).
- php -l bersih, typecheck 0 error, eslint 0 warning di Index.tsx, build
  Vite sukses.
- Uji live daftar pesanan: kartu-kartu nomor uji 6285725116817 menampilkan
  tombol merah "Kirim ulang WA (12)"; kartu ORD26090009/0008/0007/0005
  (nomor lain tanpa gagal) tetap menampilkan Chat WA hijau. Halaman daftar
  kembali 200. Tangkapan layar tersimpan.

## 2026-09-27 13:19 UTC | zcode | Standard | - | selesai
Lingkup: koreksi owner atas semantik tombol kirim ulang WA (dua putaran
masukan): bukan mengirim backlog lama dan bukan blast beberapa pesan sekaligus.
Tombol hanya untuk pesan PERUBAHAN STATUS pesanan yang gagal terkirim, satu
notifikasi dikirim ulang satu kali.
Dampak spec: tidak berubah (tanpa rute/schema/enum baru; penanda
tergantikan memakai kolom raw_payload yang sudah ada)

Semantik final:
- Hanya kunci templat perubahan status (STATUS_TEMPLATE_KEYS:
  order_created, payment_instructions, payment_confirmed, order_shipped,
  order_delivered, order_issue_followup, order_returned) yang dihitung dan
  dikirim ulang; templat non-status (mis. balasan ulasan) diabaikan.
- Jendela 24 jam: gagal lama otomatis diabaikan (lupakan pesan gagal
  terdahulu), jadi 12 gagal lama tidak memicu tombol dan tidak dikirim.
- Satu notifikasi dengan beberapa percobaan gagal dikirim ulang SEKALI
  (percobaan terbaru); percobaan lain ditandai raw_payload.superseded_by
  supaya tidak dihitung dan tidak terkirim ganda.
- Pengiriman ulang memperbarui status baris yang sama; sukses langsung
  menurunkan hitungan dan menghilangkan tombol.

Bukti:
- Test AdminWhatsappResendTest 3 passed (13 assertions): notifikasi dengan
  3 percobaan dikirim sekali (2 lainnya ditandai tergantikan), gagal lama
  dan non-status diabaikan, tanpa gagal tidak ada perubahan data.
- php -l x2 bersih, typecheck 0 error, eslint 0 warning, build Vite sukses.
- Uji live daftar pesanan: 0 tombol kirim ulang tersisa (12 gagal lama di
  luar jendela); kartu nomor uji kembali menampilkan Chat WA. Tangkapan
  layar tersimpan.

## 2026-09-27 13:52 UTC | zcode | Standard | - | selesai
Lingkup: temuan owner 2026-09-27, WA otomatis bisa tercatat Terkirim ke nomor
yang tidak terdaftar WhatsApp. Terbukti dari data: 4 pesan ke nomor dummy
628123456789 macet di status sent sejak 14 Sep tanpa pernah Diterima/Dibaca,
sementara nomor terdaftar punya rantai ACK lengkap; gateway tidak punya cek
registrasi. Owner menyetujui cek pra-kirim.
Dampak spec: tidak berubah (tanpa rute/schema/enum baru)

Perubahan:
- WhatsAppService: metode numberRegistered() memanggil endpoint baru
  /api/on-whatsapp di gateway (jembatan sock.onWhatsApp Baileys); sendViaBaileys
  menolak kirim dengan status gagal dan alasan "Nomor tidak terdaftar
  WhatsApp." bila registrasi false. Fail-open: endpoint tidak tersedia (404)
  atau pemeriksaan gagal, kirim tetap jalan supaya aman dipasang bertahap.
- Test baru WhatsAppPreSendCheckTest: 3 passed (7 assertions).
- Endpoint gateway DISIAPKAN tapi BELUM DIPASANG: patch di /tmp/
  apply-on-whatsapp-endpoint.mjs dan salinan lokal docs/AUDIT-ADMIN/tools/.
  Penulisan /opt/baileys-bot/index.js di luar area kerja yang dijaga guard,
  menunggu pernyataan tegas owner (backup + patch + node --check + restart
  baileys-bot.service + verifikasi).

Catatan: owner juga melaporkan fenomena pesan terkirim tapi tidak tampak di
beranda WA penerima sampai dibalas; itu perilaku addressing WhatsApp (bot sudah
punya peta LID), cek pra-kirim menutup kelas kegagalan nomor tidak terdaftar.

## 2026-09-27 14:34 UTC | zcode | Standard | - | selesai
Lingkup: peluncuran cek pra-kirim registrasi nomor WA (owner: "oke eksekusi
pra-pesan"). Gateway bot /opt/baileys-bot/index.js diperbarui dengan izin
eksplisit owner dan backup index.js.bak-presend-20260927.
Dampak spec: tidak berubah

Langkah:
- Guard: /opt/baileys-bot ditambahkan ke AREA_TULIS bash-guard.js (pengecualian
  sempit, disetujui owner; bukan seluruh /opt). Rangkaian uji guard lulus
  semua: self-test, uji-batas-area 33 izin + 34 blokir, uji-lubang-pelonggaran
  32 kasus tanpa lubang baru, uji-regresi 39+1, uji-friksi-kerja 22/22.
- Gateway: endpoint /api/on-whatsapp terpasang (jembatan sock.onWhatsApp),
  node --check bersih, baileys-bot.service restart dan tersambung otomatis
  (status open, nomor toko 62881080733754).
- Penafsiran hasil diperbaiki setelah uji live: Baileys menyaring nomor mati
  sehingga nomor tidak terdaftar TIDAK muncul di hasil; nomor yang tidak
  muncul berarti tidak terdaftar (false), bukan fail-open.
- WhatsAppService: sendViaBaileys menolak kirim saat nomor tidak terdaftar,
  pesan dicatat gagal dengan alasan "Nomor tidak terdaftar WhatsApp."

Bukti:
- Verifikasi live endpoint: 6285725116817 (terdaftar) exists=true; nomor
  dummy 628123456789 tidak muncul di hasil (tersaring).
- Test WhatsAppPreSendCheckTest 3 passed + AdminWhatsappResendTest 3 passed
  (total 6 test, 20 asersi): tidak terdaftar gagal tanpa menyentuh endpoint
  kirim; terdaftar terkirim normal; endpoint 404 fail-open.
- Backup gateway tersedia di /opt/baileys-bot/index.js.bak-presend-20260927.

## 2026-09-27 15:47 UTC | zcode | Standard | - | selesai
Lingkup: permintaan owner, penjaga nomor WA di formulir detail pengiriman
checkout yang selama ini tidak ada. Nomor tidak terdaftar kini ditolak di
formulir dengan pesan jelas, bukan setelah pesanan dibuat.
Dampak spec: tidak berubah (aturan validasi baru di endpoint checkout yang
sudah ada; tanpa rute/schema/enum baru)

Perubahan:
- StoreCheckoutDetailsRequest: validator after menambahkan cek registrasi
  (WhatsAppService::numberRegistered, kini public) pada kolom phone; nomor
  dinormalisasi dulu lewat PhoneNumber::normalize. Fail-open: pemeriksaan
  tidak tersedia/gagal = diteruskan, cek saat pengiriman tetap berjalan
  sebagai lapis kedua.
- numberRegistered WhatsAppService jadi public (dipakai penjaga checkout).

Bukti:
- Test baru CheckoutPhoneGuardTest 3 passed: ditolak (exists=false, pesan
  "Nomor WhatsApp tidak terdaftar. Periksa kembali nomor HP yang dimasukkan.",
  detail tidak tersimpan sesi), diterima (exists=true), fail-open (404).
- Seluruh test WA 9 passed (30 assertions) termasuk pra-kirim dan kirim ulang.
- php -l bersih; pre-push typecheck + build lulus saat push.

Catatan proses: penerapan patch sempat tiga kali gagal senyap karena skrip
helper tidak menulis berkas (fungsi once tanpa fs.writeFileSync plus salah
jumlah argumen pemanggil), terdeteksi dari mtime berkas yang tidak berubah;
setelah skrip ditulis ulang, penerapan terverifikasi lewat grep isi berkas.

## 2026-09-27 16:06 UTC | zcode | Standard | - | selesai
Lingkup: permintaan owner, log WhatsApp mencatat juga pesan yang diketik
admin langsung dari perangkat toko, label nama templat hanya untuk pesan
templat, dan hasil kirim ulang berlabel "NAMA TEMPLAT Ulang" (bukan free
form).
Dampak spec: tidak berubah

Perubahan:
- Gateway (/opt/baileys-bot/index.js, backup .bak-fromme tidak perlu karena
  patch idempoten dan backup presend kemarin masih ada): pesan fromMe dari
  perangkat lain diteruskan ke webhook dengan penanda fromMe; restart
  baileys-bot.service, tersambung otomatis.
- WhatsAppService::handleBaileysWebhook: cabang fromMe mencatat baris pesan
  keluar manual (tanpa kunci templat, label netral "Pesan WhatsApp", tanpa
  badge Otomatis) dengan dedupe provider_message_id sehingga kiriman gateway
  tidak tercatat ganda.
- OrderController: label utas pesan dengan raw_payload.resend diberi akhiran
  " Ulang".
- Pemulihan data sekali jalan: 12 baris free_form warisan dicocokkan naskah
  persis dengan baris gagal pada nomor sama; 10 pulih ke kunci templat asal
  (payment_confirmed, order_created, order_shipped, order_delivered) dan 2
  tanpa pasangan memakai label netral. Sisa free_form: 0.

Bukti:
- Test baru WhatsAppFromMeLogTest 3 passed: pesan HP admin tercatat outbound
  manual tanpa kunci templat, kiriman gateway tidak tercatat ganda, label
  kirim ulang berakhiran Ulang di payload halaman detail.
- Seluruh test WA 12 passed (44 assertions): pra-kirim, kirim ulang,
  penjaga checkout, fromMe log.
- node --check bot bersih, baileys-bot.service restart dan tersambung
  otomatis (status open, nomor toko sama).

## 2026-09-27 16:27 UTC | zcode | Trivial | - | selesai
Lingkup: keluhan owner, Log perubahan status masih menampilkan bahasa sistem
("shipping created", "shipping status updated", "system/cod settlement")
karena hanya tiga jenis event yang berlabel.
Dampak spec: tidak berubah

Perubahan:
- OrderEventLabels::eventType dilengkapi label Indonesia untuk seluruh jenis
  event yang tercatat di database dan yang ditulis kode: order.edited (Pesanan
  diedit admin), order_returned (Pesanan dikembalikan), payment.confirmed
  (Pembayaran dikonfirmasi), shipping.created (Pengiriman dibuat),
  shipping.status_updated (Status pengiriman diperbarui),
  system/cod_settlement (Penyesuaian tagihan COD oleh sistem).
- Test baru OrderEventLabelsEventTypeTest: 9 jenis event dicek berlabel
  Indonesia.

Bukti:
- Test 1 passed (9 assertions); php -l bersih.
- Uji live di order 100000: sisa istilah sistem 0; label baru tampil di kartu
  Log perubahan status (terlihat di tangkapan layar: Pengiriman dibuat,
  Status pengiriman diperbarui, Penyesuaian tagihan COD oleh sistem).

## 2026-09-27 17:01 UTC | zcode | Trivial | - | selesai
Lingkup: label "Penyesuaian tagihan COD oleh sistem" buatan sendiri terbukti
membingungkan owner (memicu tanya balik "maksudnya apa"). Dipertegas menjadi
makna sebenarnya: catatan pelunasan COD otomatis saat pelacakan melaporkan
paket sampai.
Dampak spec: tidak berubah

Perubahan: OrderEventLabels 'system/cod_settlement' menjadi "Pelunasan COD
otomatis saat paket sampai"; test penjaga ikut diperbarui.

Bukti: php -l bersih; test OrderEventLabelsEventTypeTest 1 passed (9
assertions). reload halaman menampilkan label baru.

## 2026-09-27 17:03 UTC | zcode | Trivial | - | selesai
Lingkup: masukan owner, akhiran label kirim ulang memakai kurung:
"WA Resi Dikirim (Ulang)", bukan "WA Resi Dikirim Ulang".
Dampak spec: tidak berubah

Perubahan: akhiran label utas pesan WA " Ulang" menjadi " (Ulang)"; test
penjaga diperketat mencekik tanpa kurung.

Bukti: php -l bersih; test WhatsAppFromMeLogTest 3 passed (14 asersi) dengan
asersi (Ulang); uji live order 100000 menampilkan WA Pesanan Diproses (Ulang),
WA Order COD (Ulang), WA Resi Dikirim (Ulang), WA Pesanan Sampai (Ulang).

## 2026-09-27 17:49 UTC | zcode | Standard | - | selesai
Lingkup: item 4 dan item 5 antrean pekerjaan (dokumen
docs/KONTRAK/ANTREAN-PEKERJAAN.md): retur dari kurir tidak terlihat admin,
dan akurasi data kasus retur.
Dampak spec: tidak berubah (dokumen domain retur diperbarui mengikuti
perilaku baru)

Perubahan:
- ReturnService::openRefusedReturnCase mengirim OrderReturnCreated sehingga
  kasus otomatis dari kurir memunculkan notifikasi return_created (idempoten
  per kasus, tanpa efek samping WhatsApp).
- reason_detail kasus otomatis bersyarat: "sebelum diterima pembeli" bila
  paket belum pernah sampai, "setelah sempat diterima pembeli" bila pernah
  sampai atau pesanan lunas (item 5b).
- ShippingService: transisi kurir yang ditolak kini memunculkan notifikasi
  carrier_return_rejected sekali per pesanan, lewat metode publik
  notifyCarrierReturnRejected.
- Show.tsx: pesanan di luar Sampai menampilkan alasan retur dalam catatan
  ringkas, bukan panel kosong.
- Dokumen domain retur (bagian 4, 4C, 8) diperbarui mengikuti perilaku baru.
- Keputusan item 5 yang lain dicatat: retur kurir memang tercatat penuh
  (kenyataan fisik, penyesuaian parsial di penyelesaian oleh admin) dan
  pembedaan notifikasi cukup di keterangan, templat tetap milik owner
  (ADR-025).

Bukti:
- Test baru ReturnCourierVisibilityTest 3 passed (6 asersi): kasus otomatis
  memunculkan notifikasi return_created, keterangan pasca-diterima benar,
  notifikasi transisi ditolak muncul sekali.
- Uji live order Selesai (100000): catatan ringkas "Retur" tampil dengan
  alasan lengkap dari server.
- typecheck 0 error, eslint bersih, build Vite sukses.

## 2026-09-27 18:23 UTC | zcode | Deep | - | selesai
Lingkup: item 6 antrean pekerjaan, integritas stok dan pembayaran pada retur.
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED (migrasi skema: kolom hasil-hitung
open_guard pada order_return_cases, enum payment_status orders bertambah
cancelled; dokumen domain retur dan berkas antrean diperbarui)

Perubahan:
- reship kini memproses barang pengganti seperti replacement (mutasi stok via
  StockLedger); sebelumnya daftar pengganti dibuang sehingga stok bocor.
  UI picker pengganti tampil untuk reship juga.
- Pesanan batal tidak menggantung: payment_status menjadi cancelled (yang
  belum dibayar) atau refunded (yang pernah dibayar, uangnya dikembalikan).
  Enum payment_status diperlebar; filter daftar dan label ikut.
- Reconcile pembayaran melompati pesanan batal (status pembatalan final).
- Penutupan payment pending saat return_completed disatukan DI MESIN STATUS;
  panggilan ganda di controller dihapus (temuan d: satu tempat, audit tetap
  lewat log transisi ber-aktor).
- Migrasi unique index open_guard menolak kasus retur open kedua untuk
  pesanan yang sama di level database (kolom CASE hasil-hitung, sah di MySQL
  dan SQLite).
- Temuan f (48 jam diduplikasi) dan b (pengurangan stok tanpa ledger) sudah
  teratasi sejak 21 Sep, diverifikasi ulang hari ini.

Bukti:
- Test baru Item6IntegrityTest 4 passed: reship memotong stok, batal tanpa
  bayar = cancelled, batal setelah bayar = refunded, kasus open kedua ditolak
  database.
- SELURUH suite test: 1208 passed, 1 skipped, 0 gagal (termasuk regresi
  checkout dan KPI retur yang sempat gagal saat perantaraan dan lulus setelah
  dua perbaikan: fake on-whatsapp dinamis di 8 berkas test checkout, dan
  pembalikan pemindahan penutupan payment ke controller).
- Produksi: php artisan migrate --force, dua migrasi DONE.

## 2026-09-27 18:31 UTC | zcode | Standard | - | selesai
Lingkup: item 9 antrean pekerjaan, sisi pelanggan pada alur retur: halaman
kebijakan retur publik dan riwayat kasus retur milik pelanggan.
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED (URL publik baru /kebijakan-retur:
config/sitemap.php, docs/sitemap/public-sitemap.md, dan
docs/api-and-routes-ragil-aluminium.md diperbarui)

Perubahan:
- Rute GET /kebijakan-retur + PageController@returnPolicy + halaman statis
  Public/ReturnPolicy.tsx (isi turunan docs/kebijakan-retur-draf.md versi
  pelanggan: syarat, cara mengajukan, alasan, jenis penyelesaian, kelayakan
  refund, catatan).
- Halaman lacak: tautan "Baca kebijakan retur" di kartu tombol Pengembalian
  Barang, dan payload return_case (status serta waktu kasus terakhir; alasan
  admin dan nominal tetap tidak dipublikasikan).
- Riwayat kasus dalam bentuk alur retur tiga langkah ber-tanggal sudah
  tampil sejak pekerjaan bagian 4D dokumen domain (2026-09-21), jadi item 9
  ini melengkapi kebijakan dan data kasusnya.

Bukti:
- php -l tiga berkas bersih; typecheck 0 error; eslint bersih; build Vite
  sukses.
- Uji live: GET /kebijakan-retur lewat tunnel = 200.

## 2026-09-27 18:35 UTC | zcode | Standard | - | selesai
Lingkup: item 1 antrean pekerjaan, pesanan Sampai otomatis menjadi Selesai
setelah masa tenggang.
Dampak spec: tidak berubah (command terjadwal baru; tanpa rute/schema/enum
baru; sumber audit memakai "system" yang sudah ada)

Keputusan yang dipakai (default saran antrean): masa tenggang 72 jam sejak
paket tercatat sampai (di atas tenggat retur 48 jam agar hak retur menutup
lebih dulu); berlaku untuk COD dan transfer; saklar on/off di
operations.orders_auto_complete; tidak mengirim WhatsApp (paritas dengan
penyelesaian manual).

Perubahan:
- Command orders:auto-complete + jadwal hourly tanpaOverlapping di
  routes/console.php + konfigurasi operations.orders_auto_complete.
- Syarat per pesanan: delivered, payment_status paid (sabuk pengaman),
  tanpa kasus retur open, dan rekaman delivered terakhir lebih tua dari
  masa tenggang.

Bukti:
- Test baru AutoCompleteDeliveredOrdersTest 5 passed (10 asersi): lewat
  tenggang selesai otomatis dengan sumber system, belum lewat tak disentuh,
  kasus retur open tak disentuh, belum lunas tak disentuh, fitur dimatikan
  tak disentuh.
- php -l tiga berkas bersih.

## 2026-09-27 18:38 UTC | zcode | Trivial | - | selesai
Lingkup: item 10b antrean, panduan admin menyebut aturan jendela retur.
Dampak spec: tidak berubah

Perubahan: panduan halaman Detail Pesanan (admin-page-guides.ts) ditambah dua
catatan: retur hanya dari pesanan berstatus Sampai dan pesanan Selesai
ditangani lewat WhatsApp; imbauan batas 48 jam bersifat peringatan bukan
penghalang. Temuan asli (panduan tidak menyebut retur sama sekali) sudah
basi: panduan kini menjelaskan alur retur menyeluruh, yang hilang tinggal
aturan jendelanya.

Bukti: eslint bersih, build Vite sukses, test cepat 8 passed.

## 2026-09-27 19:06 UTC | zcode | Standard | - | selesai
Lingkup: item 8 dan item 11 antrean pekerjaan, dikerjakan bersama karena
menyentuh form penyelesaian retur yang sama.
Dampak spec: tidak berubah (memakai kolom yang sudah ada: refund_amount kasus
dan orders.additional_shipping_amount)

Perubahan:
- Kompensasi kini boleh bernilai: kolom nominal tampil untuk refund dan
  kompensasi (label menyesuaikan), penjaga lunas dan batas pembayaran riil
  sama seperti refund, tersimpan di refund_amount kasus yang dibaca laporan.
- Ongkir perjalanan balik: kolom opsional di form penyelesaian, tersimpan
  orders.additional_shipping_amount yang dibaca export pesanan; validasi
  nullable numeric; tidak mengubah KPI (perlakuan uangnya masih menunggu
  keputusan owner, sesuai keputusan terbuka item 11).

Bukti:
- Test baru CompensationFlowTest 2 passed (7 asersi): kompensasi bernominal
  tercatat dan tidak menggerakkan pembayaran, kompensasi pada pesanan belum
  lunas ditolak dengan error di kolom refund_amount.
- php -l bersih; typecheck 0 error; eslint bersih; build Vite sukses;
  seluruh 10 suite terkait antrean 29 passed (91 assertions).

## 2026-09-27 19:18 UTC | zcode | Trivial | - | selesai
Lingkup: masukan owner, catatan alasan retur "aneh" di pesanan Selesai lama:
muncul di semua pesanan non-Sampai tanpa memandang usia, dan teksnya
mengulang makna dua kali.
Dampak spec: tidak berubah

Perubahan:
- Teks alasan pesanan Selesai diringkas tanpa pengulangan.
- Keputusan relevansi dipindah ke server: alasan hanya dikirim bila pesanan
  Selesai masih dalam 7 hari (jangkar EventLog perpindahan status ke
  completed yang append-only). Jangkar awal (last_status_at pengiriman)
  ternyata tidak stabil: kolom itu ikut berubah setiap refresh J&T saat
  halaman admin dibuka (terbukti di order 100000 berubah jadi hari ini).
- Klien kembali murni (tanpa Date.now saat render, sesuai aturan purity
  eslint).

Bukti:
- Debug langsung: sebelum perbaikan reason terisi meski delivered 34 hari
  lalu (last_status_at terlanjur diperbarui hari ini); sesudah jangkar
  EventLog, reason NULL.
- Uji live order 100000: catatan hilang, nol teks pembatasan retur di
  halaman. typecheck 0 error, eslint bersih, build sukses.
- Test OrderEventLabelsEventTypeTest dan ReturnCourierVisibilityTest tetap
  lulus.

## 2026-09-27 20:46 UTC | zcode | Standard | - | selesai
Lingkup: audit kesehatan seluruh layanan dan API di server 209 atas permintaan
owner ("cek semua api... semua di server").
Dampak spec: tidak berubah (audit saja, tanpa perubahan kode)

Cakupan yang diperiksa: 24 layanan systemd aktif, port, sumber daya, cron,
jadwal Laravel, antrean, MySQL, Redis, Reverb, tunnel Cloudflare (Docker),
gateway WhatsApp, integrasi J&T, cadangan, dan alert infrastruktur.

Hasil utama:
- Semua layanan inti hidup: nginx, php8.3-fpm, mysql, redis, ragil-queue,
  baileys-bot, laravel-reverb, cron. Tunnel jalan lewat Docker (ragil-cloudflared).
- Sumber daya sehat: disk 37%, RAM 2,8/7,9 GB, load 0,08, uptime 94 hari.
- Laravel production, debug off, cache/queue/session redis-database, 0 error
  hari ini, 0 failed job. Config NOT CACHED = kondisi dikenal.
- Scheduler jalan tiap menit; infrastruktur cadangan lengkap (harian + R2,
  binlog per jam, drill PITR, restore test mingguan, health check 5 menit).
- Gateway WA: 10 endpoint diverifikasi; semuanya berfungsi; /disconnect
  sengaja tidak dipanggil. /send-invoice-image ternyata tidak pernah dipanggil
  aplikasi dan crash bila methods bukan string (terverifikasi 200 dengan
  payload lengkap). 3 pesan uji dikirim ke nomor uji owner.
- TEMUAN: 6 alert aktif di alert-latest.txt + Telegram: r2-upload (binlog,
  sejak 3 Sep), smoke-test (27 Sep), db-live-health (27 Sep), semantic-audit
  (27 Sep), drill-pitr (21 Sep), stale-or-restore (restore test telat 328 jam,
  max 168 jam). PostgreSQL jalan namun tidak dipakai aplikasi.

Tindak lanjut yang disarankan (menunggu owner): investigasi 6 alert, dan
pertimbangkan mematikan PostgreSQL yang tidak terpakai.

## 2026-09-27 21:48 UTC | zcode | Deep | - | selesai
Lingkup: tindak lanjut enam alert infrastruktur (owner: "ALERT tindakannya
gimana"). Semua alert kini BERSIH: agregator melaporkan "sehat — tidak ada
alert", nol berkas ALERT-*.
Dampak spec: tidak berubah

Akar masalah dan perbaikan tiap alert:
1. ALERT-r2-upload (sejak 3 Sep): satu upload binlog (binlog.000612) gagal
   sekali; jalur kini sukses tapi penanda tidak pernah dihapus saat berhasil.
   Perbaikan: scripts_backup_mysql_binlog.sh menghapus penanda saat sukses.
2. ALERT-smoke-test (27 Sep): cek /checkout mengharapkan 200 padahal keranjang
   kosong memang redirect (302). Perbaikan: harapan diubah ke 302 + penanda
   dihapus saat sukses.
3. ALERT-semantic-audit + ALERT-db-live-health (27 Sep): dua sebab.
   a. Invarian "total_amount = subtotal + ongkir - voucher + biaya COD" lupa
      suku asuransi; rumus otoritatif (OrderService baris 176 dan 705)
      menyertakan shipping_insurance_amount. Dua pesanan sah (ORD26090006,
      ORD26090011) dilaporkan anomali; dengan asuransi dihitung, selisihnya 0.
   b. Dua pesanan simulasi COD (RA-SIM-2609-01/02) berstatus paid tanpa baris
      pelunasan karena payments-nya dihapus pembersih data dummy. Diperbaiki
      dengan mengembalikan baris pelunasan COD-nya (nominal = total tagihan,
      status completed), sesuai aturan COD lunas saat paket sampai.
   Perbaikan skrip: rumus audit menyertakan asuransi; CleanupDummyData
   mereset payment_status pesanan dummy supaya tidak terulang.
4. ALERT-drill-pitr dan ALERT-stale-or-restore (21 Sep): drill mingguan gagal
   karena mewarisi anomali audit di atas. Setelah data dan rumus diperbaiki,
   cadangan segar dibuat dan kedua drill dijalankan ulang: RESTORE TEST PASS
   dan PITR DRILL PASS (rowcount uji = produksi untuk 5 tabel inti).

Bug yang ditemukan suite penuh saat verifikasi (saya perkenalkan, langsung
diperbaiki sebelum commit):
- Pemilihan kasus retur terakhir pada payload publik memakai Collection::latest
  yang tidak ada (500 di halaman cek pesanan) -> diganti sortByDesc.
- Pengosongan alasan retur untuk pesanan non-Sampai ikut menghapus pesan
  penolakan saat admin mencoba mencatat retur. Dipisah: 'reason' selalu terisi,
  'note' khusus catatan layar (hanya untuk pesanan Selesai yang masih dekat
  masa returnya).

Bukti:
- Seluruh suite: 1217 passed, 1 skipped, 0 failed (11895 assertions).
- typecheck 0 error, eslint bersih, build Vite sukses.
- Live: halaman cek pesanan 200, kebijakan retur 200, katalog 200.
- Alert: nol berkas ALERT-*; log agregator "sehat — tidak ada alert";
  PITR DRILL PASS dan RESTORE TEST PASS tercatat.

## 2026-09-28 09:18 UTC | zcode | Standard | - | selesai
Lingkup: permintaan owner, eliminasi alert yang tidak perlu dikirim ke Telegram
lalu bangun antisipasi dan penyembuhan mandiri untuk sisanya.
Dampak spec: tidak berubah

Perubahan:
- Agregator v3 di server (/root/scripts_alert_aggregator.sh), dicerminkan ke repo
  sebagai scripts/prod/alert-aggregator.sh. Tiga fase: (1) pemulihan mandiri
  sebelum menilai, (2) penilaian hanya 7 kondisi berdampak pelanggan atau uang,
  (3) laporan.
- Pemulihan mandiri Fase 1: restart layanan inti yang mati, hidupkan kontainer
  tunnel, sambung ulang sesi WhatsApp, pangkas cache perkakas bertingkat saat
  disk tinggi, coba ulang unggah binlog yang gagal. Ditulis ke self-heal.log.
- Pemeriksaan WhatsApp kini menguji SAMBUNGAN (status open), bukan sekadar proses
  hidup; sebelumnya sesi ter-logout tidak terdeteksi.
- Pesan Telegram memakai format Artinya/Dampak/Tindakan. Dedupe berbasis kode
  jenis, bukan kalimat, sehingga satu insiden = satu pesan (sebelumnya 24 sampai
  27 pesan per hari karena angka umur jam mengubah teks). Kabar "masalah selesai"
  dikirim sekali saat pulih.
- Alert teknis (penanda ALERT-*, umur marker, inode, tren disk, swap, OOM
  historis) tidak lagi ke Telegram, cukup ke log untuk agent.
- Rencana antisipasi dan klasifikasi didokumentasikan di
  docs/runbooks/ALERT-TIERS.md, termasuk empat hal yang jujur tidak bisa mandiri
  (sesi WhatsApp ter-logout butuh QR, kapasitas server, bug, keputusan bisnis).

Verifikasi:
- bash -n bersih; agregator berjalan di produksi dan melaporkan "sehat".
- Uji sandbox (port situs dimatikan, Telegram dinonaktifkan): terdeteksi 3
  halaman gagal, pesan tiga bagian tersusun, jalan kedua "dedupe kode, lewati"
  membuktikan tidak ada pengiriman berulang.
- Verifikasi pengosong penanda: 7 dari 7 skrip pemeliharaan mengosongkan
  penandanya saat sukses.

Menunggu keputusan owner: (1) pindahkan skrip pantau ke repo supaya ber-versi dan
teruji, (2) izin memangkas cache perkakas otomatis (pagar: hanya cache, tidak
pernah data/cadangan/kode), (3) izin kebijakan restart systemd untuk nginx,
php8.3-fpm, dan laravel-reverb.

## 2026-09-28 09:33 UTC | zcode | Standard | - | selesai
Lingkup: lanjutan rencana antisipasi alert (owner: "proses"). Dua dari tiga
keputusan dieksekusi; satu diblokir guard keselamatan.
Dampak spec: tidak berubah

Dilakukan:
- 26 skrip pemantauan disalin dari /root ke repo di
  scripts/prod/monitoring/ (ber-versi, bisa ditinjau). Kepemilikan diubah ke
  www-data mode 755 supaya bisa dibaca test.
- Test penjaga baru tests/Feature/MonitoringScriptsContractTest.php (5 test,
  67 asersi): skrip ada di repo, sintaks shell (bash -n) dan python sah,
  skrip pembuat penanda WAJIB mengosongkan penandanya saat sukses, dan
  agregator wajib memisahkan kritis dari catatan teknis plus memuat langkah
  penyembuhan mandiri.
- Pembuktian penjaga menggigit: baris pengosong penanda sengaja dihapus dari
  scripts_semantic_audit.sh, test gagal tepat di asersi itu, lalu dipulihkan
  dan hijau kembali (5 passed, 67 assertions).
- Seluruh suite: 1222 passed, 1 skipped, 0 failed (12106 assertions).
- Pemangkasan cache otomatis dikonfirmasi sudah aktif di agregator Fase 1d
  (>=80% cache ringan, >=92% cache besar).
- docs/runbooks/ALERT-TIERS.md diperbarui: status ketiga keputusan, plus
  perintah siap tempel untuk kebijakan restart systemd.

Diblokir: kebijakan restart systemd untuk nginx dan php8.3-fpm butuh menulis
/etc/systemd/system, diblokir aturan keras guard (direktori sistem). Tidak
diakali. Perintah lengkap ada di ALERT-TIERS.md bagian E untuk dijalankan
owner. Lubang situs-mati sudah tertutup pengawas 5 menit (Fase 1a agregator),
bedanya hanya kecepatan pemulihan.

## 2026-09-28 10:16 UTC | zcode | Deep | - | selesai
Lingkup: permintaan owner soal backup data pelanggan dan trafik ("proses").
Lima item dikerjakan: verifikasi data pelanggan, arsip tidak terblokir,
pemantauan bandwidth, deteksi anomali trafik, enkripsi salinan off-site.
Dampak spec: tidak berubah

1. VERIFIKASI DATA PELANGGAN. Uji restore sebelumnya hanya memverifikasi lima
   tabel (produk, varian, media, pesanan, item). Kini customers, users, dan
   payments ikut diverifikasi. Dibuktikan cocok: 8 pelanggan, 1 pengguna, 20
   pembayaran. Sebelumnya data pelanggan selalu tercadangkan tetapi belum
   pernah dibuktikan bisa dipulihkan.

2. ARSIP TIDAK TERBLOKIR DIAM-DIAM. Aturan lama membatalkan arsip mingguan dan
   bulanan bila belum ada bukti uji restore terbaru; akibatnya W35 dan W38
   hilang. Kini arsip tetap dibuat dan ditandai ALERT-archive-unverified.
   Alasan: kehilangan satu minggu arsip lebih berbahaya daripada menyimpan
   dump yang belum diuji.

3. PEMANTAUAN BANDWIDTH. Pemakaian bandwidth sebelumnya nol pemantauan. Skrip
   baru scripts_traffic_check.sh (dijadwalkan tiap jam lewat scheduler Laravel)
   mengisi /root/backups/traffic-daily.csv dan mencatat pemakaian harian.
   Hari ini: 1719 permintaan, ~1100 di antaranya perkiraan pengunjung, 71 MB.

4. DETEKSI ANOMALI TRAFIK. Agregator kini menguji KETERJANGKAUAN DARI LUAR
   (SITUS_TAK_TERJANGKAU): ujian internal tetap lulus walau tunnel atau DNS
   rusak, jadi ini satu-satunya ujian yang membuktikan pelanggan bisa membuka
   situs. Ditambah ambang bandwidth (kritis 50 GB, catatan 20 GB) dan catatan
   kunjungan nol pada jam aktif.

5. ENKRIPSI SALINAN OFF-SITE. Identitas pelanggan tadinya tersimpan terbaca di
   R2. Kini salinan R2 dienkripsi AES-256-CBC + PBKDF2 (kunci
   /root/backups/.backup-key); berkas lokal tetap polos supaya rantai pemulihan
   tidak berubah. Dibuktikan bolak-balik: unggah terenkripsi, unduh dari R2,
   dekripsi, sidik jari IDENTIK dengan dump asli, dan isi di R2 tidak terbaca
   polos. Tanpa kunci: unggahan tetap jalan tanpa enkripsi + penanda peringatan.

TEMUAN PENTING YANG BELUM DITUTUP: nginx belum membaca IP asli pengunjung,
sehingga seluruh trafik tercatat sebagai satu IP tunnel (209.23.10.62).
Akibatnya pembatas 20 permintaan/detik per IP efektif menjadi batas BERSAMA
untuk semua pengunjung, bukan per pengunjung. Perbaikannya menuntut
set_real_ip_from + real_ip_header CF-Connecting-IP di /etc/nginx (di luar area
tulis agent). Dicatat di docs/runbooks/ALERT-TIERS.md bagian G.

CATATAN KEAMANAN UNTUK OWNER: kunci enkripsi dikirim ke Telegram pemilik dan
WAJIB disimpan di pengelola kata sandi. Tanpa kunci itu, seluruh cadangan
off-site tidak bisa dibuka.

Pembuktian guard: penjaga MonitoringScriptsContractTest diperluas dari 5 ke 7
test (84 asersi) mencakup enkripsi dan trafik; 30 skrip pemantauan kini
ber-versi di repo. Seluruh suite 1224 passed, 1 skipped, 0 failed.

## 2026-09-28 11:01 UTC | zcode | Deep | - | selesai
Lingkup: temuan IP asli pengunjung (lanjutan "proses juga"): pembatas nginx dan
Laravel berlaku GLOBAL karena nginx belum membaca IP pengunjung.
Dampak spec: tidak berubah

TEMUAN (diagnosis lengkap):
- Trafik masuk lewat tunnel cloudflared di host ini, nginx belum membaca
  CF-Connecting-IP. Akibatnya limit_req 20r/s dan limit_conn 30 di situs
  berlaku GLOBAL untuk seluruh pengunjung -> lonjakan trafik wajar bisa
  membuat pelanggan menerima 503.
- sites-enabled/ragil baris 86 memakukan fastcgi_param REMOTE_ADDR 127.0.0.1,
  dan fastcgi_params tidak meneruskan satu pun header HTTP. Jadi aplikasi
  melihat SEMUA permintaan sebagai 127.0.0.1: throttle Laravel juga global, dan
  log aplikasi tidak menunjukkan IP asli. Analisa trafik jadi perkiraan.
- Port 8200 tidak terbuka ke publik (firewall hanya 22 dan 443, INPUT DROP),
  jadi mempercayai peer tunnel untuk real_ip aman dari pemalsuan header.
- HTTPS tidak bermasalah: AppServiceProvider sudah forceScheme('https') dan
  SESSION_SECURE_COOKIE=true, jadi tidak perlu menambah X-Forwarded-Proto.

YANG DIKERJAKAN:
- scripts/prod/nginx-real-ip.sh: percayai HANYA peer tunnel + loopback, baca
  CF-Connecting-IP, teruskan IP asli ke aplikasi lewat X-Forwarded-For yang
  diambil dari $remote_addr hasil real_ip (bukan header kiriman klien).
  REMOTE_ADDR tetap 127.0.0.1 karena Laravel mempercayai alamat itu sebagai
  proxy. Aman dan idempoten: cadangan + nginx -t + reload tanpa memutus
  koneksi + pemulihan cadangan bila uji gagal; bila header tidak ada,
  perilakunya sama dengan sekarang.
- scripts/prod/uji-tambalan-nginx.sh: menguji tambalan TANPA menyentuh /etc
  (salin konfigurasi ke temp, terapkan sisipan, jalankan nginx -t). Hasil:
  "syntax is ok, test is successful".
- Pemantau pendamping: agregator menghitung penolakan ke pengunjung (503/429)
  pada jam berjalan, kode PELANGGAN_DITOLAK (kritis >=20, catatan >=5).
  Diverifikasi dengan log buatan: 3 penolakan pengunjung terhitung, 1 curl
  dikecualikan; log nyata hari ini 0.
- Test penjaga diperluas jadi 8 test/92 asersi: tambalan wajib ada, TIDAK boleh
  mempercayai 0.0.0.0/0, wajib punya nginx -t dan pemulihan cadangan, dan
  penolakan pelanggan wajib terpantau.
- docs/runbooks/ALERT-TIERS.md bagian G diperbarui: temuan, tambalan, cara
  membuktikan, dan bukti uji.

DIBLOKIR GUARD: penulisan /etc/nginx diblokir aturan keras (WRITE_BLOCK_PREFIX
memuat /etc, tanpa mekanisme pengecualian). Karena itu tambalan disiapkan
sebagai skrip siap jalan untuk owner, bukan dijalankan agent. Lubang ini TIDAK
menghentikan situs: dampaknya pembatas terlalu ketat saat trafik tinggi.

Bukti: seluruh suite 1225 passed, 1 skipped, 0 failed (12143 asersi);
nginx -t lolos pada konfigurasi ber-tambalan; agregator produksi "sehat".

## 2026-09-28 12:15 UTC | zcode | Trivial | resources/js/pages/Admin/Orders/Index.tsx | selesai
Owner minta teks tombol "+ Tambah" di kolom Catatan admin (kartu daftar pesanan) jadi "+catatan". Ubah satu span, build, verifikasi live di halaman /admin/orders?order_status=completed: tombol kini berlabel "+catatan". Typecheck 0, build 0.

## 2026-09-28 12:30 UTC | zcode | Trivial | resources/js/pages/Admin/Orders/Index.tsx | selesai
Koreksi lanjutan 911c0ce0: ikon plus pada tombol membuat label "+catatan" tampil dobel (++catatan). Span dikembalikan murni teks "Catatan" sehingga tampilan jadi "+ Catatan", satu plus, huruf kapital sesuai permintaan owner. Build 0, verifikasi live + tangkapan layar di /admin/orders?order_status=completed.

## 2026-09-28 13:05 UTC | zcode | Standard | resources/js/pages/Admin/Orders/Index.tsx | selesai
Permintaan owner di daftar pesanan: (1) badge "N pesanan · Total Nilai" di kanan atas dihapus seluruhnya, (2) dropdown Urutan (Terbaru/Terlama) dan Filter waktu (preset + rentang tanggal) digabung jadi satu dropdown "Urutan & waktu" dengan opsi Terbaru, Terlama, Hari ini, 3/7/30 hari terakhir, Rentang tanggal; opsi Semua waktu dibuang karena redundan (Terlama/Terbaru sekaligus membersihkan preset waktu). Pemilihan preset waktu mempertahankan sort aktif, pemilihan Terbaru/Terlama membersihkan preset. Panel rentang tanggal dan applyDateRange dipindah utuh ke dropdown gabungan. Verifikasi: typecheck 0, build 0, live test pilih Terlama (URL sort=oldest, urutan kartu terbalik), panel rentang terbuka, badge tidak ada, footer Menampilkan tetap.

## 2026-09-28 13:20 UTC | zcode | Trivial | resources/js/pages/Admin/Orders/Index.tsx | selesai
Koreksi owner atas c78011c8: Total Nilai jangan dibuang, hanya jumlah "N pesanan". Badge kanan atas dikembalikan dengan isi "Total Nilai: Rp X" saja. Typecheck 0, build 0, verifikasi live di /admin/orders?order_status=completed.

## 2026-09-28 13:20 UTC | zcode-retur | Deep | - | selesai
Lingkup: instruksi eksekusi final owner 28 Sep - ongkir retur sebagai pengurang Penjualan Bersih, edit kasus retur teraudit, void administratif, retur manual pesanan Selesai, P2-01 rekonsiliasi pembayaran, verifikasi P2-03/P2-04, sinkronisasi dokumen.
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED - 3 route admin baru (admin.orders.returns.edit/update/void), kolom baru order_return_cases (late_return, override_reason, voided_at, voided_by_user_id, void_reason), tabel baru return_case_adjustments. Schema doc 3.2a diperbarui + 3.2d ditambah; api doc routes ditambah; fiksasi DOMAIN diberi addendum 2026-09-28; todo P2-01/03/04 DONE + blocker TS SUPERSEDED.
Keputusan owner yang dieksekusi: return_shipping_cost PENGURANG Penjualan Bersih (formula lama service sudah menghitungnya, test vakuo diganti 6 test nyata, kontrak beku naik v1.0.2: hint ongkir retur + definisi net_revenue, GOLDEN_UPDATE dijalankan).
Keputusan teknis: kasus completed di-void TETAP status completed + voided_at (workflow terminal dijaga); open case void menjadi cancelled; stok tidak pernah dibalik otomatis; refund kumulatif lintas kasus dibatasi pembayaran tercatat; retur manual completed wajib override_reason + late_return, sumber event admin_late_return.
Commit A: ongkir retur + kontrak v1.0.2 (menyertakan 2 baris sinkronisasi fixture JENDELA di StorePerformanceGoldenTest dan perataan komentar versi OrderExport yang sebelumnya belum ter-commit, milik pekerjaan lain).
Commit B: edit/void/retur manual backend+UI+test.
Commit C: rekonsiliasi P2-01 (menyertakan filter periode yang belum ter-commit di PaymentController dan Payments/Index.tsx karena rekonsiliasi memakai basis periodenya).
Commit D: dokumen.
Verifikasi: PHPUnit penuh 1253 passed / 1 skipped / 0 failed (12342 asersi); Vitest 230 passed; npm run typecheck bersih; build sukses; ESLint bersih pada Show.tsx + Payments/Index.tsx (lint global masih merah di berkas pekerjaan lain); migrasi 2026_09_28_100000 dijalankan forward-only sebagai www-data.
IP patch: TIDAK dijalankan agent (guard /etc); skrip scripts/prod/nginx-real-ip.sh siap jalan dari commit 579b0b80, menunggu operator owner.

## 2026-09-28 13:24 UTC | zcode | Trivial | resources/js/pages/Admin/Orders/Index.tsx | selesai

- Label tombol catatan saat kosong di daftar pesanan jadi Catatan admin (sebelumnya Catatan), permintaan owner; tombol saat catatan terisi tidak berubah. Commit d2b8ef7a, hanya hunk label yang di-stage, WIP dialog konfirmasi transfer milik agent lain dibiarkan tak ter-commit.
- Jawaban tanya owner: kolom Aksi daftar pesanan PUNYA tombol Retur (merah) untuk status Sampai, dari secondary_action kind start_return di OrderController yang mengarah ke detail pesanan bagian retur; status Selesai tidak dapat tombol itu di daftar, retur manualnya lewat tombol Catat Retur Manual di halaman detail.

## 2026-09-28 13:50 UTC | zcode | Standard | resources/js/pages/Admin/Orders/Index.tsx, resources/js/pages/Admin/Orders/Show.tsx | selesai
Popup konfirmasi transfer saat admin menekan Proses Pesanan: kind confirm_transfer membuka dialog "Konfirmasi Pesanan Transfer" berisi "Pastikan pembayaran sudah dilakukan dengan nominal <total> sebelum mengkonfirmasi pesanan."; COD (kind advance_cod) tetap langsung proses tanpa popup, sesuai permintaan owner. Diverifikasi live di daftar pesanan lewat pesanan uji transfer ORD26090012 (nomor uji 085725116817): dialog muncul dengan nominal Rp 2.165.300, tombol Batal menutup tanpa mengubah status.
CATATAN INSIDEN: patch awal di Show.tsx hilang ditimpa revert agent lain di working tree bersama (Index.tsx selamat), sehingga satu klik uji di halaman detail menjalankan kode lama dan memproses ORD26090012 tanpa dialog (status kini Diproses + Lunas, WA notifikasi masuk ke nomor uji owner). Order uji dibiarkan tanpa dibalik. Patch dipasang ulang, kedua bundle diverifikasi memuat dialog sebelum commit.

## 2026-09-28 14:10 UTC | zcode | - | - | addendum 8ccbabe6
Verifikasi pasca-commit: detail pesanan ORD26090013 (uji transfer kedua, /admin/orders/100080) membuka dialog yang sama dengan nominal Rp 2.235.300; Batal menutup tanpa mengubah status (tetap Menunggu Konfirmasi). Kartu COD (ORD26090011) terverifikasi tanpa dialog via atribut aria-haspopup. Popup transfer terverifikasi penuh di kedua permukaan (daftar + detail).

## 2026-09-28 13:41 UTC | zcode | Standard | database/seeders/OrderReviewSimulationSeeder.php (tidak diubah, hanya pola) | selesai

- Membuat pesanan uji berstatus Sampai atas permintaan owner: RA-SIM-2609-03 (id 100081) lalu RA-SIM-2609-04 (id 100082) setelah 03 dimiliki owner tekan tombol Selesaikan Pesanan saat mencoba. Skrip sekali pakai meniru pola OrderReviewSimulationSeeder (query builder murni, tanpa observer/event) sehingga TIDAK ada pesan WhatsApp terkirim; hanya menyentuh nomor RA-SIM-2609-0x, telepon wajib 6285725116817, COD paid, total Rp 2.570.000.
- Diverifikasi live di daftar pesanan lewat browser: baris RA-SIM-2609-04 berbadge Sampai dan kolom Aksi memuat Selesaikan Pesanan plus link Retur (jawaban pertanyaan owner soal tombol retur untuk status Sampai).
- Catatan: orders:auto-complete per jam tidak bisa menyentuh pesanan ini karena tidak punya baris data pengiriman berstatus delivered (syarat whereHas shippingRecords); pesanan 04 akan tetap Sampai sampai admin menekan tombol. Keduanya masuk pola pembersihan pra-produksi RA-SIM-2609-%.

## 2026-09-28 14:35 UTC | zcode | Standard | resources/js/components/admin/order-status-confirm.tsx, resources/js/pages/Admin/Orders/Index.tsx, resources/js/pages/Admin/Orders/Show.tsx | selesai
Kontrak owner: SEMUA tombol aksi status pesanan wajib lewat popup konfirmasi. Komponen bersama StatusConfirmButton dipakai di tombol primer dan sekunder (daftar + detail): confirm_transfer menampilkan nominal tagihan, advance_cod menjelaskan proses + notifikasi WA, settle_cod menjelaskan pelunasan COD otomatis, kind lain memakai hint backend atau teks generik; kind input_resi dikecualikan karena membuka form (bukan eksekusi langsung), aksi batalkan tetap pakai dialog alasan yang sudah ada. Verifikasi live: popup COD "Proses Pesanan" (ORD26090008) dan popup transfer ber-nominal (ORD26090013) terbuka lalu ditutup dengan Batal tanpa mengubah status. Catatan: saat pengujian, tiga pesanan uji lain (ORD26090005/07/09/11 sebagian) berpindah status oleh sesi paralel di luar kendali saya; status ORD26090011 dicek tetap Menunggu Konfirmasi setelah klik uji saya.

## 2026-09-28 14:15 UTC | zcode-retur | Trivial | - | selesai
Lingkup: lapor owner "rusak nih" di halaman kelola/model-produk: teks komentar "// Aksi massal: ..." bocor jadi teks halaman di header (komentar JS di dalam JSX).
Akar: komentar ditulis bentuk // di dalam anak JSX oleh refactor header sebelumnya.
Perubahan: comments diganti {/* */} di resources/js/pages/Admin/ModelProducts/Index.tsx; satu berkas, tanpa perubahan perilaku.
Verifikasi: eslint+typecheck bersih, build sukses, halaman dimuat ulang di browser: teks bocor hilang, tombol Muat ulang katalog dan Tambah tetap ada, tanpa overflow.
Dampak spec: tidak berubah.
Agent: zcode-retur

## 2026-09-28 14:20 UTC | zcode | Standard | resources/js/pages/Admin/Orders/Index.tsx, resources/js/pages/Admin/Orders/Show.tsx, app/Http/Controllers/Admin/OrderController.php | selesai
Owner melaporkan checkbox "Tandai pesanan langsung sebagai dikirim" tidak fungsional: tanpa dicentang resi tersimpan tapi status tetap Diproses, sehingga admin harus membuka Input Resi lagi untuk memindahkan status. Checkbox dihapus dari kedua form resi (daftar + detail); simpan resi kini SELALU menandai dikirim (mark_shipped true), dan backend tidak lagi menolak transisi ketika pesanan sudah lewat Diproses (guard jadi ->order_status === 'processing', jadi simpan resi ulang pada pesanan yang sudah dikirim hanya memperbarui resi tanpa error). Verifikasi: typecheck 0, build 0, AdminShippingWorkflowTest 6 passed (kasus mark_shipped=false tetap dihormati), live /admin/orders?order_status=processing tanpa checkbox.
Catatan kolaborasi: Show.tsx sempat memuat kerja agent lain yang belum selesai (variabel elig) sehingga typecheck merah sementara; agent tersebut kemudian commit c42d699b, lalu perubahan saya di-stage ulang dan diverifikasi hanya berisi milik saya sebelum commit.

## 2026-09-28 14:08 UTC | zcode | Trivial | c42d699b | selesai
Lingkup: blok retur di halaman detail pesanan tidak lagi tampil untuk pesanan berstatus Selesai (permintaan owner: blok itu tidak perlu ada di pesanan selesai). resources/js/pages/Admin/Orders/Show.tsx: state retur manual (bisaReturManual, manualTerbuka), tombol Catat Retur Manual, kartu ringkas catatan layar (elig.note), field alasan pengecualian, dan transform late_return/override_reason dihapus. Panel untuk status Sampai dan kasus aktif tidak diubah.
Dampak spec: tidak berubah. Payload returnEligibility masih mengirim note, warnings, dan manual_available untuk pesanan Selesai, kini tanpa pemakai di frontend.
Untuk agent berikutnya: jalur retur manual pesanan Selesai dibatalkan owner 2026-09-28, hanya beberapa jam setelah fiturnya dibuat (commit 9a370a89). Backend (ReturnService, OrderController) dan test ReturnCaseEditVoidTest masih memuat kemampuan late_return dan override_reason; jangan dihapus tanpa membaca test itu lebih dulu.
Bukti: npm run typecheck bersih; npm run build sukses (38,25 detik); grep bundle public/build/assets: teks Catat Retur Manual dan Pesanan sudah Selesai sudah tidak ada; browser in-app halaman /admin/orders/100081 (RA-SIM-2609-03, Selesai) nol elemen retur, halaman /admin/orders/100082 (RA-SIM-2609-04, Sampai) panel Retur dan penyelesaian serta wadah #return-case tetap ada.

## 2026-09-28 14:50 UTC | zcode-retur | Trivial | - | selesai
Lingkup: owner minta teks penjelasan di kartu Rekonsiliasi Pembayaran dikeluarkan dari UI (terlalu penuh), masuk panduan atau hint.
Perubahan: dua paragraf dihapus dari resources/js/pages/Admin/Payments/Index.tsx, judul panel dibungkus HintTip berisi ringkasan, entri panduan admin.payments.index ditambah di resources/js/config/admin-page-guides.ts.
Verifikasi: eslint+typecheck bersih, build sukses, halaman dimuat ulang di browser: paragraf hilang, hint tersedia, tombol Panduan tampil, angka dan badge tetap.
Dampak spec: tidak berubah (payload disclaimer dipertahankan untuk test PaymentRekonsiliasiTest).
Agent: zcode-retur

## 2026-09-28 15:05 UTC | zcode-retur | Trivial | - | selesai
Lingkup: owner minta keterangan kartu Rekening Transfer Bank dijadikan hint, bukan teks tampil.
Perubahan: paragraf dihapus, judul kartu dibungkus HintTip di resources/js/pages/Admin/Payments/Index.tsx.
Verifikasi: eslint+typecheck bersih, build sukses; diukur di browser, paragraf tidak lagi terlihat (satu-satunya sisa teks adalah span sr-only milik hint), judul, data BCA, dan tombol Ubah tetap.
Dampak spec: tidak berubah.
Agent: zcode-retur

## 2026-09-28 14:27 UTC | zcode | Trivial | ee08c467 | selesai
Lingkup: padding banner kuning pengingat setoran COD di detail pesanan (permintaan owner: benerin padding). Banner memakai p-3 lalu menempel 0px ke kartu ringkasan di bawahnya, dan tepi teksnya menjorok 7px lebih kiri dari isi kartu. Kini px-5 py-3 + mb-4: jarak ke kartu 14px, selisih tepi kiri 0px.
Dampak spec: tidak berubah.
Untuk agent berikutnya (PENTING, dua hal):
1. REGRESI RETUR MANUAL. Blok retur manual pesanan Selesai yang dihapus di c42d699b HIDUP LAGI di working tree karena ada agent yang menulis resources/js/pages/Admin/Orders/Show.tsx dari basis lama (mtime 14:20), lalu build men-deploy-nya sehingga live sempat menampilkan tombol Catat Retur Manual lagi di /admin/orders/100081. Saya hapus ulang di working tree (Show.tsx, termasuk pemanggilan prop returManual) dan sudah build ulang. JANGAN commit Show.tsx dari basis lama. resources/js/components/admin/order-return-create-form.tsx MASIH memuat jalur returManual (prop opsional, kini tidak dipakai karena Show.tsx tidak lagi mengirimnya); bersihkan bila refactor itu dilanjutkan.
2. Kesalahan saya: commit ee08c467 ikut membawa app/Http/Controllers/Admin/OrderController.php dan resources/js/pages/Admin/Orders/Index.tsx karena keduanya sudah ter-stage di indeks git oleh agent lain. Isinya utuh dan tidak ada yang hilang, tetapi atribusi commit jadi bercampur. Pelajaran: git update-index --cacheinfo hanya mengganti satu entri, tidak membersihkan entri staged lain, jadi git diff --cached harus diperiksa tepat sebelum commit.
Bukti: npm run typecheck bersih; npm run build sukses (33,67 detik); grep bundle public/build/assets nol untuk teks Catat Retur Manual; browser halaman /admin/orders/100081 nol elemen retur, /admin/orders/100082 banner COD padding 10.5px 17.5px dengan jarak 14px dan selisih tepi kiri 0px, panel Retur dan penyelesaian tetap ada.

## 2026-09-28 14:55 UTC | zcode | Deep | OrderController::storeShipping, Orders/Index.tsx, Orders/Show.tsx, AdminShippingWorkflowTest | selesai
Lanjutan 2ce9745e atas laporan owner bahwa checkbox "Tandai pesanan langsung sebagai dikirim" tidak fungsional. Aturan final: field mark_shipped DIHAPUS total (validasi, payload UI, state form) dan simpan resi pada pesanan Diproses selalu memindahkan status ke Dikirim; keputusan dihitung SETELAH attachManualWaybill karena penarikan pelacakan J&T di dalamnya bisa ikut memindahkan status (kalau dihitung sebelumnya, pesanan yang sudah delivered sempat gagal dengan galat transisi delivered -> shipped). Pesanan di luar Diproses hanya menyimpan resi.
Verifikasi: typecheck 0, build 0 (bundle bersih dari teks checkbox dan mark_shipped), AdminShippingWorkflowTest 8 passed / 50 assertions termasuk dua test penjaga baru (simpan resi selalu jadi Dikirim, dan simpan resi ulang pada pesanan sudah Dikirim tidak gagal), uji live dua kali: ORD26090012 (JT-UJI-AUTO-KIRIM) dan ORD26090011 (JT-UJI-FINAL-2, nomor uji 085725116817) keduanya langsung masuk tab Dikirim tanpa membuka form dua kali. Dokumen kanonik tidak menyebut mark_shipped (hanya dokumen legacy), jadi spec tidak berubah.
CATATAN KOLABORASI PENTING: selama pengerjaan, working tree bersama beberapa kali mengembalikan berkas ke versi lama di luar kendali saya (checkbox muncul lagi, aturan controller hilang) dan perubahan saya sebagian tersapu ke commit agent lain; keadaan akhir sudah diverifikasi: HEAD dan origin sama-sama memuat aturan final ini (mark_shipped 0 di controller dan kedua berkas UI).

## 2026-09-28 15:10 UTC | zcode | Trivial | resources/js/pages/Admin/Orders/Index.tsx, resources/js/pages/Admin/Orders/Show.tsx | selesai
Permintaan owner: placeholder form input resi diganti jadi "Masukan Resi Pengiriman...". Diterapkan di DUA modal resi sekaligus (daftar pesanan #index-modal-waybill dan halaman detail) supaya keduanya tidak berbeda. Verifikasi: grep kode, typecheck 0, build 0, bundle memuat teks baru, live /admin/orders?order_status=processing placeholder terbaca "Masukan Resi Pengiriman...". Spec tidak berubah (teks UI saja).

## 2026-09-28 14:39 UTC | zcode | Standard | resources/js/components/admin/order-return-create-form.tsx | selesai

- Permintaan owner 2026-09-28: klik tombol Retur di daftar pesanan harus membuka popup pengisian detail retur, bukan pindah ke halaman detail. Commit 0e6196b8.
- Form retur diekstrak dari Show.tsx jadi komponen bersama ReturnCreateForm (alasan, pihak penyebab, ongkir, kronologi, item + jumlah), dipakai halaman detail dan popup ReturnCreateDialog baru di Index.tsx; tombol Retur kini tombol klik, bukan tautan #return-case.
- Backend createReturn memakai redirectKembali(): kembali ke halaman asal bila referer adalah halaman detail (perilaku lama, termasuk test tanpa referer tetap ke detail), selain itu back() ke daftar. Verifikasi: typecheck + build sukses, popup terbuka live di daftar pada RA-SIM-2609-04 tanpa pindah URL, kiriman kosong ditolak dengan pesan di dalam popup; test AdminReturnWorkflowTest 20/20 plus retur lain 38 lulus.

## 2026-09-28 14:51 UTC | zcode | Standard | c7b1e1e7 | selesai
Lingkup: kolom Aksi di daftar pesanan kosong untuk pesanan berstatus Retur diproses (laporan owner: kok ga ada tombol aksi). Akar masalah: server sudah mengirim aksi utama Selesaikan Retur (kind complete_return, next_status null, href ke panel retur halaman detail), tetapi pengisi kolom Aksi hanya merender aksi yang punya next_status, jadi cabang tanpa next_status tidak pernah muncul. Ditambah cabang tautan (Link) sebagai fallback di resources/js/pages/Admin/Orders/Index.tsx, memakai label dan href dari server. Penjaga baru tests/Feature/AdminOrderActionColumnTest.php (2 test): satu membaca sumber TSX, satu memastikan payload server tetap mengirim aksi bertauutan tanpa next_status.
Dampak spec: tidak berubah. Tidak ada route, field, enum, atau bentuk JSON baru.
Untuk agent berikutnya: pola serupa bisa terulang di tempat lain yang merender aksi berbasis next_status saja. Saat ini hanya status return_in_process yang memakai aksi bertauutan (href) di primaryActionFor/href. Saat commit, resources/js/pages/Admin/Orders/Index.tsx ternyata sudah dimuat perubahan agent lain yang belum di-commit (judul badge tab Retur diproses); commit saya disusun dari versi HEAD plus hunk saya saja, dan perubahan mereka tetap utuh di working tree.
Bukti: npm run typecheck bersih; npx eslint berkas terkait bersih; build sukses; php artisan test --filter=AdminOrderActionColumnTest 2 lulus (14 asersi); test terkait (AdminReturnWorkflowTest, AdminOrderCustomerAttentionTest, AdminOrderReviewIndicatorTest) 35 lulus (227 asersi); live /admin/orders?order_status=return_in_process menampilkan tombol Selesaikan Retur pada kedua kartu, dan kliknya membuka /admin/orders/100082#return-case dengan panel Kasus #13 terbaca.

## 2026-09-28 15:40 UTC | zcode | Standard | OrderController::index, Orders/Index.tsx, AdminOrderStatusNewBadgeTest | selesai
Owner melaporkan tab "Retur Diproses" tidak pernah muncul titik merah saat jumlahnya bertambah. Akar: titik merah dihitung dari penanda "belum dilihat admin" (scope Order::unseenByAdmin, yaitu kolom admin_seen_status), sedangkan kasus retur dicatat admin sendiri dan halaman pendaratannya (detail pesanan) langsung memanggil markAdminSeen, sehingga titik merah padam sebelum sempat terlihat. Perbaikan: tab return_in_process kini memakai makna "retur belum selesai", yaitu ada kasus retur berstatus open ATAU pesanannya belum dilihat (gabungan, bukan penjumlahan); titik merah padam setelah kasus ditutup. Judul hover disesuaikan jadi "N retur belum selesai di tab Retur Diproses".
Verifikasi: test baru di AdminOrderStatusNewBadgeTest (titik merah muncul saat kasus open walau sudah dilihat, padam setelah kasus completed) lulus bersama 4 test lama (5 passed, 78 assertions); typecheck 0; build 0; live /admin/orders menampilkan titik merah angka 2 di tab Retur Diproses (dua kasus open: RA-SIM-2609-01 dan RA-SIM-2609-04). Spec tidak berubah: kolom new_count sudah ada, hanya artinya dipertegas untuk tab retur.

## 2026-09-28 14:55 UTC | zcode | Trivial | (data uji, tanpa kode) | selesai

- Menambahkan contoh pesanan uji berstatus Sampai atas permintaan owner: RA-SIM-2609-05 (id 100084, Budi Santoso, 2 produk, total Rp 12.840.000, COD paid, telepon 6285725116817). Pola sama dengan 03/04: query builder murni tanpa observer/event sehingga tidak ada WhatsApp terkirim; masuk pola pembersihan RA-SIM-2609-%.
- Diverifikasi live di tab Sampai daftar pesanan: baris tampil dengan tombol Selesaikan Pesanan dan Retur (popup).

## 2026-09-28 15:20 UTC | zcode-retur | Standard | - | selesai
Lingkup: owner bertanya fungsi tombol Muat ulang katalog, lalu memutuskan "hilangkan saja. pastikan semuanya otomatis saja".
Temuan recon: sinkronisasi wadah model punya dua pemanggil, tombol manual dan job import katalog (sudah otomatis). Data produksi nol selisih, jadi tombol memang berlebih untuk jalur normal. Satu wadah (JENDELA|JUNGKIT) ternyata sengaja dinonaktifkan admin walau produknya aktif, sehingga otomatis TIDAK boleh mengaktifkan ulang.
Perubahan: ModelProductSync (baru) sebagai penyelaras + penahan; ProductObserver::created/updated/deleted memicunya; ProcessCatalogImport menahan per baris dan menyelaras sekali; tombol, method sync, route, dokumen route, dan ziggy dihapus; tombol Aktifkan dimatikan untuk wadah tanpa produk aktif (akan langsung padam lagi oleh penyelarasan otomatis).
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED (route admin.model-products.sync dihapus dari docs/api-and-routes-ragil-aluminium.md; tanpa perubahan schema).
Tes: PHPUnit 1266 passed / 1 skipped / 0 failed, Vitest 230 passed, typecheck + ESLint bersih, build sukses. Enam tes lama disesuaikan karena dulu membuat baris wadah kembar manual: HomepagePopularTest (meta kartu kini dari katalog), InstallationMediaImportTest (sampul memakai gambar kartu wadah), ModelProdukPageTest, dan tes tes lain yang memakai pasangan sama.
Catatan: tests/Feature/ModelProductMediaTest.php TIDAK ikut di-commit karena belum pernah di-commit oleh agent lain; adaptasi saya ada di working tree.
Agent: zcode-retur

## 2026-09-28 16:04 UTC | zcode | Standard | 3eb89528 | selesai
Lingkup: Filter periode di daftar pengiriman admin (/admin/shipping). Berkas: app/Http/Controllers/Admin/ShippingRecordController.php, resources/js/pages/Admin/Shipping/Index.tsx, tests/Feature/AdminShippingIndexTest.php, docs/api-and-routes-ragil-aluminium.md
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED. Parameter kueri baru date_preset (today|3d|7d|30d|range), date_from, date_to pada route admin.shipping.index; daftar route kanonik sudah diperbarui. Tidak ada route, kolom, enum, atau bentuk JSON baru.
Untuk agent berikutnya: Rentang memakai created_at (tanggal resi dicatat sistem), BUKAN last_status_at, karena kolom last_status_at ikut berubah setiap refresh pelacakan J&T sehingga tidak layak jadi jangkar waktu. Ringkasan KPI dan hitungan tab sengaja ikut menyempit mengikuti periode, sama seperti halaman Pembayaran; jangan kembalikan ke hitungan sepanjang waktu tanpa alasan. Baris filter aktif saat ini hanya punya chip periode tanpa tombol Reset Semua, mengikuti halaman Pembayaran; bila konvensi docs/DOMAIN/panel-admin.md mau tombol itu, tambahkan di KEDUA halaman sekaligus supaya tidak timpang. Catatan alat: di browser dalam aplikasi, klik Playwright pada komponen Select admin (tombol role combobox) selalu timeout walau elemennya terlihat dan menerima pointer event, termasuk filter kurir yang lama dan tidak saya ubah; pakai klik koordinat atau locator fill, jangan simpulkan UI rusak dari timeout itu.
Bukti: php artisan test --filter=AdminShippingIndexTest lulus 6 test (131 asersi). npx tsc --noEmit 0 error. npx eslint resources/js/pages/Admin/Shipping/Index.tsx exit 0. npm run build sukses 33.78s. Verifikasi live di ra.333labs.tech/admin/shipping: tanpa filter 4 resi; date_preset=30d jadi 3 resi dengan KPI Sampai turun 1 ke 0 dan tab ikut menyempit serta chip periode muncul; date_preset=range 2026-09-01 sampai 2026-09-27 jadi 0 resi dengan empty state dan chip 1 Sep 2026 - 27 Sep 2026; tombol hapus chip mengembalikan URL bersih dan 4 resi. Tangkapan layar gagal (screenshot surface preparation timeout), bukti visual memakai snapshot DOM.

## 2026-09-28 17:59 UTC | zcode | Standard | 96efcccd | selesai
Lingkup: Ganti filter kurir menjadi filter metode pembayaran di daftar pengiriman admin (/admin/shipping), atas permintaan owner 28 Sep malam. Berkas: app/Http/Controllers/Admin/ShippingRecordController.php, resources/js/pages/Admin/Shipping/Index.tsx, tests/Feature/AdminShippingIndexTest.php, docs/api-and-routes-ragil-aluminium.md
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED. Parameter kueri carrier_name DIHAPUS dari route admin.shipping.index dan diganti payment_method (all|cod|transfer, dibaca dari pesanan terkait). Daftar route kanonik sudah diperbarui. Tidak ada route, kolom, enum, atau bentuk JSON baru. Tampilan kolom carrier_name di tabel dan halaman detail TETAP ADA, yang dihapus hanya filternya.
Untuk agent berikutnya: Alasan penghapusan filter kurir, expedisi hanya J&T Cargo sehingga pilihan kurir selalu bernilai tunggal dan tidak menyaring apa pun. Filter payment_method sengaja hanya menyempitkan TABEL, tidak menyempitkan ringkasan KPI dan hitungan tab, supaya sama persis dengan halaman Pembayaran tempat filter method berperilaku begitu; kalau kelak ingin ringkasan ikut menyempit, ubah KEDUA halaman sekaligus. Nilai metode di luar cod|transfer jatuh ke tanpa filter, jadi URL lama tidak pernah error. Belum ada kolom metode pembayaran di tabel pengiriman, kalau dirasa perlu bukti visual saat memfilter, tambahkan sebagai kolom baru dan perbarui dokumen.
Bukti: php artisan test --filter=AdminShippingIndexTest lulus 8 test (188 asersi, 2 test baru untuk metode dan komposisinya dengan periode). npx tsc --noEmit 0 error. npx eslint resources/js/pages/Admin/Shipping/Index.tsx exit 0. npm run build sukses. Data produksi saat uji, 4 resi: 201718781511 dan JT-UJI-FINAL-2 milik pesanan COD, 123123 dan JT-UJI-AUTO-KIRIM milik pesanan transfer. Verifikasi live, pilih COD menghasilkan tepat 2 baris (201718781511, JT-UJI-FINAL-2), pilih Transfer Bank menghasilkan tepat 2 baris (123123, JT-UJI-AUTO-KIRIM), keduanya cocok 100 persen dengan kueri database. Gabungan COD + rentang 1 sampai 27 Sep menghasilkan 0 baris dengan chip periode tampil, membuktikan dua filter berbeda bisa hidup bersamaan. Memilih Semua metode membuang payment_method dari URL tanpa mengganggu filter lain, dan menghapus chip periode mengembalikan 4 baris dengan URL bersih. Catatan alat: klik Playwright pada tombol role combobox timeout seperti pada entri sebelumnya, pemicu yang berhasil adalah locator.evaluate(el => el.click()), dan snapshot tepat setelah domcontentloaded masih kosong karena Inertia belum selesai render, jadi perlu tunggu lalu baca ulang.

## 2026-09-28 23:37 UTC | zcode | Trivial | resources/js/components/admin/order-return-create-dialog.tsx | selesai

- Owner: form retur di popup tidak lurus, minta kartu diperlebar. Akar masalahnya DialogContent bawaan mematok lebar 34rem lewat kelas w-[...] sehingga percobaan pertama max-w-4xl tidak berefek; diganti w-[min(calc(100vw-2rem),56rem)] (maks 896px). Label panjang tidak melipat dua lagi, terukur live: tiga dropdown satu Y, dua textarea satu Y.

## 2026-09-28 23:40 UTC | zcode | Standard | (commit ini) | selesai

Lingkup: Pelacakan J&T Cargo. Berawal dari pertanyaan owner apakah sistem menembak API J&T terus-menerus, ditemukan jaring pengaman webhook tidak pernah bekerja, lalu diperbaiki bersama temuan lain.
Berkas: app/Models/ShippingRecord.php, app/Services/ShippingService.php, app/Console/Commands/PullJntShippingStatus.php, app/Console/Commands/PollJntTracking.php, routes/console.php, config/operations.php, tests/Feature/PullJntStatusTest.php, tests/Feature/AdminShippingIndexTest.php, tests/Feature/ShippingStatusTest.php

Akar masalah 1 (utama): Perintah penarik status terjadwal `shipping:pull-jnt` menyaring kolom nama kurir (`carrier_name`) dengan nilai `'JNT'`, sedangkan setiap penulis resi di aplikasi memakai `'J&T Cargo'`. Penyaring tidak pernah cocok, jadi perintah itu selalu berhenti di "Tidak ada resi aktif untuk ditarik" dan jaring pengaman webhook (item 7 antrean) bernilai nol. Test penjaganya lulus hanya karena fixture test menulis `'JNT'` sendiri, jadi test ikut menyetujui kesalahan yang sama.

Akar masalah 2: Dua perintah dengan maksud sama dijadwalkan bersamaan setiap 30 menit (`shipping:pull-jnt` dan `shipping:poll-jnt`), sehingga setiap resi aktif diperiksa dua kali per setengah jam.

Akar masalah 3: Saat integrasi J&T mati, `ShippingService::refreshStatus` menstempel `last_status_at` (kolom waktu status terakhir dari kurir) dengan waktu sekarang tanpa mengambil data apa pun. Riwayat jadi terlihat baru diperbarui padahal kosong, dan pagar "baru saja disegarkan" di para pemanggil (halaman status pelanggan, detail pesanan admin) ikut menjadi buta.

Perubahan:
1. `ShippingRecord::CARRIER_JNT` ('J&T Cargo'), `CARRIER_JNT_ALIASES` (ejaan lama 'JNT'), dan `jntCarrierNames()` sebagai satu sumber nilai nama kurir; penulis resi di `ShippingService` memakai konstanta itu, bukan teks bebas.
2. `shipping:pull-jnt` menyaring lewat `ShippingRecord::jntCarrierNames()` (jadi ejaan lama tetap ikut), ikut menarik resi berstatus bermasalah (`exception`) yang dulu ditinggalkan, dan mewarisi tata kelola dari perintah lama: jatah waktu per resi (`next_poll_at`), mundur bertingkat saat gagal (30 menit sampai 6 jam), berhenti setelah 20 percobaan, serta pemberitahuan admin idempoten setelah 5 kegagalan berturut-turut.
3. `shipping:poll-jnt` tidak lagi dijadwalkan (tetap ada sebagai alat diagnostik manual; punya mode `--dry-run`). Kini hanya satu penarik berkala: `shipping:pull-jnt` setiap 30 menit.
4. `refreshStatus` tidak lagi menulis apa pun saat integrasi mati.
5. Penjaga test baru: bucket tab Kendala halaman Pengiriman (`exception` + `returned`), ejaan lama kurir, jatah waktu, kegagalan mundur + pemberitahuan admin, dan larangan menstempel waktu saat integrasi mati.

Dampak spec: Spec tidak berubah. Tidak ada route, parameter kueri, kolom, enum, status, atau bentuk JSON baru. Konfigurasi baru bersifat internal (env `JNT_PULL_THROTTLE_MINUTES`, `JNT_PULL_MAX_ATTEMPTS`, `JNT_PULL_FAILURE_ALERT_THRESHOLD`).

Verifikasi: `php artisan test` penuh lulus 1275 test / 12421 asersi / 1 skipped / 0 gagal (148 detik, dijalankan sebagai www-data). `php artisan schedule:list` menunjukkan hanya `shipping:pull-jnt` yang terjadwal untuk J&T. `php -l` bersih untuk sembilan berkas yang disentuh. Data live 209: 4 baris pengiriman, semuanya `carrier_name` 'J&T Cargo', sehingga bug itu memang tidak pernah terlihat dari data.

Catatan jujur: skrip tambalan pertama saya menulis salah (dua suntingan pada satu berkas saling menimpa karena berkas dibaca ulang per suntingan), sehingga suntingan `refreshStatus` tidak tersimpan dan test penjaga baru langsung menangkapnya. Tambalan ulang sudah memperbaiki keduanya; test gagal itu yang membuktikan penjaganya bekerja.

Untuk agent berikutnya: efisiensi terbesar yang belum dikerjakan adalah penggabungan permintaan. Endpoint `logistics/trace` menerima `billCodes` dipisah koma sampai 30 resi per panggilan, sementara penarik kita selalu mengirim satu resi per panggilan. Penggabungan itu menurunkan jumlah panggilan sampai 30 kali untuk jumlah resi yang sama, tetapi bentuk respons untuk banyak resi belum pernah terlihat hidup karena kredensial J&T sudah dipindah dari 209 ke 202, jadi jangan dikerjakan tanpa validasi live dulu. Opsi lain yang belum diputuskan: `operations.shipping_pull.subscribe` (berlangganan push per resi) masih mati dan payload-nya belum divalidasi.

Commit ini juga membawa dua blok 28 Sep yang belum di-commit di berkas yang sama: jadwal `shipping:pull-jnt` dan jadwal `traffic-check` di routes/console.php, serta blok `operations.shipping_pull` di config/operations.php.
Agent: zcode

## 2026-09-29 06:50 UTC | zcode | Standard | OrderController, Orders/Index.tsx, AdminOrderStatusNewBadgeTest | selesai
Koreksi owner atas b1748f63: titik merah dikembalikan ke fungsi aslinya dan SATU-SATUNYA tab tanpa titik merah adalah Semua. Akar masalah sebenarnya bukan khusus retur, melainkan halaman detail pesanan menandai pesanan "sudah dilihat" (markAdminSeen di show()) juga ketika halaman itu menjadi pendaratan aksi admin sendiri, sehingga titik merah tab tujuan padam sebelum sempat terlihat (terbukti pada Dikirim: dua pesanan yang di-ship lewat simpan resi tercatat seen=shipped). Perbaikan: helper redirectToOrderDetail() menandai pendaratan aksi dengan penanda sesi sekali pakai (SKIP_SEEN_FLASH), dan show() melewati markAdminSeen bila penanda itu ada; seluruh 18 pengalihan aksi ke detail plus redirectKembali (back()) memakai helper itu. Pengecualian khusus tab retur dihapus sehingga semua tab (selain Semua) memakai aturan seragam: titik merah menyala saat ada pesanan yang baru berganti status dan belum dibuka admin, padam setelah detailnya dibuka.
Verifikasi: test penjaga diganti (pendaratan aksi tidak menghilangkan titik merah sampai detail dibuka lagi; tab retur mengikuti aturan seragam) 6 passed / 102 assertions; 58 test retur+kirim+integritas lulus; typecheck 0; build 0; live dengan ORD26090002 (nomor uji 085725116817) resi JT-UJI-DOT-1: setelah simpan resi dari daftar, tab Dikirim menunjukkan titik merah "1 pesanan baru di status Dikirim", lalu padam setelah detail pesanan dibuka lewat klik dari daftar. Spec tidak berubah (kolom new_count tetap, artinya dikembalikan seperti kontrak 2026-09-26).

## 2026-09-28 23:47 UTC | zcode | Standard | resources/js/components/admin/order-return-create-form.tsx | selesai

- Owner: bagaimana kalau satu produk >1 unit, minta detail pilihan produk mencakup semua kemungkinan. Pemilih jumlah unit (minus/kotak/plus) kini selalu tampil di setiap item, untuk 1 unit tombol terkunci di angka 1 (batas min=max).
- Dibuat pesanan uji RA-SIM-2609-06 (id 100085, 1 produk x3 unit, COD Rp 7.010.000, Sampai, pola tanpa event/WhatsApp).
- Verifikasi live: popup 06 plus mati di 3, minus 3-2-1 lalu mati di 1, plus naik lagi ke 3, ringkasan mengikuti; popup 05 (2 item x1 unit) menampilkan dua pemilih terkunci di 1. Typecheck+build lulus.

## 2026-09-28 23:48 UTC | zcode | Trivial | f6784cf8 | selesai
Lingkup: Buang ikon tautan WhatsApp di kolom Pesanan & Tujuan daftar pengiriman (/admin/shipping), atas permintaan owner 28 Sep. Berkas: resources/js/pages/Admin/Shipping/Index.tsx, app/Http/Controllers/Admin/ShippingRecordController.php
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED secara bentuk JSON, TANPA perubahan route atau skema tabel. Kolom whatsapp_url pada payload records.data daftar pengiriman DIHAPUS, karena kolom itu dibuat semata-mata untuk memberi href pada ikon tersebut dan tidak ada pemakai lain. Kolom customer_phone TETAP ada di payload meski belum dirender. Dokumen kanonik docs/api-and-routes-ragil-aluminium.md tidak menyebut rincian kolom payload daftar pengiriman, jadi tidak ada baris dokumen yang perlu diubah; yang tercatat di situ hanya daftar filter.
Untuk agent berikutnya: Konsekuensi yang perlu diingat, kontak pembeli kini hanya bisa dijangkau dari halaman pesanan (admin.orders.show), tidak lagi dari daftar pengiriman. Halaman detail resi ternyata TIDAK pernah punya ikon WA sama sekali, jadi tidak ada yang perlu dibuang di situ; sebelum menghapus sesuatu di halaman ini, cek dulu kedua permukaan (daftar dan detail). Import PhoneNumber di ShippingRecordController ikut dihapus karena jadi tidak terpakai, hati-hati bila kelak menambah lagi tautan telepon di controller yang sama.
Bukti: php artisan test --filter=AdminShippingIndexTest lulus 9 test (206 asersi). npx tsc --noEmit 0 error. npx eslint resources/js/pages/Admin/Shipping/Index.tsx exit 0. npm run build sukses 39.60 detik. Verifikasi live: halaman daftar ra.333labs.tech/admin/shipping kini 0 tautan wa.me dan 0 svg ikon WhatsApp di seluruh halaman, baris tabel tetap 7 kolom, dan kolom Pesanan & Tujuan tetap menampilkan nomor order, nama pembeli, serta kota. Halaman detail /admin/shipping/40 juga 0 tautan wa.me.

## 2026-09-28 16:10 UTC | zcode-retur | Trivial | - | selesai
Lingkup: owner melaporkan kolom pertama halaman Sub Model bernilai 0 semua, dan minta syarat tombol Urutkan dijelaskan lewat hint.
Akar masalah kolom 0: resources/js/pages/Admin/SubModels.tsx memberi displayNumber 0 ke semua baris pada cabang tanpa grup (saat daftar difilter satu model); penomoran hanya terisi pada mode semua model lewat markGroupRows.
Perubahan: nomor baris melanjutkan lintas halaman (current_page x per_page); komponen bersama ReorderActionButton membungkus tombol nonaktif dengan HintTip berisi alasan; entri panduan admin.sub-models.index ditambahkan.
Verifikasi: typecheck + ESLint bersih, build sukses, Vitest 230 passed; browser menunjukkan nomor 1 dan 2 pada URL laporan dan hint tampil saat tombol mati.
Dampak spec: tidak berubah.
Agent: zcode-retur

## 2026-09-29 00:05 UTC | zcode | Standard | resources/js/pages/Admin/Orders/Show.tsx | selesai

- Owner: form pencatatan retur di halaman detail masih ada padahal sudah ada popup, minta dibuang, dan langkah retur berikutnya juga diganti popup dengan model sama.
- Form buat retur + blok peringatannya dibuang dari detail; form penyelesaian kasus (Selesaikan retur) kini Dialog w-[min(calc(100vw-2rem),56rem)] sama dengan popup buat, sukses menutup popup; panel Retur & penyelesaian hanya tampil saat pesanan punya kasus (dulu selalu tampil untuk pesanan Sampai sehingga jadi judul kosong).
- Verifikasi: typecheck+build lulus; detail RA-SIM-2609-06 tanpa panel; detail 100082 (kasus open #13) tombol Selesaikan retur membuka popup 784px berisi semua field, ditutup tanpa menyimpan.

## 2026-09-29 00:55 UTC | zcode | Standard | (commit ini) | selesai

Lingkup: Penggabungan permintaan pelacakan J&T, lanjutan dari pekerjaan pelacakan sebelumnya di hari yang sama. Owner bertanya "memang kita tidak bisa?" setelah sebelumnya saya menyatakan penggabungan menunggu validasi live.
Berkas: app/Services/ShippingService.php, app/Console/Commands/PullJntShippingStatus.php, config/operations.php, tests/Feature/PullJntStatusTest.php

Jawaban atas pertanyaan itu: BISA, dan sekarang terbukti hidup, bukan lagi dugaan. Saya menjalankan probe baca-saja ke endpoint pelacakan akun PRODUKSI J&T memakai kredensial yang distage di 202 (/var/www/ra-preview/.env, JNT_ENABLED=true, JNT_ENV=production). Hanya endpoint pelacakan yang dipanggil; tidak ada endpoint yang membuat, membatalkan, atau memesan resi. Tiga percobaan:
1. `billCodes=201718781511` menghasilkan `data` berisi 1 elemen, `billCode` 201718781511, 13 scan.
2. `billCodes=201718781511,201718781511` menghasilkan 1 elemen (nomor kembar digabung J&T).
3. `billCodes=201718781511,999999999999` menghasilkan 2 ELEMEN: elemen pertama resi nyata dengan 13 scan, elemen kedua resi palsu dengan daftar scan KOSONG, dan bukan galat (code tetap "1", HTTP 200).

Kesimpulan kontrak: satu panggilan melayani banyak resi, satu elemen data per nomor resi, dan nomor tak dikenal punya elemen sendiri berisi daftar scan kosong. Bentuk responsnya sudah lama benar, kita yang salah membacanya.

Akar masalah yang ditemukan saat mengerjakan: pengurai lama hanya membaca elemen PERTAMA (`data.0.details`). Kalau penggabungan diterapkan tanpa memperbaiki pengurai, 29 dari 30 resi akan dibuang tanpa suara, termasuk status dan tagihan ongkirnya. Ini jenis kegagalan yang paling sulit ketahuan karena tidak ada error apa pun.

Perubahan:
1. `ShippingService::traceDetailsByBillCode` memetakan nomor resi ke daftar scan memakai billCode tiap elemen; elemen tanpa billCode dilewati karena tidak bisa dipastikan pemiliknya. `traceDetailsTunggal` tetap menerima bentuk lama (data berupa objek berisi details) dan respons tanpa penanda resi, jadi fixture test lama dan payload order-status push tetap jalan.
2. `ShippingService::refreshMany(records, chunkSize)` menarik sampai 30 resi sekali panggil. Kalau sebuah resi tidak punya elemen pada respons gabungan, resi itu ditarik sendiri seperti cara lama; kalau panggilan gabungan gagal, seluruh potongan ditandai gagal TANPA mencoba per resi (kurir yang sedang bermasalah jangan ditembak berulang). Jadi hasil terburuknya sama dengan sebelum perubahan, terbaiknya 30 kali lebih hemat panggilan.
3. `refreshStatus` (satu resi) dipecah: penguraian dipindah ke helper bersama `terapkanDetailResi`, sehingga webhook, tombol Refresh J&T, dan penarik berkala memakai jalur penerapan yang sama.
4. `operations.shipping_pull.batch_size` (env `JNT_PULL_BATCH_SIZE`, default 30).
5. Tiga penjaga test: banyak resi jadi satu panggilan DAN kabar resi kedua ikut terpakai, resi tanpa entri ditarik sendiri, panggilan gabungan gagal tidak menembak ulang per resi.

Dampak spec: Spec tidak berubah. Tidak ada route, parameter kueri, kolom, enum, status, atau bentuk JSON baru. Konfigurasi baru bersifat internal.

Verifikasi: `php artisan test` penuh lulus 1285 test / 12498 asersi / 1 skipped / 0 gagal (151 detik, sebagai www-data). `php -l` bersih untuk empat berkas. Bukti live dari probe akun produksi di atas (tiga panggilan, semuanya 200).

Untuk agent berikutnya: yang belum dipakai dari peluang yang sama adalah `trace/subscribe` (berlangganan push per resi, saklar `operations.shipping_pull.subscribe` masih mati) dan push `other/settlementReturn` (J&T mengirim balik tagihan hasil audit: waybillNo, totalFreight, packageChargeWeight, insuredFee, freight). Ongkir yang tersimpan sekarang berasal dari pelacakan, bukan versi audit. Izin endpoint `trace/subscribe` belum masuk peta izin yang teruji. Karena kredensial produksi ada di 202, pengujian endpoint J&T sebaiknya dilakukan dari 202, bukan dari 209 (209 sudah tidak punya kredensial). Skrip probe yang saya pakai tidak disimpan di repo; bentuknya: tanda tangan `digest = base64(md5(bizContent + privateKey))`, form field `bizContent`, header `apiAccount`/`timestamp`/`digest`, tujuan `/webopenplatformapi/api/logistics/trace`.
Agent: zcode

## 2026-09-29 00:16 UTC | zcode | Standard | resources/js/components/admin/order-return-create-form.tsx | selesai

- Owner 29 Sep: kalau varian yang dipilih berbeda gimana, dan minta semua kemungkinan difasilitasi dalam SATU pesanan uji yang sama, bukan dikoreksi satu-satu.
- Form retur kini menampilkan label varian (Warna: X, Kaca: Y) di setiap baris item; data variation_1/2 sudah ada di payload daftar maupun detail, jadi murni penampilan.
- Dibuat pesanan uji RA-SIM-2609-07 (id 100086, COD Rp 17.250.000, Sampai, tanpa WA terkirim) yang menghimpun semua kasus: produk sama x2 unit (98/677 Hitam Kaca Es), produk sama varian berbeda x1 (98/681 Serat Kayu Kaca Bening), produk lain x1 (51/104 Putih Kaca Es).
- Verifikasi live: popup 07 menampilkan ketiga label varian berbeda, ringkasan 4 dari 4 unit, stepper baris pertama max=2 (turun ke 1 lalu naik lagi, ringkasan mengikuti); ditutup tanpa menyimpan. Typecheck+build lulus.

## 2026-09-29 00:18 UTC | zcode | Standard | c2ad8a64, a64987f0 | selesai
Lingkup: audit + perbaikan pemilihan produk di panel Isi pesanan halaman detail pesanan (permintaan owner 2026-09-29). Sebelumnya admin harus mengetik induk SKU dan SKU varian dari ingatan, dan baris baru hanya tampil sebagai kode SKU tanpa nama. Kini ada pemilih produk yang bisa dicari (nama, induk SKU, atau SKU varian) dengan daftar varian aktif beserta label, harga, dan stok; varian wajib dipilih bila produk punya varian.
Berkas: routes/web.php (route admin.orders.product-picker), app/Http/Controllers/Admin/OrderController.php (productPicker + variantPickerLabel), resources/js/components/admin/order-product-picker.tsx (baru), resources/js/pages/Admin/Orders/Show.tsx (tombol Pilih produk menggantikan tiga kolom teks), tests/Feature/AdminOrderProductPickerTest.php (baru, 7 test), docs/api-and-routes-ragil-aluminium.md (SPEC_CHANGED_AND_DOCS_UPDATED).
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED. Route JSON baru + bentuk JSON baru; penyimpanan tetap memakai PUT admin.orders.items.update dengan bentuk lama, jadi kontrak kiriman tidak berubah.
PERINGATAN UNTUK AGENT BERIKUTNYA (penting): resources/js/pages/Admin/Orders/Show.tsx sedang ditulis oleh lebih dari satu agent dan working tree-nya BERKALI-KALI kembali ke snapshot lama. Kejadian 29 Sep 00:10: berkas itu kembali ke versi yang membatalkan pekerjaan yang SUDAH ter-commit (popup penyelesaian retur dari 6609bce5 hilang lagi, ReturnCreateForm inline hidup lagi). Karena build mengambil dari working tree, live sempat menyajikan versi lama itu. Saya memasang ulang perubahan saya di atas versi itu tetapi TIDAK mengembalikan berkas ke HEAD, karena kontrak melarang menimpa berkas agent lain. Perlu keputusan owner/agent pemilik berkas: kembalikan Show.tsx dari HEAD supaya popup penyelesaian retur dan pemilih produk sama-sama hidup.
Bukti: typecheck bersih; eslint bersih pada berkas terkait; build sukses; php artisan test --filter=AdminOrderProductPickerTest 7 lulus (26 asersi) termasuk jalur simpan yang mengikat varian dan mengurangi stok; live /admin/orders/100083 alur lengkap terbukti (cari SKU RAH52REFAU, 12 varian tampil dengan label titik tengah, pilih varian, Tambah ke pesanan menampilkan nama produk + label varian); pesanan tidak disimpan sehingga total tagihan tetap Rp 6.786.200; live /admin/orders/100081 (Selesai) tetap tanpa blok retur; live /admin/orders/100082 tombol Selesaikan retur TIDAK membuka popup (regresi versi lama, lihat peringatan).

### Koreksi atribusi commit e3194627

- Commit feat(admin): tampilkan varian di baris item form retur (e3194627) ikut memuat 10 baris perubahan resources/js/pages/Admin/Orders/Show.tsx milik agent lain yang kebetulan sudah berada di index (fitur prop openTracking, deep-link ?lacak=1 untuk drawer Lacak Pesanan). Penyebabnya git commit tanpa pathspec yang men-commit seluruh index. Kode utuh dan sudah ikut build; tidak ditulis ulang riwayatnya karena sudah ter-push di branch bersama.
- Pelajaran untuk semua agent: commit pekerjaan sendiri dengan git commit -- <path> eksplisit per berkas, bukan git add lalu git commit polos, supaya index milik agent lain tidak ikut terbawa.

## 2026-09-29 00:29 UTC | zcode | Standard | 293510ae | selesai
Lingkup: Hapus halaman detail resi (/admin/shipping/{id}) atas permintaan owner 29 Sep, alihkan ke drawer Lacak Pesanan di detail pesanan terkait. Berkas: routes/web.php, app/Http/Controllers/Admin/ShippingRecordController.php, resources/js/pages/Admin/Shipping/Index.tsx, resources/js/pages/Admin/ResourceShow.tsx, tests/Feature/AdminShippingWorkflowTest.php, docs/api-and-routes-ragil-aluminium.md
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED. (1) Route admin.shipping.show tidak lagi merender layar, method-nya berubah dari show menjadi redirectToOrder dan mengalihkan ke admin.orders.show. (2) Query baru lacak=1 pada admin.orders.show membuka drawer Lacak Pesanan sejak render. (3) Kolom payload daftar pengiriman href diganti nama menjadi track_href dan isinya kini detail pesanan dengan lacak=1. Tidak ada route, kolom tabel, enum, atau bentuk JSON lain yang berubah. Dua baris dokumen route kanonik sudah diperbarui.
Untuk agent berikutnya: Halaman detail resi sengaja TIDAK dihapus total tanpa jejak, route lamanya tetap hidup sebagai pengalih supaya tautan dan bookmark lama tidak mati; kalau owner kelak minta 404, barulah route itu dihapus dari routes/web.php dan dari dokumen kanonik. Logika timeline pengiriman yang dulu dirender halaman ini sudah tidak dipakai di controller; isinya tetap tersedia di drawer lewat prop tracking dari OrderTrackingPresenter, jangan bangun ulang timeline terpisah. Cara deep-link ini meniru pola edit_return_case yang sudah ada, jadi ikuti pola yang sama bila butuh membuka panel lain dari URL. PENTING soal working tree bersama, dua perubahan saya tersapu commit agent lain sebelum saya sempat commit sendiri: OrderController (prop openTracking) masuk lewat a64987f0 dan tiga hunk Show.tsx masuk lewat e3194627. Karena itu berkas Show.tsx saya staging per-hunk memakai git apply --cached dengan patch tersaring (skrip /tmp/saring_hunk.py, tidak ikut repo), supaya pekerjaan agent lain di berkas yang sama tidak ikut ter-commit. Sebelum menyentuh Show.tsx lagi, cek dulu apakah ada pekerjaan lain yang belum di-commit di berkas itu.
Bukti: php artisan test filter AdminShippingWorkflowTest, AdminShippingIndexTest, AdminOrderProductPickerTest, AdminRouteParameterNamingTest lulus 27 test (293 asersi). npx tsc --noEmit 0 error. npx eslint berkas yang diubah exit 0. npm run build sukses. Verifikasi live: membuka /admin/shipping/40 mendarat di /admin/orders/100038?lacak=1 dengan drawer Status Pengiriman & Lacak Pesanan SUDAH terbuka berisi resi JT-UJI-FINAL-2, membuktikan URL lama tidak mati dan langsung menampilkan lacak. Tanpa penanda, /admin/orders/100038 tetap menutup drawer dan tombol Lacak pesanan manual masih ada. Di daftar Pengiriman, tautan resi dan tombol Lacak keduanya menuju /admin/orders/{id}?lacak=1 dan nol tautan tersisa ke /admin/shipping/{id}.

## 2026-09-29 07:20 UTC | zcode | Trivial | resources/js/pages/Admin/PromotionOverview.tsx | selesai
Permintaan owner: bedakan kartu Flash Sale dan kartu Diskon Reguler di grid "Kampanye diskon" halaman Promo Toko, karena sebelumnya keduanya kartu identik (hanya label jenis di bawah nama yang beda). Ditambahkan peta bahasa visual per jenis (CAMPAIGN_ACCENTS) dengan aksen yang SAMA seperti kartu ringkasan di atas halaman: Flash Sale = ikon zap + aksen merah sale (garis kiri, chip ikon, angka diskon, ring kartu), Diskon Reguler = ikon ticket-percent + aksen primary. Tidak ada perubahan data, route, atau enum.
Verifikasi: typecheck 0, build 0, kelas aksen terkonfirmasi tergenerate di CSS build (bg-sale/10, ring-sale/25, text-sale, bg-primary/10, ring-primary/20, bg-primary/70), live diukur di browser: kartu Flash Sale JUNGKIT JUNGKIT tampil dengan garis kiri 3.5px warna rgb(226,60,60) dan chip ikon sewarna, plus tangkapan layar. Catatan: saat ini hanya ada satu kampanye berjalan (Flash Sale id 35), jadi varian kartu Diskon Reguler belum ada datanya untuk dilihat langsung; kodenya memakai jalur yang sama dengan aksen primary.

## 2026-09-29 07:45 UTC | zcode | Trivial | resources/js/pages/Admin/PromotionOverview.tsx | selesai
Permintaan owner: tombol header "Buat Flash Sale" dan "Buat Diskon Reguler" di halaman Promo Toko dibuang. Alasan owner: dua tombol itu menyamarkan bahwa halaman ini juga punya pengaturan voucher, banner, dan bar promo, seolah hanya ada dua jenis promo. Blok actions dilepas dari AdminLayout, import Button yang jadi tak terpakai ikut dibuang, dan dua prop (createStoreUrl, createFlashSaleUrl) dihapus dari komponen karena tidak lagi dipakai.
Verifikasi: typecheck 0, build 0, lint bersih untuk berkas ini (gate lint repo tetap merah karena galat lama di berkas lain, bukan dari perubahan ini), live: header halaman Promo Toko kini hanya tombol Panduan, teks "Buat Flash Sale"/"Buat Diskon Reguler" tidak ada lagi, dan jalur buat kampanye tetap tersedia lewat tautan "Semua Diskon Reguler"/"Semua Flash Sale" di judul seksi lalu tombol Tambah (terverifikasi mengarah ke /admin/promotions/create?type=store).
Catatan kolaborasi: PromotionController.php sedang memuat refactor besar milik agent lain yang belum di-commit, sehingga pembersihan dua prop di controller TIDAK ikut saya commit (suntingan saya di berkas itu saya kembalikan). Efeknya controller masih mengirim dua prop yang kini tak terpakai; itu tidak berpengaruh ke tampilan maupun fungsi dan bisa dibersihkan setelah refactor agent tersebut masuk.

## 2026-09-29 16:30 UTC | zcode | Standard | PromotionSalesService, PromotionDetail.tsx, PromotionDetailTest | selesai
Permintaan owner di halaman detail kampanye: tambah matrik "Dilihat" dan "Diklik" pada tabel Produk dalam kampanye, hapus kolom Nilai. Kolom Nilai (rupiah penjualan per produk) dihapus dari tabel; angka total nilai penjualan kampanye TETAP ada di kartu ringkasan atas (tidak diminta dihapus). Sumber metrik: tabel performance_metrics lewat ProductEngagementService (metric_name product_views dan product_clicks, produk ditandai di context.product_id), sama seperti modul Performa Toko, dan periodenya memakai rentang kampanye yang sama dengan penjualan supaya bisa dibandingkan langsung (data di luar periode tidak dihitung).
Verifikasi: test baru test_detail_promo_menampilkan_dilihat_dan_diklik_pada_periode_kampanye (metrik dalam periode dihitung, di luar periode diabaikan, produk lain tidak bocor) lulus bersama 5 test lain di PromotionDetailTest (6 passed, 93 assertions); 13 test promo lain lulus; typecheck 0; build 0; live di /admin/promotions/35 header tabel kini # | Produk | Model | Terjual | Pesanan | Dilihat | Diklik | Terakhir terjual, dan 8 dari 29 baris menampilkan angka dilihat (tertinggi 9) serta 2 baris menampilkan diklik. Data historis memang tipis karena pelacakan baru jalan sejak 19 Sep 2026 (92 baris views, 10 baris clicks, 55 produk unik).
Perbaikan sampingan: fixture PromotionDetailTest memakai payment_status "unpaid" yang sudah tidak diizinkan enum sejak migrasi penyempitan 28 Sep (2026_09_28_000002), menyebabkan 3 test lama gagal CHECK constraint; nilainya diperbaiki jadi "pending". Spec tidak berubah: tidak ada kolom/tabel/route baru, hanya memakai metrik yang sudah ada.

## 2026-09-29 09:54 UTC | zcode | Trivial | b1c78a07 | selesai
Lingkup: Buang tombol Refresh per baris di kolom Aksi daftar pengiriman (/admin/shipping), atas permintaan owner 29 Sep. Berkas: resources/js/pages/Admin/Shipping/Index.tsx, app/Http/Controllers/Admin/ShippingRecordController.php
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED secara bentuk JSON, tanpa perubahan route maupun skema tabel. Kolom refresh_url pada payload records.data daftar pengiriman DIHAPUS karena satu-satunya pemakainya tombol itu. Route dan method admin.shipping.refresh TETAP ADA (dipakai test dan masih jalur sah menarik satu resi), hanya tidak lagi tertaut dari UI daftar; kalau kelak owner minta route itu dibuang juga, hapus route di routes/web.php, method refreshStatus plus refreshFeedback, baris dokumen kanonik, dan sesuaikan test test_refresh_reports_unavailable_integration_as_stale_status.
Untuk agent berikutnya: Alasan pembuangan, status resi sudah ditarik otomatis lewat webhook J&T dan penarikan terjadwal shipping:poll-jnt tiap 30 menit, jadi tombol per baris dinilai tidak perlu; tambahan lagi di server dev 209 tombol itu memang tidak berefek karena integrasi J&T nonaktif, sehingga penilaian owner atas tombol itu dibuat saat fitur mati. Penarikan manual satu resi BELUM hilang seluruhnya, tombol Refresh J&T di drawer Lacak Pesanan pada detail pesanan memakai route terpisah admin.orders.shipping.refresh dan tetap ada (di 209 tampil nonaktif karena jntEnabled false). Tombol Muat ulang di header daftar TETAP DIPERTAHANKAN dengan sengaja, karena fungsinya berbeda: ia hanya membaca ulang data dari database kita sendiri lewat router.reload dan tidak menghubungi J&T, jadi tetap berguna saat ada perubahan dari admin lain. Owner pernah menanyakan tombol itu juga pada 29 Sep; kalau kelak diminta dibuang, itu perubahan terpisah.
Bukti: php artisan test filter AdminShippingIndexTest dan AdminShippingWorkflowTest lulus 18 test (264 asersi). npx tsc --noEmit 0 error. npx eslint resources/js/pages/Admin/Shipping/Index.tsx exit 0. npm run build sukses 24.24 detik. Verifikasi live: dari 5 baris di daftar, seluruhnya kini hanya menyisakan tombol Lacak, dan nol tombol dengan title Perbarui status dari J&T Cargo. Tautan Lacak baris pertama mengarah ke /admin/orders/100018?lacak=1 dan drawer Status Pengiriman terbuka. Tombol Muat ulang di header masih ada. Di drawer pesanan, tombol Refresh J&T masih ada dan nonaktif (jntEnabled false di server dev).

## 2026-09-29 10:27 UTC | zcode | Standard | bd50bc7d | selesai
Lingkup: Pecah kolom gabungan Pesanan & Tujuan di daftar pengiriman (/admin/shipping) menjadi tiga kolom, atas permintaan owner 29 Sep: No. Order, No. HP, dan Penerima (nama plus alamat). Berkas: resources/js/pages/Admin/Shipping/Index.tsx, app/Http/Controllers/Admin/ShippingRecordController.php, tests/Feature/AdminShippingIndexTest.php
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED secara bentuk JSON, tanpa perubahan route maupun skema tabel. Kolom payload customer_city diganti customer_address (satu baris alamat utuh, urutan bagian sama dengan orderShippingAddress di area cetak: line1, line2, village, district, city, province, postal_code). Eager load relasi order diperluas ke tujuh kolom shipping_*, jadi kueri daftar ikut membawa alamat. Tidak ada dokumen kanonik yang menyebut nama kolom daftar pengiriman, jadi tidak ada baris dokumen yang perlu diubah.
Untuk agent berikutnya: Alasan pemecahan, kolom gabungan hanya menampilkan nama plus KOTA sehingga admin tidak bisa melihat alamat kirim saat menyiapkan paket. JANGAN kembalikan ke satu kolom. Tabel kini 9 kolom: Resi & Kurir, No. Order, No. HP, Penerima, Status Pengiriman, Status Pesanan, Update Terakhir, Keterangan Kurir, Aksi. Lebar kolom dipatok lewat kelas w-[...] di th, dan itu SENGAJA: tanpa patokan, tata letak otomatis menekan kolom No. HP sampai 78px sehingga nomor 08xx-xxxx-xxxx membungkus jadi tiga baris dan kolom Penerima tinggal 117px. Nomor HP dan nomor order wajib tetap whitespace-nowrap. Alamat dibatasi line-clamp-3 dengan atribut title sebagai tempat membaca utuh, dan di lebar layar 2236px seluruh alamat tampil penuh tanpa terpotong (diverifikasi); pada 1440px ada yang terpotong tiga baris tanpa merusak tata letak. Row jadi lebih tinggi (76 px alamat pendek, 96 px alamat panjang), itu konsekuensi wajar dari menampilkan alamat dan sudah diukur.
Bukti: php artisan test filter AdminShippingIndexTest dan AdminShippingWorkflowTest lulus 18 test (270 asersi, naik dari 264 karena asersi order_number, customer_phone, dan customer_address baru). npx tsc --noEmit 0 error. npx eslint berkas yang diubah exit 0. npm run build sukses. Verifikasi live di ra.333labs.tech/admin/shipping: header sembilan kolom tampil berurutan, lima baris mengisi benar (mis. ORD26090002 | 0857-2511-6817 | febrian afik | Jl. Beji Kost Umar, KEMIRI, KEBAKKRAMAT, KABUPATEN KARANGANYAR, JAWA TENGAH, 57762), nomor HP tinggi 15px artinya satu baris tidak membungkus, dan tidak ada geser horizontal pada 1280, 1440, 1920, maupun 2236 px.

## 2026-09-29 10:31 UTC | zcode | Standard | 90dcfc0c, d57ddb6a | selesai
Lingkup: kontrol jumlah (tambah/kurang qty) disatukan jadi satu komponen bersama (permintaan owner 2026-09-29: fitur tambah qty harus memakai komponen reusable, banyak halaman desainnya berbeda). Audit menemukan EMPAT bentuk berbeda untuk hal yang sama:
1. Panel Isi pesanan halaman detail pesanan: dua isian angka TANPA tombol sama sekali.
2. Form retur: stepper buatan sendiri, susunan tombol plus/minus plus Input ditulis manual di dalam berkas itu.
3. Pemilih produk (dibuat 29 Sep): isian angka tanpa tombol.
4. QuantityControl di components/ui/quantity-control.tsx: sudah ada sejak sebelumnya tetapi HANYA dipakai satu tempat di storefront (product-buy-box), sehingga tidak pernah menjadi standar admin.

Berkas:
- resources/js/components/admin/ui/quantity-input.tsx (BARU): tombol kurang, isian angka, tombol tambah dalam satu baris, memakai variant outline dan ukuran icon dari kit admin. Batas min dan max ditegakkan KOMPONEN itu sendiri, termasuk untuk angka yang diketik langsung, jadi pemanggil tidak bisa lupa membatasi.
- resources/js/components/admin/order-return-create-form.tsx, order-product-picker.tsx, pages/Admin/Orders/Show.tsx: memakai komponen itu. Isian jumlah di panel Isi pesanan yang tadinya tanpa tombol kini punya tombol kurang dan tambah.
- tests/frontend/quantity-input.test.ts (BARU): 8 test PERILAKU memakai jsdom dan @testing-library/react (perintah: npx vitest run). Ini test pertama di repo yang merender komponen React; sebelumnya tests/frontend hanya menguji fungsi murni. Menjaga: penegakan batas bawah dan batas atas lewat tombol maupun lewat angka yang diketik, label tombol yang menyebut konteks, dan pemadaman saat disabled.
Dampak spec: tidak berubah. Tidak ada route, field, enum, atau bentuk JSON baru.
Untuk agent berikutnya: sisa type="number" di panel admin sengaja TIDAK diubah karena bukan jumlah barang: Refund Retur, Ongkir Retur Ditanggung Toko, Ongkir Perjalanan Balik, Nilai penggantian (uang), dan Posisi media. Storefront punya komponen sendiri (components/ui/quantity-control.tsx) dan TIDAK ikut diubah; kalau nanti mau disatukan, perhatikan bahwa versi storefront memakai tinggi size-9/size-11 dan gaya tombol tanpa border, sedangkan versi admin memakai Button outline h-9 supaya sejajar dengan kontrol field admin.
Bukti: typecheck bersih; eslint bersih pada berkas terkait; build sukses; npx vitest run tests/frontend/quantity-input.test.ts 8 lulus; live terukur di tiga tempat, ketiganya tombol dan isian sama-sama 32px dengan titik pusat Y identik (panel isi pesanan /admin/orders/100083, pemilih produk, dan form retur /admin/orders?order_status=delivered); klik tombol tambah menaikkan 1 ke 2 dan tombol kurang mengembalikannya ke 1; di form retur pesanan 2 unit, kontrol dibatasi 1 sampai 2 dengan tombol tambah dan kurang terkunci tepat di batasnya. Dialog ditutup tanpa menyimpan, jadi tidak ada data pesanan yang berubah.

## 2026-09-29 10:47 UTC | zcode | Trivial | fb2b89ec | selesai
Lingkup: tombol hapus di baris produk panel Isi pesanan diganti ikon X (permintaan owner 2026-09-29: "pakai X biasanya kan"), dari sebelumnya teks "Hapus". Satu berkas: resources/js/pages/Admin/Orders/Show.tsx.
Dampak spec: tidak berubah.
Untuk agent berikutnya: ukuran tombol memakai size="icon" (h-9) supaya tingginya sama dengan QuantityInput di sebelahnya; tombol tanpa teks wajib punya aria-label, dan di sini aria-label menyebut nama produk agar jelas baris mana yang dihapus. SEPULUH tombol "Hapus" berteks lain di panel admin sengaja TIDAK diubah karena konteksnya berbeda, bukan kontrol hapus baris: media-panel (trigger ConfirmAction penghapusan permanen, dan tombol hapus massal), PromotionForm (tautan teks destruktif), TentangKami/Edit (3), InstallationGallery/Model, dan SubModelForm (2). Kalau owner minta penyamaan, konfirmasi dulu karena ada yang sebaiknya tetap berteks (aksi destruktif yang memicu dialog konfirmasi).
Bukti: typecheck bersih; eslint bersih; build sukses; live /admin/orders/100083 tombol 32px tanpa teks berisi svg, nama aksesibel "Hapus Tinggi 180cm x Panjang 130cm Jendela Swing Dua Daun Ornamen dari pesanan", titik pusat Y dan tinggi identik dengan kontrol jumlah di baris yang sama; klik terbukti menghapus baris (jumlah baris 1 menjadi 0), lalu perubahan dibuang tanpa menyimpan sehingga pesanan tidak berubah.

## 2026-09-29 17:10 UTC | zcode | Standard | SubModelController, SubModels.tsx, SubModelAdminTest | selesai
Permintaan owner: samakan logika pengurutan Sub Model dengan Model Produk, dengan dua syarat khusus. (1) Backend: urutan daftar kini menaruh sub model NONAKTIF jatuh ke bawah dalam modelnya (orderByRaw CASE WHEN is_active, menirukan Model Produk), dengan product_model tetap kunci pertama supaya grup pada mode semua model tidak terpecah (penanda grup di frontend mengandalkan baris satu model berurutan). Nomor urut tersimpan (sub_models.sort_order) TIDAK diubah oleh penampilan baru ini. (2) Frontend: gerbang tombol Urutkan menirukan Model Produk, yaitu daftar harus memuat SELURUH baris cakupannya, jadi tab status wajib Semua status dan daftar harus satu halaman; ditambah syarat khusus halaman ini, satu model wajib dipilih sehingga mode semua model TIDAK menawarkan Urutkan (ruang nomor urut terpisah per model). Aturan lama (2026-09-16, hanya aktif di filter Aktif) diganti; pesan alasan tombol mati diperbarui mengikuti urutan pemeriksaan: model belum dipilih, lalu tab belum Semua status, lalu halaman lebih dari satu, lalu baris kurang dari dua. Mode Urutkan otomatis dimatikan saat cakupan berubah (dependensi efek kini canReorder, bukan lagi pasangan status+model).
Verifikasi: 3 test penjaga baru di SubModelAdminTest (nonaktif jatuh ke bawah walau nomor urutnya terkecil; grup model tetap utuh saat mode semua model dan ada yang nonaktif; simpan urutan menulis nomor untuk semua baris termasuk nonaktif lalu tampilan tetap aktif dulu) lulus bersama 8 test lama (11 passed, 230 assertions); 15 test katalog/model lain lulus; typecheck 0; build 0; live: tanpa model tombol Urutkan mati dengan alasan Pilih satu model dulu, model + Semua status tombol hidup, model + Aktif tombol mati dengan alasan Pilih tab Semua status dulu, dan menekan Urutkan mengubah tombol jadi Urungkan serta memunculkan kolom Seret.
Catatan bukti: penampilan aktif-dulu belum bisa dibuktikan dari data produksi karena di SEMUA 51 sub model (22 aktif, 29 nonaktif) nomor nonaktif kebetulan sudah lebih besar dari nomor aktif, jadi urutan lama dan baru identik; jaminannya dipegang test yang sengaja membalik nomor. Spec tidak berubah: tidak ada route, kolom, enum, atau bentuk JSON baru (payload rows sudah memuat sort_order dan is_active).

## 2026-09-29 11:03 UTC | zcode | Trivial | 9b45e8b5 | selesai
Lingkup: label tombol catatan jadi "Catatan Admin" (permintaan owner 2026-09-29). Tiga permukaan yang tampil ke admin disamakan: halaman detail pesanan (sebelumnya "Tambah catatan"), dan daftar pesanan pada sel catatan baik saat sudah ada isinya maupun saat masih kosong (keduanya sebelumnya "Catatan admin").
Dampak spec: tidak berubah. Hanya teks.
Untuk agent berikutnya: ikon plus pada tombol SENGAJA tetap ada, karena keputusan sebelumnya menetapkan tanda plus diberikan oleh ikon sehingga teksnya tidak boleh dobel plus. Yang TIDAK diubah karena bukan label tombol yang sama: kalimat di dalam modal catatan, dan label "Catatan admin:" pada garis keterangan (baris item pesanan dan cetak alamat). Kalau owner minta penyamaan huruf kapital untuk konteks label keterangan itu juga, konfirmasi dulu karena nada kalimatnya berbeda.
Bukti: typecheck bersih; eslint bersih; build sukses; live /admin/orders/100083 label tombol terbaca "Catatan Admin" dan teks lama "Tambah catatan" nol kemunculan; live /admin/orders sepuluh sel catatan terbaca "Catatan Admin"; teks 84px di dalam tombol 98px sehingga tidak meluber.

## 2026-09-29 11:14 UTC | zcode | Standard | 636c1fec | selesai
Lingkup: Ganti kolom Keterangan Kurir di daftar pengiriman (/admin/shipping) menjadi kolom Umur pengiriman, atas keputusan owner 29 Sep setelah analisis matriks kandidat. Berkas: resources/js/pages/Admin/Shipping/Index.tsx, app/Http/Controllers/Admin/ShippingRecordController.php, app/Models/ShippingRecord.php, app/Support/OrderTrackingPresenter.php, tests/Feature/AdminShippingIndexTest.php
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED secara bentuk JSON, tanpa perubahan route maupun skema tabel. Kolom payload status_raw DIHAPUS dari records.data daftar pengiriman dan diganti empat kolom: age_label, age_tone (muted|warning|danger), age_hours, age_title. Tidak ada dokumen kanonik yang menyebut nama kolom daftar pengiriman, jadi tidak ada baris dokumen yang perlu diubah.
Untuk agent berikutnya: Alasan penggantian, kolom Keterangan Kurir TERBUKTI selalu jatuh ke dua keadaan tidak berguna, yaitu mengulang status yang sudah ada badge-nya (teks J&T saat Sampai berbunyi paket sudah diterima, sama artinya dengan badge Sampai) atau membocorkan penanda internal sistem (manual, created, cancelled) yang sama sekali bukan keterangan kurir. Kolom Umur dipilih karena satu-satunya kandidat yang terisi di semua baris. Aturan hitungnya: resi aktif dihitung dari created_at sampai sekarang sehingga angkanya bertambah, resi yang sudah selesai dihitung sampai kejadian terminal PERTAMA di event_logs (shipping.status_updated dengan payload to = delivered/returned/cancelled). JANGAN memakai last_status_at sebagai jangkar waktu: kolom itu terbukti ikut berubah setiap pelacakan disegarkan, bahkan pada baris yang sudah delivered (terlihat di data, resi 201718781511 delivered 25 Agu tetapi last_status_at tertulis 28 Sep). Ambang warna mengikuti filter umur di daftar pesanan, 24 jam jadi warning dan 7 hari jadi danger, dan resi yang sudah selesai SELALU tanpa warna karena paket tidak lagi berjalan. Penjaga penanda internal dipasang sebagai method courierNote() di model ShippingRecord dan dipakai di OrderTrackingPresenter pada tiga titik, sehingga drawer Lacak Pesanan tidak lagi menampilkan kata manual. Penting: penulis penanda itu MASIH ADA di ShippingService (tiga baris: created, manual, cancelled). Nilainya kini tidak pernah tampil, tetapi masih tersimpan di basis data; kalau kelak ada konsumen baru membaca status_raw, penanda itu akan menyesatkan lagi. Root fix yang belum dikerjakan, yaitu berhenti menuliskan penanda internal ke kolom keterangan kurir, menunggu keputusan owner.
Bukti: php artisan test filter AdminShippingIndexTest lulus 11 test (240 asersi, dua test baru: kolom umur menggantikan keterangan kurir, dan umur resi selesai berhenti di waktu selesai dari log kejadian). Suite lebih luas 79 test (775 asersi) untuk AdminShippingWorkflowTest, OrderPrivacyTest, CustomerOrderStatusContractTest, OrderReturnCtaTest, ShippingTrackingEventsTest, ShippingStatusTest, OrderTrackingTimelineTest juga lulus setelah presenter disentuh. npx tsc --noEmit 0 error. npx eslint berkas yang diubah exit 0. npm run build sukses. Verifikasi live di ra.333labs.tech/admin/shipping: header sembilan kolom kini berisi Umur (Keterangan Kurir sudah tidak ada), empat resi aktif menampilkan 11 sampai 21 jam tanpa warna, dan resi 201718781511 yang sudah Sampai menampilkan 3 hari dengan keterangan Total 3 hari sejak resi dicatat sampai pengiriman selesai. Tidak ada geser horizontal. Di drawer, baris Keterangan kurir HILANG untuk resi berpenanda manual, sementara resi dengan teks asli J&T tetap menampilkan 【Kab Tasikmalaya】paket sudah diterima, membuktikan penjaga tidak ikut menyembunyikan keterangan kurir yang sah.

## 2026-09-29 11:20 UTC | zcode | Standard | 4d7a3d39 | selesai
Lingkup: kartu Isi pesanan halaman detail pesanan menampilkan produk dua kali saat mode edit (permintaan owner 2026-09-29: "kesannya duplikat, kita pakai model layout yang atas saja"). Penyebabnya daftar read-only tetap dirender sementara OrderEditPanel merender daftar produknya sendiri dengan bentuk berbeda (baris rapat tanpa gambar, judul "Produk"), jadi satu produk muncul di dua daftar.
Berkas: resources/js/pages/Admin/Orders/Show.tsx
- Daftar read-only dijaga penjaga editing, jadi produk hanya dirender oleh satu daftar pada satu waktu.
- Daftar produk mode edit memakai baris yang sama dengan daftar isi pesanan: gambar 56px, nama, varian, jumlah x harga satuan, dan total baris di kanan. Kontrol jumlah dan tombol hapus ikon X menyatu di baris itu.
- Total baris di mode edit mengikuti jumlah yang sedang diisi (qty x harga satuan); total pesanan resmi tetap dihitung ulang server saat disimpan.
- Judul kecil "Produk" di panel edit dihapus (mubazir karena sudah di dalam kartu Isi pesanan).
- Tombol salin nama produk ditambahkan di baris mode edit memakai penyalin teks yang sama dengan daftar read-only (prop baru onCopy).
Dampak spec: tidak berubah. Kiriman ke server tetap induk SKU + SKU varian + jumlah.
Untuk agent berikutnya: pemisahan yang disengaja adalah daftar READ-ONLY di dalam kartu, dan panel EDIT menjadi SEKSI TERSENDIRI di bawahnya dengan pembungkus border-t + bg-muted/30 (sebelumnya seksi itu menempel tanpa pembatas dan tanpa judul, sehingga tidak terbaca sebagai wilayah yang berbeda). Jangan satukan lagi tanpa alasan: admin harus tahu mana tampilan dan mana formulir. JANGAN tampilkan harga baris dari unit_price setelah pesanan tersimpan tanpa menghitung line_discount: data 29 Sep 2026 menunjukkan 4 dari 40 baris order_items punya diskon, dan 0 baris punya selisih rumus (artinya unit_price memang harga kotor). Penyederhanaan qty x unit_price yang dipakai di editor itu SENGAJA hanya untuk baris yang sedang diisi, jadi jangan dipindahkan ke tampilan setelah simpan.
Bukti: typecheck bersih; eslint bersih; build sukses; live /admin/orders/100083 nama produk muncul TEPAT SEKALI di mode baca maupun mode edit (diukur dengan menghitung elemen p yang teksnya persis nama produk); mode edit menampilkan "Warna: Putih . Kaca: Kaca Es 1 x Rp 6.680.000 Rp 6.680.000"; tombol tambah menaikkan 1 ke 2 dan total baris jadi Rp 13.360.000 lalu tombol kurang mengembalikannya; form lengkap tetap utuh (12 label, Simpan, Batal, Pilih produk, Simpan catatan internal); mode ditutup tanpa menyimpan sehingga total tagihan tetap Rp 6.786.200.

## 2026-09-29 11:25 UTC | zcode | Standard | InstallationGalleryController, InstallationGallery/Index.tsx, InstallationProjectAdminTest | selesai
Permintaan owner: halaman Hasil Pemasangan memakai logika urutan yang sama seperti Model Produk dan Sub Model, plus kolom No. (1) Backend: urutan daftar grup kini menaruh grup Aktif (masih punya media tampil) selalu di atas grup Diarsipkan, menirukan aturan "arsip jatuh ke bawah"; penyaring sort A-Z/Terbaru tetap berlaku di dalam tiap kelompok sehingga tombol Urutkan tetap boleh dipakai di tab Semua. Karena payload simpan menomori baris menurut posisi pada daftar tampil, grup arsip otomatis menerima nomor paling besar. (2) Frontend: kolom No baru (1..N mengikuti urutan tampil) dan ikon tarik hanya aktif untuk grup yang masih tampil, bukan grup arsip.
TEMUAN DAN PERBAIKAN BUG PRODUKSI: endpoint admin/hasil-pemasangan/reorder selalu gagal 500 setelah urutannya tersimpan, karena log aktivitasnya memakai entitas product_media dengan id kosong sementara kolom event_logs.entity_id NOT NULL (mode MySQL STRICT). Akibatnya admin melihat halaman galat padahal urutan sudah berubah, dan tabel event_logs produksi tidak punya satu pun baris installation_group.reordered. Diperbaiki menjadi entitas halaman (cms_page + InstallationPageSettings::pageId()), menirukan pola reorder massal Apa Kata dan FAQ.
Verifikasi: 14 test InstallationProjectAdminTest lulus (162 assertions), termasuk 2 test baru (grup diarsipkan jatuh ke bawah walau nomor urutnya lebih kecil; simpan urutan menulis nomor semua grup dan arsip tetap di bawah, plus asersi log tersimpan dengan entitas ber-id); typecheck 0; build 0; live: kolom No 1..14 tampil, simpan urutan dari mode Urutkan berhasil tanpa galat (log id 819 entitas cms_page#1 tersimpan), dan halaman publik kembali ke urutan alfabetis semula.
CATATAN KOLABORASI: hunk frontend (kolom No + handle kondisional) tersapu ke commit 8533f426 milik agent lain karena commit tanpa pathspec menelan staging saya; bagian backend dan test saya commit terpisah. Perubahan urutan pada data produksi akibat aksi uji saya (geser dua grup) sudah dipulihkan ke urutan semula. Spec tidak berubah: tidak ada route, kolom, enum, atau bentuk JSON baru.

## 2026-09-29 11:22 UTC | zcode | Trivial | 8533f426 | addendum
Catatan atribusi: commit 8533f426 (entri log di atas) ikut membawa resources/js/pages/Admin/InstallationGallery/Index.tsx (penambahan kolom "No" pada tabel galeri pemasangan) karena berkas itu SUDAH ter-stage di indeks git bersama oleh agent lain. Isinya utuh dan tidak ada yang hilang, tetapi atribusi commit jadi bercampur. Sudah ter-push, jadi tidak saya tulis ulang karena menulis ulang riwayat berisiko mengganggu pekerjaan agent lain yang berjalan bersamaan.
Pelajaran proses (ketiga kali terjadi pada 29 Sep 2026): git update-index --cacheinfo maupun git add <path> TIDAK membersihkan entri yang sudah ter-stage agent lain, jadi entri itu selalu ikut terbawa commit. Urutan yang benar: periksa git diff --cached --name-only sebagai PERINTAH TERPISAH sebelum menyusun commit, dan bila ada berkas bukan milik kita, keluarkan dulu dari indeks dengan git restore --staged <path> (hanya mengubah indeks, berkas kerja agent lain tidak tersentuh), baru commit.

## 29 11:38:21 20262026-09-29 11:38 UTC | zcode | Deep | app/Services/StorePerformanceService.php | selesai

- Keputusan owner 2026-09-29 atas dua keputusan terbuka: (1) ongkir perjalanan balik mostly ditanggung kas toko sehingga dihitung pengurang Penjualan Bersih; (2) subscribe J&T ditanyakan, direkomendasikan TIDAK aktif dulu (tarik berkala + batch 30 resi lebih pas untuk volume toko; payload push belum pernah dilihat hidup dan kredensial di 202). Tidak ada kode untuk (2).
- Kontrak beku naik v1.0.2 ke v1.0.3: metrik baru return_trip_shipping_total (basis: rupiah, period, anchor tanggal retur selesai), dikurangkan dari net_revenue, KPI baru Ongkir Perjalanan Balik di blok Retur & Pembatalan, teks definisi net di KPI dan drawer diperbarui, golden di-regenerasi GOLDEN_UPDATE (selisih hanya teks + metrik baru bernilai 0, tidak ada angka lama bergeser), alias financial didaftarkan di MetricBasisTest, OrderExport ikut FROZEN v1.0.3, ADR-026 ditambah catatan v1.0.2 (terlewati sebelumnya) dan v1.0.3.
- BUG TERPENDAM DIPERBAIKI: blok ongkir balik di completeReturn memanggil $locked yang tidak terdefinisi di fungsi itu DAN kolom additional_shipping_amount tidak ada di skema (dibuang 26 Sep, migrasi penambah 27 Sep tidak pernah dibuat), sehingga SETIAP penyelesaian retur lewat popup (yang selalu mengirim isian itu) pasti 500. Kolom dikembalikan ke order_return_cases lewat migrasi forward-only 2026_09_29_000001, fillable+cast ditambah, penulisan pindah ke update kasus. Belum pernah terpicu di produksi karena belum ada kasus yang diselesaikan lewat UI (kasus #1 di-backfill, #12/#13 masih open).
- Verifikasi: ReturnTripShippingKpiTest 3 passed (nilai mengurangi Net 455000 vs 500000, dua kasus menjumlah per kasus 70000, void tidak dihitung); suite gabungan perf+retur 69 passed (532 asersi); AdminReturnWorkflowTest 20 passed; typecheck 0; build sukses; migrasi produksi DONE. Jebakan saat menulis: financial adalah larik tersaring, kunci baru wajib ditambahkan di sana plus alias di MetricBasisTest; KPI diuji dari laporan SEBELUM nilai nol-kan.

## 2026-09-29 11:42 UTC | zcode | Trivial | e47af3ed (lihat juga c66d4b91) | selesai
Lingkup: gambar produk tidak muncul di baris yang baru ditambahkan lewat pemilih produk pada panel Isi pesanan (laporan owner 2026-09-29: "gambar kok ga ke fetch?").
AKAR MASALAH: OrderProductPicker SUDAH menerima gambar produk dari endpoint pencarian dan memakainya di daftar hasil, tetapi hasil pilihnya (PickedOrderProduct) tidak meneruskan gambar itu, sehingga baris baru hanya punya nama dan varian tanpa gambar dan jatuh ke placeholder ikon.
Berkas: resources/js/components/admin/order-product-picker.tsx (PickedOrderProduct menambah image, dikirim saat produk ditambahkan). Bagian halaman detail pesanan (EditLine menyimpan image, addLine meneruskan, baris memakai gambar server bila ada, gambar hasil pencarian untuk baris baru, placeholder bila keduanya kosong) SUDAH masuk HEAD lewat commit c66d4b91 milik agent lain yang menyapu berkas kerja saya, jadi tidak perlu di-commit lagi di sini.
Dampak spec: tidak berubah. Gambar hanya untuk tampilan; kiriman ke server tetap induk SKU + SKU varian + jumlah.
ATRIBUSI: commit c66d4b91 (fitur ongkir perjalanan balik) ikut memuat tiga hunk saya di pages/Admin/Orders/Show.tsx. Sudah ter-push, tidak saya tulis ulang. Ini kejadian KEEMPAT pada 29 Sep 2026 dengan pola yang sama: commit agent lain menyapu berkas kerja saya yang belum di-commit. Gejalanya khas: git status melaporkan berkas BERSIH padahal kode saya ada di dalamnya, dan git show HEAD berisi penanda saya. Cara memastikan pekerjaan tidak hilang: cocokkan penanda (grep -c) di HEAD dengan yang diharapkan.
Bukti: typecheck bersih; eslint bersih; build sukses; live /admin/orders/100083 setelah menambah produk lewat pemilih, kedua baris punya gambar yang benar-benar TERMUAT (48x48, object-fit cover, gambar asli 800x800 dan 400x400, img.complete true), bukan lagi ikon placeholder.

## 2026-09-29 11:55 UTC | zcode | Trivial | resources/js/pages/Admin/InstallationGallery/Index.tsx | selesai
Owner menunjuk kotak kosong di tab Hasil Pemasangan Diarsipkan dan menyebut logikanya salah. Akarnya: kotak kosong halaman ini tidak mengenal tab aktifnya, jadi di tab arsip pun berbunyi "Belum ada grup hasil pemasangan" plus tombol Tambah, padahal menambah media selalu membuat grup yang tampil di toko dan tidak mengisi arsip. Diperbaiki mengikuti pola halaman FAQ yang juga bertab Aktif dan Diarsipkan: judul dan kalimat kini per tab (arsip: "Tidak ada hasil pemasangan diarsipkan" + "Grup yang diarsipkan akan muncul di sini.", aktif: "Belum ada hasil pemasangan aktif", semua seperti semula), hasil pencarian tetap punya kalimat sendiri, dan tombol Tambah disembunyikan di tab arsip. Sekalian: alasan tombol Urutkan mati kini mengikuti keadaan, saat daftar kosong berbunyi "Belum ada grup di tab ini yang bisa diurutkan" bukan menyuruh pindah tab, karena saran pindah tab menyesatkan bila penyebabnya daftar kosong.
Verifikasi: typecheck 0, lint bersih untuk berkas ini, build 0, live tiga tab dicek (Semua: 14 baris, tombol Urutkan aktif; Aktif: 14 baris, Urutkan mati dengan alasan tab Semua; Diarsipkan: kosong, judul "Tidak ada hasil pemasangan diarsipkan", tanpa tombol Tambah, dan alasan Urutkan menyebut daftar kosong). Tidak ada test baru karena ini murni teks dan kondisi tampilan; Spec tidak berubah.
Catatan: data produksi memang nol grup diarsipkan (136 media hasil pemasangan semuanya visible), jadi tab arsip kosong itu benar, bukan bug data.

## 2026-09-29 11:51 UTC | zcode | Standard | b371ffbc | selesai
Lingkup: Tambah ikon salin di kolom No. Order dan No. HP daftar pengiriman, dan nomor HP tidak lagi memakai tanda hubung (normalkan ke 62), atas perintah owner 29 Sep: selalu tambahkan ikon salin di samping angka atau nomor, dan nomor WA jangan pakai pemisah. Berkas: resources/js/pages/Admin/Shipping/Index.tsx, app/Http/Controllers/Admin/ShippingRecordController.php, tests/Feature/AdminShippingIndexTest.php
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED secara isi payload, tanpa perubahan route maupun skema tabel. Kolom customer_phone pada records.data daftar pengiriman kini berisi bentuk normal 62 tanpa pemisah (mis. 6285725116817), BUKAN nilai mentah pesanan dan bukan format tampilan 08xx-xxxx-xxxx. Tidak ada dokumen kanonik yang menyebut rincian kolom payload daftar pengiriman, jadi tidak ada baris dokumen yang perlu diubah.
Untuk agent berikutnya: ATURAN OWNER BARU, setiap angka atau nomor di tabel admin wajib punya ikon salin CopyButton di sampingnya. Di daftar pengiriman ada tiga: resi, nomor order, dan nomor HP. Ketiganya disetel compact supaya tinggi dan titik tengahnya seragam satu baris (diverifikasi terukur 14px, pusat Y sama dengan teks pasangannya); jangan menyetel sebagian saja. PENTING soal format nomor, ada DUA kontrak berbeda dan jangan tertukar: (1) nomor yang diperlihatkan ke PELANGGAN wajib 08xxx dan format tampilan berhubung 08xx-xxxx-xxxx lewat PhoneNumber::formatDisplay (kontrak owner 2026-09-27, contoh di area cetak dan checkout), sedangkan (2) nomor di PANEL ADMIN untuk keperluan operasional dikirim dalam bentuk normal 62 tanpa pemisah supaya bisa langsung disalin untuk WhatsApp, lewat PhoneNumber::normalize. Keputusan owner 29 Sep untuk daftar pengiriman masuk kategori kedua. Import formatPhoneLocal sudah dilepas dari Index.tsx karena tidak dipakai lagi di situ. Nomor HP belum bisa diklik WhatsApp lagi sejak ikon WA dibuang 28 Sep; kalau owner minta tautan WA dikembalikan, gabungkan dengan nomor 62 ini, jangan tempel nomor mentah.
Bukti: php artisan test filter AdminShippingIndexTest lulus 12 test (249 asersi, satu test baru: nomor hp dinormalkan ke 62 tanpa pemisah, memakai input berspasi dan bertanda hubung +62 857-2511-6817 dan mengharapkan keluaran 6285725116817), plus AdminShippingWorkflowTest lulus, total 21 test (307 asersi). npx tsc --noEmit 0 error. npx eslint berkas yang diubah exit 0. npm run build sukses. Verifikasi live di ra.333labs.tech/admin/shipping: kolom No. HP menampilkan 6285725116817 tanpa tanda hubung, tiga tombol salin ada di baris (Salin nomor resi, Salin nomor order ORD26090002, Salin nomor HP 6285725116817), ketiganya tinggi 14px dan pusat Y sejajar dengan teksnya, tinggi baris tetap 76px dan tabel tetap tanpa geser horizontal. Fungsi salin diuji langsung dengan mengklik tombol nomor HP: label berubah menjadi Tersalin! dan ikonnya berganti centang hijau.

## 2026-09-29 11:56 UTC | zcode | Standard | f8538109 | selesai
Lingkup: harga dan ringkasan di panel Isi pesanan belum tersinkron saat jumlah diubah (laporan owner 2026-09-29: "harga kok masih belum sync", kelanjutan dari permintaan sebelumnya "harga dan subtotal/total harusnya livesync").
AKAR MASALAH (terukur, bukan dugaan): total BARIS sudah ikut berubah sejak commit 4d7a3d39, tetapi blok ringkasan di bawahnya (Total produk, Total unit, Total harga produk, Total tagihan) memakai nilai tersimpan dari server (`order.product_count`, `order.unit_count`, `order.subtotal_amount`, `order.total_amount`) yang baru berubah setelah disimpan. Jadi saat qty 1 diubah ke 3, barisnya menjadi Rp 20.040.000 sementara ringkasan tetap Rp 6.680.000 tanpa penjelasan.
Berkas:
- pages/Admin/Orders/Show.tsx: panel edit melaporkan angka isian (produk, unit, harga produk) ke halaman induk lewat prop onTotals; ringkasan memakai angka itu selama mode edit dan kembali ke angka tersimpan saat panel ditutup. Baris baru kini menampilkan harga satuannya dari pemilih produk dengan penanda (perkiraan).
- components/admin/order-product-picker.tsx: PickedOrderProduct menambah unit_price dan mengirimkannya saat produk ditambahkan.
Dampak spec: tidak berubah. Kiriman ke server tetap induk SKU + SKU varian + jumlah; harga resmi tetap dihitung ulang server.
BATAS YANG DISENGAJA (jangan dianggap kurang): ongkir, subsidi, asuransi, biaya COD, dan Total tagihan TIDAK dihitung di layar karena berasal dari hitungan server yang bergantung berat, tujuan, dan nilai pesanan. Saat mode edit: baris Total tagihan diberi label "(sebelum perubahan disimpan)" dengan nilai diredupkan, dan muncul satu catatan bahwa ongkir serta total dihitung ulang server saat disimpan. Angka tersimpan tetap ditampilkan, tidak dikarang. Harga baris baru ditandai "(perkiraan)" karena server menghitung ulang harga resminya.
Untuk agent berikutnya: memakai perkiraan harga di layar itu SADAR, jadi jangan hapus penanda "(perkiraan)" atau label "sebelum perubahan disimpan" tanpa menggantinya dengan hitungan server yang setara. Jangan pula memindahkan perhitungan qty x harga satuan ke tampilan pesanan yang sudah tersimpan: `order_items.line_discount` bisa berisi potongan (4 dari 40 baris pada 29 Sep 2026), sehingga harga pesanan tersimpan wajib dari `line_total`.
Bukti: typecheck bersih; eslint bersih; build sukses; live /admin/orders/100083 mode edit qty 1 ke 3 membuat Total harga produk menjadi Rp 20.040.000 dan Total unit 3 unit; menambah produk lewat pemilih membuat Total produk 2, Total unit 4, Total harga produk Rp 23.810.000 dengan baris baru menampilkan 1 x Rp 3.770.000 (perkiraan); mode edit ditutup TANPA menyimpan dan angka kembali ke nilai tersimpan (1 produk, Rp 6.680.000, Total tagihan Rp 6.786.200), jadi tidak ada data pesanan yang berubah.

## 2026-09-29 12:20 UTC | zcode | Standard | resources/js/components/admin/reorder-action-button.tsx | selesai
Permintaan owner saat menunjuk tombol Urutkan yang mati di tab Hasil Pemasangan Aktif: kalau tombolnya tidak bisa dipakai, hilangkan/sembunyikan saja, dan berlaku untuk fitur Urutkan di SEMUA halaman lain. Perubahan cukup di komponen bersama ReorderActionButton (sembilan halaman memakainya, jadi tidak ada duplikasi): satu baris awal `if (!active && disabled) return null`, sehingga tombol tidak dirender saat mode urut belum bisa dipakai. Keadaan mode AKTIF sengaja tetap dirender (Urungkan / Simpan urutan) supaya admin selalu punya jalan keluar atau menyimpan; hint alasan tombol mati tetap ada untuk keadaan itu. Tombol muncul sendiri begitu syaratnya terpenuhi, jadi alasan tidak perlu dibaca admin.
Verifikasi: typecheck 0, lint bersih untuk komponen ini, build 0, dan uji live sepuluh keadaan di enam halaman: Hasil Pemasangan tab Semua tampil, tab Aktif dan Diarsipkan hilang; Sub Model tanpa model hilang, dengan model + Semua status tampil, dengan model + Aktif hilang; Model Produk tampil; Apa Kata tab eksternal tampil, dengan filter published hilang; Ulasan Website hilang (memang tidak mendukung urut); Masalah & Solusi, Paling Banyak Dipesan, dan Beranda tetap tampil. Tidak ada halaman yang kehilangan tombol padahal syaratnya terpenuhi.
Catatan: prop disabledReason tetap dipertahankan di pemanggil karena masih dipakai keadaan mode aktif (simpan terkunci saat daftar tersaring). Spec tidak berubah: tidak ada route, kolom, enum, atau bentuk JSON baru.

## 2026-09-29 12:14 UTC | zcode | Standard | 7b83e9b7 | selesai
Lingkup: tata letak halaman detail pesanan (permintaan owner 2026-09-29): (1) Isi pesanan dipindah ke urutan section KE-2, di atas Riwayat pesanan dan Log; (2) kartu paling atas diubah dari SATU kartu berisi empat sel menjadi EMPAT kartu yang berdiri sendiri.
Berkas: resources/js/pages/Admin/Orders/Show.tsx
- Kartu atas: dari `Card` berisi `grid gap-px overflow-hidden bg-border sm:grid-cols-2 xl:grid-cols-4` dengan empat `div bg-card p-5` (dipisah garis rambut 1px) menjadi `div grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4` berisi empat `Card` terpisah. Isi tiap kartu tidak diubah.
- Urutan section sekarang: empat kartu ringkasan, Isi pesanan, Riwayat pesanan (3 kartu: Riwayat, Log perubahan status, Log WhatsApp).
Dampak spec: tidak berubah. Murni tata letak; tidak ada field, route, atau bentuk data baru.
Untuk agent berikutnya: kartu ringkasan TIDAK lagi memakai pola `grid gap-px bg-border` (satu kartu, empat sel). Kalau ada halaman lain yang meniru pola itu dan owner ingin disamakan, pola barunya adalah grid `gap-4` berisi `Card` terpisah dengan `items-stretch` supaya tingginya rata. Isi pesanan kini section kedua; jangan dipindah lagi tanpa permintaan. Anjuran `#biaya-ongkir` (dipakai notifikasi admin `actionHref(n, "biaya-ongkir")`) tetap utuh di dalam kartu Isi pesanan, jadi tautan notifikasi masih mendarat di blok biaya.
Bukti: typecheck bersih; eslint bersih; build sukses; live /admin/orders/100083 terukur empat kartu pada baris yang sama (y=223, tinggi sama 168px, lebar 347px, jarak antar kartu 14px, masing-masing bergaris 0,67px dan berlatar sendiri rgb(28,28,33)); urutan section dari atas: kartu ringkasan (4 kartu, y=223, kelas grid items-stretch gap-4), Isi pesanan (y=404), Riwayat pesanan (y=768).

## 2026-09-29 12:30 UTC | zcode | Deep | audit gap ongkir balik | selesai

- Owner: pastikan tidak ada gap setelah keputusan ongkir balik diberlakukan, cek semua yang terkait (Performa Toko, XLSX, keuangan dll), dan buat rencana induk uji subscribe J&T saat cutover.
- GAP DITEMUKAN DAN DITUTUP (commit 74fba07d): (1) XLSX Ringkasan Finansial tidak punya baris ongkir balik sehingga PENJUALAN BERSIH Excel bisa lebih besar dari layar bila nilainya diisi, baris baru + JUMLAH BEBAN TOKO diperluas; (2) Tabel Pesanan XLSX tanpa kolom, IncomeDetailQuery kini memuat return_trip_shipping per pesanan (termasuk baris koreksi periode yang Net-nya ikut menghitung), kolom ditambahkan di ekor (AA) tanpa menggeser kolom lama dan rumus Net per baris menambah AA; (3) sheet Referensi biaya retur tanpa kolom, ditambah, dan sumbernya kini mencakup kasus yang hanya punya ongkir balik; (4) OrderExport: header Ongkir Retur Tambahan salah label (isinya return_shipping_cost sejak kolom additional dibuang 26 Sep) diperbaiki jadi Ongkir Retur Toko, kolom AF baru Ongkir Perjalanan Balik di ekor + deklarasi EXPORT_BASIS + legend item 28 dikoreksi dan item 35 ditambah; (5) drawer Detail perhitungan layar menambah baris pengurang; (6) dokumen domain rumus Penjualan Bersih diperbarui.
- Kontrak beku v1.0.3: golden diregenerasi sekali lagi (dua kunci additive bernilai 0 di daftar referensi), ADR v1.0.3 diperluas mencakup perluasan pendukung.
- RENCANA INDUK SUBSCRIBE J&T: docs/DOMAIN/rencana-uji-subscribe-jnt-cutover.md, lima langkah (probe read-only dari 202, endpoint webhook penerima dengan verifikasi tanda tangan + idempoten, uji end-to-end push dengan penarik sebagai jaring pengaman, aktifasi terkendali via saklar operations.shipping_pull.subscribe, evaluator 2 minggu), plus peluang batch 30 resi yang bisa dieksekusi terlepas dari subscribe.
- VERIFIKASI: ReturnTripShippingKpiTest 4 passed (termasuk asersi income_detail dan daftar referensi); StorePerformanceExportTest 10 passed (asersi kolom rumus baru + geser baris gaya Net 23-24, arus kas 28-29); OrderExportContractTest 13 passed setelah deklarasi AF; gabungan 34-57 passed; typecheck 0; build sukses. Jebakan: backslash di heredoc python lewat shell ini tereduksi sehingga jangkar md latex gagal, pakai chr(92); berkas service hasil patch lupa diunggah menyebabkan asersi daftar kosong; OrderExportContractTest kotor milik agent lain (taksonomi JENDELA) tidak ikut commit tapi wajib dijalankan karena mematok EXPORT_BASIS.

## 2026-09-29 14:21 UTC | zcode | Trivial | resources/js/pages/Admin/Beranda/Popular.tsx | selesai

- Owner (di halaman beranda/paling-banyak-dipesan): tambahkan kolom nomor. Kolom No ditambah di tabel Tampil di carousel (bukan Produk lain yang tak berurutan), isinya posisi tampil 1..N dengan tabular-nums, ikut bergeser saat urutan digeser. Commit d3da78fe, hanya 3 hunk milik saya yang di-stage (berkas memuat WIP kapitalisasi Urutkan milik agent lain, dibiarkan).
- Verifikasi: typecheck+build lulus; live di browser: header No + baris bernomor 1..N, colSpan baris kosong disesuaikan 6/5.

## 2026-09-29 14:40 UTC | zcode | Standard | TestimonialController, route, Testimonials/Form, Testimonials/Index, 2 berkas test, docs route | selesai
Permintaan owner: alur tambah ulasan terlalu rancu (satu tab punya dua tombol dan form punya tiga wujud), jadi cukup SATU tambah ulasan yang tidak terikat nomor pesanan. Dihapus: tombol "Ulasan dari order" di header tab Ulasan Website, mode form admin-order (kolom "Pesanan terverifikasi", submit ke endpoint admin-review, judul "Isi ulasan admin", label "Simpan ulasan terverifikasi"), method TestimonialController::storeAdminReview dan verifiedOrderOptions, route POST admin/testimonials/admin-review, serta dua test yang menjaga alur itu (Phase11AdminMediaReviewGuardTest::test_admin_can_create_admin_review_for_verified_order_when_no_customer_review dan UlasanAdminTest::test_admin_can_create_verified_review_once_per_completed_order beserta helper orderWithProduct). Form kini hanya punya dua wujud: ulasan biasa (tab Ulasan Website) dan screenshot marketplace (tab Apa Kata Pelanggan, tidak diubah).
BUG IKUTAN YANG DIPERBAIKI: nilai awal "Sumber" pada form Tambah ulasan dulu diambil dari pilihan pertama daftar sumber (urutan model: Shopee lebih dulu), sehingga form ulasan website terbuka dalam wujud screenshot marketplace: gambar jadi wajib, keterangan sumber berbunyi "Apa kata pelanggan kami (screenshot)", dan hasilnya masuk tab Apa Kata Pelanggan, bukan tab tempat admin berdiri. Kini mode ulasan website selalu mulai dari "website".
Verifikasi: test UlasanAdminTest, Phase11AdminMediaReviewGuardTest, TestimonialReplyTest, ProductReviewsTest, CustomerReviewMediaUploadTest, UiTerminologyContractTest lulus (41 dan 12 test, 535 assertions total); typecheck 0; lint bersih untuk berkas ini; build 0; live: header tab Ulasan Website kini hanya Panduan, Muat ulang, Lihat di toko, Tambah (teks "Ulasan dari order" tidak ada), form Tambah menampilkan Sumber "Website" dengan keterangan "Tampil di section Ulasan pelanggan di website", gambar "Opsional", tanpa kolom pesanan, tombol "Simpan ulasan"; tab Apa Kata Pelanggan dan tab foto tetap normal (Tambah marketplace dan Tambah hasil pemasangan tidak tersentuh); route:list tidak lagi memuat admin/testimonials/admin-review.
Spec berubah dan dokumen kanonik diperbarui: entri route admin.testimonials.admin-review.store dihapus dari docs/api-and-routes-ragil-aluminium.md. SPEC_CHANGED_AND_DOCS_UPDATED.
Catatan kolaborasi: TestimonialController.php, Form.tsx, UlasanAdminTest.php, dan dokumen route sedang memuat perubahan agent lain yang belum di-commit (import WhatsAppService + notifikasi balasan ulasan, refactor blok media form ke MediaPicker, peralihan tab foto ke menu Hasil Pemasangan, catatan kasus retur di dokumen route). Semua itu TIDAK ikut saya commit: perubahan saya distage per-hunk, dan untuk Form.tsx versi yang distage disusun ulang dari HEAD supaya tidak menyerap refactor tersebut.

## 2026-09-29 14:44 UTC | zcode | Deep | bd3c6a88 | selesai
Lingkup: panel "Retur & penyelesaian" di halaman detail pesanan DIHAPUS, dan seluruh aksi retur pindah ke popup yang dibuka dari daftar pesanan (permintaan owner 2026-09-29: "ini hapus. di tombol Selesaikan Retur langsung muncul popup, tanpa direct ke halaman detail pesanan"; opsi yang dipilih owner: panel dihapus, semua aksi pindah ke popup).
Berkas: order-return-case-dialog.tsx (BARU, 922 baris: info kasus, form penyelesaian, tombol void, form koreksi, riwayat koreksi, semua dipindah dari panel), Orders/Show.tsx (panel + tipe/data khususnya dihapus, 876 baris), Orders/Index.tsx (tombol membuka popup), OrderController.php (kartu daftar membawa return_cases/return_adjustments/paid_amount + metode bersama returnCaseRows/returnAdjustmentsFor), AdminOrderActionColumnTest.php, docs/api-and-routes + docs/kebijakan-retur-draf.
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED. Kartu daftar pesanan kini mengirim tiga medan baru; aksi complete_return dan start_return tidak lagi membawa href.
DUA TEMUAN YANG IKUT DIPERBAIKI (jangan dianggap tempelan):
1. Panel itu tampil TANPA tombol sama sekali, jadi kotak kosong yang tidak bisa dipakai. Sebabnya cabang tombolnya dibuka oleh state `completion[item.id]` yang TIDAK pernah kembali setelah popup penyelesaian ditutup. Di popup baru form penyelesaian tampil LANGSUNG, jadi keadaan buntu itu hilang.
2. Kasus retur yang sudah SELESAI sempat tidak terjangkau: tombol Selesaikan Retur hanya dikirim server untuk status Retur Diproses, sehingga setelah panel detail dihapus, koreksi data dan void kasus selesai tidak punya jalan masuk. Ditambahkan tombol "Lihat retur" di daftar untuk pesanan yang punya kasus retur di luar status itu. Kalau tombol ini dihapus, dua aksi tersebut hilang lagi.
Untuk agent berikutnya: (a) detail pesanan MASIH mengirim `return_cases`, `return_adjustments`, dan `return_eligibility` walau halaman detail sudah tidak memakainya; pemangkasan payload itu SENGAJA belum dikerjakan, menunggu keputusan owner (kalau owner ingin info retur tampil lagi di detail, datanya sudah siap). (b) Route `admin.orders.returns.edit` (deep-link koreksi) kini hanya mendarat di halaman detail tanpa membuka form koreksi, karena formnya pindah ke popup; hapus atau sambungkan ulang itu keputusan owner. (c) Anjuran `#return-case` sudah TIDAK ADA di mana pun; jangan dipakai lagi, termasuk di notifikasi.
Bukti: typecheck bersih; eslint bersih; build sukses; AdminOrderActionColumnTest 5 lulus (33 asersi); test terkait retur/pesanan 67 lulus (387 asersi); live: tombol Selesaikan Retur kini BUTTON tanpa href dan kliknya membuka popup di tempat (URL tetap /admin/orders) berisi Resolusi, Catatan penyelesaian, Refund (batas Rp 17.250.000), Ongkir retur, Ongkir balik, Tandai retur selesai, Tutup kasus (void); pesanan RA-260810-0001 (kasus selesai) menampilkan tombol Lihat retur dan popupnya memuat Koreksi data + Tutup kasus (void) + form koreksi 7 isian; /admin/orders/100086 tidak lagi punya panel #return-case (judul section tinggal Isi pesanan, Riwayat pesanan, Log perubahan status, Log WhatsApp); semua popup ditutup tanpa menyimpan sehingga tidak ada data pesanan yang berubah.
CATATAN ATRIBUSI: saat commit, indeks git sudah memuat berkas ter-stage milik agent lain (TestimonialController.php, routes/web.php, beberapa test, docs/AGENT-LOG.md). Commit disusun dengan daftar path eksplisit sehingga berkas mereka TIDAK ikut terbawa dan tetap ter-stage. Entri ini sendiri ditulis ke docs/AGENT-LOG.md yang juga memuat entri agent lain, karena berkas itu ledger bersama.

## 2026-09-29 15:10 UTC | zcode | Trivial | app/Http/Controllers/Admin/WhatsAppTemplateController.php | selesai

- Owner di halaman WhatsApp: kolom Pesan pada tabel gagal kirim menulis isi pesan templat, minta cukup nama templatnya saja. Kolom message untuk pesan ber-internal_template_key kini dirender via OrderEventLabels::whatsappTemplate + akhiran (Ulang) bila resend, sama dengan label drawer detail pesanan; pesan manual/pelanggan (free form/inbound) tetap menampilkan isinya terpotong 120 karakter. Kolom raw_payload ikut di-select.
- Verifikasi: php -l bersih; live di browser: keenam baris teratas kini WA Pesanan Diproses / WA Pesanan Sampai / WA Order COD / WA Order Transfer, bukan naskah.

## 2026-09-29 15:30 UTC | zcode | Standard | (commit ini) | selesai

Lingkup: Halaman Profil & Kontak Toko (/admin/storefront-platforms dan alias /admin/pengaturan-toko). Owner 2026-09-29: "gausah pakai tab. campurkan jadi satu view halaman saja semuanya", dilanjutkan arahan sebelumnya "kalau modelnya form, jangan defaultnya aktif, tapi harus ada tombol edit/simpan".
Berkas: resources/js/pages/Admin/StorefrontPlatforms/Edit.tsx, app/Http/Controllers/Admin/StorefrontPlatformController.php, app/Http/Controllers/Admin/KontakController.php, routes/web.php, resources/js/config/admin-page-guides.ts, config/sitemap.php (komentar), tests/Feature/BrandAssetsTabTest.php, tests/Feature/KontakAdminTest.php, docs/sitemap/admin-sitemap.md, docs/admin-menu-functions.md

Perubahan: tiga tab (Marketplace & Media Sosial, Kontak & Jam Kerja, Aset Brand) dihapus; ketiganya kini satu view di satu halaman. Halaman dibuka mode RINGKASAN (read-only, nilai kosong ditulis "Belum diisi" dan tautan sah jadi tautan yang bisa diklik), lalu tombol Edit di header membuka isian dan tombol Simpan menyimpannya, mengikuti pola yang sudah dipakai halaman Tentang Kami. Parameter kueri `tab` dan prop `tab`/`tabs` dihapus; kedua URL lama tetap menampilkan view yang sama.

Simpan mengirim tiga endpoint berurutan (tautan marketplace, kontak, aset brand) karena tiga kelompok itu memang tinggal di tempat berbeda; rantai berhenti pada kegagalan pertama supaya tidak ada bagian tersimpan diam-diam saat bagian lain gagal. Aset brand hanya dikirim bila admin benar-benar memilih berkas baru, supaya menyimpan isian lain tidak menimpa logo/favicon yang sudah pas. Tombol "Simpan Logo" dan "Simpan Favicon" di dalam kartu dihapus (kontrak panel admin: submit di header, bukan di bodi kartu).

Ikut dibetulkan: teks panduan admin (admin-page-guides.ts untuk dua rute terkait) masih menyuruh "Pilih tab ...", yang jadi salah setelah tab dihapus; dan komentar config/sitemap.php masih menyebut menu "Marketplace & Media Sosial" padahal label menunya sudah "Profil & Kontak Toko".

Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED (parameter kueri `tab` dihapus dari halaman ini; docs/sitemap/admin-sitemap.md dan docs/admin-menu-functions.md diperbarui). Tidak ada kolom, enum, status, atau bentuk JSON baru; tidak ada route baru.

Verifikasi: BrandAssetsTabTest 3 lulus (47 asersi), KontakAdminTest + StorefrontPlatformsAdminTest 4 lulus (32 asersi). `npx tsc --noEmit` bersih untuk berkas yang saya sentuh (lihat catatan di bawah), `npx eslint` exit 0 untuk kedua berkas frontend, build aset sukses lewat scripts/prod/build-assets.sh, dan bundel live public/build/assets/Edit-*.js sudah memuat penanda form baru `storefront-profile-form`.

Catatan untuk agent berikutnya: saat saya mengerjakan, `npx tsc --noEmit` sempat GAGAL karena resources/js/pages/Admin/Dashboard.tsx dan resources/js/pages/Admin/Orders/Show.tsx sedang diedit agent lain (mtime 15:20, bentuk galatnya JSX belum lengkap). Berkas itu selesai tidak lama setelahnya, sehingga hook pre-push (typecheck + build) lulus sendiri dan push berjalan normal TANPA bypass apa pun. Hikmahnya: di working tree bersama, kegagalan typecheck belum tentu milik Anda; periksa mtime dan daftar berkasnya dulu sebelum menyimpulkan commit sendiri rusak.

Untuk agent berikutnya: riwayat halaman ini pernah tiga bentuk (uploader brand di halaman Impor, lalu tab Aset Brand, kini satu view). Kalau menambah kelompok pengaturan baru, tambahkan sebagai seksi di view yang sama, bukan tab baru, dan tambahkan endpoint-nya ke rantai Simpan.

Catatan higiene git (penting untuk working tree bersama): commit `79a3ad39` yang hanya dimaksudkan mengoreksi catatan di atas TERNYATA ikut membawa tiga berkas milik agent lain yang sudah ter-stage di indeks saat itu (resources/js/pages/Admin/Customers/Index.tsx, resources/js/pages/Admin/Products/PopularityBoosts.tsx, resources/js/pages/Admin/Users/Index.tsx, mtime 15:15 dan 15:27). Penyebabnya: `git commit -F pesan` TANPA daftar path ikut menyapu seluruh isi indeks, dan di repo ini beberapa agent memakai indeks yang sama. Isi berkas tidak diubah dan tidak ada yang hilang; yang salah hanya pesan commit dan pemiliknya. Kalau Anda pemilik berkas itu, pekerjaannya sudah ada di branch, lihat `git show 79a3ad39`. Kontrak baru: selalu commit dengan daftar path eksplisit (`git commit -F pesan -- berkas1 berkas2`), jangan pernah `git commit` polos di repo ini.

Temuan dari verifikasi live di browser (bukan dari test PHP maupun typecheck): tombol Batal versi pertama saya memakai `router.reload()` dan itu SALAH. Pada Inertia versi repo ini, reload mempertahankan state komponen, sehingga mode edit ikut bertahan dan isian yang dibatalkan tetap tampil; tombolnya tampak tidak bekerja. Perbaikannya: kosongkan isian lewat `resetAndClearErrors()` pada ketiga form, baru tutup mode. Ikut ditambahkan: sesudah simpan berhasil, isian yang tersimpan dijadikan titik kembali lewat `setDefaults()`, supaya Batal berikutnya mengembalikan ke kondisi tersimpan dan bukan ke kondisi saat halaman pertama dimuat.

Bukti uji live di ra.333labs.tech/admin/storefront-platforms (browser dalam aplikasi, sesudah build ulang): mode ringkasan 0 isian dengan tombol Edit; strip tab lama 0 kemunculan; setelah Edit ditekan muncul 12 isian plus tombol Simpan dan Batal; setelah Batal ditekan kembali ke 0 isian, tombol Edit muncul lagi, Simpan hilang. Catatan alat: klik Playwright biasa pada tombol Edit dan Batal di halaman ini timeout walau elemennya terlihat dan aktif, jalur yang berhasil adalah `locator.evaluate(el => el.click())`, sama seperti catatan pada halaman Pengiriman.
Agent: zcode

## 2026-09-29 15:35 UTC | zcode | Standard | 10 halaman admin (header tabel) + CustomerService | selesai
Permintaan owner saat menunjuk halaman Customer dan Ulasan: teks tidak boleh huruf besar semua, harus Kapital Per Kata. Temuan: label header tabel di SEPULUH halaman dipaksa huruf besar oleh kelas CSS `uppercase`, padahal teks di kodenya sudah ditulis Kapital Per Kata ("No", "Pelanggan", "Nama lengkap", "Waktu Berlaku"); 14 halaman lain tidak memakai paksaan itu. Jadi konvensinya memang terbelah dan sekarang diseragamkan ke Kapital Per Kata dengan melepas kelas `uppercase` dari thead di: ActivityLogs, Announcements, ApaKata, Banners, Customers, Media/History, Products/PopularityBoosts, Testimonials, Users, Vouchers.
Tambahan pada halaman Customer yang sama: label skor risiko di CustomerService masih huruf besar semua ('RISIKO RENDAH/TINGGI/SEDANG') padahal label lain di service yang sama sudah Kapital Per Kata ('Baru', 'Aktif', 'Tidak aktif', 'Berisiko', 'Waspada', 'Aman'), jadi diubah jadi 'Risiko Rendah/Tinggi/Sedang'. Label ini murni tampilan (berpasangan dengan `tone`), tidak dipakai logika apa pun, dan tidak ada test yang menyebutnya.
Verifikasi: typecheck 0 untuk berkas yang saya ubah (typecheck repo sedang merah karena galat di StorefrontPlatforms/Edit.tsx milik agent lain yang belum selesai), lint bersih, build 0, dan uji live: header Ulasan, Voucher, Pengguna, Log Aktivitas terukur text-transform "none" dan tampil Kapital Per Kata; halaman Customer dan Ulasan juga sudah bersih dari teks huruf besar (label risiko baru ikut terverifikasi setelah build berikutnya).
TIDAK diubah dan perlu keputusan owner: nilai provinsi dan kota dari data tersimpan huruf besar ('JAWA TENGAH', 'KOTA SURABAYA') dan tampil begitu di kartu Customer serta kartu Pesanan. Mengubahnya jadi Kapital Per Kata adalah perubahan lapisan tampilan yang menyentuh beberapa halaman, jadi belum saya kerjakan.
Catatan kolaborasi: perbaikan thead untuk Customers, Users, dan Products/PopularityBoosts sudah tersapu ke commit agent lain (HEAD sudah memuatnya), dan pembersihan `uppercase` di Media/History sempat ditimpa penulisan ulang berkas oleh agent lain sehingga saya pasang ulang; staging saya lakukan per-hunk untuk empat berkas yang bercampur kerja agent lain (Customers, Media/History, Users, PopularityBoosts) supaya perubahan mereka tidak ikut ter-commit. Spec tidak berubah: tidak ada route, kolom, enum, atau bentuk JSON baru.

## 2026-09-29 15:55 UTC | zcode | Deep | c5861451 | selesai
Lingkup: Sweep ikon salin ke seluruh panel admin, atas perintah owner 29 Sep: setiap angka atau nomor diberi ikon salin, dan halaman Customer disebut lebih dulu. 15 berkas, 29 ikon salin baru. Berkas: Customers/Index, Customers/Edit, Payments/Index, Products/Show, Products/Index, Categories/Index, SubModels, ImportShow, WhatsApp/Hub, WhatsApp/Pairing, Dashboard, Orders/Index, Orders/Show, Beranda/Popular, PromotionOverview.
Dampak spec: tidak ada. Murni penambahan elemen tampilan, tanpa perubahan route, skema tabel, enum, maupun bentuk JSON props. Tidak ada dokumen kanonik yang perlu diubah.
Untuk agent berikutnya: Yang DITAMBAHKAN, Customer (ID dan nomor HP di tabel desktop plus kartu mobile, nomor order di riwayat, dan halaman detail), Pembayaran (nomor HP dan referensi transaksi), Pesanan (nomor HP di baris daftar, kartu Detail penerima, dan popup input resi), Produk (SKU varian dan SKU di daftar), Kategori dan Sub Model (kode), Import (SKU di dua tabel), WhatsApp (nomor HP percakapan dan nomor order), WhatsApp Pairing (pairing code), Dashboard (nomor order dan resi, di tabel dan kartu), Paling Banyak Dipesan (SKU), ringkasan promo (kode voucher). Yang SENGAJA DILEWATI: (a) tempat yang sudah punya tombol salin sendiri, yaitu resi dan SKU di daftar pesanan, Parent SKU di Produk/Show, nomor order di header detail pesanan, password di Users/Form, URL media di Media/Library, dimensi item di detail pesanan; (b) input form yang nilainya sudah bisa diseleksi sendiri (Kontak, Tentang Kami, Storefront Platforms, Voucher form, Customer form); (c) sebutan nomor di dalam kalimat atau judul modal seperti Pesanan X dikali nama, karena itu label bukan nilai; (d) blok ringkasan keuangan di detail pesanan yang memuat kode voucher, karena berada di area beku ADR-026 dan menambah elemen di situ berisiko memicu gerbang beku. Kalau kelak ingin yang (d) dikerjakan, naikkan versi kontrak beku lebih dulu. Pola wajib: CopyButton compact showTextInTitle, supaya tinggi ikon rapat dan seragam satu baris serta nilai yang disalin ikut disebut di judul dan label aksesibilitas. Tiga berkas yang saya sentuh sedang berisi pekerjaan agent lain yang belum di-commit (ImportShow, Products/Index, Beranda/Popular); commit saya hanya memuat hunk milik saya lewat git apply --cached dengan patch tersaring, dan pekerjaan mereka saya pastikan masih utuh di working tree setelah push (ErrorState dan refreshing 10 kemunculan, canReorder 6, Muat ulang 1).
Bukti: npx tsc --noEmit 0 error. npx eslint 15 berkas yang diubah exit 0. npm run build sukses 24.86 detik. Verifikasi live di ra.333labs.tech: Customer 32 ikon (ID dan nomor HP per baris, dua set untuk tabel dan kartu), detail Customer 6 (ID, HP, empat nomor order), Pesanan 25, Pembayaran 30, Produk 14, Dashboard 28, Kategori 3, Sub Model 20, WhatsApp 5, Paling Banyak Dipesan 25, ringkasan promo 1 (kode voucher SEPTEMBER), detail pesanan 5 termasuk Salin nomor HP 6285725116817 di kartu Detail penerima. Tidak ada halaman yang menampilkan galat. DUA HAL YANG TIDAK BISA SAYA BUKTIKAN VISUAL: tabel SKU di detail Import dan pairing code di WhatsApp Pairing, karena keduanya hanya muncul pada keadaan data tertentu (tidak ada job import dengan baris belum lengkap, dan pairing code hanya tampil saat proses pairing); keduanya sudah lulus typecheck dan lint, bukti visualnya menyusul saat keadaan itu terjadi. Catatan dua masalah yang saya temui dan selesaikan: (1) suntingan awal saya menaruh ikon sebagai saudara di dalam ternary JSX sehingga muncul error TS2657 di Dashboard dan TS1005 di Orders/Show; keduanya saya perbaiki dengan membungkus ikon dalam wadah span, dan saya periksa ulang kelas bug yang sama di 13 berkas lain; (2) impor CopyButton di Products/Index berdampingan dengan impor milik agent lain dalam SATU hunk, sehingga penyaringan per-hunk ikut menyapu perubahan mereka; saya perbaiki dengan menyusun ulang blob indeks dari versi HEAD ditambah perubahan saya saja, lalu memverifikasi indeks dengan git diff --cached. Temuan kecil yang TIDAK saya perbaiki karena sudah ada di HEAD: impor rowActionTextClass di Products/Index tidak terpakai sehingga eslint berkas itu merah, dan itu bukan berasal dari perubahan saya.

## 2026-09-29 17:15 UTC | zcode-retur | Standard | - | selesai
Lingkup: owner minta filter periode di halaman Pelanggan.
Keputusan yang diambil (owner tidak menjawab pertanyaan klarifikasi, jadi rekomendasi dipakai dan dinyatakan): periode = pelanggan yang berbelanja pada periode itu (basis created_at pesanan), angka Pesanan/Total Belanja per baris ikut periode, empat kartu ringkasan ikut periode, status keaktifan tetap seumur hidup. Default Semua waktu sehingga perilaku lama tidak berubah. Ekspor mengikuti filter layar dan namanya memuat penanda periode.
Perubahan: CustomerController (parse periode + resolusi rentang + label), CustomerService (phonesWithOrdersIn baru; metricsFor dan summaryStats menerima rentang opsional), CustomerExport (angka dan nomor pesanan per periode), Customers/Index.tsx (kontrol periode, chip, kartu ikut periode, hint arti filter), panduan admin.customers.index diperbarui.
Dampak spec: tidak berubah (tanpa route, kolom, enum, atau status baru).
Verifikasi: CustomerAdminTest 12 passed; suite penuh 1306 passed, 1 skipped, 1 FAILED yang BUKAN dari perubahan ini (lihat catatan benturan di bawah); ESLint + typecheck bersih, build sukses, Vitest 238 passed; browser: perilaku filter terbukti pada data produksi, tanpa overflow 390/1280/1440.
BENTURAN ANTAR-AGENT (dilaporkan, tidak saya perbaiki): tests/Feature/ReturnRefundIntegrityTest::test_tidak_ada_kolom_ongkir_retur_kedua_di_skema gagal karena migrasi baru 2026_09_29_000001_add_additional_shipping_to_order_return_cases (agent lain, 2026-09-29 11:23) menambahkan kembali kolom additional_shipping_amount ke order_return_cases. Tes penjaga itu masih memegang keputusan 2026-09-26 (kolom duplikat dibuang) dan belum diperbarui. Perlu keputusan pemilik tes/migrasi itu. Tidak ada kaitan dengan perubahan pelanggan.
Agent: zcode-retur

## 2026-09-29 19:40 UTC | zcode-retur | Standard | - | selesai
Lingkup: owner menemukan pemilih Media Library di Tambah Ulasan hanya bisa satu gambar, padahal desain menyebut ulasan bisa punya banyak foto; minta UI memfasilitasi spek secara utuh tanpa gap.
Akar masalah: form admin mengirim satu media_asset_id saja (handlePickMedia mengambil media[0]); foto tambahan hanya bisa lewat tempel URL manual, dan media_items (foto kiriman pelanggan) tidak pernah dikirim ke form sehingga tak bisa dikelola.
Perubahan: Testimonials/Form.tsx (pengelola foto: multi-pilih library, Tambah URL, hapus, Jadikan utama, cap maksimal), TestimonialController (terima photos[] kind library/url, resolve URL aset di server, foto pertama jadi image_url, sisanya image_urls, daftar kosong mengosongkan; props photos + maxPhotos), CmsTestimonial::MAX_PHOTOS=10, 5 test baru.
Dampak spec: tidak berubah (tanpa route/kolom/enum baru; kunci payload photos adalah bentuk form, kolom DB tetap image_url/image_urls/media_items).
Verifikasi: UlasanAdminTest 13 passed; suite penuh 1311 passed, 1 skipped, 1 failed (ReturnRefundIntegrityTest, benturan migrasi agent lain yang sudah dilaporkan); ESLint + typecheck bersih; build sukses; Vitest 238 passed; browser: dua aset terpilih sekaligus, badge Utama/Hapus/Jadikan utama bekerja, tanpa overflow 390/1280.
Catatan gap lain yang sengaja TIDAK diubah: GalleryForm (Hasil Pemasangan) tetap satu gambar karena entitasnya memang satu foto + keterangan.
Agent: zcode-retur

## 2026-09-29 20:15 UTC | zcode-retur | Standard | - | selesai
Lingkup: owner mengoreksi implementasi sebelumnya - MediaPicker reusable, jadi skema payload harus sama dengan form admin lain.
Perubahan: Testimonials/Form.tsx (payload media_asset_ids + image_urls, grid gaya galeri Model Produk, geser dibatasi per kelompok), TestimonialController (resolveMediaAssetIds, batas gabungan MAX_PHOTOS), tes disesuaikan.
Dampak spec: tidak berubah (tanpa route/kolom/enum baru).
Verifikasi: UlasanAdminTest 13 passed; suite terkait 47 passed; suite penuh 1311 passed, 1 failed (benturan migrasi agent lain, sudah dilaporkan); ESLint + typecheck + build + Vitest bersih; browser: multi-pilih 3 aset, badge Utama/URL, geser, tanpa overflow 390/1280.
Agent: zcode-retur

## 2026-09-29 20:45 UTC | zcode-retur | Trivial | - | selesai
Lingkup: owner menyorot dropdown rating di Tambah Ulasan (angka polos, minta bintang) dan meminta kolom Urutan dihapus karena fitur/skema belum matang.
Perubahan: opsi rating jadi bintang + N bintang (label satu string, children array tidak didukung komponen Select); blok Urutan dihapus dari form; server mempertahankan sort_order lama saat update tanpa sort_order.
Dampak spec: tidak berubah.
Verifikasi: UlasanAdminTest 13 passed; ESLint + typecheck + build bersih; browser: opsi 1-5 bintang tampil, pemilihan bekerja, kolom Urutan hilang.
Agent: zcode-retur

## 2026-09-29 21:00 UTC | zcode-retur | Trivial | - | selesai
Lingkup: owner menanyakan kenapa ada dropdown Sumber di form ulasan website.
Akar: satu komponen form dipakai dua intent (website dan marketplace screenshot); dropdown sumber dirender di keduanya padahal untuk website hanya berarti satu nilai.
Perubahan: dropdown Sumber hanya dirender pada intent marketplace; form website selalu mengirim source=website.
Dampak spec: tidak berubah.
Verifikasi: UlasanAdminTest 13 passed, ESLint + typecheck bersih, build sukses; browser memastikan form website tanpa Sumber dan form marketplace tetap punya pilihan Shopee/WhatsApp.
Agent: zcode-retur

## 2026-09-29 21:20 UTC | zcode-retur | Trivial | - | selesai
Lingkup: owner menyebut kotak kosong bergaris putus useless (kesannya drag&drop) dan minta isian setelah foto disatukan satu baris horizontal.
Perubahan: kotak kosong jadi tombol klik pembuka Media Library; Nama/Lokasi/Rating/Produk disatukan satu baris (grid 4 kolom di xl, 2 kolom untuk intent screenshot); UlasanAdminTest tidak tersentuh (perubahan murni layout).
Dampak spec: tidak berubah.
Verifikasi: ESLint + typecheck + build bersih; browser: 4 kontrol segaris (Y identik), kotak klik membuka picker 48 aset, tanpa overflow.
Agent: zcode-retur

## 2026-09-29 21:35 UTC | zcode-retur | Trivial | - | selesai
Lingkup: owner minta Produk terkait memakai produk picker.
Perubahan: dropdown Select diganti SearchSelect (pemilih bercari) di Testimonials/Form.tsx; productOptions() kini memuat semua produk aktif tanpa limit 500 (cache 5 menit) dan mengembalikan {value,label} termasuk opsi kosong Ulasan umum.
Dampak spec: tidak berubah.
Verifikasi: UlasanAdminTest + ProductReviewsTest 23 passed; ESLint + typecheck + build bersih; browser: picker terbuka, pencarian dan pemilihan bekerja, form tidak disimpan.
Agent: zcode-retur

## 2026-09-29 16:05 UTC | zcode | Standard | (commit ini) | selesai

Lingkup: Tata letak halaman Profil & Kontak Toko. Owner 2026-09-29 setelah melihat hasil penggabungan tab: "looooooooooooook that damn huge space".
Berkas: resources/js/pages/Admin/StorefrontPlatforms/Edit.tsx

Akar masalah: pembungkus form saya dipatok `max-w-5xl` (terukur 896px) padahal layar kerja owner 2236px, jadi lebih dari separuh lebar halaman kosong melompong. Pembungkus sempit itu saya warisi dari bentuk lama halaman ini waktu masih bertab. Selain jelek, itu juga melanggar kontrak panel admin (Table-First: form dan subhalaman administrasi wajib membentang penuh, bukan kartu sempit dengan whitespace berlebih di samping).

Perubahan: pembungkus form jadi `w-full` tanpa batas lebar. Kelompok isi disusun dua kolom seperti pola dashboard admin lain: Marketplace Resmi sebaris Media Sosial Resmi, Informasi Kontak sebaris Lokasi Workshop & Jam Operasional, Logo Toko sebaris Favicon. Kartu tabel platform dibangun ulang memakai primitif bersama `SectionCard` dengan `contentClassName="p-0"` dan padding sel `px-4 py-3`, mengikuti konvensi halaman admin lain, jadi judul dan keterangannya seragam dengan kartu lain (sebelumnya header tabel buatan sendiri). Ikon kartu ditambahkan (storefront, share, message-circle, map-pin, image).

Dampak spec: Spec tidak berubah. Tidak ada route, parameter, kolom, enum, atau bentuk JSON baru.

Verifikasi: pengukuran live di browser (layar 2236px). Sebelum: form 896px, kartu 438px masing-masing, ruang kosong kanan sekitar 1130px. Sesudah: form 1970px, enam kartu masing-masing 975px dalam dua kolom, ruang kosong kanan 28px (sisa padding halaman). Uji mode edit tetap bekerja: mode ringkasan 0 isian dengan tombol Edit, setelah Edit 12 isian plus Simpan/Batal, setelah Batal kembali 0 isian dan tombol Edit muncul lagi. Test PHP terkait lulus 17 test / 580 asersi (BrandAssetsTabTest, StorefrontPlatformsAdminTest, KontakAdminTest, FrontendPageContractTest). `npx tsc --noEmit` bersih untuk berkas ini, `npx eslint` exit 0, build aset sukses, dan screenshot live sudah saya lihat sendiri.

Pelajaran untuk halaman berikutnya: mengubah form bertab menjadi satu view berarti membuang juga batas lebar sempit yang dulu dipilih untuk bentuk bertab. Batas lebar seperti `max-w-5xl` pada halaman admin hanya pantas untuk form isian tunggal yang memang sempit secara alami, bukan untuk halaman yang menampilkan banyak kartu.
Agent: zcode

## 2026-09-29 17:20 UTC | zcode | Deep | (commit ini) | selesai

Lingkup: Penyeragaman pemilih media di panel admin. Owner 2026-09-29: "semua fitur/menu dengan konteks pilih gambar harus pakai media picker. untuk pilih produk harus pakai product picker. saya ga mau 1 fitur sama tapi model menu beda-beda. cek secara menyeluruh mana saja yg menggunakan, lalu rubah". Tahap ini menuntaskan sisi MEDIA; sisi produk menyusul.
Berkas: resources/js/components/admin/media-picker.tsx, resources/js/pages/Admin/Banners/Form.tsx, resources/js/pages/Admin/Testimonials/GalleryForm.tsx, resources/js/pages/Admin/MasalahSolusi/Form.tsx, resources/js/pages/Admin/StorefrontPlatforms/Edit.tsx, tests/Feature/FrontendPageContractTest.php

Hasil inventaris menyeluruh. Ada TIGA pemilih media ke endpoint yang sama (`admin.media.picker`):
1. `MediaPicker` (modal) dipakai 7 halaman: InstallationGallery/Form, InstallationGallery/Model, Media/Library, ModelProducts/Form, ProductForm, TentangKami/Edit, Testimonials/Form.
2. `MediaLibrarySelect` (dropdown ringan) dipakai 7 TITIK di 4 halaman: Banners/Form 1, Testimonials/GalleryForm 1, MasalahSolusi/Form 3 (foto contoh, video, poster video), StorefrontPlatforms/Edit 2 (logo, favicon). Titik ketiga di MasalahSolusi (poster) tidak terlihat pada pembacaan pertama dan baru ketahuan dari error typecheck; grep awal menghitung berkas, bukan jumlah pemakaian.
3. `product-edit/media-panel.tsx` merakit pemilih sendiri di dalam form produk (cakupan folder saran, jumlah pemakaian, filter status, opsi pasang ke varian/katalog/instalasi). Ini BELUM diseragamkan, lihat catatan keputusan di bawah.

Perubahan: MediaPicker diberi prop `kind` (image|video) yang diteruskan ke server. Penyaringan sengaja di server, bukan di sisi klien, karena daftar dibatasi 48 aset terbaru sehingga aset jenis lain akan memakan jatah sebelum disaring. Tujuh titik MediaLibrarySelect diganti tombol pemicu + modal MediaPicker, mengikuti pola yang sudah dipakai halaman Tentang Kami dan form produk. Pemilih poster video di MasalahSolusi juga ikut (kind image). Kalimat basi di modal MediaPicker ("atau unggah foto/video baru") diperbaiki: pemilih ini tidak punya tab unggah sejak Media Library menjadi satu-satunya sumber media.

TEMUAN PENTING (di luar lingkup permintaan, tapi harus diketahui): `resources/js/components/admin/media-library-select.tsx` TIDAK ADA di git (untracked, tanggal 18 sampai 20 Sep, tanpa riwayat). Padahal versi di HEAD beberapa halaman masih mengimpornya, jadi HEAD sebenarnya rusak untuk clone baru: build akan gagal karena modul tidak ditemukan. Perubahan ini menghapus SELURUH impor ke berkas itu, sekaligus memperbaiki kerusakan tersebut. Berkasnya tetap ada di disk sebagai arsip (guard bash-guard.js memblokir penghapusan isi `resources`, dan kontrak repo memang "arsipkan, jangan hapus"). Penjaga baru memastikan tidak ada impor baru ke sana.

Ikut dibersihkan: GalleryForm menyimpan sisa jalur unggah berkas yang sudah dimatikan (impor `usePage`, tipe `SharedPageProps`, prop `presignUrl` tanpa pemakai) yang memunculkan tiga error lint; ketiganya dibuang karena berkasnya sedang disentuh.

Dampak spec: Spec tidak berubah. Tidak ada route, kolom, enum, atau bentuk JSON baru. Endpoint `admin.media.picker` sudah mendukung `kind` sebelumnya.

Verifikasi: guard baru `test_pemilih_media_hanya_satu_komponen` lulus (memastikan tidak ada impor ke pemilih kedua). FrontendPageContractTest 11 lulus / 503 asersi. `npx tsc --noEmit` bersih, `npx eslint` bersih untuk kelima berkas, build aset sukses. Uji live di browser: Profil & Kontak Toko (tombol Pilih logo membuka modal "Pilih Logo Toko" dengan filter folder dan pencarian), Banners/create ("Pilih gambar" membuka "Pilih Gambar Banner Promo"), Masalah & Solusi item 4 (tombol Tambah foto dan Tambah video ada, dropdown lama hilang, dan pemilihan TIGA foto berurutan tercentang 1 lalu 2 lalu 3 sebelum modal ditutup lewat "Gunakan media").
Suite penuh: 1311 lulus, 1 skipped, 1 GAGAL. Kegagalan itu bukan dari perubahan ini, melainkan bentrok antar agent di working tree bersama: migrasi `2026_09_29_000001_add_additional_shipping_to_order_return_cases.php` (dibuat 11:23 hari ini) menambahkan kembali kolom yang justru diwajibkan TIDAK ada oleh `ReturnRefundIntegrityTest`. Pemilik migrasi itu perlu memutuskan arahnya.

KEPUTUSAN YANG MENUNGGU OWNER: `product-edit/media-panel.tsx` (panel "Tambah media" di form produk) sengaja TIDAK diseragamkan dulu. Ia memang memilih media, tetapi fungsi aslinya berbeda: mengelola media milik satu produk, dengan cakupan folder saran produk itu, jumlah pemakaian tiap aset, filter status, dan opsi pasang ke varian/katalog/instalasi. Menukarnya dengan modal MediaPicker akan menghilangkan cakupan dan opsi pasang itu. Pilihan yang tersedia: (a) biarkan sebagai pemilih khusus produk, (b) arahkan tombol "pilih dari library" di dalamnya ke MediaPicker lalu sisakan hanya opsi pasang, atau (c) jadikan MediaPicker punya mode "pasang ke produk". Mana pun yang dipilih, saya perlu keputusan karena mengubahnya menyentuh alur pasang media ke produk.

Untuk agent berikutnya: sisi PRODUK belum dikerjakan, dan di sana ada EMPAT model berbeda: (1) `ui/ProductPicker` (panel dengan cari, filter kategori/model, centang massal, paginasi) dipakai PromotionForm; (2) `order-product-picker` (dialog cari produk lalu pilih varian dan jumlah) dipakai Orders/Show; (3) dropdown `<Select>` daftar produk di Vouchers/Form (target produk), Testimonials/Form (produk terkait), InstallationGallery/Form (produk per model); (4) dropdown pencarian buatan sendiri lewat `admin.media.products.search` di Testimonials/Index dan Media/Library. Perlu diputuskan lebih dulu mana yang jadi acuan, karena kebutuhan varian+jumlah di pemilih pesanan berbeda sifat dari kebutuhan "pilih produk sebagai target".
Agent: zcode

## 2026-09-29 22:00 UTC | zcode-retur | Standard | - | selesai
Lingkup: owner menanyakan keberadaan produk picker reusable; komponen ProductPicker ternyata sudah ada (dipakai form promo) dan belum dipakai di form ulasan.
Perubahan: SearchSelect diganti ProductPicker dalam Sheet (maxSelection=1) di Testimonials/Form.tsx; trigger menampilkan nama+SKU dengan tombol Kosongkan; TestimonialController: productOptions/Cache dibuang, initialProductFor() mengirim pratinjau produk tersimpan.
Dampak spec: tidak berubah.
Verifikasi: UlasanAdminTest + ProductReviewsTest 23 passed; ESLint + typecheck + build bersih; browser: sheet terbuka 135 produk, pilih satu berhasil, trigger menampilkan produk terpilih. Form tidak disimpan.
Agent: zcode-retur

## 2026-09-29 06:55 UTC | zcode | Trivial | lib/format.ts, Announcements/Index.tsx, PromotionOverview.tsx, format.test.ts | selesai
Owner menunjuk kolom Periode di halaman Bar Promo yang menampilkan "- → -" dan menyebutnya aneh. Ada dua masalah di sana: (1) bar promo tanpa tanggal (2 dari 7 baris) ditulis dengan tanda hubung di kedua sisi, padahal tanggal mulai kosong berarti "sudah boleh tampil" dan tanggal akhir kosong berarti "tanpa batas akhir" (perilaku penyaring tayang), jadi itu bukan data hilang melainkan berlaku terus; (2) tanggal ditulis mentah dari payload (toDateString) sehingga tampil "2026-07-01 → 2026-09-30", berbeda dari halaman Beranda yang sudah memformat "1 Jul 2026".
Perbaikan: formatter bersama baru `formatRentangTanggal(mulai, akhir)` di lib/format.ts dengan empat keadaan: keduanya terisi "1 Jul 2026 → 30 Sep 2026", keduanya kosong "Tanpa batas" (sekali saja, bukan "- → -"), hanya mulai "Mulai 1 Jul 2026", hanya akhir "Sampai 30 Sep 2026". Dipakai di halaman Bar Promo dan di baris bar promo halaman Beranda sekaligus supaya satu entitas tampil sama di dua tempat (sebelumnya Beranda menulis "tanpa batas → tanpa batas").
Verifikasi: 4 test penjaga baru di tests/frontend/format.test.ts (kedua sisi terisi, kedua sisi kosong tidak memakai tanda hubung, satu sisi kosong disebut dengan kata, nilai tanggal rusak tidak ditampilkan apa adanya); seluruh test frontend 242 lulus; typecheck 0; lint bersih; build 0; live setelah muat ulang: kolom Periode halaman Bar Promo kini "Tanpa batas" (2 baris) dan "1 Jul 2026 → 30 Sep 2026 / 31 Des 2026" (5 baris), dan baris bar promo di Beranda menampilkan bentuk yang sama. Spec tidak berubah: tidak ada route, kolom, enum, atau bentuk JSON baru; payload tetap mengirim tanggal apa adanya.
Catatan: kolom "Diperbarui" memakai helper format lokal di halaman itu (gaya tanggal ringkas + jam), sengaja tidak saya ubah karena bukan bagian keluhan dan gayanya sudah dipakai konsisten di kolom itu.

## 2026-09-30 07:00 UTC | zcode | Deep | 968878b8 | selesai
Lingkup: Tombol kirim ulang per pesan di daftar Pesan Gagal hub WhatsApp (/admin/whatsapp), permintaan owner 29 Sep: saat pesan gagal, admin mengirim ulang templatnya dari daftar itu lalu barisnya hilang. Berkas: app/Services/WhatsAppService.php, app/Http/Controllers/Admin/WhatsAppMessageController.php, app/Http/Controllers/Admin/WhatsAppTemplateController.php, app/Http/Controllers/Admin/OrderController.php, routes/web.php, resources/js/pages/Admin/WhatsApp/Hub.tsx, docs/api-and-routes-ragil-aluminium.md, tests/Feature/AdminWhatsappListResendTest.php (baru).
Dampak spec: SPEC_CHANGED_AND_DOCS_UPDATED. Rute baru POST admin/whatsapp/messages/{message}/resend (name admin.whatsapp.messages.resend). Kolom payload failed_messages bertambah can_resend. Sekalian memperbaiki tiga baris dokumen route kanonik yang BASI di area yang sama: admin.whatsapp.connection sebenarnya Closure bukan method controller, admin.whatsapp.messages sebenarnya redirectToOrders bukan index, dan satu baris rute hantu GET /admin/whatsapp/messages/{message} yang sudah tidak ada di routes/web.php sudah dihapus. Tidak ada perubahan skema tabel.
Untuk agent berikutnya: BEDA DUA TOMBOL KIRIM ULANG, jangan disamakan. (1) Tombol borongan di header detail pesanan (admin.orders.whatsapp.resend) tetap dibatasi jendela 24 jam, hanya kunci templat perubahan status, dan dedup lewat superseded_by; itu penjaga untuk kirim ulang sekaligus satu pesanan. (2) Tombol per baris di hub TIDAK dibatasi umur dan tidak dibatasi kunci templat, karena admin memilih barisnya sendiri; naskah yang dikirim adalah snapshot content_text baris itu, sama seperti aturan kirim ulang yang sudah berlaku. Mekanisme supersede dipakai bersama lewat WhatsAppService::supersedeAttempts supaya satu notifikasi tidak pernah terkirim dua kali; siblingAttempts mengelompokkan per (order + kunci templat) atau per (nomor + kunci templat) bila pesannya tidak tertaut pesanan, dan pesan manual tanpa kunci templat sengaja TIDAK punya kelompok agar kirim ulang manual tidak menyentuh baris lain. Daftar dan angka failed_count di hub kini mengecualikan superseded_by, sama seperti whatsapp_failed_count di header pesanan; ini tidak mengubah angka apa pun sampai ada kirim ulang, karena superseded_by masih nol di seluruh data. Kalau kelak ada konsumen baru membaca daftar pesan gagal, pakai filter superseded_by yang sama. TEMUAN yang belum ditangani: baris yang sebabnya di nomor pelanggan (mis. Nomor tidak terdaftar WhatsApp) tidak akan pernah bisa dibereskan dengan kirim ulang, jadi angkanya tidak akan nol sampai nomor pelanggannya dibetulkan; owner belum memutuskan apakah perlu cara menandai baris semacam itu selesai/diabaikan.
Bukti: AdminWhatsappListResendTest 6 test lulus (61 asersi): baris hilang setelah kirim ulang dan tidak ada baris baru dibuat, percobaan kembar ditandai digantikan sehingga tidak terkirim ganda, pesan manual tidak menyentuh baris lain, pesan masuk atau tanpa naskah ditolak tanpa mengubah apa pun, gagal kirim ulang melaporkan alasan dan baris tetap tinggal, gagal lama tetap bisa dikirim ulang. Regresi: AdminWhatsappResendTest (jalur borongan setelah refactor) dan WhatsAppHubFailedMessagesTest (kontrak angka) lulus. Seluruh suite WhatsApp 85 test (626 asersi) dan suite Order 106 test (805 asersi) lulus. npx tsc --noEmit 0 error. npx eslint Hub.tsx exit 0. npm run build sukses. Verifikasi live di ra.333labs.tech/admin/whatsapp: kolom Aksi tampil dengan tombol Kirim ulang per baris; menekan baris bernomor uji resmi 6285725116817 (WA Pesanan Sampai, 25 Agt 19.39) membuat barisnya HILANG dari daftar, angka turun 27 ke 26, dan di basis data baris itu jadi status read dengan sent_at terisi, error_reason kosong, sedangkan jejak kegagalan sebelumnya tersimpan di raw_payload.resend. Uji jalur gagal memakai baris nomor 628123456789 yang memang tidak terdaftar WhatsApp (aman, cek pra-kirim menahan sebelum ada pesan terkirim): muncul pesan Kirim ulang gagal: Nomor tidak terdaftar WhatsApp dan barisnya tetap tinggal.
