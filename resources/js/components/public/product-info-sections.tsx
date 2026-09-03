import { Link } from "@inertiajs/react"
import * as React from "react"

import { InstallationLightbox, type InstallationLightboxItem } from "@/components/public/installation-lightbox"

import { GalleryLightbox } from "@/components/public/gallery-lightbox"
import { TestimonialCard } from "@/components/public/testimonial-card"
import * as DialogPrimitive from "@radix-ui/react-dialog"
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

/** Semua foto satu ulasan - `images` multi-gambar, fallback ke `image_url`. */
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
  installationMedia?: Array<{ id: number; url: string; thumb?: string | null; is_video?: boolean }>
  reviews: Testimonial[]
  averageRating: number | null
  ratingLabel: string | null
  ratedReviews: Testimonial[]
}) {
  const [previewReview, setPreviewReview] = React.useState<Testimonial | null>(null)
  const [previewIndex, setPreviewIndex] = React.useState(0)
  const [reviewsOpen, setReviewsOpen] = React.useState(false)
  const [installationOpen, setInstallationOpen] = React.useState(false)
  const [installationIndex, setInstallationIndex] = React.useState(0)

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


      {/* Penilaian & Ulasan */}
      <section id="penilaian-ulasan" className="mt-4 scroll-mt-28">
        <h2 className="text-base font-bold text-foreground">Ulasan Pembeli</h2>
        {averageRating !== null ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[22px] font-normal leading-8 text-foreground">
              {ratingLabel}/5
            </span>
            <StarRow value={averageRating} size="size-4" />
            <span className="text-xs text-muted-foreground">
              ({ratedReviews.length} ulasan)
            </span>
          </div>
        ) : null}

        {reviews.length ? (
          <ul className="mt-4 flex flex-col gap-3">
            {reviews.slice(0, 2).map((review) => {
              const photos = reviewImages(review)
              return (
                <li
                  key={review.id}
                  className="flex flex-col rounded-xl border border-border bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                      {review.customer_name}
                    </p>
                    {review.location ? (
                      <p className="truncate text-[11px] leading-tight text-muted-foreground">
                        {review.location}
                      </p>
                    ) : null}
                  </div>
                  {(review.rating ?? 0) > 0 ? (
                    <div className="mt-2 flex text-warning" aria-label={`${review.rating} dari 5 bintang`}>
                      <StarRow value={review.rating ?? 0} size="size-3" />
                    </div>
                  ) : null}
                  <p className="mt-1 max-w-full break-words text-xs leading-snug text-foreground">
                    {review.message}
                  </p>
                  {photos.length ? (
                    <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
                      {photos.slice(0, 3).map((src, index) => (
                        <button
                          type="button"
                          key={`${src}-${index}`}
                          onClick={() => {
                            setPreviewReview(review)
                            setPreviewIndex(index)
                          }}
                          className="group/img relative size-14 shrink-0 overflow-hidden rounded-[6px] bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          aria-label={`Foto ulasan ${review.customer_name} ${index + 1}`}
                        >
                          <ResponsiveImage
                            src={src}
                            alt={`Foto ulasan ${review.customer_name}`}
                            wrapperClassName="size-full bg-surface-muted"
                            className="size-full object-cover transition duration-300 group-hover/img:scale-[1.03]"
                          />
                        </button>
                      ))}
                      {photos.length > 3 ? (
                        <span className="flex size-14 shrink-0 select-none items-center justify-center rounded-[6px] bg-black/50">
                          <span className="text-base font-semibold leading-none text-muted-foreground">
                            {photos.length - 3}+
                          </span>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-3 border-t border-border pt-4 text-sm text-muted-foreground">
            Belum ada ulasan untuk produk ini. Lihat ulasan pelanggan lain di halaman Ulasan
            atau tanya detail pemasangan via WhatsApp.
          </p>
        )}
        {reviews.length ? (
          <div className="mt-4 border-t border-b border-border">
            <button
              type="button"
              onClick={() => setReviewsOpen(true)}
              className="flex w-full cursor-pointer items-center justify-between gap-1.5 py-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <span>Lihat Semua Ulasan ({reviews.length})</span>
              <Icon name="arrow-right" className="size-4 -rotate-90 transition-transform md:rotate-0" weight="regular" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </section>

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
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <span>Lihat Semua</span>
              <Icon name="arrow-right" className="size-4" weight="bold" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-1.5">
            {installationMedia.slice(0, 3).map((item, index) => (
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
                  <span className="font-normal text-muted-foreground">({reviews.length})</span>
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
            <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
              <ul className="flex flex-col gap-3">
                {reviews.map((review) => (
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
