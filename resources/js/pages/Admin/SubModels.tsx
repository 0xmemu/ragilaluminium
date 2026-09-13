import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { rowActionTextClass } from "@/components/admin/row-actions"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { Icon } from "@/components/shared/icon"
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
import { ManageProductsTabs } from "@/components/admin/manage-products-tabs"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

interface SubModelRow {
  id: number
  code: string
  name: string
  description?: string | null
  image_url?: string | null
  sort_order: number
  is_active: boolean
  products_count: number
  edit_href: string
  toggle_url: string
}

export default function SubModelsIndex({
  title,
  description,
  activeModel,
  modelOptions,
  rows: initialRows = [],
  createHref,
  reorderUrl,
}: {
  title: string
  description: string
  activeModel: string
  modelOptions: Array<{ value: string; label: string }>
  rows: SubModelRow[]
  createHref: string
  reorderUrl: string
}) {
  const [rows, setRows] = React.useState(initialRows)
  const [reorderMode, setReorderMode] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const reorderForm = useForm({
    rows: initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
  })

  React.useEffect(() => {
    // Sync dari props saat Inertia me-render ulang (reorder bisa di-reset server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initialRows)
    reorderForm.setData(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRows])

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setRows(next)
    reorderForm.setData("rows", next.map((row, rowIndex) => ({ id: row.id, sort_order: rowIndex })))
  }

  function saveOrder() {
    reorderForm.post(reorderUrl, { preserveScroll: true })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setReorderMode((v) => !v)}>
            {reorderMode ? "Nonaktifkan mode geser" : "Aktifkan mode geser"}
          </Button>
          {reorderMode ? (
            <Button onClick={saveOrder} disabled={reorderForm.processing}>
              {reorderForm.processing ? "Menyimpan..." : "Simpan urutan"}
            </Button>
          ) : null}
          <Button asChild>
            <Link href={createHref}>
              <Icon name="plus" className="size-4" aria-hidden="true" />
              Tambah sub model
            </Link>
          </Button>
        </div>
      }
    >
      <Head title={title} />
      <ManageProductsTabs active="subModels" />
      <div className="space-y-6">
        {reorderMode ? (
          <div className="rounded-lg border border-info/20 bg-info/10 px-4 py-3 text-sm text-info">
            Atur urutan sub model dengan tombol naik/turun, lalu simpan.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {modelOptions.map((option) => (
              <Button
                key={option.value}
                asChild
                variant={option.value === activeModel ? "primary" : "secondary"}
                size="sm"
              >
                <Link
                  href={routeUrl("admin.sub-models.index", { product_model: option.value })}
                  preserveScroll
                >
                  {option.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden border border-border bg-card">
          {rows.length === 0 ? (
            <EmptyState
              className="p-8"
              title="Belum ada sub model"
              description="Tambahkan sub model pertama untuk model ini."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
                  <TableHead className="w-12 text-center">Urut</TableHead>
                  <TableHead className="text-left">Kode</TableHead>
                  <TableHead className="text-left">Nama Sub Model</TableHead>
                  <TableHead className="text-left">Deskripsi</TableHead>
                  <TableHead className="text-center">Produk Aktif</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-center">
                      {reorderMode ? (
                        <div className="flex flex-col">
                          <button
                            type="button"
                            className={cn(rowActionTextClass, "disabled:opacity-30")}
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={cn(rowActionTextClass, "disabled:opacity-30")}
                            disabled={index === rows.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            ↓
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell className="font-medium">
                      {row.image_url ? (
                        <span className="inline-flex items-center gap-2">
                          <img src={row.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                          {row.name}
                        </span>
                      ) : (
                        row.name
                      )}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                      {row.description ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.products_count}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.is_active ? "active" : "inactive"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link className={rowActionTextClass} href={row.edit_href}>
                          Edit
                        </Link>
                        <ConfirmAction
                          trigger={
                            <button type="button" className={cn(rowActionTextClass, "text-destructive")} disabled={busyId === row.id}>
                              {row.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          }
                          title={row.is_active ? "Nonaktifkan sub model?" : "Aktifkan sub model?"}
                          description={
                            row.is_active
                              ? `"${row.name}" tidak akan muncul sebagai pilihan sub model baru.`
                              : `"${row.name}" akan muncul kembali sebagai pilihan sub model.`
                          }
                          confirmLabel={row.is_active ? "Nonaktifkan" : "Aktifkan"}
                          processing={busyId === row.id}
                          onConfirm={() => {
                            setBusyId(row.id)
                            router.post(row.toggle_url, {}, {
                              preserveScroll: true,
                              onFinish: () => setBusyId(null),
                            })
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
