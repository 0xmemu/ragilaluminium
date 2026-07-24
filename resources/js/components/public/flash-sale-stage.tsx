import { Link, usePage } from "@inertiajs/react"
import { Lightning } from "@phosphor-icons/react"
import * as React from "react"

import { ProductCard } from "@/components/public/product-card"
import { ProductCardGrid } from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { FlashSalePeriod, ProductCardData, SelectOption, SharedPageProps } from "@/types"

function useFlashSalePeriod(override?: FlashSalePeriod | null): FlashSalePeriod | null {
  const shared = usePage<SharedPageProps>().props.flashSalePeriod
  return override ?? shared ?? null
}

function useCountdown(secondsRemaining: number | null | undefined): number | null {
  const [remaining, setRemaining] = React.useState<number | null>(
    typeof secondsRemaining === "number" ? secondsRemaining : null,
  )

  React.useEffect(() => {
    if (typeof secondsRemaining !== "number") {
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
        className="size-full text-[#FFB020] drop-shadow-[2px_3px_0_rgba(120,40,0,0.35)]"
      />
    </span>
  )
}

/** Marketplace countdown: "22 Jam : 19 Menit : 30 Detik" */
export function FlashSaleCountdownClock({
  secondsRemaining,
  label = "Berakhir dalam:",
  className,
}: {
  secondsRemaining: number | null
  label?: string
  className?: string
}) {
  const remaining = useCountdown(secondsRemaining)

  if (remaining === null) {
    return null
  }

  const parts = splitCountdown(remaining)
  const displayHours = parts.days * 24 + parts.hours
  const units = [
    { value: displayHours, unit: "Jam" },
    { value: parts.minutes, unit: "Menit" },
    { value: parts.seconds, unit: "Detik" },
  ]

  return (
    <div className={cn("text-right text-white", className)}>
      <p className="text-xs font-semibold sm:text-sm">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline justify-end gap-x-1 font-display text-lg font-extrabold tabular-nums tracking-tight sm:text-2xl lg:text-3xl">
        {units.map((item, index) => (
          <React.Fragment key={item.unit}>
            {index > 0 ? (
              <span className="px-0.5 font-bold opacity-90" aria-hidden>
                :
              </span>
            ) : null}
            <span>
              <span className="tabular-nums">{String(item.value).padStart(2, "0")}</span>{" "}
              <span className="text-[0.65em] font-bold">{item.unit}</span>
            </span>
          </React.Fragment>
        ))}
      </p>
    </div>
  )
}

/** Shared Signal Red marketplace banner (Flash Sale page + Promo strip). */
export function FlashSaleRedBanner({
  period,
  compact = false,
  subtitle = "PENAWARAN TERBATAS",
}: {
  period?: FlashSalePeriod | null
  compact?: boolean
  subtitle?: string
}) {
  const resolved = useFlashSalePeriod(period)
  const isLive = resolved?.live === true
  const isScheduled = resolved?.status === "scheduled"
  const countdownSeconds =
    isLive || isScheduled ? (resolved?.seconds_remaining ?? null) : null

  let statusLine = subtitle
  if (!resolved || resolved.status === "disabled") {
    statusLine = "PERIODE BELUM AKTIF"
  } else if (resolved.status === "ended") {
    statusLine = "PERIODE BERAKHIR"
  } else if (isScheduled) {
    statusLine = "SEGERA DIMULAI"
  }

  return (
    <div className="relative overflow-hidden bg-primary text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_80%_40%,rgba(255,255,255,0.18),transparent_62%)]"
      />
      <div
        className={cn(
          "container-page relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
          compact ? "py-4 sm:py-5" : "py-5 sm:py-6 lg:py-7",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
          <FlashSaleBolt className={compact ? "size-9 sm:size-14" : "size-10 sm:size-16 lg:size-20"} />
          <div className="min-w-0">
            <h1
              className={cn(
                "font-display font-extrabold italic tracking-tight",
                compact ? "text-2xl sm:text-4xl" : "text-2xl sm:text-5xl lg:text-6xl",
              )}
            >
              FLASH SALE
            </h1>
            <p
              className={cn(
                "mt-0.5 font-semibold uppercase tracking-tight text-white/95",
                compact ? "text-[11px] sm:text-sm" : "text-xs sm:text-base",
              )}
            >
              {statusLine}
            </p>
          </div>
        </div>

        {countdownSeconds !== null ? (
          <FlashSaleCountdownClock
            secondsRemaining={countdownSeconds}
            label={isScheduled ? "Dimulai dalam:" : "Berakhir dalam:"}
            className="sm:min-w-[16rem]"
          />
        ) : resolved?.ends_at_label || resolved?.starts_at_label ? (
          <p className="max-w-xs text-right text-sm font-semibold text-white/95 sm:text-base">
            {resolved.status === "ended"
              ? `Berakhir ${resolved.ends_at_label}`
              : resolved.range_label}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function FlashSaleSectionIntro({
  period,
  productCount,
  searchQuery,
  showSeeAll = false,
}: {
  period?: FlashSalePeriod | null
  productCount?: number
  searchQuery?: string
  showSeeAll?: boolean
}) {
  const resolved = useFlashSalePeriod(period)
  const remaining = useCountdown(
    resolved?.live ? resolved.seconds_remaining : null,
  )
  const endsToday = remaining !== null && remaining > 0 && remaining < 86400

  const accent = endsToday ? "khusus hari ini!" : "selagi periode berlangsung!"
  const lead = resolved?.live
    ? "Penawaran terbatas,"
    : resolved?.status === "scheduled"
      ? "Flash Sale segera dimulai."
      : resolved?.status === "ended"
        ? "Periode Flash Sale sudah berakhir."
        : "Flash Sale sedang disiapkan."

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {resolved?.live ? (
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {lead}{" "}
            <span className="text-primary">{accent}</span>
          </h2>
        ) : (
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{lead}</h2>
        )}
        {resolved?.live && typeof productCount === "number" ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(productCount)} produk
            {searchQuery ? ` untuk “${searchQuery}”` : ""} dalam Flash Sale
          </p>
        ) : null}
      </div>
      {showSeeAll ? (
        <Link
          href={routeUrl("catalog.flash-sale")}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary transition hover:text-primary/80"
        >
          Lihat Semua
          <Icon name="caret-right" className="size-4" weight="bold" aria-hidden />
        </Link>
      ) : null}
    </div>
  )
}

/** Flash Sale page hero: breadcrumbs + Signal Red marketplace banner + intro. */
export function FlashSaleHero({
  productCount,
  searchQuery,
  period,
}: {
  productCount: number
  searchQuery?: string
  actions?: React.ReactNode
  period?: FlashSalePeriod | null
}) {
  const resolved = useFlashSalePeriod(period)

  return (
    <section className="bg-white">
      <div className="container-page py-4 lg:py-5">
        <Breadcrumbs
          items={[
            { label: "Home", href: routeUrl("home") },
            { label: "Semua Model Produk", href: routeUrl("catalog.index") },
            { label: "Flash Sale" },
          ]}
        />
      </div>

      <FlashSaleRedBanner period={resolved} />

      <div className="container-page py-5 lg:py-6">
        <FlashSaleSectionIntro
          period={resolved}
          productCount={productCount}
          searchQuery={searchQuery}
        />
      </div>
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

/** Compact Flash Sale band embedded on Promo page. */
export function PromoFlashSaleSection({
  products,
  period,
}: {
  products: ProductCardData[]
  period?: FlashSalePeriod | null
}) {
  const resolved = useFlashSalePeriod(period)

  if (!resolved?.live || !products.length) {
    return null
  }

  return (
    <section className="bg-white">
      <FlashSaleRedBanner period={resolved} compact />

      <div className="container-page py-6 lg:py-8">
        <FlashSaleSectionIntro period={resolved} showSeeAll />

        <div className="mt-5">
          <ProductCardGrid>
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={index < 4}
                emphasis="flash"
              />
            ))}
          </ProductCardGrid>
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
