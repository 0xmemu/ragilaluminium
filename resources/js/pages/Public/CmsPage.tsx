import { Head, Link, usePage } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { StorefrontPlatforms } from "@/components/public/storefront-platforms"
import { Icon } from "@/components/shared/icon"
import { SectionHeading } from "@/components/shared/section-heading"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import PublicLayout from "@/layouts/public-layout"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

interface CmsPageData {
  title: string
  heading?: string
  body: string
  slug: string
}

const WHY_POINTS = [
  {
    icon: "ruler",
    title: "30.000+ Variasi",
    body: "Ukuran & model lengkap untuk hunian, kantor, dan proyek.",
  },
  {
    icon: "truck",
    title: "Kirim Nasional",
    body: "Pengiriman aman dengan armada terpercaya ke seluruh Indonesia.",
  },
  {
    icon: "storefront",
    title: "Produksi Sendiri",
    body: "Dikerjakan tim berpengalaman dengan standar kualitas ketat.",
  },
  {
    icon: "lightning",
    title: "Proses Cepat",
    body: "Diproses & dikirim maksimal 1 hari kerja (sesuai antrian).",
  },
] as const

const TRUST_POINTS = [
  {
    icon: "package",
    title: "Unit Terpasang",
    body: "Ratusan ribu unit di rumah dan bangunan pelanggan.",
  },
  {
    icon: "trend-up",
    title: "Jangkauan Nasional",
    body: "Dari Sabang sampai Merauke, kami siap kirim.",
  },
  {
    icon: "shield-check",
    title: "Garansi Pengembalian",
    body: "Perlindungan bila produk tidak sesuai spesifikasi.",
  },
  {
    icon: "badge-check",
    title: "Konfirmasi Detail",
    body: "Ukuran, alamat, dan jadwal dikonfirmasi sebelum produksi.",
  },
] as const

const WORK_STEPS = [
  {
    icon: "shopping-cart",
    title: "Pilih Produk",
    body: "Pilih model dan ukuran di katalog.",
  },
  {
    icon: "whatsapp",
    title: "Konfirmasi WhatsApp",
    body: "Detail pesanan, ukuran, alamat, dan jadwal kirim.",
  },
  {
    icon: "truck",
    title: "Produk Dikirim",
    body: "Diproses, dikirim, dan bisa dilacak lewat menu Pesanan.",
  },
] as const

function parseStatFigure(label: string): { figure: string; caption: string } {
  const match = label.match(/^([\d.+\u00a0\s]+)\s*(.*)$/u)
  if (!match) {
    return { figure: label, caption: "" }
  }
  return {
    figure: match[1].replace(/\u00a0/g, " ").trim(),
    caption: match[2].trim(),
  }
}

