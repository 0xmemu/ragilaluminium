import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { CategoryMenu, type CategoryMenuItem } from "@/components/public/category-menu"
import { InstallationCard } from "@/components/public/installation-card"
import { ProductCardCarousel } from "@/components/public/home-carousels"
import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { InstallationItem, ModelCardData, ProductCardData } from "@/types"

export interface DesignRailMeta {
  value: string
  label: string
  title: string
  image: string
  count: number
  size_count: number
  href: string
}

interface ModelLandingProps {
  model: ModelCardData
  promos?: ProductCardData[]
  designs?: DesignRailMeta[]
  /** Ukuran unik model (T×P) — kartu produk per varian, termurah. */
  sizes?: ProductCardData[]
  documentation?: InstallationItem[]
  products?: ProductCardData[]
  categoryMenu?: CategoryMenuItem[]
  allHref: string
}

function categorySlug(code?: string | null): string {
  if (code === "DOOR") return "doors"
  if (code === "BOUVEN") return "bouven"
  return "windows"
}

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
    <div className="mb-3 flex min-w-0 items-center justify-between gap-3 sm:mb-4">
      <h2
        id={id}
        className="min-w-0 text-[clamp(1rem,4.5vw,1.125rem)] font-bold leading-tight tracking-tight text-foreground"
      >
        {title}
      </h2>
      {actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-[#474747] transition hover:text-[#333333]"
        >
          {actionLabel}
          <Icon name="arrow-right" className="size-3 sm:size-3.5" weight="regular" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  )
}

