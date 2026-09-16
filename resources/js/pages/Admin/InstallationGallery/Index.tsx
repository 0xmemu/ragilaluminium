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
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationType } from "@/types"

interface ProjectRow {
  id: number
  title: string
  slug: string
  category_label?: string | null
  description?: string | null
  status: "active" | "inactive" | "archived"
  sort_order: number
  main_image_url?: string | null
  main_video_url?: string | null
  gallery_count: number
  model_product?: {
    id: number
    name: string
    category: string
    model: string
  } | null
  specifications: Array<{ name: string; value: string }>
  features: string[]
  created_at?: string | null
  showUrl: string
  editUrl: string
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
  projects: PaginationType<ProjectRow>
  tabs: StatusTab[]
  activeStatus: string
  viewMode: "list" | "grid"
  sort: string
  q: string
  createUrl: string
  reorderUrl: string
  previewUrl: string
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
  const [rows, setRows] = React.useState<ProjectRow[]>(initialRows)

  React.useEffect(() => {
    setRows(projects.data ?? [])
  }, [projects.data])

  const reorderForm = useForm({
    rows: initialRows.map((r, i) => ({ id: r.id, sort_order: i + 1 })),
  })

  const dnd = useRowDragSort({
    enabled: reorderMode,
    count: rows.length,
    onReorder: (from, to) => {
      setRows((prev) => {
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        reorderForm.setData(
          "rows",
          next.map((r, i) => ({ id: r.id, sort_order: i + 1 })),
        )
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
                title="Atur urutan proyek dengan drag and drop"
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
              placeholder="Cari nama proyek, kategori, deskripsi..."
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
            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Urutan:</span>
              <select
                value={sort}
                onChange={(e) => handleFilter({ sort: e.target.value, page: 1 })}
                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="order">Urutan Tampil (Manual)</option>
                <option value="latest">Proyek Terbaru</option>
              </select>
            </div>

            {/* View Mode Switcher */}
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
              Mode Geser aktif: Seret baris untuk mengubah urutan nomor hasil pemasangan. Klik{" "}
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
              Belum ada data hasil pemasangan
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {q
                ? `Tidak ditemukan proyek yang cocok dengan "${q}".`
                : "Mulai tambahkan portofolio hasil pemasangan untuk menampilkan karya Anda."}
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
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="w-12 py-3 pl-4 pr-2 text-center">No</th>
                    <th className="w-24 px-3 py-3">Media</th>
                    <th className="min-w-[16rem] px-3 py-3">Nama Proyek</th>
                    <th className="min-w-[14rem] px-3 py-3">Deskripsi</th>
                    <th className="w-40 px-3 py-3">Model Produk</th>
                    <th className="w-28 px-3 py-3">Status</th>
                    <th className="w-16 py-3 pl-2 pr-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((project, index) => {
                    const rowDrag = reorderMode ? dnd.rowProps(index) : {}
                    const isDragging = dnd.draggingIndex === index
                    const isTarget = dnd.targetIndex === index

                    return (
                      <tr
                        key={project.id}
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
                            project.sort_order || index + 1
                          )}
                        </td>

                        {/* Thumbnail Media */}
                        <td className="px-3 py-3">
                          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                            {project.main_image_url ? (
                              <img
                                src={project.main_image_url}
                                alt={project.title}
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-muted-foreground">
                                <Icon name="image" className="size-5" />
                              </div>
                            )}
                            {project.main_video_url && (
                              <span
                                className="absolute bottom-1 right-1 flex size-4 items-center justify-center rounded-full bg-black/70 text-white shadow-xs"
                                title="Memiliki video"
                              >
                                <Icon name="play" className="size-2.5 fill-current" />
                              </span>
                            )}
                            {project.gallery_count > 0 && (
                              <span
                                className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white"
                                title={`${project.gallery_count} foto tambahan`}
                              >
                                +{project.gallery_count}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Nama & Sub-judul */}
                        <td className="px-3 py-3">
                          <div className="font-semibold text-foreground">
                            <Link
                              href={project.showUrl}
                              className="hover:text-primary transition-colors"
                            >
                              {project.title}
                            </Link>
                          </div>
                          {project.category_label && (
                            <div className="mt-0.5 text-[11px] text-muted-foreground font-medium">
                              {project.category_label}
                            </div>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {project.specifications?.slice(0, 2).map((s, i) => (
                              <span
                                key={i}
                                className="inline-block rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {s.name}: {s.value}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Deskripsi */}
                        <td className="px-3 py-3">
                          <p className="line-clamp-2 text-muted-foreground leading-relaxed">
                            {project.description || "—"}
                          </p>
                        </td>

                        {/* Tautan Model Produk */}
                        <td className="px-3 py-3">
                          {project.model_product ? (
                            <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground">
                              <Icon name="layers" className="size-3 text-muted-foreground" />
                              <span className="truncate max-w-[10rem]">
                                {project.model_product.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <StatusBadge status={project.status} />
                        </td>

                        {/* Aksi Dropdown */}
                        <td className="py-3 pl-2 pr-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label={`Aksi untuk ${project.title}`}
                              >
                                <Icon name="dots-three-vertical" className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 text-xs">
                              <DropdownMenuItem asChild>
                                <Link href={project.showUrl} className="cursor-pointer">
                                  <Icon name="eye" className="mr-2 size-3.5" />
                                  Lihat detail
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={project.editUrl} className="cursor-pointer">
                                  <Icon name="pencil" className="mr-2 size-3.5" />
                                  Edit proyek
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.patch(
                                    project.toggleStatusUrl,
                                    {},
                                    { preserveScroll: true },
                                  )
                                }
                                className="cursor-pointer"
                              >
                                <Icon
                                  name={project.status === "active" ? "eye-slash" : "eye"}
                                  className="mr-2 size-3.5"
                                />
                                {project.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                              </DropdownMenuItem>
                              {project.status !== "archived" && (
                                <DropdownMenuItem asChild>
                                  <ConfirmAction
                                    trigger={
                                      <button
                                        type="button"
                                        className="flex w-full items-center px-2 py-1.5 text-xs text-amber-700 hover:bg-muted"
                                      >
                                        <Icon name="archive" className="mr-2 size-3.5" />
                                        Arsipkan proyek
                                      </button>
                                    }
                                    title="Arsipkan proyek?"
                                    description={`Proyek "${project.title}" akan disembunyikan dari publik.`}
                                    confirmLabel="Arsipkan"
                                    onConfirm={() =>
                                      router.post(project.archiveUrl, {}, { preserveScroll: true })
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
                                      Hapus proyek
                                    </button>
                                  }
                                  title="Hapus proyek?"
                                  description={`Hapus portofolio "${project.title}" secara permanen? Tindakan ini tidak dapat dibatalkan.`}
                                  confirmLabel="Hapus"
                                  variant="destructive"
                                  onConfirm={() =>
                                    router.delete(project.destroyUrl, { preserveScroll: true })
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
            {rows.map((project) => (
              <article
                key={project.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:shadow-md"
              >
                {/* Media Card Top */}
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {project.main_image_url ? (
                    <img
                      src={project.main_image_url}
                      alt={project.title}
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <Icon name="image" className="size-8" />
                    </div>
                  )}

                  {/* Status Overlay */}
                  <div className="absolute right-2.5 top-2.5">
                    <StatusBadge status={project.status} />
                  </div>

                  {/* Video Badge */}
                  {project.main_video_url && (
                    <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                      <Icon name="play" className="size-3 fill-current" />
                      Video
                    </span>
                  )}

                  {project.gallery_count > 0 && (
                    <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                      <Icon name="images" className="size-3" />+{project.gallery_count}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {project.category_label && (
                        <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {project.category_label}
                        </span>
                      )}
                      <h4 className="mt-1.5 font-semibold text-foreground line-clamp-1">
                        <Link
                          href={project.showUrl}
                          className="hover:text-primary transition-colors"
                        >
                          {project.title}
                        </Link>
                      </h4>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      #{project.sort_order}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                    {project.description || "Tidak ada deskripsi."}
                  </p>

                  {/* Model & Specs */}
                  {project.model_product && (
                    <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Icon name="layers" className="size-3" />
                      <span className="truncate">{project.model_product.name}</span>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                      <Link href={project.editUrl}>
                        <Icon name="pencil" className="size-3 mr-1" />
                        Edit
                      </Link>
                    </Button>

                    <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                      <Link href={project.showUrl}>
                        Detail
                        <Icon name="arrow-right" className="size-3 ml-1" />
                      </Link>
                    </Button>
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
