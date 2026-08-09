import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { ModelCard } from "@/components/public/model-card"
import { IntroCards } from "@/components/public/intro-cards"
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
  actionHref,
  actionLabel = "Lihat semua →",
  tone = "default",
}: {
  title: string
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
      fitHeading={false}
      headingClassName="!text-[18px]"
      className="mb-3 gap-1 sm:mb-4"
      title={title}
      action={
        actionHref ? (
          <Link
            href={actionHref}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1 self-end px-1 text-[12px] font-bold transition",
              onPrimary
                ? "text-white/90 hover:text-white"
                : "text-foreground/80 hover:text-primary",
            )}
          >
            {actionLabel}
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
          <Icon name="caret-right" className="size-5 sm:size-6" weight="bold" aria-hidden="true" />
        </span>
        <span className="max-w-full text-center text-[12px] font-bold leading-tight tracking-tight">
          {label}
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

/** Banner promo solid — persis contoh: 3 baris teks rata kiri (baris kecil di atas,
    headline besar bold di tengah, subteks regular di bawah). Seluruh banner adalah
    link, tanpa tombol / chip / disclaimer. */
function HeroPromoCard({ slide }: { slide: PromoSlide }) {
  const headlineLines = (slide.headline || "").split("\n").filter(Boolean)
  const label = [slide.eyebrow, slide.headline, slide.subheadline]
    .filter(Boolean)
    .join(" — ")

  return (
    <Link
      href={slide.href}
      className="group relative flex h-full w-full items-center overflow-hidden rounded-md bg-primary transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={label || "Lihat promo"}
    >
      <div className="flex w-full flex-col justify-center px-4 sm:px-8 lg:px-10">
        {slide.eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/90">
            {slide.eyebrow}
          </p>
        ) : null}
        <p className="mt-0.5 whitespace-pre-line font-display text-xl font-extrabold leading-[1.15] tracking-[-0.02em] text-white sm:mt-1 sm:text-3xl lg:text-4xl">
          {headlineLines.length ? headlineLines.join("\n") : slide.headline}
        </p>
        {slide.subheadline ? (
          <p className="mt-1 text-xs leading-4 text-white/90 sm:mt-1.5">
            {slide.subheadline}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

function HeroSlideContent({
  slide,
  priority,
}: {
  slide: PromoSlide
  priority: boolean
}) {
  const accent = slide.accent
    ? slide.accent.startsWith("-") || !/\d/.test(slide.accent)
      ? slide.accent
      : `-${slide.accent}`
    : null

  if (slide.layout === "promo_card" || slide.sticker || slide.layout === "landing") {
    return <HeroPromoCard slide={slide} />
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75 sm:text-sm">
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
  // Slide terakhir = banner 2-zona info brand (IntroCards); total selalu ≥ 1.
  const total = slides.length + 1
  const visibleIndex = Math.min(activeIndex, total - 1)
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
    <section id="promo" className="scroll-mt-20 bg-surface pt-5 md:pt-8 lg:pt-12" aria-label="Promo dan campaign">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <div
          ref={surfaceRef}
          className="relative w-full overflow-hidden rounded-md bg-surface-muted shadow-[0_2px_16px_hsl(var(--foreground)/0.06)] [touch-action:pan-x_pan-y]"
        >
          <>
            <div
              className={cn(
                // Mobile: strip seragam 134px seperti banner sebelumnya (lebih tinggi di layar <360px agar teks tidak terpotong); sm+ mengikuti konten tertinggi.
                // Mobile: strip FIX 134px (sesuai spec 398x134) — tidak diubah-ubah; sm+ mengikuti konten.
                "flex h-[134px] w-full items-stretch sm:h-auto sm:min-h-[132px] lg:min-h-[148px]",
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
                    <HeroSlideContent slide={slide} priority={index === 0} />
                  </div>
                )
              })}
              <div
                className="h-full w-full shrink-0 basis-full"
                aria-hidden={slides.length !== visibleIndex ? "true" : undefined}
                {...(slides.length !== visibleIndex
                  ? ({ inert: "" } as React.HTMLAttributes<HTMLDivElement>)
                  : {})}
              >
                {/* Satu banner utuh full-bleed — mengisi slide seperti banner merah. */}
                <IntroCards className="h-full w-full" />
              </div>
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
                    {Array.from({ length: total }).map((_, index) => (
                      <button
                        type="button"
                        key={index}
                        onClick={() => goTo(index)}
                        className="flex size-8 items-center justify-center rounded-full transition-all"
                        aria-label={`Slide ${index + 1}`}
                        aria-current={index === visibleIndex ? "true" : undefined}
                      >
                        <span
                          className={cn(
                            // Ring tipis agar dot tetap terlihat di atas kartu putih (slide intro).
                            "h-2 rounded-full shadow-[0_0_0_1px_rgba(15,15,15,0.25)] transition-all",
                            index === visibleIndex ? "w-5 bg-white" : "w-2 bg-white/50",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
          </>
        </div>
      </div>
    </section>
  )
}

function PilihModelProduk({ models }: { models: ModelCardData[] }) {
  const seeMoreHref = routeUrl("catalog.index")

  return (
    <section id="pilih-model-produk" className="scroll-mt-20 bg-surface section-space">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <SectionTitle
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
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <SectionTitle
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
  const title = data?.title || "cara pesan jendela impian anda"
  const steps = (data?.steps?.length ? data.steps : DEFAULT_ORDER_STEPS).slice(0, 3)
  const stepDescriptions: Record<string, string> = {
    "Pilih model": "telusuri katalog di website dan pilih model jendela favoritmu",
    "Pilih ukuran & varian": "tentukan ukuran & varian yang kamu butuhkan, lalu masukkan ke keranjang",
    "Proses pesanan & konfirmasi WhatsApp": "selesaikan checkout, lalu konfirmasi pesananmu lewat WhatsApp",
  }
  const [active, setActive] = React.useState(0)
  const total = steps.length
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
      setActive((current) => (current + 1) % total)
    }, 2000)
    return () => window.clearInterval(id)
  }, [total])

  // Swipe kiri/kanan untuk ganti langkah.
  React.useEffect(() => {
    const el = surfaceRef.current
    if (!el || total < 2) return

    const state = dragRef.current
    let startX = 0
    let activeDrag = false
    let dragged = false
    const usePointer = typeof window.PointerEvent === "function"

    const begin = (clientX: number, pointerId: number | null = null) => {
      activeDrag = true
      dragged = false
      startX = clientX
      state.pointerId = pointerId
      state.dragged = false
    }

    const markDrag = (clientX: number, event?: Event) => {
      if (!activeDrag) return
      if (Math.abs(clientX - startX) < 28) return
      if (!dragged) {
        dragged = true
        state.dragged = true
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
      if (!activeDrag) return
      const dx = clientX - startX
      const wasDragged = dragged
      activeDrag = false
      dragged = false
      state.pointerId = null
      state.dragged = false
      if (!wasDragged || Math.abs(dx) < 40) return
      setActive((current) => ((current + (dx < 0 ? 1 : -1)) % total + total) % total)
    }

    if (usePointer) {
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType === "mouse" && event.button !== 0) return
        begin(event.clientX, event.pointerId)
      }
      const onPointerMove = (event: PointerEvent) => {
        if (state.pointerId !== null && state.pointerId !== event.pointerId) return
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
      }
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      begin(event.touches[0].clientX)
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!activeDrag || event.touches.length !== 1) return
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
    }
  }, [total])

  return (
    <section id="cara-pesan" className="scroll-mt-20 bg-surface section-space">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <SectionTitle
          title={title}
          actionHref={routeUrl("cara-pemesanan")}
          actionLabel="Lihat panduan →"
        />

        <div
          ref={surfaceRef}
          className="relative w-full overflow-hidden rounded-xl bg-foreground shadow-[0_2px_16px_rgba(10,0,0,0.12)] [touch-action:pan-y]"
        >
          <div
            className={cn(
              "flex h-[90px] w-full",
              !(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) &&
                "transition-transform duration-200 ease-emphasized",
            )}
            style={{ transform: `translateX(-${active * 100}%)` }}
            aria-live="polite"
          >
            {steps.map((item, index) => {
              const icon = orderStepIcon(item.title, index)
              const desc =
                stepDescriptions[item.title] ??
                ("description" in item ? item.description : undefined)
              return (
                <div
                  key={`${index}-${item.title}`}
                  className="flex h-full w-full shrink-0 items-center gap-3 px-4 sm:gap-4 sm:px-6"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white sm:size-10">
                    <Icon name={icon} className="size-4.5 sm:size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="mt-0.5 truncate text-[13px] font-bold leading-snug tracking-tight text-white sm:text-sm">
                      {item.title.toLowerCase()}
                    </h3>
                    {desc ? (
                      <p className="mt-0.5 truncate text-[11px] leading-snug text-white/70 sm:text-xs">
                        {desc.toLowerCase()}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Dots tipis di kanan bawah */}
          {total > 1 ? (
            <div className="absolute bottom-2 right-3 flex items-center gap-1">
              {steps.map((item, index) => (
                <button
                  key={`dot-${index}-${item.title}`}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Langkah ${index + 1}`}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    index === active ? "w-4 bg-white" : "w-1 bg-white/40 hover:bg-white/70",
                  )}
                />
              ))}
            </div>
          ) : null}
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
    <section id="hasil-pemasangan" className="scroll-mt-20 section-space">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <SectionTitle
          title={meta?.heading?.trim() || "Hasil pemasangan"}
          actionHref={seeMoreHref}
          actionLabel="Lihat semua →"
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
  const seeMoreHref = `${routeUrl("reviews")}#apa-kata-pelanggan`

  return (
    <section id="apa-kata-pelanggan" className="scroll-mt-20 bg-surface section-space">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <SectionTitle
          title="Apa kata pelanggan kami"
          actionHref={seeMoreHref}
          actionLabel="Lihat semua →"
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
  const seeMoreHref = `${routeUrl("reviews")}#ulasan-website`

  return (
    <section id="ulasan-website" className="scroll-mt-20 bg-surface-muted section-space">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <SectionTitle
          title="Ulasan pelanggan di website"
          actionHref={seeMoreHref}
          actionLabel="Lihat semua →"
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

const HELP_CARD_VARIANTS = [
  {
    card: "bg-primary text-white",
    icon: "bg-white/15 text-white",
    number: "text-white",
    title: "text-white",
    description: "text-white",
  },
  {
    card: "bg-action text-white",
    icon: "bg-white/10 text-white",
    number: "text-white/80",
    title: "text-white",
    description: "text-white/80",
  },
  {
    card: "bg-white/10 text-white",
    icon: "bg-white/10 text-white",
    number: "text-white/80",
    title: "text-white",
    description: "text-white/80",
  },
  {
    card: "bg-white text-action",
    icon: "bg-action/10 text-action",
    number: "text-action",
    title: "text-action",
    description: "text-action",
  },
] as const

function KamiBantu() {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null

  return (
    <section id="kami-bantu" className="scroll-mt-20 bg-foreground text-background section-space">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <div className="mx-auto mb-3 max-w-xl text-center md:mb-4">
          <SectionHeading
            size="display"
            fitHeading={false}
            headingClassName="!text-[18px]"
            className="text-background [&_h2]:text-background [&_p]:text-white"
            title={
              <>
                Kami bantu dari <span className="text-[hsl(var(--on-dark-accent))]">awal sampai jadi</span>
              </>
            }
          />
        </div>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HELP_STEPS.map((item, index) => {
            const variant = HELP_CARD_VARIANTS[index % HELP_CARD_VARIANTS.length]

            return (
              <article
                key={item.title}
                className={cn(
                  "flex min-h-[13.5rem] flex-col items-start gap-4 rounded-md border border-white/10 p-4 text-left shadow-[0_8px_24px_rgba(10,0,0,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(10,0,0,0.18)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:min-h-[14.5rem] sm:p-5",
                  variant.card,
                )}
              >
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-md sm:size-12", variant.icon)}>
                  <Icon name={item.icon} className="size-5 sm:size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <span className={cn("text-[11px] font-bold tracking-tight", variant.number)}>
                    0{index + 1}
                  </span>
                  <h3 className={cn("mt-1 text-[14px] font-bold leading-snug tracking-tight", variant.title)}>
                    {item.title}
                  </h3>
                  <p className={cn("mt-2 line-clamp-3 text-xs leading-5 sm:text-sm", variant.description)}>
                    {item.description}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
        <div className="mt-6 flex w-full max-w-xl flex-col items-stretch gap-2 sm:mx-auto sm:flex-row sm:items-center sm:justify-center sm:gap-3">
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
    </PublicLayout>
  )
}
