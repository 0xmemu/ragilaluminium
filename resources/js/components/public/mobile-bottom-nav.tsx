import { Link, usePage } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { isRouteActive, routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

export function MobileBottomNav() {
  const { nav } = usePage<SharedPageProps>().props
  const items = nav?.public?.mobile_bottom ?? []
  if (!items.length) return null

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-header border-t border-border bg-surface px-2 pt-1.5 shadow-[0_-8px_24px_hsl(var(--foreground)/0.06)] lg:hidden"
      aria-label="Navigasi cepat"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {items.map((item) => {
          const active = isRouteActive(item.active ?? [item.route])
          return (
            <Link
              key={`${item.label}-${item.route}`}
              href={routeUrl(item.route, item.params)}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[11px] font-semibold transition",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                <span className="absolute top-0 h-0.5 w-8 bg-foreground" aria-hidden="true" />
              ) : null}
              <Icon
                name={item.icon ?? "package"}
                className="h-5 w-5"
                weight={active ? "fill" : "regular"}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
