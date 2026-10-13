import { Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { InstallationLightbox } from "@/components/public/installation-lightbox"
import { ReviewPhotoThumb } from "@/components/public/review-photo-thumb"
import {
  ReviewFilterPills,
  type ReviewSortValue,
} from "@/components/public/review-filter-pills"
import { filterReviews, reviewMediaItems, reviewRatingCounts } from "@/lib/review-filters"
import { ReviewCollapsibleText } from "@/components/public/review-collapsible-text"
import { formatDate } from "@/lib/format"

import { GalleryLightbox } from "@/components/public/gallery-lightbox"
import { TestimonialCard } from "@/components/public/testimonial-card"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ProductAttribute, ProductDetailData, SharedPageProps, Testimonial } from "@/types"

function StarRow({
  value,
  size = "size-4",
  className,
}: {
  value: number
  size?: string
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-warning", className)} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <Icon
          key={index}
          name="star"
          weight={index < Math.round(value) ? "fill" : "regular"}
          className={size}
        />
      ))}
    </span>
  )
}


function AccordionSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const contentId = React.useId()

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-10 w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="text-sm font-bold text-foreground">{title}</span>
        <Icon
          name="caret-down"
          className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")}
          weight="bold"
          aria-hidden="true"
        />
      </button>
      <div id={contentId} className={cn("pb-5", !open && "hidden")}>
        {children}
      </div>
    </div>
  )
}

/**
 * Bagian bawah kolom kanan halaman produk: Informasi produk & Tentang produk
 * (accordion), Hasil pemasangan, dan Penilaian & ulasan.
 * Semua nilai turunan (rating, ulasan terfilter) datang sebagai props (§5 R).
 */
