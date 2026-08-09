import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import PublicLayout from "@/layouts/public-layout"
import { cn } from "@/lib/utils"
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
  const [activeCategory, setActiveCategory] = React.useState<string>("all")
  const [openId, setOpenId] = React.useState<number | null>(null)

  const visibleGroups =
    activeCategory === "all"
      ? guide.groups
      : guide.groups.filter((group) => group.category === activeCategory)

  return (
    <PublicLayout>
      <Head title={guide.title}>
        <meta name="description" content={guide.subtitle || "Pertanyaan yang sering diajukan tentang Ragil Aluminium."} />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden py-4 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Sering ditanyakan", href: null },
            ]}
          />
        </div>
        <div className="container-page pb-4 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="caret-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {guide.heading}
            </h1>
          </div>
        </div>
      </section>

      <section className="py-4">
        <div className="container-page">
          {guide.categories.length > 1 ? (
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
                  activeCategory === "all"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-surface text-foreground hover:border-foreground/40",
                )}
              >
                Semua
              </button>
              {guide.categories.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveCategory(tab.key)}
                  className={cn(
                    "min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
                    activeCategory === tab.key
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-surface text-foreground hover:border-foreground/40",
                  )}
                >
                  {tab.label}
                  <span className="ml-1.5 tabular-nums opacity-70">({tab.count})</span>
                </button>
              ))}
            </div>
          ) : null}

          {visibleGroups.length ? (
            <div className="mx-auto grid max-w-3xl gap-4">
              {visibleGroups.map((group) => (
                <div key={group.category}>
                  <h2 className="text-sm font-bold tracking-tight text-foreground sm:text-lg">{group.category}</h2>
                  <ul className="mt-2 divide-y divide-border border border-border bg-surface">
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
