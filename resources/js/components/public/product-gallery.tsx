import * as React from "react"

import { GalleryLightbox } from "@/components/public/gallery-lightbox"
import { Icon } from "@/components/shared/icon"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import type { ProductMedia } from "@/types"

/** Sub-komponen Video Galeri: autoplay saat aktif, pause & resume detik terakhir saat berganti */
function GalleryVideoItem({
  item,
  title,
  index,
  isActive,
  onOpenLightbox,
}: {
  item: ProductMedia
  title: string
  index: number
  isActive: boolean
  onOpenLightbox: () => void
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const savedTimeRef = React.useRef(0)

  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isActive) {
      if (savedTimeRef.current > 0 && Math.abs(video.currentTime - savedTimeRef.current) > 0.5) {
        video.currentTime = savedTimeRef.current
      }
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Fallback bila browser blokir audio autoplay
          video.muted = true
          video.play().catch(() => {})
        })
      }
    } else {
      if (!video.paused) {
        savedTimeRef.current = video.currentTime
        video.pause()
      }
    }
  }, [isActive])

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      savedTimeRef.current = videoRef.current.currentTime
    }
  }

  return (
    <div className="relative size-full bg-white flex items-center justify-center">
      <video
        ref={videoRef}
        src={item.url ?? undefined}
        poster={item.thumb ?? undefined}
        playsInline
        muted
        loop
        onTimeUpdate={handleTimeUpdate}
        className="size-full bg-white object-contain"
      />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onOpenLightbox()
        }}
        className="absolute inset-0 z-10 size-full select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={`Perbesar video produk ${index + 1}`}
      />
    </div>
  )
}

/**
 * Galeri produk: strip horizontal sejajar dengan swipe real-time, thumbnail,
 * panah prev/next, dan lightbox. Semua state galeri (index, drag, lightbox)
 * hidup di sini - ProductDetail cukup mengirim `items` + judul.
 */
