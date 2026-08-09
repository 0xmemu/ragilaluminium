import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { FilterBerdasarkanControl } from "@/components/public/filter-berdasarkan-control"
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

const REVIEW_SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "rating_desc", label: "Rating tertinggi" },
  { value: "rating_asc", label: "Rating terendah" },
]

/** Halaman ulasan pelanggan di website — terpisah dari galeri "Apa kata pelanggan kami". */
export default function Ulasan({
  websiteTestimonials = [],
  stats,
  activeSort = "newest",
  installationsHref,
}: {
  websiteTestimonials?: Testimonial[]
  stats?: { website_total?: number; average_rating?: number | null }
  activeSort?: string
  installationsHref?: string
}) {
  const total = stats?.website_total ?? websiteTestimonials.length
  const averageRating = stats?.average_rating ?? null

  const galleryItems = React.useMemo(() => toGalleryItems(websiteTestimonials), [websiteTestimonials])
  const [lightboxIndex, setLightboxIndex] = React.useState(-1)

  function navigateSort(sort: string) {
    router.get(
      routeUrl("ulasan"),
      { sort: sort === "newest" ? undefined : sort },
      { preserveScroll: true, preserveState: false, replace: true },
    )
  }

  return (
    <PublicLayout>
      <Head title="Ulasan Pelanggan">
        <meta
          name="description"
          content="Ulasan dari pembeli yang order lewat website Ragil Aluminium."
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden py-4 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Ulasan Pelanggan", href: null },
            ]}
          />
        </div>
        <div className="container-page flex flex-col gap-4 pb-4 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
                aria-label="Kembali"
              >
                <Icon name="caret-left" className="size-5" aria-hidden="true" />
              </button>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Ulasan pelanggan
              </h1>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
                Ulasan dari pembeli yang order lewat website.
              </p>
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
              <Button asChild variant="secondary" size="sm">
                <Link href={routeUrl("reviews")}>Apa kata pelanggan kami</Link>
              </Button>
            </div>
        </div>
      </section>

      <section className="py-4">
        <div className="container-page">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="tabular-nums font-semibold text-foreground">
                {formatNumber(total)}
              </span>{" "}
              ulasan website
            </p>
            <FilterBerdasarkanControl
              id="reviews-sort"
              variant="plain"
              value={activeSort || "newest"}
              options={REVIEW_SORT_OPTIONS}
              onChange={navigateSort}
              ariaLabel="Urutkan ulasan"
            />
          </div>

          {websiteTestimonials.length ? (
            <ShowcaseCardGrid className="mt-6 gap-2 sm:gap-3.5">
              {websiteTestimonials.map((testimonial) => {
                const itemIndex = galleryItems.findIndex((g) => g.src === testimonial.image_url)
                return (
                  <TestimonialCard
                    key={testimonial.id}
                    testimonial={testimonial}
                    compact
                    variant="review"
                    onOpen={itemIndex >= 0 ? () => setLightboxIndex(itemIndex) : undefined}
                  />
                )
              })}
            </ShowcaseCardGrid>
          ) : (
            <EmptyState
              className="mt-6"
              icon="star"
              title="Belum ada ulasan website"
              description="Ulasan dari pembeli website akan tampil di sini."
              action={
                <Button asChild variant="secondary">
                  <Link href={installationsHref ?? routeUrl("installation.index")}>
                    Lihat hasil pemasangan
                  </Link>
                </Button>
              }
            />
          )}
        </div>
      </section>

      {galleryItems.length ? (
        <GalleryLightbox
          items={galleryItems}
          index={lightboxIndex}
          onOpenChange={(open) => { if (!open) setLightboxIndex(-1) }}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </PublicLayout>
  )
}
