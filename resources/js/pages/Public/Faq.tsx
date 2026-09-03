import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { ClosingCTASection } from "@/components/public/closing-cta"
import { HelpPageFrame } from "@/components/public/help-page-frame"
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
  const [activeCategory, setActiveCategory] = React.useState<string>("all")
  const visibleGroups = activeCategory === "all"
    ? guide.groups
    : guide.groups.filter((group) => group.category === activeCategory)

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
        subtitle={guide.subtitle || "Jawaban singkat untuk pertanyaan yang sering diajukan pembeli."}
        footer={(
          <ClosingCTASection
            eyebrow="Masih punya pertanyaan?"
            heading="Tim kami siap membantu lewat WhatsApp"
            compact={false}
            actions={[
              { label: "Chat WhatsApp", href: whatsappUrl ?? routeUrl("contact"), variant: "primary", whatsappIcon: true, external: true },
              { label: "Lihat cara pemesanan", href: routeUrl("cara-pemesanan"), variant: "secondary" },
            ]}
          />
        )}
      >
        {guide.categories.length ? (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Kategori FAQ">
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${activeCategory === "all" ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground hover:border-foreground/40"}`}
            >
              Semua <span className="tabular-nums opacity-70">{guide.categories.reduce((sum, category) => sum + category.count, 0)}</span>
            </button>
            {guide.categories.map((category) => (
              <button
                key={category.key}
                type="button"
                role="tab"
                aria-selected={activeCategory === category.key}
                onClick={() => setActiveCategory(category.key)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${activeCategory === category.key ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground hover:border-foreground/40"}`}
              >
                {category.label} <span className="tabular-nums opacity-70">{category.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {visibleGroups.length ? (
          <div className="grid gap-5">
            {visibleGroups.map((group) => (
              <section key={group.category} aria-labelledby={`faq-category-${group.category}`}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 id={`faq-category-${group.category}`} className="text-sm font-bold tracking-tight text-foreground">
                    {group.category}
                  </h2>
                  <span className="tabular-nums text-xs text-muted-foreground">{group.items.length} pertanyaan</span>
                </div>
                <ul className="overflow-hidden rounded-lg border border-border bg-surface">
                  {group.items.map((item) => {
                    const open = openId === item.id
                    const panelId = `faq-panel-${item.id}`
                    return (
                      <li key={item.id} className="border-b border-border last:border-b-0">
                        <button
                          type="button"
                          className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 sm:px-5"
                          onClick={() => setOpenId(open ? null : item.id)}
                          aria-expanded={open}
                          aria-controls={panelId}
                          id={`faq-trigger-${item.id}`}
                        >
                          <span className="text-sm font-semibold leading-5 text-foreground">{item.question}</span>
                          <Icon name={open ? "chevron-up" : "chevron-down"} className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
          <EmptyState icon="circle-help" title="Belum ada pertanyaan" description="Tim kami siap membantu lewat WhatsApp jika Anda punya pertanyaan." className="mx-auto max-w-lg" />
        )}
      </HelpPageFrame>
    </PublicLayout>
  )
}
