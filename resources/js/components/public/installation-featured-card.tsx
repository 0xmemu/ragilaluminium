import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
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
  const photoCount = Math.max(0, Number(item.photo_count ?? 0))
  const videoCount = Math.max(0, Number(item.video_count ?? 0))
  const mediaCount = photoCount + videoCount

  const categoryLabel =
    item.category?.toUpperCase() === "DOOR"
      ? "Pintu"
      : item.category?.toUpperCase() === "BOUVEN"
        ? "Boven"
        : item.category?.toUpperCase() === "LAINNYA"
          ? "Lainnya"
          : item.category
            ? "Jendela"
            : null

  const specs = [
    categoryLabel ? { label: "Kategori", value: categoryLabel } : null,
    item.model
      ? {
          label: "Model",
          value: item.model.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
        }
      : null,
    Number(item.product_count ?? 0) > 0
      ? { label: "Produk", value: `${formatNumber(item.product_count)} produk` }
      : null,
    mediaCount > 0
      ? {
          label: "Media",
          value:
            videoCount > 0 && photoCount > 0
              ? `${formatNumber(photoCount)} foto � ${formatNumber(videoCount)} video`
              : videoCount > 0
                ? `${formatNumber(videoCount)} video`
                : `${formatNumber(photoCount)} foto`,
        }
      : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row?.value))

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
                  <span className="text-[10px] font-medium leading-snug text-foreground/85 sm:text-xs">{highlight.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {specs.length ? (
            <aside className="mt-6 border-t border-border pt-5 sm:mt-8 sm:pt-6">
              <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">Spesifikasi Unit</h3>
              <dl className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-3">
                {specs.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 text-right font-semibold text-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          ) : null}
        </div>
      </div>
    </article>
  )
}
