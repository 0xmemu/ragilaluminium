import { Head, Link, router } from "@inertiajs/react"
import { usePage } from "@inertiajs/react"
import type { SharedPageProps } from "@/types"
import * as React from "react"

import { ManagePromotionsTabs } from "@/components/admin/manage-promotions-tabs"
import { Card } from "@/components/admin/ui/card"
import { rowActionTextClass } from "@/components/admin/row-actions"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table"
import { Icon } from "@/components/shared/icon"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

interface TargetRow {
  label: string
  excluded: boolean
  override_discount_percent: number | null
}

interface PromotionRow {
  id: number
  name: string
  status: string
  discount_percent: number
  starts_at?: string | null
  ends_at?: string | null
  items_count: number
  products_count: number
  targets: TargetRow[]
  edit_href: string
  duplicate_url: string
  activate_url: string
  end_url: string
  impact_url: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Terjadwal",
  active: "Aktif",
  ended: "Diakhiri",
  finished: "Selesai",
}

function canActivate(status: string): boolean {
  return status === "draft" || status === "scheduled"
}

function canEnd(status: string): boolean {
  return status === "draft" || status === "scheduled" || status === "active"
}

function formatSchedule(iso?: string | null): string {
  if (!iso) return "segera"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "segera"
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
}

function ActivateAction({ row, busy, setBusy }: { row: PromotionRow; busy: boolean; setBusy: (v: boolean) => void }) {
  const [impact, setImpact] = React.useState<{ products?: number; variants?: number; error?: string } | null>(null)
  const { csrf } = usePage<SharedPageProps>().props
  const isScheduled = row.status === "scheduled"
  const isFuture = Boolean(row.starts_at && new Date(row.starts_at) > new Date())

  const actionLabel = isScheduled ? "Mulai Sekarang" : isFuture ? "Jadwalkan" : "Aktifkan"
  const modalTitle = isScheduled ? "Mulai kampanye sekarang?" : isFuture ? "Jadwalkan kampanye?" : "Aktifkan kampanye?"

  async function fetchImpact() {
    setImpact(null)
    try {
      // Tanpa targets: backend memakai items tersimpan sebagai sumber otoritatif.
      // POST fetch wajib membawa CSRF token, tanpa itu endpoint impact 419 dan
      // dialog salah bilang "Kampanye tidak valid untuk diaktifkan".
      const response = await fetch(row.impact_url, {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrf ?? "",
        },
        body: JSON.stringify({}),
      })
      const data = (await response.json()) as { ok: boolean; products?: number; variants?: number; errors?: string[] }
      if (!response.ok || !data.ok) {
        setImpact({ error: data.errors?.[0] ?? "Kampanye tidak valid untuk diaktifkan." })
        return
      }
      setImpact({ products: data.products ?? 0, variants: data.variants ?? 0 })
    } catch {
      setImpact({ error: "Gagal memuat dampak kampanye." })
    }
  }

  function resolveDescription(): string {
    if (impact?.error) return impact.error
    if (!impact) return "Memuat dampak..."
    const counts = `${formatNumber(impact.products ?? 0)} produk / ${formatNumber(impact.variants ?? 0)} varian aktif akan terdampak diskon ${row.discount_percent}%.`
    if (isScheduled) {
      return `Kampanye ini dijadwalkan mulai ${formatSchedule(row.starts_at)}. Memulai sekarang akan memajukan waktu mulai ke saat ini sehingga langsung aktif di etalase toko untuk ${counts}`
    }
    if (isFuture) {
      return `Kampanye ini memiliki jadwal mulai ${formatSchedule(row.starts_at)}. Mengonfirmasi akan menyimpannya sebagai Terjadwal dan aktif otomatis pada jadwal tersebut.`
    }
    return counts
  }

  return (
    <ConfirmAction
      trigger={
        <button type="button" className={rowActionTextClass} disabled={busy} onClick={fetchImpact}>
          {actionLabel}
        </button>
      }
      title={modalTitle}
      description={resolveDescription()}
      confirmLabel={actionLabel}
      variant="primary"
      processing={busy}
      onConfirm={() => {
        // Kampanye gagal validasi -> jangan lanjut aktivasi (di backend pun
        // activate() memvalidasi ulang; guard ini hanya mencegah klik percuma).
        if (impact?.error) return
        setBusy(true)
        router.post(row.activate_url, { start_now: isScheduled }, { preserveScroll: true, onFinish: () => setBusy(false) })
      }}
    />
  )
}

