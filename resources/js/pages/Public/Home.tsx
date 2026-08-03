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
import { useDragScroll } from "@/hooks/use-drag-scroll"
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
  marketplaceTestimonials?: Testimonial[]
  websiteTestimonials?: Testimonial[]
  installations?: InstallationItem[]
  installationMeta?: { title?: string; heading?: string; subtitle?: string } | null
  homepageLayout?: HomepageLayoutProps
}

function SectionTitle({
  title,
  eyebrow,
  actionHref,
  actionLabel = "Lihat selengkapnya",
  tone = "default",
}: {
  title: string
  eyebrow?: string
  actionHref?: string
  actionLabel?: string
  tone?: "default" | "on-primary"
}) {
  const onPrimary = tone === "on-primary"

  return (
    <SectionHeading
      align="left"
      size="default"
      tone={tone}
      className="mb-3 gap-1 sm:mb-4"
      eyebrow={eyebrow}
      title={title}
      action={
        actionHref ? (
          <Link
            href={actionHref}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 self-end text-[11px] font-light transition sm:text-xs",
              onPrimary
                ? "text-white/90 hover:text-white"
                : "text-foreground/80 hover:text-primary",
            )}
          >
            {actionLabel}
            <Icon name="caret-right" className="size-3 sm:size-3.5" weight="regular" aria-hidden="true" />
          </Link>
        ) : undefined
      }
    />
  )
}

/** Desktop next/back — visible from md; mobile memakai slider horizontal. */
const carouselNavBtnClass =
  "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-sm transition hover:scale-105 hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 md:flex md:size-12"

/** Touch: pan-x + pan-y agar swipe kartu & scroll halaman sama-sama jalan. Mouse = useDragScroll. */
const carouselTrackClass =
  "scrollbar-x flex min-w-0 snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-3.5 md:pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] [scroll-behavior:auto] data-[dragging=true]:snap-none data-[dragging=true]:cursor-grabbing"

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

