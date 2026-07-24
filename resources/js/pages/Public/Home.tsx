import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { ModelCard } from "@/components/public/model-card"
import { InstallationCard } from "@/components/public/installation-card"
import { ProductCard } from "@/components/public/product-card"
import { TestimonialCard } from "@/components/public/testimonial-card"
import { Icon } from "@/components/shared/icon"
import { SectionHeading } from "@/components/shared/section-heading"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import PublicLayout from "@/layouts/public-layout"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type {
  InstallationItem,
  ModelCardData,
  ProductCardData,
  PromoSlide,
  SharedPageProps,
  Testimonial,
} from "@/types"

interface HomepageLayoutProps {
  sections: Array<{ key: string; enabled: boolean }>
  how_to_order: {
    title: string
    subtitle?: string
    steps: Array<{ step: string; title: string; description: string }>
  }
}

interface HomeProps {
  promoSlides: PromoSlide[]
  modelCards: ModelCardData[]
  featuredProducts: ProductCardData[]
  popularProducts: ProductCardData[]
  testimonials?: Testimonial[]
  installations?: InstallationItem[]
  installationMeta?: { title?: string; heading?: string; subtitle?: string } | null
  homepageLayout?: HomepageLayoutProps
}

function SectionTitle({
  title,
  subtitle,
  actionHref,
  actionLabel = "Lihat semua",
}: {
  title: string
  subtitle?: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <SectionHeading
      align="left"
      size="display"
      className="mb-8 gap-4 md:mb-10"
      title={title}
      description={subtitle}
      action={
        actionHref ? (
          <Link
            href={actionHref}
            className="hidden min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-foreground bg-background px-5 text-sm font-semibold text-foreground transition hover:bg-foreground/5 md:inline-flex"
          >
            {actionLabel}
          </Link>
        ) : undefined
      }
    />
  )
}

/** Desktop next/back — disembunyikan di mobile (swipe-only). */
const carouselNavBtnClass =
  "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:flex md:size-12"

const mobileSeeMoreLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-foreground bg-background px-5 text-sm font-semibold text-foreground active:bg-foreground/5"

function useHorizontalCarousel(itemCount: number) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const trackId = React.useId()
  const [canGoBack, setCanGoBack] = React.useState(false)
  const [canGoNext, setCanGoNext] = React.useState(itemCount > 4)

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
        side === "left"
          ? "md:left-0 md:-translate-x-1/2"
          : "md:right-0 md:translate-x-1/2",
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

/** Slot swipe terakhir di mobile — setelah maks. 10 kartu. */
function MobileSeeMoreSlide({
  href,
  label = "Lihat selengkapnya",
  wide = false,
}: {
  href: string
  label?: string
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 snap-start flex-col items-center justify-center border border-dashed border-border bg-muted/40 px-4 md:hidden",
        wide
          ? "w-[88%] sm:w-[calc((100%_-_1.25rem)/2)]"
          : "w-[calc((100%_-_1.25rem)/2)] sm:w-[calc((100%_-_2.5rem)/3)]",
      )}
    >
      <Link href={href} className={mobileSeeMoreLinkClass}>
        {label}
        <Icon name="caret-right" className="ml-1.5 size-4" weight="bold" aria-hidden="true" />
      </Link>
    </div>
  )
}

