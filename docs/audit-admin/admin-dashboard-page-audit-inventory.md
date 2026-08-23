# Admin Dashboard Page-by-Page Audit Inventory

> Companion document untuk `admin-dashboard-audit-todo.md`.
>
> Tujuan dokumen ini adalah mengubah backlog audit tingkat sistem menjadi daftar halaman yang dapat dieksekusi oleh product designer, frontend engineer, backend engineer, dan AI coding agent.
>
> Setiap halaman dinilai dari tujuan kerja admin, tipe layout, masalah UX/UI, risiko data/workflow, prioritas, rekomendasi desain, dan acceptance criteria.

---

## Cara menggunakan inventory

Gunakan urutan kerja berikut:

```text
1. Pilih halaman berdasarkan prioritas P0/P1/P2.
2. Verifikasi tujuan bisnis dan source of truth data.
3. Terapkan layout type yang direkomendasikan.
4. Periksa status/action/filter/loading/error/accessibility.
5. Implementasi perubahan kecil dan dapat diuji.
6. Validasi acceptance criteria sebelum lanjut ke halaman berikutnya.
```

Definisi prioritas:

```text
P0 = langsung memengaruhi order, pembayaran, pengiriman, keamanan, atau pekerjaan harian admin.
P1 = memengaruhi skalabilitas katalog, merchandising, dan konsistensi CMS.
P2 = meningkatkan maturity, discovery, dan efisiensi jangka panjang.
```

---

# 1. App Shell dan Navigasi Global

## Tujuan

Membuat semua halaman terasa sebagai satu sistem admin yang konsisten, mudah dipindai, dan tidak membebani mental admin.

## Layout type

```text
Persistent sidebar + top application bar + standard page shell
```

## Masalah/risk

- Sidebar panjang dan mencampur operasi harian, konfigurasi, konten, analytics, dan settings.
- Banyak menu setara padahal frekuensi penggunaan sangat berbeda.
- Promo dan content placement bercampur dalam grup yang sama.
- Global search terlihat ada, tetapi scope hasilnya belum jelas.
- Ada risiko admin kesulitan menemukan area untuk tugas cepat.

## Rekomendasi

- Kelompokkan sidebar berdasarkan domain kerja:

```text
Workspace
- Dashboard
- Perlu Tindakan
- Notifikasi

Operasional
- Pesanan
- Pembayaran
- Pengiriman
- Customer

Katalog
- Produk
- Kategori
- Model Produk
- Sub Model
- Media
- Import & Sinkronisasi

Merchandising
- Promo Harga
- Flash Sale
- Voucher
- Subsidi Ongkir
- Popularitas
- Beranda & Koleksi

Konten Website
- Banner
- Bar Promo
- Cara Pemesanan
- FAQ
- Masalah & Solusi
- Dokumen
- Ulasan
- Hasil Pemasangan
- Marketplace & Media Sosial

Insights
- Performa Toko
- Penjualan
- Produk
- Customer
- Operasional

Settings
- Profil Saya
- Manajemen Admin
- Pengaturan Sistem
- Log Aktivitas
```

- Pisahkan page group yang sering dipakai dari konfigurasi yang jarang dipakai.
- Tambahkan collapse state/sidebar compact untuk laptop kecil.
- Definisikan global search sebagai command palette bertahap.
- Standarkan top bar: global search, system health shortcut, notifications, profile menu.

## Acceptance criteria

- [ ] Admin dapat menemukan Pesanan, Produk, Promo, CMS, dan Settings dalam satu scan.
- [ ] Operasional tidak bercampur dengan pengaturan jarang dipakai.
- [ ] Menu aktif dan submenu aktif selalu terlihat jelas.
- [ ] Sidebar tetap usable pada lebar laptop minimal 1366px.
- [ ] Global search memiliki scope yang jelas atau diberi placeholder yang menjelaskan fungsinya.

---

# 2. Dashboard

## Tujuan

Menjadi command center untuk pekerjaan harian admin, bukan sekadar kumpulan analytics.

## Layout type

```text
Operational workspace / action-first dashboard
```

