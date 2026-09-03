import { Head, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { ClosingCTASection } from "@/components/public/closing-cta"
import { HelpPageFrame } from "@/components/public/help-page-frame"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
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
  const [query, setQuery] = React.useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const visibleGroups = guide.groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        activeCategory !== "all" && group.category !== activeCategory
          ? false
          : !normalizedQuery || `${item.question} ${item.answer}`.toLowerCase().includes(normalizedQuery),
      ),
    }))
    .filter((group) => group.items.length > 0)
  const resultCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0)

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
        <div className="mb-5">
          <label htmlFor="faq-search" className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Cari jawaban
          </label>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="faq-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari pertanyaan tentang ukuran, kaca, COD..."
              className="pl-10 pr-12"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Hapus pencarian FAQ" className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {normalizedQuery ? `${resultCount} pertanyaan ditemukan` : `${resultCount} pertanyaan`}
          </p>
        </div>

        <div>
          <div className="mb-5">
            <label htmlFor="faq-category" className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Kategori
            </label>
            <select
              id="faq-category"
              value={activeCategory}
              onChange={(event) => setActiveCategory(event.target.value)}
              className="flex min-h-11 w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            >
              <option value="all">Semua kategori · {guide.categories.reduce((sum, category) => sum + category.count, 0)} pertanyaan</option>
              {guide.categories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label} · {category.count} pertanyaan
                </option>
              ))}
            </select>
          </div>

          {visibleGroups.length ? (
            <div className="grid gap-6">
              {visibleGroups.map((group) => (
                <section key={group.category} aria-labelledby={`faq-category-${group.category}`}>
                  <div className="mb-2.5 flex items-end justify-between gap-3">
                    <h2 id={`faq-category-${group.category}`} className="text-base font-bold tracking-tight text-foreground">
                      {group.category}
                    </h2>
                    <span className="tabular-nums shrink-0 text-xs text-muted-foreground">{group.items.length} pertanyaan</span>
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
              title={normalizedQuery ? "Pertanyaan tidak ditemukan" : "Belum ada pertanyaan"}
              description={normalizedQuery ? "Coba kata kunci lain atau chat kami melalui WhatsApp." : "Tim kami siap membantu lewat WhatsApp jika Anda punya pertanyaan."}
              className="mx-auto max-w-lg"
            />
          )}
        </div>
      </HelpPageFrame>
    </PublicLayout>
  )
}
