import { Link, usePage } from "@inertiajs/react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { isRouteActive, routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

/** Sidebar chrome stays graphite in both admin themes (content canvas toggles light/dark). */
const sidebarShell = "flex h-full flex-col bg-[#131212] text-white"
const sidebarMuted = "text-white/70"
const sidebarHover = "hover:bg-white/10 hover:text-white"
const sidebarRule = "border-white/10"

export function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { nav } = usePage<SharedPageProps>().props
  const groups = Object.entries(nav?.admin ?? {})

  return (
    <div className={sidebarShell}>
      <div className={cn("flex min-h-[4.5rem] items-center border-b px-5", sidebarRule)}>
        <BrandWordmark href={routeUrl("admin.dashboard")} variant="dark" />
      </div>
      <nav className="scrollbar-none flex-1 overflow-y-auto px-3 py-5" aria-label="Navigasi admin">
        {groups.map(([key, group], groupIndex) => (
          <div key={key} className={cn(groupIndex > 0 && "mt-6")}>
            {group.title ? (
              <p className={cn("px-3 text-[10px] font-bold tracking-tight", sidebarMuted)}>
                {group.title}
              </p>
            ) : null}
            <ul className={cn("space-y-1", group.title && "mt-2")}>
              {group.items.map((item) => {
                const active = isRouteActive(item.active ?? [item.route])
                return (
                  <li key={`${item.label}-${item.route}`}>
                    <Link
                      href={routeUrl(item.route, item.params)}
                      onClick={onNavigate}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition",
                        active
                          ? "bg-primary text-primary-foreground"
                          : cn(sidebarMuted, sidebarHover),
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        name={item.icon ?? "package"}
                        className="h-[18px] w-[18px] shrink-0"
                        weight={active ? "fill" : "regular"}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className={cn("border-t p-3", sidebarRule)}>
        <Link
          href={routeUrl("home")}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
            sidebarMuted,
            sidebarHover,
          )}
          aria-label="Lihat toko di tab baru"
        >
          <Icon name="storefront" className="h-[18px] w-[18px]" aria-hidden="true" />
          Lihat toko
        </Link>
      </div>
    </div>
  )
}