## Masalah/risk

- KPI, status operasional, order terbaru, dan system health memiliki bobot visual yang terlalu setara.
- Antrian tindakan belum cukup dominan.
- Metrik yang belum actionable dapat mengambil ruang dari masalah yang perlu diselesaikan.
- Admin perlu mengetahui pekerjaan prioritas tanpa membuka banyak halaman.

## Rekomendasi layout

```text
Page header
- Greeting
- Last updated
- Refresh

Action Center
- Perlu konfirmasi
- Payment verification
- Order melewati SLA
- Shipping problem
- WhatsApp failed
- Import/media failed

Operational snapshot
- Baru
- Diproses
- Siap kirim
- Dikirim
- Selesai
- Dibatalkan

Recent orders

Business snapshot
- Omzet
- Unit
- Conversion
- Customer baru
- Repeat order

System health
- WhatsApp
- J&T
- Queue
- Media
```

## Acceptance criteria

- [ ] Area `Perlu tindakan` adalah section paling mudah ditemukan setelah header.
- [ ] Semua item action center memiliki jumlah, severity, dan deep link ke filtered list.
- [ ] Metrik bisnis tidak mendominasi pekerjaan yang bersifat urgent.
- [ ] Recent orders dapat dibuka ke detail tanpa kehilangan konteks.
- [ ] System health menggunakan status ringkas dan tidak memakan ruang berlebihan.

---

# 3. Performa Toko

## Tujuan

Membantu owner/admin mengambil keputusan bisnis dari data, bukan hanya melihat angka.

## Layout type

```text
Analytics page dengan tab/section berdasarkan decision area
```

## Masalah/risk

- Banyak KPI dan chart tampil sekaligus.
- Beberapa metric mungkin belum cukup data atau belum actionable.
- Filter periode, comparison, dan granularity berpotensi membingungkan.
- Chart tanpa drill-down cenderung menjadi dekoratif.

## Rekomendasi

Bagi menjadi tab:

```text
Ringkasan
Produk
Customer
Operasional
```

Filter prioritas:

```text
Tanggal/periode
Bandingkan dengan
Granularity chart
Filter tambahan
```

Setiap metric wajib memiliki:

```text
Nama
Nilai saat ini
Perbandingan
Periode
Definisi singkat
Link/drill-down jika actionable
```

## Acceptance criteria

- [ ] Tidak lebih dari 5–6 KPI utama pada tab Ringkasan.
- [ ] Setiap metric dapat dijelaskan formula dan data source-nya.
- [ ] Chart memiliki empty state bila data belum cukup.
- [ ] Filter periode tidak bercampur dengan sort/filter tabel.
- [ ] Admin dapat masuk dari metric ke daftar source data yang relevan.

---

# 4. Daftar Pesanan

## Tujuan

Memproses order harian secara cepat, aman, dan berdasarkan status prioritas.

## Layout type

```text
Operational list / work queue
```

## Masalah/risk

- Banyak action tampil dalam satu row.
- Status order, payment, dan shipping berpotensi tercampur.
- Filter dapat menjadi terlalu padat.
- Order yang melewati SLA belum tentu terlihat menonjol.

## Rekomendasi

Toolbar:

```text
[Search order/customer] [Status order] [Tanggal] [Filter lainnya] [Sort]    [Export]
```

Filter tambahan:

```text
Payment method
Payment status
Shipping status
Kurir
SLA/age
Customer
Order source
```

Row action berdasarkan state:

```text
Order baru            → Konfirmasi pesanan
Payment pending       → Lihat pembayaran
Siap dikirim          → Input resi
Dalam perjalanan      → Lihat tracking
Selesai               → Lihat detail
Exception             → Tangani masalah
```

## Acceptance criteria

- [ ] Satu primary action per row sesuai status.
- [ ] Detail selalu tersedia sebagai action sekunder.
- [ ] Chat, print, cancel, dan action jarang dipakai berada di `Lainnya`.
- [ ] Order/payment/shipping status dapat dibaca tanpa ambigu.
- [ ] SLA atau item perlu tindakan memiliki visual priority.
- [ ] Bulk selection dan bulk action memiliki confirmation/impact preview.

