import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import {
  PrintAddressArea,
  type AddressData,
  usePrintAddress,
} from "@/components/shared/print-address"
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
  shipping_status?: string
  cod_flag?: boolean
  flow?: "cod" | "transfer"
  customer_name: string
  customer_phone?: string | null
  shipping_address_line1?: string | null
  shipping_address_line2?: string | null
  shipping_village?: string | null
  shipping_district?: string | null
  shipping_city?: string | null
  shipping_province?: string | null
  shipping_postal_code?: string | null
  notes?: string | null
  admin_notes?: string | null
  total_amount: number
  product_count: number
  unit_count: number
  created_at: string | null
  updated_at: string | null
  href: string
  whatsapp_url?: string | null
  primary_action: PrimaryAction | null
  secondary_action?: PrimaryAction | null
  shipping_track?: {
    shipping_status: string
    carrier_name?: string | null
    waybill_number?: string | null
    record_status?: string | null
    status_raw?: string | null
    last_status_at?: string | null
    tracking_url?: string | null
    order_status?: string
    payment_status?: string
    payment_method?: string | null
    total_amount?: number
    paid?: boolean
    latest_message?: string | null
    latest_at?: string | null
  }
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
  activeOlderThan?: string
  activeDatePreset?: string
  dateFrom?: string
  dateTo?: string
  searchQuery: string
  summary: {
    count: number
    total_value: number
  }
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
  if (minutes < 60) return `${minutes} menit`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `${days} hari ${remHours} jam` : `${days} hari`
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
    .join(", ")
}

/** Grid kolom: produk | bayar | status | waktu | kirim | aksi */
const orderRowGridClass =
  "xl:grid xl:grid-cols-[minmax(0,2.8fr)_minmax(7rem,0.95fr)_minmax(8.5rem,1.05fr)_minmax(6.5rem,0.85fr)_minmax(8.5rem,1fr)_minmax(6rem,0.75fr)] xl:items-start xl:gap-x-4"

function OrderListColumnHeader() {
  return (
    <div
      className={cn(
        orderRowGridClass,
        "hidden px-4 pb-2 text-xs font-medium text-muted-foreground xl:grid",
      )}
      aria-hidden="true"
    >
      <span>Produk</span>
      <span>Dibayar pembeli</span>
      <span>Status</span>
      <span>Batas waktu</span>
      <span>Jasa kirim</span>
      <span className="text-right">Aksi</span>
    </div>
  )
}

