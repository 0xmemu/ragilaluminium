import { Head, Link, router, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
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
          className={cn("h-3.5 w-3.5", !up && "rotate-180")}
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
        className={cn("h-3.5 w-3.5", !up && "rotate-180")}
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
  const width = 160
  const height = 48
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
      className="h-12 w-40 text-success"
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
}: DashboardProps) {
  const { auth } = usePage<SharedPageProps>().props
  const name = greetingName || auth.user?.name || "Admin"
  const attentionTotal = attention.reduce((sum, item) => sum + item.count, 0)
  const revenueUp = omzet.change_percent >= 0

  function onPerformaPeriodChange(event: React.ChangeEvent<HTMLSelectElement>) {
    router.get(
      routeUrl("admin.dashboard"),
      { performa_period: event.target.value },
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  return (
    <AdminLayout title="Dashboard Admin Ragil Aluminium" description={null}>
      <Head title="Dashboard | Admin" />

      <section className="grid items-stretch gap-4 xl:grid-cols-2">
        <article className="flex h-full flex-col rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {greetingPrefix()}, {name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{todayLabel}</p>
          </div>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Omset Hari Ini</p>
              <p className="tabular-nums mt-2 text-3xl font-bold tracking-tight text-foreground">
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
                  className={cn("h-3.5 w-3.5", !revenueUp && "rotate-180")}
                  aria-hidden="true"
                />
                {revenueUp ? "+" : ""}
                {omzet.change_percent}% dari kemarin
              </p>
            </div>
            <Sparkline values={omzet.sparkline} />
          </div>

          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div className="rounded-md bg-surface-muted p-3">
              <p className="text-xs text-muted-foreground">Jumlah Order</p>
              <p className="tabular-nums mt-1 text-lg font-bold">
                {formatNumber(omzet.orders)} Order
              </p>
              <div className="mt-1">
                <DeltaBadge absolute={omzet.orders_delta} absoluteSuffix="Order" />
              </div>
            </div>
            <div className="rounded-md bg-surface-muted p-3">
              <p className="text-xs text-muted-foreground">Jumlah Unit</p>
              <p className="tabular-nums mt-1 text-lg font-bold">
                {formatNumber(omzet.units)} Unit
              </p>
              <div className="mt-1">
                <DeltaBadge absolute={omzet.units_delta} absoluteSuffix="Unit" />
              </div>
            </div>
          </div>
        </article>

        <article className="flex h-full flex-col rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight">Performa Toko</h2>
              <p className="mt-1 text-xs text-muted-foreground">{performa.period_label}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="performa-period">
                Periode performa
              </label>
              <select
                id="performa-period"
                value={performa.period}
                onChange={onPerformaPeriodChange}
                className="h-9 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground"
              >
                {performa.period_options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Link
                href={performa.detail_href}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Detail
              </Link>
            </div>
          </div>

          <div className="mt-5 grid flex-1 grid-cols-2 gap-3">
            {performa.metrics.map((metric) => (
              <div key={metric.key} className="rounded-md bg-surface-muted p-3">
                <p className="text-[11px] font-medium text-muted-foreground">{metric.label}</p>
                <p className="tabular-nums mt-1 text-xl font-bold">
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

      <section className="mt-6">
        <h2 className="text-sm font-bold tracking-tight text-foreground">Status Order</h2>
        <div className="mt-3 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {statusOrder.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex h-full min-h-[4.75rem] items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm transition hover:border-foreground/20 hover:shadow-md"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                <Icon name={item.icon} className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="tabular-nums text-xl font-bold">
                  {formatNumber(item.total)}{" "}
                  <span className="text-sm font-semibold text-muted-foreground">Pesanan</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 grid items-stretch gap-4 lg:grid-cols-2">
        <article className="flex h-full flex-col rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight">Perlu Perhatian</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {attentionTotal > 0
                  ? `${formatNumber(attentionTotal)} item perlu ditindaklanjuti`
                  : "Tidak ada antrean aging aktif"}
              </p>
            </div>
            {attentionTotal > 0 ? (
              <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
                {formatNumber(attentionTotal)}
              </span>
            ) : null}
          </div>
          <ul className="mt-4 grid gap-2">
            {attention.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border px-3 py-3 text-sm transition",
                    item.count > 0
                      ? "border-destructive/40 bg-destructive/5 hover:border-destructive"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 leading-5">
                    <Icon
                      name="alert-circle"
                      className={cn(
                        "size-4 shrink-0",
                        item.count > 0 ? "text-destructive" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums shrink-0 rounded-md px-2 py-0.5 text-xs font-bold",
                      item.count > 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {formatNumber(item.count)} Pesanan
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </article>

        <article className="flex h-full flex-col rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-bold tracking-tight">Aksi Cepat</h2>
          <p className="mt-1 text-xs text-muted-foreground">Pintasan pembuatan & monitoring.</p>
          <div className="mt-4 grid flex-1 content-start gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 rounded-md border border-border bg-surface-muted/60 p-3 transition hover:bg-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface text-primary">
                  <Icon name={action.icon} className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{action.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {action.description}
                  </span>
                </span>
                <Icon name="arrow-right" className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="text-base font-bold tracking-tight">Pesanan Terbaru</h2>
            <p className="mt-1 text-xs text-muted-foreground">Delapan pesanan terakhir dari seluruh status.</p>
          </div>
          <Link href={routeUrl("admin.orders.index")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Lihat Semua Pesanan
            <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recentOrders.length ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="border-b border-border bg-surface-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">No. Order</th>
                    <th className="px-4 py-3 font-semibold">Penerima</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Total Tagihan</th>
                    <th className="px-4 py-3 font-semibold">Metode</th>
                    <th className="px-4 py-3 font-semibold">Produk</th>
                    <th className="px-4 py-3 font-semibold">Status Terakhir</th>
                    <th className="px-4 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="align-top hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <Link href={order.href} className="font-mono text-xs font-bold hover:text-primary">
                          {order.order_number}
                        </Link>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatDateTime(order.created_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{order.customer_name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[order.shipping_city, order.shipping_province].filter(Boolean).join(", ") ||
                            "-"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{order.customer_phone || "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.order_status} />
                      </td>
                      <td className="tabular-nums px-4 py-3 font-bold">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        {order.payment_method ? (
                          <span className="inline-flex rounded-full border border-border px-2.5 py-1 text-xs font-medium">
                            {humanize(order.payment_method)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatNumber(order.product_count)} Produk · {formatNumber(order.unit_count)} Unit
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                        {formatRelativeAge(order.updated_at)}
                      </td>
                      <td className="px-4 py-3">
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
                      <Link href={order.href} className="font-mono text-xs font-bold hover:text-primary">
                        {order.order_number}
                      </Link>
                      <p className="mt-1 text-sm font-semibold">{order.customer_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(order.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={order.order_status} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="tabular-nums font-bold">{formatCurrency(order.total_amount)}</span>
                    <span className="text-muted-foreground">
                      {formatNumber(order.product_count)} produk · {formatNumber(order.unit_count)} unit
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
          <p className="p-8 text-sm text-muted-foreground">Belum ada pesanan.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-base font-bold tracking-tight">Promo &amp; Flash Sale Aktif</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Nilai plus di luar Figma: {formatNumber(promoTotal)} produk beratribut promo.
            </p>
          </div>
          <Link href={routeUrl("admin.banners.index")} className="text-xs font-semibold text-primary">
            Kelola banner
          </Link>
        </div>
        {promoProducts.length ? (
          <div className="divide-y divide-border">
            {promoProducts.map((product) => (
              <Link
                key={product.id}
                href={product.href}
                className="grid gap-3 p-4 transition hover:bg-accent/55 sm:grid-cols-[10rem_1fr_auto_auto] sm:items-center"
              >
                <p className="font-mono text-xs font-semibold">{product.parent_sku}</p>
                <p className="line-clamp-1 text-sm">{product.name}</p>
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
          <p className="p-8 text-sm text-muted-foreground">
            Tidak ada produk dengan atribut promo aktif.
          </p>
        )}
      </section>
    </AdminLayout>
  )
}
