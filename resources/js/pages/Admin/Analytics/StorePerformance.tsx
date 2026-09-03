import { Head, router } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/admin/ui/tooltip"


interface Kpi {
  key: string
  label: string
  value: number
  previous: number
  change_percent: number | null
  format: "currency" | "number" | "percent" | "hours" | "days"
  detail?: string | null
}

// KPI yg SEMAKIN NAIK justru BURUK (retur, antrean, waktu) -> warna delta dibalik.
const GOOD_WHEN_DOWN = new Set([
  "open_orders",
  "returns",
  "return_value",
  "avg_confirm_hours",
  "avg_process_days",
  // Task 1-2: KPI backlog/cost/pending yang naik = buruk.
  "returns_created",
  "returns_open",
  "returns_completed",
  "refund_given",
  "return_rate_created",
  "return_rate_completed",
  "payment_pending_count",
  "cancelled_orders",
  "cancelled_by_customer",
  "cancelled_by_store",
  "cancellation_rate",
]);

// true = kenaikan perlu tampil merah, penurunan hijau
function invertColorFor(key: string, changePercent: number | null): boolean {
  if (changePercent === null || changePercent === 0) return false
  return GOOD_WHEN_DOWN.has(key)
}

// KPI-005/009: minus unicode & panah konsisten.
const MINUS = "−"
// KPI-014a: metrik yang arahnya netral/kontekstual (bukan lebih-besar/lebih-kecil baik).
const NEUTRAL_DIRECTION = new Set(["avg_unit_price"])


interface Section {
  key: string
  title: string
  kpis: Kpi[]
}

interface SeriesPoint {
  bucket: string
  label: string
  value: number
}

interface ChartBlock {
  key: string
  title: string
  total: number
  total_format: "currency" | "number"
  series: SeriesPoint[]
}

interface Report {
  range: {
    period: string
    label: string
    from_date: string
    to_date: string
    granularity: string
    compare_label: string
    compare_from_date: string
    compare_to_date: string
    is_running: boolean
  }
  generated_at: string
  financial: {
    gross_revenue: number
    refund_adjustments: number
    net_revenue: number
    definition: string
  }
  sections: Section[]
  charts: ChartBlock[]
  top_products: Array<{
    parent_sku: string
    name: string
    units: number
    revenue: number
    order_count: number
  }>
  customers: Array<{
    customer_name: string
    customer_phone: string
    order_count: number
    total_spent: number
    last_order_at: string | null
  }>
  payment_mix: Array<{ method: string; count: number; revenue: number }>
  product_breakdowns: {
    most_viewed: Array<{ product_id: number; parent_sku: string; name: string; image: string | null; views: number; clicks: number; total: number }>
    most_clicked: Array<{ product_id: number; parent_sku: string; name: string; image: string | null; views: number; clicks: number; total: number }>
    best_sellers: Array<{ product_id: number; parent_sku: string; name: string; units: number; revenue: number; order_count: number }>
  }
}

function formatKpiValue(kpi: Kpi): string {
  switch (kpi.format) {
    case "currency":
      return formatCurrency(kpi.value)
    case "percent":
      return `${formatNumber(kpi.value)}%`
    case "hours":
      return formatDuration(kpi.value, false)
    case "days":
      return formatDuration(kpi.value, true)
    default:
      return formatNumber(kpi.value)
  }
}

function formatPrevious(kpi: Kpi): string {
  switch (kpi.format) {
    case "currency":
      return formatCurrency(kpi.previous)
    case "percent":
      return `${formatNumber(kpi.previous)}%`
    case "hours":
      return formatDuration(kpi.previous, false)
    case "days":
      return formatDuration(kpi.previous, true)
    default:
      return formatNumber(kpi.previous)
  }
}
// P2-3: privacy - nomor WA customer ditampilkan sebagian (6285••••1617).
function maskPhone(phone: string): string {
  if (!phone) return "-"
  const visible = phone.slice(-4)
  const head = phone.slice(0, 4)
  return `${head}${"•".repeat(Math.max(phone.length - 8, 2))}${visible}`
}

// P0-2: freshness "Data diperbarui ..." - format ISO ke "2 Sep 2026, 22:01 WIB".
function formatGeneratedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "-"
  const t = d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  return t.replace(".", ":") + " WIB"
}

