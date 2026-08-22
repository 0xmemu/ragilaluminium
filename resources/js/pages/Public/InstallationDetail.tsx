import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import {
  InstallationLightbox,
  type InstallationLightboxItem,
} from "@/components/public/installation-lightbox"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import PublicLayout from "@/layouts/public-layout"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import { formatCurrency } from "@/lib/format"

export default function InstallationDetail({
  pageMeta,
  product,
  media = [],
  indexHref,
  modelHref = null,
  modelLabel = null,
}: {
  pageMeta?: { title?: string; heading?: string } | null
  product: {
    id: number
    parent_sku: string
    name: string
    href: string
    category?: string | null
    model?: string | null
    image?: string | null
    min_price?: number | null
  }
  media: InstallationLightboxItem[]
  indexHref: string
  modelHref?: string | null
  modelLabel?: string | null
}) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [lightboxOpen, setLightboxOpen] = React.useState(false)
  const active = media[activeIndex] ?? media[0] ?? null
  const docTitle = `${product.name} · Hasil pemasangan`
  const heading = pageMeta?.heading?.trim() || "Hasil pemasangan"
  const photoCount = media.filter((item) => !item.is_video).length
  const videoCount = media.filter((item) => item.is_video).length

  function go(delta: number) {
    if (media.length < 2) return
    setActiveIndex((current) => (current + delta + media.length) % media.length)
  }

  function openLightbox(index: number) {
    setActiveIndex(index)
    setLightboxOpen(true)
  }

  const crumbs = [
    { label: "Beranda", href: routeUrl("home") },
    { label: heading, href: indexHref },
    ...(modelHref && modelLabel ? [{ label: modelLabel, href: modelHref }] : []),
    { label: product.name, href: null as string | null },
  ]

  const countLabel = [
    photoCount > 0 ? `${photoCount} foto` : null,
    videoCount > 0 ? `${videoCount} video` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <PublicLayout>
      <Head title={docTitle} />

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center gap-3">
                        <Breadcrumbs items={crumbs} />
          </div>
        </div>
        <div className="container-page flex flex-col gap-3 py-2 sm:flex-row !px-2.5 md:!px-8 lg:!px-12 sm:items-end sm:justify-between">
          <div>
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
                {product.name}
              </h1>
            </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {modelHref ? (
                <Button asChild variant="secondary" className="w-full sm:w-auto">
                  <Link href={modelHref}>Produk model ini</Link>
                </Button>
              ) : null}
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link href={indexHref}>Semua model</Link>
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <Link href={product.href}>Lihat produk</Link>
              </Button>
            </div>
          </div>
      </section>

      {/* Item pemasangan — card gaya checkout: gambar + nama + kategori/model + harga */}
      <section className="container-page !px-2.5 md:!px-8 lg:!px-12 py-2">
        <h2 className="text-sm font-bold tracking-tight text-foreground">Item pemasangan</h2>
        <article className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-surface p-3 sm:gap-4 sm:p-4">
          {product.image ? (
            <ResponsiveImage
              src={product.image}
              alt={product.name}
              wrapperClassName="size-[75px] shrink-0 rounded-[5px] bg-muted"
              className="object-cover"
            />
          ) : (
            <span className="flex size-[75px] shrink-0 items-center justify-center rounded-[5px] bg-muted text-muted-foreground">
              <Icon name="images" className="size-6" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <Link
              href={product.href}
              className="line-clamp-2 block text-[13px] font-semibold leading-4 text-foreground hover:text-primary"
            >
              {product.name}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {[product.category, product.model].filter(Boolean).join(" · ")}
            </p>
            {typeof product.min_price === "number" ? (
              <p className="mt-1 text-[13px] font-bold text-sale">
                Mulai {formatCurrency(product.min_price)}
              </p>
            ) : null}
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href={product.href}>Lihat Produk</Link>
          </Button>
        </article>
      </section>

      <section className="pt-4 pb-4 sm:pt-6 sm:pb-6 lg:pt-6">
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
          {active ? (
            <div className="mx-auto max-w-4xl">
              <div className="relative border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => openLightbox(activeIndex)}
                  className="group relative block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Perbesar ${active.is_video ? "video" : "foto"} ${activeIndex + 1}`}
                >
                  {active.is_video ? (
                    <div className="relative aspect-square bg-foreground/90">
                      {active.thumb ? (
                        <ResponsiveImage
                          src={active.thumb}
                          alt=""
                          wrapperClassName="aspect-square"
                          className="object-cover opacity-80"
                        />
                      ) : (
                        <div className="aspect-square" aria-hidden />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="inline-flex size-16 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md transition group-hover:scale-105">
                          <Icon name="play" className="size-8" weight="fill" aria-hidden />
                        </span>
                      </span>
                    </div>
                  ) : (
                    <ResponsiveImage
                      src={active.url}
                      alt={`${product.name}, foto ${activeIndex + 1}`}
                      wrapperClassName="aspect-square"
                      className="object-contain transition group-hover:opacity-95"
                    />
                  )}
                  <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-foreground/75 px-2.5 py-1 text-xs font-semibold text-background backdrop-blur-sm">
                    Ketuk untuk perbesar
                  </span>
                </button>

                {media.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:opacity-90"
                      aria-label="Media sebelumnya"
                    >
                      <Icon name="arrow-left" className="size-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:opacity-90"
                      aria-label="Media berikutnya"
                    >
                      <Icon name="arrow-right" className="size-5" aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </div>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                {active.is_video ? "Video" : "Foto"} {activeIndex + 1} dari {media.length}
                {countLabel ? ` · ${countLabel}` : ""}
              </p>

              {media.length > 1 ? (
                <ul className="scrollbar-x mt-4 flex gap-2 overflow-x-auto pb-3">
                  {media.map((item, index) => (
                    <li key={item.id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        onDoubleClick={() => openLightbox(index)}
                        className={cn(
                          "relative block size-16 overflow-hidden border-2 bg-surface transition",
                          index === activeIndex
                            ? "border-foreground"
                            : "border-transparent opacity-80 hover:opacity-100",
                        )}
                        aria-label={`Tampilkan ${item.is_video ? "video" : "foto"} ${index + 1}`}
                        aria-current={index === activeIndex ? "true" : undefined}
                      >
                        {item.thumb || !item.is_video ? (
                          <ResponsiveImage
                            src={item.thumb ?? item.url}
                            alt=""
                            wrapperClassName="size-16"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex size-16 items-center justify-center bg-muted text-muted-foreground">
                            <Icon name="video" className="size-5" aria-hidden />
                          </span>
                        )}
                        {item.is_video ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-foreground/25">
                            <Icon name="play" className="size-4 text-white" weight="fill" aria-hidden />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <InstallationLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        items={media}
        index={activeIndex}
        onIndexChange={setActiveIndex}
        productName={product.name}
      />
    </PublicLayout>
  )
}
