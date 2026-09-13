import { Head, Link, router } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import AdminLayout from "@/layouts/admin-layout"
import { can, useAdminCapabilities } from "@/lib/capabilities"
import {
  dedupeManualShippingReviews,
  isManualShippingReview,
  type NotificationItem,
} from "@/components/admin/notification-bell"

const typeIcons: Record<string, string> = {
  order_created: "bell",
  order_delivered: "check-circle",
  order_cancelled: "x",
}

const typeColors: Record<string, string> = {
  order_created: "bg-primary text-primary-foreground",
  order_delivered: "bg-success text-success-foreground",
  order_cancelled: "bg-destructive text-destructive-foreground",
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
  const capabilities = useAdminCapabilities()
  const canManageNotifications = can("notifications.manage", capabilities)

  function markRead(id: number) {
    if (!canManageNotifications) return
    router.post(routeUrl("admin.notifications.read", { notification: id }), {}, {
      preserveScroll: true,
      preserveState: true,
    })
  }

  function actionHref(notification: NotificationItem, anchor: string): string {
    const href = notification.href ?? "#"
    if (href === "#") return href

    return href.split("#")[0] + "#" + anchor
  }

  const visibleNotifications = dedupeManualShippingReviews(notifications)

  return (
    <AdminLayout
      title="Notifikasi"
      description="Pemberitahuan operasional yang perlu ditindaklanjuti admin."
    >
      <Head title="Notifikasi | Admin" />
      <div className="w-full">
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
              disabled={!canManageNotifications}
              title={canManageNotifications ? undefined : "Kamu tidak punya akses mengelola notifikasi"}
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

        {/* Table-first: satu baris per notifikasi */}
        <div className="overflow-hidden rounded-lg border border-border">
          {visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <span className="inline-flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon name="bell" className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-foreground">
                {unread_only ? "Tidak ada notifikasi belum dibaca" : "Belum ada notifikasi"}
              </p>
              <p className="max-w-sm text-[13px] text-muted-foreground">
                Notifikasi pesanan, termasuk review ongkir yang perlu ditindaklanjuti, akan muncul di sini.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="w-12 px-3 py-1.5" aria-label="Jenis" />
                  <th className="px-3 py-1.5">Notifikasi</th>
                  <th className="w-40 px-3 py-1.5">Waktu</th>
                  <th className="w-56 px-3 py-1.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleNotifications.map((n) => (
                  <tr key={n.id} className="transition hover:bg-muted/50">
                    <td className="px-3 py-2 align-top">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                          typeColors[n.type] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon name={typeIcons[n.type] ?? "bell"} className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Link
                        href={n.href ?? "#"}
                        onClick={() => {
                          if (!n.read_at) markRead(n.id)
                        }}
                        className="block min-w-0"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          {n.title}
                          {!n.read_at ? (
                            <span
                              className="inline-block size-2 shrink-0 rounded-full bg-primary"
                              aria-label="Belum dibaca"
                            />
                          ) : null}
                        </span>
                        {n.body ? (
                          <span className="mt-0.5 block text-[13px] text-muted-foreground">{n.body}</span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground/70">
                      {n.created_at_label ?? n.created_at}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {isManualShippingReview(n) ? (
                        <span className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={n.href ?? "#"}
                            onClick={() => {
                              if (!n.read_at) markRead(n.id)
                            }}
                            className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            Review ongkir
                          </Link>
                          <Link
                            href={actionHref(n, "biaya-ongkir")}
                            onClick={() => {
                              if (!n.read_at) markRead(n.id)
                            }}
                            className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted"
                          >
                            Edit biaya ongkir
                          </Link>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}