// KPI-005: durasi -> "X jam Y menit". days=true ditampilkan "X hari Y jam".
function formatDuration(value: number, isDays = false): string {
  if (!Number.isFinite(value) || value <= 0) return "0 menit"
  const base = isDays ? value * 24 : value // konversi hari->jam
  const totalMinutes = Math.round(base * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const jam = hours.toString() + " jam"
  const menit = minutes.toString() + " menit"
  if (isDays) {
    return minutes === 0 ? jam : jam + " " + menit
  }
  if (hours === 0) return menit
  return minutes === 0 ? jam : jam + " " + menit
}


const TrendChart = React.lazy(() => import("@/components/admin/charts/trend-chart"))
type ProductBreakdown = {
  product_id: number
  parent_sku: string
  name: string
  image?: string | null
  units?: number
  revenue?: number
  order_count?: number
  views?: number
  clicks?: number
  total?: number
}

type ProductBreakdownGridProps = {
  breakdowns: {
    most_viewed: ProductBreakdown[]
    most_clicked: ProductBreakdown[]
    best_sellers: ProductBreakdown[]
  }
}

function ProductBreakdownGrid({ breakdowns }: ProductBreakdownGridProps) {
  const [tab, setTab] = React.useState<"top_sales" | "viewed" | "clicked" | "sellers">("top_sales")

  const tabs = [
    { key: "top_sales" as const, label: "Produk Terpopuler" },
    { key: "viewed" as const, label: "Paling Dilihat" },
    { key: "clicked" as const, label: "Paling Diklik" },
    { key: "sellers" as const, label: "Terlaris" },
  ]

  const data =
    tab === "viewed"
      ? breakdowns.most_viewed
      : tab === "clicked"
        ? breakdowns.most_clicked
        : tab === "sellers"
          ? breakdowns.best_sellers
          : []

  const empty =
    tab === "viewed" || tab === "clicked" || tab === "sellers"
      ? data.length === 0
      : true // top_sales diwakili table top_products existing; kosongkan bukan error

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold">Produk Berdasarkan Interaksi</h3>
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold",
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "viewed" || tab === "clicked" ? (
        <EngagementList rows={data} />
      ) : tab === "sellers" ? (
        <SellersList rows={data} />
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Produk Terpopuler (views + clicks) ditampilkan pada tabel "Penjualan produk" di atas, yaitu produk dengan
          omzet & unit tertinggi dari pesanan fulfillment. Untuk ranking murni berdasarkan views/clicks, gunakan tab
          Paling Dilihat / Paling Diklik.
        </p>
      )}
      {empty && tab !== "top_sales" ? (
        <EmptyState className="min-h-24 border-0 bg-transparent" title="Belum ada data" description="Belum ada data interaksi produk pada periode ini." />
      ) : null}
    </section>
  )
}