function ModelCardCarousel({
  models,
  seeMoreHref,
}: {
  models: ModelCardData[]
  seeMoreHref: string
}) {
  const items = models.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(items.length)

  return (
    <div className="relative -mx-1 overflow-visible px-1">
      <div
        ref={trackRef}
        id={trackId}
        className="scrollbar-none flex touch-pan-x snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]"
      >
        {items.map((model) => (
          <div
            key={`${model.category}-${model.model}`}
            className="w-[calc((100%_-_1.25rem)/2)] shrink-0 snap-start sm:w-[calc((100%_-_2.5rem)/3)] md:w-[calc((100%_-_3.75rem)/4)] xl:w-[calc((100%_-_5rem)/5)]"
          >
            <ModelCard model={model} />
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
    <div className="relative -mx-1 overflow-visible px-1">
      <div
        ref={trackRef}
        id={trackId}
        className="scrollbar-none flex touch-pan-x snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]"
      >
        {items.map((product, index) => (
          <div
            key={product.id}
            className="w-[calc((100%_-_1.25rem)/2)] shrink-0 snap-start sm:w-[calc((100%_-_2.5rem)/3)] md:w-[calc((100%_-_3.75rem)/4)] xl:w-[calc((100%_-_5rem)/5)]"
          >
            <ProductCard product={product} priority={index < 4} />
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

function InstallationCarousel({
  items,
  seeMoreHref,
}: {
  items: InstallationItem[]
  seeMoreHref: string
}) {
  const slides = items.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(slides.length)

  return (
    <div className="relative -mx-1 overflow-visible px-1">
      <div
        ref={trackRef}
        id={trackId}
        className="scrollbar-none flex touch-pan-x snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]"
      >
        {slides.map((item) => (
          <div
            key={item.id}
            className="w-[calc((100%_-_1.25rem)/2)] shrink-0 snap-start sm:w-[calc((100%_-_2.5rem)/3)] md:w-[calc((100%_-_3.75rem)/4)] xl:w-[calc((100%_-_5rem)/5)]"
          >
            <InstallationCard item={item} />
          </div>
        ))}
        {slides.length > 0 ? (
          <MobileSeeMoreSlide href={seeMoreHref} label="Lihat selengkapnya" />
        ) : null}
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

function TestimonialCarousel({
  testimonials,
  seeMoreHref,
}: {
  testimonials: Testimonial[]
  seeMoreHref: string
}) {
  const items = testimonials.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(items.length)

  return (
    <div className="relative -mx-1 overflow-visible px-1">
      <div
        ref={trackRef}
        id={trackId}
        className="scrollbar-none flex touch-pan-x snap-x snap-mandatory items-stretch gap-5 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]"
      >
        {items.map((testimonial) => (
          <div
            key={testimonial.id}
            className="w-[88%] shrink-0 snap-start sm:w-[calc((100%_-_1.25rem)/2)] lg:w-[calc((100%_-_2.5rem)/3)]"
          >
            <TestimonialCard
              testimonial={testimonial}
              compact
              href={testimonial.product?.href ?? `${routeUrl("reviews")}#testimoni`}
            />
          </div>
        ))}
        {items.length > 0 ? <MobileSeeMoreSlide href={seeMoreHref} wide /> : null}
      </div>
      <CarouselNavButton
        trackId={trackId}
        side="left"
        label="Lihat ulasan sebelumnya"
        enabled={canGoBack}
        onClick={() => move(-1)}
      />
      <CarouselNavButton
        trackId={trackId}
        side="right"
        label="Lihat ulasan berikutnya"
        enabled={canGoNext}
        onClick={() => move(1)}
      />
    </div>
  )
}

function splitPromoEyebrow(eyebrow?: string | null): { lead: string; accentWord: string | null } {
  const text = (eyebrow ?? "Promo").trim()
  // Homepage promo banner accents "Diskon" only — Flash Sale has /flash-sale.
  const match = text.match(/^(.*?)(\bDiskon\b)(.*)$/i)
  if (!match) {
    return { lead: text, accentWord: null }
  }
  const before = match[1].trim()
  return {
    lead: before || "Promo",
    accentWord: "Diskon",
  }
}

/** Variasi warna kartu promo (dirotasi per slide): Signal Red, Graphite, Aluminium. */
const PROMO_CARD_VARIANTS = [
  {
    card: "bg-primary",
    eyebrow: "text-white/90",
    eyebrowAccent: "text-white",
    headline: "text-white drop-shadow-[0_1px_2px_rgba(10,0,0,0.25)]",
    chip: "bg-white text-primary",
    subheadline: "text-white/90",
    cta: "bg-background text-foreground hover:bg-background/90",
    disclaimer: "text-white/70",
  },
  {
    card: "bg-foreground",
    eyebrow: "text-white/85",
    eyebrowAccent: "text-white",
    headline: "text-white",
    chip: "bg-primary text-white",
    subheadline: "text-white/85",
    cta: "bg-background text-foreground hover:bg-background/90",
    disclaimer: "text-white/60",
  },
  {
    card: "bg-border",
    eyebrow: "text-foreground/85",
    eyebrowAccent: "text-primary",
    headline: "text-foreground",
    chip: "bg-primary text-white",
    subheadline: "text-foreground/80",
    cta: "bg-foreground text-background hover:bg-foreground/85",
    disclaimer: "text-foreground/60",
  },
] as const

function HeroPromoCard({
  slide,
  priority,
  variantIndex = 0,
}: {
  slide: PromoSlide
  priority: boolean
  variantIndex?: number
}) {
  const accent = slide.accent
    ? slide.accent.startsWith("-") || !/\d/.test(slide.accent)
      ? slide.accent
      : `-${slide.accent}`
    : null
  const eyebrow = splitPromoEyebrow(slide.eyebrow)
  const headlineLines = (slide.headline || "").split("\n").filter(Boolean)
  const v = PROMO_CARD_VARIANTS[Math.abs(variantIndex) % PROMO_CARD_VARIANTS.length]

  return (
    <div className="relative h-full w-full bg-muted">
      <ResponsiveImage
        src={slide.image}
        alt={slide.image_alt ?? slide.headline}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        wrapperClassName="absolute inset-0"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 flex items-center">
        <div
          className={cn(
            "ml-4 flex aspect-[3/4] h-[72%] w-auto flex-col justify-start rounded-[14px] shadow-[0_10px_30px_rgba(10,0,0,0.25)] px-5 py-6 sm:ml-8 sm:px-7 sm:py-8 md:ml-10 md:px-9 lg:ml-14",
            v.card,
          )}
        >
          <p className={cn("mt-3 font-display text-base font-medium tracking-[-0.04em] sm:mt-5 sm:text-lg md:text-xl", v.eyebrow)}>
            {eyebrow.lead}
            {eyebrow.accentWord ? (
              <>
                {" "}
                <span className={cn("text-[1.5em] font-extrabold", v.eyebrowAccent)}>{eyebrow.accentWord}</span>
              </>
            ) : null}
          </p>
          <p className={cn("mt-1 whitespace-pre-line font-display text-2xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-4xl md:text-5xl", v.headline)}>
            {headlineLines.length ? headlineLines.join("\n") : slide.headline}
          </p>
          {accent ? (
            <p className={cn("mt-2 inline-flex self-start rounded-full px-3 py-0.5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl", v.chip)}>
              {accent}
            </p>
          ) : null}
          {slide.subheadline ? (
            <p className={cn("mt-3 text-sm font-normal leading-snug sm:text-base md:text-lg", v.subheadline)}>
              {slide.subheadline}
            </p>
          ) : null}
          <Link
            href={slide.href}
            className={cn(
              "mt-auto inline-flex h-10 items-center justify-center self-start rounded-full px-6 text-sm font-bold transition",
              v.cta,
            )}
          >
            Belanja sekarang
          </Link>
          <p className={cn("mt-3 text-[10px] font-light sm:text-xs", v.disclaimer)}>
            {slide.disclaimer ?? "*Untuk berbagai produk pilihan"}
          </p>
        </div>
      </div>
    </div>
  )
}

function HeroSlideContent({
  slide,
  priority,
  index = 0,
}: {
  slide: PromoSlide
  priority: boolean
  index?: number
}) {
  const accent = slide.accent
    ? slide.accent.startsWith("-") || !/\d/.test(slide.accent)
      ? slide.accent
      : `-${slide.accent}`
    : null

  if (slide.layout === "promo_card" || slide.sticker) {
    return <HeroPromoCard slide={slide} priority={priority} variantIndex={index} />
  }

  return (
    <div className="relative h-full w-full">
      <ResponsiveImage
        src={slide.image}
        alt={slide.image_alt ?? slide.headline}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        wrapperClassName="absolute inset-0"
        className="object-cover object-center"
      />
      {/* Mobile: full-bleed dark scrim so white headline stays readable on bright photos. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/50 to-foreground/25 md:hidden"
        aria-hidden="true"
      />
      {/* Desktop: left-edge scrim only — photo remains the dominant plane. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[52%] max-w-[520px] bg-gradient-to-r from-foreground/85 to-transparent md:block"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center">
        <div className="w-full max-w-[560px] px-5 py-5 text-left text-white sm:px-16 md:px-[72px] lg:px-[88px]">
          {slide.eyebrow ? (
            <p className="font-display text-base font-normal leading-[1.25] tracking-[-0.01em] sm:text-2xl md:text-[2rem]">
              {slide.eyebrow}
            </p>
          ) : null}
          <p className="whitespace-pre-line font-display text-2xl font-bold leading-[1.08] tracking-[-0.02em] sm:text-4xl md:text-[3.25rem]">
            {slide.headline}
          </p>
          {accent ? (
            <p className="mt-1 font-display text-2xl font-bold leading-[1.1] tracking-tight text-primary sm:text-4xl md:text-[3rem]">
              {accent}
            </p>
          ) : null}
          {slide.subheadline ? (
            <p className="mt-2 text-sm font-normal leading-snug text-white/90 sm:mt-3 sm:text-base md:text-lg">
              {slide.subheadline}
            </p>
          ) : null}
          <Link
            href={slide.href}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-foreground px-6 text-sm font-semibold text-white transition hover:bg-foreground/85 sm:mt-6"
          >
            Belanja sekarang
          </Link>
          {priority ? (
            <ul
              className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 sm:mt-7"
              aria-label="Keunggulan layanan"
            >
              <li className="inline-flex items-center gap-1.5">
                <img
                  src="/images/icons/cod.svg"
                  alt=""
                  className="h-[17px] w-[34px] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-white/85">Bayar di tempat</span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-[17px] w-[34px] shrink-0 items-center justify-center" aria-hidden="true">
                  <img src="/images/icons/hero-shield.svg" alt="" className="h-[19px] w-auto" />
                </span>
                <span className="text-xs font-medium text-white/85">Garansi 100%</span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-[17px] w-[34px] shrink-0 items-center justify-center" aria-hidden="true">
                  <img src="/images/icons/hero-truck.svg" alt="" className="h-[17px] w-auto" />
                </span>
                <span className="text-xs font-medium text-white/85">Kirim ke seluruh Indonesia</span>
              </li>
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function HeroPromo({ slides }: { slides: PromoSlide[] }) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const total = slides.length
  const visibleIndex = total ? Math.min(activeIndex, total - 1) : 0
  const touchStartX = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (total < 2) return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (media.matches) return
    const id = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % total)
    }, 6000)
    return () => window.clearInterval(id)
  }, [total, visibleIndex])

  function goTo(index: number) {
    setActiveIndex((index + total) % total)
  }

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  function onTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null || total < 2) return
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current
    const delta = endX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 40) return
    goTo(visibleIndex + (delta < 0 ? 1 : -1))
  }

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return (
    <section id="promo" className="scroll-mt-20 bg-surface" aria-label="Promo dan campaign">
      <div
        className="relative w-full overflow-hidden bg-foreground/5 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
          {total ? (
            <>
              <div
                className={cn(
                  "flex aspect-[1024/426] min-h-[320px] w-full",
                  !reduceMotion && "transition-transform duration-500 ease-emphasized",
                )}
                style={{ transform: `translateX(-${visibleIndex * 100}%)` }}
                aria-live="polite"
              >
                {slides.map((slide, index) => {
                  const hidden = index !== visibleIndex
                  return (
                    <div
                      key={slide.id}
                      className="h-full w-full shrink-0 basis-full"
                      aria-hidden={hidden ? "true" : undefined}
                      // Hidden carousel slides must not keep focusable CTAs in tab order (axe aria-hidden-focus).
                      {...(hidden ? ({ inert: "" } as React.HTMLAttributes<HTMLDivElement>) : {})}
                    >
                      <HeroSlideContent slide={slide} priority={index === 0} index={index} />
                    </div>
                  )
                })}
              </div>

              {total > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => goTo(visibleIndex - 1)}
                    aria-label="Slide sebelumnya"
                    className="absolute left-5 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:flex"
                  >
                    <Icon name="caret-left" className="size-6" weight="bold" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(visibleIndex + 1)}
                    aria-label="Slide berikutnya"
                    className="absolute right-5 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:flex"
                  >
                    <Icon name="caret-right" className="size-6" weight="bold" aria-hidden="true" />
                  </button>

                  <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                    {slides.map((item, index) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => goTo(index)}
                        className={cn(
                          "h-2 rounded-full transition-all",
                          index === visibleIndex ? "w-5 bg-white" : "w-2 bg-white/40",
                        )}
                        aria-label={`Slide ${index + 1}`}
                        aria-current={index === visibleIndex ? "true" : undefined}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="flex aspect-[1024/426] min-h-[320px] w-full items-center justify-center bg-muted">
              <EmptyState
                className="min-h-28 border-0 bg-transparent p-4"
                title="Promo segera hadir"
                description="Banner promo akan tampil setelah konten aktif."
              />
            </div>
          )}
      </div>
    </section>
  )
}

function PilihModelProduk({ models }: { models: ModelCardData[] }) {
  const seeMoreHref = routeUrl("catalog.index")

  return (
    <section className="border-t border-border bg-surface section-space">
      <div className="container-page">
        <SectionTitle
          title="Pilih model produk"
          subtitle="Bandingkan model produk sebelum memilih ukuran."
          actionHref={seeMoreHref}
        />
        {models.length ? (
          <ModelCardCarousel models={models} seeMoreHref={seeMoreHref} />
        ) : (
          <EmptyState
            title="Model belum tersedia"
            description="Model produk akan tampil setelah katalog aktif."
            action={
              <Button asChild>
                <Link href={seeMoreHref}>Buka katalog</Link>
              </Button>
            }
          />
        )}
      </div>
    </section>
  )
}

function PalingBanyakDipesan({ products }: { products: ProductCardData[] }) {
  const seeMoreHref = `${routeUrl("catalog.index")}?sort=popular`

  return (
    <section
      id="paling-banyak-dipesan"
      className="scroll-mt-20 border-t border-border bg-surface-muted section-space"
    >
      <div className="container-page">
        <SectionTitle
          title="Paling banyak dipesan"
          subtitle="Untuk inspirasi Anda."
          actionHref={seeMoreHref}
        />
        {products.length ? (
          <ProductCardCarousel products={products} seeMoreHref={seeMoreHref} />
        ) : (
          <EmptyState
            title="Belum ada produk populer"
            description="Produk paling banyak dipesan akan muncul di sini."
            action={
              <Button asChild>
                <Link href={routeUrl("catalog.windows")}>Jelajahi produk</Link>
              </Button>
            }
          />
        )}
      </div>
    </section>
  )
}

const DEFAULT_ORDER_STEPS = [
  {
    step: "01",
    title: "Pilih model",
    description: "Tentukan model jendela, pintu, atau bouven yang sesuai kebutuhan.",
  },
  {
    step: "02",
    title: "Pilih ukuran & varian",
    description: "Atur ukuran, desain, dan opsi di halaman produk.",
  },
  {
    step: "03",
    title: "Checkout",
    description: "Isi data pengiriman, pilih pembayaran, lalu buat pesanan.",
  },
  {
    step: "04",
    title: "Lacak pesanan",
    description: "Pantau status tanpa login lewat menu Pesanan.",
  },
]

function CaraPesan({
  data,
}: {
  data?: HomepageLayoutProps["how_to_order"]
}) {
  const title = data?.title || "Cara pesan jendela Anda"
  const subtitle = data?.subtitle || "Alur singkat dari memilih model hingga pesanan terkirim."
  const steps = data?.steps?.length ? data.steps : DEFAULT_ORDER_STEPS

  return (
    <section className="border-t border-border bg-surface section-space">
      <div className="container-page">
        <div className="mx-auto mb-10 max-w-xl text-center md:mb-12">
          <SectionHeading
            size="display"
            title={title}
            description={subtitle}
            action={
              <Link
                href={routeUrl("cara-pemesanan")}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-foreground bg-background px-5 text-sm font-semibold text-foreground transition hover:bg-foreground/5"
              >
                Lihat panduan
              </Link>
            }
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <article
              key={`${item.step}-${item.title}`}
              className="border border-border bg-background p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(10,0,0,0.1)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <p className="font-mono text-xs font-bold text-primary">{item.step}</p>
              <h3 className="mt-3 text-sm font-bold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function HasilPemasangan({
  items,
  meta,
}: {
  items: InstallationItem[]
  meta?: { heading?: string; subtitle?: string } | null
}) {
  const seeMoreHref = routeUrl("installation.index")

  return (
    <section className="border-t border-border bg-surface-muted section-space">
      <div className="container-page">
        <SectionTitle
          title={meta?.heading?.trim() || "Hasil pemasangan kami"}
          subtitle={meta?.subtitle?.trim() || "Dokumentasi pemasangan dari pelanggan dan galeri toko."}
          actionHref={seeMoreHref}
          actionLabel="Semua hasil pemasangan"
        />
        {items.length ? (
          <InstallationCarousel items={items} seeMoreHref={seeMoreHref} />
        ) : (
          <EmptyState
            icon="image"
            title="Dokumentasi segera hadir"
            description="Dokumentasi pemasangan akan segera hadir."
          />
        )}
      </div>
    </section>
  )
}

function ApaKataPelanggan({ testimonials }: { testimonials: Testimonial[] }) {
  const seeMoreHref = routeUrl("reviews")

  return (
    <section className="border-t border-border bg-surface section-space">
      <div className="container-page">
        <SectionTitle
          title="Apa kata pelanggan kami"
          subtitle="Cuplikan ulasan terbit. Semua sumber (Shopee, WhatsApp, website) digabung di halaman Ulasan dengan filter."
          actionHref={seeMoreHref}
          actionLabel="Semua ulasan"
        />
        {testimonials.length ? (
          <TestimonialCarousel testimonials={testimonials} seeMoreHref={seeMoreHref} />
        ) : (
          <EmptyState
            icon="star"
            title="Belum ada ulasan"
            description="Belum ada ulasan yang tampil. Lihat hasil pemasangan kami atau tanya langsung via WhatsApp."
          />
        )}
      </div>
    </section>
  )
}

const HELP_STEPS = [
  {
    icon: "headset",
    title: "Konsultasi sebelum produksi",
    description:
      "Tim ahli kami membantu memilih model yang paling sesuai dengan fungsionalitas dan estetika bangunan Anda.",
  },
  {
    icon: "ruler",
    title: "Kami bantu cek & konfirmasi ukuran sebelum produksi",
    description:
      "Cek ulang spesifikasi teknis dan ukuran sebelum proses produksi dimulai untuk akurasi mutlak.",
  },
  {
    icon: "package",
    title: "Packing aman & pengiriman ke seluruh Indonesia",
    description:
      "Pengemasan standar industri untuk menjamin keamanan produk selama perjalanan menuju lokasi Anda.",
  },
  {
    icon: "whatsapp",
    title: "Masih ragu? Chat WhatsApp, kami bantu sampai jelas",
    description:
      "Layanan purna jual yang menyediakan bantuan panduan instalasi agar hasil akhir maksimal.",
  },
]

function KamiBantu() {
  return (
    <section className="border-t border-border bg-surface-muted section-space">
      <div className="container-page">
        <div className="mx-auto mb-10 max-w-xl text-center md:mb-12">
          <SectionHeading
            size="display"
            title={
              <>
                Kami bantu dari <span className="text-primary">awal sampai jadi</span>
              </>
            }
            description="Proses mudah, aman, dan nyaman untuk hasil yang sesuai harapan Anda."
          />
        </div>
        <div className="mx-auto grid max-w-3xl gap-4">
          {HELP_STEPS.map((item, index) => (
            <article
              key={item.title}
              className="flex items-center gap-4 border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(10,0,0,0.1)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:gap-6 sm:p-6"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground sm:size-16">
                <Icon name={item.icon} className="size-6 sm:size-7" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span className="tabular-nums mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-bold leading-snug tracking-tight text-foreground">
                    {item.title}
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function ClosingCta() {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null

  return (
    <section className="section-space border-t border-border bg-foreground text-background">
      <div className="container-page flex flex-col items-center text-center">
        <SectionHeading
          size="display"
          className="text-background [&_h2]:text-background [&_p]:text-white"
          title="Tingkatkan kualitas bangunan bersama kami"
          description="Pilih model aluminium yang tepat untuk rumah yang lebih rapi, terang, dan tahan lama."
        />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="bg-background text-primary hover:bg-background/90">
            <Link href={routeUrl("catalog.index")}>Pilih model produk</Link>
          </Button>
          <Button asChild variant="secondary" className="border-white/40 bg-transparent text-white hover:bg-white/10">
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                Konsultasi via WhatsApp
              </a>
            ) : (
              <Link href={routeUrl("contact")}>
                <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                Konsultasi via WhatsApp
              </Link>
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}

export default function Home({
  promoSlides = [],
  modelCards = [],
  featuredProducts = [],
  popularProducts = [],
  testimonials = [],
  installations = [],
  installationMeta = null,
  homepageLayout,
}: HomeProps) {
  const popular = popularProducts.length ? popularProducts : featuredProducts
  const sections = homepageLayout?.sections?.length
    ? homepageLayout.sections
    : [
        { key: "banner", enabled: true },
        { key: "how_to_order", enabled: true },
      ]

  function isSectionEnabled(key: string) {
    return sections.find((section) => section.key === key)?.enabled ?? true
  }

  function renderManagedSection(key: string) {
    if (!isSectionEnabled(key)) return null

    if (key === "banner") {
      return <HeroPromo key="banner" slides={promoSlides} />
    }
    return null
  }

  const bannerSections = sections.filter((section) => section.key === "banner")
  const showCaraPesan = isSectionEnabled("how_to_order")

  return (
    <PublicLayout>
      <Head title="Ragil Aluminium">
        <meta
          name="description"
          content="Pilih jendela, pintu, dan bouven aluminium berdasarkan model, desain, ukuran, dan harga."
        />
      </Head>

      <h1 className="sr-only">Bukaan presisi untuk rumah yang terasa lebih lega.</h1>

      {bannerSections.map((section) => renderManagedSection(section.key))}
      <PilihModelProduk models={modelCards} />
      <PalingBanyakDipesan products={popular} />
      {showCaraPesan ? <CaraPesan data={homepageLayout?.how_to_order} /> : null}
      <HasilPemasangan items={installations} meta={installationMeta} />
      <ApaKataPelanggan testimonials={testimonials} />
      <KamiBantu />
      <ClosingCta />
    </PublicLayout>
  )
}
