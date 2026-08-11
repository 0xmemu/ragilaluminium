import { Link } from "@inertiajs/react"
import * as React from "react"

import { InstallationCard } from "@/components/public/installation-card"
import { ModelCard } from "@/components/public/model-card"
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

function useHorizontalCarousel(itemCount: number) {
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
      left: direction * track.clientWidth * 0.85,
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

/** Trailing mobile CTA — ikon chevron + label di bawahnya. */
function MobileSeeMoreSlide({
  href,
  label = "Lihat semua",
  tone = "default",
}: {
  href: string
  label?: string
  tone?: "default" | "on-primary"
  /** @deprecated slot selalu sempit; prop diabaikan agar call site lama aman */
  wide?: boolean
}) {
  const onPrimary = tone === "on-primary"

  return (
    <div className="flex w-[4.75rem] shrink-0 snap-end items-center justify-center self-stretch px-0.5 md:hidden sm:w-20">
      <Link
        href={href}
        className={cn(
          "inline-flex flex-col items-center justify-center gap-1 transition active:scale-95",
          onPrimary ? "text-white hover:text-white/90" : "text-foreground hover:text-primary",
        )}
        aria-label={label}
      >
        <span
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full border bg-white shadow-sm transition sm:size-12",
            onPrimary
              ? "border-white/40 text-primary hover:border-white"
              : "border-foreground/25 text-foreground hover:border-foreground/40",
          )}
        >
          <Icon name="arrow-right" className="size-5 sm:size-6" weight="bold" aria-hidden="true" />
        </span>
        <span className="max-w-full text-center text-[12px] font-bold leading-tight tracking-tight">
          {label}
        </span>
      </Link>
    </div>
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

  return (
    <div className="relative min-w-0 px-1">
      <div ref={trackRef} id={trackId} className={carouselTrackClass}>
        {items.map((model) => (
          <div key={`${model.category}-${model.model}`} className={carouselCardClass}>
            <ModelCard model={model} showDesc={false} />
          </div>
        ))}
        {items.length > 0 ? <MobileSeeMoreSlide href={seeMoreHref} /> : null}
      </div>
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
        {items.length > 0 ? <MobileSeeMoreSlide href={seeMoreHref} tone={tone} /> : null}
      </div>
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

  return (
    <div className="relative min-w-0 px-1">
      <div ref={trackRef} id={trackId} className={cn(carouselTrackClass, "items-start")}>
        {slides.map((item) => (
          <div key={item.id} className={carouselCardClass}>
            <InstallationCard item={item} level="model" />
          </div>
        ))}
        {slides.length > 0 ? <MobileSeeMoreSlide href={seeMoreHref} /> : null}
      </div>
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
  const anchor = variant === "screenshot" ? "apa-kata-pelanggan" : "ulasan-website"

  return (
    <div className="relative min-w-0 px-1">
      <div ref={trackRef} id={trackId} className={cn(carouselTrackClass, "items-stretch")}>
        {items.map((testimonial) => (
          <div key={testimonial.id} className={carouselCardClass}>
            <TestimonialCard
              testimonial={testimonial}
              compact
              variant={variant}
              href={testimonial.product?.href ?? `${routeUrl("reviews")}#${anchor}`}
            />
          </div>
        ))}
        {items.length > 0 ? <MobileSeeMoreSlide href={seeMoreHref} /> : null}
      </div>
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
