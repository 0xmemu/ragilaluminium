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

/**
 * System Health Console.
 *
 * Urutan informasi mengikuti kontrak admin UI: status global, masalah yang
 * perlu ditangani, resource server, status layanan, grafik tren, lalu detail
 * teknis yang dilipat. Setiap status punya teks, bukan hanya warna.
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

interface EnvInfo {
  app_env: string
  whatsapp_number_id: string | null
  jnt_environment: string
  queue_connection: string
  cache_store: string
  media_disk: string
}

/** Kosakata status: teks, warna dot, dan gaya badge. */
const STATUS_META: Record<HealthStatus, { label: string; dot: string; text: string }> = {
  healthy: { label: "Sehat", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  warning: { label: "Perlu Perhatian", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  failed: { label: "Gagal", dot: "bg-destructive", text: "text-destructive" },
  offline: { label: "Offline", dot: "bg-destructive", text: "text-destructive" },
  not_configured: { label: "Belum Dikonfigurasi", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  checking: { label: "Memeriksa", dot: "bg-primary animate-pulse", text: "text-muted-foreground" },
  unknown: { label: "Tidak Diketahui", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
}

/** Status yang butuh tindakan: dipakai untuk AttentionPanel. */
const NEEDS_ATTENTION: HealthStatus[] = ["warning", "failed", "offline", "not_configured", "unknown"]

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
  })
}

function maskId(value: string | null): string {
  if (!value) return "-"
  if (value.length <= 6) return "••••"
  return value.slice(0, 3) + " •••• " + value.slice(-4)
}

/** Status dot + teks. Warna tidak pernah jadi satu-satunya pembeda. */
function StatusBadge({ status }: { status: HealthStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.unknown
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", meta.text)}>
      <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// 4. Resource server
// ---------------------------------------------------------------------------

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
          <Card
            key={metric.label}
            className={cn(
              "border p-4",
              metric.status === "healthy" || metric.status === "unknown"
                ? "border-border bg-card"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
              {metric.status !== "healthy" && metric.status !== "unknown" ? (
                <StatusBadge status={metric.status} />
              ) : null}
            </div>
            <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">{metric.value}</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground" title={metric.hint}>
              {metric.detail}
            </p>
          </Card>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 5 dan 6. Panel layanan
// ---------------------------------------------------------------------------

function ServiceHealthRow({ check }: { check: HealthCheck }) {
  const [open, setOpen] = React.useState(false)
  const hasDetails = check.details.length > 0

  return (
    <li className="px-4 py-3 transition hover:bg-muted/20 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{check.name}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {check.provider ? <span className="text-foreground/70">{check.provider}</span> : null}
            {check.provider ? " · " : null}
            {check.summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {jamWIB(check.checked_at)}
          </span>
          <StatusBadge status={check.status} />
        </div>
      </div>

      {check.action || hasDetails ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {check.action?.href ? (
            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
              <a href={check.action.href}>{check.action.label}</a>
            </Button>
          ) : [
            check.status === "not_configured" ? null : (
              <Button
                key="detail"
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
              >
                {open ? "Sembunyikan" : check.action?.label ?? "Lihat detail"}
              </Button>
            ),
          ]}
        </div>
      ) : null}

      {open && hasDetails ? (
        <ul className="mt-2 space-y-1 border-l-2 border-border pl-3">
          {check.details.map((detail) => (
            <li key={detail} className="text-xs leading-5 text-muted-foreground">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function ServiceHealthPanel({ title, checks }: { title: string; checks: HealthCheck[] }) {
  if (checks.length === 0) return null

  return (
    <Card className="overflow-hidden border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{checks.length} layanan diperiksa</span>
      </div>
      <ul className="divide-y divide-border">
        {checks.map((check) => (
          <ServiceHealthRow key={check.key} check={check} />
        ))}
      </ul>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 12. Grafik tren: satu grafik satu satuan
// ---------------------------------------------------------------------------

function TrendTooltip({
  active,
  payload,
  label,
  format,
  unitLabel,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | null; color?: string; dataKey?: string }>
  label?: string
  format: (value: number) => string
  unitLabel: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-[11px] text-muted-foreground">Pukul {label} WIB</p>
      <ul className="mt-1 space-y-0.5">
        {payload
          .filter((entry) => entry.value !== null && entry.value !== undefined)
          .map((entry) => (
            <li key={entry.dataKey} className="flex items-center gap-2 text-xs">
              <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-semibold tabular-nums text-foreground">{format(Number(entry.value))}</span>
            </li>
          ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">{unitLabel}</p>
    </div>
  )
}

function ChartFrame({
  title,
  subtitle,
  summaryText,
  legend,
  hasData,
  onRun,
  children,
}: {
  title: string
  subtitle: string
  summaryText: string
  legend: Array<{ label: string; color: string }>
  hasData: boolean
  onRun: () => void
  children: React.ReactNode
}) {
  return (
    <Card className="border border-border bg-card">
      <div className="border-b border-border px-5 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          <span className="text-[11px] text-muted-foreground">{subtitle}</span>
        </div>
        {hasData ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{summaryText}</p>
        ) : null}
      </div>

      {hasData ? (
        <div className="p-4">
          <div className="h-48" role="img" aria-label={summaryText}>
            {children}
          </div>
          <ul className="mt-2 flex flex-wrap items-center gap-3">
            {legend.map((item) => (
              <li key={item.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-0.5 w-4 rounded" style={{ backgroundColor: item.color }} aria-hidden="true" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Belum ada data tren</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            Data akan muncul setelah pemeriksaan sistem berikutnya. Snapshot otomatis diambil tiap 15 menit.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={onRun}>
            Jalankan pemeriksaan
          </Button>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Halaman
// ---------------------------------------------------------------------------

export default function SystemHealth({
  title,
  description,
  checks = [],
  summary,
  env,
  runUrl,
  server,
  history = [],
  lastCheckedAt,
}: {
  title: string
  description: string
  checks: HealthCheck[]
  summary: HealthSummary
  env: EnvInfo
  runUrl: string
  server: ServerMetrics
  history: HistoryPoint[]
  lastCheckedAt: string | null
}) {
  const [running, setRunning] = React.useState(false)
  const [showConfig, setShowConfig] = React.useState(false)

  // Waktu acuan diambil sekali saat mount. Memanggil Date.now() langsung di
  // badan render membuat hasil render tidak stabil (aturan purity React).
  const [nowMs] = React.useState(() => Date.now())

  function runChecks() {
    setRunning(true)
    router.post(runUrl, {}, { onFinish: () => setRunning(false) })
  }

  // ---- Resource server ----
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
  const dbStatus: HealthStatus =
    server.db_response_ms === null ? "unknown" : server.db_response_ms >= 1000 ? "failed" : server.db_response_ms >= 200 ? "warning" : "healthy"

  const metrics: Metric[] = [
    {
      label: "Load average",
      value: server.load_1 === null ? "Tidak tersedia" : server.load_1.toFixed(2),
      detail: `${loadDetail} · 5 menit ${server.load_5?.toFixed(2) ?? "-"}`,
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
          : `${server.disk_used_gb.toFixed(1)} GB dari ${(server.disk_total_gb ?? 0).toFixed(1)} GB`,
      status: diskStatus,
      hint: "Periksa tren untuk menilai pertumbuhan, bukan satu pembacaan.",
    },
    {
      label: "Database latency",
      value: server.db_response_ms === null ? "Belum tersedia" : `${Math.round(server.db_response_ms)} ms`,
      detail:
        server.queue_backlog === null
          ? "Health check belum dijalankan"
          : `Health check terakhir · queue ${server.queue_backlog} pekerjaan`,
      status: dbStatus,
      hint: "Waktu query ping. Perlu perhatian di atas 200 ms.",
    },
  ]

  // ---- Perlu perhatian ----
  const attentionItems = checks.filter((check) => NEEDS_ATTENTION.includes(check.status))
  const counts = summary.counts

  // ---- Grafik ----
  const cpuMemoryPoints = history.filter((point) => point.cpu_pct !== null || point.memory_pct !== null)
  const loadPoints = history.filter((point) => point.load_1 !== null)
  const dbPoints = history.filter((point) => point.db_response_ms !== null)

  const lastPoint = history.length > 0 ? history[history.length - 1] : null
  const memNow = lastPoint?.memory_pct ?? server.memory_pct
  const cpuNow = lastPoint?.cpu_pct ?? server.cpu_pct

  const lastRunIso = lastCheckedAt ?? summary.checked_at
  const staleMs = lastRunIso ? nowMs - new Date(lastRunIso).getTime() : null
  const isStale = staleMs !== null && staleMs > 30 * 60 * 1000

  const infrastructure = checks.filter((check) => check.group === "infrastructure")
  const integrations = checks.filter((check) => check.group === "integration")

  const waktuPemeriksaan = tanggalJamWIB(lastRunIso)

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <span className="text-[11px] text-muted-foreground">
            Pemeriksaan terakhir {waktuPemeriksaan}
          </span>
          <Button type="button" onClick={runChecks} disabled={running} aria-busy={running}>
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
        {/* 4. Status global */}
        <Card className="border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full border",
                summary.overall === "healthy"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : summary.overall === "failed"
                    ? "border-destructive/40 bg-destructive/15 text-destructive"
                    : "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400",
              )}
            >
              <Icon
                name={summary.overall === "healthy" ? "check-circle" : "warning"}
                className="size-5"
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground">{summary.headline}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {counts.healthy} sehat
                {counts.warning > 0 ? ` · ${counts.warning} perlu perhatian` : ""}
                {counts.failed + counts.offline > 0 ? ` · ${counts.failed + counts.offline} gagal` : ""}
                {counts.not_configured > 0 ? ` · ${counts.not_configured} belum dikonfigurasi` : ""}
                {" · "}diperiksa {jamWIB(lastRunIso)}
              </p>
              {attentionItems.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {attentionItems.map((item) => item.name).join(", ")}
                </p>
              ) : null}
            </div>
          </div>

          {isStale ? (
            <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Data mungkin sudah lama. Pemeriksaan terakhir {Math.round((staleMs ?? 0) / 60000)} menit lalu.
            </p>
          ) : null}
        </Card>

        {/* 5. Perlu perhatian */}
        {attentionItems.length > 0 ? (
          <section aria-label="Perlu perhatian">
            <h2 className="mb-2.5 text-sm font-semibold tracking-tight text-foreground">Perlu perhatian</h2>
            <Card className="divide-y divide-border border border-border bg-card">
              {attentionItems.map((item) => (
                <div key={item.key} className="flex flex-wrap items-start gap-3 p-4 sm:p-5">
                  <span
                    className={cn("mt-1 size-2 shrink-0 rounded-full", STATUS_META[item.status].dot)}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.summary}</p>
                    {item.details.length > 0 ? (
                      <ul className="mt-1.5 space-y-0.5">
                        {item.details.map((detail) => (
                          <li key={detail} className="text-xs leading-5 text-muted-foreground">
                            {detail}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {item.action?.href ? (
                    <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                      <a href={item.action.href}>{item.action.label}</a>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={runChecks}
                      disabled={running}
                    >
                      {item.action?.label ?? "Coba lagi"}
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          </section>
        ) : null}

        {/* 6. Resource server */}
        <ResourceMetricGrid metrics={metrics} />

        {/* 8. Layanan infrastruktur */}
        <ServiceHealthPanel title="Layanan infrastruktur" checks={infrastructure} />

        {/* 9. Integrasi eksternal */}
        <ServiceHealthPanel title="Integrasi eksternal" checks={integrations} />

        {/* 12. Tren resource */}
        <section aria-label="Tren resource" className="space-y-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Tren resource</h2>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartFrame
              title="CPU & memori"
              subtitle={`${history.length} titik · WIB`}
              summaryText={
                cpuNow !== null || memNow !== null
                  ? `CPU ${cpuNow !== null ? cpuNow.toFixed(0) + "%" : "-"}, memori ${memNow !== null ? memNow.toFixed(1) + "%" : "-"} pada titik terakhir.`
                  : "Belum ada pembacaan."
              }
              legend={[
                { label: "CPU (%)", color: "hsl(var(--sale))" },
                { label: "Memori (%)", color: "#f59e0b" },
              ]}
              hasData={cpuMemoryPoints.length > 1}
              onRun={runChecks}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cpuMemoryPoints} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="taken_at" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                  <Tooltip content={<TrendTooltip format={(v) => v.toFixed(1) + "%"} unitLabel="Persentase" />} />
                  <Line type="monotone" dataKey="cpu_pct" name="CPU" stroke="hsl(var(--sale))" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="memory_pct" name="Memori" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>

            <ChartFrame
              title="Load average"
              subtitle={`${loadPoints.length} titik · WIB`}
              summaryText={
                server.load_1 !== null
                  ? `Load ${server.load_1.toFixed(2)} · ${loadHealthy ? "normal" : "tinggi"} untuk ${server.vcpu ?? "-"} vCPU.`
                  : "Belum ada pembacaan."
              }
              legend={[{ label: "Load 1 menit", color: "hsl(var(--sale))" }]}
              hasData={loadPoints.length > 1}
              onRun={runChecks}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={loadPoints} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="taken_at" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, "auto"]} />
                  <Tooltip content={<TrendTooltip format={(v) => v.toFixed(2)} unitLabel="Jumlah proses" />} />
                  <Line type="monotone" dataKey="load_1" name="Load 1 menit" stroke="hsl(var(--sale))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>

            <ChartFrame
              title="Database latency"
              subtitle={`${dbPoints.length} titik · WIB`}
              summaryText={
                server.db_response_ms !== null
                  ? `Terakhir ${Math.round(server.db_response_ms)} ms.`
                  : "Belum ada pengukuran."
              }
              legend={[{ label: "Respons (ms)", color: "#10b981" }]}
              hasData={dbPoints.length > 1}
              onRun={runChecks}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dbPoints} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="taken_at" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, "auto"]} />
                  <Tooltip content={<TrendTooltip format={(v) => Math.round(v) + " ms"} unitLabel="Milidetik" />} />
                  <Line type="monotone" dataKey="db_response_ms" name="Respons" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>

            {/*
              Disk sengaja TIDAK dibuat grafik besar: perubahannya lambat,
              sehingga garis mendatar tidak memberi keputusan apa pun. Nilainya
              sudah ada di kartu resource di atas.
            */}
            <Card className="border border-border bg-card p-5">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Catatan disk</h3>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                Perubahan disk berlangsung lambat, jadi angkanya cukup dipantau dari kartu resource di atas.
                Yang perlu diwaspadai bukan satu pembacaan, melainkan pertumbuhan yang tidak pernah turun.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Snapshot harian:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {history.length > 0
                    ? `${Math.min(...history.filter((p) => p.disk_pct !== null).map((p) => p.disk_pct as number)).toFixed(1)}% sampai ${Math.max(...history.filter((p) => p.disk_pct !== null).map((p) => p.disk_pct as number)).toFixed(1)}%`
                    : "belum ada data"}
                </span>
              </p>
            </Card>
          </div>
        </section>

        {/* 15. Konfigurasi teknis */}
        <Card className="border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Konfigurasi teknis</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Read-only · perubahan dilakukan melalui environment server
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowConfig((prev) => !prev)}
              aria-expanded={showConfig}
            >
              {showConfig ? "Sembunyikan konfigurasi" : "Tampilkan konfigurasi"}
            </Button>
          </div>
          {showConfig ? (
            <dl className="divide-y divide-border border-t border-border">
              {(
                [
                  ["Environment", env.app_env],
                  ["Queue connection", env.queue_connection],
                  ["Cache store", env.cache_store],
                  ["Media disk", env.media_disk],
                  ["Environment J&T", env.jnt_environment],
                  ["J&T credential", "Tersimpan · nilai disembunyikan"],
                  ["WhatsApp Number ID", maskId(env.whatsapp_number_id)],
                ] as Array<[string, string]>
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-5 py-2.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-mono text-xs text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </Card>

        {/* 16. Tentang pemeriksaan */}
        <details className="group rounded-lg border border-border bg-card">
          <summary className="flex cursor-pointer select-none items-center gap-2 px-5 py-3 text-xs font-semibold text-muted-foreground transition hover:text-foreground">
            <Icon name="info" className="size-3.5" aria-hidden="true" />
            Tentang pemeriksaan
            <Icon
              name="caret-down"
              className="ml-auto size-3.5 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-border px-5 py-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Pemeriksaan melakukan query database, read/write cache dan storage, serta permintaan ke gateway dan API
              dengan timeout pendek. Pemeriksaan dapat dijalankan kapan pun tanpa mengganggu pengunjung. Uji koneksi ke
              API eksternal hanya dijalankan saat Anda menekan tombol periksa.
            </p>
          </div>
        </details>
      </div>
    </AdminLayout>
  )
}
