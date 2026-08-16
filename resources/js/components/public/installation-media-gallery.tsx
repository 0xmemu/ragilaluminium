import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { InstallationLightbox, type InstallationLightboxItem } from "@/components/public/installation-lightbox"
import { ResponsiveImage } from "@/components/ui/responsive-image"

export function InstallationMediaGallery({
  items,
  title,
}: {
  items: InstallationLightboxItem[]
  title: string
}) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const [loadedVideoIds, setLoadedVideoIds] = React.useState<Set<number>>(() => new Set())

  if (!items.length) return null

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Galeri hasil pemasangan">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveIndex(index)
              setOpen(true)
            }}
            className="group relative aspect-square overflow-hidden bg-surface-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Perbesar ${item.is_video ? "video" : "foto"} ${index + 1}`}
          >
            {item.is_video ? (
              <>
                <video
                  src={item.thumb ?? item.url}
                  muted
                  playsInline
                  preload="metadata"
                  className="size-full object-cover"
                  onLoadedData={() =>
                    setLoadedVideoIds((current) => new Set(current).add(item.id))
                  }
                  onError={() =>
                    setLoadedVideoIds((current) => new Set(current).add(item.id))
                  }
                />
                {!loadedVideoIds.has(item.id) ? (
                  <span
                    className="pointer-events-none absolute inset-0 z-10 skeleton-shimmer bg-muted"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="absolute inset-0 z-20 flex items-center justify-center bg-black/15 text-white">
                  <Icon name="play" weight="fill" className="size-8 drop-shadow" aria-hidden />
                </span>
              </>
            ) : (
              <ResponsiveImage src={item.thumb ?? item.url} alt="" wrapperClassName="absolute inset-0 size-full !aspect-auto" className="object-cover transition duration-200 group-hover:scale-[1.02]" />
            )}
          </button>
        ))}
      </div>
      <InstallationLightbox
        open={open}
        onOpenChange={setOpen}
        items={items}
        index={activeIndex}
        onIndexChange={setActiveIndex}
        productName={title}
      />
    </>
  )
}