---

# 5. Detail Pesanan

## Tujuan

Memberi admin konteks lengkap untuk mengambil action order tanpa mengubah banyak halaman.

## Layout type

```text
Entity detail page: summary header + two-column content + progressive disclosure
```

## Masalah/risk

- Terlalu banyak informasi dapat berada dalam satu layar dengan level hierarchy serupa.
- Log WhatsApp, raw tracking, log pembayaran, customer notes, dan item dapat bersaing dengan informasi inti.
- Action order berisiko tersembunyi di antara blok detail.

## Rekomendasi

```text
Header
- Order number
- Current status stack
- Customer
- Total
- Primary action

Main column
- Item pesanan
- Payment summary
- Shipping summary
- Order milestone/timeline

Side column
- Customer
- Alamat penerima
- Catatan pembeli
- Resi/kurir
- Secondary actions

Secondary/accordion or tabs
- Log WhatsApp
- Audit log
- Raw carrier events
- Payment event history
```

## Acceptance criteria

- [ ] Status utama dan primary action terlihat tanpa scroll.
- [ ] Item, payment, shipping, dan customer tidak saling tercampur.
- [ ] Raw technical log tidak lebih dominan dari order summary.
- [ ] Semua action kritis punya confirmation dan audit.
- [ ] Layout tetap usable pada laptop kecil dan responsive pada tablet.

---

# 6. Pembayaran

## Tujuan

Memantau dan memproses pembayaran secara akurat, terutama transfer manual, payment pending, COD, dan refund.

## Layout type

```text
Operational payment queue + payment detail
```

## Masalah/risk

- COD pending dapat disalahartikan sama dengan transfer unpaid.
- Status pembayaran yang sederhana belum cukup untuk workflow verifikasi/refund.
- Tidak semua payment action bersifat sama risiko.

## Rekomendasi

Status canonical:

```text
Unpaid
Proof received
Pending verification
Paid
Failed
Expired
Refund requested
Refund in progress
Refunded
COD pending collection
COD collected
COD collection failed
```

Summary queue:

```text
Perlu verifikasi
Belum dibayar
Diterima hari ini
COD dalam perjalanan
Refund berjalan
```

## Acceptance criteria

- [ ] COD dan transfer memiliki copy/status berbeda.
- [ ] Transfer verification memiliki proof, amount, bank, sender, timestamp, verifier, notes, approve/reject.
- [ ] Payment action berisiko dicatat di audit log.
- [ ] Refund memiliki status dan reason yang jelas.
- [ ] Semua total payment konsisten dengan order financial summary.

---

# 7. Pengiriman

## Tujuan

Mengelola resi, integrasi carrier, refresh tracking, dan exception pengiriman.

## Layout type

```text
Shipment list + shipment detail
```

## Masalah/risk

- Status internal fulfillment dan status carrier dapat tercampur.
- Tombol refresh berpotensi tidak memberikan feedback.
- Raw carrier event dapat terlalu teknis.
- Tracking belum tersedia harus ditangani dengan state yang jelas.

## Rekomendasi

Daftar pengiriman menampilkan:

```text
Resi
Order
Customer
Kurir
Fulfillment status
Carrier status
Last carrier update
Last sync
Primary action
```

Detail pengiriman:

```text
Shipment summary
Carrier status
Last update
Milestone timeline
Raw event accordion
Refresh history
Exception action
```

## Acceptance criteria

- [ ] `Segarkan` memiliki loading, success, error, dan cooldown state.
- [ ] Status internal dan carrier diberi label terpisah.
- [ ] Last sync dan last carrier event bisa dibedakan.
- [ ] Raw carrier event dinormalisasi untuk tampilan utama.
- [ ] Stale tracking memicu warning/action bila melebihi SLA.
- [ ] Multiple shipment tidak dicampur dalam satu timeline tanpa grouping.

---

# 8. Produk List

## Tujuan

