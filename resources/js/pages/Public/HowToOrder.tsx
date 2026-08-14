import { Head, Link, usePage } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { SectionHeading } from "@/components/shared/section-heading"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

interface OrderStep {
  icon: string
  title: string
  description: string
  points: string[]
}

interface InfoCard {
  icon: string
  title: string
  description: string
}

interface GuideProps {
  heading: string
  subtitle: string
  body_html: string
  steps: OrderStep[]
  info_cards: InfoCard[]
}

export default function HowToOrder({ guide }: { guide: GuideProps }) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null
  const bodyHtml = React.useMemo(
    () =>
      DOMPurify.sanitize(guide.body_html ?? "", {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
        FORBID_ATTR: ["style", "onerror", "onclick"],
      }),
    [guide.body_html],
  )

  return (
    <PublicLayout>
      <Head title="Cara pemesanan">
        <meta
          name="description"
          content="Panduan memesan jendela, pintu, dan bouven aluminium di Ragil Aluminium, dari memilih model hingga pesanan sampai."
        />
      </Head>

      {/* Baris Navigasi Breadcrumbs & Judul Halaman */}
      <section className="border-b border-border bg-surface">
        <div className="container-page !px-4 sm:!px-5 md:!px-8 lg:!px-12 hidden py-2 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Cara pemesanan", href: null },
            ]}
          />
        </div>
        <div className="container-page !px-4 sm:!px-5 md:!px-8 lg:!px-12 py-2.5 sm:py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-9 shrink-0 items-center justify-center sm:hidden text-foreground hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
              {guide.heading}
            </h1>
          </div>
        </div>
      </section>

      {/* Bagian 1: 4 Langkah Pemesanan (Mobile-optimized Horizontal Cards) */}
      <section className="py-4 sm:py-6 bg-surface">
        <div className="container-page !px-4 sm:!px-5 md:!px-8 lg:!px-12">
          <ol className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            {guide.steps.map((step, index) => (
              <li
                key={`${step.title}-${index}`}
                className="flex items-start gap-3.5 sm:gap-4 rounded-xl border border-border/80 bg-background p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
              >
                {/* Icon & Step Number */}
                <div className="relative flex size-11 sm:size-13 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon name={step.icon} className="size-5 sm:size-6" aria-hidden="true" />
                  <span className="tabular-nums absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#c20000] text-[10px] font-bold text-white shadow-xs">
                    {index + 1}
                  </span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                    {step.title}
                  </h2>
                  {step.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {step.description}
                    </p>
                  ) : null}
                  {step.points?.length ? (
                    <ul className="mt-2.5 grid gap-1 border-t border-border/40 pt-2">
                      {step.points.map((point) => (
                        <li key={point} className="flex items-start gap-1.5 text-xs text-foreground sm:text-sm">
                          <Icon
                            name="check-circle"
                            weight="fill"
                            className="mt-0.5 size-3.5 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Bagian 2: Pembayaran, Pengiriman & Bantuan (Compact on Mobile) */}
      {guide.info_cards.length ? (
        <section className="border-t border-border bg-surface py-5 sm:py-8">
          <div className="container-page !px-4 sm:!px-5 md:!px-8 lg:!px-12">
            <div className="mx-auto mb-4 sm:mb-5 max-w-xl text-center">
              <SectionHeading
                title="Pembayaran, Pengiriman & Bantuan"
                description="Informasi pendukung untuk menjamin kenyamanan dan keamanan pemesanan Anda."
              />
            </div>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guide.info_cards.map((card) => (
                <article
                  key={card.title}
                  className="flex items-start gap-3 rounded-xl border border-border/80 bg-background p-4 shadow-xs transition hover:border-foreground/20 hover:shadow-sm sm:flex-col sm:p-5"
                >
                  <span className="flex size-9 sm:size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name={card.icon} className="size-4.5 sm:size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 sm:mt-2">
                    <h3 className="text-sm font-bold tracking-tight text-foreground">{card.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {card.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Bagian 3: Catatan Ukuran Kustom */}
      {bodyHtml ? (
        <section className="border-t border-border bg-surface/50 py-3 sm:py-4">
          <div className="container-page !px-4 sm:!px-5 md:!px-8 lg:!px-12">
            <article
              className="cms-content mx-auto max-w-3xl rounded-xl border border-border/80 bg-background p-3.5 text-xs leading-relaxed text-muted-foreground sm:p-4"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>
        </section>
      ) : (
        <section className="border-t border-border bg-surface/50 py-3 sm:py-4">
          <div className="container-page !px-4 sm:!px-5 md:!px-8 lg:!px-12">
            <div className="flex items-start gap-2.5 sm:gap-3 rounded-xl border border-border/80 bg-background p-3.5 sm:p-4 text-xs leading-relaxed text-muted-foreground shadow-xs">
              <Icon name="info" weight="fill" className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <span className="font-bold text-foreground">Catatan Ukuran Custom: </span>
                Kami melayani ukuran custom. Sertakan model dan ukuran (Tinggi &times; Panjang, cm) saat chat
                admin agar spesifikasi sesuai dan tidak terjadi kesalahan produksi.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Bagian 4: Call to Action (CTA) ??? Compact & Sleek Spacing */}
      <section className="border-t border-border bg-[#141414] py-5 sm:py-6 text-white">
        <div className="container-page !px-4 sm:!px-5 md:!px-8 lg:!px-12 flex flex-col items-center text-center">
          <SectionHeading
            className="text-white [&_h2]:text-white [&_p]:text-white/75"
            title="Siap Memesan?"
            description="Pilih model aluminium yang tepat, atau konsultasikan kebutuhan Anda lebih dulu."
          />
          <div className="mt-3.5 sm:mt-4 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
            <Button
              asChild
              className="h-9 sm:h-9.5 bg-[#c20000] text-white hover:bg-[#a80000] px-5 text-xs sm:text-sm font-semibold shadow-sm sm:min-w-[160px]"
            >
              <Link href={routeUrl("catalog.index")}>Pilih Model Produk</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="h-9 sm:h-9.5 border border-white/20 bg-white/5 text-white hover:bg-white/10 px-5 text-xs sm:text-sm font-medium sm:min-w-[160px]"
            >
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
                  <Icon name="whatsapp" className="h-4 w-4 text-[#25D366]" aria-hidden="true" />
                  <span>Konsultasi Sekarang</span>
                </a>
              ) : (
                <Link href={routeUrl("contact")} className="flex items-center justify-center gap-2">
                  <Icon name="whatsapp" className="h-4 w-4 text-[#25D366]" aria-hidden="true" />
                  <span>Konsultasi Sekarang</span>
                </Link>
              )}
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}

