import { describe, expect, it } from "vitest"

import { shouldShowFlashCarousel } from "@/lib/catalog-flash-carousel"

/**
 * Kontrak 2026-10-11: carousel Flash Sale hanya tampil di halaman "Paling
 * Banyak Dipesan" dalam keadaan aslinya.
 *
 * Dua celah yang dijaga di sini:
 * - carousel tetap tampil setelah pembeli memilih urutan lain atau
 *   mempersempit filter, padahal isinya peringkat Flash Sale global yang tidak
 *   mengikuti filter itu;
 * - penanda `from` bisa ikut terbawa di URL halaman lain (kategori, model,
 *   promo) yang memakai komponen halaman yang sama, sehingga carousel muncul
 *   di halaman yang bukan miliknya.
 */
describe("shouldShowFlashCarousel", () => {
  const dasar = {
    isAllProducts: true,
    fromTopSold: true,
    sort: "popular",
    activeFilterCount: 0,
  }

  it("tampil di halaman Paling Banyak Dipesan tanpa filter dan urutan default", () => {
    expect(shouldShowFlashCarousel(dasar)).toBe(true)
  })

  it("sembunyi di halaman lain walau penandanya ikut di URL", () => {
    expect(shouldShowFlashCarousel({ ...dasar, isAllProducts: false })).toBe(false)
  })

  it("sembunyi bila pembeli memilih urutan lain", () => {
    for (const sort of ["newest", "size_asc", "size_desc", "price_asc", "price_desc"]) {
      expect(shouldShowFlashCarousel({ ...dasar, sort })).toBe(false)
    }
  })

  it("sembunyi bila daftar dipersempit filter", () => {
    expect(shouldShowFlashCarousel({ ...dasar, activeFilterCount: 1 })).toBe(false)
    expect(shouldShowFlashCarousel({ ...dasar, activeFilterCount: 3 })).toBe(false)
  })

  it("sembunyi bila halaman tidak dibuka dari carousel Paling Banyak Dipesan", () => {
    expect(shouldShowFlashCarousel({ ...dasar, fromTopSold: false })).toBe(false)
  })
})
