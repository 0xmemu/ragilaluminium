import { Link } from "@inertiajs/react"

import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

const TABS = [
  { key: "messages", label: "Live Chat", href: "admin.whatsapp.messages.index" },
  { key: "templates", label: "Template Pesan", href: "admin.whatsapp.templates.index" },
  { key: "pairing", label: "Sambungkan Nomor", href: "admin.whatsapp.pairing" },
]

export function WhatsAppTabs({ active }: { active: string }) {
  return (
    <div className="mb-4">
      <div
        className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-xs"
        role="tablist"
        aria-label="Navigasi WhatsApp"
      >
        {TABS.map((tab) => {
          const isActive = active === tab.key
          return (
            <Link
              key={tab.key}
              href={routeUrl(tab.href)}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                isActive
                  ? "bg-foreground text-background shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
