import { Head, Link, router, usePage } from "@inertiajs/react"
import * as React from "react"

import { OptionMenu } from "@/components/admin/option-menu"
import { Icon } from "@/components/shared/icon"
import { ShippingTrackPanel } from "@/components/shared/shipping-track-panel"
import { StatusBadge } from "@/components/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber, humanize } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { SharedPageProps } from "@/types"

interface OmzetData {
  revenue: number
  orders: number
  units: number
  change_percent: number
  orders_delta: number
  units_delta: number
  sparkline: number[]
}

interface PerformaMetric {
  key: string
  label: string
  value: number
  previous: number
  change_percent: number | null
  format: string
}

interface PerformaData {
  period: string
  period_label: string
  period_options: Array<{ value: string; label: string }>
  metrics: PerformaMetric[]
  detail_href: string
}

interface StatusOrderItem {
  key: string
  label: string
  icon: string
  total: number
  href: string
}

interface AttentionItem {
  key: string
  label: string
  count: number
  href: string
}

interface QuickAction {
  label: string
  description: string
  href: string
  icon: string
}

interface RecentOrderRow {
  id: number
  order_number: string
  created_at: string | null
  updated_at: string | null
  customer_name: string
  shipping_city?: string | null
  shipping_province?: string | null
  customer_phone?: string | null
  order_status: string
  shipping_status?: string
  waybill_number?: string | null
  shipping_track?: {
    shipping_status: string
    waybill_number?: string | null
    latest_message?: string | null
    latest_at?: string | null
    order_status?: string
    payment_status?: string
    payment_method?: string | null
    total_amount?: number
    paid?: boolean
  }
  total_amount: number
  payment_method?: string | null
  product_count: number
  unit_count: number
  href: string
  whatsapp_url?: string | null
}

interface PromoProduct {
  id: number
  parent_sku: string
  name: string
  discount_percent: number | null
  flash_sale: boolean
  homepage_popular: boolean
  href: string
}

interface TopEngagedProduct {
  id: number
  parent_sku: string
  name: string
  image?: string | null
  views: number
  clicks: number
  total: number
  href: string
}

interface TopEngagedProductsData {
  period: string
  period_label: string
  items: TopEngagedProduct[]
}

interface DashboardProps {
  greetingName: string
  todayLabel: string
  omzet: OmzetData
  performa: PerformaData
  statusOrder: StatusOrderItem[]
  attention: AttentionItem[]
  quickActions: QuickAction[]
  recentOrders: RecentOrderRow[]
  promoProducts: PromoProduct[]
  promoTotal: number
  topEngagedProducts?: TopEngagedProductsData
}

function greetingPrefix(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 11) return "Selamat Pagi"
  if (hour < 15) return "Selamat Siang"
  if (hour < 18) return "Selamat Sore"
  return "Selamat Malam"
}

