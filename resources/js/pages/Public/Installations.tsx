import { Head, Link } from "@inertiajs/react"

import { InstallationCard } from "@/components/public/installation-card"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import type { InstallationItem } from "@/types"

export default function Installations({
  pageMeta,
  installations = [],
  reviewsHref,
}: {
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  installations?: InstallationItem[]
  reviewsHref?: string
}) {
  const heading = pageMeta?.heading?.trim() || "Hasil pemasangan kami."
  const subtitle =
    pageMeta?.subtitle?.trim() ||
    "Dokumentasi visual pemasangan dari pelanggan, dikelompokkan per produk."
  const docTitle = pageMeta?.title?.trim() || "Hasil Pemasangan"

  return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={subtitle} />
      </Head>

      <section className="border-b border-border bg-foreground text-background">
        <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:py-16">
          <div>
            <h1 className="max-w-3xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {heading}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-background/70 sm:text-base">{subtitle}</p>
          </div>
          <Button asChild variant="secondary" className="border-white/30 bg-white/10 text-background hover:bg-white/20">
            <Link href={reviewsHref ?? routeUrl("reviews")}>Lihat ulasan pelanggan</Link>
          </Button>
        </div>
      </section>

      <section className="section-space">
        <div className="container-page">
          {installations.length ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
              {installations.map((item) => (
                <InstallationCard
                  key={`install-${item.id}`}
                  item={{
                    ...item,
                    image: item.image ?? item.image_url,
                  }}
                />
              ))}
            </div>
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
