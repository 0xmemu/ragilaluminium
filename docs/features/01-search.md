# Feature 01 — Search Pintar Tanpa AI

**Status implementasi:** engine deterministik Fase 6 terimplementasi (CatalogSearch) untuk typo/sinonim/dimensi/warna/saran (lihat appendix di bawah). Sisa target terbuka: UI near-size/saran, pipeline admin, ranking, analytics.

**Aktor:** customer guest dan admin katalog. Search deterministik, explainable, fixture-testable, tanpa AI/LLM, memakai katalog aktif sebagai sumber kebenaran.

## Customer flow dan behavior
1. User mengetik query dan submit; raw query tetap terlihat.
2. UI loading tanpa mereset input.
3. Backend parse intent dan mengembalikan exact match lebih dahulu.
4. Near-size/suggestion di blok terpisah dengan alasan.
5. User memilih filter/saran lalu membuka PDP.
6. Empty/error mempertahankan query dan memberi retry/clear/saran katalog.
| Input | Respons |
|---|---|
| model/kategori/warna exact | Exact match lebih dahulu |
| typo confidence tinggi: slidding | Normalisasi langsung ke sliding; raw query untuk analitik |
| ukuran 100x50 | Parse tinggi=100, panjang=50 |
| exact ukuran kosong | Near-size/range; tidak otomatis membalik ke 50x100 |
| minimalis/modern | Saran model, bukaan, ukuran, kategori, warna, atribut yang ada |
| abu doff | Jangan tampilkan sebagai varian bila tidak ada |
Ukuran tinggi × panjang. Warna aktif: Putih, Hitam, Coklat, Serat Kayu. Orientasi terbalik bukan rekomendasi default.

## Customer UI/UX states
Loading, exact, recommendation berlabel “ukuran paling mendekati”, suggestion “Mungkin yang Anda maksud”, empty, error/retry, clear, keyboard submit, mobile focus, pagination. Query tidak diganti diam-diam.

## Admin dashboard UX
Target admin search lintas produk/varian/order/import belum dikunci atau dianggap terimplementasi. Admin dapat melihat identifier internal sesuai kebutuhan; search tidak mengubah taxonomy. Analytics hanya agregat, bukan PII.

## Backend/API/database
Pipeline trim/case-fold → tokenisasi → parser ukuran → kamus taxonomy/warna → typo deterministic → scope produk aktif → ranking. Ranking exact intent, exact dimensi, near-size distance/tolerance, istilah katalog, popularitas sebagai tie-breaker. Baca products/product_variants/taxonomy aktif; dimensi positif cm. Endpoint/JSON analytics baru belum dikunci; update docs sebelum membuatnya.

## Permissions/validation/acceptance
Customer produk visible; admin authenticated sesuai role. Input malformed tidak crash. Test deterministic: typo bekerja; 100x50 tidak jadi 50x100; near-size beralasan; suggestion valid; abu doff tidak invent. Threshold/tier, sinonim, admin pipeline, analytics retention terbuka. Di luar scope AI/image search/taxonomy change.

## Appendix — Implementasi Fase 6 (rule-based, deterministic)
- **Normalisasi query** (`CatalogSearch::normalizeQuery`): whole-word, case-insensitive.
  Query asli selalu disimpan & dikembalikan (`original` vs `normalized`); `replacements`
  mendaftar penggantian agar tidak tampak merusak input. Dipakai debrief/telemetri asli.
- **Typo deterministic (whole-word):** slidding / slidng / slidingg → sliding; jenndela → jendela.
- **Sinonim Bahasa Indonesia:** bouven → boven; geser → sliding; ayun → swing.
- **Desain terkontrol:** frasa "seri a/b/c" → SERIES_A/B/C; polos/ornamen/kombinasi + nilai
  `sub_models` aktif → `design_variant` AND dengan hasil (diarahkan ke desain yang ADA).
- **Kata ambigu (minimalis/modern/elegan/mewah/premium, dsb):** tidak dipakai sebagai token
  taxonomy/warna; substring global tetap berlaku hanya jika produk memang bernama demikian.
- **Dimensi:** ukuran identik (Tinggi × Panjang), pasangan terbalik yang SAMA disengaja, dan
  RANGE (mis. "80x100 sampai 85x110", "80x100 - 85x110", "80x100 s/d 85x110") dengan
  orientasi dipertahankan (match via product_variants.height_cm/width_cm). TIDAK memaksa
  rekomendasi ukuran terbalik; ukuran terdekat (`nearestSizeVariants`, jarak Manhattan) ditawarkan.
- **Warna:** HANYA dari nilai varian resmi (product_variants variation option berlabel "Warna",
  dari DB) — tidak pernah menginvent; ejaan diselaraskan (coklat→cokelat) ke nilai resmi bila ada.
- **Saran:** `CatalogSearch::catalogKeywordSuggestions()` mengambil model/desain/kategori/warna
  yang benar-benar tersedia dari DB untuk "Mungkin yang Anda maksud" (/api/search `suggestions`).
- **Endpoint:** `/api/search` kini menambah `search`, `dimension`, `nearest_sizes`, `suggestions`.
- **Terbuka (di luar Fase 6):** UI near-size/saran, pipeline admin lintas produk/varian/order,
  ranking berdasar popularitas sebagai tie-breaker, analytics agregat.
