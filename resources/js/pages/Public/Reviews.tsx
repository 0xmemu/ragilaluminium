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
import { PageTopBar } from "@/components/public/page-top-bar"
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

  // Ulasan website: terbaru (default), terlama, atau terbaik (rating 4-5).
  const [sortFilter, setSortFilter] = React.useState("")
  const websiteFiltered = React.useMemo(() => {
    if (sortFilter === "oldest") {
      return [...website].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    }
    const sorted = [...website].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
    if (sortFilter === "best") {
      return sorted.filter((testimonial) => (testimonial.rating ?? 0) >= 4)
    }
    return sorted
  }, [sortFilter, website])

  const sortOptions = React.useMemo(
    () => [
      { value: "", label: "Ulasan terbaru" },
      { value: "oldest", label: "Ulasan terlama" },
      { value: "best", label: "Ulasan terbaik" },
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
        />
      )
    }
    // Screenshot = galeri 2 kolom (2 gambar per baris); ulasan teks tetap 1 kolom.
    const grid = variant === "screenshot"
    return (
      <ul className={grid ? "grid grid-cols-2 gap-2 md:gap-3" : "flex flex-col gap-3"}>
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
        <PageTopBar
          title={heading}
          breadcrumbs={[
            { label: "Beranda", href: routeUrl("home") },
            { label: heading, href: null },
          ]}
        />
      </section>

      {total ? (
        <section className="bg-surface py-0">
          <div className="container-page !px-2.5 md:!px-8 lg:!px-12 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                <span className="tabular-nums font-semibold text-foreground">{formatNumber(total)}</span> ulasan
                {averageRating ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    <Icon name="star" weight="fill" className="size-4 text-warning" aria-hidden="true" />
                    <span className="tabular-nums font-semibold text-foreground">{averageRating.toFixed(1)}</span>
                  </span>
                ) : null}
              </p>
              <FilterBerdasarkanControl
                id="reviews-sort"
                variant="plain"
                value={sortFilter}
                options={sortOptions}
                onChange={setSortFilter}
                ariaLabel="Urutkan ulasan"
                menuLabel="Urutkan"
              />
            </div>
          </div>
        </section>
      ) : null}


      <section className="container-page !px-2.5 md:!px-8 lg:!px-12 pt-4 pb-6 lg:pb-8">
        <div className="min-w-0">
          <div className="flex flex-col gap-8">
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
                {renderGrid(
                  websiteFiltered,
                  "review",
                  sortFilter === "best"
                    ? "Belum ada ulasan terbaik"
                    : "Belum ada ulasan website",
                  sortFilter === "best"
                    ? "Ulasan dengan rating 4-5 belum tersedia. Coba urutan lain."
                    : "Ulasan dari pembeli website akan tampil di sini.",
                )}
              </section>
            )}
            {pagination ? <Pagination pagination={pagination} className="mt-0" /> : null}
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