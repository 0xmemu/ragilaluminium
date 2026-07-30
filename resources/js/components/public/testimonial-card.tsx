import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
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
  const rating = Math.max(0, Math.min(5, testimonial.rating ?? 0))
  const cardHref = href ?? testimonial.product?.href ?? null
  const isScreenshot = variant === "screenshot"
  const message = (testimonial.message ?? "").trim()
  const hasImage = Boolean(testimonial.image_url)
  const cardClassName = cn(
    "flex h-full break-inside-avoid flex-col overflow-hidden border border-border bg-surface shadow-[0_1px_3px_rgba(10,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    cardHref ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" : null,
  )

  const body = (
    <>
      {hasImage ? (
        <ResponsiveImage
          src={testimonial.image_url!}
          alt={
            isScreenshot
              ? `Screenshot dari ${testimonial.customer_name}`
              : `Ulasan dari ${testimonial.customer_name}`
          }
          wrapperClassName={cn(
            "bg-[#fafafa]",
            isScreenshot ? "aspect-[4/5] sm:aspect-square" : "aspect-square",
          )}
        />
      ) : null}
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
    </>
  )

  if (cardHref) {
    return (
      <Link
        href={cardHref}
        className={cardClassName}
        aria-label={
          testimonial.product
            ? `Ulasan ${testimonial.customer_name}, lihat produk ${testimonial.product.name}`
            : `Ulasan ${testimonial.customer_name}`
        }
      >
        {body}
      </Link>
    )
  }

  return <article className={cardClassName}>{body}</article>
}
