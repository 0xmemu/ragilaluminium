# Storefront Audit TODO — website.4.0

**Diperbarui:** 2026-08-06  
**Status:** perbaikan performa utama diterapkan; audit browser lanjutan masih aktif  
**Branch:** feat/admin-ui-redesign  
**Baseline:** cd302c0

## Tujuan dokumen

Dokumen ini adalah backlog lanjutan untuk audit UI/UX storefront setelah audit workflow
fungsional pada docs/WORKFLOW-AUDIT.md. Audit workflow tersebut tetap menjadi catatan
historis dengan status selesai per 2026-07-22; dokumen ini tidak mengubah status historis itu.

## Status dokumentasi audit

- Audit workflow pelanggan dan admin sudah terdokumentasi di docs/WORKFLOW-AUDIT.md.
- Milestone audit sampai 2026-07-28 tercatat di docs/MEMORY.md.
- Audit visual storefront 2026-08-03 sampai 2026-08-06 tercermin di riwayat Git dan checkpoint,
  tetapi sebelumnya belum memiliki TODO atau handoff terpisah.
- Tidak ditemukan log sesi atau dokumen khusus Cline di repository.
- Interupsi Cline dan keputusan pemulihan dicatat di bagian Insiden sesi Cline di bawah.

## Baseline yang sudah terverifikasi

- Workflow backend checkout tetap memakai dua langkah: /checkout/validate menyimpan detail
  pengiriman ke session, lalu /checkout/place-order menerima payment_method.
- Field checkout address_line2 dan notes tetap tersedia sebagai data opsional yang didukung
  kontrak dan OrderService.
- Audit workflow P0/P1/P2 publik dan admin pada 2026-07-22 tercatat selesai.
- Audit visual prioritas 1–2 sudah masuk commit 52e3e2f dan cd302c0, termasuk standardisasi
  back button mobile, breadcrumb, heading, OrderConfirmation, dan ProductDetail.
- php artisan test: PASS, 184 tests / 3018 assertions.
- npm run build: PASS.
- npm run test: PASS, 17 tests.
- public/hot tidak ada dan public/build/manifest.json tersedia di VPS dev.

## Performance audit 2026-08-06

Status batch: diterapkan dan tervalidasi di VPS.

- Update quantity cart sekarang optimistik di UI, didebounce 220 ms, dikirim ke endpoint JSON, dan tidak lagi melakukan redirect ke /cart pada setiap klik. Validasi stok server tetap berlaku; response server dapat meng-clamp quantity dan UI melakukan rollback saat gagal.
- Cart preview dikeluarkan dari shared Inertia props. Preview dihitung hanya saat hover atau focus melalui /cart/preview, sehingga pricing cart tidak ikut setiap navigasi.
- Shared model menu memakai cache aplikasi dua menit.
- Page-view tracking tidak lagi menulis metrik untuk Inertia atau AJAX partial request; hanya full document view yang dicatat.
- Bootstrap production dioptimalkan dengan php artisan optimize: config, events, routes, dan views cached.
- Evidence VPS: partial Inertia /cart 313 byte dan sekitar 127 ms; endpoint cart update JSON sekitar 151 ms; aset JS Cloudflare content-encoding br, cf-cache-status HIT, cache-control public max-age 604800.
- Validasi aman: php artisan test 184 tests / 3018 assertions PASS setelah cache dibersihkan sementara untuk konfigurasi SQLite testing lalu cache production dipulihkan; npm run typecheck, npm run test, dan npm run build PASS.

Remaining performance follow-up:

- [ ] Ambil browser Performance/Network trace nyata pada perangkat mobile dan desktop.
- [ ] Evaluasi pemecahan bundle routes 236 KB dan app 362 KB bila cold-load masih terasa lambat setelah cache browser.
- [ ] Tambahkan invalidasi eksplisit cache model menu setelah perubahan CMS model product jika TTL dua menit tidak cukup.

## Insiden sesi Cline

Perubahan uncommitted dari sesi yang terputus sempat:

1. Membuat PlaceOrderRequest mewajibkan seluruh detail customer dan alamat.
2. Mengubah CheckoutController::placeOrder() agar membaca detail dari request pembayaran.
3. Menghapus field patokan dan catatan dari form checkout.

Perubahan tersebut tidak sesuai alur UI dua langkah: form pembayaran hanya mengirim
payment_method, sehingga order selalu gagal validasi. Penghapusan address_line2 juga tidak
sesuai kontrak Stage 10. Perubahan backend dan UI yang belum selesai dipulihkan ke baseline
kontrak; tidak ada perubahan database atau migrasi yang dilakukan.

