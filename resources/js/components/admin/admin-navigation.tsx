import { Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { isRouteActive, routeUrl } from "@/lib/routes"
import { clearReadyCount, getReadyCount, onReadyCountChange } from "@/lib/media-live"
import type { SharedPageProps } from "@/types"

interface AdminNavItemData {
  label: string
  route: string
  params?: Record<string, string | number>
  icon?: string
  active?: string[]
  children?: AdminNavItemData[]
}

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

/** Item menu tunggal (link). */
function AdminNavLink({
  item,
  onNavigate,
  isChild = false,
}: {
  item: AdminNavItemData
  onNavigate?: () => void
  isChild?: boolean
}) {
  const active = isRouteActive(item.active ?? [item.route])
  return (
    <Link
      href={routeUrl(item.route, item.params)}
      onClick={() => {
        if (item.route === "admin.media.library") clearReadyCount()
        onNavigate?.()
      }}
      className={cn(
        "group/item flex h-8 items-center gap-2.5 rounded-lg text-[13px] font-medium transition duration-100",
        isChild ? "py-1.5 pl-8 pr-2.5" : "h-9 px-2.5",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {!isChild ? (
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
      ) : null}
      <span className="truncate">{item.label}</span>
      {!isChild && item.route === "admin.media.library" ? (
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

/** Item menu dengan submenu inline (pola Ant Design vertical inline submenu). */
function AdminNavGroup({
  item,
  onNavigate,
}: {
  item: AdminNavItemData
  onNavigate?: () => void
}) {
  const children = item.children ?? []
  const childActive = children.some((child) => isRouteActive(child.active ?? [child.route]))
  const [open, setOpen] = React.useState<boolean>(childActive)

  // Ikuti route berubah (navigasi antar halaman) — buka grup saat anaknya aktif.
  React.useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive])

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition duration-100",
          childActive
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )}
      >
        <Icon
          name={item.icon ?? "package"}
          className={cn(
            "size-4 shrink-0 transition",
            childActive
              ? "text-foreground"
              : "text-muted-foreground/80 group-hover/item:text-foreground",
          )}
          weight={childActive ? "fill" : "regular"}
          aria-hidden="true"
        />
        <span className="truncate">{item.label}</span>
        <Icon
          name="caret-down"
          className={cn(
            "ml-auto size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <ul className="mt-0.5 space-y-0.5">
          {children.map((child) => (
            <AdminNavLink key={child.label} item={child} onNavigate={onNavigate} isChild />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { nav } = usePage<SharedPageProps>().props
  const groups = Object.entries(nav?.admin ?? {})

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
        <AdminBrand />
      </div>

      <nav
        className="scrollbar-none flex-1 overflow-y-auto px-2.5 py-3"
        aria-label="Navigasi admin"
      >
        {groups.map(([key, group], groupIndex) => (
          <div key={key} className={cn(groupIndex > 0 && "mt-4")}>
            {group.title ? (
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                {group.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item: AdminNavItemData) =>
                item.children?.length ? (
                  <AdminNavGroup key={item.label} item={item} onNavigate={onNavigate} />
                ) : (
                  <AdminNavLink key={item.label} item={item} onNavigate={onNavigate} />
                ),
              )}
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
