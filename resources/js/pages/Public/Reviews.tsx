import { Head, Link, router, usePage } from "@inertiajs/react"

import { FilterBerdasarkanControl } from "@/components/public/filter-berdasarkan-control"
import { TestimonialCard } from "@/components/public/testimonial-card"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Pagination } from "@/components/ui/pagination"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData, SharedPageProps, Testimonial } from "@/types"

const REVIEW_SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "rating_desc", label: "Rating tertinggi" },
  { value: "rating_asc", label: "Rating terendah" },
]

const SOURCE_FILTERS = [
  { value: "all", label: "Semua" },
  { value: "marketplace", label: "Shopee & WhatsApp" },
  { value: "website", label: "Website" },
] as const

interface ReviewStats {
  total: number
  average_rating: number | null
}

export default function Reviews({
  pageMeta,
  testimonials = [],
  pagination,
  stats,
  activeSort = "newest",
  activeSource = "all",
  installationsHref,
}: {
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  testimonials: Testimonial[]
  pagination?: PaginationData | null
  stats?: ReviewStats
  activeSort?: string
  activeSource?: string
  installationsHref?: string
}) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const totalCount = stats?.total ?? testimonials.length
  const averageRating = stats?.average_rating ?? null
  const heading = pageMeta?.heading?.trim() || "Apa kata pelanggan kami"
  const subtitle =
    pageMeta?.subtitle?.trim() ||
    "Ulasan pelanggan dari Shopee, WhatsApp, dan website."
  const docTitle = pageMeta?.title?.trim() || "Ulasan Pelanggan"

  function navigateReviews(next: { sort?: string; source?: string }) {
    const sort = next.sort ?? activeSort
    const source = next.source ?? activeSource
    router.get(
      routeUrl("reviews"),
      {
        sort: sort === "newest" ? undefined : sort,
        source: source === "all" ? undefined : source,
      },
      { preserveScroll: true, preserveState: false, replace: true },
    )
  }

  return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={subtitle} />
      </Head>

      <section className="border-b border-border bg-foreground text-background">
        <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:py-16">
          <div>
            <h1 className="max-w-3xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {heading}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-background/70 sm:text-base">{subtitle}</p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            {totalCount ? (
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-background/20">
                <div className="min-w-32 bg-foreground p-5">
                  <p className="tabular-nums text-2xl font-semibold text-background">
                    {formatNumber(totalCount)}
                  </p>
                  <p className="mt-2 text-xs text-background/60">Ulasan terbit</p>
                </div>
                <div className="min-w-32 bg-foreground p-5">
                  <p className="tabular-nums flex items-center gap-2 text-2xl font-semibold text-background">
                    {averageRating ? averageRating.toFixed(1) : "-"}
                    {averageRating ? (
                      <Icon name="star" weight="fill" className="h-5 w-5 text-warning" aria-hidden="true" />
                    ) : null}
                  </p>
                  <p className="mt-2 text-xs text-background/60">Rata-rata rating</p>
                </div>
              </div>
            ) : null}
            <Button
              asChild
              variant="secondary"
              className="border-white/30 bg-white/10 text-background hover:bg-white/20"
            >
              <Link href={installationsHref ?? routeUrl("installation.index")}>
                Lihat hasil pemasangan
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="section-space border-b border-border">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-bold tracking-tight sm:text-base">Semua ulasan</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Ulasan Shopee, WhatsApp, dan website. Pisahkan lewat filter sumber.
              </p>
            </div>
            {testimonials.length || activeSource !== "all" ? (
              <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                <span className="text-sm text-muted-foreground">Urutkan</span>
                <FilterBerdasarkanControl
                  id="reviews-sort"
                  value={activeSort || "newest"}
                  options={REVIEW_SORT_OPTIONS}
                  onChange={(sort) => navigateReviews({ sort })}
                  ariaLabel="Urutkan ulasan"
                />
              </div>
            ) : null}
          </div>

          <div
            className="mt-6 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Filter sumber ulasan"
          >
            {SOURCE_FILTERS.map((filter) => {
              const active = (activeSource || "all") === filter.value
              return (
                <button
                  key={filter.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => navigateReviews({ source: filter.value })}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-surface text-foreground hover:border-foreground/40",
                  )}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>

          {testimonials.length ? (
            <>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {testimonials.map((testimonial) => (
                  <TestimonialCard key={testimonial.id} testimonial={testimonial} compact />
                ))}
              </div>
              <Pagination pagination={pagination} />
            </>
          ) : (
            <EmptyState
              className="mt-8"
              icon="star"
              title="Belum ada testimoni"
              description={
                activeSource === "all"
                  ? "Belum ada ulasan yang tampil. Lihat hasil pemasangan kami atau tanya langsung via WhatsApp."
                  : "Tidak ada ulasan untuk filter sumber ini."
              }
              action={
                activeSource === "all" ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild variant="secondary">
                      <Link href={routeUrl("installation.index")}>Hasil pemasangan</Link>
                    </Button>
                    {consultationWhatsApp?.directUrl ? (
                      <Button asChild>
                        <a href={consultationWhatsApp.directUrl} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : undefined
              }
            />
          )}
        </div>
      </section>

      <section className="border-t border-border bg-surface py-12">
        <div className="container-page flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Temukan model untuk kebutuhan Anda</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Bandingkan model terlebih dahulu sebelum memilih ukuran dan varian.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href={routeUrl("catalog.index")}>
              Pilih model
              <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  )
}