Mengelola produk dalam jumlah besar dengan pencarian, filter, bulk action, dan status katalog yang jelas.

## Layout type

```text
Data table dengan configurable columns
```

## Masalah/risk

- Tabel sangat lebar: produk, kategori, model, desain, status, harga, stok, varian, terjual, action.
- Semua kolom terlihat setara walau tidak semua dibutuhkan setiap hari.
- Admin perlu membedakan produk aktif, draft, arsip, dan product completeness.

## Rekomendasi

Kolom default:

```text
Produk
Status
Harga
Stok
Varian
Aksi
```

Kolom optional:

```text
Kategori
Model
Submodel/desain
Terjual
SKU
Last updated
Completeness
```

Tambahkan:

```text
Column visibility
Saved view
Sticky first/action column
Bulk action
Completeness filter
Archive/restore filter
```

## Acceptance criteria

- [ ] Tabel tetap mudah dipakai pada 1366px.
- [ ] Admin dapat menyembunyikan kolom sekunder.
- [ ] Produk aktif/draft/arsip terlihat jelas.
- [ ] Bulk action memiliki preview dan confirmation.
- [ ] Produk tidak dapat dihapus keras jika punya histori order.

---

# 9. Product Wizard: Identitas, Varian, Media, Review

## Tujuan

Membuat atau mengedit produk dengan proses aman sampai siap publish.

## Layout type

```text
Multi-step form wizard dengan sticky action footer dan review gate
```

## Masalah/risk

- Step bisa terasa linear tetapi blocker tidak langsung diarahkan ke field sumber.
- Form panjang mudah kehilangan save state.
- Publish risk tinggi jika validasi tidak terintegrasi.

## Rekomendasi

Step state:

```text
Completed
Current
Blocked
Optional
```

Footer:

```text
Simpan draft
Simpan & lanjut
Kembali
Publish / Simpan & publikasikan
```

Review page harus memiliki:

```text
Checklist
Status each requirement
Link “Perbaiki” ke step/field
Preview katalog
Publish gate
```

## Acceptance criteria

- [ ] Input tidak hilang saat pindah step.
- [ ] Unsaved changes terlihat jelas.
- [ ] Semua blocker dapat diklik menuju sumber masalah.
- [ ] Produk hanya dapat dipublish saat mandatory checklist selesai.
- [ ] Copy `draft`, `aktif`, dan `published` tidak ambigu.

---

# 10. Kategori, Model Produk, dan Sub Model

## Tujuan

Menjaga taxonomy katalog tetap mudah dipahami dan aman terhadap dependency.

## Layout type

```text
Taxonomy management list + drill-down
```

## Definisi wajib

```text
Kategori  = kelompok utama produk, misalnya Jendela, Pintu, Boven.
Model     = tipe/fungsi produk, misalnya Jungkit, Sliding, Swing, Kaca Mati.
Sub Model = variasi desain/configuration, misalnya Polos, Ornamen, Kombinasi.
Produk    = item konkret yang dijual.
Varian    = ukuran, warna, kaca, SKU, harga, dan stok spesifik.
```

## Rekomendasi

- Tambahkan helper text pada setiap page/form taxonomy.
- Tampilkan product count aktif, draft, dan arsip.
- Tambahkan link drill-down ke produk terkait.
- Gunakan archive/nonaktifkan, bukan hard delete jika sudah dipakai.
- Tambahkan dependency warning sebelum archive/delete.
- Untuk Sub Model, tampilkan parent model yang aktif secara jelas.

## Acceptance criteria

- [ ] Admin baru mengerti beda kategori/model/submodel tanpa dokumentasi eksternal.
- [ ] Entity taxonomy tidak dapat dihapus jika akan merusak referensi aktif.
- [ ] Urutan taxonomy yang dipakai storefront bisa dikelola dengan aman.
- [ ] Empty submodel/product count memiliki explanation dan CTA relevan.

---

# 11. Import Katalog dan Performa Import

## Tujuan

Melakukan perubahan katalog massal secara aman, dapat dipreview, dapat dilacak, dan dapat dipulihkan.

## Layout type

