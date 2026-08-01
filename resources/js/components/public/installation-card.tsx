import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { InstallationItem } from "@/types"

type MetaStat = {
  key: string
  icon?: "package" | "images" | "video"
  value: number
  label: string
}

function metaStats(item: InstallationItem, level: "model" | "product"): MetaStat[] {
  const products = Math.max(0, Number(item.product_count ?? 0))
  const photos = Math.max(0, Number(item.photo_count ?? 0))
  const videos = Math.max(0, Number(item.video_count ?? 0))

  if (level === "model") {
    const modelStats: MetaStat[] = [
      { key: "products", icon: "package", value: products, label: "produk" },
      { key: "photos", icon: "images", value: photos, label: "foto" },
      { key: "videos", icon: "video", value: videos, label: "video" },
    ]
    return modelStats
  }

  const stats: MetaStat[] = []
  if (photos > 0) stats.push({ key: "photos", icon: "images", value: photos, label: "foto" })
  if (videos > 0) stats.push({ key: "videos", icon: "video", value: videos, label: "video" })
  return stats
}

/**
 * Kartu Hasil Pemasangan.
 * - level=model: nama model + total produk / foto / video → masuk listing produk model
 * - level=product: nama produk + foto / video → galeri SKU
 */
export function InstallationCard({
  item,
  level = "model",
  className,
}: {
  item: InstallationItem
  level?: "model" | "product"
  className?: string
}) {
  const title = item.label?.trim() || "Hasil pemasangan"
  const href = item.href?.trim() || routeUrl("installation.index")
  const image = item.image ?? item.image_url ?? null
  const stats = metaStats(item, level)
  const hasVideo = Math.max(0, Number(item.video_count ?? 0)) > 0
  const external = href.startsWith("http://") || href.startsWith("https://")

  const body = (
    <>
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-surface-muted">
        <ResponsiveImage
          src={image}
          alt={title}
          wrapperClassName="aspect-square size-full bg-surface-muted"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        {hasVideo ? (
          <span
            className="absolute bottom-2.5 right-2.5 inline-flex size-9 items-center justify-center rounded-full border border-white/40 bg-foreground/80 text-background shadow-sm backdrop-blur-[1px]"
            aria-hidden="true"
          >
            <Icon name="play" className="size-4 translate-x-px" weight="fill" />
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 shrink-0 flex-col gap-1.5 bg-white px-2.5 py-2.5 @[16rem]:gap-2 @[16rem]:px-3 @[16rem]:py-3">
        <h3 className="w-full min-w-0 break-words text-[11px] font-normal leading-4 text-foreground line-clamp-2 @[16rem]:text-xs @[16rem]:leading-4 @[22rem]:text-xs @[22rem]:leading-4">
          {title}
        </h3>

        {stats.length ? (
          <ul
            className={cn(
              "w-full min-w-0",
              level === "model"
                ? "grid grid-cols-3 gap-1 border-t border-border/70 pt-1.5"
                : "flex flex-wrap items-center justify-start gap-x-2 gap-y-0.5 text-left",
            )}
            aria-label="Ringkasan dokumentasi"
          >
            {stats.map((stat) => (
              <li
                key={stat.key}
                className={cn(
                  "min-w-0 max-w-full",
                  level === "model"
                    ? "flex flex-col items-center justify-center gap-0.5 text-center"
                    : "inline-flex items-center justify-start gap-1",
                )}
                title={`${formatNumber(stat.value)} ${stat.label}`}
              >
                {stat.icon ? (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center text-primary/80",
                      level === "model"
                        ? "size-3.5"
                        : "size-4 rounded-full bg-white ring-1 ring-border/60",
                    )}
                  >
                    <Icon
                      name={stat.icon}
                      weight="bold"
                      className="size-2.5 @[16rem]:size-3"
                      aria-hidden="true"
                    />
                  </span>
                ) : null}
                <span
                  className={cn(
                    "min-w-0 font-light leading-none",
                    level === "model"
                      ? "whitespace-nowrap text-center text-[8px] @[16rem]:text-[9px]"
                      : "truncate text-left text-[10px] @[16rem]:text-[11px]",
                  )}
                >
                  <span className="tabular-nums font-normal text-primary">{formatNumber(stat.value)}</span>
                  {" "}
                  <span className="font-light text-muted-foreground">{stat.label}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  )

  return (
    <article
      className={cn(
        "@container group flex min-w-0 flex-col overflow-hidden border border-border bg-white shadow-[0_1px_3px_rgba(10,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-border/60 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {external ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Lihat ${title}`}
        >
          {body}
        </a>
      ) : (
        <Link
          href={href}
          className="flex min-w-0 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={
            level === "model"
              ? `Lihat produk hasil pemasangan model ${title}`
              : `Lihat galeri hasil pemasangan ${title}`
          }
        >
          {body}
        </Link>
      )}
    </article>
  )
}
