import { Link } from "@inertiajs/react"
import { SealCheck, ShieldCheck, Tag, Truck } from "@phosphor-icons/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import type { PromoSlide } from "@/types"

// Poin layanan yang ditampilkan satu per satu di slider promo (tidak menampilkan
// ulang announcement yang sudah ada di bar paling atas). Gaya mengikuti bar promo
// header: ikon Phosphor + copy marketing.
const PROMO_ITEMS: { icon: React.ElementType; text: string }[] = [
  { icon: SealCheck, text: "Bayar di tempat (COD), aman & mudah" },
  { icon: ShieldCheck, text: "Garansi 100% resmi pabrik" },
  { icon: Truck, text: "Kirim ke seluruh Indonesia" },
  { icon: Tag, text: "Harga pabrik langsung, tanpa perantara" },
]

/** Banner promosi solid — persis contoh: 3 baris teks rata kiri (baris kecil di atas,
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
          <p className="text-xs font-medium text-white/90">
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

/**
 * Slider pengumuman horizontal (ticker) di atas banner promo — strip merah
 * full-width (edge-to-edge, tanpa rounded dan tanpa padding horizontal).
 *
 * Satu teks promo rata kiri tampil penuh selama 3 detik, lalu track bergeser ke
 * kiri (translateX, 400ms) sehingga pesan aktif keluar ke kiri dan pesan
 * berikutnya masuk dari kanan. Bukan marquee: tidak ada animasi berjalan
 * terus-menerus. Loop seamless lewat duplikasi item pertama di akhir.
 */
function PromoSlider() {
  // Item terakhir adalah duplikat item pertama → transisi maju terlihat seamless,
  // lalu reset diam-diam ke index 0.
  const items = [...PROMO_ITEMS, PROMO_ITEMS[0]]
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const [noTransition, setNoTransition] = React.useState(false)

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // Autoplay: tiap teks diam 3 detik, lalu bergeser ke berikutnya. Nonaktif saat
  // hover/focus atau prefers-reduced-motion. Dari item terakhir maju ke duplikat
  // (index items.length-1) supaya transisi maju terlihat seamless.
  React.useEffect(() => {
    if (items.length < 2 || paused || reduceMotion) return
    const id = window.setInterval(() => {
      setActiveIndex((current) =>
        current === items.length - 2 ? current + 1 : (current + 1) % items.length,
      )
    }, 3000)
    return () => window.clearInterval(id)
  }, [items.length, paused, reduceMotion])

  // Saat sampai di duplikat item pertama, reset ke index 0 tanpa transisi
  // (kontennya identik, jadi tidak terlihat melompat). Pakai timeout 450ms
  // (> durasi transisi 400ms) supaya reset tetap jalan walau transitionend
  // tidak terpicu (tab background, transisi terinterupsi).
  React.useEffect(() => {
    if (activeIndex !== items.length - 1) return
    const id = window.setTimeout(() => {
      setNoTransition(true)
      setActiveIndex(0)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setNoTransition(false))
      })
    }, 450)
    return () => window.clearTimeout(id)
  }, [activeIndex, items.length])

  // Cadangan: kalau transitionend tetap terpicu, reset langsung (idempoten).
  function handleTransitionEnd() {
    if (activeIndex !== items.length - 1) return
    setNoTransition(true)
    setActiveIndex(0)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setNoTransition(false))
    })
  }

  return (
    <div
      className="relative h-8 w-full overflow-hidden bg-primary text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-label="Pengumuman promo"
    >
      <div
        onTransitionEnd={handleTransitionEnd}
        className={cn(
          "flex h-full flex-row",
          !reduceMotion && !noTransition &&
            "transition-transform duration-[400ms] ease-emphasized",
        )}
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {items.map((item, index) => (
          <div
            key={`${item.text}-${index}`}
            className="flex h-full w-full shrink-0 basis-full items-center justify-center px-4"
            aria-hidden={index !== activeIndex ? "true" : undefined}
          >
            <span className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold leading-none tracking-tight">
              <item.icon weight="fill" className="size-3.5 shrink-0 text-white/90" aria-hidden />
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Konten tiap slide:
 * - layout "placeholder" → blok polos (slot banner yang belum diisi admin).
 * - punya gambar → gambar full-bleed (banner buatan admin).
 * - selain itu → kartu teks solid (fallback).
 */
function HeroSlideContent({
  slide,
  priority,
}: {
  slide: PromoSlide
  priority: boolean
}) {
  if (slide.layout === "placeholder") {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-secondary"
        aria-hidden="true"
      />
    )
  }

  if (slide.image) {
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
      </div>
    )
  }

  return <HeroPromoCard slide={slide} />
}

/** Section banner homepage: slider promo full-width di atas + carousel slot banner. */
export function HomeHero({ slides }: { slides: PromoSlide[] }) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  // Reset timer tiap kali user berpindah manual (klik dot/panah), supaya slide
  // tidak langsung berpindah lagi setelah interaksi.
  const [interactionKey, setInteractionKey] = React.useState(0)
  // Banyaknya slot selalu ≥ 1 (backend memastikan minimal 10).
  const total = Math.max(slides.length, 1)
  const visibleIndex = Math.min(activeIndex, total - 1)
  const surfaceRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<{
    pointerId: number | null
    startX: number
    dragged: boolean
  }>({ pointerId: null, startX: 0, dragged: false })

  // Autoplay: tiap promo diam 5 detik, lalu bergeser cepat (350ms) ke berikutnya.
  React.useEffect(() => {
    if (total < 2 || paused) return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (media.matches) return
    const id = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % total)
    }, 5000)
    return () => window.clearInterval(id)
  }, [total, paused, interactionKey])

  function goTo(index: number) {
    setActiveIndex((index + total) % total)
    setInteractionKey((key) => key + 1)
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
      {/* Slider promo full-width: keluar dari container ber-padding, tanpa rounded. */}
      <PromoSlider />

      <div className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]">
        <div
          ref={surfaceRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className="relative w-full overflow-hidden [touch-action:pan-x_pan-y]"
        >
          <div
            className={cn(
              // Mobile: strip FIX 134px; sm+ mengikuti konten dengan tinggi minimal.
              "flex h-[134px] w-full items-stretch sm:h-auto sm:min-h-[132px] lg:min-h-[148px]",
              // Perpindahan antar-promo cepat (350ms) dengan transform translateX.
              !reduceMotion && "transition-transform duration-[350ms] ease-emphasized",
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

              <div className="absolute inset-x-0 bottom-1 flex justify-center gap-0.5">
                {Array.from({ length: total }).map((_, index) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => goTo(index)}
                    className="relative flex size-6 items-center justify-center rounded-full transition-all before:absolute before:-inset-2 before:content-['']"
                    aria-label={`Slide ${index + 1}`}
                    aria-current={index === visibleIndex ? "true" : undefined}
                  >
                    <span
                      className={cn(
                        "h-1 rounded-full shadow-[0_0_0_1px_rgba(15,15,15,0.25)] transition-all",
                        index === visibleIndex ? "w-4 bg-primary" : "w-1 bg-primary/40",
                      )}
                    />
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
