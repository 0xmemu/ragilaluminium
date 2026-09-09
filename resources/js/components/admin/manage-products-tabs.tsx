import { Link } from "@inertiajs/react"

import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

const TABS = [
  { key: "products", label: "Produk", href: "admin.products.index" },
  { key: "categories", label: "Kategori", href: "admin.categories.index" },
  { key: "models", label: "Model Produk", href: "admin.model-products.index" },
  { key: "subModels", label: "Sub Model", href: "admin.sub-models.index" },
]

export function ManageProductsTabs({ active }: { active: string }) {
  return (
    <div className="mb-4">
      <div
        className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-xs"
        role="tablist"
        aria-label="Navigasi kelola produk"
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
