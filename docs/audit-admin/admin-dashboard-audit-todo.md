# Admin Dashboard Audit & Improvement Todo List

> Tujuan: merapikan dashboard Ragil Aluminium menjadi admin panel yang lebih cepat dipakai, konsisten, scalable, card-light, aman, dan mudah dioperasikan. Fokus utama bukan menambah modul baru, melainkan memperjelas workflow, menyederhanakan hierarchy, memperbaiki visual polish, dan menegakkan aturan status/data lintas modul.

---

## Cara memakai dokumen

Prioritas:

```text
P0 = wajib diselesaikan sebelum memperluas fitur baru
P1 = penting untuk stabilitas dan skalabilitas operasional
P2 = peningkatan setelah workflow inti stabil
```

Status kerja:

```text
[ ] Belum mulai
[~] Sedang dikerjakan
[x] Selesai
[-] Ditunda / tidak relevan saat ini
```

---

# P0 — Fondasi Operasional dan UX

## 1. Status architecture

- [ ] Buat dokumen canonical status untuk `order`, `payment`, `fulfillment`, `shipping`, `return`, `product`, `promo`, `media`, dan `import`.
- [ ] Definisikan label internal, label UI, tone status, deskripsi, trigger, allowed transition, dan side effect untuk setiap status.
- [ ] Pastikan hanya ada satu sumber kebenaran untuk status order, pembayaran, dan pengiriman.
- [ ] Pisahkan dengan jelas status order, status pembayaran, dan status pengiriman pada semua list/detail page.
- [ ] Pastikan status utama di dashboard, daftar pesanan, detail pesanan, pembayaran, pengiriman, dan notifikasi selalu sinkron.
- [ ] Definisikan state `pending`, `need_action`, `processing`, `completed`, `failed`, `cancelled`, dan `exception` secara konsisten.
- [ ] Tetapkan rule bahwa status yang belum lengkap tidak boleh terlihat sebagai selesai.
- [ ] Buat transition guard untuk status yang berisiko, misalnya order tidak boleh menjadi `dikirim` tanpa resi/kurir bila flow bisnis mewajibkannya.
- [ ] Buat exception flow untuk payment failed, delivery failed, cancelled, return, refund, dan stale tracking.

### Done criteria

- [ ] Tidak ada dua halaman yang menampilkan status berbeda untuk entity yang sama.
- [ ] Admin mengerti apa arti setiap status tanpa membuka dokumentasi teknis.
- [ ] Semua status mempunyai rule transition yang terdefinisi.

---

## 2. Dashboard sebagai action center

- [ ] Ubah dashboard utama dari metric-first menjadi action-first.
- [ ] Jadikan section `Perlu tindakan` sebagai elemen paling menonjol setelah header.
- [ ] Tambahkan queue untuk pesanan perlu konfirmasi.
- [ ] Tambahkan queue untuk pembayaran perlu verifikasi.
- [ ] Tambahkan queue untuk pesanan tertahan melebihi SLA.
- [ ] Tambahkan queue untuk pengiriman bermasalah/stale.
- [ ] Tambahkan queue untuk pesan WhatsApp gagal.
- [ ] Tambahkan queue untuk import/media job gagal.
- [ ] Tampilkan jumlah item, severity, dan CTA langsung pada setiap action queue.
- [ ] Pisahkan `operational snapshot` dari `business snapshot`.
- [ ] Pastikan KPI yang tampil memiliki aksi lanjutan atau decision value.
- [ ] Kurangi metrik yang masih belum actionable atau selalu nol dari default dashboard.
- [ ] Tambahkan last refresh timestamp dan status data source.

### Done criteria

- [ ] Admin dapat mengetahui pekerjaan paling mendesak dalam kurang dari 5 detik.
- [ ] Semua alert dashboard bisa diklik menuju filtered view yang relevan.
- [ ] Dashboard tidak lagi terasa seperti kumpulan metrik dengan bobot visual setara.

---

## 3. Action hierarchy dan destructive action safety

