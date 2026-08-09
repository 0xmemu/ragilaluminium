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
  const rating = Math.max(0, Math.min(5, testimonial.rating ?? 0))
  const cardHref = href ?? testimonial.product?.href ?? null
  const isScreenshot = variant === "screenshot"
  const message = (testimonial.message ?? "").trim()
  const hasImage = Boolean(testimonial.image_url)
  const imageUrl = testimonial.image_url ?? null
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
              className="group/img relative block size-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Perbesar screenshot ulasan ${testimonial.customer_name}`}
            >
              <ResponsiveImage
                src={imageUrl!}
                alt={imageAlt}
                wrapperClassName="aspect-square size-full overflow-hidden"
                className="size-full object-cover transition duration-300 group-hover/img:scale-[1.03]"
              />
              <span
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition duration-300 group-hover/img:bg-black/20"
                aria-hidden="true"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition duration-300 group-hover/img:opacity-100">
                  <Icon name="expand" weight="bold" className="h-5 w-5" aria-hidden="true" />
                </span>
              </span>
            </button>
          ) : (
            <div className="flex aspect-square items-center justify-center bg-muted p-4 text-center text-xs text-muted-foreground">
              Bukti ulasan tidak memiliki gambar
            </div>
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

  // Mode Review (Website): Rating, pesan ulasan, identitas & link produk
  const cardClassName = cn(
    "@container group flex h-full min-w-0 flex-col overflow-hidden border border-border bg-white shadow-[0_1px_3px_rgba(10,0,0,0.08)] transition-all duration-300 hover:border-border/60 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] motion-reduce:transition-none",
    cardHref ? "cursor-pointer" : null,
  )

  const clampLines = hasImage ? (compact ? "line-clamp-2" : "line-clamp-3") : (compact ? "line-clamp-4" : "line-clamp-5")

  const body = (
    <div className="flex min-h-0 flex-1 flex-col p-[5px]">
      <p
        className={cn(
          "font-semibold text-foreground",
          compact ? "truncate text-xs leading-4" : "text-sm",
        )}
      >
        {testimonial.customer_name}
      </p>
      {rating > 0 ? (
        <div
          className="mt-1 flex gap-0.5 text-warning"
          aria-label={`${rating} dari 5 bintang`}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <Icon
              name="star"
              key={index}
              weight={index < rating ? "fill" : "regular"}
              className={compact ? "h-3 w-3" : "h-4 w-4"}
              aria-hidden="true"
            />
          ))}
        </div>
      ) : null}
      {message ? (
        <blockquote
          className={cn(
            "text-foreground",
            compact ? "mt-1.5 text-xs leading-5" : "mt-2 text-sm leading-6",
            clampLines,
          )}
        >
          “{message}”
        </blockquote>
      ) : null}
    </div>
  )

  const linkLabel = testimonial.product
    ? `Ulasan ${testimonial.customer_name}, lihat produk ${testimonial.product.name}`
    : `Ulasan ${testimonial.customer_name}`

  return (
    <article className={cardClassName}>
      {cardHref ? (
        <Link
          href={cardHref}
          className="flex min-h-0 min-w-0 flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={linkLabel}
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{body}</div>
      )}

      {hasImage ? (
        <button
          type="button"
          onClick={() => (onOpen ? onOpen() : setPreviewOpen(true))}
          className="group/img relative block h-20 w-full shrink-0 overflow-hidden bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Perbesar foto dari ${testimonial.customer_name}`}
        >
          <ResponsiveImage
            src={imageUrl}
            alt={imageAlt}
            wrapperClassName="size-full bg-surface-muted"
            className="size-full object-cover transition duration-300 group-hover/img:scale-[1.03]"
          />
          <span
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 transition duration-300 group-hover/img:bg-black/20 group-focus-visible/img:bg-black/20"
            aria-hidden="true"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition duration-300 group-hover/img:opacity-100 group-focus-visible/img:opacity-100">
              <Icon name="expand" weight="bold" className="h-5 w-5" aria-hidden="true" />
            </span>
          </span>
        </button>
      ) : null}

      {hasImage && !onOpen ? (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="!fixed !inset-0 !left-0 !top-0 z-modal !flex !h-dvh !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !gap-0 !overflow-hidden !rounded-none !border-0 !bg-black/95 !p-0 shadow-none" aria-describedby={undefined}>
            <DialogTitle className="sr-only">
              Foto ulasan dari {testimonial.customer_name}
            </DialogTitle>
            <img
              src={imageUrl ?? undefined}
              alt={imageAlt}
              className="mx-auto aspect-square max-h-[80dvh] w-auto max-w-full object-contain"
            />
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{testimonial.customer_name}</p>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </article>
  )
}
