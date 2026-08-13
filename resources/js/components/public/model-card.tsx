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
  showDesc = true,
}: {
  model: ModelCardData
  /** @deprecated unused; kept for call-site compatibility */
  featured?: boolean
  /** Tampilkan deskripsi model (dimatikan di carousel Home agar kartu lebih kompak). */
  showDesc?: boolean
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
        prefetch
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

        <div className="flex shrink-0 flex-col gap-1 bg-white p-[5px] @[20rem]:gap-1.5">
          <h3 className="line-clamp-2 shrink-0 text-[13px] font-medium leading-snug text-foreground">
            {model.title}
          </h3>

          <p className="shrink-0 truncate text-xs font-light leading-snug @[16rem]:text-xs @[22rem]:text-[13px]">
            <span className="text-primary">{countLabel}</span>
            <span className="text-foreground">
              {" | "}
              {model.designs.length > 0 ? `${model.designs.length} model produk` : "Model katalog"}
            </span>
          </p>

          {showDesc && model.desc ? (
            <p className="line-clamp-2 text-xs font-normal leading-snug text-foreground @[16rem]:text-xs @[22rem]:text-[13px]">
              {model.desc}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  )
}