- [ ] Standardisasi action menjadi `primary`, `secondary`, `tertiary`, `destructive`, dan `more menu`.
- [ ] Pastikan satu page/context hanya memiliki satu primary action utama.
- [ ] Tempatkan primary action secara konsisten di kanan atas page header atau sticky footer.
- [ ] Pindahkan action jarang dipakai ke overflow menu `Lainnya`.
- [ ] Pastikan action destruktif tidak tampil setara dengan action normal.
- [ ] Tambahkan confirmation dialog untuk archive, delete, cancel, refund, deactivate, rerun import, dan perubahan massal.
- [ ] Tambahkan impact preview pada confirmation dialog.
- [ ] Tambahkan alasan perubahan pada action berisiko tinggi bila relevan.
- [ ] Tambahkan soft delete/archive untuk entity yang sudah memiliki histori transaksi.
- [ ] Tambahkan undo untuk aksi yang memungkinkan dipulihkan dengan aman.
- [ ] Pastikan action disabled menjelaskan alasan mengapa action belum tersedia.

### Template confirmation

```text
[Tindakan] [jumlah entity]?

Jelaskan dampak yang konkret:
- apa yang berubah,
- apa yang tidak berubah,
- dependency yang terkena,
- apakah bisa dipulihkan.

[Batalkan] [Tindakan destruktif]
```

---

## 4. Standardisasi list, filter, dan pencarian

- [ ] Buat component/template standar untuk list page.
- [ ] Standarkan urutan: page header → toolbar → result count → table/list → pagination.
- [ ] Letakkan global/local search sebagai kontrol pertama di toolbar.
- [ ] Tampilkan hanya filter yang paling sering dipakai secara langsung.
- [ ] Pindahkan filter sekunder ke `Filter lainnya` atau popover/drawer.
- [ ] Pisahkan filter dari sorting.
- [ ] Pisahkan export dari filter.
- [ ] Tambahkan chip filter aktif.
- [ ] Tambahkan `Reset filter`.
- [ ] Tambahkan result count setelah filter diterapkan.
- [ ] Tambahkan empty state khusus untuk hasil pencarian kosong.
- [ ] Tentukan apakah filter disimpan di URL/query string.
- [ ] Tambahkan debounce untuk field search.
- [ ] Tambahkan keyboard shortcut untuk focus search bila relevan.
- [ ] Audit seluruh halaman list: Pesanan, Pembayaran, Pengiriman, Produk, Customer, Ulasan, Media, Import, Promo, FAQ, Log Aktivitas, Notifikasi, dan Admin.

### Standard toolbar

```text
[Search] [Primary status] [Date] [Filter lainnya] [Sort]             [Export] [Primary action]
```

---

## 5. Pesanan, pembayaran, dan pengiriman

### Pesanan

- [ ] Jadikan primary action pada tiap order row mengikuti status order.
- [ ] Contoh: `Proses Pesanan`, `Input Resi`, `Lihat Tracking`, atau `Selesaikan Order`.
- [ ] Jadikan `Detail` sebagai action sekunder yang konsisten.
- [ ] Pindahkan `Chat WA`, `Print`, `Batalkan`, dan action jarang dipakai ke menu `Lainnya`.
- [ ] Tampilkan status order, payment, dan shipping dalam kelompok yang jelas.
- [ ] Tambahkan bulk selection dan bulk action yang aman untuk order.
- [ ] Tambahkan SLA/age indicator untuk order yang belum diproses.
- [ ] Tambahkan visual exception state untuk order bermasalah.

### Detail pesanan

- [ ] Susun ulang detail order menjadi summary header + main content + sidebar context.
- [ ] Header berisi nomor order, status utama, customer, total, dan primary action.
- [ ] Main content berisi item, payment, shipping, dan timeline status.
- [ ] Sidebar berisi customer, alamat, notes, dan action pendukung.
- [ ] Pindahkan raw log WhatsApp, audit, dan raw tracking ke section sekunder/accordion/tab.
- [ ] Hindari menampilkan semua data dalam satu page tanpa grouping.
- [ ] Tambahkan sticky action bar bila detail order panjang.

### Pembayaran

