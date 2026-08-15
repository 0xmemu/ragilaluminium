import { Head, Link, router, usePage } from "@inertiajs/react"
import * as React from "react"

import { OptionMenu } from "@/components/admin/option-menu"
import { SectionCard } from "@/components/admin/section-card"
import { Card } from "@/components/admin/ui/card"
import { DeltaBadge } from "@/components/admin/ui/delta-badge"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber } from "@/lib/format"
import { routeUrl, withQuery } from "@/lib/routes"
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

interface PerformaTrend {
  total: number
  total_format: string
  granularity: string
  series: Array<{ bucket: string; label: string; value: number }>
}

interface PerformaData {
  period: string
  period_label: string
  period_options: Array<{ value: string; label: string }>
  metrics: PerformaMetric[]
  trend: PerformaTrend
  detail_href: string
}

interface FinancialData {
  pending_payment_amount: number
  pending_payment_orders: number
  active_order_amount: number
  active_order_count: number
  received_today_amount: number
  received_today_count: number
}

interface StatusOrderItem {
  key: string
  label: string
  icon: string
  total: number
  total_value: number
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
  payment_status: string
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
  shipping_href: string
  whatsapp_url?: string | null
}




interface MediaStatusSummary {
  ready: number
  pending: number
  failed: number
  archived: number
}

interface ImportMediaSummary {
  imports: {
    running: number
    failed: number
    completed: number
    failed_rows: number
    recent: Array<{
      id: number
      file_name: string
      status: string
      failed_rows: number
      updated_at: string | null
      href: string
    }>
    href: string
  }
  media: {
    attachments: MediaStatusSummary
    shared_assets: MediaStatusSummary
    href: string
  }
}

interface DashboardProps {
  greetingName: string
  todayLabel: string
  generatedAt: string
  importMediaSummary: ImportMediaSummary
  omzet: OmzetData
  financial: FinancialData
  performa: PerformaData
  statusOrder: StatusOrderItem[]
  attention: AttentionItem[]
  quickActions: QuickAction[]
  recentOrders: RecentOrderRow[]
  productCount: number
}

function greetingPrefix(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 11) return "Selamat pagi"
  if (hour < 15) return "Selamat siang"
  if (hour < 18) return "Selamat sore"
  return "Selamat malam"
}

function formatRelativeAge(iso: string | null | undefined): string {
  if (!iso) return "-"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "-"
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${Math.max(minutes, 0)} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
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

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  const width = 160
  const height = 48
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * (height - 6) - 3
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-12 w-40 text-primary"
      aria-hidden="true"
      role="img"
    >
      <polygon points={`0,${height} ${points} ${width},${height}`} className="fill-primary/10" stroke="none" />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  )
}

