import { Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { MobileEndActionReveal, useEndActionReveal } from "@/components/public/home-carousels"
import { FlashSaleCountdown, FlashSaleLabel } from "@/components/public/flash-sale-stage"
import { Icon } from "@/components/shared/icon"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { ProductCardData, SharedPageProps } from "@/types"

function FlashSaleCarouselCard({ product }: { product: ProductCardData }) {
  const price =
    typeof product.min_price === "number" ? product.min_price : Number(product.min_price ?? 0)
  const compare =
    typeof product.compare_price === "number"
      ? product.compare_price
      : Number(product.compare_price ?? 0)
  return (
    <Link
      href={product.href}
      // product-card--model = varian tipografi kartu katalog (judul 13px/400,
      // harga & compare mengikuti lebar kartu). Dipakai supaya kartu carousel
      // Flash Sale tampil sama dengan kartu produk biasa, bukan gaya terpisah.
      className="product-card product-card--model group block min-w-0 overflow-hidden rounded-[5px] border border-border bg-white transition hover:border-foreground/20"
    >
      <div className="product-card__media relative aspect-square w-full overflow-hidden bg-surface-muted">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="product-card__image absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : null}
        {product.discount_percent ? (
          <span className="absolute bottom-2 left-2 z-10 rounded-[4px] bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-white">
            -{product.discount_percent}%
          </span>
        ) : null}
      </div>
      <div className="product-card__content">
        <h3 className="product-card__title line-clamp-2">{product.name}</h3>
        <div className="product-card__pricing">
          {price > 0 ? <span className="product-card__price">{formatCurrency(price)}</span> : null}
          {compare > price && price > 0 ? (
            <span className="product-card__compare">
              <span className="product-card__original-price">{formatCurrency(compare)}</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

/** Lebar kartu - pola sama dengan carousel homepage (5 kartu penuh di desktop). */
const flashSaleCardClass =
  "w-[calc((100%-1rem)*6/13)] shrink-0 snap-start sm:w-[calc((100%-2.5rem)/3.5)] md:w-[calc((100%-3rem)/4)] xl:w-[calc((100%-4rem)/5)]"

/** Track carousel horizontal - swipe mobile, scroll + tombol di desktop. */
const flashSaleTrackClass =
  "scrollbar-x flex min-w-0 snap-x snap-proximity gap-3 sm:gap-4 overflow-x-auto overscroll-x-contain pb-3 md:pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] data-[dragging=true]:snap-none data-[dragging=true]:cursor-grabbing"

const flashSaleNavBtnClass =
  "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-sm transition hover:scale-105 hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 md:flex md:size-12"

function useFlashSaleNav(itemCount: number) {
  const trackRef = React.useRef<HTMLDivElement>(null)
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
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateControls()) : null
    ro?.observe(track)
    return () => {
      window.cancelAnimationFrame(frame)
      track.removeEventListener("scroll", updateControls)
      window.removeEventListener("resize", updateControls)
      ro?.disconnect()
    }
  }, [itemCount, updateControls])

  const move = React.useCallback((direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    track.scrollBy({
      left: direction * track.clientWidth * 0.85,
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }, [])

  return { trackRef, canGoBack, canGoNext, move }
}

/**
 * Section "FLASH SALE" berdiri sendiri - muncul di halaman Paling Banyak
 * Dipesan. Carousel penuh di semua breakpoint: swipe di mobile, tombol
 * back/next + scroll di desktop (5 kartu per layar), konsisten dengan
 * carousel homepage. Tipografi kartu mengikuti standar product-card website.
 */
export function FlashSaleCarouselSection({ products }: { products: ProductCardData[] }) {
  const { flashSalePeriod } = usePage<SharedPageProps>().props
  const { trackRef, canGoBack, canGoNext, move } = useFlashSaleNav(products.length)
  const reveal = useEndActionReveal(trackRef)

  return (
    <section id="flash-sale-carousel" className="border-b border-border bg-surface">
      <div className="container-page !px-2.5 md:!px-8 lg:!px-12 py-4 sm:py-5">
        {/* Bingkai blok Flash Sale. Tanpa bingkai, strip ini menyatu dengan grid
            produk di bawahnya sehingga batas sorotan promo tidak terlihat dan
            produk yang tampil di sini terkesan muncul dua kali. Warnanya merah
            promo (token primary, merah yang sama dengan label FLASH SALE dan
            badge diskon; nilainya sama dengan token sale, #C20000) sebagai
            sapuan latar saja, tanpa garis tepi.
            Bingkai ini sengaja TIDAK menahan limpahan: tombol panah menonjol
            keluar dari tepi kartu seperti carousel beranda, jadi kalau bingkai
            yang menahan limpahan tombolnya ikut terpotong. Yang ditahan hanya
            track, sebab saat aksi geser di HP track bergeser ke kiri dan tanpa
            penahan akan menembus keluar bingkai. */}
        <div className="rounded-md bg-primary/5 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Link
              href={routeUrl("catalog.flash-sale", undefined, "/flash-sale")}
              className="flex shrink-0 items-center gap-1.5"
              aria-label="Lihat halaman Flash Sale"
            >
              <h2 className="flex min-w-0 items-center">
                <FlashSaleLabel />
              </h2>
            </Link>
            <span className="ml-auto" />

            <FlashSaleCountdown period={flashSalePeriod ?? null} />
          </div>

          <div className="relative mt-3">
            <div className="overflow-hidden">
              <div
                ref={trackRef}
                id="flash-sale-carousel-track"
                className={flashSaleTrackClass}
                style={{
                  transform: `translateX(${reveal.revealed ? -76 : -Math.min(reveal.pull * 1.45, 76)}px)`,
                  transition: reveal.pull ? "none" : "transform 360ms ease-out",
                }}
                onPointerDown={reveal.onPointerDown}
                onPointerMove={reveal.onPointerMove}
                onPointerUp={reveal.onPointerUp}
                onPointerCancel={reveal.onPointerUp}
              >
                {products.map((product) => (
                  <div key={product.id} className={flashSaleCardClass}>
                    <FlashSaleCarouselCard product={product} />
                  </div>
                ))}
              </div>
            </div>
            {products.length > 0 ? (
              <MobileEndActionReveal
                href={routeUrl("catalog.flash-sale", undefined, "/flash-sale")}
                pull={reveal.pull}
                revealed={reveal.revealed}
              />
            ) : null}
            {canGoBack ? (
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Lihat produk flash sale sebelumnya"
                aria-controls="flash-sale-carousel-track"
                className={cn(flashSaleNavBtnClass, "md:-left-5")}
              >
                <Icon name="caret-left" className="size-5 md:size-6" weight="bold" aria-hidden="true" />
              </button>
            ) : null}
            {canGoNext ? (
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Lihat produk flash sale berikutnya"
                aria-controls="flash-sale-carousel-track"
                className={cn(flashSaleNavBtnClass, "md:-right-5")}
              >
                <Icon name="caret-right" className="size-5 md:size-6" weight="bold" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