function EngagementList({ rows }: { rows: ProductBreakdown[] }) {
  if (!rows.length) return null
  return (
    <div className="mt-4 divide-y divide-border">
      {rows.map((p) => (
        <article key={p.product_id} className="flex items-center gap-3 py-3">
          {p.image ? (
            <img src={p.image} alt={p.name} className="h-10 w-10 rounded-md object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
              {p.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.name}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{p.parent_sku}</p>
          </div>
          <div className="text-right text-sm tabular-nums">
            <p className="font-semibold">{formatNumber(p.views ?? 0)} dilihat</p>
            <p className="text-xs text-muted-foreground">{formatNumber(p.clicks ?? 0)} klik</p>
          </div>
        </article>
      ))}
    </div>
  )
}

function SellersList({ rows }: { rows: ProductBreakdown[] }) {
  if (!rows.length) return null
  return (
    <div className="mt-4 divide-y divide-border">
      {rows.map((p) => (
        <article key={p.product_id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.name}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{p.parent_sku}</p>
          </div>
          <div className="text-right text-sm tabular-nums">
            <p className="font-semibold">{formatNumber(p.units ?? 0)} unit</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(p.revenue ?? 0)}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

export default function StorePerformance({
  title,
  description,
  filters,
  periodOptions,
  granularityOptions,
  report,
  exportUrl,
}: {
  title: string
  description: string
  filters: { period: string; from: string; to: string; granularity: string }
  periodOptions: Array<{ value: string; label: string }>
  granularityOptions: Array<{ value: string; label: string }>
  report: Report
  exportUrl: string
}) {
  const [refreshing, setRefreshing] = React.useState(false)
  const [refreshedAt, setRefreshedAt] = React.useState<string | null>(null)
  const [period, setPeriod] = React.useState(filters.period)
  const [from, setFrom] = React.useState(filters.from)
  const [to, setTo] = React.useState(filters.to)
  const [granularity, setGranularity] = React.useState(filters.granularity)

  // P1: akses KPI lintas section utk Ringkasan Utama & Perlu Perhatian.
  const kpiMap = React.useMemo(() => {
    const map: Record<string, (typeof report)["sections"][number]["kpis"][number]> = {}
    for (const sec of report.sections) for (const k of sec.kpis) map[k.key] = k
    return map
  }, [report])

  const attentionItems = [
    { key: "open_orders", label: "Pesanan belum selesai", href: routeUrl("admin.orders.index", { order_status: "processing" }) },
    { key: "payment_pending_count", label: "Pembayaran pending", href: routeUrl("admin.payments.index", { status: "pending" }) },
    { key: "dispatched_orders", label: "Pesanan dalam pengiriman", href: routeUrl("admin.orders.index", { order_status: "shipped" }) },
    { key: "returns_open", label: "Retur aktif", href: routeUrl("admin.orders.index", { order_status: "return_in_process" }) },
  ]
  const [chartTab, setChartTab] = React.useState(0)
  const attentionRows = attentionItems
    .map((item) => ({ ...item, value: kpiMap[item.key]?.value ?? 0 }))
    .filter((row) => row.value > 0)

  function apply(next?: Partial<{ period: string; from: string; to: string; granularity: string }>) {
    const payload = {
      period: next?.period ?? period,
      from: next?.from ?? from,
      to: next?.to ?? to,
      granularity: next?.granularity ?? granularity,
    }
    router.get(routeUrl("admin.analytics.store-performance"), payload, {
      preserveState: true,
      preserveScroll: true,
    })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true)
                router.reload({
                  only: ["report", "filters"],
                  onFinish: () => {
                    setRefreshing(false)
                    setRefreshedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(".", ":"))
                  },
                })
              }}
            >
              <Icon name="refresh" className={"size-4" + (refreshing ? " animate-spin" : "")} aria-hidden="true" />
              {refreshing ? "Memperbarui..." : "Perbarui"}
            </Button>
            {refreshedAt ? (
              <span className="text-xs text-muted-foreground">Diperbarui {refreshedAt}</span>
            ) : null}
          </div>
          <Button asChild variant="secondary">
            <a href={exportUrl}>
              <Icon name="download" className="size-4" aria-hidden="true" />
              Unduh Laporan
            </a>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <section className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Tinjauan bisnis</p>
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex items-center text-muted-foreground hover:text-foreground" aria-label="Panduan metrik">
                    <Icon name="circle-help" className="size-4" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs leading-relaxed">
                  <p className="font-semibold">Cara membaca metrik</p>
                  <ul className="mt-1 list-disc pl-4">
                    <li>Penjualan Gross = nilai pesanan yang dibayar/COD lunas (belum dipotong apa pun).</li>
                    <li>Penjualan Bersih = gross dikurangi refund dari retur yang benar-benar selesai.</li>
                    <li>Pengunjung yang Membeli = rasio pesanan dibanding pengunjung unik; ada angkanya di kategori Kunjungan & Customer.</li>
                    <li>Model / Produk / Unit: jumlah model berbeda, produk (varian/ukuran) berbeda, dan total qty item.</li>
                    <li>Retur & Pembatalan dilipat di bawah; Refund hanya salah satu metrik di sana, bukan ringkasan utama.</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
            <h2 className="mt-1 text-xl font-bold">{report.range.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {report.range.from_date} – {report.range.to_date} · {report.range.compare_label} · Data diperbarui {formatGeneratedAt(report.generated_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              Periode
              <Select
                value={period}
                onChange={(event) => {
                  const value = event.target.value
                  setPeriod(value)
                  if (value !== "custom") {
                    apply({ period: value })
                  }
                }}
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            {period === "custom" ? (
              <>
                <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                  Dari
                  <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                  Sampai
                  <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                </label>
                <Button type="button" onClick={() => apply({ period: "custom", from, to })}>
                  Terapkan
                </Button>
              </>
            ) : null}
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              Granularitas tren
              <Select
                value={granularity}
                onChange={(event) => {
                  const value = event.target.value
                  setGranularity(value)
                  apply({ granularity: value })
                }}
              >
                {granularityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {periodOptions
            .filter((option) => option.value !== "custom")
            .map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setPeriod(option.value)
                  apply({ period: option.value })
                }}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-semibold transition",
                  period === option.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-surface text-foreground hover:border-primary",
                )}
              >
                {option.label}
              </button>
            ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <Icon name="arrow-right" className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-[13px] font-medium text-foreground">
            Perbandingan dengan: {report.range.compare_label}
          </p>
          <p className="text-xs text-muted-foreground">
            ({report.range.compare_from_date} – {report.range.compare_to_date}
            {report.range.is_running ? " · periode berjalan, dibandingkan sampai jam yang sama" : " · periode penuh"})
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Ringkasan keuangan">
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <p className="text-xs font-semibold text-muted-foreground">Penjualan Gross</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(report.financial.gross_revenue)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <p className="text-xs font-semibold text-muted-foreground">Refund Retur</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(report.financial.refund_adjustments)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <p className="text-xs font-semibold text-muted-foreground">Penjualan Bersih</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(report.financial.net_revenue)}</p>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">{report.financial.definition}</p>
        </div>
      </section>

      {/* P1-2: Ringkasan Utama - 6 KPI penentu keputusan (termasuk Pengunjung yang Membeli)
          dengan delta % vs periode pembanding. */}
      <section aria-label="Ringkasan utama" className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { key: "omzet", label: "Penjualan Gross", fmt: "currency" as const },
          { key: "net_revenue", label: "Penjualan Bersih", fmt: "currency" as const },
          { key: "orders", label: "Pesanan Masuk", fmt: "number" as const },
          { key: "units", label: "Unit Terjual", fmt: "number" as const },
          { key: "conversion", label: "Pengunjung yang Membeli", fmt: "percent" as const },
          { key: "open_orders", label: "Pesanan Belum Selesai", fmt: "number" as const },
        ].map((item) => {
          const kpi = kpiMap[item.key]
          if (!kpi) return null
          return (
            <div key={item.key} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
                {item.fmt === "currency" ? formatCurrency(kpi.value) : item.fmt === "percent" ? formatNumber(kpi.value) + "%" : formatNumber(kpi.value)}
              </p>
              <p
                className={cn(
                  "mt-1 text-xs font-semibold",
                  !NEUTRAL_DIRECTION.has(kpi.key) && (kpi.change_percent ?? 0) > 0 && !invertColorFor(kpi.key, kpi.change_percent) && "text-success",
                  !NEUTRAL_DIRECTION.has(kpi.key) && (kpi.change_percent ?? 0) > 0 && invertColorFor(kpi.key, kpi.change_percent) && "text-destructive",
                  !NEUTRAL_DIRECTION.has(kpi.key) && (kpi.change_percent ?? 0) < 0 && !invertColorFor(kpi.key, kpi.change_percent) && "text-destructive",
                  !NEUTRAL_DIRECTION.has(kpi.key) && (kpi.change_percent ?? 0) < 0 && invertColorFor(kpi.key, kpi.change_percent) && "text-success",
                  (kpi.change_percent ?? 0) === 0 && "text-muted-foreground",
                )}
              >
                {kpi.change_percent === null
                  ? "Baru pada periode ini"
                  : (kpi.change_percent ?? 0) === 0
                    ? "Tidak berubah"
                    : (kpi.change_percent > 0 ? "▲ +" : "▼ " + MINUS) + formatNumber(Math.abs(kpi.change_percent)) + "%"}
              </p>
            </div>
          )
        })}
      </section>

      {/* P1-1: Perlu Perhatian - action queue; section disembunyikan bila tidak ada item. */}
      {attentionRows.length ? (
      <section aria-label="Perlu perhatian" className="mb-6 rounded-lg border border-warning/30 bg-warning/5 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Icon name="alert-circle" className="size-4 text-warning" aria-hidden="true" />
          Perlu Perhatian
        </h3>
        <ul className="mt-3 divide-y divide-border">
            {attentionRows.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-foreground">
                  <span className="font-bold tabular-nums">{formatNumber(row.value)}</span> {row.label}
                </span>
                <a href={row.href} className="shrink-0 text-xs font-semibold text-info underline underline-offset-2 hover:no-underline">
                  Lihat
                </a>
              </li>
            ))}
          </ul>
      </section>
      ) : null}

      <div className="space-y-6">
        {report.sections.map((section) => (
          <section key={section.key} className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
            <header className="border-b border-border px-4 py-3">
              <h3 className="text-base font-bold">{section.title}</h3>
            </header>
            {section.key === "returns_cancellations" ? (
              /* P1-3/P2-1: detail retur & pembatalan disembunyikan (progressive disclosure),
                 dibagi 3 subgrup agar 14 KPI tidak jadi satu grid rata. */
              <details className="group">
                <summary className="cursor-pointer select-none list-none px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Icon name="chevron-right" className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
                    Tampilkan detail retur & pembatalan ({section.kpis.length} metrik)
                  </span>
                </summary>
                {[
                  { title: "Retur", keys: ["returns", "returns_created", "returns_open", "returns_completed", "return_rate_created", "return_rate_completed", "return_value"] },
                  { title: "Pembatalan", keys: ["cancelled_orders", "cancelled_by_customer", "cancelled_by_store", "cancellation_rate"] },
                  { title: "Biaya", keys: ["refund_given", "return_shipping_cost_total", "return_shipping_cost_cases"] },
                ].map((group) => {
                  const kpis = group.keys
                    .map((key) => section.kpis.find((k) => k.key === key))
                    .filter((k): k is (typeof section.kpis)[number] => Boolean(k))
                  if (!kpis.length) return null
                  return (
                    <div key={group.title} className="border-t border-border px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.title}</p>
                      <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                        {kpis.map((kpi) => (
                          <div key={kpi.key} className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground" title={kpi.detail ?? undefined}>{kpi.label}</p>
                            <p
                              className="mt-1 text-base font-bold tabular-nums whitespace-nowrap truncate"
                              title={[kpi.detail, `${report.range.compare_label}: ${formatPrevious(kpi)}`].filter(Boolean).join(" · ")}
                            >
                              {formatKpiValue(kpi)}
                            </p>
                            <p className={cn("text-[11px] font-semibold", (kpi.change_percent ?? 0) > 0 && !invertColorFor(kpi.key, kpi.change_percent) && "text-success", (kpi.change_percent ?? 0) > 0 && invertColorFor(kpi.key, kpi.change_percent) && "text-destructive", (kpi.change_percent ?? 0) < 0 && !invertColorFor(kpi.key, kpi.change_percent) && "text-destructive", (kpi.change_percent ?? 0) < 0 && invertColorFor(kpi.key, kpi.change_percent) && "text-success", (kpi.change_percent ?? 0) === 0 && "text-muted-foreground")}>
                              {kpi.change_percent === null ? "Baru pada periode ini" : (kpi.change_percent ?? 0) === 0 ? "Tidak berubah" : (kpi.change_percent > 0 ? "▲ +" : "▼ " + MINUS) + formatNumber(Math.abs(kpi.change_percent)) + "%"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </details>
            ) : (
            <div className="grid gap-0 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
              {section.kpis.map((kpi, index) => (
                <article
                  key={kpi.key}
                  className={cn(
                    "px-4 py-5",
                    index > 0 && "border-t border-border sm:border-t-0 sm:border-l",
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground" title={kpi.detail ?? undefined}>{kpi.label}</p>
                  <p
                    className="mt-2 text-lg font-bold tabular-nums tracking-tight xl:text-xl whitespace-nowrap truncate"
                    title={[kpi.detail, `${report.range.compare_label}: ${formatPrevious(kpi)}`].filter(Boolean).join(" · ")}
                  >
                    {formatKpiValue(kpi)}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-xs font-semibold",
                      !NEUTRAL_DIRECTION.has(kpi.key) && (kpi.change_percent ?? 0) > 0 && !invertColorFor(kpi.key, kpi.change_percent) && "text-success",
                      !NEUTRAL_DIRECTION.has(kpi.key) && (kpi.change_percent ?? 0) > 0 && invertColorFor(kpi.key, kpi.change_percent) && "text-destructive",
                      !NEUTRAL_DIRECTION.has(kpi.key) && (kpi.change_percent ?? 0) < 0 && !invertColorFor(kpi.key, kpi.change_percent) && "text-destructive",
                      !NEUTRAL_DIRECTION.has(kpi.key) && (kpi.change_percent ?? 0) < 0 && invertColorFor(kpi.key, kpi.change_percent) && "text-success",
                      (kpi.change_percent ?? 0) === 0 && "text-muted-foreground",
                      NEUTRAL_DIRECTION.has(kpi.key) && (kpi.change_percent ?? 0) !== 0 && "text-muted-foreground",
                    )}
                  >
                    {kpi.change_percent === null
                      ? "Baru pada periode ini"
                      : (kpi.change_percent ?? 0) === 0
                        ? "Tidak berubah"
                        : (kpi.change_percent > 0 ? "▲ +" : "▼ " + MINUS) + formatNumber(Math.abs(kpi.change_percent)) + "%"}
                  </p>
                </article>
              ))}
            </div>
            )}
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
        {/* P1-4: satu grafik bertab (Penjualan/Pengunjung/Unit) menggantikan tiga grafik kecil. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Tren utama</h3>
          <div className="flex gap-1" role="tablist" aria-label="Pilih metrik tren">
            {report.charts.map((chart, idx) => (
              <button
                key={chart.key}
                type="button"
                role="tab"
                aria-selected={chartTab === idx}
                onClick={() => setChartTab(idx)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  chartTab === idx
                    ? "border-foreground bg-foreground text-background"
                    : "border border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {chart.title.replace(/^Tren /, "")}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const chart = report.charts[chartTab] ?? report.charts[0]
          if (!chart) return null
          const granLabel =
            report.range.granularity === "hour" ? "Per Jam"
            : report.range.granularity === "week" ? "Per Minggu"
            : report.range.granularity === "month" ? "Per Bulan"
            : report.range.granularity === "year" ? "Per Tahun"
            : "Per Hari"
          return (
            <div className="mt-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {chart.title} · {granLabel}
                </p>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Total</p>
                  <p className="text-sm font-bold tabular-nums">
                    {chart.total_format === "currency" ? formatCurrency(chart.total) : chart.key === "conversion_rate" ? formatNumber(chart.total) + "%" : formatNumber(chart.total)}
                  </p>
                </div>
              </div>
              {chart.series.length ? (
                <React.Suspense fallback={<div className="mt-2 h-32 w-full animate-pulse rounded-md bg-muted" aria-label="Memuat grafik" />}>
                  <TrendChart series={chart.series} />
                </React.Suspense>
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">Data belum cukup untuk menampilkan tren periode ini.</p>
              )}
              {chart.key === "visitors" && chart.series.length ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Total = pengunjung unik sepanjang periode; grafik = kehadiran unik per{" "}
                  {report.range.granularity === "hour" ? "jam" : report.range.granularity === "week" ? "minggu" : report.range.granularity === "month" ? "bulan" : "hari"}.
                  Jumlah bar dapat melebihi total unik karena pengunjung yang kembali dihitung di tiap periode.
                </p>
              ) : null}
            </div>
          )
        })()}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
          <header className="border-b border-border px-4 py-3">
            <h3 className="text-base font-bold">Penjualan produk</h3>
            <p className="text-xs text-muted-foreground">Omzet & unit dari pesanan fulfillment (processing–completed).</p>
          </header>
          {report.top_products.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Produk</th>
                      <th className="px-4 py-2 font-semibold">Unit</th>
                      <th className="px-4 py-2 font-semibold">Order</th>
                      <th className="px-4 py-2 font-semibold">Omzet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.top_products.map((product) => (
                      <tr key={`${product.parent_sku}-${product.name}`} className="border-t border-border">
                        <td className="px-4 py-3">
                          <p className="font-semibold">{product.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{product.parent_sku}</p>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatNumber(product.units)}</td>
                        <td className="px-4 py-3 tabular-nums">{formatNumber(product.order_count)}</td>
                        <td className="px-4 py-3 tabular-nums font-semibold">{formatCurrency(product.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border md:hidden">
                {report.top_products.map((product) => (
                  <article key={`${product.parent_sku}-${product.name}`} className="p-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Produk</p>
                      <p className="mt-1 font-semibold">{product.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{product.parent_sku}</p>
                    </div>
                    <dl className="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Unit</dt>
                        <dd className="mt-1 text-sm tabular-nums">{formatNumber(product.units)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Order</dt>
                        <dd className="mt-1 text-sm tabular-nums">{formatNumber(product.order_count)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Omzet</dt>
                        <dd className="mt-1 text-sm tabular-nums font-semibold">{formatCurrency(product.revenue)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              className="min-h-40 border-0 bg-transparent"
              title="Belum ada penjualan produk"
              description="Omzet produk muncul setelah ada pesanan fulfillment."
            />
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
          <header className="border-b border-border px-4 py-3">
            <h3 className="text-base font-bold">Customer</h3>
            <p className="text-xs text-muted-foreground">Agregat per nomor WhatsApp pada periode terpilih.</p>
          </header>
          {report.customers.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Customer</th>
                      <th className="px-4 py-2 font-semibold">Order</th>
                      <th className="px-4 py-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.customers.map((customer) => (
                      <tr key={customer.customer_phone} className="border-t border-border">
                        <td className="px-4 py-3">
                          <p className="font-semibold">{customer.customer_name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{maskPhone(customer.customer_phone)}</p>
                          {customer.last_order_at ? (
                            <p className="text-[11px] text-muted-foreground">Terakhir {formatDate(customer.last_order_at)}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatNumber(customer.order_count)}</td>
                        <td className="px-4 py-3 tabular-nums font-semibold">{formatCurrency(customer.total_spent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border md:hidden">
                {report.customers.map((customer) => (
                  <article key={customer.customer_phone} className="p-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Customer</p>
                      <p className="mt-1 font-semibold">{customer.customer_name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{maskPhone(customer.customer_phone)}</p>
                      {customer.last_order_at ? (
                        <p className="text-[11px] text-muted-foreground">Terakhir {formatDate(customer.last_order_at)}</p>
                      ) : null}
                    </div>
                    <dl className="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Order</dt>
                        <dd className="mt-1 text-sm tabular-nums">{formatNumber(customer.order_count)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">Total</dt>
                        <dd className="mt-1 text-sm tabular-nums font-semibold">{formatCurrency(customer.total_spent)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              className="min-h-40 border-0 bg-transparent"
              title="Belum ada customer"
              description="Data muncul setelah ada pesanan pada periode ini."
            />
          )}
        </section>
      </div>

      <ProductBreakdownGrid breakdowns={report.product_breakdowns} />

      {report.payment_mix.length ? (
        <section className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="text-base font-bold">Bauran metode bayar</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Berdasarkan metode pembayaran pada pesanan fulfillment dalam periode terpilih; persentase dari Penjualan Gross.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {report.payment_mix.map((row) => {
              const gross = report.financial.gross_revenue
              const pct = gross > 0 ? Math.round((row.revenue / gross) * 1000) / 10 : 0
              return (
                <li key={row.method} className="rounded-md border border-border px-3 py-2 text-sm">
                  <p className="font-semibold uppercase">{row.method}</p>
                  <p className="tabular-nums text-muted-foreground">
                    {formatNumber(row.count)} order · {pct}% dari Penjualan Gross
                  </p>
                  <p className="tabular-nums font-semibold">{formatCurrency(row.revenue)}</p>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Keterangan perbandingan: metrik dibandingkan secara otomatis dengan periode sebelumnya
        ({report.range.compare_label}: {report.range.compare_from_date} – {report.range.compare_to_date}).
        {report.range.is_running
          ? " Karena periode berjalan masih berlangsung, data pembanding dipotong sampai jam yang sama agar adil."
          : " Periode pembanding dihitung penuh."}
      </p>
    </AdminLayout>
  )
}
