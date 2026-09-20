import { describe, expect, it } from "vitest"

import {
  filterReviews,
  parseRatingParam,
  reviewHasMedia,
  reviewRatingCounts,
} from "@/lib/review-filters"
import type { Testimonial } from "@/types"

function review(id: number, rating: number | null, extra: Partial<Testimonial> = {}): Testimonial {
  return {
    id,
    customer_name: `Pelanggan ${id}`,
    message: `Ulasan ${id}`,
    rating,
    source: "website",
    ...extra,
  }
}

describe("filter ulasan", () => {
  it("menghitung jumlah per rating dari seluruh ulasan dan mengurutkan menaik", () => {
    const items = [
      review(1, 5),
      review(2, 5),
      review(3, 4),
      review(4, null),
      review(5, 0),
    ]

    // Rating 4 dan 5 saja; null dan 0 tidak dihitung, urut dari yang terkecil.
    expect(reviewRatingCounts(items)).toEqual([
      { value: "4", count: 1 },
      { value: "5", count: 2 },
    ])
  })

  it("menyaring berdasarkan satu atau beberapa rating", () => {
    const items = [review(1, 5), review(2, 4), review(3, 3)]

    expect(filterReviews(items, { ratings: [4], mediaOnly: false, sort: "all" }).map((r) => r.id)).toEqual([2])
    // Pilih banyak rating: hasilnya gabungan, tetap urut sesuai masukan asli.
    expect(filterReviews(items, { ratings: [3, 5], mediaOnly: false, sort: "all" }).map((r) => r.id)).toEqual([1, 3])
    // Tanpa pilihan rating berarti tanpa penyaringan.
    expect(filterReviews(items, { ratings: [], mediaOnly: false, sort: "all" })).toHaveLength(3)
  })

  it("mengenali ulasan berfoto dan bervideo sebagai punya media", () => {
    expect(reviewHasMedia(review(1, 5))).toBe(false)
    expect(reviewHasMedia(review(2, 5, { image_url: "https://example.test/a.jpg" }))).toBe(true)
    expect(reviewHasMedia(review(3, 5, { images: ["https://example.test/b.jpg"] }))).toBe(true)
    expect(
      reviewHasMedia(review(4, 5, { media: [{ type: "video" }] } as Partial<Testimonial>)),
    ).toBe(true)
    // Daftar gambar kosong tidak dianggap punya media.
    expect(reviewHasMedia(review(5, 5, { images: [] }))).toBe(false)
  })

  it("menyaring hanya ulasan yang punya foto atau video", () => {
    const items = [
      review(1, 5),
      review(2, 5, { image_url: "https://example.test/a.jpg" }),
      review(3, 4, { media: [{ type: "video" }] } as Partial<Testimonial>),
    ]

    expect(filterReviews(items, { ratings: [], mediaOnly: true, sort: "all" }).map((r) => r.id)).toEqual([2, 3])
  })

  it("mengurutkan terbaru dan terlama berdasarkan id", () => {
    const items = [review(7, 5), review(3, 5), review(9, 5)]

    expect(filterReviews(items, { ratings: [], mediaOnly: false, sort: "newest" }).map((r) => r.id)).toEqual([9, 7, 3])
    expect(filterReviews(items, { ratings: [], mediaOnly: false, sort: "oldest" }).map((r) => r.id)).toEqual([3, 7, 9])
    // "all" mempertahankan urutan bawaan, tanpa pengurutan ulang.
    expect(filterReviews(items, { ratings: [], mediaOnly: false, sort: "all" }).map((r) => r.id)).toEqual([7, 3, 9])
  })

  it("tidak mengubah daftar masukan saat mengurutkan", () => {
    const items = [review(7, 5), review(3, 5)]
    filterReviews(items, { ratings: [], mediaOnly: false, sort: "newest" })

    expect(items.map((r) => r.id)).toEqual([7, 3])
  })

  it("menggabungkan filter rating, media, dan urutan", () => {
    const items = [
      review(1, 5, { image_url: "https://example.test/a.jpg" }),
      review(2, 5),
      review(3, 4, { image_url: "https://example.test/b.jpg" }),
      review(4, 4),
    ]

    expect(
      filterReviews(items, { ratings: [4, 5], mediaOnly: true, sort: "newest" }).map((r) => r.id),
    ).toEqual([3, 1])
  })

  it("menguraikan param rating berbentuk daftar dan membuang nilai tidak sah", () => {
    expect(parseRatingParam("4,5")).toEqual([4, 5])
    expect(parseRatingParam("5,4")).toEqual([4, 5])
    expect(parseRatingParam("4")).toEqual([4])
    expect(parseRatingParam("0,6,abc,3.5,-2")).toEqual([])
    expect(parseRatingParam("4,4,5")).toEqual([4, 5])
    expect(parseRatingParam("")).toEqual([])
    expect(parseRatingParam(null)).toEqual([])
  })
})
