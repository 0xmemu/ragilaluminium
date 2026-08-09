import { Link, router } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu"
import { routeUrl } from "@/lib/routes"

const typeIcons: Record<string, string> = {
  order_created: "bell",
  order_delivered: "check-circle",
  order_cancelled: "x",
}

const typeColors: Record<string, string> = {
  order_created: "bg-primary/10 text-primary",
  order_delivered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  order_cancelled: "bg-destructive/10 text-destructive",
}

export interface NotificationItem {
  id: number
  type: string
  title: string
  body?: string | null
  href?: string | null
  read_at?: string | null
  created_at?: string | null
  created_at_label?: string | null
}

export function NotificationBell({ notifications }: { notifications: NotificationItem[] }) {
  const unread = notifications.filter((n) => !n.read_at).length

  function markRead(id: number) {
    router.post(routeUrl("admin.notifications.read", { notification: id }), {}, {
      preserveScroll: true,
      preserveState: true,
      only: ["adminNotificationCount", "notifications"],
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={`Notifikasi (${unread} belum dibaca)`}
        >
          <Icon name="bell" className="h-4 w-4" aria-hidden="true" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,22rem)]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">Notifikasi</span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() =>
                router.post(routeUrl("admin.notifications.mark-all-read"), {}, {
                  preserveScroll: true,
                  preserveState: true,
                  only: ["adminNotificationCount", "notifications"],
                })
              }
              className="text-xs font-medium text-primary hover:underline"
            >
              Tandai semua dibaca
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[min(60vh,26rem)] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Belum ada notifikasi.
            </p>
          ) : (
            notifications.slice(0, 12).map((n) => (
              <Link
                key={n.id}
                href={n.href ?? "#"}
                onClick={() => {
                  if (!n.read_at) markRead(n.id)
                }}
                className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition last:border-0 hover:bg-muted/60"
              >
                <span
                  className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full ${
                    typeColors[n.type] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon name={typeIcons[n.type] ?? "bell"} className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {n.title}
                  </span>
                  {n.body ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {n.body}
                    </span>
                  ) : null}
                  <span className="mt-1 block text-[11px] text-muted-foreground/70">
                    {n.created_at_label ?? n.created_at}
                  </span>
                </span>
                {!n.read_at ? (
                  <span
                    className="mt-2 inline-block size-2 shrink-0 rounded-full bg-primary"
                    aria-label="Belum dibaca"
                  />
                ) : null}
              </Link>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <Link
            href={routeUrl("admin.notifications.index")}
            className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-center text-xs font-medium text-foreground transition hover:bg-muted"
          >
            Lihat semua notifikasi
            <Icon name="arrow-right" className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

