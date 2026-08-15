import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { rowActionTextClass } from "@/components/admin/row-actions"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
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
  sync_banner: boolean
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

function ActivateAction({ row, busy, setBusy }: { row: PromotionRow; busy: boolean; setBusy: (v: boolean) => void }) {
  const [impact, setImpact] = React.useState<{ products?: number; variants?: number; error?: string } | null>(null)

  async function fetchImpact() {
    setImpact(null)
    try {
      const response = await fetch(row.impact_url, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/json" },
        body: JSON.stringify({ targets: [] }),
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

  return (
    <ConfirmAction
      trigger={
        <button type="button" className={rowActionTextClass} disabled={busy || Boolean(impact?.error)} onClick={fetchImpact}>
          Aktifkan
        </button>
      }
      title="Aktifkan kampanye?"
      description={
        impact?.error
          ? impact.error
          : impact
            ? `${formatNumber(impact.products ?? 0)} produk / ${formatNumber(impact.variants ?? 0)} varian aktif akan terdampak diskon ${row.discount_percent}%.`
            : "Memuat dampak…"
      }
      confirmLabel="Aktifkan"
      variant="primary"
      processing={busy}
      onConfirm={() => {
        setBusy(true)
        router.post(row.activate_url, {}, { preserveScroll: true, onFinish: () => setBusy(false) })
      }}
    />
  )
}

export default function PromotionsIndex({
  title,
  description,
  activeType,
  typeOptions,
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

  React.useEffect(() => {
    // Sync dari props saat Inertia me-render ulang (data tabel bisa berubah dari server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initialRows)
  }, [initialRows])

  return (
    <AdminLayout title={title} description={description}>
      <Head title={title} />
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
          <Button asChild size="sm">
            <Link href={createHref}>Tambah {activeType === "flash_sale" ? "Flash Sale" : "Promo"}</Link>
          </Button>
        </div>

        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState title="Belum ada kampanye" description="Buat kampanye pertama untuk mulai memberikan diskon." />
          ) : (
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
                  <TableHead className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.name}</span>
                        {row.sync_banner ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            <Icon name="image" className="h-3 w-3" />
                            Banner
                          </span>
                        ) : null}
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
                    <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]">
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
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
