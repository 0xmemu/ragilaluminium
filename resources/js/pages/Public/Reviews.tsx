import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { FilterBerdasarkanControl } from "@/components/public/filter-berdasarkan-control"
import {
  AppliedFiltersCard,
  FilterSidebar,
  FilterSidebarSection,
} from "@/components/public/filter-sidebar"
import { GalleryLightbox, toGalleryItems } from "@/components/public/gallery-lightbox"
import { TestimonialCard } from "@/components/public/testimonial-card"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Radio } from "@/components/ui/radio"
import { EmptyState } from "@/components/ui/empty-state"
import { Pagination } from "@/components/ui/pagination"
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
  type = "ss",
  pageMeta,
  testimonials = [],
  modelNav = [],
  activeModel = null,
  stats,
  installationsHref,
}: {
  type?: "ss" | "web"
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  testimonials?:
    | Testimonial[]
    | {
        data: Testimonial[]
        current_page: number
        last_page: number
        total: number
        next_page_url: string | null
        prev_page_url: string | null
        links?: Array<{ url: string | null; label: string; active: boolean }>
      }
  modelNav?: ModelNavOption[]
  activeModel?: string | null
  stats?: { website_total?: number; average_rating?: number | null }
  installationsHref?: string
}) {
  const isSs = type === "ss"
  const heading =
    pageMeta?.heading?.trim().replace(/\.$/, "") ||
    (isSs ? "Apa kata pelanggan kami" : "Ulasan pelanggan di website")
  const subtitle =
    pageMeta?.subtitle?.trim() ||
    (isSs
      ? "Galeri screenshot percakapan Shopee/WhatsApp dari pelanggan."
      : "Ulasan pelanggan yang memesan lewat website.")
  const docTitle = pageMeta?.title?.trim() || heading

  const testimonialList = Array.isArray(testimonials) ? testimonials : testimonials?.data ?? []
  const pagination = !Array.isArray(testimonials)
    ? {
        current_page: testimonials?.current_page ?? 1,
        last_page: testimonials?.last_page ?? 1,
        next_page_url: testimonials?.next_page_url ?? null,
        prev_page_url: testimonials?.prev_page_url ?? null,
        total: testimonials?.total ?? 0,
        links: testimonials?.links ?? [],
      }
    : null

  const marketplace = React.useMemo(() => {
    const marketplaceItems = testimonialList.filter((t) => t.source !== "website")
    return marketplaceItems.length ? marketplaceItems : testimonialList
  }, [testimonialList])
  const website = React.useMemo(
    () => testimonialList.filter((t) => t.source === "website"),
    [testimonialList],
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

  const total = isSs ? marketplace.length : (stats?.website_total ?? website.length)
  const averageRating = stats?.average_rating ?? null

  const galleryItems = React.useMemo(() => toGalleryItems(testimonialList), [testimonialList])
  const [lightboxIndex, setLightboxIndex] = React.useState(-1)

  const activeModelLabel =
    modelNav.find((option) => option.value === activeModel)?.label ?? null

  function selectModel(value: string | null) {
    router.get(
      routeUrl(isSs ? "reviews.screenshots" : "reviews.website"),
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
    // Halaman ulasan = 1 kolom (list vertikal), bukan grid.
    return (
      <ul className="flex flex-col gap-3">
        {items.map((testimonial) => {
          const itemIndex = galleryItems.findIndex((g) => g.src === testimonial.image_url)
          return (
            <li key={testimonial.id} className="min-w-0">
              <TestimonialCard
                testimonial={testimonial}
                compact
                variant={variant}
                onOpen={itemIndex >= 0 ? () => setLightboxIndex(itemIndex) : undefined}
              />
            </li>
          )
        })}
      </ul>
    )
  }return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={subtitle} />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center gap-3">
                        <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: heading, href: null },
            ]}
          />
          </div>
        </div>
        <div className="container-page flex flex-col gap-4 py-2 sm:flex-row !px-2.5 md:!px-8 lg:!px-12 sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden"
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

      <section className="container-page !px-2.5 md:!px-8 lg:!px-12">
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
                      <Radio
                        name="review-model"
                        value=""
                        checked={!activeModel}
                        onChange={() => selectModel(null)}
                        className="min-h-10 px-1 text-sm hover:bg-accent"
                      >
                        Semua Model
                      </Radio>
                      {modelNav.map((option) => (
                        <Radio
                          key={option.value}
                          name="review-model"
                          value={option.value}
                          checked={activeModel === option.value}
                          onChange={() => selectModel(option.value)}
                          className="min-h-10 px-1 text-sm hover:bg-accent"
                        >
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <span className="truncate">{option.label}</span>
                            <span className="tabular-nums text-xs text-muted-foreground">
                              {formatNumber(option.count)}
                            </span>
                          </span>
                        </Radio>
                      ))}
                    </fieldset>
                  </FilterSidebarSection>
                ) : null}
              </FilterSidebar>
            </div>
          </aside><div className="flex flex-col gap-8">
            {isSs ? (
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
            ) : (
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
                {pagination ? <Pagination pagination={pagination} /> : null}
              </section>
            )}
          </div>
        </div>
      </section>

      {isSs && galleryItems.length ? (
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