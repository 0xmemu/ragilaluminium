/**
 * Ukuran halaman katalog per lebar layar.
 *
 * Grid katalog memakai kolom responsif, sedangkan jumlah kartu per halaman
 * dihitung SERVER, jadi server tidak bisa tahu lebar layar. Klien karena itu
 * mengirim `per_page` saat viewport sempit.
 *
 * Kenapa mobile butuh angka berbeda: pada grid 2 kolom, 15 kartu menyisakan satu
 * kartu menggantung di baris terakhir. 16 kartu mengisi 8 baris penuh.
 */

/** Breakpoint `sm` Tailwind: di bawah ini grid katalog hanya 2 kolom. */
export const CATALOG_MOBILE_BREAKPOINT = 640

export interface CatalogPageSizes {
  desktop: number
  mobile: number
}

/**
 * Ukuran halaman yang seharusnya dipakai pada lebar viewport tertentu.
 * Lebar tidak valid (mis. 0 saat SSR) jatuh ke ukuran desktop yang aman.
 */
export function resolveCatalogPageSize(
  viewportWidth: number,
  sizes: CatalogPageSizes,
): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return sizes.desktop
  return viewportWidth < CATALOG_MOBILE_BREAKPOINT ? sizes.mobile : sizes.desktop
}

/**
 * Nilai parameter query untuk ukuran halaman. Ukuran desktop adalah default
 * server, jadi tidak perlu dikirim supaya URL desktop tetap bersih.
 */
export function catalogPageSizeParam(
  size: number,
  sizes: CatalogPageSizes,
): number | undefined {
  return size === sizes.desktop ? undefined : size
}

/**
 * Nomor halaman yang tetap valid setelah ukuran halaman berubah.
 *
 * Perpindahan ukuran mengubah jumlah halaman (mis. 31 produk: 15 per halaman =
 * 3 halaman, 16 per halaman = 2 halaman). Tanpa penjepitan ini, halaman lama
 * yang lebih besar dari jumlah halaman baru akan tampil kosong.
 */
export function clampCatalogPage(
  currentPage: number,
  total: number,
  pageSize: number,
): number {
  if (!Number.isFinite(total) || total <= 0 || pageSize <= 0) return 1

  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const page = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1

  return Math.min(Math.max(1, page), lastPage)
}