export function ProductGallery({
  items,
  title,
  onActiveMediaChange,
  highlightedMediaId,
}: {
  items: ProductMedia[]
  title: string
  /** Lapor media yang sedang dilihat ke parent (dipakai animasi fly saat add-to-cart). */
  onActiveMediaChange?: (media: ProductMedia | null) => void
  /** Foto varian yang ditonjolkan (urutan galeri TIDAK diubah). */
  highlightedMediaId?: string | number | null
}) {
  const [activeMediaIndex, setActiveMediaIndex] = React.useState(0)
  const [lightboxIndex, setLightboxIndex] = React.useState(-1)
  // Strip carousel mobile (plan rev 4): 5 thumb terlihat penuh, geser per
  // thumb, main image = thumb yang baru masuk, chip +N dinamis dua arah.
  const VISIBLE_THUMBS = 3
  const STRIP_GAP = 8
  const STRIP_PAD = 10
  const [leftVisibleIndex, setLeftVisibleIndex] = React.useState(0)
  const leftVisibleIndexRef = React.useRef(0)
  leftVisibleIndexRef.current = leftVisibleIndex
  const stripRef = React.useRef<HTMLDivElement>(null)
  const stripScrollProgrammatic = React.useRef(false)
  const stripProgrammaticTimer = React.useRef<number | undefined>(undefined)
  const userStripScrollAt = React.useRef(0)
  const stripSnapTimer = React.useRef<number | undefined>(undefined)

  // Lebar thumbnail dihitung langsung via CSS calc((100% - 32px) / 5)
  // 100% di dalam kontainer flex dengan padding px-2.5 adalah inner width.
  // 5 kartu * w + 4 gap (32px) = persis 100% inner width, thumb ke-6 berada 0px di luar batas view.
  const visibleCount = Math.min(VISIBLE_THUMBS, items.length)
  const maxLeftVisibleIndex = Math.max(0, items.length - visibleCount)
  const leftHidden = leftVisibleIndex
  const rightHidden = Math.max(0, items.length - (leftVisibleIndex + VISIBLE_THUMBS))
  const lightboxItems = React.useMemo(
    () =>
      items
        .filter((item) => Boolean(item.url))
        .map((item) => ({
          src: item.url!,
          alt: `${title}, ${item.is_video ? "video" : "foto"} ${item.id}`,
          is_video: Boolean(item.is_video),
        })),
    [items, title],
  )

  // Swipe galeri - pakai touch events native + drag real-time.
  const [galleryDrag, setGalleryDrag] = React.useState(0)
  const [galleryDragging, setGalleryDragging] = React.useState(false)
  const galleryStartX = React.useRef(0)
  const [galleryWidth, setGalleryWidth] = React.useState(0)
  const galleryRef = React.useRef<HTMLDivElement>(null)
  const didSwipe = React.useRef(false)

  // Ref untuk drag real-time TANPA setState per frame (re-render per move bikin jank).
  const galleryDragRef = React.useRef(0)
  const galleryTrackRef = React.useRef<HTMLDivElement | null>(null)
  const galleryLastX = React.useRef(0)
  const galleryLastT = React.useRef(0)
  const galleryVelocity = React.useRef(0)

  /** Terapkan transform langsung ke DOM: drag + damping di ujung kiri/kanan. */
  function applyGalleryTransform(dx: number) {
    const track = galleryTrackRef.current
    if (!track) return
    const atStart = activeMediaIndex === 0
    const atEnd = activeMediaIndex === items.length - 1
    let effective = dx
    if ((atStart && dx > 0) || (atEnd && dx < 0)) {
      // Rubber-band: 1/3 dari jarak di ujung.
      effective = dx / 3
    }
    const base = -(activeMediaIndex * 100)
    const pct = galleryWidth ? (effective / galleryWidth) * 100 : 0
    track.style.transform = `translateX(calc(${base}% + ${pct}%))`
  }

  function onGalleryTouchStart(event: React.TouchEvent) {
    if (items.length <= 1) return
    const t = event.touches[0]
    galleryStartX.current = t.clientX
    galleryLastX.current = t.clientX
    galleryLastT.current = performance.now()
    galleryVelocity.current = 0
    setGalleryWidth(galleryRef.current?.clientWidth ?? 0)
    didSwipe.current = false
    setGalleryDragging(true)
    setGalleryDrag(0)
    galleryDragRef.current = 0
    if (galleryTrackRef.current) galleryTrackRef.current.style.transition = 'none'
  }

  function onGalleryTouchMove(event: React.TouchEvent) {
    if (!galleryDragging) return
    const dx = event.touches[0].clientX - galleryStartX.current
    if (Math.abs(dx) > 8) didSwipe.current = true
    galleryDragRef.current = dx
    // velocity px/ms untuk deteksi flick
    const now = performance.now()
    const dt = now - galleryLastT.current
    if (dt > 0) {
      galleryVelocity.current = (event.touches[0].clientX - galleryLastX.current) / dt
      galleryLastX.current = event.touches[0].clientX
      galleryLastT.current = now
    }
    applyGalleryTransform(dx)
  }

  function onGalleryTouchEnd() {
    if (!galleryDragging) return
    setGalleryDragging(false)
    const dx = galleryDragRef.current
    const threshold = galleryWidth * 0.2
    // Flick: geser cepat (|v| > 0.5 px/ms) dengan jarak minimal 24px tetap pindah.
    const flick = Math.abs(galleryVelocity.current) > 0.5 && Math.abs(dx) > 24
    const isNext = (galleryDrag < 0 || dx < 0)
    const canMove = isNext ? activeMediaIndex < items.length - 1 : activeMediaIndex > 0

    if (galleryTrackRef.current) {
      galleryTrackRef.current.style.transition = 'transform 320ms cubic-bezier(0.22,1,0.36,1)'
    }

    if ((Math.abs(dx) > threshold || flick) && canMove) {
      moveGallery(isNext ? 1 : -1)
    } else {
      // Kembali / mental balik (snap back) ke foto aktif dengan transisi halus.
      applyGalleryTransform(0)
    }
    setGalleryDrag(0)
    galleryDragRef.current = 0
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

  // Pindah foto saat highlightedMediaId berubah (opsional, sebagai pelengkap).
  const prevHighlightedId = React.useRef<string | number | null | undefined>(undefined)
  React.useEffect(() => {
    if (highlightedMediaId !== prevHighlightedId.current) {
      prevHighlightedId.current = highlightedMediaId
      if (highlightedMediaId != null) {
        const idx = items.findIndex((item) => item.id === highlightedMediaId)
        if (idx !== -1) {
          setActiveMediaIndex(idx)
        }
      }
    }
  }, [highlightedMediaId, items])

  // Scroll strip: update index terlihat untuk badge +N tanpa merubah foto utama.
  const onStripScroll = () => {
    const strip = stripRef.current
    if (!strip) return
    userStripScrollAt.current = Date.now()
    const firstBtn = strip.querySelector("button")
    if (!firstBtn) return
    const step = firstBtn.getBoundingClientRect().width + STRIP_GAP
    if (step <= 0) return
    const rawIndex = Math.round(strip.scrollLeft / step)
    const candidateIndex = Math.max(0, Math.min(rawIndex, maxLeftVisibleIndex))
    if (candidateIndex !== leftVisibleIndexRef.current) {
      leftVisibleIndexRef.current = candidateIndex
      setLeftVisibleIndex(candidateIndex)
    }
  }

  // Programmatic scroll helper (plan 6.1): flag bertahan 600ms agar sisa event
  // scroll animasi tidak dianggap gesture user (akar cascade lama).
  const scrollStripToIndex = React.useCallback((targetIndex: number) => {
    const strip = stripRef.current
    if (!strip) return
    const firstBtn = strip.querySelector("button")
    if (!firstBtn) return
    const step = firstBtn.getBoundingClientRect().width + STRIP_GAP
    if (step <= 0) return
    const target = Math.max(0, Math.min(targetIndex, maxLeftVisibleIndex))
    stripScrollProgrammatic.current = true
    if (stripProgrammaticTimer.current) {
      window.clearTimeout(stripProgrammaticTimer.current)
    }
    strip.scrollTo({ left: target * step, behavior: "smooth" })
    stripProgrammaticTimer.current = window.setTimeout(() => {
      stripScrollProgrammatic.current = false
    }, 600)
  }, [maxLeftVisibleIndex])

  // Sinkronisasi dua arah (plan 7): main image berubah (swipe main / tap
  // thumb / ganti varian) -> bawa window strip agar thumb aktif tampak.
  // Guard 400ms: jangan melawan gesture user yang masih berlangsung (plan 7.4).
  React.useEffect(() => {
    if (Date.now() - userStripScrollAt.current < 400) return
    const strip = stripRef.current
    if (!strip) return
    const firstBtn = strip.querySelector("button")
    if (!firstBtn) return
    const step = firstBtn.getBoundingClientRect().width + STRIP_GAP
    if (step <= 0) return
    const targetLeftIndex = Math.max(0, Math.min(
      activeMediaIndex < leftVisibleIndex
        ? activeMediaIndex
        : activeMediaIndex >= leftVisibleIndex + VISIBLE_THUMBS
          ? activeMediaIndex - VISIBLE_THUMBS + 1
          : leftVisibleIndex,
      maxLeftVisibleIndex,
    ))
    const desired = targetLeftIndex * step
    if (Math.abs(strip.scrollLeft - desired) < 2) return
    scrollStripToIndex(targetLeftIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMediaIndex, items.length, scrollStripToIndex])

  return (
    <div className="group/gallery -mx-2.5 min-w-0 overflow-hidden sm:-mx-8 lg:mx-0" aria-label="Galeri produk">
      {activeMedia ? (
        <>
          <div
            data-gallery-main
            ref={galleryRef}
            onTouchStart={onGalleryTouchStart}
            onTouchMove={onGalleryTouchMove}
            onTouchEnd={onGalleryTouchEnd}
            onTouchCancel={onGalleryTouchEnd}
            className="relative mx-auto aspect-square w-1/2 max-w-[200px] overflow-hidden bg-white sm:w-full sm:max-w-none"
          >
            {/* Horizontal strip: semua gambar sejajar - swipe real-time */}
            <div
              ref={galleryTrackRef}
              className="flex h-full touch-pan-y will-change-transform"
              onClick={(event) => {
                if (!didSwipe.current && event.target === event.currentTarget) setLightboxIndex(activeMediaIndex)
              }}
              style={{
                transform: `translateX(${-activeMediaIndex * 100 + (galleryWidth && galleryDrag ? (galleryDrag / galleryWidth) * 100 : 0)}%)`,
                transition: galleryDragging ? 'none' : 'transform 320ms cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              {items.map((item, index) => (
                <div key={item.id} className="flex h-full w-full shrink-0 items-center justify-center bg-white">
                  {item.is_video ? (
                    <GalleryVideoItem
                      item={item}
                      title={title}
                      index={index}
                      isActive={activeMediaIndex === index}
                      onOpenLightbox={() => {
                        if (!didSwipe.current) setLightboxIndex(index)
                      }}
                    />
                  ) : (
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
                      loading={index <= activeMediaIndex + 1 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : undefined}
                      wrapperClassName="size-full bg-white"
                      className="!object-contain"
                    />
                      </button>
                  )}

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
                  className="absolute left-2 top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-muted-foreground text-white opacity-100 shadow-md transition-[opacity,background-color] hover:bg-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed md:-left-14 md:flex md:size-12 md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100 md:group-hover/gallery:disabled:opacity-35 md:group-focus-within/gallery:disabled:opacity-35"
                >
                  <Icon name="arrow-left" className="size-6" weight="bold" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveGallery(1)}
                  disabled={activeMediaIndex === items.length - 1}
                  aria-label="Lihat foto berikutnya"
                  className="absolute right-2 top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-muted-foreground text-white opacity-100 shadow-md transition-[opacity,background-color] hover:bg-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed md:-right-14 md:flex md:size-12 md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100 md:group-hover/gallery:disabled:opacity-35 md:group-focus-within/gallery:disabled:opacity-35"
                >
                  <Icon name="arrow-right" className="size-6" weight="bold" aria-hidden="true" />
                </button>
              </>
            ) : null}

          {items.length > 1 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                if (!didSwipe.current) setLightboxIndex(activeMediaIndex)
              }}
              data-gallery-counter="1" className="absolute bottom-2 right-2 z-20 inline-flex items-center rounded-full bg-surface/85 px-2.5 py-1 text-[11px] font-bold tabular-nums text-foreground shadow-md backdrop-blur-sm transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Buka foto ${activeMediaIndex + 1} dari ${items.length}`}
            >
              {activeMediaIndex + 1}/{items.length}
            </button>
          ) : null}
          </div>

          {items.length > 1 ? (
            <div
              ref={stripRef}
              data-gallery-strip
              onScroll={onStripScroll}
              className="scrollbar-none mt-0 flex w-full max-w-full gap-2 overflow-x-auto px-2.5 py-2 [scroll-padding-left:10px] [scroll-snap-type:x_mandatory] sm:px-8 sm:py-2 lg:mt-3 lg:flex-wrap lg:gap-2.5 lg:p-0 lg:overflow-visible"
              aria-label="Pilih foto produk"
            >
              {/* Semua foto dirender urut asli; ke-6+ tersembunyi kanan.
                  Chip +N dinamis dua arah (plan 2.3). */}
              {items.map((item, index) => {
                const showLeftBadge = leftHidden > 0 && index === leftVisibleIndex
                const showRightBadge = rightHidden > 0 && index === leftVisibleIndex + VISIBLE_THUMBS - 1
                return (
                <button
                  type="button"
                  data-gallery-thumb
                  key={item.id}
                  onClick={() => {
                    setActiveMediaIndex(index)
                  }}
                  aria-label={`Tampilkan foto ${index + 1}`}
                  aria-current={activeMediaIndex === index ? "true" : undefined}
                  className={cn(
                    "relative aspect-square w-[calc((100%-16px)/3)] min-w-[calc((100%-16px)/3)] shrink-0 snap-start overflow-hidden rounded-none border-2 bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:size-24 lg:w-24 lg:min-w-24 lg:rounded-none",
                    activeMediaIndex === index
                      ? "border-primary"
                      : "border-transparent hover:border-border",
                  )}
                >
                  {item.is_video ? (
                    <>
                      <img src={item.thumb ?? item.url ?? ""} alt="" className="size-full bg-white object-contain" loading="lazy" />
                      <span className="absolute inset-0 z-10 flex items-center justify-center">
                        <span className="flex size-6 items-center justify-center rounded-full bg-foreground/70 text-background">
                          <Icon name="play" className="size-3" weight="fill" aria-hidden="true" />
                        </span>
                      </span>
                    </>
                  ) : (
                    <ResponsiveImage
                      src={item.thumb ?? item.url}
                      alt=""
                      wrapperClassName="size-full bg-white"
                      className="object-contain"
                    />
                  )}
                  {showLeftBadge ? (
                    <span data-gallery-more-left="1" className="absolute inset-0 z-20 flex items-center justify-center bg-foreground/60 text-sm font-bold text-white lg:hidden">
                      +{leftHidden}
                    </span>
                  ) : null}
                  {showRightBadge ? (
                    <span data-gallery-more-count="1" className="absolute inset-0 z-20 flex items-center justify-center bg-foreground/60 text-sm font-bold text-white lg:hidden">
                      +{rightHidden}
                    </span>
                  ) : null}

                </button>
                )
              })}

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
