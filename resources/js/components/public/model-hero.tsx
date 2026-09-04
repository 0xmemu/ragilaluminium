import * as React from "react"

import { buttonVariants } from "@/components/ui/button"

import { cn } from "@/lib/utils"
import { useDragScroll } from "@/hooks/use-drag-scroll"

import { ResponsiveImage } from "@/components/ui/responsive-image"

export interface ModelHeroStat {
  value: string | number
  label: string
}

export interface ModelHeroThumb {
  id: string
  src: string
  alt: string
  href?: string
}

/**
 * Hero halaman model — REUSABLE di ModelDetail & Installations.
 *
 * Desktop: thumb kiri (24rem) + kanan (judul, deskripsi, statistik).
 * Mobile: thumb full-width dengan overlay judul & subjudul + statistik di bawah.
 * Thumbs > 1 -> carousel swipe + dots (dipakai ModelDetail); 1 thumb -> gambar statis.
 */
export function ModelHero({
  title,
  description,
  slogan,
  highlights,
  thumbs,
  stats,
  hubHref,
}: {
  title: string
  /** Deskripsi panjang (kolom kanan desktop). */
  description?: string | null
  /** Slogan pendek (overlay mobile). */
  slogan?: string | null
  /** Keunggulan model — danau global, sama di semua halaman. */
  highlights?: Array<{ label: string }>
  thumbs: ModelHeroThumb[]
  stats: ModelHeroStat[]
  hubHref?: string | null
}) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  useDragScroll(trackRef)
  const [active, setActive] = React.useState(0)

  const handleScroll = React.useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth))
    setActive(Math.max(0, Math.min(thumbs.length - 1, index)))
  }, [thumbs.length])

  const goSlide = React.useCallback((index: number) => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" })
  }, [])

  const first = thumbs[0]
  if (!first) return null

  return (
    <div className="container-page !px-0 md:!px-8 lg:!px-12">
      <div className="lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        {/* Kiri: thumb + overlay (mobile) */}
        <div>
          <div className="relative mx-auto aspect-square w-full overflow-hidden">
            {thumbs.length > 1 ? (
              <div
                ref={trackRef}
                onScroll={handleScroll}
                className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scrollbar-none [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] data-[dragging=true]:cursor-grabbing"
              >
                {thumbs.map((thumb) => (
                  <button
                    key={thumb.id}
                    type="button"
                    onClick={() => thumb.href && window.location.assign(thumb.href)}
                    className="relative h-full w-full shrink-0 snap-start"
                    aria-label={thumb.alt}
                  >
                    <ResponsiveImage
                      src={thumb.src}
                      alt={thumb.alt}
                      loading="lazy"
                      wrapperClassName="absolute inset-0 size-full !aspect-auto bg-surface-muted"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <ResponsiveImage
                src={first.src}
                alt={first.alt}
                loading="lazy"
                wrapperClassName="absolute inset-0 size-full !aspect-auto bg-surface-muted"
                className="h-full w-full object-cover"
              />
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[140px] bg-gradient-to-b from-transparent to-black/60" />
            <div className="pointer-events-none absolute inset-x-0 bottom-3.5 p-3.5 sm:p-5 lg:hidden">
              <h1 className="font-bold leading-tight tracking-tight text-white text-sm sm:text-base">
                {title}
              </h1>
              {slogan ? (
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-white/90 sm:text-[13px]">
                  {slogan}
                </p>
              ) : null}
              {highlights?.length ? (
                <div className="mt-3 flex flex-nowrap items-center gap-1.5 sm:gap-2" aria-label="Keunggulan model">
                  {highlights.map((item) => (
                    <span
                      key={item.label}
                      className="inline-flex min-w-0 flex-1 items-center justify-center truncate whitespace-nowrap rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-foreground sm:px-2.5 sm:text-[11px]"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {thumbs.length > 1 ? (
              <div className="absolute inset-x-0 bottom-1.5 flex items-center justify-center">
                {thumbs.map((thumb, index) => (
                  <button
                    key={`dot-${index}-${thumb.id}`}
                    type="button"
                    onClick={() => goSlide(index)}
                    aria-label={`Foto ${index + 1}`}
                    className="relative flex size-6 items-center justify-center rounded-full"
                  >
                    <span
                      className={cn(
                        "h-1 rounded-full transition-[width] duration-300",
                        index === active ? "w-4 bg-white" : "w-1 bg-white/50 hover:bg-white/80",
                      )}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Kanan: judul + deskripsi + statistik (desktop) */}
        <div className="min-w-0 px-2.5 sm:px-4 lg:px-0 lg:pt-3">
          <h1 className="hidden text-xl font-bold leading-tight tracking-tight text-foreground lg:block">
            {title}
          </h1>
          {highlights?.length ? (
            <div className="mt-3 hidden flex-wrap gap-2.5 lg:flex" aria-label="Keunggulan model">
              {highlights.map((item) => (
                <span
                  key={item.label}
                  className={buttonVariants({ variant: "tertiary", size: "sm" }) + " !min-h-0 cursor-default py-1.5 font-medium"}
                >
                  {item.label}
                </span>
              ))}
            </div>
          ) : null}
          {description ? (
            <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-muted-foreground lg:block">
              {description}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 lg:mt-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-surface px-2 py-3"
              >
                <span className="text-base font-bold leading-tight tracking-tight text-foreground">
                  {stat.value}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
          {hubHref ? (
            <a
              href={hubHref}
              className="mt-4 hidden text-xs font-semibold text-primary hover:underline lg:inline-block"
            >
              Lihat semua model
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}