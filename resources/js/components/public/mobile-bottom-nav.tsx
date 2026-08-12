import { Link, usePage } from "@inertiajs/react"
import { ClipboardText, House, Package, Storefront, type IconProps } from "@phosphor-icons/react"
import type { ComponentType } from "react"

import { cn } from "@/lib/utils"
import { isRouteActive, routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

type NavGlyph = ComponentType<IconProps>

/** Static map — avoids shared Icon registry miss / remount flicker. */
const NAV_ICONS: Record<string, NavGlyph> = {
  house: House,
  home: House,
  package: Package,
  "clipboard-list": ClipboardText,
  storefront: Storefront,
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const Glyph = NAV_ICONS[name] ?? Package
  return (
    <Glyph
      weight={active ? "fill" : "regular"}
      width={22}
      height={22}
      className="size-[22px] shrink-0"
      aria-hidden
    />
  )
}

export function MobileBottomNav() {
  const { nav } = usePage<SharedPageProps>().props
  const items = nav?.public?.mobile_bottom ?? []
  if (!items.length) return null

  const columns = Math.min(Math.max(items.length, 1), 5)

  return (
    <nav
      className="fixed bottom-0 left-0 z-[60] w-full max-w-[100vw] border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-6px_20px_hsl(var(--foreground)/0.05)] lg:hidden"
      aria-label="Navigasi cepat"
    >
      <div
        className="mx-auto grid h-14 w-full max-w-lg items-stretch px-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isRouteActive(item.active ?? [item.route])
          return (
            <Link
              key={`${item.label}-${item.route}`}
              href={routeUrl(item.route, item.params)}
              prefetch
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden px-0.5 pt-1.5 pb-1 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
              <NavIcon name={item.icon ?? "package"} active={active} />
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
