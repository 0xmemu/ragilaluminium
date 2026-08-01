import { Link } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { humanize } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Testimonial } from "@/types"

const SOURCE_LABELS: Record<string, string> = {
  shopee: "Marketplace / Shopee",
  whatsapp: "WhatsApp",
  website: "Website",
  other: "Lainnya",
}

function sourceLabel(source?: string | null): string | null {
  if (!source) return null
  return SOURCE_LABELS[source] ?? humanize(source)
}

export function TestimonialCard({
  testimonial,
  compact = false,
  href,
  variant = "review",
}: {
  testimonial: Testimonial
  compact?: boolean
  /** Jika diisi, seluruh card menjadi link. Default: produk terkait (jika ada). */
  href?: string | null
  /** `screenshot` = image-forward (marketplace/WA); `review` = teks+rating. */
  variant?: "review" | "screenshot"
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const rating = Math.max(0, Math.min(5, testimonial.rating ?? 0))
  const cardHref = href ?? testimonial.product?.href ?? null
  const isScreenshot = variant === "screenshot"
  const message = (testimonial.message ?? "").trim()
  const hasImage = Boolean(testimonial.image_url)
  const imageUrl = testimonial.image_url ?? null
  const imageAlt = isScreenshot
    ? `Screenshot dari ${testimonial.customer_name}`
    : `Hasil pemasangan dari ${testimonial.customer_name}`

  const cardClassName = cn(
    "@container group flex h-full min-w-0 flex-col overflow-hidden border border-border bg-white shadow-[0_1px_3px_rgba(10,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-border/60 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    cardHref ? "cursor-pointer" : null,
  )

  const body = (
    <div className={cn("flex flex-1 flex-col", compact ? "p-3" : "p-5 sm:p-6")}>
      {rating > 0 ? (
        <div
          className="flex gap-0.5 text-warning"
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
            compact
              ? "mt-2 line-clamp-4 text-xs leading-5"
              : isScreenshot
                ? "mt-3 line-clamp-3 text-sm leading-6"
                : "mt-5 text-base leading-7",
          )}
        >
          “{message}”
        </blockquote>
      ) : null}
      <div
        className={cn(
          "border-t border-border",
          compact
            ? "mt-auto flex flex-col gap-1.5 pt-2.5"
            : "mt-auto flex items-end justify-between gap-4 pt-4",
          !message && !rating ? "border-t-0 pt-0" : null,
          !message && rating > 0 ? "mt-3" : null,
          message && !compact ? (isScreenshot ? "mt-4" : "mt-6") : null,
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold text-foreground",
              compact ? "truncate text-xs leading-4" : "text-sm",
            )}
          >
            {testimonial.customer_name}
          </p>
          <p
            className={cn(
              "text-muted-foreground",
              compact ? "mt-0.5 truncate text-[11px] leading-4" : "mt-1 text-xs",
            )}
          >
            {[testimonial.location, sourceLabel(testimonial.source)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {testimonial.product ? (
          <span
            className={cn(
              "font-semibold text-primary",
              compact ? "text-[11px] leading-4" : "shrink-0 text-xs",
            )}
          >
            Lihat produk
          </span>
        ) : null}
      </div>
    </div>
  )

  const linkLabel = testimonial.product
    ? `Ulasan ${testimonial.customer_name}, lihat produk ${testimonial.product.name}`
    : `Ulasan ${testimonial.customer_name}`

  return (
    <article className={cardClassName}>
      {hasImage ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="group/img relative block w-full shrink-0 overflow-hidden bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Perbesar ${isScreenshot ? "screenshot" : "foto"} dari ${testimonial.customer_name}`}
        >
          <div className="aspect-[4/3] w-full overflow-hidden">
            <ResponsiveImage
              src={imageUrl}
              alt={imageAlt}
              wrapperClassName="aspect-[4/3] size-full bg-surface-muted"
              className="object-cover transition duration-300 group-hover/img:scale-[1.03]"
            />
          </div>
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

      {cardHref ? (
        <Link
          href={cardHref}
          className="flex min-w-0 flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={linkLabel}
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col">{body}</div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[min(calc(100%-2rem),56rem)] gap-4 p-4 sm:p-6">
          <DialogTitle className="sr-only">
            {isScreenshot ? "Screenshot" : "Foto hasil pemasangan"} dari {testimonial.customer_name}
          </DialogTitle>
          <img
            src={imageUrl ?? undefined}
            alt={imageAlt}
            className="mx-auto max-h-[80dvh] w-auto max-w-full rounded object-contain"
          />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">{testimonial.customer_name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {[testimonial.location, sourceLabel(testimonial.source)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  )
}
