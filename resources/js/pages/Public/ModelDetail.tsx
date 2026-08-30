import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import {
  MobileEndActionReveal,
  useEndActionReveal,
} from "@/components/public/home-carousels"
import { ProductCard } from "@/components/public/product-card"
import { ProductCardGrid } from "@/components/public/product-card-grid"
import {
  carouselCardClass,
  carouselTrackClass,
  CarouselNavButton,
  useHorizontalCarousel as useRailCarousel,
} from "@/components/public/carousel-controls"
import { ClosingCTASection } from "@/components/public/closing-cta"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { PageHeader } from "@/components/public/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { useDragScroll } from "@/hooks/use-drag-scroll"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ModelCardData, ProductCardData, SharedPageProps } from "@/types"

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



function DesignProductRail({
  variant,
  compact = false,
}: {
  variant: DesignVariantCard
  compact?: boolean
}) {
  const items = (variant.products ?? []).slice(0, 12)
  const { trackRef, trackId, canGoBack, canGoNext, move } = useRailCarousel(items.length)
  const reveal = useEndActionReveal(trackRef)
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
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          Lihat Semua
          <Icon name="arrow-right" className="size-3.5" weight="regular" aria-hidden="true" />
        </Link>
      </div>

      {items.length < 3 ? (
        /* Sub-model dengan produk < 3 → grid produk, bukan carousel. */
        <ProductCardGrid className={compact ? "xl:!grid-cols-2" : undefined}>
          {items.map((product) => (
            <ProductCard
              key={product.card_key ?? `${product.parent_sku}-${product.short_name ?? product.id}`}
              product={product}
              titleStyle="model"
            />
          ))}
        </ProductCardGrid>
      ) : (
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
            style={{
              transform: `translateX(${reveal.revealed ? -76 : -Math.min(reveal.pull * 1.45, 76)}px)`,
              transition: reveal.pull ? "none" : "transform 360ms ease-out",
            }}
            onPointerDown={reveal.onPointerDown}
            onPointerMove={reveal.onPointerMove}
            onPointerUp={reveal.onPointerUp}
            onPointerCancel={reveal.onPointerUp}
          >
            {items.map((product) => (
              <div
                key={product.card_key ?? `${product.parent_sku}-${product.short_name ?? product.id}`}
                className={carouselCardClass}
              >
                <ProductCard product={product} titleStyle="model" />
              </div>
            ))}
          </div>
          {items.length > 0 ? (
            <MobileEndActionReveal href={variant.href} pull={reveal.pull} revealed={reveal.revealed} />
          ) : null}
        </div>
      )}
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

  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? routeUrl("contact")

  const rails = React.useMemo(() => {
    const source = designRails.length ? designRails : designVariants
    return source.filter((rail) => (rail.products?.length ?? 0) > 0)
  }, [designRails, designVariants])

  const heroThumbs = React.useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ id: string; src: string; alt: string; href?: string }> = []
    const push = (src: string | null | undefined, alt: string, href?: string) => {
      if (!src || seen.has(src)) return
      seen.add(src)
      out.push({ id: src, src, alt, href })
    }
    push(model.image, model.title, model.detail_href ?? undefined)
    for (const rail of rails) {
      for (const p of rail.products ?? []) push(p.image, p.name, p.href ?? undefined)
    }
    for (const p of products) push(p.image, p.name, p.href ?? undefined)
    return out.slice(0, 12)
  }, [model, rails, products])

  const heroThumbsRef = React.useRef<HTMLDivElement>(null)
  useDragScroll(heroThumbsRef)
  const [heroActive, setHeroActive] = React.useState(0)

  const handleHeroScroll = React.useCallback(() => {
    const track = heroThumbsRef.current
    if (!track) return
    const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth))
    setHeroActive(Math.max(0, Math.min(heroThumbs.length - 1, index)))
  }, [heroThumbs.length])

  const goHeroSlide = React.useCallback((index: number) => {
    const track = heroThumbsRef.current
    if (!track) return
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" })
  }, [])

  return (
    <PublicLayout>
      <Head title={`${model.title} · Model Produk`}>
        <meta
          name="description"
          content={(model.desc || model.subtitle || model.title).slice(0, 155)}
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center gap-3">
                        <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Model Produk", href: modelsHref },
              { label: model.title, href: null },
            ]}
          />
          </div>
        </div>
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
          <PageHeader title="Model Produk" container={false} className="border-b-0" />
        </div>
      </section>

            <section className="pb-5">
        <div className="container-page !px-0 md:!px-8 lg:!px-12">
          {/* Hero dua kolom: thumb diperkecil (kiri) + deskripsi & statistik (kanan) */}
          <div className="lg:grid lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
            {/* Kiri: thumb + judul + keunggulan */}
            <div>
              <div className="relative mx-auto aspect-square w-full max-w-[28rem] overflow-hidden lg:max-w-none">
                <div
                  ref={heroThumbsRef}
                  onScroll={handleHeroScroll}
                  className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scrollbar-none [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] data-[dragging=true]:cursor-grabbing"
                >
                  {heroThumbs.map((thumb) => (
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

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[170px] bg-gradient-to-b from-transparent to-black/60" />

                <div className="pointer-events-none absolute inset-x-0 bottom-12 p-3.5 sm:p-5 lg:hidden">
                  <h1
                    className={cn(
                      "font-bold leading-tight tracking-tight text-white",
                      "text-sm sm:text-base",
                    )}
                  >
                    {model.title}
                  </h1>

                  {highlights.length ? (
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

                {heroThumbs.length > 1 ? (
                  <div className="absolute inset-x-0 bottom-1.5 flex items-center justify-center">
                    {heroThumbs.map((thumb, index) => (
                      <button
                        key={`dot-${index}-${thumb.id}`}
                        type="button"
                        onClick={() => goHeroSlide(index)}
                        aria-label={`Foto ${index + 1}`}
                        className="relative flex size-6 items-center justify-center rounded-full"
                      >
                        <span
                          className={cn(
                            "h-1 rounded-full transition-all duration-300",
                            index === heroActive ? "w-4 bg-white" : "w-1 bg-white/50 hover:bg-white/80",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Kanan: judul + pill + deskripsi + statistik (desktop) */}
            <div className="min-w-0 lg:pt-3">
              <h1 className="hidden text-xl font-bold leading-tight tracking-tight text-foreground lg:block">
                {model.title}
              </h1>

              {highlights.length ? (
                <div className="mt-3 hidden flex-wrap gap-2.5 lg:flex" aria-label="Keunggulan model">
                  {highlights.map((item) => (
                    <span
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-4 py-2 text-[13px] font-medium text-foreground"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              ) : null}

              {model.desc ? (
                <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-muted-foreground lg:block">
                  {model.desc}
                </p>
              ) : null}

              <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-surface px-2 py-3">
                  <span className="text-base font-bold leading-tight tracking-tight text-foreground">
                    {rails.length}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">Varian Model</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-surface px-2 py-3">
                  <span className="text-base font-bold leading-tight tracking-tight text-foreground">
                    {model.count ?? 0}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">Produk</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-surface px-2 py-3">
                  <span className="text-base font-bold leading-tight tracking-tight text-foreground">100%</span>
                  <span className="text-[10px] font-medium text-muted-foreground">Garansi</span>
                </div>
              </div>
            </div>
          </div>

          {/* Konten 1 kolom penuh: varian & produk (carousel 5 kartu) */}
          <div className="mt-8">
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
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                  >
                    Lihat Semua
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
              <div className="flex flex-col gap-5 sm:gap-6">
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
                    <Link href={modelsHref}>Kembali Ke Model</Link>
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </section>
      <ClosingCTASection />
    </PublicLayout>
  )
}
