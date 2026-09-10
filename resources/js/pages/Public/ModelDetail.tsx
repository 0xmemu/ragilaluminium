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
import { PageTopBar } from "@/components/public/page-top-bar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { ModelHero } from "@/components/public/model-hero"
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
          className="min-w-0 truncate text-base font-bold leading-tight tracking-tight text-foreground"
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




  return (
    <PublicLayout>
      <Head title={`${model.title} · Model Produk`}>
        <meta
          name="description"
          content={(model.desc || model.subtitle || model.title).slice(0, 155)}
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <PageTopBar
          title="Model Produk"
          breadcrumbs={[
            { label: "Beranda", href: routeUrl("home") },
            { label: "Model Produk", href: modelsHref },
            { label: model.title, href: null },
          ]}
        />
      </section>

            <section className="pb-5">
          <ModelHero
            title={model.title}
            description={model.desc}
            slogan={model.desc}
            highlights={highlights}
            thumbs={heroThumbs}
            stats={[
              { value: rails.length, label: "Varian Model" },
              { value: model.count ?? 0, label: "Produk" },
              { value: "100%", label: "Garansi" },
            ]}
          />

          {/* Konten 1 kolom penuh: varian & produk (carousel 5 kartu) */}
          <div className="container-page !px-2.5 md:!px-8 lg:!px-12 mt-8">
            {rails.length === 1 ? (
              <section aria-labelledby="single-design-heading">
                <div className="mb-3 flex min-w-0 items-center justify-between gap-3 sm:mb-4">
                  <h2
                    id="single-design-heading"
                    className="min-w-0 truncate text-base font-bold leading-tight tracking-tight text-foreground"
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
      </section>
      <ClosingCTASection />
    </PublicLayout>
  )
}
