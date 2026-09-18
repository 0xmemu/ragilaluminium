import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { DeltaBadge } from "@/components/admin/ui/delta-badge"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/admin/ui/tooltip"

interface Kpi {
  key: string
  label: string
  value: number
  previous: number
  change_percent: number | null
  sparkline?: number[]
  format: "currency" | "number" | "percent" | "hours" | "days"
  detail?: string | null
}


interface Section {
  key: string
  title: string
  kpis: Kpi[]
}

interface SeriesPoint {
  bucket: string
  label: string
  value: number
  previous_value?: number
  previous_label?: string | null
}

interface ChartBlock {
  key: string
  title: string
  total: number
  previous_total?: number
  total_format: "currency" | "number"
  series: SeriesPoint[]
  previous_series?: SeriesPoint[]
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
    shipping_raw?: number
    product_discount?: number
    voucher_discount?: number
    shipping_paid_by_customer?: number
    shipping_subsidy?: number
    cod_fee?: number
    refund_adjustments: number
    return_shipping_store?: number
    net_revenue: number
    buyer_orders?: number
    visitors?: number
    payments_received?: number
    cod_paid?: number
    cod_pending_amount?: number
    cod_pending_count?: number
    payment_pending_count?: number
    definition: string
  }
  sections: Section[]
  charts: ChartBlock[]
  top_products: Array<{
    parent_sku: string
    name: string
    image?: string | null
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
    best_sellers: Array<{ product_id: number; parent_sku: string; name: string; image?: string | null; units: number; revenue: number; order_count: number }>
  }
}





function formatDuration(value: number, isDays = false): string {
  if (!Number.isFinite(value) || value <= 0) return "0 menit"
  const base = isDays ? value * 24 : value
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



function HoverHint({
  label,
  hint,
  className,
}: {
  label: React.ReactNode
  hint?: string
  className?: string
}) {
  if (!hint) return <span className={className}>{label}</span>
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={cn(
              "cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-[3px] transition hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
              className,
            )}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs font-normal">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function CopySkuButton({ sku }: { sku: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(sku)
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
      className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground transition hover:text-foreground hover:bg-muted"
      title={copied ? "Tersalin!" : "Salin SKU " + sku}
      aria-label={"Salin SKU " + sku}
    >
      <Icon
        name={copied ? "check" : "copy"}
        className={cn("size-3", copied ? "text-success" : "text-muted-foreground")}
        aria-hidden="true"
      />
    </button>
  )
}

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
  onViewAll: () => void
}