```text
Import wizard + job monitoring dashboard
```

## Rekomendasi workflow

```text
1. Pilih tipe import
2. Download template
3. Upload file
4. Validasi kolom
5. Preview rows
6. Tampilkan error per row
7. Tampilkan impact summary
8. Konfirmasi job
9. Monitor queue/progress
10. Result + error report + retry failed
```

## Impact summary wajib

```text
Rows detected
Will create
Will update
Will archive
Will skip
Invalid rows
Potential duplicate rows
```

## Acceptance criteria

- [ ] Tombol mulai import tidak aktif sebelum validasi minimum selesai.
- [ ] Admin melihat dampak sebelum import dijalankan.
- [ ] Error dapat diunduh per row.
- [ ] Gagal sebagian tidak menghilangkan hasil sukses.
- [ ] Ada retry failed rows.
- [ ] Audit mencatat actor, file, rules, result, dan timestamp.

---

# 12. Media Library dan Riwayat Media

## Tujuan

Menyediakan asset reusable dan memisahkan asset availability dari processing history.

## Layout type

```text
Media asset grid/list + processing/audit list
```

## Rekomendasi

### Media Library

```text
Asset preview
Name/label
Type
Dimensions
Usage count
Status
Created date
Actions
```

### Riwayat Media

```text
Queued
Processing
Ready
Failed
Duplicate
Source
Related import/job
Retry action
```

## Acceptance criteria

- [ ] Media Library tidak tercampur dengan log processing.
- [ ] Media yang dipakai product aktif menunjukkan usage count.
- [ ] Delete media memberi warning jika ada dependency.
- [ ] Failed media dapat diretry.
- [ ] Grid/list toggle mengikuti use case asset visual.

---

# 13. Promo: Promo Toko, Flash Sale, Voucher, Subsidi Ongkir, COD

## Tujuan

Mengelola penawaran komersial dengan aturan yang jelas dan mencegah konflik harga/promosi.

## Layout type

```text
Merchandising workspace: campaign list + campaign form + impact preview
```

## Information architecture

```text
Promo Harga
Flash Sale
Voucher
Subsidi Ongkir
Biaya COD
Banner Promo
Bar Promo
```

## Rekomendasi core rule

- Definisikan promo stacking.
- Definisikan priority ketika Flash Sale dan Promo Toko overlap.
- Definisikan apakah voucher dapat digunakan bersamaan dengan subsidi.
- Definisikan efek promo terhadap COD fee dan shipping calculation.
- Tampilkan product/variant target dengan jelas.
- Tambahkan preview price breakdown.

## Acceptance criteria

- [ ] Campaign mempunyai state draft, scheduled, active, expired, disabled.
- [ ] Overlap/promo conflict menghasilkan warning sebelum publish.
- [ ] Admin dapat preview hasil harga sebelum publish.
- [ ] Period menggunakan timezone yang eksplisit.
- [ ] Promo yang sudah digunakan order tidak dapat hard-delete.
- [ ] Action publish/unpublish tercatat dalam audit.

---

# 14. Banner Promo dan Bar Promo

## Tujuan

Mengatur promotional placement storefront tanpa membuat admin menebak hasilnya di mobile/desktop.

## Layout type

```text
Create/edit form + storefront preview sidebar
```

## Rekomendasi layout desktop

```text
Main form 65%
- Content
- Link
- Period
- Priority
- Publish state

Side context 35%
- Mobile preview
- Desktop preview
- Character count
- Active/scheduled conflicts
- Placement rule
```

## Acceptance criteria

- [ ] Banner memiliki preview crop desktop dan mobile.
- [ ] Bar Promo memiliki character limit dan single-line preview.
- [ ] Link tujuan tervalidasi.
- [ ] Schedule overlap terlihat sebelum publish.
- [ ] Urutan tampil tidak hanya angka; ada drag/order preview.
- [ ] Fallback storefront jelas saat tidak ada content aktif.

---

# 15. Beranda Pembeli dan CMS Layout

## Tujuan

Mengatur storefront homepage dan section content tanpa membuat admin kehilangan konteks hasil publik.

