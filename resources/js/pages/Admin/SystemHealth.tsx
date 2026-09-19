import { Head, router } from "@inertiajs/react"
import * as React from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

/**
 * System Health Console.
 *
 * Fokus pemantauan resource server dan tren metrik operasional:
 * 1. Header (title, deskripsi, waktu pemeriksaan WIB, primary action 40px)
 * 2. Resource server (4 card metrik: Load average, Memori, Disk, Media storage R2)
 * 3. Tren resource (CPU & Memori %, Load average 1m, Database latency ms)
 *    dilengkapi filter periode operasional server (6 Jam, 12 Jam, 24 Jam, 3 Hari, 7 Hari).
 */

type HealthStatus =
  | "healthy"
  | "warning"
  | "failed"
  | "offline"
  | "not_configured"
  | "checking"
  | "unknown"

interface HealthAction {
  label: string
  href?: string
}

interface HealthCheck {
  key: string
  name: string
  group: "infrastructure" | "integration"
  provider: string | null
  status: HealthStatus
  summary: string
  checked_at: string
  latency_ms: number | null
  action: HealthAction | null
  details: string[]
}

interface HealthSummary {
  total: number
  counts: Record<HealthStatus, number>
  overall: HealthStatus
  headline: string
  failed_names: string[]
  checked_at: string | null
}

interface ServerMetrics {
  taken_at: string
  load_1: number | null
  load_5: number | null
  load_15: number | null
  vcpu: number | null
  cpu_pct: number | null
  memory_used_mb: number | null
  memory_total_mb: number | null
  memory_pct: number | null
  disk_used_gb: number | null
  disk_total_gb: number | null
  disk_pct: number | null
  disk_mount: string | null
  db_response_ms: number | null
  queue_backlog: number | null
  php_memory_mb: number | null
  php_peak_mb: number | null
  r2_used_gb?: number | null
  r2_limit_gb?: number | null
  r2_pct?: number | null
  r2_object_count?: number | null
  r2_bucket?: string | null
}

interface HistoryPoint {
  taken_at: string
  taken_iso: string
  load_1: number | null
  cpu_pct: number | null
  memory_pct: number | null
  disk_pct: number | null
  db_response_ms: number | null
  queue_backlog: number | null
}

interface PeriodOption {
  value: string
  label: string
}

const STATUS_META: Record<HealthStatus, { label: string; dot: string; text: string }> = {
  healthy: { label: "Sehat", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  warning: { label: "Perlu Perhatian", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  failed: { label: "Gagal", dot: "bg-destructive", text: "text-destructive" },
  offline: { label: "Offline", dot: "bg-destructive", text: "text-destructive" },
  not_configured: { label: "Belum Dikonfigurasi", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  checking: { label: "Memeriksa", dot: "bg-primary animate-pulse", text: "text-muted-foreground" },
  unknown: { label: "Tidak Diketahui", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
}

function jamWIB(iso: string | null): string {
  if (!iso) return "-"
  const date = new Date(iso)
  return (
    date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB"
  )
}

function tanggalJamWIB(iso: string | null): string {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }) + " WIB"
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.unknown
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", meta.text)}>
      <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

interface Metric {
  label: string
  value: string
  detail: string
  status: HealthStatus
  hint: string
}

function ResourceMetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <section aria-label="Resource server">
      <h2 className="mb-2.5 text-sm font-semibold tracking-tight text-foreground">Resource server</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border border-border bg-card p-4 transition-colors hover:border-border/80">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
              {metric.status !== "healthy" && metric.status !== "unknown" ? (
                <StatusBadge status={metric.status} />
              ) : null}
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">{metric.value}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground" title={metric.hint}>
              {metric.detail}
            </p>
          </Card>
        ))}
      </div>
    </section>
  )
}

interface SingleTrendSeries {
  key: string
  dataKey: string
  name: string
  color: string
  unit: string
  format: (val: number) => string
}

