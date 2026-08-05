import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { GalleryLightbox, toGalleryItems } from "@/components/public/gallery-lightbox"
import { TestimonialCard } from "@/components/public/testimonial-card"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps, Testimonial } from "@/types"

/** Halaman galeri "Apa kata pelanggan kami" — grid 1:1 tanpa frame, tanpa sort/filter. */
export default function Reviews({
  pageMeta,
  marketplaceTestimonials = [],
  installationsHref,
}: {
  pageMeta?: { title: string; heading: string; subtitle: string } | null
  marketplaceTestimonials?: Testimonial[]
  installationsHref?: string
}) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const heading = pageMeta?.heading?.trim().replace(/\.$/, "") || "Apa kata pelanggan kami"
  const subtitle =
    pageMeta?.subtitle?.trim() ||
    "Screenshot percakapan Shopee atau WhatsApp di luar transaksi website."
  const docTitle = pageMeta?.title?.trim() || heading

  const galleryItems = React.useMemo(() => toGalleryItems(marketplaceTestimonials), [marketplaceTestimonials])
  const [lightboxIndex, setLightboxIndex] = React.useState(-1)

  return (
    <PublicLayout>
      <Head title={docTitle}>
        <meta name="description" content={subtitle} />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden py-4 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: heading, href: null },
            ]}
          />
        </div>
        <div className="container-page flex flex-col gap-4 pb-4 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="flex shrink-0 items-center justify-center"
                aria-label="Kembali"
              >
                <Icon name="caret-left" className="size-5" aria-hidden="true" />
              </button>
              <h1 className="text-lg font-semibold tracking-tight">{heading}</h1>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href={routeUrl("ulasan")}>Ulasan pelanggan di website</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={installationsHref ?? routeUrl("installation.index")}>
                  Hasil pemasangan
                </Link>
              </Button>
            </div>
        </div>
      </section>

      <section className="py-4">
        <div className="container-page">
          {marketplaceTestimonials.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
              {marketplaceTestimonials.map((testimonial) => {
                const itemIndex = galleryItems.findIndex((g) => g.src === testimonial.image_url)
                return (
                  <TestimonialCard
                    key={testimonial.id}
                    testimonial={testimonial}
                    compact
                    variant="screenshot"
                    onOpen={itemIndex >= 0 ? () => setLightboxIndex(itemIndex) : undefined}
                  />
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon="message-circle"
              title="Belum ada screenshot"
              description="Bukti percakapan pelanggan akan tampil di sini. Sementara itu, lihat hasil pemasangan kami atau tanya langsung via WhatsApp."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild variant="secondary">
                    <Link href={installationsHref ?? routeUrl("installation.index")}>
                      Hasil pemasangan
                    </Link>
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
