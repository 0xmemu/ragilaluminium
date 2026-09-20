import { Link } from "@inertiajs/react"
import * as React from "react"

import { usePage } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import type { SharedPageProps } from "@/types"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { reviewMediaItems } from "@/lib/review-filters"
import { ReviewPhotoThumb } from "@/components/public/review-photo-thumb"
import { formatDate, productName } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Testimonial } from "@/types"

export function TestimonialCard({
  testimonial,
  compact = false,
  href,
  variant = "review",
  onOpen,
}: {
  testimonial: Testimonial
  compact?: boolean
  /** Jika diisi, seluruh card menjadi link. Default: produk terkait (jika ada). */
  href?: string | null
  /** `screenshot` = image-only (marketplace/WA); `review` = teks+rating. */
  variant?: "review" | "screenshot"
  /** Dipanggil saat gambar screenshot diklik (mode galeri dengan lightbox eksternal). */
  onOpen?: () => void
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [visiblePhotos, setVisiblePhotos] = React.useState(0)
  const photoRowRef = React.useRef<HTMLDivElement>(null)
  const rating = Math.max(0, Math.min(5, testimonial.rating ?? 0))
  const cardHref = href ?? testimonial.product?.href ?? null
  const isScreenshot = variant === "screenshot"
  const message = (testimonial.message ?? "").trim()
  const adminReply = (testimonial.admin_reply ?? "").trim()
  const { brand } = usePage<SharedPageProps>().props
  const storeName = brand?.short_name || "Toko"
  const hasImage = Boolean(testimonial.image_url)
  const imageUrl = testimonial.image_url ?? null
  const photos = (testimonial.images ?? []).filter((url): url is string => Boolean(url))
  if (!photos.length && imageUrl) photos.push(imageUrl)
  // Foto lalu video, memakai helper bersama supaya video tidak ikut terhitung
  // sebagai foto (server juga menaruh URL video di `images`).
  const mediaItems = reviewMediaItems(testimonial)
  const imageAlt = isScreenshot
    ? `Screenshot ulasan ${testimonial.customer_name}`
    : `Hasil pemasangan dari ${testimonial.customer_name}`

  // Mode Screenshot (Shopee / WhatsApp): murni gambar 1:1 tanpa frame
  // Hitung berapa foto 56px yang muat dalam lebar kartu; sisanya jadi badge "+N"
  // pada foto terakhir yang ditampilkan (overlay gelap) - bukan scroll.
  React.useEffect(() => {
    const el = photoRowRef.current
    if (!el || mediaItems.length === 0) return
    const CELL = 56 + 6
    const compute = () => {
      const width = el.clientWidth
      const count = Math.max(1, Math.floor((width + 6) / CELL))
      setVisiblePhotos(Math.min(mediaItems.length, count))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [mediaItems.length])

  if (isScreenshot) {
    return (
      <>
        <article className="group flex h-full flex-col">
          {hasImage ? (
            <button
              type="button"
              onClick={() => (onOpen ? onOpen() : setPreviewOpen(true))}
              className="group/img relative block size-full overflow-hidden rounded-[5px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Perbesar screenshot ulasan ${testimonial.customer_name}`}
            >
              <ResponsiveImage
                src={imageUrl!}
                alt={imageAlt}
                wrapperClassName="aspect-square size-full overflow-hidden"
                className="size-full object-cover transition duration-300 group-hover/img:scale-[1.03]"
              />
              <span
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15 transition duration-300 group-hover/img:bg-black/20"
                aria-hidden="true"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition duration-300 group-hover/img:opacity-100">
                  <Icon name="expand" weight="bold" className="h-5 w-5" aria-hidden="true" />
                </span>
              </span>
            </button>
          ) : (
            <div className="aspect-square bg-muted" />
          )}
        </article>

        {hasImage && !onOpen ? (
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="!fixed !inset-0 !left-0 !top-0 z-modal !flex !h-dvh !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !gap-0 !overflow-hidden !rounded-none !border-0 !bg-black/95 !p-0 shadow-none" aria-describedby={undefined}>
              <DialogTitle className="sr-only">
                Screenshot ulasan {testimonial.customer_name}
              </DialogTitle>
              <img
                src={imageUrl!}
                alt={imageAlt}
                className="mx-auto max-h-[88dvh] w-auto max-w-full object-contain"
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </>
    )
  }

  // Tujuan klik: ulasan produk terkait (bukan preview gambar). Fallback ke href.
  const reviewSectionHref = testimonial.product
    ? `${testimonial.product.href}#penilaian-ulasan`
    : cardHref

  const shown = visiblePhotos > 0 ? visiblePhotos : Math.min(mediaItems.length, 3)
  const extra = mediaItems.length - shown
  const showOverlay = extra > 0

  const cardClassName = cn(
    "testimonial-card @container group flex h-full min-w-0 flex-col rounded-xl border border-border bg-white p-4 transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-1 hover:border-border/60 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    reviewSectionHref ? "cursor-pointer" : null,
    hasImage ? "testimonial-card--with-image" : null,
  )

  // Waktu ulasan, nama produk, dan varian yang dipilih tampil pada 11px.
  // Ketiganya opsional: kartu tanpa data itu tetap tampil seperti sebelumnya.
  const reviewDate = testimonial.created_at ? formatDate(testimonial.created_at) : ""
  const productLabel = testimonial.product
    ? productName(testimonial.product.full_name || testimonial.product.name || "")
    : ""
  const variantLabel = (testimonial.variant_label ?? "").trim()

  const inner = (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
          {testimonial.customer_name}
        </p>
        {testimonial.location || reviewDate ? (
          <p className="flex items-center gap-1 text-[11px] leading-tight text-muted-foreground">
            {testimonial.location ? <span className="truncate">{testimonial.location}</span> : null}
            {testimonial.location && reviewDate ? <span aria-hidden="true">·</span> : null}
            {reviewDate ? <span className="shrink-0 tabular-nums">{reviewDate}</span> : null}
          </p>
        ) : null}
      </div>
      {productLabel || variantLabel ? (
        <div className="mt-1.5 min-w-0">
          {productLabel ? (
            <p
              className="truncate text-[11px] leading-tight text-muted-foreground"
              title={productLabel}
            >
              {productLabel}
            </p>
          ) : null}
          {variantLabel ? (
            <p className="truncate text-[11px] leading-tight text-muted-foreground">{variantLabel}</p>
          ) : null}
        </div>
      ) : null}
      {rating > 0 ? (
        <div className="mt-2 flex gap-0.5 text-warning" aria-label={`${rating} dari 5 bintang`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Icon
              name="star"
              key={index}
              weight={index < rating ? "fill" : "regular"}
              className="size-3"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : null}
      {message ? (
        <p className={cn("mt-1 text-xs leading-snug text-foreground", compact ? "line-clamp-4" : "line-clamp-5")}>
          {message}
        </p>
      ) : null}
      {adminReply ? (
        <div className="mt-2 rounded-lg border border-border/70 bg-muted/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Balasan {storeName}
          </p>
          <p className="mt-0.5 whitespace-pre-line text-xs leading-snug text-foreground/90 line-clamp-3">
            {adminReply}
          </p>
        </div>
      ) : null}

      {mediaItems.length ? (
        <div ref={photoRowRef} className="mt-2.5 flex items-center gap-1.5">
          {mediaItems.slice(0, shown).map((item, index) => {
            const isBadge = showOverlay && index === shown - 1
            return (
              <ReviewPhotoThumb
                key={item.src + "-" + index}
                src={item.src}
                isVideo={item.isVideo}
                alt={item.isVideo ? `Video ulasan ${testimonial.customer_name}` : imageAlt}
                overlayCount={isBadge ? extra : undefined}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )

  const linkLabel = testimonial.product
    ? `Lihat ulasan ${testimonial.customer_name} di produk ${testimonial.product.name}`
    : `Lihat ulasan ${testimonial.customer_name}`

  return (
    <article className={cardClassName}>
      {reviewSectionHref ? (
        <Link
          href={reviewSectionHref}
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={linkLabel}
        >
          {inner}
        </Link>
      ) : (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{inner}</div>
      )}
    </article>
  )
}