export function ProductInfoSections({
  mode = "all",
  product,
  attributes,
  installationMedia = [],
  reviews,
  averageRating,
  ratingLabel,
  ratedReviews,
}: {
  mode?: "all" | "info" | "reviews-installation"
  product: ProductDetailData
  attributes: ProductAttribute[]
  installationMedia?: Array<{ id: number; url: string; thumb?: string | null; is_video?: boolean }>
  reviews: Testimonial[]
  averageRating: number | null
  ratingLabel: string | null
  ratedReviews: Testimonial[]
}) {
  // Nama toko untuk label balasan ulasan (owner 2026-09-18).
  const { brand } = usePage<SharedPageProps>().props
  const storeName = brand?.short_name || "Toko"

  const [previewReview, setPreviewReview] = React.useState<Testimonial | null>(null)
  const [previewIndex, setPreviewIndex] = React.useState(0)
  const [reviewsOpen, setReviewsOpen] = React.useState(false)
  const [installationOpen, setInstallationOpen] = React.useState(false)
  const [installationIndex, setInstallationIndex] = React.useState(0)

  // Filter ulasan di section ini dan di popup "Semua Ulasan". Dijalankan di
  // browser karena seluruh ulasan produk sudah tersedia sebagai data halaman,
  // jadi tidak perlu memuat ulang apa pun saat filter diubah.
  const [reviewSort, setReviewSort] = React.useState<ReviewSortValue>("all")
  const [reviewMediaOnly, setReviewMediaOnly] = React.useState(false)
  const [reviewRatings, setReviewRatings] = React.useState<number[]>([])

  /** Jumlah tiap rating, dihitung SEBELUM filter rating supaya tidak hilang. */
  const ratingCounts = React.useMemo(() => reviewRatingCounts(reviews), [reviews])

  const filteredReviews = React.useMemo(
    () => filterReviews(reviews, { ratings: reviewRatings, mediaOnly: reviewMediaOnly, sort: reviewSort }),
    [reviews, reviewRatings, reviewMediaOnly, reviewSort],
  )

  const reviewPills = (
    <ReviewFilterPills
      idPrefix={`product-reviews-${product.parent_sku}`}
      totalCount={reviews.length}
      sort={reviewSort}
      onSortChange={setReviewSort}
      mediaOnly={reviewMediaOnly}
      onMediaOnlyChange={setReviewMediaOnly}
      ratings={ratingCounts}
      selectedRatings={reviewRatings}
      onRatingsChange={setReviewRatings}
      className="mt-3"
    />
  )

  const reviewsScrollRef = React.useRef<HTMLUListElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(true)

  const checkScroll = React.useCallback(() => {
    const el = reviewsScrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  React.useEffect(() => {
    checkScroll()
    window.addEventListener("resize", checkScroll)
    return () => window.removeEventListener("resize", checkScroll)
  }, [checkScroll, reviews.length])

  const scrollReviews = (dir: -1 | 1) => {
    const el = reviewsScrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.75 * dir
    el.scrollBy({ left: amount, behavior: "smooth" })
  }

  const visibleAttributes = attributes.filter(
    (a) => !/^(promo_|flash_sale|compare_price|harga_asli|harga_sebelum_diskon)/i.test(a.name),
  )

  const showInfo = mode === "all" || mode === "info"
  const showReviewsAndInstallation = mode === "all" || mode === "reviews-installation"

  return (
    <>
      {/* Informasi Produk */}
      {showInfo ? (
      <div className="mt-4 border-t border-border">
        <AccordionSection title="Informasi produk" defaultOpen={false}>
          <div className="space-y-1.5 text-xs leading-5">
            {product.category_label ? (
              <p>
                <span className="font-bold text-foreground">Kategori</span>
                <span className="text-foreground">: {product.category_label}</span>
              </p>
            ) : null}
            {product.model_label ? (
              <p>
                <span className="font-bold text-foreground">Model</span>
                <span className="text-foreground">: {product.model_label}</span>
              </p>
            ) : null}
            {product.design_label ? (
              <p>
                <span className="font-bold text-foreground">Desain</span>
                <span className="text-foreground">: {product.design_label}</span>
              </p>
            ) : null}
            {visibleAttributes.map((attribute, index) => (
              <p key={`${attribute.name}-${index}`}>
                <span className="font-bold text-foreground">{attribute.name}</span>
                <span className="text-foreground">: {attribute.value}</span>
              </p>
            ))}
          </div>
        </AccordionSection>

        {product.description ? (
          <AccordionSection title="Tentang produk" defaultOpen={false}>
            <p className="whitespace-pre-line text-xs leading-5 text-foreground">
              {product.description}
            </p>
          </AccordionSection>
        ) : null}
      </div>
      ) : null}

      {showReviewsAndInstallation ? (
      <>
      {/* Penilaian & Ulasan - Carousel horizontal di desktop */}
      {reviews.length ? (
      <section id="penilaian-ulasan" className="mt-4 scroll-mt-28">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base lg:text-lg font-bold text-foreground">Ulasan Pembeli</h2>
            {averageRating !== null ? (
              <div className="flex items-center gap-1.5">
                <span className="text-lg lg:text-xl font-bold leading-none text-foreground">
                  {ratingLabel}/5
                </span>
                <StarRow value={averageRating} size="size-4" />
                <span className="text-xs text-muted-foreground">
                  ({ratedReviews.length} ulasan)
                </span>
              </div>
            ) : null}
          </div>

          {/* Tombol Back & Next Carousel (Desktop) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollReviews(-1)}
              disabled={!canScrollLeft}
              aria-label="Geser ulasan ke kiri"
              className="hidden lg:inline-flex size-8 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:bg-muted disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none"
            >
              <Icon name="caret-left" className="size-4" weight="bold" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollReviews(1)}
              disabled={!canScrollRight}
              aria-label="Geser ulasan ke kanan"
              className="hidden lg:inline-flex size-8 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:bg-muted disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none"
            >
              <Icon name="caret-right" className="size-4" weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        {reviewPills}

        {filteredReviews.length ? (
          <ul
            ref={reviewsScrollRef}
            onScroll={checkScroll}
            // `lg:items-start` mencegah flex row merentangkan semua kartu ke tinggi
            // kartu tertinggi (bawaan align-items: stretch), sehingga tiap kartu
            // berhenti di tinggi kontennya sendiri.
            className="scrollbar-none mt-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:overflow-x-auto lg:scroll-smooth lg:pb-2"
          >
            {filteredReviews.map((review) => {
              const media = reviewMediaItems(review)
              // Empat media per baris, satu baris penuh (grid 4 kolom).
              const visibleMedia = media.slice(0, 4)
              const extraMedia = media.length - visibleMedia.length
              // Variabel lokal supaya tipenya menyempit jadi string; guard
              // `?? ""` pada pemakaian langsung tidak menyempitkan tipe.
              const variantLabel = (review.variant_label ?? "").trim()
              const adminReply = (review.admin_reply ?? "").trim()
              return (
                <li
                  key={review.id}
                  // Lebar kartu = (100% - 2 jarak) / 2.5 supaya tepat 2,5 kartu terlihat
                  // di lebar layar mana pun. Jarak antar kartu 12px (gap-3), jadi dua jarak
                  // = 24px = 1.5rem. Sebelumnya 320px tetap, sehingga jumlah kartu yang
                  // terlihat berubah mengikuti lebar layar (3,5 kartu pada kontainer 1169px).
                  className="flex flex-col rounded-xl border border-border bg-white p-4 shrink-0 lg:w-[calc((100%_-_1.5rem)/2.5)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                      {review.customer_name}
                    </p>
                    {review.location || review.created_at ? (
                      <p className="flex items-center gap-1 text-[11px] leading-tight text-muted-foreground">
                        {review.location ? <span className="truncate">{review.location}</span> : null}
                        {review.location && review.created_at ? <span aria-hidden="true">·</span> : null}
                        {review.created_at ? (
                          <span className="shrink-0 tabular-nums">{formatDate(review.created_at)}</span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  {(review.rating ?? 0) > 0 ? (
                    <div className="mt-2 flex text-warning" aria-label={`${review.rating} dari 5 bintang`}>
                      <StarRow value={review.rating ?? 0} size="size-3" />
                    </div>
                  ) : null}
                  {variantLabel ? (
                    <p className="mt-1.5 truncate text-[11px] leading-tight text-muted-foreground">
                      {variantLabel.replace(/ · /g, " / ")}
                    </p>
                  ) : null}
                  {review.message ? (
                    <ReviewCollapsibleText
                      text={review.message}
                      className="mt-1 max-w-full break-words text-xs leading-snug text-foreground"
                    />
                  ) : null}
                  {media.length ? (
                    <div className="mt-2.5 grid w-full grid-cols-4 gap-1.5">
                      {visibleMedia.map((item, index) => {
                        // Ubin terakhir menanggung sisa media yang tidak tampil.
                        const withOverlay = extraMedia > 0 && index === visibleMedia.length - 1
                        return (
                          <ReviewPhotoThumb
                            key={`${item.src}-${index}`}
                            src={item.src}
                            isVideo={item.isVideo}
                            bare
                            asButton
                            onButtonClick={() => {
                              setPreviewReview(review)
                              setPreviewIndex(index)
                            }}
                            ariaLabel={
                              withOverlay
                                ? `Lihat ${media.length} media ulasan ${review.customer_name}`
                                : `${item.isVideo ? "Video" : "Foto"} ulasan ${review.customer_name} ${index + 1}`
                            }
                            alt={`${item.isVideo ? "Video" : "Foto"} ulasan ${review.customer_name} ${index + 1}`}
                            overlayCount={withOverlay ? extraMedia : undefined}
                            className="aspect-square w-full rounded-[4px]"
                            buttonClassName="bg-surface-muted"
                          />
                        )
                      })}
                    </div>
                  ) : null}
                  {adminReply ? (
                    <div className="mt-2 rounded-lg border border-border/70 bg-surface-muted p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Balasan {storeName}
                      </p>
                      <ReviewCollapsibleText
                        text={adminReply}
                        clampClassName="line-clamp-2"
                        className="mt-0.5 whitespace-pre-line text-xs leading-snug text-foreground/90"
                        surfaceClassName="bg-surface-muted"
                      />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-3 border-t border-border pt-4 text-sm text-muted-foreground">
            Belum ada ulasan yang cocok dengan filter. Coba ubah atau hapus filternya,
            atau tanyakan detail pemasangan via WhatsApp.
          </p>
        )}
        {filteredReviews.length ? (
          <div className="mt-4 border-t border-b border-border lg:hidden">
            <button
              type="button"
              onClick={() => setReviewsOpen(true)}
              className="flex w-full cursor-pointer items-center justify-between gap-1.5 py-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <span>Lihat Semua Ulasan ({filteredReviews.length})</span>
              <Icon name="arrow-right" className="size-4 -rotate-90 transition-transform md:rotate-0" weight="regular" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </section>
      ) : null}

      {/* Hasil pemasangan: 3 kartu 1:1 (radius 3px). Lebih dari 3 -> overlay +N pada kartu ke-3, klik membuka lightbox swipeable. */}
      {installationMedia.length ? (
        <section id="hasil-pemasangan" className="mt-4 scroll-mt-28">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-foreground">Hasil pemasangan</h2>
            <Link
              href={
                product.product_category && product.product_model
                  ? routeUrl("installation.model", {
                      category: product.product_category.toLowerCase(),
                      model: product.product_model,
                    })
                  : routeUrl("installation.index")
              }
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground lg:text-primary lg:hover:underline"
            >
              <span>Lihat Semua</span>
              <Icon name="arrow-right" className="size-4" weight="bold" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {installationMedia.slice(0, 6).map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setInstallationIndex(index)
                    setInstallationOpen(true)
                  }}
                  className="group relative block aspect-square w-full overflow-hidden rounded-[3px] border border-border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Perbesar ${item.is_video ? "video" : "foto"} pemasangan ${index + 1}`}
                >
                  <ResponsiveImage
                    src={item.url}
                    alt=""
                    wrapperClassName="size-full bg-white"
                    className="!object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  {index === 2 && installationMedia.length > 3 ? (
                    <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/55">
                      <span className="text-base font-bold leading-none text-white">
                        +{installationMedia.length - 3}
                      </span>
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <InstallationLightbox
            open={installationOpen}
            onOpenChange={setInstallationOpen}
            items={installationMedia}
            index={installationIndex}
            onIndexChange={setInstallationIndex}
            productName={product.name}
          />
        </section>
      ) : null}
      </>
      ) : null}

      {showReviewsAndInstallation ? (
      <DialogPrimitive.Root open={reviewsOpen} onOpenChange={setReviewsOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-[70] flex max-h-[82dvh] w-full flex-col gap-0 overflow-hidden rounded-t-2xl bg-white shadow-[0_-8px_40px_rgba(10,0,0,0.2)]",
              "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-[100%] data-[state=open]:duration-500 data-[state=open]:ease-[cubic-bezier(0.16,1,0.3,1)]",
              "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-[100%] data-[state=closed]:duration-300 data-[state=closed]:ease-[cubic-bezier(0.32,0,0.67,0)]",
              "sm:mx-auto sm:w-[min(30rem,100%)]",
            )}
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">
              Semua ulasan {product.short_name || product.name}
            </DialogPrimitive.Title>
            <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border" />
            <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground">
                  Semua Ulasan{" "}
                  <span className="font-normal text-muted-foreground">
                    ({filteredReviews.length})
                  </span>
                </h3>
                {averageRating !== null ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold leading-none text-foreground">
                      {ratingLabel}/5
                    </span>
                    <StarRow value={averageRating} size="size-3.5" />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setReviewsOpen(false)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Tutup daftar ulasan"
              >
                <Icon name="x" className="size-4" aria-hidden="true" />
              </button>
            </div>
            {/* Pill filter yang sama seperti di section, supaya pembeli bisa
                menyaring tanpa menutup popup. */}
            <div className="px-5 pb-1">{reviewPills}</div>
            <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
              <ul className="flex flex-col gap-3">
                {filteredReviews.map((review) => (
                  <li key={review.id} className="min-w-0">
                    <TestimonialCard
                      testimonial={{ ...review, product: undefined as Testimonial["product"] }}
                      variant="review"
                      href={null}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      ) : null}

      {showReviewsAndInstallation && previewReview ? (
        <GalleryLightbox
          items={reviewMediaItems(previewReview).map((item) => ({
            src: item.src,
            alt: `${item.isVideo ? "Video" : "Foto"} ulasan ${previewReview.customer_name}`,
            name: previewReview.customer_name,
            is_video: item.isVideo,
          }))}
          index={previewIndex}
          onOpenChange={(open) => {
            if (!open) setPreviewReview(null)
          }}
          onIndexChange={setPreviewIndex}
        />
      ) : null}
    </>
  )
}
