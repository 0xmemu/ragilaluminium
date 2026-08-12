import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { ProductCard } from "@/components/public/product-card"
import { ProductCardGrid } from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ModelCardData, ProductCardData } from "@/types"

export interface DesignVariantCard {
  value: string
  label: string
  title: string
  image: string
  count: number
  size_count: number
  href: string
  products?: Array<ProductCardData & { card_key?: string; variant_sku?: string }>
}

const carouselNavBtnClass =
  "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground shadow-sm transition hover:scale-105 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:flex md:size-12"

const carouselTrackClass =
  "scrollbar-x flex min-w-0 snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain pb-3.5 md:pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] [scroll-behavior:auto] data-[dragging=true]:snap-none data-[dragging=true]:cursor-grabbing"

const carouselCardClass =
  "w-[calc((100%-1rem)*6/13)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/3.5)] md:w-[calc((100%-1.5rem)/3.25)] xl:w-[calc((100%-2rem)/4)]"

function useHorizontalCarousel(itemCount: number) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const trackId = React.useId()
  const [canGoBack, setCanGoBack] = React.useState(false)
  const [canGoNext, setCanGoNext] = React.useState(itemCount > 3)

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
        side === "left" ? "md:left-2" : "md:right-2",
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

function MobileSeeMoreSlide({ href }: { href: string }) {
  return (
    <div className="flex w-[4.75rem] shrink-0 snap-end items-center justify-center self-stretch px-0.5 md:hidden sm:w-20">
      <Link
        href={href}
        className="inline-flex flex-col items-center justify-center gap-1 text-foreground transition hover:text-primary active:scale-95"
        aria-label="Lihat selengkapnya"
      >
        <span className="inline-flex size-11 items-center justify-center rounded-full border border-foreground/25 bg-white text-foreground shadow-sm transition hover:border-foreground/40 sm:size-12">
          <Icon name="arrow-right" className="size-5 sm:size-6" weight="bold" aria-hidden="true" />
        </span>
        <span className="max-w-full text-center text-xs font-medium leading-tight tracking-tight">
          selengkapnya
        </span>
      </Link>
    </div>
  )
}

function DesignProductRail({
  variant,
}: {
  variant: DesignVariantCard
}) {
  const items = (variant.products ?? []).slice(0, 12)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useHorizontalCarousel(items.length)
  const headingId = `design-rail-${variant.value}`

  if (!items.length) return null

  return (
    <section className="min-w-0" aria-labelledby={headingId}>
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3 sm:mb-4">
        <h3
          id={headingId}
          className="min-w-0 truncate text-[clamp(1rem,4.5vw,1.125rem)] font-bold leading-tight tracking-tight text-foreground"
        >
          {variant.title}
        </h3>
        <Link
          href={variant.href}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-foreground/80 transition hover:text-primary"
        >
          Lihat semua
          <Icon name="arrow-right" className="size-3.5" weight="regular" aria-hidden="true" />
        </Link>
      </div>

      <div className="relative min-w-0">
        <CarouselNavButton
          side="left"
          label={`Geser mundur ${variant.label}`}
          trackId={trackId}
          enabled={canGoBack}
          onClick={() => move(-1)}
        />
        <CarouselNavButton
          side="right"
          label={`Geser maju ${variant.label}`}
          trackId={trackId}
          enabled={canGoNext}
          onClick={() => move(1)}
        />

        <div
          id={trackId}
          ref={trackRef}
          className={carouselTrackClass}
          data-dragging="false"
        >
          {items.map((product) => (
            <div
              key={product.card_key ?? `${product.parent_sku}-${product.short_name ?? product.id}`}
              className={carouselCardClass}
            >
              <ProductCard product={product} titleStyle="model" />
            </div>
          ))}
          <MobileSeeMoreSlide href={variant.href} />
        </div>
      </div>
    </section>
  )
}

