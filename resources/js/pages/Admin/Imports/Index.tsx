import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { formatDateTime, formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"

export interface ImportItem {
  id: number
  type: string
  type_label: string
  source_file_name: string
  status: string
  total_rows: number
  processed_rows: number
  success_rows: number
  failed_rows: number
  product_count: number
  triggered_by: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  href: string
  failed_rows_href: string | null
  retry_url: string | null
}

export interface ImportSummary {
  total_jobs: number
  total_completed: number
  total_failed: number
  total_running: number
  total_success_rows: number
  total_failed_rows: number
}

export interface StatusTab {
  key: string
  label: string
  count: number
}

export interface ImportsIndexProps {
  title: string
  description?: string
  summary: ImportSummary
  tabs: StatusTab[]
  activeStatus: string
  activeType: string
  searchQuery: string
  createHref: string
  importPerformanceHref: string
  jobs: {
    data: ImportItem[]
    links: Array<{ url: string | null; label: string; active: boolean }>
    from: number | null
    to: number | null
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export default function ImportsIndex({
  title,
  description,
  summary,
  tabs,
  activeStatus,
  activeType,
  searchQuery,
  createHref,
  importPerformanceHref: _importPerformanceHref,
  jobs,
}: ImportsIndexProps) {
  const [refreshing, setRefreshing] = React.useState(false)
  const [busyJobId, setBusyJobId] = React.useState<number | null>(null)
  const [q, setQ] = React.useState(searchQuery)

  function visit(params: Record<string, string | undefined>) {
    const next: Record<string, string> = {}
    const merged = {
      status: activeStatus,
      type: activeType,
      q: searchQuery,
      ...params,
    }
    Object.entries(merged).forEach(([key, value]) => {
      if (!value || value === "all") return
      if (key === "q" && !value.trim()) return
      next[key] = value
    })
    router.get(routeUrl("admin.imports.index"), next, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
    })
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    visit({ q: q.trim() })
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={refreshing}
        onClick={() => {
          setRefreshing(true)
          router.reload({
            onFinish: () => setRefreshing(false),
          })
        }}
        className="inline-flex items-center gap-1.5"
      >
        <Icon
          name="refresh"
          className={cn("size-3.5", refreshing ? "animate-spin" : "")}
          aria-hidden="true"
        />
        <span>{refreshing ? "Memuat..." : "Refresh data"}</span>
      </Button>

      <Button asChild size="sm">
        <Link href={createHref}>
          <Icon name="plus" className="size-4" aria-hidden="true" />
          Mulai Import Baru
        </Link>
      </Button>
    </div>
  )

  return (
    <AdminLayout
      title={title}
      description={
        description ??
        "Riwayat proses import katalog, pembaruan harga & stok masal, serta penambahan media produk."
      }
      actions={actions}
    >
      <Head title={`${title} | Admin`} />

      {/* 4 Kartu KPI Ringkasan Import */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Total Pekerjaan Import</p>
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
            {formatNumber(summary.total_jobs)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Riwayat batch import yang pernah dijalankan
          </p>
        </Card>

        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Import Selesai (Sukses)</p>
          <p className="font-mono text-lg font-bold tabular-nums text-success">
            {formatNumber(summary.total_completed)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Pekerjaan tuntas tanpa kesalahan fatal
          </p>
        </Card>

        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Baris Berhasil Diimpor</p>
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
            {formatNumber(summary.total_success_rows)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Akumulasi baris kombinasi varian seluruh batch
          </p>
        </Card>

        <Card className="p-4 space-y-1 bg-card">
          <p className="text-xs font-medium text-muted-foreground">Baris Gagal / Perlu Koreksi</p>
          <p className="font-mono text-lg font-bold tabular-nums text-destructive">
            {formatNumber(summary.total_failed_rows)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Baris data dengan validasi format keliru
          </p>
        </Card>
      </div>

      {/* Tabs status import DS v2 */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 scrollbar-none overflow-x-auto">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-1"
            role="tablist"
            aria-label="Filter status import"
          >
            {tabs.map((tab) => {
              const active = tab.key === activeStatus
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => visit({ status: tab.key })}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-foreground text-background shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "tabular-nums rounded-full px-1.5 py-px text-[11px] font-semibold",
                      active
                        ? "bg-background/20 text-background"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {formatNumber(tab.count)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
          <span>
            Total Batch:{" "}
            <strong className="tabular-nums font-semibold text-foreground">
              {formatNumber(summary.total_jobs)}
            </strong>
          </span>
        </div>
      </div>

      {/* Toolbar filter & search */}
      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: submitSearch,
          placeholder: "Cari ID import, nama file Excel, atau admin pelaksana...",
        }}
        className="mb-4 pb-[10px]"
      >
        <Select
          value={activeType || "all"}
          onChange={(event) =>
            visit({ type: event.target.value === "all" ? undefined : event.target.value })
          }
          className="w-auto"
          aria-label="Filter tipe import"
        >
          <option value="all">Semua tipe</option>
          <option value="catalog_import">Import Katalog</option>
          <option value="stock_price_update">Update Harga & Stok</option>
          <option value="media_update">Update Media</option>
        </Select>
      </ListToolbar>

      {/* Tabel Import Table-First Desktop */}
      <Card className="overflow-hidden border border-border bg-card">
        {jobs.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
                  <th className="px-4 py-3 text-left">ID & Tipe</th>
                  <th className="px-4 py-3 text-left">File Sumber</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Hasil Import</th>
                  <th className="px-3 py-3 text-center">Waktu Eksekusi</th>
                  <th className="px-3 py-3 text-center">Pelaksana</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.data.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/40">
                    {/* Kolom 1: ID & Tipe (Rata Kiri) */}
                    <td className="px-4 py-3 align-middle">
                      <div className="space-y-0.5">
                        <Link
                          href={item.href}
                          className="font-mono text-sm font-bold tracking-tight text-foreground hover:text-primary hover:underline"
                        >
                          #{item.id}
                        </Link>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {item.type_label}
                        </p>
                      </div>
                    </td>

                    {/* Kolom 2: File Sumber (Rata Kiri) */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded bg-muted/60 text-muted-foreground">
                          <Icon name="file-text" className="size-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 max-w-xs space-y-0.5">
                          <p className="truncate font-medium text-foreground" title={item.source_file_name}>
                            {item.source_file_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase">Format Excel</p>
                        </div>
                      </div>
                    </td>

                    {/* Kolom 3: Status (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="inline-flex items-center justify-center">
                        <StatusBadge status={item.status} />
                      </div>
                    </td>

                    {/* Kolom 4: Realisasi Produk & Baris (Rata Tengah) */}
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="space-y-0.5">
                        {item.product_count > 0 ? (
                          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                            {formatNumber(item.product_count)} produk
                          </span>
                        ) : null}
                        <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
                          {formatNumber(item.processed_rows)} / {formatNumber(item.total_rows)} baris
                        </span>
                        <div className="flex items-center justify-center gap-2 text-[11px]">
                          <span className="text-success font-medium">
                            {formatNumber(item.success_rows)} ok
                          </span>
                          {item.failed_rows > 0 ? (
                            <span className="text-destructive font-semibold">
                              · {formatNumber(item.failed_rows)} gagal
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Kolom 5: Waktu Eksekusi (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="space-y-0.5">
                        <span className="text-xs font-medium text-foreground">
                          {item.completed_at
                            ? formatDateTime(item.completed_at)
                            : item.started_at
                              ? formatDateTime(item.started_at)
                              : formatDateTime(item.created_at)}
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          {item.completed_at ? "Selesai" : item.started_at ? "Mulai" : "Diunggah"}
                        </p>
                      </div>
                    </td>

                    {/* Kolom 6: Pelaksana (Rata Tengah) */}
                    <td className="px-3 py-3 text-center align-middle">
                      <span className="font-medium text-foreground">{item.triggered_by}</span>
                    </td>

                    {/* Kolom 7: Aksi (Rata Kanan) */}
                    <td className="px-4 py-3 text-right align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.failed_rows_href ? (
                          <Button asChild variant="outline" size="xs" className="text-destructive">
                            <Link href={item.failed_rows_href}>Baris gagal</Link>
                          </Button>
                        ) : null}

                        {item.retry_url ? (
                          <ConfirmAction
                            trigger={
                              <Button
                                variant="ghost"
                                size="xs"
                                disabled={busyJobId === item.id}
                                className="text-xs"
                              >
                                {busyJobId === item.id ? "Memproses..." : "Jalankan ulang"}
                              </Button>
                            }
                            title={`Jalankan ulang import #${item.id}?`}
                            description="Proses import akan dimasukkan kembali ke antrean pekerjaan."
                            confirmLabel="Jalankan ulang"
                            onConfirm={() => {
                              if (!item.retry_url) return
                              setBusyJobId(item.id)
                              router.post(item.retry_url, {}, {
                                preserveScroll: true,
                                onFinish: () => setBusyJobId(null),
                              })
                            }}
                          />
                        ) : null}

                        <Button asChild variant="secondary" size="xs">
                          <Link href={item.href}>Detail</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            className="p-8"
            icon="upload"
            title="Belum ada riwayat import"
            description="Riwayat file Excel yang diunggah untuk pembaruan produk akan dicatat di tabel ini."
            action={
              <Button asChild size="sm">
                <Link href={createHref}>
                  <Icon name="plus" className="size-4" aria-hidden="true" />
                  Mulai Import Baru
                </Link>
              </Button>
            }
          />
        )}
      </Card>

      {/* Paginasi */}
      <div className="mt-4">
        <Pagination pagination={jobs} />
      </div>
    </AdminLayout>
  )
}
