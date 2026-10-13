## Ringkasan

<!-- Apa yang berubah, kenapa, dan bagaimana angkanya diverifikasi. -->

## Gerbang Kontrak Beku (ADR-026, versi 1.0.0)

Berkas beku: `app/Services/StorePerformanceService.php`, `app/Exports/OrderExport.php`,
`tests/Expectations/store-performance-golden-v1.json`.

Pilih satu:

- [ ] PR ini **TIDAK** menyentuh berkas beku maupun mengubah angka perhitungan, atau
- [ ] Perubahan formula DISENGGAJA: `tests/Expectations/store-performance-golden-v1.json`
      diperbarui di PR yang sama (jalankan `GOLDEN_UPDATE=1 php artisan test --filter=StorePerformanceGoldenTest`),
      alasan perubahan dijelaskan di ringkasan, dan versi kontrak di ADR-026 beserta komentar
      FROZEN dinaikkan bersama.

Bila tidak ada kotak yang dicentang, PR tidak boleh digabungkan.

## Verifikasi

<!-- Perintah yang dijalankan dan hasilnya: suite, golden, lint, typecheck. -->
