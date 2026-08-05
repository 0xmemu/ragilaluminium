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

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden py-4 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Cara pemesanan", href: null },
            ]}
          />
        </div>
        <div className="container-page pb-4 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex shrink-0 items-center justify-center"
              aria-label="Kembali"
            >
              <Icon name="caret-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-lg font-bold leading-snug tracking-tight text-foreground">
              {guide.heading}
            </h1>
          </div>
        </div>
      </section>

      <section className="py-4">
        <div className="container-page">
          <ol className="grid gap-3 sm:grid-cols-2">
            {guide.steps.map((step, index) => (
              <li
                key={`${step.title}-${index}`}
                className="flex flex-col gap-4 border border-border bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(10,0,0,0.1)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:flex-row sm:items-start sm:gap-5 sm:p-5"
              >
                <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground sm:size-16">
                  <Icon name={step.icon} className="size-6 sm:size-7" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                      {index + 1}
                    </span>
                    <h2 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                      {step.title}
                    </h2>
                  </div>
                  {step.description ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                  ) : null}
                  {step.points?.length ? (
                    <ul className="mt-3 grid gap-1.5">
                      {step.points.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-sm text-foreground">
                          <Icon
                            name="check-circle"
                            weight="fill"
                            className="mt-0.5 size-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          {point}
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

      {guide.info_cards.length ? (
        <section className="border-t border-border bg-surface py-4">
          <div className="container-page">
            <div className="mx-auto mb-4 max-w-xl text-center md:mb-6">
              <SectionHeading title="Pembayaran, pengiriman & bantuan" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guide.info_cards.map((card) => (
                <article key={card.title} className="border border-border bg-white p-4 sm:p-5">
                  <span className="flex size-11 items-center justify-center rounded-md bg-accent text-primary">
                    <Icon name={card.icon} className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-2 text-sm font-bold tracking-tight text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {bodyHtml ? (
        <section className="py-4 border-t border-border">
          <div className="container-page">
            <article
              className="cms-content mx-auto max-w-3xl text-xs leading-5 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>
        </section>
      ) : (
        <section className="py-4 border-t border-border">
          <div className="container-page">
            <div className="text-xs leading-5 text-muted-foreground">
              <p>
                <span className="font-bold text-foreground">*Catatan Ukuran Custom:</span> Kami
                melayani ukuran custom. Sertakan model dan ukuran (Tinggi × Panjang, cm) saat chat
                admin agar spesifikasi sesuai dan tidak terjadi kesalahan produksi.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="py-4 border-t border-border bg-foreground text-background">
        <div className="container-page flex flex-col items-center text-center">
          <SectionHeading
            className="text-background [&_h2]:text-background [&_p]:text-background/80"
            title="Siap memesan?"
            description="Pilih model aluminium yang tepat, atau konsultasikan kebutuhan Anda lebih dulu."
          />
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button asChild className="bg-white text-primary hover:bg-white/90 sm:min-w-[180px]">
              <Link href={routeUrl("catalog.index")}>Pilih model produk</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="border-background/30 bg-transparent text-background hover:bg-background/10 sm:min-w-[180px]"
            >
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                  Konsultasi Sekarang
                </a>
              ) : (
                <Link href={routeUrl("contact")}>
                  <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                  Konsultasi Sekarang
                </Link>
              )}
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
