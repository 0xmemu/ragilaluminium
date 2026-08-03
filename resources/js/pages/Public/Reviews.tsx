import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { GalleryLightbox, toGalleryItems } from "@/components/public/gallery-lightbox"
import { TestimonialCard } from "@/components/public/testimonial-card"
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
        <div className="container-page grid gap-4 py-5">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: heading, href: null },
            ]}
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{heading}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
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
        </div>
      </section>

      <section className="section-space">
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
