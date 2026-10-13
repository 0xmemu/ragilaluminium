# RENCANA Refactor — Ekstrak seam `CmsSettings` (Kandidat A, arsitektur)

**Status:** RENCANA MATANG — **BELUM dieksekusi**. Menunggu working tree agent lain bersih.
**Dibuat:** 2026-08-22 (fase grilling skill improve-codebase-architecture)
**Sifat:** Refactor arsitektur (bukan bug/performa). Risiko tinggi → eksekusi bertahap.

---

## 1. Temuan (evidence-based, dari grilling)

`app/Support/` berisi **14 kelas \*Settings.php** (total 2854 baris) yang menyimpan pengaturan
tampilan toko di `cms_pages.content`. Ditemukan:

| Pengamatan | Angka |
|---|---|
| Total baris 14 Settings | 2854 baris |
| Ukuran variasi | 79 (kecil) s/d 411 (besar) baris |
| Berbagi pola CMS (`page()`/`ensurePage()`/`PAGE_SLUG`) | 13 dari 14 |
| Punya interaksi admin (update/reorder/normalize) | 14 dari 14 |
| Konsumen (file yang memanggil `*Settings::`) | 35 file |
| Pemakaian per Settings | 2-5 file masing-masing |

**Diagnosis:** BUKAN "14 modul shallow" (salah — 5 besar punya aturan bisnis kompleks:
FAQ kategorisasi, CaraPemesanan merge, FlashSale logic). Yang berulang adalah **boilerplate
CMS write-path** (`page()` query + `CmsPage::create/update` + content merge) yang diduplikasi
di hampir semua file (±50% kode).

---

## 2. Keputusan arsitektur (mengapa base class, BUKAN gabung semua)

- **JANGAN** gabung 14 jadi 1 class (god-object 2854 baris; melanggar deletion test; 5 modul
  punya aturan unik yang tidak boleh hilang di satu blob).
- **LAKUKAN** ekstrak seam **`CmsSettings` (abstract base / trait)** yang menyembunyikan
  operasi CMS generik (`page`, `ensurePage`, `save`/`update`, `content` merge), sehingga setiap
  Settings menyusut ke hanya: `PAGE_SLUG`, `DEFAULTS`, `key()`, dan **logika bisnis uniknya**.

Deletion test: menghapus boilerplate CMS dari 13 file memusatkan kompleksitas penanganan CMS
di 1 seam (menjadi lebih dalam) — PASS. Menghapus aturan bisnis unik (FAQ/FlashSale) = memindahkan,
bukan memusatkan — TIDAK disentuh.

---

## 3. Variasi tersembunyi yang WAJIB ditangani base (dari grilling)

Sebelum refactor, base class harus tangani varian ini (jangan disamakan buta):

1. `FlashSalePeriodSettings::page(bool $create=false)` — param beda signature.
2. `FaqSettings::reorder()`, `statusCounts()`, `normalizeCategory()`, `normalizeStatus()` — operasi unik.
3. `CaraPemesananSettings::mergePreserving()` — logic merge khusus.
4. `CmsDocumentSettings` — mungkin struktur document beda (bukan simple content).
5. `OperationalSettings` — cek apakah benar-benar CMS-backed atau beda.

**Rule:** base class DEFINISIKAN `abstract page()/save()/get()` tapi serahkan perilaku spesifik
yang Divergen ke override. Jangan paksa uniform pada yang beda.

---

## 4. Tahapan eksekusi (rangkaian aman, reversible)

### Fase 0 — kondisi prasyarat (BELUM sekarang)
- [ ] Konfirmasi **working tree bersih** dari agent lain (`git status`).
- [ ] Snapshot/backup file yang akan diubah.
- [ ] `php artisan test` baseline → catat hasil (harus hijau sebelum refactor).

### Fase 1 — buat base (tanpa mengubah perilaku)
- [ ] Buat `app/Support/CmsSettings.php` (abstract base): `page()`, `ensurePage()`,
      `createOrUpdate($payload)`, `contentFor()`.
- [ ] `php -l` + nul test (base tidak dipakai dulu — zero side effect).

### Fase 2 — refactor 3 Settings KECIL dulu (proof, aman)
Pilih: **AnnouncementSlideSettings (79), InstallationPageSettings (87), TestimonialPageSettings (87)**.
Konsumennya: masing-masing 2-5 file; perubahan kecil & terawasi.
- [ ] 1-by-1 extends base, hapus boilerplate.
- [ ] Setelah tiap file: `php artisan test` (katalog/rendering yang sentuh modul tsb).

### Fase 3 — verifikasi & ice (STOP-POINT)
- [ ] Regression: semua test hijau + smoke storefront 200.
- [ ] Bandingkan output sebelum/sesudah (data props identik).
- [ ] Jika ada anomali → revert file tsb (backup sudah ada).

### Fase 4 — refactor sisa besar (HANYA setelah F2/F3 solid)
- [ ] Refactor 6 sisanya yg punya varian beda dengan override tepat.
- [ ] Yang jelas beda (Faq, CaraPemesanan, FlashSale) = pertimbangkan TIDAK digabung
      (biarkan sebagai modul dalam mandiri; hanya hapus boilerplate page() via reuse bila aman).

---

## 5. Definisi "selesai" (done)

- [ ] 14 Settings bebas boilerplate CMS duplikat (page/create/update dipakai dari 1 seam).
- [ ] 0 perubahan perilaku (get/sharedProps/save output identik).
- [ ] `php artisan test` full hijau.
- [ ] Smoke storefront 200 (semua halaman).
- [ ] Tidak mencampur commit agent lain (hunk-selective).

---

## 6. Kandidat lain (untuk sesi berikutnya, bukan sekarang)
- B: bagi CatalogController 697 baris (renders) — STRONG
- C: kelompokkan 51 komponen public → modul catalog/ & cart/ — WORTH
- D: ekstrak useCatalogFilter dari Catalog.tsx 628 baris — SPECULATIVE

---

## 7. Referensi
- Report: `docs/plans/architecture-review-2026-08-22.html` (Kandidat A STRONG)
- ADR: `docs/decisions/MASTER-ADR.md` (kebijakan arsitektur)
- Konvensi: kode menang; jangan campur working tree agent lain.

---
**Eksekusi: menunggu working tree agent lain bersih + persetujuan user.**