- [ ] Tambahkan status payment yang lengkap: unpaid, proof received, pending verification, paid, failed, expired, refund in progress, refunded.
- [ ] Tambahkan summary queue: perlu verifikasi, belum dibayar, diterima hari ini, refund berjalan.
- [ ] Bedakan `COD pending collection` dari transfer `unpaid`.
- [ ] Buat detail transfer manual: bukti, bank, nominal, pengirim, waktu, verifier, catatan, approve/reject.
- [ ] Tambahkan audit untuk verifikasi, reject, dan refund.

### Pengiriman

- [ ] Bedakan status internal fulfillment dengan status carrier.
- [ ] Tampilkan last carrier update dan waktu sync terakhir.
- [ ] Tambahkan loading/success/error state untuk tombol `Segarkan`.
- [ ] Tambahkan fallback jika tracking belum tersedia.
- [ ] Tambahkan stale tracking alert berdasarkan SLA.
- [ ] Normalisasi raw carrier events menjadi milestone customer/admin-friendly.
- [ ] Simpan raw event untuk audit, namun jangan jadikan primary tracking UI.
- [ ] Tambahkan grouping per shipment bila satu order memiliki banyak resi.

---

## 6. Visual polish dan information density

- [ ] Jadikan `Visual polish & information density` sebagai acceptance criteria untuk semua halaman baru/hasil refactor.
- [ ] Audit semua halaman yang memakai satu card besar pada desktop.
- [ ] Hentikan penggunaan card sebagai wrapper default.
- [ ] Terapkan pendekatan `card-light admin UI`.
- [ ] Gunakan card hanya untuk containment yang benar-benar diperlukan: alert, summary penting, preview, complex form step, atau grouped detail.
- [ ] Ganti konfigurasi sederhana dari single-card menjadi `settings rows`.
- [ ] Gunakan two-column layout pada desktop jika side context/preview/rule benar-benar membantu.
- [ ] Terapkan `main column 60–70%` dan `side context 30–40%` untuk form yang relevan.
- [ ] Buat layout type yang berbeda untuk settings page, form page, entity detail page, list page, CMS editor, system health page, dan dashboard.
- [ ] Pastikan whitespace mendukung hierarchy, bukan menjadi area kosong yang tidak disengaja.
- [ ] Hindari nested card dan border berlapis-lapis.
- [ ] Audit alignment label, field, badge, table column, divider, serta CTA.
- [ ] Audit contrast text pada dark theme, terutama helper text dan metadata.
- [ ] Audit field width agar tidak terlalu melebar pada layar besar.
- [ ] Gunakan `max-width` atau content grid yang sesuai berdasarkan jenis halaman.

### Halaman prioritas visual polish

- [ ] Biaya COD.
- [ ] Subsidi Ongkir.
- [ ] Profil Saya.
- [ ] Pengaturan Sistem.
- [ ] Tambah/Edit Bar Promo.
- [ ] Banner Promo.
- [ ] Import Katalog.
- [ ] Cara Pemesanan.
- [ ] Masalah & Solusi.
- [ ] Marketplace & Media Sosial.
- [ ] Pengaturan Tata Letak Beranda.
- [ ] Form produk identitas/media/review.

### Rule visual

```text
Satu halaman bukan berarti satu card besar.
Satu halaman harus memiliki satu task context yang jelas:
header/context → main work area → side context/preview bila perlu → save/action state.
```

---

# P1 — Katalog, Konten, dan Workflow Skalabel

## 7. Katalog dan taxonomy

- [ ] Dokumentasikan taxonomy canonical: Category → Model → Sub Model → Product → Variant.
- [ ] Tambahkan helper text pada semua form taxonomy.
- [ ] Pastikan istilah kategori, model, submodel, produk, dan varian tidak tumpang tindih.
- [ ] Tambahkan dependency rule saat category/model/submodel memiliki produk aktif.
- [ ] Hindari hard delete untuk taxonomy yang sudah dipakai product/order.
- [ ] Tambahkan archive/disable workflow yang aman.
- [ ] Tampilkan jumlah produk aktif/arsip pada category/model/submodel.
- [ ] Tambahkan link drill-down dari category/model ke product yang terkait.
- [ ] Tambahkan dependency warning sebelum archive/nonaktifkan.

