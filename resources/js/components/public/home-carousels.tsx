import { Link } from "@inertiajs/react"
import * as React from "react"

import { InstallationCard } from "@/components/public/installation-card"
import { ModelCategoryCard } from "@/components/public/model-category-card"
import { ProductCard } from "@/components/public/product-card"
import { TestimonialCard } from "@/components/public/testimonial-card"
import { Icon } from "@/components/shared/icon"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type {
  InstallationItem,
  ModelCardData,
  ProductCardData,
  Testimonial,
} from "@/types"

/** Desktop next/back — visible from md; mobile memakai slider horizontal. */
const carouselNavBtnClass =
  "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-sm transition hover:scale-105 hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 md:flex md:size-12"

/** Touch: pan-x + pan-y agar swipe kartu & scroll halaman sama-sama jalan. Mouse = useDragScroll. */
const carouselTrackClass =
  "scrollbar-x flex min-w-0 snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-3 md:pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] [scroll-behavior:auto] data-[dragging=true]:snap-none data-[dragging=true]:cursor-grabbing"

/** Mobile ≈ 2⅙ kartu di viewport; gap-2 (0.5rem) antar kartu. */
const carouselCardClass =
  "w-[calc((100%-1rem)*6/13)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/3.5)] md:w-[calc((100%-1.5rem)/4)] xl:w-[calc((100%-2rem)/5)]"

function useHorizontalCarousel(itemCount: number, scrollFactor = 0.85) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const trackId = React.useId()
  const [canGoBack, setCanGoBack] = React.useState(false)
  const [canGoNext, setCanGoNext] = React.useState(itemCount > 4)

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

function CarouselNavButton({
  trackId,
  side,
  label,
  enabled,
  onClick,
}: {
  trackId: string
  side: "left" | "right"
  label: string
  enabled: boolean
  onClick: () => void
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
        // Inset di dalam track — jangan half-outside (overflow parent memotong tombol).
        side === "left" ? "md:-left-5" : "md:-right-5",
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

export function useEndActionReveal(trackRef: React.RefObject<HTMLDivElement | null>) {
  const [pull, setPull] = React.useState(0)
  const [revealed, setRevealed] = React.useState(false)
  const pullRef = React.useRef(0)
  const gesture = React.useRef<{ startX: number; atEnd: boolean } | null>(null)

  const atEnd = React.useCallback(() => {
    const track = trackRef.current
    return !!track && track.scrollLeft + track.clientWidth >= track.scrollWidth - 2
  }, [trackRef])

  React.useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const onScroll = () => {
      if (!atEnd()) {
        setRevealed(false)
        setPull(0)
      }
    }
    let touchStartX = 0
    let touchAtEnd = false
    const onTouchStart = (event: TouchEvent) => {
      touchStartX = event.touches[0]?.clientX ?? 0
      touchAtEnd = atEnd()
    }
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch || !touchAtEnd) return
      const delta = touch.clientX - touchStartX
      if (delta >= 0) return
      event.preventDefault()
      const nextPull = Math.min(-delta * 0.42, 84)
      pullRef.current = nextPull
      setPull(nextPull)
    }
    const onTouchEnd = () => {
      if (pullRef.current >= 52) setRevealed(true)
      pullRef.current = 0
      setPull(0)
      touchAtEnd = false
    }
    track.addEventListener("scroll", onScroll, { passive: true })
    track.addEventListener("touchstart", onTouchStart, { passive: true })
    track.addEventListener("touchmove", onTouchMove, { passive: false })
    track.addEventListener("touchend", onTouchEnd)
    track.addEventListener("touchcancel", onTouchEnd)
    return () => {
      track.removeEventListener("scroll", onScroll)
      track.removeEventListener("touchstart", onTouchStart)
      track.removeEventListener("touchmove", onTouchMove)
      track.removeEventListener("touchend", onTouchEnd)
      track.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [atEnd, trackRef])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return
    gesture.current = { startX: event.clientX, atEnd: atEnd() }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return
    const current = gesture.current
    if (!current) return
    const delta = event.clientX - current.startX
    if ((current.atEnd || atEnd()) && delta < 0) {
      event.preventDefault()
      setPull(Math.min(-delta * 0.42, 84))
    }
    if (revealed && delta > 10) setRevealed(false)
  }

  const onPointerUp = () => {
    if (pull >= 52) setRevealed(true)
    setPull(0)
    gesture.current = null
  }

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    if (touch) gesture.current = { startX: touch.clientX, atEnd: atEnd() }
  }

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const current = gesture.current
    const touch = event.touches[0]
    if (!current || !touch) return
    const delta = touch.clientX - current.startX
    if ((current.atEnd || atEnd()) && delta < 0) {
      event.preventDefault()
      setPull(Math.min(-delta * 0.42, 84))
    }
    if (revealed && delta > 10) setRevealed(false)
  }

  return { pull, revealed, onPointerDown, onPointerMove, onPointerUp, onTouchStart, onTouchMove }
}

