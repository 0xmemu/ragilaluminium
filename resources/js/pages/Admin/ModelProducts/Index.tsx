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
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { ManageProductsTabs } from "@/components/admin/manage-products-tabs"
import AdminLayout from "@/layouts/admin-layout"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"
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

  function apply(next?: Partial<{ q: string; status: string; product_category: string; view: string }>) {
    const view = next?.view ?? viewMode
    const nextQ = next?.q !== undefined ? next.q : q
    const nextStatus = next?.status !== undefined ? next.status : status
    const nextCategory = next?.product_category !== undefined ? next.product_category : (filters.product_category ?? "")

    router.get(
      routeUrl("admin.model-products.index"),
      {
        q: nextQ || undefined,
        status: nextStatus || undefined,
        product_category: nextCategory || undefined,
        view: view === "grid" ? "grid" : undefined,
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
      { view: viewMode === "grid" ? "grid" : undefined },
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
    // Mode geser otomatis nonaktif setelah tersimpan; snapshot baru dari server
    // menimpa rows lokal via useEffect [initialRows]. Query view dipertahankan
    // supaya redirect tetap di tampilan yang sama (grid tidak terlempar ke list).
    reorderForm.put(reorderUrl, {
      onSuccess: () => setReorderMode(false),
      preserveState: true,
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

  // Geser-urut hanya sahih saat daftar memuat seluruh baris: payload simpan hanya
  // berisi baris yang tampil, jadi daftar tersaring menulis sort_order parsial.
  const listTersaring =
    filters.q.trim() !== "" ||
    filters.status !== "" ||
    (filters.product_category ?? "") !== ""
  // Pencarian dibersihkan sendiri oleh tombol Urutkan, jadi hanya filter lain
  // yang mengunci tombolnya.
  const filterKunci = filters.status !== "" || (filters.product_category ?? "") !== ""

  const dnd = useRowDragSort({
    enabled: reorderMode && !listTersaring,
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
            Refresh katalog
          </Button>
          {/* Satu tombol yang berubah peran mengikuti keadaan (kontrak owner 2026-09-20):
              Urutkan -> Urungkan saat mode aktif -> Simpan urutan begitu ada urutan
              yang benar-benar digeser. */}
          <ReorderActionButton
            active={reorderMode}
            dirty={reorderForm.isDirty}
            processing={reorderForm.processing}
            disabled={!rows.length || filterKunci}
            disabledReason="Kosongkan filter status dan kategori dulu supaya urutan bisa digeser."
            onToggle={() => {
              setReorderMode(true)
              // Urutan tidak bisa digeser saat daftar tersaring, jadi pencarian
              // dibersihkan sekaligus saat mode geser dinyalakan.
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
          Tarik ikon titik enam di kiri baris untuk memindahkan, lalu simpan.
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
              {formatNumber(rows.length)}
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
      </ListToolbar>

      {/* Filter aktif chips (seragam dengan halaman produk) */}
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
              {...(reorderMode && !listTersaring ? dnd.rowProps(index) : {})}
            >
              {/* Geser hanya lewat ikon tarik di tepi kiri kartu (kontrak owner 2026-09-20). */}
              <span className="absolute left-2 top-2 z-10 rounded-md bg-background/90 shadow-soft">
                <ReorderDragHandle
                  enabled={reorderMode && !listTersaring && row.status === "active"}
                />
              </span>
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
                    <dt className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">Sub model</dt>
                    <dd className="text-sm font-semibold tabular-nums">{formatNumber(row.sub_model_count)}</dd>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2 py-1.5">
                    <dt className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">Aktif</dt>
                    <dd className="text-sm font-semibold tabular-nums">{formatNumber(row.active_count)}</dd>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2 py-1.5">
                    <dt className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">Variasi</dt>
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
                <tr>
                  <th className="w-12 px-3 py-3" aria-label="Seret" />
                  <th className="px-3 py-3 text-center">No</th>
                  <th className="px-4 py-3 text-left">Model Produk</th>
                  <th className="px-3 py-3 text-center">Jumlah Sub Model</th>
                  <th className="px-3 py-3 text-center">Produk Aktif</th>
                  <th className="px-3 py-3 text-center">Produk Arsip</th>
                  <th className="px-3 py-3 text-center">Total Variasi</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-t border-border align-top",
                      dnd.draggingIndex === index && "opacity-40",
                      reorderMode && row.status !== "active" && "opacity-60",
                    )}
                    {...(reorderMode && !listTersaring ? dnd.rowProps(index) : {})}
                  >
                    {/* Geser hanya lewat ikon tarik di tepi kiri (kontrak owner 2026-09-20).
                        Baris nonaktif tetap punya handle tapi redup: urutan hanya berarti
                        untuk model yang tampil di toko. */}
                    <td className="w-12 px-3 py-3">
                      <ReorderDragHandle
                        enabled={
                          reorderMode && !listTersaring && row.status === "active"
                        }
                      />
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">
                      {row.no}
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
                    <td className="px-3 py-3 text-center align-middle">
                      <p className="font-semibold tabular-nums">{formatNumber(row.sub_model_count)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {row.sub_models.length ? row.sub_models.join(", ") : "-"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center align-middle tabular-nums font-semibold">{formatNumber(row.active_count)}</td>
                    <td className="px-3 py-3 text-center align-middle tabular-nums text-muted-foreground">{formatNumber(row.archived_count)}</td>
                    <td className="px-3 py-3 text-center align-middle tabular-nums font-semibold">{formatNumber(row.variant_count)}</td>
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="inline-flex items-center justify-center">
                        <StatusBadge
                          status={row.status === "active" ? "active" : "inactive"}
                          label={row.status === "active" ? "Aktif" : "Nonaktif"}
                        />
                      </div>
                    </td>
                    <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                      <ModelActions row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AdminLayout>
  )
}
