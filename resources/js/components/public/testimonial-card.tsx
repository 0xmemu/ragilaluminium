import { Link } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ResponsiveImage } from "@/components/ui/responsive-image"
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
  const hasImage = Boolean(testimonial.image_url)
  const imageUrl = testimonial.image_url ?? null
  const photos = (testimonial.images ?? []).filter((url): url is string => Boolean(url))
  if (!photos.length && imageUrl) photos.push(imageUrl)
  const imageAlt = isScreenshot
    ? `Screenshot ulasan ${testimonial.customer_name}`
    : `Hasil pemasangan dari ${testimonial.customer_name}`

  // Mode Screenshot (Shopee / WhatsApp): murni gambar 1:1 tanpa frame
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

  // Hitung berapa foto 56px yang muat dalam lebar kartu; sisanya jadi badge "+N"
  // pada foto terakhir yang ditampilkan (overlay gelap) — bukan scroll.
  React.useEffect(() => {
    const el = photoRowRef.current
    if (!el || photos.length === 0) return
    const CELL = 56 + 6
    const compute = () => {
      const width = el.clientWidth
      const count = Math.max(1, Math.floor((width + 6) / CELL))
      setVisiblePhotos(Math.min(photos.length, count))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [photos.length])

  const shown = visiblePhotos > 0 ? visiblePhotos : Math.min(photos.length, 3)
  const extra = photos.length - shown
  const showOverlay = extra > 0

  const cardClassName = cn(
    "testimonial-card @container group flex h-full min-w-0 flex-col rounded-xl border border-border bg-white p-4 transition-all duration-300 hover:border-border/60 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] motion-reduce:transition-none",
    reviewSectionHref ? "cursor-pointer" : null,
    hasImage ? "testimonial-card--with-image" : null,
  )

  const inner = (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
          {testimonial.customer_name}
        </p>
        {testimonial.location ? (
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {testimonial.location}
          </p>
        ) : null}
      </div>
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

      {photos.length ? (
        <div ref={photoRowRef} className="mt-auto flex items-center gap-1.5 pt-2.5">
          {photos.slice(0, shown).map((src, index) => {
            const isBadge = showOverlay && index === shown - 1
            return (
              <span
                key={src + "-" + index}
                className="relative size-14 shrink-0 overflow-hidden rounded-[6px] bg-surface-muted"
              >
                <ResponsiveImage
                  src={src}
                  alt={imageAlt}
                  wrapperClassName="size-full bg-surface-muted"
                  className="size-full object-cover"
                />
                {isBadge ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-base font-semibold leading-none tabular-nums text-muted-foreground">
                      +{extra}
                    </span>
                  </span>
                ) : null}
              </span>
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