export default function ModelDetail({
  model,
  products = [],
  designRails = [],
  designVariants = [],
  hubHref,
}: {
  model: ModelCardData
  products?: ProductCardData[]
  designRails?: DesignVariantCard[]
  designVariants?: DesignVariantCard[]
  hubHref?: string
}) {
  const highlights =
    model.highlights?.length === 3
      ? model.highlights
      : [
          { icon: "sparkle", label: "Tampilan Bersih & Modern" },
          { icon: "sun", label: "Maksimalkan Pencahayaan" },
          { icon: "shield-check", label: "Cocok untuk Berbagai Ruangan" },
        ]

  const modelsHref = hubHref || routeUrl("catalog.index")

  const rails = React.useMemo(() => {
    const source = designRails.length ? designRails : designVariants
    return source.filter((rail) => (rail.products?.length ?? 0) > 0)
  }, [designRails, designVariants])

  return (
    <PublicLayout>
      <Head title={`${model.title} · Model Produk`}>
        <meta
          name="description"
          content={(model.desc || model.subtitle || model.title).slice(0, 155)}
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden py-2 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Model Produk", href: modelsHref },
              { label: model.title, href: null },
            ]}
          />
        </div>
        <div className="container-page">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-foreground">Model Produk</h1>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container-page !px-5 md:!px-8 lg:!px-12">
          <div className="md:grid md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start md:gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
            <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
              <ResponsiveImage
                src={model.image}
                alt={model.title}
                loading="eager"
                fetchPriority="high"
                wrapperClassName="absolute inset-0 size-full !aspect-auto bg-surface-muted"
                className="object-cover"
              />
            </div>

            <div className="min-w-0 pt-5 md:pt-0">
              <h1 className="text-base font-bold leading-tight tracking-tight text-foreground">
                {model.title}
              </h1>
              {model.desc ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-4 sm:text-[15px] sm:leading-7">
                  {model.desc}
                </p>
              ) : null}

              {highlights.length ? (
                <ul
                  className="mt-6 grid grid-cols-3 gap-2.5 sm:mt-8 sm:gap-3"
                  aria-label="Keunggulan model"
                >
                  {highlights.map((item) => (
                    <li
                      key={item.label}
                      className="flex min-h-[5rem] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-white px-2 py-3.5 text-center sm:min-h-[6.25rem] sm:gap-3 sm:px-3 sm:py-5"
                    >
                      <Icon
                        name={item.icon}
                        weight="regular"
                        className="size-6 text-foreground sm:size-8"
                        aria-hidden="true"
                      />
                      <span className="text-[11px] font-medium leading-snug text-foreground/85 sm:text-xs">
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        <div id="produk" className="container-page !px-5 md:!px-8 lg:!px-12 scroll-mt-24 mt-8 border-t border-border pt-6 sm:mt-10 sm:pt-8">
          {rails.length === 1 ? (
            <section aria-labelledby="single-design-heading">
              <div className="mb-3 flex min-w-0 items-center justify-between gap-3 sm:mb-4">
                <h2
                  id="single-design-heading"
                  className="min-w-0 truncate text-[clamp(1rem,4.5vw,1.125rem)] font-bold leading-tight tracking-tight text-foreground"
                >
                  {rails[0].title}
                </h2>
                <Link
                  href={rails[0].href}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-foreground/80 transition hover:text-primary"
                >
                  Lihat semua
                  <Icon name="arrow-right" className="size-3 sm:size-3.5" weight="regular" aria-hidden="true" />
                </Link>
              </div>
              <ProductCardGrid>
                {(products.length ? products : (rails[0].products ?? [])).map((product) => (
                  <ProductCard
                    key={product.card_key ?? `${product.parent_sku}-${product.short_name ?? product.id}`}
                    product={product}
                    titleStyle="model"
                  />
                ))}
              </ProductCardGrid>
            </section>
          ) : rails.length ? (
            <div className="flex flex-col gap-8 sm:gap-10">
              {rails.map((variant) => (
                <DesignProductRail key={variant.value} variant={variant} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="package"
              title="Produk belum tersedia"
              description="Model ini belum punya produk aktif di katalog."
              action={
                <Button asChild>
                  <Link href={modelsHref}>Kembali ke model</Link>
                </Button>
              }
            />
          )}
        </div>
      </section>
    </PublicLayout>
  )
}
