import { Head, Link, usePage } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

interface Pair {
  id: number
  problem: string
  solution: string
}

interface Guide {
  title: string
  heading: string
  subtitle: string
  items: Pair[]
}

export default function MasalahSolusi({ guide }: { guide: Guide }) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null

  return (
    <PublicLayout>
      <Head title={guide.title}>
        <meta
          name="description"
          content={guide.subtitle || "Kendala umum pemasangan dan solusi produk aluminium Ragil."}
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page py-6">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Masalah & solusi", href: null },
            ]}
          />
        </div>
        <div className="container-page flex flex-col items-center pb-12 pt-6 text-center lg:pb-16">
          <h1 className="max-w-2xl text-2xl font-bold leading-snug tracking-tight sm:text-3xl md:text-4xl">
            {guide.heading}
          </h1>
          {guide.subtitle ? (
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{guide.subtitle}</p>
          ) : null}
        </div>
      </section>

      <section className="section-space">
        <div className="container-page">
          {guide.items.length ? (
            <ol className="mx-auto grid max-w-4xl gap-4">
              {guide.items.map((item, index) => (
                <li
                  key={item.id}
                  className="grid gap-0 overflow-hidden border border-border bg-surface lg:grid-cols-2"
                >
                  <article className="border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                        {index + 1}
                      </span>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Masalah</p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-foreground sm:text-base">
                      {item.problem}
                    </p>
                  </article>
                  <article className="bg-accent/30 p-5 sm:p-6">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Solusi Ragil</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground sm:text-base">
                      {item.solution}
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="Konten segera hadir"
              description="Tim kami sedang menyusun panduan masalah & solusi. Sementara itu, chat WhatsApp untuk konsultasi."
              className="mx-auto max-w-lg"
            />
          )}

          <div className="mx-auto mt-12 max-w-xl text-center">
            <p className="text-sm text-muted-foreground">Masih ragu spesifikasi yang tepat?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button asChild variant="secondary">
                <Link href={routeUrl("faq")}>Lihat FAQ</Link>
              </Button>
              <Button asChild>
                {whatsappUrl ? (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                    Konsultasi WhatsApp
                  </a>
                ) : (
                  <Link href={routeUrl("contact")}>Hubungi kami</Link>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
