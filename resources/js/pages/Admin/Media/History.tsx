import { Head, router } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

interface LogRow {
  id: number
  loggable_type: string
  loggable_id: number
  entity_label: string | null
  event: string
  message: string | null
  retry_url?: string | null
  delete_url?: string | null
  created_at?: string | null
  created_at_label?: string | null
}

const EVENT_META: Record<string, { label: string; tone: string }> = {
  queued: { label: "Antre", tone: "secondary" },
  processing: { label: "Diproses", tone: "info" },
  success: { label: "Siap", tone: "success" },
  failed: { label: "Gagal", tone: "danger" },
  dedup: { label: "Duplikat", tone: "warning" },
  downloaded: { label: "Terunduh", tone: "info" },
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return (
    date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
  )
}

export default function MediaHistory({
  logs = [],
  pagination,
  filters,
  prune,
}: {
  logs: LogRow[]
  pagination: PaginationData | null
  filters: { event: string; q: string; from: string; to: string }
  prune?: { days: number; count: number } | null
}) {
  const [q, setQ] = React.useState(filters.q)
  const [from, setFrom] = React.useState(filters.from)
  const [to, setTo] = React.useState(filters.to)

  function apply(next?: Partial<{ q: string; event: string; from: string; to: string }>) {
    const params: Record<string, string> = {}
    if (next?.q !== undefined) params.q = next.q
    else if (q) params.q = q
    if (next?.event !== undefined) params.event = next.event
    else if (filters.event) params.event = filters.event
    if (next?.from !== undefined) params.from = next.from
    else if (from) params.from = from
    if (next?.to !== undefined) params.to = next.to
    else if (to) params.to = to

    router.get(routeUrl("admin.media.history"), params, {
      preserveState: true,
      preserveScroll: true,
    })
  }

  // ---- Live: polling status entitas yang masih queued/processing ----
  // Overrides per log id (hanya di-set dari callback async polling, bukan di
  // body effect) sehingga tidak memicu peringatan setState-in-effect.
  const [liveOverrides, setLiveOverrides] = React.useState<Record<number, Partial<LogRow>>>({})

  const liveRows = logs.map((row) => ({ ...row, ...liveOverrides[row.id] }))
  const liveActive = liveRows.some((r) => r.event === "queued" || r.event === "processing")

  React.useEffect(() => {
    const pending = logs.filter((r) => r.event === "queued" || r.event === "processing")
    if (pending.length === 0) return
    let cancelled = false

    async function tick() {
      if (cancelled) return
      try {
        const assetIds = [
          ...new Set(
            pending
              .filter((r) => r.loggable_type.includes("MediaAsset"))
              .map((r) => r.loggable_id),
          ),
        ]
        const productIds = [
          ...new Set(
            pending
              .filter((r) => r.loggable_type.includes("ProductMedia"))
              .map((r) => r.loggable_id),
          ),
        ]
        const statuses: Record<string, { status: string; error_reason?: string | null }> = {}

        async function poll(kind: string, ids: number[]) {
          if (ids.length === 0) return
          const params = new URLSearchParams()
          params.set("kind", kind)
          ids.forEach((id) => params.append("ids[]", String(id)))
          const res = await fetch(`${route("admin.media.status")}?${params.toString()}`, {
            headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
          })
          if (!res.ok) return
          const body = (await res.json()) as {
            statuses: { id: number; status: string; error_reason?: string | null }[]
          }
          for (const item of body.statuses ?? []) statuses[`${kind}:${item.id}`] = item
        }

        await Promise.all([poll("asset", assetIds), poll("product", productIds)])
        if (cancelled) return

        // Hanya baris non-terminal TERBARU per entitas yang di-update; baris
        // historis (mis. "Antre" lama) tetap seperti riwayat aslinya.
        const latestPerEntity = new Map<string, LogRow>()
        for (const row of pending) {
          const key = `${row.loggable_type}:${row.loggable_id}`
          if (!latestPerEntity.has(key)) latestPerEntity.set(key, row)
        }

        const next: Record<number, Partial<LogRow>> = {}
        for (const row of latestPerEntity.values()) {
          const kind = row.loggable_type.includes("MediaAsset") ? "asset" : "product"
          const info = statuses[`${kind}:${row.loggable_id}`]
          if (!info) continue
          if (info.status === "ready" || info.status === "downloaded") {
            next[row.id] = {
              event: "success",
              message: "Derivatif WebP siap (thumb/card/pdp).",
              retry_url: null,
            }
          } else if (info.status === "failed") {
            next[row.id] = {
              event: "failed",
              message: info.error_reason ?? "Pemrosesan media gagal.",
              retry_url: routeUrl("admin.media.logs.retry", { log: row.id }),
            }
          }
        }
        if (Object.keys(next).length > 0) {
          setLiveOverrides((prev) => ({ ...prev, ...next }))
        }
      } catch {
        // Abaikan error polling sesaat; interval berikutnya mencoba lagi.
      }
    }

    void tick()
    const interval = window.setInterval(() => void tick(), 3000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [logs])

  return (
    <AdminLayout title="Riwayat Media" description="Audit pemrosesan media (queued → processing → siap / gagal)">
      <Head title="Riwayat Media | Admin" />

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
        {[
          { key: "", label: "Semua" },
          { key: "failed", label: "Gagal" },
          { key: "success", label: "Siap" },
          { key: "processing", label: "Diproses" },
          { key: "queued", label: "Antre" },
          { key: "dedup", label: "Duplikat" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => apply({ event: tab.key })}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              filters.event === tab.key
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
        </div>
        {liveActive ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        ) : null}
      </div>

      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => apply({ q }),
          placeholder: "Cari berdasarkan label media atau pesan",
        }}
        className="mb-4"
        actions={
          prune && prune.count > 0 ? (
            <ConfirmAction
              trigger={
                <Button type="button" variant="secondary" size="sm">
                  <Icon name="trash" className="size-4" aria-hidden="true" />
                  Bersihkan log lama ({prune.count})
                </Button>
              }
              title="Hapus log riwayat lama"
              description={`Hapus permanen ${prune.count} log riwayat yang lebih tua dari ${prune.days} hari. Tindakan ini tidak dapat dibatalkan.`}
              confirmLabel="Hapus"
              onConfirm={() =>
                router.post(routeUrl("admin.media.logs.prune"), undefined, {
                  preserveScroll: true,
                  preserveState: true,
                })
              }
            />
          ) : undefined
        }
      >
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onBlur={() => apply({ from })}
          className="h-9 rounded-md border border-border bg-surface px-2.5 text-[13px] text-foreground"
          aria-label="Dari tanggal"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onBlur={() => apply({ to })}
          className="h-9 rounded-md border border-border bg-surface px-2.5 text-[13px] text-foreground"
          aria-label="Sampai tanggal"
        />
        <Select
          value={filters.event}
          onChange={(event) => apply({ event: event.target.value })}
          className="w-40"
          aria-label="Filter status"
        >
          <option value="">Semua status</option>
          <option value="queued">Antre</option>
          <option value="processing">Diproses</option>
          <option value="success">Siap</option>
          <option value="failed">Gagal</option>
          <option value="dedup">Duplikat</option>
          <option value="downloaded">Terunduh</option>
        </Select>
      </ListToolbar>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {liveRows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Waktu</th>
                    <th className="px-3 py-3 font-semibold">Media</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Detail</th>
                    <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {liveRows.map((row) => {
                    const meta = EVENT_META[row.event] ?? { label: row.event, tone: "secondary" }
                    return (
                      <tr key={row.id} className="border-t border-border align-top">
                        <td className="whitespace-nowrap px-3 py-3 text-[12px] tabular-nums text-muted-foreground">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="max-w-[16rem] px-3 py-3">
                          <p className="truncate font-medium text-foreground">{row.entity_label ?? "—"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {row.loggable_type.includes("ProductMedia") ? "Media produk" : "Aset"} #{row.loggable_id}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={meta.tone} label={meta.label} />
                        </td>
                        <td className="max-w-[24rem] px-3 py-3 text-[13px] text-muted-foreground">
                          {row.message ?? "—"}
                        </td>
                        <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            {row.retry_url ? (
                              <Button
                                type="button"
                                size="xs"
                                variant="secondary"
                                onClick={() =>
                                  router.post(row.retry_url!, undefined, {
                                    preserveScroll: true,
                                    preserveState: true,
                                  })
                                }
                              >
                                <Icon name="refresh" className="size-3.5" aria-hidden="true" />
                                Coba lagi
                              </Button>
                            ) : null}
                            {row.delete_url ? (
                              <ConfirmAction
                                trigger={
                                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus log">
                                    <Icon name="trash" className="size-3.5" aria-hidden="true" />
                                  </Button>
                                }
                                title="Hapus log riwayat"
                                description={`Hapus permanen log "${row.entity_label ?? ""}". Tindakan ini tidak dapat dibatalkan.`}
                                confirmLabel="Hapus"
                                onConfirm={() =>
                                  router.delete(row.delete_url!, {
                                    preserveScroll: true,
                                    preserveState: true,
                                  })
                                }
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {liveRows.map((row) => {
                const meta = EVENT_META[row.event] ?? { label: row.event, tone: "secondary" }
                return (
                  <div key={row.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{row.entity_label ?? "—"}</p>
                      <StatusBadge status={meta.tone} label={meta.label} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(row.created_at)}</p>
                    {row.message ? (
                      <p className="mt-1 text-[13px] text-muted-foreground">{row.message}</p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-1.5">
                      {row.retry_url ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="secondary"
                          onClick={() =>
                            router.post(row.retry_url!, undefined, {
                              preserveScroll: true,
                              preserveState: true,
                            })
                          }
                        >
                          <Icon name="refresh" className="size-3.5" aria-hidden="true" />
                          Coba lagi
                        </Button>
                      ) : null}
                      {row.delete_url ? (
                        <ConfirmAction
                          trigger={
                            <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus log">
                              <Icon name="trash" className="size-3.5" aria-hidden="true" />
                            </Button>
                          }
                          title="Hapus log riwayat"
                          description={`Hapus permanen log "${row.entity_label ?? ""}". Tindakan ini tidak dapat dibatalkan.`}
                          confirmLabel="Hapus"
                          onConfirm={() =>
                            router.delete(row.delete_url!, {
                              preserveScroll: true,
                              preserveState: true,
                            })
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <EmptyState
            icon="history"
            title="Belum ada riwayat pemrosesan"
            description={
              filters.event || filters.q
                ? "Tidak ada log yang cocok dengan filter. Coba ubah pencarian atau status."
                : "Log pemrosesan media akan muncul di sini setelah media diunggah."
            }
            className="py-14"
          />
        )}
      </section>

      <div className="mt-4">
        <Pagination pagination={pagination} />
      </div>
    </AdminLayout>
  )
}
