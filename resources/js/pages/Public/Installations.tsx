import { Head, router } from "@inertiajs/react"

import { InstallationCard } from "@/components/public/installation-card"
import { InstallationFeaturedCard } from "@/components/public/installation-featured-card"
import { InstallationMediaGallery } from "@/components/public/installation-media-gallery"
import { ShowcaseCardGrid } from "@/components/public/product-card-grid"
import {
  FilterBerdasarkanControl,
  type FilterBerdasarkanOption,
} from "@/components/public/filter-berdasarkan-control"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { InstallationItem } from "@/types"

const INSTALLATION_SORT_OPTIONS: FilterBerdasarkanOption[] = [
  { value: "newest", label: "Urutan model" },
  { value: "photos", label: "Terbanyak media" },
]

function categorySlugFromCode(category: string): string {
  const code = category.toUpperCase()
  if (code === "DOOR") return "door"
  if (code === "BOUVEN") return "bouven"
  if (code === "LAINNYA") return "lainnya"
  return "window"
}

export default function Installations({
  pageMeta,
  installations = [],
  featured = null,
  gallery = [],
  level = "model",
  modelMeta = null,
  indexHref,
  activeSort = "newest",
}: {
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  installations?: InstallationItem[]
  featured?: InstallationItem | null
  gallery?: { id: number; url: string; thumb?: string | null; is_video?: boolean; caption?: string | null }[]
  level?: "model" | "product"
  modelMeta?: { category: string; model: string; label: string } | null
  indexHref?: string
  reviewsHref?: string
  activeSort?: string
}) {
  const isModelLevel = level !== "product"
  const heading = pageMeta?.heading?.trim() || "Hasil Pemasangan Kami"
  const subtitle =
    pageMeta?.subtitle?.trim() ||
    (isModelLevel
      ? "Pilih model untuk melihat contoh pemasangan di rumah dan proyek nyata."
      : "Contoh pemasangan untuk produk dalam model ini.")
  const docTitle = pageMeta?.title?.trim() || "Hasil Pemasangan"
  const listingHref = indexHref || routeUrl("installation.index")
  const sortValue = activeSort || "newest"
  const countLabel = isModelLevel
    ? `${formatNumber(installations.length)} model ditemukan`
    : `${formatNumber(installations.length)} produk ditemukan`

  function visitSort(sort: string) {
    if (isModelLevel) {
      router.get(
        routeUrl("installation.index"),
        { sort: sort === "newest" ? undefined : sort },
        { preserveScroll: true, replace: true },
      )
      return
    }
    if (!modelMeta?.category || !modelMeta?.model) return
    const modelSlug = modelMeta.model.toLowerCase().replace(/\s+/g, "_")
    router.get(
      routeUrl("installation.model", {
        category: categorySlugFromCode(modelMeta.category),
        model: modelSlug,
      }),
      { sort: sort === "newest" ? undefined : sort },
      { preserveScroll: true, replace: true },
    )
  }

  const sortControl = (
    <FilterBerdasarkanControl
      id={isModelLevel ? "installation-index-sort" : "installation-model-sort"}
      variant="plain"
      value={sortValue}
      options={INSTALLATION_SORT_OPTIONS}
      onChange={visitSort}
      ariaLabel={isModelLevel ? "Urutkan model hasil pemasangan" : "Urutkan inspirasi pemasangan"}
      menuLabel="Urutkan"
    />
  )

  return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={subtitle} />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page py-3 lg:py-4">
          <Breadcrumbs
            singleLine={!isModelLevel}
            items={
              isModelLevel
                ? [
                    { label: "Home", href: routeUrl("home") },
                    { label: "Hasil Pemasangan" },
                  ]
                : [
                    { label: "Home", href: routeUrl("home") },
                    { label: "Hasil Pemasangan", href: listingHref },
                    { label: modelMeta?.label || heading },
                  ]
            }
          />

          {isModelLevel ? (
            <div className="mt-4">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h1>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="min-w-0 text-sm leading-8 text-muted-foreground">{countLabel}</p>
                <div className="flex shrink-0 items-end justify-end">{sortControl}</div>
              </div>
            </div>
          ) : (
            <h1 className="sr-only">{modelMeta?.label || heading}</h1>
          )}
        </div>
      </section>

      <section className={isModelLevel ? "pt-4 pb-8 sm:pt-6 sm:pb-10" : "pt-0 pb-8 sm:pb-10"}>
        {isModelLevel ? (
          <div className="container-page">
            {installations.length ? (
              <ShowcaseCardGrid className="gap-2">
                {installations.map((item) => (
                  <InstallationCard
                    key={item.id}
                    level="model"
                    item={{
                      ...item,
                      image: item.image ?? item.image_url,
                    }}
                  />
                ))}
              </ShowcaseCardGrid>
            ) : (
              <EmptyState
                icon="image"
                title="Belum ada dokumentasi pemasangan"
                description="Foto hasil pemasangan akan tampil di sini setelah tersedia."
              />
            )}
          </div>
        ) : (
          <div className="space-y-6 lg:space-y-8">
            {featured ? (
              <div className="container-page">
                <InstallationFeaturedCard
                  className="w-full"
                  item={{
                    ...featured,
                    image: featured.image ?? featured.image_url,
                  }}
                />
              </div>
            ) : null}

            <div id="inspirasi-pemasangan" className="container-page scroll-mt-24">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
                <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  Inspirasi Pemasangan
                </h2>
                {sortControl}
              </div>

              {gallery.length ? (
                <InstallationMediaGallery items={gallery} title={modelMeta?.label || heading} />
              ) : (
                <EmptyState
                  icon="image"
                  title="Belum ada dokumentasi untuk model ini"
                  description="Foto hasil pemasangan akan tampil di sini setelah tersedia."
                />
              )}
            </div>
          </div>
        )}
      </section>
    </PublicLayout>
  )
}
