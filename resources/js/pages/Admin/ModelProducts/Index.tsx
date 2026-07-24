import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

interface ModelRow {
  id: number
  no: number
  name: string
  image_url?: string | null
  type: string
  status: string
  sort_order: number
  product_category?: string | null
  product_model?: string | null
  sub_models: string[]
  sub_model_count: number
  active_count: number
  archived_count: number
  variant_count: number
  edit_href: string
  activate_url: string
  deactivate_url: string
}

export default function ModelProductsIndex({
  title,
  description,
  filters,
  statusOptions,
  rows: initialRows = [],
  createHref,
  reorderUrl,
  syncUrl,
}: {
  title: string
  description: string
  filters: { q: string; status: string }
  statusOptions: Array<{ value: string; label: string }>
  rows: ModelRow[]
  createHref: string
  reorderUrl: string
  syncUrl: string
}) {
  const [q, setQ] = React.useState(filters.q)
  const [status, setStatus] = React.useState(filters.status)
  const [reorderMode, setReorderMode] = React.useState(false)
  const [rows, setRows] = React.useState(initialRows)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const reorderForm = useForm({
    rows: initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
  })

  React.useEffect(() => {
    setRows(initialRows)
    reorderForm.setData(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
  }, [initialRows])

  function apply(next?: Partial<{ q: string; status: string }>) {
    router.get(
      routeUrl("admin.model-products.index"),
      {
        q: next?.q ?? q,
        status: next?.status ?? status,
      },
      { preserveState: true, preserveScroll: true },
    )
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    const numbered = next.map((row, i) => ({ ...row, no: i + 1, sort_order: i }))
    setRows(numbered)
    reorderForm.setData(
      "rows",
      numbered.map((row, i) => ({ id: row.id, sort_order: i })),
    )
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setReorderMode((v) => !v)}>
            {reorderMode ? "Nonaktifkan mode geser" : "Aktifkan mode geser"}
          </Button>
          {reorderMode ? (
            <Button
              type="button"
              disabled={reorderForm.processing}
              onClick={() => reorderForm.put(reorderUrl)}
            >
              {reorderForm.processing ? "Menyimpan..." : "Simpan urutan"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.post(syncUrl)}
              >
                Sinkron dari katalog
              </Button>
              <Button asChild>
                <Link href={createHref}>
                  <Icon name="plus" className="size-4" aria-hidden="true" />
                  Tambah model
                </Link>
              </Button>
            </>
          )}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {reorderMode ? (
        <div className="mb-4 rounded-lg border border-info/20 bg-info/10 px-4 py-3 text-sm text-info">
          Atur urutan model produk dengan tombol naik/turun, lalu simpan.
        </div>
      ) : null}

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          apply({ q })
        }}
      >
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Cari nama atau kode model"
          className="min-w-[16rem] flex-1"
        />
        <Select
          value={status}
          onChange={(event) => {
            const value = event.target.value
            setStatus(value)
            apply({ status: value })
          }}
          className="w-40"
        >
          {statusOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button type="submit">Cari</Button>
      </form>

      <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-semibold">No</th>
                  <th className="px-3 py-3 font-semibold">Model produk</th>
                  <th className="px-3 py-3 font-semibold">Jumlah sub model</th>
                  <th className="px-3 py-3 font-semibold">Produk aktif</th>
                  <th className="px-3 py-3 font-semibold">Produk arsip</th>
                  <th className="px-3 py-3 font-semibold">Total variasi</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-3 py-3">
                      {reorderMode ? (
                        <div className="flex flex-col gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-7 px-2 text-xs"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          >
                            ↑
                          </Button>
                          <span className="text-center tabular-nums text-muted-foreground">{row.no}</span>
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-7 px-2 text-xs"
                            disabled={index === rows.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            ↓
                          </Button>
                        </div>
                      ) : (
                        <span className="tabular-nums text-muted-foreground">{row.no}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {row.image_url ? (
                          <img
                            src={row.image_url}
                            alt=""
                            className="size-12 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <span className="inline-flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Icon name="box" className="size-5" aria-hidden="true" />
                          </span>
                        )}
                        <div>
                          <Link href={row.edit_href} className="font-semibold hover:text-primary hover:underline">
                            {row.name}
                          </Link>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {[row.product_category, row.product_model].filter(Boolean).join(" · ") || "Belum tertaut katalog"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold tabular-nums">{formatNumber(row.sub_model_count)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {row.sub_models.length ? row.sub_models.join(", ") : "—"}
                      </p>
                    </td>
                    <td className="px-3 py-3 tabular-nums font-semibold">{formatNumber(row.active_count)}</td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{formatNumber(row.archived_count)}</td>
                    <td className="px-3 py-3 tabular-nums font-semibold">{formatNumber(row.variant_count)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        status={row.status === "active" ? "active" : "inactive"}
                        label={row.status === "active" ? "Aktif" : "Draft"}
                      />
                    </td>
                    <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                      <RowActions>
                        <Button asChild variant="secondary" size="xs">
                          <Link href={row.edit_href}>Edit</Link>
                        </Button>
                        {row.status === "active" ? (
                          <ConfirmAction
                            trigger={
                              <button
                                type="button"
                                className={cn(rowActionTextClass, "text-destructive")}
                                disabled={busyId === row.id}
                              >
                                Draft
                              </button>
                            }
                            title="Sembunyikan model?"
                            description="Model tidak tampil di beranda / showcase jika draft."
                            confirmLabel="Jadikan draft"
                            processing={busyId === row.id}
                            onConfirm={() => {
                              setBusyId(row.id)
                              router.post(row.deactivate_url, {}, {
                                preserveScroll: true,
                                onFinish: () => setBusyId(null),
                              })
                            }}
                          />
                        ) : (
                          <Button
                            size="xs"
                            disabled={busyId === row.id}
                            onClick={() => {
                              setBusyId(row.id)
                              router.post(row.activate_url, {}, {
                                preserveScroll: true,
                                onFinish: () => setBusyId(null),
                              })
                            }}
                          >
                            Aktifkan
                          </Button>
                        )}
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada model produk"
            description="Sinkronkan dari katalog atau tambah model manual untuk showcase beranda."
            className="border-0"
          />
        )}
      </section>
    </AdminLayout>
  )
}