export function MobileEndActionReveal({
  href,
  pull,
  revealed,
}: {
  href: string
  pull: number
  revealed: boolean
}) {
  const offset = revealed ? 0 : Math.max(0, 76 - pull)
  const opacity = revealed ? 1 : Math.min(1, pull / 52)

  return (
    <Link
      href={href}
      aria-label="Lihat Semua"
      className="absolute right-0 top-0 bottom-3 z-10 flex w-[4.75rem] flex-col items-center justify-center gap-1 text-[#2563EB] transition-[transform,opacity] duration-[360ms] ease-out md:hidden sm:w-20"
      style={{
        transform: `translateX(${offset}px)`,
        opacity,
        pointerEvents: revealed ? "auto" : "none",
        transitionDuration: pull ? "0ms" : "360ms",
      }}
    >
      <Icon name="arrow-right" className="size-5 sm:size-6" weight="bold" aria-hidden="true" />
      <span className="max-w-full text-center text-[12px] font-bold leading-tight tracking-tight">Lihat Semua</span>
    </Link>
  )
}

export function ModelCardCarousel({
  models,
  seeMoreHref,
}: {
  models: ModelCardData[]
  seeMoreHref: string
}) {
  const items = models.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(items.length)
  const reveal = useEndActionReveal(trackRef)

  return (
    <div className="relative min-w-0 px-1">
      <div
        ref={trackRef}
        id={trackId}
        className={carouselTrackClass}
        style={{
          transform: `translateX(${reveal.revealed ? -76 : -Math.min(reveal.pull * 1.45, 76)}px)`,
          transition: reveal.pull ? "none" : "transform 360ms ease-out",
        }}
        onPointerDown={reveal.onPointerDown}
        onPointerMove={reveal.onPointerMove}
        onPointerUp={reveal.onPointerUp}
        onPointerCancel={reveal.onPointerUp}
      >
        {items.map((model) => (
          <div key={`${model.category}-${model.model}`} className={carouselCardClass}>
            <ModelCategoryCard model={model} />
          </div>
        ))}
      </div>
      {items.length > 0 ? (
        <MobileEndActionReveal href={seeMoreHref} pull={reveal.pull} revealed={reveal.revealed} />
      ) : null}
      <CarouselNavButton
        trackId={trackId}
        side="left"
        label="Lihat model sebelumnya"
        enabled={canGoBack}
        onClick={() => move(-1)}
      />
      <CarouselNavButton
        trackId={trackId}
        side="right"
        label="Lihat model berikutnya"
        enabled={canGoNext}
        onClick={() => move(1)}
      />
    </div>
  )
}

export function ProductCardCarousel({
  products,
  seeMoreHref,
  tone = "default",
}: {
  products: ProductCardData[]
  seeMoreHref: string
  tone?: "default" | "on-primary"
}) {
  const items = products.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(items.length)
  const reveal = useEndActionReveal(trackRef)
  const onPrimary = tone === "on-primary"

  return (
    <div className={cn("relative min-w-0", onPrimary ? "" : "px-1")}>
      <div
        ref={trackRef}
        id={trackId}
        className={cn(
          carouselTrackClass,
          onPrimary && "items-stretch pb-1 md:pb-1",
        )}
        style={{
          transform: `translateX(${reveal.revealed ? -76 : -Math.min(reveal.pull * 1.45, 76)}px)`,
          transition: reveal.pull ? "none" : "transform 360ms ease-out",
        }}
        onPointerDown={reveal.onPointerDown}
        onPointerMove={reveal.onPointerMove}
        onPointerUp={reveal.onPointerUp}
        onPointerCancel={reveal.onPointerUp}
      >
        {items.map((product, index) => (
          <div key={product.id} className={cn(carouselCardClass, onPrimary && "flex")}>
            <ProductCard
              product={product}
              priority={index < 4}
              titleStyle="model"
              className={onPrimary ? "w-full" : undefined}
            />
          </div>
        ))}
        
      </div>
      {items.length > 0 ? (
        <MobileEndActionReveal href={seeMoreHref} pull={reveal.pull} revealed={reveal.revealed} />
      ) : null}
      <CarouselNavButton
        trackId={trackId}
        side="left"
        label="Lihat produk sebelumnya"
        enabled={canGoBack}
        onClick={() => move(-1)}
      />
      <CarouselNavButton
        trackId={trackId}
        side="right"
        label="Lihat produk berikutnya"
        enabled={canGoNext}
        onClick={() => move(1)}
      />
    </div>
  )
}

