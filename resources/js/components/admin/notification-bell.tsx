import { Link, router } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { Button } from "@/components/admin/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu"
import { routeUrl } from "@/lib/routes"

/**
 * Ikon dan warna per jenis notifikasi admin. Satu peta untuk seluruh panel:
 * lonceng header dan halaman Notifikasi memakai daftar yang sama supaya tidak
 * ada jenis yang tampil beda antar keduanya.
 */
export const NOTIFICATION_TYPE_ICONS: Record<string, string> = {
  order_created: "bell",
  order_delivered: "check-circle",
  order_cancelled: "x",
  order_returned: "arrow-counter-clockwise",
  return_created: "arrow-counter-clockwise",
  shipping_poll_failed: "warning",
  whatsapp_inbound: "whatsapp",
  whatsapp_logged_out: "warning",
  media_failed: "warning",
  media_cleanup: "bell",
  product_popularity_boost_disabled: "trend-up",
}

export const NOTIFICATION_TYPE_COLORS: Record<string, string> = {
  order_created: "bg-primary/10 text-primary",
  order_delivered: "bg-success/10 text-success",
  order_cancelled: "bg-destructive/10 text-destructive",
  order_returned: "bg-destructive/10 text-destructive",
  return_created: "bg-warning/10 text-warning-foreground",
  shipping_poll_failed: "bg-destructive/10 text-destructive",
  whatsapp_inbound: "bg-success/10 text-success",
  whatsapp_logged_out: "bg-destructive/10 text-destructive",
  media_failed: "bg-destructive/10 text-destructive",
  media_cleanup: "bg-warning/10 text-warning-foreground",
  product_popularity_boost_disabled: "bg-info/10 text-info",
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
  /** URL hapus baris ini; hanya dikirim halaman /admin/notifications. */
  destroy_url?: string | null
}

/**
 * Backend may use a more specific type name as the quote/manual-review
 * contract evolves. Keep the UI resilient by recognizing the semantic family.
 */
export function isManualShippingReview(notification: NotificationItem): boolean {
  const type = notification.type.toLowerCase()
  const context = (type + " " + notification.title + " " + (notification.body ?? "")).toLowerCase()

  return (
    (context.includes("shipping") || context.includes("ongkir") || context.includes("postal")) &&
    /(manual|review|pending|unavailable|failed|error)/.test(context)
  )
}

/**
 * Repeated provider failures can create multiple alerts for one order. The
 * notification href is the canonical order target, so use it as the stable
 * dedupe key and retain the newest notification.
 */
export function dedupeManualShippingReviews(
  notifications: NotificationItem[],
): NotificationItem[] {
  const seen = new Set<string>()

  return notifications.filter((notification) => {
    if (!isManualShippingReview(notification)) return true

    const orderNumber = (notification.title + " " + (notification.body ?? "")).match(/RA-[A-Z0-9-]+/i)?.[0]
    const key = notification.href?.split("#")[0] || orderNumber || ("notification:" + notification.id)

    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

type Kategori = "semua" | "wa" | "pesanan"

const KATEGORI_TABS: Array<{ key: Kategori; label: string }> = [
  { key: "semua", label: "Semua" },
  { key: "wa", label: "Pesan WA" },
  { key: "pesanan", label: "Pesanan" },
]

/** Kelompokkan notifikasi: WA, pesanan, atau lainnya (media, sistem). */
function kategoriOf(notification: NotificationItem): "wa" | "pesanan" | "lainnya" {
  const type = notification.type.toLowerCase()
  if (type.includes("whatsapp")) return "wa"
  if (
    type.includes("order") ||
    type.includes("shipping") ||
    (notification.href ?? "").includes("/admin/orders")
  ) {
    return "pesanan"
  }
  return "lainnya"
}

export function NotificationBell({
  notifications,
}: {
  notifications: NotificationItem[]
}) {
  const [kategori, setKategori] = React.useState<Kategori>("semua")
  const visibleNotifications = dedupeManualShippingReviews(notifications)
  const unread = visibleNotifications.filter((n) => !n.read_at).length
  const filteredNotifications =
    kategori === "semua"
      ? visibleNotifications
      : visibleNotifications.filter((n) => kategoriOf(n) === kategori)

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
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
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
        <div className="flex items-center gap-1 px-3 pb-2">
          {KATEGORI_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setKategori(key)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold transition",
                kategori === key
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[min(60vh,26rem)] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              {kategori === "wa"
                ? "Belum ada pesan WhatsApp."
                : kategori === "pesanan"
                  ? "Belum ada notifikasi pesanan."
                  : "Belum ada notifikasi."}
            </p>
          ) : (
            filteredNotifications.slice(0, 12).map((n) => (
              <Link
                key={n.id}
                href={n.href ?? "#"}
                onClick={(event) => {
                  if (!n.href) event.preventDefault()
                  if (!n.read_at) markRead(n.id)
                }}
                aria-disabled={!n.href ? true : undefined}
                className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition last:border-0 hover:bg-muted/60"
              >
                <span
                  className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full ${
                    NOTIFICATION_TYPE_COLORS[n.type] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon name={NOTIFICATION_TYPE_ICONS[n.type] ?? "bell"} className="h-4 w-4" aria-hidden="true" />
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

