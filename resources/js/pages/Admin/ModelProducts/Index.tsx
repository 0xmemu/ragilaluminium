import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu } from "@/components/admin/row-actions"
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ReorderActionButton } from "@/components/admin/reorder-action-button"
import { ReorderDragHandle } from "@/components/admin/reorder-drag-handle"
import { Card } from "@/components/admin/ui/card"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Pagination } from "@/components/admin/ui/pagination"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/admin/ui/table"
import { ManageProductsTabs } from "@/components/admin/manage-products-tabs"
import AdminLayout from "@/layouts/admin-layout"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"
import { routeUrl } from "@/lib/routes"
import type { Pagination as PaginationData } from "@/types"

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

type ViewMode = "list" | "grid"

/** Toggle Grid/List. Klik mengubah state lokal; URL disinkronkan lewat router. */
function ViewToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="flex gap-1 rounded-md border border-border p-1">
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-pressed={viewMode === "grid"}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-semibold",
          viewMode === "grid"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        <Icon name="layout-grid" className="size-3.5" aria-hidden="true" />
        Grid
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={viewMode === "list"}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-semibold",
          viewMode === "list"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        <Icon name="menu" className="size-3.5" aria-hidden="true" />
        List
      </button>
    </div>
  )
}

export default function ModelProductsIndex({
  title,
  description,
  viewMode: initialViewMode = "list",
  filters,
  statusOptions,
  categoryOptions = [],
  rows: initialRows = [],
  perPage = 20,
  pagination = null,
  createHref,
  reorderUrl,
  syncUrl,
}: {
  title: string
  description: string
  viewMode?: ViewMode
  filters: { q: string; status: string; product_category?: string }
  statusOptions: Array<{ value: string; label: string }>
  categoryOptions?: Array<{ value: string; label: string }>
  rows: ModelRow[]
  perPage?: number
  pagination?: PaginationData | null
  createHref: string
  reorderUrl: string
  syncUrl: string
}) {
  const [q, setQ] = React.useState(filters.q)
  const [status, setStatus] = React.useState(filters.status)
  const [viewMode, setViewMode] = React.useState<ViewMode>(initialViewMode)
  const [reorderMode, setReorderMode] = React.useState(false)
  const [rows, setRows] = React.useState(initialRows)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const reorderForm = useForm({
    rows: initialRows.map((row, index) => ({ id: row.id, sort_order: index })),
  })

  React.useEffect(() => {
    // Inertia refresh replaces the editable rows with the server snapshot.
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
    // `useForm` returns a new facade on every render; the server snapshot is the only dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRows])

  function apply(next?: Partial<{ q: string; status: string; product_category: string; view: string; per_page: string }>) {
    const view = next?.view ?? viewMode
    const nextQ = next?.q !== undefined ? next.q : q
    const nextStatus = next?.status !== undefined ? next.status : status
    const nextCategory = next?.product_category !== undefined ? next.product_category : (filters.product_category ?? "")
    const nextPerPage = next?.per_page !== undefined ? next.per_page : String(perPage)

    router.get(
      routeUrl("admin.model-products.index"),
      {
        q: nextQ || undefined,
        status: nextStatus || undefined,
        product_category: nextCategory || undefined,
        view: view === "grid" ? "grid" : undefined,
        // 20 adalah default server, jadi tidak perlu ditulis di URL.
        per_page: nextPerPage && nextPerPage !== "20" ? nextPerPage : undefined,
      },
      { preserveState: true, preserveScroll: true },
    )
  }

  const activeFilters = React.useMemo(() => {
    const chips: Array<{ label: string; clear: () => void }> = []
    if (filters.product_category) {
      const option = categoryOptions?.find((o) => o.value === filters.product_category)
      chips.push({
        label: `Kategori: ${option?.label ?? filters.product_category}`,
        clear: () => apply({ product_category: "" }),
      })
    }
    if (filters.status) {
      const option = statusOptions.find((o) => o.value === filters.status)
      chips.push({
        label: `Status: ${option?.label ?? filters.status}`,
        clear: () => {
          setStatus("")
          apply({ status: "" })
        },
      })
    }
    if (filters.q?.trim()) {
      chips.push({
        label: `Cari: ${filters.q}`,
        clear: () => {
          setQ("")
          apply({ q: "" })
        },
      })
    }
    return chips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.product_category, filters.status, filters.q, categoryOptions, statusOptions])

  function resetAllFilters() {
    setQ("")
    setStatus("")
    router.get(
      routeUrl("admin.model-products.index"),
      {
        view: viewMode === "grid" ? "grid" : undefined,
        per_page: perPage !== 20 ? String(perPage) : undefined,
      },
      { preserveState: false, preserveScroll: true },
    )
  }

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode)
    apply({ view: mode })
  }

  function reorderRows(from: number, to: number) {
    if (from === to) return
    const next = [...rows]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    const numbered = next.map((row, i) => ({ ...row, no: i + 1, sort_order: i }))
    setRows(numbered)
    reorderForm.setData(
      "rows",
      numbered.map((row, i) => ({ id: row.id, sort_order: i })),
    )
  }

  function saveReorder() {
    // Mode Urutkan otomatis nonaktif setelah tersimpan; snapshot baru dari server
    // menimpa rows lokal via useEffect [initialRows]. Query view dipertahankan
    // supaya redirect tetap di tampilan yang sama (grid tidak terlempar ke list).
    reorderForm.put(reorderUrl, {
      onSuccess: () => setReorderMode(false),
      preserveState: true,
    })
  }

  /** Batalkan mode Urutkan: kembalikan urutan ke snapshot server lalu keluar. */
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

  // Geser-urut hanya sahih saat daftar memuat seluruh baris: payload simpan hanya
  // berisi baris yang tampil, jadi daftar tersaring atau berhalaman menulis
  // sort_order parsial.
  const halamanTunggal = (pagination?.last_page ?? 1) <= 1
  const listTersaring =
    filters.q.trim() !== "" ||
    filters.status !== "" ||
    (filters.product_category ?? "") !== "" ||
    !halamanTunggal
  // Pencarian dibersihkan sendiri oleh tombol Urutkan, jadi hanya filter lain
  // yang mengunci tombolnya.
  const filterKunci =
    filters.status !== "" || (filters.product_category ?? "") !== "" || !halamanTunggal
  const filterKunciReason = !halamanTunggal
    ? "Naikkan ukuran halaman sampai semua model tampil dalam satu halaman supaya urutan bisa disimpan sekaligus."
    : "Kosongkan filter status dan kategori dulu supaya tombol Urutkan bisa dipakai."

  // Ikon tarik hanya ada saat mode Urutkan aktif dan daftar tidak tersaring
  // (kontrak owner 2026-09-20, direvisi).
  const dragAktif = reorderMode && !listTersaring

  const dnd = useRowDragSort({
    enabled: dragAktif,
    count: rows.length,
    onReorder: reorderRows,
    // Urutan hanya berarti untuk model yang tampil di toko; model nonaktif
    // tidak bisa digeser supaya tidak menghabiskan posisi urutan percuma.
    isRowDraggable: (index) => rows[index]?.status === "active",
  })

  function ModelActions({ row }: { row: ModelRow }) {
    return (
      <RowActions>
        <Button asChild variant="secondary" size="xs">
          <Link href={row.edit_href}>Edit</Link>
        </Button>
        <RowActionsMenu>
          {row.status === "active" ? (
            <ConfirmAction
              trigger={
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                  disabled={busyId === row.id}
                >
                  Nonaktifkan
                </button>
              }
              title="Sembunyikan model?"
              description="Model tidak tampil di beranda / showcase sampai diaktifkan kembali."
              confirmLabel="Nonaktifkan"
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
            <DropdownMenuItem asChild>
              <button
                type="button"
                className="w-full text-left"
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
              </button>
            </DropdownMenuItem>
          )}
        </RowActionsMenu>
      </RowActions>
    )
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.post(syncUrl)}
            title="Tambahkan model dari kombinasi kategori + model produk yang belum terdaftar, dan nonaktifkan model yang sudah tidak punya produk aktif."
          >
            <Icon name="refresh" className="size-4" aria-hidden="true" />
            Muat ulang katalog
          </Button>
          {/* Satu tombol yang berubah peran mengikuti keadaan (kontrak owner 2026-09-20):
              Urutkan -> Urungkan saat mode aktif -> Simpan urutan begitu ada urutan
              yang benar-benar digeser. */}
          <ReorderActionButton
            active={reorderMode}
            dirty={reorderForm.isDirty}
            processing={reorderForm.processing}
            disabled={!rows.length || filterKunci}
            disabledReason={filterKunciReason}
            onToggle={() => {
              setReorderMode(true)
              // Urutan tidak bisa diubah saat daftar tersaring, jadi pencarian
              // dibersihkan sekaligus saat mode Urutkan dinyalakan.
              if (filters.q) {
                setQ("")
                apply({ q: "" })
              }
            }}
            onCancel={cancelOrder}
            onSave={saveReorder}
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
      <Head title={`${title} | Admin`} />
      <ManageProductsTabs active="models" />

      {reorderMode ? (
        <div className="mb-4 rounded-lg border border-info/20 bg-info/10 px-4 py-3 text-sm text-info">
          Mode Urutkan aktif: pakai ikon tarik di tepi kiri baris untuk memindahkan, lalu simpan.
        </div>
      ) : null}

      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => apply({ q }),
          placeholder: "Cari nama atau kode model…",
        }}
        summary={
          <span>
            <span className="tabular-nums font-semibold text-foreground">
              {formatNumber(pagination?.total ?? rows.length)}
            </span>{" "}
            model
          </span>
        }
        actions={<ViewToggle viewMode={viewMode} onChange={changeViewMode} />}
        className="mb-4"
      >
        {categoryOptions && categoryOptions.length > 0 ? (
          <Select
            className="flex-1 min-w-0"
            value={filters.product_category ?? ""}
            onChange={(event) => apply({ product_category: event.target.value })}
            aria-label="Filter kategori"
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          value={status}
          onChange={(event) => {
            const value = event.target.value
            setStatus(value)
            apply({ status: value })
          }}
          className="w-40"
          aria-label="Filter status"
        >
          {statusOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={String(perPage)}
          onChange={(event) => apply({ per_page: event.target.value })}
          className="w-40"
          aria-label="Baris per halaman"
        >
          <option value="20">20 baris</option>
          <option value="50">50 baris</option>
          <option value="100">100 baris</option>
        </Select>
      </ListToolbar>

      {/* Filter aktif chips (seragam dengan halaman produk) */}
      {activeFilters.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
          <span className="text-[11px] font-medium text-muted-foreground">
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

      {!rows.length ? (
        <Card className="overflow-hidden border border-border bg-card">
          <EmptyState
            title="Belum ada model produk"
            description="Sinkronkan dari katalog atau tambah model manual untuk showcase beranda."
            className="border-0"
          />
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {rows.map((row, index) => (
            <article
              key={row.id}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft",
                dnd.draggingIndex === index && "opacity-40",
                dnd.targetIndex === index && dnd.draggingIndex !== null && dnd.draggingIndex !== index && "ring-2 ring-primary",
                reorderMode && row.status !== "active" && "opacity-60",
              )}
              {...(dragAktif ? dnd.rowProps(index) : {})}
            >
              {/* Ikon tarik hanya ada saat mode Urutkan aktif, dan hanya pada kartu
                  model aktif: urutan hanya berarti untuk model yang tampil di toko. */}
              {dragAktif && row.status === "active" ? (
                <span className="absolute left-2 top-2 z-10 rounded-md bg-background/90 shadow-soft">
                  <ReorderDragHandle enabled />
                </span>
              ) : null}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                {row.image_url ? (
                  <img
                    src={row.image_url}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground">
                    <Icon name="box" className="size-10" aria-hidden="true" />
                  </span>
                )}
                <span className="absolute right-2 top-2">
                  <StatusBadge
                    status={row.status === "active" ? "active" : "inactive"}
                    label={row.status === "active" ? "Aktif" : "Nonaktif"}
                  />
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                  <Link href={row.edit_href} className="font-semibold hover:text-primary hover:underline">
                    {row.name}
                  </Link>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {[row.product_category, row.product_model].filter(Boolean).join(" · ") || "Belum tertaut katalog"}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted/50 px-2 py-1.5">
                    <dt className="text-[10px] font-medium tracking-tight text-muted-foreground">Sub model</dt>
                    <dd className="text-sm font-semibold tabular-nums">{formatNumber(row.sub_model_count)}</dd>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2 py-1.5">
                    <dt className="text-[10px] font-medium tracking-tight text-muted-foreground">Aktif</dt>
                    <dd className="text-sm font-semibold tabular-nums">{formatNumber(row.active_count)}</dd>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2 py-1.5">
                    <dt className="text-[10px] font-medium tracking-tight text-muted-foreground">Variasi</dt>
                    <dd className="text-sm font-semibold tabular-nums">{formatNumber(row.variant_count)}</dd>
                  </div>
                </dl>
                {row.sub_models.length ? (
                  <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                    {row.sub_models.join(", ")}
                  </p>
                ) : null}
                <div className="mt-auto flex justify-end">
                  <ModelActions row={row} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden border border-border bg-card">
          <TableScroll>
            <Table>
              <TableHeader className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
                <TableRow>
                  {dragAktif ? <TableHead className="w-12" aria-label="Seret" /> : null}
                  <TableHead className="text-center">No</TableHead>
                  <TableHead>Model Produk</TableHead>
                  <TableHead className="text-center">Jumlah Sub Model</TableHead>
                  <TableHead className="text-center">Produk Aktif</TableHead>
                  <TableHead className="text-center">Produk Arsip</TableHead>
                  <TableHead className="text-center">Total Variasi</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "align-top",
                      dnd.draggingIndex === index && "opacity-40",
                      reorderMode && row.status !== "active" && "opacity-60",
                    )}
                    {...(dragAktif ? dnd.rowProps(index) : {})}
                  >
                    {/* Ikon tarik hanya ada saat mode Urutkan aktif, dan hanya pada baris
                        model aktif: urutan hanya berarti untuk model yang tampil di toko.
                        Baris nonaktif tidak merender ikon sama sekali. */}
                    {dragAktif ? (
                      <TableCell className="w-12">
                        <ReorderDragHandle enabled={row.status === "active"} />
                      </TableCell>
                    ) : null}
                    <TableCell className="text-center text-muted-foreground" numeric>
                      {row.no}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-center">
                      <p className="font-semibold tabular-nums">{formatNumber(row.sub_model_count)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {row.sub_models.length ? row.sub_models.join(", ") : "-"}
                      </p>
                    </TableCell>
                    <TableCell className="text-center font-semibold" numeric>{formatNumber(row.active_count)}</TableCell>
                    <TableCell className="text-center text-muted-foreground" numeric>{formatNumber(row.archived_count)}</TableCell>
                    <TableCell className="text-center font-semibold" numeric>{formatNumber(row.variant_count)}</TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center justify-center">
                        <StatusBadge
                          status={row.status === "active" ? "active" : "inactive"}
                          label={row.status === "active" ? "Aktif" : "Nonaktif"}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="w-[1%] whitespace-nowrap text-right">
                      <ModelActions row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        </Card>
      )}

      <Pagination pagination={pagination} />
    </AdminLayout>
  )
}
