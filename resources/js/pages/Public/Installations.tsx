import { Head } from "@inertiajs/react"
import * as React from "react"

import { InstallationCard } from "@/components/public/installation-card"
import { InstallationMediaGallery } from "@/components/public/installation-media-gallery"
import { ShowcaseCardGrid } from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { PageHeader } from "@/components/public/page-header"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import type { InstallationItem } from "@/types"

export default function Installations({
  pageMeta,
  installations = [],
  featured = null,
  gallery = [],
  level = "model",
  modelMeta = null,
  indexHref,
}: {
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  installations?: InstallationItem[]
  featured?: InstallationItem | null
  gallery?: { id: number; url: string; thumb?: string | null; is_video?: boolean; caption?: string | null }[]
  level?: "model" | "product"
  modelMeta?: { category: string; model: string; label: string } | null
  indexHref?: string
  reviewsHref?: string
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

  // Urutan tampilan diatur admin (tidak ada kontrol urut di halaman pembeli).
  // Pembeli hanya bisa MENCARI model/produk tertentu via ikon search.
  const [searchOpen, setSearchOpen] = React.useState(false)
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
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center gap-3">
            <Breadcrumbs
              singleLine={!isModelLevel}
              items={
                isModelLevel
                  ? [
                      { label: "Home", href: routeUrl("home") },
                      { label: "Hasil Pemasangan" },
                    ]
                  : [
                      { label: "Beranda", href: routeUrl("home") },
                      { label: "Hasil Pemasangan", href: listingHref },
                      { label: modelMeta?.label || heading },
                    ]
              }
            />
          </div>
        </div>

        {isModelLevel ? (
          <div className="container-page py-2 !px-2.5 md:!px-8 lg:!px-12">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden"
                  aria-label="Kembali"
                >
                  <Icon name="arrow-left" className="size-5" aria-hidden="true" />
                </button>
                <h1 className="text-base font-bold tracking-tight text-foreground">
                  {heading}
                </h1>
              </div>
              <div className="flex shrink-0 items-center">{searchControl}</div>
            </div>
          </div>
        ) : (
          <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
            <PageHeader title="Hasil Pemasangan" container={false} className="border-b-0" />
          </div>
        )}
      </section>

      <section className={isModelLevel ? "pt-4 pb-4 sm:pt-6 sm:pb-6" : "pt-0 pb-4 sm:pb-6"}>
        {isModelLevel ? (
          <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
            {filteredInstallations.length ? (
              <ShowcaseCardGrid className="gap-3 sm:gap-4">
                {filteredInstallations.map((item) => (
                  <InstallationCard
                    key={item.id}
                    item={{
                      ...item,
                      image: item.image ?? item.image_url,
                    }}
                  />
                ))}
              </ShowcaseCardGrid>
            ) : (
              <EmptyState
                icon="search"
                title={needle ? "Tidak ada hasil pencarian" : "Belum ada dokumentasi pemasangan"}
                description={
                  needle
                    ? `Tidak ada hasil pemasangan untuk “${searchQuery.trim()}”. Coba kata kunci lain.`
                    : "Foto hasil pemasangan akan tampil di sini setelah tersedia."
                }
              />
            )}
          </div>
        ) : (
          <div className="space-y-6 lg:space-y-8">
            {/* Hero — mengikuti halaman model produk: aspect-square + overlay judul */}
            {featured?.image_url ? (
              <div className="relative aspect-square w-full overflow-hidden">
                <ResponsiveImage
                  src={featured.image_url}
                  alt={heading}
                  loading="lazy"
                  wrapperClassName="absolute inset-0 size-full !aspect-auto bg-surface-muted"
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[170px] bg-gradient-to-b from-transparent to-black/60" />
                <div className="pointer-events-none absolute inset-x-0 bottom-12 p-3.5 sm:p-5">
                  <h1 className="font-bold leading-tight tracking-tight text-white text-sm sm:text-base">
                    {heading}
                  </h1>
                  {subtitle ? (
                    <p className="mt-1.5 max-w-xl truncate text-[11px] leading-snug text-white/90 sm:text-[13px]">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Statistik — mengikuti halaman model produk */}
            <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-base font-bold leading-tight tracking-tight text-foreground">
                    {installations.length}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">Produk</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-base font-bold leading-tight tracking-tight text-foreground">
                    {(featured?.photo_count ?? 0) + (featured?.video_count ?? 0)}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">Hasil pemasangan</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-base font-bold leading-tight tracking-tight text-foreground">100%</span>
                  <span className="text-[10px] font-medium text-muted-foreground">Garansi</span>
                </div>
              </div>
            </div>

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
      </section>
    </PublicLayout>
  )
}