## Layout type

```text
CMS section manager + ordering + preview
```

## Rekomendasi

- Tampilkan section list dengan name, status, type, last updated, dan preview mini.
- Gunakan mode geser/drag dengan explicit save state.
- Beri preview urutan di mobile storefront.
- Pisahkan homepage section settings dari content detail editor.
- Tambahkan draft/published state per section bila relevan.

## Acceptance criteria

- [ ] Admin tahu section mana yang tampil di homepage.
- [ ] Pengubahan urutan tidak langsung merusak published state tanpa confirmation/save.
- [ ] Preview storefront tersedia sebelum publish.
- [ ] Section kosong/disabled memiliki fallback yang jelas.

---

# 16. Cara Pemesanan, FAQ, Masalah & Solusi, Dokumen Halaman

## Tujuan

Mengelola informational content publik dengan lifecycle, preview, keamanan input, dan hierarchy yang rapi.

## Layout type

```text
CMS editor / list + inline content management
```

## Rekomendasi

- Gunakan draft → review → published → archived.
- Tambahkan revision history untuk konten penting.
- Gunakan rich text terbatas/sanitized HTML.
- Tampilkan live preview.
- Gunakan compact empty state untuk list kosong.
- Tambahkan category/order pada FAQ dan issue-solution.
- Tambahkan search pada content list.
- Tambahkan link antar content relevan.

## Acceptance criteria

- [ ] Tidak ada script/iframe yang dapat masuk ke konten publik.
- [ ] Admin dapat melihat apa yang berubah sebelum publish.
- [ ] Content dapat dipulihkan dari revision sebelumnya.
- [ ] Empty state tidak memakai panel besar tanpa alasan.
- [ ] FAQ dan Masalah & Solusi memiliki structure yang mudah dicari di publik.

---

# 17. Marketplace & Media Sosial

## Tujuan

Mengelola link eksternal brand secara aman dan terpisah antara marketplace serta social media.

## Layout type

```text
Settings rows + preview/action context
```

## Rekomendasi

- Gunakan settings rows, bukan one large card.
- Kelompokkan Marketplace dan Media Sosial dalam dua section.
- Validasi URL per platform.
- Tambahkan open link/preview action.
- Tambahkan status filled/empty dan last updated.

## Acceptance criteria

- [ ] URL tidak valid ditolak sebelum simpan.
- [ ] Marketplace dan social media tidak tercampur secara terminologi.
- [ ] Admin dapat preview lokasi pemakaian link di footer/info toko.
- [ ] Halaman tidak terasa kosong pada desktop.

---

# 18. Customer, Ulasan, Testimonial, dan Hasil Pemasangan

## Tujuan

Mengelola relationship/customer evidence dan social proof tanpa mencampur data operasional dengan content marketing.

## Layout type

```text
Customer CRM list, review moderation list, content gallery/list
```

## Customer

Tambahkan/validasi:

```text
Total order
Lifetime value
Last order
Last contact
Payment behavior
Return/refund count
Tags
Consent komunikasi
Fraud score explanation
```

## Ulasan/testimonial

- Pisahkan review website, review marketplace, dan screenshot WhatsApp sebagai source/type.
- Tambahkan moderation state: imported, pending, approved, published, hidden.
- Tambahkan product/order relation bila tersedia.
- Jangan expose customer data berlebihan.

## Hasil pemasangan

- Hubungkan ke product/model/submodel.
- Simpan lokasi umum, bukan alamat detail.
- Tambahkan alt text, caption, order, publish state, dan usage location.

## Acceptance criteria

- [ ] Fraud score memiliki alasan dan action, bukan hanya angka.
- [ ] Review memiliki source dan moderation state.
- [ ] Screenshot/testimonial diperlakukan sebagai content type berbeda bila perlu.
- [ ] Hasil pemasangan dapat digunakan sebagai gallery produk/landing page secara terstruktur.

---

# 19. WhatsApp

## Tujuan

Menjaga koneksi, template, delivery queue, dan failure recovery komunikasi customer.

## Layout type

