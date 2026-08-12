import { Link } from "@inertiajs/react"
import * as React from "react"

import { IntroCards } from "@/components/public/intro-cards"
import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import type { PromoSlide } from "@/types"

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
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-semibold text-white transition hover:bg-foreground/85 sm:mt-6"
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

/** Menu kategori horizontal di atas banner — model produk + sub-model (desain). */
export function HomeHero({ slides }: { slides: PromoSlide[] }) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
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
    if (total < 2 || paused) return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (media.matches) return
    const id = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % total)
    }, 6000)
    return () => window.clearInterval(id)
  }, [total, paused])

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
      <div className="container-page !px-5 py-5 md:!px-8 md:py-8 lg:!px-12 lg:py-12">
        <div
          ref={surfaceRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
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
                    <Icon name="arrow-left" className="size-6" weight="bold" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(visibleIndex + 1)}
                    aria-label="Slide berikutnya"
                    className="absolute right-5 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:flex"
                  >
                    <Icon name="arrow-right" className="size-6" weight="bold" aria-hidden="true" />
                  </button>

                  <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                    {Array.from({ length: total }).map((_, index) => (
                      <button
                        type="button"
                        key={index}
                        onClick={() => goTo(index)}
                        className="relative flex size-8 items-center justify-center rounded-full transition-all before:absolute before:-inset-2 before:content-['']"
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
