import { Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { isRouteActive, routeUrl } from "@/lib/routes"
import { clearReadyCount, getReadyCount, onReadyCountChange } from "@/lib/media-live"
import { can, useAdminCapabilities } from "@/lib/capabilities"
import type { SharedPageProps } from "@/types"

interface AdminNavItemData {
  label: string
  route: string
  params?: Record<string, string | number | boolean | null>
  icon?: string
  active?: string[]
  /** Capability admin yang dibutuhkan utk menampilkan item (Foundation Track A). */
  capability?: string
  /** Filter tambahan berbasis query string (mis. type=flash_sale pada route yang sama). */
  activeType?: "store" | "flash_sale"
}

function AdminBrand() {
  return (
    <Link
      href={routeUrl("admin.dashboard")}
      prefetch={["hover", "click"]}
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

/** Item menu tunggal (link). */
function AdminNavLink({
  item,
  onNavigate,
}: {
  item: AdminNavItemData
  onNavigate?: () => void
}) {
  let active = isRouteActive(item.active ?? [item.route])
  if (item.activeType && typeof window !== "undefined") {
    const type = new URLSearchParams(window.location.search).get("type")
    active = active && (item.activeType === "flash_sale" ? type === "flash_sale" : type !== "flash_sale")
  }
  return (
    <Link
      href={routeUrl(item.route, item.params)}
      prefetch={["hover", "click"]}
      onClick={() => {
        if (item.route === "admin.media.library") clearReadyCount()
        onNavigate?.()
      }}
      className={cn(
        "group/item flex h-8 items-center gap-2.5 rounded-lg text-[13px] font-medium transition duration-100",
        "h-9 px-2.5",
        active
          ? "bg-secondary text-foreground font-semibold"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        name={item.icon ?? "package"}
        className={cn(
          "size-4 shrink-0 transition",
          active
            ? "text-foreground"
            : "text-muted-foreground/80 group-hover/item:text-foreground",
        )}
        weight={active ? "fill" : "regular"}
        aria-hidden="true"
      />
      <span className="truncate">{item.label}</span>
      {item.route === "admin.media.library" ? (
        <MediaBadge />
      ) : null}
    </Link>
  )
}

function MediaBadge() {
  const [mediaReadyCount, setMediaReadyCount] = React.useState<number>(() => getReadyCount())
  React.useEffect(() => onReadyCountChange(setMediaReadyCount), [])
  if (mediaReadyCount <= 0) return null
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground">
      {mediaReadyCount > 99 ? "99+" : mediaReadyCount}
    </span>
  )
}

export function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { nav } = usePage<SharedPageProps>().props
  const capabilities = useAdminCapabilities()
  const groups = Object.entries(nav?.admin ?? {})

  function canShowItem(item: AdminNavItemData): boolean {
    if (!item.capability) return true
    return can(item.capability, capabilities)
  }

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--sidebar))]">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
        <AdminBrand />
      </div>

      <nav
        className="admin-sidebar-nav scrollbar-none flex-1 overflow-y-auto px-2.5 py-3"
        aria-label="Navigasi admin"
      >
        {groups.map(([key, group], groupIndex) => {
          const visibleItems = group.items.filter(canShowItem)
          if (!visibleItems.length) return null
          return (
          <div key={key} className={cn(groupIndex > 0 && "mt-4")}>
            {group.title ? (
              <p className="admin-sidebar-title px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em]">
                {group.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {visibleItems.map((item: AdminNavItemData) => (
                <AdminNavLink key={item.label} item={item} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
          )
        })}
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
