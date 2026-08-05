import { Head, Link } from "@inertiajs/react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/shared/icon"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"

const COPY: Record<
  number,
  { title: string; body: string; primaryHref: string; primaryLabel: string; secondaryHref: string; secondaryLabel: string }
> = {
  403: {
    title: "Akses dibatasi",
    body: "Anda tidak memiliki izin untuk membuka halaman ini.",
    primaryHref: "home",
    primaryLabel: "Ke Beranda",
    secondaryHref: "catalog.index",
    secondaryLabel: "Lihat Model Produk",
  },
  404: {
    title: "Halaman ini tidak ditemukan",
    body: "Mungkin tautannya sudah berubah atau halaman sudah tidak tersedia.",
    primaryHref: "home",
    primaryLabel: "Ke Beranda",
    secondaryHref: "catalog.index",
    secondaryLabel: "Lihat Model Produk",
  },
  500: {
    title: "Terjadi gangguan sementara",
    body: "Sistem kami sedang memulihkan layanan. Silakan coba lagi sebentar lagi.",
    primaryHref: "home",
    primaryLabel: "Ke Beranda",
    secondaryHref: "catalog.index",
    secondaryLabel: "Lihat katalog",
  },
  503: {
    title: "Layanan sedang dirawat",
    body: "Kami akan segera kembali. Terima kasih atas kesabaran Anda.",
    primaryHref: "home",
    primaryLabel: "Ke Beranda",
    secondaryHref: "catalog.index",
    secondaryLabel: "Lihat katalog",
  },
}

export default function ErrorPage({ status }: { status: number }) {
  const copy = COPY[status] ?? COPY[404]
  const primary = routeUrl(copy.primaryHref)
  const secondary = routeUrl(copy.secondaryHref)

  return (
    <PublicLayout>
      <Head title={`${status} · Ragil Aluminium`} />
      <section className="container-page flex min-h-[55dvh] flex-col items-center justify-center py-16 text-center sm:py-20">
        <BrandWordmark className="mx-auto w-fit" />
        <p className="mt-8 font-display text-6xl font-bold tracking-tight text-foreground/15 sm:text-7xl">
          {status}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex shrink-0 items-center justify-center sm:hidden"
            aria-label="Kembali"
          >
            <Icon name="caret-left" className="size-5" aria-hidden="true" />
          </button>
          <h1 className="mt-4 max-w-xl font-display text-lg font-bold tracking-tight text-foreground">
          {copy.title}
        </h1>
        </div>
        <p className="mt-3 max-w-lg text-lg leading-7 text-muted-foreground">{copy.body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-full px-7">
            <Link href={primary}>{copy.primaryLabel}</Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-full px-7">
            <Link href={secondary}>{copy.secondaryLabel}</Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  )
}
