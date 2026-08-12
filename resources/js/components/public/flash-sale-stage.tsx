import { Link, usePage } from "@inertiajs/react"
import { Lightning } from "@phosphor-icons/react"
import * as React from "react"

import { ProductCard } from "@/components/public/product-card"
import { Icon } from "@/components/shared/icon"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { FlashSalePeriod, ProductCardData, SelectOption, SharedPageProps } from "@/types"

/** Sort chips for `/flash-sale` — maps to existing `?sort=` contract (+ `terlaris` alias). */
export const FLASH_SALE_SORT_OPTIONS = [
  { value: "popular", label: "Populer" },
  { value: "newest", label: "Terbaru" },
  { value: "terlaris", label: "Terlaris" },
] as const

function useFlashSalePeriod(override?: FlashSalePeriod | null): FlashSalePeriod | null {
  const shared = usePage<SharedPageProps>().props.flashSalePeriod
  return override ?? shared ?? null
}

const DAY_MS = 86_400_000

/** Daily Flash Sale deadline; rolls to next midnight while campaign is still live. */
function useDailyFlashSaleCountdown(period: FlashSalePeriod | null | undefined): number | null {
  const [remaining, setRemaining] = React.useState<number | null>(null)
  const dailyEndsAt = period?.daily_ends_at ?? null

  React.useEffect(() => {
    if (period?.live !== true || !dailyEndsAt) {
      // Reset the timer when the server turns the campaign off.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemaining(null)
      return
    }

    const tick = () => {
      const now = Date.now()
      const campaignEndMs = period.ends_at ? new Date(period.ends_at).getTime() : null

      if (campaignEndMs !== null && now >= campaignEndMs) {
        setRemaining(null)
        return
      }

      let deadlineMs = new Date(dailyEndsAt).getTime()

      while (deadlineMs <= now) {
        if (campaignEndMs !== null && deadlineMs >= campaignEndMs) {
          setRemaining(null)
          return
        }
        deadlineMs += DAY_MS
      }

      const effectiveEndMs =
        campaignEndMs !== null ? Math.min(deadlineMs, campaignEndMs) : deadlineMs
      setRemaining(Math.max(0, Math.floor((effectiveEndMs - now) / 1000)))
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [dailyEndsAt, period?.ends_at, period?.live])

  return remaining
}

function formatHms(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":")
}

/** Timer nav Flash Sale — hh:mm:ss, kuning 50%, italic; hidden bila tidak live. */
export function FlashSaleNavCountdown({
  period,
  className,
}: {
  period?: FlashSalePeriod | null
  className?: string
}) {
  const resolved = useFlashSalePeriod(period)
  const remaining = useDailyFlashSaleCountdown(resolved)

  if (resolved?.live !== true || remaining === null || remaining <= 0) {
    return null
  }

  const display = formatHms(remaining)
  const [hours, minutes, seconds] = display.split(":")

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-baseline gap-1.5 font-semibold italic tabular-nums tracking-tight text-[#FFB020]/50",
        className,
      )}
      aria-live="polite"
      aria-label={`Berakhir dalam ${hours} jam ${minutes} menit ${seconds} detik`}
    >
      <span>{hours}</span>
      <span className="opacity-70" aria-hidden>
        :
      </span>
      <span>{minutes}</span>
      <span className="opacity-70" aria-hidden>
        :
      </span>
      <span>{seconds}</span>
    </span>
  )
}

function useCountdown(secondsRemaining: number | null | undefined): number | null {
  const [remaining, setRemaining] = React.useState<number | null>(
    typeof secondsRemaining === "number" ? secondsRemaining : null,
  )

  React.useEffect(() => {
    if (typeof secondsRemaining !== "number") {
      // The timer state mirrors the incoming server deadline.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemaining(null)
      return
    }
    const startedAt = Date.now()
    setRemaining(secondsRemaining)
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setRemaining(Math.max(0, secondsRemaining - elapsed))
    }, 1000)
    return () => window.clearInterval(id)
  }, [secondsRemaining])

  return remaining
}