function formatRelativeAge(iso: string | null | undefined): string {
  if (!iso) return "-"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "-"
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${Math.max(minutes, 0)} Menit`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} Jam`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `${days} Hari ${remHours} Jam` : `${days} Hari`
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

function formatMetricValue(metric: PerformaMetric): string {
  if (metric.format === "percent") {
    return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(metric.value)}%`
  }
  return formatNumber(metric.value)
}

function DeltaBadge({
  percent,
  absolute,
  absoluteSuffix,
}: {
  percent?: number | null
  absolute?: number
  absoluteSuffix?: string
}) {
  if (absolute !== undefined) {
    const up = absolute >= 0
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold",
          up ? "text-success" : "text-destructive",
        )}
      >
        <Icon
          name="trend-up"
          className={cn("size-3.5", !up && "rotate-180")}
          aria-hidden="true"
        />
        {up ? "+" : ""}
        {formatNumber(absolute)} {absoluteSuffix} dari kemarin
      </span>
    )
  }

  if (percent === null || percent === undefined) {
    return <span className="text-xs text-muted-foreground">Belum ada pembanding</span>
  }

  const up = percent >= 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        up ? "text-success" : "text-destructive",
      )}
    >
      <Icon
        name="trend-up"
        className={cn("size-3.5", !up && "rotate-180")}
        aria-hidden="true"
      />
      {up ? "+" : ""}
      {percent}%
    </span>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  const width = 128
  const height = 40
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-10 w-32 text-success"
      aria-hidden="true"
      role="img"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  )
}

export default function Dashboard({
  greetingName,
  todayLabel,
  omzet,
  performa,
  statusOrder = [],
  attention = [],
  quickActions = [],
  recentOrders = [],
  promoProducts = [],
  promoTotal = 0,
  topEngagedProducts,
}: DashboardProps) {
  const { auth } = usePage<SharedPageProps>().props
  const name = greetingName || auth.user?.name || "Admin"
  const revenueUp = omzet.change_percent >= 0

  function onPerformaPeriodChange(period: string) {
    router.get(
      routeUrl("admin.dashboard"),
      { performa_period: period },
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  return (
    <AdminLayout>
      <Head title="Dashboard | Admin" />

      <div className="space-y-2.5">
        {/* Row 1 — Greeting + Omzet | Performa Toko */}
        <section className="grid items-stretch gap-3 xl:grid-cols-2">
          <article className="flex h-full flex-col rounded-lg border border-border bg-surface p-4">
            <div>
              <p className="text-balance text-xl font-bold tracking-tight text-foreground">
                {greetingPrefix()}, {name}
              </p>
              <p className="mt-0.5 text-pretty text-xs text-muted-foreground">{todayLabel}</p>
            </div>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">Omzet Hari Ini</p>
                <p className="tabular-nums mt-1.5 text-2xl font-bold tracking-tight text-foreground">
                  {formatCurrency(omzet.revenue)}
                </p>
                <p
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 text-xs font-semibold",
                    revenueUp ? "text-success" : "text-destructive",
                  )}
                >
                  <Icon
                    name="trend-up"
                    className={cn("size-3.5", !revenueUp && "rotate-180")}
                    aria-hidden="true"
                  />
                  {revenueUp ? "+" : ""}
                  {omzet.change_percent}% dari kemarin
                </p>
              </div>
              <Sparkline values={omzet.sparkline} />
            </div>

            <div className="mt-auto grid grid-cols-2 gap-2.5 pt-4">
              <div className="rounded-md border border-border bg-surface p-2.5">
                <p className="text-[11px] text-muted-foreground">Jumlah Order</p>
                <p className="tabular-nums mt-0.5 text-base font-bold">
                  {formatNumber(omzet.orders)} Order
                </p>
                <div className="mt-1">
                  <DeltaBadge absolute={omzet.orders_delta} absoluteSuffix="Order" />
                </div>
              </div>
              <div className="rounded-md border border-border bg-surface p-2.5">
                <p className="text-[11px] text-muted-foreground">Jumlah Unit</p>
                <p className="tabular-nums mt-0.5 text-base font-bold">
                  {formatNumber(omzet.units)} Unit
                </p>
                <div className="mt-1">
                  <DeltaBadge absolute={omzet.units_delta} absoluteSuffix="Unit" />
                </div>
              </div>
            </div>
          </article>

          <article className="flex h-full flex-col rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-surface-muted text-foreground">
                  <Icon name="chart-line" className="size-3.5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-balance text-sm font-bold tracking-tight">Performa Toko</h2>
                  <p className="text-[11px] text-muted-foreground">{performa.period_label}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <OptionMenu
                  id="performa-period"
                  label="Periode performa"
                  value={performa.period}
                  options={performa.period_options}
                  onChange={onPerformaPeriodChange}
                />
                <Link
                  href={performa.detail_href}
                  className="inline-flex h-8 items-center rounded-md px-2 text-[11px] font-semibold text-primary transition hover:bg-accent"
                >
                  Detail
                </Link>
              </div>
            </div>

            <div className="mt-4 grid flex-1 grid-cols-2 gap-2.5">
              {performa.metrics.map((metric) => (
                <div
                  key={metric.key}
                  className="rounded-md border border-border bg-surface p-2.5"
                >
                  <p className="text-[10px] font-medium text-muted-foreground">{metric.label}</p>
                  <p className="tabular-nums mt-0.5 text-lg font-bold">
                    {formatMetricValue(metric)}
                  </p>
                  <div className="mt-1">
                    <DeltaBadge percent={metric.change_percent} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* Row 2 — Status Order */}
        <section>
          <h2 className="text-balance text-xs font-bold tracking-tight text-foreground">
            Status Order
          </h2>
          <div className="mt-2 grid auto-rows-fr gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {statusOrder.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex h-full min-h-[3.25rem] items-center gap-2 rounded border border-border bg-surface px-2.5 py-2 transition hover:border-foreground/20"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded bg-surface-muted text-foreground">
                  <Icon name={item.icon} className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-medium text-muted-foreground">{item.label}</p>
                  <p className="tabular-nums text-sm font-bold">
                    {formatNumber(item.total)}{" "}
                    <span className="text-[10px] font-semibold text-muted-foreground">Pesanan</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Row 3 — Perlu Perhatian | Produk paling dilihat | Aksi Cepat */}
        <section className="grid items-stretch gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_13rem]">
          <div className="min-w-0">
            <h2 className="text-balance text-xs font-bold tracking-tight text-primary">
              Perlu Perhatian
            </h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {attention.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded border bg-surface px-2.5 py-2 transition",
                    item.count > 0
                      ? "border-destructive/35 hover:border-destructive"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span className="flex min-w-0 items-start gap-2">
                    <Icon
                      name="alert-circle"
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        item.count > 0 ? "text-destructive" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <span className="text-pretty text-[11px] font-medium leading-4 text-foreground">
                      {item.label}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "tabular-nums shrink-0 text-[11px] font-bold",
                      item.count > 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {formatNumber(item.count)}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded border border-border bg-surface">
            <div className="border-b border-border px-2.5 py-2">
              <h2 className="text-balance text-xs font-bold tracking-tight">
                Produk Paling Dilihat
              </h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {topEngagedProducts?.period_label ?? performa.period_label}
              </p>
            </div>
            {topEngagedProducts?.items?.length ? (
              <ul className="divide-y divide-border">
                {topEngagedProducts.items.slice(0, 5).map((product, index) => (
                  <li key={product.id}>
                    <Link
                      href={product.href}
                      className="flex items-center gap-2 px-2.5 py-1.5 transition hover:bg-accent/40"
                    >
                      <span className="tabular-nums w-3.5 shrink-0 text-[10px] font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="size-7 shrink-0 overflow-hidden rounded border border-border bg-muted">
                        {product.image ? (
                          <img src={product.image} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Icon name="image" className="size-3" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[11px] font-semibold leading-4">{product.name}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatNumber(product.views)} lihat · {formatNumber(product.clicks)} klik
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2.5 py-3 text-[11px] text-muted-foreground">
                Belum ada data kunjungan produk.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-balance text-xs font-bold tracking-tight text-foreground">
              Aksi Cepat
            </h2>
            <nav className="mt-2 overflow-hidden rounded border border-border bg-surface" aria-label="Aksi cepat">
              <ul className="divide-y divide-border">
                {quickActions.map((action) => (
                  <li key={action.label}>
                    <Link
                      href={action.href}
                      className="flex items-center gap-2 px-2 py-1.5 transition hover:bg-muted"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-surface-muted text-foreground">
                        <Icon name={action.icon} className="size-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold leading-4">{action.label}</span>
                      </span>
                      <Icon
                        name="chevron-right"
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </section>

        {/* Row 4 — Pesanan Terbaru */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-3 py-2">
            <h2 className="text-balance text-sm font-bold tracking-tight">Pesanan Terbaru</h2>
            <Link
              href={routeUrl("admin.orders.index")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition hover:underline"
            >
              Lihat Semua Pesanan
              <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          {recentOrders.length ? (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[56rem] text-left text-xs">
                  <thead className="border-b border-border bg-surface-muted/40 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">No. Order</th>
                      <th className="px-3 py-2 font-semibold">Penerima</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Pengiriman</th>
                      <th className="px-3 py-2 font-semibold">Total Tagihan</th>
                      <th className="px-3 py-2 font-semibold">Metode</th>
                      <th className="px-3 py-2 font-semibold">Produk</th>
                      <th className="px-3 py-2 font-semibold">Status Terakhir</th>
                      <th className="px-3 py-2 font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="align-top hover:bg-accent/40">
                        <td className="px-3 py-2">
                          <Link
                            href={order.href}
                            className="font-mono text-xs font-bold hover:text-primary"
                          >
                            {order.order_number}
                          </Link>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatDateTime(order.created_at)}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-semibold">{order.customer_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {[order.shipping_city, order.shipping_province]
                              .filter(Boolean)
                              .join(", ") || "-"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {order.customer_phone || "-"}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={order.order_status} />
                        </td>
                        <td className="px-3 py-2">
                          <ShippingTrackPanel
                            compact
                            track={
                              order.shipping_track ?? {
                                shipping_status: order.shipping_status || "pending_pickup",
                                waybill_number: order.waybill_number,
                                order_status: order.order_status,
                              }
                            }
                          />
                        </td>
                        <td className="tabular-nums px-3 py-2 font-bold">
                          {formatCurrency(order.total_amount)}
                        </td>
                        <td className="px-3 py-2">
                          {order.payment_method ? (
                            <span className="inline-flex rounded-md border border-border px-2.5 py-1 text-xs font-medium">
                              {humanize(order.payment_method)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {formatNumber(order.product_count)} Produk ·{" "}
                          {formatNumber(order.unit_count)} Unit
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Icon name="clock" className="size-3.5" aria-hidden="true" />
                            {formatRelativeAge(order.updated_at)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {order.whatsapp_url ? (
                              <a
                                href={order.whatsapp_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex size-9 items-center justify-center rounded-md text-foreground transition hover:bg-muted"
                                aria-label={`WhatsApp ${order.customer_name}`}
                              >
                                <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                              </a>
                            ) : null}
                            <Link
                              href={order.href}
                              className="inline-flex size-9 items-center justify-center rounded-md text-foreground transition hover:bg-muted"
                              aria-label={`Buka ${order.order_number}`}
                            >
                              <Icon name="pencil" className="size-4" aria-hidden="true" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border lg:hidden">
                {recentOrders.map((order) => (
                  <article key={order.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={order.href}
                          className="font-mono text-xs font-bold hover:text-primary"
                        >
                          {order.order_number}
                        </Link>
                        <p className="mt-1 text-sm font-semibold">{order.customer_name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateTime(order.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={order.order_status} />
                    </div>
                    <ShippingTrackPanel
                      compact
                      track={
                        order.shipping_track ?? {
                          shipping_status: order.shipping_status || "pending_pickup",
                          waybill_number: order.waybill_number,
                          order_status: order.order_status,
                        }
                      }
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="tabular-nums font-bold">
                        {formatCurrency(order.total_amount)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Icon name="clock" className="size-3.5" aria-hidden="true" />
                        {formatRelativeAge(order.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.whatsapp_url ? (
                        <a
                          href={order.whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold"
                        >
                          <Icon name="whatsapp" className="size-3.5" aria-hidden="true" />
                          WhatsApp
                        </a>
                      ) : null}
                      <Link
                        href={order.href}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
                      >
                        Detail
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start gap-2.5 p-6">
              <p className="text-pretty text-xs text-muted-foreground">Belum ada pesanan.</p>
              <Link
                href={routeUrl("admin.orders.index")}
                className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-semibold"
              >
                Buka daftar pesanan
              </Link>
            </div>
          )}
        </section>

        {/* Opsional — di luar frame Figma, tetap fungsional */}
        <section className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-balance text-sm font-bold tracking-tight">
                Promo &amp; Flash Sale Aktif
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatNumber(promoTotal)} produk beratribut promo.
              </p>
            </div>
            <Link
              href={routeUrl("admin.banners.index")}
              className="text-xs font-semibold text-primary transition hover:underline"
            >
              Kelola banner
            </Link>
          </div>
          {promoProducts.length ? (
            <div className="divide-y divide-border">
              {promoProducts.map((product) => (
                <Link
                  key={product.id}
                  href={product.href}
                  className="grid gap-2.5 p-3 transition hover:bg-accent/55 sm:grid-cols-[8rem_1fr_auto_auto] sm:items-center"
                >
                  <p className="font-mono text-xs font-semibold">{product.parent_sku}</p>
                  <p className="line-clamp-1 text-xs">{product.name}</p>
                  <span className="flex items-center gap-1.5">
                    {product.discount_percent !== null ? (
                      <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">
                        -{product.discount_percent}%
                      </span>
                    ) : null}
                    {product.flash_sale ? (
                      <span className="text-xs font-extrabold italic uppercase text-primary">
                        Flash Sale
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {product.homepage_popular ? "Tampil di Home" : "Katalog"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="p-6 text-xs text-muted-foreground">
              Tidak ada produk dengan atribut promo aktif.
            </p>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
