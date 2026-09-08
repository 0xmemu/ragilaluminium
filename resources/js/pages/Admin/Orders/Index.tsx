import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import * as DialogPrimitive from "@radix-ui/react-dialog"

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
  PrintOrderArea,
  type OrderPrintData,
  usePrintOrder,
} from "@/components/shared/print-order-customer"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber, humanize } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
// import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"
import { useAdminLiveOrders } from "@/lib/admin-live-events"

interface OrderItemPreview {
  id: number
  name: string
  variant_sku?: string | null
  variation_1_name?: string | null
  variation_1_option?: string | null
  variation_2_name?: string | null
  variation_2_option?: string | null
  quantity: number
  unit_price: number
  line_total: number
  image?: string | null
  note?: string | null
}

interface PrimaryAction {
  label: string
  next_status: string | null
  kind?: string
  hint?: string | null
  href?: string
}

interface OrderCard {
  id: number
  order_number: string
  order_status: string
  payment_status: string
  payment_bucket?: string
  payment_label?: string
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

function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      title={copied ? "Tersalin!" : `${label} ${text}`}
      aria-label={copied ? "Tersalin!" : `${label} ${text}`}
    >
      <Icon
        name={copied ? "check" : "copy"}
        className={cn("size-3", copied ? "text-success" : "text-muted-foreground")}
        aria-hidden="true"
      />
    </button>
  )
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

/** Grid 7 kolom desktop berimbang: produk & subtotal | status | pembayaran | pengiriman | update | catatan admin | aksi */
const orderRowGridClass =
  "xl:grid xl:grid-cols-[minmax(0,2.65fr)_minmax(7.5rem,0.75fr)_minmax(8rem,0.85fr)_minmax(8.5rem,1fr)_minmax(7.5rem,0.8fr)_minmax(8.5rem,1fr)_minmax(6.5rem,0.75fr)] xl:items-start xl:gap-x-4"

function OrderListColumnHeader() {
  return (
    <div
      className={cn(
        orderRowGridClass,
        "hidden px-4 pb-2 text-xs font-medium text-muted-foreground xl:grid",
      )}
      aria-hidden="true"
    >
      <div className="flex items-baseline justify-between pr-2">
        <span>Produk</span>
        <span>Subtotal</span>
      </div>
      <span>Status pesanan</span>
      <span>Pembayaran</span>
      <span>Pengiriman</span>
      <span>Update terakhir</span>
      <span>Catatan admin</span>
      <span className="text-right">Aksi</span>
    </div>
  )
}

