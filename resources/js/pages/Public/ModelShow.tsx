import { Head, Link, usePage } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Pagination } from "@/components/ui/pagination"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import type { Pagination as PaginationData, SharedPageProps } from "@/types"

interface Benefit {
  icon: string
  title: string
}

interface Spec {
  label: string
  value: string
}

interface Inspiration {
  id: string
  image_url: string
  label: string
  href?: string | null
}

interface ModelShowProps {
  title: string
  category: string
  model: string
  hero: { image?: string | null; caption?: string | null }
  description: string
  benefits: Benefit[]
  specs: Spec[]
  inspirations: Inspiration[]
  pagination?: PaginationData | null
  catalog_href: string
  installations_href: string
  back_href: string
}

export default function ModelShow({
  title,
  hero,
  description,
  benefits = [],
  specs = [],
  inspirations = [],
  pagination = null,
  catalog_href,
  installations_href,
  back_href,
}: ModelShowProps) {
  const { brand, consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null
  const phoneHref = brand.phone ? `tel:${brand.phone.replace(/[^\d+]/g, "")}` : null
  const heroCaption = hero.caption?.trim() || null

  return (
    <PublicLayout>
      <Head title={`${title} | Ragil Aluminium`}>
        <meta name="description" content={description} />
      </Head>

      <div className="border-b border-border bg-surface">
        <div className="container-page py-4">
          <Link
            href={back_href || routeUrl("catalog.index")}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:text-primary"
          >
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali
          </Link>
        </div>
      </div>

      <section className="bg-surface">
        <div className="container-page pb-8 md:pb-12">
          <div className="relative overflow-hidden rounded-2xl bg-foreground">
            {hero.image ? (
              <ResponsiveImage
                src={hero.image}
                alt={title}
                wrapperClassName="aspect-[16/10] w-full sm:aspect-[21/9]"
                className="object-cover"
                loading="eager"
              />
            ) : (
              <div className="flex aspect-[16/10] w-full items-center justify-center bg-surface-muted sm:aspect-[21/9]">
                <p className="text-sm text-muted-foreground">Gambar model belum tersedia</p>
              </div>
            )}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
              <h1 className="max-w-3xl text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                {title}
              </h1>
              {heroCaption ? (
                <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">{heroCaption}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="section-space border-b border-border bg-white">
        <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.85fr)] lg:gap-12">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Detail Pemasangan
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              {description}
            </p>

            {benefits.length > 0 ? (
              <ul className="mt-8 grid gap-3 sm:grid-cols-3">
                {benefits.map((benefit) => (
                  <li
                    key={`${benefit.icon}-${benefit.title}`}
                    className="flex flex-col gap-3 rounded-xl bg-surface-muted px-4 py-5"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                      <Icon name={benefit.icon} className="size-5" weight="bold" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-semibold leading-snug text-foreground">{benefit.title}</p>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-8">
              <Button asChild size="lg">
                <Link href={catalog_href}>
                  <Icon name="shopping-cart" className="size-5" aria-hidden="true" />
                  Lihat Produk Terkait
                </Link>
              </Button>
            </div>
          </div>

          <aside className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Spesifikasi Unit</h2>
            {specs.length > 0 ? (
              <dl className="mt-5 divide-y divide-border">
                {specs.map((spec) => (
                  <div
                    key={`${spec.label}-${spec.value}`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 py-3 text-sm first:pt-0 last:pb-0"
                  >
                    <dt className="text-muted-foreground">{spec.label}</dt>
                    <dd className="text-right font-semibold text-foreground">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Spesifikasi belum diisi.</p>
            )}
          </aside>
        </div>
      </section>

      <section className="section-space bg-surface">
        <div className="container-page">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Inspirasi Pemasangan
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Dokumentasi pemasangan untuk model ini, diurutkan terbaru.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Urutkan: <span className="font-semibold text-foreground">Terbaru</span>
            </p>
          </div>

          {inspirations.length > 0 ? (
            <>
              <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {inspirations.map((item) => {
                  const body = (
                    <ResponsiveImage
                      src={item.image_url}
                      alt={item.label}
                      wrapperClassName="aspect-square w-full bg-surface-muted"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  )

                  return (
                    <li key={item.id} className="overflow-hidden rounded-xl border border-border bg-white">
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="group">{body}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
              <Pagination pagination={pagination} />
            </>
          ) : (
            <div className="mt-8">
              <EmptyState
                icon="image"
                title="Belum ada inspirasi pemasangan"
                description="Foto hasil pemasangan untuk model ini akan tampil di sini setelah tersedia."
                action={
                  <Button asChild variant="secondary">
                    <Link href={installations_href}>Lihat semua hasil pemasangan</Link>
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border bg-white py-14 sm:py-16">
        <div className="container-page mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Tingkatkan <span className="text-primary">kualitas</span>{" "}
            <span className="text-primary">bangunan</span> bersama kami!
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            Konsultasikan kebutuhan jendela, pintu, atau boven aluminium Anda — kami bantu pilih
            model dan ukuran yang tepat.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {whatsappUrl ? (
              <Button asChild size="lg" variant="secondary">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" className="size-5" aria-hidden="true" />
                  Konsultasi WhatsApp
                </a>
              </Button>
            ) : null}
            {phoneHref ? (
              <Button asChild size="lg">
                <a href={phoneHref}>
                  <Icon name="phone" className="size-5" aria-hidden="true" />
                  Hubungi Kami Sekarang
                </a>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href={routeUrl("contact")}>Hubungi Kami Sekarang</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
