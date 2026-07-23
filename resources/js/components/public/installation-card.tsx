import { Link } from "@inertiajs/react"

import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { InstallationItem } from "@/types"

function mediaMeta(photoCount = 0, videoCount = 0): { primary: string; secondary?: string } | null {
  const photos = Math.max(0, photoCount)
  const videos = Math.max(0, videoCount)
  if (photos <= 0 && videos <= 0) {
    return null
  }

  if (photos > 0 && videos > 0) {
    return {
      primary: `${photos} Foto`,
      secondary: `${videos} Video`,
    }
  }

  if (photos > 0) {
    return { primary: `${photos} Foto` }
  }

  return { primary: `${videos} Video` }
}

/**
 * Kartu Hasil Pemasangan: layout sama dengan ModelCard.
 * Keterangan = total foto / video (bukan jumlah produk).
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
  const meta = mediaMeta(item.photo_count ?? 0, item.video_count ?? 0)

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
        aria-label={`Lihat galeri hasil pemasangan ${title}`}
      >
        <div className="aspect-square w-full shrink-0 overflow-hidden bg-[#fafafa]">
          <ResponsiveImage
            src={image}
            alt={title}
            wrapperClassName="aspect-square size-full bg-[#fafafa]"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </div>

        <div className="flex h-[5.75rem] shrink-0 flex-col gap-1 overflow-hidden bg-white px-2.5 py-2 @[16rem]:h-[6.5rem] @[16rem]:px-3 @[16rem]:py-2.5 @[20rem]:h-[7rem] @[20rem]:gap-1.5 @[20rem]:px-3.5 @[20rem]:py-2.5">
          <h3 className="line-clamp-2 text-xs font-medium leading-4 text-[#0a0a0a] @[16rem]:text-[13px] @[16rem]:leading-4 @[22rem]:text-sm @[22rem]:leading-5">
            {title}
          </h3>

          {meta ? (
            <p className="truncate text-[11px] font-light leading-snug @[16rem]:text-xs @[22rem]:text-[13px]">
              <span className="text-primary">{meta.primary}</span>
              {meta.secondary ? (
                <span className="text-[#0a0a0a]">
                  {" | "}
                  <span className="text-primary">{meta.secondary}</span>
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  )
}
