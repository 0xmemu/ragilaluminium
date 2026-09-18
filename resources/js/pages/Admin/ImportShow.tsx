import { Head, Link } from "@inertiajs/react"
import { useEffect, useRef, useState } from "react"

import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import { Icon } from "@/components/shared/icon"
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
  total_products?: number
  processed_products?: number
  success_products?: number
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  rows: Array<{ row_number: number; status: string; reason: string }>
  imported_products: Array<{
    product_id: number
    name: string
    sku: string
    status: string
    variants: number
    url: string
    edit_url: string | null
  }>
  incomplete_products: Array<{
    product_id: number
    name: string
    sku: string
    edit_url: string | null
    rows: number[]
    reasons: string[]
  }>
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

export default function ImportShow({
  importJob,
  backUrl,
}: {
  importJob: ImportJobView
  // URL kembali ke daftar import. Dikirim controller supaya pola tombol
  // Kembali sama dengan halaman admin lain (layout yang merender).
  backUrl?: string | null
}) {
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
    // Polling via Inertia partial reload: hanya properti importJob yang
    // dimuat ulang, halaman tidak di-render ulang penuh. Fetch manual dengan
    // header X-Inertia tanpa X-Inertia-Version akan kena 409 konflik versi
    // sehingga loading bar tidak pernah maju.
    timer.current = setInterval(() => {
      router.reload({
        only: ["importJob"],
        onSuccess: (page) => {
          const props = page.props.importJob as ImportJobView | undefined
          if (props) setJob(props)
        },
      })
    }, 1000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [active, job.id])

  return (
    <AdminLayout
      title={`Import #${job.id}`}
      description={job.file}
      backUrl={backUrl}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.reload()}
            className="inline-flex items-center gap-1.5"
          >
            <Icon name="refresh" className="size-3.5" aria-hidden="true" />
            <span>Refresh data</span>
          </Button>
          {job.failed_rows > 0 ? (
            <Button asChild variant="secondary" size="sm">
              <a href={routeUrl("admin.imports.correction-file", { import_job: job.id })} className="inline-flex items-center gap-1.5">
                <Icon name="download" className="size-3.5" aria-hidden="true" />
                <span>Unduh Berkas Koreksi</span>
              </a>
            </Button>
          ) : null}
          <Button asChild variant="secondary" size="sm">
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
                {total > 0 ? (
                  job.total_products
                    ? `${job.processed_products ?? 0} dari ${job.total_products} produk (${processed} dari ${total} baris)`
                    : `${processed} dari ${total} baris`
                ) : "menyiapkan..."}
              </span>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                {total > 0 ? (
                  job.total_products
                    ? `Diproses ${job.processed_products ?? 0} dari ${job.total_products} produk (${processed} dari ${total} baris)`
                    : `Diproses ${processed} dari ${total} baris`
                ) : "Menunggu data baris"}
              </span>
              <span className="tabular-nums font-semibold">{percent}%</span>
            </div>
            <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ${job.status === "failed" ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${percent}%` }}
              />
              {/* Selama import berjalan, lapisan bergerak menandakan proses
                  masih hidup walau persentase kebetulan belum berubah. Tanpa
                  ini bar terlihat statis dan admin menduga import menggantung. */}
              {active ? (
                <div
                  className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
                  aria-hidden="true"
                />
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <span className="text-success font-semibold">
                {job.total_products
                  ? `${job.success_products ?? job.total_products} produk (${job.success_rows} baris kombinasi) berhasil`
                  : `${job.success_rows} baris berhasil`}
              </span>
              <span className={job.failed_rows > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                {job.failed_rows} baris gagal
              </span>
              {job.started_at ? <span className="text-muted-foreground">Mulai: {job.started_at}</span> : null}
              {job.completed_at ? <span className="text-muted-foreground">Selesai: {job.completed_at}</span> : null}
            </div>
            {active ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon name="spinner" className="size-3.5 animate-spin" aria-hidden="true" />
                Angka di halaman ini diperbarui otomatis setiap 1 detik sampai import selesai.
              </p>
            ) : null}
          </div>

          {job.status === "failed" && job.error_message ? (
            <Alert tone="danger" title="Import gagal">{job.error_message}</Alert>
          ) : null}
        </div>

        {job.status === "completed" ? (
          <div className="rounded-lg border border-success/30 bg-success/5 p-5">
            <p className="text-sm font-semibold text-success">
              Import selesai: {job.success_rows} baris berhasil diimpor
              {job.failed_rows > 0 ? `, ${job.failed_rows} gagal` : ""}.
            </p>
            {job.incomplete_products.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Semua produk lengkap dan langsung aktif.
              </p>
            ) : null}
            {job.incomplete_products.length > 0 ? (
              <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {job.incomplete_products.length} produk perlu dilengkapi (tersimpan sebagai arsip)
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Data di baris ini valid dan sudah masuk, tapi belum cukup untuk tampil di toko. Lengkapi dari form edit, lalu tekan Aktifkan produk.
                </p>
                <div className="mt-3 overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Produk</th>
                        <th className="px-3 py-2 font-medium">SKU</th>
                        <th className="px-3 py-2 font-medium">Baris</th>
                        <th className="px-3 py-2 font-medium">Yang kurang</th>
                        <th className="px-3 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {job.incomplete_products.map((item) => (
                        <tr key={item.product_id}>
                          <td className="max-w-56 px-3 py-2 font-medium text-foreground">{item.name}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">{item.sku}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{item.rows.join(", ")}</td>
                          <td className="px-3 py-2 text-foreground">{item.reasons.join(", ")}</td>
                          <td className="px-3 py-2 text-right">
                            {item.edit_url ? (
                              <Button asChild variant="secondary" size="sm">
                                <a href={item.edit_url}>Edit</a>
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {job.imported_products.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                  <span className="text-xs font-semibold">
                    Produk yang berhasil diimpor ({job.imported_products.length})
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Klik nama produk untuk membuka halamannya di toko
                  </span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Nama Produk</th>
                      <th className="px-4 py-2 font-medium">SKU</th>
                      <th className="px-4 py-2 text-right font-medium">Varian</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {job.imported_products.map((item) => (
                      <tr key={item.product_id}>
                        <td className="max-w-80 px-4 py-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {item.name}
                          </a>
                        </td>
                        <td className="px-4 py-2 font-mono tabular-nums text-muted-foreground">{item.sku}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{item.variants}</td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              item.status === "active"
                                ? "text-success font-semibold"
                                : "text-warning font-semibold"
                            }
                          >
                            {item.status === "active" ? "Aktif" : "Arsip"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {item.edit_url ? (
                            <Button asChild variant="secondary" size="sm">
                              <a href={item.edit_url}>Edit</a>
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href={routeUrl("admin.products.index")}>Lihat Produk</Link>
              </Button>
            </div>
          </div>
        ) : job.failed_rows > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-semibold">
              Baris yang gagal
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Baris</th>
                  <th className="px-4 py-2 font-medium">Alasan gagal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {job.rows.filter((row) => row.status !== "success").map((row) => (
                  <tr key={row.row_number}>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{row.row_number}</td>
                    <td className="px-4 py-2">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  )
}
