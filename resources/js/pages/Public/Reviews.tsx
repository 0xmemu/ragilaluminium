import { Head, Link, router, usePage } from "@inertiajs/react"

import { FilterBerdasarkanControl } from "@/components/public/filter-berdasarkan-control"
import { ShowcaseCardGrid } from "@/components/public/product-card-grid"
import { TestimonialCard } from "@/components/public/testimonial-card"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps, Testimonial } from "@/types"

const REVIEW_SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "rating_desc", label: "Rating tertinggi" },
  { value: "rating_asc", label: "Rating terendah" },
]

interface ReviewStats {
  total: number
  average_rating: number | null
  marketplace_total?: number
  website_total?: number
}

function ScreenshotCarousel({ items }: { items: Testimonial[] }) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [canGoBack, setCanGoBack] = React.useState(false)
  const [canGoNext, setCanGoNext] = React.useState(items.length > 3)

  const updateControls = React.useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const overflow = track.scrollWidth > track.clientWidth + 2
    setCanGoBack(overflow && track.scrollLeft > 2)
    setCanGoNext(overflow && track.scrollLeft + track.clientWidth < track.scrollWidth - 2)
  }, [])

  React.useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const frame = window.requestAnimationFrame(() => updateControls())
    track.addEventListener("scroll", updateControls, { passive: true })
    window.addEventListener("resize", updateControls)
    return () => {
      window.cancelAnimationFrame(frame)
      track.removeEventListener("scroll", updateControls)
      window.removeEventListener("resize", updateControls)
    }
  }, [items.length, updateControls])

  function move(direction: -1 | 1) {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({
      left: direction * track.clientWidth * 0.75,
      behavior: "smooth",
    })
  }

  return (
    <div className="relative mt-6 min-w-0">
      <div
        ref={trackRef}
        className="scrollbar-x flex min-w-0 snap-x snap-proximity gap-3.5 overflow-x-auto overscroll-x-contain pb-3 pt-1 [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch]"
      >
        {items.map((testimonial) => (
          <div
            key={testimonial.id}
            className="w-[calc((100%-1rem)*5/7)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2.5)] md:w-[calc((100%-2rem)/3.2)] xl:w-[calc((100%-3rem)/4.2)]"
          >
            <TestimonialCard
              testimonial={testimonial}
              compact
              variant="screenshot"
            />
          </div>
        ))}
      </div>

      {canGoBack ? (
        <button
          type="button"
          onClick={() => move(-1)}
          className="absolute -left-3 top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-foreground shadow-md transition hover:scale-105 hover:bg-muted focus-visible:outline-none md:flex"
          aria-label="Kembali"
        >
          <Icon name="caret-left" className="size-5" weight="bold" />
        </button>
      ) : null}

      {canGoNext ? (
        <button
          type="button"
          onClick={() => move(1)}
          className="absolute -right-3 top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-foreground shadow-md transition hover:scale-105 hover:bg-muted focus-visible:outline-none md:flex"
          aria-label="Berikutnya"
        >
          <Icon name="caret-right" className="size-5" weight="bold" />
        </button>
      ) : null}
    </div>
  )
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

  if (variant === "screenshot") {
    return <ScreenshotCarousel items={items} />
  }

  return (
    <ShowcaseCardGrid className="mt-6 gap-2 sm:gap-3.5">
      {items.map((testimonial) => (
        <TestimonialCard
          key={testimonial.id}
          testimonial={testimonial}
          compact
          variant="review"
        />
      ))}
    </ShowcaseCardGrid>
  )
}

