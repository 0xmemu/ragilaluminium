# ADR-025: Naskah template WhatsApp satu jalur, panel admin sebagai sumber tunggal

- **Status:** Accepted
- **Tanggal:** 2026-09-21
- **Konteks:** halaman admin WhatsApp Otomatis dan seeder template
- **Terkait:** kontrak owner 2026-09-15 (forceFill bukan penimpa naskah admin)

## Masalah

Naskah pesan WhatsApp otomatis tersimpan di dua tempat sekaligus: katalog kode
(`App\Support\WhatsAppAutomationCatalog::default_body`) dan kolom naskah di
database (`whatsapp_templates.body_preview`) yang disunting lewat panel admin.
Tidak ada aturan yang jelas siapa yang menang, sehingga keduanya saling timpa.

Dua cacat nyata yang sudah terjadi:

1. **Naskah terkirim tanpa kalimat.** `WhatsAppTemplateSeeder` membuat baris
   template tetapi tidak mengisi kolom naskah. Controller mengisi naskah hanya
   lewat `firstOrCreate`, jadi baris yang sudah dibuat seeder tetap kosong
   selamanya. `WhatsAppService::renderTemplateBody()` saat naskah kosong jatuh
   ke `implode("\n", $variables)`, sehingga pelanggan menerima deretan nilai
   mentah tanpa kalimat. Template `review_replied` sempat terkirim begitu.

2. **Kode berbeda dari database tanpa ketahuan.** Teks di kode dan teks di
   database bisa berbeda dan tidak ada yang membandingkan. Pada 2026-09-21
   ditemukan `order_created` berbeda satu baris:

   | Baris | Sumber | Isi |
   |---|---|---|
   | 21 | Kode (versi lama) | `Untuk konfirmasi pesanan, tolong balas pesan ini dengan oke atau proses.` |
   | 21 | Database (suntingan admin) | `Untuk konfirmasi pesanan, tolong balas pesan ini dengan "oke",` |

   Nilai database adalah hasil suntingan lewat panel admin dan itulah yang
   dikirim ke pelanggan; teks di kode tertinggal sebagai versi lama.

3. **Suntingan admin pernah hilang.** Sebelum 2026-09-15 controller memakai
   `forceFill` yang menimpa `body_preview` setiap halaman index dibuka, sehingga
   pekerjaan admin selalu terhapus. Owner mencabut perilaku itu.

## Keputusan

**Naskah template WhatsApp punya SATU jalur penulisan.**

```
Katalog kode  -> metadata + naskah AWAL (seed sekali saja)
Database      -> body_preview = naskah RESMI yang benar-benar dikirim
Panel admin   -> SATU-SATUNYA tempat menyunting naskah
```

Aturan yang mengikat:

1. Kode TIDAK PERNAH menimpa `body_preview` yang sudah terisi. Suntingan admin
   adalah yang menang.
2. Kode mengisi `body_preview` HANYA bila baris belum ada, ATAU bila isinya
   kosong (memperbaiki baris rusak).
3. Ada satu method bersama, `App\Support\WhatsAppTemplateSync::sync()` yang
   mengembalikan ringkasan `created` / `healed` / `skipped`. Seeder
   `WhatsAppTemplateSeeder` dan `WhatsAppTemplateController::ensureAutomationTemplates()`
   mendelegasikan ke method itu. Tidak ada dua jalur penulisan.
4. Setelah naskah `order_created` diselaraskan, kode dan database tidak lagi
   berbeda (9 template SAMA, 0 BEDA). Naskah awal di kode mengikuti nilai
   database yang sudah berlaku sebagai sumber tunggal.

## Alternatif yang ditolak

- **Kode sebagai sumber tunggal, timpa database tiap deploy.** Mengulang bug
  `forceFill`: suntingan admin hilang setiap halaman dibuka atau setiap rilis.
  Bertentangan dengan instruksi owner bahwa panel admin adalah sumber tunggal.
- **Database sebagai sumber tunggal, hapus naskah dari kode.** Instance baru
  atau database kosong tidak punya naskah awal, sehingga pesan terkirim kosong
  sampai admin mengisi manual. Naskah awal di kode tetap dibutuhkan sebagai
  benih dan sebagai pemulih baris rusak.
- **Biarkan dua jalur tanpa sinkronisasi.** Persis keadaan yang melahirkan dua
  cacat di atas: naskah kosong dan kode berbeda dari database tanpa ketahuan.

## Akibat

- Menambah template baru berarti menambah entri di katalog kode. Baris database
  dibuat otomatis lengkap dengan naskah awalnya lewat `sync()`.
- Mengubah naskah template yang sudah ada HANYA boleh lewat panel admin. Rilis
  kode tidak akan menyentuhnya.
- Baris rusak bernaskah kosong dipulihkan otomatis (`healed`), jadi insiden
  "pesan terkirim tanpa kalimat" tidak terulang.
- Menjalankan seeder atau membuka halaman admin berulang kali bersifat
  idempoten: `created=0`, `healed=0`, `skipped=9`.
- Naskah `review_replied` memakai tepat tiga token berurutan: nama pelanggan,
  nomor order, isi balasan admin. Nama produk dan token varian dihapus, dan
  method `variantLabelForReview()` di `WhatsAppService` dihapus karena tidak
  lagi dipakai.

## Cara verifikasi

1. Jalankan seeder dua kali: `php artisan db:seed --class=WhatsAppTemplateSeeder --force`.
   Kedua kali harus melaporkan `created=0, healed=0, skipped=9`.
2. Bandingkan 9 template kode vs database: seluruhnya harus SAMA, 0 BEDA.
3. Uji suntingan admin bertahan: isi satu `body_preview` dengan teks karangan,
   jalankan `WhatsAppTemplateSync::sync()`, teks karangan harus TIDAK berubah.
4. Test penjaga di `tests/Feature/WhatsAppTemplateCatalogTest.php`:
   naskah tidak kosong untuk setiap key, suntingan admin tidak tertimpa sync,
   dan naskah database sama dengan katalog setelah sync.
5. Render dengan ulasan nyata: nomor order muncul, tidak ada token `{{` yang
   tersisa di pesan akhir.
