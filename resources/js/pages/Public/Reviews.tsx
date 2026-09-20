import { Head, router } from "@inertiajs/react"
import * as React from "react"

import {
  ReviewFilterPills,
  type ReviewRatingCount,
  type ReviewSortValue,
} from "@/components/public/review-filter-pills"
import { GalleryLightbox, toGalleryItems } from "@/components/public/gallery-lightbox"
import { TestimonialCard } from "@/components/public/testimonial-card"
import { EmptyState } from "@/components/ui/empty-state"
import { ReviewListingFrame } from "@/components/public/review-listing-frame"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import type { Testimonial } from "@/types"

interface ModelNavOption {
  value: string
  label: string
  count: number
}

/**
 * Halaman gabungan "Apa kata pelanggan kami" + "Ulasan pelanggan di website".
 * Satu slug (/reviews) dengan nav/filter model produk seperti halaman Model Produk.
 */
export default function Reviews({
  type = "ss",
  pageMeta,
  testimonials = [],
  activeModel = null,
  ratingNav = [],
  activeRating = null,
  activeMediaOnly = false,
  activeSort = "all",
  stats,
}: {
  type?: "ss" | "web"
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  testimonials?:
    | Testimonial[]
    | {
        data: Testimonial[]
        current_page: number
        last_page: number
        total: number
        next_page_url: string | null
        prev_page_url: string | null
        links?: Array<{ url: string | null; label: string; active: boolean }>
      }
  activeModel?: string | null
  /** Opsi filter rating (mis. "5 bintang") beserta jumlah ulasannya. */
  ratingNav?: ModelNavOption[]
  activeRating?: string | null
  activeMediaOnly?: boolean
  activeSort?: string
  stats?: { website_total?: number; average_rating?: number | null }
}) {
  const isSs = type === "ss"
  const heading =
    pageMeta?.heading?.trim().replace(/\.$/, "") ||
    (isSs ? "Apa kata pelanggan kami" : "Ulasan pelanggan di website")
  const subtitle =
    pageMeta?.subtitle?.trim() ||
    (isSs
      ? "Galeri screenshot percakapan Shopee/WhatsApp dari pelanggan."
      : "Ulasan pelanggan yang memesan lewat website.")
  const docTitle = pageMeta?.title?.trim() || heading

  const testimonialList = Array.isArray(testimonials) ? testimonials : testimonials?.data ?? []
  const pagination = !Array.isArray(testimonials)
    ? {
        current_page: testimonials?.current_page ?? 1,
        last_page: testimonials?.last_page ?? 1,
        next_page_url: testimonials?.next_page_url ?? null,
        prev_page_url: testimonials?.prev_page_url ?? null,
        total: testimonials?.total ?? 0,
        links: testimonials?.links ?? [],
      }
    : null

  const marketplace = React.useMemo(() => {
    const marketplaceItems = testimonialList.filter((t) => t.source !== "website")
    return marketplaceItems.length ? marketplaceItems : testimonialList
  }, [testimonialList])
  const website = React.useMemo(
    () => testimonialList.filter((t) => t.source === "website"),
    [testimonialList],
  )

  const total = isSs ? marketplace.length : (stats?.website_total ?? website.length)

  const galleryItems = React.useMemo(() => toGalleryItems(testimonialList), [testimonialList])
  const [lightboxIndex, setLightboxIndex] = React.useState(-1)

  /** Rating terpilih dari query param, mis. "4,5" -> [4, 5]. */
  const selectedRatings = React.useMemo(
    () =>
      (activeRating ?? "")
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5)
        .sort((a, b) => a - b),
    [activeRating],
  )

  const sortValue: ReviewSortValue =
    activeSort === "newest" || activeSort === "oldest" ? activeSort : "all"

  // Daftar ulasan halaman ini sudah disaring dan diurutkan oleh server, jadi
  // grid hanya merender apa adanya. Grid di halaman /reviews/ss menampilkan
  // item marketplace, sehingga daftar dari server dipakai apa adanya juga.
  const visibleItems = React.useMemo(
    () => (isSs ? testimonialList : website),
    [isSs, testimonialList, website],
  )

  const ratingCounts: ReviewRatingCount[] = React.useMemo(
    () =>
      ratingNav
        .map((option) => ({ value: option.value, count: option.count }))
        .sort((a, b) => Number(a.value) - Number(b.value)),
    [ratingNav],
  )

  /**
   * Semua filter dikirim sebagai query param dan SALING menjaga: memilih satu
   * filter tidak menghapus filter lain, sehingga bisa dipakai bersamaan.
   */
  function applyFilters(next: {
    model?: string | null
    ratings?: number[]
    mediaOnly?: boolean
    sort?: ReviewSortValue
  }) {
    const model = next.model !== undefined ? next.model : activeModel
    const ratings = next.ratings !== undefined ? next.ratings : selectedRatings
    const mediaOnly = next.mediaOnly !== undefined ? next.mediaOnly : activeMediaOnly
    const sort = next.sort !== undefined ? next.sort : sortValue

    const params: Record<string, string> = {}
    if (model) params.model = model
    if (ratings.length) params.rating = ratings.join(",")
    if (mediaOnly) params.media_only = "1"
    if (sort !== "all") params.sort = sort

    router.get(
      routeUrl(isSs ? "reviews.screenshots" : "reviews.website"),
      params,
      { preserveScroll: true, preserveState: false, replace: true },
    )
  }


  function renderGrid(
    items: Testimonial[],
    variant: "screenshot" | "review",
    emptyTitle: string,
    emptyDesc: string,
  ) {
    if (!items.length) {
      return (
        <EmptyState
          icon="message-circle"
          title={emptyTitle}
          description={emptyDesc}
        />
      )
    }
    // Screenshot = galeri 2 kolom (2 gambar per baris); ulasan teks tetap 1 kolom.
    const grid = variant === "screenshot"
    return (
      <ul className={grid ? "grid grid-cols-2 gap-2 md:gap-3" : "flex flex-col gap-3"}>
        {items.map((testimonial) => {
          const itemIndex = galleryItems.findIndex((g) => g.src === testimonial.image_url)
          return (
            <li key={testimonial.id} className="min-w-0">
              <TestimonialCard
                testimonial={testimonial}
                compact
                variant={variant}
                onOpen={itemIndex >= 0 ? () => setLightboxIndex(itemIndex) : undefined}
              />
            </li>
          )
        })}
      </ul>
    )
  }return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={subtitle} />
      </Head>

      {/* Ringkasan jumlah ulasan dan rating rata-rata sengaja tidak
          ditampilkan: jumlahnya sudah ada di pill filter, dan rating
          rata-rata mudah menyesatkan karena saat ini seluruh ulasan
          berating 4 sampai 5. */}
      <ReviewListingFrame
        title={heading}
        breadcrumbs={[
          { label: "Beranda", href: routeUrl("home") },
          { label: heading, href: null },
        ]}
        summary={
          <ReviewFilterPills
            idPrefix={isSs ? "reviews-ss" : "reviews-web"}
            totalCount={total}
            sort={sortValue}
            onSortChange={(value) => applyFilters({ sort: value })}
            mediaOnly={activeMediaOnly}
            onMediaOnlyChange={(value) => applyFilters({ mediaOnly: value })}
            ratings={ratingCounts}
            selectedRatings={selectedRatings}
            onRatingsChange={(value) => applyFilters({ ratings: value })}
          />
        }
        pagination={pagination}
      >
        {isSs ? (
          <section id="apa-kata-pelanggan" className="scroll-mt-20">
            {renderGrid(
              visibleItems,
              "screenshot",
              "Belum ada screenshot pelanggan",
              "Coba ubah filter, atau bukti percakapan Shopee/WhatsApp akan tampil di sini.",
            )}
          </section>
        ) : (
          <section id="ulasan-website" className="scroll-mt-20">
            {renderGrid(
              visibleItems,
              "review",
              "Belum ada ulasan sesuai filter",
              "Coba ubah atau hapus filter untuk melihat ulasan lainnya.",
            )}
          </section>
        )}
      </ReviewListingFrame>
      {isSs && galleryItems.length ? (
        <GalleryLightbox
          items={galleryItems}
          index={lightboxIndex}
          onOpenChange={(open) => {
            if (!open) setLightboxIndex(-1)
          }}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </PublicLayout>
  )
}