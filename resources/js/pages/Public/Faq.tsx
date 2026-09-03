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
  const [openId, setOpenId] = React.useState<number | null>(guide.groups[0]?.items[0]?.id ?? null)
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
        <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
          <aside className="lg:sticky lg:top-24">
            <div className="mb-2 flex items-center justify-between gap-3 lg:block">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pilih topik</p>
              <span className="tabular-nums text-xs text-muted-foreground lg:hidden">
                {guide.categories.reduce((sum, category) => sum + category.count, 0)} pertanyaan
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === "all"}
                onClick={() => setActiveCategory("all")}
                className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${activeCategory === "all" ? "border-foreground bg-foreground text-background shadow-sm" : "border-border bg-surface text-foreground hover:border-foreground/40"}`}
              >
                <span>Semua topik</span>
                <span className="tabular-nums opacity-65">{guide.categories.reduce((sum, category) => sum + category.count, 0)}</span>
              </button>
              {guide.categories.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === category.key}
                  onClick={() => setActiveCategory(category.key)}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold leading-4 transition ${activeCategory === category.key ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-surface text-foreground hover:border-primary/40"}`}
                >
                  <span>{category.label}</span>
                  <span className="tabular-nums shrink-0 opacity-65">{category.count}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="min-w-0">
            {visibleGroups.length ? (
              <div className="grid gap-5">
                {visibleGroups.map((group) => (
                  <section key={group.category} aria-labelledby={`faq-category-${group.category}`}>
                    <div className="mb-2.5 flex items-end justify-between gap-3">
                      <div>
                        <h2 id={`faq-category-${group.category}`} className="mt-1 text-base font-bold tracking-tight text-foreground">
                          {group.category}
                        </h2>
                      </div>
                      <span className="tabular-nums shrink-0 text-xs text-muted-foreground">{group.items.length} pertanyaan</span>
                    </div>
                    <ul className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                      {group.items.map((item) => {
                        const open = openId === item.id
                        const panelId = `faq-panel-${item.id}`
                        return (
                          <li key={item.id} className="border-b border-border last:border-b-0">
                            <button
                              type="button"
                              className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/35 sm:px-5"
                              onClick={() => setOpenId(open ? null : item.id)}
                              aria-expanded={open}
                              aria-controls={panelId}
                              id={`faq-trigger-${item.id}`}
                            >
                              <span className="flex min-w-0 items-start gap-3">
                                <span className="tabular-nums mt-0.5 text-xs font-bold text-primary/70">{String(group.items.indexOf(item) + 1).padStart(2, "0")}</span>
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
              <EmptyState icon="circle-help" title="Belum ada pertanyaan" description="Tim kami siap membantu lewat WhatsApp jika Anda punya pertanyaan." className="mx-auto max-w-lg" />
            )}
          </div>
        </div>
      </HelpPageFrame>
    </PublicLayout>
  )
}
