/**
 * Aturan media untuk tiap item Masalah & Solusi.
 *
 * Kontrak owner 2026-09-30: media TIDAK dipisah foto dan video. Admin memakai
 * satu tombol "Tambah media" dan bebas memilih apa saja: dua video, dua foto,
 * atau campuran keduanya dalam urutan yang ia mau. Yang dijaga hanya jumlahnya.
 *
 * Rasio (landscape, 1:1, atau banner memanjang) TIDAK dibatasi, karena pemakaian
 * nyata admin beragam: ada foto banner dan ada pasangan media 1:1.
 */

/** Maksimal media per item, apa pun jenisnya (foto dan video sama nilainya). */
export const MASALAH_SOLUSI_MAX_MEDIA = 2

/** Jenis media yang boleh dipilih di tiap slot. */
export type MasalahSolusiMediaKind = "image" | "video"

/**
 * Satu media di dalam daftar item, sudah berurutan sesuai pilihan admin.
 * Entri video memakai `poster`/`source`/`assetId`; entri gambar memakai
 * `width`/`height` untuk menentukan tata letak di halaman publik.
 */
export type MasalahSolusiMedia = {
  kind: MasalahSolusiMediaKind
  src: string
  alt: string
  width?: number | null
  height?: number | null
  poster?: string | null
  source?: "library" | "url"
  assetId?: number | null
}

export function isMediaLimitReached(used: number, max = MASALAH_SOLUSI_MAX_MEDIA): boolean {
  return used >= max
}

/** Sisa slot yang masih bisa diisi. */
export function remainingMedia(used: number, max = MASALAH_SOLUSI_MAX_MEDIA): number {
  return Math.max(0, max - used)
}

/**
 * Tata letak satu media contoh di halaman publik.
 *
 * Kontrak owner 2026-09-20: media di Masalah & Solusi dipakai seperti pasangan
 * before/after. Karena itu foto yang LEBAR (landscape atau banner) berdiri
 * sendiri selebar penuh, sedangkan foto persegi atau tegak dipasangkan
 * berjejer dua kolom. Sebelumnya semua dipaksa dua kolom sehingga banner
 * memanjang terhimpit separuh lebar.
 */
export type MasalahSolusiMediaLayout = "full" | "half"

/**
 * Ambang rasio untuk dianggap lebar. 1.5 mencakup 3:2, 16:9, dan banner
 * memanjang, sementara 4:3 (1.33) dan persegi tetap dipasangkan.
 */
export const MASALAH_SOLUSI_WIDE_RATIO = 1.5

/**
 * Tentukan tata letak dari ukuran asli media.
 * Mengembalikan null bila ukurannya belum diketahui, supaya pemanggil bisa
 * mengukur sendiri dari gambar yang sudah termuat.
 */
export function mediaLayout(
  width: number | null | undefined,
  height: number | null | undefined,
): MasalahSolusiMediaLayout | null {
  if (!width || !height) return null
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null

  return width / height >= MASALAH_SOLUSI_WIDE_RATIO ? "full" : "half"
}

/**
 * Kelas rentang kolom untuk tata letak ini. Media lebar membentang dua kolom
 * sehingga berdiri sendiri; media lain cukup satu kolom supaya bisa berjejer.
 */
export function mediaLayoutClass(layout: MasalahSolusiMediaLayout | null): string {
  return layout === "full" ? "col-span-2" : ""
}
