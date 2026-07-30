import { Head, Link } from "@inertiajs/react"

import { InstallationCard } from "@/components/public/installation-card"
import { ShowcaseCardGrid } from "@/components/public/product-card-grid"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { InstallationItem } from "@/types"

export default function Installations({
  pageMeta,
  installations = [],
  level = "model",
  modelMeta = null,
  indexHref,
  reviewsHref,
}: {
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  installations?: InstallationItem[]
  level?: "model" | "product"
  modelMeta?: { category: string; model: string; label: string } | null
  indexHref?: string
  reviewsHref?: string
}) {
  const isModelLevel = level !== "product"
  const heading = pageMeta?.heading?.trim() || (isModelLevel ? "Hasil pemasangan" : "Produk hasil pemasangan")
  const subtitle =
    pageMeta?.subtitle?.trim() ||
    (isModelLevel
      ? "Pilih model untuk melihat contoh pemasangan di rumah dan proyek nyata."
      : "Contoh pemasangan untuk produk dalam model ini.")
  const docTitle = pageMeta?.title?.trim() || "Hasil Pemasangan"
  const listingHref = indexHref || routeUrl("installation.index")

  return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={subtitle} />
      </Head>

      <section className="border-b border-border bg-foreground text-background">
        <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:py-16">
          <div>
            {!isModelLevel ? (
              <div className="mb-4">
                <Breadcrumbs
                  tone="onDark"
                  items={[
                    { label: "Beranda", href: routeUrl("home") },
                    { label: "Hasil pemasangan", href: listingHref },
                    { label: modelMeta?.label || heading, href: null },
                  ]}
                />
              </div>
            ) : null}
            <h1 className="max-w-3xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {heading}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-background/70 sm:text-base">{subtitle}</p>
            {installations.length ? (
              <p className="mt-3 text-sm text-background/60">
                {formatNumber(installations.length)}{" "}
                {isModelLevel ? "model" : "produk"} dengan dokumentasi
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {!isModelLevel ? (
              <Button asChild variant="secondary" className="border-white/30 bg-white/10 text-background hover:bg-white/20">
                <Link href={listingHref}>Semua model</Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary" className="border-white/30 bg-white/10 text-background hover:bg-white/20">
              <Link href={reviewsHref ?? routeUrl("reviews")}>Lihat ulasan pelanggan</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="section-space">
        <div className="container-page">
          {installations.length ? (
            <ShowcaseCardGrid>
              {installations.map((item) => (
                <InstallationCard
                  key={`install-${item.id}`}
                  level={isModelLevel ? "model" : "product"}
                  item={{
                    ...item,
                    image: item.image ?? item.image_url,
                  }}
                />
              ))}
            </ShowcaseCardGrid>
          ) : (
            <EmptyState
              icon="image"
              title="Belum ada dokumentasi pemasangan"
              description="Foto hasil pemasangan akan tampil di sini setelah tersedia."
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
