import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { useMediaZoom } from "@/hooks/use-media-zoom"
import { shouldPlayPreviewVideo } from "@/lib/gallery-video"
import type { Testimonial } from "@/types"

type GalleryItem = {
  src: string
  alt: string
  name?: string | null
  is_video?: boolean
}

/** Selang maksimum antar ketukan agar dianggap ketuk dua kali. */
const DOUBLE_TAP_MS = 300
/** Toleransi pergeseran antar ketukan, supaya geser tetap dibaca sebagai geser. */
const DOUBLE_TAP_SLOP_PX = 32

/**
 * Sub-komponen Video di Lightbox:
 * Video HANYA boleh berputar saat slide video sedang aktif ditampilkan.
 * Saat pembeli sedang melihat foto lain di lightbox, video wajib PAUSE.
 * Tidak memakai atribut putar-otomatis (auto-play) HTML baku agar browser tidak memutar video
 * di latar belakang saat lightbox baru dibuka pada slide foto.
 */
function LightboxVideoItem({
  src,
  isActive,
}: {
  src: string
  isActive: boolean
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (shouldPlayPreviewVideo(isActive)) {
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Browser menolak autoplay audio sebelum interaksi pembeli
          video.muted = true
          video.play().catch(() => {})
        })
      }
    } else {
      if (!video.paused) {
        video.pause()
      }
    }
  }, [isActive])

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      onClick={(event) => event.stopPropagation()}
      className="max-h-[90dvh] max-w-[92vw] select-none bg-black object-contain"
    />
  )
}

/**
 * Lightbox fullscreen tanpa frame. Swipe real-time (drag ikut jari/mouse) + tombol + keyboard.
 *
 * Foto bisa diperbesar: roda tetikus atau cubit trackpad di desktop (zoom tepat
 * di posisi kursor), cubit dua jari dan ketuk dua kali di ponsel, lalu digeser
 * dengan menyeret. Saat diperbesar, geser antar media dimatikan sementara supaya
 * seret dipakai untuk menggeser foto, bukan pindah slide.
 */