export default function Reviews({
  pageMeta,
  marketplaceTestimonials = [],
  websiteTestimonials = [],
  stats,
  activeSort = "newest",
  installationsHref,
}: {
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  testimonials?: Testimonial[]
  marketplaceTestimonials?: Testimonial[]
  websiteTestimonials?: Testimonial[]
  pagination?: unknown
  stats?: ReviewStats
  activeSort?: string
  activeSource?: string
  installationsHref?: string
}) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const totalCount = stats?.total ?? 0
  const averageRating = stats?.average_rating ?? null
  const docTitle = pageMeta?.title?.trim() || "Ulasan Pelanggan"
  const pageHeading = "Ulasan Pelanggan"
  const pageSubtitle =
    "Dua jenis bukti terpisah: screenshot Shopee/WhatsApp, dan ulasan dari pembeli lewat website."
  const marketplaceHeading =
    pageMeta?.heading?.trim().replace(/\.$/, "") || "Apa kata pelanggan kami"
  const marketplaceSubtitle =
    pageMeta?.subtitle?.trim() ||
    "Screenshot percakapan Shopee atau WhatsApp di luar transaksi website."

  function navigateSort(sort: string) {
    router.get(
      routeUrl("reviews"),
      { sort: sort === "newest" ? undefined : sort },
      { preserveScroll: true, preserveState: false, replace: true },
    )
  }

  return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={pageSubtitle} />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page grid gap-5 py-4 lg:grid-cols-[1fr_auto] lg:items-end lg:py-5">
          <div className="lg:col-span-2">
            <Breadcrumbs
              items={[
                { label: "Beranda", href: routeUrl("home") },
                { label: "Ulasan Pelanggan", href: null },
              ]}
            />
          </div>
          <div>
            <h1 className="max-w-3xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {pageHeading}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              {pageSubtitle}
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            {totalCount ? (
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
                <div className="min-w-32 bg-background p-4">
                  <p className="tabular-nums text-2xl font-semibold text-foreground">
                    {formatNumber(totalCount)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Ulasan terbit</p>
                </div>
                <div className="min-w-32 bg-background p-4">
                  <p className="tabular-nums flex items-center gap-2 text-2xl font-semibold text-foreground">
                    {averageRating ? averageRating.toFixed(1) : "-"}
                    {averageRating ? (
                      <Icon name="star" weight="fill" className="h-5 w-5 text-warning" aria-hidden="true" />
                    ) : null}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Rata-rata rating</p>
                </div>
              </div>
            ) : null}
            <Button
              asChild
              variant="secondary"
              className="border-border bg-background text-foreground hover:bg-muted"
            >
              <Link href={installationsHref ?? routeUrl("installation.index")}>
                Lihat hasil pemasangan
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface py-4">
        <div className="container-page flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {formatNumber(stats?.marketplace_total ?? marketplaceTestimonials.length)}
            </span>{" "}
            marketplace/WA
            <span className="mx-2 text-border" aria-hidden>
              ·
            </span>
            <span className="font-semibold text-foreground">
              {formatNumber(stats?.website_total ?? websiteTestimonials.length)}
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
      </section>

      <section id="apa-kata-pelanggan" className="scroll-mt-24 section-space border-b border-border">
        <div className="container-page">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">{marketplaceHeading}</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{marketplaceSubtitle}</p>
          <ReviewGrid
            items={marketplaceTestimonials}
            variant="screenshot"
            emptyTitle="Belum ada screenshot"
            emptyDescription="Tambahkan screenshot Shopee atau WhatsApp dari admin (Pengaturan → Apa Kata Pelanggan Kami)."
          />
        </div>
      </section>

      <section id="ulasan-website" className="scroll-mt-24 section-space border-b border-border bg-surface-muted">
        <div className="container-page">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">Ulasan pelanggan di website</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Ulasan dari pembeli yang order lewat website. Admin boleh menambahkan foto/screenshot bila pelanggan tidak menulis ulasan.
          </p>
          <ReviewGrid
            items={websiteTestimonials}
            variant="review"
            emptyTitle="Belum ada ulasan website"
            emptyDescription="Tambahkan ulasan dengan sumber Website di admin."
          />
        </div>
      </section>

      {!marketplaceTestimonials.length && !websiteTestimonials.length ? (
        <section className="section-space">
          <div className="container-page">
            <EmptyState
              icon="star"
              title="Belum ada ulasan"
              description="Belum ada bukti pelanggan yang tampil. Lihat hasil pemasangan kami atau tanya langsung via WhatsApp."
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
