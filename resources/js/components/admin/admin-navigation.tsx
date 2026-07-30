import { Link, usePage } from "@inertiajs/react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { isRouteActive, routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

/** Sidebar graphite #131212 — dasar netral admin; token .dark mengikuti turunan warna ini. */
const sidebarShell = "flex h-full flex-col bg-[#131212] text-white"
const sidebarMuted = "text-white/70"
const sidebarHover = "hover:bg-white/10 hover:text-white"
const sidebarRule = "border-white/10"

export function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { nav } = usePage<SharedPageProps>().props
  const groups = Object.entries(nav?.admin ?? {})

  return (
    <div className={sidebarShell}>
      <div className={cn("flex min-h-[3.25rem] items-center border-b px-5 lg:min-h-[3.75rem]", sidebarRule)}>
        <BrandWordmark href={routeUrl("admin.dashboard")} variant="dark" />
      </div>
      <nav className="scrollbar-none flex-1 overflow-y-auto px-3 py-4" aria-label="Navigasi admin">
        {groups.map(([key, group], groupIndex) => (
          <div key={key} className={cn(groupIndex > 0 && "mt-6")}>
            {group.title ? (
              <p className={cn("px-2.5 text-[10px] font-bold uppercase tracking-wider", sidebarMuted)}>
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
                        "flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-semibold leading-5 transition",
                        active
                          ? "bg-primary text-primary-foreground"
                          : cn(sidebarMuted, sidebarHover),
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        name={item.icon ?? "package"}
                        className="size-4 shrink-0"
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
            "flex min-h-10 items-center gap-2.5 rounded-md px-3 text-[13px] font-semibold transition",
            sidebarMuted,
            sidebarHover,
          )}
          aria-label="Lihat toko di tab baru"
        >
          <Icon name="storefront" className="size-4" aria-hidden="true" />
          Lihat toko
        </Link>
      </div>
    </div>
  )
}
