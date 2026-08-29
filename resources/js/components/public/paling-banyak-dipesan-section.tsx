import * as React from "react"

import { ProductCard } from "@/components/public/product-card"
import { MobileEndActionReveal, useEndActionReveal } from "@/components/public/home-carousels"
import { Icon } from "@/components/shared/icon"
import { SectionHeading } from "@/components/shared/section-heading"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { ProductCardData } from "@/types"
import {
  carouselCardClass as profileCarouselCardClass,
  carouselTrackClass,
  CarouselNavButton,
  useHorizontalCarousel as useRailCarousel,
} from "@/components/public/carousel-controls"

const carouselNavBtnClass =
  "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-sm transition hover:scale-105 hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 md:flex md:size-12"



function ProductCardCarousel({
  products,
  seeMoreHref,
}: {
  products: ProductCardData[]
  seeMoreHref: string
}) {
  const items = products.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useRailCarousel(items.length, { nextThreshold: 4 })
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
        {items.map((product, index) => (
          <div key={product.id} className={profileCarouselCardClass.popular}>
            <ProductCard product={product} priority={index < 4} titleStyle="model" />
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
            variant="dark"
      />
      <CarouselNavButton
        trackId={trackId}
        side="right"
        label="Lihat produk berikutnya"
        enabled={canGoNext}
        onClick={() => move(1)}
            variant="dark"
      />
    </div>
  )
}

/** Strip kurasi “Paling banyak dipesan” - data dari `InertiaCatalog::popularProductCards`. */
export function PalingBanyakDipesanSection({
  products,
  className,
}: {
  products: ProductCardData[]
  className?: string
}) {
  if (!products.length) return null

  const seeMoreHref = `${routeUrl("catalog.all")}?sort=popular&from=paling-banyak-dipesan`

  return (
    <section
      id="paling-banyak-dipesan"
      className={cn("scroll-mt-20", className)}
    >
      <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
        <SectionHeading
          align="left"
          size="default"
          className="mb-3 gap-1 sm:mb-4"
          eyebrow="Untuk inspirasi Anda"
          title="Paling banyak dipesan"
          action={
            <a
              href={seeMoreHref}
              className="inline-flex shrink-0 items-center gap-1 self-end text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <span>Lihat Semua</span>
              <Icon name="arrow-right" className="size-4" weight="bold" aria-hidden="true" />
            </a>
          }
        />
        <ProductCardCarousel products={products} seeMoreHref={seeMoreHref} />
      </div>
    </section>
  )
}
