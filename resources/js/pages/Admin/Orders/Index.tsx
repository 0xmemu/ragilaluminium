import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber, humanize } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

interface OrderItemPreview {
  id: number
  name: string
  variant_sku?: string | null
  variation_1_name?: string | null
  variation_1_option?: string | null
  variation_2_name?: string | null
  variation_2_option?: string | null
  quantity: number
  image?: string | null
}

interface PrimaryAction {
  label: string
  next_status: string | null
  kind?: string
  hint?: string | null
}

interface OrderCard {
  id: number
  order_number: string
  order_status: string
  payment_status: string
  payment_method?: string | null
  payment_method_label?: string
  cod_flag?: boolean
  flow?: "cod" | "transfer"
  customer_name: string
  customer_phone?: string | null
  shipping_city?: string | null
  shipping_province?: string | null
  notes?: string | null
  total_amount: number
  product_count: number
  unit_count: number
  created_at: string | null
  updated_at: string | null
  href: string
  whatsapp_url?: string | null
  primary_action: PrimaryAction | null
  items: OrderItemPreview[]
  items_total: number
}

interface StatusTab {
  key: string
  label: string
  count: number
}

interface OrdersIndexProps {
  title: string
  description: string
  tabs: StatusTab[]
  activeStatus: string
  activeSort: string
  activePaymentStatus?: string
  activeShippingStatus?: string
  activeDatePreset?: string
  dateFrom?: string
  dateTo?: string
  searchQuery: string
  orders: OrderCard[]
  pagination: PaginationData
  exportUrl: string
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatRelativeAge(iso: string | null | undefined): string {
  if (!iso) return "-"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "-"
  const diffMs = Math.max(Date.now() - then, 0)
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${minutes} Menit`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} Jam`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `${days} Hari ${remHours} Jam` : `${days} Hari`
}

function variationLabel(item: OrderItemPreview): string {
  return [
    item.variation_1_option
      ? `${item.variation_1_name ? `${item.variation_1_name}: ` : ""}${item.variation_1_option}`
      : null,
    item.variation_2_option
      ? `${item.variation_2_name ? `${item.variation_2_name}: ` : ""}${item.variation_2_option}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

function OrderCardRow({
  order,
  queryState,
}: {
  order: OrderCard
  queryState: { order_status: string; q: string; sort: string }
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const visibleItems = expanded ? order.items : order.items.slice(0, 2)
  const hiddenCount = Math.max(order.items_total - visibleItems.length, 0)

  function applyStatus(nextStatus: string, cancelReason?: string) {
    setBusy(true)
    router.put(
      routeUrl("admin.orders.status", { order: order.id }),
      {
        order_status: nextStatus,
        redirect_to: "index",
        filter_status: queryState.order_status,
        filter_q: queryState.q,
        filter_sort: queryState.sort,
        ...(nextStatus === "cancelled" && cancelReason ? { cancel_reason: cancelReason } : {}),
      },
      {
        preserveScroll: true,
        onFinish: () => setBusy(false),
      },
    )
  }

  function applyPrimary() {
    if (order.primary_action?.kind === "input_resi") {
      router.visit(`${order.href}#lacak-pesanan`)
      return
    }
    if (!order.primary_action?.next_status) return
    applyStatus(order.primary_action.next_status)
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={order.href} className="font-mono text-base font-bold hover:text-primary">
                  {order.order_number}
                </Link>
                <StatusBadge status={order.order_status} />
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 text-foreground">
                  <Icon name="user" className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="font-semibold">{order.customer_name}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Icon name="home" className="size-3.5 shrink-0" aria-hidden="true" />
                  {[order.shipping_city, order.shipping_province].filter(Boolean).join(", ") || "-"}
                </p>
                <p className="flex items-center gap-2">
                  <Icon name="whatsapp" className="size-3.5 shrink-0" aria-hidden="true" />
                  {order.customer_phone || "-"}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1",
                    order.flow === "cod" || order.cod_flag
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-border bg-surface-muted text-foreground",
                  )}
                >
                  {order.payment_method_label ||
                    (order.payment_method ? humanize(order.payment_method) : "Metode -")}
                </span>
                <span className="rounded-full border border-border bg-surface-muted px-2.5 py-1">
                  {statusMeta(order.payment_status).label}
                </span>
                <span className="rounded-full border border-border bg-surface-muted px-2.5 py-1">
                  {formatNumber(order.product_count)} Produk
                </span>
                <span className="rounded-full border border-border bg-surface-muted px-2.5 py-1">
                  {formatNumber(order.unit_count)} Unit
                </span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
                Total tagihan
              </p>
              <p className="tabular-nums mt-1 text-xl font-bold">{formatCurrency(order.total_amount)}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Terakhir: {formatDateTime(order.updated_at)}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Icon name="history" className="size-3.5" aria-hidden="true" />
                {formatRelativeAge(order.updated_at)}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface-muted/40">
            <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
              Produk ({Math.min(visibleItems.length, order.items_total)} dari {order.items_total})
            </div>
            <ul className="divide-y divide-border">
              {visibleItems.map((item) => (
                <li key={item.id} className="flex gap-3 px-3 py-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded bg-muted">
                    {item.image ? (
                      <img src={item.image} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Icon name="image" className="size-4" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-semibold">{item.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {variationLabel(item) || item.variant_sku || "-"}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold">{formatNumber(item.quantity)} Unit</p>
                </li>
              ))}
            </ul>
            {order.notes ? (
              <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Catatan: </span>
                {order.notes}
              </p>
            ) : null}
            {order.items_total > 2 ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="w-full border-t border-border px-3 py-2 text-left text-xs font-semibold text-primary hover:underline"
              >
                {expanded
                  ? "Sembunyikan produk"
                  : hiddenCount > 0
                    ? `Tampilkan semua produk (+${hiddenCount})`
                    : "Tampilkan semua produk"}
              </button>
            ) : null}
          </div>
        </div>

        <aside className="flex flex-col gap-2 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          {order.primary_action?.next_status || order.primary_action?.kind === "input_resi" ? (
            <div className="space-y-1">
              <Button className="w-full" disabled={busy} onClick={applyPrimary}>
                {busy ? "Memproses..." : order.primary_action.label}
              </Button>
              {order.primary_action.hint ? (
                <p className="text-[10px] leading-4 text-muted-foreground">{order.primary_action.hint}</p>
              ) : null}
            </div>
          ) : null}

          {order.whatsapp_url ? (
            <Button asChild variant="secondary" className="w-full">
              <a href={order.whatsapp_url} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                Chat WA
              </a>
            </Button>
          ) : null}

          <Button asChild variant="secondary" className="w-full">
            <Link href={order.href}>Detail</Link>
          </Button>

          {order.order_status !== "cancelled" && order.order_status !== "completed" ? (
            <ConfirmAction
              trigger={
                <button
                  type="button"
                  className="mt-1 min-h-10 text-left text-xs font-semibold text-destructive hover:underline"
                >
                  Batalkan Pesanan
                </button>
              }
              title="Batalkan pesanan?"
              description={`Pesanan ${order.order_number} akan berstatus dibatalkan.`}
              confirmLabel="Batalkan"
              processing={busy}
              reasonLabel="Alasan (opsional)"
              reasonPlaceholder="Misalnya: pelanggan meminta pembatalan"
              onConfirm={(reason) => applyStatus("cancelled", reason)}
            />
          ) : null}
        </aside>
      </div>
    </article>
  )
}

