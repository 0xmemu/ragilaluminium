import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu, rowActionTextClass } from "@/components/admin/row-actions"
import { Button } from "@/components/admin/ui/button"
import { ReorderActionButton } from "@/components/admin/reorder-action-button"
import { Card } from "@/components/admin/ui/card"
import { Icon } from "@/components/shared/icon"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Select } from "@/components/admin/ui/select"
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
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"
import { markGroupRows } from "@/lib/search-select"
import { routeUrl } from "@/lib/routes"

interface SubModelRow {
  id: number
  product_model: string
  model_label: string
  code: string
  name: string
  description?: string | null
  sort_order: number
  is_active: boolean
  products_count: number
  edit_href: string
  toggle_url: string
}

interface FilterOption {
  value: string
  label: string
}

export interface StatusTab {
  key: string
  label: string
  count: number
}

interface SubModelsProps {
  title: string
  description: string
  activeModel: string | null
  activeStatus?: "all" | "active" | "inactive"
  filters?: {
    q: string
    product_model: string
    status: string
  }
  statusOptions?: FilterOption[]
  statusTabs?: StatusTab[]
  modelOptions: FilterOption[]
  rows: SubModelRow[]
  createHref: string
  reorderUrl: string
}

export default function SubModelsIndex({
  title,
  description,
  activeModel,
  activeStatus = "all",
  filters = { q: "", product_model: activeModel ?? "", status: activeStatus },
  statusOptions = [
    { value: "all", label: "Semua status" },
    { value: "active", label: "Aktif" },
    { value: "inactive", label: "Nonaktif" },
  ],
  modelOptions,
  rows: initialRows = [],
  createHref,
  reorderUrl,
}: SubModelsProps) {
  const [rows, setRows] = React.useState(initialRows)
  const [reorderMode, setReorderMode] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [q, setQ] = React.useState(filters?.q ?? "")

  const currentStatus = filters?.status ?? activeStatus ?? "all"
  const currentModel = filters?.product_model ?? activeModel ?? ""

  const reorderForm = useForm({
    rows: initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
  })

  React.useEffect(() => {
    // Sync dari props saat Inertia me-render ulang.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initialRows)
    // Data dan defaults dipindah bersama: `isDirty` membandingkan data dengan
    // defaults, jadi keduanya harus berisi snapshot server yang sama.
    reorderForm.setData(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
    reorderForm.setDefaults(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRows])

  function visit(params: Record<string, string | undefined>) {
    const next: Record<string, string> = {}
    const merged = {
      q: filters?.q ?? "",
      product_model: currentModel,
      status: currentStatus,
      ...params,
    }
    Object.entries(merged).forEach(([key, value]) => {
      if (!value || value === "all") return
      if (key === "q" && !value.trim()) return
      next[key] = value
    })
    router.get(routeUrl("admin.sub-models.index"), next, {
      preserveState: true,
      replace: true,
    })
  }

  // Owner 2026-09-16: mode geser hanya aktif pada filter sub model yang aktif.
  const canReorder = currentStatus === "active" && Boolean(currentModel) && rows.length > 1
  const reorderDisabledReason =
    currentStatus !== "active"
      ? "Mode geser hanya aktif pada filter sub model yang aktif."
      : !currentModel
      ? "Pilih satu model dulu; urutan berlaku per model."
      : rows.length <= 1
      ? "Minimal 2 sub model aktif untuk mengatur urutan."
      : undefined

  React.useEffect(() => {
    if (currentStatus !== "active" || !currentModel) {
      // Filter berubah membuat urutan tidak lagi bisa digeser, jadi mode geser
      // ikut dimatikan supaya tombol header tidak menampilkan keadaan palsu.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReorderMode(false)
    }
  }, [currentStatus, currentModel])

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setRows(next)
    reorderForm.setData("rows", next.map((row, rowIndex) => ({ id: row.id, sort_order: rowIndex })))
  }

  function reorderRows(from: number, to: number) {
    if (from === to) return
    const next = [...rows]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setRows(next)
    reorderForm.setData("rows", next.map((row, rowIndex) => ({ id: row.id, sort_order: rowIndex })))
  }

  // Geser-urut hanya sahih saat daftar memuat seluruh sub model pada model yang
  // dipilih: payload simpan hanya berisi baris yang tampil, jadi daftar tersaring
  // menulis sort_order parsial. Pencarian dibersihkan sendiri oleh tombol Urutkan.
  const listTersaring = (filters?.q ?? "").trim() !== ""

  const dnd = useRowDragSort({
    enabled: reorderMode && currentStatus === "active" && !listTersaring,
    count: rows.length,
    onReorder: reorderRows,
  })

  // Kontrak 2026-09-16: tanpa model terpilih, seluruh sub model tampil
  // dikelompokkan per model; nomor urut dihitung ulang dalam grupnya.
  const grouped = !currentModel

  const displayRows = React.useMemo(
    () => (grouped ? markGroupRows(rows) : rows.map((row) => ({ ...row, groupHeader: false, displayNumber: 0 }))),
    [rows, grouped],
  )

  const activeFilters = React.useMemo(() => {
    const chips: Array<{ label: string; clear: () => void }> = []
    if (currentModel) {
      const option = modelOptions.find((o) => o.value === currentModel)
      chips.push({
        label: `Model: ${option?.label ?? currentModel}`,
        clear: () => visit({ product_model: "" }),
      })
    }
    if (currentStatus && currentStatus !== "all") {
      const option = statusOptions.find((o) => o.value === currentStatus)
      chips.push({
        label: `Status: ${option?.label ?? currentStatus}`,
        clear: () => visit({ status: "all" }),
      })
    }
    if (filters?.q?.trim()) {
      chips.push({
        label: `Cari: ${filters.q}`,
        clear: () => visit({ q: "" }),
      })
    }
    return chips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModel, currentStatus, filters?.q, modelOptions, statusOptions])

  function resetAllFilters() {
    router.get(routeUrl("admin.sub-models.index"), {}, { preserveState: false, preserveScroll: true })
  }

  function saveOrder() {
    reorderForm.post(reorderUrl, {
      preserveScroll: true,
      onSuccess: () => setReorderMode(false),
    })
  }

  /** Batalkan mode geser: kembalikan urutan ke snapshot server lalu keluar. */
  function cancelOrder() {
    setRows(initialRows)
    reorderForm.setData(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
    reorderForm.setDefaults(
      "rows",
      initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
    )
    setReorderMode(false)
  }


  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Satu tombol yang berubah peran mengikuti keadaan (kontrak owner 2026-09-20):
              Urutkan -> Urungkan saat mode aktif -> Simpan urutan begitu ada urutan
              yang benar-benar digeser. */}
          <ReorderActionButton
            active={reorderMode}
            dirty={reorderForm.isDirty}
            processing={reorderForm.processing}
            disabled={!canReorder}
            disabledReason={reorderDisabledReason}
            onToggle={() => {
              setReorderMode(true)
              // Urutan tidak bisa digeser saat daftar tersaring, jadi pencarian
              // dibersihkan sekaligus saat mode geser dinyalakan.
              if (listTersaring) visit({ q: "" })
            }}
            onCancel={cancelOrder}
            onSave={saveOrder}
          />
          {!reorderMode ? (
            <Button asChild>
              <Link href={createHref}>
                <Icon name="plus" className="size-4" aria-hidden="true" />
                Tambah
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <Head title={title} />
      <ManageProductsTabs active="subModels" />
      <div className="space-y-4">
        {reorderMode ? (
          <div className="rounded-lg border border-info/20 bg-info/10 px-4 py-3 text-sm text-info">
            Atur urutan dengan drag & drop atau tombol naik/turun, lalu simpan.
          </div>
        ) : null}

        {/* Pencarian dan filter model / status (seragam dengan halaman produk) */}
        <ListToolbar
          search={{
            value: q,
            onChange: setQ,
            onSubmit: () => visit({ q }),
            placeholder: "Cari nama, kode, atau deskripsi sub model…",
          }}
          summary={
            <span>
              <span className="tabular-nums font-semibold text-foreground">
                {formatNumber(rows.length)}
              </span>{" "}
              sub model
            </span>
          }
          className="mb-4"
        >
          <Select
            className="flex-1 min-w-0"
            value={currentModel}
            onChange={(event) => visit({ product_model: event.target.value })}
            aria-label="Filter model"
          >
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            className="w-40"
            value={currentStatus}
            onChange={(event) => visit({ status: event.target.value })}
            aria-label="Filter status"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </ListToolbar>

        {/* Filter aktif chips */}
        {activeFilters.length ? (
          <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Filter aktif
            </span>
            {activeFilters.map((filter) => (
              <span
                key={filter.label}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground"
              >
                {filter.label}
                <button
                  type="button"
                  onClick={filter.clear}
                  className="inline-flex size-3.5 items-center justify-center rounded-full hover:bg-foreground/10"
                  aria-label={`Hapus filter ${filter.label}`}
                >
                  <Icon name="x" className="size-2.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={resetAllFilters}
              className="ml-1 text-xs font-medium text-muted-foreground underline hover:text-foreground"
            >
              Hapus semua filter
            </button>
          </div>
        ) : null}

        <Card className="overflow-hidden border border-border bg-card">
          {rows.length === 0 ? (
            <EmptyState
              className="p-8"
              title={
                currentStatus === "active"
                  ? "Belum ada sub model aktif"
                  : currentStatus === "inactive"
                  ? "Belum ada sub model nonaktif"
                  : "Belum ada sub model"
              }
              description={
                activeFilters.length
                  ? "Tidak ada sub model yang cocok dengan filter yang dipilih."
                  : currentModel
                  ? "Tambahkan sub model pertama untuk model ini."
                  : "Belum ada sub model terdaftar. Gunakan tombol Tambah."
              }
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
                  <TableHead className="w-[1%] whitespace-nowrap text-right pr-4">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.map((row, index) => (
                  <React.Fragment key={row.id}>
                    {row.groupHeader ? (
                      <TableRow className="bg-surface/60">
                        <TableCell colSpan={7} className="py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {row.model_label}
                        </TableCell>
                      </TableRow>
                    ) : null}
                    <TableRow className={cn(dnd.draggingIndex === index && "opacity-40")} {...(reorderMode ? dnd.rowProps(index) : {})}>
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
                        <span className="text-muted-foreground">{row.displayNumber}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                      {row.description ?? "-"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{row.products_count}</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={row.is_active ? "active" : "inactive"} />
                    </TableCell>
                    <TableCell className="w-[1%] whitespace-nowrap text-right pr-4">
                      <RowActions>
                        <Button asChild variant="secondary" size="xs">
                          <Link href={row.edit_href}>Edit</Link>
                        </Button>
                        <RowActionsMenu>
                          <ConfirmAction
                            trigger={
                              <button
                                type="button"
                                className={cn(
                                  "w-full px-2 py-1.5 text-left text-xs",
                                  row.is_active ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted"
                                )}
                                disabled={busyId === row.id}
                              >
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
                        </RowActionsMenu>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
