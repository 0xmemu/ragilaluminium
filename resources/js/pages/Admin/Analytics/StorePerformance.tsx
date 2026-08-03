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

interface Kpi {
  key: string
  label: string
  value: number
  previous: number
  change_percent: number | null
  format: "currency" | "number" | "percent" | "hours" | "days"
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
}

function formatKpiValue(kpi: Kpi): string {
  switch (kpi.format) {
    case "currency":
      return formatCurrency(kpi.value)
    case "percent":
      return `${formatNumber(kpi.value)}%`
    case "hours":
      return `${formatNumber(kpi.value)} jam`
    case "days":
      return `${formatNumber(kpi.value)} hari`
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
      return `${formatNumber(kpi.previous)} jam`
    case "days":
      return `${formatNumber(kpi.previous)} hari`
    default:
      return formatNumber(kpi.previous)
  }
}

function TrendSparkline({ series }: { series: SeriesPoint[] }) {
  const max = Math.max(...series.map((point) => point.value), 1)

  return (
    <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label="Grafik tren">
      {series.map((point) => (
        <div key={point.bucket} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-sm bg-primary/80"
            style={{ height: `${Math.max(4, (point.value / max) * 100)}%` }}
            title={`${point.label}: ${point.value}`}
          />
          {series.length <= 14 ? (
            <span className="truncate text-[10px] text-muted-foreground">{point.label}</span>
          ) : null}
        </div>
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
  const [period, setPeriod] = React.useState(filters.period)
  const [from, setFrom] = React.useState(filters.from)
  const [to, setTo] = React.useState(filters.to)
  const [granularity, setGranularity] = React.useState(filters.granularity)

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
        <Button asChild variant="secondary">
          <a href={exportUrl}>
            <Icon name="download" className="size-4" aria-hidden="true" />
            Unduh CSV
          </a>
        </Button>
      }
    >
      <Head title={`${title} | Admin`} />

      <section className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Tinjauan bisnis</p>
            <h2 className="mt-1 text-xl font-bold">{report.range.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {report.range.from_date} – {report.range.to_date} · {report.range.compare_label}
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
      </section>

      <div className="space-y-6">
        {report.sections.map((section) => (
          <section key={section.key} className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
            <header className="border-b border-border px-4 py-3">
              <h3 className="text-base font-bold">{section.title}</h3>
            </header>
            <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-5">
              {section.kpis.map((kpi, index) => (
                <article
                  key={kpi.key}
                  className={cn(
                    "px-4 py-5",
                    index > 0 && "border-t border-border sm:border-t-0 sm:border-l",
                    index >= 2 && "xl:border-l",
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">{kpi.label}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{formatKpiValue(kpi)}</p>
                  <p
                    className={cn(
                      "mt-2 text-xs font-semibold",
                      (kpi.change_percent ?? 0) > 0 && "text-success",
                      (kpi.change_percent ?? 0) < 0 && "text-destructive",
                      (kpi.change_percent ?? 0) === 0 && "text-muted-foreground",
                    )}
                  >
                    {kpi.change_percent === null
                      ? "—"
                      : `${kpi.change_percent > 0 ? "+" : ""}${formatNumber(kpi.change_percent)}%`}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {report.range.compare_label} ({formatPrevious(kpi)})
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {report.charts.map((chart) => (
          <section key={chart.key} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold">
                {chart.title} ({report.range.granularity === "hour" ? "Per Jam" : report.range.granularity === "week" ? "Per Minggu" : report.range.granularity === "month" ? "Per Bulan" : "Per Hari"})
              </h3>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Total</p>
                <p className="text-sm font-bold tabular-nums">
                  {chart.total_format === "currency" ? formatCurrency(chart.total) : formatNumber(chart.total)}
                </p>
              </div>
            </div>
            {chart.series.length ? (
              <TrendSparkline series={chart.series} />
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">Belum ada data tren.</p>
            )}
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:sm:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
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

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
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
                          <p className="font-mono text-[11px] text-muted-foreground">{customer.customer_phone}</p>
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
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{customer.customer_phone}</p>
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

      {report.payment_mix.length ? (
        <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-base font-bold">Bauran metode bayar (omzet)</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {report.payment_mix.map((row) => (
              <li key={row.method} className="rounded-md border border-border px-3 py-2 text-sm">
                <p className="font-semibold uppercase">{row.method}</p>
                <p className="tabular-nums text-muted-foreground">
                  {formatNumber(row.count)} order · {formatCurrency(row.revenue)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AdminLayout>
  )
}
