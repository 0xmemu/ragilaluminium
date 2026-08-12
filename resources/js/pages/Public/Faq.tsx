import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

interface FaqItem {
  id: number
  question: string
  answer: string
}

interface FaqGroup {
  category: string
  items: FaqItem[]
}

interface FaqCategoryTab {
  key: string
  label: string
  count: number
}

interface FaqGuide {
  title: string
  heading: string
  subtitle: string
  categories: FaqCategoryTab[]
  groups: FaqGroup[]
}

export default function Faq({ guide }: { guide: FaqGuide }) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null
  const [openId, setOpenId] = React.useState<number | null>(null)

  return (
    <PublicLayout>
      <Head title={guide.title}>
        <meta name="description" content={guide.subtitle || "Pertanyaan yang sering diajukan tentang Ragil Aluminium."} />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden py-2 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Sering ditanyakan", href: null },
            ]}
          />
        </div>
        <div className="container-page py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              {guide.heading}
            </h1>
          </div>
        </div>
      </section>

      <section>
        <div className="container-page !px-5 md:!px-8 lg:!px-12">
          {guide.groups.length ? (
            <div className="mx-auto max-w-3xl">
              {guide.groups.map((group, groupIndex) => (
                <div
                  key={group.category}
                  className={groupIndex > 0 ? "mt-8 border-t border-border pt-6 sm:mt-10 sm:pt-8" : ""}
                >
                  <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                    {group.category}
                  </h2>
                  <ul className="mt-3 divide-y divide-border border border-border bg-surface">
                    {group.items.map((item) => {
                      const open = openId === item.id
                      const panelId = `faq-panel-${item.id}`
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left sm:px-5"
                            onClick={() => setOpenId(open ? null : item.id)}
                            aria-expanded={open}
                            aria-controls={panelId}
                            id={`faq-trigger-${item.id}`}
                          >
                            <span className="text-sm font-semibold text-foreground sm:text-lg">{item.question}</span>
                            <Icon
                              name={open ? "chevron-up" : "chevron-down"}
                              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </button>
                          {open ? (
                            <div
                              id={panelId}
                              role="region"
                              aria-labelledby={`faq-trigger-${item.id}`}
                              className="border-t border-border px-4 pb-4 pt-3 sm:px-5"
                            >
                              <p className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{item.answer}</p>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="circle-help"
              title="Belum ada pertanyaan"
              description="Tim kami siap membantu lewat WhatsApp jika Anda punya pertanyaan."
              className="mx-auto max-w-lg"
            />
          )}

          <div className="mx-auto mt-6 max-w-xl text-center">
            <p className="text-sm text-muted-foreground">Tidak menemukan jawaban?</p>
            <div className="mt-3 flex justify-center gap-2">
              <Button asChild variant="secondary" className="px-4 sm:px-6">
                <Link href={routeUrl("cara-pemesanan")}>Lihat cara pemesanan</Link>
              </Button>
              <Button asChild className="px-4 sm:px-6">
                {whatsappUrl ? (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                    Chat WhatsApp
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