export function InstallationCarousel({
  items,
  seeMoreHref,
}: {
  items: InstallationItem[]
  seeMoreHref: string
}) {
  const slides = items.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(slides.length)
  const reveal = useEndActionReveal(trackRef)

  return (
    <div className="relative min-w-0 px-1">
      <div
        ref={trackRef}
        id={trackId}
        className={cn(carouselTrackClass, "items-start")}
        style={{
          transform: `translateX(${reveal.revealed ? -76 : -Math.min(reveal.pull * 1.45, 76)}px)`,
          transition: reveal.pull ? "none" : "transform 360ms ease-out",
        }}
        onPointerDown={reveal.onPointerDown}
        onPointerMove={reveal.onPointerMove}
        onPointerUp={reveal.onPointerUp}
        onPointerCancel={reveal.onPointerUp}
      >
        {slides.map((item) => (
          <div key={item.id} className={carouselCardClass}>
            <InstallationCard item={item} />
          </div>
        ))}
        
      </div>
      {slides.length > 0 ? (
        <MobileEndActionReveal href={seeMoreHref} pull={reveal.pull} revealed={reveal.revealed} />
      ) : null}
      <CarouselNavButton
        trackId={trackId}
        side="left"
        label="Lihat dokumentasi sebelumnya"
        enabled={canGoBack}
        onClick={() => move(-1)}
      />
      <CarouselNavButton
        trackId={trackId}
        side="right"
        label="Lihat dokumentasi berikutnya"
        enabled={canGoNext}
        onClick={() => move(1)}
      />
    </div>
  )
}

export function TestimonialCarousel({
  testimonials,
  seeMoreHref,
  variant = "review",
  navLabel = "ulasan",
}: {
  testimonials: Testimonial[]
  seeMoreHref: string
  variant?: "review" | "screenshot"
  navLabel?: string
}) {
  const items = testimonials.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(items.length)
  const reveal = useEndActionReveal(trackRef)
  const anchor = variant === "screenshot" ? "apa-kata-pelanggan" : "ulasan-website"

  return (
    <div className="relative min-w-0 px-1">
      <div
        ref={trackRef}
        id={trackId}
        className={cn(carouselTrackClass, "items-stretch")}
        style={{
          transform: `translateX(${reveal.revealed ? -76 : -Math.min(reveal.pull * 1.45, 76)}px)`,
          transition: reveal.pull ? "none" : "transform 360ms ease-out",
        }}
        onPointerDown={reveal.onPointerDown}
        onPointerMove={reveal.onPointerMove}
        onPointerUp={reveal.onPointerUp}
        onPointerCancel={reveal.onPointerUp}
      >
        {items.map((testimonial) => (
          <div
            key={testimonial.id}
            className={carouselCardClass}
          >
            <TestimonialCard
              testimonial={testimonial}
              compact
              variant={variant}
              href={testimonial.product?.href ?? `${routeUrl("reviews")}#${anchor}`}
            />
          </div>
        ))}
        
      </div>
      {items.length > 0 ? (
        <MobileEndActionReveal href={seeMoreHref} pull={reveal.pull} revealed={reveal.revealed} />
      ) : null}
      <CarouselNavButton
        trackId={trackId}
        side="left"
        label={`Lihat ${navLabel} sebelumnya`}
        enabled={canGoBack}
        onClick={() => move(-1)}
      />
      <CarouselNavButton
        trackId={trackId}
        side="right"
        label={`Lihat ${navLabel} berikutnya`}
        enabled={canGoNext}
        onClick={() => move(1)}
      />
    </div>
  )
}
