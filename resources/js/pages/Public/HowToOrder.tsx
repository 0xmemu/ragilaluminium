import { Head, Link, usePage } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { ClosingCTASection } from "@/components/public/closing-cta"
import { SectionHeading } from "@/components/shared/section-heading"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
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
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center gap-3">
                        <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Cara pemesanan", href: null },
            ]}
          />
          </div>
        </div>
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden"
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
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
          {/* Timeline alur pemesanan — titik ikon + garis penghubung kontinyu */}
          <ol className="relative mx-auto max-w-2xl">
            {guide.steps.map((step, index) => (
              <li
                key={`${step.title}-${index}`}
                className="relative flex gap-3.5 pb-6 last:pb-0 sm:gap-5 sm:pb-8
                  after:absolute after:left-[22px] after:top-12 after:bottom-0 after:w-px after:bg-border
                  last:after:hidden sm:after:left-[24px] sm:after:top-[52px]"
              >
                {/* Titik ikon di garis */}
                <div className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-primary shadow-xs sm:size-12">
                  <Icon name={step.icon} className="size-5 sm:size-6" aria-hidden="true" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 rounded-xl border border-border/80 bg-background p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md sm:p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Langkah {index + 1}
                  </p>
                  <h2 className="mt-0.5 text-sm font-bold tracking-tight text-foreground sm:text-base">
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
          <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
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
          <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
            <article
              className="cms-content mx-auto max-w-3xl rounded-xl border border-border/80 bg-background p-3.5 text-xs leading-relaxed text-muted-foreground sm:p-4"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>
        </section>
      ) : (
        <section className="border-t border-border bg-surface/50 py-3 sm:py-4">
          <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
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

      {/* Bagian 4: Call to Action (CTA) — pakai komponen dasar ClosingCTASection */}
      <ClosingCTASection
        compact={false}
        eyebrow="Siap memesan?"
        heading="Pilih model aluminium yang tepat, atau konsultasikan kebutuhan Anda lebih dulu"
        actions={[
          { label: "Pilih Model Produk", href: routeUrl("catalog.index"), variant: "primary" },
          {
            label: "Konsultasi Sekarang",
            href: whatsappUrl ?? routeUrl("contact"),
            variant: "secondary",
            whatsappIcon: true,
            external: true,
          },
        ]}
      />
    </PublicLayout>
  )
}

