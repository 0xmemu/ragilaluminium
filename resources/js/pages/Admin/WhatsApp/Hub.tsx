import { Head, Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { WhatsAppTabs } from "@/components/admin/whatsapp-tabs"
import AdminLayout from "@/layouts/admin-layout"

interface HubCard {
  key: string
  label: string
  description: string
  icon: string
  href: string
  meta: string
}

interface Props {
  title: string
  description: string
  cards: HubCard[]
}

export default function WhatsAppHub({ title, description, cards }: Props) {
  return (
    <AdminLayout title={title} description={description}>
      <Head title={`${title} | Admin`} />

      <WhatsAppTabs active="hub" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-soft"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary">
                <Icon name={card.icon as never} className="size-5" aria-hidden="true" />
              </span>
              <Icon
                name="arrow-right"
                className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </div>

            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">{card.label}</h2>
              <p className="text-xs leading-5 text-muted-foreground">{card.description}</p>
            </div>

            <p className="mt-auto text-xs font-medium text-muted-foreground">{card.meta}</p>
          </Link>
        ))}
      </div>
    </AdminLayout>
  )
}
