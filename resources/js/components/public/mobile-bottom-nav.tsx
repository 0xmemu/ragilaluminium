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
      className="safe-bottom fixed inset-x-0 bottom-0 z-header border-t border-border bg-surface shadow-[0_-6px_20px_hsl(var(--foreground)/0.05)] lg:hidden"
      aria-label="Navigasi cepat"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch px-1">
        {items.map((item) => {
          const active = isRouteActive(item.active ?? [item.route])
          return (
            <Link
              key={`${item.label}-${item.route}`}
              href={routeUrl(item.route, item.params)}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1 text-center transition",
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
              <Icon
                name={item.icon ?? "package"}
                className="size-[22px] shrink-0"
                weight={active ? "fill" : "regular"}
                aria-hidden="true"
              />
              <span className="max-w-full truncate text-[10px] font-semibold leading-none tracking-tight">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
