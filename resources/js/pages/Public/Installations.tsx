import { Head, router } from "@inertiajs/react"
import * as React from "react"

import { InstallationCard } from "@/components/public/installation-card"
import { InstallationMediaGallery } from "@/components/public/installation-media-gallery"
import { ShowcaseCardGrid } from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { PageTopBar } from "@/components/public/page-top-bar"
import { ModelHero } from "@/components/public/model-hero"
import { ShowcaseListingFrame } from "@/components/public/showcase-listing-frame"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { EmptyState } from "@/components/ui/empty-state"
import { SortMenu } from "@/components/public/model-sort-menu"
import { formatNumber } from "@/lib/format"
import { Input } from "@/components/ui/input"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import type { InstallationItem, ModelCardData } from "@/types"

export default function Installations({
  pageMeta,
  installations = [],
  featured = null,
  modelHighlightsRaw = null,
  modelDescription = null,
  gallery = [],
  level = "model",
  modelMeta = null,
  models = [],
  activeSort = "admin",
  indexHref,
}: {
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  installations?: InstallationItem[]
  featured?: InstallationItem | null
  modelHighlightsRaw?: Array<{ label: string }> | null
  modelDescription?: string | null
  gallery?: { id: number; url: string; thumb?: string | null; is_video?: boolean; caption?: string | null }[]
  level?: "model" | "product"
  modelMeta?: { category: string; model: string; label: string } | null
  indexHref?: string
  models?: ModelCardData[]
  activeSort?: string
  reviewsHref?: string
}) {
  const isModelLevel = level !== "product"

  // Kontrak owner: label pill maksimal 2 kata (ikut model produk).
  // Fallback lama 3-4 kata membuat pill terpotong di mobile.
  const modelHighlights =
    modelHighlightsRaw?.length === 3
      ? modelHighlightsRaw
      : [
          { label: "Bersih & Modern" },
          { label: "Cahaya Optimal" },
          { label: "Serbaguna" },
        ]
  const heading = pageMeta?.heading?.trim() || "Hasil Pemasangan Kami"
  const subtitle =
    pageMeta?.subtitle?.trim() ||
    (isModelLevel
      ? "Pilih model untuk melihat contoh pemasangan di rumah dan proyek nyata."
      : "Contoh pemasangan untuk produk dalam model ini.")
  const docTitle = pageMeta?.title?.trim() || "Hasil Pemasangan"
  const listingHref = indexHref || routeUrl("installation.index")

  const totalModels = (models || []).reduce((sum, model) => sum + (Number(model.count) || 0), 0)

  // Urutan tampilan diatur admin (tidak ada kontrol urut di halaman pembeli).
  const [sort, setSort] = React.useState<string>(activeSort)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSort(activeSort)
  }, [activeSort])

  function selectSort(value: string) {
    setSort(value)
    router.get(
      routeUrl("installation.index"),
      value ? { sort: value } : {},
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={subtitle} />
      </Head>

      {!isModelLevel ? (
        <section className="border-b border-border bg-surface">
          <PageTopBar
            title="Hasil Pemasangan"
            singleLine
            breadcrumbs={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Hasil Pemasangan", href: listingHref },
              { label: modelMeta?.label || heading },
            ]}
          />
        </section>
      ) : null}

      {isModelLevel ? (
        <>
          <ShowcaseListingFrame
            title={heading}
            breadcrumbs={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Hasil Pemasangan" },
            ]}
            countLabel={`${formatNumber(totalModels)} model produk ditemukan`}
            toolbar={<SortMenu value={sort} onChange={selectSort} />}
          >
            {installations.length ? (
              <ShowcaseCardGrid>
                {installations.map((item) => (
                  <InstallationCard key={item.id} item={item} />
                ))}
              </ShowcaseCardGrid>
            ) : (
              <EmptyState
                icon="funnel"
                title="Belum ada model yang cocok"
                description="Model produk belum tersedia pada katalog aktif."
              />
            )}
          </ShowcaseListingFrame>
        </>
      ) : (
          <div className="space-y-6 lg:space-y-8">
            {featured?.image_url ? (
              <ModelHero
                title={heading}
                description={modelDescription ?? subtitle}
                slogan={modelDescription ?? subtitle}
                highlights={modelHighlights}
                thumbs={[{ id: "featured", src: featured.image_url, alt: heading }]}
                stats={[
                  { value: installations.length, label: "Produk" },
                  { value: (featured?.photo_count ?? 0) + (featured?.video_count ?? 0), label: "Hasil pemasangan" },
                  { value: "100%", label: "Garansi" },
                ]}
              />
            ) : null}

            <div id="inspirasi-pemasangan" className="container-page !px-2.5 pb-10 md:!px-8 lg:!px-12 scroll-mt-24">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Inspirasi Pemasangan
                </h2>
              </div>

              {gallery.length ? (
                <InstallationMediaGallery items={gallery} title={modelMeta?.label || heading} />
              ) : (
                <EmptyState
                  icon="images"
                  title="Belum ada dokumentasi untuk model ini"
                  description="Foto hasil pemasangan akan tampil di sini setelah tersedia."
                />
              )}
            </div>
          </div>
        )}
    </PublicLayout>
  )
}