function TrendBars({ trend }: { trend: PerformaTrend }) {
  const max = Math.max(...trend.series.map((point) => point.value), 1)

  return (
    <div className="mt-3 flex h-16 items-end gap-1" role="img" aria-label="Tren omzet sesuai periode aktif">
      {trend.series.map((point) => (
        <div key={point.bucket} className="flex min-w-0 flex-1 items-end" title={`${point.label}: ${formatCurrency(point.value)}`}>
          <div
            className="w-full rounded-sm bg-primary/70"
            style={{ height: `${Math.max(4, (point.value / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  )
}

function MetricTile({
  label,
  value,
  delta,
}: {
  label: string
  value: React.ReactNode
  delta?: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="tabular-nums mt-1 text-xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {delta ? <div className="mt-1">{delta}</div> : null}
    </div>
  )
}

function DensityChip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <p className="tabular-nums text-lg font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{label}</p>
    </div>
  )
}

export default function Dashboard({
  greetingName,
  todayLabel,
  generatedAt,
  importMediaSummary,
  omzet,
  financial,
  performa,
  statusOrder = [],
  attention = [],
  quickActions = [],
  recentOrders = [],
  productCount = 0,
}: DashboardProps) {
  const { auth } = usePage<SharedPageProps>().props
  const [refreshing, setRefreshing] = React.useState(false)
  const [refreshError, setRefreshError] = React.useState(false)
  const name = greetingName || auth.user?.name || "Admin"
  const pendingPaymentOrders = statusOrder.find((item) => item.key === "pending_payment")
  const pendingPaymentOrdersHref =
    pendingPaymentOrders?.href ??
    withQuery(routeUrl("admin.orders.index"), { order_status: "pending_payment" })
  const hasOrders =
    statusOrder.reduce((sum, item) => sum + item.total, 0) > 0 || omzet.orders > 0
  const visitorsMetric = performa.metrics.find((metric) => metric.key === "visitors")
  const onboardingActions = quickActions.filter((action) => action.label !== "Lihat Pending Payment")

  function onPerformaPeriodChange(period: string) {
    router.get(
      routeUrl("admin.dashboard"),
      { performa_period: period },
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  function refreshDashboard() {
    setRefreshing(true)
    setRefreshError(false)
    router.reload({
      onError: () => setRefreshError(true),
      onFinish: () => setRefreshing(false),
    })
  }

  return (
    <AdminLayout>
      <Head title="Dashboard | Admin" />
      <h1 className="sr-only">Dashboard</h1>

      <div className="space-y-4 pt-4">
        {/* Header — sapaan */}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">
                {greetingPrefix()},{" "}
                <span className="font-normal text-muted-foreground">{name}</span>
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">{todayLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                {refreshing ? "Memperbarui data dashboard..." : `Data diperbarui ${formatDateTime(generatedAt)}`}
              </p>
              {refreshError ? (
                <p className="mt-1 text-xs font-medium text-destructive" role="status">
                  Data belum diperbarui. Coba refresh lagi.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={refreshDashboard}
              disabled={refreshing}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
            >
              <Icon name="refresh" className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
              {refreshing ? "Memuat..." : "Refresh data"}
            </button>
          </div>
        </div>

        {/* Antrean kerja utama — order selalu didahulukan dari alert pendukung */}
        <section className="grid gap-4">
          <SectionCard
            title="Antrean tindakan hari ini"
            icon="alert-circle"
            description="Prioritas order yang perlu segera diproses admin."
            className="lg:col-span-12"
            contentClassName="p-0"
          >
            {attention.length ? (
              <ul className="divide-y divide-border">
                {attention.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-muted/60"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-destructive" />
                        <span className="text-pretty text-[13px] leading-5 text-foreground">
                          {item.label}
                        </span>
                      </span>
                      <span className="tabular-nums shrink-0 text-sm font-semibold text-destructive">
                        {formatNumber(item.count)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 px-5 py-6">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Icon name="check-circle" className="size-4" aria-hidden="true" />
                </span>
                <p className="text-[13px] text-muted-foreground">Tidak ada pekerjaan yang perlu ditindaklanjuti.</p>
              </div>
            )}
          </SectionCard>
        </section>

        {/* Row 1 — Omzet | Performa Toko */}
        <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          {hasOrders ? (
            <Card className="flex h-full flex-col">
              <div className="flex flex-wrap items-start justify-between gap-4 p-4 pb-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Omzet hari ini
                  </p>
                  <p className="tabular-nums mt-2 text-4xl font-bold tracking-tight text-foreground">
                    {formatCurrency(omzet.revenue)}
                  </p>
                  <div className="mt-2">
                    <DeltaBadge percent={omzet.change_percent} />
                  </div>
                  {(pendingPaymentOrders?.total ?? 0) > 0 ? (
                    <div className="mt-4 rounded-md border border-info/20 bg-info/5 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <Icon name="info" className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">Belum masuk omzet</p>
                          <p>
                            Order Perlu Konfirmasi, batal, atau bermasalah belum dihitung. Omzet hanya
                            memakai order yang sudah masuk proses fulfillment.
                          </p>
                          <Link
                            href={pendingPaymentOrdersHref}
                            className="mt-1 inline-flex items-center gap-1 font-semibold text-info underline underline-offset-2 hover:no-underline"
                          >
                            Lihat {formatNumber(pendingPaymentOrders?.total ?? 0)} order Perlu Konfirmasi
                            <Icon name="arrow-right" className="size-3" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <Sparkline values={omzet.sparkline} />
              </div>
              <div className="mt-auto grid divide-x divide-border border-t border-border sm:grid-cols-2 xl:grid-cols-4">
                <div className="px-4 py-3">
                  <MetricTile
                    label="Order masuk"
                    value={`${formatNumber(omzet.orders)} order`}
                    delta={<DeltaBadge absolute={omzet.orders_delta} absoluteSuffix="order" />}
                  />
                </div>
                <div className="px-4 py-3">
                  <MetricTile
                    label="Jumlah unit"
                    value={`${formatNumber(omzet.units)} unit`}
                    delta={<DeltaBadge absolute={omzet.units_delta} absoluteSuffix="unit" />}
                  />
                </div>
                <div className="px-4 py-3">
                  <MetricTile
                    label="Belum dibayar"
                    value={formatCurrency(financial.pending_payment_amount)}
                    delta={`${formatNumber(financial.pending_payment_orders)} order pending`}
                  />
                </div>
                <div className="px-4 py-3">
                  <MetricTile
                    label="Diterima hari ini"
                    value={formatCurrency(financial.received_today_amount)}
                    delta={`${formatNumber(financial.received_today_count)} pembayaran`}
                  />
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex h-full flex-col p-6">
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Mulai berjualan
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                    Toko belum memiliki pesanan
                  </h2>
                  <p className="mt-1.5 max-w-lg text-[13px] leading-5 text-muted-foreground">
                    Semua siap dipakai. Lengkapi katalog agar order pertama bisa masuk dan diproses lancar.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <DensityChip label="Produk aktif" value={formatNumber(productCount)} />
                    <DensityChip
                      label="Media siap"
                      value={formatNumber(importMediaSummary.media.attachments.ready)}
                    />
                    <DensityChip
                      label="Import selesai"
                      value={formatNumber(importMediaSummary.imports.completed)}
                    />
                    <DensityChip label="Pengunjung" value={formatNumber(visitorsMetric?.value ?? 0)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {onboardingActions.map((action) => (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover"
                    >
                      <Icon name={action.icon} className="size-4" aria-hidden="true" />
                      {action.label}
                    </Link>
                  ))}
                  <Link
                    href={routeUrl("admin.products.index")}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3.5 text-xs font-semibold text-foreground transition hover:bg-muted"
                  >
                    Buka katalog
                  </Link>
                </div>
              </div>
            </Card>
          )}

          <Card className="flex h-full flex-col p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Performa toko
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{performa.period_label}</p>
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
                  className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-primary transition hover:bg-secondary"
                >
                  Detail
                </Link>
              </div>
            </div>
            <div className="mt-4 grid flex-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              {performa.metrics.map((metric) => (
                <MetricTile
                  key={metric.key}
                  label={metric.label}
                  value={formatMetricValue(metric)}
                  delta={<DeltaBadge percent={metric.change_percent} />}
                />
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Tren omzet</p>
                <p className="tabular-nums text-xs font-semibold text-foreground">
                  {formatCurrency(performa.trend.total)}
                </p>
              </div>
              <TrendBars trend={performa.trend} />
            </div>
          </Card>
        </section>

        {hasOrders ? (
          <>
        {/* Row 2 — Status Order */}
        <SectionCard
          title="Status order"
          icon="clipboard-list"
          description="Ringkasan antrean pesanan berdasarkan tahap operasional."
          action={
            <Link
              href={routeUrl("admin.orders.index")}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:underline"
            >
              Semua pesanan
              <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {statusOrder.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-muted"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition group-hover:bg-accent group-hover:text-accent-foreground">
                  <Icon name={item.icon} className="size-4" aria-hidden="true" />
                </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-muted-foreground">{item.label}</span>
                    <span className="tabular-nums block text-lg font-semibold tracking-tight text-foreground">
                      {formatNumber(item.total)}{" "}
                      <span className="text-[11px] font-normal text-muted-foreground">pesanan</span>
                    </span>
                    <span className="tabular-nums block text-[11px] text-muted-foreground">
                      {formatCurrency(item.total_value)}
                    </span>
                  </span>
              </Link>
            ))}
          </div>
        </SectionCard>
          </>
        ) : null}


        {/* Pesanan terbaru — ringkasan dengan tautan detail */}
        <SectionCard
          title="Pesanan terbaru"
          description="Order terakhir yang masuk untuk tindak lanjut cepat."
          action={
            <Link
              href={routeUrl("admin.orders.index")}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:underline"
            >
              Lihat semua
              <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
            </Link>
          }
          contentClassName="p-0"
        >
          {recentOrders.length ? (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table className="min-w-[44rem]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>No. order</TableHead>
                      <TableHead>Penerima</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Diperbarui</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Link
                            href={order.href}
                            className="font-mono text-xs font-semibold text-foreground hover:text-primary"
                          >
                            {order.order_number}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDateTime(order.created_at)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {order.customer_phone || "-"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={order.order_status} />
                        </TableCell>
                        <TableCell className="tabular-nums font-semibold">
                          {formatCurrency(order.total_amount)}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Icon name="clock" className="size-3.5" aria-hidden="true" />
                            {formatRelativeAge(order.updated_at)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-0.5">
                            {order.whatsapp_url ? (
                              <a
                                href={order.whatsapp_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                aria-label={`WhatsApp ${order.customer_name}`}
                              >
                                <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                              </a>
                            ) : null}
                            <Link
                              href={order.href}
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                              aria-label={`Buka ${order.order_number}`}
                            >
                              <Icon name="arrow-right" className="size-4" aria-hidden="true" />
                            </Link>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-border lg:hidden">
                {recentOrders.map((order) => (
                  <article key={order.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={order.href}
                          className="font-mono text-xs font-semibold hover:text-primary"
                        >
                          {order.order_number}
                        </Link>
                        <p className="mt-1 text-sm font-medium">{order.customer_name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{order.customer_phone || "-"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateTime(order.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={order.order_status} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="tabular-nums text-sm font-semibold">
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
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium transition hover:bg-muted"
                        >
                          <Icon name="whatsapp" className="size-3.5" aria-hidden="true" />
                          WhatsApp
                        </a>
                      ) : null}
                      <Link
                        href={order.href}
                        className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary-hover"
                      >
                        Detail
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Belum ada pesanan</p>
                <p className="mt-1 max-w-lg text-[13px] leading-5 text-muted-foreground">
                  Order pertama akan tampil di sini. Lengkapi katalog dan buka daftar pesanan untuk memantau order masuk.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={routeUrl("admin.products.index")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium transition hover:bg-muted"
                >
                  <Icon name="package" className="size-3.5" aria-hidden="true" />
                  Buka katalog
                </Link>
                <Link
                  href={routeUrl("admin.imports.index")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium transition hover:bg-muted"
                >
                  <Icon name="upload" className="size-3.5" aria-hidden="true" />
                  Cek import
                </Link>
                <Link
                  href={routeUrl("admin.orders.index")}
                  className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary-hover"
                >
                  Buka daftar pesanan
                </Link>
              </div>
            </div>
          )}
        </SectionCard>

      </div>
    </AdminLayout>
  )
}
