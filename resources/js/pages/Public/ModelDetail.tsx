import { Head, Link } from "@inertiajs/react"

import { ProductCard } from "@/components/public/product-card"
import { ProductCardGrid } from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { ModelCardData, ProductCardData } from "@/types"

export default function ModelDetail({
  model,
  products = [],
  hubHref,
  listingHref,
}: {
  model: ModelCardData
  products?: ProductCardData[]
  hubHref?: string
  listingHref?: string
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
  const catalogHref = listingHref || model.href || modelsHref

  return (
    <PublicLayout>
      <Head title={`${model.title} · Model Produk`}>
        <meta
          name="description"
          content={(model.desc || model.subtitle || model.title).slice(0, 155)}
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page py-4 sm:py-5">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Model Produk", href: modelsHref },
              { label: model.title, href: null },
            ]}
          />
        </div>
      </section>

      <section className="container-page pb-8 pt-4 sm:pb-10 sm:pt-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <div className="overflow-hidden bg-surface-muted">
              <ResponsiveImage
                src={model.image}
                alt={model.title}
                loading="eager"
                fetchPriority="high"
                wrapperClassName="aspect-square size-full bg-surface-muted"
                className="object-cover"
              />
            </div>

            <div className="mt-5 px-0.5">
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
                {model.title}
              </h1>
              {model.desc ? (
                <p className="mt-3 text-sm leading-6 text-foreground/80 sm:text-base sm:leading-7">
                  {model.desc}
                </p>
              ) : null}

              <ul className="mt-6 grid grid-cols-3 gap-3" aria-label="Keunggulan model">
                {highlights.map((item) => (
                  <li key={item.label} className="flex flex-col items-center gap-2 text-center">
                    <Icon
                      name={item.icon}
                      weight="regular"
                      className="size-8 text-foreground sm:size-9"
                      aria-hidden="true"
                    />
                    <span className="text-[11px] font-normal leading-snug text-foreground/80 sm:text-xs">
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div id="produk" className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  Produk dalam model ini
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {products.length
                    ? `${formatNumber(products.length)} produk dari katalog aktif`
                    : "Belum ada produk aktif untuk model ini."}
                </p>
              </div>
              {products.length ? (
                <Button asChild variant="secondary" className="shrink-0">
                  <Link href={catalogHref}>Lihat di katalog</Link>
                </Button>
              ) : null}
            </div>

            {products.length ? (
              <ProductCardGrid className="mt-5">
                {products.map((product, index) => (
                  <ProductCard key={product.id} product={product} priority={index < 4} />
                ))}
              </ProductCardGrid>
            ) : (
              <EmptyState
                className="mt-5"
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
        </div>
      </section>
    </PublicLayout>
  )
}
