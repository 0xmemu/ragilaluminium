import { Head, Link, useForm } from "@inertiajs/react"
import { useEffect, useRef, useState } from "react"

import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { router } from "@inertiajs/react"

type ImportJobView = {
  id: number
  type: string
  file: string
  status: "pending" | "running" | "completed" | "failed"
  stock_source: string
  total_rows: number
  processed_rows: number
  success_rows: number
  failed_rows: number
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  rows: Array<{ row_number: number; status: string; reason: string }>
}

const STATUS_LABEL: Record<ImportJobView["status"], string> = {
  pending: "Menunggu",
  running: "Sedang diproses",
  completed: "Selesai",
  failed: "Gagal",
}

const STATUS_STYLE: Record<ImportJobView["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-info/15 text-info",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
}

export default function ImportShow({ importJob }: { importJob: ImportJobView }) {
  const [job, setJob] = useState(importJob)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const active = job.status === "pending" || job.status === "running"
  const total = job.total_rows
  const processed = Math.min(job.processed_rows, total > 0 ? total : job.processed_rows)
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : active ? 0 : 100

  useEffect(() => {
    if (!active) {
      if (timer.current) clearInterval(timer.current)
      return
    }
    timer.current = setInterval(() => {
      void fetch(routeUrl("admin.imports.show", { import_job: job.id }), {
        headers: { Accept: "application/json", "X-Inertia": "true", "X-Requested-With": "XMLHttpRequest" },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const props = data?.props?.importJob
          if (props) setJob(props as ImportJobView)
        })
        .catch(() => undefined)
    }, 3000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [active, job.id])

  return (
    <AdminLayout
      title={`Import #${job.id}`}
      description={job.file}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={routeUrl("admin.imports.index")}>Riwayat import</Link>
          </Button>
        </div>
      }
    >
      <Head title={`Import #${job.id} | Admin`} />

      <div className="space-y-5">
        <div className="rounded-lg border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[job.status]}`}>
                {STATUS_LABEL[job.status]}
              </span>
              <span className="text-xs text-muted-foreground">{job.type}</span>
            </div>
            {active ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {total > 0 ? `${processed} dari ${total} baris` : "menyiapkan..."}
              </span>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                {total > 0 ? `Diproses ${processed} dari ${total} baris` : "Menunggu data baris"}
              </span>
              <span className="tabular-nums font-semibold">{percent}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ${job.status === "failed" ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <span className="text-success">{job.success_rows} berhasil</span>
              <span className={job.failed_rows > 0 ? "text-destructive" : "text-muted-foreground"}>
                {job.failed_rows} gagal
              </span>
              <span className="text-muted-foreground">Sumber stok: {job.stock_source}</span>
              {job.started_at ? <span className="text-muted-foreground">Mulai: {job.started_at}</span> : null}
              {job.completed_at ? <span className="text-muted-foreground">Selesai: {job.completed_at}</span> : null}
            </div>
            {active ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Halaman menyegarkan otomatis setiap 3 detik sampai import selesai.
              </p>
            ) : null}
          </div>

          {job.status === "failed" && job.error_message ? (
            <Alert tone="danger" title="Import gagal">{job.error_message}</Alert>
          ) : null}
        </div>

        {job.rows.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-semibold">
              Baris terakhir (maks. 50)
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Baris</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {job.rows.map((row) => (
                  <tr key={row.row_number}>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{row.row_number}</td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Alert tone="info">
            {job.total_rows > 0
              ? "Hasil per baris akan tampil di sini saat import berjalan."
              : "Belum ada data baris."}
          </Alert>
        )}
      </div>
    </AdminLayout>
  )
}