## 8. Produk dan varian

- [ ] Audit kolom tabel produk dan tentukan kolom wajib vs optional.
- [ ] Tambahkan column visibility untuk tabel produk lebar.
- [ ] Tambahkan sticky first column dan action column jika tabel horizontal scroll.
- [ ] Simpan preference kolom admin bila relevan.
- [ ] Tambahkan bulk edit harga, stok, status, category/model/submodel, dan archive dengan confirmation/preview.
- [ ] Pastikan product list tidak menampilkan data terlalu banyak tanpa hierarchy.
- [ ] Tambahkan warning untuk stok rendah/habis bila stok memang digunakan secara nyata.
- [ ] Tambahkan product completeness status yang jelas.

## 9. Product wizard dan publish gate

- [ ] Standardisasi wizard: Identitas → Varian & Harga → Media → Review.
- [ ] Tambahkan state step: completed, current, blocked, optional.
- [ ] Tampilkan error summary per step.
- [ ] Tambahkan direct link dari review blocker ke field yang harus diperbaiki.
- [ ] Pastikan data form tetap tersimpan saat pindah step.
- [ ] Tambahkan sticky footer: Simpan Draft, Simpan & Lanjut, Publish.
- [ ] Bedakan copy action: `Simpan`, `Simpan draft`, `Aktifkan`, `Publikasikan`.
- [ ] Jadikan review checklist sebagai publish gate yang benar.
- [ ] Tambahkan preview katalog/storefront sebelum publish jika memungkinkan.
- [ ] Tambahkan dependency warning jika produk dipublish tanpa media/harga/shipping data wajib.

## 10. Import dan media workflow

- [ ] Buat import workflow 10 langkah: pilih tipe → template → upload → validasi → preview → error per row → impact confirmation → queue → progress → result.
- [ ] Tampilkan dampak import sebelum dijalankan.
- [ ] Tampilkan jumlah insert/update/archive/error sebelum confirmation.
- [ ] Buat error report per row yang dapat diunduh.
- [ ] Tambahkan retry only failed rows.
- [ ] Tambahkan recovery/rollback guidance untuk import yang berdampak besar.
- [ ] Bedakan `Media Library` sebagai asset library dengan `Riwayat Media` sebagai processing/audit history.
- [ ] Tambahkan status media: queued, processing, ready, failed, duplicate.
- [ ] Tambahkan retry media processing.
- [ ] Tambahkan preview media, usage count, dan dependency sebelum delete.

## 11. Promo dan merchandising

- [ ] Kelompokkan fitur promo menjadi offer/pricing dan content placement.
- [ ] Buat navigation promo lebih terstruktur: Promo Harga, Voucher, Flash Sale, Subsidi Ongkir, Biaya Tambahan, Banner, Bar Promo.
- [ ] Definisikan promo stacking rules.
- [ ] Definisikan priority/conflict rules untuk promo yang overlap.
- [ ] Tambahkan preview efek promo pada checkout/product price.
- [ ] Tambahkan date/time timezone validation.
- [ ] Tambahkan warning saat promo akan mulai/berakhir.
- [ ] Tambahkan schedule status: draft, scheduled, active, expired, disabled.
- [ ] Tambahkan campaign audit trail.
- [ ] Tambahkan storefront preview untuk banner dan bar promo.
- [ ] Tambahkan character count, link validation, mobile preview, dan fallback content untuk bar promo.
- [ ] Tambahkan confirmation publish/unpublish.

## 12. CMS dan content lifecycle

- [ ] Definisikan content lifecycle: draft → review → published → archived.
- [ ] Tambahkan preview desktop/mobile sebelum publish.
- [ ] Tambahkan revision history dan rollback untuk content penting.
- [ ] Sanitasi HTML/teks pada CMS.
- [ ] Batasi tag HTML yang diizinkan.
- [ ] Larang script dan iframe pada content public.
- [ ] Tambahkan save draft dan unsaved changes warning.
- [ ] Standarkan ordering UI untuk content sections.
- [ ] Tambahkan preview hasil ordering sebelum publish.
- [ ] Perkecil empty state yang terlalu besar pada CMS list sederhana.
- [ ] Bedakan FAQ, review, screenshot testimonial, dan hasil pemasangan sebagai content type yang jelas.
- [ ] Hubungkan hasil pemasangan ke product/model/submodel terkait.