## TODO aktif berdasarkan prioritas

### P0 — quality gate sebelum menyatakan audit storefront selesai

- [x] Perbaiki error TypeScript Cart.tsx pada undoItem.name dan pastikan npm run typecheck PASS.
- [x] Bersihkan tiga lint blocker yang memblokir CI:
      FlashSaleSectionIntro tidak terpakai di flash-sale-stage.tsx, serta Link dan
      ContactRow tidak terpakai di InformasiToko.tsx.
- [x] Jalankan npm run typecheck dan npm run lint sampai keduanya PASS; lint kini PASS dengan warning non-blocking.
- [ ] Jalankan npm run test:e2e memakai database SQLite E2E terisolasi, bukan koneksi DB aplikasi.
      Simpan hasil dan screenshot/trace yang gagal; jangan menjalankan reset terhadap database
      MySQL aplikasi.

### P1 — audit browser dan alur utama

- [ ] Lengkapi Playwright untuk alur nyata: PDP pilih varian → cart → checkout validate →
      pilih COD/transfer → confirmation → order status.
- [ ] Tambahkan verifikasi checkout untuk validation error, state pending, duplicate-click,
      shipping fallback, address_line2, dan notes.
- [ ] Jalankan matrix responsive minimal pada 360, 768, 1024, dan 1440 px; cek horizontal
      overflow, CTA sticky mobile, heading/breadcrumb, focus ring, dan safe-area.
- [ ] Jalankan scripts/qa-final.mjs dan scripts/qa-full.mjs setelah server dev tersedia;
      arsipkan hasil yang relevan sebagai evidence audit.
- [ ] Audit keyboard dan axe pada Home, Catalog, PDP, Cart, Checkout, Order Status, dan
      halaman admin yang disentuh; catat violation serious/critical per halaman.
- [ ] Review 42 warning lint React setelah error blocker selesai, terutama
      set-state-in-effect, akses ref saat render, dan missing hook dependencies.

### P1 — sinkronisasi dokumentasi

- [ ] Setelah setiap batch audit, update bagian status di dokumen ini dengan commit, command,
      dan evidence yang benar-benar dijalankan.
- [ ] Update docs/WORKFLOW-AUDIT.md hanya untuk perubahan status workflow; jangan menghapus
      catatan historis 2026-07-22.
- [ ] Tambahkan milestone penting ke docs/MEMORY.md, bukan log harian atau output mentah.
- [ ] Jika kontrak route, field, atau status berubah, update schema/API/logic docs pada commit
      yang sama dan gunakan SPEC_CHANGED_AND_DOCS_UPDATED.

### P2 — backlog audit fungsional yang bukan blocker checkout

- [ ] Branded public 404 untuk menggantikan fallback 404 generik.
- [ ] Evaluasi dedicated UI Import/Media/Payments bila Resource shell masih kurang nyaman
      setelah audit browser.
- [ ] Evaluasi manual resend template WA dari log, tetap melalui WhatsApp Module.
- [ ] Tambah evidence untuk media R2, queue worker, J&T sandbox, dan template Meta setelah
      kredensial/integrasi tersedia.

## Di luar scope audit storefront saat ini

Item DNS cutover, shim /api/jnt, kredensial J&T/Meta, nginx, dan rollback tetap berada di
docs/cutover-prep-website-4.0-before-handoff.md. Item tersebut jangan dicampur ke audit UI
sebelum ada jadwal cutover dan akses integrasi yang jelas.

## Urutan eksekusi yang disarankan

1. Fix TypeScript dan tiga lint error blocker.
2. Jalankan typecheck, lint, PHPUnit, Vitest, dan build sebagai baseline hijau.
3. Lengkapi serta jalankan Playwright checkout dan responsive matrix.
4. Perbaiki temuan browser berdasarkan severity, bukan preferensi visual semata.
5. Update evidence di dokumen ini dan milestone singkat di docs/MEMORY.md.
6. Baru lanjutkan backlog P2 atau audit visual batch berikutnya.

## Referensi

- docs/WORKFLOW-AUDIT.md
- docs/MEMORY.md
- docs/logic/stage-10-public-store-ui-and-checkout-contract.md
- frontend/docs/ACCESSIBILITY-AND-QA.md
- tests/e2e/storefront.spec.ts
- playwright.config.ts
