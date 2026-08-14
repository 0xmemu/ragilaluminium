import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import type { InstallationItem } from "@/types"

/**
 * Model summary for Hasil Pemasangan. Media remains in the gallery below.
 */
export function InstallationFeaturedCard({
  item,
  className,
}: {
  item: InstallationItem
  className?: string
}) {
  const title = item.label?.trim() || "Hasil pemasangan"
  const image = item.image ?? item.image_url ?? null
  const highlights = (item.highlights ?? []).slice(0, 3)
  return (
    <article className={cn("w-full", className)}>
      <div className="md:grid md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start md:gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
        <div className="relative mx-auto aspect-square w-full max-w-[22rem] overflow-hidden bg-surface-muted md:mx-0 md:max-w-none">
          <ResponsiveImage src={image} alt={title} wrapperClassName="absolute inset-0 size-full !aspect-auto bg-surface-muted" className="object-cover" />
        </div>
        <div className="min-w-0 pt-5 md:pt-0">
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[1.75rem] lg:text-3xl">{title}</h2>
          {item.desc ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-4 sm:text-[15px] sm:leading-7">{item.desc}</p> : null}
          {highlights.length ? (
            <ul className="mt-6 grid grid-cols-3 gap-2.5 sm:mt-8 sm:gap-3" aria-label="Keunggulan model">
              {highlights.map((highlight) => (
                <li key={highlight.label} className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2.5 rounded-xl border border-border bg-white px-2.5 py-4 text-center sm:min-h-[6.25rem] sm:gap-3 sm:px-3 sm:py-5">
                  <Icon name={highlight.icon} weight="regular" className="size-7 text-foreground sm:size-8" aria-hidden />
                  <span className="text-xs font-medium leading-snug text-foreground/85">{highlight.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
                  </div>
      </div>
    </article>
  )
}