```text
Communication operations workspace
```

## Rekomendasi structure

```text
Connection health
Template management
Outbound queue
Recent logs
Failure queue
Retry/reconnect actions
```

## Template requirements

```text
Internal name
Trigger event
Status active/inactive
Message content
Available variables
Preview rendered content
Test send
Version
Last edited by
```

## Acceptance criteria

- [ ] Kegagalan pengiriman pesan menjadi action queue, bukan hanya angka statistik.
- [ ] Failure reason dapat dilihat admin yang berwenang.
- [ ] Template tidak bisa aktif jika variable wajib tidak tersedia.
- [ ] Ada test send/preview sebelum template dipakai otomatis.
- [ ] Reconnect/pairing/retry punya status dan audit.

---

# 20. Notifikasi

## Tujuan

Menampilkan pekerjaan/peristiwa yang perlu perhatian, bukan menjadi duplicate dari semua log sistem.

## Layout type

```text
Notification inbox / operational feed
```

## Rekomendasi

- Kelompokkan: Unread, Action required, Informational, System.
- Tambahkan deep link ke entity/action.
- Tambahkan mark as read dan bulk mark as read.
- Jangan campur notifikasi ordinary dengan error incident tanpa visual differentiation.
- Gunakan expiration/retention rule untuk notification lama.

## Acceptance criteria

- [ ] Setiap notification memiliki context, timestamp, severity, dan destination action.
- [ ] Admin dapat membedakan pesan baru, error, dan informational update.
- [ ] Unread count konsisten dengan data notifikasi.

---

# 21. Manajemen Admin, Profil Saya, dan Pengaturan Sistem

## Tujuan

Mengelola akses dan konfigurasi sensitif tanpa mengekspos data rahasia atau menciptakan konfigurasi berbahaya.

## Layout type

```text
Settings rows / security settings / system health detail
```

## Manajemen Admin

- Gunakan role/capability matrix, bukan hanya active/inactive.
- Lindungi admin terakhir/owner agar tidak dapat dinonaktifkan sembarangan.
- Tambahkan invitation and activation lifecycle.
- Tambahkan last login dan session information bila relevan.

## Profil Saya

- Pisahkan personal profile, security/password, and account status.
- Gunakan layout two-column jika side security context bermanfaat.
- Tampilkan unsaved changes indicator.

## Pengaturan Sistem

- Jangan menampilkan secret/token.
- Tampilkan integration health summary, environment, last sync, and safe diagnostics.
- Pisahkan read-only system status dari editable configuration.
- Action technical harus dibatasi role.

## Acceptance criteria

- [ ] Settings page tidak memakai single-card besar sebagai default.
- [ ] Sensitive values tidak terekspos.
- [ ] Permission dan audit mengontrol perubahan sistem.
- [ ] System health bisa dibaca tanpa memahami detail backend.

---

# 22. Log Aktivitas

## Tujuan

Menyediakan jejak audit yang dapat dicari untuk perubahan penting dan troubleshooting.

## Layout type

```text
Audit table + entity detail drawer/page
```

## Wajib ditampilkan

```text
Actor
Timestamp
Action
Entity type
Entity ID
Summary
Status
Detail/diff link
```

## Filter

```text
Actor
Action
Entity
Date range
Status
Module
```

## Acceptance criteria

- [ ] Log dapat menjawab siapa mengubah apa dan kapan.
- [ ] Detail menampilkan before/after untuk perubahan penting.
- [ ] Log action memiliki deep link ke entity terkait bila masih tersedia.
- [ ] Export dibatasi permission dan diaudit.

---

# 23. Cross-cutting UI States

## Tujuan

Menstandarkan state non-happy-path pada seluruh admin panel.

## Wajib tersedia

### Loading

```text
Table skeleton
Metric skeleton
Form skeleton
Gallery skeleton
Detail skeleton
```

### Empty

```text
Icon
Title
Explanation
Primary CTA
```

### Error

```text
Apa yang gagal
Dampak
Apa yang dapat dilakukan admin
Retry / see log action
```

### Success

