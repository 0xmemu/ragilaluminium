import type { Testimonial } from "@/types"

/** Urutan ulasan: "all" = urutan bawaan (paling relevan), tanpa pengurutan ulang. */
export type ReviewSortValue = "all" | "newest" | "oldest"

export interface ReviewRatingCount {
  /** "1" sampai "5". */
  value: string
  count: number
}

/**
 * Apakah ulasan ini punya foto atau video.
 * Foto dibaca dari `images` dengan fallback `image_url`, video dari `media`.
 */
export function reviewHasMedia(review: Testimonial): boolean {
  const images = (review.images ?? []).filter((url): url is string => Boolean(url))
  if (images.length || review.image_url) return true

  return (review.media ?? []).some((item) => Boolean(item?.url))
}

/** Satu ubin media ulasan: foto atau video. */
export interface ReviewMediaItem {
  src: string
  isVideo: boolean
}

/**
 * Foto lalu video satu ulasan, tanpa duplikat.
 *
 * Server memasukkan URL video ke dalam `images` juga (imagesPayload
 * menggabungkan seluruh media_items), jadi URL yang sudah muncul sebagai video
 * dibuang dari daftar foto. Tanpa itu, video akan tampil dua kali: sekali
 * sebagai ubin gambar rusak (mp4 dimuat sebagai gambar) dan sekali sebagai video.
 */
export function reviewMediaItems(review: Testimonial): ReviewMediaItem[] {
  const videos = (review.media ?? []).filter(
    (item): item is { type: "video"; url: string } => item?.type === "video" && Boolean(item.url),
  )
  const videoUrls = new Set(videos.map((item) => item.url))

  const photos = (review.images ?? []).filter(
    (url): url is string => Boolean(url) && !videoUrls.has(url),
  )
  if (!photos.length && review.image_url && !videoUrls.has(review.image_url)) {
    photos.push(review.image_url)
  }

  return [
    ...photos.map((src) => ({ src, isVideo: false })),
    ...videos.map((item) => ({ src: item.url, isVideo: true })),
  ]
}

/**
 * Hitung jumlah ulasan per rating.
 *
 * Sengaja dihitung dari SELURUH ulasan (tanpa filter rating), supaya jumlah
 * tiap rating tetap terbaca saat pembeli sedang memilih salah satu rating.
 * Rating tanpa ulasan tidak ditampilkan, jadi tidak ada pilihan kosong.
 * Urut menaik: bintang terendah di paling atas.
 */
export function reviewRatingCounts(reviews: Testimonial[]): ReviewRatingCount[] {
  const counts = new Map<number, number>()

  for (const review of reviews) {
    const value = review.rating ?? 0
    if (value >= 1 && value <= 5) counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => ({ value: String(value), count }))
}

/**
 * Uraikan param rating berbentuk daftar, mis. "4,5" -> [4, 5].
 * Nilai di luar 1..5 dibuang dan duplikat disatukan, sama seperti sisi server.
 */
export function parseRatingParam(raw: string | null | undefined): number[] {
  const values = (raw ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5)

  return [...new Set(values)].sort((a, b) => a - b)
}

/**
 * Terapkan filter dan urutan ulasan untuk daftar di sisi klien.
 *
 * Dipakai halaman produk, yang seluruh ulasannya sudah tersedia sebagai data
 * halaman sehingga tidak perlu memuat ulang saat filter diubah.
 */
export function filterReviews(
  reviews: Testimonial[],
  options: { ratings: number[]; mediaOnly: boolean; sort: ReviewSortValue },
): Testimonial[] {
  let items = reviews

  if (options.ratings.length) {
    items = items.filter((review) => options.ratings.includes(review.rating ?? 0))
  }

  if (options.mediaOnly) {
    items = items.filter(reviewHasMedia)
  }

  if (options.sort === "newest") {
    items = [...items].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
  } else if (options.sort === "oldest") {
    items = [...items].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
  }

  return items
}