function OrderCardRow({
  order,
  queryState,
  onInputResi,
  onEditNotes,
}: {
  order: OrderCard
  onInputResi?: (order: OrderCard) => void
  onEditNotes?: (order: OrderCard) => void
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

  const [busy, setBusy] = React.useState(false)
  const { printing, handlePrint } = usePrintOrder()

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
      onInputResi?.(order)
      return
    }
    if (!order.primary_action?.next_status) return
    applyStatus(order.primary_action.next_status)
  }

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-soft transition-colors hover:border-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="truncate font-medium text-foreground">{order.customer_name}</span>
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
          <span className="hidden sm:inline">
            {[order.shipping_city, order.shipping_province].filter(Boolean).join(", ") || "-"}
          </span>
          {order.customer_phone ? (
            <span className="hidden md:inline">· {order.customer_phone}</span>
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label={`Cetak detail konsumen ${order.customer_name}`}
            title="Cetak detail konsumen"
          >
            <Icon name="printer" className="size-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Cetak</span>
          </button>
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
      </div>

      <div className={cn(orderRowGridClass, "gap-y-3 divide-y divide-border p-4 xl:divide-y-0")}>
        {/* Kolom 1: Produk & Subtotal Per Item */}
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Produk
          </p>
          <ul className="space-y-3">
            {visibleItems.map((item) => {
              const itemSubtotal = item.line_total ?? (item.unit_price * item.quantity)
              return (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-2.5">
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
                      <p className="line-clamp-2 text-xs font-normal leading-5 text-foreground">
                        {item.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {variationLabel(item) || item.variant_sku || "-"}
                        </span>
                        {item.variant_sku ? (
                          <CopyButton text={item.variant_sku} label="Salin SKU" />
                        ) : null}
                      </div>
                      {item.note?.trim() ? (
                        <div className="mt-1 inline-flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                          <Icon name="message-square" className="size-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                          <span>Catatan pelanggan: <strong className="font-semibold text-foreground">{item.note}</strong></span>
                        </div>
                      ) : (
                        <p className="mt-0.5 text-xs text-muted-foreground/60">
                          Catatan: -
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Matrik Subtotal Per Produk (setelah diskon/promo) */}
                  <div className="shrink-0 text-right self-start pl-2">
                    <p className="tabular-nums text-xs font-semibold text-foreground">
                      {formatCurrency(itemSubtotal)}
                    </p>
                    <p className="mt-0.5 tabular-nums text-[11px] text-muted-foreground">
                      {formatNumber(item.quantity)} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                </li>
              )
            })}
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

          {order.notes?.trim() ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              <Icon name="message-square" className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <span className="font-semibold">Catatan pelanggan: </span>
                <span className="font-medium text-foreground">{order.notes}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Kolom 2: Status Pesanan */}
        <div className="min-w-0 pt-3 xl:pt-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Status pesanan
          </p>
          <StatusBadge status={order.order_status} />
        </div>

        {/* Kolom 3: Pembayaran */}
        <div className="min-w-0 pt-3 xl:pt-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Pembayaran
          </p>
          <p className="text-xs font-medium text-foreground">
            {order.payment_method_label ||
              (order.payment_method ? humanize(order.payment_method) : "Metode -")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {order.flow === "cod" || (order.payment_method || "").toLowerCase() === "cod" ? (
              order.order_status === "completed" || order.payment_status === "paid" ? (
                <span className="font-medium text-success">Lunas saat tiba</span>
              ) : (
                <span>Bayar saat tiba</span>
              )
            ) : order.payment_status === "paid" ? (
              <span className="font-medium text-success">Lunas</span>
            ) : (
              <span>Belum lunas</span>
            )}
          </p>
        </div>

        {/* Kolom 4: Pengiriman */}
        <div className="min-w-0 pt-3 xl:pt-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Pengiriman
          </p>
          <p className="text-xs font-medium text-foreground">
            {order.shipping_track?.carrier_name || "Pengiriman"}
          </p>
          {order.shipping_track?.waybill_number ? (
            <div className="mt-0.5 flex items-center gap-1">
              <span className="font-mono text-xs text-foreground font-medium">
                {order.shipping_track.waybill_number}
              </span>
              <CopyButton text={order.shipping_track.waybill_number} label="Salin resi" />
            </div>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Belum ada resi</p>
          )}
          {order.shipping_track?.latest_message ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {order.shipping_track.latest_message}
            </p>
          ) : null}
          {order.shipping_track?.tracking_url ? (
            <a
              href={order.shipping_track.tracking_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Lacak
              <Icon name="external-link" className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>

        {/* Kolom 5: Usia Pesanan / Update Terakhir */}
        <div className="min-w-0 pt-3 xl:pt-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Update terakhir
          </p>
          <p className="text-xs font-medium leading-snug text-foreground">
            {formatRelativeAge(order.updated_at)}
          </p>
          <p className="mt-1 text-xs leading-4 text-muted-foreground/80">
            Dipesan {formatDateTime(order.created_at)}
          </p>
        </div>

        {/* Kolom 6: Catatan Admin (Tepat di sebelah kiri tombol aksi) */}
        <div className="min-w-0 pt-3 xl:pt-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Catatan admin
          </p>
          {order.admin_notes?.trim() ? (
            <div className="group/note rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-foreground">
              <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <span className="inline-flex items-center gap-1">
                  <Icon name="clipboard-text" className="size-3" aria-hidden="true" />
                  Catatan admin
                </span>
                <button
                  type="button"
                  onClick={() => onEditNotes?.(order)}
                  className="font-medium text-primary hover:underline"
                >
                  Edit
                </button>
              </div>
              <p className="mt-1 line-clamp-4 break-words text-xs leading-relaxed text-foreground">
                {order.admin_notes}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onEditNotes?.(order)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface/60 px-2.5 py-2 text-xs text-muted-foreground transition hover:border-primary/60 hover:bg-muted hover:text-foreground"
              title="Tambah catatan internal admin"
            >
              <Icon name="plus" className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Tambah catatan</span>
            </button>
          )}
        </div>

        {/* Kolom 7: Aksi */}
        <div className="flex min-w-0 flex-col items-stretch gap-1.5 pt-3 xl:items-end xl:pt-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:sr-only">
            Aksi
          </p>
          {order.primary_action?.next_status || order.primary_action?.kind === "input_resi" ? (
            <Button size="xs" className="w-full xl:w-auto" disabled={busy} onClick={applyPrimary}>
              {busy ? "Memproses..." : order.primary_action.label}
            </Button>
          ) : null}

          {order.secondary_action ? (
            order.secondary_action.href ? (
              <Button asChild variant="secondary" size="xs" className="w-full xl:w-auto">
                <Link href={order.secondary_action.href}>{order.secondary_action.label}</Link>
              </Button>
            ) : order.secondary_action.next_status ? (
              <Button
                variant="secondary"
                size="xs"
                className="w-full xl:w-auto"
                disabled={busy}
                onClick={() => applyStatus(order.secondary_action!.next_status!)}
              >
                {busy ? "Memproses..." : order.secondary_action.label}
              </Button>
            ) : null
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

          {order.order_status === "awaiting_confirmation" || order.order_status === "processing" ? (
            <ConfirmAction
              trigger={
                <button
                  type="button"
                  className="mt-1 text-xs text-destructive hover:underline xl:text-right"
                >
                  Batalkan
                </button>
              }
              title="Batalkan Pesanan"
              description={`Apakah Anda yakin ingin membatalkan pesanan ${order.order_number}? Stok produk akan dikembalikan dan pesanan tidak dapat diubah lagi.`}
              confirmLabel="Ya, batalkan pesanan"
              variant="destructive"
              onConfirm={() => applyStatus("cancelled")}
            />
          ) : null}

        </div>
      </div>

      {/* Baris Bawah Kartu: Rincian Unit & Total Dibayar Pembeli di Kanan Bawah */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-surface/40 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Pesanan: <strong className="text-foreground">{formatNumber(order.product_count)}</strong> produk ({formatNumber(order.unit_count)} unit)</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">Total Pesanan (Dibayar Pembeli):</span>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(order.total_amount)}
          </span>
        </div>
      </div>

      {printing ? <PrintOrderArea data={order as OrderPrintData} /> : null}
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
  const [exportOpen, setExportOpen] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [exportRange, setExportRange] = React.useState<"screen" | "custom">("screen")
  const [exportFrom, setExportFrom] = React.useState("")
  const [exportTo, setExportTo] = React.useState("")
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

  // Live-event-ready: adapter tidak aktif (broadcast runtime belum ada).
  // Saat aktif nanti, event utk order pada hasil/filter saat ini memicu notice.
  const [liveNotice, setLiveNotice] = React.useState<string | null>(null)
  const { state: _liveState } = useAdminLiveOrders({
    onOrderUpdated: (event) => {
      // Jangan sisipkan row palsu; cukup tandai data baru tersedia.
      setLiveNotice(`Ada pembaruan pesanan ${event.order_number}. Perbarui daftar.`)
    },
  })

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

  const hasActiveFilters = React.useMemo(() => {
    return (
      (activeStatus && activeStatus !== "all") ||
      (activePaymentStatus && activePaymentStatus !== "all") ||
      (activeShippingStatus && activeShippingStatus !== "all") ||
      (activeOlderThan && activeOlderThan !== "all") ||
      (activeDatePreset && activeDatePreset !== "all" && activeDatePreset !== "today") ||
      searchQuery?.trim()
    )
  }, [activeStatus, activePaymentStatus, activeShippingStatus, activeOlderThan, activeDatePreset, searchQuery])

  const activeFilters = React.useMemo(() => {
    const chips: Array<{ label: string; clear: () => void }> = []
    if (activeStatus && activeStatus !== "all") {
      const tab = tabs.find((t) => t.key === activeStatus)
      if (tab) chips.push({ label: tab.label, clear: () => visit({ order_status: "all" }) })
    }
    if (activePaymentStatus && activePaymentStatus !== "all") {
      chips.push({ label: `Pembayaran: ${humanize(activePaymentStatus)}`, clear: () => visit({ payment_status: "all" }) })
    }
    if (activeShippingStatus && activeShippingStatus !== "all") {
      chips.push({ label: `Pengiriman: ${humanize(activeShippingStatus)}`, clear: () => visit({ shipping_status: "all" }) })
    }
    if (activeOlderThan && activeOlderThan !== "all") {
      chips.push({ label: `Umur: ${humanize(activeOlderThan)}`, clear: () => visit({ older_than: "all" }) })
    }
    if (activeDatePreset && activeDatePreset !== "all" && activeDatePreset !== "today") {
      chips.push({ label: `Tanggal: ${humanize(activeDatePreset)}`, clear: () => visit({ date_preset: "today" }) })
    }
    if (searchQuery?.trim()) {
      chips.push({ label: `Cari: ${searchQuery}`, clear: () => visit({ q: "" }) })
    }
    return chips
  }, [activeStatus, activePaymentStatus, activeShippingStatus, activeOlderThan, activeDatePreset, searchQuery, tabs, visit])

  function resetAllFilters() {
    router.get(routeUrl("admin.orders.index"), {}, { preserveState: false, preserveScroll: true })
  }

  function buildExportUrl(): string {
    try {
      const url = new URL(exportUrl, window.location.origin)
      if (exportRange === "custom" && exportFrom && exportTo) {
        url.searchParams.set("date_preset", "range")
        url.searchParams.set("date_from", exportFrom)
        url.searchParams.set("date_to", exportTo)
      }
      return url.toString()
    } catch {
      return exportUrl
    }
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

  // Popup input resi langsung dari daftar: form + verifikasi pelanggan & alamat.
  // Sistem tidak menilai benar/salah; admin yang memastikan sebelum menyimpan.
  const [resiOrder, setResiOrder] = React.useState<OrderCard | null>(null)
  const [resiForm, setResiForm] = React.useState({ waybill_number: "", mark_shipped: true })
  const [resiBusy, setResiBusy] = React.useState(false)
  const [resiError, setResiError] = React.useState<string | null>(null)

  // Popup catatan internal admin langsung dari daftar
  const [notesModalOrder, setNotesModalOrder] = React.useState<OrderCard | null>(null)
  const [notesText, setNotesText] = React.useState("")
  const [notesBusy, setNotesBusy] = React.useState(false)

  function openNotesModal(order: OrderCard) {
    setNotesModalOrder(order)
    setNotesText(order.admin_notes ?? "")
  }

  function submitAdminNotes(e: React.FormEvent) {
    e.preventDefault()
    if (!notesModalOrder) return
    setNotesBusy(true)
    router.put(
      routeUrl("admin.orders.admin-notes.update", { order: notesModalOrder.id }),
      { admin_notes: notesText.trim() || null },
      {
        preserveScroll: true,
        onSuccess: () => {
          setNotesModalOrder(null)
          setNotesText("")
        },
        onFinish: () => setNotesBusy(false),
      },
    )
  }

  function submitResi(event: React.FormEvent) {
    event.preventDefault()
    if (!resiOrder) return
    setResiBusy(true)
    setResiError(null)
    router.post(
      routeUrl("admin.orders.shipping.store", { order: resiOrder.id }),
      {
        waybill_number: resiForm.waybill_number,
        mark_shipped: resiForm.mark_shipped,
      },
      {
        preserveScroll: true,
        onSuccess: () => {
          setResiOrder(null)
          setResiForm({ waybill_number: "", mark_shipped: true })
        },
        onError: (errors) => {
          const map = (errors ?? {}) as Record<string, string>
          setResiError(map.waybill_number ?? map.mark_shipped ?? "Gagal menyimpan resi. Periksa kembali isian.")
        },
        onFinish: () => setResiBusy(false),
      },
    )
  }

  function resiAddress(order: OrderCard): string {
    return [
      order.shipping_address_line1,
      order.shipping_address_line2,
      order.shipping_village,
      order.shipping_district,
      order.shipping_city,
      order.shipping_province,
      order.shipping_postal_code,
    ].filter(Boolean).join(", ")
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setRefreshing(true)
              router.reload({
                only: ["orders", "summary", "tabs"],
                onFinish: () => setRefreshing(false),
              })
            }}
            disabled={refreshing}
          >
            <Icon name="refresh" className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            {refreshing ? "Memuat..." : "Refresh data"}
          </Button>

          <div className="relative">
            <Button variant="secondary" onClick={() => setExportOpen((v) => !v)}>
              <Icon name="download" className="size-3.5" aria-hidden="true" />
              Unduh Laporan
            </Button>
            {exportOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
                <p className="text-xs font-bold text-foreground">Rentang waktu export</p>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <input type="radio" name="orders_export_range" checked={exportRange === "screen"} onChange={() => setExportRange("screen")} />
                  Ikuti filter di layar
                </label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <input type="radio" name="orders_export_range" checked={exportRange === "custom"} onChange={() => setExportRange("custom")} />
                  Kustom
                </label>
                {exportRange === "custom" ? (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="h-8 w-32 text-xs" aria-label="Dari tanggal" />
                    <span className="text-xs text-muted-foreground">s/d</span>
                    <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="h-8 w-32 text-xs" aria-label="Sampai tanggal" />
                  </div>
                ) : null}
                <a
                  href={buildExportUrl()}
                  onClick={() => setExportOpen(false)}
                  className="mt-3 flex h-9 w-full items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Unduh XLSX
                </a>
              </div>
            ) : null}
          </div>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {/* Tabs status pesanan + Ringkasan Pesanan & Nilai sejajar di kanan */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-none overflow-x-auto">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-1"
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
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-foreground text-background shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "tabular-nums rounded-full px-1.5 py-px text-[11px] font-semibold",
                      active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {formatNumber(tab.count)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
          <span>Ditemukan: <strong className="tabular-nums font-semibold text-foreground">{formatNumber(summary.count)}</strong> pesanan</span>
          <span className="text-muted-foreground/60">·</span>
          <span>Total Nilai: <strong className="tabular-nums font-semibold text-foreground">{formatCurrency(summary.total_value)}</strong></span>
        </div>
      </div>

      {/* Baris kontrol seragam: search | sort/filter | summary | actions */}
      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: submitSearch,
          placeholder: "Cari nomor order, nama penerima, no. HP, provinsi, kota...",
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
          <option value="3d">3 hari terakhir</option>
          <option value="7d">7 hari terakhir</option>
          <option value="30d">30 hari terakhir</option>
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
            <span className="text-xs text-muted-foreground">-</span>
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
        {liveNotice ? (
          <div
            role="status"
            className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-info/20 bg-info/5 px-3 py-2 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-2">
              <Icon name="info" className="size-3.5 shrink-0 text-info" aria-hidden="true" />
              {liveNotice}
            </span>
            <button
              type="button"
              onClick={() => {
                setLiveNotice(null)
                router.get(routeUrl("admin.orders.index"), {}, { preserveScroll: true })
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 font-semibold text-foreground transition hover:bg-muted"
            >
              <Icon name="refresh" className="size-3" aria-hidden="true" />
              Perbarui daftar
            </button>
          </div>
        ) : null}

        {/* Baris Filter Aktif (hanya tampil jika ada filter aktif) */}
        {activeFilters.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs" aria-label="Filter aktif">
            <span className="font-medium text-muted-foreground">
              Filter Aktif:
            </span>
            {activeFilters.map((filter) => (
              <span
                key={filter.label}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground"
              >
                {filter.label}
                <button
                  type="button"
                  onClick={filter.clear}
                  className="rounded-full p-0.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  aria-label={`Hapus filter ${filter.label}`}
                >
                  <Icon name="x" className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={resetAllFilters}
              className="ml-1 text-xs font-medium text-primary hover:underline"
            >
              Reset Semua
            </button>
          </div>
        ) : null}

        {orders.length ? (
          <>
            <div className="overflow-x-auto">
              <div className="space-y-3 xl:min-w-[60rem]">
                <OrderListColumnHeader />
                {orders.map((order) => (
                  <OrderCardRow
                    key={order.id}
                    order={order}
                    queryState={queryState}
                    onInputResi={setResiOrder}
                    onEditNotes={openNotesModal}
                  />
                ))}
              </div>
            </div>
          </>
        ) : hasActiveFilters ? (
          <EmptyState
            icon="clipboard-list"
            title="Tidak ada pesanan yang cocok"
            description="Coba ubah atau hapus filter untuk melihat pesanan lain."
            action={
              <Button variant="outline" size="sm" onClick={resetAllFilters}>
                Reset Filter
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="clipboard-list"
            title="Belum ada pesanan"
            description="Pesanan yang masuk akan tampil di sini."
          />
        )}
      </div>

      {pagination?.total ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Menampilkan{" "}
          <span className="tabular-nums font-semibold text-foreground">
            {(pagination.current_page - 1) * (pagination.per_page ?? 10) + 1}
            {" - "}
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

      {/* Dialog input resi desktop: kartu terpadu, adaptif tema, zero text-contrast bug */}
      <DialogPrimitive.Root open={Boolean(resiOrder)} onOpenChange={(open) => { if (!open) setResiOrder(null) }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-[80] flex max-h-[min(90dvh,38rem)] w-[min(calc(100%-2rem),32rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl duration-200",
              "data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95",
            )}
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Input nomor resi</DialogPrimitive.Title>

            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Input Resi Pengiriman</h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Pesanan {resiOrder?.order_number} · {resiOrder?.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResiOrder(null)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Tutup popup resi"
              >
                <Icon name="x" className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {resiOrder ? (
                <>
                <section className="rounded-lg border border-border bg-surface/80 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground inline-flex items-center gap-1.5">
                      <Icon name="user" className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      Detail Penerima & Alamat
                    </span>
                    {resiOrder.whatsapp_url ? (
                      <a
                        href={resiOrder.whatsapp_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"
                      >
                        <Icon name="whatsapp" className="size-3.5 text-info" aria-hidden="true" />
                        Chat WhatsApp
                      </a>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                    <span className="text-muted-foreground">Penerima:</span>
                    <span className="font-medium text-foreground">{resiOrder.customer_name} ({resiOrder.customer_phone || "-"})</span>
                    <span className="text-muted-foreground align-top">Alamat:</span>
                    <span className="font-medium leading-5 text-foreground">{resiAddress(resiOrder) || "-"}</span>
                  </div>
                </section>

                <form onSubmit={submitResi} className="space-y-4">
                  {resiError ? (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{resiError}</p>
                  ) : null}

                  <div className="space-y-1.5">
                    <label htmlFor="index-modal-waybill" className="text-xs font-semibold text-foreground">
                      Nomor Resi J&T Cargo *
                    </label>
                    <input
                      id="index-modal-waybill"
                      type="text"
                      required
                      value={resiForm.waybill_number}
                      onChange={(event) => setResiForm((prev) => ({ ...prev, waybill_number: event.target.value }))}
                      placeholder="Masukkan nomor resi ekspedisi (mis. JT1234567890)"
                      className="h-9 w-full rounded-md border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={resiForm.mark_shipped}
                      onChange={(event) => setResiForm((prev) => ({ ...prev, mark_shipped: event.target.checked }))}
                      className="size-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span>Tandai pesanan langsung sebagai dikirim (shipped)</span>
                  </label>

                  <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setResiOrder(null)}
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={resiBusy}
                    >
                      {resiBusy ? "Menyimpan..." : "Simpan Resi"}
                    </Button>
                  </div>
                </form>
                </>
              ) : null}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Dialog Catatan Internal Admin: tambah & ubah catatan langsung dari daftar */}
      <DialogPrimitive.Root open={Boolean(notesModalOrder)} onOpenChange={(open) => { if (!open) setNotesModalOrder(null) }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-[80] flex max-h-[min(90dvh,32rem)] w-[min(calc(100%-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl duration-200",
              "data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95",
            )}
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Catatan internal admin</DialogPrimitive.Title>

            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Catatan Internal Admin</h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Pesanan {notesModalOrder?.order_number} · {notesModalOrder?.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotesModalOrder(null)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Tutup popup catatan"
              >
                <Icon name="x" className="size-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={submitAdminNotes} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="modal-admin-notes-textarea" className="text-xs font-semibold text-foreground">
                  Catatan khusus internal (tidak terlihat oleh pembeli)
                </label>
                <textarea
                  id="modal-admin-notes-textarea"
                  rows={4}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Tulis catatan internal untuk pesanan ini (mis. permintaan jadwal kirim khusus, DP transfer manual, verifikasi spesifikasi)..."
                  className="w-full rounded-md border border-border bg-surface p-3 text-xs leading-5 text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  maxLength={5000}
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                {notesModalOrder?.admin_notes?.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={notesBusy}
                    onClick={() => {
                      setNotesText("")
                      if (!notesModalOrder) return
                      setNotesBusy(true)
                      router.put(
                        routeUrl("admin.orders.admin-notes.update", { order: notesModalOrder.id }),
                        { admin_notes: null },
                        {
                          preserveScroll: true,
                          onSuccess: () => setNotesModalOrder(null),
                          onFinish: () => setNotesBusy(false),
                        },
                      )
                    }}
                  >
                    Hapus Catatan
                  </Button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setNotesModalOrder(null)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={notesBusy}
                  >
                    {notesBusy ? "Menyimpan..." : "Simpan Catatan"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </AdminLayout>
  )
}