function splitCountdown(totalSeconds: number): {
  days: number
  hours: number
  minutes: number
  seconds: number
} {
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

function FlashSaleBolt({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden>
      <Lightning
        weight="fill"
        className="size-full text-white drop-shadow-[1px_2px_0_rgba(80,20,0,0.35)]"
      />
    </span>
  )
}

/** Marketplace countdown: HH : MM : SS dalam digibox (harian 0–23 jam, atau total periode). */
export function FlashSaleCountdownClock({
  secondsRemaining,
  label = "Berakhir dalam",
  daily = false,
  size = "lg",
  className,
}: {
  secondsRemaining: number | null
  label?: string
  daily?: boolean
  size?: "sm" | "lg"
  className?: string
}) {
  const remaining = useCountdown(secondsRemaining)

  if (remaining === null) {
    return null
  }

  const parts = splitCountdown(remaining)
  const displayHours = daily ? parts.hours : parts.days * 24 + parts.hours
  const units = [
    { value: displayHours, key: "hours" },
    { value: parts.minutes, key: "minutes" },
    { value: parts.seconds, key: "seconds" },
  ]

  const digitClass = size === "sm"
    ? "min-w-[1.8rem] px-1 py-0.5 text-sm sm:min-w-[2.25rem] sm:text-base"
    : "min-w-[2.25rem] px-1.5 py-1 text-base sm:min-w-[2.75rem] sm:px-2 sm:py-1.5 sm:text-xl lg:min-w-[3.25rem] lg:text-2xl"
  const colonClass = size === "sm"
    ? "text-sm sm:text-base"
    : "text-base sm:text-xl"

  return (
    <div
      className={cn("flex shrink-0 items-center gap-1 sm:gap-1.5", className)}
      aria-live="polite"
      aria-label={`${label}: ${displayHours} jam ${parts.minutes} menit ${parts.seconds} detik`}
    >
      {units.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? (
            <span
              className={cn("px-0.5 font-display font-extrabold leading-none text-white", colonClass)}
              aria-hidden
            >
              :
            </span>
          ) : null}
          <span className={cn("inline-flex items-center justify-center rounded-md bg-black font-display font-extrabold leading-none tabular-nums tracking-tight text-white", digitClass)}>
            {String(item.value).padStart(2, "0")}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

/** Shared Signal Red marketplace banner (Flash Sale page + Promo strip). */
export function FlashSaleRedBanner({
  period,
  compact = false,
}: {
  period?: FlashSalePeriod | null
  compact?: boolean
  /** @deprecated subtitle banner dihapus; prop diabaikan agar call site lama aman */
  subtitle?: string
}) {
  const resolved = useFlashSalePeriod(period)
  const isLive = resolved?.live === true
  const isScheduled = resolved?.status === "scheduled"
  // Saat live: countdown harian (reset tiap hari), bukan total sisa periode kampanye.
  const dailyRemaining = useDailyFlashSaleCountdown(resolved)
  const countdownSeconds = isLive
    ? dailyRemaining
    : isScheduled
      ? (resolved?.seconds_remaining ?? null)
      : null

  return (
    <div className="bg-primary text-white">
      <div
        className={cn(
          "container-page flex items-center gap-3 sm:gap-6",
          compact ? "py-3.5 sm:py-4" : "py-4 sm:py-5",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-4">
          <FlashSaleBolt className={compact ? "size-16 sm:size-20 -my-4" : "size-20 sm:size-28 lg:size-32 -my-6"} />
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <h1
              className={cn(
                "min-w-0 font-display font-extrabold italic leading-none tracking-tight",
                compact ? "text-xl sm:text-3xl" : "text-[1.65rem] sm:text-3xl lg:text-4xl",
              )}
            >
              Flash Sale
            </h1>
            {countdownSeconds !== null ? (
              <FlashSaleCountdownClock
                secondsRemaining={countdownSeconds}
                daily={isLive}
                label={isScheduled ? "Dimulai dalam" : "Berakhir dalam"}
                size={compact ? "sm" : "lg"}
              />
            ) : null}
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <p className="text-xs font-medium leading-snug text-white/90 sm:text-sm">
            {resolved?.live ? "Penawaran terbatas, khusus hari ini!" : resolved?.status === "scheduled" ? "Flash Sale segera dimulai." : ""}
          </p>
          <Link
            href={routeUrl("catalog.flash-sale")}
            className="inline-flex h-8 shrink-0 items-center gap-1 text-xs font-light text-white/90 transition hover:text-white"
          >
            Lihat semua →
          </Link>
        </div>

        {countdownSeconds !== null ? null : resolved?.ends_at_label || resolved?.starts_at_label ? (
          <p className="max-w-[11rem] text-right text-xs font-medium leading-snug text-white/90 sm:max-w-xs sm:text-sm">
            {resolved.status === "ended"
              ? `Berakhir ${resolved.ends_at_label}`
              : resolved.range_label}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** Flash Sale page hero: breadcrumbs + Signal Red marketplace banner. */
export function FlashSaleHero({
  period,
}: {
  productCount?: number
  searchQuery?: string
  actions?: React.ReactNode
  period?: FlashSalePeriod | null
}) {
  const resolved = useFlashSalePeriod(period)

  return (
    <section className="bg-white">
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <Breadcrumbs
          items={[
            { label: "Home", href: routeUrl("home") },
            { label: "Promo", href: routeUrl("catalog.promo") },
            { label: "Flash Sale" },
          ]}
        />
      </div>

      <FlashSaleRedBanner period={resolved} />
    </section>
  )
}

/** Kept for admin/shared period labels outside the red banner. */
export function FlashSalePeriodBadge({
  period,
  tone = "onLight",
}: {
  period?: FlashSalePeriod | null
  tone?: "onDark" | "onLight"
}) {
  const resolved = useFlashSalePeriod(period)
  const remaining = useCountdown(
    resolved?.status === "live" || resolved?.status === "scheduled"
      ? resolved.seconds_remaining
      : null,
  )

  if (!resolved || resolved.status === "disabled") {
    return (
      <p className={cn("text-sm font-medium", tone === "onDark" ? "text-white/70" : "text-muted-foreground")}>
        Flash Sale sedang disiapkan. Pantau pengumuman atau lihat promo yang sedang berjalan.
      </p>
    )
  }

  if (resolved.status === "scheduled") {
    return (
      <div className="space-y-1">
        <p className={cn("text-sm font-semibold", tone === "onDark" ? "text-white" : "text-foreground")}>
          Dimulai {resolved.starts_at_label ?? "segera"}
        </p>
        {remaining !== null ? (
          <FlashSaleCountdownClock
            secondsRemaining={remaining}
            label="Dimulai dalam:"
            className={tone === "onDark" ? undefined : "!text-foreground [&_p]:!text-muted-foreground"}
          />
        ) : null}
      </div>
    )
  }

  if (resolved.status === "ended") {
    return (
      <p className={cn("text-sm font-semibold", tone === "onDark" ? "text-white/80" : "text-muted-foreground")}>
        Periode berakhir {resolved.ends_at_label ?? ""}
      </p>
    )
  }

  return remaining !== null ? (
    <FlashSaleCountdownClock secondsRemaining={remaining} />
  ) : (
    <p className={cn("text-sm font-semibold", tone === "onDark" ? "text-white" : "text-foreground")}>
      {resolved.range_label}
    </p>
  )
}

/** Model toggles above Flash Sale / Promo gallery (no sidebar). */
export function FlashModelToggles({
  models,
  activeModel,
  onSelect,
  ariaLabel = "Pilih model",
}: {
  models: SelectOption[]
  activeModel?: string | null
  onSelect: (model: string) => void
  ariaLabel?: string
}) {
  if (!models.length) {
    return null
  }

  const current = activeModel ?? ""

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={() => onSelect("")}
        aria-pressed={current === ""}
        className={cn(
          "min-h-10 rounded-full border px-4 text-sm font-semibold transition",
          current === ""
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-white text-foreground hover:border-foreground/35",
        )}
      >
        Semua
      </button>
      {models.map((model) => {
        const selected = current === model.value
        return (
          <button
            key={model.value}
            type="button"
            onClick={() => onSelect(model.value)}
            aria-pressed={selected}
            className={cn(
              "min-h-10 rounded-full border px-4 text-sm font-semibold transition",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-foreground hover:border-foreground/35",
            )}
          >
            {model.label}
          </button>
        )
      })}
    </div>
  )
}

function flashChipClass(active: boolean): string {
  return cn(
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-white text-foreground hover:border-foreground/35",
  )
}

/**
 * Flash Sale listing controls: Populer / Terbaru / Terlaris, filter harga, cari ukuran (`?q=`).
 * Wired to `/flash-sale` query params — not decorative.
 */
export function FlashSaleListingToolbar({
  sort,
  priceMin,
  priceMax,
  searchQuery,
  onSortChange,
  onPriceApply,
  onSearch,
}: {
  sort: string
  priceMin: string
  priceMax: string
  searchQuery: string
  onSortChange: (sort: string) => void
  onPriceApply: (next: { priceMin: string; priceMax: string }) => void
  onSearch: (q: string) => void
}) {
  const resolvedSort = sort && sort !== "" ? sort : "popular"
  const priceActive = Boolean(priceMin || priceMax)
  const [priceOpen, setPriceOpen] = React.useState(false)
  const [draftMin, setDraftMin] = React.useState(priceMin)
  const [draftMax, setDraftMax] = React.useState(priceMax)
  const [searchOpen, setSearchOpen] = React.useState(Boolean(searchQuery.trim()))
  const [draftQuery, setDraftQuery] = React.useState(searchQuery)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    // Filter drafts follow server navigation while remaining editable locally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftMin(priceMin)
    setDraftMax(priceMax)
  }, [priceMin, priceMax])

  React.useEffect(() => {
    // Search draft follows the URL after an Inertia visit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftQuery(searchQuery)
    if (searchQuery.trim()) {
      setSearchOpen(true)
    }
  }, [searchQuery])

  React.useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  function submitSearch(event?: React.FormEvent) {
    event?.preventDefault()
    onSearch(draftQuery.trim())
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Urutkan dan filter Flash Sale">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Urutkan">
          {FLASH_SALE_SORT_OPTIONS.map((option) => {
            const active = resolvedSort === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onSortChange(option.value)}
                className={flashChipClass(active)}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <DropdownMenu
          open={priceOpen}
          onOpenChange={(open) => {
            setPriceOpen(open)
            if (open) {
              setDraftMin(priceMin)
              setDraftMax(priceMax)
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <button type="button" aria-pressed={priceActive} className={flashChipClass(priceActive)}>
              <Icon name="sliders" className="size-3.5" aria-hidden />
              Filter harga
              {priceActive ? (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px] font-bold tabular-nums">•</span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={10}
            className="w-[min(100vw-2rem,18rem)] rounded-xl border border-border bg-surface p-3 shadow-float"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <p className="px-0.5 pb-2 text-xs font-bold tracking-tight text-muted-foreground">
              Rentang harga
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field id="flash-price-min" label="Minimum">
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={draftMin}
                  onChange={(event) => setDraftMin(event.target.value)}
                  placeholder="Rp0"
                  className="rounded-lg"
                />
              </Field>
              <Field id="flash-price-max" label="Maksimum">
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={draftMax}
                  onChange={(event) => setDraftMax(event.target.value)}
                  placeholder="Tanpa batas"
                  className="rounded-lg"
                />
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  setDraftMin("")
                  setDraftMax("")
                  onPriceApply({ priceMin: "", priceMax: "" })
                  setPriceOpen(false)
                }}
              >
                Reset
              </Button>
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => {
                  onPriceApply({ priceMin: draftMin, priceMax: draftMax })
                  setPriceOpen(false)
                }}
              >
                Terapkan
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {!searchOpen ? (
          <button
            type="button"
            aria-label="Cari ukuran spesifik"
            title="Cari ukuran"
            onClick={() => setSearchOpen(true)}
            className={flashChipClass(Boolean(searchQuery.trim()))}
          >
            <Icon name="search" className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only sm:inline">Ukuran</span>
          </button>
        ) : null}
      </div>

      {searchOpen ? (
        <form
          onSubmit={submitSearch}
          className="flex w-full max-w-md items-center gap-2"
          role="search"
          aria-label="Cari ukuran Flash Sale"
        >
          <div className="relative min-w-0 flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchInputRef}
              type="search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Cari ukuran, mis. 60x120"
              className="rounded-full pl-10 pr-10"
              aria-label="Ukuran spesifik"
            />
            {draftQuery || searchQuery ? (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
                aria-label="Hapus pencarian ukuran"
                onClick={() => {
                  setDraftQuery("")
                  onSearch("")
                  setSearchOpen(false)
                }}
              >
                <Icon name="x" className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <Button type="submit" size="sm" className="shrink-0 px-4">
            Cari
          </Button>
          {!searchQuery.trim() ? (
            <button
              type="button"
              className="shrink-0 text-sm font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => {
                setDraftQuery("")
                setSearchOpen(false)
              }}
            >
              Batal
            </button>
          ) : null}
        </form>
      ) : null}
    </div>
  )
}


/** Carousel styles for flash sale strip — same pattern as Home/ProductCardCarousel. */
const flashCarouselTrackClass =
  "scrollbar-x flex min-w-0 snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-3.5 md:pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] [scroll-behavior:auto] data-[dragging=true]:snap-none data-[dragging=true]:cursor-grabbing"

const flashCarouselCardClass =
  "w-[calc((100%-1rem)*6/13)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/3.5)] md:w-[calc((100%-1.5rem)/4)] xl:w-[calc((100%-2rem)/5)]"

const flashCarouselNavBtnClass =
  "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-sm transition hover:scale-105 hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 md:flex md:size-12"

function FlashCarouselNavButton({
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
      className={cn(flashCarouselNavBtnClass, side === "left" ? "md:-left-5" : "md:-right-5")}
    >
      <Icon name={side === "left" ? "caret-left" : "caret-right"} className="size-5 md:size-6" weight="bold" aria-hidden="true" />
    </button>
  )
}

function useFlashCarousel(itemCount: number) {
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
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateControls()) : null
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
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: reduceMotion ? "auto" : "smooth" })
  }

  return { trackRef, trackId, canGoBack, canGoNext, move }
}

/** Compact Flash Sale band ??? horizontal carousel. */
export function PromoFlashSaleSection({
  products,
  period,
}: {
  products: ProductCardData[]
  period?: FlashSalePeriod | null
}) {
  const resolved = useFlashSalePeriod(period)
  const items = products.slice(0, 10)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useFlashCarousel(items.length)

  if (!resolved?.live || !items.length) {
    return null
  }

  return (
    <section className="bg-white">
      <FlashSaleRedBanner period={resolved} compact />

      <div className="container-page pb-6 lg:pb-8">
        <div className="relative mt-0 px-1">
          <div ref={trackRef} id={trackId} className={flashCarouselTrackClass}>
            {items.map((product, index) => (
              <div key={product.id} className={flashCarouselCardClass}>
                <ProductCard
                  product={product}
                  priority={index < 4}
                  emphasis="flash"
                />
              </div>
            ))}
            <div className="flex w-[4.75rem] shrink-0 snap-end items-center justify-center self-stretch px-0.5 md:hidden sm:w-20">
              <Link
                href={routeUrl("catalog.flash-sale")}
                className="inline-flex flex-col items-center justify-center gap-1 text-[#2563EB] transition hover:text-[#1D4ED8] active:scale-95"
                aria-label="Lihat semua"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-full border border-[#2563EB]/40 bg-white text-[#2563EB] shadow-sm transition hover:border-[#2563EB] sm:size-12">
                  <Icon name="arrow-right" className="size-5 sm:size-6" weight="bold" aria-hidden="true" />
                </span>
                <span className="max-w-full text-center text-xs font-semibold leading-tight tracking-tight">
                  Lihat semua
                </span>
              </Link>
            </div>
          </div>
          <FlashCarouselNavButton
            trackId={trackId}
            side="left"
            label="Produk sebelumnya"
            enabled={canGoBack}
            onClick={() => move(-1)}
          />
          <FlashCarouselNavButton
            trackId={trackId}
            side="right"
            label="Produk berikutnya"
            enabled={canGoNext}
            onClick={() => move(1)}
          />
        </div>
      </div>
    </section>
  )
}

export function FlashSaleListingShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("bg-white", className)}>{children}</div>
}
