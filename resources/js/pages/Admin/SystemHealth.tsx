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

interface HealthCheck {
  key: string
  label: string
  ok: boolean
  detail: string
  group: string
}

interface HealthSummary {
  total: number
  failed: number
  all_ok: boolean
  checked_at: string
}

interface ServerMetrics {
  taken_at: string
  load_1: number | null
  load_5: number | null
  load_15: number | null
  memory_used_mb: number | null
  memory_total_mb: number | null
  memory_pct: number | null
  disk_used_gb: number | null
  disk_total_gb: number | null
  disk_pct: number | null
  db_response_ms: number | null
  queue_backlog: number | null
  php_memory_mb: number | null
  php_peak_mb: number | null
}

interface HistoryPoint {
  taken_at: string
  load_1: number
  memory_pct: number
  disk_pct: number
  db_response_ms: number
  queue_backlog: number
}

interface EnvInfo {
  app_env: string
  whatsapp_number_id: string | null
  jnt_environment: string
  queue_connection: string
  cache_store: string
  media_disk: string
}

/**
 * Satu kartu tren untuk SATU metrik. Dipisah per metrik supaya tiap garis
 * punya skala sumbu sendiri dan tidak ada satuan yang bercampur.
 */
function TrenCard({
  judul,
  catatan,
  data,
  dataKey,
  nama,
  warna,
  format,
}: {
  judul: string
  catatan: string
  data: HistoryPoint[]
  dataKey: keyof HistoryPoint
  nama: string
  warna: string
  format: (value: number) => string
}) {
  return (
    <Card className="border border-border bg-card">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{judul}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{catatan}</p>
      </div>
      <div className="h-48 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="taken_at" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              formatter={(value: number) => [format(value), nama]}
            />
            <Line type="monotone" dataKey={dataKey} name={nama} stroke={warna} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export default function SystemHealth({
  title,
  description,
  checks = [],
  summary,
  env,
  runUrl,
  server,
  history = [],
}: {
  title: string
  description: string
  checks: HealthCheck[]
  summary: HealthSummary
  env: EnvInfo
  runUrl: string
  server: ServerMetrics
  history: HistoryPoint[]
}) {
  const [running, setRunning] = React.useState(false)

  function runChecks() {
    setRunning(true)
    router.post(runUrl, {}, { onFinish: () => setRunning(false) })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <Button type="button" onClick={runChecks} disabled={running}>
          <Icon name={running ? "spinner" : "refresh"} className={cn("size-4", running && "animate-spin")} aria-hidden="true" />
          {running ? "Memeriksa..." : "Jalankan pemeriksaan"}
        </Button>
      }
    >
      <Head title={`${title} | Admin`} />

      <div className="space-y-6">
        <Card className={cn("border p-5", summary.all_ok ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40" : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/40")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full",
                  summary.all_ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
                )}
              >
                <Icon name={summary.all_ok ? "check-circle" : "warning"} className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {summary.all_ok
                    ? `Semua ${summary.total} layanan sehat`
                    : `${summary.failed} dari ${summary.total} layanan perlu perhatian`}
                </p>
                <p className="text-xs text-muted-foreground">Diperiksa {summary.checked_at}</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Beban CPU (1 menit)",
              value: server.load_1 === null ? "-" : server.load_1.toFixed(2),
              hint: "Rata-rata proses menunggu 1 menit terakhir. Di atas jumlah core berarti server kewalahan.",
              warn: server.load_1 !== null && server.load_1 > 4,
            },
            {
              label: "Memori terpakai",
              value: server.memory_pct === null ? "-" : server.memory_pct.toFixed(1) + "%",
              hint: server.memory_used_mb === null
                ? "Tidak dapat dibaca."
                : `${server.memory_used_mb.toFixed(0)} MB dari ${server.memory_total_mb?.toFixed(0) ?? "-"} MB`,
              warn: server.memory_pct !== null && server.memory_pct > 85,
            },
            {
              label: "Disk terpakai",
              value: server.disk_pct === null ? "-" : server.disk_pct.toFixed(1) + "%",
              hint: server.disk_used_gb === null
                ? "Tidak dapat dibaca."
                : `${server.disk_used_gb.toFixed(1)} GB dari ${server.disk_total_gb?.toFixed(1) ?? "-"} GB`,
              warn: server.disk_pct !== null && server.disk_pct > 85,
            },
            {
              label: "Respons database",
              value: server.db_response_ms === null ? "-" : server.db_response_ms.toFixed(0) + " ms",
              hint: server.queue_backlog === null
                ? "Antrean queue tidak terbaca."
                : `Antrean queue: ${server.queue_backlog} pekerjaan`,
              warn: server.db_response_ms !== null && server.db_response_ms > 200,
            },
          ].map((kartu) => (
            <div
              key={kartu.label}
              className={cn(
                "rounded-xl border p-4 shadow-soft",
                kartu.warn
                  ? "border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/40"
                  : "border-border bg-card",
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">{kartu.label}</p>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">{kartu.value}</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{kartu.hint}</p>
            </div>
          ))}
        </div>

        {history.length > 1 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {/*
              Satu grafik satu satuan. Sebelumnya CPU (0-4), memori (%), dan
              disk (%) berbagi satu sumbu sehingga garis CPU menempel di dasar
              dan terbaca seolah nol. Tiap metrik kini punya grafiknya sendiri.
            */}
            <TrenCard
              judul="Beban CPU"
              catatan={`Rata-rata proses menunggu (1 menit). Naik terus berarti server kewalahan. ${history.length} titik.`}
              data={history}
              dataKey="load_1"
              nama="Beban CPU"
              warna="hsl(var(--sale))"
              format={(v) => v.toFixed(2)}
            />

            <TrenCard
              judul="Memori terpakai"
              catatan="Persentase RAM terpakai. Di atas 85% berisiko proses dibunuh sistem."
              data={history}
              dataKey="memory_pct"
              nama="Memori"
              warna="#f59e0b"
              format={(v) => v.toFixed(1) + "%"}
            />

            <TrenCard
              judul="Disk terpakai"
              catatan="Garis mendatar itu normal. Yang perlu diwaspadai bila terus naik tanpa turun."
              data={history}
              dataKey="disk_pct"
              nama="Disk"
              warna="#6366f1"
              format={(v) => v.toFixed(1) + "%"}
            />

            <TrenCard
              judul="Respons database"
              catatan="Waktu query ping. Naik berarti query melambat atau server sibuk."
              data={history}
              dataKey="db_response_ms"
              nama="Respons DB"
              warna="#10b981"
              format={(v) => v.toFixed(0) + " ms"}
            />
          </div>
        ) : (
          <Card className="border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">
              Grafik tren muncul setelah ada minimal dua snapshot. Snapshot otomatis diambil tiap 15 menit dan setiap
              halaman ini dibuka, jadi biarkan beberapa menit lalu muat ulang.
            </p>
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {checks.map((check) => (
            <div
              key={check.key}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                  check.ok
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                )}
              >
                <Icon name={check.ok ? "check" : "x"} className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{check.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <Card className="border border-border bg-card">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Konfigurasi aktif</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Nilai dari environment server, read-only. Perubahan dilakukan di file .env di VPS.</p>
          </div>
          <dl className="divide-y divide-border">
            {[
              ["Environment", env.app_env],
              ["Queue connection", env.queue_connection],
              ["Cache store", env.cache_store],
              ["Media disk", env.media_disk],
              ["Environment J&T", env.jnt_environment],
              ["WhatsApp Number ID", env.whatsapp_number_id ?? "-"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-5 py-2.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-mono text-xs text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <p className="text-xs text-muted-foreground">
          Pemeriksaan menyentuh layanan secara nyata (query ping, tulis-baca cache dan storage, HTTP ke gateway) dengan
          timeout pendek, jadi aman dijalankan kapan pun tanpa mengganggu pengunjung.
        </p>
      </div>
    </AdminLayout>
  )
}