```text
Toast short feedback
Inline persisted status bila perlu
```

### Unsaved changes

```text
Saving
Saved
Failed to save
Leave confirmation
```

## Acceptance criteria

- [ ] Tidak ada full-page spinner untuk loading parsial.
- [ ] Empty state tidak terlalu besar untuk konteks list sederhana.
- [ ] Error message actionable dan tidak bocor debug/secrets.
- [ ] Form memiliki feedback save state.

---

# 24. Accessibility, Responsive, dan Performance

## Tujuan

Memastikan panel tetap usable pada perangkat, volume data, dan kondisi akses yang realistis.

## Accessibility

- Keyboard navigation.
- Visible focus state.
- Text contrast dark theme.
- Label untuk icon-only action.
- Focus management pada modal/drawer.
- Screen-reader labels untuk status/action.

## Responsive

- Target minimal laptop 1366px.
- Sidebar collapse/compact.
- Table horizontal scroll dengan sticky key columns.
- Two-column form collapse ke satu kolom.
- Action bar tidak overflow.

## Performance

- Server pagination untuk list besar.
- Virtualization untuk data/log sangat panjang bila diperlukan.
- Debounced search.
- Lazy loading media grid.
- Caching untuk metric/report yang mahal.
- Async queue untuk import, media, sync, dan WA.

## Acceptance criteria

- [ ] Halaman kritis usable tanpa mouse.
- [ ] Dark theme memenuhi contrast yang layak.
- [ ] Tabel besar tidak membuat browser freeze.
- [ ] Layout tidak rusak pada 1366px dan viewport lebih sempit.

---

# Shared Page Template Rules

## Standard page shell

```text
AdminPage
├── PageHeader
│   ├── Breadcrumb/back
│   ├── Title + description
│   ├── Contextual status
│   └── Primary action
├── PageToolbar (optional)
│   ├── Search
│   ├── Primary filter
│   ├── Date/filter controls
│   ├── Sort
│   └── Secondary actions
├── PageContent
│   ├── Main content
│   └── Optional side context
└── StickyActionBar (optional)
    ├── Save state
    ├── Secondary action
    └── Primary save/publish action
```

## Layout selection rules

| Page type | Preferred layout |
|---|---|
| Operational queue | Header + action/status tabs + list/table |
| List page | Header + toolbar + table/list + pagination |
| Entity detail | Summary header + main/side columns + secondary accordions |
| Settings | Settings rows + sticky save bar |
| Form create/edit | Main form + preview/rules sidebar when useful |
| CMS editor | Content editor + preview/sidebar + publish controls |
| System health | Compact status grid + expandable diagnostics |
| Dashboard | Action center + operations snapshot + insights |

## Do not

```text
- Do not use a single huge card as default page content.
- Do not show every action as an equal visible button.
- Do not place every filter inline by default.
- Do not show raw technical payloads to ordinary admins/customer contexts.
- Do not hard-delete entities with transactional history.
- Do not treat pending COD and unpaid transfer as the same state.
- Do not create one-off visual styles when an existing design-system component can be used.
```

---

# Master Completion Checklist

## P0 completion

- [ ] Status architecture finalized.
- [ ] Dashboard action center implemented.
- [ ] Order/payment/shipping action hierarchy implemented.
- [ ] Global list/filter pattern standardized.
- [ ] Confirmation and audit for destructive action implemented.
- [ ] Single-card visual polish audit completed for critical settings pages.
- [ ] Loading/empty/error/success components standardized.

## P1 completion

- [ ] Catalog taxonomy/documentation improved.
- [ ] Product wizard/publish gate improved.
- [ ] Import/media workflow made safe and observable.
- [ ] Promo and CMS preview/lifecycle improved.
- [ ] WhatsApp failure workflow implemented.
- [ ] Permission, dependency, and system health requirements implemented.

## P2 completion

- [ ] Command palette/search mature.
- [ ] Bulk actions mature.
- [ ] Reconciliation/reporting mature.
- [ ] Accessibility/responsive audit complete.
- [ ] Analytics and onboarding mature.