export default function PromotionsIndex({
  title,
  description,
  activeType,
  typeOptions,
  statusOptions,
  rows: initialRows = [],
  createHref,
}: {
  title: string
  description: string
  activeType: string
  typeOptions: Array<{ value: string; label: string }>
  statusOptions: Array<{ value: string; label: string }>
  rows: PromotionRow[]
  createHref: string
}) {
  const [rows, setRows] = React.useState(initialRows)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("")

  const filteredRows = rows.filter((row) => {
    const byName = search.trim() === "" || row.name.toLowerCase().includes(search.trim().toLowerCase())
    const byStatus = statusFilter === "" || row.status === statusFilter
    return byName && byStatus
  })

  React.useEffect(() => {
    // Sync dari props saat Inertia me-render ulang (data tabel bisa berubah dari server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initialRows)
  }, [initialRows])

  return (
    <AdminLayout
      title={title}
      description={description}
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
          <Button asChild size="sm">
            <Link href={createHref}>
              <Icon name="plus" className="size-4" aria-hidden="true" />
              Tambah {activeType === "flash_sale" ? "Flash Sale" : "Promo"}
            </Link>
          </Button>
        </div>
      }
    >
      <Head title={title} />
      <ManagePromotionsTabs active="promotions" />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {typeOptions.map((option) => (
              <Button key={option.value} asChild variant={option.value === activeType ? "primary" : "secondary"} size="sm">
                <Link href={routeUrl("admin.promotions.index", { type: option.value })} preserveScroll>
                  {option.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <input
              type="search"
              className="h-9 w-full rounded-md border border-input bg-surface px-3 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              placeholder="Cari nama kampanye…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Icon name="magnifying-glass" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
          {search.trim() || statusFilter ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("") }}>
              Reset filter
            </Button>
          ) : null}
          <Select className="w-44" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Semua status</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </div>

        <div>
          {filteredRows.length === 0 ? (
            <EmptyState title="Belum ada kampanye" description="Buat kampanye pertama untuk mulai memberikan diskon." />
          ) : (
            <Card className="overflow-hidden border border-border bg-card">
              <div className="overflow-x-auto">
                <Table className="min-w-[62rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Diskon</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Produk</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} label={STATUS_LABELS[row.status] ?? row.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-semibold text-primary">{row.discount_percent}%</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.starts_at ? new Date(row.starts_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "Tanpa batas"}
                      <span className="block">→</span>
                      {row.ends_at ? new Date(row.ends_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "tanpa batas"}
                    </TableCell>
                    <TableCell>
                      <ul className="max-w-64 space-y-0.5">
                        {row.targets.slice(0, 3).map((target, index) => (
                          <li key={index} className="truncate text-xs text-muted-foreground">
                            {target.excluded ? (
                              <span className="text-destructive line-through">{target.label}</span>
                            ) : (
                              <>
                                {target.label}
                                {target.override_discount_percent ? ` (${target.override_discount_percent}%)` : ""}
                              </>
                            )}
                          </li>
                        ))}
                        {row.targets.length > 3 ? <li className="text-xs text-muted-foreground">+{row.targets.length - 3} lainnya</li> : null}
                      </ul>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.products_count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link className={rowActionTextClass} href={row.edit_href}>
                          Edit
                        </Link>
                        <button
                          type="button"
                          className={rowActionTextClass}
                          disabled={busyId === row.id}
                          onClick={() => {
                            setBusyId(row.id)
                            router.post(row.duplicate_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
                          }}
                        >
                          Duplikat
                        </button>
                        {canActivate(row.status) ? (
                          <ActivateAction row={row} busy={busyId === row.id} setBusy={(v) => setBusyId(v ? row.id : null)} />
                        ) : null}
                        {canEnd(row.status) ? (
                          <ConfirmAction
                            trigger={
                              <button type="button" className={cn(rowActionTextClass, "text-destructive")} disabled={busyId === row.id}>
                                Akhiri
                              </button>
                            }
                            title="Akhiri kampanye?"
                            description={`"${row.name}" akan diakhiri dan diskon berhenti berlaku.`}
                            confirmLabel="Akhiri"
                            processing={busyId === row.id}
                            onConfirm={() => {
                              setBusyId(row.id)
                              router.post(row.end_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
                            }}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
