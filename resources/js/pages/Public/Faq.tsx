import { Head, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { ClosingCTASection } from "@/components/public/closing-cta"
import { HelpPageFrame } from "@/components/public/help-page-frame"
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
  const visibleGroups = guide.groups

  return (
    <PublicLayout>
      <Head title={guide.title}>
        <meta name="description" content={guide.subtitle || "Pertanyaan yang sering diajukan tentang Ragil Aluminium."} />
      </Head>

      <HelpPageFrame
        title={guide.heading}
        breadcrumbs={[
          { label: "Beranda", href: routeUrl("home") },
          { label: "Sering ditanyakan", href: null },
        ]}
      >
        <div>
          {visibleGroups.length ? (
            <div className="grid gap-6">
              {visibleGroups.map((group) => (
                <section key={group.category} aria-labelledby={`faq-category-${group.category}`}>
                  <div className="mb-2.5 flex items-end justify-between gap-3">
                    <h2 id={`faq-category-${group.category}`} className="text-sm font-bold tracking-tight text-foreground">
                      {group.category}
                    </h2>
                  </div>
                  <ul className="overflow-hidden rounded-lg border border-border bg-surface">
                    {group.items.map((item, itemIndex) => {
                      const open = openId === item.id
                      const panelId = `faq-panel-${item.id}`
                      return (
                        <li key={item.id} className="border-b border-border last:border-b-0">
                          <button
                            type="button"
                            className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
                            onClick={() => setOpenId(open ? null : item.id)}
                            aria-expanded={open}
                            aria-controls={panelId}
                            id={`faq-trigger-${item.id}`}
                          >
                            <span className="flex min-w-0 items-start gap-3">
                              <span className="tabular-nums mt-0.5 text-xs font-bold text-primary/70">{String(itemIndex + 1).padStart(2, "0")}</span>
                              <span className="text-sm font-semibold leading-5 text-foreground">{item.question}</span>
                            </span>
                            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${open ? "bg-primary/10 text-primary" : "bg-surface-muted text-muted-foreground"}`}>
                              <Icon name={open ? "chevron-up" : "chevron-down"} className="size-3.5" aria-hidden="true" />
                            </span>
                          </button>
                          {open ? (
                            <div id={panelId} role="region" aria-labelledby={`faq-trigger-${item.id}`} className="border-t border-border bg-surface-muted/45 px-4 pb-4 pt-3 sm:px-5">
                              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.answer}</p>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </section>
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
        </div>
      </HelpPageFrame>

      <ClosingCTASection
        eyebrow="Masih punya pertanyaan?"
        heading="Tim kami siap membantu lewat WhatsApp"
        compact
        actions={[
          { label: "Chat WhatsApp", href: whatsappUrl ?? routeUrl("contact"), variant: "primary", whatsappIcon: true, external: true },
          { label: "Cara pemesanan", href: routeUrl("cara-pemesanan"), variant: "secondary" },
        ]}
      />
    </PublicLayout>
  )
}
