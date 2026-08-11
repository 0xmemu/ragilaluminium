import * as React from "react"

import { GalleryLightbox } from "@/components/public/gallery-lightbox"
import { Icon } from "@/components/shared/icon"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import type { ProductMedia } from "@/types"

/**
 * Galeri produk: strip horizontal sejajar dengan swipe real-time, thumbnail,
 * panah prev/next, dan lightbox. Semua state galeri (index, drag, lightbox)
 * hidup di sini — ProductDetail cukup mengirim `items` + judul.
 */
export function ProductGallery({
  items,
  title,
  onActiveMediaChange,
}: {
  items: ProductMedia[]
  title: string
  /** Lapor media yang sedang dilihat ke parent (dipakai animasi fly saat add-to-cart). */
  onActiveMediaChange?: (media: ProductMedia | null) => void
}) {
  const [activeMediaIndex, setActiveMediaIndex] = React.useState(0)
  const [lightboxIndex, setLightboxIndex] = React.useState(-1)

  const lightboxItems = React.useMemo(
    () =>
      items
        .filter((item) => Boolean(item.url))
        .map((item) => ({ src: item.url!, alt: `${title}, foto ${item.id}` })),
    [items, title],
  )

  // Swipe galeri — pakai touch events native + drag real-time.
  const [galleryDrag, setGalleryDrag] = React.useState(0)
  const [galleryDragging, setGalleryDragging] = React.useState(false)
  const galleryStartX = React.useRef(0)
  const [galleryWidth, setGalleryWidth] = React.useState(0)
  const galleryRef = React.useRef<HTMLDivElement>(null)
  const didSwipe = React.useRef(false)

  function onGalleryTouchStart(event: React.TouchEvent) {
    if (items.length <= 1) return
    const t = event.touches[0]
    galleryStartX.current = t.clientX
    setGalleryWidth(galleryRef.current?.clientWidth ?? 0)
    didSwipe.current = false
    setGalleryDragging(true)
    setGalleryDrag(0)
  }

  function onGalleryTouchMove(event: React.TouchEvent) {
    if (!galleryDragging) return
    const dx = event.touches[0].clientX - galleryStartX.current
    if (Math.abs(dx) > 8) didSwipe.current = true
    setGalleryDrag(dx)
  }

  function onGalleryTouchEnd() {
    if (!galleryDragging) return
    setGalleryDragging(false)
    const threshold = galleryWidth * 0.2
    if (Math.abs(galleryDrag) > threshold) {
      moveGallery(galleryDrag < 0 ? 1 : -1)
    }
    setGalleryDrag(0)
  }

  function moveGallery(direction: -1 | 1) {
    setActiveMediaIndex((current) => {
      const next = current + direction
      return Math.min(Math.max(next, 0), items.length - 1)
    })
  }

  const activeMedia = items[activeMediaIndex] ?? items[0] ?? null

  React.useEffect(() => {
    onActiveMediaChange?.(activeMedia)
  }, [activeMedia, onActiveMediaChange])

  React.useEffect(() => {
    if (activeMediaIndex >= items.length) {
      // Clamp saat varian terpilih punya lebih sedikit foto.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveMediaIndex(Math.max(0, items.length - 1))
    }
  }, [activeMediaIndex, items.length])

  return (
    <div className="group/gallery min-w-0" aria-label="Galeri produk">
      {activeMedia ? (
        <>
          <div
            ref={galleryRef}
            onTouchStart={onGalleryTouchStart}
            onTouchMove={onGalleryTouchMove}
            onTouchEnd={onGalleryTouchEnd}
            onTouchCancel={onGalleryTouchEnd}
            className="relative mx-auto aspect-square w-full overflow-hidden bg-white"
          >
            <button
              type="button"
              onClick={() => window.history.back()}
              className="absolute left-3 top-3 z-20 flex size-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>

            {/* Horizontal strip: semua gambar sejajar — swipe real-time */}
            <div
              className="flex h-full touch-pan-y"
              onClick={(event) => {
                if (!didSwipe.current && event.target === event.currentTarget) setLightboxIndex(activeMediaIndex)
              }}
              style={{
                transform: `translateX(${-activeMediaIndex * 100 + (galleryWidth ? (galleryDrag / galleryWidth) * 100 : 0)}%)`,
                transition: galleryDragging ? 'none' : 'transform 320ms cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              {items.map((item, index) => (
                <div key={item.id} className="flex h-full w-full shrink-0 items-center justify-center bg-white">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!didSwipe.current) setLightboxIndex(index)
                    }}
                    className="relative size-full select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-label={`Perbesar foto produk ${index + 1}`}
                  >
                    <ResponsiveImage
                      src={item.url}
                      alt={`${title}, foto ${index + 1}`}
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : undefined}
                      wrapperClassName="size-full bg-white"
                      className="!object-contain"
                    />
                  </button>
                </div>
              ))}
            </div>

            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => moveGallery(-1)}
                  disabled={activeMediaIndex === 0}
                  aria-label="Lihat foto sebelumnya"
                  className="absolute left-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#525252] text-white opacity-100 shadow-md transition-[opacity,background-color] hover:bg-[#303030] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed md:-left-14 md:flex md:size-12 md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100 md:group-hover/gallery:disabled:opacity-35 md:group-focus-within/gallery:disabled:opacity-35"
                >
                  <Icon name="arrow-left" className="size-6" weight="bold" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveGallery(1)}
                  disabled={activeMediaIndex === items.length - 1}
                  aria-label="Lihat foto berikutnya"
                  className="absolute right-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#525252] text-white opacity-100 shadow-md transition-[opacity,background-color] hover:bg-[#303030] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed md:-right-14 md:flex md:size-12 md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100 md:group-hover/gallery:disabled:opacity-35 md:group-focus-within/gallery:disabled:opacity-35"
                >
                  <Icon name="arrow-right" className="size-6" weight="bold" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>

          {items.length > 1 ? (
            <div
              className="scrollbar-x mt-2 flex snap-x gap-2 overflow-x-auto px-0 pb-2 sm:mt-3 sm:justify-center"
              aria-label="Pilih foto produk"
            >
              {items.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setActiveMediaIndex(index)}
                  aria-label={`Tampilkan foto ${index + 1}`}
                  aria-current={activeMediaIndex === index ? "true" : undefined}
                  className={cn(
                    "relative size-14 shrink-0 snap-start overflow-hidden border-2 bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:size-16",
                    activeMediaIndex === index
                      ? "border-foreground"
                      : "border-transparent hover:border-border",
                  )}
                >
                  <ResponsiveImage
                    src={item.thumb ?? item.url}
                    alt=""
                    wrapperClassName="size-full bg-white"
                    className="object-contain"
                  />
                </button>
              ))}
            </div>
          ) : null}

          <p className="sr-only" aria-live="polite">
            Foto {activeMediaIndex + 1} dari {items.length}
          </p>
        </>
      ) : (
        <EmptyState
          icon="image"
          title="Foto belum tersedia"
          description="Foto produk akan tampil setelah media selesai diunggah."
        />
      )}

      {lightboxItems.length ? (
        <GalleryLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onOpenChange={(open) => { if (!open) setLightboxIndex(-1) }}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </div>
  )
}