---

# P1 — Platform Operations, Permission, dan Data Governance

## 13. Permission dan admin management

- [ ] Buat role/capability matrix.
- [ ] Hindari model semua admin setara bila action sudah mencakup payment, refund, promo, dan system settings.
- [ ] Definisikan capability untuk product, order, payment, shipping, promo, content, customer, system, audit, dan admin management.
- [ ] Tambahkan role preset: Owner, Operations, Catalog, Finance, Customer Service, Content, Viewer.
- [ ] Pastikan admin tidak dapat menonaktifkan dirinya sendiri tanpa safeguard.
- [ ] Tambahkan invitation, activation, deactivation, password reset, dan last login workflow.
- [ ] Tambahkan session management bila dibutuhkan.
- [ ] Tambahkan confirmation untuk perubahan role atau akses sensitif.

## 14. Audit log dan governance

- [ ] Pastikan audit log menyimpan actor, timestamp, action, entity, entity ID, before, after, reason, IP/session bila tersedia.
- [ ] Audit semua action berisiko tinggi.
- [ ] Tambahkan detail diff untuk perubahan harga, stok, status, promo, resi, dan payment.
- [ ] Tambahkan filter audit berdasarkan actor, action, entity, date, dan status.
- [ ] Tambahkan deep link dari audit log ke entity terkait.
- [ ] Tambahkan export audit hanya untuk authorized role.
- [ ] Tentukan retention policy audit log.

## 15. Data lifecycle dan dependency management

- [ ] Petakan dependency seluruh entity penting.
- [ ] Definisikan behavior saat product/category/model/media/promo/admin diarchive atau dihapus.
- [ ] Tambahkan dependency warning sebelum action yang berdampak.
- [ ] Gunakan archive/soft delete untuk entity yang sudah memiliki referensi historis.
- [ ] Pastikan order history tidak rusak saat product diarsipkan.
- [ ] Pastikan promo history tidak berubah saat promo diakhiri.
- [ ] Pastikan media yang dipakai produk aktif tidak dapat dihapus tanpa replacement/confirmation.
- [ ] Tambahkan usage count pada media, taxonomy, promo, dan content asset bila relevan.

## 16. System health dan observability

- [ ] Buat halaman system health yang dibedakan dari setting read-only.
- [ ] Tampilkan health WhatsApp, J&T, queue, media processing, import jobs, storage, database, webhook, dan scheduled jobs.
- [ ] Tampilkan status: healthy, degraded, down, unknown.
- [ ] Tampilkan last successful sync dan last failed sync.
- [ ] Tampilkan queue backlog dan failed job count.
- [ ] Tampilkan WhatsApp delivery failure rate serta last error reason.
- [ ] Buat retry/reconnect/requeue action dengan permission dan confirmation.
- [ ] Tambahkan alert ketika service health berdampak pada order/customer.
- [ ] Pisahkan detail kredensial/integration secret dari UI umum.
- [ ] Pastikan system settings sensitive hanya dibaca oleh role yang sesuai.

## 17. Security dan privacy

- [ ] Audit exposure nama, alamat, telepon, bukti bayar, resi, dan data customer.
- [ ] Mask nomor telepon pada list bila tidak perlu terlihat penuh.
- [ ] Batasi export customer/order/payment berdasarkan permission.
- [ ] Jangan tampilkan credential/token di UI.
- [ ] Tambahkan audit export data sensitif.
- [ ] Tambahkan rate limit dan abuse guard pada action sensitif.
- [ ] Tambahkan secure file access untuk bukti bayar/media privat.
- [ ] Definisikan data retention untuk proof payment, WA log, customer data, dan audit.

---

# P2 — Maturity, Scale, dan Experience Refinement

## 18. Search dan command palette

