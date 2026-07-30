import { Link } from "@inertiajs/react"
import * as React from "react"

import { ProductCard } from "@/components/public/product-card"
import { Icon } from "@/components/shared/icon"
import { SectionHeading } from "@/components/shared/section-heading"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { ProductCardData } from "@/types"

const carouselNavBtnClass =
  "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground shadow-sm transition hover:scale-105 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:flex md:size-12"

const carouselTrackClass =
  "scrollbar-x flex min-w-0 snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-3.5 md:pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] [scroll-behavior:auto] data-[dragging=true]:snap-none data-[dragging=true]:cursor-grabbing"

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
        side === "left" ? "md:left-0 md:-translate-x-1/2" : "md:right-0 md:translate-x-1/2",
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

function MobileSeeMoreSlide({ href }: { href: string }) {
  return (
    <div className="flex w-[4.75rem] shrink-0 snap-end items-center justify-center self-stretch px-0.5 md:hidden sm:w-20">
      <Link
        href={href}
        className="inline-flex flex-col items-center justify-center gap-1 text-foreground transition hover:text-primary active:scale-95"
        aria-label="Lihat selengkapnya"
      >
        <span className="inline-flex size-11 items-center justify-center rounded-full border border-foreground/25 bg-white text-foreground shadow-sm transition hover:border-foreground/40 sm:size-12">
          <Icon name="caret-right" className="size-5 sm:size-6" weight="bold" aria-hidden="true" />
        </span>
        <span className="max-w-full text-center text-[10px] font-semibold leading-tight tracking-tight sm:text-xs">
          selengkapnya
        </span>
      </Link>
    </div>
  )
}

function ProductCardCarousel({
  products,
  seeMoreHref,
}: {
  products: ProductCardData[]
  seeMoreHref: string
}) {
  const items = products.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(items.length)

  return (
    <div className="relative min-w-0 overflow-x-clip px-1">
      <div ref={trackRef} id={trackId} className={carouselTrackClass}>
        {items.map((product, index) => (
          <div key={product.id} className={carouselCardClass}>
            <ProductCard product={product} priority={index < 4} titleStyle="model" />
          </div>
        ))}
        {items.length > 0 ? <MobileSeeMoreSlide href={seeMoreHref} /> : null}
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

/** Strip kurasi “Paling banyak dipesan” — data dari `InertiaCatalog::popularProductCards`. */
export function PalingBanyakDipesanSection({
  products,
  className,
}: {
  products: ProductCardData[]
  className?: string
}) {
  if (!products.length) return null

  const seeMoreHref = `${routeUrl("catalog.index")}?sort=popular`

  return (
    <section
      id="paling-banyak-dipesan"
      className={cn("scroll-mt-20 bg-surface-muted section-space", className)}
    >
      <div className="container-page">
        <SectionHeading
          align="left"
          size="default"
          className="mb-4 gap-1 sm:mb-5 md:mb-6"
          eyebrow="Untuk inspirasi Anda"
          title="Paling banyak dipesan"
          action={
            <Link
              href={seeMoreHref}
              className="inline-flex min-h-8 shrink-0 items-center gap-1 self-end text-xs font-semibold text-foreground transition hover:text-primary sm:min-h-9 sm:text-sm"
            >
              Lihat selengkapnya
              <Icon name="caret-right" className="size-3.5 sm:size-4" weight="bold" aria-hidden="true" />
            </Link>
          }
        />
        <ProductCardCarousel products={products} seeMoreHref={seeMoreHref} />
      </div>
    </section>
  )
}
