# ADR-022: Kontrak Alignment Form Admin

- Status: **Accepted** (2026-09-17)
- Pemutus: Owner (Ragil)
- Ruang lingkup: seluruh form admin (Inertia React)
- Referensi: ADR-011 (admin UI shadcn), ADR-020 (form produk satu halaman)

## Konteks

Ditemukan baris form yang tidak lurus pada form Ulasan (Tambahan Screenshot):

1. Input Lokasi duduk 11px lebih rendah dari Nama pelanggan pada baris yang sama. Penyebab: grid di dalam komponen Field ikut meregang (default stretch) saat selnya di-stretch baris grid, sehingga track auto bertambah tinggi dan kontrol terdorong turun. Sel dengan hint/error lebih tinggi dari sel tetangganya, jadi masalah ini muncul di mana-mana.
2. Baris media memakai stripe dengan padding sendiri (14px) sedangkan grid field memakai 20/24px, sehingga tepi kiri/kanan tidak sekolom.
3. Checkbox Tampilkan di storefront memakai sm:self-end atau sm:pt-7 (nilai manual), sehingga titiknya tidak sejajar dengan kontrol di sebelahnya.
4. Skala root font admin 14px, jadi h-8 = 28px dan leading-5 = 17.5px; kontrol standar memakai h-9 = 32px. Baris spacer yang memakai h-8 atau leading-5 menghasilkan selisih 2-3px.

## Keputusan

1. Field (resources/js/components/admin/ui/field.tsx) memakai grid content-start, sehingga sel yang diregangkan tidak pernah mendorong kontrol turun.
2. Tambah primitif bersama di file yang sama:
   - FieldGrid: grid form standar (content-start, gap-4, sm:grid-cols-2).
   - CheckboxField: checkbox yang sebaris dengan field lain; spacer setinggi baris label dipakai hanya pada sm+ supaya centang sejajar dengan kontrol tetangga. Mode standalone untuk checkbox satu baris penuh.
   - FieldAction: tombol atau aksi lain yang harus sejajar dengan kontrol field di sebelahnya.
3. Dilarang menyejajarkan kontrol dengan trik manual (sm:self-end, items-end, sm:pt-*). Semua baris memakai primitif di atas.
4. Section/kartu dalam satu halaman form memakai skala padding yang sama (p-5 sm:p-6) supaya tepi kiri/kanan lurus. Baris media digabung ke grid field, bukan stripe dengan padding sendiri.
5. Karena skala root 14px, baris kontrol memakai h-9 (bukan h-8) dan spacer tidak menetapkan leading sendiri (mengikuti line-height label Field, 19.5px).

## Konsekuensi

- Positif: label dan kontrol antar kolom selalu lurus sebaris walau ada hint/error; tidak ada lagi tambalan per halaman.
- Positif: satu tempat untuk memperbaiki perilaku alignment (ui/field.tsx) berlaku ke semua form.
- Netral: markup form sedikit lebih panjang karena spacer, tetapi konsisten.
- Risiko: form lama yang belum memakai primitif ini bisa tampak sedikit berbeda; migrasikan saat menyentuh halaman tersebut.

## Verifikasi

Ukur rect elemen: kontrol dalam satu baris wajib punya center Y sama (toleransi pembulatan 1px) dan kolom kiri/kanan punya X konsisten. Diuji pada tambah screenshot (marketplace), tambah ulasan website, banner, pengumuman, dan galeri pemasangan.

## Alternatif yang ditolak

- Menambal tiap halaman satu per satu: ditolak karena masalahnya sistemik (stretch grid) dan akan berulang.
- Memaksa semua sel memakai fixed height: ditolak karena mengurangi keluwesan saat ada hint/error panjang.
