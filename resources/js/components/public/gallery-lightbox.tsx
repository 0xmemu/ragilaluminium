import * as React from "react"

import { Icon } from "@/components/shared/icon"
import type { Testimonial } from "@/types"

type GalleryItem = {
  src: string
  alt: string
  name?: string | null
}

/** Lightbox fullscreen tanpa frame. Swipe real-time (drag ikut jari/mouse) + tombol + keyboard. */
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
  const widthRef = React.useRef(0)
  const wrapRef = React.useRef<HTMLDivElement>(null)

  const count = items.length

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
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count])

  React.useEffect(() => {
    widthRef.current = wrapRef.current?.clientWidth ?? 0
    function onResize() {
      widthRef.current = wrapRef.current?.clientWidth ?? 0
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  function onPointerDown(event: React.PointerEvent) {
    if (count <= 1) return
    setDragging(true)
    startX.current = event.clientX
    widthRef.current = wrapRef.current?.clientWidth ?? 0
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!dragging) return
    setDrag(event.clientX - startX.current)
  }

  function onPointerUp() {
    if (!dragging) return
    const threshold = widthRef.current * 0.18
    setDragging(false)
    if (Math.abs(drag) > threshold) {
      go(drag < 0 ? index + 1 : index - 1)
    }
    setDrag(0)
  }

  if (index < 0 || !items[index]) return null

  const translate = -index * 100 + (widthRef.current ? (drag / widthRef.current) * 100 : 0)

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
            className="absolute left-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
            aria-label="Sebelumnya"
          >
            <Icon name="caret-left" className="h-6 w-6" weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              go(index + 1)
            }}
            className="absolute right-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
            aria-label="Berikutnya"
          >
            <Icon name="caret-right" className="h-6 w-6" weight="bold" aria-hidden="true" />
          </button>
          <span className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs tabular-nums text-white/80">
            {index + 1} / {count}
          </span>
        </>
      ) : null}

      <div
        className="flex h-full w-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${translate}%)`,
          transition: dragging ? "none" : "transform 320ms cubic-bezier(0.22,1,0.36,1)",
          cursor: dragging ? "grabbing" : "grab",
        }}
      >
        {items.map((item) => (
          <div key={item.src} className="flex h-full w-full shrink-0 items-center justify-center">
            <img
              src={item.src}
              alt={item.alt}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[90dvh] max-w-[92vw] select-none object-contain"
              draggable={false}
            />
          </div>
        ))}
      </div>
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
