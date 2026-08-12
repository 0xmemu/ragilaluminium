import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { FilterBerdasarkanControl } from "@/components/public/filter-berdasarkan-control"
import {
  AppliedFiltersCard,
  FilterSidebar,
  FilterSidebarSection,
} from "@/components/public/filter-sidebar"
import { GalleryLightbox, toGalleryItems } from "@/components/public/gallery-lightbox"
import { ShowcaseCardGrid } from "@/components/public/product-card-grid"
import { TestimonialCard } from "@/components/public/testimonial-card"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { Testimonial } from "@/types"

interface ModelNavOption {
  value: string
  label: string
  count: number
}

/**
 * Halaman gabungan "Apa kata pelanggan kami" + "Ulasan pelanggan di website".
 * Satu slug (/reviews) dengan nav/filter model produk seperti halaman Model Produk.
 */
export default function Reviews({
  pageMeta,
  testimonials = [],
  modelNav = [],
  activeModel = null,
  stats,
  installationsHref,
}: {
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  testimonials?: Testimonial[]
  modelNav?: ModelNavOption[]
  activeModel?: string | null
  stats?: { website_total?: number; average_rating?: number | null }
  installationsHref?: string
}) {
  const heading = pageMeta?.heading?.trim().replace(/\.$/, "") || "Apa kata pelanggan kami"
  const subtitle =
    pageMeta?.subtitle?.trim() ||
    "Screenshot percakapan Shopee/WhatsApp dan ulasan pelanggan di website."
  const docTitle = pageMeta?.title?.trim() || heading

  const marketplace = React.useMemo(
    () => testimonials.filter((t) => t.source !== "website"),
    [testimonials],
  )
  const website = React.useMemo(
    () => testimonials.filter((t) => t.source === "website"),
    [testimonials],
  )

  // Ulasan website: default "Semua" (terbaru dulu); dropdown bintang 1–5 memfilter.
  const [starFilter, setStarFilter] = React.useState("")
  const websiteFiltered = React.useMemo(() => {
    const sorted = [...website].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
    if (!starFilter) return sorted
    const target = Number(starFilter)
    return sorted.filter((testimonial) => (testimonial.rating ?? 0) === target)
  }, [starFilter, website])

  const starOptions = React.useMemo(
    () => [
      { value: "", label: "Semua" },
      ...([5, 4, 3, 2, 1] as const).map((stars) => ({
        value: String(stars),
        label: `Bintang ${stars}`,
      })),
    ],
    [],
  )

  const total = stats?.website_total ?? testimonials.length
  const averageRating = stats?.average_rating ?? null

  const galleryItems = React.useMemo(() => toGalleryItems(testimonials), [testimonials])
  const [lightboxIndex, setLightboxIndex] = React.useState(-1)

  const activeModelLabel =
    modelNav.find((option) => option.value === activeModel)?.label ?? null

  function selectModel(value: string | null) {
    router.get(
      routeUrl("reviews"),
      value ? { model: value } : {},
      { preserveScroll: true, preserveState: false, replace: true },
    )
  }

  const modelOptions = React.useMemo(
    () => [
      { value: "", label: "Semua Model" },
      ...modelNav.map((option) => ({ value: option.value, label: option.label })),
    ],
    [modelNav],
  )

  function renderGrid(
    items: Testimonial[],
    variant: "screenshot" | "review",
    emptyTitle: string,
    emptyDesc: string,
  ) {
    if (!items.length) {
      return (
        <EmptyState
          icon="message-circle"
          title={emptyTitle}
          description={emptyDesc}
          action={
            <Button asChild variant="secondary">
              <Link href={installationsHref ?? routeUrl("installation.index")}>
                Hasil pemasangan
              </Link>
            </Button>
          }
        />
      )
    }
    return (
      <ShowcaseCardGrid>
        {items.map((testimonial) => {
          const itemIndex = galleryItems.findIndex((g) => g.src === testimonial.image_url)
          return (
            <TestimonialCard
              key={testimonial.id}
              testimonial={testimonial}
              compact
              variant={variant}
              onOpen={itemIndex >= 0 ? () => setLightboxIndex(itemIndex) : undefined}
            />
          )
        })}
      </ShowcaseCardGrid>
    )
  }return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={subtitle} />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden py-2 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: heading, href: null },
            ]}
          />
        </div>
        <div className="container-page flex flex-col gap-4 py-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
                aria-label="Kembali"
              >
                <Icon name="arrow-left" className="size-5" aria-hidden="true" />
              </button>
              <h1 className="text-base font-bold tracking-tight text-foreground">{heading}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {total ? (
              <div className="flex items-center gap-4 text-sm">
                <span className="tabular-nums font-semibold text-foreground">
                  {formatNumber(total)}
                </span>
                <span className="text-muted-foreground">ulasan</span>
                {averageRating ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Icon name="star" weight="fill" className="size-4 text-warning" aria-hidden="true" />
                    <span className="tabular-nums font-semibold text-foreground">
                      {averageRating.toFixed(1)}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}
            <Button asChild variant="ghost" size="md">
              <Link href={installationsHref ?? routeUrl("installation.index")}>
                Hasil pemasangan
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container-page flex justify-end py-3 lg:hidden">
        <FilterBerdasarkanControl
          id="reviews-model"
          variant="plain"
          value={activeModel ?? ""}
          options={modelOptions}
          onChange={(value) => selectModel(value || null)}
          ariaLabel="Filter model produk"
          menuLabel="Model Produk"
        />
      </div>

      <section className="container-page !px-5 md:!px-8 lg:!px-12">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <FilterSidebar>
                <AppliedFiltersCard
                  chips={
                    activeModel && activeModelLabel
                      ? [{ id: activeModel, label: activeModelLabel }]
                      : []
                  }
                  onRemove={() => selectModel(null)}
                  onClearAll={() => selectModel(null)}
                />
                {modelNav.length ? (
                  <FilterSidebarSection title="Model Produk" subtitle={activeModelLabel}>
                    <fieldset className="space-y-1">
                      <legend className="sr-only">Filter model produk</legend>
                      <label className="flex min-h-10 cursor-pointer items-center gap-3 px-1 text-sm hover:bg-accent">
                        <input
                          type="radio"
                          name="review-model"
                          value=""
                          checked={!activeModel}
                          onChange={() => selectModel(null)}
                          className="h-4 w-4 accent-primary"
                        />
                        Semua Model
                      </label>
                      {modelNav.map((option) => (
                        <label
                          key={option.value}
                          className="flex min-h-10 cursor-pointer items-center gap-3 px-1 text-sm hover:bg-accent"
                        >
                          <input
                            type="radio"
                            name="review-model"
                            value={option.value}
                            checked={activeModel === option.value}
                            onChange={() => selectModel(option.value)}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <span className="truncate">{option.label}</span>
                            <span className="tabular-nums text-xs text-muted-foreground">
                              {formatNumber(option.count)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  </FilterSidebarSection>
                ) : null}
              </FilterSidebar>
            </div>
          </aside><div className="flex flex-col gap-8">
            <section id="apa-kata-pelanggan" className="scroll-mt-20">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-foreground">Screenshot pelanggan</h2>
                <span className="tabular-nums text-sm text-muted-foreground">
                  {formatNumber(marketplace.length)}
                </span>
              </div>
              {renderGrid(
                marketplace,
                "screenshot",
                "Belum ada screenshot pelanggan",
                "Bukti percakapan Shopee/WhatsApp akan tampil di sini.",
              )}
            </section>

            <section id="ulasan-website" className="scroll-mt-20">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-foreground">
                    Ulasan pelanggan di website
                  </h2>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {formatNumber(websiteFiltered.length)}
                  </span>
                </div>
                <FilterBerdasarkanControl
                  id="reviews-star"
                  variant="plain"
                  value={starFilter}
                  options={starOptions}
                  onChange={setStarFilter}
                  ariaLabel="Filter ulasan berdasarkan bintang"
                  menuLabel="Urutkan / Filter"
                />
              </div>
              {renderGrid(
                websiteFiltered,
                "review",
                starFilter
                  ? `Belum ada ulasan bintang ${starFilter}`
                  : "Belum ada ulasan website",
                starFilter
                  ? "Ulasan dengan rating tersebut belum tersedia. Coba bintang lain atau Semua."
                  : "Ulasan dari pembeli website akan tampil di sini.",
              )}
            </section>
          </div>
        </div>
      </section>

      {galleryItems.length ? (
        <GalleryLightbox
          items={galleryItems}
          index={lightboxIndex}
          onOpenChange={(open) => {
            if (!open) setLightboxIndex(-1)
          }}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </PublicLayout>
  )
}