/**
 * Logika jendela nomor halaman untuk komponen Pagination.
 *
 * Halaman pertama & terakhir SELALU tampil; di antaranya hanya `middleCount`
 * nomor yang ditampilkan, dan jendela itu digeser mengikuti halaman aktif agar
 * tidak melewati batas atas/bawah. Bagian yang dilewati diwakili "gap" (…).
 *
 * Dipisah dari komponen supaya bisa diuji tanpa merender React, dan supaya
 * jumlah nomor bisa berbeda per breakpoint (mobile lebih sedikit dari desktop).
 */

export type PaginationItem = number | "gap"

export function buildVisiblePages(
  lastPage: number,
  current: number,
  middleCount: number,
): PaginationItem[] {
  if (!Number.isFinite(lastPage) || lastPage <= 0) return []

  // Nomor tengah minimal 1 supaya jendela tidak pernah kosong.
  const middle = Math.max(1, Math.floor(middleCount))

  // Semua halaman muat tanpa perlu ellipsis.
  if (lastPage <= middle + 2) {
    return Array.from({ length: lastPage }, (_, index) => index + 1)
  }

  const clampedCurrent = Math.min(Math.max(current, 1), lastPage)
  const rawStart = clampedCurrent - Math.floor((middle - 1) / 2)
  const start = Math.max(2, Math.min(rawStart, lastPage - middle))
  const end = start + middle - 1

  const items: PaginationItem[] = [1]
  if (start > 2) items.push("gap")
  for (let page = start; page <= end; page++) items.push(page)
  if (end < lastPage - 1) items.push("gap")
  items.push(lastPage)

  return items
}

/** Jumlah nomor tengah: mobile lebih sedikit agar muat di layar sempit. */
export const PAGINATION_MIDDLE_DESKTOP = 3
export const PAGINATION_MIDDLE_MOBILE = 2