function DesignTile({ design }: { design: DesignRailMeta }) {
  return (
    <Link
      href={design.href}
      prefetch
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(10,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-border/60 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
        <ResponsiveImage
          src={design.image}
          alt={design.title}
          wrapperClassName="absolute inset-0 size-full bg-surface-muted"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 p-2.5">
        <span className="min-w-0 truncate text-[13px] font-semibold leading-tight text-foreground">
          {design.label}
        </span>
        <span className="text-[11px] leading-tight text-muted-foreground">
          {design.count} produk · {design.size_count} ukuran
        </span>
      </div>
    </Link>
  )
}

function SizeTile({ size }: { size: ProductCardData }) {
  const price = size.min_price !== null && size.min_price !== undefined ? Number(size.min_price) : null
  const compare =
    size.compare_price !== null && size.compare_price !== undefined ? Number(size.compare_price) : null
  const dims = (size.short_name || size.name || "")
    .replace(/\s+/g, "")
    .replace("x", " × ")
    .replace("X", " × ")

  return (
    <Link
      href={size.href}
      prefetch
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(10,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-border/60 hover:shadow-[0_10px_24px_rgba(10,0,0,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
        <ResponsiveImage
          src={size.image}
          alt={size.name}
          wrapperClassName="absolute inset-0 size-full bg-surface-muted"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        {size.discount_percent ? (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
            -{size.discount_percent}%
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1 p-2.5">
        <span className="min-w-0 truncate text-[13px] font-semibold leading-tight text-foreground">
          {dims || "Ukuran custom"}
        </span>
        {price !== null ? (
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span className="text-[13px] font-bold tabular-nums text-foreground">
              {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price)}
            </span>
            {compare && compare > price ? (
              <span className="text-[11px] text-muted-foreground line-through">
                {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(compare)}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </Link>
  )
}

/**
 * Halaman landing satu model (tujuan pill nav kategori) — layout ala homepage
 * Zalora: card-card promo + carousel minimal. Data per model: promo, desain,
 * ukuran, dokumentasi, dan seluruh produk — satu template untuk semua model,
 * tidak ada halaman khusus per model.
 */
export default function ModelLanding({
  model,
  promos = [],
  designs = [],
  sizes = [],
  documentation = [],
  products = [],
  categoryMenu = [],
  allHref,
}: ModelLandingProps) {
  const activeKey = model.category && model.model ? `${model.category}|${model.model}` : null
  // Label pendek dari pill menu (mis. "Boven Jungkit"), bukan nama lengkap CMS.
  const shortTitle =
    categoryMenu.find((item) => item.key === activeKey)?.label ?? model.title
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
      category: categorySlug(model.category),
      model: model.model.toLowerCase().replace(/_/g, "-"),
    })
  const hasDocs = documentation.length > 0

  return (
    <PublicLayout>
      <Head title={`${model.title} · Model Produk`}>
        <meta
          name="description"
          content={(model.desc || model.subtitle || model.title).slice(0, 155)}
        />
      </Head>

      <CategoryMenu items={categoryMenu} activeKey={activeKey} />

      {/* Hero — kartu model: gambar + judul + deskripsi + keunggulan + CTA */}
      <section className="py-5">
        <div className="container-page !px-5 md:!px-8 lg:!px-12">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="md:grid md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:items-stretch lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
              <div className="relative aspect-square w-full overflow-hidden bg-surface-muted md:aspect-auto md:h-full">
                <ResponsiveImage
                  src={model.image}
                  alt={model.title}
                  loading="eager"
                  fetchPriority="high"
                  wrapperClassName="absolute inset-0 size-full !aspect-auto bg-surface-muted"
                  className="object-cover"
                />
              </div>

              <div className="flex min-w-0 flex-col p-5 sm:p-6 lg:p-8">
                <h1 className="text-base font-bold leading-tight tracking-tight text-foreground">
                  {model.title}
                </h1>
                {model.subtitle ? (
                  <p className="mt-1 text-[13px] font-medium text-primary">{model.subtitle}</p>
                ) : null}
                {model.desc ? (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {model.desc}
                  </p>
                ) : null}

                <ul
                  className="mt-5 grid grid-cols-3 gap-2.5 sm:mt-6 sm:gap-3"
                  aria-label="Keunggulan model"
                >
                  {highlights.map((item) => (
                    <li
                      key={item.label}
                      className="flex min-h-[4.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-white px-2 py-3 text-center sm:min-h-[5.5rem] sm:gap-3 sm:px-3 sm:py-4"
                    >
                      <Icon
                        name={item.icon}
                        weight="regular"
                        className="size-6 text-foreground sm:size-7"
                        aria-hidden="true"
                      />
                      <span className="text-[11px] font-medium leading-snug text-foreground/85 sm:text-xs">
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap items-center gap-2.5 sm:mt-8">
                  <Link
                    href={allHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Lihat semua produk
                  </Link>
                  {hasDocs ? (
                    <a
                      href="#dokumentasi"
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-white px-5 text-sm font-semibold text-foreground transition hover:border-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      Lihat dokumentasi
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Promo model — carousel minimal kartu berdiskon */}
      {promos.length ? (
        <section
          aria-labelledby="model-promo-heading"
          className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]"
        >
          <SectionHeader id="model-promo-heading" title={`Promo ${shortTitle}`} actionHref={allHref} />
          <ProductCardCarousel products={promos} seeMoreHref={allHref} />
        </section>
      ) : null}

      {/* Desain model — kartu grid (bukan carousel) */}
      {designs.length ? (
        <section
          aria-labelledby="model-designs-heading"
          className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]"
        >
          <SectionHeader id="model-designs-heading" title={`Pilih desain ${shortTitle.toLowerCase()}`} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {designs.map((design) => (
              <DesignTile key={design.value} design={design} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Ukuran tersedia — kartu ukuran */}
      {sizes.length ? (
        <section
          aria-labelledby="model-sizes-heading"
          className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]"
        >
          <SectionHeader id="model-sizes-heading" title={`Ukuran tersedia ${shortTitle.toLowerCase()}`} actionHref={allHref} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {sizes.map((size) => (
              <SizeTile key={size.card_key ?? size.id} size={size} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Dokumentasi model — foto/video pemasangan */}
      {hasDocs ? (
        <section
          id="dokumentasi"
          aria-labelledby="model-docs-heading"
          className="container-page !px-5 md:!px-8 lg:!px-12 scroll-mt-24 py-[10px]"
        >
          <SectionHeader
            id="model-docs-heading"
            title={`Dokumentasi ${shortTitle.toLowerCase()}`}
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

      {/* Semua produk model — carousel minimal */}
      {products.length ? (
        <section
          aria-labelledby="model-products-heading"
          className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]"
        >
          <SectionHeader id="model-products-heading" title={`Semua produk ${shortTitle.toLowerCase()}`} actionHref={allHref} />
          <ProductCardCarousel products={products} seeMoreHref={allHref} />
        </section>
      ) : null}
    </PublicLayout>
  )
}
