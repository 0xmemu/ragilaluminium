import { Link, usePage } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { isRouteActive, routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

function AdminBrand() {
  return (
    <Link
      href={routeUrl("admin.dashboard")}
      className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-muted"
      aria-label="Ragil Aluminium, ke dashboard admin"
    >
      <img
        src="/images/brand/light-mark.png"
        alt=""
        width={28}
        height={28}
        className="size-7 object-contain dark:hidden"
        decoding="async"
      />
      <img
        src="/images/brand/dark-mark.png"
        alt=""
        width={28}
        height={28}
        className="hidden size-7 object-contain dark:block"
        decoding="async"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold tracking-tight text-foreground">
          Ragil Aluminium
        </span>
        <span className="block text-[11px] leading-4 text-muted-foreground">Panel Admin</span>
      </span>
    </Link>
  )
}

export function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { nav } = usePage<SharedPageProps>().props
  const groups = Object.entries(nav?.admin ?? {})

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
        <AdminBrand />
      </div>

      <nav
        className="scrollbar-none flex-1 overflow-y-auto px-2.5 py-3"
        aria-label="Navigasi admin"
      >
        {groups.map(([key, group], groupIndex) => (
          <div key={key} className={cn(groupIndex > 0 && "mt-5")}>
            {group.title ? (
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                {group.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isRouteActive(item.active ?? [item.route])
                return (
                  <li key={`${item.label}-${item.route}`}>
                    <Link
                      href={routeUrl(item.route, item.params)}
                      onClick={onNavigate}
                      className={cn(
                        "group/item flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition duration-100",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        name={item.icon ?? "package"}
                        className={cn(
                          "size-4 shrink-0 transition",
                          active
                            ? "text-accent-foreground"
                            : "text-muted-foreground/80 group-hover/item:text-foreground",
                        )}
                        weight={active ? "fill" : "regular"}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="ml-auto size-1.5 shrink-0 rounded-full bg-primary"
                        />
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2.5">
        <Link
          href={routeUrl("home")}
          target="_blank"
          rel="noreferrer"
          className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Lihat toko di tab baru"
        >
          <Icon name="storefront" className="size-4" aria-hidden="true" />
          Lihat toko
          <Icon name="arrow-right" className="ml-auto size-3.5 opacity-60" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
