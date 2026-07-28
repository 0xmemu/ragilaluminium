import { Link } from "@inertiajs/react"

import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import type { ModelCardData } from "@/types"

/**
 * Tipografi mengikuti lebar card (container query), bukan viewport.
 * Acuan "pas" = card homepage ~4 kolom (~16–22rem): judul 13px, meta/desc 12px.
 * Klik membuka halaman detail model (`detail_href`), bukan popup.
 */
export function ModelCard({
  model,
  className,
}: {
  model: ModelCardData
  /** @deprecated unused; kept for call-site compatibility */
  featured?: boolean
  className?: string
}) {
  const countLabel = model.count.trim().toLowerCase().endsWith("produk")
    ? model.count
    : `${model.count} produk`
  const href = model.detail_href?.trim() || model.href

  return (
    <article
      className={cn(
        "@container group flex h-full min-w-0 flex-col overflow-hidden border border-border bg-white shadow-[0_1px_3px_rgba(10,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-border/60 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <Link
        href={href}
        className="flex h-full min-w-0 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="aspect-square w-full shrink-0 overflow-hidden bg-surface-muted">
          <ResponsiveImage
            src={model.image}
            alt={model.title}
            wrapperClassName="aspect-square size-full bg-surface-muted"
            className="transition duration-300 group-hover:scale-[1.03]"
          />
        </div>

        <div className="flex h-[5.75rem] shrink-0 flex-col gap-1 overflow-hidden bg-white px-2.5 py-2 @[16rem]:h-[6.5rem] @[16rem]:px-3 @[16rem]:py-2.5 @[20rem]:h-[7rem] @[20rem]:gap-1.5 @[20rem]:px-3.5 @[20rem]:py-2.5">
          <h3 className="line-clamp-2 text-xs font-medium leading-4 text-foreground @[16rem]:text-[13px] @[16rem]:leading-4 @[22rem]:text-sm @[22rem]:leading-5">
            {model.title}
          </h3>

          <p className="truncate text-[11px] font-light leading-snug @[16rem]:text-xs @[22rem]:text-[13px]">
            <span className="text-primary">{countLabel}</span>
            {model.meta ? (
              <span className="text-foreground">
                {" | "}
                {model.meta}
              </span>
            ) : null}
          </p>

          {model.desc ? (
            <p className="line-clamp-2 text-[11px] font-normal leading-snug text-foreground @[16rem]:text-xs @[22rem]:text-[13px]">
              {model.desc}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  )
}