- [ ] Definisikan cakupan global search: menu, order, product, customer, promo, page, action cepat.
- [ ] Kembangkan global search menjadi command palette `Ctrl/Cmd + K` bila relevan.
- [ ] Tambahkan hasil bertipe jelas: Navigation, Order, Product, Customer, Action.
- [ ] Tambahkan keyboard navigation pada hasil search.
- [ ] Tambahkan recent searches/recent pages bila membantu.
- [ ] Pastikan search local dan global tidak membingungkan.

## 19. Bulk operation maturity

- [ ] Tambahkan bulk selection yang konsisten pada list relevan.
- [ ] Tambahkan selected count.
- [ ] Tambahkan preview impact sebelum bulk action.
- [ ] Tambahkan validation result sebelum eksekusi.
- [ ] Tambahkan progress, success/failure summary, retry failures, dan audit.
- [ ] Tambahkan rule khusus untuk bulk archive, bulk publish, bulk price update, bulk stock update, bulk promo, bulk resend WA, dan bulk shipping refresh.

## 20. Financial reconciliation

- [ ] Buat reconciliation model untuk gross order, discounts, voucher, shipping charge, COD fee, subsidy, refund, payment received, dan net revenue.
- [ ] Definisikan lifecycle COD secara eksplisit.
- [ ] Bedakan `COD pending`, `COD collected`, `COD failed`, dan `COD returned`.
- [ ] Tambahkan report mismatch antara order, payment, refund, dan carrier result bila relevan.
- [ ] Tambahkan finance export dengan permission/audit.

## 21. Accessibility dan responsive admin

- [ ] Audit keyboard navigation seluruh admin panel.
- [ ] Pastikan focus visible konsisten.
- [ ] Audit color contrast dark theme.
- [ ] Audit tooltip/icon-only button accessibility.
- [ ] Audit modal/drawer focus trap.
- [ ] Audit table horizontal scrolling dan sticky columns pada laptop kecil.
- [ ] Buat breakpoint strategy untuk sidebar, tables, form two-column, dan action bar.
- [ ] Pastikan desktop luas tidak menghasilkan stretched form/card berlebihan.
- [ ] Pastikan admin minimal usable pada laptop 1366px lebar.

## 22. Loading, empty, error, dan success state

- [ ] Buat component pattern standard untuk empty state.
- [ ] Buat skeleton standard untuk table, metric, form, gallery, dan detail page.
- [ ] Buat inline error state yang actionable.
- [ ] Buat toast success/error standard.
- [ ] Tambahkan unsaved changes indicator pada form.
- [ ] Tambahkan save state: saving, saved, failed to save.
- [ ] Tambahkan retry action pada error integration/job.
- [ ] Hindari full-page spinner untuk loading parsial.

## 23. Analytics quality

- [ ] Audit setiap KPI: definisi, formula, period, source, dan actionability.
- [ ] Hapus/sembunyikan metric yang belum bermakna atau masih selalu nol dari default view.
- [ ] Tambahkan drill-down dari KPI ke data sumber.
- [ ] Tambahkan tooltip definisi metric.
- [ ] Tambahkan compare period yang eksplisit.
- [ ] Pisahkan analytics: Business, Product, Customer, Operational.
- [ ] Tambahkan empty state untuk chart dengan data tidak cukup.

## 24. Documentation dan onboarding

- [ ] Dokumentasikan istilah domain: category, model, submodel, product, variant, order, fulfillment, payment, shipment, refund, return.
- [ ] Tambahkan contextual help pada form kompleks.
- [ ] Tambahkan onboarding checklist admin baru.
- [ ] Tambahkan SOP untuk order, payment verification, shipping, import, promo, content publish, dan WA failures.
- [ ] Tambahkan explanation untuk fraud score bila feature tetap dipakai.
- [ ] Tambahkan internal release note/change log untuk perubahan sistem.

---

# Audit Checklist per Halaman

Gunakan checklist ini pada setiap halaman admin.

## Page context

- [ ] Apa satu pekerjaan utama admin di halaman ini?
- [ ] Apakah title dan description menjelaskan pekerjaan itu?
- [ ] Apakah ada satu primary action yang jelas?
- [ ] Apakah action berada di posisi konsisten?

