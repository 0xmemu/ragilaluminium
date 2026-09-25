import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/admin/ui/table"
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
import type { Pagination as PaginationData } from "@/types"

const typeIcons: Record<string, string> = {
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

const typeColors: Record<string, string> = {
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

type CategoryKey = "all" | "orders" | "messages" | "system"

const CATEGORY_TABS: Array<{ key: CategoryKey; label: string; icon: string }> = [
  { key: "all", label: "Semua", icon: "bell" },
  { key: "orders", label: "Pesanan", icon: "package" },
  { key: "messages", label: "Pesan", icon: "whatsapp" },
  { key: "system", label: "Sistem", icon: "gear" },
]

export default function Notifications({
  notifications,
  unread_count,
  unread_only,
  active_category = "all",
  category_counts = {},
  perPage = 20,
  pagination = null,
  prune_url = null,
  prune_days = 90,
}: {
  notifications: NotificationItem[]
  unread_count: number
  unread_only: boolean
  active_category?: CategoryKey
  category_counts?: Record<string, number>
  perPage?: number
  pagination?: PaginationData | null
  prune_url?: string | null
  prune_days?: number
}) {
  const capabilities = useAdminCapabilities()
  const canManageNotifications = can("notifications.manage", capabilities)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [pruning, setPruning] = React.useState(false)

  function markRead(id: number) {
    if (!canManageNotifications) return
    router.post(routeUrl("admin.notifications.read", { notification: id }), {}, {
      preserveScroll: true,
      preserveState: true,
    })
  }

  function destroyNotification(notification: NotificationItem) {
    if (!canManageNotifications || !notification.destroy_url) return
    setBusyId(notification.id)
    router.delete(notification.destroy_url, {
      preserveScroll: true,
      onFinish: () => setBusyId(null),
    })
  }

  function pruneOld() {
    if (!canManageNotifications || !prune_url) return
    setPruning(true)
    router.post(prune_url, {}, {
      preserveScroll: true,
      onFinish: () => setPruning(false),
    })
  }

  function actionHref(notification: NotificationItem, anchor: string): string {
    const href = notification.href ?? "#"
    if (href === "#") return href

    return href.split("#")[0] + "#" + anchor
  }

  function visit(params: { category?: string; unread?: string | undefined; per_page?: string }) {
    const merged: Record<string, string | undefined> = {
      category: params.category !== undefined ? params.category : active_category,
      unread: params.unread !== undefined ? params.unread : unread_only ? "1" : undefined,
      per_page: params.per_page !== undefined ? params.per_page : String(perPage),
    }
    const next: Record<string, string> = {}
    Object.entries(merged).forEach(([key, value]) => {
      if (!value || value === "all") return
      // 20 adalah default server, jadi tidak perlu ditulis di URL.
      if (key === "per_page" && value === "20") return
      next[key] = value
    })
    router.get(routeUrl("admin.notifications.index"), next, {
      preserveScroll: true,
      preserveState: true,
      replace: true,
    })
  }

  const visibleNotifications = dedupeManualShippingReviews(notifications)

  const emptyTitle =
    active_category === "messages"
      ? "Belum ada pesan WhatsApp"
      : active_category === "orders"
      ? "Belum ada notifikasi pesanan"
      : active_category === "system"
      ? "Belum ada pemberitahuan sistem"
      : unread_only
      ? "Tidak ada notifikasi belum dibaca"
      : "Belum ada notifikasi"

  const emptyDescription =
    active_category === "messages"
      ? "Chat masuk dari pelanggan via WhatsApp dan status koneksi perangkat akan muncul di sini."
      : active_category === "orders"
      ? "Pesanan baru, terkirim, sampai, dan dibatalkan akan tercatat di sini."
      : active_category === "system"
      ? "Pemberitahuan pembersihan media dan performa produk akan muncul di sini."
      : "Notifikasi pesan, pesanan, dan sistem akan muncul di sini."

  return (
    <AdminLayout
      title="Notifikasi"
      description="Pesan WhatsApp, pesanan baru, dan pemberitahuan sistem."
    >
      <Head title="Notifikasi | Admin" />
      <div className="w-full">
        {/* Filter kategori (owner 2026-09-16): Semua, Pesanan, Pesan, Sistem */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-card p-1">
            {CATEGORY_TABS.map((tab) => {
              const active = tab.key === active_category
              const count = category_counts[tab.key] ?? 0

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => visit({ category: tab.key })}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-medium transition",
                    active
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon name={tab.icon} className="size-3.5 shrink-0" aria-hidden="true" />
                  {tab.label}
                  {count > 0 ? (
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                        active ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <Select
              className="w-40"
              value={String(perPage)}
              onChange={(event) => visit({ per_page: event.target.value })}
              aria-label="Baris per halaman"
            >
              <option value="20">20 baris</option>
              <option value="50">50 baris</option>
              <option value="100">100 baris</option>
            </Select>

            <button
              type="button"
              onClick={() => visit({ unread: unread_only ? undefined : "1" })}
              aria-pressed={unread_only}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition",
                unread_only
                  ? "border-primary/40 bg-primary/10 font-semibold text-primary"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Belum dibaca
              {unread_count > 0 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {unread_count}
                </span>
              ) : null}
            </button>

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

            {prune_url ? (
              <ConfirmAction
                trigger={
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!canManageNotifications || pruning}
                    title={canManageNotifications ? undefined : "Kamu tidak punya akses mengelola notifikasi"}
                  >
                    Bersihkan lama
                  </Button>
                }
                title="Bersihkan notifikasi lama?"
                description={`Menghapus notifikasi yang sudah dibaca lebih dari ${prune_days} hari. Notifikasi belum dibaca tidak dihapus.`}
                confirmLabel="Bersihkan"
                processing={pruning}
                onConfirm={pruneOld}
              />
            ) : null}
          </div>
        </div>

        {/* Table-first: satu baris per notifikasi */}
        <div className="overflow-hidden rounded-lg border border-border">
          <TableScroll>
            {visibleNotifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon name="bell" className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
                <p className="max-w-sm text-[13px] text-muted-foreground">{emptyDescription}</p>
              </div>
            ) : (
              <Table>
              <TableHeader className="border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <TableRow>
                  <TableHead className="w-12 px-3 py-1.5" aria-label="Jenis" />
                  <TableHead className="px-3 py-1.5">Notifikasi</TableHead>
                  <TableHead className="w-40 px-3 py-1.5">Waktu</TableHead>
                  <TableHead className="w-56 px-3 py-1.5 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleNotifications.map((n) => (
                  <TableRow key={n.id} className="hover:bg-muted/50">
                    <TableCell className="px-3 py-2 align-top">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                          typeColors[n.type] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon name={typeIcons[n.type] ?? "bell"} className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top">
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
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top text-xs text-muted-foreground/70">
                      {n.created_at_label ?? n.created_at}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right align-top">
                      <span className="flex flex-wrap items-center justify-end gap-2">
                        {isManualShippingReview(n) ? (
                          <>
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
                          </>
                        ) : null}

                        {n.destroy_url ? (
                          <ConfirmAction
                            trigger={
                              <button
                                type="button"
                                aria-label={`Hapus notifikasi: ${n.title}`}
                                disabled={!canManageNotifications || busyId === n.id}
                                title={canManageNotifications ? "Hapus notifikasi" : "Kamu tidak punya akses mengelola notifikasi"}
                                className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Icon name="trash" className="h-4 w-4" aria-hidden="true" />
                              </button>
                            }
                            title="Hapus notifikasi ini?"
                            description={`"${n.title}" akan dihapus permanen dari daftar notifikasi.`}
                            confirmLabel="Hapus"
                            processing={busyId === n.id}
                            onConfirm={() => destroyNotification(n)}
                          />
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          </TableScroll>
        </div>

        <Pagination pagination={pagination} />
      </div>
    </AdminLayout>
  )
}