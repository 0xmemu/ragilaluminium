
import { Icon } from "@/components/shared/icon"
import { PrefetchLink } from "@/components/shared/prefetch-link"
import { cn } from "@/lib/utils"
import { isRouteActive, routeUrl } from "@/lib/routes"

const items = [
  { label: "Dashboard", route: "admin.dashboard", icon: "layout-dashboard", active: ["admin.dashboard"] },
  { label: "Performa", route: "admin.analytics.store-performance", icon: "trending-up", active: ["admin.analytics.store-performance", "admin.analytics.store-performance.*"] },
  { label: "Pesanan", route: "admin.orders.index", icon: "clipboard-list", active: ["admin.orders.*"] },
  { label: "Produk", route: "admin.products.index", icon: "package", active: ["admin.products.*", "admin.variants.*", "admin.attributes.*", "admin.sub-models.*", "admin.model-products.*"] },
]

type BottomNavItem = (typeof items)[number]

/**
 * Item bottom nav dengan prefetch hover yang bisa dibatalkan.
 * Tanpa ini, timer hover bawaan Inertia menyala setelah klik dan memicu
 * kunjungan kedua yang membuat halaman ter-render ulang.
 */
function BottomNavLink({ item }: { item: BottomNavItem }) {
  const href = routeUrl(item.route)
  const active = isRouteActive(item.active ?? [item.route])

  return (
    <PrefetchLink
      href={href}
      className={cn(
        "relative flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden px-0.5 pt-1.5 pb-1 text-center transition",
        active ? "text-foreground" : "text-muted-foreground active:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {active ? (
        <span
          className="absolute inset-x-0 top-0 mx-auto h-0.5 w-7 rounded-full bg-foreground"
          aria-hidden="true"
        />
      ) : null}
      <Icon name={item.icon} className="h-5 w-5" weight={active ? "fill" : "regular"} aria-hidden="true" />
      <span className="max-w-full truncate text-[10px] font-semibold leading-none tracking-tight">
        {item.label}
      </span>
    </PrefetchLink>
  )
}

export function AdminBottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <nav
      className="fixed bottom-0 left-0 z-[60] w-full border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-6px_20px_hsl(var(--foreground)/0.05)] lg:hidden"
      aria-label="Navigasi admin cepat"
    >
      <div className="mx-auto grid h-14 w-full max-w-lg grid-cols-5 items-stretch px-1">
        {items.map((item) => (
          <BottomNavLink key={item.label} item={item} />
        ))}
        <button
          type="button"
          onClick={onOpenMenu}
          className="relative flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden px-0.5 pt-1.5 pb-1 text-center text-muted-foreground transition active:text-foreground"
          aria-label="Buka menu navigasi admin"
        >
          <Icon name="list" className="h-5 w-5" aria-hidden="true" />
          <span className="max-w-full truncate text-[10px] font-semibold leading-none tracking-tight">
            Menu
          </span>
        </button>
      </div>
    </nav>
  )
}

