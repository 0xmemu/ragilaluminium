import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import PublicLayout from "@/layouts/public-layout"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

interface GalleryImage {
  id: number
  url: string
  thumb?: string | null
}

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
  }
  media: GalleryImage[]
  indexHref: string
  modelHref?: string | null
  modelLabel?: string | null
}) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const active = media[activeIndex] ?? media[0] ?? null
  const docTitle = `${product.name} · Hasil pemasangan`
  const heading = pageMeta?.heading?.trim() || "Hasil pemasangan"

  function go(delta: number) {
    if (media.length < 2) return
    setActiveIndex((current) => (current + delta + media.length) % media.length)
  }

  const crumbs = [
    { label: "Beranda", href: routeUrl("home") },
    { label: heading, href: indexHref },
    ...(modelHref && modelLabel
      ? [{ label: modelLabel, href: modelHref }]
      : []),
    { label: product.name, href: null as string | null },
  ]

  return (
    <PublicLayout>
      <Head title={docTitle} />

      <section className="border-b border-border bg-surface">
        <div className="container-page py-6 md:py-8">
          <Breadcrumbs items={crumbs} />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {product.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {media.length} foto dokumentasi pemasangan untuk produk ini.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {modelHref ? (
                <Button asChild variant="secondary">
                  <Link href={modelHref}>Produk model ini</Link>
                </Button>
              ) : null}
              <Button asChild variant="secondary">
                <Link href={indexHref}>Semua model</Link>
              </Button>
              <Button asChild>
                <Link href={product.href}>Lihat produk</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="section-space">
        <div className="container-page">
          {active ? (
            <div className="mx-auto max-w-4xl">
              <div className="relative border border-border bg-[#fafafa]">
                <ResponsiveImage
                  src={active.url}
                  alt={`${product.name}, foto ${activeIndex + 1}`}
                  wrapperClassName="aspect-square"
                  className="object-contain"
                />
                {media.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:opacity-90"
                      aria-label="Foto sebelumnya"
                    >
                      <Icon name="caret-left" className="size-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:opacity-90"
                      aria-label="Foto berikutnya"
                    >
                      <Icon name="caret-right" className="size-5" aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Foto {activeIndex + 1} dari {media.length}
              </p>

              {media.length > 1 ? (
                <ul className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {media.map((item, index) => (
                    <li key={item.id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={cn(
                          "block size-16 overflow-hidden border-2 bg-[#fafafa] transition",
                          index === activeIndex ? "border-foreground" : "border-transparent opacity-80 hover:opacity-100",
                        )}
                        aria-label={`Tampilkan foto ${index + 1}`}
                        aria-current={index === activeIndex ? "true" : undefined}
                      >
                        <ResponsiveImage
                          src={item.thumb ?? item.url}
                          alt=""
                          wrapperClassName="size-16"
                          className="object-cover"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </PublicLayout>
  )
}