function ProductBreakdownGrid({ breakdowns, onViewAll }: ProductBreakdownGridProps) {
  const [tab, setTab] = React.useState<"viewed" | "clicked" | "sellers">("viewed")

  const tabs = [
    { key: "viewed" as const, label: "Paling Dilihat" },
    { key: "clicked" as const, label: "Paling Diklik" },
    { key: "sellers" as const, label: "Terlaris" },
  ]

  const data =
    tab === "viewed"
      ? breakdowns.most_viewed
      : tab === "clicked"
        ? breakdowns.most_clicked
        : breakdowns.best_sellers

  // Batasi persis 6 produk di kartu ringkas
  const previewRows = data.slice(0, 6)

  return (
    <section className="flex flex-col justify-between overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="p-5 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <HoverHint
            label="Produk Berdasarkan Interaksi"
            hint="Peminat katalog (dilihat & diklik) dibanding produk yang dikonversi menjadi penjualan."
            className="text-sm font-semibold tracking-tight text-foreground"
          />
          <div className="flex flex-wrap gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  tab === t.key
                    ? "bg-foreground text-background shadow-xs font-semibold"
                    : "bg-surface text-muted-foreground hover:text-foreground border border-border",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "viewed" || tab === "clicked" ? (
          <EngagementList rows={previewRows} />
        ) : (
          <SellersList rows={previewRows} />
        )}
        {data.length === 0 ? (
          <EmptyState className="min-h-24 border-0 bg-transparent py-8" title="Belum ada data" description="Belum ada interaksi produk pada periode ini." />
        ) : null}
      </div>

      {data.length > 0 ? (
        <div className="border-t border-border p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onViewAll}
            className="w-full text-xs font-semibold"
          >
            Lihat semua {data.length} produk ({tabs.find((t) => t.key === tab)?.label})
            <Icon name="arrow-right" className="ml-1.5 size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function EngagementList({ rows }: { rows: ProductBreakdown[] }) {
  if (!rows.length) return null
  return (
    <div className="mt-3 divide-y divide-border">
      {rows.map((p) => (
        <article key={p.product_id} className="flex items-center gap-3 py-2">
          {p.image ? (
            <img src={p.image} alt={p.name} className="size-9 shrink-0 rounded-md object-cover border border-border" />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
              {p.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-normal text-foreground" title={p.name}>{p.name}</p>
            <div className="flex items-center gap-1">
              <span className="truncate font-mono text-xs text-muted-foreground">{p.parent_sku}</span>
              <CopySkuButton sku={p.parent_sku} />
            </div>
          </div>
          <div className="text-right text-xs tabular-nums">
            <p className="font-semibold text-foreground">{formatNumber(p.views ?? 0)} dilihat</p>
            <p className="text-[11px] text-muted-foreground">{formatNumber(p.clicks ?? 0)} klik</p>
          </div>
        </article>
      ))}
    </div>
  )
}

function SellersList({ rows }: { rows: ProductBreakdown[] }) {
  if (!rows.length) return null
  return (
    <div className="mt-3 divide-y divide-border">
      {rows.map((p) => (
        <article key={p.product_id} className="flex items-center gap-3 py-2">
          {p.image ? (
            <img src={p.image} alt={p.name} className="size-9 shrink-0 rounded-md object-cover border border-border" />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
              {p.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-normal text-foreground" title={p.name}>{p.name}</p>
            <div className="flex items-center gap-1">
              <span className="truncate font-mono text-xs text-muted-foreground">{p.parent_sku}</span>
              <CopySkuButton sku={p.parent_sku} />
            </div>
          </div>
          <div className="text-right text-xs tabular-nums">
            <p className="font-semibold text-foreground">{formatNumber(p.units ?? 0)} unit</p>
            <p className="text-[11px] text-muted-foreground">{formatCurrency(p.revenue ?? 0)}</p>
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
  const [exportOpen, setExportOpen] = React.useState(false)
  const [exportRange, setExportRange] = React.useState<"screen" | "custom">("screen")
  const [exportFrom, setExportFrom] = React.useState("")
  const [exportTo, setExportTo] = React.useState("")
  const [exportGranularity, setExportGranularity] = React.useState("day")
  const [refreshError, setRefreshError] = React.useState(false)
  const [period, setPeriod] = React.useState(filters.period)
  const [from, setFrom] = React.useState(filters.from)
  const [to, setTo] = React.useState(filters.to)
  const [granularity, setGranularity] = React.useState(filters.granularity)

  // Ref dan penutup klik luar untuk popover export
  const exportRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!exportOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setExportOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [exportOpen])

  // State Modal Popover Lebar
  const [showTopProductsModal, setShowTopProductsModal] = React.useState(false)
  const [showInteractionModal, setShowInteractionModal] = React.useState(false)
  const [searchQueryTop, setSearchQueryTop] = React.useState("")
  const [searchQueryInteraction, setSearchQueryInteraction] = React.useState("")
  const [modalInteractionTab, setModalInteractionTab] = React.useState<"viewed" | "clicked" | "sellers">("viewed")

  const sparklineBy = React.useMemo(() => {
    const byKey: Record<string, number[]> = {}
    for (const chart of report.charts ?? []) {
      byKey[chart.key] = (chart.series ?? []).map((point) => point.value)
    }
    return {
      omzet: byKey["revenue"] ?? [],
      net_revenue: byKey["net_revenue"] ?? byKey["revenue"] ?? [],
      payments_received: byKey["net_revenue"] ?? byKey["revenue"] ?? [],
      orders: byKey["units"] ?? [],
      units: byKey["units"] ?? [],
      conversion: byKey["conversion_rate"] ?? [],
    } as Record<string, number[]>
  }, [report])

  const kpiMap = React.useMemo(() => {
    const map: Record<string, (typeof report)["sections"][number]["kpis"][number] & { sparkline?: number[] }> = {}
    for (const sec of report.sections) for (const k of sec.kpis) {
      map[k.key] = { ...k, sparkline: sparklineBy[k.key] ?? [] }
    }
    return map
  }, [report, sparklineBy])

  // Tampilkan "vs <rentang>" utuh sesuai owner 2026-09-15 (jangan buang prefiks "vs").
  const compareLabel = report.range.compare_label || "vs periode lalu"
  const [chartTab, setChartTab] = React.useState(0)
  const [chartModel, setChartModel] = React.useState<"line" | "bar">("line")

  function buildExportUrl(): string {
    try {
      const url = new URL(exportUrl, window.location.origin)
      if (exportRange === "screen") {
        url.searchParams.set("period", period)
        if (period === "custom") {
          if (from) url.searchParams.set("from", from)
          if (to) url.searchParams.set("to", to)
        }
      } else if (exportRange === "custom") {
        url.searchParams.set("period", "custom")
        if (exportFrom) url.searchParams.set("export_from", exportFrom)
        if (exportTo) url.searchParams.set("export_to", exportTo)
      }
      url.searchParams.set("export_granularity", exportGranularity)
      return url.toString()
    } catch {
      return exportUrl
    }
  }

  const [prevFilters, setPrevFilters] = React.useState(filters)
  if (prevFilters.period !== filters.period || prevFilters.granularity !== filters.granularity || prevFilters.from !== filters.from || prevFilters.to !== filters.to) {
    setPrevFilters(filters)
    setPeriod(filters.period)
    setGranularity(filters.granularity)
    setFrom(filters.from)
    setTo(filters.to)
  }

  function apply(next?: Partial<{ period: string; from: string; to: string; granularity?: string }>) {
    const nextPeriod = next?.period ?? period
    const isPeriodChanged = next?.period !== undefined && next.period !== period

    const payload: Record<string, string> = {
      period: nextPeriod,
    }

    const nextFrom = next?.from ?? from
    const nextTo = next?.to ?? to
    if (nextFrom) payload.from = nextFrom
    if (nextTo) payload.to = nextTo

    // Jika ganti periode, jangan bawa granularitas lama agar backend memilihkan granularitas kanonik
    if (next?.granularity !== undefined) {
      payload.granularity = next.granularity
    } else if (!isPeriodChanged && granularity) {
      payload.granularity = granularity
    }

    router.get(routeUrl("admin.analytics.store-performance"), payload, {
      preserveState: true,
      preserveScroll: true,
    })
  }

  const returnsSection = report.sections.find((s) => s.key === "returns_cancellations")

  // Filter list untuk modal Top Products
  const filteredTopProductsModal = React.useMemo(() => {
    const q = searchQueryTop.trim().toLowerCase()
    if (!q) return report.top_products
    return report.top_products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.parent_sku.toLowerCase().includes(q),
    )
  }, [report.top_products, searchQueryTop])

  // Filter list untuk modal Interaksi
  const interactionModalData = React.useMemo(() => {
    const list =
      modalInteractionTab === "viewed"
        ? report.product_breakdowns.most_viewed
        : modalInteractionTab === "clicked"
          ? report.product_breakdowns.most_clicked
          : report.product_breakdowns.best_sellers
    const q = searchQueryInteraction.trim().toLowerCase()
    if (!q) return list
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.parent_sku.toLowerCase().includes(q))
  }, [report.product_breakdowns, modalInteractionTab, searchQueryInteraction])

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
              setRefreshError(false)
              router.reload({
                only: ["report", "filters"],
                onError: () => setRefreshError(true),
                onFinish: () => setRefreshing(false),
              })
            }}
            disabled={refreshing}
          >
            <Icon name="refresh" className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            {refreshing ? "Memuat..." : "Refresh data"}
          </Button>
          <div className="relative" ref={exportRef}>
            <Button variant="secondary" onClick={() => setExportOpen((v) => !v)}>
              <Icon name="download" className="size-4" aria-hidden="true" />
              Unduh Laporan
            </Button>
            {exportOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
                <p className="text-xs font-bold text-foreground">Rentang waktu export</p>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <input type="radio" name="export_range" checked={exportRange === "screen"} onChange={() => setExportRange("screen")} />
                  Ikuti periode di layar
                </label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <input type="radio" name="export_range" checked={exportRange === "custom"} onChange={() => setExportRange("custom")} />
                  Kustom
                </label>
                {exportRange === "custom" ? (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="h-8 w-32 text-xs" aria-label="Dari tanggal" />
                    <span className="text-xs text-muted-foreground">s/d</span>
                    <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="h-8 w-32 text-xs" aria-label="Sampai tanggal" />
                  </div>
                ) : null}
                <p className="mt-3 text-xs font-bold text-foreground">Granularitas data</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Rentang &gt; 1 bulan otomatis dipecah: satu file, sheet per bulan.
                </p>
                <select
                  value={exportGranularity}
                  onChange={(e) => setExportGranularity(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  aria-label="Granularitas export"
                >
                  {granularityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
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

      {/* FILTER PERIODE & BANNER KONTROL */}
      <section className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm">
        {/* Baris Atas: Identitas Periode Analisis */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Periode Analisis:</span>
            <span className="text-xs font-semibold text-primary">{report.range.label}</span>
            <span className="text-xs text-muted-foreground">({report.range.from_date} - {report.range.to_date})</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {refreshing ? "Memperbarui data..." : `Pembanding: ${report.range.compare_label.replace(/^vs\s+/, "")}`}
            </span>
          </div>
        </div>

        {/* Baris Bawah: Kontrol Segmented Periode & Granularitas */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface p-1">
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
                    "rounded-md px-2.5 py-1 text-xs font-medium transition",
                    period === option.value
                      ? "bg-foreground text-background shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {option.label}
                </button>
              ))}
            <button
              type="button"
              onClick={() => setPeriod("custom")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                period === "custom"
                  ? "bg-foreground text-background shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              Kustom
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Granularitas:</span>
            <Select
              value={granularity}
              onChange={(event) => {
                const value = event.target.value
                setGranularity(value)
                apply({ granularity: value })
              }}
              className="h-8 text-xs font-medium w-28 bg-surface"
            >
              {granularityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {refreshError ? (
          <p className="mt-2 text-xs font-medium text-destructive" role="status">
            Gagal memuat pembaruan data. Coba refresh lagi.
          </p>
        ) : null}

        {period === "custom" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs font-medium text-muted-foreground">Rentang tanggal:</span>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-8 w-36 text-xs bg-surface" />
            <span className="text-xs text-muted-foreground">s/d</span>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-8 w-36 text-xs bg-surface" />
            <Button size="sm" type="button" onClick={() => apply({ period: "custom", from, to })} className="h-8 text-xs">
              Terapkan
            </Button>
          </div>
        ) : null}
      </section>

      {/* LAYER 1: HEADLINE METRICS (4 KARTU EKSEKUTIF BERPRIORITAS TINGGI) */}
      <section aria-label="Ringkasan utama" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {/* KARTU 1: Penjualan Gross (nilai utama) */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm">
          <div>
            <div>
              <HoverHint
                label={kpiMap["omzet"]?.label ?? "Penjualan Gross"}
                hint="Total nilai transaksi pembeli pada periode (sebelum dikurangi ongkir J&T, biaya COD, subsidi, dan retur)."
                className="text-xs font-medium text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground tracking-tight">
              {formatCurrency(report.financial.gross_revenue)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Bersih: {formatCurrency(report.financial.net_revenue)}
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
            <span className="text-xs text-muted-foreground">{compareLabel}</span>
            <span className={cn(
              "font-semibold",
              (kpiMap["omzet"]?.change_percent ?? 0) > 0 && "text-success",
              (kpiMap["omzet"]?.change_percent ?? 0) < 0 && "text-destructive",
              (kpiMap["omzet"]?.change_percent ?? 0) === 0 && "text-muted-foreground",
            )}>
              <DeltaBadge percent={kpiMap["omzet"]?.change_percent} />
            </span>
          </div>
        </div>

        {/* KARTU 2: Jumlah Pesanan */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm">
          <div>
            <div>
              <HoverHint
                label={kpiMap["orders"]?.label ?? "Jumlah Pesanan"}
                hint="Pesanan yang sudah masuk alur fulfillment (diproses atau lebih lanjut). Pesanan yang baru masuk dan belum dikonfirmasi belum ikut dihitung."
                className="text-xs font-medium text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground tracking-tight">
              {formatNumber(kpiMap["orders"]?.value ?? 0)} <span className="text-sm font-normal text-muted-foreground">pesanan</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNumber(kpiMap["units"]?.value ?? 0)} unit terjual
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
            <span className="text-xs text-muted-foreground">{compareLabel}</span>
            <span className={cn(
              "font-semibold",
              (kpiMap["orders"]?.change_percent ?? 0) > 0 && "text-success",
              (kpiMap["orders"]?.change_percent ?? 0) < 0 && "text-destructive",
              (kpiMap["orders"]?.change_percent ?? 0) === 0 && "text-muted-foreground",
            )}>
              <DeltaBadge percent={kpiMap["orders"]?.change_percent} />
            </span>
          </div>
        </div>

        {/* KARTU 3c: Jumlah Produk Terjual */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm">
          <div>
            <div>
              <HoverHint
                label={kpiMap["products"]?.label ?? "Produk Terjual"}
                hint="Jumlah produk unik yang terjual pada periode."
                className="text-xs font-medium text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground tracking-tight">
              {formatNumber(kpiMap["products"]?.value ?? 0)} <span className="text-sm font-normal text-muted-foreground">produk</span>
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
            <span className="text-xs text-muted-foreground">{compareLabel}</span>
            <span className={cn(
              "font-semibold",
              (kpiMap["products"]?.change_percent ?? 0) > 0 && "text-success",
              (kpiMap["products"]?.change_percent ?? 0) < 0 && "text-destructive",
              (kpiMap["products"]?.change_percent ?? 0) === 0 && "text-muted-foreground",
            )}>
              <DeltaBadge percent={kpiMap["products"]?.change_percent} />
            </span>
          </div>
        </div>

        {/* KARTU 3b: Jumlah Unit Terjual */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm">
          <div>
            <div>
              <HoverHint
                label={kpiMap["units"]?.label ?? "Jumlah Unit Terjual"}
                hint="Total unit fisik terjual pada periode (dari pesanan fulfillment)."
                className="text-xs font-medium text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground tracking-tight">
              {formatNumber(kpiMap["units"]?.value ?? 0)} <span className="text-sm font-normal text-muted-foreground">unit</span>
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
            <span className="text-xs text-muted-foreground">{compareLabel}</span>
            <span className={cn(
              "font-semibold",
              (kpiMap["units"]?.change_percent ?? 0) > 0 && "text-success",
              (kpiMap["units"]?.change_percent ?? 0) < 0 && "text-destructive",
              (kpiMap["units"]?.change_percent ?? 0) === 0 && "text-muted-foreground",
            )}>
              <DeltaBadge percent={kpiMap["units"]?.change_percent} />
            </span>
          </div>
        </div>

        {/* KARTU 4: Tingkat Konversi Toko */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm">
          <div>
            <div>
              <HoverHint
                label={kpiMap["conversion"]?.label ?? "Pengunjung yang Membeli"}
                hint="Persentase pengunjung unik yang menyelesaikan pembelian pada periode ini."
                className="text-xs font-medium text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground tracking-tight">
              {formatNumber(kpiMap["conversion"]?.value ?? 0)}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground truncate" title={kpiMap["conversion"]?.detail ?? undefined}>
              {/* Angka pembeli diambil dari detail backend (pembeli unik), bukan jumlah
                pesanan: satu pelanggan dengan beberapa pesanan tetap dihitung satu orang. */}
              {kpiMap["conversion"]?.detail ?? ""}
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
            <span className="text-xs text-muted-foreground">{compareLabel}</span>
            <span className={cn(
              "font-semibold",
              (kpiMap["conversion"]?.change_percent ?? 0) > 0 && "text-success",
              (kpiMap["conversion"]?.change_percent ?? 0) < 0 && "text-destructive",
              (kpiMap["conversion"]?.change_percent ?? 0) === 0 && "text-muted-foreground",
            )}>
              <DeltaBadge percent={kpiMap["conversion"]?.change_percent} />
            </span>
          </div>
        </div>
        {/* KARTU 3: Rata-rata Nilai Pesanan */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm">
          <div>
            <div>
              <HoverHint
                label={kpiMap["avg_unit_price"]?.label ?? "Harga Rata-rata per Unit"}
                hint="Nilai pesanan dibagi jumlah unit terjual pada periode ini."
                className="text-xs font-medium text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-foreground tracking-tight">
              {formatCurrency(kpiMap["avg_unit_price"]?.value ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              AOV {formatCurrency(kpiMap["aov"]?.value ?? 0)} per pesanan
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
            <span className="text-xs text-muted-foreground">{compareLabel}</span>
            <span className={cn(
              "font-semibold",
              (kpiMap["avg_unit_price"]?.change_percent ?? 0) > 0 && "text-success",
              (kpiMap["avg_unit_price"]?.change_percent ?? 0) < 0 && "text-destructive",
              (kpiMap["avg_unit_price"]?.change_percent ?? 0) === 0 && "text-muted-foreground",
            )}>
              <DeltaBadge percent={kpiMap["avg_unit_price"]?.change_percent} />
            </span>
          </div>
        </div>

      </section>

      {/* LAYER 2: REKONSILIASI KEUANGAN & LIKUIDITAS KAS (TABLE-FIRST ACCOUNTING) */}
      <section className="mb-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <header className="border-b border-border bg-muted/30 px-5 py-3">
          <HoverHint
            label="Rekonsiliasi Keuangan & Arus Kas"
            hint="Penjabaran transparan dari total nilai transaksi pembeli hingga pendapatan bersih dan status kas."
            className="text-sm font-bold text-foreground"
          />
        </header>

        <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
          {/* Kolom Kiri: Laporan Laba/Rugi Penjualan */}
          <div className="p-5 border-b lg:border-b-0 lg:border-r border-border">
            <p className="text-xs font-medium text-muted-foreground">
              Dari Penjualan Gross ke Penjualan Bersih
            </p>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                <HoverHint
                  label={kpiMap["omzet"]?.label ?? "Penjualan Gross"}
                  hint="Total nilai transaksi kotor pembeli termasuk nilai produk, ongkir, dan biaya COD."
                  className="font-semibold text-foreground"
                />
                <span className="font-bold tabular-nums text-foreground">{formatCurrency(report.financial.gross_revenue)}</span>
              </div>

              {/* Promo ditanggung toko: SUDAH tercakup dalam Penjualan Gross (pelanggan
                  membayar lebih murah), jadi TIDAK dikurangkan lagi di sini -
                  ditampilkan agar beban promo toko tetap terdata. */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-foreground mb-2">Promo Ditanggung Toko (tercakup dalam Penjualan Gross)</p>
                <div className="space-y-1">
                  {[
                    { label: "Potongan Harga Produk", hint: "Diskon harga produk yang ditanggung toko.", val: report.financial.product_discount ?? 0 },
                    { label: "Potongan Voucher", hint: "Potongan voucher yang ditanggung toko.", val: report.financial.voucher_discount ?? 0 },
                    { label: "Subsidi Ongkir", hint: "Ongkir yang disubsidi toko; sudah masuk dalam Titipan Ongkir J&T di bawah, tidak dihitung dua kali.", val: report.financial.shipping_subsidy ?? 0 },
                  ].map((row, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 text-muted-foreground">
                      <span className="pl-2">
                        <HoverHint label={row.label} hint={row.hint} className="text-muted-foreground" />
                      </span>
                      <span className={cn("tabular-nums", row.val > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                        {formatCurrency(row.val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-foreground mb-2">Dikurangkan dari dana pembeli (dana titipan & biaya retur)</p>
              </div>
              {[
                { label: "Titipan Ongkir J&T Cargo", hint: "Ongkir dasar yang diteruskan ke J&T Cargo, sudah termasuk subsidi ongkir yang ditanggung toko.", val: report.financial.shipping_raw ?? 0 },
                { label: "Titipan Biaya Layanan COD J&T", hint: "Biaya administrasi COD yang dipotong oleh pihak kurir J&T Cargo.", val: report.financial.cod_fee ?? 0 },
                { label: "Refund Retur", hint: "Pengembalian dana kepada pembeli atas kasus retur yang selesai.", val: report.financial.refund_adjustments ?? 0 },
                { label: "Ongkir Retur (Toko)", hint: "Biaya pengiriman barang retur yang ditanggung oleh pihak toko.", val: report.financial.return_shipping_store ?? 0 },
              ].map((row, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 text-muted-foreground">
                  <span className="pl-2">
                    <HoverHint label={row.label} hint={row.hint} className="text-muted-foreground" />
                  </span>
                  <span className={cn("tabular-nums", row.val > 0 ? "text-destructive font-medium" : "text-muted-foreground")}>
                    {row.val > 0 ? `− ${formatCurrency(row.val)}` : formatCurrency(0)}
                  </span>
                </div>
              ))}

              <div className="mt-3 flex items-center justify-between rounded-md bg-muted/40 p-2.5 border border-border">
                <HoverHint
                  label={kpiMap["net_revenue"]?.label ?? "Penjualan Bersih"}
                  hint="Hak pendapatan bersih toko setelah dikurangi ongkir, fee COD, subsidi, dan retur."
                  className="text-xs font-bold text-foreground"
                />
                <span className="text-sm font-bold tabular-nums text-primary">{formatCurrency(report.financial.net_revenue)}</span>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Status Kas & Likuiditas */}
          <div className="p-5 bg-surface-muted/20">
            <p className="text-xs font-medium text-muted-foreground">
              Arus Kas & Likuiditas
            </p>

            <div className="mt-3 space-y-3">
              {/* Box 1: Pembayaran Diterima (Total Kas Masuk) */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <HoverHint
                    label={kpiMap["payments_received"]?.label ?? "Pembayaran Diterima"}
                    hint="Total dana riil dari transaksi transfer lunas dan COD yang selesai pada periode ini."
                    className="text-xs font-semibold text-foreground"
                  />
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">Lunas</span>
                </div>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  {formatCurrency(report.financial.payments_received ?? 0)}
                </p>
              </div>

              {/* Rincian Komposisi Kas Masuk */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-md border border-border bg-card p-2.5">
                  <HoverHint
                    label="Transfer Bank"
                    hint="Pembayaran transfer yang lunas di muka langsung ke rekening toko."
                    className="text-xs text-muted-foreground"
                  />
                  <p className="mt-1 font-bold tabular-nums text-foreground">
                    {formatCurrency(Math.max(0, (report.financial.payments_received ?? 0) - (report.financial.cod_paid ?? 0)))}
                  </p>
                </div>

                <div className="rounded-md border border-border bg-card p-2.5">
                  <HoverHint
                    label={kpiMap["cod_paid"]?.label ?? "COD Selesai"}
                    hint="Pesanan COD yang barangnya sudah sampai ke pembeli. Sistem tidak melacak setoran uang dari kurir."
                    className="text-xs text-muted-foreground"
                  />
                  <p className="mt-1 font-bold tabular-nums text-foreground">
                    {formatCurrency(report.financial.cod_paid ?? 0)}
                  </p>
                </div>
              </div>

              {/* Box 2: Transfer Menunggu Bukti / Verifikasi */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <HoverHint
                    label={kpiMap["payment_pending_count"]?.label ?? "Pembayaran Pending"}
                    hint="Pesanan metode transfer yang belum selesai dibayar atau menunggu verifikasi admin."
                    className="text-xs font-semibold text-foreground"
                  />
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Pending</span>
                </div>
                <p className="mt-1 text-base font-bold tabular-nums text-foreground">
                  {formatNumber(report.financial.payment_pending_count ?? 0)} <span className="text-xs font-normal text-muted-foreground">pesanan</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LAYER 3: KESEHATAN OPERASIONAL & PIPELINE FULFILLMENT */}
      <section className="mb-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <HoverHint
            label="Kesehatan Operasional & Logistik Toko"
            hint="Pantau antrean fulfillment pesanan agar tidak terjadi bottleneck pengiriman."
            className="text-sm font-semibold tracking-tight text-foreground"
          />
          <Button asChild variant="outline" size="sm">
            <Link href={routeUrl("admin.orders.index")}>
              Ke Daftar Pesanan <Icon name="arrow-right" className="ml-1 size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link
            href={`${routeUrl("admin.orders.index")}?order_status=processing`}
            className="group rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["open_orders"]?.label ?? "Pesanan Belum Selesai"}
                hint="Pesanan aktif menunggu diproses dan disiapkan workshop."
                className="text-xs font-semibold text-muted-foreground group-hover:text-primary"
              />
              <Icon name="package" className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["open_orders"]?.value ?? 0)} <span className="text-xs font-normal text-muted-foreground">pesanan</span>
            </p>
          </Link>

          <Link
            href={`${routeUrl("admin.orders.index")}?order_status=shipped`}
            className="group rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["dispatched_orders"]?.label ?? "Dalam Pengiriman"}
                hint="Pesanan sedang dalam pengiriman ekspedisi kurir."
                className="text-xs font-semibold text-muted-foreground group-hover:text-primary"
              />
              <Icon name="truck" className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["dispatched_orders"]?.value ?? 0)} <span className="text-xs font-normal text-muted-foreground">pesanan</span>
            </p>
          </Link>

          <Link
            href={`${routeUrl("admin.orders.index")}?order_status=completed`}
            className="group rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["completed_orders"]?.label ?? "Pesanan Selesai"}
                hint="Pesanan yang telah sampai di tujuan dan diterima pembeli."
                className="text-xs font-semibold text-muted-foreground group-hover:text-primary"
              />
              <Icon name="check-circle" className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["completed_orders"]?.value ?? 0)} <span className="text-xs font-normal text-muted-foreground">pesanan</span>
            </p>
          </Link>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["avg_confirm_hours"]?.label ?? "Rata-rata Waktu Konfirmasi"}
                hint="Rata-rata waktu respon sejak pesanan masuk hingga dikonfirmasi admin."
                className="text-xs font-semibold text-muted-foreground"
              />
              <Icon name="clock" className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatDuration(kpiMap["avg_confirm_hours"]?.value ?? 0)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["avg_process_days"]?.label ?? "Rata-rata Waktu Proses"}
                hint="Waktu dari dikonfirmasi sampai disiapkan/siap kirim."
                className="text-xs font-semibold text-muted-foreground"
              />
              <Icon name="clock" className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatDuration(kpiMap["avg_process_days"]?.value ?? 0, true)}
            </p>
          </div>
        </div>

        {/* Sub-panel Progressive Disclosure Retur & Pembatalan */}
        {returnsSection ? (
          <details className="group mt-4 rounded-md border border-border bg-muted/20">
            <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <span className="inline-flex items-center gap-2">
                <Icon name="caret-down" className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                Rincian Kasus Retur & Pembatalan ({returnsSection.kpis.length} indikator)
              </span>
            </summary>
            <div className="border-t border-border px-4 py-3 grid gap-4 sm:grid-cols-3 text-xs">
              <div>
                <p className="font-bold text-foreground">Retur Barang</p>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li className="flex justify-between">
                    <span>{kpiMap["returns_created"]?.label ?? "Retur Diajukan"}:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(kpiMap["returns_created"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["returns_open"]?.label ?? "Retur Aktif"}:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(kpiMap["returns_open"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["returns_completed"]?.label ?? "Retur Selesai"}:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(kpiMap["returns_completed"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["return_rate_completed"]?.label ?? "Rasio Retur Selesai"}:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(kpiMap["return_rate_completed"]?.value ?? 0)}%</span>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-foreground">Pembatalan Pesanan</p>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li className="flex justify-between">
                    <span>{kpiMap["cancelled_orders"]?.label ?? "Pesanan Dibatalkan"}:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(kpiMap["cancelled_orders"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["cancelled_by_customer"]?.label ?? "Dibatalkan Pelanggan"}:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(kpiMap["cancelled_by_customer"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["cancelled_by_store"]?.label ?? "Dibatalkan Toko"}:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(kpiMap["cancelled_by_store"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["cancellation_rate"]?.label ?? "Rasio Pembatalan"}:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(kpiMap["cancellation_rate"]?.value ?? 0)}%</span>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-foreground">Dampak Beban Biaya</p>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li className="flex justify-between">
                    <span>{kpiMap["refund_given"]?.label ?? "Refund Diberikan"}:</span>
                    <span className="font-semibold text-destructive tabular-nums">{formatCurrency(kpiMap["refund_given"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["return_shipping_cost_total"]?.label ?? "Ongkir Retur (Toko)"}:</span>
                    <span className="font-semibold text-destructive tabular-nums">{formatCurrency(kpiMap["return_shipping_cost_total"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["return_shipping_cost_cases"]?.label ?? "Kasus Retur (Ongkir Toko)"}:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(kpiMap["return_shipping_cost_cases"]?.value ?? 0)} kasus</span>
                  </li>
                </ul>
              </div>
            </div>
          </details>
        ) : null}
      </section>

      {/* LAYER 4: TREN BISNIS & KUNJUNGAN / METODE BAYAR (2 KOLOM BERIMBANG) */}
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        {/* Kolom Kiri: Tren Bisnis Interaktif */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm">
          <div>
            {(() => {
              const chart = report.charts[chartTab] ?? report.charts[0]
              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                    <HoverHint
                      label="Grafik Tren Bisnis"
                      hint="Grafik fluktuasi kinerja bisnis toko berdasarkan metrik dan skala waktu yang dipilih."
                      className="text-sm font-semibold tracking-tight text-foreground"
                    />
                    <div className="flex gap-1" role="tablist" aria-label="Pilih metrik tren">
                      {report.charts.map((c, idx) => (
                        <button
                          key={c.key}
                          type="button"
                          role="tab"
                          aria-selected={chartTab === idx}
                          onClick={() => setChartTab(idx)}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-semibold transition",
                            chartTab === idx
                              ? "bg-foreground text-background shadow-xs"
                              : "bg-surface text-muted-foreground hover:text-foreground border border-border",
                          )}
                        >
                          {c.title.replace(/^Tren /, "")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {chart ? (
                    <div className="mt-3">
                      {/* Baris Sejajar: Total Metrik di Kiri, Legend & Toggle Model Chart di Kanan */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5 mb-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-muted-foreground">Total {chart.title.replace(/^Tren /, "")}:</span>
                          <span className="text-base font-bold tabular-nums text-foreground">
                            {chart.total_format === "currency"
                              ? formatCurrency(chart.total)
                              : chart.key === "conversion_rate"
                                ? formatNumber(chart.total) + "%"
                                : formatNumber(chart.total)}
                          </span>
                          {chart.previous_total !== undefined ? (
                            <span className="text-xs text-muted-foreground">
                              (vs {chart.total_format === "currency"
                                ? formatCurrency(chart.previous_total)
                                : chart.key === "conversion_rate"
                                  ? formatNumber(chart.previous_total) + "%"
                                  : formatNumber(chart.previous_total)})
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Legend Indikator Garis */}
                          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="size-2 rounded-full inline-block" style={{ backgroundColor: "hsl(var(--sale))" }} />
                              Periode Ini
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-0.5 w-3 border-t-2 border-dashed border-muted-foreground/60 inline-block" />
                              Periode Lalu
                            </span>
                          </div>

                          {/* Toggle Model Chart (Line / Bar) */}
                          <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
                            {([
                              { key: "line", label: "Line Chart" },
                              { key: "bar", label: "Bar Chart" },
                            ] as const).map(({ key, label }) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setChartModel(key)}
                                className={cn(
                                  "rounded px-2.5 py-1 text-xs font-medium transition",
                                  chartModel === key
                                    ? "bg-foreground text-background shadow-xs font-semibold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                                )}
                                title={label}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const prev = chart.previous_series ?? []
                        const combinedSeries = chart.series.map((item, idx) => ({
                          ...item,
                          previous_value: prev[idx]?.value,
                          previous_label: prev[idx]?.label,
                        }))
                        return combinedSeries.length ? (
                          <React.Suspense fallback={<div className="h-[175px] w-full animate-pulse rounded-md bg-muted/40" />}>
                            <TrendChart
                              series={combinedSeries}
                            format={chart.key === "conversion_rate" ? "percent" : chart.total_format === "currency" ? "currency" : "number"}
                            chartType={chartModel}
                            showChartTypeToggle={false}
                            height={175}
                            />
                          </React.Suspense>
                        ) : (
                          <p className="py-12 text-center text-xs text-muted-foreground">Data belum cukup untuk menampilkan tren periode ini.</p>
                        )
                      })()}
                    </div>
                  ) : null}
                </>
              )
            })()}
          </div>
        </div>

        {/* Kolom Kanan: Kunjungan, Retensi & Bauran Pembayaran (DIGABUNG) */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm">
          <div>
            <div className="border-b border-border pb-3">
              <HoverHint
                label="Kunjungan & Pelayanan"
                hint="Loyalitas pengunjung, pelayanan pesanan, serta preferensi pembayaran."
                className="text-sm font-semibold tracking-tight text-foreground"
              />
            </div>

            {/* Sub-section A: Kunjungan & Retensi Pelanggan */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-lg border border-border bg-surface p-2.5 text-center">
                <HoverHint
                  label={kpiMap["visitors"]?.label ?? "Pengunjung Unik"}
                  hint="Jumlah pengunjung unik berdasarkan id sesi per hari yang membuka halaman toko."
                  className="text-xs font-medium text-muted-foreground"
                />
                <p className="mt-1.5 text-base font-bold tabular-nums text-foreground">{formatNumber(kpiMap["visitors"]?.value ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-2.5 text-center">
                <HoverHint
                  label={kpiMap["new_customers"]?.label ?? "Pelanggan Baru"}
                  hint="Jumlah pelanggan yang belum pernah memesan sebelum periode ini (dihitung per nomor HP unik)."
                  className="text-xs font-medium text-muted-foreground"
                />
                <p className="mt-1.5 text-base font-bold tabular-nums text-foreground">{formatNumber(kpiMap["new_customers"]?.value ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-2.5 text-center">
                <HoverHint
                  label={kpiMap["repeat_customers"]?.label ?? "Pelanggan Ulang"}
                  hint="Jumlah pelanggan yang sudah pernah memesan sebelum periode ini (dihitung per nomor HP unik)."
                  className="text-xs font-medium text-muted-foreground"
                />
                <p className="mt-1.5 text-base font-bold tabular-nums text-foreground">{formatNumber(kpiMap["repeat_customers"]?.value ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-2.5 text-center">
                <HoverHint
                  label={kpiMap["repeat_order_rate"]?.label ?? "Rasio Pelanggan Ulang"}
                  hint="Persentase pelanggan ulang dari total pelanggan unik yang membeli pada periode ini."
                  className="text-xs font-medium text-muted-foreground"
                />
                <p className="mt-1.5 text-base font-bold tabular-nums text-primary">{formatNumber(kpiMap["repeat_order_rate"]?.value ?? 0)}%</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-2.5 text-center">
                <HoverHint
                  label={kpiMap["completed_orders"]?.label ?? "Pesanan Selesai"}
                  hint="Pesanan yang telah sampai di tujuan dan diterima pembeli."
                  className="text-xs font-medium text-muted-foreground"
                />
                <p className="mt-1.5 text-base font-bold tabular-nums text-foreground">{formatNumber(kpiMap["completed_orders"]?.value ?? 0)}</p>
              </div>
            </div>

            {/* Sub-section B: Bauran Metode Pembayaran */}
            {report.payment_mix.length ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-semibold text-foreground mb-2.5">Metode Pembayaran</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {report.payment_mix.map((row) => {
                    const gross = report.financial.gross_revenue
                    const pct = gross > 0 ? Math.round((row.revenue / gross) * 1000) / 10 : 0
                    const methodLabel = row.method.toLowerCase() === "cod" ? "COD" : "Transfer Bank"
                    return (
                      <div key={row.method} className="rounded-lg border border-border bg-surface p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-foreground">{methodLabel}</span>
                          <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            {pct}% dari {kpiMap["omzet"]?.label ?? "Penjualan Gross"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-base font-bold tabular-nums text-foreground">{formatCurrency(row.revenue)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                          {formatNumber(row.count)} pesanan
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* LAYER 5: ANALISIS KATALOG PRODUK (PRODUK TERLARIS & INTERAKSI DI PALING BAWAH) */}
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        {/* Kolom Kiri: Produk Terlaris - TAMPIL 6 PRODUK */}
        <div className="flex flex-col justify-between overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-5 pb-3">
              <HoverHint
                label="Produk Terlaris"
                hint="Peringkat produk berdasarkan nilai produk terjual dari pesanan fulfillment."
                className="text-sm font-semibold tracking-tight text-foreground"
              />
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {Math.min(6, report.top_products.length)} teratas
              </span>
            </header>
            {report.top_products.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-left text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 w-12 text-center">Foto</th>
                      <th className="px-4 py-2">Nama Produk</th>
                      <th className="px-3 py-2 text-right">Unit</th>
                      <th className="px-3 py-2 text-right">Pesanan</th>
                      <th className="px-4 py-2 text-right">Nilai Produk Terjual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.top_products.slice(0, 6).map((product) => (
                      <tr key={`${product.parent_sku}-${product.name}`} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-center">
                          {product.image ? (
                            <img src={product.image} alt="" className="size-8 mx-auto rounded object-cover border border-border" />
                          ) : (
                            <div className="size-8 mx-auto flex items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
                              {product.name.charAt(0)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 max-w-[200px]">
                          <p className="truncate font-normal text-foreground" title={product.name}>{product.name}</p>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-muted-foreground">{product.parent_sku}</span>
                            <CopySkuButton sku={product.parent_sku} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums text-foreground">{formatNumber(product.units)}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">{formatNumber(product.order_count)}</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums text-foreground">{formatCurrency(product.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                className="min-h-40 border-0 bg-transparent"
                title="Belum ada penjualan produk"
                description="Nilai produk terjual muncul setelah ada pesanan fulfillment pada periode ini."
              />
            )}
          </div>

          {report.top_products.length > 0 ? (
            <div className="border-t border-border p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTopProductsModal(true)}
                className="w-full text-xs font-semibold"
              >
                Lihat semua {report.top_products.length} produk terlaris
                <Icon name="arrow-right" className="ml-1.5 size-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>

        {/* Kolom Kanan: Produk Berdasarkan Interaksi - TAMPIL 6 PRODUK */}
        <ProductBreakdownGrid
          breakdowns={report.product_breakdowns}
          onViewAll={() => setShowInteractionModal(true)}
        />
      </div>

      {/* ========================================================================= */}
      {/* POPUP MODAL 1: RINCIAN PENJUALAN SELURUH PRODUK (TOP SELLERS FULL LIST)  */}
      {/* ========================================================================= */}
      <Dialog open={showTopProductsModal} onOpenChange={setShowTopProductsModal}>
        <DialogContent className="!w-[min(96vw,68rem)] !max-w-5xl flex max-h-[88vh] flex-col gap-0 p-0 overflow-hidden">
          <div className="border-b border-border p-5 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Rincian Penjualan Produk Terlaris
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Peringkat produk berdasarkan nilai produk terjual dan unit fisik dari pesanan fulfillment periode {report.range.label}.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Total Nilai Produk Terjual</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatCurrency(report.top_products.reduce((acc, p) => acc + p.revenue, 0))}
                  </p>
                </div>
                <div className="h-6 w-px bg-border" />
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Total Unit</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatNumber(report.top_products.reduce((acc, p) => acc + p.units, 0))} unit
                  </p>
                </div>
              </div>
            </div>

            {/* Input Pencarian Cepat di dalam Modal */}
            <div className="mt-3">
              <Input
                type="search"
                placeholder="Cari nama produk atau SKU..."
                value={searchQueryTop}
                onChange={(e) => setSearchQueryTop(e.target.value)}
                className="h-8 text-xs max-w-md"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0">
            {filteredTopProductsModal.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs text-left text-xs font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 w-12 text-center">No</th>
                    <th className="px-4 py-2.5 w-14 text-center">Foto</th>
                    <th className="px-4 py-2.5">Produk & SKU</th>
                    <th className="px-4 py-2.5 text-right">Unit Terjual</th>
                    <th className="px-4 py-2.5 text-right">Pesanan</th>
                    <th className="px-4 py-2.5 text-right">Nilai Produk Terjual</th>
                    <th className="px-4 py-2.5 text-right">Porsi Penjualan Gross</th>
                    <th className="px-4 py-2.5 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTopProductsModal.map((product, idx) => {
                    const gross = report.financial.gross_revenue
                    const pct = gross > 0 ? ((product.revenue / gross) * 100).toFixed(1) : "0.0"
                    return (
                      <tr key={`${product.parent_sku}-${product.name}`} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-center text-muted-foreground tabular-nums font-semibold">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {product.image ? (
                            <img src={product.image} alt="" className="size-8 mx-auto rounded object-cover border border-border" />
                          ) : (
                            <div className="size-8 mx-auto flex items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
                              {product.name.charAt(0)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 max-w-md">
                          <Link
                            href={`${routeUrl("admin.products.index")}?search=${encodeURIComponent(product.parent_sku)}`}
                            className="font-normal text-foreground hover:text-primary hover:underline leading-snug block"
                            title={`Kelola ${product.name} di admin`}
                          >
                            {product.name}
                          </Link>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-xs text-muted-foreground">{product.parent_sku}</span>
                            <CopySkuButton sku={product.parent_sku} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-foreground">
                          {formatNumber(product.units)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                          {formatNumber(product.order_count)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums text-foreground">
                          {formatCurrency(product.revenue)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                            {pct}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`${routeUrl("admin.products.index")}?search=${encodeURIComponent(product.parent_sku)}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                              title="Kelola produk di panel admin"
                            >
                              Kelola
                            </Link>
                            <span className="text-muted-foreground/40">·</span>
                            <a
                              href={`/product/${product.parent_sku}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-muted-foreground hover:text-foreground"
                              title="Buka tampilan etalase toko"
                            >
                              <Icon name="arrow-up-right" className="size-3" aria-hidden="true" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Tidak ada produk yang cocok dengan pencarian "{searchQueryTop}".
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3 text-xs">
            <span className="text-muted-foreground">
              Menampilkan {filteredTopProductsModal.length} dari {report.top_products.length} produk
            </span>
            <Button size="sm" variant="secondary" onClick={() => setShowTopProductsModal(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* POPUP MODAL 2: RINCIAN INTERAKSI PRODUK (VIEWS / CLICKS / SELLERS FULL)   */}
      {/* ========================================================================= */}
      <Dialog open={showInteractionModal} onOpenChange={setShowInteractionModal}>
        <DialogContent className="!w-[min(96vw,68rem)] !max-w-5xl flex max-h-[88vh] flex-col gap-0 p-0 overflow-hidden">
          <div className="border-b border-border p-5 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Rincian Interaksi & Minat Produk
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Data aktivitas pengunjung (tampilan halaman & klik) dibanding produk yang paling banyak terjual.
                </DialogDescription>
              </div>

              {/* Tab Selector di dalam Modal */}
              <div className="flex gap-1">
                {([
                  ["viewed", "Paling Dilihat"],
                  ["clicked", "Paling Diklik"],
                  ["sellers", "Terlaris"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModalInteractionTab(key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition",
                      modalInteractionTab === key
                        ? "bg-foreground text-background shadow-xs font-semibold"
                        : "bg-surface text-muted-foreground hover:text-foreground border border-border",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Pencarian Cepat di dalam Modal */}
            <div className="mt-3">
              <Input
                type="search"
                placeholder="Cari nama produk atau SKU..."
                value={searchQueryInteraction}
                onChange={(e) => setSearchQueryInteraction(e.target.value)}
                className="h-8 text-xs max-w-md"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0">
            {interactionModalData.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs text-left text-xs font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 w-12 text-center">No</th>
                    <th className="px-4 py-2.5 w-14 text-center">Foto</th>
                    <th className="px-4 py-2.5">Produk & SKU</th>
                    {modalInteractionTab === "sellers" ? (
                      <>
                        <th className="px-4 py-2.5 text-right">Unit Terjual</th>
                        <th className="px-4 py-2.5 text-right">Total Nilai Penjualan</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-2.5 text-right">Dilihat</th>
                        <th className="px-4 py-2.5 text-right">Diklik</th>
                        <th className="px-4 py-2.5 text-right">Rasio Klik / Lihat</th>
                      </>
                    )}
                    <th className="px-4 py-2.5 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {interactionModalData.map((item, idx) => {
                    const product = item as ProductBreakdown
                    const views = product.views ?? 0
                    const clicks = product.clicks ?? 0
                    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) + "%" : "-"
                    return (
                      <tr key={`${product.parent_sku}-${product.product_id}`} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-center text-muted-foreground tabular-nums font-semibold">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {product.image ? (
                            <img src={product.image} alt="" className="size-8 mx-auto rounded object-cover border border-border" />
                          ) : (
                            <div className="size-8 mx-auto flex items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
                              {product.name.charAt(0)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 max-w-md">
                          <Link
                            href={`${routeUrl("admin.products.index")}?search=${encodeURIComponent(product.parent_sku)}`}
                            className="font-normal text-foreground hover:text-primary hover:underline leading-snug block"
                            title={`Kelola ${product.name} di admin`}
                          >
                            {product.name}
                          </Link>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-xs text-muted-foreground">{product.parent_sku}</span>
                            <CopySkuButton sku={product.parent_sku} />
                          </div>
                        </td>
                        {modalInteractionTab === "sellers" ? (
                          <>
                            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-foreground">
                              {formatNumber(product.units ?? 0)} unit
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-primary">
                              {formatCurrency(product.revenue ?? 0)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                              {formatNumber(views)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium tabular-nums text-muted-foreground">
                              {formatNumber(clicks)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                                {ctr}
                              </span>
                            </td>
                          </>
                        )}
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`${routeUrl("admin.products.index")}?search=${encodeURIComponent(product.parent_sku)}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                              title="Kelola produk di panel admin"
                            >
                              Kelola
                            </Link>
                            <span className="text-muted-foreground/40">·</span>
                            <a
                              href={`/product/${product.parent_sku}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-muted-foreground hover:text-foreground"
                              title="Buka tampilan etalase toko"
                            >
                              <Icon name="arrow-up-right" className="size-3" aria-hidden="true" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Tidak ada data yang cocok dengan pencarian "{searchQueryInteraction}".
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3 text-xs">
            <span className="text-muted-foreground">
              Menampilkan {interactionModalData.length} data produk
            </span>
            <Button size="sm" variant="secondary" onClick={() => setShowInteractionModal(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
