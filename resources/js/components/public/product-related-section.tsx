import { Link } from "@inertiajs/react"
import * as React from "react"

import { ProductCard } from "@/components/public/product-card"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ProductCardData } from "@/types"

/* ── Carousel helpers (same as Home / Paling Banyak Dipesan) ── */

const carouselNavBtnClass =
  "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-sm transition hover:scale-105 hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 md:flex md:size-12"

const carouselTrackClass =
  "scrollbar-x flex min-w-0 snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-3.5 md:pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] [scroll-behavior:auto] data-[dragging=true]:snap-none data-[dragging=true]:cursor-grabbing"

const carouselCardClass =
  "w-[calc((100%-1rem)*6/13)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/3.5)] md:w-[calc((100%-1.5rem)/4)] xl:w-[calc((100%-2rem)/5)]"

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
        side === "left" ? "left-2 md:-left-5" : "right-2 md:-right-5",
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
        aria-label="Lihat semua"
      >
        <span className="inline-flex size-11 items-center justify-center rounded-full border border-foreground/25 bg-white text-foreground shadow-sm transition hover:border-foreground/40 sm:size-12">
          <Icon name="arrow-right" className="size-5 sm:size-6" weight="bold" aria-hidden="true" />
        </span>
        <span className="max-w-full text-center text-xs font-medium leading-tight tracking-tight">
          Lihat semua
        </span>
      </Link>
    </div>
  )
}

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
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateControls()) : null
    observer?.observe(track)
    return () => {
      window.cancelAnimationFrame(frame)
      track.removeEventListener("scroll", updateControls)
      window.removeEventListener("resize", updateControls)
      observer?.disconnect()
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

function RelatedCarousel({ products }: { products: ProductCardData[] }) {
  const items = products.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(items.length)

  return (
    <div className="relative min-w-0 mt-4 px-1">
      <div ref={trackRef} id={trackId} className={carouselTrackClass}>
        {items.map((product, index) => (
          <div key={product.id} className={carouselCardClass}>
            <ProductCard product={product} priority={index < 4} titleStyle="model" imageFit="contain" />
          </div>
        ))}
        {items.length > 0 ? <MobileSeeMoreSlide href={routeUrl("catalog.index")} /> : null}
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

/**
 * Section penutup halaman produk: "Anda mungkin juga suka" dengan carousel
 * produk terkait (atau empty state dengan aksi ke katalog).
 */
export function ProductRelatedSection({ products }: { products: ProductCardData[] }) {
  return (
    <section className="pt-5 pb-[calc(var(--mobile-sticky-cta-height)+var(--mobile-bottom-nav-height))] lg:pb-5 border-t border-border">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="min-w-0 break-words text-base font-bold text-foreground">Anda mungkin juga suka</h2>
          <Link
            href={routeUrl("catalog.index")}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground/80 transition hover:text-primary"
          >
            <span>Lihat semua</span>
            <Icon name="arrow-right" className="size-3.5" weight="regular" aria-hidden="true" />
          </Link>
        </div>
        {products.length ? (
          <RelatedCarousel products={products} />
        ) : (
          <EmptyState
            className="mt-4"
            title="Belum ada produk terkait"
            description="Lihat seluruh model untuk menemukan pilihan dari kategori lain."
            action={
              <Button asChild>
                <Link href={routeUrl("catalog.index")}>Lihat model produk</Link>
              </Button>
            }
          />
        )}
      </div>
    </section>
  )
}
