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
    <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
      {TABS.map((tab) => {
        const isActive = active === tab.key
        return (
          <a
            key={tab.key}
            href={routeUrl(tab.href)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </a>
        )
      })}
    </div>
  )
}