function ChartCustomTooltip({
  active,
  payload,
  label,
  seriesList,
}: {
  active?: boolean
  payload?: Array<{ payload?: Record<string, unknown> }>
  label?: string
  seriesList: SingleTrendSeries[]
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div className="rounded-lg border border-border bg-popover/95 backdrop-blur-sm px-3.5 py-2.5 shadow-lg">
      <p className="text-[11px] font-medium text-muted-foreground">Waktu: {label} WIB</p>
      <ul className="mt-1.5 space-y-1">
        {seriesList.map((item) => {
          const rawVal = row[item.dataKey]
          const numVal = typeof rawVal === "number" ? rawVal : null
          return (
            <li key={item.key} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
              <span className="font-semibold tabular-nums text-foreground">
                {numVal !== null ? item.format(numVal) : "-"}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TrendChartCard({
  title,
  subtitle,
  freshness,
  conditionSummary,
  seriesList,
  data,
  yDomain,
  yUnit,
  heightClass = "h-56",
  ariaLabel,
  onRunChecks,
  runLoading,
}: {
  title: string
  subtitle: string
  freshness: string
  conditionSummary: string
  seriesList: SingleTrendSeries[]
  data: Record<string, unknown>[]
  yDomain?: [number | "auto", number | "auto"]
  yUnit?: string
  heightClass?: string
  ariaLabel: string
  onRunChecks: () => void
  runLoading: boolean
}) {
  const hasPoints = data.length > 1

  return (
    <Card className="border border-border bg-card">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          <span className="text-[11px] text-muted-foreground">{freshness}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          <p className="text-xs font-medium text-foreground/90">{conditionSummary}</p>
        </div>
      </div>

      {hasPoints ? (
        <div className="p-4">
          <div className={heightClass} role="img" aria-label={ariaLabel}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/70" />
                <XAxis dataKey="taken_at" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis
                  tick={{ fontSize: 10 }}
                  domain={yDomain ?? [0, "auto"]}
                  unit={yUnit ? yUnit : undefined}
                />
                <Tooltip content={<ChartCustomTooltip seriesList={seriesList} />} />
                {seriesList.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/50 pt-2.5">
            {seriesList.map((item) => {
              const lastRow = [...data].reverse().find((r) => r[item.dataKey] !== null && r[item.dataKey] !== undefined)
              const lastVal = lastRow ? (lastRow[item.dataKey] as number | null) : null

              return (
                <li key={item.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-1 w-3.5 rounded" style={{ backgroundColor: item.color }} aria-hidden="true" />
                  <span className="text-foreground/80">{item.name}</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {lastVal !== null ? item.format(lastVal) : "-"}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Belum ada data tren</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            Data akan terkumpul secara otomatis setiap 15 menit dan setiap pemeriksaan sistem dijalankan.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 min-h-[40px] h-10 px-4 text-xs active:scale-[0.98] transition-transform duration-150"
            onClick={onRunChecks}
            disabled={runLoading}
          >
            {runLoading ? "Memeriksa..." : "Jalankan pemeriksaan"}
          </Button>
        </div>
      )}
    </Card>
  )
}

const DEFAULT_PERIOD_OPTIONS: PeriodOption[] = [
  { value: "6h", label: "6 Jam" },
  { value: "12h", label: "12 Jam" },
  { value: "24h", label: "24 Jam" },
  { value: "3d", label: "3 Hari" },
  { value: "7d", label: "7 Hari" },
]

export default function SystemHealth({
  title,
  description,
  runUrl,
  server,
  history = [],
  lastCheckedAt,
  period = "24h",
  periodOptions = DEFAULT_PERIOD_OPTIONS,
}: {
  title: string
  description: string
  checks?: HealthCheck[]
  summary?: HealthSummary
  runUrl: string
  server: ServerMetrics
  history: HistoryPoint[]
  lastCheckedAt: string | null
  period?: string
  periodOptions?: PeriodOption[]
}) {
  const [running, setRunning] = React.useState(false)
  const [periodLoading, setPeriodLoading] = React.useState(false)
  const [nowMs] = React.useState(() => Date.now())

  function runChecks() {
    setRunning(true)
    router.post(runUrl, {}, { onFinish: () => setRunning(false) })
  }

  function handlePeriodChange(newPeriod: string) {
    if (newPeriod === period || periodLoading) return
    setPeriodLoading(true)

    // P2-4 (audit 2026-09-20): only[] membatasi reload ke data histori saja,
    // sehingga pergantian periode tidak lagi menjalankan ulang checks()
    // (sebelumnya 3,7 detik + panggilan API eksternal tiap klik).
    // P2-5: query period selalu eksplisit di URL sejak klik pertama supaya
    // tampilan bisa dibagikan dan refresh tetap pada periode terpilih.
    router.get(
      routeUrl("admin.settings.index"),
      { period: newPeriod },
      {
        preserveState: true,
        preserveScroll: true,
        replace: true,
        only: ["history", "period", "server"],
        onFinish: () => setPeriodLoading(false),
      },
    )
  }

  // 1. Resource metrics computation
  const loadHealthy = server.load_1 !== null && server.vcpu !== null ? server.load_1 / server.vcpu < 0.9 : true
  const loadDetail =
    server.load_1 === null
      ? "Tidak dapat dibaca"
      : server.vcpu === null
        ? "Jumlah vCPU tidak terbaca"
        : `${loadHealthy ? "Normal" : "Tinggi"} · ${server.vcpu} vCPU`

  const memStatus: HealthStatus =
    server.memory_pct === null ? "unknown" : server.memory_pct > 90 ? "failed" : server.memory_pct >= 75 ? "warning" : "healthy"
  const diskStatus: HealthStatus =
    server.disk_pct === null ? "unknown" : server.disk_pct > 90 ? "failed" : server.disk_pct >= 75 ? "warning" : "healthy"

  // Disk delta from previous snapshot
  const prevSnapshot = history.length >= 2 ? history[history.length - 2] : null
  const prevDisk = prevSnapshot ? prevSnapshot.disk_pct : null
  const diskDelta =
    server.disk_pct !== null && prevDisk !== null
      ? server.disk_pct - prevDisk
      : null
  const diskDeltaText =
    diskDelta !== null
      ? (Math.abs(diskDelta) < 0.05
          ? "Stabil sejak pemeriksaan sebelumnya"
          : (diskDelta >= 0 ? `+${diskDelta.toFixed(1)}%` : `${diskDelta.toFixed(1)}%`) + " sejak pemeriksaan sebelumnya")
      : "Periksa tren untuk menilai pertumbuhan"

  const dbLatencyValue =
    server.db_response_ms === null
      ? "Belum tersedia"
      : server.db_response_ms < 1
        ? "<1 ms"
        : `${Math.round(server.db_response_ms)} ms`

  const metrics: Metric[] = [
    {
      label: "Load average",
      value: server.load_1 === null ? "Tidak tersedia" : server.load_1.toFixed(2),
      detail: `${loadDetail} · 5m ${server.load_5?.toFixed(2) ?? "-"}`,
      status: loadHealthy ? "healthy" : "warning",
      hint: "Rata-rata beban proses selama 1 menit, dibandingkan jumlah vCPU.",
    },
    {
      label: "Memori terpakai",
      value: server.memory_pct === null ? "Tidak tersedia" : server.memory_pct.toFixed(1) + "%",
      detail:
        server.memory_used_mb === null
          ? "Belum ada pembacaan"
          : `${(server.memory_used_mb / 1024).toFixed(2)} GB dari ${((server.memory_total_mb ?? 0) / 1024).toFixed(2)} GB`,
      status: memStatus,
      hint: "Perlu perhatian di atas 75%, kritis di atas 90%.",
    },
    {
      label: `Disk terpakai${server.disk_mount ? " · " + server.disk_mount : ""}`,
      value: server.disk_pct === null ? "Tidak tersedia" : server.disk_pct.toFixed(1) + "%",
      detail:
        server.disk_used_gb === null
          ? "Belum ada pembacaan"
          : `${server.disk_used_gb.toFixed(1)} GB dari ${(server.disk_total_gb ?? 0).toFixed(1)} GB · ${diskDeltaText}`,
      status: diskStatus,
      hint: "Periksa tren untuk menilai pertumbuhan, bukan satu pembacaan.",
    },
    {
      label: "Media storage · Cloudflare R2",
      value:
        server.r2_used_gb !== null && server.r2_used_gb !== undefined
          ? `${server.r2_used_gb.toFixed(2)} GB`
          : "Belum tersedia",
      detail:
        server.r2_used_gb !== null && server.r2_used_gb !== undefined
          ? `${server.r2_used_gb.toFixed(2)} GB dari ${(server.r2_limit_gb ?? 10).toFixed(0)} GB (${(server.r2_pct ?? 0).toFixed(1)}%) · ${(server.r2_object_count ?? 0).toLocaleString("id-ID")} objek`
          : "Penyimpanan media di Cloudflare R2",
      status:
        server.r2_pct === null || server.r2_pct === undefined
          ? "unknown"
          : server.r2_pct > 90
            ? "failed"
            : server.r2_pct >= 75
              ? "warning"
              : "healthy",
      hint: "Kapasitas terpakai pada bucket Cloudflare R2 untuk media gambar dan katalog.",
    },
  ]

  // 2. Stale check & timestamp
  const lastRunIso = lastCheckedAt
  const staleMs = lastRunIso ? nowMs - new Date(lastRunIso).getTime() : null
  const isStale = staleMs !== null && staleMs > 30 * 60 * 1000
  const waktuPemeriksaan = tanggalJamWIB(lastRunIso)
  const freshnessWIB = `Diperbarui ${jamWIB(lastRunIso)}`

  // P2-7 (audit 2026-09-20): bila data yang ada lebih pendek dari rentang
  // periode terpilih, katakan jujur berapa rentang efektifnya supaya admin
  // tidak mengira grafik 8 jam itu gambaran 7 hari.
  const periodHours: Record<string, number> = { "6h": 6, "12h": 12, "24h": 24, "3d": 72, "7d": 168 }
  let effectiveRangeNote: string | null = null
  if (history.length >= 2) {
    const oldestIso = history[0]?.taken_iso
    const spanHours = oldestIso ? (nowMs - new Date(oldestIso).getTime()) / 3_600_000 : 0
    const wanted = periodHours[period] ?? 24
    if (spanHours < wanted * 0.75) {
      const jamTersisa = Math.max(1, Math.round(spanHours))
      effectiveRangeNote = `Data baru lengkap sebagian: baru tersedia sekitar ${jamTersisa} jam terakhir, bukan ${wanted >= 24 ? (wanted / 24) + " hari" : wanted + " jam"}.`
    }
  }

  // 3. Chart data preparations
  const historyData = history.map((pt) => ({
    taken_at: pt.taken_at,
    cpu_pct: pt.cpu_pct,
    memory_pct: pt.memory_pct,
    load_1: pt.load_1,
    db_response_ms: pt.db_response_ms,
  }))

  const cpuMemSeries: SingleTrendSeries[] = [
    {
      key: "cpu",
      dataKey: "cpu_pct",
      name: "CPU utilization",
      color: "hsl(var(--primary))",
      unit: "%",
      format: (v) => v.toFixed(1) + "%",
    },
    {
      key: "memory",
      dataKey: "memory_pct",
      name: "Memory used",
      color: "#f59e0b",
      unit: "%",
      format: (v) => v.toFixed(1) + "%",
    },
  ]

  const loadSeries: SingleTrendSeries[] = [
    {
      key: "load",
      dataKey: "load_1",
      name: "Load average 1 menit",
      color: "#6366f1",
      unit: "",
      format: (v) => v.toFixed(2),
    },
  ]

  const dbSeries: SingleTrendSeries[] = [
    {
      key: "database",
      dataKey: "db_response_ms",
      name: "Health check latency",
      color: "#10b981",
      unit: "ms",
      format: (v) => (v < 1 ? "<1 ms" : Math.round(v) + " ms"),
    },
  ]

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-col items-stretch gap-2 sm:items-end w-full sm:w-auto">
          <span className="text-[11px] tabular-nums text-muted-foreground text-center sm:text-right">
            Pemeriksaan terakhir: {waktuPemeriksaan}
          </span>
          <Button
            type="button"
            onClick={runChecks}
            disabled={running}
            aria-busy={running}
            className="min-h-[40px] h-10 w-full sm:w-auto px-4 shadow-sm active:scale-[0.98] transition-transform duration-150"
          >
            <Icon
              name={running ? "spinner" : "refresh"}
              className={cn("size-4", running && "animate-spin")}
              aria-hidden="true"
            />
            {running ? "Memeriksa..." : "Jalankan pemeriksaan"}
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <div className="space-y-6">
        {/* Warning jika data stale */}
        {isStale ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
            Data mungkin sudah lama. Pemeriksaan terakhir {Math.round((staleMs ?? 0) / 60000)} menit lalu.
          </p>
        ) : null}

        {/* 1. Resource server (4 Card) */}
        <ResourceMetricGrid metrics={metrics} />

        {/* 2. Tren resource dengan filter periode operasional */}
        <section aria-label="Tren resource" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Tren resource</h2>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  ({history.length} titik riwayat)
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Snapshot berkala tiap 15 menit dan setiap pemeriksaan sistem dijalankan. Waktu Indonesia Barat (WIB).
              </p>
              {effectiveRangeNote ? (
                <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">{effectiveRangeNote}</p>
              ) : null}
            </div>

            {/* Filter periode operasional server */}
            <div
              className="flex items-center gap-1 self-start rounded-lg border border-border bg-surface p-1 shadow-sm sm:self-auto"
              role="group"
              aria-label="Pilih periode tren resource"
            >
              {periodOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePeriodChange(opt.value)}
                  disabled={periodLoading}
                  aria-pressed={period === opt.value}
                  className={cn(
                    "min-h-[40px] rounded-md px-3 text-xs font-medium transition-all duration-150 active:scale-[0.97]",
                    period === opt.value
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grafik 1: CPU & Memori (%) - Full width */}
          <TrendChartCard
            title="CPU & memori"
            subtitle="Histori pemeriksaan · WIB"
            freshness={freshnessWIB}
            conditionSummary={`Memori ${server.memory_pct?.toFixed(1) ?? "-"}% · CPU ${server.cpu_pct?.toFixed(1) ?? "-"}%`}
            seriesList={cpuMemSeries}
            data={historyData}
            yDomain={[0, 100]}
            yUnit="%"
            heightClass="h-64"
            ariaLabel={`CPU utilization ${server.cpu_pct?.toFixed(1) ?? "-"}%, memori ${server.memory_pct?.toFixed(1) ?? "-"}%`}
            onRunChecks={runChecks}
            runLoading={running}
          />

          {/* Grid 2 kolom: Load Average & Database Latency */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Grafik 2: Load average */}
            <TrendChartCard
              title="Load average"
              subtitle="Rata-rata beban proses · WIB"
              freshness={freshnessWIB}
              conditionSummary={`Load 1m ${server.load_1?.toFixed(2) ?? "-"} · ${server.vcpu ?? 1} vCPU`}
              seriesList={loadSeries}
              data={historyData}
              heightClass="h-52"
              ariaLabel={`Load average 1 menit ${server.load_1?.toFixed(2) ?? "-"}`}
              onRunChecks={runChecks}
              runLoading={running}
            />

            {/* Grafik 3: Database latency */}
            <TrendChartCard
              title="Database latency"
              subtitle="Waktu respon query ping · WIB"
              freshness={freshnessWIB}
              conditionSummary={`Latency ${dbLatencyValue} · query ping`}
              seriesList={dbSeries}
              data={historyData}
              yUnit="ms"
              heightClass="h-52"
              ariaLabel={`Database ping latency ${dbLatencyValue}`}
              onRunChecks={runChecks}
              runLoading={running}
            />
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
