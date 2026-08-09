import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
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
    <AdminLayout title={title} description={description}>
      <Head title={title} />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {modelOptions.map((option) => (
              <Button
                key={option.value}
                asChild
                variant={option.value === activeModel ? "default" : "secondary"}
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
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={createHref}>Tambah Sub Model</Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={saveOrder} disabled={reorderForm.processing}>
              Simpan Urutan
            </Button>
          </div>
        </div>

        <Card>
          {rows.length === 0 ? (
            <EmptyState
              title="Belum ada sub model"
              description="Tambahkan sub model pertama untuk model ini."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Urut</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-right">Produk Aktif</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell>
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