export default function OrdersIndex({
  title,
  description,
  tabs,
  activeStatus,
  activeSort,
  activePaymentStatus = "",
  activeShippingStatus = "",
  activeDatePreset = "",
  dateFrom = "",
  dateTo = "",
  searchQuery,
  orders,
  pagination,
  exportUrl,
}: OrdersIndexProps) {
  const [q, setQ] = React.useState(searchQuery)
  const [rangeFrom, setRangeFrom] = React.useState(dateFrom)
  const [rangeTo, setRangeTo] = React.useState(dateTo)
  const queryState = {
    order_status: activeStatus,
    q: searchQuery,
    sort: activeSort,
  }

  function visit(params: Record<string, string | undefined>) {
    const next: Record<string, string> = {}
    const merged = {
      order_status: activeStatus,
      q: searchQuery,
      sort: activeSort,
      payment_status: activePaymentStatus,
      shipping_status: activeShippingStatus,
      date_preset: activeDatePreset,
      date_from: activeDatePreset === "range" ? dateFrom : "",
      date_to: activeDatePreset === "range" ? dateTo : "",
      ...params,
    }
    Object.entries(merged).forEach(([key, value]) => {
      if (!value || value === "all" || (key === "sort" && value === "newest")) return
      if (key === "q" && !value.trim()) return
      if ((key === "date_from" || key === "date_to") && merged.date_preset !== "range") return
      next[key] = value
    })
    router.get(routeUrl("admin.orders.index"), next, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
    })
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    visit({ q: q.trim() })
  }

  function applyDateRange(event: React.FormEvent) {
    event.preventDefault()
    visit({
      date_preset: "range",
      date_from: rangeFrom || undefined,
      date_to: rangeTo || undefined,
    })
  }

  return (
    <AdminLayout title={title} description={description}>
      <Head title={`${title} | Admin`} />

      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map((tab) => {
          const active = tab.key === activeStatus
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => visit({ order_status: tab.key })}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "tabular-nums rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {formatNumber(tab.count)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={submitSearch} className="relative min-w-0 flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Cari nomor order, nama penerima, no. HP, provinsi, kota..."
            className="pl-10"
            data-admin-search
          />
        </form>
        <Select
          value={activeSort}
          onChange={(event) => visit({ sort: event.target.value })}
          className="sm:w-40"
          aria-label="Urutan"
        >
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
        </Select>
        <Button asChild variant="secondary">
          <a href={exportUrl}>Export</a>
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <Select
          value={activePaymentStatus || "all"}
          onChange={(event) =>
            visit({ payment_status: event.target.value === "all" ? undefined : event.target.value })
          }
          className="lg:w-44"
          aria-label="Filter status pembayaran"
        >
          <option value="all">Semua pembayaran</option>
          <option value="pending">Belum lunas</option>
          <option value="paid">Lunas</option>
          <option value="refunded">Refund</option>
        </Select>
        <Select
          value={activeShippingStatus || "all"}
          onChange={(event) =>
            visit({ shipping_status: event.target.value === "all" ? undefined : event.target.value })
          }
          className="lg:w-48"
          aria-label="Filter status pengiriman"
        >
          <option value="all">Semua pengiriman</option>
          <option value="pending_pickup">Menunggu pickup</option>
          <option value="in_process">Diproses kurir</option>
          <option value="in_transit">Dalam perjalanan</option>
          <option value="delivered">Terkirim</option>
          <option value="cancelled">Dibatalkan</option>
        </Select>
        <Select
          value={activeDatePreset || "all"}
          onChange={(event) => {
            const value = event.target.value
            if (value === "all") {
              visit({ date_preset: undefined, date_from: undefined, date_to: undefined })
              return
            }
            if (value === "range") {
              visit({
                date_preset: "range",
                date_from: rangeFrom || undefined,
                date_to: rangeTo || undefined,
              })
              return
            }
            visit({ date_preset: value, date_from: undefined, date_to: undefined })
          }}
          className="lg:w-44"
          aria-label="Filter waktu"
        >
          <option value="all">Semua waktu</option>
          <option value="today">Hari ini</option>
          <option value="7d">7 hari terakhir</option>
          <option value="range">Rentang tanggal</option>
        </Select>
        {activeDatePreset === "range" ? (
          <form onSubmit={applyDateRange} className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              Dari
              <Input
                type="date"
                value={rangeFrom}
                onChange={(event) => setRangeFrom(event.target.value)}
                className="w-40"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              Sampai
              <Input
                type="date"
                value={rangeTo}
                onChange={(event) => setRangeTo(event.target.value)}
                className="w-40"
              />
            </label>
            <Button type="submit" variant="secondary">
              Terapkan
            </Button>
          </form>
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        {orders.length ? (
          orders.map((order) => (
            <OrderCardRow key={order.id} order={order} queryState={queryState} />
          ))
        ) : (
          <EmptyState
            icon="clipboard-list"
            title="Belum ada pesanan"
            description="Pesanan yang cocok dengan filter saat ini akan tampil di sini."
          />
        )}
      </div>

      {pagination?.total ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Menampilkan{" "}
          <span className="font-semibold text-foreground">
            {(pagination.current_page - 1) * (pagination.per_page ?? 10) + 1}
            {" - "}
            {Math.min(pagination.current_page * (pagination.per_page ?? 10), pagination.total)}
          </span>{" "}
          dari <span className="font-semibold text-foreground">{formatNumber(pagination.total)}</span>{" "}
          pesanan
        </p>
      ) : null}

      <Pagination pagination={pagination} />
    </AdminLayout>
  )
}