/** Trailing mobile CTA — ikon chevron + label "selengkapnya" di bawahnya. */
function MobileSeeMoreSlide({
  href,
  label = "Lihat selengkapnya",
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
          <Icon name="caret-right" className="size-5 sm:size-6" weight="bold" aria-hidden="true" />
        </span>
        <span className="max-w-full text-center text-[10px] font-semibold leading-tight tracking-tight sm:text-xs">
          selengkapnya
        </span>
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
    <div className="relative min-w-0 px-1">
      <div ref={trackRef} id={trackId} className={carouselTrackClass}>
        {items.map((model) => (
          <div key={`${model.category}-${model.model}`} className={carouselCardClass}>
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

function TestimonialCarousel({
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
  const targetHref = variant === "screenshot" ? routeUrl("reviews") : routeUrl("ulasan")

  return (
    <div className="relative min-w-0 px-1">
      <div ref={trackRef} id={trackId} className={cn(carouselTrackClass, "items-stretch")}>
        {items.map((testimonial) => (
          <div key={testimonial.id} className={carouselCardClass}>
            <TestimonialCard
              testimonial={testimonial}
              compact
              variant={variant}
              href={testimonial.product?.href ?? targetHref}
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
    cta: "bg-black/60 text-white hover:bg-black/70",
    disclaimer: "text-white/70",
  },
  {
    card: "bg-foreground",
    eyebrow: "text-white/85",
    eyebrowAccent: "text-white",
    headline: "text-white",
    chip: "bg-primary text-white",
    subheadline: "text-white/85",
    cta: "bg-black/60 text-white hover:bg-black/70",
    disclaimer: "text-white/60",
  },
  {
    card: "bg-border",
    eyebrow: "text-foreground/85",
    eyebrowAccent: "text-primary",
    headline: "text-foreground",
    chip: "bg-primary text-white",
    subheadline: "text-foreground/80",
    cta: "bg-black/60 text-white hover:bg-black/70",
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
            // Mobile: padding dalam lebar (jarak teks↔tepi kartu); sm+: tinggi 72% (DESIGN-SYSTEM).
            "ml-4 flex aspect-[3/4] h-auto w-[clamp(12.5rem,58%,20rem)] max-h-[85%] flex-col justify-start overflow-hidden rounded-[clamp(0.625rem,1.2vw,0.875rem)] px-[clamp(0.875rem,2.5vw,2.75rem)] py-[clamp(1rem,3.5vw,2.25rem)] shadow-[0_10px_30px_rgba(10,0,0,0.25)]",
            "sm:ml-8 sm:h-[clamp(60%,72%,78%)] sm:w-auto sm:max-h-none sm:max-w-none sm:overflow-visible sm:px-[clamp(1.25rem,3vw,2.75rem)] sm:py-[clamp(1.5rem,4vw,2.25rem)]",
            "md:ml-10 md:px-10 lg:ml-14 lg:px-11",
            v.card,
          )}
        >
          <p className={cn("font-display text-[clamp(0.72rem,1.8vw,1.25rem)] font-medium tracking-[-0.04em] sm:mt-4 sm:text-[clamp(1rem,1.4vw,1.25rem)]", v.eyebrow)}>
            {eyebrow.lead}
            {eyebrow.accentWord ? (
              <>
                {" "}
                <span className={cn("text-[1.5em] font-extrabold", v.eyebrowAccent)}>{eyebrow.accentWord}</span>
              </>
            ) : null}
          </p>
          <p className={cn("mt-1 whitespace-pre-line font-display text-[clamp(1.2rem,4.2vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.03em] sm:mt-1.5 sm:text-[clamp(1.75rem,4vw,3rem)] md:text-[clamp(2.25rem,3.4vw,3.75rem)]", v.headline)}>
            {headlineLines.length ? headlineLines.join("\n") : slide.headline}
          </p>
          {accent ? (
            <p className={cn("mt-2 inline-flex self-start rounded-full px-2.5 py-0.5 font-display text-[clamp(1rem,3vw,1.875rem)] font-extrabold tracking-tight sm:mt-2.5 sm:px-3 sm:text-[clamp(1.5rem,2.8vw,1.875rem)]", v.chip)}>
              {accent}
            </p>
          ) : null}
          {slide.subheadline ? (
            <p className={cn("mt-2 text-[clamp(0.68rem,1.4vw,1.125rem)] font-normal leading-snug sm:mt-3", v.subheadline)}>
              {slide.subheadline}
            </p>
          ) : null}
          <Link
            href={slide.href}
            className={cn(
              "mt-auto inline-flex h-[clamp(2rem,4vw,2.5rem)] max-w-full shrink-0 items-center justify-center self-start whitespace-nowrap rounded-full px-[clamp(0.75rem,1.8vw,1.5rem)] text-[clamp(0.68rem,1.2vw,0.875rem)] font-bold transition",
              v.cta,
            )}
          >
            Belanja sekarang
          </Link>
          <p className={cn("mt-2 truncate text-[clamp(0.55rem,0.9vw,0.75rem)] font-light sm:mt-3", v.disclaimer)}>
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
  const surfaceRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<{
    pointerId: number | null
    startX: number
    dragged: boolean
  }>({ pointerId: null, startX: 0, dragged: false })

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

  // Swipe from middle of promo card / CTA (pointer when available, else touch).
  React.useEffect(() => {
    const el = surfaceRef.current
    if (!el || total < 2) return

    const state = dragRef.current
    let suppressClick = false
    let startX = 0
    let active = false
    let dragged = false
    const usePointer = typeof window.PointerEvent === "function"

    const begin = (clientX: number, pointerId: number | null = null) => {
      active = true
      dragged = false
      startX = clientX
      state.pointerId = pointerId
      state.startX = clientX
      state.dragged = false
    }

    const markDrag = (clientX: number, event?: Event) => {
      if (!active) return
      if (Math.abs(clientX - startX) < 28) return
      if (!dragged) {
        dragged = true
        state.dragged = true
        suppressClick = true
        if (state.pointerId !== null && event instanceof PointerEvent) {
          try {
            el.setPointerCapture(state.pointerId)
          } catch {
            // ignore
          }
        }
      }
      event?.preventDefault()
    }

    const finish = (clientX: number) => {
      if (!active) return
      const dx = clientX - startX
      const wasDragged = dragged
      active = false
      dragged = false
      state.pointerId = null
      state.dragged = false
      if (!wasDragged || Math.abs(dx) < 40) return
      setActiveIndex((current) => {
        const next = current + (dx < 0 ? 1 : -1)
        return ((next % total) + total) % total
      })
    }

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick) return
      event.preventDefault()
      event.stopPropagation()
      suppressClick = false
    }

    el.addEventListener("click", onClickCapture, true)

    if (usePointer) {
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType === "mouse" && event.button !== 0) return
        begin(event.clientX, event.pointerId)
      }
      const onPointerMove = (event: PointerEvent) => {
        if (state.pointerId !== event.pointerId) return
        markDrag(event.clientX, event)
      }
      const onPointerUp = (event: PointerEvent) => {
        if (state.pointerId !== null && state.pointerId !== event.pointerId) return
        finish(event.clientX)
      }
      el.addEventListener("pointerdown", onPointerDown)
      el.addEventListener("pointermove", onPointerMove, { passive: false })
      el.addEventListener("pointerup", onPointerUp)
      el.addEventListener("pointercancel", onPointerUp)
      return () => {
        el.removeEventListener("pointerdown", onPointerDown)
        el.removeEventListener("pointermove", onPointerMove)
        el.removeEventListener("pointerup", onPointerUp)
        el.removeEventListener("pointercancel", onPointerUp)
        el.removeEventListener("click", onClickCapture, true)
      }
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      begin(event.touches[0].clientX)
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!active || event.touches.length !== 1) return
      markDrag(event.touches[0].clientX, event)
    }
    const onTouchEnd = (event: TouchEvent) => {
      finish(event.changedTouches[0]?.clientX ?? startX)
    }
    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd)
    el.addEventListener("touchcancel", onTouchEnd)
    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchEnd)
      el.removeEventListener("click", onClickCapture, true)
    }
  }, [total])

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return (
    <section id="promo" className="scroll-mt-20 bg-surface" aria-label="Promo dan campaign">
      <div
        ref={surfaceRef}
        className="relative w-full overflow-hidden bg-foreground/5 [touch-action:pan-x_pan-y]"
      >
          {total ? (
            <>
              <div
                className={cn(
                  "flex aspect-[1024/426] min-h-[260px] w-full sm:min-h-[320px]",
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
            <div className="flex aspect-[1024/426] min-h-[260px] w-full items-center justify-center bg-muted sm:min-h-[320px]">
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
    <section id="pilih-model-produk" className="scroll-mt-20 bg-surface section-space">
      <div className="container-page">
        <SectionTitle
          eyebrow="Temukan model Anda"
          title="Pilih model produk"
          actionHref={seeMoreHref}
        />
        {models.length ? (
          <ModelCardCarousel models={models} seeMoreHref={seeMoreHref} />
        ) : (
          <EmptyState
            title="Model belum tersedia"
            description="Katalog model sedang disiapkan. Chat WhatsApp jika Anda ingin dibantu memilih."
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
  const seeMoreHref = `${routeUrl("catalog.all")}?sort=popular`

  return (
    <section id="paling-banyak-dipesan" className="scroll-mt-20 section-space">
      <div className="container-page">
        <SectionTitle
          eyebrow="Untuk inspirasi Anda"
          title="Paling banyak dipesan"
          actionHref={seeMoreHref}
        />
        {products.length ? (
          <ProductCardCarousel products={products} seeMoreHref={seeMoreHref} />
        ) : (
          <EmptyState
            title="Belum ada produk populer"
            description="Mulai dari katalog jendela, pintu, atau bouven untuk menemukan ukuran yang Anda butuhkan."
            action={
              <Button asChild>
                <Link href={routeUrl("catalog.category", { category: "windows" })}>Jelajahi produk</Link>
              </Button>
            }
          />
        )}
      </div>
    </section>
  )
}

const DEFAULT_ORDER_STEPS = [
  { step: "01", title: "Pilih model", icon: "package" as const },
  { step: "02", title: "Pilih ukuran & varian", icon: "ruler" as const },
  { step: "03", title: "Proses pesanan & konfirmasi WhatsApp", icon: "whatsapp" as const },
]

const ORDER_STEP_ICONS = ["package", "ruler", "whatsapp"] as const

/** Shared step index chip — filled hitam (Kami bantu); dipakai juga di Cara pesan. */
function orderStepIcon(title: string, index: number): string {
  const t = title.toLowerCase()
  if (t.includes("model")) return "package"
  if (t.includes("ukuran") || t.includes("varian")) return "ruler"
  if (t.includes("whatsapp") || t.includes("konfirmasi") || t.includes("proses")) return "whatsapp"
  if (t.includes("checkout") || t.includes("bayar")) return "credit-card"
  if (t.includes("lacak") || t.includes("pesanan")) return "clipboard-list"
  return ORDER_STEP_ICONS[index % ORDER_STEP_ICONS.length] ?? "package"
}

function CaraPesan({
  data,
}: {
  data?: HomepageLayoutProps["how_to_order"]
}) {
  const title = data?.title || "Cara pesan jendela Anda"
  const steps = (data?.steps?.length ? data.steps : DEFAULT_ORDER_STEPS).slice(0, 3)

  return (
    <section id="cara-pesan" className="scroll-mt-20 bg-surface section-space">
      <div className="container-page">
        <div className="mx-auto mb-4 max-w-xl text-center md:mb-5">
          <SectionHeading
            size="display"
            eyebrow="Panduan"
            title={title}
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
        <ol className="mx-auto grid max-w-3xl grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
          {steps.map((item, index) => {
            const icon = orderStepIcon(item.title, index)
            return (
              <li key={`${index}-${item.title}`}>
                <article className="flex h-full flex-col items-center rounded-xl border border-border bg-background px-1.5 py-3 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(10,0,0,0.1)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:px-3 sm:py-4">
                  <span className="mt-2 flex size-14 items-center justify-center rounded-xl bg-muted text-foreground sm:mt-3 sm:size-16">
                    <Icon name={icon} className="size-6 sm:size-7" aria-hidden="true" />
                  </span>
                  <h3 className="mt-2 text-[0.6875rem] font-bold leading-snug tracking-tight text-foreground sm:mt-3 sm:text-sm">
                    {item.title}
                  </h3>
                </article>
              </li>
            )
          })}
        </ol>
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
    <section id="hasil-pemasangan" className="scroll-mt-20 section-space">
      <div className="container-page">
        <SectionTitle
          eyebrow="Inspirasi penerapan"
          title={meta?.heading?.trim() || "Hasil pemasangan"}
          actionHref={seeMoreHref}
          actionLabel="Lihat selengkapnya"
        />
        {items.length ? (
          <InstallationCarousel items={items} seeMoreHref={seeMoreHref} />
        ) : (
          <EmptyState
            icon="image"
            title="Dokumentasi segera hadir"
            description="Foto pemasangan sedang dikumpulkan. Sementara itu, chat kami untuk melihat contoh di kota Anda."
          />
        )}
      </div>
    </section>
  )
}

function ApaKataPelanggan({ testimonials }: { testimonials: Testimonial[] }) {
  const seeMoreHref = routeUrl("reviews")

  return (
    <section id="apa-kata-pelanggan" className="scroll-mt-20 bg-surface section-space">
      <div className="container-page">
        <SectionTitle
          eyebrow="Ulasan dari marketplace dan WhatsApp"
          title="Apa kata pelanggan kami"
          actionHref={seeMoreHref}
          actionLabel="Lihat selengkapnya"
        />
        {testimonials.length ? (
          <TestimonialCarousel
            testimonials={testimonials}
            seeMoreHref={seeMoreHref}
            variant="screenshot"
            navLabel="testimoni"
          />
        ) : (
          <EmptyState
            icon="message-circle"
            title="Belum ada screenshot"
            description="Screenshot Shopee/WhatsApp akan tampil di sini setelah admin menambahkan."
          />
        )}
      </div>
    </section>
  )
}

function UlasanPelangganWebsite({ testimonials }: { testimonials: Testimonial[] }) {
  const seeMoreHref = routeUrl("ulasan")

  return (
    <section id="ulasan-website" className="scroll-mt-20 bg-surface-muted section-space">
      <div className="container-page">
        <SectionTitle
          eyebrow="Pembeli lewat website"
          title="Ulasan pelanggan di website"
          actionHref={seeMoreHref}
          actionLabel="Lihat selengkapnya"
        />
        {testimonials.length ? (
          <TestimonialCarousel
            testimonials={testimonials}
            seeMoreHref={seeMoreHref}
            variant="review"
            navLabel="ulasan"
          />
        ) : (
          <EmptyState
            icon="star"
            title="Belum ada ulasan website"
            description="Ulasan dari pembeli website (teks dan/atau foto) akan tampil di sini."
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
      "Tim kami bantu memilih model yang pas untuk kebutuhan dan tampilan rumah Anda.",
  },
  {
    icon: "ruler",
    title: "Kami bantu cek & konfirmasi ukuran sebelum produksi",
    description:
      "Ukuran dan opsi dicek ulang bersama Anda sebelum produksi, agar hasilnya pas di lokasi.",
  },
  {
    icon: "package",
    title: "Packing aman & pengiriman ke seluruh Indonesia",
    description:
      "Produk dikemas rapi agar aman sampai di rumah Anda, ke seluruh Indonesia.",
  },
  {
    icon: "whatsapp",
    title: "Masih ragu? Chat WhatsApp, kami bantu sampai jelas",
    description:
      "Tanya apa saja lewat WhatsApp, dari pilihan model sampai panduan pemasangan.",
  },
]

function KamiBantu() {
  return (
    <section id="kami-bantu" className="scroll-mt-20 bg-surface-muted section-space">
      <div className="container-page">
        <div className="mx-auto mb-4 max-w-xl text-center md:mb-5">
          <SectionHeading
            size="display"
            eyebrow="Didukung tim kami"
            title={
              <>
                Kami bantu dari <span className="text-primary">awal sampai jadi</span>
              </>
            }
          />
        </div>
        <div className="mx-auto grid max-w-3xl gap-4">
          {HELP_STEPS.map((item) => (
            <article
              key={item.title}
              className="flex items-center gap-4 border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(10,0,0,0.1)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:gap-6 sm:p-6"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground sm:size-16">
                <Icon name={item.icon} className="size-6 sm:size-7" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold leading-snug tracking-tight text-foreground">
                  {item.title}
                </h3>
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
    <section id="closing-cta" className="scroll-mt-20 section-space bg-foreground text-background">
      <div className="container-page flex flex-col items-center text-center">
        <SectionHeading
          size="display"
          eyebrow="Produk berkualitas"
          className="text-background [&_h2]:text-background [&_p]:text-white"
          title="Tingkatkan kualitas bangunan bersama kami"
        />
        <div className="mt-10 flex w-full max-w-xl flex-nowrap items-center justify-center gap-2 sm:gap-3">
          <Button asChild className="min-w-0 flex-1 whitespace-nowrap bg-background px-3 text-xs text-primary hover:bg-background/90 sm:px-6 sm:text-sm">
            <Link href={routeUrl("catalog.index")}>Pilih model produk</Link>
          </Button>
          <Button asChild variant="secondary" className="min-w-0 flex-1 whitespace-nowrap border-white/40 bg-transparent px-3 text-xs text-white hover:bg-white/10 sm:px-6 sm:text-sm">
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                Konsultasi ukuran
              </a>
            ) : (
              <Link href={routeUrl("contact")}>
                <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                Konsultasi ukuran
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
  marketplaceTestimonials,
  websiteTestimonials,
  installations = [],
  installationMeta = null,
  homepageLayout,
}: HomeProps) {
  const marketplaceItems = marketplaceTestimonials?.length
    ? marketplaceTestimonials
    : testimonials
  const websiteItems = websiteTestimonials ?? []
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
      <ApaKataPelanggan testimonials={marketplaceItems} />
      {websiteItems.length >= 10 ? (
        <UlasanPelangganWebsite testimonials={websiteItems} />
      ) : null}
      <KamiBantu />
      <ClosingCta />
    </PublicLayout>
  )
}