export default function CmsPage({ page }: { page: CmsPageData }) {
  const { brand, consultationWhatsApp, platforms = [] } = usePage<SharedPageProps>().props
  const cleanBody = React.useMemo(
    () =>
      DOMPurify.sanitize(page.body, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
        FORBID_ATTR: ["style", "onerror", "onclick"],
      }),
    [page.body],
  )
  const isContact = page.slug === "kontak"
  const isAbout = page.slug === "tentang-kami"
  const heading = page.heading?.trim() || page.title
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null
  const phoneHref = brand.phone ? `tel:${brand.phone.replace(/\s/g, "")}` : null
  const yearsLabel = brand.years_experience_label ?? "15+ Tahun Pengalaman"
  const unitsLabel = brand.units_installed_label ?? "Unit Terpasang di Seluruh Indonesia"

  if (isAbout) {
    const years = parseStatFigure(yearsLabel)
    const units = parseStatFigure(unitsLabel)

    return (
      <PublicLayout>
        <Head title={page.title}>
          <meta name="description" content={`${page.title} Ragil Aluminium.`} />
        </Head>

        {/* Hero — brand first, editorial stats */}
        <section className="relative overflow-hidden border-b border-border bg-surface-muted">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          />
          <div className="container-page py-5">
            <div className="flex justify-center">
              <Breadcrumbs
                items={[
                  { label: "Beranda", href: routeUrl("home") },
                  { label: "Informasi Toko", href: null },
                ]}
              />
            </div>
          </div>
          <div className="container-page mx-auto max-w-5xl pb-16 pt-8 text-center lg:pb-24 lg:pt-12">
            <div className="mx-auto flex max-w-lg flex-col items-center">
              <h1 className="flex justify-center">
                <img
                  src="/images/brand/light-logo.png"
                  alt={brand.short_name || "Ragil Aluminium"}
                  width={420}
                  height={110}
                  className="h-16 w-auto max-w-[min(100%,22rem)] object-contain object-center sm:h-20 lg:h-24 lg:max-w-[28rem]"
                  decoding="async"
                />
              </h1>
              <p className="mt-2 max-w-md text-pretty text-sm font-semibold leading-6 tracking-tight text-muted-foreground sm:mt-2.5 sm:text-base">
                {brand.tagline || "Pusat Belanja Jendela Aluminium"}
              </p>
            </div>

            <div
              aria-hidden="true"
              className="mx-auto mt-10 h-px w-16 bg-primary/35 sm:mt-12"
            />

            <ul className="mx-auto mt-8 flex max-w-xl flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:items-center sm:justify-center sm:gap-0">
              <li className="flex flex-1 items-center gap-4 rounded-xl bg-white/80 px-5 py-4 sm:justify-center sm:rounded-none sm:bg-transparent sm:px-8 sm:py-0">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon name="badge-check" className="size-6" weight="bold" aria-hidden="true" />
                </span>
                <div className="min-w-0 text-left">
                  <p className="tabular-nums text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                    {years.figure || "15+"}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold tracking-tight text-muted-foreground sm:text-sm">
                    {years.caption || "Tahun Pengalaman"}
                  </p>
                </div>
              </li>
              <li
                aria-hidden="true"
                className="hidden h-12 w-px shrink-0 bg-primary/25 sm:block"
              />
              <li className="flex flex-1 items-center gap-4 rounded-xl bg-white/80 px-5 py-4 sm:justify-center sm:rounded-none sm:bg-transparent sm:px-8 sm:py-0">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon name="package" className="size-6" weight="bold" aria-hidden="true" />
                </span>
                <div className="min-w-0 text-left">
                  <p className="tabular-nums text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                    {units.figure || "1.000.000+"}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold tracking-tight text-muted-foreground sm:text-sm">
                    {units.caption || "Unit Terpasang"}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <div className="bg-background">
          {/* Intro */}
          <section className="container-page py-14 lg:py-20">
            <article
              className={cn(
                "cms-content mx-auto max-w-[42rem] text-left text-base leading-7 text-foreground sm:text-lg sm:leading-8",
                "[&_p]:text-pretty [&_p+p]:mt-5",
              )}
              dangerouslySetInnerHTML={{ __html: cleanBody }}
            />
          </section>

          {/* Why */}
          <section
            className="relative border-y border-border bg-surface-muted py-14 lg:py-20"
            aria-labelledby="why-ragil"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
            />
            <div className="container-page">
              <SectionHeading id="why-ragil" size="display">
                Kenapa Memilih Ragil Aluminium
              </SectionHeading>
              <ul className="mx-auto mt-12 grid max-w-5xl gap-0 sm:grid-cols-2 lg:grid-cols-4">
                {WHY_POINTS.map((item, index) => (
                  <li
                    key={item.title}
                    className={cn(
                      "flex flex-col items-center px-5 py-8 text-center sm:px-6",
                      index > 0 && "border-t border-border sm:border-t-0 sm:border-l",
                      index === 2 && "lg:border-l",
                    )}
                  >
                    <span className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary shadow-soft">
                      <Icon name={item.icon} className="size-6" weight="bold" aria-hidden="true" />
                    </span>
                    <p className="mt-5 text-sm font-bold tracking-tight text-foreground sm:text-base">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Trust */}
          <section className="container-page py-14 lg:py-20" aria-labelledby="trust-ragil">
            <SectionHeading id="trust-ragil" size="display">
              Dipercaya Oleh Banyak Pelanggan
            </SectionHeading>
            <ul className="mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-2">
              {TRUST_POINTS.map((item) => (
                <li key={item.title} className="flex gap-4 text-left">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
                    <Icon name={item.icon} className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* How */}
          <section className="border-y border-border bg-surface-muted py-14 lg:py-20" aria-labelledby="how-ragil">
            <div className="container-page">
              <SectionHeading id="how-ragil" size="display">
                Cara Kerja Kami
              </SectionHeading>
              <ol className="mx-auto mt-10 grid max-w-3xl gap-4">
                {WORK_STEPS.map((item, index) => (
                  <li
                    key={item.title}
                    className="flex items-center gap-4 border border-border bg-white p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(10,0,0,0.1)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:gap-6 sm:p-6"
                  >
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground sm:size-16">
                      <Icon name={item.icon} className="size-6 sm:size-7" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <span className="tabular-nums mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                          {index + 1}
                        </span>
                        <h3 className="text-sm font-bold leading-snug tracking-tight text-foreground sm:text-base">
                          {item.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" variant="secondary">
                  <Link href={routeUrl("catalog.index")}>Pilih Model Produk</Link>
                </Button>
                {whatsappUrl ? (
                  <Button asChild size="lg">
                    <a href={whatsappUrl} target="_blank" rel="noreferrer">
                      <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                      Konsultasi Via WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          {/* Contact + Ikuti Kami side by side */}
          <section className="relative bg-foreground text-background" aria-labelledby="contact-ragil">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
            />
            <div className="container-page py-14 lg:py-16">
              <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-14 lg:items-start">
                <div>
                  <h2
                    id="contact-ragil"
                    className="text-balance text-2xl font-bold tracking-tight sm:text-3xl"
                  >
                    Informasi Kontak
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-background/75">
                    Kunjungi toko atau hubungi tim Ragil Aluminium.
                  </p>

                  <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
                    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 py-4">
                      <span className="mt-0.5 flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                        <Icon name="map-pin" className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-bold tracking-tight text-background">
                          Alamat
                        </p>
                        <p className="mt-1.5 text-sm font-normal leading-6 text-background/75">
                          {brand.address}
                        </p>
                        {brand.maps_url ? (
                          <a
                            href={brand.maps_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                          >
                            Buka di Google Maps
                            <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>
                    </li>

                    {brand.phone ? (
                      <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 py-4">
                        <span className="mt-0.5 flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                          <Icon name="whatsapp" className="size-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-bold tracking-tight text-background">
                            WhatsApp / Telepon
                          </p>
                          <p className="mt-1.5 text-sm font-normal text-background/75">
                            {phoneHref ? (
                              <a href={phoneHref} className="transition hover:text-primary">
                                {brand.phone}
                              </a>
                            ) : (
                              brand.phone
                            )}
                          </p>
                          {whatsappUrl ? (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                            >
                              Chat WhatsApp
                              <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      </li>
                    ) : null}

                    {brand.email ? (
                      <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 py-4">
                        <span className="mt-0.5 flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                          <Icon name="envelope" className="size-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-bold tracking-tight text-background">
                            Email
                          </p>
                          <p className="mt-1.5 break-all text-sm font-normal text-background/75">
                            <a
                              href={`mailto:${brand.email}`}
                              className="transition hover:text-primary"
                            >
                              {brand.email}
                            </a>
                          </p>
                        </div>
                      </li>
                    ) : null}

                    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 py-4">
                      <span className="mt-0.5 flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                        <Icon name="clock" className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-bold tracking-tight text-background">
                          Jam Operasional
                        </p>
                        <p className="mt-1.5 text-sm font-normal text-background/75">
                          {brand.hours ?? "Senin – Sabtu, 08.00 – 17.00 WIB"}
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col gap-8 lg:pt-1">
                  {platforms.length ? (
                    <StorefrontPlatforms
                      platforms={platforms}
                      title="Ikuti Kami"
                      variant="dark"
                      align="start"
                    />
                  ) : null}

                  {brand.maps_embed_url ? (
                    <div className="relative min-h-[14rem] w-full flex-1 overflow-hidden border border-white/10 border-l-[3px] border-l-primary bg-white/5 sm:min-h-[16rem] lg:min-h-[18rem]">
                      <iframe
                        title="Peta lokasi Ragil Aluminium"
                        src={brand.maps_embed_url}
                        className="absolute inset-0 h-full w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <Head title={page.title}>
        <meta name="description" content={`${page.title} Ragil Aluminium.`} />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page py-6">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: page.title, href: null },
            ]}
          />
        </div>
        <div className="container-page pb-12 pt-8 lg:pb-18 lg:pt-12">
          <h1 className="max-w-3xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
            {heading}
          </h1>
        </div>
      </section>

      <section className="container-page py-10 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,44rem)_18rem] lg:justify-between">
          <div className="min-w-0 space-y-12">
            <article
              className="cms-content"
              dangerouslySetInnerHTML={{ __html: cleanBody }}
            />
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            {isContact ? (
              <div className="surface-panel p-5">
                <h2 className="text-xl font-semibold">Kontak Ragil</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{brand.address}</p>
                <div className="mt-5 grid gap-2">
                  {whatsappUrl ? (
                    <Button asChild>
                      <a href={whatsappUrl} target="_blank" rel="noreferrer">
                        <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                        {consultationWhatsApp?.directLabel ?? "Chat WhatsApp"}
                      </a>
                    </Button>
                  ) : null}
                  {phoneHref ? (
                    <Button asChild variant={whatsappUrl ? "secondary" : undefined}>
                      <a href={phoneHref}>
                        <Icon name="headset" className="h-4 w-4" aria-hidden="true" />
                        Telepon
                      </a>
                    </Button>
                  ) : null}
                  <Button asChild variant="secondary">
                    <a href={`mailto:${brand.email}`}>Kirim email</a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-lg font-semibold">Butuh bantuan?</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Lihat pertanyaan umum atau hubungi tim Ragil untuk informasi produk.
                </p>
                <div className="mt-4 grid">
                  <Link
                    href={routeUrl("faq")}
                    className="flex min-h-11 items-center justify-between border-b border-border text-sm font-semibold hover:text-primary"
                  >
                    Sering ditanyakan
                    <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href={routeUrl("contact")}
                    className="flex min-h-11 items-center justify-between text-sm font-semibold hover:text-primary"
                  >
                    Hubungi kami
                    <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )}

            <nav className="rounded-lg bg-surface-muted p-5" aria-label="Informasi terkait">
              <p className="text-xs font-bold tracking-tight text-muted-foreground">
                Informasi lain
              </p>
              <ul className="mt-3 space-y-1">
                {[
                  ["Cara Pemesanan", "cara-pemesanan"],
                  ["Kebijakan Privasi", "privacy"],
                  ["Ketentuan Layanan", "terms"],
                ].map(([label, routeName]) => (
                  <li key={routeName}>
                    <Link
                      href={routeUrl(routeName)}
                      className="flex min-h-10 items-center text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </section>
    </PublicLayout>
  )
}