function OrderCardRow({
  order,
  queryState,
}: {
  order: OrderCard
  queryState: {
    order_status: string
    q: string
    sort: string
    payment_status: string
    shipping_status: string
    older_than: string
    date_preset: string
    date_from: string
    date_to: string
  }
}) {
  const [expanded, setExpanded] = React.useState(false)

  async function copyItemText(value: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // ignore
    }
  }
  const [busy, setBusy] = React.useState(false)
  const { printing, handlePrint } = usePrintAddress()

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
        filter_payment_status: queryState.payment_status,
        filter_shipping_status: queryState.shipping_status,
        filter_older_than: queryState.older_than,
        filter_date_preset: queryState.date_preset,
        filter_date_from: queryState.date_from,
        filter_date_to: queryState.date_to,
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
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-colors hover:border-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-[10px] font-semibold text-muted-foreground">
            {order.customer_name.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate font-medium text-foreground">{order.customer_name}</span>
          {order.admin_notes?.trim() ? (
            <span
              title={order.admin_notes}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
            >
              <Icon name="file-text" className="size-3" aria-hidden="true" />
              Catatan admin
            </span>
          ) : null}
          {order.whatsapp_url ? (
            <a
              href={order.whatsapp_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label={`WhatsApp ${order.customer_name}`}
            >
              <Icon name="whatsapp" className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-8 w-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label={`Cetak alamat ${order.customer_name}`}
            title="Cetak alamat"
          >
            <Icon name="printer" className="size-4" aria-hidden="true" />
            <span className="hidden text-xs font-medium xl:inline">Print</span>
          </button>
          <span className="hidden sm:inline">
            {[order.shipping_city, order.shipping_province].filter(Boolean).join(", ") || "-"}
          </span>
          {order.customer_phone ? (
            <span className="hidden md:inline">· {order.customer_phone}</span>
          ) : null}
        </div>
        <Link
          href={order.href}
          className="group/order inline-flex shrink-0 items-center gap-1 font-mono text-xs font-semibold text-foreground transition hover:text-primary"
        >
          {order.order_number}
          <Icon
            name="chevron-right"
            className="size-3 text-muted-foreground transition group-hover/order:text-primary"
            aria-hidden="true"
          />
        </Link>
      </div>

      <div className={cn(orderRowGridClass, "gap-y-3 divide-y divide-border p-4 xl:divide-y-0")}>
        {/* Produk */}
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Produk
          </p>
          <ul className="space-y-2.5">
            {visibleItems.map((item) => (
              <li key={item.id} className="flex gap-2.5">
                <div className="size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  {item.image ? (
                    <img src={item.image} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <Icon name="image" className="size-3.5" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1.5">
                    <p className="line-clamp-2 flex-1 text-[13px] font-medium leading-5 text-foreground">
                      {item.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => copyItemText(item.name)}
                      className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label={`Salin ukuran & nama: ${item.name}`}
                      title="Salin ukuran & nama produk"
                    >
                      <Icon name="copy" className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {variationLabel(item) || item.variant_sku || "-"}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    ×{formatNumber(item.quantity)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {order.items_total > 2 ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="text-left text-xs font-medium text-primary hover:underline"
            >
              {expanded
                ? "Sembunyikan produk"
                : hiddenCount > 0
                  ? `+${hiddenCount} produk lainnya`
                  : "Tampilkan semua produk"}
            </button>
          ) : null}
          {order.notes ? (
            <p className="rounded-md border border-info/20 bg-info/5 px-3 py-2 text-xs leading-5 text-foreground">
              <span className="font-semibold">Catatan: </span>
              {order.notes}
            </p>
          ) : null}
        </div>

        {/* Dibayar Pembeli */}
        <div className="min-w-0 pt-3 xl:pt-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Dibayar pembeli
          </p>
          <p className="tabular-nums text-sm font-semibold text-foreground">
            {formatCurrency(order.total_amount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {order.payment_method_label ||
              (order.payment_method ? humanize(order.payment_method) : "Metode -")}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
            {statusMeta(order.payment_status).label}
          </p>
        </div>

        {/* Status */}
        <div className="min-w-0 pt-3 xl:pt-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Status
          </p>
          <StatusBadge status={order.order_status} />
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground/80">
            {order.primary_action?.hint || statusMeta(order.order_status).label}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(order.flow === "cod" || order.cod_flag) && (
              <span className="rounded-md border border-warning/30 bg-transparent px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">
                COD
              </span>
            )}
            <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {formatNumber(order.product_count)} produk
            </span>
          </div>
        </div>

        {/* Batas Waktu */}
        <div className="min-w-0 pt-3 xl:pt-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Batas waktu
          </p>
          <p className="text-[13px] font-medium leading-snug text-foreground">
            {formatRelativeAge(order.updated_at)}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground/80">
            Dipesan {formatDateTime(order.created_at)}
          </p>
        </div>

        {/* Jasa Kirim */}
        <div className="min-w-0 pt-3 xl:pt-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Jasa kirim
          </p>
          <p className="text-[13px] font-medium text-foreground">
            {order.shipping_track?.carrier_name || "Pengiriman"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {statusMeta(order.shipping_track?.shipping_status || order.shipping_status || "pending_pickup").label}
          </p>
          {order.shipping_track?.waybill_number ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {order.shipping_track.waybill_number}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Belum ada resi</p>
          )}
          {order.shipping_track?.tracking_url ? (
            <a
              href={order.shipping_track.tracking_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
            >
              Lacak
            </a>
          ) : null}
        </div>

        {/* Aksi */}
        <div className="flex min-w-0 flex-col items-stretch gap-1.5 pt-3 xl:items-end xl:pt-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Aksi
          </p>
          {order.primary_action?.next_status || order.primary_action?.kind === "input_resi" ? (
            <Button size="xs" className="w-full xl:w-auto" disabled={busy} onClick={applyPrimary}>
              {busy ? "Memproses..." : order.primary_action.label}
            </Button>
          ) : null}

          {order.secondary_action?.next_status ? (
            <Button
              variant="secondary"
              size="xs"
              className="w-full xl:w-auto"
              disabled={busy}
              onClick={() => applyStatus(order.secondary_action!.next_status!)}
            >
              {busy ? "Memproses..." : order.secondary_action.label}
            </Button>
          ) : null}

          {order.whatsapp_url ? (
            <Button asChild variant="secondary" size="xs" className="w-full xl:w-auto">
              <a href={order.whatsapp_url} target="_blank" rel="noreferrer">
                Chat WA
              </a>
            </Button>
          ) : null}

          <Button asChild variant="ghost" size="xs" className="w-full xl:w-auto">
            <Link href={order.href}>Detail</Link>
          </Button>

          {order.order_status !== "cancelled" && order.order_status !== "completed" ? (
            <ConfirmAction
              trigger={
                <button
                  type="button"
                  className="text-left text-xs font-medium text-destructive hover:underline xl:text-right"
                >
                  Batalkan
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
        </div>
      </div>
      {printing ? <PrintAddressArea data={order as AddressData} /> : null}
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
  activeOlderThan = "",
  activeDatePreset = "",
  dateFrom = "",
  dateTo = "",
  searchQuery,
  summary,
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
    payment_status: activePaymentStatus,
    shipping_status: activeShippingStatus,
    older_than: activeOlderThan,
    date_preset: activeDatePreset,
    date_from: activeDatePreset === "range" ? dateFrom : "",
    date_to: activeDatePreset === "range" ? dateTo : "",
  }

  function visit(params: Record<string, string | undefined>) {
    const next: Record<string, string> = {}
    const merged = {
      order_status: activeStatus,
      q: searchQuery,
      sort: activeSort,
      payment_status: activePaymentStatus,
      shipping_status: activeShippingStatus,
      older_than: activeOlderThan,
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

      {/* Tabs status — segmented control ala AI app */}
      <div className="scrollbar-none overflow-x-auto">
        <div
          className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-card p-1"
          role="tablist"
          aria-label="Filter status pesanan"
        >
          {tabs.map((tab) => {
            const active = tab.key === activeStatus
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => visit({ order_status: tab.key, older_than: undefined })}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition duration-100",
                  active
                    ? "bg-surface text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "tabular-nums rounded-full px-1.5 py-px text-[10px] font-semibold",
                    active ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {formatNumber(tab.count)}
                </span>
              </button>
            )
          })}
        </div>
      </div>


      {/* Baris kontrol seragam: search | sort/filter | summary | actions */}
      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: submitSearch,
          placeholder: "Cari nomor order, nama penerima, no. HP, provinsi, kota…",
        }}
        sort={
          <Select
            value={activeSort}
            onChange={(event) => visit({ sort: event.target.value })}
            aria-label="Urutan"
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
          </Select>
        }
        summary={
          <>
            <span>
              <span className="tabular-nums font-semibold text-foreground">
                {formatNumber(summary.count)}
              </span>{" "}
              pesanan
            </span>
            <span className="tabular-nums">
              Nilai:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(summary.total_value)}
              </span>
            </span>
          </>
        }
        actions={
          <Button asChild variant="secondary">
            <a href={exportUrl}>
              <Icon name="download" className="size-3.5" aria-hidden="true" />
              Export
            </a>
          </Button>
        }
        className="mb-4"
      >
        <Select
          value={activePaymentStatus || "all"}
          onChange={(event) =>
            visit({ payment_status: event.target.value === "all" ? undefined : event.target.value })
          }
          className="w-auto"
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
          className="w-auto"
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
          value={activeOlderThan || "all"}
          onChange={(event) =>
            visit({ older_than: event.target.value === "all" ? undefined : event.target.value })
          }
          className="w-auto"
          aria-label="Filter umur status"
        >
          <option value="all">Semua umur</option>
          <option value="24h">Status &gt; 24 jam</option>
          <option value="2d">Status &gt; 2 hari</option>
          <option value="7d">Status &gt; 7 hari</option>
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
          className="w-auto"
          aria-label="Filter waktu"
        >
          <option value="all">Semua waktu</option>
          <option value="today">Hari ini</option>
          <option value="7d">7 hari terakhir</option>
          <option value="range">Rentang tanggal</option>
        </Select>
        {activeDatePreset === "range" ? (
          <form onSubmit={applyDateRange} className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={rangeFrom}
              onChange={(event) => setRangeFrom(event.target.value)}
              className="w-36"
              aria-label="Dari tanggal"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              value={rangeTo}
              onChange={(event) => setRangeTo(event.target.value)}
              className="w-36"
              aria-label="Sampai tanggal"
            />
            <Button type="submit" variant="secondary" size="sm">
              Terapkan
            </Button>
          </form>
        ) : null}
      </ListToolbar>

      {/* Daftar pesanan */}
      <div className="mt-4">
        {orders.length ? (
          <>
            <p className="mb-2.5 text-xs font-medium text-muted-foreground">
              <span className="tabular-nums font-semibold text-foreground">
                {formatNumber(pagination?.total ?? orders.length)}
              </span>{" "}
              pesanan
            </p>
            <div className="overflow-x-auto">
              <div className="space-y-3 xl:min-w-[60rem]">
                <OrderListColumnHeader />
                {orders.map((order) => (
                  <OrderCardRow key={order.id} order={order} queryState={queryState} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon="clipboard-list"
            title="Belum ada pesanan"
            description="Pesanan yang cocok dengan filter saat ini akan tampil di sini."
          />
        )}
      </div>

      {pagination?.total ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Menampilkan{" "}
          <span className="tabular-nums font-semibold text-foreground">
            {(pagination.current_page - 1) * (pagination.per_page ?? 10) + 1}
            {" – "}
            {Math.min(pagination.current_page * (pagination.per_page ?? 10), pagination.total)}
          </span>{" "}
          dari{" "}
          <span className="tabular-nums font-semibold text-foreground">
            {formatNumber(pagination.total)}
          </span>{" "}
          pesanan
        </p>
      ) : null}

      <Pagination pagination={pagination} />
    </AdminLayout>
  )
}
