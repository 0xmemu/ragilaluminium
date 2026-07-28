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
    return [
      { key: "products", icon: "package", value: products, label: "produk" },
      { key: "photos", icon: "images", value: photos, label: "foto" },
      { key: "videos", icon: "video", value: videos, label: "video" },
    ]
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
  const external = href.startsWith("http://") || href.startsWith("https://")

  const body = (
    <>
      <div className="aspect-square w-full shrink-0 overflow-hidden bg-surface-muted">
        <ResponsiveImage
          src={image}
          alt={title}
          wrapperClassName="aspect-square size-full bg-surface-muted"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 bg-white px-3 py-3 @[16rem]:gap-3 @[16rem]:px-3.5 @[16rem]:py-3.5">
        <h3 className="line-clamp-2 text-xs font-semibold leading-4 text-foreground @[16rem]:text-[13px] @[16rem]:leading-4 @[22rem]:text-sm @[22rem]:leading-5">
          {title}
        </h3>

        {stats.length ? (
          <ul
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold leading-none text-primary @[16rem]:gap-x-3.5 @[16rem]:text-[15px] @[22rem]:text-base"
            aria-label="Ringkasan dokumentasi"
          >
            {stats.map((stat) => (
              <li key={stat.key} className="inline-flex items-center gap-1.5">
                {stat.icon ? (
                  <Icon
                    name={stat.icon}
                    weight="bold"
                    className="size-5 shrink-0 @[22rem]:size-6"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="tabular-nums">
                  {formatNumber(stat.value)}
                  <span className="sr-only"> {stat.label}</span>
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
