/**
 * Gerbang tampil carousel Flash Sale di halaman daftar produk.
 *
 * Carousel Flash Sale adalah sorotan milik halaman "Paling Banyak Dipesan",
 * yaitu daftar seluruh produk (/products/all). Isinya diambil dari peringkat
 * Flash Sale global dan TIDAK mengikuti filter yang sedang aktif, jadi begitu
 * pembeli memilih urutan lain atau mempersempit dengan filter, sorotan itu
 * tampil di luar konteks: ia bisa memuat produk yang tidak cocok dengan daftar
 * yang sedang dilihat.
 *
 * Karena itu carousel hanya tampil dalam keadaan asli halaman itu:
 * - halaman yang dirender memang daftar seluruh produk, bukan kategori, model,
 *   promo, atau flash sale yang memakai komponen halaman yang sama,
 * - dibuka dari carousel "Paling Banyak Dipesan" di beranda (penanda `from`),
 * - urutan Populer yang kanonis, bukan hasil memilih urutan lain,
 * - belum dipersempit filter apa pun (model, desain, rentang harga, kata kunci).
 */

/** Urutan kanonis halaman "Paling Banyak Dipesan". */
export const FLASH_CAROUSEL_SORT = "popular"

export interface FlashCarouselGateInput {
  /**
   * Halaman yang dirender memang daftar seluruh produk. Halaman kategori,
   * model, desain, promo, dan flash sale memakai komponen yang sama, dan
   * penanda `from` bisa ikut terbawa di URL mana pun, jadi penanda itu saja
   * tidak cukup untuk memastikan halaman yang sedang dibuka.
   */
  isAllProducts: boolean
  /** Halaman dibuka dari carousel "Paling Banyak Dipesan" di beranda. */
  fromTopSold: boolean
  /** Urutan yang sedang berlaku; nilai kosong berarti default Populer. */
  sort: string
  /** Jumlah filter aktif yang sedang menyempitkan daftar. */
  activeFilterCount: number
}

export function shouldShowFlashCarousel(input: FlashCarouselGateInput): boolean {
  return (
    input.isAllProducts &&
    input.fromTopSold &&
    input.sort === FLASH_CAROUSEL_SORT &&
    input.activeFilterCount === 0
  )
}
