import { Head, Link, router, usePage } from "@inertiajs/react"
import * as React from "react"

import { OptionMenu } from "@/components/admin/option-menu"
import { SectionCard } from "@/components/admin/section-card"
import { Alert } from "@/components/admin/ui/alert"
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
import { ShippingTrackPanel } from "@/components/shared/shipping-track-panel"
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

interface JntReadiness {
  provider_label: string
  environment: string
  enabled_flag: boolean
  client_ready: boolean
  missing: string[]
}

interface DashboardProps {
  greetingName: string
  todayLabel: string
  jntReadiness: JntReadiness
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

export default function Dashboard({
  greetingName,
  todayLabel,
  jntReadiness,
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
      <h1 className="sr-only">Dashboard</h1>

      <div className="space-y-5">
        {/* Header — sapaan */}
        <div className="pt-2">
          <p className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">
            {greetingPrefix()},{" "}
            <span className="font-normal text-muted-foreground">{name}</span>
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">{todayLabel}</p>
        </div>

        {/* Row 1 — Omzet | Performa Toko */}
        <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="flex h-full flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4 p-5 pb-4">
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
              </div>
              <Sparkline values={omzet.sparkline} />
            </div>
            <div className="mt-auto grid grid-cols-2 divide-x divide-border border-t border-border">
              <div className="px-5 py-4">
                <MetricTile
                  label="Jumlah order"
                  value={`${formatNumber(omzet.orders)} order`}
                  delta={<DeltaBadge absolute={omzet.orders_delta} absoluteSuffix="order" />}
                />
              </div>
              <div className="px-5 py-4">
                <MetricTile
                  label="Jumlah unit"
                  value={`${formatNumber(omzet.units)} unit`}
                  delta={<DeltaBadge absolute={omzet.units_delta} absoluteSuffix="unit" />}
                />
              </div>
            </div>
          </Card>

          <Card className="flex h-full flex-col p-5">
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
            <div className="mt-5 grid flex-1 grid-cols-2 gap-x-4 gap-y-5">
              {performa.metrics.map((metric) => (
                <MetricTile
                  key={metric.key}
                  label={metric.label}
                  value={formatMetricValue(metric)}
                  delta={<DeltaBadge percent={metric.change_percent} />}
                />
              ))}
            </div>
          </Card>
        </section>

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
                </span>
              </Link>
            ))}
          </div>
        </SectionCard>

        {/* Row 2b — Kesiapan J&T */}
        <Alert
          tone={jntReadiness.client_ready ? "success" : "warning"}
          title={jntReadiness.provider_label}
          className="items-center"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px]">
              {jntReadiness.client_ready
                ? `Terhubung · ${jntReadiness.environment}`
                : `Belum siap · ${jntReadiness.missing.length} konfigurasi perlu dilengkapi`}
            </p>
            <Link
              href={routeUrl("admin.settings.index")}
              className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
            >
              Periksa konfigurasi
            </Link>
          </div>
          {!jntReadiness.client_ready && jntReadiness.missing.length ? (
            <p className="mt-2 rounded-md bg-current/5 px-3 py-2 font-mono text-[11px] leading-5 opacity-80">
              {jntReadiness.missing.join(", ")}
            </p>
          ) : null}
        </Alert>

        {/* Row 3 — Perlu Perhatian | Produk Paling Dilihat | Aksi Cepat */}
        <section className="grid items-stretch gap-4 lg:grid-cols-12">
          <SectionCard
            title="Perlu perhatian"
            icon="alert-circle"
            description="Item yang membutuhkan tindak lanjut."
            className="lg:col-span-5"
            contentClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-muted/60"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          item.count > 0 ? "bg-destructive" : "bg-muted-foreground/40",
                        )}
                      />
                      <span className="text-pretty text-[13px] leading-5 text-foreground">
                        {item.label}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "tabular-nums shrink-0 text-sm font-semibold",
                        item.count > 0 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {formatNumber(item.count)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Produk paling dilihat"
            icon="eye"
            description={topEngagedProducts?.period_label ?? performa.period_label}
            className="lg:col-span-4"
            contentClassName="p-0"
          >
            {topEngagedProducts?.items?.length ? (
              <ul className="divide-y divide-border">
                {topEngagedProducts.items.slice(0, 5).map((product, index) => (
                  <li key={product.id}>
                    <Link
                      href={product.href}
                      className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-muted/60"
                    >
                      <span className="tabular-nums w-4 shrink-0 text-center text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="size-8 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        {product.image ? (
                          <img src={product.image} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-muted-foreground">
                            <Icon name="image" className="size-3.5" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {product.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatNumber(product.views)} dilihat
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-muted-foreground">
                Belum ada data kunjungan produk.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Aksi cepat"
            icon="lightning"
            description="Jalan pintas ke pekerjaan rutin."
            className="lg:col-span-3"
            contentClassName="p-0"
          >
            <nav aria-label="Aksi cepat">
              <ul className="divide-y divide-border">
                {quickActions.map((action) => (
                  <li key={action.label}>
                    <Link
                      href={action.href}
                      className="group flex items-center gap-3 px-5 py-3 transition hover:bg-muted/60"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition group-hover:bg-accent group-hover:text-accent-foreground">
                        <Icon name={action.icon} className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                        {action.label}
                      </span>
                      <Icon
                        name="chevron-right"
                        className="size-3.5 shrink-0 text-muted-foreground/60 transition group-hover:text-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </SectionCard>
        </section>

        {/* Row 4 — Pesanan Terbaru */}
        <SectionCard
          title="Pesanan terbaru"
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
                <Table className="min-w-[56rem]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>No. order</TableHead>
                      <TableHead>Penerima</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pengiriman</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Metode</TableHead>
                      <TableHead>Produk</TableHead>
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
                        <TableCell>
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
                        </TableCell>
                        <TableCell className="tabular-nums font-semibold">
                          {formatCurrency(order.total_amount)}
                        </TableCell>
                        <TableCell>
                          {order.payment_method ? (
                            <span className="inline-flex rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {humanize(order.payment_method)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatNumber(order.product_count)} produk ·{" "}
                          {formatNumber(order.unit_count)} unit
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
            <div className="flex flex-col items-start gap-3 p-6">
              <p className="text-[13px] text-muted-foreground">Belum ada pesanan.</p>
              <Link
                href={routeUrl("admin.orders.index")}
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium transition hover:bg-muted"
              >
                Buka daftar pesanan
              </Link>
            </div>
          )}
        </SectionCard>

        {/* Row 5 — Promo & Flash Sale Aktif */}
        <SectionCard
          title="Promo & flash sale aktif"
          description={`${formatNumber(promoTotal)} produk beratribut promo.`}
          action={
            <Link
              href={routeUrl("admin.banners.index")}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:underline"
            >
              Kelola banner
            </Link>
          }
          contentClassName="p-0"
        >
          {promoProducts.length ? (
            <ul className="divide-y divide-border">
              {promoProducts.map((product) => (
                <li key={product.id}>
                  <Link
                    href={product.href}
                    className="grid gap-2 px-5 py-3 transition hover:bg-muted/60 sm:grid-cols-[8rem_1fr_auto_auto] sm:items-center"
                  >
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {product.parent_sku}
                    </span>
                    <span className="line-clamp-1 text-[13px] text-foreground">{product.name}</span>
                    <span className="flex items-center gap-1.5">
                      {product.discount_percent !== null ? (
                        <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                          -{product.discount_percent}%
                        </span>
                      ) : null}
                      {product.flash_sale ? (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                          Flash sale
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {product.homepage_popular ? "Tampil di home" : "Katalog"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-[13px] text-muted-foreground">
              Tidak ada produk dengan atribut promo aktif.
            </p>
          )}
        </SectionCard>
      </div>
    </AdminLayout>
  )
}