export function GalleryLightbox({
  items,
  index,
  onOpenChange,
  onIndexChange,
}: {
  items: GalleryItem[]
  index: number
  onOpenChange: (open: boolean) => void
  onIndexChange: (next: number) => void
}) {
  const [drag, setDrag] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const startX = React.useRef(0)
  const [width, setWidth] = React.useState(0)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  /** Area yang menerima gesti zoom dan geser. */
  const surfaceRef = React.useRef<HTMLDivElement>(null)
  /** Gambar yang sedang aktif, dipakai membaca ukuran aslinya. */
  const imageRef = React.useRef<HTMLImageElement>(null)
  const lastTapRef = React.useRef<{ at: number; x: number; y: number } | null>(null)

  const count = items.length
  const activeItem = index >= 0 ? items[index] : undefined

  const zoom = useMediaZoom({
    surfaceRef,
    imageRef,
    resetKey: index,
    enabled: Boolean(activeItem) && !activeItem?.is_video,
  })

  const { scaled: zoomed } = zoom

  function close() {
    onOpenChange(false)
  }

  function go(next: number) {
    onIndexChange(((next % count) + count) % count)
  }

  React.useEffect(() => {
    if (index < 0) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close()
      if (event.key === "ArrowRight") go(index + 1)
      if (event.key === "ArrowLeft") go(index - 1)
      // Pintasan papan tuntas untuk memperbesar dan memperkecil.
      if (event.key === "+" || event.key === "=") zoom.zoomIn()
      if (event.key === "-") zoom.zoomOut()
      if (event.key === "0") zoom.resetZoom()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count, zoom.zoomIn, zoom.zoomOut, zoom.resetZoom])

  React.useEffect(() => {
    function onResize() {
      setWidth(wrapRef.current?.clientWidth ?? 0)
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  function onPointerDown(event: React.PointerEvent) {
    if (count <= 1) return
    // Saat foto sedang diperbesar, seret dipakai untuk menggeser foto.
    if (zoomed) return
    setDragging(true)
    startX.current = event.clientX
    setWidth(wrapRef.current?.clientWidth ?? 0)
    zoom.clearDrag()
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!dragging) return
    const distance = event.clientX - startX.current
    // Geser navigasi juga dihitung sebagai geser, supaya ketukan yang menyusul
    // tidak salah dibaca sebagai ketuk dua kali untuk memperbesar foto.
    zoom.noteDrag(Math.abs(distance))
    setDrag(distance)
  }

  function onPointerUp() {
    if (!dragging) return
    const threshold = width * 0.18
    setDragging(false)
    if (Math.abs(drag) > threshold) {
      go(drag < 0 ? index + 1 : index - 1)
    }
    setDrag(0)
  }

  /**
   * Ketuk dua kali untuk memperbesar di titik yang diketuk.
   * Dipakai untuk semua jenis penunjuk supaya perilakunya sama di ponsel dan
   * desktop, tanpa bergantung pada event klik ganda bawaan.
   */
  function handleDoubleTap(event: React.PointerEvent<HTMLImageElement>) {
    if (zoom.wasDragged()) {
      lastTapRef.current = null
      return
    }

    const now = event.timeStamp
    const previous = lastTapRef.current
    const isDoubleTap =
      previous !== null &&
      now - previous.at <= DOUBLE_TAP_MS &&
      Math.abs(event.clientX - previous.x) <= DOUBLE_TAP_SLOP_PX &&
      Math.abs(event.clientY - previous.y) <= DOUBLE_TAP_SLOP_PX

    if (isDoubleTap) {
      lastTapRef.current = null
      zoom.toggleZoomAt(event.clientX, event.clientY)
      return
    }

    lastTapRef.current = { at: now, x: event.clientX, y: event.clientY }
  }

  if (index < 0 || !items[index]) return null

  const translate = -index * 100 + (width ? (drag / width) * 100 : 0)

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 z-overlay flex items-center bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={items[index].alt}
      onClick={(event) => {
        if (!dragging) close()
        event.stopPropagation()
      }}
      style={{ touchAction: "pan-y" }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          close()
        }}
        className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Tutup"
      >
        <Icon name="x" className="h-5 w-5" aria-hidden="true" />
      </button>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              go(index - 1)
            }}
            aria-label="Sebelumnya"
            className="absolute left-2.5 top-1/2 z-10 hidden lg:flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground/75 text-white shadow-md backdrop-blur-sm transition hover:scale-105 hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="arrow-left" className="size-5" weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              go(index + 1)
            }}
            aria-label="Berikutnya"
            className="absolute right-2.5 top-1/2 z-10 hidden lg:flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground/75 text-white shadow-md backdrop-blur-sm transition hover:scale-105 hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="arrow-right" className="size-5" weight="bold" aria-hidden="true" />
          </button>
        </>
      ) : null}

      <div
        ref={surfaceRef}
        className="relative flex h-full w-full"
        style={{ touchAction: zoomed ? "none" : "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex h-full w-full"
          style={{
            transform: `translateX(${translate}%)`,
            transition: dragging ? "none" : "transform 320ms cubic-bezier(0.22,1,0.36,1)",
            cursor: dragging ? "grabbing" : "grab",
          }}
        >
          {items.map((item, itemIndex) => {
            const isActiveSlide = itemIndex === index
            return (
              <div
                key={item.src}
                className="flex h-full w-full shrink-0 items-center justify-center overflow-hidden"
              >
                {item.is_video ? (
                  <LightboxVideoItem
                    src={item.src}
                    isActive={isActiveSlide}
                  />
                ) : isActiveSlide ? (
                  <img
                    ref={imageRef}
                    src={item.src}
                    alt={item.alt}
                    onPointerDown={zoom.panHandlers.onPointerDown}
                    onPointerMove={zoom.panHandlers.onPointerMove}
                    onPointerUp={(event) => {
                      zoom.panHandlers.onPointerUp(event)
                      handleDoubleTap(event)
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="max-h-[90dvh] max-w-[92vw] select-none object-contain will-change-transform"
                    style={{
                      cursor: zoomed ? "grab" : "zoom-in",
                      touchAction: zoomed ? "none" : "pan-y",
                    }}
                    draggable={false}
                  />
                ) : (
                  <img
                    src={item.src}
                    alt={item.alt}
                    onClick={(event) => event.stopPropagation()}
                    className="max-h-[90dvh] max-w-[92vw] select-none object-contain"
                    draggable={false}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Kontrol zoom. Hanya untuk foto, dan hanya dirender saat memang bisa di-zoom.
          Di ponsel dan tablet tombol ini TIDAK ditampilkan: pembeli memakai cubit dua jari,
          ketuk dua kali, dan seret. Tombol hanya berguna saat ada tetikus, jadi mulai 1024px. */}
      {!activeItem?.is_video ? (
        <div
          className="absolute bottom-4 left-1/2 z-[70] hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/60 px-1.5 py-1 text-white shadow-lg backdrop-blur-md lg:flex"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              zoom.zoomOut()
            }}
            disabled={!zoom.canZoomOut}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            aria-label="Perkecil foto"
          >
            <Icon name="minus" className="h-4 w-4" weight="bold" aria-hidden="true" />
          </button>
          <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-white/85">
            {zoom.percent}%
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              zoom.zoomIn()
            }}
            disabled={!zoom.canZoomIn}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            aria-label="Perbesar foto"
          >
            <Icon name="plus" className="h-4 w-4" weight="bold" aria-hidden="true" />
          </button>
          <span className="mx-0.5 h-5 w-px bg-white/20" aria-hidden="true" />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              zoom.resetZoom()
            }}
            disabled={!zoomed}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            aria-label="Kembalikan ukuran foto"
            title="Kembalikan ke ukuran utuh"
          >
            <Icon name="expand" className="h-4 w-4" weight="bold" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {count > 1 ? (
        <span className="pointer-events-none absolute bottom-28 right-4 z-[70] rounded-full bg-white/10 px-3 py-1 text-xs tabular-nums text-white/80 lg:bottom-6">
          {index + 1} / {count}
        </span>
      ) : null}
    </div>
  )
}

/** Bangun daftar item lightbox dari daftar testimonial screenshot. */
export function toGalleryItems(testimonials: Testimonial[]): GalleryItem[] {
  return testimonials
    .filter((t) => Boolean(t.image_url))
    .map((t) => ({
      src: t.image_url!,
      alt: `Screenshot ulasan ${t.customer_name}`,
      name: t.customer_name,
    }))
}
