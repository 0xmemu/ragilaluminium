/**
 * Gerbang tampil carousel Flash Sale di halaman daftar produk.
 *
 * Carousel Flash Sale adalah sorotan milik halaman "Paling Banyak Dipesan".
 * Isinya diambil dari peringkat Flash Sale global dan TIDAK mengikuti filter
 * yang sedang aktif, jadi begitu pembeli memilih urutan lain atau mempersempit
 * dengan filter, sorotan itu tampil di luar konteks: ia bisa memuat produk yang
 * tidak cocok dengan daftar yang sedang dilihat.
 *
 * Karena itu carousel hanya tampil dalam keadaan asli halaman itu:
 * - dibuka dari carousel "Paling Banyak Dipesan" di beranda (penanda `from`),
 * - urutan Populer yang kanonis, bukan hasil memilih urutan lain,
 * - belum dipersempit filter apa pun (model, desain, rentang harga, kata kunci).
 */

/** Urutan kanonis halaman "Paling Banyak Dipesan". */
export const FLASH_CAROUSEL_SORT = "popular"

export interface FlashCarouselGateInput {
  /** Halaman dibuka dari carousel "Paling Banyak Dipesan" di beranda. */
  fromTopSold: boolean
  /** Urutan yang sedang berlaku; nilai kosong berarti default Populer. */
  sort: string
  /** Jumlah filter aktif yang sedang menyempitkan daftar. */
  activeFilterCount: number
}

export function shouldShowFlashCarousel(input: FlashCarouselGateInput): boolean {
  return (
    input.fromTopSold &&
    input.sort === FLASH_CAROUSEL_SORT &&
    input.activeFilterCount === 0
  )
}
