import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { CategoryMenu, type CategoryMenuItem } from "@/components/public/category-menu"
import { ProductCardCarousel } from "@/components/public/home-carousels"
import { InstallationCard } from "@/components/public/installation-card"
import { ModelCard } from "@/components/public/model-card"
import { ProductCard } from "@/components/public/product-card"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { routeUrl } from "@/lib/routes"
import PublicLayout from "@/layouts/public-layout"
import type { InstallationItem, ModelCardData, ProductCardData, SharedPageProps } from "@/types"

export interface SegmentDesign {
  value: string
  label: string
  title: string
  image: string
  count: number
  size_count: number
  href: string
}

interface SegmentLandingProps {
  segment: string
  model: ModelCardData
  promos?: ProductCardData[]
  designs?: SegmentDesign[]
  bestSellers?: ProductCardData[]
  products?: ProductCardData[]
  documentation?: InstallationItem[]
  relatedModels?: ModelCardData[]
  categoryMenu?: CategoryMenuItem[]
  allHref: string
}

const CONTAINER = "container-page !px-5 md:!px-8 lg:!px-12"

/** Heading section — hierarchy jelas, spacing konsisten dengan homepage. */
function SectionHeader({
  id,
  title,
  actionHref,
  actionLabel = "Lihat semua",
}: {
  id: string
  title: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className="mb-3 flex min-w-0 items-end justify-between gap-3 sm:mb-4">
      <h2
        id={id}
        className="min-w-0 text-[clamp(1.0625rem,3.5vw,1.25rem)] font-bold leading-tight tracking-tight text-foreground"
      >
        {title}
      </h2>
      {actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-[#474747] transition hover:text-[#333333]"
        >
          {actionLabel}
          <Icon name="arrow-right" className="size-3 sm:size-3.5" weight="regular" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  )
}

/** Kartu submodel/desain — gambar besar + label + statistik. */
function DesignCard({ design }: { design: SegmentDesign }) {
  return (
    <Link
      href={design.href}
      prefetch
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_3px_rgba(10,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-border/60 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
        <ResponsiveImage
          src={design.image}
          alt={design.title}
          wrapperClassName="absolute inset-0 size-full bg-surface-muted"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 p-3">
        <span className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
          {design.label}
        </span>
        <span className="text-xs leading-tight text-muted-foreground">
          {design.count} produk · {design.size_count} ukuran
        </span>
      </div>
    </Link>
  )
}

/** Overlay loading halus saat pindah segment (partial reload halaman yang sama). */
function SegmentProgress() {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const start = () => setVisible(true)
    const finish = () => {
      // beri jeda kecil supaya indikator terlihat walau respons sangat cepat
      window.setTimeout(() => setVisible(false), 250)
    }
    window.addEventListener("inertia:start", start)
    window.addEventListener("inertia:finish", finish)
    return () => {
      window.removeEventListener("inertia:start", start)
      window.removeEventListener("inertia:finish", finish)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-0.5 overflow-hidden bg-primary/15"
      aria-hidden="true"
    >
      <div className="h-full w-1/3 animate-pulse bg-primary" />
    </div>
  )
}

/**
 * Landing segment dinamis — SATU template reusable untuk semua segment pill.
 * Pill dipilih -> partial reload di halaman yang sama (URL /segment?segment=slug),
 * isi landing berganti per segment. Data murni dari sumber yang sudah ada
 * (produk, kategori, model, hasil pemasangan); tidak ada duplikasi data.
 */
export default function SegmentLanding({
  segment,
  model,
  promos = [],
  designs = [],
  bestSellers = [],
  products = [],
  documentation = [],
  relatedModels = [],
  categoryMenu = [],
  allHref,
}: SegmentLandingProps) {
  const activeKey = model.category && model.model ? `${model.category}|${model.model}` : null
  const shortTitle = categoryMenu.find((item) => item.key === activeKey)?.label ?? model.title
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null

  const highlights =
    model.highlights?.length === 3
      ? model.highlights
      : [
          { icon: "sparkle", label: "Tampilan Bersih & Modern" },
          { icon: "sun", label: "Maksimalkan Pencahayaan" },
          { icon: "shield-check", label: "Kokoh untuk Sehari-hari" },
        ]

  const docHref =
    model.inspiration_href ??
    routeUrl("installation.model", {
      category: model.category === "DOOR" ? "doors" : model.category === "BOUVEN" ? "bouven" : "windows",
      model: model.model.toLowerCase().replace(/_/g, "-"),
    })

  return (
    <PublicLayout>
      <Head title={`${model.title} · Model Produk`}>
        <meta
          name="description"
          content={(model.desc || model.subtitle || model.title).slice(0, 155)}
        />
      </Head>

      <SegmentProgress />

      {/* Segment tab — pill aktif; memilih pill lain mengganti isi halaman ini */}
      <CategoryMenu items={categoryMenu} activeKey={activeKey} />

      {/* 1 + 2. Hero/banner segment — editorial, bukan salinan Zalora */}
      <section className="relative isolate overflow-hidden bg-foreground text-background">
        {model.image ? (
          <ResponsiveImage
            src={model.image}
            alt={model.title}
            loading="eager"
            fetchPriority="high"
            wrapperClassName="absolute inset-0 size-full bg-foreground"
            className="object-cover opacity-30"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" aria-hidden="true" />

        <div className={`${CONTAINER} relative py-12 sm:py-16 lg:py-20`}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-background/30 bg-background/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-background/90 backdrop-blur-sm">
            <Icon name="package" className="size-3.5" aria-hidden="true" />
            Segment {shortTitle}
          </span>
          <h1 className="mt-4 max-w-2xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
            {model.title}
          </h1>
          {model.subtitle ? (
            <p className="mt-2 text-sm font-medium text-primary">{model.subtitle}</p>
          ) : null}
          {model.desc ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-background/80 sm:text-[15px] sm:leading-7">
              {model.desc}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Button asChild>
              <Link href={allHref}>Lihat semua produk</Link>
            </Button>
            {whatsappUrl ? (
              <Button asChild variant="secondary">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                  Konsultasi WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {/* 6. Benefit / keunggulan segment */}
      <section className={`${CONTAINER} py-[10px]`} aria-label="Keunggulan segment">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {highlights.map((item) => (
            <div
              key={item.label}
              className="flex min-h-[5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-white px-2 py-4 text-center shadow-[0_1px_3px_rgba(10,0,0,0.06)] sm:min-h-[6.25rem] sm:gap-3 sm:px-4 sm:py-5"
            >
              <Icon name={item.icon} weight="regular" className="size-6 text-primary sm:size-7" aria-hidden="true" />
              <span className="text-[11px] font-medium leading-snug text-foreground sm:text-xs">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Submodel produk segment (desain) */}
      {designs.length ? (
        <section aria-labelledby="segment-designs-heading" className={`${CONTAINER} py-[10px]`}>
          <SectionHeader id="segment-designs-heading" title={`Jelajahi desain ${shortTitle.toLowerCase()}`} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {designs.map((design) => (
              <DesignCard key={design.value} design={design} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 5. Promosi khusus segment */}
      {promos.length ? (
        <section aria-labelledby="segment-promo-heading" className={`${CONTAINER} py-[10px]`}>
          <SectionHeader id="segment-promo-heading" title={`Promo ${shortTitle}`} actionHref={allHref} />
          <ProductCardCarousel products={promos} seeMoreHref={allHref} />
        </section>
      ) : null}

      {/* 8. Paling banyak dipesan */}
      {bestSellers.length ? (
        <section aria-labelledby="segment-bestsellers-heading" className={`${CONTAINER} py-[10px]`}>
          <SectionHeader
            id="segment-bestsellers-heading"
            title={`Paling banyak dipesan ${shortTitle.toLowerCase()}`}
            actionHref={allHref}
          />
          <ProductCardCarousel products={bestSellers} seeMoreHref={allHref} />
        </section>
      ) : null}

      {/* 4. Product card produk terkait */}
      {products.length ? (
        <section aria-labelledby="segment-products-heading" className={`${CONTAINER} py-[10px]`}>
          <SectionHeader
            id="segment-products-heading"
            title={`Produk ${shortTitle.toLowerCase()}`}
            actionHref={allHref}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.card_key ?? `${product.parent_sku}-${product.short_name ?? product.id}`}
                product={product}
                titleStyle="model"
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Galeri hasil pemasangan */}
      {documentation.length ? (
        <section
          id="dokumentasi"
          aria-labelledby="segment-docs-heading"
          className={`${CONTAINER} scroll-mt-24 py-[10px]`}
        >
          <SectionHeader
            id="segment-docs-heading"
            title={`Hasil pemasangan ${shortTitle.toLowerCase()}`}
            actionHref={docHref}
            actionLabel="Lihat semua dokumentasi"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {documentation.slice(0, 8).map((item) => (
              <InstallationCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 9. Model terkait */}
      {relatedModels.length ? (
        <section aria-labelledby="segment-related-heading" className={`${CONTAINER} py-[10px]`}>
          <SectionHeader id="segment-related-heading" title="Model terkait" actionHref={routeUrl("catalog.index")} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {relatedModels.map((related) => (
              <ModelCard key={`${related.category}-${related.model}`} model={related} showDesc={false} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 10. CTA konsultasi / pesan WhatsApp */}
      <section className={`${CONTAINER} pb-[10px]`}>
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight tracking-tight text-foreground">
              Masih bingung memilih {shortTitle.toLowerCase()}?
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
              Tim kami siap membantu memilih ukuran dan desain yang pas untuk kebutuhan Anda.
            </p>
          </div>
          {whatsappUrl ? (
            <Button asChild className="shrink-0">
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                Pesan via WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </section>
    </PublicLayout>
  )
}
