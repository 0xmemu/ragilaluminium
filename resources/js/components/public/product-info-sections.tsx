import { Link } from "@inertiajs/react"
import * as React from "react"

import { GalleryLightbox } from "@/components/public/gallery-lightbox"
import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ProductAttribute, ProductDetailData, Testimonial } from "@/types"

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
    <span className={cn("inline-flex items-center gap-0.5 text-[#F5A623]", className)} aria-hidden="true">
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

/** Semua foto satu ulasan — `images` multi-gambar, fallback ke `image_url`. */
function reviewImages(review: Testimonial): string[] {
  const images = (review.images ?? []).filter((url): url is string => Boolean(url))
  return images.length ? images : review.image_url ? [review.image_url] : []
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
        className="flex min-h-14 w-full items-center justify-between gap-4 text-left"
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
  product,
  attributes,
  installationMedia = [],
  reviews,
  averageRating,
  ratingLabel,
  ratedReviews,
}: {
  product: ProductDetailData
  attributes: ProductAttribute[]
  installationMedia?: Array<{ id: number; url: string; thumb?: string | null }>
  reviews: Testimonial[]
  averageRating: number | null
  ratingLabel: string | null
  ratedReviews: Testimonial[]
}) {
  const [previewReview, setPreviewReview] = React.useState<Testimonial | null>(null)
  const [previewIndex, setPreviewIndex] = React.useState(0)

  const visibleAttributes = attributes.filter(
    (a) => !/^(promo_|flash_sale|compare_price|harga_asli|harga_sebelum_diskon)/i.test(a.name),
  )

  return (
    <>
      {/* Informasi Produk */}
      <div className="mt-4 border-t border-border">
        <AccordionSection title="Informasi produk" defaultOpen={false}>
          <div className="space-y-1.5 text-sm leading-6">
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
          </div>
          {visibleAttributes.length ? (
            <dl className="mt-4 border-t border-border">
              {visibleAttributes.map((attribute, index) => (
                <div
                  key={`${attribute.name}-${index}`}
                  className="grid min-w-0 grid-cols-1 gap-3 border-b border-border/60 py-3 text-sm sm:grid-cols-[minmax(7rem,0.65fr)_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="min-w-0 break-words font-bold text-foreground">{attribute.name}</dt>
                  <dd className="min-w-0 break-words leading-6 text-foreground">{attribute.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </AccordionSection>

        {product.description ? (
          <AccordionSection title="Tentang produk" defaultOpen={false}>
            <p className="whitespace-pre-line text-sm leading-6 text-foreground">
              {product.description}
            </p>
          </AccordionSection>
        ) : null}
      </div>

      {installationMedia.length ? (
        <section id="hasil-pemasangan" className="mt-4 scroll-mt-28">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-foreground">Hasil pemasangan</h2>
            <Link
              href={routeUrl("installation.show", { parent_sku: product.parent_sku })}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#474747] transition hover:text-[#333333]"
            >
              <span>Lihat Semua</span>
              <Icon name="arrow-right" className="size-3.5" weight="regular" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {installationMedia.slice(0, 8).map((item) => (
              <li key={item.id} className="relative flex aspect-[4/3] min-w-0 items-center overflow-hidden border border-border bg-white">
                <ResponsiveImage
                  src={item.url}
                  alt=""
                  wrapperClassName="size-full bg-white"
                  className="!object-contain"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Penilaian & Ulasan */}
      <section id="penilaian-ulasan" className="mt-4 scroll-mt-28">
        <h2 className="text-base font-bold text-foreground">Penilaian & ulasan</h2>
        {averageRating !== null ? (
          <div className="mt-2 flex items-center gap-2.5">
            <span className="text-3xl font-normal leading-9 text-foreground">
              {ratingLabel}/5
            </span>
            <StarRow value={averageRating} size="size-5" />
            <span className="text-sm text-muted-foreground">
              ({ratedReviews.length} ulasan)
            </span>
          </div>
        ) : null}

        {reviews.length ? (
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {reviews.slice(0, 2).map((review) => (
              <li key={review.id} className="py-4">
                {(review.rating ?? 0) > 0 ? (
                  <StarRow value={review.rating ?? 0} size="size-3.5" />
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {review.customer_name}
                  {review.location ? ` · ${review.location}` : ""}
                </p>
                <p className="mt-2 max-w-full break-words text-xs leading-5 text-foreground">
                  {review.message}
                </p>
                {reviewImages(review).length ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewReview(review)
                      setPreviewIndex(0)
                    }}
                    className="group/img relative mt-3 block h-24 w-full overflow-hidden rounded-sm bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Perbesar foto ulasan ${review.customer_name}`}
                  >
                    <ResponsiveImage
                      src={reviewImages(review)[0]}
                      alt={`Foto ulasan ${review.customer_name}`}
                      wrapperClassName="size-full bg-surface-muted"
                      className="size-full object-cover transition duration-300 group-hover/img:scale-[1.03]"
                    />
                    {reviewImages(review).length > 1 ? (
                      <span
                        className="absolute bottom-1.5 right-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white"
                        aria-hidden="true"
                      >
                        <Icon name="image" weight="fill" className="size-3" />
                        {reviewImages(review).length}
                      </span>
                    ) : null}
                    <span
                      className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 transition duration-300 group-hover/img:bg-black/30"
                      aria-hidden="true"
                    >
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white opacity-0 transition duration-300 group-hover/img:opacity-100">
                        <Icon name="expand" weight="bold" className="size-3.5" />
                        {reviewImages(review).length} foto
                      </span>
                    </span>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 border-t border-border pt-4 text-sm text-muted-foreground">
            Belum ada ulasan untuk produk ini. Lihat ulasan pelanggan lain di halaman Ulasan
            atau tanya detail pemasangan via WhatsApp.
          </p>
        )}
        {reviews.length ? (
          <Link
            href={routeUrl("reviews")}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#474747] transition hover:text-[#333333]"
          >
            <span>Lihat Semua Ulasan ({reviews.length})</span>
            <Icon name="arrow-right" className="size-3.5" weight="regular" aria-hidden="true" />
          </Link>
        ) : null}
      </section>

      {previewReview ? (
        <GalleryLightbox
          items={reviewImages(previewReview).map((src) => ({
            src,
            alt: `Foto ulasan ${previewReview.customer_name}`,
            name: previewReview.customer_name,
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
