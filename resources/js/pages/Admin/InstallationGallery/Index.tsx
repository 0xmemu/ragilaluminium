import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Icon } from "@/components/shared/icon"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationType } from "@/types"

interface MediaRow {
  id: number
  media_id: number
  url: string
  thumb: string
  is_video: boolean
  caption: string
  visibility: "visible" | "hidden" | "archived"
  product_sku: string
  product_name: string
  model_label: string
  category: string
  model: string
  placement: "product" | "model" | "standalone"
  created_at?: string | null
  showUrl: string
  toggleStatusUrl: string
  archiveUrl: string
  destroyUrl: string
}

interface StatusTab {
  key: string
  label: string
  count: number
}

interface IndexProps {
  title: string
  description: string
  projects: PaginationType<MediaRow>
  tabs: StatusTab[]
  activeStatus: string
  viewMode: "list" | "grid"
  sort: string
  q: string
  createUrl: string
  reorderUrl: string
  previewUrl: string
}

const VISIBILITY_LABEL: Record<MediaRow["visibility"], string> = {
  visible: "Aktif",
  hidden: "Disembunyikan",
  archived: "Diarsipkan",
}

export default function InstallationGalleryIndex({
  title,
  description,
  projects,
  tabs = [],
  activeStatus = "all",
  viewMode = "list",
  sort = "order",
  q = "",
  createUrl,
  reorderUrl,
  previewUrl,
}: IndexProps) {
  const [search, setSearch] = React.useState(q)
  const [currentView, setCurrentView] = React.useState<"list" | "grid">(viewMode)
  const [reorderMode, setReorderMode] = React.useState(false)

  const initialRows = projects.data ?? []
  const [rows, setRows] = React.useState<MediaRow[]>(initialRows)

  React.useEffect(() => {
    setRows(projects.data ?? [])
  }, [projects.data])

  const reorderForm = useForm({
    rows: initialRows.map((r) => ({ id: r.media_id })),
  })

  const dnd = useRowDragSort({
    enabled: reorderMode,
    count: rows.length,
    onReorder: (from, to) => {
      setRows((prev) => {
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        reorderForm.setData("rows", next.map((r) => ({ id: r.media_id })))
        return next
      })
    },
  })

  function handleFilter(newParams: Record<string, string | number | null | undefined>) {
    router.get(
      route("admin.hasil-pemasangan.index"),
      {
        status: activeStatus !== "all" ? activeStatus : undefined,
        q: search || undefined,
        sort: sort !== "order" ? sort : undefined,
        view: currentView !== "list" ? currentView : undefined,
        ...newParams,
      },
      { preserveState: true, preserveScroll: true },
    )
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    handleFilter({ q: search || null, page: 1 })
  }

  function handleReorderSubmit() {
    reorderForm.put(reorderUrl, {
      preserveScroll: true,
      onSuccess: () => setReorderMode(false),
    })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {reorderMode ? (
            <>
              <Button
                variant="default"
                disabled={reorderForm.processing}
                onClick={handleReorderSubmit}
              >
                <Icon name="check" className="size-4" aria-hidden="true" />
                Simpan urutan
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setReorderMode(false)
                  setRows(projects.data ?? [])
                }}
              >
                Batal geser
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setReorderMode(true)}
                title="Atur urutan media dengan drag and drop"
              >
                <Icon name="arrows-down-up" className="size-4" aria-hidden="true" />
                Mode Geser
              </Button>
              <Button asChild variant="outline">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <Icon name="external-link" className="size-4" aria-hidden="true" />
                  Lihat Publik
                </a>
              </Button>
              <Button asChild>
                <Link href={createUrl}>
                  <Icon name="plus" className="size-4" aria-hidden="true" />
                  Tambah Pemasangan
                </Link>
              </Button>
            </>
          )}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <div className="space-y-6">
        {/* Filter Status Tabs */}
        <nav
          className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3"
          aria-label="Filter status hasil pemasangan"
        >
          {tabs.map((tab) => {
            const active = tab.key === activeStatus
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleFilter({ status: tab.key, page: 1 })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition",
                  active
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Toolbar & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={submitSearch} className="relative w-full max-w-sm">
            <Input
              type="search"
              placeholder="Cari SKU, nama model, keterangan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            <Icon
              name="search"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("")
                  handleFilter({ q: null, page: 1 })
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Hapus pencarian"
              >
                <Icon name="x" className="size-3.5" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Urutan:</span>
              <select
                value={sort}
                onChange={(e) => handleFilter({ sort: e.target.value, page: 1 })}
                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="order">Urutan Tampil (Manual)</option>
                <option value="latest">Media Terbaru</option>
              </select>
            </div>

            <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => {
                  setCurrentView("list")
                  handleFilter({ view: "list" })
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  currentView === "list"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Tampilan tabel"
              >
                <Icon name="menu" className="size-3.5" />
                <span className="hidden sm:inline">Daftar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentView("grid")
                  handleFilter({ view: "grid" })
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  currentView === "grid"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Tampilan grid"
              >
                <Icon name="layout-grid" className="size-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {reorderMode && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <Icon name="info" className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Mode Geser aktif: seret baris untuk mengubah urutan tampil media. Klik{" "}
              <strong>Simpan urutan</strong> di kanan atas setelah selesai.
            </span>
          </div>
        )}

        {/* Konten Utama */}
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <Icon name="image" className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Belum ada media hasil pemasangan
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {q
                ? `Tidak ditemukan media yang cocok dengan "${q}".`
                : "Tambahkan media hasil pemasangan untuk model, produk, atau portofolio mandiri."}
            </p>
            <div className="mt-5">
              <Button asChild size="sm">
                <Link href={createUrl}>
                  <Icon name="plus" className="size-3.5" />
                  Tambah Pemasangan
                </Link>
              </Button>
            </div>
          </div>
        ) : currentView === "list" ? (
          /* Mode Tampilan Tabel */
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] table-fixed text-left text-xs">
                <colgroup>
                  <col className="w-14" />
                  <col className="w-20" />
                  <col className="w-64" />
                  <col />
                  <col className="w-56" />
                  <col className="w-28" />
                  <col className="w-24" />
                </colgroup>
                <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="py-3 pl-4 pr-2 text-center">No</th>
                    <th className="px-3 py-3">Media</th>
                    <th className="px-3 py-3">Keterangan</th>
                    <th className="px-3 py-3">Model / Produk</th>
                    <th className="px-3 py-3">Penempatan</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="py-3 pl-2 pr-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, index) => {
                    const rowDrag = reorderMode ? dnd.rowProps(index) : {}
                    const isDragging = dnd.draggingIndex === index
                    const isTarget = dnd.targetIndex === index

                    return (
                      <tr
                        key={row.id}
                        {...rowDrag}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          reorderMode && "cursor-grab active:cursor-grabbing",
                          isDragging && "opacity-40",
                          isTarget && "border-t-2 border-primary bg-primary/5",
                        )}
                      >
                        {/* No Urut */}
                        <td className="py-3 pl-4 pr-2 text-center font-mono font-medium text-muted-foreground">
                          {reorderMode ? (
                            <span className="inline-flex items-center gap-1">
                              <Icon name="menu" className="size-3.5 text-muted-foreground" />
                              {index + 1}
                            </span>
                          ) : (
                            index + 1
                          )}
                        </td>

                        {/* Thumbnail Media */}
                        <td className="px-3 py-3">
                          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                            {row.thumb ? (
                              <img
                                src={row.thumb}
                                alt={row.caption || "Media pemasangan"}
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-muted-foreground">
                                <Icon name="image" className="size-5" />
                              </div>
                            )}
                            {row.is_video && (
                              <span
                                className="absolute bottom-1 right-1 flex size-4 items-center justify-center rounded-full bg-black/70 text-white shadow-xs"
                                title="Video"
                              >
                                <Icon name="play" className="size-2.5 fill-current" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Keterangan */}
                        <td className="px-3 py-3">
                          <p className="line-clamp-2 font-medium text-foreground">
                            {row.caption || "Tanpa keterangan"}
                          </p>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {row.created_at}
                          </div>
                        </td>

                        {/* Model / Produk */}
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1 max-w-full">
                            <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground">
                              <Icon name="layers" className="size-3 shrink-0 text-muted-foreground" />
                              <span className="truncate font-medium text-foreground">
                                {row.model_label}
                              </span>
                            </div>
                            {row.product_sku && (
                              <div className="text-[10px] text-muted-foreground font-mono truncate">
                                SKU: {row.product_sku}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Penempatan */}
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                              row.placement === "product"
                                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                : row.placement === "model"
                                  ? "bg-sky-500/15 text-sky-800 dark:text-sky-300"
                                  : "bg-purple-500/15 text-purple-800 dark:text-purple-300",
                            )}
                          >
                            {row.placement === "product"
                              ? "Produk (SKU)"
                              : row.placement === "model"
                                ? "Model saja"
                                : "Mandiri"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                              row.visibility === "visible"
                                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                : row.visibility === "hidden"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
                            )}
                          >
                            {VISIBILITY_LABEL[row.visibility]}
                          </span>
                        </td>

                        {/* Aksi Dropdown */}
                        <td className="py-3 pl-2 pr-4 text-right whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2.5 text-xs font-medium border-border hover:bg-muted text-foreground"
                                aria-label={`Aksi untuk media #${row.media_id}`}
                              >
                                <span>Aksi</span>
                                <Icon name="dots-three-vertical" className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 text-xs">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.patch(
                                    row.toggleStatusUrl,
                                    {},
                                    { preserveScroll: true },
                                  )
                                }
                                className="cursor-pointer"
                              >
                                <Icon
                                  name={row.visibility === "visible" ? "eye-slash" : "eye"}
                                  className="mr-2 size-3.5"
                                />
                                {row.visibility === "visible" ? "Sembunyikan" : "Tampilkan"}
                              </DropdownMenuItem>
                              {row.visibility !== "archived" && (
                                <DropdownMenuItem asChild>
                                  <ConfirmAction
                                    trigger={
                                      <button
                                        type="button"
                                        className="flex w-full items-center px-2 py-1.5 text-xs text-amber-700 hover:bg-muted"
                                      >
                                        <Icon name="archive" className="mr-2 size-3.5" />
                                        Arsipkan media
                                      </button>
                                    }
                                    title="Arsipkan media?"
                                    description="Media ini akan keluar dari halaman publik hasil pemasangan."
                                    confirmLabel="Arsipkan"
                                    onConfirm={() =>
                                      router.post(row.archiveUrl, {}, { preserveScroll: true })
                                    }
                                  />
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <ConfirmAction
                                  trigger={
                                    <button
                                      type="button"
                                      className="flex w-full items-center px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                                    >
                                      <Icon name="trash" className="mr-2 size-3.5" />
                                      Hapus media
                                    </button>
                                  }
                                  title="Hapus media?"
                                  description="Hapus media ini secara permanen? Tindakan tidak dapat dibatalkan."
                                  confirmLabel="Hapus"
                                  variant="destructive"
                                  onConfirm={() =>
                                    router.delete(row.destroyUrl, { preserveScroll: true })
                                  }
                                />
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Mode Tampilan Grid */
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <article
                key={row.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:shadow-md"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {row.thumb ? (
                    <img
                      src={row.thumb}
                      alt={row.caption || "Media pemasangan"}
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <Icon name="image" className="size-8" />
                    </div>
                  )}

                  <div className="absolute right-2.5 top-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur-xs",
                        row.visibility === "visible"
                          ? "bg-emerald-600/80 text-white"
                          : "bg-zinc-700/80 text-white",
                      )}
                    >
                      {VISIBILITY_LABEL[row.visibility]}
                    </span>
                  </div>

                  {row.is_video && (
                    <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                      <Icon name="play" className="size-3 fill-current" />
                      Video
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <p className="text-sm font-semibold text-foreground line-clamp-2">
                    {row.caption || "Tanpa keterangan"}
                  </p>

                  <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Icon name="layers" className="size-3" />
                    <span className="truncate">{row.model_label}</span>
                  </div>
                  {row.product_sku && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground font-mono truncate">
                      SKU: {row.product_sku}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between border-t border-border pt-3 mt-3">
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        row.placement === "product"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : row.placement === "model"
                            ? "text-sky-700 dark:text-sky-400"
                            : "text-purple-700 dark:text-purple-400",
                      )}
                    >
                      {row.placement === "product"
                        ? "Produk (SKU)"
                        : row.placement === "model"
                          ? "Model saja"
                          : "Mandiri"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        {projects.links && projects.links.length > 3 && (
          <div className="pt-2">
            <Pagination pagination={projects} />
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