## Layout dan visual polish

- [ ] Apakah halaman memakai layout type yang benar: list, detail, setting, form, CMS, workspace, atau system health?
- [ ] Apakah ada single-card besar yang sebenarnya harus menjadi settings rows atau grouped sections?
- [ ] Apakah main content menggunakan lebar yang proporsional?
- [ ] Apakah side context/preview dibutuhkan?
- [ ] Apakah whitespace intentional?
- [ ] Apakah card benar-benar diperlukan?
- [ ] Apakah typography, spacing, divider, alignment, dan action hierarchy konsisten?

## Data dan workflow

- [ ] Apakah status yang tampil sinkron dengan source of truth?
- [ ] Apakah happy path jelas?
- [ ] Apakah exception path jelas?
- [ ] Apakah action bisa dipulihkan atau diaudit?
- [ ] Apakah dependency entity dipertimbangkan?

## List/table/filter

- [ ] Apakah search scope jelas?
- [ ] Apakah filter utama mudah ditemukan?
- [ ] Apakah filter lanjutan tidak membuat toolbar padat?
- [ ] Apakah sort terpisah dari filter?
- [ ] Apakah active filter bisa dihapus/reset?
- [ ] Apakah table memiliki kolom yang tepat dan tidak terlalu lebar?
- [ ] Apakah ada result count, pagination, empty state, loading state, dan error state?

## Safety dan permission

- [ ] Apakah action destruktif dipisahkan?
- [ ] Apakah ada confirmation dampak?
- [ ] Apakah permission sesuai risiko action?
- [ ] Apakah perubahan tercatat dalam audit log?

## Accessibility dan responsive

- [ ] Apakah dapat digunakan keyboard?
- [ ] Apakah focus visible terlihat?
- [ ] Apakah kontras cukup?
- [ ] Apakah layout aman pada laptop kecil?
- [ ] Apakah icon-only action memiliki label/tooltip?

---

# Suggested Execution Order

## Sprint 1 — Safety dan core operations

- [ ] Status architecture
- [ ] Dashboard action center
- [ ] Order/payment/shipping action hierarchy
- [ ] Confirmation untuk destructive actions
- [ ] Standard filter/search pattern
- [ ] Standard loading/empty/error/success pattern

## Sprint 2 — Visual polish dan product workflow

- [ ] Refactor single-card settings pages
- [ ] Two-column form/detail composition
- [ ] Product wizard publish gate
- [ ] Product table column management
- [ ] Import impact preview
- [ ] Media lifecycle/usage safety

## Sprint 3 — Merchandising, CMS, dan communication

- [ ] Promo conflict/schedule/preview
- [ ] Banner/bar promo preview
- [ ] CMS draft/review/publish/revision
- [ ] WhatsApp health + template workflow
- [ ] Customer/review/testimonial governance

## Sprint 4 — Governance dan scale

- [ ] Permission matrix
- [ ] Audit log improvements
- [ ] System health/observability
- [ ] Security/privacy controls
- [ ] Financial reconciliation
- [ ] Bulk operations
- [ ] Global search/command palette

---

# Definition of Success

Dashboard dianggap berhasil ditingkatkan jika:

- [ ] Admin dapat menemukan pekerjaan prioritas tanpa membuka banyak halaman.
- [ ] Status order, payment, shipping, produk, promo, dan content tidak saling bertentangan.
- [ ] List page memiliki search/filter/sort/action model yang konsisten.
- [ ] Form, setting, detail, dan CMS tidak lagi memakai single-card besar sebagai pola default.
- [ ] Setiap halaman mempunyai hierarchy visual yang jelas dan memanfaatkan ruang desktop secara proporsional.
- [ ] Aksi destruktif aman, terkonfirmasi, dan dapat diaudit.
- [ ] Error/empty/loading/success state konsisten dan actionable.
- [ ] Sistem tetap usable saat jumlah produk, order, media, log, dan admin meningkat.
- [ ] Permission, privacy, integration health, dan audit memadai untuk operasi harian.
- [ ] Tidak ada penambahan feature baru tanpa justifikasi workflow, data model, dan visual pattern yang jelas.
