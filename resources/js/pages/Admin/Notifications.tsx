import { Link, router } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { NotificationItem } from "@/components/admin/notification-bell"

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

export default function Notifications({
  notifications,
  unread_count,
  unread_only,
}: {
  notifications: NotificationItem[]
  unread_count: number
  unread_only: boolean
}) {
  function markRead(id: number) {
    router.post(routeUrl("admin.notifications.read", { notification: id }), {}, {
      preserveScroll: true,
      preserveState: true,
    })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={routeUrl("admin.notifications.index")}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium transition",
              !unread_only
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Semua
          </Link>
          <Link
            href={routeUrl("admin.notifications.index", { unread: 1 })}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition",
              unread_only
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Belum dibaca
            {unread_count > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unread_count}
              </span>
            ) : null}
          </Link>
        </div>
        {unread_count > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              router.post(routeUrl("admin.notifications.mark-all-read"), {}, {
                preserveScroll: true,
                preserveState: true,
              })
            }
          >
            Tandai semua dibaca
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon name="bell" className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-foreground">
              {unread_only ? "Tidak ada notifikasi belum dibaca" : "Belum ada notifikasi"}
            </p>
            <p className="max-w-sm text-[13px] text-muted-foreground">
              Notifikasi pesanan baru, sampai, dan dibatalkan akan muncul di sini.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href ?? "#"}
                  onClick={() => {
                    if (!n.read_at) markRead(n.id)
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3.5 transition hover:bg-muted/60"
                >
                  <span
                    className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full ${
                      typeColors[n.type] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon name={typeIcons[n.type] ?? "bell"} className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{n.title}</span>
                    {n.body ? (
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">
                        {n.body}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-muted-foreground/70">
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

