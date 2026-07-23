import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { humanize } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Testimonial } from "@/types"

export function TestimonialCard({
  testimonial,
  compact = false,
  href,
}: {
  testimonial: Testimonial
  compact?: boolean
  /** Jika diisi, seluruh card menjadi link. Default: produk terkait (jika ada). */
  href?: string | null
}) {
  const rating = Math.max(0, Math.min(5, testimonial.rating ?? 0))
  const cardHref = href ?? testimonial.product?.href ?? null
  const cardClassName = cn(
    "flex h-full break-inside-avoid flex-col overflow-hidden border border-border bg-surface shadow-[0_1px_3px_rgba(10,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    cardHref ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" : null,
  )

  const body = (
    <>
      {!compact && testimonial.image_url ? (
        <ResponsiveImage
          src={testimonial.image_url}
          alt={`Hasil pemasangan dari ${testimonial.customer_name}`}
          wrapperClassName="aspect-square bg-[#fafafa]"
        />
      ) : null}
      <div className={cn("flex flex-1 flex-col", compact ? "p-4" : "p-5 sm:p-6")}>
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
                className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
                aria-hidden="true"
              />
            ))}
          </div>
        ) : null}
        <blockquote
          className={cn(
            "text-foreground",
            compact
              ? "mt-3 line-clamp-4 text-sm leading-6"
              : "mt-5 text-base leading-7",
          )}
        >
          “{testimonial.message}”
        </blockquote>
        <div
          className={cn(
            "flex items-end justify-between gap-4 border-t border-border",
            compact ? "mt-auto pt-3" : "mt-6 pt-4",
          )}
        >
          <div>
            <p className="text-sm font-semibold text-foreground">{testimonial.customer_name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {[testimonial.location, testimonial.source ? humanize(testimonial.source) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {testimonial.product ? (
            <span className="shrink-0 text-xs font-semibold text-primary">Lihat produk</span>
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
