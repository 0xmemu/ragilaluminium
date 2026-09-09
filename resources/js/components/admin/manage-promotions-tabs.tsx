import { Link } from "@inertiajs/react"

import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

const TABS = [
  { key: "promotions", label: "Promo Produk", href: "admin.promotions.index" },
  { key: "vouchers", label: "Voucher Toko", href: "admin.vouchers.index" },
  { key: "banners", label: "Banner Promo", href: "admin.banners.index" },
  { key: "announcements", label: "Bar Promo", href: "admin.announcements.index" },
]

export function ManagePromotionsTabs({ active }: { active: string }) {
  return (
    <div className="mb-4">
      <div
        className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-xs"
        role="tablist"
        aria-label="Navigasi promo toko"
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
