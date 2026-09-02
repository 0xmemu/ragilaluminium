import { Head, router } from "@inertiajs/react"
import * as React from "react"

import { InstallationCard } from "@/components/public/installation-card"
import { InstallationMediaGallery } from "@/components/public/installation-media-gallery"
import { ShowcaseCardGrid } from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { PageTopBar } from "@/components/public/page-top-bar"
import { ModelHero } from "@/components/public/model-hero"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { EmptyState } from "@/components/ui/empty-state"
import { ModelCategoryCard } from "@/components/public/model-category-card"
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

  const modelHighlights =
    modelHighlightsRaw?.length === 3
      ? modelHighlightsRaw
      : [
          { label: "Tampilan Bersih & Modern" },
          { label: "Maksimalkan Pencahayaan" },
          { label: "Cocok untuk Berbagai Ruangan" },
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
  // Pembeli hanya bisa MENCARI model/produk tertentu via ikon search.
  const [searchOpen, setSearchOpen] = React.useState(false)
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
  const [searchQuery, setSearchQuery] = React.useState("")
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const needle = searchQuery.trim().toLowerCase()
  const filteredInstallations = needle
    ? installations.filter((item) =>
        [item.label, item.subtitle, item.desc, item.model]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(needle)),
      )
    : installations
  const filteredGallery = needle
    ? gallery.filter((item) =>
        [item.caption, item.url]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(needle)),
      )
    : gallery

  React.useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const searchControl = (
    <div className="relative flex shrink-0 items-center gap-2">
      {searchOpen ? (
        <Input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSearchOpen(false)
              setSearchQuery("")
            }
          }}
          placeholder={isModelLevel ? "Cari model produk…" : "Cari di dokumentasi…"}
          aria-label="Cari hasil pemasangan"
          className="h-9 w-40 rounded-full sm:w-56"
        />
      ) : null}
      <button
        type="button"
        onClick={() => {
          setSearchOpen((current) => !current)
          if (searchOpen) setSearchQuery("")
        }}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-muted/50"
        aria-label="Cari hasil pemasangan"
        aria-expanded={searchOpen}
      >
        <Icon name="search" className="size-5" aria-hidden="true" />
      </button>
    </div>
  )

  return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={subtitle} />
      </Head>

      <section className="border-b border-border bg-surface">
        <PageTopBar
          title={isModelLevel ? heading : "Hasil Pemasangan"}
          singleLine={!isModelLevel}
          breadcrumbs={
            isModelLevel
              ? [
                  { label: "Beranda", href: routeUrl("home") },
                  { label: "Hasil Pemasangan" },
                ]
              : [
                  { label: "Beranda", href: routeUrl("home") },
                  { label: "Hasil Pemasangan", href: listingHref },
                  { label: modelMeta?.label || heading },
                ]
          }
        />
      </section>

      {isModelLevel ? (
        <>
          <section className="bg-surface py-0">
            <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
              <div className="flex items-center justify-between gap-4 pt-2 pb-1.5 sm:pt-2.5 sm:pb-2">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {formatNumber(totalModels)} model produk ditemukan
                </p>
                <SortMenu value={sort} onChange={selectSort} />
              </div>
            </div>
          </section>
          <section className="container-page !px-2.5 md:!px-8 lg:!px-12 py-5 md:py-8">
            {models.length ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {models.map((model) => (
                  <ModelCategoryCard key={`${model.category}-${model.model}`} model={model} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="funnel"
                title="Belum ada model yang cocok"
                description="Model produk belum tersedia pada katalog aktif."
              />
            )}
          </section>
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

            <div id="inspirasi-pemasangan" className="container-page !px-2.5 md:!px-8 lg:!px-12 scroll-mt-24">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Inspirasi Pemasangan
                </h2>
                {searchControl}
              </div>

              {filteredGallery.length ? (
                <InstallationMediaGallery items={filteredGallery} title={modelMeta?.label || heading} />
              ) : (
                <EmptyState
                  icon="search"
                  title={needle ? "Tidak ada hasil pencarian" : "Belum ada dokumentasi untuk model ini"}
                  description={
                    needle
                      ? `Tidak ada dokumentasi untuk “${searchQuery.trim()}”. Coba kata kunci lain.`
                      : "Foto hasil pemasangan akan tampil di sini setelah tersedia."
                  }
                />
              )}
            </div>
          </div>
        )}
    </PublicLayout>
  )
}
