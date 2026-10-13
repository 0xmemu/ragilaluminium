import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { cn } from "@/lib/utils"

/**
 * Carousel horizontal storefront (module reusable).
 *
 * Satu sumber utk track class, ukuran kartu per profil, hook kontrol panah,
 * dan tombol navigasi. Dipakai oleh: ModelDetail, HomeCarousels,
 * PalingBanyakDipesan, FlashSale sections.
 */

/** Track carousel horizontal — kanonik (gap 12/16px, snap-x). */
export const carouselTrackClass =
  "carousel-track scrollbar-x flex min-w-0 snap-x snap-proximity gap-3 sm:gap-4 overflow-x-auto overscroll-x-contain pb-3.5 md:pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] [scroll-behavior:auto] data-[dragging=true]:snap-none data-[dragging=true]:cursor-grabbing"

/** Lebar kartu: satu class adaptif (container query di app.css) utk SEMUA rail. */
export const carouselCardClass = "carousel-card"

export interface CarouselHookOptions {
  /** Faktor geser per klik panah (0-1). Default 0.85. */
  scrollFactor?: number
  /** Jumlah minimal item yang menampilkan tombol panah. Default 3. */
  nextThreshold?: number
}

/** Hook kontrol carousel horizontal: drag-scroll, panah, reduce-motion. */
export function useHorizontalCarousel(itemCount: number, options: CarouselHookOptions = {}) {
  const scrollFactor = options.scrollFactor ?? 0.85
  const nextThreshold = options.nextThreshold ?? 3
  const trackRef = React.useRef<HTMLDivElement>(null)
  const trackId = React.useId()
  const [canGoBack, setCanGoBack] = React.useState(false)
  const [canGoNext, setCanGoNext] = React.useState(itemCount > nextThreshold)

  useDragScroll(trackRef)

  const updateControls = React.useCallback(() => {
    const track = trackRef.current
    if (!track) return

    const overflow = track.scrollWidth > track.clientWidth + 2
    setCanGoBack(overflow && track.scrollLeft > 2)
    setCanGoNext(overflow && track.scrollLeft + track.clientWidth < track.scrollWidth - 2)
  }, [])

  React.useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const frame = window.requestAnimationFrame(() => updateControls())
    track.addEventListener("scroll", updateControls, { passive: true })
    window.addEventListener("resize", updateControls)

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateControls()) : null
    resizeObserver?.observe(track)

    return () => {
      window.cancelAnimationFrame(frame)
      track.removeEventListener("scroll", updateControls)
      window.removeEventListener("resize", updateControls)
      resizeObserver?.disconnect()
    }
  }, [itemCount, updateControls])

  function move(direction: -1 | 1) {
    const track = trackRef.current
    if (!track) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    track.scrollBy({
      left: direction * track.clientWidth * scrollFactor,
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }

  return { trackRef, trackId, canGoBack, canGoNext, move }
}

/** Dasar ukuran tombol panah (44px mobile, 48px desktop). */
export const carouselNavBtnClass =
  "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-sm transition hover:scale-105 hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 md:flex md:size-12"

/** Tombol panah carousel — SATU gaya global (patokan homepage). */
export function CarouselNavButton({
  trackId,
  side,
  label,
  enabled,
  onClick,
  sideOffset = "outset",
}: {
  /** Id track utk aria-controls (opsional: slider hero tidak pakai track). */
  trackId?: string
  side: "left" | "right"
  label: string
  enabled: boolean
  onClick: () => void
  /** outset: menonjol keluar track (carousel) · inset: di dalam area (hero). */
  sideOffset?: "outset" | "inset"
}) {
  if (!enabled) return null

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-controls={trackId}
      className={cn(
        carouselNavBtnClass,
        side === "left" ? (sideOffset === "inset" ? "md:left-5" : "md:-left-5") : (sideOffset === "inset" ? "md:right-5" : "md:-right-5"),
      )}
    >
      <Icon
        name={side === "left" ? "caret-left" : "caret-right"}
        className="size-5 md:size-6"
        weight="bold"
        aria-hidden="true"
      />
    </button>
  )
}