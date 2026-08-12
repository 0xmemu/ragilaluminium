import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { ModelCard } from "@/components/public/model-card"
import { ProductCard } from "@/components/public/product-card"
import {
  ProductCardGrid,
  ShowcaseCardGrid,
} from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import StorefrontLayout from "@/layouts/storefront-layout"
import { routeUrl } from "@/lib/routes"
import type { ModelCardData, ProductCardData } from "@/types"

export interface StorefrontCategoryConfig {
  slug: string
  code: string
  title: string
  description: string
  hero_image?: string | null
  benefits?: Array<{ icon: string; label: string }>
  all_href: string
}

interface CategoryPageProps {
  config: StorefrontCategoryConfig
  models?: ModelCardData[]
  products?: ProductCardData[]
}

/**
 * Template halaman kategori — SATU file untuk semua kategori. Struktur tidak
 * di-hardcode per produk/kategori: section, judul, deskripsi, hero, benefits,
 * dan link view-all semuanya berasal dari `config` (StorefrontCategoryPages)
 * + data katalog. Tanpa carousel — konten berupa grid model & grid produk,
 * persis gaya homepage.
 */
export default function CategoryPage({
  config,
  models = [],
  products = [],
}: CategoryPageProps) {
  const benefits = config.benefits ?? []
  const heroImage = config.hero_image ?? null

  return (
    <StorefrontLayout activeCategory={config.code}>
      <Head title={config.title}>
        <meta name="description" content={config.description.slice(0, 155)} />
      </Head>

      {/* Hero kategori — pola halaman model (gambar + judul + deskripsi + keunggulan) */}
      <section className="py-5">
        <div className="container-page hidden sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: config.title, href: null },
            ]}
          />
        </div>
        <div className="container-page !px-5 md:!px-8 lg:!px-12">
          <div className="md:grid md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start md:gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
            {heroImage ? (
              <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
                <ResponsiveImage
                  src={heroImage}
                  alt={config.title}
                  loading="eager"
                  fetchPriority="high"
                  wrapperClassName="absolute inset-0 size-full !aspect-auto bg-surface-muted"
                  className="object-cover"
                />
              </div>
            ) : null}

            <div className="min-w-0 pt-5 md:pt-0">
              <h1 className="text-base font-bold leading-tight tracking-tight text-foreground">
                {config.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-4 sm:text-[15px] sm:leading-7">
                {config.description}
              </p>

              {benefits.length ? (
                <ul
                  className="mt-6 grid grid-cols-3 gap-2.5 sm:mt-8 sm:gap-3"
                  aria-label="Keunggulan kategori"
                >
                  {benefits.map((item) => (
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
      </section>

      {/* Section model — grid galeri model (bukan carousel) */}
      {models.length ? (
        <section
          aria-labelledby="category-models-heading"
          className="container-page !px-5 md:!px-8 lg:!px-12 scroll-mt-24 mt-4 border-t border-border pt-6 sm:mt-6 sm:pt-8"
        >
          <div className="mb-4 flex min-w-0 items-center justify-between gap-3 sm:mb-5">
            <h2
              id="category-models-heading"
              className="min-w-0 text-base font-bold leading-tight tracking-tight text-foreground"
            >
              Pilih model {config.title.toLowerCase()}
            </h2>
            <Link
              href={config.all_href}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-[#474747] transition hover:text-[#333333]"
            >
              Lihat semua
              <Icon name="arrow-right" className="size-3 sm:size-3.5" weight="regular" aria-hidden="true" />
            </Link>
          </div>
          <ShowcaseCardGrid>
            {models.map((model) => (
              <ModelCard key={`${model.category}-${model.model}`} model={model} />
            ))}
          </ShowcaseCardGrid>
        </section>
      ) : null}

      {/* Section produk terlaris — grid produk (bukan carousel) */}
      {products.length ? (
        <section
          aria-labelledby="category-products-heading"
          className="container-page !px-5 md:!px-8 lg:!px-12 mt-8 sm:mt-10"
        >
          <div className="mb-4 flex min-w-0 items-center justify-between gap-3 sm:mb-5">
            <h2
              id="category-products-heading"
              className="min-w-0 text-base font-bold leading-tight tracking-tight text-foreground"
            >
              Produk terlaris {config.title.toLowerCase()}
            </h2>
            <Link
              href={config.all_href}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-[#474747] transition hover:text-[#333333]"
            >
              Lihat semua
              <Icon name="arrow-right" className="size-3 sm:size-3.5" weight="regular" aria-hidden="true" />
            </Link>
          </div>
          <ProductCardGrid>
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </ProductCardGrid>
        </section>
      ) : null}

      {!models.length && !products.length ? (
        <section className="container-page !px-5 md:!px-8 lg:!px-12 mt-8">
          <EmptyState
            icon="package"
            title="Produk belum tersedia"
            description="Kategori ini belum punya produk aktif di katalog."
            action={
              <Link
                href={config.all_href}
                className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-semibold text-background"
              >
                Lihat katalog
              </Link>
            }
          />
        </section>
      ) : null}
    </StorefrontLayout>
  )
}
