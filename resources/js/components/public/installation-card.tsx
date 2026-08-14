import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { InstallationItem } from "@/types"

/**
 * Kartu Hasil Pemasangan (gaya Zalora):
 * gambar + badge merah jumlah produk + judul + divider + statistik foto/video + panah.
 * Dipakai di halaman Hasil Pemasangan dan carousel homepage.
 */
export function InstallationCard({
  item,
  className,
}: {
  item: InstallationItem
  className?: string
}) {
  const title = item.label?.trim() || "Hasil pemasangan"
  const href = item.href?.trim() || routeUrl("installation.index")
  const image = item.image ?? item.image_url ?? null
  const productCount = Math.max(0, Number(item.product_count ?? 0))
  const photoCount = Math.max(0, Number(item.photo_count ?? 0))
  const videoCount = Math.max(0, Number(item.video_count ?? 0))
  const external = href.startsWith("http://") || href.startsWith("https://")

  const body = (
    <>
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-[#f7f8f8]">
        <ResponsiveImage
          src={image}
          alt={title}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {productCount > 0 ? (
          <span className="absolute bottom-2 left-2 rounded-[4px] bg-[#c20000] px-2 py-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
            {formatNumber(productCount)} produk
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        <h3 className="line-clamp-2 shrink-0 text-[13px] font-semibold leading-snug text-[#333333]">
          {title}
        </h3>
        <div className="flex-1" aria-hidden="true" />
        <div className="h-px w-full bg-[#dee3e0]" aria-hidden="true" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] leading-snug text-[#666666]">
              <Icon name="images" className="size-3 shrink-0" aria-hidden="true" />
              {formatNumber(photoCount)} foto
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] leading-snug text-[#666666]">
              <Icon name="video" className="size-3 shrink-0" aria-hidden="true" />
              {formatNumber(videoCount)} video
            </span>
          </div>
          <Icon name="arrow-up-right" className="size-3.5 shrink-0 text-[#333333]" aria-hidden="true" />
        </div>
      </div>
    </>
  )

  return (
    <article
      className={cn(
        "group flex h-full min-w-0 flex-col overflow-hidden rounded-[5px] border border-[#dee3e0] bg-white transition-colors duration-200 hover:border-[#b9c2bd]",
        className,
      )}
    >
      {external ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="flex h-full min-w-0 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Lihat ${title}`}
        >
          {body}
        </a>
      ) : (
        <Link
          href={href}
          className="flex h-full min-w-0 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </Link>
      )}
    </article>
  )
}
