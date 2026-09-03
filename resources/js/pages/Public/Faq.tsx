import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { ClosingCTASection } from "@/components/public/closing-cta"
import { PageTopBar } from "@/components/public/page-top-bar"
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
        <PageTopBar
          breadcrumbs={[
            { label: "Beranda", href: routeUrl("home") },
            { label: "Sering ditanyakan", href: null },
          ]}

          title={guide.heading}
        />
      </section>

      <section>
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12 pt-4 pb-6 lg:pb-8">
          {guide.groups.length ? (
            <div className="mx-auto max-w-3xl">
              {guide.groups.map((group, groupIndex) => (
                <div
                  key={group.category}
                  className={groupIndex > 0 ? "mt-6 pt-4 sm:mt-8 sm:pt-6" : ""}
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

          <ClosingCTASection
            eyebrow="Tidak menemukan jawaban?"
            heading="Kami siap bantu lewat WhatsApp"
            compact={false}
            actions={[
              { label: "Lihat cara pemesanan", href: routeUrl("cara-pemesanan"), variant: "secondary" },
              { label: "Chat WhatsApp", href: whatsappUrl ?? routeUrl("contact"), variant: "primary", whatsappIcon: true, external: true },
            ]}
          />
        </div>
      </section>
    </PublicLayout>
  )
}
