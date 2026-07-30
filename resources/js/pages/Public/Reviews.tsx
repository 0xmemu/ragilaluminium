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
  { value: "marketplace", label: "Apa kata pelanggan" },
  { value: "website", label: "Ulasan website" },
] as const

interface ReviewStats {
  total: number
  average_rating: number | null
}

function ReviewGrid({
  items,
  variant,
  emptyTitle,
  emptyDescription,
}: {
  items: Testimonial[]
  variant: "screenshot" | "review"
  emptyTitle: string
  emptyDescription: string
}) {
  if (!items.length) {
    return (
      <EmptyState
        className="mt-6"
        icon={variant === "screenshot" ? "message-circle" : "star"}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((testimonial) => (
        <TestimonialCard
          key={testimonial.id}
          testimonial={testimonial}
          compact
          variant={variant}
        />
      ))}
    </div>
  )
}

export default function Reviews({
  pageMeta,
  testimonials = [],
  marketplaceTestimonials = [],
  websiteTestimonials = [],
  pagination,
  stats,
  activeSort = "newest",
  activeSource = "all",
  installationsHref,
}: {
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  testimonials?: Testimonial[]
  marketplaceTestimonials?: Testimonial[]
  websiteTestimonials?: Testimonial[]
  pagination?: PaginationData | null
  stats?: ReviewStats
  activeSort?: string
  activeSource?: string
  installationsHref?: string
}) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const totalCount = stats?.total ?? 0
  const averageRating = stats?.average_rating ?? null
  const heading = pageMeta?.heading?.trim() || "Apa kata pelanggan kami"
  const subtitle =
    pageMeta?.subtitle?.trim() ||
    "Screenshot marketplace/WhatsApp dan ulasan pembeli yang order lewat website."
  const docTitle = pageMeta?.title?.trim() || "Ulasan Pelanggan"
  const showSplit = (activeSource || "all") === "all"
  const marketplaceItems = showSplit
    ? marketplaceTestimonials
    : activeSource === "marketplace"
      ? marketplaceTestimonials.length
        ? marketplaceTestimonials
        : testimonials
      : []
  const websiteItems = showSplit
    ? websiteTestimonials
    : activeSource === "website"
      ? websiteTestimonials.length
        ? websiteTestimonials
        : testimonials
      : []

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

      <section className="border-b border-border bg-surface py-6">
        <div className="container-page flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex flex-wrap gap-2"
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
                      : "border-border bg-background text-foreground hover:border-foreground/40",
                  )}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm text-muted-foreground">Urutkan</span>
            <FilterBerdasarkanControl
              id="reviews-sort"
              value={activeSort || "newest"}
              options={REVIEW_SORT_OPTIONS}
              onChange={(sort) => navigateReviews({ sort })}
              ariaLabel="Urutkan ulasan"
            />
          </div>
        </div>
      </section>

      {(showSplit || activeSource === "marketplace") && (
        <section id="apa-kata-pelanggan" className="scroll-mt-24 section-space border-b border-border">
          <div className="container-page">
            <h2 className="text-sm font-bold tracking-tight sm:text-base">Apa kata pelanggan kami</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Screenshot ulasan marketplace dan interaksi WhatsApp dengan pelanggan.
            </p>
            <ReviewGrid
              items={marketplaceItems}
              variant="screenshot"
              emptyTitle="Belum ada screenshot"
              emptyDescription="Tambahkan dari admin dengan sumber Shopee, WhatsApp, atau Lainnya."
            />
            {!showSplit && pagination ? <Pagination pagination={pagination} /> : null}
          </div>
        </section>
      )}

      {(showSplit || activeSource === "website") && (
        <section id="ulasan-website" className="scroll-mt-24 section-space border-b border-border bg-surface-muted">
          <div className="container-page">
            <h2 className="text-sm font-bold tracking-tight sm:text-base">Ulasan pelanggan di website</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Ulasan dari pembeli lewat website. Admin boleh menambahkan foto/screenshot bila pelanggan tidak menulis ulasan.
            </p>
            <ReviewGrid
              items={websiteItems}
              variant="review"
              emptyTitle="Belum ada ulasan website"
              emptyDescription="Tambahkan ulasan dengan sumber Website di admin."
            />
            {!showSplit && pagination ? <Pagination pagination={pagination} /> : null}
          </div>
        </section>
      )}

      {!marketplaceItems.length && !websiteItems.length ? (
        <section className="section-space">
          <div className="container-page">
            <EmptyState
              icon="star"
              title="Belum ada testimoni"
              description="Belum ada ulasan yang tampil. Lihat hasil pemasangan kami atau tanya langsung via WhatsApp."
              action={
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
              }
            />
          </div>
        </section>
      ) : null}

      <section className="border-t border-border bg-surface py-12">
        <div className="container-page flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Temukan model untuk kebutuhan Anda</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Bandingkan model terlebih dahulu sebelum memilih ukuran dan varian.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href={routeUrl("catalog.index")}>Pilih model</Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  )
}
